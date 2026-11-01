import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { computeAlerts } from '../../src/modules/contracts/data/alerts'
import { cancelOnTermination, completeObligation, decideAcceptance, effStatus, generateOccurrences, penaltyOf, saveObligation, startObligation, wouldCycle } from '../../src/modules/contracts/data/obligations'
import { billingBlocker, createBilling, financialSummary, recordPayment, saveItem, scheduleCheck } from '../../src/modules/contracts/data/payments'
import { checkAgreements, checkFinance } from '../../src/modules/contracts/data/integrity'
import { balanceOf } from '../../src/modules/contracts/data/fulfillment'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const as = <T,>(u: string, f: () => T) => { const p = db.userId; db.userId = u; try { return f() } finally { db.userId = p } }
const o = (id: string) => db.obligations.find((x) => x.id === id)!
const it = (id: string) => db.paymentItems.find((x) => x.id === id)!
const setDate = (d: string) => { db.asOf = d; setToday(d) }

// 1) complete -> accept (separation of duties), dependencies
ok('dependent obligation cannot start', startObligation(db, 'obl-06') !== null)
ok('complete by the responsible user', as('u-sal', () => completeObligation(db, 'obl-10')) === null && o('obl-10').status === 'Completed')
ok('completer cannot accept own work', as('u-sal', () => decideAcceptance(db, 'obl-10', true)) !== null)
ok('another user accepts', as('u-leg', () => decideAcceptance(db, 'obl-10', true)) === null && o('obl-10').status === 'Accepted')
ok('rejection needs a reason, then returns to work', as('u-leg', () => decideAcceptance(db, 'obl-10', false)) !== null)
as('u-sal', () => completeObligation(db, 'obl-19')); as('u-leg', () => decideAcceptance(db, 'obl-19', false, 'عيب'))
ok('rejected obligation is open again', o('obl-19').status === 'Rejected')
ok('completing the dependency unlocks the dependent', as('u-mgr', () => completeObligation(db, 'obl-05')) === null && as('u-mgr', () => startObligation(db, 'obl-06')) === null)
ok('cycle detected', wouldCycle(db, 'obl-04', 'obl-06'))
ok('cycle refused on save', saveObligation(db, { ...o('obl-04'), dependsOnId: 'obl-06' }) !== null)

// 2) overdue by demo date + display-only penalty
ok('obl-02 planned today', effStatus(o('obl-02')) === 'Planned')
setDate('2026-12-16')
ok('obl-02 overdue after its due date', effStatus(o('obl-02')) === 'Overdue')
setDate('2026-10-30')
const o11 = o('obl-11')
ok('penalty percent/day capped', Math.abs(penaltyOf(o11) - Math.min(0.001 * 27_750_000 * 2, 1_387_500)) < 1, String(penaltyOf(o11)))
const o16 = o('obl-16')
ok('penalty fixed/day', penaltyOf(o16) === Math.min(100_000 * 29, 3_000_000), String(penaltyOf(o16)))
ok('fixed penalty capped', penaltyOf(o('obl-15')) === 0)
setDate('2026-11-10')
ok('fixed penalty applies once late', penaltyOf(o('obl-15')) === 5000)
setDate('2026-10-30')

// 3) recurrence is idempotent
const before = db.occurrences.length
setDate('2026-12-02'); const g1 = generateOccurrences(db), g2 = generateOccurrences(db)
ok('occurrences generated once', g1 > 0 && g2 === 0 && db.occurrences.length === before + g1)
ok('occurrences unique per date', new Set(db.occurrences.map((x) => `${x.obligationId}|${x.dueDate}`)).size === db.occurrences.length)
setDate('2026-10-30')

// 4) termination cancels open obligations unless they survive
const n = cancelOnTermination(db, db.contracts.find((c) => c.id === 'c-09')!)
ok('termination cancels open obligations', n === 2 && o('obl-13').status === 'Cancelled')
ok('surviving obligation stays open', cancelOnTermination(db, db.contracts.find((c) => c.id === 'c-23')!) === 0 && o('obl-22').status === 'Planned')

// 5) billing from a due item reaches the ledger
const inv0 = balanceOf(db, 'c-01-l1').invQ
ok('due item can be billed; future item cannot', billingBlocker(db, it('pay-19')) === undefined && billingBlocker(db, it('pay-20')) !== undefined)
ok('create sales invoice from due item', as('u-fin', () => createBilling(db, 'pay-19')) === null && it('pay-19').status === 'Invoiced')
ok('invoice entry in the ledger (+2000 on line 1)', balanceOf(db, 'c-01-l1').invQ === inv0 + 2000 && db.billingLog.some((b) => b.paymentItemId === 'pay-19' && !!b.ledgerDocId))
ok('second billing refused', createBilling(db, 'pay-19') !== null)
ok('invoiced item is frozen', saveItem(db, { ...it('pay-19'), amount: 1 }) !== null)
const s1 = financialSummary(db, db.contracts.find((c) => c.id === 'c-01')!)
ok('summary shows settlement unavailable until Finance reports', s1.outstanding === null && s1.unsettled === 1)
ok('partial payment keeps it invoiced, full payment closes it', recordPayment(db, 'pay-19', 100_000_000) === null && it('pay-19').status === 'Invoiced' && recordPayment(db, 'pay-19', 190_000_000) === null && it('pay-19').status === 'Paid')
const s2 = financialSummary(db, db.contracts.find((c) => c.id === 'c-01')!)
ok('outstanding = invoiced - paid after settlement', s2.outstanding === 0 && s2.paidValue === 190_000_000)
const s17 = financialSummary(db, db.contracts.find((c) => c.id === 'c-17')!)
ok('c-17 has an invoice without settlement -> unavailable', s17.outstanding === null)
const s16 = financialSummary(db, db.contracts.find((c) => c.id === 'c-16')!)
ok('c-16 invoiced 81M, paid 81M, outstanding 0', s16.invoicedValue === 81_000_000 && s16.paidValue === 81_000_000 && s16.outstanding === 0)
ok('template billing creates a record, no document', (() => { const t = it('pay-18'); t.billingDocType = 'PurchaseTemplate'; setDate('2026-11-11'); const e = createBilling(db, 'pay-18'); setDate('2026-10-30'); return e === null && db.billingLog.find((b) => b.paymentItemId === 'pay-18')!.template })())

// 6) schedule check
const c25 = db.contracts.find((c) => c.id === 'c-25')!
ok('schedule at 100%', scheduleCheck(db, c25).percent === 100 && scheduleCheck(db, c25).warnings.length === 0)
ok('over 100% warns', scheduleCheck(db, c25, [...db.paymentItems.filter((p) => p.contractId === 'c-25'), { ...it('pay-15'), id: 'x', percent: 20 }]).warnings.length > 0)

// 7) alerts
const alerts = computeAlerts(db)
ok('obligation and guarantee alerts', alerts.some((a) => a.rule === 'ObligationDue' && a.key.includes('obl-11')) && alerts.some((a) => a.rule === 'GuaranteeExpiry' && a.key.includes('gar-2')))

ok('integrity (finance)', checkFinance(db).length === 0, checkFinance(db).join('|'))
ok('integrity (agreements)', checkAgreements(db).length === 0, checkAgreements(db).join('|'))
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
