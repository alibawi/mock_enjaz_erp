import { Save } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/Layout'
import { AssetSelect, DateInput, PartnerSelect } from '../../components/inputs'
import { EmptyBlock } from '../../components/states'
import { Card, Field, FormGrid, Select } from '../../components/ui'
import { saveAsset } from '../../data/assets'
import { uid } from '../../data/format'
import { useStore } from '../../data/store'
import type { Asset, OwnerKind, VehicleDetails } from '../../data/types'
import { Link, useNavigate, useParams } from '../../router'

const blankVehicle = (assetId: string): VehicleDetails => ({ assetId, plate: '', vin: '', make: '', model: '', year: 2024, engineNo: '', fuel: 'بنزين', transmission: 'أوتوماتيك', color: '' })

export default function AssetForm() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const existing = db.assets.find((a) => a.id === id)
  const isNew = !id
  const [a, setA] = useState<Asset>(() => existing ? structuredClone(existing) : {
    id: uid('as'), code: 'سيُولَّد عند الحفظ', name: '', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: '', model: '', brand: '', location: '',
    state: 'active', attributes: {},
  })
  const [v, setV] = useState<VehicleDetails>(() => structuredClone(db.vehicles.find((x) => x.assetId === id) ?? blankVehicle(a.id)))
  const cat = db.categories.find((c) => c.id === a.categoryId)
  const set = (p: Partial<Asset>) => setA((x) => ({ ...x, ...p }))
  const setVeh = (p: Partial<VehicleDetails>) => setV((x) => ({ ...x, ...p }))

  if (!isNew && !existing) return <EmptyBlock title="الأصل غير موجود" action={<Link to="/assets" className="btn">العودة</Link>} />
  if (!can('Assets.Manage')) return <EmptyBlock title="لا تملك صلاحية تعديل الأصول" hint="بدّل إلى موظف الاستقبال أو مدير الورشة." />

  const save = () => {
    const ok = run((d) => saveAsset(d, structuredClone(a), cat?.isVehicle ? { ...v, assetId: a.id } : null, isNew), isNew ? 'تم إنشاء بطاقة الأصل' : 'تم حفظ التعديلات')
    if (ok) nav(`/assets/${a.id}`)
  }
  const setOwnerKind = (ownerKind: OwnerKind) => set({ ownerKind, ownerPartnerId: ownerKind === 'company' ? db.settings.internalPartnerId : '' })

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'بطاقات الأصول', to: '/assets' }, ...(existing ? [{ label: existing.code, to: `/assets/${existing.id}` }] : []), { label: isNew ? 'أصل جديد' : 'تعديل' }]}
        title={isNew ? 'بطاقة أصل جديدة' : `تعديل ${existing!.code}`}
        actions={<>
          <button type="button" className="btn" onClick={() => nav(isNew ? '/assets' : `/assets/${id}`)}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={save}><Save className="h-4 w-4" />حفظ</button>
        </>}
      />
      <div className="space-y-4">
        <Card title="الهوية والمالك">
          <FormGrid>
            <Field label="الاسم" required span={3}><input className="inp" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثال: مكيف LG 2 طن — دار زيد" /></Field>
            <Field label="الفئة" required>
              <Select value={a.categoryId} onChange={(categoryId) => set({ categoryId, attributes: {} })} options={db.categories.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="الحالة"><Select<Asset['state']> value={a.state} onChange={(state) => set({ state })} options={[{ value: 'active', label: 'فعال' }, { value: 'loaned', label: 'معار' }, { value: 'retired', label: 'متقاعد' }]} /></Field>
            <Field label="الماركة" required><input className="inp" value={a.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
            <Field label="الموديل" required><input className="inp" value={a.model} onChange={(e) => set({ model: e.target.value })} /></Field>
            <Field label="الرقم التسلسلي" hint="فريد داخل المؤسسة؛ يمكن تركه فارغًا"><input className="inp" dir="ltr" value={a.serial ?? ''} onChange={(e) => set({ serial: e.target.value || undefined })} /></Field>
            <Field label="نوع المالك"><Select<OwnerKind> value={a.ownerKind} onChange={setOwnerKind} options={[{ value: 'customer', label: 'عميل' }, { value: 'company', label: 'الشركة (داخلي)' }]} /></Field>
            <Field label="المالك" required hint="قد يختلف عن الجهة المُفوتَرة (القرار 4)">
              <PartnerSelect kind={a.ownerKind === 'company' ? 'internal' : 'customer'} disabled={a.ownerKind === 'company'} value={a.ownerPartnerId} onChange={(ownerPartnerId) => set({ ownerPartnerId })} />
            </Field>
          </FormGrid>
        </Card>

        <Card title="الموقع والضمان والروابط">
          <FormGrid>
            <Field label="الموقع" span={3}><input className="inp" value={a.location} onChange={(e) => set({ location: e.target.value })} /></Field>
            <Field label="المنطقة"><input className="inp" value={a.area ?? ''} onChange={(e) => set({ area: e.target.value || undefined })} /></Field>
            <Field label="جزء من أصل (الأب)"><AssetSelect partnerId={a.ownerPartnerId || undefined} value={a.parentAssetId ?? ''} onChange={(p) => set({ parentAssetId: p || undefined })} /></Field>
            <Field label="بداية الضمان"><DateInput value={a.warrantyStart ?? ''} onChange={(x) => set({ warrantyStart: x || undefined })} /></Field>
            <Field label="نهاية الضمان"><DateInput value={a.warrantyEnd ?? ''} onChange={(x) => set({ warrantyEnd: x || undefined })} /></Field>
            <Field label="رقم الأصل الثابت" hint="للأصول الداخلية — رقم مرجعي"><input className="inp" dir="ltr" value={a.fixedAssetRef ?? ''} onChange={(e) => set({ fixedAssetRef: e.target.value || undefined })} /></Field>
            <Field label="رقم العقد" hint="رقم مرجعي"><input className="inp" dir="ltr" value={a.contractRef ?? ''} onChange={(e) => set({ contractRef: e.target.value || undefined })} /></Field>
            <Field label="مركز التكلفة"><input className="inp" dir="ltr" value={a.costCenter ?? ''} onChange={(e) => set({ costCenter: e.target.value || undefined })} /></Field>
          </FormGrid>
        </Card>

        {cat && cat.attributes.length > 0 && (
          <Card title={`سمات ${cat.name} (من قالب الفئة)`}>
            <FormGrid>
              {cat.attributes.map((d) => (
                <Field key={d.key} label={d.label + (d.unit ? ` (${d.unit})` : '')}>
                  <input className="inp" value={a.attributes[d.key] ?? ''} onChange={(e) => set({ attributes: { ...a.attributes, [d.key]: e.target.value } })} />
                </Field>
              ))}
            </FormGrid>
          </Card>
        )}

        {cat?.isVehicle && (
          <Card title="بيانات السيارة">
            <FormGrid>
              <Field label="رقم اللوحة" required><input className="inp" value={v.plate} onChange={(e) => setVeh({ plate: e.target.value })} placeholder="بغداد 12345 أ" /></Field>
              <Field label="رقم الشاصي (VIN)" required span={2}><input className="inp" dir="ltr" value={v.vin} onChange={(e) => setVeh({ vin: e.target.value.toUpperCase() })} /></Field>
              <Field label="الشركة المصنعة"><input className="inp" dir="ltr" value={v.make} onChange={(e) => setVeh({ make: e.target.value })} /></Field>
              <Field label="الموديل"><input className="inp" dir="ltr" value={v.model} onChange={(e) => setVeh({ model: e.target.value })} /></Field>
              <Field label="سنة الصنع"><input className="inp" dir="ltr" inputMode="numeric" value={v.year} onChange={(e) => setVeh({ year: Number(e.target.value) || 0 })} /></Field>
              <Field label="رقم المحرك"><input className="inp" dir="ltr" value={v.engineNo} onChange={(e) => setVeh({ engineNo: e.target.value })} /></Field>
              <Field label="الوقود"><Select value={v.fuel} onChange={(fuel) => setVeh({ fuel })} options={['بنزين', 'ديزل', 'هجين', 'كهرباء'].map((x) => ({ value: x, label: x }))} /></Field>
              <Field label="ناقل الحركة"><Select value={v.transmission} onChange={(transmission) => setVeh({ transmission })} options={['أوتوماتيك', 'يدوي'].map((x) => ({ value: x, label: x }))} /></Field>
              <Field label="اللون"><input className="inp" value={v.color} onChange={(e) => setVeh({ color: e.target.value })} /></Field>
            </FormGrid>
          </Card>
        )}
      </div>
    </div>
  )
}
