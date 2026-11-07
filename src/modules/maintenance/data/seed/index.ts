// Seed entry point. Documents (requests, estimates, WOs, bookings, billing) are added area by area (prompts 3.1 …).
import { DEFAULT_TODAY } from '../asof'
import { defaultRolePerms } from '../permissions'
import type { DB } from '../types'
import * as as_ from './assets'
import * as es from './estimates'
import * as m from './master'
import * as rq from './requests'
import * as wo from './workorders'
import * as sc from './schedule'
import * as bl from './billing'
import * as lb from './labor'

export function seed(): DB {
  return structuredClone({
    asOf: DEFAULT_TODAY,
    role: 'advisor',
    userId: 'u-adv',
    simulateError: false,
    rolePerms: defaultRolePerms,
    users: m.users,
    settings: m.settings,
    maintenanceTypes: m.maintenanceTypes,
    categories: m.categories,
    failureCodes: m.failureCodes,
    operations: m.operations,
    workshops: m.workshops,
    expenseTypes: m.expenseTypes,
    technicians: m.technicians,
    partners: [...m.partners, ...wo.partners],
    items: m.items,
    warehouses: m.warehouses,
    stock: m.stock.map((r) => ({ ...r, reserved: r.reserved + (wo.reserved[r.itemId] ?? 0) })),
    timeSlots: m.timeSlots,
    assets: [...as_.assets, ...wo.assets],
    vehicles: [...as_.vehicles, ...wo.vehicles],
    readings: [...as_.readings, ...rq.intakeReadings, ...wo.readings],
    requests: [...wo.requests, ...rq.requests, ...es.requests],
    estimates: [...wo.estimates, ...es.estimates],
    approvals: [...wo.approvals, ...es.approvals],
    tasks: es.tasks,
    workOrders: wo.workOrders,
    bookings: sc.bookings,
    leaves: sc.leaves,
    attendance: lb.attendance,
    goodsIssues: wo.goodsIssues,
    invoices: bl.invoices,
    receipts: bl.receipts,
    applications: bl.applications,
    audit: [...wo.audit, ...sc.audit, ...bl.audit, ...es.audit],
    counters: { ...wo.counters, ...sc.counters, ...bl.counters },
  } satisfies DB)
}
