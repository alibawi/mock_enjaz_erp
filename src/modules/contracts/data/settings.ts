// System settings that change mock behaviour (plan ADR-17/18/25, doc 09). Read at action time via getSetting(db, key).
import type { DB, SettingKey, SettingValue } from './types'

export interface SettingDef {
  key: SettingKey
  group: string
  label: string
  description: string
  kind: 'select' | 'text' | 'number' | 'bool'
  options?: { value: string; label: string }[]
  default: SettingValue
}

export const settingDefs: SettingDef[] = [
  { key: 'Agreements.EnforcementMode', group: 'الاتفاقيات', label: 'وضع الإنفاذ عند تجاوز الالتزام', kind: 'select', default: 'Warn',
    description: 'تحذير: يُسمح بالمستند مع تحذير. منع: يُرفض المستند عند تجاوز الحد الأقصى. تتبع فقط: لا تحذير ولا منع.',
    options: [{ value: 'None', label: 'تتبع فقط' }, { value: 'Warn', label: 'تحذير' }, { value: 'Block', label: 'منع' }] },
  { key: 'Agreements.FulfillmentBasis', group: 'الاتفاقيات', label: 'متى تُحتسب الكمية مستهلكة', kind: 'select', default: 'Order',
    description: 'يحدد العدّاد الذي يُحتسب منه المتبقي: الأمر أو التسليم/الاستلام أو الفاتورة.',
    options: [{ value: 'Order', label: 'عند أمر البيع/الشراء' }, { value: 'Delivery', label: 'عند التسليم/الاستلام' }, { value: 'Invoice', label: 'عند الفاتورة' }] },
  { key: 'Agreements.ReturnsRestoreCommitment', group: 'الاتفاقيات', label: 'إعادة المرتجع إلى رصيد العقد', kind: 'bool', default: true,
    description: 'عند تفعيله تعود كمية المرتجع (بعد الحركة المخزنية) إلى المتبقي من العقد.' },
  { key: 'Agreements.OnFulfillmentFailure', group: 'الاتفاقيات', label: 'عند فشل معالج العقد', kind: 'select', default: 'Rollback',
    description: 'إلغاء المستند مع رسالة، أو حفظ المستند مع وسم Exceeded وتنبيه المسؤول.',
    options: [{ value: 'Rollback', label: 'إلغاء المستند' }, { value: 'KeepAndAlert', label: 'حفظ المستند مع تنبيه' }] },
  { key: 'Currency.ConversionRateSource', group: 'العملة', label: 'سعر تحويل عملة المستند إلى عملة العقد', kind: 'select', default: 'ActivationRate',
    description: 'سعر الصرف المسجل عند تفعيل العقد (ثابت)، أو سعر تاريخ المستند.',
    options: [{ value: 'ActivationRate', label: 'سعر تفعيل العقد' }, { value: 'DocumentDateRate', label: 'سعر تاريخ المستند' }] },
  { key: 'Reminder.Days', group: 'التنبيهات', label: 'أيام تنبيه الانتهاء', kind: 'text', default: '30,15,7,1', description: 'قائمة أيام مفصولة بفواصل قبل تاريخ الانتهاء.' },
  { key: 'Reminder.NoticeDays', group: 'التنبيهات', label: 'أيام تنبيه مهلة الإشعار', kind: 'text', default: '14,7,1', description: 'قبل آخر موعد للإشعار بعدم التجديد.' },
  { key: 'Renewal.GraceDays', group: 'التنبيهات', label: 'مدة السماح لتجديد عقد منتهٍ (يوم)', kind: 'number', default: 90, description: 'يمكن تمديد أو تجديد العقد المنتهي خلال هذه المدة.' },
  { key: 'Approval.ReminderDays', group: 'التنبيهات', label: 'تذكير بالاعتماد المعلّق بعد (يوم)', kind: 'number', default: 2, description: 'يُنبَّه المعتمد الحالي بعد هذه المدة.' },
  { key: 'Approval.AllowCreatorApproval', group: 'الاعتماد', label: 'السماح لمنشئ العقد باعتماده', kind: 'bool', default: false, description: 'الأصل: يُمنع المنشئ من اعتماد عقده (فصل المهام).' },
  { key: 'Schedule.MaxDeferralsPerItem', group: 'جدول الدفعات', label: 'أقصى عدد لتأجيل القسط الواحد', kind: 'number', default: 3, description: 'بعده لا يُؤجَّل القسط إلا بملحق.' },
  { key: 'Schedule.AllowBeyondEndDate', group: 'جدول الدفعات', label: 'السماح بتأجيل قسط إلى ما بعد انتهاء العقد', kind: 'bool', default: false, description: 'الأصل: تاريخ القسط الجديد لا يتجاوز تاريخ انتهاء العقد (إلا العقود مفتوحة المدة).' },
  { key: 'Feature.Obligations', group: 'تفعيل الميزات', label: 'الالتزامات والدفعات', kind: 'bool', default: true, description: 'إخفاء/إظهار تبويبات وقوائم الالتزامات والمالية.' },
  { key: 'Feature.Templates', group: 'تفعيل الميزات', label: 'القوالب والبنود والطباعة', kind: 'bool', default: true, description: 'إخفاء/إظهار القوالب والبنود.' },
  { key: 'Feature.Service', group: 'تفعيل الميزات', label: 'عقود الخدمة', kind: 'bool', default: true, description: 'إخفاء/إظهار عقود الخدمة واتفاقيات مستوى الخدمة.' },
  { key: 'Feature.ESignature', group: 'تفعيل الميزات', label: 'التوقيع الإلكتروني', kind: 'bool', default: true, description: 'يعمل في الخطة الحقيقية بمزوّد عند طلب العميل؛ هنا بمزوّد تجريبي.' },
  { key: 'Feature.RecurringBilling', group: 'تفعيل الميزات', label: 'الفوترة الدورية التلقائية', kind: 'bool', default: true, description: 'إنشاء مستندات الفوترة من جدول الدفعات عبر المبيعات والمشتريات.' },
]

export const defaultSettings = () =>
  Object.fromEntries(settingDefs.map((d) => [d.key, d.default])) as Record<SettingKey, SettingValue>

export const getSetting = <T extends SettingValue = SettingValue>(db: DB, key: SettingKey): T =>
  (db.settings[key] ?? settingDefs.find((d) => d.key === key)!.default) as T

export const daysSetting = (db: DB, key: 'Reminder.Days' | 'Reminder.NoticeDays') =>
  String(getSetting(db, key)).split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a)
