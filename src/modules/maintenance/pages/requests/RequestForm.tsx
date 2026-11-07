import { AlertTriangle, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/Layout'
import { AssetSelect, PartnerSelect } from '../../components/inputs'
import { EmptyBlock } from '../../components/states'
import { Card, Field, FormGrid, Modal, NumInput, ReadOnly, Select } from '../../components/ui'
import { lastReading, saveAsset } from '../../data/assets'
import { fmtDate, maintKindLabel, num, uid } from '../../data/format'
import { createRequest, probableRework, type IntakeInput } from '../../data/requests'
import { useStore } from '../../data/store'
import type { Asset, MaintRequest } from '../../data/types'
import { Link, useNavigate, useSearchParams } from '../../router'
import { WarrantyBadge } from '../assets/shared'
import { channelLabel } from './RequestsList'

/** Minimal asset card created from the intake desk (full card can be completed later). */
function QuickAsset({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, partnerId: string) => void }) {
  const { db, run } = useStore()
  const [x, setX] = useState({ name: '', categoryId: 'cat-car', ownerPartnerId: '', brand: '', model: '', serial: '', plate: '', vin: '', year: 2022 })
  const cat = db.categories.find((c) => c.id === x.categoryId)
  const save = () => {
    const id = uid('as')
    const asset: Asset = { id, code: '', name: x.name, categoryId: x.categoryId, ownerKind: 'customer', ownerPartnerId: x.ownerPartnerId, brand: x.brand, model: x.model,
      serial: x.serial || undefined, location: 'عند العميل', area: db.partners.find((p) => p.id === x.ownerPartnerId)?.area, state: 'active', attributes: {} }
    const veh = cat?.isVehicle ? { assetId: id, plate: x.plate, vin: x.vin, make: x.brand, model: x.model, year: x.year, engineNo: '', fuel: 'بنزين', transmission: 'أوتوماتيك', color: '' } : null
    if (run((d) => saveAsset(d, asset, veh, true), 'تم إنشاء بطاقة الأصل')) onCreated(id, x.ownerPartnerId)
  }
  return (
    <Modal wide title="بطاقة أصل سريعة" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>إلغاء</button><button type="button" className="btn btn-primary" onClick={save}>إنشاء واختيار</button></>}>
      <FormGrid>
        <Field label="الاسم" required span={3}><input className="inp" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></Field>
        <Field label="الفئة" span={2}><Select value={x.categoryId} onChange={(categoryId) => setX({ ...x, categoryId })} options={db.categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="المالك (العميل)" required span={2}><PartnerSelect kind="customer" value={x.ownerPartnerId} onChange={(ownerPartnerId) => setX({ ...x, ownerPartnerId })} /></Field>
        <Field label="الماركة" required><input className="inp" dir="ltr" value={x.brand} onChange={(e) => setX({ ...x, brand: e.target.value })} /></Field>
        <Field label="الموديل" required><input className="inp" dir="ltr" value={x.model} onChange={(e) => setX({ ...x, model: e.target.value })} /></Field>
        {cat?.isVehicle ? (
          <>
            <Field label="رقم اللوحة" required><input className="inp" value={x.plate} onChange={(e) => setX({ ...x, plate: e.target.value })} /></Field>
            <Field label="VIN" required span={2}><input className="inp" dir="ltr" value={x.vin} onChange={(e) => setX({ ...x, vin: e.target.value.toUpperCase() })} /></Field>
          </>
        ) : (
          <Field label="الرقم التسلسلي" span={2}><input className="inp" dir="ltr" value={x.serial} onChange={(e) => setX({ ...x, serial: e.target.value })} /></Field>
        )}
      </FormGrid>
      <p className="mt-2 text-[11px] text-gray-500">تُستكمل بقية البيانات (الضمان، السمات، الموقع) من بطاقة الأصل لاحقًا.</p>
    </Modal>
  )
}

export default function RequestForm() {
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [quick, setQuick] = useState(false)
  /** Owner contact and the first maintenance type that fits the asset (internal types for company assets only). */
  const defaultsFor = (assetId: string): Partial<IntakeInput> => {
    const a = db.assets.find((x) => x.id === assetId)
    const p = db.partners.find((x) => x.id === a?.ownerPartnerId)
    const first = db.maintenanceTypes.find((m) => m.active && a && (a.ownerKind === 'company') === (m.kind === 'internal'))
    return { assetId, maintenanceTypeId: first?.id ?? '', contactName: p?.kind === 'customer' ? p.name : undefined, contactPhone: p?.kind === 'customer' ? p.phone : undefined, meterAtIntake: undefined }
  }
  const [f, setF] = useState<IntakeInput>(() => ({
    assetId: '', maintenanceTypeId: '', complaint: '', accessories: '', channel: 'walkIn', receiveNow: true, markRework: true,
    ...defaultsFor(params.get('asset') ?? ''),
  }))
  const set = (p: Partial<IntakeInput>) => setF((x) => ({ ...x, ...p }))

  if (!can('Requests.Create')) return <EmptyBlock title="لا تملك صلاحية استلام الطلبات" hint="بدّل إلى موظف الاستقبال." />

  const asset = db.assets.find((a) => a.id === f.assetId)
  const owner = db.partners.find((p) => p.id === asset?.ownerPartnerId)
  const cat = db.categories.find((c) => c.id === asset?.categoryId)
  const last = asset ? lastReading(db, asset.id) : undefined
  const rework = asset ? probableRework(db, asset.id) : undefined
  const types = db.maintenanceTypes.filter((m) => m.active && (!asset || (asset.ownerKind === 'company') === (m.kind === 'internal')))
  const plate = asset && db.vehicles.find((v) => v.assetId === asset.id)?.plate

  const pickAsset = (assetId: string) => set(defaultsFor(assetId))

  const save = () => {
    const id = uid('rq')
    if (run((d) => createRequest(d, f, id), f.receiveNow ? 'تم استلام الطلب' : 'تم حفظ الطلب كمسودة')) nav(`/requests/${id}`)
  }

  return (
    <div>
      <PageHeader crumbs={[{ label: 'طلبات الصيانة', to: '/requests' }, { label: 'استلام طلب' }]} title="استلام طلب صيانة"
        actions={<>
          <button type="button" className="btn" onClick={() => nav('/requests')}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={save}><Save className="h-4 w-4" />{f.receiveNow ? 'حفظ واستلام' : 'حفظ كمسودة'}</button>
        </>} />

      <div className="space-y-4">
        <Card title="الأصل" actions={<button type="button" className="btn" onClick={() => setQuick(true)}><Plus className="h-4 w-4" />أصل غير مسجل</button>}>
          <FormGrid>
            <Field label="الأصل" required span={3} hint="ابحث بالرمز أو الاسم أو اللوحة أو الرقم التسلسلي"><AssetSelect value={f.assetId} onChange={pickAsset} /></Field>
            <Field label="المالك"><ReadOnly>{owner?.name}</ReadOnly></Field>
            <Field label="الضمان"><ReadOnly>{asset ? <WarrantyBadge asset={asset} /> : '—'}</ReadOnly></Field>
            {asset && (
              <>
                <Field label="اللوحة / الرقم التسلسلي"><ReadOnly>{plate ?? asset.serial}</ReadOnly></Field>
                <Field label="الموقع" span={2}><ReadOnly>{asset.location}</ReadOnly></Field>
                <Field label="فتح البطاقة"><ReadOnly><Link to={`/assets/${asset.id}`} className="text-navy hover:underline">{asset.code}</Link></ReadOnly></Field>
              </>
            )}
          </FormGrid>
          {rework && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">إعادة عمل محتملة</div>
                آخر أمر عمل لهذا الأصل <Link to={`/work-orders/${rework.id}`} className="font-mono underline" dir="ltr">{rework.number}</Link> انتهى في {fmtDate(rework.actualEnd)}، أي خلال {db.settings.reworkWindowDays} يومًا.
                <label className="mt-1 flex items-center gap-1.5"><input type="checkbox" checked={f.markRework} onChange={(e) => set({ markRework: e.target.checked })} />تسجيله كإعادة عمل (تغطية حسن نية، لا يُفوتر)</label>
              </div>
            </div>
          )}
        </Card>

        <Card title="الطلب">
          <FormGrid>
            <Field label="نوع الصيانة" required span={2}>
              <Select value={f.maintenanceTypeId} placeholder="اختر" onChange={(maintenanceTypeId) => set({ maintenanceTypeId })}
                options={types.map((m) => ({ value: m.id, label: `${m.name} · ${maintKindLabel[m.kind]}` }))} />
            </Field>
            <Field label="قناة الطلب"><Select<MaintRequest['channel']> value={f.channel} onChange={(channel) => set({ channel })} options={(Object.keys(channelLabel) as MaintRequest['channel'][]).map((c) => ({ value: c, label: channelLabel[c] }))} /></Field>
            <Field label="جهة الاتصال"><input className="inp" value={f.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} /></Field>
            <Field label="الهاتف"><input className="inp" dir="ltr" value={f.contactPhone ?? ''} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
            <Field label="شكوى العميل / وصف العطل" required span={5}>
              <textarea className="inp min-h-[80px] py-2" value={f.complaint} onChange={(e) => set({ complaint: e.target.value })} />
            </Field>
            {cat?.meterUnit && (
              <Field label={`قراءة العداد عند الاستلام (${cat.meterUnit === 'km' ? 'كم' : 'ساعة'})`} span={2} hint={last ? `آخر قراءة ${num(last.value)} بتاريخ ${fmtDate(last.at)}` : undefined}>
                <NumInput value={f.meterAtIntake ?? 0} onChange={(meterAtIntake) => set({ meterAtIntake })} />
              </Field>
            )}
            <Field label="المتعلقات المستلمة" span={3} hint="مفاتيح، إطار احتياط، ريموت، ..."><input className="inp" value={f.accessories} onChange={(e) => set({ accessories: e.target.value })} /></Field>
            <Field label="الاستلام" span={5}>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.receiveNow} onChange={(e) => set({ receiveNow: e.target.checked })} />استلام الأصل الآن (يسجَّل العداد ويُطبع الإيصال)</label>
            </Field>
          </FormGrid>
        </Card>
      </div>

      {quick && (
        <QuickAsset onClose={() => setQuick(false)} onCreated={(id, partnerId) => {
          // the store has the new asset only after this render, so defaults are set from what the dialog knows
          const p = db.partners.find((x) => x.id === partnerId)
          setQuick(false)
          set({ assetId: id, maintenanceTypeId: db.maintenanceTypes.find((m) => m.active && m.kind !== 'internal')?.id ?? '', contactName: p?.name, contactPhone: p?.phone, meterAtIntake: undefined })
        }} />
      )}
    </div>
  )
}
