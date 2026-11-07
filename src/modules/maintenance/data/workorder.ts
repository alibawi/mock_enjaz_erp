// Work order engine — spec §3 Work order / Consumption, BR-M-10…15, 19…21, 25; plan §20, §21. Called inside run().
// Created → Planned → Scheduled → InProgress ⇄ WaitingParts / WaitingCustomer / OnHold → QualityCheck → Completed → Closed.
import { today } from './asof'
import { isInternal } from './estimate'
import { nowStamp, uid } from './format'
import { consumptionShortages, postConsumption, releaseParts, reservationShortages, reserveParts } from './stock'
import { addAudit, nextNumber } from './store'
import type { DB, RemovedPart, TimeEntry, WorkOrder, WorkOrderStatus } from './types'

export const OPEN: WorkOrderStatus[] = ['created', 'planned', 'scheduled', 'inProgress', 'waitingParts', 'waitingCustomer', 'onHold', 'qualityCheck']
export const ACTIVE_WORK: WorkOrderStatus[] = ['inProgress', 'waitingParts', 'waitingCustomer', 'onHold', 'qualityCheck']
export const isOpenWo = (w: WorkOrder) => OPEN.includes(w.status)
export const isOverdue = (w: WorkOrder) => isOpenWo(w) && !!w.plannedEnd && w.plannedEnd.slice(0, 10) < today()

function get(d: DB, id: string) { return d.workOrders.find((w) => w.id === id) }
function move(d: DB, w: WorkOrder, to: WorkOrderStatus, reason?: string) {
  w.statusHistory.push({ from: w.status, to, at: nowStamp(), by: d.userId, reason })
  w.status = to
}
/** Billable when any paid part or service line exists (BR-M-16); warranty / goodwill / internal work is not billed. */
export function billingFor(w: Pick<WorkOrder, 'parts' | 'services'>) {
  return w.parts.some((p) => p.coverage === 'paid') || w.services.some((s) => s.coverage === 'paid') ? 'notInvoiced' as const : 'notBillable' as const
}
export const kindOf = (d: DB, w: WorkOrder) => d.maintenanceTypes.find((m) => m.id === w.maintenanceTypeId)?.kind

export interface CreateOptions { billingPartnerId: string; leadTechnicianId?: string; plannedStart?: string; plannedEnd?: string; depositRequired?: number }

/** Converts an approved (and customer-accepted, or internal) estimate into a work order; the request closes (§20). */
export function createFromEstimate(d: DB, estimateId: string, id: string, o: CreateOptions): string | null {
  const e = d.estimates.find((x) => x.id === estimateId)
  if (!e) return 'التقدير غير موجود'
  if (e.status !== 'approved') return 'التقدير غير معتمد'
  if (!isInternal(d, e) && e.customerAcceptance?.decision !== 'accepted') return 'لم يوافق العميل على التقدير بعد'
  if (d.workOrders.some((w) => w.estimateId === e.id)) return 'للتقدير أمر عمل مسبق'
  const req = d.requests.find((r) => r.id === e.requestId)
  const asset = d.assets.find((a) => a.id === e.assetId)!
  if (o.billingPartnerId !== asset.ownerPartnerId && d.partners.find((p) => p.id === o.billingPartnerId)?.kind !== 'customer') return 'الجهة المُفوتَرة يجب أن تكون عميلًا'
  const type = d.maintenanceTypes.find((m) => m.id === req?.maintenanceTypeId)
  const rework = !!req?.reworkOfWorkOrderId
  const item = (iid: string) => d.items.find((i) => i.id === iid)
  const w: WorkOrder = {
    id, number: nextNumber(d, 'MWO'), requestId: req?.id, estimateId: e.id, assetId: e.assetId, partnerId: asset.ownerPartnerId, billingPartnerId: o.billingPartnerId,
    maintenanceTypeId: req?.maintenanceTypeId ?? 'mt-car', expenseTypeId: rework ? 'et-gw' : type?.defaultExpenseTypeId, status: 'created',
    bookingIds: [], reworkOfId: req?.reworkOfWorkOrderId, consumptionSeq: 0, consumptionStatus: 'pending', billingStatus: 'notInvoiced', billingBatch: 0,
    depositRequired: o.depositRequired, createdAt: nowStamp(), goodsIssueIds: [],
    parts: e.lines.filter((l) => l.kind === 'part').map((l) => ({
      id: uid('wp'), itemId: l.itemId, plannedQty: l.qty, reservedQty: 0, consumedQty: 0, issuedQty: 0, price: Math.round(l.price * (1 - l.discountPct / 100)),
      coverage: rework ? 'goodwill' : l.coverage, expenseTypeId: l.coverage === 'warranty' ? 'et-war' : l.coverage === 'goodwill' || rework ? 'et-gw' : undefined,
    })),
    services: e.lines.filter((l) => l.kind !== 'part').map((l) => ({ id: uid('ws'), itemId: l.itemId, qty: l.qty, price: Math.round(l.price * (1 - l.discountPct / 100)), coverage: rework ? 'goodwill' : l.coverage })),
    operations: e.lines.filter((l) => l.kind === 'labor').map((l) => {
      const op = d.operations.find((x) => x.serviceItemId === l.itemId)
      return { id: uid('wo'), operationId: op?.id ?? '', description: op?.name ?? item(l.itemId)?.name ?? 'عملية', plannedHours: l.qty, done: false }
    }),
    timeEntries: [], removedParts: [], statusHistory: [],
  }
  w.billingStatus = billingFor(w)
  w.consumptionStatus = w.parts.length ? 'pending' : 'notRequired'
  w.statusHistory.push({ from: null, to: 'created', at: nowStamp(), by: d.userId })
  d.workOrders.push(w)
  if (req) { req.workOrderId = id; req.status = 'closed' }
  addAudit(d, 'workOrder', id, 'إنشاء أمر عمل من التقدير', `${w.number} ← ${e.number} v${e.version}`)
  return o.leadTechnicianId ? plan(d, id, o.leadTechnicianId, o.plannedStart, o.plannedEnd) : null
}

export interface DirectInput { assetId: string; maintenanceTypeId: string; expenseTypeId: string; description: string; leadTechnicianId?: string; plannedStart?: string; plannedEnd?: string }

/** Direct internal work order (company asset, no customer estimate). Cost is approved through its expense type and limits. */
export function createDirect(d: DB, x: DirectInput, id: string): string | null {
  const asset = d.assets.find((a) => a.id === x.assetId)
  if (!asset) return 'اختر الأصل'
  if (asset.ownerKind !== 'company') return 'أمر العمل المباشر لأصول الشركة فقط — أصول العملاء تمر بالطلب والتقدير'
  if (asset.state === 'retired') return 'الأصل متقاعد'
  if (d.maintenanceTypes.find((m) => m.id === x.maintenanceTypeId)?.kind !== 'internal') return 'اختر نوع صيانة داخلية'
  if (!x.expenseTypeId) return 'نوع المصروف إلزامي للصيانة الداخلية (القرار 1c)'
  if (!x.description.trim()) return 'اكتب وصف العمل'
  if (d.workOrders.some((w) => w.assetId === asset.id && isOpenWo(w))) return 'للأصل أمر عمل مفتوح'
  const w: WorkOrder = {
    id, number: nextNumber(d, 'MWO'), assetId: asset.id, partnerId: asset.ownerPartnerId, billingPartnerId: asset.ownerPartnerId, maintenanceTypeId: x.maintenanceTypeId,
    expenseTypeId: x.expenseTypeId, status: 'created', bookingIds: [], consumptionSeq: 0, consumptionStatus: 'notRequired', billingStatus: 'notBillable', billingBatch: 0,
    createdAt: nowStamp(), goodsIssueIds: [], parts: [], services: [], timeEntries: [], removedParts: [], repairReason: undefined,
    operations: [{ id: uid('wo'), operationId: '', description: x.description.trim(), plannedHours: 1, done: false }],
    statusHistory: [{ from: null, to: 'created', at: nowStamp(), by: d.userId }],
  }
  d.workOrders.push(w)
  addAudit(d, 'workOrder', id, 'إنشاء أمر عمل داخلي مباشر', w.number)
  return x.leadTechnicianId ? plan(d, id, x.leadTechnicianId, x.plannedStart, x.plannedEnd) : null
}

/** Assigns the lead technician and planned window; Created → Planned (or updates the plan). */
export function plan(d: DB, id: string, techId: string, start?: string, end?: string): string | null {
  const w = get(d, id)
  if (!w || !['created', 'planned', 'scheduled'].includes(w.status)) return 'يُخطط أمر العمل قبل البدء فقط'
  if (!d.technicians.some((t) => t.id === techId && t.active)) return 'اختر فنيًا فعالًا'
  if (start && end && end < start) return 'نهاية الخطة قبل بدايتها'
  w.leadTechnicianId = techId
  w.plannedStart = start
  w.plannedEnd = end
  if (w.status === 'created') move(d, w, 'planned')
  addAudit(d, 'workOrder', id, 'تخطيط أمر العمل', `${d.technicians.find((t) => t.id === techId)?.name} ${start ?? ''} ← ${end ?? ''}`)
  return null
}

/** BR-M-10 approval satisfied + technician; BR-M-11 reserve all planned parts or refuse with the shortages. */
export function start(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w || !['planned', 'scheduled'].includes(w.status)) return 'يبدأ أمر العمل من حالة مخطط أو مجدول'
  if (!w.leadTechnicianId) return 'عيّن الفني المسؤول أولًا'
  const e = d.estimates.find((x) => x.id === w.estimateId)
  if (e && (e.status !== 'approved' || (!isInternal(d, e) && e.customerAcceptance?.decision !== 'accepted'))) return 'التقدير غير معتمد أو لم يوافق عليه العميل'
  const short = reservationShortages(d, w)
  if (short.length) return `لا يمكن البدء — قطع غير متوفرة: ${short.map((s) => `${s.name} (مطلوب ${s.need}، متاح ${s.available})`).join('، ')}`
  reserveParts(d, w)
  w.actualStart = nowStamp()
  move(d, w, 'inProgress')
  addAudit(d, 'workOrder', id, 'بدء العمل وحجز القطع', w.parts.length ? `${w.parts.length} قطعة محجوزة` : 'بلا قطع')
  return null
}

export function pause(d: DB, id: string, to: 'waitingParts' | 'waitingCustomer' | 'onHold', reason: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'inProgress') return 'يُعلَّق أمر العمل وهو قيد التنفيذ فقط'
  if (!reason.trim()) return 'اذكر السبب'
  w.holdReason = reason.trim()
  move(d, w, to, reason.trim())
  addAudit(d, 'workOrder', id, 'تعليق أمر العمل', reason.trim())
  return null
}

/** Back to work; waiting-parts resumes only when the missing parts can now be reserved. */
export function resume(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w || !['waitingParts', 'waitingCustomer', 'onHold'].includes(w.status)) return 'أمر العمل غير معلّق'
  const short = reservationShortages(d, w)
  if (w.status === 'waitingParts' && short.length) return `القطع ما زالت غير متوفرة: ${short.map((s) => s.name).join('، ')}`
  reserveParts(d, w)
  w.holdReason = undefined
  move(d, w, 'inProgress')
  addAudit(d, 'workOrder', id, 'استئناف العمل')
  return null
}

export function toQualityCheck(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'inProgress') return 'يُحال للفحص من قيد التنفيذ'
  if (w.operations.some((o) => !o.done)) return 'أنجز كل العمليات قبل فحص الجودة'
  move(d, w, 'qualityCheck')
  addAudit(d, 'workOrder', id, 'إحالة لفحص الجودة')
  return null
}

export function qualityResult(d: DB, id: string, passed: boolean, note: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'qualityCheck') return 'أمر العمل ليس في فحص الجودة'
  if (!passed && !note.trim()) return 'اذكر سبب عدم النجاح'
  w.qcResult = passed ? 'passed' : 'failed'
  if (!passed) move(d, w, 'inProgress', note.trim())
  addAudit(d, 'workOrder', id, passed ? 'نجح فحص الجودة' : 'لم ينجح فحص الجودة — إعادة', note.trim())
  return null
}

export interface CompleteInput { failureCodeId?: string; repairReason?: string; meterAtHandover?: number }

/** BR-M-12/13: failure code for corrective types, operations done, stock check (1f), automatic issue (1g). */
export function complete(d: DB, id: string, x: CompleteInput): string | null {
  const w = get(d, id)
  if (!w || !['inProgress', 'qualityCheck'].includes(w.status)) return 'يكتمل أمر العمل من قيد التنفيذ أو فحص الجودة'
  const type = d.maintenanceTypes.find((m) => m.id === w.maintenanceTypeId)
  if (type?.corrective && (!x.failureCodeId || !x.repairReason?.trim())) return 'كود العطل وسبب الإصلاح إلزاميان لهذا النوع (§28.8)'
  if (w.operations.some((o) => !o.done)) return 'كل العمليات يجب أن تكون منجزة'
  if (w.removedParts.some((r) => !r.disposition)) return 'حدّد مصير كل قطعة مُزالة'
  const asset = d.assets.find((a) => a.id === w.assetId)
  const unit = d.categories.find((c) => c.id === asset?.categoryId)?.meterUnit
  if (x.meterAtHandover && unit) {
    const last = d.readings.filter((r) => r.assetId === w.assetId).sort((a, b) => b.value - a.value)[0]
    if (last && x.meterAtHandover < last.value) return `قراءة التسليم أقل من آخر قراءة (${last.value.toLocaleString('en-US')})`
  }
  const short = consumptionShortages(d, w)
  if (short.length && d.settings.overIssueMode === 'block') return `لا يمكن الإكمال — الكمية المستهلكة أكبر من المتاح: ${short.map((s) => `${s.name} (${s.need} > ${s.available})`).join('، ')}`
  w.failureCodeId = x.failureCodeId
  w.repairReason = x.repairReason?.trim()
  w.meterAtHandover = x.meterAtHandover || undefined
  if (x.meterAtHandover && unit) d.readings.push({ id: uid('rd'), assetId: w.assetId, value: x.meterAtHandover, unit, at: today(), source: 'handover', docRef: w.number })
  w.actualEnd = nowStamp()
  move(d, w, 'completed')
  addAudit(d, 'workOrder', id, 'إكمال أمر العمل', d.failureCodes.find((f) => f.id === x.failureCodeId)?.code ?? '')
  // a booking still running for this WO ends with it once every stop on it is finished (BR-M-23 counterpart)
  for (const b of d.bookings.filter((x) => x.status === 'inProgress' && x.stops.some((s) => s.workOrderId === w.id))) {
    const stops = b.stops.map((s) => d.workOrders.find((y) => y.id === s.workOrderId))
    if (stops.every((y) => y && ['completed', 'closed', 'cancelled'].includes(y.status))) {
      b.status = 'completed'
      b.actualEnd = w.actualEnd
      w.operations.forEach((o) => { o.doneByBookingId ??= b.id })
      addAudit(d, 'booking', b.id, 'إكمال الحجز تلقائيًا مع أمر العمل', w.number)
    }
  }
  if (!w.parts.some((p) => p.consumedQty > 0)) { releaseParts(d, w); w.consumptionStatus = 'notRequired'; return null }
  if (d.settings.consumptionMode === 'manual') { w.consumptionStatus = 'pending'; return null }
  postConsumption(d, w) // failure keeps the WO completed with consumptionStatus = failed (§21.4)
  return null
}

export function retryConsumption(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'completed' || !['failed', 'pending'].includes(w.consumptionStatus)) return 'لا يوجد صرف معلّق لهذا الأمر'
  return postConsumption(d, w)
}

/** BR-M-19: consumption posted / not required and billing invoiced / not billable. */
export function close(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'completed') return 'يُغلق أمر العمل بعد اكتماله'
  if (!['posted', 'notRequired'].includes(w.consumptionStatus)) return 'صرف القطع لم يُرحَّل بعد'
  if (!['invoiced', 'notBillable'].includes(w.billingStatus)) return 'أمر العمل لم يُفوتر بعد'
  move(d, w, 'closed')
  addAudit(d, 'workOrder', id, 'إغلاق أمر العمل')
  return null
}

export function cancel(d: DB, id: string, reason: string): string | null {
  const w = get(d, id)
  if (!w || !OPEN.includes(w.status)) return 'لا يمكن إلغاء أمر العمل في هذه الحالة'
  if (!reason.trim()) return 'سبب الإلغاء إلزامي'
  if (w.parts.some((p) => p.issuedQty > 0)) return 'صُرفت قطع لهذا الأمر — ألغِ سند الصرف أو أرجع القطع أولًا'
  releaseParts(d, w)
  for (const b of d.bookings.filter((b) => b.stops.some((s) => s.workOrderId === w.id) && ['scheduled', 'rescheduled'].includes(b.status))) {
    b.stops = b.stops.filter((s) => s.workOrderId !== w.id)
    if (b.stops.length === 0) { b.status = 'cancelled'; b.cancelReason = `إلغاء ${w.number}` }
  }
  w.cancelReason = reason.trim()
  w.consumptionStatus = 'notRequired'
  w.billingStatus = 'notBillable'
  move(d, w, 'cancelled', reason.trim())
  addAudit(d, 'workOrder', id, 'إلغاء أمر العمل', reason.trim())
  return null
}

export function reopen(d: DB, id: string, reason: string): string | null {
  const w = get(d, id)
  if (!w || w.status !== 'closed') return 'يُعاد فتح أمر عمل مغلق فقط'
  if (!reason.trim()) return 'سبب إعادة الفتح إلزامي'
  move(d, w, 'inProgress', reason.trim())
  w.actualEnd = undefined
  addAudit(d, 'workOrder', id, 'إعادة فتح أمر العمل', reason.trim())
  return null
}

// ---------- lines ----------
const editableParts = (w: WorkOrder) => [...OPEN].includes(w.status)

export function addPart(d: DB, id: string, itemId: string, qty: number): string | null {
  const w = get(d, id)
  if (!w || !editableParts(w)) return 'تُضاف القطع قبل الإكمال'
  if (!itemId || !(qty > 0)) return 'اختر القطعة والكمية'
  const item = d.items.find((i) => i.id === itemId)
  const rework = !!w.reworkOfId
  const internal = d.partners.find((p) => p.id === w.billingPartnerId)?.kind === 'internal'
  w.parts.push({ id: uid('wp'), itemId, plannedQty: qty, reservedQty: 0, consumedQty: 0, issuedQty: 0, price: item?.price ?? 0, coverage: rework ? 'goodwill' : 'paid', expenseTypeId: rework ? 'et-gw' : undefined })
  if (!internal) w.billingStatus = billingFor(w)
  if (w.consumptionStatus === 'notRequired') w.consumptionStatus = 'pending'
  if (ACTIVE_WORK.includes(w.status)) reserveParts(d, w) // free stock only; shortages stay unreserved
  addAudit(d, 'workOrder', id, 'إضافة قطعة', `${item?.name} × ${qty}`)
  return null
}

export function setConsumed(d: DB, id: string, partId: string, qty: number): string | null {
  const w = get(d, id)
  const p = w?.parts.find((x) => x.id === partId)
  if (!w || !p || !ACTIVE_WORK.includes(w.status)) return 'تُسجَّل الكمية المستهلكة أثناء التنفيذ'
  if (qty < 0) return 'كمية غير صحيحة'
  p.consumedQty = qty
  return null
}

export function setPartExpenseType(d: DB, id: string, partId: string, expenseTypeId: string): string | null {
  const w = get(d, id)
  const p = w?.parts.find((x) => x.id === partId)
  if (!w || !p || p.issuedQty > 0) return 'لا يتغير نوع المصروف بعد الصرف'
  p.expenseTypeId = expenseTypeId || undefined
  addAudit(d, 'workOrder', id, 'تغيير نوع مصروف سطر', `${d.items.find((i) => i.id === p.itemId)?.name} → ${d.expenseTypes.find((e) => e.id === expenseTypeId)?.name ?? 'حسب أمر العمل'}`)
  return null
}

export function removePart(d: DB, id: string, partId: string): string | null {
  const w = get(d, id)
  const p = w?.parts.find((x) => x.id === partId)
  if (!w || !p) return 'السطر غير موجود'
  if (p.issuedQty > 0 || p.consumedQty > 0) return 'لا يُحذف سطر استُهلك أو صُرف'
  const r = d.stock.find((s) => s.itemId === p.itemId)
  if (r && p.reservedQty) r.reserved = Math.max(0, r.reserved - p.reservedQty)
  w.parts = w.parts.filter((x) => x.id !== partId)
  addAudit(d, 'workOrder', id, 'حذف قطعة مخططة', d.items.find((i) => i.id === p.itemId)?.name ?? '')
  return null
}

export function toggleOperation(d: DB, id: string, opId: string): string | null {
  const w = get(d, id)
  const o = w?.operations.find((x) => x.id === opId)
  if (!w || !o || !ACTIVE_WORK.includes(w.status)) return 'تُنجز العمليات أثناء التنفيذ'
  o.done = !o.done
  return null
}

export function addOperation(d: DB, id: string, operationId: string): string | null {
  const w = get(d, id)
  const op = d.operations.find((x) => x.id === operationId)
  if (!w || !op || !OPEN.includes(w.status)) return 'تُضاف العمليات قبل الإكمال'
  w.operations.push({ id: uid('wo'), operationId: op.id, description: op.name, plannedHours: op.standardHours, done: false })
  addAudit(d, 'workOrder', id, 'إضافة عملية', op.name)
  return null
}

/** BR-M-25: time is editable until the WO is closed. */
export function addTime(d: DB, id: string, t: Omit<TimeEntry, 'id'>): string | null {
  const w = get(d, id)
  if (!w || ['closed', 'cancelled', 'created'].includes(w.status)) return 'تُسجَّل الساعات بعد بدء العمل وحتى الإغلاق'
  if (!t.technicianId || !(t.hours > 0) || t.hours > 16) return 'أدخل الفني وساعات بين 0 و 16'
  if (t.date > today()) return 'لا تُسجَّل ساعات بتاريخ مستقبلي'
  w.timeEntries.push({ ...t, id: uid('te') })
  addAudit(d, 'workOrder', id, 'تسجيل ساعات', `${d.technicians.find((x) => x.id === t.technicianId)?.name} ${t.hours} س`)
  return null
}

export function removeTime(d: DB, id: string, entryId: string): string | null {
  const w = get(d, id)
  const t = w?.timeEntries.find((x) => x.id === entryId)
  if (!w || !t || w.status === 'closed') return 'لا يُحذف السطر'
  if (t.confirmedBy) return 'السطر مؤكَّد من المشرف'
  w.timeEntries = w.timeEntries.filter((x) => x.id !== entryId)
  return null
}

export function confirmTime(d: DB, id: string): string | null {
  const w = get(d, id)
  if (!w) return 'أمر العمل غير موجود'
  const n = w.timeEntries.filter((t) => !t.confirmedBy).length
  if (!n) return 'لا توجد ساعات بانتظار التأكيد'
  w.timeEntries.forEach((t) => { t.confirmedBy ??= d.userId })
  addAudit(d, 'workOrder', id, 'تأكيد ساعات الفنيين', `${n} سطر`)
  return null
}

export function addRemovedPart(d: DB, id: string, r: Omit<RemovedPart, 'id'>): string | null {
  const w = get(d, id)
  if (!w || !OPEN.includes(w.status)) return 'تُسجَّل القطع المُزالة أثناء العمل'
  if (!r.description.trim()) return 'صف القطعة المُزالة'
  w.removedParts.push({ ...r, id: uid('rp') })
  addAudit(d, 'workOrder', id, 'تسجيل قطعة مُزالة', `${r.description} — ${r.disposition}`)
  return null
}

export function setBillingPartner(d: DB, id: string, partnerId: string): string | null {
  const w = get(d, id)
  if (!w || !['created', 'planned', 'scheduled', 'inProgress'].includes(w.status)) return 'تتغير الجهة المُفوتَرة قبل الإكمال'
  if (d.partners.find((p) => p.id === partnerId)?.kind !== 'customer') return 'اختر عميلًا'
  w.billingPartnerId = partnerId
  addAudit(d, 'workOrder', id, 'تغيير الجهة المُفوتَرة', d.partners.find((p) => p.id === partnerId)?.name ?? '')
  return null
}

/** Cost of a WO: issued parts at issue cost + labor at the technician's standard rate (report-only, §33 item 7). */
export function woCost(d: DB, w: WorkOrder) {
  const parts = w.parts.reduce((s, p) => s + p.issuedQty * (p.unitCost ?? 0), 0)
  const labor = w.timeEntries.reduce((s, t) => s + t.hours * (d.technicians.find((x) => x.id === t.technicianId)?.standardRate ?? 0), 0)
  return { parts, labor, total: parts + labor }
}
