import { Gauge, Inbox, Pencil, Power } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { DateInput } from '../../components/inputs'
import { Timeline } from '../../components/display'
import { EmptyBlock, ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal, NumInput, ReadOnly, Select, Tabs } from '../../components/ui'
import { addReading, assetHistory, childrenOf, lastReading, setAssetState } from '../../data/assets'
import { today } from '../../data/asof'
import { fmtDate, fmtDateTime, iqd, num, requestStatus, woStatus } from '../../data/format'
import { useStore } from '../../data/store'
import type { Asset } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { Link, useNavigate, useParams, useSearchParams } from '../../router'
import { RefChip, StateBadge, WarrantyBadge } from './shared'

type TabId = 'data' | 'vehicle' | 'meters' | 'history' | 'audit'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Field label={label}><ReadOnly>{children || '—'}</ReadOnly></Field>
)

export default function AssetCard() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'data'
  const api = useApi(() => db.assets.find((a) => a.id === id) ?? null, [id])
  const [reading, setReading] = useState<{ value: number; at: string } | null>(null)
  const [stateDlg, setStateDlg] = useState<{ state: Asset['state']; reason: string } | null>(null)

  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />
  const a = db.assets.find((x) => x.id === id)
  if (!a) return <EmptyBlock title="الأصل غير موجود" hint="ربما حُذف أو أُعيد تعيين البيانات." action={<Link to="/assets" className="btn">العودة إلى الأصول</Link>} />

  const cat = db.categories.find((c) => c.id === a.categoryId)
  const owner = db.partners.find((p) => p.id === a.ownerPartnerId)
  const vehicle = db.vehicles.find((v) => v.assetId === a.id)
  const parent = db.assets.find((x) => x.id === a.parentAssetId)
  const kids = childrenOf(db, a.id)
  const last = lastReading(db, a.id)
  const hist = assetHistory(db, a.id)
  const readings = db.readings.filter((r) => r.assetId === a.id).sort((x, y) => y.at.localeCompare(x.at))
  const audit = db.audit.filter((x) => x.entity === 'asset' && x.entityId === a.id).reverse()
  const userName = (uid: string) => db.users.find((u) => u.id === uid)?.name ?? uid

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'data', label: 'البيانات' },
    ...(cat?.isVehicle ? [{ id: 'vehicle' as TabId, label: 'بيانات السيارة' }] : []),
    ...(cat?.meterUnit ? [{ id: 'meters' as TabId, label: 'العدادات', count: readings.length }] : []),
    { id: 'history', label: 'تاريخ الصيانة', count: hist.wos.length + hist.reqs.length },
    { id: 'audit', label: 'سجل التدقيق', count: audit.length },
  ]

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'بطاقات الأصول', to: '/assets' }, { label: a.code }]}
        title={a.name}
        badge={<><StateBadge asset={a} /><WarrantyBadge asset={a} /></>}
        summary={{ label: 'تكلفة الصيانة التراكمية', value: iqd(hist.total) }}
        actions={
          <>
            {can('Requests.Create') && a.state !== 'retired' && (
              <button type="button" className="btn btn-primary" onClick={() => nav(`/requests/new?asset=${a.id}`)}><Inbox className="h-4 w-4" />طلب صيانة</button>
            )}
            {can('Assets.Manage') && <button type="button" className="btn" onClick={() => nav(`/assets/${a.id}/edit`)}><Pencil className="h-4 w-4" />تعديل</button>}
            {can('Assets.Manage') && (
              <button type="button" className="btn" onClick={() => setStateDlg({ state: a.state === 'active' ? 'retired' : 'active', reason: '' })}><Power className="h-4 w-4" />تغيير الحالة</button>
            )}
          </>
        }
      />

      <Card pad={false}>
        <Tabs<TabId> tabs={tabs} active={tab} onChange={(t) => setParams({ tab: t })} />
        <div className="p-4">
          {tab === 'data' && (
            <div className="space-y-5">
              <FormGrid>
                <Row label="الرمز"><span className="font-mono" dir="ltr">{a.code}</span></Row>
                <Row label="الفئة">{cat?.name}</Row>
                <Row label="الماركة">{a.brand}</Row>
                <Row label="الموديل">{a.model}</Row>
                <Row label="الرقم التسلسلي"><span dir="ltr">{a.serial}</span></Row>
                <Row label="المالك">{owner?.name}{a.ownerKind === 'company' ? ' (أصل الشركة)' : ''}</Row>
                <Row label="هاتف المالك"><span dir="ltr">{owner?.phone}</span></Row>
                <Field label="الموقع" span={2}><ReadOnly>{a.location}</ReadOnly></Field>
                <Row label="المنطقة">{a.area}</Row>
                <Row label="بداية الضمان">{fmtDate(a.warrantyStart)}</Row>
                <Row label="نهاية الضمان">{fmtDate(a.warrantyEnd)}</Row>
                <Row label="مركز التكلفة"><span dir="ltr">{a.costCenter}</span></Row>
                <Row label="آخر قراءة عداد">{last ? `${num(last.value)} ${last.unit === 'km' ? 'كم' : 'ساعة'} — ${fmtDate(last.at)}` : ''}</Row>
              </FormGrid>
              {(a.fixedAssetRef || a.contractRef) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  روابط مع وحدات أخرى: <RefChip label="أصل ثابت" value={a.fixedAssetRef} /><RefChip label="عقد" value={a.contractRef} />
                  <span className="text-[11px] text-gray-400">(الجانب المحاسبي للأصل الثابت في وحدة الموجودات الثابتة)</span>
                </div>
              )}
              {cat && cat.attributes.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-gray-500">سمات {cat.name}</div>
                  <FormGrid>{cat.attributes.map((d) => <Row key={d.key} label={d.label + (d.unit ? ` (${d.unit})` : '')}>{a.attributes[d.key]}</Row>)}</FormGrid>
                </div>
              )}
              {(parent || kids.length > 0) && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-gray-500">التركيب</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {parent && <span>جزء من: <Link to={`/assets/${parent.id}`} className="text-navy hover:underline">{parent.code} — {parent.name}</Link></span>}
                    {kids.map((k) => <span key={k.id}>مكوّن: <Link to={`/assets/${k.id}`} className="text-navy hover:underline">{k.code} — {k.name}</Link></span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'vehicle' && vehicle && (
            <FormGrid>
              <Row label="رقم اللوحة">{vehicle.plate}</Row>
              <Row label="رقم الشاصي (VIN)"><span dir="ltr">{vehicle.vin}</span></Row>
              <Row label="الشركة المصنعة">{vehicle.make}</Row>
              <Row label="الموديل">{vehicle.model}</Row>
              <Row label="سنة الصنع">{String(vehicle.year)}</Row>
              <Row label="رقم المحرك"><span dir="ltr">{vehicle.engineNo}</span></Row>
              <Row label="الوقود">{vehicle.fuel}</Row>
              <Row label="ناقل الحركة">{vehicle.transmission}</Row>
              <Row label="اللون">{vehicle.color}</Row>
            </FormGrid>
          )}

          {tab === 'meters' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">القراءة لا تقل عن السابقة. قراءات الاستلام والتسليم تُسجَّل تلقائيًا من الطلبات وأوامر العمل.</span>
                {can('Assets.Manage') && a.state !== 'retired' && (
                  <button type="button" className="btn" onClick={() => setReading({ value: last?.value ?? 0, at: today() })}><Gauge className="h-4 w-4" />قراءة جديدة</button>
                )}
              </div>
              <DataTable rows={readings} compact emptyTitle="لا توجد قراءات" columns={[
                { key: 'at', label: 'التاريخ', render: (r) => fmtDate(r.at), sort: (r) => r.at },
                { key: 'v', label: 'القراءة', num: true, render: (r) => `${num(r.value)} ${r.unit === 'km' ? 'كم' : 'ساعة'}` },
                { key: 'src', label: 'المصدر', render: (r) => ({ intake: 'استلام', handover: 'تسليم', manual: 'يدوي' })[r.source] },
                { key: 'doc', label: 'المستند', render: (r) => (r.docRef ? <span className="font-mono text-[12px]" dir="ltr">{r.docRef}</span> : '—') },
              ]} />
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              {hist.wos.length === 0 && hist.reqs.length === 0 ? (
                <EmptyBlock title="لا يوجد تاريخ صيانة بعد" hint="تظهر هنا طلبات الصيانة وأوامر العمل مع تكلفة كل أمر." />
              ) : (
                <>
                  <DataTable rows={hist.wos} rowTo={(w) => `/work-orders/${w.id}`} emptyTitle="لا توجد أوامر عمل" columns={[
                    { key: 'n', label: 'أمر العمل', render: (w) => <span className="font-mono text-[12px]" dir="ltr">{w.number}</span> },
                    { key: 'd', label: 'التاريخ', render: (w) => fmtDate(w.date), sort: (w) => w.date },
                    { key: 's', label: 'الحالة', render: (w) => <Badge tone={woStatus[w.status].tone}>{woStatus[w.status].label}</Badge> },
                    { key: 'rw', label: '', render: (w) => (w.reworkOfId ? <Badge tone="amber">إعادة عمل</Badge> : null) },
                    { key: 'p', label: 'القطع', num: true, render: (w) => iqd(w.parts), total: (rs) => iqd(rs.reduce((s, w) => s + w.parts, 0)) },
                    { key: 'l', label: 'العمالة', num: true, render: (w) => iqd(w.labor), total: (rs) => iqd(rs.reduce((s, w) => s + w.labor, 0)) },
                    { key: 't', label: 'الإجمالي', num: true, render: (w) => iqd(w.total), total: (rs) => iqd(rs.reduce((s, w) => s + w.total, 0)) },
                  ]} />
                  {hist.reqs.length > 0 && (
                    <DataTable rows={hist.reqs} rowTo={(r) => `/requests/${r.id}`} columns={[
                      { key: 'n', label: 'طلب بلا أمر عمل', render: (r) => <span className="font-mono text-[12px]" dir="ltr">{r.number}</span> },
                      { key: 'd', label: 'التاريخ', render: (r) => fmtDate(r.date) },
                      { key: 'c', label: 'الشكوى', render: (r) => r.complaint },
                      { key: 's', label: 'الحالة', render: (r) => <Badge tone={requestStatus[r.status].tone}>{requestStatus[r.status].label}</Badge> },
                    ]} />
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <Timeline empty="لا توجد تغييرات مسجلة على هذه البطاقة" items={audit.map((x) => ({ id: x.id, at: fmtDateTime(x.at), title: x.action, detail: x.detail, by: userName(x.userId) }))} />
          )}
        </div>
      </Card>

      {reading && (
        <Modal title="تسجيل قراءة عداد" onClose={() => setReading(null)}
          footer={<><button type="button" className="btn" onClick={() => setReading(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={() => run((d) => addReading(d, a.id, reading.value, reading.at), 'تم تسجيل القراءة') && setReading(null)}>حفظ</button></>}>
          <FormGrid>
            <Field label={`القراءة (${cat?.meterUnit === 'km' ? 'كم' : 'ساعة'})`} span={2}><NumInput value={reading.value} onChange={(value) => setReading({ ...reading, value })} /></Field>
            <Field label="التاريخ" span={2}><DateInput value={reading.at} onChange={(at) => setReading({ ...reading, at })} /></Field>
          </FormGrid>
          {last && <p className="mt-2 text-xs text-gray-500">آخر قراءة: {num(last.value)} بتاريخ {fmtDate(last.at)}</p>}
        </Modal>
      )}

      {stateDlg && (
        <Modal title="تغيير حالة الأصل" onClose={() => setStateDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setStateDlg(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={() => run((d) => setAssetState(d, a.id, stateDlg.state, stateDlg.reason), 'تم تغيير الحالة') && setStateDlg(null)}>حفظ</button></>}>
          <FormGrid>
            <Field label="الحالة الجديدة" span={2}>
              <Select<Asset['state']> value={stateDlg.state} onChange={(state) => setStateDlg({ ...stateDlg, state })}
                options={[{ value: 'active', label: 'فعال' }, { value: 'loaned', label: 'معار' }, { value: 'retired', label: 'متقاعد' }]} />
            </Field>
            <Field label="السبب" required span={3}><input className="inp" value={stateDlg.reason} onChange={(e) => setStateDlg({ ...stateDlg, reason: e.target.value })} /></Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
