// Plan doc 09 §3 permissions and doc 03 §7 default roles. The matrix is editable in module 8 (stored in db.rolePerms).
import type { Perm, RoleId } from './types'

export const allPerms: { code: Perm; group: string; label: string }[] = [
  { code: 'Contracts.View', group: 'العقود', label: 'عرض العقود' },
  { code: 'Contracts.Create', group: 'العقود', label: 'إنشاء عقد' },
  { code: 'Contracts.Edit', group: 'العقود', label: 'تعديل المسودة والبيانات غير القانونية' },
  { code: 'Contracts.Delete', group: 'العقود', label: 'حذف مسودة' },
  { code: 'Contracts.Submit', group: 'العقود', label: 'إرسال للاعتماد' },
  { code: 'Contracts.Approve', group: 'العقود', label: 'اعتماد' },
  { code: 'Contracts.Reject', group: 'العقود', label: 'رفض' },
  { code: 'Contracts.Activate', group: 'العقود', label: 'إرسال للتوقيع / تفعيل' },
  { code: 'Contracts.Suspend', group: 'العقود', label: 'تعليق / استئناف' },
  { code: 'Contracts.Terminate', group: 'العقود', label: 'إنهاء / إغلاق' },
  { code: 'Contracts.Cancel', group: 'العقود', label: 'إلغاء مسودة' },
  { code: 'Contracts.Amend', group: 'العقود', label: 'ملاحق وتعديلات' },
  { code: 'Contracts.Renew', group: 'العقود', label: 'تجديد' },
  { code: 'Contracts.ViewConfidential', group: 'العقود', label: 'عرض العقود السرية' },
  { code: 'Contracts.Export', group: 'العقود', label: 'تصدير' },
  { code: 'Attachments.View', group: 'المرفقات', label: 'عرض المرفقات' },
  { code: 'Attachments.Upload', group: 'المرفقات', label: 'رفع مرفق' },
  { code: 'Attachments.Download', group: 'المرفقات', label: 'تنزيل مرفق' },
  { code: 'Attachments.Delete', group: 'المرفقات', label: 'حذف مرفق' },
  { code: 'Fulfillment.Recalculate', group: 'الاتفاقيات', label: 'إعادة احتساب التنفيذ' },
  { code: 'ContractTypes.Manage', group: 'الإعداد', label: 'إدارة أنواع العقود' },
  { code: 'Templates.Manage', group: 'الإعداد', label: 'إدارة القوالب' },
  { code: 'Clauses.Manage', group: 'الإعداد', label: 'إدارة مكتبة البنود' },
  { code: 'Obligations.Manage', group: 'الالتزامات', label: 'إدارة الالتزامات والدفعات' },
  { code: 'Obligations.Complete', group: 'الالتزامات', label: 'إنجاز التزام' },
  { code: 'Obligations.Accept', group: 'الالتزامات', label: 'قبول الإنجاز' },
  { code: 'Schedule.RequestChange', group: 'الالتزامات', label: 'طلب تأجيل/تقسيم/دمج أقساط' },
  { code: 'Schedule.ApproveChange', group: 'الالتزامات', label: 'اعتماد تغيير جدول الأقساط' },
  { code: 'ApprovalDelegations.Manage', group: 'الاعتماد', label: 'إدارة تفويضات الغير' },
  { code: 'Reports.View', group: 'التقارير', label: 'التقارير' },
  { code: 'Settings.Manage', group: 'الإعداد', label: 'إعدادات النظام والصلاحيات' },
]

export const roleLabel: Record<RoleId, string> = {
  requester: 'منشئ عقد',
  approver: 'معتمد',
  manager: 'مدير عقود',
  legal: 'قانوني',
  sales: 'مبيعات',
  procurement: 'مشتريات',
  finance: 'مالية',
  admin: 'مسؤول نظام',
}

const P = (...p: Perm[]) => p
const viewer: Perm[] = ['Contracts.View', 'Attachments.View', 'Attachments.Download']

export const defaultRolePerms: Record<RoleId, Perm[]> = {
  requester: [...viewer, ...P('Contracts.Create', 'Contracts.Edit', 'Contracts.Delete', 'Contracts.Submit', 'Contracts.Cancel', 'Attachments.Upload', 'Obligations.Manage', 'Schedule.RequestChange')],
  approver: [...viewer, ...P('Contracts.Approve', 'Contracts.Reject', 'ApprovalDelegations.Manage', 'Reports.View', 'Schedule.ApproveChange')],
  manager: [...viewer, ...P('Contracts.Create', 'Contracts.Edit', 'Contracts.Submit', 'Contracts.Activate', 'Contracts.Suspend', 'Contracts.Terminate', 'Contracts.Cancel',
    'Contracts.Approve', 'Contracts.Reject', 'Contracts.Amend', 'Contracts.Renew', 'Contracts.Export', 'Attachments.Upload', 'Attachments.Delete', 'Fulfillment.Recalculate', 'Obligations.Manage', 'Obligations.Accept',
    'Templates.Manage', 'ContractTypes.Manage', 'Reports.View', 'ApprovalDelegations.Manage', 'Schedule.RequestChange', 'Schedule.ApproveChange')],
  legal: [...viewer, ...P('Contracts.Approve', 'Contracts.Reject', 'Contracts.ViewConfidential', 'Contracts.Amend', 'Clauses.Manage', 'Templates.Manage', 'Obligations.Accept', 'Reports.View')],
  sales: [...viewer, ...P('Contracts.Create', 'Contracts.Edit', 'Contracts.Submit', 'Attachments.Upload', 'Obligations.Complete', 'Reports.View')],
  procurement: [...viewer, ...P('Contracts.Create', 'Contracts.Edit', 'Contracts.Submit', 'Attachments.Upload', 'Obligations.Complete', 'Reports.View')],
  finance: [...viewer, ...P('Obligations.Manage', 'Obligations.Accept', 'Contracts.Export', 'Reports.View', 'Schedule.RequestChange')],
  admin: allPerms.map((p) => p.code),
}

export const can = (rolePerms: Record<RoleId, Perm[]>, role: RoleId, p: Perm) => rolePerms[role]?.includes(p) ?? false
