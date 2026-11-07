import { FileText } from 'lucide-react'
import { useState } from 'react'
import { FilterSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { Badge, Tabs } from '../../components/ui'
import { balance, billableLines, canInvoice, depositsOf, generateInvoice, unapplied } from '../../data/billing'
import { billingStatus, fmtDate, fmtDateTime, iqd, num, uid } from '../../data/format'
import { useStore } from '../../data/store'
import type { Receipt, ServiceInvoice, WorkOrder } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { Link, useNavigate, useSearchParams } from '../../router'
import { PayBadge, ReceiptDialog } from './shared'

type TabId = 'ready' | 'invoices' | 'receipts'

/** Billing (S17): work orders ready to invoice, invoices (payment status O/P/C), receipts with their unapplied balance. */
export default function BillingHome() {
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'ready'
  const [pay, setPay] = useState('')
  const [rcpt, setRcpt] = useState<Receipt | null>(null)
  const api = useApi(() => ({ invoices: db.invoices, receipts: db.receipts }), [])
  const partner = (id: string) => db.partners.find((p) => p.id === id)?.name ?? '—'
  const wo = (id?: string) => db.workOrders.find((w) => w.id === id)
  const ready = db.workOrders.filter((w) => ['completed', 'closed'].includes(w.status) && ['notInvoiced', 'invoiceCancelled'].includes(w.billingStatus))
  const live = db.invoices.filter((i) => !i.canceled)
  const month = db.asOf.slice(0, 7)
  const tabs = (
    <Tabs<TabId> active={tab} onChange={(t) => setParams({ tab: t })} tabs={[
      { id: 'ready', label: 'جاهزة للفوترة', count: ready.length },
      { id: 'invoices', label: 'الفواتير', count: db.invoices.length },
      { id: 'receipts', label: 'سندات القبض والعربون', count: db.receipts.length },
    ]} />
  )
  const kpis = [
    { label: 'ذمم مفتوحة', value: iqd(live.reduce((s, i) => s + balance(i), 0)) },
    { label: 'عربون غير مُسوّى', value: iqd(db.receipts.filter((r) => r.onAccount).reduce((s, r) => s + unapplied(r), 0)) },
    { label: 'جاهزة للفوترة', value: num(ready.length) },
    { label: `إيراد ${month}`, value: iqd(live.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.total, 0)) },
  ]
  const common = { loading: api.loading, error: api.error, onRetry: api.reload, canNew: false, kpis, tabs, crumbs: [{ label: 'الفوترة والعربون' }] }

  if (tab === 'ready') {
    return (
      <ListView<WorkOrder> {...common} title="الفوترة والعربون" rows={ready} rowTo={(w) => `/work-orders/${w.id}`}
        searchText={(w) => `${w.number} ${partner(w.billingPartnerId)}`}
        emptyTitle="لا توجد أوامر عمل جاهزة للفوترة" emptyHint="تظهر هنا أوامر العمل المكتملة غير المفوترة أو التي أُلغيت فاتورتها."
        columns={[
          { key: 'no', label: 'أمر العمل', render: (w) => <span className="font-mono text-[12px]" dir="ltr">{w.number}</span> },
          { key: 'p', label: 'الجهة المُفوتَرة', render: (w) => partner(w.billingPartnerId) },
          { key: 'a', label: 'الأصل', render: (w) => db.assets.find((a) => a.id === w.assetId)?.name },
          { key: 'e', label: 'اكتمل', render: (w) => fmtDate(w.actualEnd) },
          { key: 'v', label: 'قيمة الفاتورة', num: true, render: (w) => iqd(billableLines(db, w).reduce((s, l) => s + l.qty * l.price, 0)) },
          { key: 'dp', label: 'عربون', num: true, render: (w) => { const v = depositsOf(db, w.id).reduce((s, r) => s + unapplied(r), 0); return v ? iqd(v) : '—' } },
          { key: 'b', label: 'الفوترة', render: (w) => <Badge tone={billingStatus[w.billingStatus].tone}>{billingStatus[w.billingStatus].label}{w.billingBatch ? ` (دفعة ${w.billingBatch})` : ''}</Badge> },
          {
            key: 'x', label: '', render: (w) => {
              const err = canInvoice(db, w)
              return can('Billing.Generate') ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn h-7 px-2" title={err ?? ''} disabled={!!err} onClick={() => { const id = uid('inv'); if (run((d) => generateInvoice(d, w.id, id), 'صدرت الفاتورة')) nav(`/billing/invoices/${id}`) }}><FileText className="h-4 w-4" />إصدار فاتورة</button>
                  {err && <span className="block text-[11px] text-red-600">{err}</span>}
                </span>
              ) : null
            },
          },
        ]} />
    )
  }

  if (tab === 'invoices') {
    const rows = db.invoices.filter((i) => (pay === 'X' ? i.canceled : !pay || (!i.canceled && i.paymentStatus === pay))).sort((a, b) => b.number.localeCompare(a.number))
    return (
      <ListView<ServiceInvoice> {...common} title="الفوترة والعربون" rows={rows} rowTo={(i) => `/billing/invoices/${i.id}`}
        searchText={(i) => `${i.number} ${partner(i.partnerId)} ${wo(i.workOrderId)?.number ?? ''}`}
        filters={<FilterSelect label="السداد" value={pay} onChange={setPay} options={[{ value: 'O', label: 'مفتوحة' }, { value: 'P', label: 'مدفوعة جزئيًا' }, { value: 'C', label: 'مسددة' }, { value: 'X', label: 'ملغاة' }]} />}
        emptyTitle="لا توجد فواتير"
        columns={[
          { key: 'no', label: 'رقم الفاتورة', render: (i) => <span className="font-mono text-[12px]" dir="ltr">{i.number}</span>, sort: (i) => i.number },
          { key: 'd', label: 'التاريخ', render: (i) => fmtDate(i.date), sort: (i) => i.date },
          { key: 'p', label: 'العميل', render: (i) => partner(i.partnerId), sort: (i) => partner(i.partnerId) },
          { key: 'w', label: 'أمر العمل', render: (i) => <span className="font-mono text-[12px]" dir="ltr">{wo(i.workOrderId)?.number} / {i.batchNo}</span> },
          { key: 't', label: 'الإجمالي', num: true, render: (i) => iqd(i.total), sort: (i) => i.total, total: (rs) => iqd(rs.filter((i) => !i.canceled).reduce((s, i) => s + i.total, 0)) },
          { key: 'pd', label: 'المسدد', num: true, render: (i) => iqd(i.paidAmount) },
          { key: 'b', label: 'المتبقي', num: true, render: (i) => (i.canceled ? '—' : iqd(balance(i))), sort: (i) => balance(i), total: (rs) => iqd(rs.filter((i) => !i.canceled).reduce((s, i) => s + balance(i), 0)) },
          { key: 's', label: 'الحالة', render: (i) => <PayBadge i={i} /> },
        ]} />
    )
  }

  const rows = [...db.receipts].sort((a, b) => b.number.localeCompare(a.number))
  return (
    <>
      <ListView<Receipt> {...common} title="الفوترة والعربون" rows={rows} onRowClick={setRcpt}
        searchText={(r) => `${r.number} ${partner(r.partnerId)} ${wo(r.workOrderId)?.number ?? ''}`}
        emptyTitle="لا توجد سندات قبض"
        columns={[
          { key: 'no', label: 'سند القبض', render: (r) => <span className="font-mono text-[12px]" dir="ltr">{r.number}</span>, sort: (r) => r.number },
          { key: 'd', label: 'التاريخ', render: (r) => fmtDateTime(r.date), sort: (r) => r.date },
          { key: 'p', label: 'العميل', render: (r) => partner(r.partnerId) },
          { key: 'w', label: 'أمر العمل', render: (r) => (r.workOrderId ? <Link to={`/work-orders/${r.workOrderId}`} className="font-mono text-[12px] text-navy hover:underline" dir="ltr" onClick={(e) => e.stopPropagation()}>{wo(r.workOrderId)?.number}</Link> : '—') },
          { key: 'k', label: 'النوع', render: (r) => (r.onAccount ? <Badge tone="blue">عربون / على الحساب</Badge> : <Badge tone="gray">سداد فاتورة</Badge>) },
          { key: 'a', label: 'المبلغ', num: true, render: (r) => iqd(r.amount), total: (rs) => iqd(rs.reduce((s, r) => s + r.amount, 0)) },
          { key: 'u', label: 'غير مُسوّى', num: true, render: (r) => (unapplied(r) ? <span className="font-semibold text-amber-700">{iqd(unapplied(r))}</span> : '—'), total: (rs) => iqd(rs.reduce((s, r) => s + unapplied(r), 0)) },
        ]} />
      {rcpt && <ReceiptDialog receipt={rcpt} onClose={() => setRcpt(null)} />}
    </>
  )
}
