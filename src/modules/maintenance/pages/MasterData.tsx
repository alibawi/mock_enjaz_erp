import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/Layout'
import { ItemSelect } from '../components/inputs'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { Badge, Card, Confirm, Field, FormGrid, Modal, NumInput, Select, Tabs } from '../components/ui'
import { iqd, maintKindLabel, num, scopeLabel, uid } from '../data/format'
import { deleteMaster, masterLabel, saveMaster, type MasterKey } from '../data/masterdata'
import { useStore } from '../data/store'
import type {
  AssetCategory, AttributeDef, Bay, ExpenseScope, ExpenseType, FailureCode, MaintenanceType, MaintKind, StandardOperation, Technician, TechTitle, Workshop,
} from '../data/types'
import { useApi } from '../lib/useApi'
import { useSearchParams } from '../router'

type Editor<T> = { row: T; isNew: boolean }

/** One master-data tab: table + add/edit modal + delete with in-use guard. The form body is supplied by the tab. */
function MasterTab<T extends { id: string; name: string }>({ k, rows, columns, blank, required, form }: {
  k: MasterKey; rows: T[]; columns: Column<T>[]; blank: () => T; required: (keyof T)[]
  form: (row: T, set: (patch: Partial<T>) => void) => ReactNode
}) {
  const { run, can } = useStore()
  const edit = can('MasterData.Manage')
  const [ed, setEd] = useState<Editor<T> | null>(null)
  const [del, setDel] = useState<T | null>(null)
  const set = (patch: Partial<T>) => setEd((e) => (e ? { ...e, row: { ...e.row, ...patch } } : e))
  const save = () => ed && run((d) => saveMaster(d, k, ed.row as never, required as never[]), `تم حفظ ${masterLabel[k]}`) && setEd(null)

  const actions: Column<T> = {
    key: '_a', label: '', className: 'w-20 no-print',
    render: (r) => edit && (
      <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-navy" title="تعديل" onClick={() => setEd({ row: structuredClone(r), isNew: false })}><Pencil className="h-4 w-4" /></button>
        <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="حذف" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></button>
      </span>
    ),
  }

  return (
    <>
      <div className="no-print flex items-center justify-between border-b border-line p-3">
        <span className="text-xs text-gray-500">{rows.length} سجل{!edit && ' — للعرض فقط (لا تملك صلاحية البيانات الرئيسية)'}</span>
        {edit && <button type="button" className="btn btn-primary" onClick={() => setEd({ row: blank(), isNew: true })}><Plus className="h-4 w-4" />إضافة {masterLabel[k]}</button>}
      </div>
      <DataTable rows={rows} columns={[...columns, actions]} onRowClick={edit ? (r) => setEd({ row: structuredClone(r), isNew: false }) : undefined} />
      {ed && (
        <Modal wide title={`${ed.isNew ? 'إضافة' : 'تعديل'} ${masterLabel[k]}`} onClose={() => setEd(null)}
          footer={<><button type="button" className="btn" onClick={() => setEd(null)}>إلغاء</button><button type="button" className="btn btn-primary" onClick={save}>حفظ</button></>}>
          {form(ed.row, set)}
        </Modal>
      )}
      {del && <Confirm danger title={`حذف ${masterLabel[k]}`} text={`حذف «${del.name}»؟ لا يُسمح بحذف سجل مستخدم في مستندات.`} onClose={() => setDel(null)} onYes={() => run((d) => deleteMaster(d, k, del.id), 'تم الحذف')} />}
    </>
  )
}

const Txt = ({ value, onChange, ltr }: { value: string; onChange: (v: string) => void; ltr?: boolean }) => (
  <input className="inp" dir={ltr ? 'ltr' : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
)
const Active = ({ on }: { on: boolean }) => <Badge tone={on ? 'green' : 'gray'}>{on ? 'فعال' : 'موقوف'}</Badge>

/** Editable rows of {key,label,unit} for a category's attribute template (decision §33 item 9). */
function AttributeEditor({ value, onChange }: { value: AttributeDef[]; onChange: (v: AttributeDef[]) => void }) {
  const upd = (i: number, p: Partial<AttributeDef>) => onChange(value.map((a, j) => (j === i ? { ...a, ...p } : a)))
  return (
    <div className="space-y-1.5">
      {value.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_auto] gap-1.5">
          <input className="inp" dir="ltr" placeholder="key" value={a.key} onChange={(e) => upd(i, { key: e.target.value })} />
          <input className="inp" placeholder="الاسم الظاهر" value={a.label} onChange={(e) => upd(i, { label: e.target.value })} />
          <input className="inp" placeholder="الوحدة" value={a.unit ?? ''} onChange={(e) => upd(i, { unit: e.target.value || undefined })} />
          <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, { key: '', label: '' }])}><Plus className="h-4 w-4" />سمة</button>
    </div>
  )
}

function BayEditor({ value, onChange }: { value: Bay[]; onChange: (v: Bay[]) => void }) {
  const upd = (i: number, p: Partial<Bay>) => onChange(value.map((b, j) => (j === i ? { ...b, ...p } : b)))
  return (
    <div className="space-y-1.5">
      {value.map((b, i) => (
        <div key={b.id} className="grid grid-cols-[1fr_2fr_auto] gap-1.5">
          <input className="inp" dir="ltr" value={b.code} onChange={(e) => upd(i, { code: e.target.value })} />
          <input className="inp" value={b.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, { id: uid('bay'), code: '', name: '' }])}><Plus className="h-4 w-4" />رافعة / منصة</button>
    </div>
  )
}

type TabId = MasterKey

export default function MasterData() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'maintenanceTypes'
  const api = useApi(() => db, [])
  const etName = (id?: string) => db.expenseTypes.find((e) => e.id === id)?.name ?? '—'
  const catName = (id?: string) => db.categories.find((c) => c.id === id)?.name ?? 'كل الفئات'
  const itemName = (id: string) => db.items.find((i) => i.id === id)?.name ?? '—'

  const body = () => {
    switch (tab) {
      case 'maintenanceTypes':
        return (
          <MasterTab<MaintenanceType> k={tab} rows={db.maintenanceTypes} required={['code', 'name']}
            blank={() => ({ id: uid('mt'), code: '', name: '', kind: 'workshop', corrective: true, active: true, defaultExpenseTypeId: 'et-sale' })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span>, sort: (r) => r.code },
              { key: 'name', label: 'الاسم', render: (r) => r.name, sort: (r) => r.name },
              { key: 'kind', label: 'النوع', render: (r) => maintKindLabel[r.kind] },
              { key: 'corr', label: 'تصحيحية', render: (r) => (r.corrective ? 'نعم — كود العطل إلزامي' : 'لا') },
              { key: 'et', label: 'نوع المصروف الافتراضي', render: (r) => etName(r.defaultExpenseTypeId) },
              { key: 'act', label: 'الحالة', render: (r) => <Active on={r.active} /> },
            ]}
            form={(r, set) => (
              <FormGrid>
                <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                <Field label="الاسم" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                <Field label="النوع"><Select<MaintKind> value={r.kind} onChange={(kind) => set({ kind })} options={(Object.keys(maintKindLabel) as MaintKind[]).map((v) => ({ value: v, label: maintKindLabel[v] }))} /></Field>
                <Field label="نوع المصروف الافتراضي"><Select value={r.defaultExpenseTypeId ?? ''} onChange={(v) => set({ defaultExpenseTypeId: v || undefined })} placeholder="—" options={db.expenseTypes.map((e) => ({ value: e.id, label: e.name }))} /></Field>
                <Field label="صيانة تصحيحية" hint="كود العطل وسبب الإصلاح إلزاميان عند الإكمال (§28.8)"><Select value={r.corrective ? 'y' : 'n'} onChange={(v) => set({ corrective: v === 'y' })} options={[{ value: 'y', label: 'نعم' }, { value: 'n', label: 'لا (خدمة دورية)' }]} /></Field>
                <Field label="الحالة"><Select value={r.active ? 'y' : 'n'} onChange={(v) => set({ active: v === 'y' })} options={[{ value: 'y', label: 'فعال' }, { value: 'n', label: 'موقوف' }]} /></Field>
              </FormGrid>
            )} />
        )
      case 'categories':
        return (
          <MasterTab<AssetCategory> k={tab} rows={db.categories} required={['code', 'name']}
            blank={() => ({ id: uid('cat'), code: '', name: '', isVehicle: false, attributes: [] })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span>, sort: (r) => r.code },
              { key: 'name', label: 'الفئة', render: (r) => r.name },
              { key: 'veh', label: 'سيارة', render: (r) => (r.isVehicle ? 'نعم — بيانات السيارة' : '—') },
              { key: 'meter', label: 'العداد', render: (r) => (r.meterUnit === 'km' ? 'كيلومتر' : r.meterUnit === 'hours' ? 'ساعات تشغيل' : '—') },
              { key: 'attr', label: 'قالب السمات', render: (r) => (r.attributes.length ? r.attributes.map((a) => a.label + (a.unit ? ` (${a.unit})` : '')).join('، ') : '—') },
              { key: 'n', label: 'الأصول', num: true, render: (r) => num(db.assets.filter((a) => a.categoryId === r.id).length) },
            ]}
            form={(r, set) => (
              <div className="space-y-4">
                <FormGrid>
                  <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                  <Field label="الاسم" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                  <Field label="سيارة"><Select value={r.isVehicle ? 'y' : 'n'} onChange={(v) => set({ isVehicle: v === 'y' })} options={[{ value: 'y', label: 'نعم' }, { value: 'n', label: 'لا' }]} /></Field>
                  <Field label="العداد"><Select value={r.meterUnit ?? ''} placeholder="بلا عداد" onChange={(v) => set({ meterUnit: (v || undefined) as AssetCategory['meterUnit'] })} options={[{ value: 'km', label: 'كيلومتر' }, { value: 'hours', label: 'ساعات تشغيل' }]} /></Field>
                </FormGrid>
                <Field label="قالب السمات (حقول JSON على بطاقة الأصل)"><AttributeEditor value={r.attributes} onChange={(attributes) => set({ attributes })} /></Field>
              </div>
            )} />
        )
      case 'failureCodes':
        return (
          <MasterTab<FailureCode> k={tab} rows={db.failureCodes} required={['code', 'name']}
            blank={() => ({ id: uid('fc'), code: '', name: '' })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span>, sort: (r) => r.code },
              { key: 'name', label: 'الوصف', render: (r) => r.name },
              { key: 'cat', label: 'الفئة', render: (r) => catName(r.categoryId), sort: (r) => catName(r.categoryId) },
            ]}
            form={(r, set) => (
              <FormGrid>
                <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                <Field label="الوصف" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                <Field label="الفئة" span={2}><Select value={r.categoryId ?? ''} placeholder="كل الفئات" onChange={(v) => set({ categoryId: v || undefined })} options={db.categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
              </FormGrid>
            )} />
        )
      case 'operations':
        return (
          <MasterTab<StandardOperation> k={tab} rows={db.operations} required={['code', 'name', 'serviceItemId']}
            blank={() => ({ id: uid('op'), code: '', name: '', serviceItemId: 'sv-mech', standardHours: 1 })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span>, sort: (r) => r.code },
              { key: 'name', label: 'العملية', render: (r) => r.name },
              { key: 'svc', label: 'خدمة العمالة (تُفوتر)', render: (r) => itemName(r.serviceItemId) },
              { key: 'h', label: 'الساعات القياسية', num: true, render: (r) => num(r.standardHours, 1), sort: (r) => r.standardHours },
            ]}
            form={(r, set) => (
              <FormGrid>
                <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                <Field label="العملية" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                <Field label="الساعات القياسية"><NumInput value={r.standardHours} onChange={(standardHours) => set({ standardHours })} /></Field>
                <Field label="خدمة العمالة" required span={2}><ItemSelect kind="service" value={r.serviceItemId} onChange={(serviceItemId) => set({ serviceItemId })} /></Field>
              </FormGrid>
            )} />
        )
      case 'workshops':
        return (
          <MasterTab<Workshop> k={tab} rows={db.workshops} required={['code', 'name']}
            blank={() => ({ id: uid('ws'), code: '', name: '', warehouseId: 'wh-1', bays: [] })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span> },
              { key: 'name', label: 'الورشة', render: (r) => r.name },
              { key: 'wh', label: 'مخزن القطع', render: (r) => db.warehouses.find((w) => w.id === r.warehouseId)?.name ?? '—' },
              { key: 'bays', label: 'الرافعات والمنصات (موارد جدولة)', render: (r) => r.bays.map((b) => b.name).join('، ') },
            ]}
            form={(r, set) => (
              <div className="space-y-4">
                <FormGrid>
                  <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                  <Field label="الاسم" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                  <Field label="مخزن القطع" span={2}><Select value={r.warehouseId} onChange={(warehouseId) => set({ warehouseId })} options={db.warehouses.map((w) => ({ value: w.id, label: w.name }))} /></Field>
                </FormGrid>
                <Field label="الرافعات والمنصات" hint="تظهر كصفوف في لوحة الجدولة (SC5)"><BayEditor value={r.bays} onChange={(bays) => set({ bays })} /></Field>
              </div>
            )} />
        )
      case 'expenseTypes':
        return (
          <MasterTab<ExpenseType> k={tab} rows={db.expenseTypes} required={['code', 'name', 'accountCode', 'accountName']}
            blank={() => ({ id: uid('et'), code: '', name: '', accountCode: '', accountName: '', scope: 'internal' })}
            columns={[
              { key: 'code', label: 'الرمز', render: (r) => <span className="font-mono" dir="ltr">{r.code}</span>, sort: (r) => r.code },
              { key: 'name', label: 'النوع', render: (r) => r.name },
              { key: 'acc', label: 'حساب المصروف', render: (r) => <span><span className="font-mono text-gray-500" dir="ltr">{r.accountCode}</span> {r.accountName}</span> },
              { key: 'scope', label: 'النطاق', render: (r) => scopeLabel[r.scope] },
            ]}
            form={(r, set) => (
              <FormGrid>
                <Field label="الرمز" required><Txt ltr value={r.code} onChange={(code) => set({ code })} /></Field>
                <Field label="الاسم" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                <Field label="النطاق" span={2}><Select<ExpenseScope> value={r.scope} onChange={(scope) => set({ scope })} options={(Object.keys(scopeLabel) as ExpenseScope[]).map((v) => ({ value: v, label: scopeLabel[v] }))} /></Field>
                <Field label="رقم الحساب" required><Txt ltr value={r.accountCode} onChange={(accountCode) => set({ accountCode })} /></Field>
                <Field label="اسم الحساب" required span={2}><Txt value={r.accountName} onChange={(accountName) => set({ accountName })} /></Field>
                <Field label="ملاحظة" span={2}><div className="text-[11px] leading-relaxed text-gray-500">سطر الصرف يأخذ حساب نوعه، وإلا حساب نوع أمر العمل، وإلا تكلفة المبيعات (القرار 1c).</div></Field>
              </FormGrid>
            )} />
        )
      case 'technicians':
        return (
          <MasterTab<Technician> k={tab} rows={db.technicians} required={['employeeNo', 'name']}
            blank={() => ({ id: uid('t'), employeeNo: '', name: '', title: 'technician', standardRate: 12_500, phone: '', area: '', active: true })}
            columns={[
              { key: 'no', label: 'الرقم الوظيفي', render: (r) => <span className="font-mono" dir="ltr">{r.employeeNo}</span>, sort: (r) => r.employeeNo },
              { key: 'name', label: 'الفني', render: (r) => r.name, sort: (r) => r.name },
              { key: 'title', label: 'الوظيفة', render: (r) => (r.title === 'seniorTechnician' ? 'فني أول' : 'فني') },
              { key: 'rate', label: 'المعدل القياسي / ساعة', num: true, render: (r) => iqd(r.standardRate), sort: (r) => r.standardRate },
              { key: 'area', label: 'المنطقة', render: (r) => r.area },
              { key: 'phone', label: 'الهاتف', render: (r) => <span dir="ltr">{r.phone}</span> },
              { key: 'act', label: 'الحالة', render: (r) => <Active on={r.active} /> },
            ]}
            form={(r, set) => (
              <FormGrid>
                <Field label="الرقم الوظيفي" required hint="مربوط بموظف HR"><Txt ltr value={r.employeeNo} onChange={(employeeNo) => set({ employeeNo })} /></Field>
                <Field label="الاسم" required span={2}><Txt value={r.name} onChange={(name) => set({ name })} /></Field>
                <Field label="الوظيفة"><Select<TechTitle> value={r.title} onChange={(title) => set({ title })} options={[{ value: 'technician', label: 'فني' }, { value: 'seniorTechnician', label: 'فني أول' }]} /></Field>
                <Field label="المعدل القياسي / ساعة" hint="للتقارير فقط (§36.15)"><NumInput value={r.standardRate} onChange={(standardRate) => set({ standardRate })} /></Field>
                <Field label="الهاتف"><Txt ltr value={r.phone} onChange={(phone) => set({ phone })} /></Field>
                <Field label="المنطقة"><Txt value={r.area} onChange={(area) => set({ area })} /></Field>
                <Field label="الحالة"><Select value={r.active ? 'y' : 'n'} onChange={(v) => set({ active: v === 'y' })} options={[{ value: 'y', label: 'فعال' }, { value: 'n', label: 'موقوف' }]} /></Field>
              </FormGrid>
            )} />
        )
    }
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'maintenanceTypes', label: 'أنواع الصيانة', count: db.maintenanceTypes.length },
    { id: 'categories', label: 'فئات الأصول والسمات', count: db.categories.length },
    { id: 'failureCodes', label: 'أكواد الأعطال', count: db.failureCodes.length },
    { id: 'operations', label: 'العمليات القياسية', count: db.operations.length },
    { id: 'workshops', label: 'الورشة والرافعات', count: db.workshops.length },
    { id: 'expenseTypes', label: 'أنواع المصاريف', count: db.expenseTypes.length },
    { id: 'technicians', label: 'الفنيون', count: db.technicians.length },
  ]

  return (
    <div>
      <PageHeader crumbs={[{ label: 'البيانات الرئيسية' }]} title="البيانات الرئيسية" />
      <Card pad={false}>
        <Tabs<TabId> tabs={tabs} active={tab} onChange={(t) => setParams({ tab: t })} />
        {api.error ? <ErrorState message={api.error} onRetry={api.reload} /> : api.loading ? <LoadingSkeleton /> : body()}
      </Card>
    </div>
  )
}
