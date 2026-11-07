import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { WeekBoard, type BoardItem, type BoardRow } from '../../components/board'
import { PageHeader } from '../../components/Layout'
import { ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card } from '../../components/ui'
import { addDays, today, weekDays, weekStart } from '../../data/asof'
import { fmtDate, maintKindLabel, num, timeRange, woStatus } from '../../data/format'
import { onLeave, toSchedule } from '../../data/schedule'
import { useStore } from '../../data/store'
import type { Booking } from '../../data/types'
import { kindOf } from '../../data/workorder'
import { useApi } from '../../lib/useApi'
import { Link, useSearchParams } from '../../router'
import { BookingDialog, NewBookingDialog, type NewBookingInit } from './dialogs'

/** Weekly schedule board (S14): technicians and bays × Saturday–Friday, leave shading, booking dialogs, "to schedule" list. */
export default function ScheduleBoard() {
  const { db, can } = useStore()
  const [params, setParams] = useSearchParams()
  const week = weekStart(params.get('week') ?? today())
  const days = weekDays(week)
  const [newInit, setNewInit] = useState<NewBookingInit | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const api = useApi(() => db.bookings, [])
  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />

  const manage = can('Schedule.Manage')
  const bays = db.workshops.flatMap((w) => w.bays.map((b) => ({ ...b, ws: w.name })))
  const rows: BoardRow[] = [
    ...db.technicians.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name, hint: `${t.title === 'seniorTechnician' ? 'فني أول' : 'فني'} · ${t.area}`, group: 'الفنيون' })),
    ...bays.map((b) => ({ id: b.id, label: `${b.code} — ${b.name}`, hint: b.ws, group: 'مواقع الورشة' })),
  ]
  const inWeek = db.bookings.filter((b) => b.status !== 'cancelled' && days.includes(b.date))
  const tone = (b: Booking): BoardItem['tone'] => (b.status === 'completed' ? 'green' : b.status === 'inProgress' ? 'amber' : b.status === 'rescheduled' ? 'gray' : b.kind === 'field' ? 'blue' : 'gray')
  const label = (b: Booking) => {
    const ws = b.stops.map((s) => db.workOrders.find((w) => w.id === s.workOrderId))
    const first = db.assets.find((a) => a.id === ws[0]?.assetId)
    return { title: `${timeRange(b.start, b.end)}${b.kind === 'field' ? ` · ميداني (${b.stops.length})` : ''}`, subtitle: `${ws[0]?.number.slice(-4) ?? ''} ${first?.name.split(' — ')[0] ?? ''}${ws.length > 1 ? ` +${ws.length - 1}` : ''}` }
  }
  const items: BoardItem[] = inWeek.flatMap((b) => [
    ...b.technicianIds.map((t) => ({ id: b.id, rowId: t, date: b.date, tone: tone(b), ...label(b) })),
    ...(b.bayId ? [{ id: b.id, rowId: b.bayId, date: b.date, tone: tone(b), ...label(b) }] : []),
  ])
  const pending = toSchedule(db)
  const techIds = new Set(db.technicians.map((t) => t.id))
  const hours = (b: Booking) => { const [h1, m1] = b.start.split(':').map(Number); const [h2, m2] = b.end.split(':').map(Number); return (h2 * 60 + m2 - h1 * 60 - m1) / 60 }
  const bookedHours = inWeek.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + hours(b) * b.technicianIds.length, 0)
  const capacity = db.technicians.filter((t) => t.active).reduce((s, t) => s + days.slice(0, 6).filter((d) => !onLeave(db, t.id, d)).length * 8, 0)
  const booking = db.bookings.find((b) => b.id === open)
  const nav = (n: number) => setParams({ week: addDays(week, n) })

  return (
    <div>
      <PageHeader crumbs={[{ label: 'لوحة الجدولة' }]} title="لوحة الجدولة الأسبوعية"
        summary={{ label: 'إشغال الفنيين هذا الأسبوع', value: `${num(capacity ? (bookedHours / capacity) * 100 : 0, 0)}%` }}
        actions={<>
          <button type="button" className="btn" onClick={() => nav(-7)} title="الأسبوع السابق"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" className="btn" onClick={() => setParams({})}>هذا الأسبوع</button>
          <button type="button" className="btn" onClick={() => nav(7)} title="الأسبوع التالي"><ChevronLeft className="h-4 w-4" /></button>
          {manage && <button type="button" className="btn btn-primary" onClick={() => setNewInit({ date: today() })}><Plus className="h-4 w-4" />حجز</button>}
        </>} />
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="font-semibold">{fmtDate(days[0])} ← {fmtDate(days[6])}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-sky-300 bg-sky-50" />ميداني مجدول</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-gray-300 bg-gray-50" />ورشة مجدول / أُعيدت جدولته</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-50" />قيد التنفيذ</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" />مكتمل</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-gray-300 bg-[repeating-linear-gradient(135deg,#e5e7eb,#e5e7eb_3px,#fff_3px,#fff_6px)]" />إجازة</span>
        <span className="text-gray-400">· ساعات محجوزة {num(bookedHours, 1)} من سعة {num(capacity)} (السبت–الخميس، 8 س يوميًا)</span>
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_300px]">
        <Card pad={false}>
          <WeekBoard rows={rows} days={days} items={items} isToday={(d) => d === today()}
            blocked={(rowId, d) => { if (!techIds.has(rowId)) return d < today() ? 'سابق' : null; const l = onLeave(db, rowId, d); return l ? `إجازة${l.source === 'hr' ? ' (HR)' : ''}` : d < today() ? 'سابق' : null }}
            onEmpty={manage ? (rowId, d) => setNewInit(techIds.has(rowId) ? { date: d, technicianId: rowId } : { date: d, bayId: rowId }) : undefined}
            onItem={setOpen} />
        </Card>
        <Card title={`بانتظار الجدولة (${pending.length})`}>
          {pending.length === 0 ? <p className="text-sm text-gray-500">كل الأوامر المخططة محجوزة.</p> : (
            <ul className="space-y-2">
              {pending.map((w) => {
                const k = kindOf(db, w)
                return (
                  <li key={w.id} className="rounded-md border border-line p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/work-orders/${w.id}`} className="font-mono text-[12px] text-navy hover:underline" dir="ltr">{w.number}</Link>
                      <span className="flex gap-1"><Badge tone={woStatus[w.status].tone}>{woStatus[w.status].label}</Badge>{k && <Badge tone={k === 'field' ? 'blue' : 'gray'}>{maintKindLabel[k]}</Badge>}</span>
                    </div>
                    <div className="mt-1 text-gray-700">{db.assets.find((a) => a.id === w.assetId)?.name}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{db.technicians.find((t) => t.id === w.leadTechnicianId)?.name ?? 'بلا فني'}{w.plannedStart ? ` · ${fmtDate(w.plannedStart)}` : ''}</span>
                      {manage && <button type="button" className="text-navy underline" onClick={() => setNewInit({ date: w.plannedStart && w.plannedStart.slice(0, 10) >= today() ? w.plannedStart.slice(0, 10) : today(), workOrderId: w.id })}>حجز</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-400">السحب والإفلات ومهارات الفنيين: قريباً.</p>
        </Card>
      </div>
      {newInit && <NewBookingDialog init={newInit} onClose={() => setNewInit(null)} />}
      {booking && <BookingDialog key={booking.id + booking.status} booking={booking} onClose={() => setOpen(null)} />}
    </div>
  )
}

