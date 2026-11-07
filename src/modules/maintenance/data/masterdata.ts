// Master data rules (spec §2, §4): required fields, unique codes, in-use guard on delete. Called inside run().
import { addAudit } from './store'
import type { DB } from './types'

export type MasterKey = 'maintenanceTypes' | 'categories' | 'failureCodes' | 'operations' | 'workshops' | 'expenseTypes' | 'technicians'

export const masterLabel: Record<MasterKey, string> = {
  maintenanceTypes: 'نوع صيانة',
  categories: 'فئة أصول',
  failureCodes: 'كود عطل',
  operations: 'عملية قياسية',
  workshops: 'ورشة',
  expenseTypes: 'نوع مصروف',
  technicians: 'فني',
}

type Row = { id: string; code?: string; employeeNo?: string; name: string }

const codeOf = (key: MasterKey, r: Row) => (key === 'technicians' ? r.employeeNo : r.code) ?? ''

/** Where a master row is referenced; a referenced row cannot be deleted (it can be deactivated where supported). */
function usage(d: DB, key: MasterKey, id: string): string | null {
  const used = (n: number, what: string) => (n ? `${n} ${what}` : null)
  switch (key) {
    case 'maintenanceTypes': return used(d.workOrders.filter((w) => w.maintenanceTypeId === id).length + d.requests.filter((r) => r.maintenanceTypeId === id).length, 'مستند')
    case 'categories': return used(d.assets.filter((a) => a.categoryId === id).length + d.failureCodes.filter((f) => f.categoryId === id).length, 'أصل/كود عطل')
    case 'failureCodes': return used(d.workOrders.filter((w) => w.failureCodeId === id).length, 'أمر عمل')
    case 'operations': return used(d.workOrders.filter((w) => w.operations.some((o) => o.operationId === id)).length, 'أمر عمل')
    case 'workshops': {
      if (d.workshops.length === 1) return 'آخر ورشة (يلزم وجود ورشة واحدة على الأقل)'
      const bays = d.workshops.find((w) => w.id === id)?.bays.map((b) => b.id) ?? []
      return used(d.bookings.filter((b) => b.bayId && bays.includes(b.bayId)).length, 'حجز')
    }
    case 'expenseTypes': return used(d.workOrders.filter((w) => w.expenseTypeId === id || w.parts.some((p) => p.expenseTypeId === id)).length
      + d.maintenanceTypes.filter((m) => m.defaultExpenseTypeId === id).length, 'أمر عمل/نوع صيانة')
    case 'technicians': return used(d.bookings.filter((b) => b.technicianIds.includes(id)).length + d.workOrders.filter((w) => w.leadTechnicianId === id).length, 'حجز/أمر عمل')
  }
}

export function saveMaster<T extends Row>(d: DB, key: MasterKey, row: T, required: (keyof T)[]): string | null {
  const list = d[key] as unknown as T[]
  for (const f of required) {
    const v = row[f]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return 'أكمل الحقول الإلزامية'
  }
  const code = codeOf(key, row).trim().toUpperCase()
  if (list.some((x) => x.id !== row.id && codeOf(key, x).trim().toUpperCase() === code)) return `الرمز ${codeOf(key, row)} مستخدم في ${masterLabel[key]} آخر`
  const i = list.findIndex((x) => x.id === row.id)
  if (i >= 0) list[i] = row
  else list.push(row)
  addAudit(d, key, row.id, i >= 0 ? `تعديل ${masterLabel[key]}` : `إضافة ${masterLabel[key]}`, `${codeOf(key, row)} — ${row.name}`)
  return null
}

export function deleteMaster(d: DB, key: MasterKey, id: string): string | null {
  const list = d[key] as unknown as Row[]
  const row = list.find((x) => x.id === id)
  if (!row) return 'السجل غير موجود'
  const u = usage(d, key, id)
  if (u) return `لا يمكن الحذف: مستخدم في ${u}`
  ;(d as unknown as Record<MasterKey, Row[]>)[key] = list.filter((x) => x.id !== id)
  addAudit(d, key, id, `حذف ${masterLabel[key]}`, `${codeOf(key, row)} — ${row.name}`)
  return null
}
