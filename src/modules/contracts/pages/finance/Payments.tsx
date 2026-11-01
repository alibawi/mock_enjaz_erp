import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { KPICard } from '../../components/display'
import { FilterSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Card, Tabs } from '../../components/ui'
import { daysTo, fmtDate, money } from '../../data/format'
import { billingBlocker, billingLabel, createBilling, effItemStatus, payKindLabel, payStatusLabel } from '../../data/payments'
import { useStore } from '../../data/store'
import type { PaymentItem, PaymentStatus } from '../../data/types'
import { BillingLog, PayStatus } from './FinancialTab'

/** Cross-contract payment schedule (what is due to be billed) and the billing log (O7). */
export default function Payments() {
  const { db, run, can } = useStore()
  const [tab, setTab] = useState<'schedule' | 'log'>('schedule')
  const [st, setSt] = useState('')
  const rows = db.paymentItems.filter((p) => !st || effItemStatus(p) === st).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const contract = (p: PaymentItem) => db.contracts.find((c) => c.id === p.contractId)!
  const cols: Column<PaymentItem>[] = [
    { key: 'c', label: 'العقد', render: (p) => <Link to={`/contracts/${p.contractId}`}><div className="text-navy" dir="ltr">{contract(p).number}</div><div className="max-w-[260px] truncate text-[11px] text-gray-500">{contract(p).title}</div></Link> },
    { key: 'n', label: 'الدفعة', render: (p) => `${p.itemNo} — ${payKindLabel[p.kind]}` },
    { key: 'd', label: 'الاستحقاق', render: (p) => <div>{fmtDate(p.dueDate)}{p.status === 'Planned' && <div className={`text-[11px] ${daysTo(p.dueDate) <= 7 ? 'text-amber-600' : 'text-gray-400'}`}>{daysTo(p.dueDate) < 0 ? `مستحقة منذ ${-daysTo(p.dueDate)} يوم` : `بعد ${daysTo(p.dueDate)} يوم`}</div>}</div> },
    { key: 'a', label: 'المبلغ', num: true, render: (p) => money(p.amount, p.currency) },
    { key: 'b', label: 'المستند', render: (p) => (p.billingDocType ? billingLabel[p.billingDocType] : '—') },
    { key: 's', label: 'الحالة', render: (p) => <PayStatus it={p} /> },
    { key: 'x', label: '', render: (p) => (p.status === 'Planned' && can('Obligations.Manage') ? <button type="button" className="btn btn-primary" disabled={!!billingBlocker(db, p)} title={billingBlocker(db, p)} onClick={() => run((d) => createBilling(d, p.id), 'أُنشئ مستند الفوترة (محاكاة)')}>إنشاء فوترة</button> : null) },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الالتزامات والمالية' }, { label: 'الدفعات' }]} title="جدول الدفعات والفوترة" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="دفعات مستحقة للفوترة" value={db.paymentItems.filter((p) => effItemStatus(p) === 'Due').length} tone="amber" />
        <KPICard label="مفوترة بلا تسوية" value={db.paymentItems.filter((p) => p.status === 'Invoiced' && p.paidAmount === undefined).length} hint="تنتظر تسوية Finance" />
        <KPICard label="مستندات فوترة" value={db.billingLog.length} />
        <KPICard label="ضمانات تنتهي خلال 30 يوماً" value={db.guarantees.filter((g) => daysTo(g.expiryDate) >= 0 && daysTo(g.expiryDate) <= 30).length} tone="red" />
      </div>
      <Card pad={false}>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: 'schedule', label: 'جدول الدفعات', count: db.paymentItems.length }, { id: 'log', label: 'سجل الفوترة', count: db.billingLog.length }]} />
        {tab === 'schedule' ? (
          <>
            <div className="flex gap-2 border-b border-line p-3"><FilterSelect label="الحالة" value={st} onChange={setSt} options={(Object.keys(payStatusLabel) as PaymentStatus[]).map((k) => ({ value: k, label: payStatusLabel[k] }))} /></div>
            <DataTable rows={rows} columns={cols} emptyTitle="لا دفعات" />
          </>
        ) : <BillingLog rows={db.billingLog.slice().reverse()} title="مستندات أُنشئت من جدول الدفعات" />}
      </Card>
    </div>
  )
}
