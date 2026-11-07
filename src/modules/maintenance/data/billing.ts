// Billing engine (simulated Sales + Finance) — spec §3 Billing / payment status, BR-M-16…19; plan §21.5, §33 item 8.
// Deposits are on-account incoming payments linked to the WO (not an AR down-payment document) and carry no tax.
import { today } from './asof'
import { nowStamp, uid } from './format'
import { addAudit, nextNumber } from './store'
import type { DB, JournalLine, PaymentStatus, Receipt, ServiceInvoice, WorkOrder } from './types'

export const CASH = { account: '1110', accountName: 'الصندوق — مركز الصيانة' }
const customerAcc = (d: DB, partnerId: string) => {
  const p = d.partners.find((x) => x.id === partnerId)
  return { account: p?.accountCode ?? '1211', accountName: `ذمم العملاء — ${p?.name ?? ''}` }
}
export const revenueName = (acc: string) => ({ '4120': 'إيراد بيع قطع الغيار', '4200': 'إيراد خدمات الصيانة — عام', '4210': 'إيراد خدمات الصيانة (عمالة)', '4220': 'إيراد الفحص والتشخيص', '4230': 'إيراد خدمات خارجية' } as Record<string, string>)[acc] ?? 'إيراد خدمات الصيانة'

export const balance = (i: ServiceInvoice) => i.total - i.paidAmount
export const unapplied = (r: Receipt) => r.amount - r.applied
export const statusOf = (paid: number, total: number): PaymentStatus => (paid <= 0 ? 'O' : paid >= total ? 'C' : 'P')
export const invoicesOf = (d: DB, woId: string) => d.invoices.filter((i) => i.workOrderId === woId)
export const activeInvoice = (d: DB, woId: string) => invoicesOf(d, woId).find((i) => !i.canceled)
export const depositsOf = (d: DB, woId: string) => d.receipts.filter((r) => r.workOrderId === woId && r.onAccount)

/** BR-M-16: billable lines only (paid coverage); parts at the issued (actually consumed) quantity; revenue account from the item card. */
export function billableLines(d: DB, w: WorkOrder) {
  const rev = (itemId: string) => d.items.find((i) => i.id === itemId)?.revenueAccount ?? d.settings.defaultRevenueAccount
  return [
    ...w.parts.filter((p) => p.coverage === 'paid' && p.issuedQty > 0).map((p) => ({ itemId: p.itemId, qty: p.issuedQty, price: p.price, revenueAccount: rev(p.itemId) })),
    ...w.services.filter((s) => s.coverage === 'paid').map((s) => ({ itemId: s.itemId, qty: s.qty, price: s.price, revenueAccount: rev(s.itemId) })),
  ]
}

export function invoiceJournal(d: DB, partnerId: string, lines: ServiceInvoice['lines']): JournalLine[] {
  const groups = new Map<string, number>()
  for (const l of lines) groups.set(l.revenueAccount, (groups.get(l.revenueAccount) ?? 0) + Math.round(l.qty * l.price))
  const total = [...groups.values()].reduce((s, v) => s + v, 0)
  return [{ ...customerAcc(d, partnerId), debit: total, credit: 0 }, ...[...groups].map(([account, v]) => ({ account, accountName: revenueName(account), debit: 0, credit: v }))]
}
export const receiptJournal = (d: DB, partnerId: string, amount: number): JournalLine[] =>
  [{ ...CASH, debit: amount, credit: 0 }, { ...customerAcc(d, partnerId), debit: 0, credit: amount }]

export function canInvoice(d: DB, w: WorkOrder): string | null {
  if (!['completed', 'closed'].includes(w.status)) return 'تُصدر الفاتورة بعد إكمال أمر العمل'
  if (w.billingStatus !== 'notInvoiced') return w.billingStatus === 'invoiceCancelled' ? 'الفاتورة ملغاة — أعد فتح الفوترة أولًا' : 'أمر العمل مفوتر أو غير قابل للفوترة'
  if (!['posted', 'notRequired'].includes(w.consumptionStatus)) return 'رحّل صرف القطع أولًا — الفاتورة تُحسب على الكميات المصروفة فعلًا'
  if (!billableLines(d, w).length) return 'لا توجد أسطر قابلة للفوترة'
  return null
}

function link(d: DB, r: Receipt, inv: ServiceInvoice, amount: number) {
  d.applications.push({ id: uid('apl'), receiptId: r.id, invoiceId: inv.id, amount, date: today(), reversed: false })
  r.applied += amount
  inv.paidAmount += amount
  inv.paymentStatus = statusOf(inv.paidAmount, inv.total)
}

/** Posted, locked invoice for the next batch; open deposits of this WO are applied straight away (BR-M-18). */
export function generateInvoice(d: DB, woId: string, id: string): string | null {
  const w = d.workOrders.find((x) => x.id === woId)
  if (!w) return 'أمر العمل غير موجود'
  const err = canInvoice(d, w)
  if (err) return err
  const lines = billableLines(d, w)
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.price), 0)
  w.billingBatch += 1
  const inv: ServiceInvoice = {
    id, number: nextNumber(d, 'INV'), workOrderId: w.id, batchNo: w.billingBatch, date: nowStamp(), partnerId: w.billingPartnerId,
    lines, total, paidAmount: 0, paymentStatus: 'O', canceled: false, journal: invoiceJournal(d, w.billingPartnerId, lines),
  }
  d.invoices.push(inv)
  w.billingStatus = 'invoiced'
  for (const r of depositsOf(d, w.id).filter((x) => unapplied(x) > 0 && x.partnerId === inv.partnerId)) {
    const amt = Math.min(unapplied(r), balance(inv))
    if (amt > 0) link(d, r, inv, amt)
  }
  addAudit(d, 'workOrder', w.id, 'إصدار فاتورة خدمة (مُحاكاة)', `${inv.number} — دفعة ${inv.batchNo} — ${total.toLocaleString('en-US')} د.ع${inv.paidAmount ? ` — طُبِّق عربون ${inv.paidAmount.toLocaleString('en-US')}` : ''}`)
  return null
}

/** BR-M-17: refused while any amount is applied; the WO billing becomes InvoiceCancelled. */
export function cancelInvoice(d: DB, invoiceId: string, reason: string): string | null {
  const inv = d.invoices.find((x) => x.id === invoiceId)
  if (!inv || inv.canceled) return 'الفاتورة غير موجودة أو ملغاة'
  if (!reason.trim()) return 'سبب الإلغاء إلزامي'
  if (inv.paidAmount > 0) return `على الفاتورة مبالغ مسددة (${inv.paidAmount.toLocaleString('en-US')} د.ع) — اعكس التسويات أولًا`
  const w = d.workOrders.find((x) => x.id === inv.workOrderId)
  if (w?.status === 'closed') return 'أمر العمل مغلق — أعد فتحه أولًا'
  inv.canceled = true
  if (w) w.billingStatus = 'invoiceCancelled'
  addAudit(d, 'workOrder', inv.workOrderId, 'إلغاء فاتورة (مُحاكاة المبيعات)', `${inv.number} — ${reason.trim()}`)
  return null
}

/** ReopenBilling: InvoiceCancelled → NotInvoiced; the next invoice takes the next batch number. */
export function reopenBilling(d: DB, woId: string): string | null {
  const w = d.workOrders.find((x) => x.id === woId)
  if (!w || w.billingStatus !== 'invoiceCancelled') return 'الفوترة ليست ملغاة'
  w.billingStatus = 'notInvoiced'
  addAudit(d, 'workOrder', w.id, 'إعادة فتح الفوترة', `الدفعة التالية ${w.billingBatch + 1}`)
  return null
}

/** On-account deposit linked to the WO (Dr cash / Cr customer). No tax on deposits. */
export function receiveDeposit(d: DB, woId: string, amount: number, id: string): string | null {
  const w = d.workOrders.find((x) => x.id === woId)
  if (!w || ['cancelled', 'closed'].includes(w.status)) return 'لا يُستلم عربون لهذا الأمر'
  if (w.billingStatus === 'notBillable') return 'أمر العمل غير قابل للفوترة'
  if (!(amount > 0)) return 'أدخل مبلغًا صحيحًا'
  const r: Receipt = { id, number: nextNumber(d, 'RC'), partnerId: w.billingPartnerId, workOrderId: w.id, date: nowStamp(), amount, onAccount: true, applied: 0, journal: receiptJournal(d, w.billingPartnerId, amount) }
  d.receipts.push(r)
  const inv = activeInvoice(d, w.id)
  if (inv && balance(inv) > 0) link(d, r, inv, Math.min(amount, balance(inv)))
  addAudit(d, 'workOrder', w.id, 'استلام عربون (قبض على الحساب)', `${r.number} — ${amount.toLocaleString('en-US')} د.ع`)
  return null
}

/** Payment against an invoice: receipt + application in one step. */
export function receivePayment(d: DB, invoiceId: string, amount: number, id: string): string | null {
  const inv = d.invoices.find((x) => x.id === invoiceId)
  if (!inv || inv.canceled) return 'الفاتورة غير صالحة'
  if (!(amount > 0) || amount > balance(inv)) return `المبلغ بين 1 و ${balance(inv).toLocaleString('en-US')}`
  const r: Receipt = { id, number: nextNumber(d, 'RC'), partnerId: inv.partnerId, workOrderId: inv.workOrderId, date: nowStamp(), amount, onAccount: false, applied: 0, journal: receiptJournal(d, inv.partnerId, amount) }
  d.receipts.push(r)
  link(d, r, inv, amount)
  addAudit(d, 'workOrder', inv.workOrderId, 'قبض دفعة على الفاتورة', `${r.number} → ${inv.number} — ${amount.toLocaleString('en-US')} د.ع`)
  return null
}

export function applyReceipt(d: DB, receiptId: string, invoiceId: string): string | null {
  const r = d.receipts.find((x) => x.id === receiptId)
  const inv = d.invoices.find((x) => x.id === invoiceId)
  if (!r || !inv || inv.canceled) return 'اختر سند قبض وفاتورة صالحة'
  if (r.partnerId !== inv.partnerId) return 'السند والفاتورة لعميلين مختلفين'
  const amt = Math.min(unapplied(r), balance(inv))
  if (amt <= 0) return 'لا يوجد رصيد للتسوية'
  link(d, r, inv, amt)
  addAudit(d, 'workOrder', inv.workOrderId, 'تسوية قبض مع فاتورة', `${r.number} → ${inv.number} — ${amt.toLocaleString('en-US')} د.ع`)
  return null
}

/** Reversing an application returns the amount to on-account (BR-M-18). */
export function reverseApplication(d: DB, appId: string): string | null {
  const a = d.applications.find((x) => x.id === appId)
  if (!a || a.reversed) return 'التسوية غير موجودة أو معكوسة'
  const r = d.receipts.find((x) => x.id === a.receiptId)!
  const inv = d.invoices.find((x) => x.id === a.invoiceId)!
  a.reversed = true
  r.applied -= a.amount
  r.onAccount = true
  inv.paidAmount -= a.amount
  inv.paymentStatus = statusOf(inv.paidAmount, inv.total)
  addAudit(d, 'workOrder', inv.workOrderId, 'عكس تسوية', `${r.number} ← ${inv.number} — ${a.amount.toLocaleString('en-US')} د.ع عادت على الحساب`)
  return null
}
