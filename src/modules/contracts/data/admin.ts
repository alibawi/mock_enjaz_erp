// Settings, permission matrix, numbering series, approval stage rules and data authority (spec BR-X-01…07). Every change writes a settings audit row.
import { uid } from './format'
import { today } from './asof'
import { defaultRolePerms } from './permissions'
import { defaultSettings, getSetting, settingDefs } from './settings'
import type { ApprovalStageRule, Contract, DataAuthority, DB, Perm, RoleId, SettingKey, SettingValue } from './types'

export const AUDIT_ENTITIES = ['setting', 'permission', 'numbering', 'stages', 'authority'] as const
export const entityLabel: Record<string, string> = { setting: 'إعداد', permission: 'صلاحية', numbering: 'ترقيم', stages: 'مراحل اعتماد', authority: 'صلاحية البيانات' }
export const authorityLabel: Record<DataAuthority, string> = { User: 'مستخدم (عقوده فقط)', Org: 'منشأة (عقود منشأته)', System: 'النظام (الكل)' }

const log = (d: DB, entity: (typeof AUDIT_ENTITIES)[number], key: string, detail: string) =>
  d.audit.push({ id: uid('aud'), at: `${today()}T${new Date().toTimeString().slice(0, 5)}`, userId: d.userId, entity, entityId: key, action: key, detail })
export const settingsAudit = (db: DB) => db.audit.filter((a) => (AUDIT_ENTITIES as readonly string[]).includes(a.entity)).slice().reverse()
const show = (v: unknown) => (typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v))

export const featureOn = (db: DB, f: 'Obligations' | 'Templates' | 'Service' | 'ESignature' | 'RecurringBilling') => getSetting<boolean>(db, `Feature.${f}`)

// ───────────── settings (BR-X-01, BR-X-07) ─────────────
/** Takes effect on later actions; recorded ledger entries and documents are never recomputed. */
export function changeSetting(d: DB, key: SettingKey, value: SettingValue): string | null {
  const def = settingDefs.find((x) => x.key === key)
  if (!def) return 'إعداد غير معروف'
  if (def.kind === 'select' && !def.options!.some((o) => o.value === value)) return 'قيمة غير صالحة'
  if (def.kind === 'number' && !(Number(value) >= 0 && Number.isFinite(Number(value)))) return 'أدخل رقماً غير سالب'
  if (def.kind === 'text' && key.startsWith('Reminder.') && !/^\s*\d+(\s*,\s*\d+)*\s*$/.test(String(value))) return 'قائمة أيام مفصولة بفواصل، مثل: 30,15,7,1'
  const old = getSetting(d, key)
  if (old === value) return null
  d.settings[key] = value
  log(d, 'setting', key, `${show(old)} ← ${show(value)}`)
  return null
}
export function resetSettings(d: DB, group?: string): number {
  const defs = defaultSettings()
  let n = 0
  settingDefs.filter((x) => !group || x.group === group).forEach((x) => { if (getSetting(d, x.key) !== defs[x.key]) { changeSetting(d, x.key, defs[x.key]); n++ } })
  return n
}

// ───────────── permission matrix (BR-X-02) ─────────────
export function setRolePerm(d: DB, role: RoleId, perm: Perm, on: boolean): string | null {
  if (role === 'admin') return 'صلاحيات مسؤول النظام ثابتة'
  const has = d.rolePerms[role].includes(perm)
  if (has === on) return null
  d.rolePerms[role] = on ? [...d.rolePerms[role], perm] : d.rolePerms[role].filter((p) => p !== perm)
  log(d, 'permission', `${role}:${perm}`, on ? 'منح' : 'سحب')
  return null
}
export function resetMatrix(d: DB): void {
  d.rolePerms = structuredClone(defaultRolePerms)
  log(d, 'permission', 'matrix', 'إعادة المصفوفة إلى الافتراضي')
}

// ───────────── numbering (BR-X-04) ─────────────
const seqOf = (c: Contract, prefix: string) => { const m = c.number.match(new RegExp(`^CTR-${prefix}-\\d{4}-(\\d+)$`)); return m ? Number(m[1]) : 0 }
export const maxUsed = (db: DB, prefix: string) => db.contracts.reduce((m, c) => Math.max(m, seqOf(c, prefix)), 0)
export const seriesExample = (prefix: string, next: number, size: number, year = today().slice(0, 4)) => `CTR-${prefix}-${year}-${String(next).padStart(size, '0')}`
export function seriesList(db: DB) {
  return db.contractTypes.map((t) => {
    const size = t.numberSize ?? 6, next = (db.numbering[t.prefix] ?? 0) + 1
    return { type: t, prefix: t.prefix, next, size, example: seriesExample(t.prefix, next, size), used: db.contracts.filter((c) => c.typeId === t.id).length }
  })
}
/** Changing a series never renumbers existing contracts; the next number cannot fall at or below a used number. */
export function updateSeries(d: DB, typeId: string, p: { prefix?: string; next?: number; size?: number }): string | null {
  const t = d.contractTypes.find((x) => x.id === typeId)
  if (!t) return 'النوع غير موجود'
  const before = `${t.prefix} / ${(d.numbering[t.prefix] ?? 0) + 1} / ${t.numberSize ?? 6}`
  if (p.prefix !== undefined && p.prefix !== t.prefix) {
    const np = p.prefix.trim().toUpperCase()
    if (!/^[A-Z0-9]{1,6}$/.test(np)) return 'البادئة حروف إنجليزية/أرقام حتى 6 خانات'
    if (d.contractTypes.some((x) => x.id !== t.id && x.prefix === np)) return 'البادئة مستخدمة لنوع آخر'
    d.numbering[np] = Math.max(d.numbering[np] ?? 0, 0)
    t.prefix = np
  }
  if (p.size !== undefined) {
    if (!Number.isInteger(p.size) || p.size < 3 || p.size > 9) return 'عدد خانات الرقم بين 3 و9'
    t.numberSize = p.size
  }
  if (p.next !== undefined) {
    if (!Number.isInteger(p.next) || p.next < 1) return 'الرقم التالي عدد صحيح موجب'
    const used = maxUsed(d, t.prefix)
    if (p.next <= used) return `الرقم التالي يجب أن يتجاوز أعلى رقم مستخدم (${used})`
    d.numbering[t.prefix] = p.next - 1
  }
  log(d, 'numbering', t.code, `${before} ← ${t.prefix} / ${(d.numbering[t.prefix] ?? 0) + 1} / ${t.numberSize ?? 6}`)
  return null
}

// ───────────── approval stage rules (BR-X-06) ─────────────
export function validateRule(db: DB, r: ApprovalStageRule): string[] {
  const e: string[] = []
  if (!r.name.trim()) e.push('اسم المسار مطلوب')
  if (!r.stages.length) e.push('أضف مرحلة واحدة على الأقل')
  if (r.stages.some((s) => !s.label.trim() || !db.users.some((u) => u.id === s.userId))) e.push('لكل مرحلة اسم ومعتمد')
  if (r.maxValueIQD !== undefined && r.maxValueIQD <= r.minValueIQD) e.push('الحد الأعلى يجب أن يتجاوز الأدنى')
  const same = db.stageRules.filter((x) => x.id !== r.id && x.isActive && r.isActive && x.subjectType === r.subjectType && x.typeId === r.typeId && x.organizationId === r.organizationId)
  if (same.some((x) => r.minValueIQD < (x.maxValueIQD ?? Infinity) && x.minValueIQD < (r.maxValueIQD ?? Infinity))) e.push('تتداخل حدود القيمة مع مسار فعّال آخر بنفس النطاق')
  return e
}
/** Applies to new submissions only: pending requests keep their stage snapshot. */
export function saveStageRule(d: DB, r: ApprovalStageRule): string | null {
  const errs = validateRule(d, r)
  if (errs.length) return errs.join(' — ')
  const next = { ...r, stages: r.stages.map((s, i) => ({ ...s, no: i + 1 })) }
  const i = d.stageRules.findIndex((x) => x.id === r.id)
  if (i >= 0) d.stageRules[i] = next; else d.stageRules.push(next)
  log(d, 'stages', r.id, `${r.name} — ${next.stages.length} مراحل`)
  return null
}
export function deleteStageRule(d: DB, id: string): string | null {
  const r = d.stageRules.find((x) => x.id === id)
  if (!r) return 'المسار غير موجود'
  if (d.approvalRequests.some((q) => q.ruleId === id && q.status === 'Pending')) return 'يوجد طلب اعتماد معلّق على هذا المسار؛ عطّله بدل الحذف'
  d.stageRules = d.stageRules.filter((x) => x.id !== id)
  log(d, 'stages', id, `حُذف: ${r.name}`)
  return null
}

// ───────────── data authority (BR-X-03) ─────────────
export function setUserScope(d: DB, userId: string, scope: DataAuthority): string | null {
  const u = d.users.find((x) => x.id === userId)
  if (!u) return 'المستخدم غير موجود'
  const old = d.userScopes[userId] ?? 'System'
  if (old === scope) return null
  d.userScopes[userId] = scope
  log(d, 'authority', userId, `${u.name}: ${authorityLabel[old]} ← ${authorityLabel[scope]}`)
  return null
}
