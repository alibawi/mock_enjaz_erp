// Asset registry rules (spec §2 Assets, BR-M-01; plan HTML §5 "بطاقة الأصل"). Called inside run().
import { today } from './asof'
import { addAudit } from './store'
import type { Asset, DB, MeterReading, VehicleDetails } from './types'
import { uid } from './format'

export type WarrantyState = 'valid' | 'expiring' | 'expired' | 'none'

/** Warranty as of the demo today; "expiring" = ends within 60 days (report "warranties expiring soon", §28.5). */
export function warrantyState(a: Asset, on = today()): WarrantyState {
  if (!a.warrantyEnd) return 'none'
  if (a.warrantyEnd < on) return 'expired'
  const days = (Date.parse(a.warrantyEnd) - Date.parse(on)) / 86_400_000
  return days <= 60 ? 'expiring' : 'valid'
}

export const lastReading = (d: DB, assetId: string): MeterReading | undefined =>
  d.readings.filter((r) => r.assetId === assetId).sort((x, y) => y.at.localeCompare(x.at) || y.value - x.value)[0]

export const childrenOf = (d: DB, assetId: string) => d.assets.filter((a) => a.parentAssetId === assetId)

/** Requests and work orders of an asset, newest first, with the cost of each WO (parts issued + labor at standard rate). */
export function assetHistory(d: DB, assetId: string) {
  const rate = (techId: string) => d.technicians.find((t) => t.id === techId)?.standardRate ?? 0
  const wos = d.workOrders.filter((w) => w.assetId === assetId).map((w) => {
    const parts = w.parts.reduce((s, p) => s + p.issuedQty * (p.unitCost ?? 0), 0)
    const labor = w.timeEntries.reduce((s, t) => s + t.hours * rate(t.technicianId), 0)
    return { id: w.id, kind: 'wo' as const, number: w.number, date: w.actualEnd ?? w.actualStart ?? w.plannedStart ?? w.statusHistory[0]?.at ?? '', status: w.status, parts, labor, total: parts + labor, reworkOfId: w.reworkOfId }
  })
  const reqs = d.requests.filter((r) => r.assetId === assetId && !r.workOrderId).map((r) => ({ id: r.id, kind: 'request' as const, number: r.number, date: r.receivedAt, status: r.status, complaint: r.complaint }))
  return { wos: wos.sort((a, b) => b.date.localeCompare(a.date)), reqs, total: wos.reduce((s, w) => s + w.total, 0) }
}

/** Next asset code AST-000331 … (registry-style, not year-based). */
function nextAssetCode(d: DB) {
  const max = d.assets.reduce((m, a) => Math.max(m, Number(a.code.replace(/\D/g, '')) || 0), 0)
  return `AST-${String(max + 1).padStart(6, '0')}`
}

/** `isNew`: the page generates the id up front so it can open the new card after saving. */
export function saveAsset(d: DB, asset: Asset, vehicle: VehicleDetails | null, isNew: boolean): string | null {
  const cat = d.categories.find((c) => c.id === asset.categoryId)
  if (!asset.name.trim() || !cat || !asset.ownerPartnerId || !asset.brand.trim() || !asset.model.trim()) return 'أكمل الحقول الإلزامية: الاسم والفئة والمالك والماركة والموديل'
  // BR-M-01: serial unique per organization; an asset may have no serial
  const serial = asset.serial?.trim()
  if (serial && d.assets.some((x) => x.id !== asset.id && x.serial?.trim().toUpperCase() === serial.toUpperCase())) return `الرقم التسلسلي ${serial} مسجل لأصل آخر`
  if (asset.parentAssetId === asset.id) return 'لا يمكن أن يكون الأصل أبًا لنفسه'
  if (asset.warrantyStart && asset.warrantyEnd && asset.warrantyEnd < asset.warrantyStart) return 'نهاية الضمان قبل بدايته'
  if (asset.ownerKind === 'company' && asset.ownerPartnerId !== d.settings.internalPartnerId) return 'أصل الشركة يُسجَّل باسم الشريك الداخلي'
  if (cat.isVehicle) {
    if (!vehicle || !vehicle.plate.trim() || !vehicle.vin.trim()) return 'السيارة تحتاج رقم اللوحة ورقم الشاصي (VIN)'
    if (d.vehicles.some((v) => v.assetId !== asset.id && v.vin.trim().toUpperCase() === vehicle.vin.trim().toUpperCase())) return `رقم الشاصي ${vehicle.vin} مسجل لسيارة أخرى`
  }
  for (const def of cat.attributes) if (asset.attributes[def.key] === undefined) asset.attributes[def.key] = ''

  if (isNew) {
    asset.code = nextAssetCode(d)
    d.assets.push(asset)
  } else {
    const i = d.assets.findIndex((x) => x.id === asset.id)
    if (i < 0) return 'الأصل غير موجود'
    d.assets[i] = asset
  }
  d.vehicles = d.vehicles.filter((v) => v.assetId !== asset.id)
  if (cat.isVehicle && vehicle) d.vehicles.push({ ...vehicle, assetId: asset.id })
  addAudit(d, 'asset', asset.id, isNew ? 'إنشاء بطاقة أصل' : 'تعديل بطاقة أصل', `${asset.code} — ${asset.name}`)
  return null
}

/** A meter only moves forward: a reading below the last one is refused (odometer/hour-meter). */
export function addReading(d: DB, assetId: string, value: number, at: string): string | null {
  const asset = d.assets.find((a) => a.id === assetId)
  const unit = d.categories.find((c) => c.id === asset?.categoryId)?.meterUnit
  if (!asset || !unit) return 'هذا الأصل بلا عداد'
  if (!(value > 0)) return 'أدخل قراءة صحيحة'
  if (at > today()) return 'لا تُسجَّل قراءة بتاريخ مستقبلي'
  const last = lastReading(d, assetId)
  if (last && value < last.value) return `القراءة أقل من آخر قراءة (${last.value.toLocaleString('en-US')})`
  d.readings.push({ id: uid('rd'), assetId, value, unit, at, source: 'manual' })
  addAudit(d, 'asset', assetId, 'تسجيل قراءة عداد', `${value.toLocaleString('en-US')} ${unit === 'km' ? 'كم' : 'ساعة'}`)
  return null
}

export function setAssetState(d: DB, assetId: string, state: Asset['state'], reason: string): string | null {
  const a = d.assets.find((x) => x.id === assetId)
  if (!a) return 'الأصل غير موجود'
  if (state === 'retired' && d.workOrders.some((w) => w.assetId === assetId && !['closed', 'cancelled'].includes(w.status))) return 'لا يمكن تقاعد أصل عليه أمر عمل مفتوح'
  if (!reason.trim()) return 'اذكر السبب'
  a.state = state
  addAudit(d, 'asset', assetId, 'تغيير حالة الأصل', `${state} — ${reason}`)
  return null
}
