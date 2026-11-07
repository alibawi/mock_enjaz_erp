// Module settings validation and save (spec §2 Settings; BR-M-03/04/09/13/14/20). Called inside run().
import { addAudit } from './store'
import { defaultRolePerms } from './permissions'
import type { DB, Perm, RoleId, Settings } from './types'

export function validateSettings(s: Settings): string | null {
  const bands = s.approvalBands
  if (bands.length === 0) return 'أضف شريحة اعتماد واحدة على الأقل'
  if (bands[bands.length - 1].upTo !== null) return 'الشريحة الأخيرة يجب أن تكون بلا حد أعلى'
  for (let i = 0; i < bands.length - 1; i++) {
    const cur = bands[i].upTo
    if (cur === null || cur <= 0) return `حد الشريحة ${i + 1} يجب أن يكون مبلغًا موجبًا`
    const next = bands[i + 1].upTo
    if (next !== null && next <= cur) return 'حدود الشرائح يجب أن تكون تصاعدية'
    if (i > 0 && bands[i].roles.length === 0) return `الشريحة ${i + 1} تحتاج معتمِدًا واحدًا على الأقل`
  }
  if (bands.length > 1 && bands[bands.length - 1].roles.length === 0) return 'الشريحة الأخيرة تحتاج معتمِدًا واحدًا على الأقل'
  if (s.lineDiscountLimitPct < 0 || s.lineDiscountLimitPct > 100) return 'حد خصم السطر بين 0 و 100'
  if (s.depositDefaultPercent < 0 || s.depositDefaultPercent > 100) return 'نسبة العربون الافتراضية بين 0 و 100'
  if (s.reworkWindowDays < 1) return 'مدة إعادة العمل يوم واحد على الأقل'
  if (s.estimateValidityDays < 1) return 'صلاحية التقدير يوم واحد على الأقل'
  if (!s.internalPartnerId) return 'اختر الشريك الداخلي'
  if (!s.defaultRevenueAccount.trim() || !s.cogsAccount.trim()) return 'حساب الإيراد الافتراضي وحساب تكلفة المبيعات إلزاميان'
  return null
}

export function saveSettings(d: DB, s: Settings): string | null {
  const err = validateSettings(s)
  if (err) return err
  const changed = (Object.keys(s) as (keyof Settings)[]).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(d.settings[k]))
  if (changed.length === 0) return 'لا توجد تغييرات'
  d.settings = s
  addAudit(d, 'settings', 'maintenance', 'تعديل إعدادات الصيانة', changed.join(', '))
  return null
}

/** S21 permissions matrix (cosmetic in the mock, but the whole UI reads it): toggle one role × action. Admin keeps everything. */
export function setRolePerm(d: DB, role: RoleId, perm: Perm, on: boolean): string | null {
  if (role === 'admin') return 'صلاحيات مسؤول النظام ثابتة'
  const cur = d.rolePerms[role] ?? []
  d.rolePerms = { ...d.rolePerms, [role]: on ? [...new Set([...cur, perm])] : cur.filter((p) => p !== perm) }
  addAudit(d, 'access', role, on ? 'منح صلاحية' : 'سحب صلاحية', `${role} — ${perm}`)
  return null
}

export function resetRolePerms(d: DB): string | null {
  d.rolePerms = structuredClone(defaultRolePerms)
  addAudit(d, 'access', 'all', 'استعادة الصلاحيات الافتراضية')
  return null
}
