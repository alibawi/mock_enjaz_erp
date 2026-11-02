// Plan doc 16 — schedule generated from a Finance payment term, and approved defer/split/merge after Draft (BR-PI-01…14).
// Contracts own the billing schedule; invoice installments, their deferral and payment stay in Finance.
import { addDays, today } from './asof'
import { nowStamp, uid } from './format'
import { billingFor, itemsOf, nextItemNo } from './payments'
import { can as canRole } from './permissions'
import { getSetting } from './settings'
import type { Contract, DB, PaymentItem, PaymentKind, PaymentTerm, ScheduleChange, ScheduleChangeKind, ScheduleChangeLine, ScheduleChangeStatus } from './types'

export const changeKindLabel: Record<ScheduleChangeKind, string> = { Defer: 'تأجيل', Split: 'تقسيم', Merge: 'دمج' }
export const changeStatusLabel: Record<ScheduleChangeStatus, string> = { Pending: 'بانتظار الاعتماد', Approved: 'معتمد ومطبّق', Rejected: 'مرفوض', Withdrawn: 'مسحوب' }
export const changeStatusTone: Record<ScheduleChangeStatus, 'amber' | 'green' | 'red' | 'gray'> = { Pending: 'amber', Approved: 'green', Rejected: 'red', Withdrawn: 'gray' }

const audit = (d: DB, contractId: string, action: string, detail: string) =>
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: contractId, action, detail })
const decimalsOf = (db: DB, c: Contract) => db.currencies.find((x) => x.code === c.currency)?.decimals ?? 0
const roundTo = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp
const pct = (c: Contract, amount: number) => (c.contractValue ? roundTo((amount / c.contractValue) * 100, 2) : undefined)
const closed = (c: Contract) => ['Cancelled', 'Terminated', 'Closed', 'Expired'].includes(c.status)
/** Draft schedules are edited directly; after Draft every date/amount change is a schedule change (BR-PI-04). */
export const directEdit = (c: Contract) => c.status === 'Draft'

/** A term without installments is one installment of 100 % at its base days. */
export const termInstallments = (t: PaymentTerm) => (t.installments?.length ? t.installments : [{ no: 1, percent: 100, days: t.days, description: t.name }])
export const hasInstallments = (t: PaymentTerm) => (t.installments?.length ?? 0) > 1

// ───────────── BR-PI-01/02: generate from a payment term ─────────────
export function previewFromTerm(db: DB, c: Contract, termId: string, baseDate: string): PaymentItem[] {
  const t = db.paymentTerms.find((x) => x.id === termId)
  if (!t || !c.contractValue) return []
  const inst = termInstallments(t)
  const dp = decimalsOf(db, c)
  let used = 0
  return inst.map((x, i): PaymentItem => {
    const last = i === inst.length - 1
    const amount = last ? roundTo(c.contractValue! - used, dp) : roundTo((c.contractValue! * x.percent) / 100, dp)
    used += amount
    const kind: PaymentKind = inst.length === 1 ? 'Final' : x.days === 0 && i === 0 ? 'Advance' : last ? 'Final' : 'Periodic'
    return {
      id: uid('pay'), contractId: c.id, itemNo: i + 1, kind, dueDate: addDays(baseDate, x.days), percent: x.percent, amount, currency: c.currency,
      status: 'Planned', billingDocType: billingFor(c)[0], notes: x.description ?? `${t.name} — قسط ${x.no}`, sourceTermId: t.id, sourceInstallmentNo: x.no,
    }
  })
}

export function generateBlocker(db: DB, c: Contract): string | undefined {
  if (!directEdit(c)) return 'بعد خروج العقد من المسودة يُغيَّر الجدول بطلب تقسيم/دمج أو بملحق'
  if (!c.contractValue) return 'أدخل قيمة العقد أولاً'
  if (itemsOf(db, c.id).some((i) => i.status === 'Invoiced' || i.status === 'Paid')) return 'يوجد قسط مفوتر — لا يُعاد توليد الجدول'
  return undefined
}

/** Replaces the Planned items with the generated ones (the copy is not linked to later changes of the term). */
export function generateFromTerm(d: DB, contractId: string, termId: string, baseDate: string): string | null {
  const c = d.contracts.find((x) => x.id === contractId)
  if (!c) return 'العقد غير موجود'
  const blocked = generateBlocker(d, c)
  if (blocked) return blocked
  if (!baseDate) return 'تاريخ الأساس مطلوب'
  const items = previewFromTerm(d, c, termId, baseDate)
  if (!items.length) return 'شرط الدفع غير موجود'
  d.paymentItems = d.paymentItems.filter((i) => i.contractId !== c.id).concat(items)
  audit(d, c.id, 'payment:generate', `${d.paymentTerms.find((t) => t.id === termId)!.name} — ${items.length} قسط من ${baseDate}`)
  return null
}

// ───────────── BR-PI-04…10: schedule change requests ─────────────
export const openChangeFor = (db: DB, itemId: string) => db.scheduleChanges.find((x) => x.status === 'Pending' && x.itemIds.includes(itemId))
export const changesOf = (db: DB, contractId: string) => db.scheduleChanges.filter((x) => x.contractId === contractId).sort((a, b) => b.changeNo - a.changeNo)
export const maxDeferrals = (db: DB) => Number(getSetting(db, 'Schedule.MaxDeferralsPerItem'))
/** Planned items (including overdue ones, derived `Due`) are the only ones a change may touch. */
export const changeable = (it: PaymentItem) => it.status === 'Planned'

export interface ChangeInput { contractId: string; kind: ScheduleChangeKind; itemIds: string[]; lines: ScheduleChangeLine[]; reason: string }

export function validateChange(db: DB, x: ChangeInput, ignoreId?: string): string[] {
  const e: string[] = []
  const c = db.contracts.find((k) => k.id === x.contractId)
  if (!c) return ['العقد غير موجود']
  if (directEdit(c)) return ['العقد مسودة — عدّل الجدول مباشرة دون طلب']
  if (closed(c)) return ['العقد غير ساري']
  if (!x.reason.trim()) e.push('السبب مطلوب')
  const items = x.itemIds.map((id) => db.paymentItems.find((p) => p.id === id && p.contractId === c.id))
  if (items.some((i) => !i)) return [...e, 'قسط غير موجود في هذا العقد']
  const its = items as PaymentItem[]
  its.forEach((i) => {
    if (!changeable(i)) e.push(`القسط ${i.itemNo} مفوتر أو ملغى — تغييره في المالية أو بملحق`)
    const open = openChangeFor(db, i.id)
    if (open && open.id !== ignoreId) e.push(`القسط ${i.itemNo} في طلب مفتوح رقم ${open.changeNo}`)
  })
  const beyondOk = !c.endDate || getSetting<boolean>(db, 'Schedule.AllowBeyondEndDate')
  x.lines.forEach((l, n) => {
    if (!l.newDueDate) e.push(`التاريخ مطلوب (سطر ${n + 1})`)
    else if (!beyondOk && l.newDueDate > c.endDate!) e.push(`التاريخ ${l.newDueDate} بعد انتهاء العقد ${c.endDate}`)
  })
  const dp = decimalsOf(db, c), tol = dp ? 0.005 : 0.5
  if (x.kind === 'Defer') {
    if (its.length !== 1 || x.lines.length !== 1) e.push('التأجيل لقسط واحد')
    else {
      const it = its[0], l = x.lines[0]
      if (l.newDueDate && l.newDueDate <= it.dueDate) e.push('التاريخ الجديد يجب أن يكون بعد تاريخ الاستحقاق الحالي')
      if ((it.rescheduleCount ?? 0) >= maxDeferrals(db)) e.push(`بلغ القسط الحد الأقصى للتأجيل (${maxDeferrals(db)}) — التأجيل بعده بملحق`)
      if (Math.abs(l.newAmount - it.amount) > tol) e.push('التأجيل لا يغيّر المبلغ — تغيير المبلغ بملحق')
    }
  }
  if (x.kind === 'Split') {
    if (its.length !== 1) e.push('التقسيم لقسط واحد')
    else if (x.lines.length < 2 || x.lines.length > 12) e.push('التقسيم من 2 إلى 12 جزءاً')
    else {
      if (x.lines.some((l) => !(l.newAmount > 0))) e.push('كل جزء أكبر من صفر')
      const sum = x.lines.reduce((s, l) => s + l.newAmount, 0)
      if (Math.abs(sum - its[0].amount) > tol) e.push(`مجموع الأجزاء ${roundTo(sum, dp)} لا يساوي مبلغ القسط ${its[0].amount}`)
    }
  }
  if (x.kind === 'Merge') {
    if (its.length < 2) e.push('الدمج لقسطين أو أكثر')
    if (x.lines.length !== 1) e.push('الدمج ينتج قسطاً واحداً')
    else if (its.length >= 2 && Math.abs(x.lines[0].newAmount - its.reduce((s, i) => s + i.amount, 0)) > tol) e.push('مبلغ القسط المدمج يساوي مجموع الأقساط')
  }
  return e
}

/** Builds the result lines of a request from the current items (UI helper). */
export function changeLines(db: DB, kind: ScheduleChangeKind, itemIds: string[], parts: { dueDate: string; amount: number }[]): ScheduleChangeLine[] {
  const its = itemIds.map((id) => db.paymentItems.find((p) => p.id === id)!).filter(Boolean)
  if (kind === 'Merge') return [{ itemId: its[0]?.id, oldDueDate: its[0]?.dueDate, oldAmount: its.reduce((s, i) => s + i.amount, 0), newDueDate: parts[0]?.dueDate ?? '', newAmount: its.reduce((s, i) => s + i.amount, 0) }]
  const it = its[0]
  if (kind === 'Defer') return [{ itemId: it?.id, oldDueDate: it?.dueDate, oldAmount: it?.amount, newDueDate: parts[0]?.dueDate ?? '', newAmount: it?.amount ?? 0 }]
  return parts.map((p, n) => (n === 0 ? { itemId: it?.id, oldDueDate: it?.dueDate, oldAmount: it?.amount, newDueDate: p.dueDate, newAmount: p.amount } : { newDueDate: p.dueDate, newAmount: p.amount }))
}

export function requestChange(d: DB, x: ChangeInput): string | null {
  const errs = validateChange(d, x)
  if (errs.length) return errs.join(' — ')
  const no = Math.max(0, ...d.scheduleChanges.filter((k) => k.contractId === x.contractId).map((k) => k.changeNo)) + 1
  const ch: ScheduleChange = { id: uid('sch'), contractId: x.contractId, changeNo: no, kind: x.kind, status: 'Pending', reason: x.reason.trim(), itemIds: [...x.itemIds], lines: structuredClone(x.lines), requestedBy: d.userId, requestedAt: nowStamp() }
  d.scheduleChanges.push(ch)
  audit(d, x.contractId, 'schedule:request', `${changeKindLabel[x.kind]} #${no}`)
  return null
}

export function changeEligibility(db: DB, ch: ScheduleChange): { ok: boolean; reason?: string } {
  if (ch.status !== 'Pending') return { ok: false, reason: 'الطلب ليس بانتظار الاعتماد' }
  if (ch.requestedBy === db.userId) return { ok: false, reason: 'مقدّم الطلب لا يعتمده (فصل المهام)' }
  const role = db.users.find((u) => u.id === db.userId)?.role ?? db.role
  if (!canRole(db.rolePerms, role, 'Schedule.ApproveChange')) return { ok: false, reason: 'لا تملك صلاحية اعتماد تغيير الجدول' }
  return { ok: true }
}

function apply(d: DB, c: Contract, ch: ScheduleChange) {
  const get = (id: string) => d.paymentItems.find((p) => p.id === id)!
  if (ch.kind === 'Defer') {
    const it = get(ch.itemIds[0])
    it.originalDueDate ??= it.dueDate
    it.dueDate = ch.lines[0].newDueDate
    it.rescheduleCount = (it.rescheduleCount ?? 0) + 1
  }
  if (ch.kind === 'Split') {
    const it = get(ch.itemIds[0])
    const basePct = it.percent
    let rest = basePct ?? 0
    ch.lines.forEach((l, n) => {
      const share = basePct === undefined ? undefined : n === ch.lines.length - 1 ? roundTo(rest, 2) : roundTo((basePct * l.newAmount) / it.amount, 2)
      if (share !== undefined) rest -= share
      if (n === 0) { l.newItemNo = it.itemNo; return }
      const nx: PaymentItem = { ...structuredClone(it), id: uid('pay'), itemNo: nextItemNo(d, c.id), dueDate: l.newDueDate, amount: l.newAmount, percent: share, obligationId: undefined, splitFromId: it.id, originalDueDate: undefined, rescheduleCount: 0, notes: `جزء من القسط ${it.itemNo}` }
      d.paymentItems.push(nx)
      l.newItemNo = nx.itemNo
    })
    const first = ch.lines[0]
    if (it.dueDate !== first.newDueDate) it.originalDueDate ??= it.dueDate
    it.percent = basePct === undefined ? undefined : roundTo((basePct * first.newAmount) / first.oldAmount!, 2)
    it.amount = first.newAmount; it.dueDate = first.newDueDate
  }
  if (ch.kind === 'Merge') {
    const its = ch.itemIds.map(get).sort((a, b) => a.itemNo - b.itemNo)
    const [keep, ...rest] = its
    keep.originalDueDate ??= keep.dueDate
    keep.amount = ch.lines[0].newAmount; keep.dueDate = ch.lines[0].newDueDate
    keep.percent = its.every((i) => i.percent !== undefined) ? roundTo(its.reduce((s, i) => s + i.percent!, 0), 2) : pct(c, keep.amount)
    rest.forEach((i) => { i.status = 'Cancelled'; i.notes = `دُمج في القسط ${keep.itemNo}` })
    ch.lines[0].newItemNo = keep.itemNo
  }
}

/** BR-PI-09: approve applies the change in the same step; rejection needs a comment. Revalidated at decision time (stale requests are refused). */
export function decideChange(d: DB, id: string, approve: boolean, comment = ''): string | null {
  const ch = d.scheduleChanges.find((x) => x.id === id)
  if (!ch) return 'الطلب غير موجود'
  const el = changeEligibility(d, ch)
  if (!el.ok) return el.reason!
  if (!approve && !comment.trim()) return 'سبب الرفض مطلوب'
  if (approve) {
    const errs = validateChange(d, ch, ch.id)
    if (errs.length) return `تغيّر الجدول منذ تقديم الطلب: ${errs.join(' — ')}`
    apply(d, d.contracts.find((c) => c.id === ch.contractId)!, ch)
  }
  ch.status = approve ? 'Approved' : 'Rejected'; ch.decidedBy = d.userId; ch.decidedAt = nowStamp(); ch.comment = comment.trim() || undefined
  audit(d, ch.contractId, approve ? 'schedule:approve' : 'schedule:reject', `${changeKindLabel[ch.kind]} #${ch.changeNo}`)
  return null
}

export function withdrawChange(d: DB, id: string): string | null {
  const ch = d.scheduleChanges.find((x) => x.id === id)
  if (!ch || ch.status !== 'Pending') return 'لا يُسحب إلا طلب معلّق'
  if (ch.requestedBy !== d.userId) return 'يسحب الطلب مقدّمه فقط'
  ch.status = 'Withdrawn'; ch.decidedAt = nowStamp()
  audit(d, ch.contractId, 'schedule:withdraw', `#${ch.changeNo}`)
  return null
}

/** BR-PI-14: termination cancels the unbilled items and withdraws open requests; billed items stay. */
export function cancelScheduleOnTermination(d: DB, c: Contract): number {
  let n = 0
  d.paymentItems.filter((i) => i.contractId === c.id && i.status === 'Planned').forEach((i) => { i.status = 'Cancelled'; i.notes = `${i.notes ? `${i.notes} — ` : ''}أُلغي بإنهاء العقد`; n++ })
  d.scheduleChanges.filter((x) => x.contractId === c.id && x.status === 'Pending').forEach((x) => { x.status = 'Withdrawn'; x.comment = 'سُحب بإنهاء العقد'; x.decidedAt = nowStamp() })
  return n
}

/** Unbilled items past their date (InstallmentOverdue rule, doc 11). */
export const overdueDays = (it: PaymentItem, on = today()) => (it.status === 'Planned' && it.dueDate < on ? Math.round((Date.parse(on) - Date.parse(it.dueDate)) / 86400000) : 0)
