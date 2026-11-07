import { Ban, CalendarClock, CheckCircle2, Play } from 'lucide-react'
import { useState } from 'react'
import { Badge, Field, FormGrid, Modal, Select } from '../../components/ui'
import { today } from '../../data/asof'
import { bookingStatus, fmtDate, fmtDateTime, maintKindLabel, timeRange, uid, woStatus } from '../../data/format'
import { activeBookingOf, BOOKABLE, bayName, cancelBooking, completeBooking, conflicts, createBooking, fitsKind, reschedule, startBooking } from '../../data/schedule'
import { useStore } from '../../data/store'
import type { Booking, BookingKind, DB } from '../../data/types'
import { kindOf } from '../../data/workorder'
import { Link } from '../../router'

export const companyVehicles = (db: DB) => db.vehicles.filter((v) => db.assets.find((a) => a.id === v.assetId)?.ownerKind === 'company')

/** Checkbox chips — technicians, work orders, operations. */
export function Checks({ options, values, onChange }: { options: { value: string; label: string; hint?: string; disabled?: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-line p-2">
      {options.length === 0 && <span className="text-xs text-gray-400">لا توجد خيارات</span>}
      {options.map((o) => (
        <label key={o.value} className={`flex items-center gap-2 text-sm ${o.disabled ? 'text-gray-400' : ''}`} title={o.disabled}>
          <input type="checkbox" disabled={!!o.disabled} checked={values.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))} />
          <span>{o.label}</span>{o.hint && <span className="text-[11px] text-gray-400">{o.hint}</span>}{o.disabled && <span className="text-[11px] text-red-500">{o.disabled}</span>}
        </label>
      ))}
    </div>
  )
}

export interface NewBookingInit { date: string; technicianId?: string; bayId?: string; workOrderId?: string }

/** Booking dialog: workshop (one WO + bay + times) or field (several WOs + slot + technicians + vehicle). Conflicts preview live. */
export function NewBookingDialog({ init, onClose }: { init: NewBookingInit; onClose: () => void }) {
  const { db, run } = useStore()
  const wo0 = db.workOrders.find((w) => w.id === init.workOrderId)
  const kind0: BookingKind = init.bayId ? 'workshop' : wo0 && kindOf(db, wo0) === 'field' ? 'field' : 'workshop'
  const [kind, setKind] = useState<BookingKind>(kind0)
  const [date, setDate] = useState(init.date < today() ? today() : init.date)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [slotId, setSlotId] = useState(db.timeSlots[0]?.id ?? '')
  const [bayId, setBayId] = useState(init.bayId ?? '')
  const [techs, setTechs] = useState<string[]>(init.technicianId ? [init.technicianId] : wo0?.leadTechnicianId ? [wo0.leadTechnicianId] : [])
  const [wos, setWos] = useState<string[]>(wo0 ? [wo0.id] : [])
  const [vehicle, setVehicle] = useState(companyVehicles(db)[1]?.plate ?? '')
  const bays = db.workshops.flatMap((w) => w.bays)
  const candidates = db.workOrders.filter((w) => BOOKABLE.includes(w.status) && fitsKind(db, w, kind) && !activeBookingOf(db, w.id))
  const asset = (id: string) => db.assets.find((a) => a.id === id)
  const slot = db.timeSlots.find((s) => s.id === slotId)
  const input = { kind, date, start: kind === 'field' ? slot?.start ?? '' : start, end: kind === 'field' ? slot?.end ?? '' : end, slotId: kind === 'field' ? slotId : undefined, technicianIds: techs, bayId: kind === 'workshop' ? bayId : undefined, vehicle: kind === 'field' ? vehicle : undefined, workOrderIds: wos }
  const preview = techs.length && wos.length ? conflicts(db, input) : null
  const save = () => run((d) => createBooking(d, input, uid('bk')), 'تم الحجز — أمر العمل أصبح مجدولًا') && onClose()
  const setK = (k: BookingKind) => { setKind(k); setWos(wos.filter((id) => { const w = db.workOrders.find((x) => x.id === id); return w && fitsKind(db, w, k) })) }

  return (
    <Modal title="حجز موعد" wide onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>حجز</button></>}>
      <div className="mb-3 flex gap-2">
        {(['workshop', 'field'] as BookingKind[]).map((k) => <button key={k} type="button" className={`btn ${kind === k ? 'btn-primary' : ''}`} onClick={() => setK(k)}>{k === 'workshop' ? 'ورشة (رافعة)' : 'ميداني (زيارات)'}</button>)}
      </div>
      <FormGrid>
        <Field label="التاريخ" required><input type="date" className="inp" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {kind === 'workshop' ? <>
          <Field label="من"><input type="time" className="inp" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="إلى"><input type="time" className="inp" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="الرافعة / الموقع" required><Select value={bayId} onChange={setBayId} placeholder="اختر" options={bays.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))} /></Field>
        </> : <>
          <Field label="الفترة" required><Select value={slotId} onChange={setSlotId} options={db.timeSlots.map((s) => ({ value: s.id, label: `${s.name} (سعة ${s.capacity})` }))} /></Field>
          <Field label="سيارة الفريق"><Select value={vehicle} onChange={setVehicle} options={companyVehicles(db).map((v) => ({ value: v.plate, label: `${v.plate} — ${v.make} ${v.model}` }))} /></Field>
        </>}
        <Field label={kind === 'workshop' ? 'أمر العمل (واحد)' : 'أوامر العمل (زيارات المسار بالترتيب)'} required span={3}>
          <Checks values={wos} onChange={(v) => setWos(kind === 'workshop' ? v.slice(-1) : v)} options={candidates.map((w) => ({
            value: w.id, label: `${w.number} — ${asset(w.assetId)?.name}`,
            hint: `${woStatus[w.status].label} · ${maintKindLabel[kindOf(db, w) ?? 'workshop']}${kind === 'field' ? ` · ${db.partners.find((p) => p.id === w.partnerId)?.area ?? ''}` : ''}`,
          }))} />
        </Field>
        <Field label="الفنيون" required span={3}>
          <Checks values={techs} onChange={setTechs} options={db.technicians.filter((t) => t.active).map((t) => {
            const l = db.leaves.find((x) => x.technicianId === t.id && x.from <= date && date <= x.to)
            return { value: t.id, label: t.name, hint: t.area, disabled: l ? `إجازة: ${l.note}` : undefined }
          })} />
        </Field>
      </FormGrid>
      {preview ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{preview}</div>
        : techs.length && wos.length ? <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">لا تعارض — {fmtDate(date)} {timeRange(input.start, input.end)}</div> : null}
    </Modal>
  )
}

type Mode = 'view' | 'move' | 'cancel' | 'complete'

/** Booking detail: move (reason), cancel (reason), start, complete with the finished operations. */
export function BookingDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { db, run, can } = useStore()
  const [mode, setMode] = useState<Mode>('view')
  const [m, setM] = useState({ date: booking.date < today() ? today() : booking.date, start: booking.start, end: booking.end, slotId: booking.slotId ?? db.timeSlots[0]?.id, technicianIds: booking.technicianIds, bayId: booking.bayId ?? '', vehicle: booking.vehicle ?? '' })
  const [reason, setReason] = useState('')
  const wos = booking.stops.map((s) => db.workOrders.find((w) => w.id === s.workOrderId)!).filter(Boolean)
  const [ops, setOps] = useState<string[]>(wos.flatMap((w) => w.operations.filter((o) => o.done).map((o) => o.id)))
  const manage = can('Schedule.Manage')
  const exec = can('WorkOrders.Execute')
  const pending = ['scheduled', 'rescheduled'].includes(booking.status)
  const tech = (id: string) => db.technicians.find((t) => t.id === id)?.name
  const go = (fn: Parameters<typeof run>[0], ok: string) => run(fn, ok) && onClose()

  const footer = mode === 'view' ? <>
    {pending && manage && <button type="button" className="btn" onClick={() => setMode('move')}><CalendarClock className="h-4 w-4" />إعادة جدولة</button>}
    {pending && manage && <button type="button" className="btn text-red-600" onClick={() => setMode('cancel')}><Ban className="h-4 w-4" />إلغاء</button>}
    {pending && exec && <button type="button" className="btn btn-primary" onClick={() => go((d) => startBooking(d, booking.id), 'بدأ الحجز — أوامر العمل قيد التنفيذ')}><Play className="h-4 w-4" />بدء</button>}
    {booking.status === 'inProgress' && exec && <button type="button" className="btn btn-primary" onClick={() => setMode('complete')}><CheckCircle2 className="h-4 w-4" />إكمال الحجز</button>}
    <button type="button" className="btn" onClick={onClose}>إغلاق</button>
  </> : <>
    <button type="button" className="btn" onClick={() => setMode('view')}>رجوع</button>
    {mode === 'move' && <button type="button" className="btn btn-primary" onClick={() => go((d) => reschedule(d, booking.id, { ...m, bayId: m.bayId || undefined, vehicle: m.vehicle || undefined }, reason), 'أُعيدت جدولة الحجز')}>حفظ الموعد الجديد</button>}
    {mode === 'cancel' && <button type="button" className="btn border-red-600 bg-red-600 text-white" onClick={() => go((d) => cancelBooking(d, booking.id, reason), 'أُلغي الحجز')}>إلغاء الحجز</button>}
    {mode === 'complete' && <button type="button" className="btn btn-primary" onClick={() => go((d) => completeBooking(d, booking.id, ops), 'اكتمل الحجز — أمر العمل ما زال قيد التنفيذ')}>إكمال</button>}
  </>

  return (
    <Modal title={`حجز ${booking.number}`} wide onClose={onClose} footer={footer}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={bookingStatus[booking.status].tone}>{bookingStatus[booking.status].label}</Badge>
        <Badge tone="gray">{booking.kind === 'workshop' ? 'ورشة' : 'ميداني'}</Badge>
        <span>{fmtDate(booking.date)} {timeRange(booking.start, booking.end)}</span>
        <span className="text-gray-500">· {booking.technicianIds.map(tech).join('، ')}</span>
        {booking.bayId && <span className="text-gray-500">· {bayName(db, booking.bayId)}</span>}
        {booking.vehicle && <span className="text-gray-500">· {booking.vehicle}</span>}
      </div>
      {booking.rescheduleReason && <p className="mb-2 rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-800">سبب إعادة الجدولة: {booking.rescheduleReason}</p>}
      {booking.cancelReason && <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">سبب الإلغاء: {booking.cancelReason}</p>}
      {booking.actualStart && <p className="mb-2 text-xs text-gray-500">فعلي: {fmtDateTime(booking.actualStart)} ← {fmtDateTime(booking.actualEnd)}</p>}

      {mode !== 'move' && mode !== 'cancel' && (
        <ol className="space-y-2">
          {[...booking.stops].sort((a, b) => a.order - b.order).map((s) => {
            const w = wos.find((x) => x.id === s.workOrderId)
            if (!w) return null
            const asset = db.assets.find((a) => a.id === w.assetId)
            return (
              <li key={s.workOrderId} className="rounded-md border border-line p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {booking.kind === 'field' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[11px] text-white">{s.order}</span>}
                  <Link to={`/work-orders/${w.id}`} className="font-mono text-navy hover:underline" dir="ltr">{w.number}</Link>
                  <Badge tone={woStatus[w.status].tone}>{woStatus[w.status].label}</Badge>
                  <span>{asset?.name}</span>
                </div>
                {mode === 'complete' ? (
                  <div className="mt-2"><Checks values={ops} onChange={setOps} options={w.operations.map((o) => ({ value: o.id, label: o.description, hint: `${o.plannedHours} س` }))} /></div>
                ) : (
                  <ul className="mt-1 list-disc ps-5 text-xs text-gray-600">{w.operations.map((o) => <li key={o.id}>{o.description}{o.done ? ' ✓' : ''}</li>)}</ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {mode === 'complete' && <p className="mt-2 text-xs text-gray-500">العمليات المختارة تُعلَّم منجزة بهذا الحجز؛ أمر العمل يبقى قيد التنفيذ حتى الإكمال من بطاقته.</p>}

      {mode === 'move' && (
        <FormGrid>
          <Field label="التاريخ"><input type="date" className="inp" min={today()} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
          {booking.kind === 'workshop' ? <>
            <Field label="من"><input type="time" className="inp" value={m.start} onChange={(e) => setM({ ...m, start: e.target.value })} /></Field>
            <Field label="إلى"><input type="time" className="inp" value={m.end} onChange={(e) => setM({ ...m, end: e.target.value })} /></Field>
            <Field label="الرافعة / الموقع"><Select value={m.bayId} onChange={(v) => setM({ ...m, bayId: v })} options={db.workshops.flatMap((w) => w.bays).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))} /></Field>
          </> : <>
            <Field label="الفترة"><Select value={m.slotId ?? ''} onChange={(v) => setM({ ...m, slotId: v })} options={db.timeSlots.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field label="سيارة الفريق"><Select value={m.vehicle} onChange={(v) => setM({ ...m, vehicle: v })} options={companyVehicles(db).map((v) => ({ value: v.plate, label: v.plate }))} /></Field>
          </>}
          <Field label="الفنيون" span={3}><Checks values={m.technicianIds} onChange={(v) => setM({ ...m, technicianIds: v })} options={db.technicians.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="سبب إعادة الجدولة" required span={3}><textarea className="inp min-h-[60px] py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </FormGrid>
      )}
      {mode === 'cancel' && <Field label="سبب الإلغاء" required><textarea className="inp min-h-[70px] py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
    </Modal>
  )
}
