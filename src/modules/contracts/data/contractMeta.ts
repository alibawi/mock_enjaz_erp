import type { ClosureReason, Confidentiality, ContractProfile, ContractStatus, Direction, LinkType, PartyRole, RenewalPolicy, SignatureMethod, TypeCategory } from './types'
import type { Tone } from './format'

export const statusLabel: Record<ContractStatus, string> = {
  Draft: 'مسودة', PendingApproval: 'بانتظار الاعتماد', Approved: 'معتمد', PendingSignature: 'بانتظار التوقيع', Active: 'ساري',
  OnHold: 'معلّق', Expired: 'منتهي', Terminated: 'مُنهى', Cancelled: 'ملغى', Closed: 'مغلق',
}
export const statusTone: Record<ContractStatus, Tone> = {
  Draft: 'gray', PendingApproval: 'amber', Approved: 'blue', PendingSignature: 'amber', Active: 'green',
  OnHold: 'amber', Expired: 'red', Terminated: 'red', Cancelled: 'gray', Closed: 'blue',
}
export const statusOrder: ContractStatus[] = ['Draft', 'PendingApproval', 'Approved', 'PendingSignature', 'Active', 'OnHold', 'Expired', 'Terminated', 'Cancelled', 'Closed']

export const profileLabel: Record<ContractProfile, string> = { General: 'عقد عام', Agreement: 'اتفاقية التزام', Service: 'عقد خدمة' }
export const directionLabel: Record<Direction, string> = { Outgoing: 'صادر (مبيعات / عملاء)', Incoming: 'وارد (مشتريات / موردون)', Internal: 'داخلي' }
export const directionShort: Record<Direction, string> = { Outgoing: 'صادر', Incoming: 'وارد', Internal: 'داخلي' }
export const confLabel: Record<Confidentiality, string> = { Normal: 'عادي', Confidential: 'سري', Restricted: 'شديد السرية' }
export const confTone: Record<Confidentiality, Tone> = { Normal: 'gray', Confidential: 'amber', Restricted: 'red' }
export const renewalLabel: Record<RenewalPolicy, string> = { None: 'بلا تجديد', Manual: 'تجديد يدوي', Auto: 'تجديد تلقائي' }
export const categoryLabel: Record<TypeCategory, string> = {
  Sales: 'مبيعات', Procurement: 'مشتريات', Service: 'خدمة وصيانة', Legal: 'قانوني', Lease: 'إيجار', Project: 'مشاريع', Other: 'أخرى',
}
export const partyRoleLabel: Record<PartyRole, string> = {
  Counterparty: 'الطرف الآخر', Guarantor: 'كفيل', Witness: 'شاهد', Subcontractor: 'مقاول من الباطن', Beneficiary: 'مستفيد', Other: 'أخرى',
}
export const sigMethodLabel: Record<SignatureMethod, string> = { Wet: 'توقيع ورقي', Uploaded: 'مستند موقّع مرفوع', ExternalProvider: 'مزوّد توقيع إلكتروني' }
export const closureLabel: Record<ClosureReason, string> = { Completed: 'اكتمل التنفيذ', Renewed: 'جُدِّد بعقد لاحق', Archived: 'أرشفة' }
export const linkTypeLabel: Record<LinkType, string> = { Source: 'مصدر', Release: 'حجز / أمر', Fulfillment: 'تنفيذ', Invoice: 'فاتورة', Related: 'ذو صلة' }
export const profileTone: Record<ContractProfile, Tone> = { General: 'gray', Agreement: 'blue', Service: 'green' }
