import { Printer } from 'lucide-react'
import { PrintSheet } from '../../components/board'
import { FilterSelect } from '../../components/inputs'
import { EmptyBlock } from '../../components/states'
import { today } from '../../data/asof'
import { bookingStatus, dayName, fmtDate, num, timeRange } from '../../data/format'
import { bayName, onLeave } from '../../data/schedule'
import { useStore } from '../../data/store'
import { useSearchParams } from '../../router'

/** Daily route sheet (S15): one technician's bookings for a date, field stops in order with address and phone; printable. */
export default function RouteSheet() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? (db.bookings.some((b) => b.date === today() && b.kind === 'field') ? today() : '2026-11-09')
  const busy = db.technicians.filter((t) => db.bookings.some((b) => b.date === date && b.status !== 'cancelled' && b.technicianIds.includes(t.id)))
  const techId = params.get('tech') && busy.some((t) => t.id === params.get('tech')) ? params.get('tech')! : busy[0]?.id ?? ''
  const tech = db.technicians.find((t) => t.id === techId)
  const list = db.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && b.technicianIds.includes(techId)).sort((a, b) => a.start.localeCompare(b.start))
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k === 'date') p.delete('tech'); setParams(p) }
  let stop = 0

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">التاريخ<input type="date" className="inp w-auto" value={date} onChange={(e) => set('date', e.target.value)} /></label>
          <FilterSelect label="الفني" value={techId} allLabel="—" onChange={(v) => set('tech', v)} options={busy.map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        <button type="button" className="btn btn-primary" disabled={!list.length} onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة خط السير</button>
      </div>
      {!list.length ? (
        <EmptyBlock title={`لا توجد حجوزات في ${dayName(date)} ${fmtDate(date)}`} hint={tech && onLeave(db, tech.id, date) ? 'الفني في إجازة.' : 'اختر تاريخًا آخر — مثال: الاثنين 9 تشرين الثاني فيه مسار ميداني بزيارتين.'} />
      ) : (
        <PrintSheet title="خط السير اليومي" number={tech?.employeeNo} date={date}
          footer={<div className="grid grid-cols-3 gap-6 text-[12px]"><div>عداد السيارة عند الخروج: ________</div><div>عند العودة: ________</div><div><div className="text-gray-500">توقيع الفني</div><div className="mt-8 border-t border-gray-400" /></div></div>}>
          <div className="mb-4 grid grid-cols-2 gap-x-8 text-[12px]">
            <div><span className="text-gray-500">الفني: </span><b>{tech?.name}</b> — <span dir="ltr">{tech?.phone}</span></div>
            <div><span className="text-gray-500">اليوم: </span>{dayName(date)} {fmtDate(date)}</div>
            <div><span className="text-gray-500">مع: </span>{[...new Set(list.flatMap((b) => b.technicianIds))].filter((t) => t !== techId).map((t) => db.technicians.find((x) => x.id === t)?.name).join('، ') || '—'}</div>
            <div><span className="text-gray-500">السيارة: </span>{list.find((b) => b.vehicle)?.vehicle ?? '—'}</div>
          </div>
          {list.map((b) => (
            <div key={b.id} className="mb-4">
              <div className="mb-1 flex items-center justify-between border-b border-gray-300 pb-1 text-[12px] font-bold text-navy">
                <span>{timeRange(b.start, b.end)} · {b.kind === 'field' ? 'ميداني' : `ورشة — ${bayName(db, b.bayId)}`}</span>
                <span className="font-mono font-normal" dir="ltr">{b.number} · {bookingStatus[b.status].label}</span>
              </div>
              {[...b.stops].sort((x, y) => x.order - y.order).map((s) => {
                const w = db.workOrders.find((x) => x.id === s.workOrderId)
                if (!w) return null
                const asset = db.assets.find((a) => a.id === w.assetId)
                const p = db.partners.find((x) => x.id === w.partnerId)
                const req = db.requests.find((r) => r.id === w.requestId)
                stop += 1
                return (
                  <div key={s.workOrderId} className="mb-2 grid grid-cols-[28px_1fr] gap-2 text-[12px]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-500 font-bold">{stop}</div>
                    <div>
                      <div><b>{p?.name}</b> — <span dir="ltr">{req?.contactPhone ?? p?.phone}</span>{req?.contactName && req.contactName !== p?.name ? ` (${req.contactName})` : ''}</div>
                      <div className="text-gray-600">{p?.address}{asset?.location && asset.location !== p?.address && asset.location !== 'عند العميل' ? ` · ${asset.location}` : ''}</div>
                      <div>{asset?.name} · <span className="font-mono" dir="ltr">{w.number}</span></div>
                      {req && <div className="text-gray-600">الشكوى: {req.complaint}</div>}
                      <div>العمل: {w.operations.map((o) => o.description).join('، ') || '—'}</div>
                      {w.parts.length > 0 && <div>القطع: {w.parts.map((x) => `${db.items.find((i) => i.id === x.itemId)?.name} × ${num(x.plannedQty)}`).join('، ')}</div>}
                      <div className="mt-1 text-gray-500">وصول ____:____ · مغادرة ____:____ · توقيع العميل ______________</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </PrintSheet>
      )}
    </div>
  )
}
