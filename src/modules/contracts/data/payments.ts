// Payment schedule, mock billing automation and the financial summary (spec BR-O-06…10). Contracts never post accounting entries.
import { featureOn } from './admin'
import { today } from './asof'
import { convertAmount } from './currency'
import { uid } from './format'
import { balanceOf, basisCounter, agreementCfg, committedValue, netPrice, postDoc } from './fulfillment'
import { penaltyOf } from './obligations'
import type { BillingDocType, Contract, CurrencyCode, DB, DocType, PaymentItem, PaymentKind, PaymentStatus } from './types'

export const payKindLabel: Record<PaymentKind, string> = { Advance: 'دفعة مقدمة', Milestone: 'دفعة مرحلة', Periodic: 'دفعة دورية', Retention: 'محتجز ضمان', Final: 'دفعة ختامية' }
export const payStatusLabel: Record<PaymentStatus, string> = { Planned: 'مخططة', Due: 'مستحقة', Invoiced: 'فُوتِرت', Paid: 'مسدّدة', Cancelled: 'ملغاة' }
export const payStatusTone: Record<PaymentStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = { Planned: 'gray', Due: 'amber', Invoiced: 'blue', Paid: 'green', Cancelled: 'gray' }
export const billingLabel: Record<BillingDocType, string> = {
  SaleOrder: 'أمر بيع', SaleInvoice: 'فاتورة بيع', SalesTemplate: 'قالب مبيعات متكرر', PurchaseOrder: 'أمر شراء', PurchaseBill: 'فاتورة شراء', PurchaseTemplate: 'قالب مشتريات متكرر',
}
export const billingFor = (c: Contract): BillingDocType[] => (c.direction === 'Incoming' ? ['PurchaseBill', 'PurchaseOrder', 'PurchaseTemplate'] : ['SaleInvoice', 'SaleOrder', 'SalesTemplate'])
const ledgerType: Partial<Record<BillingDocType, DocType>> = { SaleOrder: 'SOR', SaleInvoice: 'INV', PurchaseOrder: 'POR', PurchaseBill: 'PCH' }

/** Planned items whose date arrived are Due (derived from the demo date). */
export const effItemStatus = (it: PaymentItem, on = today()): PaymentStatus => (it.status === 'Planned' && it.dueDate <= on ? 'Due' : it.status)
export const itemsOf = (db: DB, contractId: string) => db.paymentItems.filter((i) => i.contractId === contractId).sort((a, b) => a.itemNo - b.itemNo)
const live = (it: PaymentItem) => it.status !== 'Cancelled'

/** BR-O-06: percent total ≤ 100 and amount total ≤ contract value. */
export function scheduleCheck(db: DB, c: Contract, items = itemsOf(db, c.id)) {
  const act = items.filter(live)
  const percent = act.reduce((s, i) => s + (i.percent ?? 0), 0), amount = act.reduce((s, i) => s + i.amount, 0)
  const warnings: string[] = []
  if (percent > 100.0001) warnings.push(`مجموع النسب ${percent.toFixed(1)}% يتجاوز 100%`)
  if (c.contractValue && amount > c.contractValue + 0.5) warnings.push('مجموع المبالغ يتجاوز قيمة العقد')
  return { percent, amount, warnings }
}

export function validateItem(db: DB, c: Contract, it: PaymentItem): string[] {
  const e: string[] = []
  if (!it.dueDate) e.push('تاريخ الاستحقاق مطلوب')
  if (!(it.amount > 0)) e.push('المبلغ يجب أن يكون أكبر من صفر')
  if (it.percent !== undefined && (it.percent < 0 || it.percent > 100)) e.push('النسبة بين 0 و100')
  if (it.obligationId && !db.obligations.some((o) => o.id === it.obligationId && o.contractId === c.id)) e.push('الالتزام المرتبط غير موجود في هذا العقد')
  if (it.agreementLineNum && !db.lines.some((l) => l.contractId === c.id && l.lineNum === it.agreementLineNum)) e.push('بند الاتفاقية غير موجود')
  const others = itemsOf(db, c.id).filter((x) => x.id !== it.id)
  const chk = scheduleCheck(db, c, [...others, it])
  if (it.status !== 'Cancelled') e.push(...chk.warnings.map((w) => `${w} — راجع الجدول`))
  return e
}

export function nextItemNo(db: DB, contractId: string) { return Math.max(0, ...db.paymentItems.filter((i) => i.contractId === contractId).map((i) => i.itemNo)) + 1 }

/** Invoiced/paid items are frozen (BR-O-06); only Planned items can be edited or removed. */
export function saveItem(d: DB, it: PaymentItem): string | null {
  const c = d.contracts.find((x) => x.id === it.contractId)
  if (!c) return 'العقد غير موجود'
  const old = d.paymentItems.find((x) => x.id === it.id)
  if (old && old.status !== 'Planned') return 'البند مجمّد بعد الفوترة'
  const errs = validateItem(d, c, it).filter((x) => !x.endsWith('راجع الجدول'))
  if (errs.length) return errs.join(' — ')
  if (old) d.paymentItems = d.paymentItems.map((x) => (x.id === it.id ? it : x)); else d.paymentItems.push(it)
  return null
}
export function deleteItem(d: DB, id: string): string | null {
  const it = d.paymentItems.find((x) => x.id === id)
  if (!it) return 'البند غير موجود'
  if (it.status !== 'Planned') return 'البند مجمّد بعد الفوترة'
  d.paymentItems = d.paymentItems.filter((x) => x.id !== id)
  return null
}

export function billingBlocker(d: DB, it: PaymentItem): string | undefined {
  const c = d.contracts.find((x) => x.id === it.contractId)
  if (!c) return 'العقد غير موجود'
  if (!featureOn(d, 'RecurringBilling')) return 'الفوترة التلقائية معطّلة من إعدادات النظام'
  if (effItemStatus(it) !== 'Due') return it.status === 'Planned' ? `يستحق في ${it.dueDate}` : 'تمت فوترته'
  if (!['Active', 'OnHold'].includes(c.status)) return 'العقد غير ساري'
  if (!it.billingDocType) return 'حدّد نوع مستند الفوترة'
  return undefined
}

/** BR-O-07 — mock billing: creates the document in Sales/Procurement (a ledger-linked document through the agreements engine when the item names an agreement line). */
export function createBilling(d: DB, itemId: string): string | null {
  const it = d.paymentItems.find((x) => x.id === itemId)
  if (!it) return 'البند غير موجود'
  const blocked = billingBlocker(d, it)
  if (blocked) return blocked
  const c = d.contracts.find((x) => x.id === it.contractId)!
  const type = it.billingDocType!
  const template = type === 'PurchaseTemplate' || type === 'SalesTemplate'
  const year = today().slice(0, 4)
  const n = d.billingLog.filter((b) => b.docType === type).length + 1
  let ref = `${template ? 'TPL' : (ledgerType[type] ?? 'DOC')}-${year}-B${String(n).padStart(4, '0')}`
  let ledgerDocId: string | undefined
  let note = template ? 'سجل قالب متكرر (محاكاة) — لا مستند فعلي' : 'مستند محاكى من وحدة المبيعات/المشتريات'
  const lt = ledgerType[type]
  if (c.profile === 'Agreement' && lt && it.agreementLineNum) {
    const line = d.lines.find((l) => l.contractId === c.id && l.lineNum === it.agreementLineNum)
    if (line?.itemId && line.commitmentType === 'Quantity') {
      const price = netPrice(line)
      const r = postDoc(d, { docType: lt, contractId: c.id, date: today(), currency: c.currency, lines: [{ itemId: line.itemId, qty: Math.round((it.amount / price) * 1000) / 1000, unitPrice: price }] })
      if (r.error) return r.error
      ref = r.doc!.ref; ledgerDocId = r.doc!.id; note = `سُجّل في دفتر التنفيذ (بند ${line.lineNum})`
    }
  }
  const rec = { id: uid('bil'), contractId: c.id, paymentItemId: it.id, docType: type, ref, date: today(), amount: it.amount, currency: it.currency, template, ledgerDocId, note, createdBy: d.userId }
  d.billingLog.push(rec)
  it.status = 'Invoiced'; it.billingId = rec.id
  d.audit.push({ id: uid('aud'), at: `${today()}T00:00`, userId: d.userId, entity: 'contract', entityId: c.id, action: 'billing:create', detail: `${ref} — ${it.amount}` })
  return null
}

/** Simulates the settlement coming back from Finance. */
export function recordPayment(d: DB, itemId: string, amount: number, date = today()): string | null {
  const it = d.paymentItems.find((x) => x.id === itemId)
  if (!it || (it.status !== 'Invoiced' && it.status !== 'Paid')) return 'لا تسجَّل دفعة قبل الفوترة'
  if (!(amount >= 0) || amount > it.amount + 0.5) return 'المبلغ المدفوع لا يتجاوز مبلغ البند'
  it.paidAmount = amount; it.paidOn = date
  it.status = amount >= it.amount - 0.5 ? 'Paid' : 'Invoiced'
  return null
}

// ───────────── financial summary (BR-O-08, BR-O-10) ─────────────
export interface FinancialSummary {
  currency: CurrencyCode; contractValue: number; plannedValue: number; committedValue: number; releasedValue: number; fulfilledValue: number
  invoicedValue: number; paidValue: number; unsettled: number; outstanding: number | null; remaining: number; retentionHeld: number; penaltiesAccrued: number
  agreement: boolean
}
export function financialSummary(db: DB, c: Contract): FinancialSummary {
  const items = itemsOf(db, c.id).filter(live)
  const lines = db.lines.filter((l) => l.contractId === c.id)
  const agreement = c.profile === 'Agreement'
  const base = { currency: c.currency, contractValue: c.contractValue ?? 0, plannedValue: items.reduce((s, i) => s + i.amount, 0), agreement }
  let committed = c.contractValue ?? 0, released = 0, fulfilled = 0, invoiced = 0, remaining = 0
  if (agreement) {
    const basis = basisCounter[agreementCfg(db, c).basis]
    committed = lines.reduce((s, l) => s + committedValue(l), 0)
    lines.forEach((l) => { const b = balanceOf(db, l.id); released += b.relV; fulfilled += b.fulV; invoiced += b.invV })
    const used = lines.reduce((s, l) => { const b = balanceOf(db, l.id); return s + (basis === 'Release' ? b.relV : basis === 'Fulfill' ? b.fulV : b.invV) }, 0)
    remaining = committed - used
  } else {
    invoiced = items.filter((i) => i.status === 'Invoiced' || i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
    remaining = committed - invoiced
  }
  const billed = items.filter((i) => i.status === 'Invoiced' || i.status === 'Paid')
  const known = billed.filter((i) => i.paidAmount !== undefined)
  const paid = known.reduce((s, i) => s + (i.paidAmount ?? 0), 0)
  const unsettled = billed.length - known.length
  const retention = items.find((i) => i.kind === 'Retention')
  return {
    ...base, committedValue: committed, releasedValue: released, fulfilledValue: fulfilled, invoicedValue: invoiced, paidValue: paid, unsettled,
    outstanding: unsettled ? null : Math.max(0, billed.reduce((s, i) => s + i.amount, 0) - paid), remaining,
    retentionHeld: retention?.percent && retention.status !== 'Paid' ? (paid * retention.percent) / 100 : 0,
    penaltiesAccrued: db.obligations.filter((o) => o.contractId === c.id).reduce((s, o) => s + penaltyOf(o), 0),
  }
}
export const toIQD = (db: DB, n: number, cur: CurrencyCode) => convertAmount(db, n, cur, 'IQD', today())

/** BR-O-09: guarantees expiring within 30 days (alerts at 30 and 7). */
export const guaranteeDays = (g: { expiryDate: string }) => Math.round((Date.parse(g.expiryDate) - Date.parse(today())) / 86400000)
