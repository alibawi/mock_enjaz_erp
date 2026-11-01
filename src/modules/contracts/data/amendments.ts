// Amendment engine (spec BR-M-01…06, 10): effective-dated amendments, write-once versions with a short hash, field-level diff.
// Independent of lifecycle.ts (which calls createVersion on activation) so the modules do not import each other in a cycle.
import { addDays, diffDays, today } from './asof'
import { decide, openRequest, startApproval } from './approval'
import { nowStamp, uid } from './format'
import { balanceOf, committedUnits, committedValue, counterUnits } from './fulfillment'
import { getSetting } from './settings'
import type {
  AmendmentStatus, AmendmentType, Contract, ContractAmendment, ContractVersion, DB, HeaderChange, HeaderField, LineFields, VersionPayload,
} from './types'

export const amendTypeLabel: Record<AmendmentType, string> = {
  ExtendTerm: 'تمديد المدة', ChangeValue: 'تغيير القيمة', ChangeLines: 'تعديل البنود', ChangeParties: 'تعديل الأطراف', ChangeTerms: 'تعديل الشروط', Other: 'أخرى',
}
export const amendStatusLabel: Record<AmendmentStatus, string> = {
  Draft: 'مسودة', PendingApproval: 'بانتظار الاعتماد', Approved: 'معتمد', Applied: 'مُطبَّق', Rejected: 'مرفوض', Cancelled: 'ملغى',
}
export const amendStatusTone: Record<AmendmentStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray', PendingApproval: 'amber', Approved: 'blue', Applied: 'green', Rejected: 'red', Cancelled: 'gray',
}
export const headerFields: { key: HeaderField; label: string; kind: 'date' | 'number' | 'text' | 'renewal' | 'paymentTerm'; group: 'header' | 'terms' }[] = [
  { key: 'endDate', label: 'تاريخ النهاية', kind: 'date', group: 'header' },
  { key: 'contractValue', label: 'قيمة العقد', kind: 'number', group: 'header' },
  { key: 'renewalPolicy', label: 'سياسة التجديد', kind: 'renewal', group: 'header' },
  { key: 'noticePeriodDays', label: 'مدة الإشعار (يوم)', kind: 'number', group: 'header' },
  { key: 'autoRenewTermMonths', label: 'مدة التجديد التلقائي (شهر)', kind: 'number', group: 'header' },
  { key: 'deliveryTerms', label: 'شروط التسليم', kind: 'text', group: 'terms' },
  { key: 'paymentTermId', label: 'شرط الدفع', kind: 'paymentTerm', group: 'terms' },
  { key: 'description', label: 'الوصف', kind: 'text', group: 'terms' },
]
export const fieldLabel = (k: string) => headerFields.find((f) => f.key === k)?.label ?? k

const isOpen = (s: AmendmentStatus) => s === 'Draft' || s === 'PendingApproval' || s === 'Approved'
export const openAmendment = (db: DB, contractId: string) => db.amendments.find((a) => a.contractId === contractId && isOpen(a.status))
export const amendmentsOf = (db: DB, contractId: string) => db.amendments.filter((a) => a.contractId === contractId).sort((a, b) => b.amendmentNo - a.amendmentNo)
export const versionsOf = (db: DB, contractId: string) => db.versions.filter((v) => v.contractId === contractId).sort((a, b) => b.versionNo - a.versionNo)

// ───────────── versions and hash (BR-M-02, BR-M-10) ─────────────
/** Frozen copy of everything an amendment can change. */
export function snapshot(d: DB, c: Contract): VersionPayload {
  const pick = <T extends object, K extends keyof T>(o: T, ...k: K[]) => Object.fromEntries(k.map((x) => [x, o[x]])) as Pick<T, K>
  return structuredClone({
    header: { startDate: c.startDate, endDate: c.endDate, contractValue: c.contractValue, currency: c.currency, renewalPolicy: c.renewalPolicy, noticePeriodDays: c.noticePeriodDays, autoRenewTermMonths: c.autoRenewTermMonths },
    terms: { deliveryTerms: c.deliveryTerms, paymentTermId: c.paymentTermId, description: c.description },
    parties: d.parties.filter((p) => p.contractId === c.id).map((p) => pick(p, 'id', 'role', 'name', 'contactName', 'email', 'phone', 'signatoryTitle')),
    lines: d.lines.filter((l) => l.contractId === c.id).sort((a, b) => a.lineNum - b.lineNum)
      .map((l) => pick(l, 'lineNum', 'itemId', 'categoryId', 'description', 'commitmentType', 'agreedQuantity', 'agreedValue', 'unitPrice', 'discountPercent', 'minRelease', 'maxRelease', 'validTo', 'status', 'notes')),
    signatures: d.signatures.filter((s) => s.contractId === c.id).map((s) => ({ role: s.role, signerName: s.signerName, signedOn: s.signedOn })),
    clauses: d.terms.filter((t) => t.contractId === c.id).sort((a, b) => a.order - b.order).map((t) => ({ order: t.order, title: t.title, body: t.body, isIncluded: t.isIncluded })),
  })
}
const stable = (v: unknown): string => (Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v as object).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v ?? null))
/** Short display hash (cyrb53, not cryptographic — plan gap logged). */
export function hashOf(p: VersionPayload): string {
  const s = stable(p)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}
export const hashValid = (v: ContractVersion) => hashOf(v.payload) === v.payloadHash

/** Writes the immutable version row for the contract's current `versionNo`. */
export function createVersion(d: DB, c: Contract, reason: ContractVersion['reason'], amendmentId?: string, createdOn = nowStamp()) {
  const payload = snapshot(d, c)
  d.versions.push({ id: `ver-${c.id}-${c.versionNo}`, contractId: c.id, versionNo: c.versionNo, reason, amendmentId, payload, payloadHash: hashOf(payload), createdOn, createdBy: d.userId })
}

// ───────────── diff (BR-M-06) ─────────────
export interface DiffRow { group: 'header' | 'lines' | 'terms' | 'parties'; label: string; from?: string; to?: string; kind: 'changed' | 'added' | 'removed' }
const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v))
export function diffPayloads(db: DB, a: VersionPayload, b: VersionPayload): DiffRow[] {
  const out: DiffRow[] = []
  const rec = (group: 'header' | 'terms', x: Record<string, unknown>, y: Record<string, unknown>) =>
    Object.keys({ ...x, ...y }).forEach((k) => {
      if (stable(x[k]) === stable(y[k])) return
      const f = (v: unknown) => (k === 'paymentTermId' ? db.paymentTerms.find((p) => p.id === v)?.name ?? show(v) : show(v))
      out.push({ group, label: k === 'startDate' ? 'تاريخ البداية' : k === 'currency' ? 'العملة' : fieldLabel(k), from: f(x[k]), to: f(y[k]), kind: 'changed' })
    })
  rec('header', a.header, b.header); rec('terms', a.terms, b.terms)
  const lineName = (l: VersionPayload['lines'][number]) => `بند ${l.lineNum}: ${l.description}`
  const lf: [keyof VersionPayload['lines'][number], string][] = [['agreedQuantity', 'الكمية'], ['agreedValue', 'القيمة'], ['unitPrice', 'السعر'], ['discountPercent', 'الخصم %'], ['minRelease', 'حد أدنى'], ['maxRelease', 'حد أقصى'], ['validTo', 'صلاحية حتى'], ['status', 'الحالة'], ['notes', 'ملاحظات']]
  b.lines.forEach((l) => {
    const o = a.lines.find((x) => x.lineNum === l.lineNum)
    if (!o) { out.push({ group: 'lines', label: lineName(l), to: l.commitmentType === 'Quantity' ? `${show(l.agreedQuantity)} × ${show(l.unitPrice)}` : show(l.agreedValue), kind: 'added' }); return }
    lf.forEach(([k, t]) => { if (stable(o[k]) !== stable(l[k])) out.push({ group: 'lines', label: `${lineName(l)} — ${t}`, from: show(k === 'status' ? (o[k] === 'Open' ? 'مفتوح' : 'مغلق') : o[k]), to: show(k === 'status' ? (l[k] === 'Open' ? 'مفتوح' : 'مغلق') : l[k]), kind: 'changed' }) })
  })
  a.lines.filter((l) => !b.lines.some((x) => x.lineNum === l.lineNum)).forEach((l) => out.push({ group: 'lines', label: lineName(l), from: show(l.agreedQuantity ?? l.agreedValue), kind: 'removed' }))
  // BR-T-07: contract terms are part of the version payload
  const ca = a.clauses ?? [], cb = b.clauses ?? []
  cb.forEach((t) => {
    const o = ca.find((x) => x.title === t.title)
    if (!o) out.push({ group: 'terms', label: `بند: ${t.title}`, to: t.isIncluded ? 'مُضاف' : 'مُضاف (مستبعد)', kind: 'added' })
    else {
      if (o.body !== t.body) out.push({ group: 'terms', label: `نص البند: ${t.title}`, from: o.body.slice(0, 80), to: t.body.slice(0, 80), kind: 'changed' })
      if (o.isIncluded !== t.isIncluded) out.push({ group: 'terms', label: `تضمين البند: ${t.title}`, from: o.isIncluded ? 'مضمَّن' : 'مستبعد', to: t.isIncluded ? 'مضمَّن' : 'مستبعد', kind: 'changed' })
    }
  })
  ca.filter((t) => !cb.some((x) => x.title === t.title)).forEach((t) => out.push({ group: 'terms', label: `بند: ${t.title}`, from: 'موجود', kind: 'removed' }))
  b.parties.forEach((p) => {
    const o = a.parties.find((x) => x.id === p.id)
    if (!o) { out.push({ group: 'parties', label: `${p.name}`, to: `${p.contactName} — ${p.signatoryTitle}`, kind: 'added' }); return }
    ;(['name', 'contactName', 'email', 'phone', 'signatoryTitle'] as const).forEach((k) => {
      if (o[k] !== p[k]) out.push({ group: 'parties', label: `${p.name} — ${{ name: 'الاسم', contactName: 'الممثل', email: 'البريد', phone: 'الهاتف', signatoryTitle: 'صفة الموقّع' }[k]}`, from: show(o[k]), to: show(p[k]), kind: 'changed' })
    })
  })
  a.parties.filter((p) => !b.parties.some((x) => x.id === p.id)).forEach((p) => out.push({ group: 'parties', label: p.name, from: `${p.contactName}`, kind: 'removed' }))
  return out
}

// ───────────── validation (BR-M-01, BR-M-03, BR-M-09) ─────────────
export interface AmendIssues { errors: string[]; warnings: string[] }
export const graceLeft = (d: DB, c: Contract) => {
  const t = d.contractTypes.find((x) => x.id === c.typeId)
  const grace = t?.renewalGraceDays ?? Number(getSetting(d, 'Renewal.GraceDays'))
  return c.endDate ? diffDays(addDays(c.endDate, grace), today()) : 0
}
export function canAmendStatus(d: DB, c: Contract): string | null {
  if (c.status === 'Active' || c.status === 'OnHold') return null
  if (c.status === 'Expired') return graceLeft(d, c) >= 0 ? null : 'انتهت مدة السماح؛ التجديد بعقد جديد فقط'
  return 'الملحق متاح للعقود السارية أو المعلّقة أو المنتهية ضمن مدة السماح'
}

/** Highest of the three counters of a line, in the line's unit — a commitment may never go below it (BR-M-03). */
export const floorOf = (d: DB, lineId: string) => {
  const l = d.lines.find((x) => x.id === lineId)!, b = balanceOf(d, lineId)
  return Math.max(counterUnits(l, b, 'Release'), counterUnits(l, b, 'Fulfill'), counterUnits(l, b, 'Invoice'))
}

export function validateAmendment(d: DB, c: Contract, a: ContractAmendment): AmendIssues {
  const errors: string[] = [], warnings: string[] = []
  const st = canAmendStatus(d, c)
  if (st) errors.push(st)
  if (!a.reason.trim()) errors.push('سبب الملحق مطلوب')
  if (!a.effectiveDate) errors.push('تاريخ سريان الملحق مطلوب')
  else if (a.effectiveDate < c.startDate) errors.push('تاريخ السريان قبل بداية العقد')
  else if (a.effectiveDate < today()) warnings.push('تاريخ السريان في الماضي (سريان رجعي) — لا تتأثر المستندات والقيود القائمة')
  if (!a.header.length && !a.lineOps.length && !a.partyOps.length) errors.push('لم تُدخل أي تغيير')
  a.header.forEach((h) => {
    if (stable(h.oldValue) === stable(h.newValue)) errors.push(`${fieldLabel(h.path)}: القيمة الجديدة مطابقة للقديمة`)
    if (h.path === 'endDate') {
      if (!h.newValue) errors.push('تاريخ النهاية الجديد مطلوب')
      else if (c.endDate && String(h.newValue) <= c.endDate) errors.push('التمديد يجب أن يتجاوز تاريخ النهاية الحالي')
    }
    if (h.path === 'contractValue') {
      if (c.profile === 'Agreement') errors.push('قيمة اتفاقية الالتزام تُحتسب من بنودها — عدّل البنود')
      else if (!(Number(h.newValue) > 0)) errors.push('قيمة العقد يجب أن تكون أكبر من صفر')
    }
    if (h.path === 'renewalPolicy' && h.newValue !== 'None' && !(c.noticePeriodDays || a.header.some((x) => x.path === 'noticePeriodDays' && Number(x.newValue) > 0))) errors.push('سياسة التجديد تتطلب مدة إشعار')
  })
  a.lineOps.forEach((op) => {
    const line = op.lineNum ? d.lines.find((l) => l.contractId === c.id && l.lineNum === op.lineNum) : undefined
    if (c.profile !== 'Agreement') { errors.push('بنود الالتزام خاصة باتفاقيات الالتزام'); return }
    if (op.op !== 'Add' && !line) { errors.push(`البند ${op.lineNum} غير موجود`); return }
    if (op.op === 'Add') {
      const x = op.add
      if (!x || (!x.itemId && !x.categoryId)) errors.push('البند الجديد يتطلب صنفاً أو تصنيفاً')
      else if (x.commitmentType === 'Quantity' ? !((x.agreedQuantity ?? 0) > 0) : !((x.agreedValue ?? 0) > 0)) errors.push('البند الجديد يتطلب كمية أو قيمة أكبر من صفر')
      else if (d.lines.some((l) => l.contractId === c.id && l.status === 'Open' && ((x.itemId && l.itemId === x.itemId) || (x.categoryId && l.categoryId === x.categoryId)))) errors.push('يوجد بند مفتوح لنفس الصنف/التصنيف')
    }
    if (op.op === 'Change' && line) {
      const f = op.fields ?? {}
      const nv = line.commitmentType === 'Quantity' ? f.agreedQuantity : f.agreedValue
      if (nv !== undefined) {
        const floor = floorOf(d, line.id)
        if (nv < floor) errors.push(`البند ${line.lineNum}: لا يجوز خفض الالتزام إلى ${nv.toLocaleString('en-US')} لأنه دون المستهلك ${floor.toLocaleString('en-US')} (محجوز/منفّذ/مفوتر)`)
        else if (nv < committedUnits(line)) warnings.push(`البند ${line.lineNum}: خفض الالتزام إلى ${nv.toLocaleString('en-US')} (المستهلك ${floor.toLocaleString('en-US')})`)
      }
      if (f.unitPrice !== undefined || f.discountPercent !== undefined) warnings.push(`البند ${line.lineNum}: السعر الجديد يسري على المستندات من ${a.effectiveDate || 'تاريخ السريان'} فصاعداً فقط`)
      if (f.minRelease && f.maxRelease && f.minRelease > f.maxRelease) errors.push(`البند ${line.lineNum}: الحد الأدنى أكبر من الأقصى`)
      if (line.status === 'Closed') errors.push(`البند ${line.lineNum} مغلق`)
    }
    if (op.op === 'Close' && line && line.status === 'Closed') errors.push(`البند ${line.lineNum} مغلق أصلاً`)
  })
  a.partyOps.forEach((p) => {
    const party = p.partyId ? d.parties.find((x) => x.id === p.partyId && x.contractId === c.id) : undefined
    if (p.op !== 'Add' && !party) errors.push('الطرف المطلوب غير موجود')
    if (p.op === 'Add' && !(p.fields?.name ?? '').trim()) errors.push('اسم الطرف الجديد مطلوب')
    if (p.op === 'Remove' && party?.isPrimary) errors.push('لا يجوز حذف الطرف الرئيسي')
  })
  return { errors, warnings }
}

/** Value change of the amendment in the contract currency (used to pick the approval route). */
export function valueDelta(d: DB, c: Contract, a: ContractAmendment): number {
  let delta = 0
  const h = a.header.find((x) => x.path === 'contractValue')
  if (h) delta += Number(h.newValue ?? 0) - Number(h.oldValue ?? 0)
  a.lineOps.forEach((op) => {
    const line = op.lineNum ? d.lines.find((l) => l.contractId === c.id && l.lineNum === op.lineNum) : undefined
    if (op.op === 'Add' && op.add) delta += op.add.commitmentType === 'Quantity' ? (op.add.agreedQuantity ?? 0) * op.add.unitPrice * (1 - op.add.discountPercent / 100) : op.add.agreedValue ?? 0
    if (op.op === 'Change' && line) delta += committedValue({ ...line, ...(op.fields ?? {}) }) - committedValue(line)
  })
  return delta
}

// ───────────── lifecycle of an amendment ─────────────
export function createAmendment(d: DB, c: Contract, input: Pick<ContractAmendment, 'type' | 'reason' | 'effectiveDate' | 'header' | 'lineOps' | 'partyOps'>, id?: string): string | ContractAmendment {
  const st = canAmendStatus(d, c)
  if (st) return st
  const existing = id ? d.amendments.find((x) => x.id === id) : undefined
  const other = openAmendment(d, c.id)
  if (other && other.id !== existing?.id) return `يوجد ملحق مفتوح (رقم ${other.amendmentNo}) لهذا العقد؛ أنهِه أو ألغِه أولاً`
  if (existing) {
    if (existing.status !== 'Draft') return 'لا يُعدَّل إلا الملحق في حالة مسودة'
    Object.assign(existing, input)
    return existing
  }
  const a: ContractAmendment = {
    id: uid('amd'), contractId: c.id, amendmentNo: d.amendments.filter((x) => x.contractId === c.id).length + 1, status: 'Draft', baseVersionNo: c.versionNo,
    createdBy: d.userId, createdAt: nowStamp(), ...input,
  }
  d.amendments.push(a)
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: c.id, action: 'amendment:create', detail: `ملحق ${a.amendmentNo}` })
  return a
}

export function submitAmendment(d: DB, id: string): string | null {
  const a = d.amendments.find((x) => x.id === id)
  if (!a) return 'الملحق غير موجود'
  const c = d.contracts.find((x) => x.id === a.contractId)!
  if (a.status !== 'Draft') return 'يُرسل للاعتماد من المسودة فقط'
  if (a.baseVersionNo !== c.versionNo) return 'الملحق قديم: تغيّر إصدار العقد منذ إنشائه (stale)'
  const v = validateAmendment(d, c, a)
  if (v.errors.length) return v.errors.join(' — ')
  // the approval route is chosen by the absolute value change, in the contract currency (rule-am-1/2)
  const probe = { ...c, contractValue: Math.abs(valueDelta(d, c, a)) }
  const started = startApproval(d, 'Amendment', a.id, probe)
  if (typeof started === 'string') return started
  a.status = 'PendingApproval'; a.approvalRequestId = started.id
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: c.id, action: 'amendment:submit', detail: `ملحق ${a.amendmentNo}` })
  return null
}

/** Records the current user's decision on the amendment's open stage. */
export function decideAmendment(d: DB, amendmentId: string, decision: 'Approved' | 'Rejected', comment: string): string | null {
  const a = d.amendments.find((x) => x.id === amendmentId)
  if (!a || a.status !== 'PendingApproval') return 'الملحق ليس قيد الاعتماد'
  const req = openRequest(d, 'Amendment', a.id)
  if (!req) return 'لا يوجد طلب اعتماد مفتوح'
  const r = decide(d, req.id, decision, comment)
  if ('error' in r) return r.error
  if (r.outcome === 'approved') { a.status = 'Approved'; a.decidedAt = nowStamp() }
  if (r.outcome === 'rejected') { a.status = 'Rejected'; a.decidedAt = nowStamp() }
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: a.contractId, action: `amendment:${r.outcome}`, detail: `ملحق ${a.amendmentNo}` })
  return null
}

export function cancelAmendment(d: DB, id: string): string | null {
  const a = d.amendments.find((x) => x.id === id)
  if (!a || !isOpen(a.status)) return 'لا يمكن إلغاء هذا الملحق'
  const req = openRequest(d, 'Amendment', a.id)
  if (req) {
    req.status = 'Cancelled'; req.completedAt = nowStamp()
    d.tasks.filter((t) => t.requestId === req.id && t.status === 'Open').forEach((t) => { t.status = 'Cancelled'; t.completedAt = nowStamp() })
  }
  a.status = 'Cancelled'
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: a.contractId, action: 'amendment:cancel', detail: `ملحق ${a.amendmentNo}` })
  return null
}

export const applyBlocker = (d: DB, a: ContractAmendment): string | undefined => {
  const c = d.contracts.find((x) => x.id === a.contractId)
  if (!c) return 'العقد غير موجود'
  if (a.status !== 'Approved') return 'يُطبَّق الملحق بعد اعتماده'
  if (a.baseVersionNo !== c.versionNo) return 'الملحق قديم: تغيّر إصدار العقد منذ إنشائه (stale)'
  if (a.effectiveDate > today()) return `يُطبَّق تلقائياً عند حلول تاريخ السريان ${a.effectiveDate}`
  return undefined
}

/** BR-M-01/02/03/04: applies an approved amendment, writes a new immutable version, never touches earlier versions, documents or the ledger. */
export function applyAmendment(d: DB, id: string, auto = false): string | null {
  const a = d.amendments.find((x) => x.id === id)
  if (!a) return 'الملحق غير موجود'
  const blocked = applyBlocker(d, a)
  if (blocked) return blocked
  const c = d.contracts.find((x) => x.id === a.contractId)!
  const v = validateAmendment(d, c, a)
  if (v.errors.length) return v.errors.join(' — ') // counters may have moved since approval
  const cmap = c as unknown as Record<string, unknown>
  a.header.forEach((h) => { cmap[h.path] = h.newValue === '' ? undefined : h.newValue })
  a.lineOps.forEach((op) => {
    const line = op.lineNum ? d.lines.find((l) => l.contractId === c.id && l.lineNum === op.lineNum) : undefined
    if (op.op === 'Change' && line) Object.assign(line, op.fields)
    if (op.op === 'Close' && line) line.status = 'Closed'
    if (op.op === 'Add' && op.add) {
      const num = Math.max(0, ...d.lines.filter((l) => l.contractId === c.id).map((l) => l.lineNum)) + 1 // lineNums are never reused
      d.lines.push({ ...op.add, id: `${c.id}-l${num}`, contractId: c.id, lineNum: num, status: 'Open', notes: `أُضيف بالملحق ${a.amendmentNo}` })
      op.lineNum = num
    }
  })
  a.partyOps.forEach((p) => {
    if (p.op === 'Add') d.parties.push({ id: `${c.id}-p${d.parties.length + 1}${uid('x').slice(2, 4)}`, contractId: c.id, role: p.fields?.role ?? 'Other', partnerId: undefined, name: p.fields?.name ?? '', contactName: p.fields?.contactName ?? '', email: p.fields?.email ?? '', phone: p.fields?.phone ?? '', signatoryTitle: p.fields?.signatoryTitle ?? '', isPrimary: false })
    const party = p.partyId ? d.parties.find((x) => x.id === p.partyId) : undefined
    if (p.op === 'Change' && party) Object.assign(party, p.fields)
    if (p.op === 'Remove' && party) d.parties = d.parties.filter((x) => x.id !== party.id)
  })
  if (c.profile === 'Agreement' && a.lineOps.length) c.contractValue = d.lines.filter((l) => l.contractId === c.id && l.status === 'Open').reduce((s, l) => s + committedValue(l), 0) || c.contractValue
  c.versionNo += 1
  a.status = 'Applied'; a.appliedVersionNo = c.versionNo; a.appliedOn = nowStamp(); a.appliedBy = auto ? 'system' : d.userId
  let reason = `ملحق رقم ${a.amendmentNo}: ${a.reason}`
  const revived = c.status === 'Expired' && c.endDate && c.endDate >= today()
  d.history.push({ id: uid('h'), contractId: c.id, from: c.status, to: revived ? 'Active' : c.status, byUserId: auto ? 'system' : d.userId, at: nowStamp(), reason: revived ? `${reason} — عاد العقد ساري` : reason })
  if (revived) c.status = 'Active'
  const prevUser = d.userId
  if (auto) d.userId = 'system'
  createVersion(d, c, 'Amendment', a.id)
  d.userId = prevUser
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: auto ? 'system' : d.userId, entity: 'contract', entityId: c.id, action: 'amendment:apply', detail: `ملحق ${a.amendmentNo} → v${c.versionNo}` })
  return null
}

/** Called when the demo date changes: approved amendments whose effective date arrived are applied by the system. */
export function applyDueAmendments(d: DB): number {
  let n = 0
  d.amendments.filter((a) => a.status === 'Approved' && a.effectiveDate <= d.asOf).forEach((a) => { if (applyAmendment(d, a.id, true) === null) n++ })
  return n
}

export const hasLineFields = (f: LineFields) => Object.values(f).some((v) => v !== undefined)
export type { HeaderChange }
