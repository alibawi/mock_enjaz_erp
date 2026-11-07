import { Ban, Link2, Printer, Undo2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { JournalPreview } from '../../components/board'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Card, Field, Modal, Select } from '../../components/ui'
import { applyReceipt, balance, cancelInvoice, reverseApplication, revenueName, unapplied } from '../../data/billing'
import { fmtDate, fmtDateTime, iqd, num } from '../../data/format'
import { useStore } from '../../data/store'
import { Link, useParams } from '../../router'
import { PaymentDialog, PayBadge, SimTag } from './shared'

/** Service invoice (simulated Sales): posted and locked; payments / deposit applications; cancel only when nothing is applied. */
export default function InvoiceView() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState<'pay' | 'apply' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [rcId, setRcId] = useState('')
  const inv = db.invoices.find((i) => i.id === id)
  if (!inv) return <EmptyBlock title="الفاتورة غير موجودة" action={<Link to="/billing?tab=invoices" className="btn">العودة</Link>} />
  const w = db.workOrders.find((x) => x.id === inv.workOrderId)
  const partner = db.partners.find((p) => p.id === inv.partnerId)
  const apps = db.applications.filter((a) => a.invoiceId === inv.id)
  const open = db.receipts.filter((r) => r.partnerId === inv.partnerId && unapplied(r) > 0)
  const others = db.invoices.filter((i) => i.workOrderId === inv.workOrderId && i.id !== inv.id)

  return (
    <div>
      <PageHeader crumbs={[{ label: 'الفوترة والعربون', to: '/billing?tab=invoices' }, { label: inv.number }]} title={`فاتورة خدمة ${inv.number}`}
        badge={<><PayBadge i={inv} /><SimTag module="المبيعات" /></>}
        summary={{ label: 'المتبقي', value: inv.canceled ? '—' : iqd(balance(inv)) }}
        actions={<>
          {!inv.canceled && balance(inv) > 0 && can('Billing.Generate') && <button type="button" className="btn btn-primary" onClick={() => setDlg('pay')}><Wallet className="h-4 w-4" />قبض</button>}
          {!inv.canceled && balance(inv) > 0 && open.length > 0 && can('Billing.Generate') && <button type="button" className="btn" onClick={() => { setRcId(open[0].id); setDlg('apply') }}><Link2 className="h-4 w-4" />تسوية عربون</button>}
          <button type="button" className="btn" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button>
          {!inv.canceled && can('Billing.Cancel') && <button type="button" className="btn text-red-600" onClick={() => { setReason(''); setDlg('cancel') }}><Ban className="h-4 w-4" />إلغاء الفاتورة</button>}
        </>} />
      {inv.canceled && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">الفاتورة ملغاة. {w?.billingStatus === 'invoiceCancelled' ? 'أعد فتح الفوترة من بطاقة أمر العمل لإصدار الدفعة التالية.' : ''}</div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="البيانات">
            <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <div><span className="text-gray-500">العميل: </span>{partner?.name} <span className="font-mono text-xs text-gray-400" dir="ltr">{partner?.code}</span></div>
              <div><span className="text-gray-500">التاريخ: </span>{fmtDateTime(inv.date)}</div>
              <div><span className="text-gray-500">أمر العمل: </span><Link to={`/work-orders/${inv.workOrderId}`} className="font-mono text-navy hover:underline" dir="ltr">{w?.number}</Link> — دفعة فوترة {inv.batchNo}</div>
              <div><span className="text-gray-500">الأصل: </span>{db.assets.find((a) => a.id === w?.assetId)?.name}</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">مرحّلة ومقفلة عند الإصدار — لا تُعدَّل. القطع بالكميات المصروفة فعلًا، والأسطر المغطاة بالضمان أو حسن النية لا تظهر.</p>
          </Card>
          <Card title="الأسطر" pad={false}>
            <DataTable rows={inv.lines.map((l, i) => ({ ...l, id: String(i) }))} compact columns={[
              { key: 'i', label: 'المادة / الخدمة', render: (l) => db.items.find((x) => x.id === l.itemId)?.name },
              { key: 'q', label: 'الكمية', num: true, render: (l) => num(l.qty, l.qty % 1 ? 1 : 0) },
              { key: 'p', label: 'السعر', num: true, render: (l) => iqd(l.price) },
              { key: 'r', label: 'حساب الإيراد', render: (l) => <span><span className="font-mono text-gray-500" dir="ltr">{l.revenueAccount}</span> {revenueName(l.revenueAccount)}</span> },
              { key: 't', label: 'المجموع', num: true, render: (l) => iqd(l.qty * l.price), total: () => iqd(inv.total) },
            ]} />
          </Card>
          <JournalPreview lines={inv.journal} title="قيد الفاتورة (مُحاكى)" />
        </div>
        <div className="space-y-4">
          <Card title="السداد">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">الإجمالي</dt><dd className="tabular-nums">{iqd(inv.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">المسدد</dt><dd className="tabular-nums">{iqd(inv.paidAmount)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-bold text-navy"><dt>المتبقي</dt><dd className="tabular-nums">{inv.canceled ? '—' : iqd(balance(inv))}</dd></div>
            </dl>
            <ul className="mt-3 space-y-1.5 text-sm">
              {apps.length === 0 && <li className="text-gray-500">لا توجد تسويات</li>}
              {apps.map((a) => {
                const r = db.receipts.find((x) => x.id === a.receiptId)
                return (
                  <li key={a.id} className={`flex items-center justify-between gap-2 ${a.reversed ? 'text-gray-400 line-through' : ''}`}>
                    <span><span className="font-mono text-xs" dir="ltr">{r?.number}</span> {r?.onAccount ? '(عربون)' : ''} — {iqd(a.amount)} <span className="text-xs text-gray-400">{fmtDate(a.date)}</span></span>
                    {!a.reversed && !inv.canceled && can('Billing.Cancel') && <button type="button" className="text-xs text-red-600 underline" onClick={() => run((d) => reverseApplication(d, a.id), 'عُكست التسوية — المبلغ عاد على حساب العميل')}><Undo2 className="inline h-3 w-3" /> عكس</button>}
                  </li>
                )
              })}
            </ul>
          </Card>
          {others.length > 0 && (
            <Card title="فواتير أخرى لأمر العمل">
              <ul className="space-y-1 text-sm">{others.map((o) => <li key={o.id} className="flex justify-between"><Link to={`/billing/invoices/${o.id}`} className="font-mono text-navy hover:underline" dir="ltr">{o.number} / {o.batchNo}</Link><PayBadge i={o} /></li>)}</ul>
            </Card>
          )}
        </div>
      </div>

      {dlg === 'pay' && <PaymentDialog invoice={inv} onClose={() => setDlg(null)} />}
      {dlg === 'apply' && (
        <Modal title="تسوية قبض على الحساب" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => run((d) => applyReceipt(d, rcId, inv.id), 'تمت التسوية') && setDlg(null)}>تسوية</button></>}>
          <Field label="سند القبض"><Select value={rcId} onChange={setRcId} options={open.map((r) => ({ value: r.id, label: `${r.number} — متاح ${iqd(unapplied(r))}` }))} /></Field>
        </Modal>
      )}
      {dlg === 'cancel' && (
        <Modal title="إلغاء الفاتورة (مُحاكاة المبيعات)" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn border-red-600 bg-red-600 text-white" onClick={() => run((d) => cancelInvoice(d, inv.id, reason), 'أُلغيت الفاتورة') && setDlg(null)}>إلغاء الفاتورة</button></>}>
          <p className="mb-2 text-sm text-gray-600">لا تُلغى فاتورة عليها مبالغ مسددة أو مُسوّاة؛ اعكس التسويات أولًا. بعد الإلغاء تُعاد فتح الفوترة من أمر العمل لإصدار دفعة جديدة.</p>
          <Field label="السبب" required><textarea className="inp min-h-[70px] py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  )
}
