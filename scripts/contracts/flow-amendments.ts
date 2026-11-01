import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { applyAmendment, applyBlocker, applyDueAmendments, canAmendStatus, createAmendment, decideAmendment, diffPayloads, hashValid, submitAmendment, versionsOf } from '../../src/modules/contracts/data/amendments'
import { autoRenew, renewContract, renewalDefaults } from '../../src/modules/contracts/data/renewal'
import { syncTime } from '../../src/modules/contracts/data/lifecycle'
import { checkAmendments, checkAgreements } from '../../src/modules/contracts/data/integrity'
import { balanceOf } from '../../src/modules/contracts/data/fulfillment'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const as = <T,>(u: string, f: () => T) => { const p = db.userId; db.userId = u; try { return f() } finally { db.userId = p } }
const c = (id: string) => db.contracts.find((x) => x.id === id)!
const mk = (cid: string, creator: string, input: Parameters<typeof createAmendment>[2]) => { const r = as(creator, () => createAmendment(db, c(cid), input)); if (typeof r === 'string') throw new Error(r); return r }
const approveAll = (id: string, users: string[]) => users.map((u) => as(u, () => decideAmendment(db, id, 'Approved', 'ok')))

// 1) amend value and quantity -> approve -> apply -> compare v1/v2
const ledgerBefore = db.ledger.length, balBefore = JSON.stringify(balanceOf(db, 'c-03-l1'))
const a = mk('c-03', 'u-sal', { type: 'ChangeLines', reason: 'more quantity', effectiveDate: '2026-10-30', header: [], partyOps: [], lineOps: [{ op: 'Change', lineNum: 1, fields: { agreedQuantity: 1000, unitPrice: 790 } }] })
ok('submit', as('u-sal', () => submitAmendment(db, a.id)) === null)
ok('creator is not an eligible approver', as('u-sal', () => decideAmendment(db, a.id, 'Approved', '')) !== null)
const res = approveAll(a.id, ['u-mgr', 'u-fd', 'u-gm'])
ok('three stages (value > 100M IQD) approve it', res.every((r) => r === null) && a.status === 'Approved', JSON.stringify(res))
ok('apply', as('u-mgr', () => applyAmendment(db, a.id)) === null && c('c-03').versionNo === 2 && a.status === 'Applied')
const vs = versionsOf(db, 'c-03')
ok('two versions, hashes valid, v1 untouched', vs.length === 2 && vs.every(hashValid) && vs[1].payload.lines[0].agreedQuantity === 800 && vs[0].payload.lines[0].agreedQuantity === 1000)
const diff = diffPayloads(db, vs[1].payload, vs[0].payload)
ok('compare v1/v2 lists quantity and price', diff.some((r) => r.group === 'lines' && r.label.endsWith('الكمية')) && diff.some((r) => r.group === 'lines' && r.label.endsWith('السعر')), diff.map((r) => `${r.label}:${r.from}>${r.to}`).join(' | '))
ok('ledger and balances untouched (BR-M-04)', db.ledger.length === ledgerBefore && JSON.stringify(balanceOf(db, 'c-03-l1')) === balBefore)

// 2) cutting below consumed is refused
const b = mk('c-03', 'u-sal', { type: 'ChangeLines', reason: 'cut', effectiveDate: '2026-10-30', header: [], partyOps: [], lineOps: [{ op: 'Change', lineNum: 1, fields: { agreedQuantity: 600 } }] })
const sub = as('u-sal', () => submitAmendment(db, b.id))
ok('cut below consumed refused', !!sub && sub.includes('دون المستهلك'), String(sub))

// 3) one open amendment per contract, stale
const second = as('u-sal', () => createAmendment(db, c('c-03'), { type: 'Other', reason: 'x', effectiveDate: '2026-10-30', header: [], lineOps: [], partyOps: [] }))
ok('second open amendment refused', typeof second === 'string' && second.includes('ملحق مفتوح'))
b.status = 'Cancelled'
const st = mk('c-03', 'u-sal', { type: 'ExtendTerm', reason: 'extend', effectiveDate: '2026-10-30', header: [{ path: 'endDate', oldValue: c('c-03').endDate, newValue: '2027-02-28' }], lineOps: [], partyOps: [] })
c('c-03').versionNo += 1
ok('stale amendment refused at submit', (as('u-sal', () => submitAmendment(db, st.id)) ?? '').includes('stale'))
c('c-03').versionNo -= 1; st.status = 'Cancelled'

// 4) future effective date: approved amendment waits, then the demo date applies it
const fut = db.amendments.find((x) => x.contractId === 'c-11' && x.status === 'Approved')!
ok('future amendment blocked until its date', !!applyBlocker(db, fut))
db.asOf = '2026-12-02'; setToday('2026-12-02')
ok('demo date applies due amendments', applyDueAmendments(db) >= 1 && fut.status === 'Applied' && c('c-11').paymentTermId === 'pt-60' && fut.appliedBy === 'system')
db.asOf = '2026-10-30'; setToday('2026-10-30')

// 5) renew an expired contract; one successor; lines renumbered with reset counters
const old = c('c-08')
const def = renewalDefaults(db, old)
const nc = renewContract(db, 'c-08', def)
ok('successor created as Draft', typeof nc !== 'string' && nc.status === 'Draft' && nc.renewedFromContractId === 'c-08' && old.successorContractId === nc.id)
if (typeof nc !== 'string') {
  const nl = db.lines.filter((l) => l.contractId === nc.id)
  ok('lines renumbered from 1, counters reset', nl.map((l) => l.lineNum).join() === '1,2' && nl.every((l) => (db.balances[l.id]?.relQ ?? 0) === 0))
  ok('one successor only', typeof renewContract(db, 'c-08', def) === 'string')
  ;['Counterparty', 'Company'].forEach((r) => db.signatures.push({ id: `t-${r}`, contractId: nc.id, role: r, signerName: 'x', signerTitle: 'x', signedOn: '2026-10-30', method: 'Uploaded' }))
  db.attachments.push({ id: 't-att', ownerType: 'contract', ownerId: nc.id, subType: 'Signed', fileName: 's.pdf', size: 1, contentType: 'application/pdf', uploadedBy: 'u-mgr', uploadedAt: '2026-10-30T10:00', version: 1 })
  nc.status = 'Approved'; nc.startDate = '2026-10-30'
  syncTime(db)
  ok('successor activates -> predecessor Closed (Renewed), version reason Renewal', nc.status === 'Active' && old.status === 'Closed' && old.closureReason === 'Renewed' && versionsOf(db, nc.id)[0].reason === 'Renewal')
}

// 6) grace window
ok('expired contract amendable within grace', canAmendStatus(db, c('c-20')) === null)
db.asOf = '2027-03-01'; setToday('2027-03-01')
ok('after grace only a successor', (canAmendStatus(db, c('c-20')) ?? '').includes('مدة السماح'))

// 7) auto renewal exactly once, when the date advances
db.asOf = '2027-01-02'; setToday('2027-01-02'); syncTime(db)
const n1 = autoRenew(db), n2 = autoRenew(db)
ok('auto renewal fires once (c-16 notice deadline 2027-01-01)', n1 >= 1 && n2 === 0 && !!c('c-16').successorContractId, `${n1}/${n2}`)

// 8) tamper
const v = db.versions[0]; const keep = v.payload.header.contractValue
v.payload.header.contractValue = 1
ok('tamper detected', !hashValid(v))
v.payload.header.contractValue = keep

ok('integrity (amendments)', checkAmendments(db).length === 0, checkAmendments(db).join('|'))
ok('integrity (agreements)', checkAgreements(db).length === 0)
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
