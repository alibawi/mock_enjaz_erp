// Scheduling engine — spec §2 Booking / Leave, BR-M-22…24; plan §38. Called inside run().
// Booking: Scheduled ⇄ Rescheduled → InProgress → Completed; → Cancelled. A booking drives the WO state (BR-M-23).
import { today } from './asof'
import { nowStamp, timeRange } from './format'
import { addAudit, nextNumber } from './store'
import type { Booking, BookingKind, DB, WorkOrder } from './types'
import { kindOf, start as startWo } from './workorder'

export const ACTIVE_BOOKING: Booking['status'][] = ['scheduled', 'rescheduled', 'inProgress']
export const isActive = (b: Booking) => ACTIVE_BOOKING.includes(b.status)
const overlap = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end

export const onLeave = (d: DB, techId: string, date: string) => d.leaves.find((l) => l.technicianId === techId && l.from <= date && date <= l.to)
export const bookingsOf = (d: DB, woId: string) => d.bookings.filter((b) => b.stops.some((s) => s.workOrderId === woId))
export const activeBookingOf = (d: DB, woId: string) => bookingsOf(d, woId).find(isActive)

/** WOs that can still be booked: open, not finished, and no active booking yet (or continuing work). */
export const BOOKABLE: WorkOrder['status'][] = ['created', 'planned', 'scheduled', 'inProgress', 'waitingParts', 'waitingCustomer', 'onHold']
export const toSchedule = (d: DB) => d.workOrders.filter((w) => ['created', 'planned'].includes(w.status) && !activeBookingOf(d, w.id))
/** Workshop bookings take workshop + internal jobs; field bookings take field + internal jobs (BR-M-24). */
export const fitsKind = (d: DB, w: WorkOrder, kind: BookingKind) => { const k = kindOf(d, w); return k === 'internal' || k === kind }

export interface BookingInput {
  kind: BookingKind; date: string; start: string; end: string; slotId?: string
  technicianIds: string[]; bayId?: string; vehicle?: string; workOrderIds: string[]
}

/** BR-M-22: technicians and bays not double-booked, nobody on leave, field slot capacity. Returns the first problem. */
export function conflicts(d: DB, x: BookingInput, ignoreId?: string): string | null {
  if (!x.date) return 'اختر التاريخ'
  if (!x.start || !x.end || x.end <= x.start) return 'وقت النهاية يجب أن يكون بعد البداية'
  if (x.start < '07:00' || x.end > '20:00') return 'خارج ساعات العمل (07:00–20:00)'
  if (!x.technicianIds.length) return 'اختر فنيًا واحدًا على الأقل'
  for (const t of x.technicianIds) {
    const l = onLeave(d, t, x.date)
    if (l) return `${d.technicians.find((y) => y.id === t)?.name} في إجازة (${l.from} ← ${l.to}${l.note ? ` — ${l.note}` : ''})`
  }
  const same = d.bookings.filter((b) => b.id !== ignoreId && isActive(b) && b.date === x.date && overlap(b, x))
  for (const b of same) {
    const t = b.technicianIds.find((id) => x.technicianIds.includes(id))
    if (t) return `تعارض: ${d.technicians.find((y) => y.id === t)?.name} محجوز في ${b.number} (${timeRange(b.start, b.end)})`
    if (x.bayId && b.bayId === x.bayId) return `تعارض: ${bayName(d, x.bayId)} محجوزة في ${b.number} (${timeRange(b.start, b.end)})`
    if (x.vehicle && b.vehicle === x.vehicle) return `تعارض: السيارة ${x.vehicle} مستخدمة في ${b.number}`
  }
  if (x.kind === 'field' && x.slotId) {
    const slot = d.timeSlots.find((s) => s.id === x.slotId)
    const used = d.bookings.filter((b) => b.id !== ignoreId && isActive(b) && b.kind === 'field' && b.date === x.date && b.slotId === x.slotId).reduce((s, b) => s + b.stops.length, 0)
    if (slot && used + x.workOrderIds.length > slot.capacity) return `سعة الفترة ${slot.name} ممتلئة (${used} من ${slot.capacity} زيارة)`
  }
  return null
}

export const bayName = (d: DB, id?: string) => d.workshops.flatMap((w) => w.bays).find((b) => b.id === id)?.name ?? '—'

/** Validates the WO side of a booking (BR-M-24) and returns the work orders. */
function checkWos(d: DB, x: BookingInput, ignoreId?: string): string | WorkOrder[] {
  if (!x.workOrderIds.length) return 'اختر أمر عمل'
  if (x.kind === 'workshop') {
    if (x.workOrderIds.length !== 1) return 'حجز الورشة لأمر عمل واحد'
    if (!x.bayId) return 'اختر الرافعة / الموقع'
  } else if (!x.slotId) return 'اختر الفترة الزمنية'
  const wos: WorkOrder[] = []
  for (const id of x.workOrderIds) {
    const w = d.workOrders.find((y) => y.id === id)
    if (!w || !BOOKABLE.includes(w.status)) return `أمر العمل ${w?.number ?? ''} لا يقبل الحجز في حالته`
    if (!fitsKind(d, w, x.kind)) return `${w.number}: نوع الصيانة ${x.kind === 'field' ? 'ورشة' : 'ميداني'} — لا يناسب هذا الحجز`
    const other = bookingsOf(d, id).find((b) => b.id !== ignoreId && isActive(b))
    if (other) return `${w.number} محجوز مسبقًا في ${other.number} — أعد جدولة ذلك الحجز`
    wos.push(w)
  }
  return wos
}

export function createBooking(d: DB, x: BookingInput, id: string): string | null {
  if (x.kind === 'field' && x.slotId) { const s = d.timeSlots.find((t) => t.id === x.slotId); if (s) { x = { ...x, start: s.start, end: s.end } } }
  if (x.date < today()) return 'لا يُحجز بتاريخ سابق'
  const wos = checkWos(d, x)
  if (typeof wos === 'string') return wos
  const c = conflicts(d, x)
  if (c) return c
  const b: Booking = {
    id, number: nextNumber(d, 'SCH'), kind: x.kind, date: x.date, start: x.start, end: x.end, slotId: x.kind === 'field' ? x.slotId : undefined,
    technicianIds: x.technicianIds, bayId: x.kind === 'workshop' ? x.bayId : undefined, vehicle: x.kind === 'field' ? x.vehicle : undefined,
    stops: x.workOrderIds.map((workOrderId, i) => ({ workOrderId, order: i + 1 })), status: 'scheduled',
  }
  d.bookings.push(b)
  for (const w of wos) {
    w.bookingIds.push(b.id)
    if (!w.leadTechnicianId) w.leadTechnicianId = x.technicianIds[0]
    w.plannedStart = `${x.date}T${b.start}`
    w.plannedEnd = `${x.date}T${b.end}`
    if (['created', 'planned'].includes(w.status)) {
      w.statusHistory.push({ from: w.status, to: 'scheduled', at: nowStamp(), by: d.userId, reason: b.number })
      w.status = 'scheduled'
    }
    addAudit(d, 'workOrder', w.id, 'حجز موعد', `${b.number} — ${b.date} ${timeRange(b.start, b.end)}`)
  }
  addAudit(d, 'booking', id, 'إنشاء حجز', `${b.number} — ${wos.map((w) => w.number).join('، ')}`)
  return null
}

export interface MoveInput { date: string; start: string; end: string; slotId?: string; technicianIds: string[]; bayId?: string; vehicle?: string }

export function reschedule(d: DB, id: string, m: MoveInput, reason: string): string | null {
  const b = d.bookings.find((x) => x.id === id)
  if (!b || !['scheduled', 'rescheduled'].includes(b.status)) return 'يُعاد جدولة الحجز قبل البدء فقط'
  if (!reason.trim()) return 'سبب إعادة الجدولة إلزامي'
  if (m.date < today()) return 'لا يُنقل إلى تاريخ سابق'
  if (b.kind === 'field' && m.slotId) { const s = d.timeSlots.find((t) => t.id === m.slotId); if (s) m = { ...m, start: s.start, end: s.end } }
  const c = conflicts(d, { kind: b.kind, ...m, bayId: b.kind === 'workshop' ? m.bayId : undefined, workOrderIds: b.stops.map((s) => s.workOrderId) }, b.id)
  if (c) return c
  if (b.kind === 'workshop' && !m.bayId) return 'اختر الرافعة / الموقع'
  const from = `${b.date} ${b.start}`
  Object.assign(b, { date: m.date, start: m.start, end: m.end, slotId: b.kind === 'field' ? m.slotId : undefined, technicianIds: m.technicianIds, bayId: b.kind === 'workshop' ? m.bayId : undefined, vehicle: b.kind === 'field' ? m.vehicle : undefined, status: 'rescheduled', rescheduleReason: reason.trim() })
  for (const s of b.stops) {
    const w = d.workOrders.find((y) => y.id === s.workOrderId)
    if (w) { w.plannedStart = `${m.date}T${m.start}`; w.plannedEnd = `${m.date}T${m.end}` }
  }
  addAudit(d, 'booking', id, 'إعادة جدولة', `${from} ← ${m.date} ${m.start} — ${reason.trim()}`)
  return null
}

/** BR-M-23: cancelled → the WO goes back to Planned when nothing else holds it. */
export function cancelBooking(d: DB, id: string, reason: string): string | null {
  const b = d.bookings.find((x) => x.id === id)
  if (!b || !['scheduled', 'rescheduled'].includes(b.status)) return 'يُلغى الحجز قبل البدء فقط'
  if (!reason.trim()) return 'سبب الإلغاء إلزامي'
  b.status = 'cancelled'
  b.cancelReason = reason.trim()
  for (const s of b.stops) {
    const w = d.workOrders.find((y) => y.id === s.workOrderId)
    if (w && w.status === 'scheduled' && !bookingsOf(d, w.id).some(isActive)) {
      w.statusHistory.push({ from: 'scheduled', to: 'planned', at: nowStamp(), by: d.userId, reason: `إلغاء ${b.number}` })
      w.status = 'planned'
    }
  }
  addAudit(d, 'booking', id, 'إلغاء حجز', reason.trim())
  return null
}

/** BR-M-23: started → each scheduled WO starts (approval, technician and reservation rules apply). */
export function startBooking(d: DB, id: string): string | null {
  const b = d.bookings.find((x) => x.id === id)
  if (!b || !['scheduled', 'rescheduled'].includes(b.status)) return 'الحجز ليس بانتظار البدء'
  if (b.date > today()) return `موعد الحجز ${b.date} — لا يبدأ قبل يومه`
  for (const s of b.stops) {
    const w = d.workOrders.find((y) => y.id === s.workOrderId)
    if (w && ['planned', 'scheduled'].includes(w.status)) {
      const e = startWo(d, w.id)
      if (e) return `${w.number}: ${e}`
    }
  }
  b.status = 'inProgress'
  b.actualStart = nowStamp()
  addAudit(d, 'booking', id, 'بدء الحجز')
  return null
}

/** BR-M-23: completed → the chosen operations are marked done by this booking; the WO stays in progress. */
export function completeBooking(d: DB, id: string, doneOps: string[]): string | null {
  const b = d.bookings.find((x) => x.id === id)
  if (!b || b.status !== 'inProgress') return 'يكتمل الحجز بعد بدئه'
  let n = 0
  for (const s of b.stops) {
    const w = d.workOrders.find((y) => y.id === s.workOrderId)
    for (const o of w?.operations ?? []) if (doneOps.includes(o.id) && !o.done) { o.done = true; o.doneByBookingId = b.id; n++ }
  }
  b.status = 'completed'
  b.actualEnd = nowStamp()
  addAudit(d, 'booking', id, 'إكمال الحجز', `${n} عملية منجزة`)
  return null
}

export function addLeave(d: DB, x: { technicianId: string; from: string; to: string; note: string }, id: string): string | null {
  if (!x.technicianId || !x.from || !x.to || x.to < x.from) return 'أدخل الفني وفترة صحيحة'
  const clash = d.bookings.find((b) => isActive(b) && b.technicianIds.includes(x.technicianId) && b.date >= x.from && b.date <= x.to)
  if (clash) return `للفني حجز ${clash.number} بتاريخ ${clash.date} — أعد جدولته أولًا`
  d.leaves.push({ id, ...x, source: 'manual' })
  addAudit(d, 'leave', id, 'إضافة إجازة يدوية', `${d.technicians.find((t) => t.id === x.technicianId)?.name} ${x.from} ← ${x.to}`)
  return null
}

export function removeLeave(d: DB, id: string): string | null {
  const l = d.leaves.find((x) => x.id === id)
  if (!l) return 'غير موجودة'
  if (l.source === 'hr') return 'الإجازة مستوردة من الموارد البشرية — تُعدَّل هناك'
  d.leaves = d.leaves.filter((x) => x.id !== id)
  addAudit(d, 'leave', id, 'حذف إجازة يدوية')
  return null
}
