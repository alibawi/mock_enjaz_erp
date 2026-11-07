import { useState } from 'react'
import { JournalPreview } from '../../components/board'
import { Badge, Field, Modal, NumInput } from '../../components/ui'
import { balance, receivePayment, receiveDeposit } from '../../data/billing'
import { fmtDateTime, iqd, paymentStatus, uid } from '../../data/format'
import { useStore } from '../../data/store'
import type { Receipt, ServiceInvoice } from '../../data/types'

export const SimTag = ({ module }: { module: string }) => <span className="rounded bg-amber-50 px-1.5 text-[10px] font-normal text-amber-700">مُحاكى — في النظام الحقيقي: {module}</span>

export const PayBadge = ({ i }: { i: ServiceInvoice }) => (i.canceled ? <Badge tone="red">ملغاة</Badge> : <Badge tone={paymentStatus[i.paymentStatus].tone}>{paymentStatus[i.paymentStatus].label}</Badge>)

/** Deposit = on-account incoming payment linked to the WO (decision: not an AR down-payment; no tax). */
export function DepositDialog({ woId, suggested, onClose }: { woId: string; suggested: number; onClose: () => void }) {
  const { run } = useStore()
  const [amount, setAmount] = useState(suggested)
  return (
    <Modal title="استلام عربون" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => run((d) => receiveDeposit(d, woId, amount, uid('rc')), 'سُجّل العربون كقبض على الحساب') && onClose()}>استلام</button></>}>
      <Field label="المبلغ (د.ع)" required hint="يُسجَّل سند قبض على حساب العميل مرتبطًا بأمر العمل، بلا ضريبة، ويُسوّى تلقائيًا مع الفاتورة عند إصدارها."><NumInput value={amount} onChange={setAmount} /></Field>
    </Modal>
  )
}

export function PaymentDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const { run } = useStore()
  const [amount, setAmount] = useState(balance(invoice))
  return (
    <Modal title={`قبض على الفاتورة ${invoice.number}`} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => run((d) => receivePayment(d, invoice.id, amount, uid('rc')), 'سُجّل القبض') && onClose()}>قبض</button></>}>
      <Field label="المبلغ (د.ع)" required hint={`المتبقي ${iqd(balance(invoice))}`}><NumInput value={amount} onChange={setAmount} /></Field>
    </Modal>
  )
}

export function ReceiptDialog({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const { db } = useStore()
  const apps = db.applications.filter((a) => a.receiptId === receipt.id)
  return (
    <Modal title={`سند قبض ${receipt.number}`} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>إغلاق</button>}>
      <div className="mb-3 space-y-1 text-sm">
        <div>{db.partners.find((p) => p.id === receipt.partnerId)?.name} — {fmtDateTime(receipt.date)} <SimTag module="المالية (المدفوعات الواردة)" /></div>
        <div>المبلغ {iqd(receipt.amount)} · مُسوّى {iqd(receipt.applied)} · على الحساب {iqd(receipt.amount - receipt.applied)}</div>
        {apps.map((a) => <div key={a.id} className={a.reversed ? 'text-gray-400 line-through' : ''}>تسوية مع {db.invoices.find((i) => i.id === a.invoiceId)?.number} — {iqd(a.amount)}</div>)}
      </div>
      <JournalPreview lines={receipt.journal} />
    </Modal>
  )
}
