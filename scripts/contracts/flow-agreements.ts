import { seed } from '../../src/modules/contracts/data/seed'
import { createReturn, editDoc, postDoc, previewPost, recalculate, setDocState, balanceOf, hasDrift, resolveLine } from '../../src/modules/contracts/data/fulfillment'
import { computeAlerts } from '../../src/modules/contracts/data/alerts'
import { checkAgreements } from '../../src/modules/contracts/data/integrity'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const c = 'c-09' // purchases of cement (IQD), line1 it-1 9000 enforceMax
const l1 = 'c-09-l1'
const rel0 = balanceOf(db, l1).relQ, ful0 = balanceOf(db, l1).fulQ, inv0 = balanceOf(db, l1).invQ
const spec = (t: any, q: number, extra: any = {}) => ({ docType: t, contractId: c, date: '2026-10-20', currency: 'IQD' as const, lines: [{ itemId: 'it-1', qty: q, unitPrice: 92000 }], ...extra })

// 1) SO 10 -> delivery 6 -> invoice 6 -> return 2 -> cancel
const so = postDoc(db, spec('POR', 10)); ok('order posts', !so.error && balanceOf(db, l1).relQ === rel0 + 10)
const dl = postDoc(db, spec('PDN', 6, { baseDocId: so.doc!.id })); ok('goods receipt fulfils 6, no second release', balanceOf(db, l1).fulQ === ful0 + 6 && balanceOf(db, l1).relQ === rel0 + 10)
const iv = postDoc(db, spec('PCH', 6, { baseDocId: dl.doc!.id })); ok('bill invoices 6', balanceOf(db, l1).invQ === inv0 + 6)
const rt = createReturn(db, iv.doc!.id, 2, true)
ok('return restores: invoice -2, fulfil -2, release -2', !rt.error && balanceOf(db, l1).invQ === inv0 + 4 && balanceOf(db, l1).fulQ === ful0 + 4 && balanceOf(db, l1).relQ === rel0 + 8, JSON.stringify(balanceOf(db, l1)))
setDocState(db, so.doc!.id, 'Cancelled')
ok('cancelling the order removes its 10 (child docs keep theirs)', balanceOf(db, l1).relQ === rel0 + 8 - 10, String(balanceOf(db, l1).relQ - rel0))
ok('integrity after flow', checkAgreements(db).length === 0, checkAgreements(db).join('|'))

// 2) edit creates delta, older revision ignored
const e = postDoc(db, spec('POR', 100)); const before = db.ledger.length
editDoc(db, e.doc!.id, [{ lineId: e.doc!.lines[0].id, qty: 60, unitPrice: 92000 }])
ok('edit adds one Edited delta -40', db.ledger.length === before + 1 && db.ledger[db.ledger.length - 1].quantityDelta === -40 && db.ledger[db.ledger.length - 1].reason === 'Edited')

// 3) USD document on an IQD contract (c-02 general)
const u = postDoc(db, { docType: 'INV', contractId: 'c-02', date: '2026-10-21', currency: 'USD', stockMovement: true, lines: [{ itemId: 'it-3', qty: 10, unitPrice: 780 }] })
const last = u.entries.filter((x) => x.entryType === 'Invoice')[0]
ok('USD doc -> IQD contract uses doc rate (local value)', !!last && Math.abs(last.valueDelta - 10 * 780 * last.rateUsed) < 1 && last.docCurrency === 'USD', JSON.stringify([last?.valueDelta, last?.rateUsed]))
// IQD doc on USD contract c-03 with ActivationRate vs DocumentDateRate
const ac = postDoc(db, { docType: 'SOR', contractId: 'c-03', date: '2026-10-21', currency: 'IQD', rate: 1, lines: [{ itemId: 'it-3', qty: 10, unitPrice: 1021800 }] }, { validate: false })
ok('IQD doc on USD contract: ActivationRate 1310', Math.abs(ac.entries[0].valueDelta - 10 * 1021800 / 1310) < 0.01 && ac.entries[0].rateUsed === 1310, String(ac.entries[0].valueDelta))
db.settings['Currency.ConversionRateSource'] = 'DocumentDateRate'
const dd = postDoc(db, { docType: 'SOR', contractId: 'c-03', date: '2026-10-22', currency: 'IQD', rate: 1, lines: [{ itemId: 'it-3', qty: 10, unitPrice: 1021800 }] }, { validate: false })
ok('IQD doc on USD contract: DocumentDateRate 1310 (Oct rate)', dd.entries[0].rateUsed === 1310)
db.settings['Currency.ConversionRateSource'] = 'ActivationRate'

// 4) Block + Rollback vs KeepAndAlert (c-04 l1 enforceMax; ask for more than remaining)
const big = { docType: 'SOR' as const, contractId: 'c-04', date: '2026-10-25', currency: 'IQD' as const, lines: [{ itemId: 'it-7', qty: 50000, unitPrice: 14500 }] }
db.settings['Agreements.EnforcementMode'] = 'Warn'
let r = previewPost(db, big); ok('Warn: saved with warning, never throws', !r.error && r.issues.some((i) => i.level === 'warning'))
db.settings['Agreements.EnforcementMode'] = 'Block'; db.settings['Agreements.OnFulfillmentFailure'] = 'Rollback'
r = previewPost(db, big); ok('Block+Rollback: refused', !!r.error)
db.settings['Agreements.OnFulfillmentFailure'] = 'KeepAndAlert'
const kept = postDoc(db, big); ok('Block+KeepAndAlert: kept, entries flagged Exceeded, exceeded alert', !kept.error && !!kept.kept && kept.entries.every((x) => x.reason === 'Exceeded') && computeAlerts(db).some((a) => a.rule === 'Exceeded' && a.contractId === 'c-04'))
db.settings['Agreements.EnforcementMode'] = 'None'
r = previewPost(db, big); ok('None: no checks', !r.error && r.issues.length === 0)
db.settings['Agreements.EnforcementMode'] = 'Warn'

// 5) returns do not restore when setting is off
db.settings['Agreements.ReturnsRestoreCommitment'] = false
const f0 = balanceOf(db, l1)
const i2 = postDoc(db, spec('PCH', 5, { stockMovement: true })); const rr = createReturn(db, i2.doc!.id, 1, true)
ok('restore=false: return adds no entries', rr.entries.length === 0)
db.settings['Agreements.ReturnsRestoreCommitment'] = true

// 6) direct invoice with stock movement counts release+fulfil+invoice once
const d1 = postDoc(db, spec('PCH', 7, { stockMovement: true }))
ok('direct bill with stock: 3 entries', d1.entries.length === 3)

// 7) drift + recalculate
db.balances[l1] = { ...db.balances[l1], fulQ: 9999 }
ok('drift detected', hasDrift(db, l1)); recalculate(db, c); ok('recalculate heals drift', !hasDrift(db, l1))
ok('integrity at end', checkAgreements(db).length === 0, checkAgreements(db).join('|'))

// 8) resolver
const res = resolveLine(db, { partnerId: 'p-c1', itemId: 'it-1', date: '2026-10-30', currency: 'IQD' })
ok('resolver finds c-01 l1 with price 95000', res[0]?.contract.id === 'c-01' && res[0].price === 95000)
const gen = resolveLine(db, { partnerId: 'p-c2', itemId: 'it-3', date: '2026-10-30', currency: 'IQD' })
ok('general agreement: matched through category, no price', gen[0]?.contract.id === 'c-02' && gen[0].price === undefined)
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
