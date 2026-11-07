// Billing seed (area 7): an invoice for every invoiced history job (paid in full, partly, or still open for the corporate
// customers), one invoice cancelled and re-issued in batch 2, and deposits (on-account receipts) on current jobs.
import type { Application, AuditEntry, JournalLine, PaymentStatus, Receipt, ServiceInvoice, WorkOrder } from '../types'
import { items, partners as basePartners, settings } from './master'
import { partners as extraPartners, workOrders } from './workorders'

const partners = [...basePartners, ...extraPartners]
const pad = (n: number) => String(n).padStart(6, '0')
const addD = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const revName: Record<string, string> = { '4120': 'إيراد بيع قطع الغيار', '4200': 'إيراد خدمات الصيانة — عام', '4210': 'إيراد خدمات الصيانة (عمالة)', '4220': 'إيراد الفحص والتشخيص', '4230': 'إيراد خدمات خارجية' }
const cust = (pid: string) => { const p = partners.find((x) => x.id === pid)!; return { account: p.accountCode, accountName: `ذمم العملاء — ${p.name}` } }
const CASH = { account: '1110', accountName: 'الصندوق — مركز الصيانة' }
const status = (paid: number, total: number): PaymentStatus => (paid <= 0 ? 'O' : paid >= total ? 'C' : 'P')

export const invoices: ServiceInvoice[] = []
export const receipts: Receipt[] = []
export const applications: Application[] = []
export const audit: AuditEntry[] = []
let inv = 0, rc = 0, ap = 0, au = 0

function lines(w: WorkOrder): ServiceInvoice['lines'] {
  const rev = (id: string) => items.find((i) => i.id === id)?.revenueAccount ?? settings.defaultRevenueAccount
  return [
    ...w.parts.filter((p) => p.coverage === 'paid' && p.issuedQty > 0).map((p) => ({ itemId: p.itemId, qty: p.issuedQty, price: p.price, revenueAccount: rev(p.itemId) })),
    ...w.services.filter((s) => s.coverage === 'paid').map((s) => ({ itemId: s.itemId, qty: s.qty, price: s.price, revenueAccount: rev(s.itemId) })),
  ]
}
function journal(pid: string, ls: ServiceInvoice['lines']): JournalLine[] {
  const g = new Map<string, number>()
  for (const l of ls) g.set(l.revenueAccount, (g.get(l.revenueAccount) ?? 0) + Math.round(l.qty * l.price))
  const total = [...g.values()].reduce((s, v) => s + v, 0)
  return [{ ...cust(pid), debit: total, credit: 0 }, ...[...g].map(([account, v]) => ({ account, accountName: revName[account] ?? 'إيراد خدمات الصيانة', debit: 0, credit: v }))]
}
function invoice(w: WorkOrder, batchNo: number, date: string, canceled = false): ServiceInvoice {
  const ls = lines(w)
  const total = ls.reduce((s, l) => s + Math.round(l.qty * l.price), 0)
  const i: ServiceInvoice = { id: `inv-${w.id.slice(3)}-${batchNo}`, number: `INV-2026-${pad(++inv)}`, workOrderId: w.id, batchNo, date, partnerId: w.billingPartnerId, lines: ls, total, paidAmount: 0, paymentStatus: 'O', canceled, journal: journal(w.billingPartnerId, ls) }
  invoices.push(i)
  audit.push({ id: `au-i${++au}`, at: date, userId: 'u-acc', entity: 'workOrder', entityId: w.id, action: 'إصدار فاتورة خدمة (مُحاكاة)', detail: `${i.number} — دفعة ${batchNo} — ${total.toLocaleString('en-US')} د.ع` })
  return i
}
function receipt(pid: string, woId: string, date: string, amount: number, onAccount: boolean): Receipt {
  const r: Receipt = { id: `rc-${++rc}`, number: `RC-2026-${pad(rc)}`, partnerId: pid, workOrderId: woId, date, amount, onAccount, applied: 0, journal: [{ ...CASH, debit: amount, credit: 0 }, { ...cust(pid), debit: 0, credit: amount }] }
  receipts.push(r)
  return r
}
function pay(r: Receipt, i: ServiceInvoice, amount: number, date: string) {
  applications.push({ id: `apl-${++ap}`, receiptId: r.id, invoiceId: i.id, amount, date: date.slice(0, 10), reversed: false })
  r.applied += amount
  i.paidAmount += amount
  i.paymentStatus = status(i.paidAmount, i.total)
}

const corporate = ['p-rafidain', 'p-alnoor', 'p-dijla', 'p-sama']
const history = workOrders.filter((w) => w.status === 'closed' && w.billingStatus === 'invoiced').sort((a, b) => a.actualEnd!.localeCompare(b.actualEnd!))
for (const w of history) {
  const date = w.actualEnd!
  if (w.id === 'wo-h23') {
    // wrong labor hours on the first invoice → cancelled, billing reopened, re-issued as batch 2
    const first = invoice(w, 1, date, true)
    first.lines = first.lines.map((l) => (l.itemId === 'sv-hvac' ? { ...l, qty: 3 } : l))
    first.total = first.lines.reduce((s, l) => s + Math.round(l.qty * l.price), 0)
    first.journal = journal(w.billingPartnerId, first.lines)
    audit.push({ id: `au-i${++au}`, at: `${addD(date, 1)}T09:00`, userId: 'u-acc', entity: 'workOrder', entityId: w.id, action: 'إلغاء فاتورة (مُحاكاة المبيعات)', detail: `${first.number} — ساعات العمالة 3 بدل 1.5` })
    audit.push({ id: `au-i${++au}`, at: `${addD(date, 1)}T09:05`, userId: 'u-acc', entity: 'workOrder', entityId: w.id, action: 'إعادة فتح الفوترة', detail: 'الدفعة التالية 2' })
    w.billingBatch = 2
    invoice(w, 2, `${addD(date, 1)}T09:10`)
    continue
  }
  const i = invoice(w, 1, date)
  const corp = corporate.includes(w.billingPartnerId)
  if (!corp) { pay(receipt(w.billingPartnerId, w.id, date, i.total, false), i, i.total, date); continue }
  // corporate customers pay on credit: older invoices settled, October partly, recent ones open
  if (date < '2026-09-20') { const d = `${addD(date, 21)}T11:00`; pay(receipt(w.billingPartnerId, w.id, d, i.total, false), i, i.total, d) }
  else if (date < '2026-10-20') { const d = `${addD(date, 14)}T11:00`; const half = Math.round(i.total / 2 / 1000) * 1000; pay(receipt(w.billingPartnerId, w.id, d, half, false), i, half, d) }
}

// deposits on current jobs: Ahmed's Lexus (applied when its invoice is generated), Sama's Hilux in quality check
const c12 = workOrders.find((w) => w.id === 'wo-c12')!
c12.depositRequired = 50_000
receipt('p-ahmed', c12.id, '2026-11-05T17:20', 50_000, true)
const c11 = workOrders.find((w) => w.id === 'wo-c11')!
c11.depositRequired = 100_000
receipt('p-sama', c11.id, '2026-11-06T08:20', 100_000, true)
workOrders.find((w) => w.id === 'wo-c04')!.depositRequired = 120_000 // required, not yet received
for (const r of receipts.filter((x) => x.onAccount)) audit.push({ id: `au-i${++au}`, at: r.date, userId: 'u-adv', entity: 'workOrder', entityId: r.workOrderId!, action: 'استلام عربون (قبض على الحساب)', detail: `${r.number} — ${r.amount.toLocaleString('en-US')} د.ع` })

export const counters = { 'INV-2026': inv, 'RC-2026': rc }
