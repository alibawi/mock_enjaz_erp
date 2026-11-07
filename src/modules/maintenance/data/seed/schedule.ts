// Scheduling seed (area 6): bookings for last few days, this week (Sat 7 Nov → Fri 13 Nov) and next, covering every booking
// state, one multi-stop field route, one rescheduled and one cancelled booking; technician leave imported from HR.
import type { AuditEntry, Booking, Leave } from '../types'
import { vehicles } from './assets'
import { workOrders } from './workorders'

const van = vehicles.find((v) => v.assetId === 'as-10')!.plate
type B = Omit<Booking, 'number' | 'stops'> & { no: number; wos: string[] }
const b = ({ no, wos, ...x }: B): Booking => ({ number: `SCH-2026-${String(no).padStart(6, '0')}`, stops: wos.map((k, i) => ({ workOrderId: `wo-${k}`, order: i + 1 })), ...x })

export const bookings: Booking[] = [
  b({ no: 1, id: 'bk-01', kind: 'field', date: '2026-11-05', start: '08:00', end: '12:00', slotId: 'ts-am', technicianIds: ['t-ali'], vehicle: van, wos: ['c09'], status: 'completed', actualStart: '2026-11-05T08:40', actualEnd: '2026-11-05T11:15' }),
  b({ no: 2, id: 'bk-02', kind: 'workshop', date: '2026-11-06', start: '08:30', end: '15:00', technicianIds: ['t-hassan'], bayId: 'bay-1', wos: ['c11'], status: 'completed', actualStart: '2026-11-06T08:35', actualEnd: '2026-11-06T14:40' }),
  b({ no: 3, id: 'bk-03', kind: 'workshop', date: '2026-11-06', start: '09:00', end: '11:00', technicianIds: ['t-ahmed'], bayId: 'bay-2', wos: ['c08'], status: 'completed', actualStart: '2026-11-06T09:05', actualEnd: '2026-11-06T10:30' }),
  b({ no: 4, id: 'bk-04', kind: 'workshop', date: '2026-11-07', start: '09:00', end: '12:00', technicianIds: ['t-hassan'], bayId: 'bay-1', wos: ['c16'], status: 'inProgress', actualStart: '2026-11-07T09:10' }),
  b({ no: 5, id: 'bk-05', kind: 'workshop', date: '2026-11-07', start: '10:00', end: '13:00', technicianIds: ['t-omar'], bayId: 'bay-2', wos: ['c07'], status: 'inProgress', actualStart: '2026-11-07T10:05' }),
  b({ no: 6, id: 'bk-06', kind: 'field', date: '2026-11-08', start: '12:00', end: '16:00', slotId: 'ts-pm', technicianIds: ['t-karim'], vehicle: van, wos: ['c15'], status: 'cancelled', cancelReason: 'العميلة ألغت الإصلاح (اشترت مكيفًا جديدًا)' }),
  b({ no: 7, id: 'bk-07', kind: 'field', date: '2026-11-09', start: '08:00', end: '12:00', slotId: 'ts-am', technicianIds: ['t-karim', 't-ali'], vehicle: van, wos: ['c05', 'c09'], status: 'scheduled' }),
  b({ no: 8, id: 'bk-08', kind: 'workshop', date: '2026-11-10', start: '09:00', end: '16:00', technicianIds: ['t-ahmed'], bayId: 'bay-3', wos: ['c04'], status: 'rescheduled', rescheduleReason: 'شركة سما طلبت التأجيل يومًا — السيارة في رحلة' }),
  b({ no: 9, id: 'bk-09', kind: 'workshop', date: '2026-11-11', start: '09:00', end: '11:00', technicianIds: ['t-mohammed'], bayId: 'bay-2', wos: ['c06'], status: 'scheduled' }),
]

// link bookings to their work orders; operations finished in a completed booking point to it
for (const bk of bookings) {
  for (const s of bk.stops) {
    const w = workOrders.find((x) => x.id === s.workOrderId)!
    w.bookingIds.push(bk.id)
    if (bk.status === 'completed') w.operations.filter((o) => o.done).forEach((o) => { o.doneByBookingId = bk.id })
  }
}

export const leaves: Leave[] = [
  { id: 'lv-1', technicianId: 't-yaser', from: '2026-11-08', to: '2026-11-09', source: 'hr', note: 'إجازة اعتيادية' },
  { id: 'lv-2', technicianId: 't-abbas', from: '2026-11-11', to: '2026-11-13', source: 'hr', note: 'إجازة مرضية' },
  { id: 'lv-3', technicianId: 't-sajjad', from: '2026-11-15', to: '2026-11-19', source: 'hr', note: 'إجازة اعتيادية' },
  { id: 'lv-4', technicianId: 't-murtada', from: '2026-11-07', to: '2026-11-07', source: 'manual', note: 'مراجعة طبية — أبلغ المشرف هاتفيًا' },
  { id: 'lv-5', technicianId: 't-karim', from: '2026-10-26', to: '2026-10-28', source: 'hr', note: 'إجازة اعتيادية' },
]

const au = (id: string, at: string, userId: string, entityId: string, action: string, detail = ''): AuditEntry => ({ id, at, userId, entity: 'booking', entityId, action, detail })
export const audit: AuditEntry[] = [
  au('au-b1', '2026-11-06T16:30', 'u-dsp', 'bk-08', 'إنشاء حجز', 'SCH-2026-000008 — 2026-11-09'),
  au('au-b2', '2026-11-07T08:15', 'u-dsp', 'bk-08', 'إعادة جدولة', '2026-11-09 09:00 ← 2026-11-10 09:00 — شركة سما طلبت التأجيل يومًا — السيارة في رحلة'),
  au('au-b3', '2026-11-06T17:00', 'u-dsp', 'bk-06', 'إلغاء حجز', 'العميلة ألغت الإصلاح (اشترت مكيفًا جديدًا)'),
  au('au-b4', '2026-11-06T16:45', 'u-dsp', 'bk-07', 'إنشاء حجز', 'SCH-2026-000007 — مسار ميداني بزيارتين'),
]
export const counters = { 'SCH-2026': bookings.length }
