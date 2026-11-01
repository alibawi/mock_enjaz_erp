// Obligation engine (spec BR-O-01…05). Display-only penalties; nothing posts to accounting.
import { addDays, addMonths, diffDays, today } from './asof'
import { uid } from './format'
import type { Contract, DB, Obligation, ObligationKind, ObligationOccurrence, ObligationStatus, PenaltyType } from './types'

export const kindLabel: Record<ObligationKind, string> = {
  Deliverable: 'مخرج / تسليم', Milestone: 'مرحلة', Payment: 'دفعة', Reporting: 'تقرير', SLA: 'مستوى خدمة', Recurring: 'متكرر', Other: 'أخرى',
}
export type EffStatus = ObligationStatus | 'Overdue'
export const statusLabel: Record<EffStatus, string> = {
  Planned: 'مخطط', InProgress: 'قيد التنفيذ', Completed: 'مكتمل (بانتظار القبول)', Accepted: 'مقبول', Rejected: 'مرفوض (يعاد العمل)', Waived: 'متنازل عنه', Cancelled: 'ملغى', Overdue: 'متأخر',
}
export const statusTone: Record<EffStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  Planned: 'gray', InProgress: 'blue', Completed: 'amber', Accepted: 'green', Rejected: 'red', Waived: 'gray', Cancelled: 'gray', Overdue: 'red',
}
export const penaltyLabel: Record<PenaltyType, string> = { None: 'بدون', FixedPerDay: 'مبلغ ثابت لكل يوم تأخير', PercentPerDay: 'نسبة % من القيمة لكل يوم', Fixed: 'مبلغ ثابت مرة واحدة' }
/** Statuses in which the obligation still has to be worked on. */
const WORKING: ObligationStatus[] = ['Planned', 'InProgress', 'Rejected']
export const isOpen = (o: { status: ObligationStatus }) => WORKING.includes(o.status) || o.status === 'Completed'

/** BR-O-01: overdue is derived from the due date and the demo date, never stored. */
export const effStatus = (o: { status: ObligationStatus; dueDate: string; recurrence?: unknown }, on = today()): EffStatus => (WORKING.includes(o.status) && !o.recurrence && o.dueDate < on ? 'Overdue' : o.status)
export const daysLate = (o: Obligation, on = today()) => Math.max(0, diffDays(o.completedOn ?? (WORKING.includes(o.status) ? on : o.dueDate), o.dueDate))

/** BR-O-05: display-only penalty accrued so far (or at completion), capped by penaltyCap. */
export function penaltyOf(o: Obligation, on = today()): number {
  if (o.penaltyType === 'None' || !o.penaltyRate || o.status === 'Waived' || o.status === 'Cancelled') return 0
  const days = daysLate(o, on)
  if (days <= 0) return 0
  const raw = o.penaltyType === 'FixedPerDay' ? o.penaltyRate * days : o.penaltyType === 'PercentPerDay' ? (o.penaltyRate / 100) * (o.value ?? 0) * days : o.penaltyRate
  return Math.min(raw, o.penaltyCap ?? raw)
}

/** BR-O-04: dependencies must be acyclic. */
export function wouldCycle(db: DB, id: string, dependsOnId: string): boolean {
  const seen = new Set<string>()
  let cur: string | undefined = dependsOnId
  while (cur) {
    if (cur === id) return true
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = db.obligations.find((o) => o.id === cur)?.dependsOnId
  }
  return false
}
export function dependencyBlocker(db: DB, o: Obligation): string | undefined {
  const dep = o.dependsOnId ? db.obligations.find((x) => x.id === o.dependsOnId) : undefined
  if (dep && dep.status !== 'Completed' && dep.status !== 'Accepted') return `يعتمد على «${dep.title}» ولم يكتمل بعد`
  return undefined
}

export function validateObligation(db: DB, o: Obligation): string[] {
  const e: string[] = []
  if (!o.title.trim()) e.push('العنوان مطلوب')
  if (!o.dueDate) e.push('تاريخ الاستحقاق مطلوب')
  if (o.penaltyType !== 'None' && !(o.penaltyRate && o.penaltyRate > 0)) e.push('قيمة/نسبة الغرامة مطلوبة')
  if (o.penaltyType === 'PercentPerDay' && !(o.value && o.value > 0)) e.push('الغرامة بالنسبة تتطلب قيمة للالتزام')
  if (o.dependsOnId) {
    const dep = db.obligations.find((x) => x.id === o.dependsOnId)
    if (!dep || dep.contractId !== o.contractId) e.push('الاعتماد على التزام من نفس العقد فقط')
    else if (wouldCycle(db, o.id, o.dependsOnId)) e.push('الاعتماد دائري: الالتزام يعتمد على نفسه عبر سلسلة')
  }
  if (o.recurrence && !o.recurrence.count && !o.recurrence.until) e.push('التكرار يتطلب عدداً أو تاريخ نهاية')
  return e
}

export function saveObligation(d: DB, o: Obligation): string | null {
  const c = d.contracts.find((x) => x.id === o.contractId)
  if (!c) return 'العقد غير موجود'
  if (['Cancelled', 'Closed'].includes(c.status)) return 'لا تُدار الالتزامات على عقد ملغى أو مغلق'
  const errs = validateObligation(d, o)
  if (errs.length) return errs.join(' — ')
  const i = d.obligations.findIndex((x) => x.id === o.id)
  if (i >= 0) d.obligations[i] = o; else d.obligations.push(o)
  return null
}
export const newObligation = (contractId: string, by: string): Obligation => ({
  id: uid('obl'), contractId, kind: 'Deliverable', title: '', description: '', dueDate: today(), status: 'Planned', acceptanceRequired: true, survivesTermination: false,
  penaltyType: 'None', attachments: [], createdBy: by, createdAt: `${today()}T00:00`,
})

const get = (d: DB, id: string) => d.obligations.find((o) => o.id === id)

export function startObligation(d: DB, id: string): string | null {
  const o = get(d, id)
  if (!o || o.status !== 'Planned' && o.status !== 'Rejected') return 'يبدأ التنفيذ من حالة مخطط أو مرفوض'
  const b = dependencyBlocker(d, o)
  if (b) return b
  o.status = 'InProgress'
  return null
}
/** Completion by the responsible user; when acceptance is not required the obligation is accepted at once. */
export function completeObligation(d: DB, id: string): string | null {
  const o = get(d, id)
  if (!o || !['Planned', 'InProgress', 'Rejected'].includes(o.status)) return 'لا يمكن إنجاز هذا الالتزام في حالته الحالية'
  const b = dependencyBlocker(d, o)
  if (b) return b
  o.status = 'Completed'; o.completedOn = today(); o.completedBy = d.userId
  if (!o.acceptanceRequired) { o.status = 'Accepted'; o.acceptedOn = today(); o.acceptedBy = d.userId }
  return null
}
/** BR-O-02: acceptance by a user other than the completer. */
export function decideAcceptance(d: DB, id: string, accept: boolean, reason = ''): string | null {
  const o = get(d, id)
  if (!o || o.status !== 'Completed') return 'القبول بعد الإنجاز فقط'
  if (o.completedBy === d.userId) return 'لا يجوز قبول إنجاز قمت به بنفسك (فصل المهام)'
  if (!accept && !reason.trim()) return 'سبب الرفض مطلوب'
  if (accept) { o.status = 'Accepted'; o.acceptedOn = today(); o.acceptedBy = d.userId }
  else { o.status = 'Rejected'; o.completedOn = undefined; o.completedBy = undefined; o.description = `${o.description}${o.description ? ' — ' : ''}رُفض: ${reason}` }
  return null
}
export function waiveObligation(d: DB, id: string): string | null {
  const o = get(d, id)
  if (!o || !['Planned', 'InProgress', 'Rejected'].includes(o.status)) return 'التنازل لما لم يُنجز بعد فقط'
  o.status = 'Waived'
  return null
}

/** Termination ⇒ open obligations are cancelled unless they survive termination. Returns how many. */
export function cancelOnTermination(d: DB, c: Contract): number {
  let n = 0
  d.obligations.filter((o) => o.contractId === c.id && isOpen(o) && !o.survivesTermination).forEach((o) => { o.status = 'Cancelled'; n++ })
  d.occurrences.forEach((x) => { const o = get(d, x.obligationId); if (o?.contractId === c.id && !o.survivesTermination && x.status === 'Planned') x.status = 'Waived' })
  return n
}

// ───────────── recurrence (BR-O-03) ─────────────
export function occurrenceDates(o: Obligation, upTo: string): string[] {
  const r = o.recurrence
  if (!r) return []
  const out: string[] = []
  for (let i = 0; i < 400; i++) {
    const date = r.freq === 'daily' ? addDays(o.dueDate, i) : r.freq === 'weekly' ? addDays(o.dueDate, 7 * i) : addMonths(o.dueDate, (r.freq === 'monthly' ? 1 : 12) * i)
    if (date > upTo || (r.until && date > r.until) || (r.count && i >= r.count)) break
    out.push(date)
  }
  return out
}
/** Generates the occurrences up to a week ahead of the demo date; unique per (obligation, date) so it is idempotent. */
export function generateOccurrences(d: DB): number {
  let n = 0
  d.obligations.filter((o) => o.recurrence && !['Cancelled', 'Waived'].includes(o.status)).forEach((o) => {
    const c = d.contracts.find((x) => x.id === o.contractId)
    if (!c || !['Active', 'OnHold'].includes(c.status)) return
    occurrenceDates(o, addDays(d.asOf, 7)).forEach((date) => {
      if (d.occurrences.some((x) => x.obligationId === o.id && x.dueDate === date)) return
      d.occurrences.push({ id: `occ-${o.id}-${date}`, obligationId: o.id, dueDate: date, status: 'Planned' }); n++
    })
  })
  return n
}
export const occurrenceStatus = (x: ObligationOccurrence, on = today()): EffStatus | 'Completed' => (x.status === 'Planned' && x.dueDate < on ? 'Overdue' : x.status)
export function completeOccurrence(d: DB, id: string): string | null {
  const x = d.occurrences.find((y) => y.id === id)
  if (!x || x.status !== 'Planned') return 'الحدث غير قابل للإنجاز'
  x.status = 'Completed'; x.completedOn = today()
  return null
}

/** Escalation points relative to the due date (BR-O-01): −3, 0, +1, +7 days. */
export const escalationDays = [-3, 0, 1, 7]
export const escalationLabel = (daysFromDue: number) => (daysFromDue < 0 ? `يستحق خلال ${-daysFromDue} أيام` : daysFromDue === 0 ? 'يستحق اليوم' : `متأخر ${daysFromDue} ${daysFromDue === 1 ? 'يوم' : 'أيام'}`)
