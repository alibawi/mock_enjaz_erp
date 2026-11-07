// Simulated Inventory (plan §21, §33 items 1c/1d/1e/1f/1g/5). In the real system these calls go through
// IGoodsIssueIntegrationService and the reservation contract (I1, I3); here they change the mock stock rows.
import { nowStamp, uid } from './format'
import { issueJournal } from './journal'
import { addAudit, nextNumber } from './store'
import type { DB, GoodsIssue, WorkOrder } from './types'

const WH = 'wh-1'
export const stockRow = (d: DB, itemId: string) => d.stock.find((s) => s.itemId === itemId && s.warehouseId === WH)
export const available = (d: DB, itemId: string) => { const r = stockRow(d, itemId); return r ? r.onHand - r.reserved : 0 }

export interface Shortage { itemId: string; name: string; need: number; available: number }

/** Parts whose remaining planned quantity is not covered by free stock (BR-M-11 at start). */
export function reservationShortages(d: DB, wo: WorkOrder): Shortage[] {
  return wo.parts
    .map((p) => ({ p, need: Math.max(0, p.plannedQty - p.reservedQty - p.issuedQty) }))
    .filter(({ p, need }) => need > 0 && available(d, p.itemId) < need)
    .map(({ p, need }) => ({ itemId: p.itemId, name: d.items.find((i) => i.id === p.itemId)?.name ?? p.itemId, need, available: available(d, p.itemId) }))
}

/** Reserve every planned part at WO start (decision §33 item 5). Caller has checked shortages. */
export function reserveParts(d: DB, wo: WorkOrder) {
  for (const p of wo.parts) {
    const need = Math.max(0, p.plannedQty - p.reservedQty - p.issuedQty)
    if (!need) continue
    const r = stockRow(d, p.itemId)
    if (r) r.reserved += need
    p.reservedQty += need
  }
}

/** Release whatever is still reserved (cancel, or the unconsumed remainder after the issue). */
export function releaseParts(d: DB, wo: WorkOrder) {
  for (const p of wo.parts) {
    if (!p.reservedQty) continue
    const r = stockRow(d, p.itemId)
    if (r) r.reserved = Math.max(0, r.reserved - p.reservedQty)
    p.reservedQty = 0
  }
}

/** Consumed quantity above what this WO holds plus free stock (decision 1f). */
export function consumptionShortages(d: DB, wo: WorkOrder): Shortage[] {
  return wo.parts
    .map((p) => ({ p, need: Math.max(0, p.consumedQty - p.issuedQty) }))
    .filter(({ p, need }) => need > 0 && need > p.reservedQty + available(d, p.itemId))
    .map(({ p, need }) => ({ itemId: p.itemId, name: d.items.find((i) => i.id === p.itemId)?.name ?? p.itemId, need, available: p.reservedQty + available(d, p.itemId) }))
}

/** Expense account of a part line: line type → WO type → COGS (decision 1c). */
export function expenseAccountOf(d: DB, wo: WorkOrder, expenseTypeId?: string) {
  const et = d.expenseTypes.find((e) => e.id === (expenseTypeId ?? wo.expenseTypeId))
  return et ? { code: et.accountCode, name: et.accountName } : { code: d.settings.cogsAccount, name: 'تكلفة المبيعات' }
}

/**
 * Posts the Goods Issue for consumed − issued quantities (decisions 1e/1g). Idempotent: an existing non-cancelled issue
 * with the same key WO:{id}:C{seq} is re-linked instead of creating a second one (§21.7). Returns an error string on failure.
 */
export function postConsumption(d: DB, wo: WorkOrder, opts: { failReason?: string } = {}): string | null {
  const lines = wo.parts.filter((p) => p.consumedQty > p.issuedQty)
  if (lines.length === 0) {
    releaseParts(d, wo)
    wo.consumptionStatus = wo.parts.some((p) => p.issuedQty > 0) ? 'posted' : 'notRequired'
    wo.consumptionError = undefined
    return null
  }
  const key = `WO:${wo.id}:C${wo.consumptionSeq + 1}`
  const existing = d.goodsIssues.find((g) => g.idempotencyKey === key && !g.canceled)
  if (existing) {
    wo.consumptionSeq += 1
    wo.consumptionStatus = 'posted'
    if (!wo.goodsIssueIds.includes(existing.id)) wo.goodsIssueIds.push(existing.id)
    addAudit(d, 'workOrder', wo.id, 'إعادة ربط سند صرف موجود', existing.number)
    return null
  }
  const short = consumptionShortages(d, wo)
  const fail = opts.failReason ?? (short.length ? `كمية غير كافية: ${short.map((s) => `${s.name} (مطلوب ${s.need}، متاح ${s.available})`).join('، ')}` : null)
  if (fail) {
    wo.consumptionStatus = 'failed'
    wo.consumptionError = fail
    addAudit(d, 'workOrder', wo.id, 'فشل صرف القطع', fail)
    return fail
  }
  const partnerId = d.partners.find((p) => p.id === wo.billingPartnerId)?.kind === 'customer' ? wo.billingPartnerId : d.settings.internalPartnerId
  const gi: GoodsIssue = {
    id: uid('gi'), number: nextNumber(d, 'GI'), workOrderId: wo.id, date: nowStamp(), partnerId, idempotencyKey: key, canceled: false,
    lines: lines.map((p) => {
      const acc = expenseAccountOf(d, wo, p.expenseTypeId)
      return { itemId: p.itemId, qty: p.consumedQty - p.issuedQty, unitCost: d.items.find((i) => i.id === p.itemId)?.cost ?? 0, expenseAccount: acc.code, expenseAccountName: acc.name }
    }),
    journal: [],
  }
  gi.journal = issueJournal(d, gi)
  for (const p of lines) {
    const qty = p.consumedQty - p.issuedQty
    const r = stockRow(d, p.itemId)
    if (r) {
      r.onHand -= qty
      r.reserved = Math.max(0, r.reserved - Math.min(p.reservedQty, qty))
    }
    p.reservedQty = Math.max(0, p.reservedQty - qty)
    p.issuedQty += qty
    p.unitCost = d.items.find((i) => i.id === p.itemId)?.cost ?? 0
  }
  releaseParts(d, wo) // planned-but-unused quantity goes back to free stock
  d.goodsIssues.push(gi)
  wo.goodsIssueIds.push(gi.id)
  wo.consumptionSeq += 1
  wo.consumptionStatus = 'posted'
  wo.consumptionError = undefined
  addAudit(d, 'workOrder', wo.id, 'صرف القطع (سند صرف مُحاكى)', `${gi.number} — ${gi.lines.length} سطر`)
  return null
}
