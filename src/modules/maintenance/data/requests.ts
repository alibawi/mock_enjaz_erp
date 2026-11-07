// Maintenance request rules (spec §3 Request, plan §20). Called inside run().
// Draft → Received → InDiagnosis → AwaitingApproval → Approved → Closed (WO created) | Rejected | Cancelled.
// AwaitingApproval / Approved / Closed are set by the estimate and work-order engines (areas 4–5).
import { diffDays, today } from './asof'
import { nowStamp, uid } from './format'
import { addAudit, nextNumber } from './store'
import type { DB, MaintRequest, RequestStatus, WorkOrder } from './types'

export const isOpenRequest = (r: MaintRequest) => !['closed', 'rejected', 'cancelled'].includes(r.status)

/**
 * BR-M-20: a completed or closed WO on the same asset that ended within the rework window
 * (default 30 days) makes a new fault a probable rework (goodwill, not billed).
 */
export function probableRework(d: DB, assetId: string, on = today()): WorkOrder | undefined {
  return d.workOrders
    .filter((w) => w.assetId === assetId && ['completed', 'closed'].includes(w.status) && w.actualEnd && !w.reworkOfId)
    .filter((w) => diffDays(on, w.actualEnd!) <= d.settings.reworkWindowDays && diffDays(on, w.actualEnd!) >= 0)
    .sort((a, b) => b.actualEnd!.localeCompare(a.actualEnd!))[0]
}

export interface IntakeInput {
  assetId: string; maintenanceTypeId: string; complaint: string; meterAtIntake?: number; accessories: string
  channel: MaintRequest['channel']; contactName?: string; contactPhone?: string; receiveNow: boolean; markRework: boolean
}

/** Creates a request (draft, or received straight away). The owner of the asset is the request partner. */
export function createRequest(d: DB, input: IntakeInput, id: string): string | null {
  const asset = d.assets.find((a) => a.id === input.assetId)
  if (!asset) return 'اختر الأصل'
  if (asset.state === 'retired') return 'الأصل متقاعد ولا يُستقبل للصيانة'
  if (!input.maintenanceTypeId) return 'اختر نوع الصيانة'
  if (!input.complaint.trim()) return 'اكتب شكوى العميل أو وصف العطل'
  const type = d.maintenanceTypes.find((m) => m.id === input.maintenanceTypeId)
  if (type?.kind === 'internal' && asset.ownerKind !== 'company') return 'نوع الصيانة الداخلية لأصول الشركة فقط'
  if (type && type.kind !== 'internal' && asset.ownerKind === 'company') return 'أصل الشركة يُستقبل بنوع صيانة داخلية'
  const open = d.requests.find((r) => r.assetId === asset.id && isOpenRequest(r))
  if (open) return `يوجد طلب مفتوح لهذا الأصل: ${open.number}`
  const rework = input.markRework ? probableRework(d, asset.id) : undefined

  const req: MaintRequest = {
    id, number: nextNumber(d, 'MRQ'), assetId: asset.id, partnerId: asset.ownerPartnerId, maintenanceTypeId: input.maintenanceTypeId,
    receivedAt: nowStamp(), receivedBy: d.userId, complaint: input.complaint.trim(), meterAtIntake: input.meterAtIntake || undefined,
    accessories: input.accessories.trim(), status: 'draft', channel: input.channel, contactName: input.contactName, contactPhone: input.contactPhone,
    reworkOfWorkOrderId: rework?.id,
  }
  d.requests.push(req)
  addAudit(d, 'request', id, 'إنشاء طلب صيانة', `${req.number} — ${asset.name}`)
  return input.receiveNow ? receive(d, id) : null
}

/** Draft → Received: the asset is physically received (or the field call is logged); the intake meter becomes a reading. */
export function receive(d: DB, id: string): string | null {
  const r = d.requests.find((x) => x.id === id)
  if (!r) return 'الطلب غير موجود'
  if (r.status !== 'draft') return 'الطلب مستلم مسبقًا'
  const unit = d.categories.find((c) => c.id === d.assets.find((a) => a.id === r.assetId)?.categoryId)?.meterUnit
  if (r.meterAtIntake && unit) {
    const last = d.readings.filter((x) => x.assetId === r.assetId).sort((a, b) => b.value - a.value)[0]
    if (last && r.meterAtIntake < last.value) return `قراءة العداد أقل من آخر قراءة (${last.value.toLocaleString('en-US')})`
    d.readings.push({ id: uid('rd'), assetId: r.assetId, value: r.meterAtIntake, unit, at: today(), source: 'intake', docRef: r.number })
  }
  r.status = 'received'
  r.receivedAt = nowStamp()
  r.receivedBy = d.userId
  addAudit(d, 'request', id, 'استلام الأصل', r.number)
  return null
}

const allowed: Partial<Record<RequestStatus, RequestStatus[]>> = {
  draft: ['received', 'cancelled'],
  received: ['inDiagnosis', 'cancelled'],
  inDiagnosis: ['received', 'cancelled'],
}

export function canMove(r: MaintRequest, to: RequestStatus) {
  return allowed[r.status]?.includes(to) ?? false
}

export function startDiagnosis(d: DB, id: string): string | null {
  const r = d.requests.find((x) => x.id === id)
  if (!r || !canMove(r, 'inDiagnosis')) return 'لا يمكن بدء التشخيص في هذه الحالة'
  r.status = 'inDiagnosis'
  addAudit(d, 'request', id, 'بدء التشخيص', r.number)
  return null
}

export function cancelRequest(d: DB, id: string, reason: string): string | null {
  const r = d.requests.find((x) => x.id === id)
  if (!r || !canMove(r, 'cancelled')) return 'لا يمكن إلغاء الطلب في هذه الحالة'
  if (!reason.trim()) return 'سبب الإلغاء إلزامي'
  r.status = 'cancelled'
  r.cancelReason = reason.trim()
  addAudit(d, 'request', id, 'إلغاء طلب الصيانة', reason.trim())
  return null
}
