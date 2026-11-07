import { useState } from 'react'
import { FilterSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { Badge, Tabs } from '../../components/ui'
import { today } from '../../data/asof'
import { bookingStatus, fmtDate, num, timeRange } from '../../data/format'
import { bayName } from '../../data/schedule'
import { useStore } from '../../data/store'
import type { Booking } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { useSearchParams } from '../../router'
import { BookingDialog } from './dialogs'

type TabId = 'upcoming' | 'today' | 'inProgress' | 'rescheduled' | 'completed' | 'cancelled' | 'all'

/** Bookings list (S15) with reschedule / cancel reasons; a row opens the booking dialog. */
export default function BookingsList() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'upcoming'
  const [kind, setKind] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const api = useApi(() => db.bookings, [])
  const t0 = today()
  const match = (b: Booking, t: TabId) => {
    switch (t) {
      case 'upcoming': return ['scheduled', 'rescheduled'].includes(b.status) && b.date >= t0
      case 'today': return b.date === t0 && b.status !== 'cancelled'
      case 'all': return true
      default: return b.status === t
    }
  }
  const all = (api.data ?? []).filter((b) => !kind || b.kind === kind)
  const rows = all.filter((b) => match(b, tab)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const count = (t: TabId) => all.filter((b) => match(b, t)).length
  const tech = (id: string) => db.technicians.find((t) => t.id === id)?.name ?? ''
  const wo = (id: string) => db.workOrders.find((w) => w.id === id)
  const booking = db.bookings.find((b) => b.id === open)

  return (
    <>
      <ListView<Booking>
        title="الحجوزات"
        crumbs={[{ label: 'الجدولة', to: '/schedule' }, { label: 'الحجوزات' }]}
        rows={rows}
        loading={api.loading}
        error={api.error}
        onRetry={api.reload}
        onRowClick={(b) => setOpen(b.id)}
        canNew={false}
        searchText={(b) => `${b.number} ${b.technicianIds.map(tech).join(' ')} ${b.stops.map((s) => wo(s.workOrderId)?.number ?? '').join(' ')} ${b.vehicle ?? ''}`}
        kpis={[
          { label: 'حجوزات اليوم', value: num(count('today')) },
          { label: 'قادمة', value: num(count('upcoming')) },
          { label: 'أُعيدت جدولتها', value: num(db.bookings.filter((b) => b.rescheduleReason).length) },
          { label: 'ملغاة', value: num(count('cancelled')) },
        ]}
        filters={<FilterSelect label="النوع" value={kind} onChange={setKind} options={[{ value: 'workshop', label: 'ورشة' }, { value: 'field', label: 'ميداني' }]} />}
        tabs={<Tabs<TabId> active={tab} onChange={(t) => setParams({ tab: t })} tabs={[
          { id: 'upcoming', label: 'القادمة', count: count('upcoming') },
          { id: 'today', label: 'اليوم', count: count('today') },
          { id: 'inProgress', label: bookingStatus.inProgress.label, count: count('inProgress') },
          { id: 'rescheduled', label: bookingStatus.rescheduled.label, count: count('rescheduled') },
          { id: 'completed', label: bookingStatus.completed.label, count: count('completed') },
          { id: 'cancelled', label: bookingStatus.cancelled.label, count: count('cancelled') },
          { id: 'all', label: 'الكل', count: count('all') },
        ]} />}
        columns={[
          { key: 'no', label: 'رقم الحجز', render: (b) => <span className="font-mono text-[12px]" dir="ltr">{b.number}</span>, sort: (b) => b.number },
          { key: 'k', label: 'النوع', render: (b) => <Badge tone={b.kind === 'field' ? 'blue' : 'gray'}>{b.kind === 'field' ? 'ميداني' : 'ورشة'}</Badge> },
          { key: 'd', label: 'الموعد', render: (b) => `${fmtDate(b.date)} ${timeRange(b.start, b.end)}`, sort: (b) => b.date + b.start },
          { key: 't', label: 'الفنيون', render: (b) => b.technicianIds.map(tech).join('، ') },
          { key: 'r', label: 'الموقع / السيارة', render: (b) => (b.bayId ? bayName(db, b.bayId) : b.vehicle ?? '—') },
          { key: 'w', label: 'أوامر العمل', render: (b) => <span className="font-mono text-[12px]" dir="ltr">{b.stops.map((s) => wo(s.workOrderId)?.number.slice(-6)).join(' · ')}</span> },
          { key: 's', label: 'الحالة', render: (b) => <Badge tone={bookingStatus[b.status].tone}>{bookingStatus[b.status].label}</Badge> },
          { key: 'why', label: 'السبب', className: 'max-w-xs text-[12px] text-gray-600', render: (b) => b.cancelReason ?? b.rescheduleReason ?? '' },
        ]}
        emptyTitle="لا توجد حجوزات في هذا التبويب"
      />
      {booking && <BookingDialog key={booking.id + booking.status} booking={booking} onClose={() => setOpen(null)} />}
    </>
  )
}
