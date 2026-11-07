import { ArrowRight, Printer } from 'lucide-react'
import { PrintSheet } from '../../components/board'
import { EmptyBlock } from '../../components/states'
import { fmtDateTime, num } from '../../data/format'
import { useStore } from '../../data/store'
import { Link, useParams } from '../../router'

const Line = ({ label, value, ltr }: { label: string; value?: string; ltr?: boolean }) => (
  <div className="flex gap-2 border-b border-dotted border-gray-300 py-1.5"><span className="w-36 shrink-0 text-gray-500">{label}</span><span className="font-medium" dir={ltr ? 'ltr' : undefined}>{value || '—'}</span></div>
)

/** Intake receipt handed to the customer (printable A4). */
export default function RequestReceipt() {
  const { id } = useParams()
  const { db } = useStore()
  const r = db.requests.find((x) => x.id === id)
  if (!r || r.status === 'draft') return <EmptyBlock title="لا يوجد إيصال" hint="يُطبع الإيصال بعد استلام الأصل." action={<Link to="/requests" className="btn">العودة</Link>} />
  const asset = db.assets.find((a) => a.id === r.assetId)
  const v = db.vehicles.find((x) => x.assetId === r.assetId)
  const partner = db.partners.find((p) => p.id === r.partnerId)
  const unit = db.categories.find((c) => c.id === asset?.categoryId)?.meterUnit
  const type = db.maintenanceTypes.find((m) => m.id === r.maintenanceTypeId)
  const user = db.users.find((u) => u.id === r.receivedBy)
  const field = type?.kind === 'field'

  return (
    <div>
      <div className="no-print mb-3 flex items-center justify-between">
        <Link to={`/requests/${r.id}`} className="btn"><ArrowRight className="h-4 w-4" />العودة إلى الطلب</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button>
      </div>
      <PrintSheet title={field ? 'إشعار تسجيل طلب صيانة ميدانية' : 'إيصال استلام للصيانة'} number={r.number} date={r.receivedAt}
        footer={
          <div className="grid grid-cols-2 gap-8 text-[12px]">
            <div><div className="text-gray-500">توقيع العميل</div><div className="mt-8 border-t border-gray-400" /></div>
            <div><div className="text-gray-500">المستلم: {user?.name}</div><div className="mt-8 border-t border-gray-400" /></div>
          </div>
        }>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <div className="mb-1 font-bold text-navy">العميل</div>
            <Line label="الاسم" value={partner?.name} />
            <Line label="جهة الاتصال" value={r.contactName} />
            <Line label="الهاتف" ltr value={r.contactPhone ?? partner?.phone} />
            <Line label="العنوان" value={partner?.address} />
          </div>
          <div>
            <div className="mb-1 font-bold text-navy">الأصل</div>
            <Line label="الأصل" value={asset?.name} />
            <Line label="الرمز" ltr value={asset?.code} />
            {v ? <Line label="اللوحة / الشاصي" value={`${v.plate} — ${v.vin}`} /> : <Line label="الرقم التسلسلي" value={asset?.serial} />}
            {unit && <Line label="العداد عند الاستلام" value={r.meterAtIntake ? `${num(r.meterAtIntake)} ${unit === 'km' ? 'كم' : 'ساعة'}` : undefined} />}
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1 font-bold text-navy">الطلب</div>
          <Line label="نوع الصيانة" value={type?.name} />
          <Line label="وقت الاستلام" value={fmtDateTime(r.receivedAt)} />
          <Line label="الشكوى" value={r.complaint} />
          {!field && <Line label="المتعلقات المستلمة" value={r.accessories} />}
        </div>
        <ol className="mt-6 list-decimal space-y-1 ps-5 text-[11px] leading-relaxed text-gray-600">
          <li>يُبلَّغ العميل بعرض سعر الإصلاح (التقدير) قبل البدء بأي عمل، ولا يُنفَّذ أي إصلاح قبل موافقته.</li>
          <li>رسم الفحص والتشخيص يُستحق إذا رفض العميل عرض السعر.</li>
          <li>الشركة غير مسؤولة عن المتعلقات غير المذكورة في هذا الإيصال.</li>
          <li>يُرجى إحضار هذا الإيصال عند الاستلام.</li>
        </ol>
      </PrintSheet>
    </div>
  )
}
