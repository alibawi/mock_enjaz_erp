import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { changeLines, decideChange, generateFromTerm, previewFromTerm, requestChange, validateChange, withdrawChange, type ChangeInput } from '../../src/modules/contracts/data/installments'
import { billingBlocker, createBilling, deleteItem, effItemStatus, itemsOf, saveItem, scheduleCheck } from '../../src/modules/contracts/data/payments'
import { changeSetting } from '../../src/modules/contracts/data/admin'
import { perform } from '../../src/modules/contracts/data/lifecycle'
import { checkFinance } from '../../src/modules/contracts/data/integrity'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const as = <T,>(u: string, f: () => T) => { const p = db.userId; db.userId = u; try { return f() } finally { db.userId = p } }
const it = (id: string) => db.paymentItems.find((x) => x.id === id)!
const c = (id: string) => db.contracts.find((x) => x.id === id)!
const req = (x: Omit<ChangeInput, 'lines'> & { parts: { dueDate: string; amount: number }[] }) => requestChange(db, { ...x, lines: changeLines(db, x.kind, x.itemIds, x.parts) })
const last = () => db.scheduleChanges[db.scheduleChanges.length - 1]
setToday('2026-10-30'); db.asOf = '2026-10-30'

// 1) generation from a payment term (BR-PI-01/02)
const c26 = c('c-26')
const pv = previewFromTerm(db, c26, 'pt-i3', '2026-12-01')
ok('3 installments 34/33/33, total = value, rounding on the last', pv.length === 3 && pv.reduce((s, p) => s + p.amount, 0) === c26.contractValue && pv[0].amount === 18_360_000 && pv[2].amount === 54_000_000 - 18_360_000 - 17_820_000)
ok('due dates = base + days', pv.map((p) => p.dueDate).join() === '2026-12-31,2027-01-30,2027-03-01')
ok('generate in Draft replaces the schedule', generateFromTerm(db, 'c-26', 'pt-i3', '2026-12-01') === null && itemsOf(db, 'c-26').length === 3 && scheduleCheck(db, c26).percent === 100)
ok('term without installments -> one item at base + days', previewFromTerm(db, c26, 'pt-60', '2026-12-01').length === 1 && previewFromTerm(db, c26, 'pt-60', '2026-12-01')[0].dueDate === '2027-01-30')
ok('USD keeps cents', (() => { const p = previewFromTerm(db, c('c-07'), 'pt-i3', '2026-12-01'); return p.reduce((s, x) => s + x.amount, 0) === c('c-07').contractValue && p[0].amount === 374571.2 })())
ok('regeneration refused after Draft', generateFromTerm(db, 'c-24', 'pt-i3', '2026-01-01') !== null)
ok('regeneration refused with a billed item', (() => { c26.status = 'Draft'; it(itemsOf(db, 'c-26')[0].id).status = 'Invoiced'; const e = generateFromTerm(db, 'c-26', 'pt-q4', '2026-12-01'); it(itemsOf(db, 'c-26')[0].id).status = 'Planned'; return e !== null })())
ok('draft items edit and delete directly', (() => { const x = itemsOf(db, 'c-26')[2]; return saveItem(db, { ...x, dueDate: '2027-03-15' }) === null && deleteItem(db, x.id) === null })())

// 2) no direct date/amount edit after Draft (BR-PI-04)
ok('active: date change refused', saveItem(db, { ...it('pay-24-4'), dueDate: '2027-01-15' }) !== null)
ok('active: notes still editable', saveItem(db, { ...it('pay-24-4'), notes: 'ملاحظة' }) === null)
ok('active: delete refused', deleteItem(db, 'pay-24-4') !== null)

// 3) defer (BR-PI-05, 09, 10)
ok('seed: deferred item keeps its original date', it('pay-24-3').originalDueDate === '2026-09-28' && it('pay-24-3').dueDate === '2026-11-20' && it('pay-24-3').rescheduleCount === 1)
ok('earlier date refused', validateChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], lines: changeLines(db, 'Defer', ['pay-24-4'], [{ dueDate: '2026-12-01', amount: 0 }]), reason: 'x' }).length > 0)
ok('after the contract end refused', validateChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], lines: changeLines(db, 'Defer', ['pay-24-4'], [{ dueDate: '2027-01-10', amount: 0 }]), reason: 'x' }).length > 0)
ok('allowed after the end when the setting allows', changeSetting(db, 'Schedule.AllowBeyondEndDate', true) === null && validateChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], lines: changeLines(db, 'Defer', ['pay-24-4'], [{ dueDate: '2027-01-10', amount: 0 }]), reason: 'x' }).length === 0)
changeSetting(db, 'Schedule.AllowBeyondEndDate', false)
ok('reason required', req({ contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], parts: [{ dueDate: '2026-12-30', amount: 0 }], reason: ' ' }) !== null)
ok('request created', as('u-fin', () => req({ contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], parts: [{ dueDate: '2026-12-30', amount: 0 }], reason: 'سيولة' })) === null && last().status === 'Pending')
ok('one open request per item', as('u-fin', () => req({ contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-4'], parts: [{ dueDate: '2026-12-29', amount: 0 }], reason: 'x' })) !== null)
setToday('2026-12-28'); db.asOf = '2026-12-28'
ok('item under request cannot be billed', billingBlocker(db, it('pay-24-4')) !== undefined && billingBlocker(db, it('pay-24-4'))!.includes('طلب'))
setToday('2026-10-30'); db.asOf = '2026-10-30'
ok('requester cannot approve', as('u-fin', () => decideChange(db, last().id, true)) !== null)
ok('role without permission cannot approve', as('u-sal', () => decideChange(db, last().id, true)) !== null)
ok('rejection needs a comment', as('u-mgr', () => decideChange(db, last().id, false)) !== null)
ok('approve applies the deferral', as('u-mgr', () => decideChange(db, last().id, true)) === null && it('pay-24-4').dueDate === '2026-12-30' && it('pay-24-4').originalDueDate === '2026-12-27' && last().status === 'Approved')
changeSetting(db, 'Schedule.MaxDeferralsPerItem', 1)
ok('deferral limit from settings', validateChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-3'], lines: changeLines(db, 'Defer', ['pay-24-3'], [{ dueDate: '2026-12-01', amount: 0 }]), reason: 'x' }).some((e) => e.includes('الحد الأقصى')))
changeSetting(db, 'Schedule.MaxDeferralsPerItem', 3)
ok('billed item cannot be deferred', validateChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-1'], lines: changeLines(db, 'Defer', ['pay-24-1'], [{ dueDate: '2026-12-01', amount: 0 }]), reason: 'x' }).length > 0)
ok('draft contract uses direct edit, not requests', validateChange(db, { contractId: 'c-26', kind: 'Defer', itemIds: [itemsOf(db, 'c-26')[0].id], lines: changeLines(db, 'Defer', [itemsOf(db, 'c-26')[0].id], [{ dueDate: '2027-02-01', amount: 0 }]), reason: 'x' }).length > 0)

// 4) split (BR-PI-06) — the seeded pending split on c-18
const sp = db.scheduleChanges.find((x) => x.contractId === 'c-18' && x.status === 'Pending')!
ok('seed: overdue item under pending split', !!sp && effItemStatus(it('pay-18-3')) === 'Due')
ok('seed: partial payment shows PartiallyPaid', effItemStatus(it('pay-18-2')) === 'PartiallyPaid')
ok('split parts must total the item', validateChange(db, { contractId: 'c-18', kind: 'Split', itemIds: ['pay-18-4'], lines: changeLines(db, 'Split', ['pay-18-4'], [{ dueDate: '2026-11-10', amount: 4000 }, { dueDate: '2026-11-30', amount: 4000 }]), reason: 'x' }).some((e) => e.includes('مجموع')))
const before18 = scheduleCheck(db, c('c-18'))
ok('approve split creates the second part', as('u-app', () => decideChange(db, sp.id, true)) === null && it('pay-18-3').amount === 4500 && it('pay-18-3').dueDate === '2026-11-15' && db.paymentItems.some((p) => p.splitFromId === 'pay-18-3' && p.amount === 4500 && p.dueDate === '2026-12-15'))
const after18 = scheduleCheck(db, c('c-18'))
ok('split keeps total and percent', after18.amount === before18.amount && Math.abs(after18.percent - before18.percent) < 0.001, `${before18.percent} -> ${after18.percent}`)

// 5) merge (BR-PI-07)
const part = db.paymentItems.find((p) => p.splitFromId === 'pay-18-3')!
ok('merge request', as('u-fin', () => req({ contractId: 'c-18', kind: 'Merge', itemIds: ['pay-18-4', 'pay-18-5'], parts: [{ dueDate: '2026-12-20', amount: 0 }], reason: 'تبسيط' })) === null)
ok('approve merge: one item keeps the total, the other is cancelled', as('u-mgr', () => decideChange(db, last().id, true)) === null && it('pay-18-4').amount === 18000 && it('pay-18-4').percent === 40 && it('pay-18-5').status === 'Cancelled')
ok('total unchanged after merge', scheduleCheck(db, c('c-18')).amount === after18.amount)

// 6) stale request and withdraw
ok('withdraw by requester only', as('u-fin', () => req({ contractId: 'c-18', kind: 'Defer', itemIds: [part.id], parts: [{ dueDate: '2027-01-15', amount: 0 }], reason: 'x' })) === null && as('u-mgr', () => withdrawChange(db, last().id)) !== null && as('u-fin', () => withdrawChange(db, last().id)) === null)
ok('stale request refused at approval', (() => {
  as('u-fin', () => req({ contractId: 'c-18', kind: 'Defer', itemIds: [part.id], parts: [{ dueDate: '2027-01-15', amount: 0 }], reason: 'x' }))
  it(part.id).status = 'Invoiced'; const e = as('u-mgr', () => decideChange(db, last().id, true)); it(part.id).status = 'Planned'; return e !== null && e.includes('تغيّر')
})())

// 7) termination (BR-PI-14)
as('u-mgr', () => perform(db, 'c-18', 'terminate', { date: '2026-10-30', reason: 'إنهاء تجريبي' }))
ok('termination cancels unbilled items and withdraws requests', c('c-18').status === 'Terminated' && itemsOf(db, 'c-18').every((p) => p.status !== 'Planned') && db.scheduleChanges.every((x) => x.contractId !== 'c-18' || x.status !== 'Pending'))
ok('billed items stay', it('pay-18-1').status === 'Paid' && it('pay-18-2').status === 'Invoiced')
ok('billing still works on c-24 after its deferral', (() => { setToday('2026-11-20'); db.asOf = '2026-11-20'; const e = createBilling(db, 'pay-24-3'); setToday('2026-10-30'); db.asOf = '2026-10-30'; return e === null })())

ok('integrity (finance)', checkFinance(db).length === 0, checkFinance(db).join('|'))
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
