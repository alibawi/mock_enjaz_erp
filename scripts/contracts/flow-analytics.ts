import { seed } from '../../src/modules/contracts/data/seed'
import { setToday } from '../../src/modules/contracts/data/asof'
import { dashboard, globalSearch, reportById, reports, toCsv, visibleContracts } from '../../src/modules/contracts/data/reports'
import { canSeeAs } from '../../src/modules/contracts/data/lifecycle'
import { changeSetting } from '../../src/modules/contracts/data/admin'
import { can } from '../../src/modules/contracts/data/permissions'
import { rateOn } from '../../src/modules/contracts/data/currency'
import type { DB, RoleId } from '../../src/modules/contracts/data/types'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
setToday(db.asOf)
const as = (db: DB, userId: string) => { db.userId = userId; db.role = db.users.find((u) => u.id === userId)!.role as RoleId }

// 1) every report builds for every user without errors and with consistent shapes
let built = 0, bad = ''
for (const u of db.users) {
  as(db, u.id)
  for (const r of reports) {
    try { const res = r.build(db, {}); built++; if (res.rows.some((row) => res.cols.some((c) => row.cells[c.key] === undefined && false))) bad = r.code } catch (e) { bad = `${r.code} ${(e as Error).message}` }
  }
}
ok(`all ${reports.length} reports build for all ${db.users.length} users (${built})`, !bad && reports.length === 17, bad)
as(db, 'u-adm')

// 2) data authority is applied before totals (BR-R-01)
const all = reportById('active')!.build(db, {}).rows.length
as(db, 'u-bsr')
const bsr = reportById('active')!.build(db, {})
ok('Org-scoped user: active report is a subset and equals what lists show', bsr.rows.length < all && bsr.rows.length === visibleContracts(db).filter((c) => c.status === 'Active').length, `${bsr.rows.length}/${all}`)
const byStatus = reportById('by-status')!.build(db, {})
ok('by-status total equals the visible contract count', byStatus.foot!.count === visibleContracts(db).length)
ok('lines of invisible agreements are excluded from R-09', reportById('fulfillment')!.build(db, {}).rows.every((r) => visibleContracts(db).some((c) => r.to === `/contracts/${c.id}`)))
ok('dashboard matches R-03 for the same user', dashboard(db).active.length === bsr.rows.length)
as(db, 'u-adm')

// 3) per-currency values and a stated rate when converting (BR-R-02)
const vp = reportById('value-partner')!.build(db, {})
ok('value by partner shows IQD and USD columns, not a mixed total', vp.cols.some((c) => c.key === 'iqd') && vp.cols.some((c) => c.key === 'usd') && !vp.cols.some((c) => c.key === 'total'))
const vc = reportById('value-partner')!.build(db, { cur: 'IQD' })
ok('converted report states the rate used', (vc.note ?? '').includes(rateOn(db, 'USD', db.asOf).toLocaleString('en-US')) && vc.cols.some((c) => c.key === 'total'))

// 4) dates follow the demo date (BR-R-03)
const exp30 = reportById('expiring')!.build(db, { days: '30' }).rows.length
setToday('2026-12-01'); db.asOf = '2026-12-01'
const exp30b = reportById('expiring')!.build(db, { days: '30' }).rows.length
ok('expiring list changes with the demo date', exp30 !== exp30b || exp30 > 0, `${exp30} -> ${exp30b}`)
setToday('2026-10-30'); db.asOf = '2026-10-30'

// 5) export (BR-R-04)
const csv = toCsv(reportById('active')!.build(db, {}))
ok('CSV has BOM, header and one line per row', csv.startsWith('﻿') && csv.split('\r\n').length === reportById('active')!.build(db, {}).rows.length + 1)
ok('export permission: manager yes, sales no', can(db.rolePerms, 'manager', 'Contracts.Export') && !can(db.rolePerms, 'sales', 'Contracts.Export'))
ok('reports permission: requester no, finance yes', !can(db.rolePerms, 'requester', 'Reports.View') && can(db.rolePerms, 'finance', 'Reports.View'))

// 6) drift report (BR-R-05)
ok('drift report shows zero drift on clean data', reportById('drift')!.build(db, {}).foot!.st === 'صفر انحراف')
db.balances['c-01-l1'] = { ...db.balances['c-01-l1'], fulQ: 1 }
ok('an injected drift appears in the report and the dashboard', String(reportById('drift')!.build(db, {}).foot!.st).includes('منحرف') && dashboard(db).drift === 1)

// 7) global search respects confidentiality (BR-R-06)
const restricted = db.contracts.find((c) => c.confidentiality === 'Restricted')!
as(db, 'u-sal')
ok('sales cannot find a restricted contract', !globalSearch(db, restricted.number.slice(-10)).some((h) => h.id === restricted.id) && !canSeeAs(db, 'u-sal', restricted))
as(db, 'u-leg')
ok('legal (ViewConfidential) can', globalSearch(db, restricted.number.slice(-10)).some((h) => h.id === restricted.id))
as(db, 'u-adm')
ok('search covers contracts, partners, documents, clauses', ['CTR-SA', 'الفرات', 'SOR-2026', 'السرية'].every((q) => globalSearch(db, q).length > 0), ['CTR-SA', 'الفرات', 'SOR-2026', 'السرية'].map((q) => globalSearch(db, q).length).join('/'))
ok('short queries return nothing', globalSearch(db, 'a').length === 0)

// 8) settings flips do not break the reports
changeSetting(db, 'Agreements.FulfillmentBasis', 'Invoice')
ok('remaining report follows the fulfillment basis', reportById('remaining')!.build(db, {}).note!.includes('الفاتورة'))

console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
