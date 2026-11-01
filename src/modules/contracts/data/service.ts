// Service contracts engine (spec BR-S-01…07): coverage lookup, deadlines counted inside coverage windows only, consumption, SLA events.
// The call lifecycle is a demo aid — real service calls belong to the (not yet built) Assets/Maintenance modules.
import { addDays, today } from './asof'
import { uid } from './format'
import type { Contract, DB, ServiceCall, SlaEvent } from './types'

export const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const pad = (n: number) => String(n).padStart(2, '0')
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()
const stamp = (date: string, m: number) => `${date}T${hhmm(m)}`
const split = (iso: string) => ({ date: iso.slice(0, 10), m: mins(iso.slice(11, 16)) })
/** Demo clock: the demo date at 12:00 (the date itself is controlled from the header). */
export const demoNow = (db?: Pick<DB, 'asOf'>) => `${db?.asOf ?? today()}T12:00`
export const fmtStamp = (iso?: string) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('/')} ${iso.slice(11, 16)}` : '—')

// ───────────── coverage windows (BR-S-02, BR-S-03) ─────────────
export const levelOf = (db: DB, contractId: string) => db.serviceLevels.find((l) => l.contractId === contractId)
export const isExcluded = (db: DB, contractId: string, date: string) => db.coverageExclusions.some((x) => x.contractId === contractId && x.date === date)
/** Coverage windows of a day in minutes, [] on an excluded date. */
export function windowsOn(db: DB, contractId: string, date: string): [number, number][] {
  if (isExcluded(db, contractId, date)) return []
  return db.coverageWindows.filter((w) => w.contractId === contractId && w.dayOfWeek === dow(date)).map((w): [number, number] => [mins(w.fromTime), mins(w.toTime)]).sort((a, b) => a[0] - b[0])
}
export const hasWindows = (db: DB, contractId: string) => db.coverageWindows.some((w) => w.contractId === contractId)
export function isInCoverage(db: DB, contractId: string, iso: string): boolean {
  const { date, m } = split(iso)
  return windowsOn(db, contractId, date).some(([a, b]) => m >= a && m < b)
}
/** BR-S-03: adds working hours that fall inside coverage windows only (exclusion dates skipped). Null when there are no windows. */
export function addCoverageHours(db: DB, contractId: string, startIso: string, hours: number): string | null {
  if (!hasWindows(db, contractId)) return null
  let { date, m } = split(startIso)
  let left = Math.round(hours * 60)
  for (let i = 0; i < 120; i++) {
    for (const [a, b] of windowsOn(db, contractId, date)) {
      const s = Math.max(a, m)
      if (s >= b) continue
      if (left <= b - s) return stamp(date, s + left)
      left -= b - s
    }
    date = addDays(date, 1); m = 0
  }
  return null
}
/** Coverage minutes between two instants (what has been "used" of a target). */
export function coverageMinutes(db: DB, contractId: string, fromIso: string, toIso: string): number {
  if (toIso <= fromIso) return 0
  const a = split(fromIso), b = split(toIso)
  let total = 0
  for (let date = a.date; date <= b.date; date = addDays(date, 1)) {
    for (const [s, e] of windowsOn(db, contractId, date)) {
      const from = date === a.date ? Math.max(s, a.m) : s, to = date === b.date ? Math.min(e, b.m) : e
      if (to > from) total += to - from
    }
  }
  return total
}

// ───────────── coverage lookup (BR-S-01, BR-S-05) ─────────────
export interface CoverageResult { contract?: Contract; item?: ReturnType<typeof matchItem>; reasons: { contract: Contract; reason: string }[] }
const matchItem = (db: DB, contractId: string, q: { itemId?: string; serial?: string }) =>
  db.coveredItems.find((i) => i.contractId === contractId && ((q.serial && i.serial === q.serial) || (q.itemId && i.itemId === q.itemId && (!i.serial || !q.serial || i.serial === q.serial))))
export function coverageFor(db: DB, q: { customerId: string; itemId?: string; serial?: string; date: string }): CoverageResult {
  const reasons: CoverageResult['reasons'] = []
  const ok: { contract: Contract; item: NonNullable<ReturnType<typeof matchItem>> }[] = []
  for (const c of db.contracts.filter((x) => x.profile === 'Service' && x.counterpartyId === q.customerId)) {
    const lvl = levelOf(db, c.id)
    const item = matchItem(db, c.id, q)
    if (c.status !== 'Active') { reasons.push({ contract: c, reason: `العقد ${c.status === 'Expired' ? 'منتهٍ' : c.status === 'OnHold' ? 'معلّق' : 'غير ساري'}` }); continue }
    if (q.date < c.startDate || (c.endDate && q.date > c.endDate)) { reasons.push({ contract: c, reason: 'تاريخ البلاغ خارج مدة العقد' }); continue }
    if (!item) { reasons.push({ contract: c, reason: 'الصنف/الرقم التسلسلي غير مشمول' }); continue }
    const ws = item.warrantyStart ?? lvl?.warrantyStart, we = item.warrantyEnd ?? lvl?.warrantyEnd
    if ((ws || we) && ((ws && q.date < ws) || (we && q.date > we))) { reasons.push({ contract: c, reason: `خارج فترة الضمان (${ws ?? ''} ← ${we ?? ''})` }); continue }
    ok.push({ contract: c, item })
  }
  ok.sort((a, b) => (a.contract.endDate ?? '9999').localeCompare(b.contract.endDate ?? '9999') || a.contract.number.localeCompare(b.contract.number))
  return { contract: ok[0]?.contract, item: ok[0]?.item, reasons }
}

// ───────────── calls ─────────────
export interface OpenInput { customerId: string; itemId?: string; serial?: string; description: string; severity: 'Critical' | 'Normal'; openedAt: string }
export function deadlinesFor(db: DB, contractId: string, openedAt: string) {
  const l = levelOf(db, contractId)
  if (!l) return {}
  return { responseDue: addCoverageHours(db, contractId, openedAt, l.responseHours) ?? undefined, resolutionDue: addCoverageHours(db, contractId, openedAt, l.resolutionHours) ?? undefined }
}
export function openCall(d: DB, i: OpenInput): string | ServiceCall {
  if (!i.customerId) return 'اختر العميل'
  if (!i.description.trim()) return 'وصف العطل مطلوب'
  if (!i.itemId && !i.serial?.trim()) return 'حدّد الصنف أو الرقم التسلسلي'
  const cov = coverageFor(d, { customerId: i.customerId, itemId: i.itemId, serial: i.serial?.trim() || undefined, date: i.openedAt.slice(0, 10) })
  const c = cov.contract
  const n = d.serviceCalls.length + 1
  const call: ServiceCall = {
    id: `call-${n}`, no: `SC-${i.openedAt.slice(0, 4)}-${String(n).padStart(4, '0')}`, customerId: i.customerId, itemId: i.itemId, serial: i.serial?.trim() || undefined, description: i.description.trim(),
    severity: i.severity, openedAt: i.openedAt, status: 'Open', contractId: c?.id, hoursConsumed: 0, visits: 0, outsideCoverage: c ? !isInCoverage(d, c.id, i.openedAt) : false, billable: !c,
    ...(c ? deadlinesFor(d, c.id, i.openedAt) : {}), note: c ? '' : 'غير مغطّى بعقد خدمة — يُحاسب بالفاتورة',
  }
  d.serviceCalls.push(call)
  return call
}
const getCall = (d: DB, id: string) => d.serviceCalls.find((x) => x.id === id)
const hasEvent = (d: DB, callId: string, kinds: SlaEvent['kind'][]) => d.slaEvents.some((e) => e.callId === callId && kinds.includes(e.kind))
const addEvent = (d: DB, call: ServiceCall, kind: SlaEvent['kind'], at: string) => {
  if (call.contractId) d.slaEvents.push({ id: uid('sla'), callId: call.id, contractId: call.contractId, kind, at })
}
export function respondCall(d: DB, id: string, at: string): string | null {
  const c = getCall(d, id)
  if (!c || c.status !== 'Open') return 'يُستجاب للبلاغ المفتوح فقط'
  if (at < c.openedAt) return 'وقت الاستجابة قبل وقت فتح البلاغ'
  c.respondedAt = at; c.status = 'Responded'
  if (c.contractId && c.responseDue && !hasEvent(d, c.id, ['ResponseMet', 'ResponseBreached'])) addEvent(d, c, at <= c.responseDue ? 'ResponseMet' : 'ResponseBreached', at)
  return null
}
/** BR-S-04: consumption is deducted from the included hours/visits; exceeding marks the call billable. */
export function resolveCall(d: DB, id: string, at: string, hours: number, visits: number): string | null {
  const c = getCall(d, id)
  if (!c || !['Open', 'Responded'].includes(c.status)) return 'لا يُحلّ هذا البلاغ في حالته'
  if (at < (c.respondedAt ?? c.openedAt)) return 'وقت الحل قبل الاستجابة/الفتح'
  if (!(hours >= 0) || !(visits >= 0)) return 'الساعات والزيارات لا تكون سالبة'
  if (!c.respondedAt) { const e = respondCall(d, id, at); if (e) return e }
  c.resolvedAt = at; c.status = 'Resolved'; c.hoursConsumed = hours; c.visits = visits
  if (c.contractId) {
    if (c.resolutionDue && !hasEvent(d, c.id, ['ResolutionMet', 'ResolutionBreached'])) addEvent(d, c, at <= c.resolutionDue ? 'ResolutionMet' : 'ResolutionBreached', at)
    d.consumption.push({ id: uid('cns'), contractId: c.contractId, callId: c.id, hours, visits, date: at.slice(0, 10) })
    const used = consumed(d, c.contractId), l = levelOf(d, c.contractId)
    if ((l?.includedHours !== undefined && used.hours > l.includedHours) || (l?.includedVisits !== undefined && used.visits > l.includedVisits)) { c.billable = true; c.note = 'تجاوز الساعات/الزيارات المشمولة — البلاغ قابل للفوترة' }
  }
  return null
}
export function closeCall(d: DB, id: string, at = demoNow(d)): string | null {
  const c = getCall(d, id)
  if (!c || c.status !== 'Resolved') return 'يُغلق البلاغ بعد حلّه'
  c.status = 'Closed'; c.closedAt = at
  return null
}
export const consumed = (db: DB, contractId: string) => db.consumption.filter((x) => x.contractId === contractId).reduce((s, x) => ({ hours: s.hours + x.hours, visits: s.visits + x.visits }), { hours: 0, visits: 0 })

/** BR-S-06: open calls whose response/resolution deadline passed get one breach event (idempotent). Called when the demo date moves. */
export function sweepBreaches(d: DB): number {
  const now = demoNow(d)
  let n = 0
  d.serviceCalls.filter((c) => c.contractId && ['Open', 'Responded'].includes(c.status)).forEach((c) => {
    if (!c.respondedAt && c.responseDue && now > c.responseDue && !hasEvent(d, c.id, ['ResponseMet', 'ResponseBreached'])) { addEvent(d, c, 'ResponseBreached', c.responseDue); n++ }
    if (!c.resolvedAt && c.resolutionDue && now > c.resolutionDue && !hasEvent(d, c.id, ['ResolutionMet', 'ResolutionBreached'])) { addEvent(d, c, 'ResolutionBreached', c.resolutionDue); n++ }
  })
  return n
}

// ───────────── SLA status ─────────────
export type SlaState = 'Within' | 'NearBreach' | 'Breached' | 'Met'
export interface CallSla { response: SlaState | 'n/a'; resolution: SlaState | 'n/a'; worst: SlaState | 'n/a' }
function stateOf(db: DB, c: ServiceCall, target: number | undefined, due: string | undefined, doneAt: string | undefined): SlaState | 'n/a' {
  if (!c.contractId || !due || !target) return 'n/a'
  if (doneAt) return doneAt <= due ? 'Met' : 'Breached'
  const now = demoNow(db)
  if (now > due) return 'Breached'
  return coverageMinutes(db, c.contractId, c.openedAt, now) >= target * 60 * 0.8 ? 'NearBreach' : 'Within'
}
export function callSla(db: DB, c: ServiceCall): CallSla {
  const l = c.contractId ? levelOf(db, c.contractId) : undefined
  const response = stateOf(db, c, l?.responseHours, c.responseDue, c.respondedAt), resolution = stateOf(db, c, l?.resolutionHours, c.resolutionDue, c.resolvedAt)
  const rank: Record<string, number> = { 'n/a': -1, Met: 0, Within: 1, NearBreach: 2, Breached: 3 }
  const worst = (rank[response] >= rank[resolution] ? response : resolution)
  return { response, resolution, worst }
}
/** Remaining coverage minutes until the next unmet deadline (negative when overdue); undefined when nothing is pending. */
export function countdown(db: DB, c: ServiceCall): { label: string; mins: number } | undefined {
  if (!c.contractId || !['Open', 'Responded'].includes(c.status)) return undefined
  const due = !c.respondedAt ? c.responseDue : c.resolutionDue
  if (!due) return undefined
  const now = demoNow(db)
  const m = now <= due ? coverageMinutes(db, c.contractId, now, due) : -coverageMinutes(db, c.contractId, due, now)
  return { label: !c.respondedAt ? 'للاستجابة' : 'للحل', mins: m }
}
export const fmtMins = (m: number) => { const a = Math.abs(m); return `${m < 0 ? '−' : ''}${Math.floor(a / 60)}س ${a % 60}د` }

export function serviceStats(db: DB, c: Contract) {
  const l = levelOf(db, c.id), used = consumed(db, c.id)
  const calls = db.serviceCalls.filter((x) => x.contractId === c.id)
  const done = db.slaEvents.filter((e) => e.contractId === c.id)
  const met = done.filter((e) => e.kind.endsWith('Met')).length
  return {
    level: l, hours: used.hours, visits: used.visits, hoursPct: l?.includedHours ? (used.hours / l.includedHours) * 100 : undefined, visitsPct: l?.includedVisits ? (used.visits / l.includedVisits) * 100 : undefined,
    calls: calls.length, slaPct: done.length ? (met / done.length) * 100 : undefined, breaches: done.length - met,
  }
}
export const warrantyEnds = (db: DB, c: Contract) => {
  const l = levelOf(db, c.id)
  return [l?.warrantyEnd, ...db.coveredItems.filter((i) => i.contractId === c.id).map((i) => i.warrantyEnd)].filter(Boolean).sort().pop()
}
