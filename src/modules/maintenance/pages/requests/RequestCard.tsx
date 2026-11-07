import { Ban, FileSignature, PackageCheck, Printer, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/Layout'
import { Timeline } from '../../components/display'
import { EmptyBlock, ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal, ReadOnly } from '../../components/ui'
import { fmtDateTime, maintKindLabel, num, requestStatus } from '../../data/format'
import { canMove, cancelRequest, receive, startDiagnosis } from '../../data/requests'
import { useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'
import { Link, useNavigate, useParams } from '../../router'
import { WarrantyBadge } from '../assets/shared'
import { channelLabel } from './RequestsList'

export default function RequestCard() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const api = useApi(() => db.requests.find((r) => r.id === id) ?? null, [id])
  const [cancel, setCancel] = useState<string | null>(null)

  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />
  const r = db.requests.find((x) => x.id === id)
  if (!r) return <EmptyBlock title="الطلب غير موجود" action={<Link to="/requests" className="btn">العودة إلى الطلبات</Link>} />

  const asset = db.assets.find((a) => a.id === r.assetId)
  const plate = db.vehicles.find((v) => v.assetId === r.assetId)?.plate
  const partner = db.partners.find((p) => p.id === r.partnerId)
  const type = db.maintenanceTypes.find((m) => m.id === r.maintenanceTypeId)
  const unit = db.categories.find((c) => c.id === asset?.categoryId)?.meterUnit
  const estimate = db.estimates.find((e) => e.id === r.estimateId)
  const wo = db.workOrders.find((w) => w.id === r.workOrderId)
  const rework = db.workOrders.find((w) => w.id === r.reworkOfWorkOrderId)
  const userName = (u: string) => db.users.find((x) => x.id === u)?.name ?? u
  const audit = db.audit.filter((x) => x.entity === 'request' && x.entityId === r.id).reverse()
  const canEstimate = can('Estimates.Create') && ['received', 'inDiagnosis'].includes(r.status) && !r.estimateId

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'طلبات الصيانة', to: '/requests' }, { label: r.number }]}
        title={`طلب صيانة ${r.number}`}
        badge={<><Badge tone={requestStatus[r.status].tone}>{requestStatus[r.status].label}</Badge>{rework && <Badge tone="amber">إعادة عمل</Badge>}</>}
        actions={
          <>
            {can('Requests.Create') && r.status === 'draft' && <button type="button" className="btn btn-primary" onClick={() => run((d) => receive(d, r.id), 'تم استلام الأصل')}><PackageCheck className="h-4 w-4" />استلام الأصل</button>}
            {can('Estimates.Create') && canMove(r, 'inDiagnosis') && <button type="button" className="btn" onClick={() => run((d) => startDiagnosis(d, r.id), 'بدأ التشخيص')}><Stethoscope className="h-4 w-4" />بدء التشخيص</button>}
            {canEstimate && <button type="button" className="btn btn-primary" onClick={() => nav(`/estimates/new?request=${r.id}`)}><FileSignature className="h-4 w-4" />إعداد التقدير</button>}
            {r.status !== 'draft' && <button type="button" className="btn" onClick={() => nav(`/requests/${r.id}/receipt`)}><Printer className="h-4 w-4" />إيصال الاستلام</button>}
            {can('Requests.Create') && canMove(r, 'cancelled') && <button type="button" className="btn text-red-600" onClick={() => setCancel('')}><Ban className="h-4 w-4" />إلغاء</button>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="الأصل والعميل">
            <FormGrid>
              <Field label="الأصل" span={3}><ReadOnly><Link to={`/assets/${asset?.id}`} className="text-navy hover:underline">{asset?.code} — {asset?.name}</Link></ReadOnly></Field>
              <Field label="الضمان"><ReadOnly>{asset ? <WarrantyBadge asset={asset} /> : '—'}</ReadOnly></Field>
              <Field label="اللوحة / الرقم التسلسلي"><ReadOnly>{plate ?? asset?.serial ?? '—'}</ReadOnly></Field>
              <Field label="العميل (المالك)" span={2}><ReadOnly>{partner?.name}</ReadOnly></Field>
              <Field label="جهة الاتصال"><ReadOnly>{r.contactName ?? '—'}</ReadOnly></Field>
              <Field label="الهاتف"><ReadOnly><span dir="ltr">{r.contactPhone ?? partner?.phone}</span></ReadOnly></Field>
              <Field label="الموقع"><ReadOnly>{asset?.location}</ReadOnly></Field>
            </FormGrid>
          </Card>
          <Card title="الطلب">
            <FormGrid>
              <Field label="نوع الصيانة" span={2}><ReadOnly>{type ? `${type.name} · ${maintKindLabel[type.kind]}` : '—'}</ReadOnly></Field>
              <Field label="القناة"><ReadOnly>{channelLabel[r.channel]}</ReadOnly></Field>
              <Field label="الاستلام"><ReadOnly>{r.status === 'draft' ? 'لم يُستلم بعد' : fmtDateTime(r.receivedAt)}</ReadOnly></Field>
              <Field label="المستلم"><ReadOnly>{userName(r.receivedBy)}</ReadOnly></Field>
              <Field label="الشكوى" span={5}><ReadOnly>{r.complaint}</ReadOnly></Field>
              {unit && <Field label="العداد عند الاستلام"><ReadOnly>{r.meterAtIntake ? `${num(r.meterAtIntake)} ${unit === 'km' ? 'كم' : 'ساعة'}` : '—'}</ReadOnly></Field>}
              <Field label="المتعلقات" span={unit ? 4 : 5}><ReadOnly>{r.accessories || '—'}</ReadOnly></Field>
              {r.cancelReason && <Field label="سبب الإلغاء" span={5}><ReadOnly>{r.cancelReason}</ReadOnly></Field>}
            </FormGrid>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="المستندات المرتبطة">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-gray-500">التقدير</span>{estimate ? <Link to={`/estimates/${estimate.id}`} className="font-mono text-navy hover:underline" dir="ltr">{estimate.number}</Link> : <span className="text-gray-400">لم يُعدّ بعد</span>}</li>
              <li className="flex justify-between"><span className="text-gray-500">أمر العمل</span>{wo ? <Link to={`/work-orders/${wo.id}`} className="font-mono text-navy hover:underline" dir="ltr">{wo.number}</Link> : <span className="text-gray-400">—</span>}</li>
              {rework && <li className="flex justify-between"><span className="text-gray-500">إعادة عمل لـ</span><Link to={`/work-orders/${rework.id}`} className="font-mono text-amber-700 hover:underline" dir="ltr">{rework.number}</Link></li>}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">المسار: استلام ← تشخيص ← تقدير واعتماد ← أمر عمل. يُغلق الطلب عند إنشاء أمر العمل.</p>
          </Card>
          <Card title="سجل الطلب">
            <Timeline empty="لا أحداث" items={audit.map((x) => ({ id: x.id, at: fmtDateTime(x.at), title: x.action, detail: x.detail, by: userName(x.userId) }))} />
          </Card>
        </div>
      </div>

      {cancel !== null && (
        <Modal title="إلغاء طلب الصيانة" onClose={() => setCancel(null)}
          footer={<><button type="button" className="btn" onClick={() => setCancel(null)}>تراجع</button>
            <button type="button" className="btn border-red-600 bg-red-600 text-white hover:bg-red-700" onClick={() => run((d) => cancelRequest(d, r.id, cancel), 'تم إلغاء الطلب') && setCancel(null)}>إلغاء الطلب</button></>}>
          <Field label="سبب الإلغاء" required><textarea className="inp min-h-[70px] py-2" value={cancel} onChange={(e) => setCancel(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  )
}
