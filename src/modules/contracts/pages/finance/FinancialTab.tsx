import { FileText, Pencil, Plus, ReceiptText, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { KPICard } from '../../components/display'
import { DateInput } from '../../components/inputs'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { fmtDate, money, num } from '../../data/format'
import {
  billingBlocker, billingFor, billingLabel, createBilling, deleteItem, effItemStatus, financialSummary, guaranteeDays, itemsOf, nextItemNo, payKindLabel, payStatusLabel, payStatusTone,
  recordPayment, saveItem, scheduleCheck, toIQD, validateItem,
} from '../../data/payments'
import { addAudit, useStore } from '../../data/store'
import type { BillingDocType, BillingRecord, Contract, Guarantee, PaymentItem, PaymentKind } from '../../data/types'

const guaranteeType = { Performance: 'حسن تنفيذ', Advance: 'دفعة مقدمة', Retention: 'محتجز' } as const

export const PayStatus = ({ it }: { it: PaymentItem }) => { const s = effItemStatus(it); return <Badge tone={payStatusTone[s]}>{payStatusLabel[s]}</Badge> }

/** O6 + O4 + O7 — financial tab: summary cards, per-currency table, payment schedule with billing, guarantees and billing records. */
export function FinancialTab({ c }: { c: Contract }) {
  const { db } = useStore()
  const s = financialSummary(db, c)
  const cur = c.currency
  const na = s.unsettled > 0
  const rows: [string, number | null, string?][] = [
    ['قيمة العقد', s.contractValue], ['المخطط في الجدول', s.plannedValue], ['الملتزم به', s.committedValue], ['المحجوز', s.releasedValue, s.agreement ? undefined : 'غير منطبق'],
    ['المنفّذ', s.fulfilledValue, s.agreement ? undefined : 'غير منطبق'], ['المفوتر', s.invoicedValue], ['المدفوع', na ? null : s.paidValue, na ? `غير متاح (${s.unsettled} فاتورة بلا تسوية)` : undefined],
    ['المستحق للتحصيل', s.outstanding, 'غير متاح'], ['المتبقي من الالتزام', s.remaining], ['المحتجز (عرض)', s.retentionHeld], ['الغرامات المستحقة (عرض)', s.penaltiesAccrued],
  ]
  const fmt = (v: number | null, na?: string) => (v === null ? na ?? 'غير متاح' : na && na === 'غير منطبق' ? '—' : money(v, cur))
  const guarantees = db.guarantees.filter((g) => g.contractId === c.id)
  const bills = db.billingLog.filter((b) => b.contractId === c.id)
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Link className="btn" to={`/contracts/${c.id}/print?doc=obligations`}>طباعة كشف الالتزامات والدفعات</Link></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="قيمة العقد" value={money(s.contractValue, cur)} icon={Wallet} /><KPICard label="المفوتر" value={money(s.invoicedValue, cur)} tone="blue" />
        <KPICard label="المدفوع" value={na ? 'غير متاح' : money(s.paidValue, cur)} tone={na ? 'amber' : 'green'} hint={na ? `${s.unsettled} فاتورة تنتظر تسوية Finance` : undefined} />
        <KPICard label="المستحق للتحصيل" value={s.outstanding === null ? 'غير متاح' : money(s.outstanding, cur)} tone={s.outstanding ? 'amber' : 'gray'} />
      </div>
      <Card title="الملخص المالي" pad={false}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">البند</th><th className="text-start">بعملة العقد ({cur})</th>{cur !== 'IQD' && <th className="text-start">بالدينار (بسعر اليوم)</th>}</tr></thead>
          <tbody>
            {rows.map(([label, v, note]) => (
              <tr key={label} className="border-b border-gray-100"><td className="px-3 py-1.5">{label}</td>
                <td className={`tabular-nums ${v === null ? 'text-amber-700' : ''}`}>{fmt(v, v === null || note === 'غير منطبق' ? note : undefined)}</td>
                {cur !== 'IQD' && <td className="tabular-nums text-gray-500">{v === null || note === 'غير منطبق' ? '—' : money(toIQD(db, v, cur), 'IQD')}</td>}</tr>))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">المفوتر من دفتر التنفيذ للاتفاقيات ومن سجل الفوترة لغيرها؛ المدفوع من تسوية Finance (محاكاة). لا قيود محاسبية.</p>
      </Card>
      <ScheduleCard c={c} />
      <Card title="الضمانات" pad={false}>
        <DataTable rows={guarantees} compact emptyTitle="لا ضمانات" columns={[
          { key: 't', label: 'النوع', render: (g: Guarantee) => guaranteeType[g.type] }, { key: 'a', label: 'المبلغ', render: (g: Guarantee) => money(g.amount, g.currency) }, { key: 'i', label: 'الجهة المصدرة', render: (g: Guarantee) => g.issuer },
          { key: 'e', label: 'الانتهاء', render: (g: Guarantee) => { const d = guaranteeDays(g); return <span className={d <= 7 ? 'font-semibold text-red-600' : d <= 30 ? 'text-amber-600' : ''}>{fmtDate(g.expiryDate)} ({d} يوم)</span> } },
        ] as Column<Guarantee>[]} />
      </Card>
      <BillingLog rows={bills} title="سجل الفوترة لهذا العقد" />
    </div>
  )
}

function ScheduleCard({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState<PaymentItem | 'new' | null>(null)
  const [pay, setPay] = useState<PaymentItem | null>(null)
  const items = itemsOf(db, c.id)
  const chk = scheduleCheck(db, c, items)
  const canSchedule = can('Obligations.Manage')
  const canBill = can('Obligations.Manage') || can('Contracts.Export')
  const cols: Column<PaymentItem>[] = [
    { key: 'n', label: '#', render: (i) => i.itemNo }, { key: 'k', label: 'النوع', render: (i) => payKindLabel[i.kind] },
    { key: 'd', label: 'الاستحقاق', render: (i) => fmtDate(i.dueDate) }, { key: 'p', label: '%', num: true, render: (i) => (i.percent !== undefined ? `${i.percent}%` : '—') },
    { key: 'a', label: 'المبلغ', num: true, render: (i) => money(i.amount, i.currency) },
    { key: 'o', label: 'الارتباط', render: (i) => <span className="text-xs text-gray-500">{i.obligationId ? db.obligations.find((o) => o.id === i.obligationId)?.title : ''}{i.agreementLineNum ? ` · بند ${i.agreementLineNum}` : ''}</span> },
    { key: 'b', label: 'مستند الفوترة', render: (i) => (i.billingDocType ? billingLabel[i.billingDocType] : '—') },
    { key: 's', label: 'الحالة', render: (i) => <div><PayStatus it={i} />{i.status === 'Invoiced' && i.paidAmount === undefined && <div className="text-[10px] text-amber-700">التسوية غير متاحة</div>}{i.paidAmount !== undefined && i.paidAmount < i.amount && <div className="text-[10px] text-gray-500">مدفوع {num(i.paidAmount)}</div>}</div> },
    {
      key: 'x', label: '', render: (i) => (
        <div className="flex flex-wrap gap-1">
          {i.status === 'Planned' && canBill && <button type="button" className="btn btn-primary" disabled={!!billingBlocker(db, i)} title={billingBlocker(db, i)} onClick={() => run((d) => createBilling(d, i.id), 'أُنشئ مستند الفوترة (محاكاة)')}><ReceiptText className="h-3.5 w-3.5" />إنشاء فوترة</button>}
          {i.status === 'Invoiced' && canBill && <button type="button" className="btn" onClick={() => setPay(i)}>تسجيل دفعة</button>}
          {i.status === 'Planned' && canSchedule && <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" title="تعديل" onClick={() => setDlg(i)}><Pencil className="h-4 w-4" /></button>}
          {i.status === 'Planned' && canSchedule && <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="حذف" onClick={() => run((d) => { const e = deleteItem(d, i.id); if (!e) addAudit(d, 'contract', c.id, 'payment:delete', `دفعة ${i.itemNo}`); return e }, 'حُذف البند')}><Trash2 className="h-4 w-4" /></button>}
        </div>) },
  ]
  return (
    <Card title="جدول الدفعات" pad={false} actions={canSchedule && !['Cancelled', 'Closed'].includes(c.status) && <button type="button" className="btn btn-primary" onClick={() => setDlg('new')}><Plus className="h-4 w-4" />دفعة</button>}>
      <DataTable rows={items} columns={cols} emptyTitle="لا دفعات مجدولة" emptyHint="أضف دفعات مقدمة ومراحل ودورية ومحتجزاً؛ تستحق بتاريخها فتُنشأ فواتيرها تلقائياً بنقرة." />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs">
        <span>المجموع: <b>{money(chk.amount, c.currency)}</b> · النسب <b>{chk.percent.toFixed(1)}%</b> · قيمة العقد {money(c.contractValue ?? 0, c.currency)}</span>
        {chk.warnings.length ? <span className="text-red-600">{chk.warnings.join(' — ')}</span> : <span className="text-emerald-700">الجدول ضمن الحدود</span>}
      </div>
      {dlg && <ItemDialog c={c} it={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} />}
      {pay && <PayDialog it={pay} onClose={() => setPay(null)} />}
    </Card>
  )
}

/** O5 — payment item dialog. */
function ItemDialog({ c, it, onClose }: { c: Contract; it?: PaymentItem; onClose: () => void }) {
  const { db, run } = useStore()
  const [f, setF] = useState<PaymentItem>(it ?? { id: `pay-n${Date.now() % 100000}`, contractId: c.id, itemNo: nextItemNo(db, c.id), kind: 'Milestone', dueDate: '', amount: 0, currency: c.currency, status: 'Planned', billingDocType: billingFor(c)[0], notes: '' })
  const [err, setErr] = useState('')
  const set = <K extends keyof PaymentItem>(k: K, v: PaymentItem[K]) => setF((x) => ({ ...x, [k]: v }))
  const warn = validateItem(db, c, f).filter((e) => e.endsWith('راجع الجدول'))
  const save = () => {
    let failure = ''
    const ok = run((d) => { const e = saveItem(d, f); if (e) failure = e; return e }, it ? 'حُدّث البند' : 'أُضيف البند')
    if (!ok) return setErr(failure)
    onClose()
  }
  return (
    <Modal title={it ? `تعديل الدفعة ${it.itemNo}` : 'دفعة جديدة'} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>حفظ</button></>}>
      <div className="space-y-3">
        <FormGrid>
          <Field label="النوع"><Select value={f.kind} onChange={(v: PaymentKind) => set('kind', v)} options={(Object.keys(payKindLabel) as PaymentKind[]).map((k) => ({ value: k, label: payKindLabel[k] }))} /></Field>
          <Field label="تاريخ الاستحقاق" required><DateInput value={f.dueDate} onChange={(v) => set('dueDate', v)} /></Field>
          <Field label={`المبلغ (${c.currency})`} required><NumInput value={f.amount} onChange={(n) => setF((x) => ({ ...x, amount: n, percent: c.contractValue ? Math.round((n / c.contractValue) * 1000) / 10 : x.percent }))} /></Field>
          <Field label="النسبة %"><NumInput value={f.percent ?? 0} onChange={(n) => setF((x) => ({ ...x, percent: n || undefined, amount: c.contractValue && n ? Math.round((c.contractValue * n) / 100) : x.amount }))} /></Field>
          <Field label="مستند الفوترة"><Select value={f.billingDocType ?? ''} onChange={(v: BillingDocType) => set('billingDocType', v)} options={(['SaleInvoice', 'SaleOrder', 'SalesTemplate', 'PurchaseBill', 'PurchaseOrder', 'PurchaseTemplate'] as BillingDocType[]).filter((t) => billingFor(c).includes(t)).map((t) => ({ value: t, label: billingLabel[t] }))} /></Field>
          <Field label="التزام مرتبط" span={2}><Select value={f.obligationId ?? ''} placeholder="— بلا —" onChange={(v) => set('obligationId', v || undefined)} options={db.obligations.filter((o) => o.contractId === c.id).map((o) => ({ value: o.id, label: o.title }))} /></Field>
          {c.profile === 'Agreement' && <Field label="بند الاتفاقية (للقيد في الدفتر)"><Select value={String(f.agreementLineNum ?? '')} placeholder="— بلا —" onChange={(v) => set('agreementLineNum', v ? Number(v) : undefined)} options={db.lines.filter((l) => l.contractId === c.id).map((l) => ({ value: String(l.lineNum), label: `${l.lineNum}. ${l.description}` }))} /></Field>}
          <Field label="ملاحظات" span={5}><input className="inp" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </FormGrid>
        {warn.map((w) => <div key={w} className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{w.replace(' — راجع الجدول', '')}</div>)}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

function PayDialog({ it, onClose }: { it: PaymentItem; onClose: () => void }) {
  const { run } = useStore()
  const [amt, setAmt] = useState(it.paidAmount ?? it.amount)
  const [err, setErr] = useState('')
  return (
    <Modal title={`تسجيل دفعة — الدفعة ${it.itemNo}`} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
      <button type="button" className="btn btn-primary" onClick={() => { let fl = ''; if (!run((d) => { const e = recordPayment(d, it.id, amt); if (e) fl = e; return e }, 'سُجّلت التسوية (محاكاة Finance)')) return setErr(fl); onClose() }}>حفظ</button></>}>
      <div className="space-y-3 text-sm"><p className="text-gray-600">محاكاة وصول التسوية من وحدة Finance: المبلغ المدفوع من فاتورة هذا البند ({money(it.amount, it.currency)}).</p>
        <Field label="المبلغ المدفوع"><NumInput value={amt} onChange={setAmt} /></Field>{err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}</div>
    </Modal>
  )
}

/** O7 — documents created from schedule items. */
export function BillingLog({ rows, title = 'سجل الفوترة' }: { rows: BillingRecord[]; title?: string }) {
  const { db } = useStore()
  const cols: Column<BillingRecord>[] = [
    { key: 'r', label: 'المستند', render: (b) => <div><span className="font-medium" dir="ltr">{b.ref}</span><div className="text-[11px] text-gray-400">{billingLabel[b.docType]}{b.template ? ' (سجل قالب)' : ''}</div></div> },
    { key: 'c', label: 'العقد', render: (b) => <span dir="ltr" className="text-xs">{db.contracts.find((c) => c.id === b.contractId)?.number}</span> },
    { key: 'd', label: 'التاريخ', render: (b) => fmtDate(b.date) }, { key: 'a', label: 'المبلغ', num: true, render: (b) => money(b.amount, b.currency) },
    { key: 'i', label: 'الدفعة', render: (b) => `#${db.paymentItems.find((p) => p.id === b.paymentItemId)?.itemNo ?? ''}` },
    { key: 'n', label: 'ملاحظة', render: (b) => <span className="flex items-center gap-1 text-xs text-gray-500">{b.ledgerDocId && <FileText className="h-3.5 w-3.5 text-navy" />}{b.note}</span> },
  ]
  return <Card title={title} pad={false}><DataTable rows={rows} columns={cols} compact emptyTitle="لا مستندات فوترة" emptyHint="تُنشأ من جدول الدفعات عند استحقاق البند." /></Card>
}
