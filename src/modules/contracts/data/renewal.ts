// Renewal (spec BR-M-07…09): manual and automatic successor contracts. Extension of an expired contract within grace is an amendment (amendments.ts).
import { addDays, addMonths, diffDays, today } from './asof'
import { nowStamp, uid } from './format'
import { graceEnd, nextNumber, noticeDeadline } from './lifecycle'
import { committedValue } from './fulfillment'
import type { Contract, DB } from './types'

export const successorOf = (d: DB, c: Contract) => (c.successorContractId ? d.contracts.find((x) => x.id === c.successorContractId) : undefined)
export const predecessorOf = (d: DB, c: Contract) => (c.renewedFromContractId ? d.contracts.find((x) => x.id === c.renewedFromContractId) : undefined)

/** Why the contract cannot be renewed by a successor now, or null. */
export function renewBlocker(_d: DB, c: Contract): string | null {
  if (!['Active', 'OnHold', 'Expired'].includes(c.status)) return 'التجديد للعقود السارية أو المعلّقة أو المنتهية فقط'
  if (c.successorContractId) return 'يوجد عقد لاحق لهذا العقد أصلاً'
  if (!c.endDate) return 'العقد مفتوح المدة ولا يحتاج تجديداً'
  return null
}

/** Months between start and end (rounded, at least 1) — the default term of a successor. */
const monthsBetween = (a: string, b: string) => Math.max(1, Math.round(diffDays(addDays(b, 1), a) / 30.4375))

export function renewalDefaults(_d: DB, c: Contract) {
  const start = c.endDate && addDays(c.endDate, 1) > today() ? addDays(c.endDate, 1) : today()
  const months = c.autoRenewTermMonths ?? monthsBetween(c.startDate, c.endDate ?? addDays(c.startDate, 364))
  return { startDate: start, months, endDate: addDays(addMonths(start, months), -1) }
}

export interface RenewOptions { startDate: string; endDate: string; title?: string }

export function renewContract(d: DB, id: string, o: RenewOptions, auto = false): string | Contract {
  const c = d.contracts.find((x) => x.id === id)
  if (!c) return 'العقد غير موجود'
  const blocked = renewBlocker(d, c)
  if (blocked) return blocked
  if (!o.startDate || !o.endDate || o.endDate < o.startDate) return 'تواريخ العقد اللاحق غير صحيحة'
  let n = d.contracts.length + 1
  while (d.contracts.some((x) => x.id === `c-${String(n).padStart(2, '0')}`)) n++
  const nid = `c-${String(n).padStart(2, '0')}`
  const actor = auto ? 'system' : d.userId
  const next: Contract = {
    ...structuredClone(c), id: nid, number: nextNumber(d, c.typeId, o.startDate), title: o.title ?? (c.title.includes('(تجديد)') ? c.title : `${c.title} (تجديد)`),
    status: 'Draft', versionNo: 0, startDate: o.startDate, endDate: o.endDate, signatureDate: undefined, effectiveDate: undefined, terminationDate: undefined,
    exchangeRate: undefined, closureReason: undefined, activatedOn: undefined, activatedBy: undefined, renewedFromContractId: c.id, successorContractId: undefined,
    internalNotes: '', createdBy: auto ? c.createdBy : d.userId, createdAt: `${today()}T${new Date().toTimeString().slice(0, 5)}`, externalReference: undefined,
  }
  d.contracts.push(next)
  d.parties.filter((p) => p.contractId === c.id).forEach((p, k) => d.parties.push({ ...p, id: `${nid}-p${k + 1}`, contractId: nid }))
  // lines are copied with counters reset and renumbered from 1 (BR-M-07); open lines only
  d.lines.filter((l) => l.contractId === c.id && l.status === 'Open').sort((a, b) => a.lineNum - b.lineNum).forEach((l, k) => {
    d.lines.push({ ...structuredClone(l), id: `${nid}-l${k + 1}`, contractId: nid, lineNum: k + 1, validFrom: undefined, validTo: undefined, notes: '' })
  })
  if (next.profile === 'Agreement') next.contractValue = d.lines.filter((l) => l.contractId === nid).reduce((s, l) => s + committedValue(l), 0) || next.contractValue
  d.history.push({ id: uid('h'), contractId: nid, to: 'Draft', byUserId: actor, at: `${today()}T00:20`, reason: `${auto ? 'تجديد تلقائي' : 'تجديد'} للعقد ${c.number}` })
  c.successorContractId = nid
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: actor, entity: 'contract', entityId: c.id, action: auto ? 'renewal:auto' : 'renewal:create', detail: next.number })
  return next
}

/** BR-M-08: Auto contracts reaching their notice deadline without a successor get exactly one Draft successor. */
export function autoRenew(d: DB): number {
  let n = 0
  d.contracts.filter((c) => c.status === 'Active' && c.renewalPolicy === 'Auto' && c.endDate && !c.successorContractId).forEach((c) => {
    const nd = noticeDeadline(c)
    if (!nd || nd > d.asOf) return
    const def = renewalDefaults(d, c)
    if (typeof renewContract(d, c.id, def, true) !== 'string') n++
  })
  return n
}

export interface RenewalDue { c: Contract; endsIn: number; noticeIn?: number; urgency: 'overdue' | 'notice' | 'soon'; graceLeft?: number }
/** M7 — contracts approaching the end or the notice deadline (≤ days) and expired ones still inside the grace window. */
export function renewalsDue(d: DB, days = 60): RenewalDue[] {
  const out: RenewalDue[] = []
  d.contracts.forEach((c) => {
    if (!c.endDate || c.successorContractId || !['Active', 'OnHold', 'Expired'].includes(c.status)) return
    const endsIn = diffDays(c.endDate, today())
    const nd = noticeDeadline(c)
    const noticeIn = nd && c.renewalPolicy !== 'None' ? diffDays(nd, today()) : undefined
    if (c.status === 'Expired') {
      const g = graceEnd(d, c)
      out.push({ c, endsIn, urgency: 'overdue', graceLeft: g ? diffDays(g, today()) : undefined })
    } else if (endsIn <= days) out.push({ c, endsIn, noticeIn, urgency: noticeIn !== undefined && noticeIn <= 0 ? 'notice' : 'soon' })
  })
  return out.sort((a, b) => a.endsIn - b.endsIn)
}
