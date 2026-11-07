import { today } from './asof'
import type {
  ApprovalStatus, BillingStatus, BookingStatus, ConsumptionStatus, Coverage, Disposition, EstimateStatus, ExpenseScope,
  LineKind, MaintKind, PaymentStatus, RequestStatus, WorkOrderStatus,
} from './types'

export type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue'

export const num = (n: number, d = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const iqd = (n: number) => `${num(n)} د.ع`
export const pct = (n: number) => `${num(n, 1)}%`

export const months = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']
export const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
/** 2026-11-07 -> 7 تشرين الثاني 2026 */
export const fmtDate = (d?: string) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return `${day} ${months[m - 1]} ${y}`
}
export const fmtDateTime = (d?: string) => (d ? `${fmtDate(d)} ${d.length > 10 ? d.slice(11, 16) : ''}`.trim() : '—')
export const dayName = (d: string) => { const [y, m, day] = d.split('-').map(Number); return dayNames[new Date(Date.UTC(y, m - 1, day)).getUTCDay()] }
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`
export const nowStamp = () => `${today()}T${new Date().toTimeString().slice(0, 5)}`

type Meta<K extends string> = Record<K, { label: string; tone: Tone }>

export const requestStatus: Meta<RequestStatus> = {
  draft: { label: 'مسودة', tone: 'gray' }, received: { label: 'مستلم', tone: 'blue' }, inDiagnosis: { label: 'قيد التشخيص', tone: 'blue' },
  awaitingApproval: { label: 'بانتظار الاعتماد', tone: 'amber' }, approved: { label: 'معتمد', tone: 'green' }, closed: { label: 'مغلق', tone: 'gray' },
  rejected: { label: 'مرفوض', tone: 'red' }, cancelled: { label: 'ملغى', tone: 'red' },
}
export const estimateStatus: Meta<EstimateStatus> = {
  draft: { label: 'مسودة', tone: 'gray' }, pendingApproval: { label: 'بانتظار الاعتماد', tone: 'amber' }, approved: { label: 'معتمد', tone: 'green' },
  rejected: { label: 'مرفوض', tone: 'red' }, superseded: { label: 'نسخة سابقة', tone: 'gray' }, expired: { label: 'منتهي الصلاحية', tone: 'red' },
  cancelled: { label: 'ملغى', tone: 'red' },
}
export const approvalStatus: Meta<ApprovalStatus> = {
  pending: { label: 'بانتظار القرار', tone: 'amber' }, approved: { label: 'معتمد', tone: 'green' }, rejected: { label: 'مرفوض', tone: 'red' },
  withdrawn: { label: 'مسحوب', tone: 'gray' }, notRequired: { label: 'لا يحتاج اعتمادًا', tone: 'blue' }, waiting: { label: 'لم يصل بعد', tone: 'gray' },
}
export const woStatus: Meta<WorkOrderStatus> = {
  created: { label: 'منشأ', tone: 'gray' }, planned: { label: 'مخطط', tone: 'blue' }, scheduled: { label: 'مجدول', tone: 'blue' },
  inProgress: { label: 'قيد التنفيذ', tone: 'amber' }, waitingParts: { label: 'بانتظار قطع', tone: 'red' }, waitingCustomer: { label: 'بانتظار العميل', tone: 'amber' },
  onHold: { label: 'معلّق', tone: 'gray' }, qualityCheck: { label: 'فحص الجودة', tone: 'blue' }, completed: { label: 'مكتمل', tone: 'green' },
  closed: { label: 'مغلق', tone: 'gray' }, cancelled: { label: 'ملغى', tone: 'red' },
}
export const consumptionStatus: Meta<ConsumptionStatus> = {
  notRequired: { label: 'لا يلزم صرف', tone: 'gray' }, pending: { label: 'بانتظار الصرف', tone: 'amber' }, posted: { label: 'مصروف', tone: 'green' },
  failed: { label: 'فشل الصرف', tone: 'red' },
}
export const billingStatus: Meta<BillingStatus> = {
  notInvoiced: { label: 'غير مفوتر', tone: 'amber' }, invoiced: { label: 'مفوتر', tone: 'green' }, invoiceCancelled: { label: 'فاتورة ملغاة', tone: 'red' },
  notBillable: { label: 'غير قابل للفوترة', tone: 'gray' },
}
export const bookingStatus: Meta<BookingStatus> = {
  scheduled: { label: 'مجدول', tone: 'blue' }, rescheduled: { label: 'أُعيدت جدولته', tone: 'amber' }, inProgress: { label: 'قيد التنفيذ', tone: 'amber' },
  completed: { label: 'مكتمل', tone: 'green' }, cancelled: { label: 'ملغى', tone: 'red' },
}
export const paymentStatus: Meta<PaymentStatus> = {
  O: { label: 'مفتوحة', tone: 'amber' }, P: { label: 'مدفوعة جزئيًا', tone: 'blue' }, C: { label: 'مسددة', tone: 'green' },
}
export const coverageLabel: Record<Coverage, string> = { paid: 'مدفوع', warranty: 'ضمان', goodwill: 'حسن نية' }
export const lineKindLabel: Record<LineKind, string> = { part: 'قطعة', labor: 'عمالة', service: 'خدمة' }
export const maintKindLabel: Record<MaintKind, string> = { workshop: 'ورشة', field: 'ميداني', internal: 'داخلي' }
export const scopeLabel: Record<ExpenseScope, string> = { customer: 'بيع لعميل', warranty: 'ضمان', internal: 'داخلي', goodwill: 'حسن نية' }
export const dispositionLabel: Record<Disposition, string> = { returnedToCustomer: 'أُعيدت للعميل', scrapped: 'أُتلفت', returnedToVendor: 'أُرجعت للمورد' }
/** "09:00–12:00" kept left-to-right inside RTL text (Unicode isolate), so the range never reads backwards. */
export const timeRange = (start: string, end: string) => `⁦${start}–${end}⁩`
