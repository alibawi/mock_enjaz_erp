import { CheckCircle2, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DateInput, ItemSelect, OrganizationSelect, PartnerSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Badge, Card, Field, Select } from '../../components/ui'
import { today } from '../../data/asof'
import { fmtDate, money, num } from '../../data/format'
import { lineMatchesItem, resolveLine } from '../../data/fulfillment'
import { useStore } from '../../data/store'
import type { CurrencyCode } from '../../data/types'
import { fmtUnits, lineTarget } from './shared'

/** A7 — resolution test: which agreement line a Sales/Procurement document would pick (BR-A-09). */
export default function Resolve() {
  const { db } = useStore()
  const [partnerId, setPartner] = useState('p-c1')
  const [itemId, setItem] = useState('it-1')
  const [date, setDate] = useState(today())
  const [currency, setCurrency] = useState<CurrencyCode>('IQD')
  const [orgId, setOrg] = useState('')
  const ready = !!partnerId && !!itemId
  const found = ready ? resolveLine(db, { partnerId, itemId, date, currency, organizationId: orgId || undefined }) : []
  const chosen = found.find((x) => x.chosen)

  // why other agreements of the same partner were skipped
  const skipped = ready ? db.contracts.filter((c) => c.profile === 'Agreement' && c.counterpartyId === partnerId && !found.some((f) => f.contract.id === c.id)).map((c) => {
    const lines = db.lines.filter((l) => l.contractId === c.id)
    const reason = c.status !== 'Active' ? `الحالة ${c.status === 'OnHold' ? 'معلّقة' : c.status === 'Expired' ? 'منتهية' : c.status === 'Draft' ? 'مسودة' : c.status}`
      : orgId && c.organizationId !== orgId ? 'منشأة مختلفة'
      : date < c.startDate || (c.endDate && date > c.endDate) ? 'التاريخ خارج فترة الاتفاقية'
      : !lines.some((l) => lineMatchesItem(db, l, itemId)) ? 'لا بند يغطي الصنف'
      : 'التاريخ خارج صلاحية البند أو البند مغلق'
    return { c, reason }
  }) : []

  return (
    <div>
      <PageHeader crumbs={[{ label: 'الاتفاقيات', to: '/agreements' }, { label: 'اختبار المطابقة' }]} title="اختبار مطابقة الاتفاقية" />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
        عند إنشاء أمر بيع/شراء يبحث النظام عن بند اتفاقية فعّال لنفس الطرف والمنشأة والتاريخ والصنف (أو تصنيفه مع الفرعي). عند التعدد يُختار الأبكر انتهاءً ثم الأقل رقماً. الاتفاقيات العامة (مكافأة) تتبع الإجماليات ولا تغيّر السعر.
      </div>
      <Card title="مدخلات المستند">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="الطرف (عميل/مورد)"><PartnerSelect value={partnerId} onChange={setPartner} /></Field>
          <Field label="الصنف"><ItemSelect value={itemId} onChange={setItem} /></Field>
          <Field label="تاريخ المستند"><DateInput value={date} onChange={setDate} /></Field>
          <Field label="عملة المستند"><Select value={currency} onChange={setCurrency} options={db.currencies.map((x) => ({ value: x.code, label: x.code }))} /></Field>
          <Field label="المنشأة (اختياري)"><OrganizationSelect value={orgId} onChange={setOrg} /></Field>
        </div>
      </Card>

      <div className="mt-4 space-y-4">
        {!ready ? <Card><div className="py-6 text-center text-sm text-gray-400">اختر الطرف والصنف.</div></Card>
          : found.length === 0 ? (
            <Card title="النتيجة"><div className="flex items-center gap-2 py-4 text-sm text-gray-600"><Search className="h-4 w-4 text-gray-400" />لا توجد اتفاقية فعّالة تغطي هذا الطرف والصنف في هذا التاريخ — يُنشأ المستند بسعر القائمة دون ربط.</div></Card>
          ) : (
            <Card title={`النتيجة — ${found.length} بند مرشّح`} pad={false}>
              <div className="divide-y divide-line">
                {found.map((f) => (
                  <div key={f.line.id} className={`grid gap-3 p-4 md:grid-cols-4 ${f.chosen ? 'bg-emerald-50/50' : ''}`}>
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2">
                        {f.chosen && <Badge tone="green"><CheckCircle2 className="h-3 w-3" />المختار</Badge>}
                        <Link to={`/contracts/${f.contract.id}`} className="font-medium text-navy" dir="ltr">{f.contract.number}</Link>
                      </div>
                      <div className="mt-0.5 text-sm">{f.contract.title}</div>
                      <div className="mt-1 text-xs text-gray-500">البند {f.line.lineNum}: {lineTarget(db, f.line)} · ينتهي {fmtDate(f.contract.endDate)}{f.contract.agreementMode === 'General' && ' · اتفاقية عامة (مكافأة)'}</div>
                    </div>
                    <div className="text-sm">
                      <div className="text-xs text-gray-500">السعر</div>
                      {f.price !== undefined ? <div className="font-semibold tabular-nums">{money(f.price, currency)}</div> : <div className="text-gray-400">—</div>}
                      <div className="text-[11px] text-gray-500">{f.priceNote}</div>
                    </div>
                    <div className="text-sm">
                      <div className="text-xs text-gray-500">المتبقي حسب الأساس</div>
                      <div className={`font-semibold tabular-nums ${f.left <= 0 ? 'text-red-600' : ''}`}>{fmtUnits(db, f.contract, f.line, f.left)}</div>
                      <div className="text-[11px] text-gray-500">استُهلك {num(f.pct, 1)}%</div>
                      {f.warnings.map((w) => <div key={w} className="text-[11px] text-amber-700">⚠ {w}</div>)}
                    </div>
                  </div>
                ))}
              </div>
              {chosen && chosen.contract.agreementMode !== 'General' && <p className="border-t border-line px-4 py-2 text-xs text-gray-500">سيحمل المستند رقم الاتفاقية والبند {chosen.line.lineNum}، وتُطبَّق شروطها (سعر ثابت: {chosen.priceFixed ? 'نعم' : 'لا'}).</p>}
            </Card>
          )}
        {skipped.length > 0 && (
          <Card title="اتفاقيات أخرى لنفس الطرف لم تُطابق">
            <ul className="space-y-1 text-sm">{skipped.map((s) => <li key={s.c.id} className="flex justify-between gap-2"><Link to={`/contracts/${s.c.id}`} className="text-navy" dir="ltr">{s.c.number}</Link><span className="truncate text-gray-500">{s.c.title}</span><span className="shrink-0 text-xs text-amber-700">{s.reason}</span></li>)}</ul>
          </Card>
        )}
      </div>
    </div>
  )
}
