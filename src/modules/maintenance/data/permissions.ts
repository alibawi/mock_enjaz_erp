// Role × action matrix — spec-maintenance.md §5. Stored in db.rolePerms so the matrix screen (S21) can toggle it.
import type { Perm, RoleId } from './types'

export const allPerms: { code: Perm; group: string; label: string }[] = [
  { code: 'MasterData.Manage', group: 'الإعداد', label: 'البيانات الرئيسية' },
  { code: 'Settings.Manage', group: 'الإعداد', label: 'إعدادات الوحدة والصلاحيات' },
  { code: 'Assets.Manage', group: 'الأصول', label: 'إنشاء وتعديل الأصول' },
  { code: 'Requests.Create', group: 'الطلبات', label: 'استلام طلب صيانة' },
  { code: 'Estimates.Create', group: 'التقديرات', label: 'إنشاء وإرسال التقدير' },
  { code: 'Estimates.Approve', group: 'التقديرات', label: 'اعتماد التقدير (حسب الشريحة)' },
  { code: 'Estimates.Withdraw', group: 'التقديرات', label: 'سحب التقدير من الاعتماد' },
  { code: 'Estimates.CustomerAcceptance', group: 'التقديرات', label: 'تسجيل موافقة العميل' },
  { code: 'WorkOrders.Create', group: 'أوامر العمل', label: 'إنشاء أمر عمل وتعيين فني' },
  { code: 'WorkOrders.Execute', group: 'أوامر العمل', label: 'بدء وإكمال وتسجيل الساعات' },
  { code: 'WorkOrders.ConfirmTime', group: 'أوامر العمل', label: 'تأكيد ساعات الفنيين' },
  { code: 'WorkOrders.PostConsumption', group: 'أوامر العمل', label: 'إعادة/ترحيل صرف القطع يدويًا' },
  { code: 'WorkOrders.Reopen', group: 'أوامر العمل', label: 'إعادة فتح أمر عمل' },
  { code: 'WorkOrders.ChangeBillingPartner', group: 'أوامر العمل', label: 'تغيير الشريك المُفوتَر' },
  { code: 'WorkOrders.OverrideExpenseType', group: 'أوامر العمل', label: 'تغيير نوع المصروف لسطر' },
  { code: 'Schedule.Manage', group: 'الجدولة', label: 'حجز ونقل وإلغاء المواعيد' },
  { code: 'Billing.Generate', group: 'الفوترة', label: 'إصدار الفاتورة وقبض العربون' },
  { code: 'Billing.Cancel', group: 'الفوترة', label: 'إلغاء الفاتورة وإعادة فتح الفوترة' },
  { code: 'Reports.View', group: 'التقارير', label: 'التقارير' },
]

export const roleLabel: Record<RoleId, string> = {
  advisor: 'موظف استقبال',
  technician: 'فني',
  workshopManager: 'مدير الورشة',
  dispatcher: 'منسق الجدولة',
  warehouse: 'أمين المخزن',
  accountant: 'محاسب',
  financeManager: 'المدير المالي',
  admin: 'مسؤول النظام',
}

const P = (...p: Perm[]) => p

export const defaultRolePerms: Record<RoleId, Perm[]> = {
  advisor: P('Assets.Manage', 'Requests.Create', 'Estimates.Create', 'Estimates.Withdraw', 'Estimates.CustomerAcceptance', 'WorkOrders.Create', 'Schedule.Manage', 'Billing.Generate'),
  technician: P('Estimates.Create', 'Estimates.Withdraw', 'WorkOrders.Execute'),
  workshopManager: P('MasterData.Manage', 'Assets.Manage', 'Requests.Create', 'Estimates.Create', 'Estimates.Approve', 'Estimates.Withdraw', 'Estimates.CustomerAcceptance',
    'WorkOrders.Create', 'WorkOrders.Execute', 'WorkOrders.ConfirmTime', 'WorkOrders.PostConsumption', 'WorkOrders.Reopen', 'WorkOrders.ChangeBillingPartner',
    'WorkOrders.OverrideExpenseType', 'Schedule.Manage', 'Reports.View'),
  dispatcher: P('Schedule.Manage', 'Reports.View'),
  warehouse: P('WorkOrders.PostConsumption'),
  accountant: P('Billing.Generate', 'Billing.Cancel', 'Reports.View'),
  financeManager: P('Estimates.Approve', 'Billing.Cancel', 'Reports.View'),
  admin: allPerms.map((p) => p.code),
}

export const can = (rolePerms: Record<RoleId, Perm[]>, role: RoleId, p: Perm) => rolePerms[role]?.includes(p) ?? false
