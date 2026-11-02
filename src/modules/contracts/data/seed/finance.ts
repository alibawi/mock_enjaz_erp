// Module 5 seed: obligations, recurrence occurrences, payment schedules (some already billed through the real billing engine), guarantees.
import { cancelOnTermination, generateOccurrences } from '../obligations'
import { changeLines, decideChange, previewFromTerm, requestChange } from '../installments'
import { createBilling, recordPayment } from '../payments'
import type { BillingDocType, DB, Obligation, ObligationKind, PaymentItem, PaymentKind, PenaltyType, Recurrence } from '../types'

let n = 0
const O = (contractId: string, kind: ObligationKind, title: string, dueDate: string, x: Partial<Obligation> = {}): Obligation => ({
  id: `obl-${String(++n).padStart(2, '0')}`, contractId, kind, title, description: '', dueDate, status: 'Planned', acceptanceRequired: kind !== 'Reporting', survivesTermination: false,
  penaltyType: 'None' as PenaltyType, attachments: [], createdBy: 'u-mgr', createdAt: '2026-01-10T09:00', ...x,
})
const monthly = (until: string): Recurrence => ({ freq: 'monthly', until })

const obligations: Obligation[] = [
  // c-16 maintenance of hospital generators
  O('c-16', 'SLA', 'زيارة صيانة وقائية — الربع الثالث', '2026-09-30', { responsibleEmployeeId: 'emp-13', responsibleDepartment: 'الصيانة', status: 'Accepted', completedOn: '2026-09-28', completedBy: 'u-mgr', acceptedOn: '2026-09-29', acceptedBy: 'u-leg' }),
  O('c-16', 'SLA', 'زيارة صيانة وقائية — الربع الرابع', '2026-12-15', { responsibleEmployeeId: 'emp-13', responsibleDepartment: 'الصيانة' }),
  O('c-16', 'Reporting', 'تقرير شهري عن أداء المولدات', '2026-08-05', { responsibleEmployeeId: 'emp-13', recurrence: monthly('2027-01-31') }),
  // c-17 electrical network maintenance
  O('c-17', 'Milestone', 'تسليم مخطط الشبكة المحدّث', '2026-09-30', { responsibleEmployeeId: 'emp-12', value: 40_000_000, status: 'Accepted', completedOn: '2026-09-29', completedBy: 'u-mgr', acceptedOn: '2026-10-01', acceptedBy: 'u-leg', linkedPaymentItemId: 'pay-09' }),
  O('c-17', 'Milestone', 'تنفيذ أعمال المرحلة الأولى', '2026-10-25', { responsibleEmployeeId: 'emp-12', value: 60_000_000, status: 'InProgress', dependsOnId: 'obl-04', penaltyType: 'FixedPerDay', penaltyRate: 500_000, penaltyCap: 10_000_000, linkedPaymentItemId: 'pay-10' }),
  O('c-17', 'Milestone', 'الاستلام الابتدائي', '2026-12-20', { responsibleEmployeeId: 'emp-12', value: 45_000_000, dependsOnId: 'obl-05', linkedPaymentItemId: 'pay-11' }),
  // c-25 warehouse expansion (on hold)
  O('c-25', 'Milestone', 'الحصول على الترخيص البلدي', '2026-08-30', { responsibleEmployeeId: 'emp-12', value: 234_000_000, status: 'InProgress', penaltyType: 'PercentPerDay', penaltyRate: 0.01, penaltyCap: 11_700_000 }),
  O('c-25', 'Deliverable', 'مخططات التنفيذ المعتمدة', '2026-04-30', { responsibleEmployeeId: 'emp-12', status: 'Accepted', completedOn: '2026-04-28', completedBy: 'u-mgr', acceptedOn: '2026-05-02', acceptedBy: 'u-leg' }),
  O('c-25', 'Milestone', 'إنجاز أعمال الأساسات', '2026-11-30', { responsibleEmployeeId: 'emp-12', value: 234_000_000, linkedPaymentItemId: 'pay-15' }),
  // c-01 sales agreement
  O('c-01', 'Deliverable', 'تسليم دفعة الإسمنت الرابعة', '2026-12-15', { responsibleEmployeeId: 'emp-5', quantity: 2500 }),
  O('c-01', 'Deliverable', 'شحنة الرمل المتفق عليها', '2026-10-28', { responsibleEmployeeId: 'emp-5', quantity: 1500, value: 27_750_000, penaltyType: 'PercentPerDay', penaltyRate: 0.1, penaltyCap: 1_387_500 }),
  O('c-01', 'Reporting', 'كشف حساب ربع سنوي للعميل', '2026-09-30', { responsibleEmployeeId: 'emp-7', recurrence: { freq: 'monthly', count: 6 } }),
  // c-09 procurement frame
  O('c-09', 'Payment', 'سداد فاتورة المورد', '2026-11-10', { responsibleEmployeeId: 'emp-7', linkedPaymentItemId: 'pay-18', value: 92_000_000 }),
  O('c-09', 'Deliverable', 'استلام شحنة الربع الرابع من الإسمنت', '2026-12-20', { responsibleEmployeeId: 'emp-6', quantity: 3000 }),
  // c-03 rebar, USD
  O('c-03', 'Deliverable', 'الشحنة الأخيرة قبل انتهاء العقد', '2026-11-05', { responsibleEmployeeId: 'emp-5', status: 'InProgress', quantity: 100, penaltyType: 'Fixed', penaltyRate: 5000, penaltyCap: 5000 }),
  // c-22 lease
  O('c-22', 'Payment', 'دفعة إيجار الربع الرابع', '2026-10-01', { responsibleEmployeeId: 'emp-7', linkedPaymentItemId: 'pay-08', value: 24_000_000, penaltyType: 'FixedPerDay', penaltyRate: 100_000, penaltyCap: 3_000_000 }),
  O('c-22', 'Other', 'تجديد التأمين على المخزن', '2026-12-01', { responsibleEmployeeId: 'emp-1' }),
  // c-02 general (bonus) agreement
  O('c-02', 'Reporting', 'تقرير استهلاك الالتزام الشهري', '2026-09-30', { responsibleEmployeeId: 'emp-5', recurrence: monthly('2026-12-05') }),
  // c-10 / c-11 purchases
  O('c-10', 'Deliverable', 'شحنة حديد التسليح — تشرين الثاني', '2026-11-15', { responsibleEmployeeId: 'emp-6', quantity: 150 }),
  O('c-10', 'Milestone', 'فحص جودة الحديد المستلم', '2026-11-01', { responsibleEmployeeId: 'emp-4' }),
  O('c-11', 'Deliverable', 'استلام المحولات (أُعيد لعيب في العزل)', '2026-10-20', { responsibleEmployeeId: 'emp-6', quantity: 4, status: 'Rejected', penaltyType: 'FixedPerDay', penaltyRate: 250, penaltyCap: 5000 }),
  // c-23 NDA, c-24 legal advice, c-05 furniture, c-14 terminated
  O('c-23', 'Other', 'الالتزام بسرية المعلومات', '2029-10-14', { responsibleEmployeeId: 'emp-4', acceptanceRequired: false, survivesTermination: true }),
  O('c-24', 'Reporting', 'رأي قانوني شهري', '2026-09-01', { responsibleEmployeeId: 'emp-4', recurrence: monthly('2026-12-31') }),
  O('c-05', 'Deliverable', 'تسليم دفعة الأثاث', '2026-11-30', { responsibleEmployeeId: 'emp-5', quantity: 40 }),
  O('c-14', 'Deliverable', 'شحنة وقود الربع الثالث', '2026-09-30', { responsibleEmployeeId: 'emp-6' }),
  O('c-14', 'Other', 'ضمان جودة الوقود المستلم', '2027-06-30', { responsibleEmployeeId: 'emp-4', survivesTermination: true, acceptanceRequired: false }),
]

let pn = 0
const P = (contractId: string, itemNo: number, kind: PaymentKind, dueDate: string, amount: number, x: Partial<PaymentItem> = {}): PaymentItem => ({
  id: `pay-${String(++pn).padStart(2, '0')}`, contractId, itemNo, kind, dueDate, amount, currency: 'IQD', status: 'Planned', notes: '', ...x,
})
const inv = (t: BillingDocType) => ({ billingDocType: t })
const payments: PaymentItem[] = [
  P('c-16', 1, 'Periodic', '2026-03-01', 27_000_000, { percent: 25, ...inv('SaleInvoice') }), P('c-16', 2, 'Periodic', '2026-06-01', 27_000_000, { percent: 25, ...inv('SaleInvoice') }),
  P('c-16', 3, 'Periodic', '2026-09-01', 27_000_000, { percent: 25, ...inv('SaleInvoice') }), P('c-16', 4, 'Periodic', '2026-12-01', 27_000_000, { percent: 25, ...inv('SaleInvoice') }),
  P('c-22', 1, 'Periodic', '2026-01-05', 24_000_000, { percent: 25, ...inv('PurchaseBill') }), P('c-22', 2, 'Periodic', '2026-04-05', 24_000_000, { percent: 25, ...inv('PurchaseBill') }),
  P('c-22', 3, 'Periodic', '2026-07-05', 24_000_000, { percent: 25, ...inv('PurchaseBill') }), P('c-22', 4, 'Periodic', '2026-10-01', 24_000_000, { percent: 25, obligationId: 'obl-16', ...inv('PurchaseBill') }),
  P('c-17', 1, 'Advance', '2026-07-05', 30_000_000, { percent: 20, ...inv('SaleInvoice') }), P('c-17', 2, 'Milestone', '2026-10-15', 60_000_000, { percent: 40, obligationId: 'obl-05', ...inv('SaleInvoice') }),
  P('c-17', 3, 'Milestone', '2026-11-05', 45_000_000, { percent: 30, obligationId: 'obl-06', ...inv('SaleInvoice') }), P('c-17', 4, 'Retention', '2027-06-30', 15_000_000, { percent: 10, ...inv('SaleInvoice') }),
  P('c-25', 1, 'Advance', '2026-03-10', 156_000_000, { percent: 20, ...inv('PurchaseBill') }), P('c-25', 2, 'Milestone', '2026-06-30', 234_000_000, { percent: 30, ...inv('PurchaseBill') }),
  P('c-25', 3, 'Milestone', '2026-11-30', 234_000_000, { percent: 30, obligationId: 'obl-09', ...inv('PurchaseBill') }), P('c-25', 4, 'Final', '2027-02-28', 156_000_000, { percent: 20, ...inv('PurchaseBill') }),
  P('c-09', 1, 'Periodic', '2026-10-25', 92_000_000, { agreementLineNum: 1, ...inv('PurchaseBill'), notes: '1000 طن من البند 1' }), P('c-09', 2, 'Periodic', '2026-11-10', 92_000_000, { agreementLineNum: 1, obligationId: 'obl-13', ...inv('PurchaseBill') }),
  P('c-01', 1, 'Periodic', '2026-10-20', 190_000_000, { agreementLineNum: 1, ...inv('SaleInvoice'), notes: '2000 طن من البند 1' }), P('c-01', 2, 'Periodic', '2026-12-10', 142_500_000, { agreementLineNum: 1, ...inv('SaleInvoice') }),
]

export function financeSeed(db: DB) {
  db.obligations = obligations.map((o) => structuredClone(o)); db.occurrences = []; db.paymentItems = payments.map((p) => structuredClone(p)); db.billingLog = []
  // obligations for the recurring set start from the contract month; generate, then close the past ones
  db.asOf = '2026-10-30'
  generateOccurrences(db)
  db.occurrences.forEach((x) => { if (x.dueDate < '2026-10-20' && x.status === 'Planned') { x.status = 'Completed'; x.completedOn = x.dueDate } })
  const terminated = db.contracts.find((c) => c.id === 'c-14')
  if (terminated) cancelOnTermination(db, terminated)

  // history of paid/billed items: written through the billing engine at a past date, then settled
  const admin = db.userId
  const billed: [string, number | 'unknown'][] = [['pay-01', 27_000_000], ['pay-02', 27_000_000], ['pay-03', 27_000_000], ['pay-05', 24_000_000], ['pay-06', 24_000_000], ['pay-07', 24_000_000],
    ['pay-09', 30_000_000], ['pay-10', 'unknown'], ['pay-13', 156_000_000], ['pay-14', 234_000_000]]
  db.userId = 'u-fin'
  billed.forEach(([id, paid]) => {
    const it = db.paymentItems.find((p) => p.id === id)!
    const e = createBilling(db, id)
    if (e) throw new Error(`finance seed ${id}: ${e}`)
    const rec = db.billingLog.find((b) => b.paymentItemId === id)!
    rec.date = it.dueDate
    if (paid !== 'unknown') recordPayment(db, id, paid, it.dueDate)
  })
  installmentsSeed(db)
  db.userId = admin
  db.guarantees = [
    { id: 'gar-1', contractId: 'c-25', type: 'Performance', amount: 78_000_000, currency: 'IQD', issuer: 'مصرف الرافدين — فرع الكرادة', expiryDate: '2026-11-20', status: 'Active' },
    { id: 'gar-2', contractId: 'c-17', type: 'Advance', amount: 30_000_000, currency: 'IQD', issuer: 'مصرف بغداد', expiryDate: '2026-11-04', status: 'Active' },
    { id: 'gar-3', contractId: 'c-01', type: 'Performance', amount: 128_400_000, currency: 'IQD', issuer: 'المصرف الأهلي العراقي', expiryDate: '2027-01-14', status: 'Active' },
    { id: 'gar-4', contractId: 'c-09', type: 'Performance', amount: 99_300_000, currency: 'IQD', issuer: 'مصرف الرشيد', expiryDate: '2026-12-31', status: 'Active' },
    { id: 'gar-5', contractId: 'c-04', type: 'Retention', amount: 41_150_000, currency: 'IQD', issuer: 'مصرف بغداد', expiryDate: '2027-04-30', status: 'Active' },
  ]
}

/** Plan doc 16: schedules generated from installment payment terms, one approved deferral, one pending split, one partial payment. */
function installmentsSeed(db: DB) {
  const gen = (contractId: string, termId: string, base: string) => {
    const c = db.contracts.find((x) => x.id === contractId)!
    const items = previewFromTerm(db, c, termId, base).map((p) => ({ ...p, id: `pay-${contractId.slice(2)}-${p.itemNo}` }))
    db.paymentItems.push(...items)
  }
  const bill = (id: string, paid?: number) => {
    const it = db.paymentItems.find((p) => p.id === id)!
    const e = createBilling(db, id)
    if (e) throw new Error(`installments seed ${id}: ${e}`)
    db.billingLog.find((b) => b.paymentItemId === id)!.date = it.dueDate
    if (paid !== undefined) recordPayment(db, id, paid, it.dueDate)
  }
  const as = (u: string, f: () => string | null) => { const p = db.userId; db.userId = u; const e = f(); db.userId = p; if (e) throw new Error(`installments seed: ${e}`) }

  // c-24 legal advice: four quarterly installments; the third was deferred once with approval
  gen('c-24', 'pt-q4', '2026-01-01')
  bill('pay-24-1', 12_000_000); bill('pay-24-2', 12_000_000)
  as('u-fin', () => requestChange(db, { contractId: 'c-24', kind: 'Defer', itemIds: ['pay-24-3'], lines: changeLines(db, 'Defer', ['pay-24-3'], [{ dueDate: '2026-11-20', amount: 0 }]), reason: 'طلب المكتب تأجيل القسط لحين إنجاز المذكرة السنوية' }))
  as('u-mgr', () => decideChange(db, db.scheduleChanges[db.scheduleChanges.length - 1].id, true, 'موافق — مرة واحدة'))

  // c-18 equipment warranty (USD): 20 % advance + four installments; one partly paid, one overdue under a pending split
  gen('c-18', 'pt-a20', '2026-05-01')
  bill('pay-18-1', 9000); bill('pay-18-2', 5000)
  as('u-fin', () => requestChange(db, { contractId: 'c-18', kind: 'Split', itemIds: ['pay-18-3'], lines: changeLines(db, 'Split', ['pay-18-3'], [{ dueDate: '2026-11-15', amount: 4500 }, { dueDate: '2026-12-15', amount: 4500 }]), reason: 'العميل طلب تقسيم القسط المتأخر على دفعتين' }))
}
