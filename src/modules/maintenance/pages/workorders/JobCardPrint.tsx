import { ArrowRight, Printer } from 'lucide-react'
import { PrintSheet } from '../../components/board'
import { EmptyBlock } from '../../components/states'
import { fmtDateTime, num, woStatus } from '../../data/format'
import { useStore } from '../../data/store'
import { Link, useParams } from '../../router'

/** Workshop job card: what to do, which parts, room for the technician's notes and signatures. No prices on the floor copy. */
export default function JobCardPrint() {
  const { id } = useParams()
  const { db } = useStore()
  const w = db.workOrders.find((x) => x.id === id)
  if (!w) return <EmptyBlock title="أمر العمل غير موجود" action={<Link to="/work-orders" className="btn">العودة</Link>} />
  const asset = db.assets.find((a) => a.id === w.assetId)
  const v = db.vehicles.find((x) => x.assetId === w.assetId)
  const owner = db.partners.find((p) => p.id === w.partnerId)
  const req = db.requests.find((r) => r.id === w.requestId)
  const type = db.maintenanceTypes.find((m) => m.id === w.maintenanceTypeId)
  const tech = db.technicians.find((t) => t.id === w.leadTechnicianId)
  const item = (iid: string) => db.items.find((i) => i.id === iid)
  const cell = 'border border-gray-300 px-2 py-1'

  return (
    <div>
      <div className="no-print mb-3 flex items-center justify-between">
        <Link to={`/work-orders/${w.id}`} className="btn"><ArrowRight className="h-4 w-4" />العودة إلى أمر العمل</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button>
      </div>
      <PrintSheet title="بطاقة عمل الورشة" number={w.number} date={db.asOf}
        footer={
          <div className="grid grid-cols-3 gap-6 text-[12px]">
            <div><div className="text-gray-500">توقيع الفني</div><div className="mt-8 border-t border-gray-400" /></div>
            <div><div className="text-gray-500">فحص الجودة (المشرف)</div><div className="mt-8 border-t border-gray-400" /></div>
            <div><div className="text-gray-500">استلام العميل</div><div className="mt-8 border-t border-gray-400" /></div>
          </div>
        }>
        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
          <div><span className="text-gray-500">الأصل: </span><b>{asset?.name}</b></div>
          <div><span className="text-gray-500">{v ? 'اللوحة / الشاصي: ' : 'الرقم التسلسلي: '}</span><span dir="ltr">{v ? `${v.plate} · ${v.vin}` : asset?.serial ?? '—'}</span></div>
          <div><span className="text-gray-500">المالك: </span>{owner?.name} — <span dir="ltr">{owner?.phone}</span></div>
          <div><span className="text-gray-500">نوع الصيانة: </span>{type?.name}</div>
          <div><span className="text-gray-500">الفني المسؤول: </span>{tech?.name ?? '________'}</div>
          <div><span className="text-gray-500">الخطة: </span>{w.plannedStart ? `${fmtDateTime(w.plannedStart)} ← ${fmtDateTime(w.plannedEnd)}` : '—'}</div>
          <div><span className="text-gray-500">قراءة الاستلام: </span>{req?.meterAtIntake ? num(req.meterAtIntake) : '—'}</div>
          <div><span className="text-gray-500">الحالة عند الطباعة: </span>{woStatus[w.status].label}</div>
        </div>
        {w.reworkOfId && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-center text-[12px] font-semibold text-red-800">إعادة عمل — أولوية عالية، بلا فوترة</div>}
        {req && <div className="mb-3 rounded border border-gray-300 px-3 py-2 text-[12px]"><b>الشكوى: </b>{req.complaint}{req.accessories ? <span className="text-gray-500"> · الملحقات: {req.accessories}</span> : null}</div>}

        <div className="mb-1 text-[12px] font-bold text-navy">العمليات</div>
        <table className="mb-4 w-full border-collapse text-[12px]">
          <thead><tr className="bg-gray-100"><th className={`${cell} w-8`}>✓</th><th className={`${cell} text-start`}>العملية</th><th className={`${cell} w-24`}>ساعات مخططة</th><th className={`${cell} w-24`}>ساعات فعلية</th></tr></thead>
          <tbody>{w.operations.map((o) => <tr key={o.id}><td className={`${cell} text-center`}>{o.done ? '✓' : '☐'}</td><td className={cell}>{o.description}</td><td className={`${cell} text-center tabular-nums`}>{num(o.plannedHours, 1)}</td><td className={cell} /></tr>)}</tbody>
        </table>

        <div className="mb-1 text-[12px] font-bold text-navy">القطع المخططة</div>
        <table className="mb-4 w-full border-collapse text-[12px]">
          <thead><tr className="bg-gray-100"><th className={`${cell} text-start`}>القطعة</th><th className={cell}>الرمز</th><th className={`${cell} w-20`}>مخطط</th><th className={`${cell} w-20`}>محجوز</th><th className={`${cell} w-24`}>مستهلك فعلًا</th></tr></thead>
          <tbody>{w.parts.length ? w.parts.map((p) => <tr key={p.id}><td className={cell}>{item(p.itemId)?.name}</td><td className={`${cell} font-mono`} dir="ltr">{item(p.itemId)?.code}</td><td className={`${cell} text-center`}>{num(p.plannedQty)}</td><td className={`${cell} text-center`}>{num(p.reservedQty)}</td><td className={`${cell} text-center`}>{p.consumedQty ? num(p.consumedQty) : ''}</td></tr>) : <tr><td className={cell} colSpan={5}>لا توجد قطع مخططة</td></tr>}</tbody>
        </table>

        <div className="grid grid-cols-2 gap-4 text-[12px]">
          <div className="rounded border border-gray-300 p-2"><b>ملاحظات الفني / كود العطل:</b><div className="h-16" /></div>
          <div className="rounded border border-gray-300 p-2"><b>القطع المُزالة ومصيرها:</b>{w.removedParts.map((r) => <div key={r.id}>{r.description}</div>)}<div className="h-10" /></div>
        </div>
        <div className="mt-3 text-[12px]">قراءة التسليم: ____________ &nbsp;&nbsp; تاريخ ووقت الإنجاز: ____ / ____ / ________ &nbsp; ____ : ____</div>
      </PrintSheet>
    </div>
  )
}
