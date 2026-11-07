// Maintenance engine flow check (prompt 10.2). Run: npm run check:maintenance (also part of npm run check).
// 1) seed integrity, 2) full customer flow request → estimate → approval → acceptance → WO → deposit → booking → start →
// complete → issue → invoice (deposit applied) → payment → close, 3) rework, 4) failed consumption + retry, 5) billing cancel cycle.
import { generateInvoice, receiveDeposit, receivePayment, cancelInvoice, reverseApplication, reopenBilling, balance } from '../../src/modules/maintenance/data/billing'
import { createEstimate, decide, recordAcceptance, saveLines, submit } from '../../src/modules/maintenance/data/estimate'
import { createRequest, startDiagnosis } from '../../src/modules/maintenance/data/requests'
import { completeBooking, createBooking, startBooking } from '../../src/modules/maintenance/data/schedule'
import { seed } from '../../src/modules/maintenance/data/seed/index'
import type { DB, JournalLine, RoleId } from '../../src/modules/maintenance/data/types'
import { addTime, close, complete, confirmTime, createFromEstimate, qualityResult, retryConsumption, setConsumed, start, toQualityCheck } from '../../src/modules/maintenance/data/workorder'

let fails = 0
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  ${detail}`}`) }
const ok = (name: string, err: string | null) => check(name, err === null, String(err))
const refused = (name: string, err: string | null, contains: string) => check(name, !!err && err.includes(contains), `got ${JSON.stringify(err)}`)
const balanced = (j: JournalLine[]) => j.reduce((s, l) => s + l.debit - l.credit, 0) === 0
const as = (d: DB, userId: string, role: RoleId) => { d.userId = userId; d.role = role }

// ---------- 1. seed integrity ----------
const d = seed()
const numbers = [...d.requests.map((r) => r.number), ...d.workOrders.map((w) => w.number), ...d.goodsIssues.map((g) => g.number), ...d.invoices.map((i) => i.number), ...d.receipts.map((r) => r.number), ...d.bookings.map((b) => b.number)]
check('seed: document numbers unique', new Set(numbers).size === numbers.length)
check('seed: every journal balances (GI, invoice, receipt)', [...d.goodsIssues, ...d.invoices, ...d.receipts].every((x) => balanced(x.journal)))
check('seed: no negative free stock', d.stock.every((s) => s.onHand - s.reserved >= 0 && s.reserved >= 0))
check('seed: reserved stock = open WO reservations', d.stock.every((s) => s.reserved === d.workOrders.reduce((t, w) => t + w.parts.filter((p) => p.itemId === s.itemId).reduce((u, p) => u + p.reservedQty, 0), 0)))
check('seed: closed WOs satisfy BR-M-19', d.workOrders.filter((w) => w.status === 'closed').every((w) => ['posted', 'notRequired'].includes(w.consumptionStatus) && ['invoiced', 'notBillable'].includes(w.billingStatus)))
check('seed: invoiced WOs have one live invoice', d.workOrders.filter((w) => w.billingStatus === 'invoiced').every((w) => d.invoices.filter((i) => i.workOrderId === w.id && !i.canceled).length === 1))
check('seed: invoice paid = applications', d.invoices.every((i) => i.paidAmount === d.applications.filter((a) => a.invoiceId === i.id && !a.reversed).reduce((s, a) => s + a.amount, 0)))
check('seed: one active booking per WO', d.workOrders.every((w) => d.bookings.filter((b) => b.stops.some((s) => s.workOrderId === w.id) && ['scheduled', 'rescheduled', 'inProgress'].includes(b.status)).length <= 1))
check('seed: every request with a WO is closed', d.requests.filter((r) => r.workOrderId).every((r) => r.status === 'closed'))

// ---------- 2. full customer flow ----------
as(d, 'u-adv', 'advisor')
ok('request: receive Ahmed\'s Camry', createRequest(d, { assetId: 'as-01', maintenanceTypeId: 'mt-car', complaint: 'اهتزاز عند الفرملة', meterAtIntake: 84_400, accessories: 'مفتاح', channel: 'walkIn', receiveNow: true, markRework: false }, 'rq-t'))
refused('request: second open request on the same asset', createRequest(d, { assetId: 'as-01', maintenanceTypeId: 'mt-car', complaint: 'x', accessories: '', channel: 'walkIn', receiveNow: false, markRework: false }, 'rq-t2'), 'مفتوح')
ok('request: start diagnosis', startDiagnosis(d, 'rq-t'))
ok('estimate: create', createEstimate(d, 'rq-t', 'es-t'))
ok('estimate: lines with a 20 % discount', saveLines(d, 'es-t', [
  { id: 'l1', kind: 'part', itemId: 'it-pads', qty: 1, price: 50_000, discountPct: 20, coverage: 'paid' },
  { id: 'l2', kind: 'part', itemId: 'it-disc', qty: 2, price: 65_000, discountPct: 0, coverage: 'paid' },
  { id: 'l3', kind: 'labor', itemId: 'sv-mech', qty: 2, price: 25_000, discountPct: 0, coverage: 'paid' },
]))
ok('estimate: submit (discount over the limit → workshop manager)', submit(d, 'es-t'))
check('estimate: pending approval', d.estimates.find((e) => e.id === 'es-t')!.status === 'pendingApproval')
const apId = d.approvals.find((a) => a.estimateId === 'es-t' && a.status === 'pending')!.id
refused('approval: advisor cannot decide', decide(d, apId, true, ''), 'لـ')
as(d, 'u-wm', 'workshopManager')
ok('approval: workshop manager approves', decide(d, apId, true, 'الخصم مبرر — عميل دائم'))
as(d, 'u-adv', 'advisor')
ok('acceptance: customer accepts by phone', recordAcceptance(d, 'es-t', 'accepted', 'phone', ''))
ok('WO: create from estimate, planned for Hassan', createFromEstimate(d, 'es-t', 'wo-t', { billingPartnerId: 'p-ahmed', leadTechnicianId: 't-hassan', depositRequired: 50_000 }))
const w = () => d.workOrders.find((x) => x.id === 'wo-t')!
check('WO: planned, request closed', w().status === 'planned' && d.requests.find((r) => r.id === 'rq-t')!.status === 'closed')
ok('deposit: 50,000 on account', receiveDeposit(d, 'wo-t', 50_000, 'rc-t'))
refused('booking: Hassan clashes with SCH-…004 at 10:00', createBooking(d, { kind: 'workshop', date: d.asOf, start: '10:00', end: '12:00', technicianIds: ['t-hassan'], bayId: 'bay-3', workOrderIds: ['wo-t'] }, 'bk-t'), 'محجوز')
ok('booking: 13:00–16:00 on bay 3', createBooking(d, { kind: 'workshop', date: d.asOf, start: '13:00', end: '16:00', technicianIds: ['t-hassan'], bayId: 'bay-3', workOrderIds: ['wo-t'] }, 'bk-t'))
check('booking: WO scheduled', w().status === 'scheduled')
as(d, 'u-wm', 'workshopManager')
const padsFree = () => { const s = d.stock.find((x) => x.itemId === 'it-pads')!; return s.onHand - s.reserved }
const before = padsFree()
ok('booking: start → WO in progress', startBooking(d, 'bk-t'))
check('start: parts reserved (pads free stock −1)', w().status === 'inProgress' && padsFree() === before - 1)
w().parts.forEach((p) => setConsumed(d, 'wo-t', p.id, p.plannedQty))
ok('time: Hassan 2.5 h', addTime(d, 'wo-t', { technicianId: 't-hassan', date: d.asOf, hours: 2.5, category: 'regular' }))
ok('booking: complete with the operation done', completeBooking(d, 'bk-t', w().operations.map((o) => o.id)))
check('booking complete: WO stays in progress, op linked', w().status === 'inProgress' && w().operations.every((o) => o.done && o.doneByBookingId === 'bk-t'))
ok('QC: refer', toQualityCheck(d, 'wo-t'))
ok('QC: pass', qualityResult(d, 'wo-t', true, ''))
refused('complete: failure code required', complete(d, 'wo-t', {}), 'كود العطل')
ok('complete: with BRK-WEAR and handover meter', complete(d, 'wo-t', { failureCodeId: 'fc-brk', repairReason: 'أقراص متآكلة', meterAtHandover: 84_410 }))
const gi = d.goodsIssues.find((g) => g.workOrderId === 'wo-t')
check('issue: automatic goods issue, balanced journal, Dr 5110', !!gi && balanced(gi.journal) && gi.journal[0].account === '5110' && w().consumptionStatus === 'posted')
check('issue: stock reservations released', w().parts.every((p) => p.reservedQty === 0 && p.issuedQty === p.plannedQty))
ok('time: supervisor confirms', confirmTime(d, 'wo-t'))
refused('close: refused before invoicing', close(d, 'wo-t'), 'لم يُفوتر')
as(d, 'u-acc', 'accountant')
ok('invoice: generate', generateInvoice(d, 'wo-t', 'inv-t'))
const inv = () => d.invoices.find((i) => i.id === 'inv-t')!
check('invoice: 220,000 (pads after 20 %), deposit applied → partly paid', inv().total === 220_000 && inv().paidAmount === 50_000 && inv().paymentStatus === 'P' && balanced(inv().journal))
// ---------- 5. billing cancel cycle on the same invoice ----------
refused('cancel: refused while the deposit is applied', cancelInvoice(d, 'inv-t', 'خطأ'), 'مسددة')
ok('cancel: reverse the deposit application', reverseApplication(d, d.applications.find((a) => a.invoiceId === 'inv-t')!.id))
ok('cancel: invoice cancelled', cancelInvoice(d, 'inv-t', 'خطأ في السعر'))
check('cancel: WO invoice-cancelled, deposit back on account', w().billingStatus === 'invoiceCancelled' && d.receipts.find((r) => r.id === 'rc-t')!.applied === 0)
ok('reopen billing', reopenBilling(d, 'wo-t'))
ok('invoice: batch 2', generateInvoice(d, 'wo-t', 'inv-t2'))
const inv2 = d.invoices.find((i) => i.id === 'inv-t2')!
check('invoice batch 2: deposit re-applied', inv2.batchNo === 2 && inv2.paidAmount === 50_000)
ok('payment: remaining balance', receivePayment(d, 'inv-t2', balance(inv2), 'rc-t2'))
check('payment: invoice settled (C)', inv2.paymentStatus === 'C')
as(d, 'u-wm', 'workshopManager')
ok('close: BR-M-19 satisfied', close(d, 'wo-t'))

// ---------- 3. rework ----------
as(d, 'u-adv', 'advisor')
ok('rework: new request on the same car marked as rework', createRequest(d, { assetId: 'as-01', maintenanceTypeId: 'mt-car', complaint: 'عاد الاهتزاز', accessories: '', channel: 'walkIn', receiveNow: true, markRework: true }, 'rq-r'))
check('rework: linked to the original WO', d.requests.find((r) => r.id === 'rq-r')!.reworkOfWorkOrderId === 'wo-t')
ok('rework: estimate', createEstimate(d, 'rq-r', 'es-r'))
const esr = d.estimates.find((e) => e.id === 'es-r')!
ok('rework: lines', saveLines(d, 'es-r', [...esr.lines, { id: 'r1', kind: 'labor', itemId: 'sv-mech', qty: 1, price: 25_000, discountPct: 0, coverage: 'goodwill' }]))
ok('rework: submit', submit(d, 'es-r'))
as(d, 'u-wm2', 'workshopManager')
const apr = d.approvals.find((a) => a.estimateId === 'es-r' && a.status === 'pending')
if (apr) ok('rework: approve goodwill', decide(d, apr.id, true, 'ضمن فترة إعادة العمل'))
as(d, 'u-adv', 'advisor')
ok('rework: customer accepts', recordAcceptance(d, 'es-r', 'accepted', 'inPerson', ''))
ok('rework: WO', createFromEstimate(d, 'es-r', 'wo-r', { billingPartnerId: 'p-ahmed' }))
const wr = d.workOrders.find((x) => x.id === 'wo-r')!
check('rework WO: goodwill, goodwill expense type, not billable', wr.reworkOfId === 'wo-t' && wr.expenseTypeId === 'et-gw' && wr.billingStatus === 'notBillable' && wr.services.every((s) => s.coverage === 'goodwill'))

// ---------- 4. failed consumption + retry ----------
as(d, 'u-wh', 'warehouse')
const c13 = d.workOrders.find((x) => x.number === 'MWO-2026-000042')!
check('failed: seeded forklift WO is failed and keeps its reservation', c13.consumptionStatus === 'failed' && c13.parts.every((p) => p.reservedQty === p.consumedQty))
ok('failed: retry posts the issue', retryConsumption(d, c13.id))
check('failed: posted once, key WO:…:C1', c13.consumptionStatus === 'posted' && d.goodsIssues.filter((g) => g.workOrderId === c13.id).length === 1 && d.goodsIssues.find((g) => g.workOrderId === c13.id)!.idempotencyKey.endsWith(':C1'))
refused('failed: a second retry is refused', retryConsumption(d, c13.id), 'لا يوجد صرف')
as(d, 'u-tec', 'technician')
const c07 = d.workOrders.find((x) => x.number === 'MWO-2026-000036')!
c07.parts.forEach((p) => setConsumed(d, c07.id, p.id, p.plannedQty))
ok('booking: completing a WO ends its running booking', complete(d, c07.id, { failureCodeId: 'fc-bat', repairReason: 'بطارية منتهية' }))
check('booking: SCH-…005 completed with the WO', d.bookings.find((b) => b.number === 'SCH-2026-000005')!.status === 'completed')
const sensor = d.workOrders.find((x) => x.number === 'MWO-2026-000032')!
as(d, 'u-wm', 'workshopManager')
refused('stock: sensor WO cannot start (BR-M-11)', start(d, sensor.id), 'حساس أوكسجين')

console.log(fails ? `\n${fails} check(s) failed` : '\nmaintenance flow: OK')
if (fails) process.exit(1)
