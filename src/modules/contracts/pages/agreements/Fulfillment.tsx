import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { BalanceBar } from '../../components/display'
import { Badge, Card, Select } from '../../components/ui'
import { fmtDate, money, num } from '../../data/format'
import {
  agreementCfg, balanceOf, basisCounter, counterLabel, counterUnits, docMeta, hasDrift, isReturn, ledgerSums, recalculate, remaining, signsOf,
} from '../../data/fulfillment'
import { addAudit, useStore } from '../../data/store'
import type { Contract, ContractLine, LedgerEntry, MockDoc } from '../../data/types'
import { DocStateBadge, fmtUnits, lineTarget, qty, ReasonBadge, signed } from './shared'

const modeLabel = { None: 'تتبع فقط', Warn: 'تحذير', Block: 'منع' } as const
const basisLabel = { Order: 'الأمر', Delivery: 'التسليم/الاستلام', Invoice: 'الفاتورة' } as const

/** A3 — fulfillment tab: per-line summary, ledger drill-down, recalculate and drift indicator. */
export function FulfillmentTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [sel, setSel] = useState('all')
  const lines = db.lines.filter((l) => l.contractId === c.id)
  const cfg = agreementCfg(db, c)
  const drift = lines.filter((l) => hasDrift(db, l.id))
  const entries = db.ledger.filter((e) => e.contractId === c.id && (sel === 'all' || e.lineId === sel))
    .sort((a, b) => b.sourceDocDate.localeCompare(a.sourceDocDate) || b.id.localeCompare(a.id, undefined, { numeric: true }))

  const sumCols: Column<ContractLine>[] = [
    { key: 'n', label: '#', render: (l) => l.lineNum },
    { key: 't', label: 'البند', render: (l) => <div className="max-w-[220px] truncate font-medium">{lineTarget(db, l)}</div> },
    { key: 'c', label: 'الملتزم', num: true, render: (l) => fmtUnits(db, c, l, l.commitmentType === 'Quantity' ? l.agreedQuantity ?? 0 : l.agreedValue ?? 0) },
    ...(['Release', 'Fulfill', 'Invoice'] as const).map((k) => ({
      key: k, label: counterLabel[k], num: true, render: (l: ContractLine) => <span className={basisCounter[cfg.basis] === k ? 'font-semibold text-navy' : ''}>{fmtUnits(db, c, l, counterUnits(l, balanceOf(db, l.id), k))}</span>,
    })),
    { key: 'r', label: `المتبقي (${basisLabel[cfg.basis]})`, num: true, render: (l) => { const r = remaining(db, c, l); return <span className={r.left < 0 ? 'font-semibold text-red-600' : ''}>{fmtUnits(db, c, l, r.left)}</span> } },
    { key: 'p', label: '%', num: true, render: (l) => `${num(remaining(db, c, l).pct, 1)}%` },
    { key: 'bar', label: '', render: (l) => { const b = balanceOf(db, l.id); const u = (k: 'Release' | 'Fulfill' | 'Invoice') => counterUnits(l, b, k); return <BalanceBar committed={l.commitmentType === 'Quantity' ? l.agreedQuantity ?? 0 : l.agreedValue ?? 0} released={u('Release')} fulfilled={u('Fulfill')} invoiced={u('Invoice')} format={(n) => num(n)} /> } },
    { key: 'd', label: 'تطابق', render: (l) => (hasDrift(db, l.id) ? <Badge tone="red">انحراف</Badge> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />) },
  ]
  const ledgerCols: Column<LedgerEntry>[] = [
    { key: 'date', label: 'تاريخ المستند', render: (e) => fmtDate(e.sourceDocDate) },
    { key: 'doc', label: 'المستند', render: (e) => <div><span className="font-medium" dir="ltr">{e.sourceDocRef}</span><div className="text-[11px] text-gray-400">{docMeta[e.sourceDocType].label}</div></div> },
    { key: 'line', label: 'البند', render: (e) => e.lineNum },
    { key: 'type', label: 'العدّاد', render: (e) => counterLabel[e.entryType] },
    { key: 'q', label: 'الكمية', num: true, render: (e) => <span className={e.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-700'}>{signed(e.quantityDelta)}</span> },
    { key: 'v', label: `القيمة (${c.currency})`, num: true, render: (e) => <span className={e.valueDelta < 0 ? 'text-red-600' : ''}>{signed(e.valueDelta, c.currency === 'USD' ? 2 : 0)}</span> },
    { key: 'dv', label: 'قيمة المستند', num: true, render: (e) => (e.docCurrency === c.currency ? <span className="text-gray-300">—</span> : <span dir="ltr">{signed(e.docValueDelta, e.docCurrency === 'USD' ? 2 : 0)} {e.docCurrency}</span>) },
    { key: 'rate', label: 'سعر التحويل', num: true, render: (e) => (e.rateUsed === 1 ? <span className="text-gray-300">—</span> : num(e.rateUsed, 2)) },
    { key: 'rev', label: 'النسخة / التسلسل', render: (e) => <span className="text-[11px] text-gray-500">r{e.sourceRevision} · #{e.sequence}</span> },
    { key: 'why', label: 'السبب', render: (e) => <ReasonBadge reason={e.reason} /> },
  ]
  const recalc = () => run((d) => {
    const n = recalculate(d, c.id)
    addAudit(d, 'contract', c.id, 'fulfillment:recalculate', `${n} قيد`)
  }, 'أُعيد احتساب التنفيذ من المستندات والدفتر')
  const corrupt = () => run((d) => {
    const l = d.lines.find((x) => x.contractId === c.id && x.status === 'Open')
    if (l) d.balances[l.id] = { ...(d.balances[l.id] ?? ledgerSums(d, l.id)), fulQ: (d.balances[l.id]?.fulQ ?? 0) + 7 }
  }, 'أُحدث انحراف تجريبي في رصيد أول بند')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <span>الإنفاذ: <b>{modeLabel[cfg.mode]}</b></span><span>·</span><span>الأساس: <b>{basisLabel[cfg.basis]}</b></span><span>·</span>
        <span>المرتجع يعيد الالتزام: <b>{cfg.restore ? 'نعم' : 'لا'}</b></span><span>·</span>
        <span>عند الفشل: <b>{cfg.onFail === 'Rollback' ? 'إلغاء المستند' : 'حفظ مع تنبيه'}</b></span><span>·</span>
        <span>سعر التحويل: <b>{cfg.rateSource === 'ActivationRate' ? 'سعر التفعيل' : 'سعر تاريخ المستند'}</b></span>
        <Link to={`/contracts/${c.id}/print?doc=fulfillment`} className="ms-auto text-navy underline">طباعة كشف التنفيذ</Link><Link to="/agreements/simulator" className="text-navy underline">محاكي المستندات</Link>
      </div>
      <Card title="ملخص التنفيذ لكل بند" pad={false} actions={
        <div className="flex items-center gap-2">
          {drift.length === 0 ? <Badge tone="green">الأرصدة = الدفتر</Badge> : <Badge tone="red"><AlertTriangle className="h-3 w-3" />{drift.length} بند منحرف</Badge>}
          {can('Fulfillment.Recalculate') && <button type="button" className="btn" onClick={recalc}><RefreshCw className="h-4 w-4" />إعادة الاحتساب</button>}
          {can('Settings.Manage') && <button type="button" className="btn" title="للعرض فقط: يُفسد رصيد أول بند ليظهر مؤشر الانحراف" onClick={corrupt}>محاكاة انحراف</button>}
        </div>}>
        <DataTable rows={lines} columns={sumCols} onRowClick={(l) => setSel(l.id)} emptyTitle="لا بنود" />
      </Card>
      <Card title={`دفتر التنفيذ (${entries.length} قيد)`} pad={false} actions={
        <div className="w-64"><Select value={sel} onChange={setSel} options={[{ value: 'all', label: 'كل البنود' }, ...lines.map((l) => ({ value: l.id, label: `${l.lineNum}. ${lineTarget(db, l)}` }))]} /></div>}>
        <DataTable rows={entries} columns={ledgerCols} compact emptyTitle="لا قيود" emptyHint="تظهر القيود عند ترحيل مستندات المبيعات/المشتريات — جرّب محاكي المستندات." />
        <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">الدفتر لا يُعدَّل: كل تغيير في مستند (تعديل، إلغاء، مرتجع) يضيف قيد فرق بنسخة وتسلسل أعلى؛ القيود ذات النسخة الأقدم تُتجاهل. مجموع القيود لكل بند = الرصيد.</p>
      </Card>
    </div>
  )
}

/** A4 — mock Sales / Procurement / Inventory documents linked to the agreement, with their current contribution. */
export function AgreementDocs({ c }: { c: Contract }) {
  const { db } = useStore()
  const docs = db.mockDocs.filter((d) => d.agreementId === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref))
  const contrib = (d: MockDoc) => {
    const s = signsOf(db, c, d)
    const parts = (['Release', 'Fulfill', 'Invoice'] as const).filter((k) => s[k]).map((k) => `${k === 'Release' ? 'حجز' : k === 'Fulfill' ? 'تنفيذ' : 'فوترة'} ${s[k]! > 0 ? '+' : '−'}`)
    return parts.length ? parts.join(' · ') : <span className="text-gray-300">لا مساهمة</span>
  }
  const cols: Column<MockDoc>[] = [
    { key: 'ref', label: 'المستند', render: (d) => <div><span className="font-medium text-navy" dir="ltr">{d.ref}</span><div className="text-[11px] text-gray-400">{docMeta[d.docType].label} · {docMeta[d.docType].module}</div></div> },
    { key: 'date', label: 'التاريخ', render: (d) => fmtDate(d.date) },
    { key: 'items', label: 'الأصناف', render: (d) => <div className="max-w-[240px] text-xs">{d.lines.map((l) => <div key={l.id}>{db.items.find((i) => i.id === l.itemId)?.name} × {qty(l.qty)} <span className="text-gray-400">(بند {l.agreementLineNum ?? '—'})</span></div>)}</div> },
    { key: 'val', label: 'القيمة', num: true, render: (d) => <span dir="ltr">{money(d.lines.reduce((s, l) => s + l.netValueDoc, 0), d.currency)}</span> },
    { key: 'cur', label: 'العملة / السعر', render: (d) => (d.currency === c.currency ? d.currency : <span className="text-amber-700">{d.currency} @ {num(d.rate)}</span>) },
    { key: 'contrib', label: 'المساهمة', render: (d) => <span className="text-xs">{contrib(d)}{isReturn(d.docType) && ' (مرتجع)'}</span> },
    { key: 'base', label: 'أساسه', render: (d) => <span className="text-xs text-gray-500" dir="ltr">{db.mockDocs.find((x) => x.id === d.baseDocId)?.ref ?? '—'}</span> },
    { key: 'rev', label: 'نسخة', render: (d) => `r${d.revision}` },
    { key: 'st', label: 'الحالة', render: (d) => <DocStateBadge state={d.state} /> },
  ]
  return (
    <Card title={`مستندات التنفيذ (${docs.length})`} pad={false} actions={<Link to="/agreements/simulator" className="btn">محاكي المستندات</Link>}>
      <DataTable rows={docs} columns={cols} compact emptyTitle="لا مستندات منفِّذة" emptyHint="أنشئ أمر بيع/شراء أو تسليماً أو فاتورة من محاكي المستندات لتظهر هنا." />
    </Card>
  )
}
