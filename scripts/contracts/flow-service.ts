import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { computeAlerts } from '../../src/modules/contracts/data/alerts'
import { addCoverageHours, callSla, countdown, coverageFor, coverageMinutes, deadlinesFor, openCall, respondCall, resolveCall, serviceStats, sweepBreaches } from '../../src/modules/contracts/data/service'
import { checkService } from '../../src/modules/contracts/data/integrity'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const setDate = (d: string) => { db.asOf = d; setToday(d) }
const open = (customerId: string, serial: string | undefined, itemId: string | undefined, openedAt: string, severity: 'Critical' | 'Normal' = 'Normal') => {
  const r = openCall(db, { customerId, serial, itemId, openedAt, severity, description: 'اختبار' }); if (typeof r === 'string') throw new Error(r); return r
}

ok('seed: 20 calls, 5 service contracts', db.serviceCalls.length === 20 && db.serviceLevels.length === 5)
// 1) coverage lookup (BR-S-01, BR-S-05)
ok('covered item resolves to the active contract', coverageFor(db, { customerId: 'p-c6', serial: 'GEN-250-A1', date: '2026-10-30' }).contract?.id === 'c-16')
const unc = coverageFor(db, { customerId: 'p-c6', serial: 'GEN-500-X9', date: '2026-10-30' })
ok('unknown serial is not covered (with reasons)', !unc.contract && unc.reasons.length >= 1, JSON.stringify(unc.reasons.map((r) => r.reason)))
ok('expired contract does not cover', coverageFor(db, { customerId: 'p-c8', serial: 'GEN-500-X1', date: '2026-10-30' }).reasons.some((r) => r.reason.includes('منتهٍ')))
ok('warranty: inside the dates covered, after not', coverageFor(db, { customerId: 'p-c10', serial: 'GEN-250-C9', date: '2026-12-20' }).contract?.id === 'c-18' && !coverageFor(db, { customerId: 'p-c10', serial: 'GEN-250-C9', date: '2026-12-21' }).contract)
ok('no contract: call is billable', open('p-c6', 'GEN-500-X9', 'it-12', '2026-10-30T09:00').billable)

// 2) deadlines count coverage hours only (BR-S-03)
ok('response skips non-coverage time (Thu 19:00 + 2h -> Fri 09:00)', addCoverageHours(db, 'c-16', '2026-10-29T19:00', 2) === '2026-10-30T09:00')
ok('24h resolution across Fri short day, Sat off, Sun (Thu 19:00 -> Mon 13:00)', addCoverageHours(db, 'c-16', '2026-10-29T19:00', 24) === '2026-11-02T13:00', String(addCoverageHours(db, 'c-16', '2026-10-29T19:00', 24)))
ok('exclusion date skipped (Thu 2026-10-01 19:00 + 24h -> Tue 10-06 13:00)', addCoverageHours(db, 'c-16', '2026-10-01T19:00', 24) === '2026-10-06T13:00', String(addCoverageHours(db, 'c-16', '2026-10-01T19:00', 24)))
ok('coverage minutes inside windows only', coverageMinutes(db, 'c-17', '2026-10-29T15:00', '2026-11-01T09:00') === 60 + 60)

// 3) outside coverage flag (BR-S-02)
const sat = open('p-c6', 'GEN-250-A1', 'it-11', '2026-10-24T10:00')
ok('Saturday call flagged outside coverage, not blocked', sat.outsideCoverage && !!sat.contractId)
ok('early morning call flagged', open('p-c6', 'GEN-250-A1', 'it-11', '2026-10-25T07:00').outsideCoverage)
ok('inside hours not flagged', !open('p-c6', 'GEN-250-A1', 'it-11', '2026-10-25T09:00').outsideCoverage)

// 4) SLA states, events (BR-S-06)
setDate('2026-10-29')
const within = open('p-c7', 'TRN-250-77', 'it-10', '2026-10-29T09:00'), near = open('p-c7', 'TRN-250-77', 'it-10', '2026-10-29T08:30')
ok('75% of target elapsed is Within', callSla(db, within).response === 'Within')
ok('87% of target elapsed is NearBreach', callSla(db, near).response === 'NearBreach')
setDate('2026-10-30')
ok('past the deadline is Breached; countdown negative', callSla(db, within).response === 'Breached' && (countdown(db, within)?.mins ?? 0) < 0)
const n1 = sweepBreaches(db), n2 = sweepBreaches(db)
ok('sweep records a breach event once', n1 >= 1 && n2 === 0 && db.slaEvents.filter((e) => e.callId === within.id).length === 1)
const late = open('p-c6', 'GEN-250-A1', 'it-11', '2026-10-25T09:00', 'Critical')
respondCall(db, late.id, '2026-10-25T14:00')
ok('late response creates ResponseBreached', db.slaEvents.some((e) => e.callId === late.id && e.kind === 'ResponseBreached'))
ok('on-time response creates ResponseMet', (() => { const c = open('p-c6', 'GEN-250-A1', 'it-11', '2026-10-26T09:00'); respondCall(db, c.id, '2026-10-26T10:00'); return db.slaEvents.some((e) => e.callId === c.id && e.kind === 'ResponseMet') })())
ok('breach alert exists for the service contract', computeAlerts(db).some((a) => a.rule === 'SlaBreach' && a.contractId === 'c-17'))
ok('respond before open refused', respondCall(db, within.id, '2026-10-29T08:00') !== null)

// 5) consumption and billable (BR-S-04)
const c16 = db.contracts.find((c) => c.id === 'c-16')!
const before = serviceStats(db, c16)
ok('seed consumption below the limit', before.hours < 40 && !computeAlerts(db).some((a) => a.rule === 'ServiceLimit' && a.contractId === 'c-16'))
const big = open('p-c6', 'GEN-500-B1', 'it-12', '2026-10-27T09:00')
ok('resolve with big consumption', resolveCall(db, big.id, '2026-10-27T17:00', 20, 1) === null)
ok('exceeding included hours marks the call billable and raises an alert', db.serviceCalls.find((c) => c.id === big.id)!.billable && computeAlerts(db).some((a) => a.rule === 'ServiceLimit' && a.contractId === 'c-16'))
ok('stats include the new consumption', serviceStats(db, c16).hours === before.hours + 20)

ok('deadlines exist for covered calls', !!deadlinesFor(db, 'c-17', '2026-10-28T09:00').responseDue)
ok('integrity (service)', checkService(db).length === 0, checkService(db).join('|'))
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
