import { Save } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/Layout'
import { AssetSelect, PartnerSelect, TechnicianSelect } from '../../components/inputs'
import { EmptyBlock } from '../../components/states'
import { Badge, Card, Field, FormGrid, NumInput, ReadOnly, Select } from '../../components/ui'
import { canConvert, isInternal, totals } from '../../data/estimate'
import { coverageLabel, iqd, lineKindLabel, num, uid } from '../../data/format'
import { useStore } from '../../data/store'
import { createDirect, createFromEstimate } from '../../data/workorder'
import { Link, useNavigate, useSearchParams } from '../../router'

/** New work order (S13): from an approved + accepted estimate, or a direct internal job on a company asset. */
export default function WorkOrderForm() {
  const [params] = useSearchParams()
  const estimateId = params.get('estimate')
  return estimateId ? <FromEstimate estimateId={estimateId} /> : <Direct />
}

function Planning({ tech, setTech, start, setStart, end, setEnd }: { tech: string; setTech: (v: string) => void; start: string; setStart: (v: string) => void; end: string; setEnd: (v: string) => void }) {
  return (
    <Card title="التخطيط (اختياري الآن — يمكن لاحقًا من البطاقة)">
      <FormGrid>
        <Field label="الفني المسؤول"><TechnicianSelect value={tech} onChange={setTech} /></Field>
        <Field label="بداية مخططة"><input type="datetime-local" className="inp" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="نهاية مخططة"><input type="datetime-local" className="inp" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </FormGrid>
      <p className="mt-2 text-[11px] text-gray-500">تعيين الفني يحوّل الأمر إلى «مخطط». الحجز على لوحة الجدولة يحوّله إلى «مجدول».</p>
    </Card>
  )
}

function FromEstimate({ estimateId }: { estimateId: string }) {
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const e = db.estimates.find((x) => x.id === estimateId)
  const asset = db.assets.find((a) => a.id === e?.assetId)
  const [billing, setBilling] = useState(asset?.ownerPartnerId ?? '')
  const [deposit, setDeposit] = useState(0)
  const [tech, setTech] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  if (!e || !asset) return <EmptyBlock title="التقدير غير موجود" action={<Link to="/estimates" className="btn">العودة</Link>} />
  const internal = isInternal(db, e)
  const t = totals(db, e)
  const req = db.requests.find((r) => r.id === e.requestId)
  const rework = !!req?.reworkOfWorkOrderId
  const ready = canConvert(db, e)
  const save = () => {
    const id = uid('wo')
    if (run((d) => createFromEstimate(d, e.id, id, { billingPartnerId: billing, leadTechnicianId: tech || undefined, plannedStart: start || undefined, plannedEnd: end || undefined, depositRequired: deposit || undefined }), 'تم إنشاء أمر العمل وإغلاق الطلب')) nav(`/work-orders/${id}`)
  }

  return (
    <div>
      <PageHeader crumbs={[{ label: 'أوامر العمل', to: '/work-orders' }, { label: 'جديد من تقدير' }]} title="أمر عمل جديد من التقدير"
        actions={<button type="button" className="btn btn-primary" disabled={!ready || !can('WorkOrders.Create')} onClick={save}><Save className="h-4 w-4" />إنشاء أمر العمل</button>} />
      {!ready && <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">لا يمكن التحويل: التقدير يجب أن يكون معتمدًا{internal ? '' : ' وموافقًا عليه من العميل'} وبلا أمر عمل سابق.</div>}
      {rework && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">إعادة عمل لأمر سابق — كل الأسطر تُنقل بتغطية «حسن نية» ونوع مصروف حسن النية، ولا يُفوتر الأمر (BR-M-20).</div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="المصدر">
            <FormGrid>
              <Field label="التقدير"><ReadOnly ltr>{e.number} v{e.version}</ReadOnly></Field>
              <Field label="الطلب"><ReadOnly ltr>{req?.number}</ReadOnly></Field>
              <Field label="الأصل" span={2}><ReadOnly>{asset.name}</ReadOnly></Field>
              <Field label="المالك"><ReadOnly>{db.partners.find((p) => p.id === asset.ownerPartnerId)?.name}</ReadOnly></Field>
              <Field label="الجهة المُفوتَرة" hint={can('WorkOrders.ChangeBillingPartner') ? 'افتراضيًا المالك؛ تتغير بصلاحية (مثل: مستأجر يدفع بدل شركة التأجير)' : 'تتطلب صلاحية تغيير الجهة المُفوتَرة'}>
                {internal ? <ReadOnly>استهلاك داخلي</ReadOnly> : <PartnerSelect kind="customer" value={billing} onChange={setBilling} disabled={!can('WorkOrders.ChangeBillingPartner')} />}
              </Field>
              {!internal && <Field label="عربون مطلوب قبل البدء (اختياري)" hint={`الافتراضي في الإعدادات ${db.settings.depositDefaultPercent}% = ${iqd(Math.round(t.billable * db.settings.depositDefaultPercent / 100))}`}><NumInput value={deposit} onChange={setDeposit} /></Field>}
            </FormGrid>
          </Card>
          <Planning {...{ tech, setTech, start, setStart, end, setEnd }} />
        </div>
        <Card title="ما سيُنقل إلى أمر العمل">
          <ul className="space-y-1.5 text-sm">
            {e.lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span><Badge tone="gray">{lineKindLabel[l.kind]}</Badge> {db.items.find((i) => i.id === l.itemId)?.name} × {num(l.qty, l.qty % 1 ? 1 : 0)}</span>
                <Badge tone={rework || l.coverage === 'goodwill' ? 'amber' : l.coverage === 'warranty' ? 'blue' : 'gray'}>{coverageLabel[rework ? 'goodwill' : l.coverage]}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-2 text-xs text-gray-600">القطع ← أسطر قطع مخططة (تُحجز عند البدء). العمالة ← عمليات وأسطر خدمة. الخدمات ← أسطر خدمة للفوترة.</div>
          <div className="mt-2 flex justify-between text-sm font-bold text-navy"><span>على العميل (تقديري)</span><span className="tabular-nums">{iqd(rework ? 0 : t.billable)}</span></div>
        </Card>
      </div>
    </div>
  )
}

function Direct() {
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [assetId, setAssetId] = useState('')
  const [mt, setMt] = useState('mt-int')
  const [et, setEt] = useState('et-mach')
  const [desc, setDesc] = useState('')
  const [tech, setTech] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const internalTypes = db.maintenanceTypes.filter((m) => m.kind === 'internal' && m.active)
  const asset = db.assets.find((a) => a.id === assetId)
  const save = () => {
    const id = uid('wo')
    if (run((d) => createDirect(d, { assetId, maintenanceTypeId: mt, expenseTypeId: et, description: desc, leadTechnicianId: tech || undefined, plannedStart: start || undefined, plannedEnd: end || undefined }, id), 'تم إنشاء أمر العمل الداخلي')) nav(`/work-orders/${id}`)
  }
  return (
    <div>
      <PageHeader crumbs={[{ label: 'أوامر العمل', to: '/work-orders' }, { label: 'أمر عمل داخلي' }]} title="أمر عمل داخلي مباشر"
        actions={<button type="button" className="btn btn-primary" disabled={!can('WorkOrders.Create')} onClick={save}><Save className="h-4 w-4" />إنشاء</button>} />
      <p className="mb-3 text-sm text-gray-600">لأصول الشركة فقط ومن دون تقدير. أصول العملاء تمر بالطلب ثم التقدير ثم أمر العمل. التكلفة تُحمَّل على نوع المصروف المختار (القرار 1c).</p>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="العمل">
            <FormGrid>
              <Field label="أصل الشركة" required span={2}><AssetSelect partnerId={db.settings.internalPartnerId} value={assetId} onChange={setAssetId} /></Field>
              <Field label="نوع الصيانة" required><Select value={mt} onChange={(v) => { setMt(v); setEt(db.maintenanceTypes.find((m) => m.id === v)?.defaultExpenseTypeId ?? '') }} options={internalTypes.map((m) => ({ value: m.id, label: m.name }))} /></Field>
              <Field label="نوع المصروف" required hint={db.expenseTypes.find((x) => x.id === et) ? `الحساب ${db.expenseTypes.find((x) => x.id === et)!.accountCode} — ${db.expenseTypes.find((x) => x.id === et)!.accountName}` : undefined}>
                <Select value={et} onChange={setEt} placeholder="اختر" options={db.expenseTypes.filter((x) => x.scope === 'internal').map((x) => ({ value: x.id, label: x.name }))} />
              </Field>
              <Field label="وصف العمل" required span={3}><textarea className="inp min-h-[70px] py-2" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: فحص دوري وتبديل خرطوم هيدروليك ذراع الرفع" /></Field>
            </FormGrid>
            {asset && <div className="mt-2 text-xs text-gray-500">{asset.location}{asset.costCenter ? ` · مركز الكلفة ${asset.costCenter}` : ''}{asset.fixedAssetRef ? ` · أصل ثابت ${asset.fixedAssetRef}` : ''}</div>}
          </Card>
          <Planning {...{ tech, setTech, start, setStart, end, setEnd }} />
        </div>
        <Card title="ملاحظة">
          <p className="text-sm text-gray-600">تُضاف القطع والعمليات من بطاقة أمر العمل. صرف القطع يُرحَّل تلقائيًا عند الإكمال على حساب نوع المصروف، ولا يُفوتر الأمر.</p>
        </Card>
      </div>
    </div>
  )
}
