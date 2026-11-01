import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { changeSetting, deleteStageRule, featureOn, maxUsed, resetMatrix, resetSettings, saveStageRule, setRolePerm, setUserScope, settingsAudit, updateSeries } from '../../src/modules/contracts/data/admin'
import { postDoc, previewPost } from '../../src/modules/contracts/data/fulfillment'
import { canSeeAs, nextNumber } from '../../src/modules/contracts/data/lifecycle'
import { can } from '../../src/modules/contracts/data/permissions'
import { billingBlocker } from '../../src/modules/contracts/data/payments'
import { selectRule, startApproval } from '../../src/modules/contracts/data/approval'
import { defaultSettings } from '../../src/modules/contracts/data/settings'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
setToday(db.asOf)

// 1) flip enforcement / failure / currency settings and replay the same simulator case (BR-X-01)
const big = { docType: 'SOR' as const, contractId: 'c-04', date: '2026-10-25', currency: 'IQD' as const, lines: [{ itemId: 'it-7', qty: 50000, unitPrice: 14500 }] }
const ledgerBefore = db.ledger.length, balBefore = JSON.stringify(db.balances)
ok('Warn: warning only', changeSetting(db, 'Agreements.EnforcementMode', 'Warn') === null && previewPost(db, big).issues.every((i) => i.level === 'warning') && !previewPost(db, big).error)
changeSetting(db, 'Agreements.EnforcementMode', 'Block')
ok('Block + Rollback: refused', changeSetting(db, 'Agreements.OnFulfillmentFailure', 'Rollback') === null && !!previewPost(db, big).error)
ok('Block + KeepAndAlert: kept and flagged', changeSetting(db, 'Agreements.OnFulfillmentFailure', 'KeepAndAlert') === null && !!previewPost(db, big).kept)
changeSetting(db, 'Agreements.EnforcementMode', 'None')
ok('None: no issues', previewPost(db, big).issues.length === 0)
ok('flipping settings never touches recorded ledger or balances', db.ledger.length === ledgerBefore && JSON.stringify(db.balances) === balBefore)
changeSetting(db, 'Agreements.EnforcementMode', 'Warn'); changeSetting(db, 'Agreements.OnFulfillmentFailure', 'Rollback')

db.rates.push({ code: 'USD', date: '2026-10-25', rate: 1400 })
const iqdOnUsd = { docType: 'SOR' as const, contractId: 'c-03', date: '2026-10-26', currency: 'IQD' as const, rate: 1, lines: [{ itemId: 'it-3', qty: 10, unitPrice: 1_021_800 }] }
const a = previewPost(db, iqdOnUsd).entries[0]
changeSetting(db, 'Currency.ConversionRateSource', 'DocumentDateRate')
const b = previewPost(db, iqdOnUsd).entries[0]
ok('currency source flips the conversion rate (1310 activation vs 1400 document date)', a.rateUsed === 1310 && b.rateUsed === 1400 && a.valueDelta !== b.valueDelta, `${a.rateUsed}/${b.rateUsed}`)
changeSetting(db, 'Currency.ConversionRateSource', 'ActivationRate')

changeSetting(db, 'Agreements.ReturnsRestoreCommitment', false)
const inv = postDoc(db, { docType: 'INV', contractId: 'c-01', date: '2026-10-26', currency: 'IQD', stockMovement: true, lines: [{ itemId: 'it-1', qty: 10, unitPrice: 95000 }] }, { validate: false })
const n0 = db.ledger.length
const ret = postDoc(db, { docType: 'RET', contractId: 'c-01', date: '2026-10-27', currency: 'IQD', baseDocId: inv.doc!.id, lines: [{ itemId: 'it-1', qty: 2, unitPrice: 95000 }] }, { validate: false })
ok('restore off: return adds no ledger entries', !ret.error && db.ledger.length === n0)
changeSetting(db, 'Agreements.ReturnsRestoreCommitment', true)

// 2) settings audit (BR-X-07) and validation
const rows = settingsAudit(db)
ok('every change logged with old and new', rows.some((r) => r.entityId === 'Agreements.EnforcementMode' && r.detail.includes('←')) && rows.some((r) => r.entityId === 'Currency.ConversionRateSource'))
const cnt = rows.length
changeSetting(db, 'Agreements.EnforcementMode', 'Warn')
ok('same value writes no row', settingsAudit(db).length === cnt)
ok('invalid values refused', changeSetting(db, 'Reminder.Days', 'abc') !== null && changeSetting(db, 'Agreements.EnforcementMode', 'Maybe' as never) !== null && changeSetting(db, 'Renewal.GraceDays', -5) !== null)
changeSetting(db, 'Renewal.GraceDays', 30)
ok('reset restores defaults', resetSettings(db) >= 1 && db.settings['Renewal.GraceDays'] === defaultSettings()['Renewal.GraceDays'])

// 3) permission matrix (BR-X-02)
ok('requester cannot approve by default', !can(db.rolePerms, 'requester', 'Contracts.Approve'))
ok('granting the permission changes can()', setRolePerm(db, 'requester', 'Contracts.Approve', true) === null && can(db.rolePerms, 'requester', 'Contracts.Approve'))
ok('admin column is locked', setRolePerm(db, 'admin', 'Contracts.View', false) !== null)
resetMatrix(db)
ok('reset matrix restores the defaults', !can(db.rolePerms, 'requester', 'Contracts.Approve') && settingsAudit(db).some((r) => r.entity === 'permission'))

// 4) numbering (BR-X-04)
const sa1 = db.contractTypes.find((t) => t.id === 'ct-sa1')!
const used = maxUsed(db, sa1.prefix)
const existing = db.contracts.map((c) => c.number)
ok('next number below a used one is refused', updateSeries(db, sa1.id, { next: used }) !== null)
ok('next number and size change', updateSeries(db, sa1.id, { next: used + 50, size: 4 }) === null)
const created = nextNumber(db, sa1.id, '2026-11-01')
ok('new contract follows the series', created === `CTR-${sa1.prefix}-2026-${String(used + 50).padStart(4, '0')}`, created)
ok('existing numbers untouched', JSON.stringify(db.contracts.map((c) => c.number)) === JSON.stringify(existing))
ok('duplicate prefix refused', updateSeries(db, sa1.id, { prefix: 'PA' }) !== null)
ok('prefix change applies to new numbers only', updateSeries(db, sa1.id, { prefix: 'SX' }) === null && nextNumber(db, sa1.id, '2026-11-01').startsWith('CTR-SX-2026-') && db.contracts.map((c) => c.number).every((n, i) => n === existing[i]))
ok('bad prefix and size refused', updateSeries(db, sa1.id, { prefix: 'a b' }) !== null && updateSeries(db, sa1.id, { size: 2 }) !== null)

// 5) approval stage rules apply to new submissions only (BR-X-06)
const pendingReq = db.approvalRequests.find((r) => r.status === 'Pending' && r.subjectType === 'Contract')!
const snap = JSON.stringify(pendingReq.stages)
const rule = db.stageRules.find((r) => r.id === pendingReq.ruleId)!
const edited = { ...structuredClone(rule), stages: [{ no: 1, label: 'مرحلة وحيدة', userId: 'u-gm' }] }
ok('rule edit saved', saveStageRule(db, edited) === null && db.stageRules.find((r) => r.id === rule.id)!.stages.length === 1)
ok('pending request keeps its snapshot', JSON.stringify(db.approvalRequests.find((r) => r.id === pendingReq.id)!.stages) === snap)
const c06 = db.contracts.find((c) => c.id === pendingReq.contractId)!
ok('a new submission uses the edited rule', selectRule(db, 'Contract', { ...c06 })?.stages.length === 1)
ok('overlapping active rule refused', saveStageRule(db, { ...structuredClone(rule), id: 'dup', name: 'تداخل' }) !== null)
ok('deleting a rule with pending requests refused', deleteStageRule(db, rule.id) !== null)
ok('rule without stages refused', saveStageRule(db, { ...edited, stages: [] }) !== null)
void startApproval

// 6) data authority (BR-X-03)
const org2 = db.contracts.filter((c) => c.organizationId === 'org-2' || c.ownerUserId === 'u-bsr')
const seenBsr = db.contracts.filter((c) => canSeeAs(db, 'u-bsr', c))
ok('Org scope sees only its organization (and its own)', seenBsr.length > 0 && seenBsr.length < db.contracts.length && seenBsr.every((c) => c.organizationId === 'org-2' || c.ownerUserId === 'u-bsr') && org2.filter((c) => c.confidentiality === 'Normal').every((c) => seenBsr.includes(c)))
ok('System scope sees all non-confidential', db.contracts.filter((c) => c.confidentiality === 'Normal').every((c) => canSeeAs(db, 'u-mgr', c)))
ok('switching scope changes visibility', setUserScope(db, 'u-bsr', 'User') === null && db.contracts.filter((c) => canSeeAs(db, 'u-bsr', c)).length <= seenBsr.length && setUserScope(db, 'u-bsr', 'System') === null && db.contracts.filter((c) => canSeeAs(db, 'u-bsr', c)).length >= seenBsr.length)
const conf = db.contracts.find((c) => c.confidentiality === 'Restricted')!
ok('confidential contract still follows ViewConfidential', !canSeeAs(db, 'u-sal', conf) || conf.ownerUserId === 'u-sal')

// 7) feature flags (BR-X-05)
const item = db.paymentItems.find((p) => p.id === 'pay-19')!
changeSetting(db, 'Feature.RecurringBilling', false)
ok('billing automation off blocks billing', !featureOn(db, 'RecurringBilling') && (billingBlocker(db, item) ?? '').includes('معطّلة'))
changeSetting(db, 'Feature.RecurringBilling', true)
ok('billing automation on again', billingBlocker(db, item) === undefined || !(billingBlocker(db, item) ?? '').includes('معطّلة'))

console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
