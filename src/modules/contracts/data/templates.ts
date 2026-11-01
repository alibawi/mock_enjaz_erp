// Templates, clause library, contract terms and the print model (spec BR-T-01…07).
// Terms are copied (frozen) into the contract: there is no live link to the template or the clause library.
import { addDays, addMonths, today } from './asof'
import { nowStamp, uid } from './format'
import type { Clause, Contract, ContractTemplate, DB } from './types'

export const clauseCategories = ['عام', 'مالي', 'قانوني', 'سرية', 'إنهاء', 'فني', 'ضمان'] as const
export const placeholderDefs: { key: string; label: string }[] = [
  { key: 'counterparty', label: 'الطرف الآخر' }, { key: 'company', label: 'المنشأة' }, { key: 'contractNumber', label: 'رقم العقد' }, { key: 'title', label: 'عنوان العقد' },
  { key: 'startDate', label: 'تاريخ البداية' }, { key: 'endDate', label: 'تاريخ النهاية' }, { key: 'value', label: 'قيمة العقد' }, { key: 'currency', label: 'العملة' },
  { key: 'paymentTerm', label: 'شرط الدفع' }, { key: 'deliveryTerms', label: 'شروط التسليم' }, { key: 'noticeDays', label: 'مدة الإشعار' }, { key: 'owner', label: 'مسؤول العقد' },
]

const dateText = (d?: string) => (d ? d.split('-').reverse().join('/') : 'غير محدد')
/** BR-T-04: placeholders are resolved from the contract at print/preview time. */
export function resolveText(db: DB, c: Contract, body: string): string {
  const partner = c.counterpartyId ? db.partners.find((p) => p.id === c.counterpartyId)?.name : c.counterpartyName
  const vals: Record<string, string> = {
    counterparty: partner ?? '…………', company: db.organizations.find((o) => o.id === c.organizationId)?.name ?? '', contractNumber: c.number || '…………', title: c.title,
    startDate: dateText(c.startDate), endDate: c.endDate ? dateText(c.endDate) : 'مفتوح المدة', value: c.contractValue ? c.contractValue.toLocaleString('en-US') : '…………', currency: c.currency,
    paymentTerm: db.paymentTerms.find((p) => p.id === c.paymentTermId)?.name ?? '…………', deliveryTerms: c.deliveryTerms ?? '…………', noticeDays: c.noticePeriodDays ? String(c.noticePeriodDays) : '…',
    owner: db.users.find((u) => u.id === c.ownerUserId)?.name ?? '',
  }
  return body.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vals[k] ?? m)
}
export const placeholdersIn = (body: string) => [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]

// ───────────── clause library ─────────────
export const clauseVersions = (db: DB, clauseId: string) => db.clauseVersions.filter((v) => v.clauseId === clauseId).sort((a, b) => b.versionNo - a.versionNo)
export const currentClauseVersion = (db: DB, clauseId: string) => clauseVersions(db, clauseId)[0]
export const clauseOfVersion = (db: DB, cvId: string) => { const v = db.clauseVersions.find((x) => x.id === cvId); return v ? db.clauses.find((c) => c.id === v.clauseId) : undefined }

export function validateClause(body: string, title: string): string[] {
  const e: string[] = []
  if (!title.trim()) e.push('عنوان البند مطلوب')
  if (!body.trim()) e.push('نص البند مطلوب')
  const bad = placeholdersIn(body).filter((k) => !placeholderDefs.some((p) => p.key === k))
  if (bad.length) e.push(`متغيرات غير معروفة: ${bad.map((k) => `{{${k}}}`).join('، ')}`)
  return e
}
/** Creates a clause (version 1) or, when `id` is given, publishes version n+1; older versions stay readable. */
export function saveClause(d: DB, input: { id?: string; code?: string; title: string; category: string; body: string }): string | Clause {
  const errs = validateClause(input.body, input.title)
  if (errs.length) return errs.join(' — ')
  let c = input.id ? d.clauses.find((x) => x.id === input.id) : undefined
  if (input.id && !c) return 'البند غير موجود'
  if (!c) {
    const code = input.code?.trim() || `CL-${String(d.clauses.length + 1).padStart(3, '0')}`
    if (d.clauses.some((x) => x.code === code)) return 'رمز البند مستخدم'
    c = { id: `cl-${d.clauses.length + 1}-${Math.random().toString(36).slice(2, 4)}`, code, title: input.title, category: input.category, currentVersionNo: 0, isActive: true }
    d.clauses.push(c)
  } else {
    const last = currentClauseVersion(d, c.id)
    if (last.body === input.body && c.title === input.title) return 'لا تغيير في النص لنشر إصدار جديد'
    c.title = input.title; c.category = input.category
  }
  c.currentVersionNo += 1
  d.clauseVersions.push({ id: `${c.id}-v${c.currentVersionNo}`, clauseId: c.id, versionNo: c.currentVersionNo, body: input.body, publishedOn: nowStamp(), publishedBy: d.userId })
  return c
}
export const clauseUsage = (db: DB, clauseId: string) => new Set(db.terms.filter((t) => t.clauseVersionId && clauseOfVersion(db, t.clauseVersionId)?.id === clauseId).map((t) => t.contractId)).size

// ───────────── templates ─────────────
export const templateVersions = (db: DB, templateId: string) => db.templateVersions.filter((v) => v.templateId === templateId).sort((a, b) => b.versionNo - a.versionNo)
export const templateUsage = (db: DB, templateId: string) => db.contracts.filter((c) => c.templateVersionId && db.templateVersions.find((v) => v.id === c.templateVersionId)?.templateId === templateId).length

export function validateTemplate(db: DB, t: ContractTemplate): string[] {
  const e: string[] = []
  if (!t.name.trim()) e.push('اسم القالب مطلوب')
  if (!db.contractTypes.some((x) => x.id === t.typeId)) e.push('نوع العقد مطلوب')
  if (!t.draft.clauses.length) e.push('أضف بنداً واحداً على الأقل')
  const ids = t.draft.clauses.map((c) => c.clauseId)
  if (new Set(ids).size !== ids.length) e.push('بند مكرر في القالب')
  if (ids.some((id) => !db.clauses.find((c) => c.id === id)?.isActive)) e.push('يحتوي القالب بنداً غير فعّال')
  return e
}
export function createTemplate(d: DB, name: string, code: string, typeId: string): string | ContractTemplate {
  if (!name.trim() || !code.trim() || !typeId) return 'الاسم والرمز والنوع مطلوبة'
  if (d.templates.some((t) => t.code === code.trim())) return 'رمز القالب مستخدم'
  const t: ContractTemplate = { id: `tpl-${d.templates.length + 1}-${Math.random().toString(36).slice(2, 4)}`, code: code.trim(), name: name.trim(), typeId, currentVersionNo: 0, status: 'Draft', draft: { defaults: {}, clauses: [], attachments: [] } }
  d.templates.push(t)
  return t
}
export function saveTemplateDraft(d: DB, t: ContractTemplate): string | null {
  const i = d.templates.findIndex((x) => x.id === t.id)
  if (i < 0) return 'القالب غير موجود'
  if (d.templates[i].status === 'Archived') return 'القالب مؤرشف'
  d.templates[i] = t
  return null
}
/** BR-T-01: publishing creates version n+1 from the working copy; version n never changes. */
export function publishTemplate(d: DB, id: string): string | null {
  const t = d.templates.find((x) => x.id === id)
  if (!t) return 'القالب غير موجود'
  if (t.status === 'Archived') return 'القالب مؤرشف'
  const errs = validateTemplate(d, t)
  if (errs.length) return errs.join(' — ')
  if (!hasUnpublishedChanges(d, t)) return 'لا تغييرات لنشرها'
  t.currentVersionNo += 1
  d.templateVersions.push({
    id: `${t.id}-v${t.currentVersionNo}`, templateId: t.id, versionNo: t.currentVersionNo, defaults: structuredClone(t.draft.defaults), attachments: [...t.draft.attachments],
    clauseRefs: t.draft.clauses.slice().sort((a, b) => a.order - b.order).map((c, i) => ({ clauseVersionId: currentClauseVersion(d, c.clauseId).id, order: i + 1, isOptional: c.isOptional })),
    publishedOn: nowStamp(), publishedBy: d.userId,
  })
  t.status = 'Published'
  return null
}
const stable = (v: unknown) => JSON.stringify(v)
export function hasUnpublishedChanges(d: DB, t: ContractTemplate): boolean {
  const last = templateVersions(d, t.id)[0]
  if (!last) return true
  const draft = { defaults: t.draft.defaults, clauses: t.draft.clauses.slice().sort((a, b) => a.order - b.order).map((c) => [currentClauseVersion(d, c.clauseId).id, c.isOptional]), attachments: t.draft.attachments }
  const old = { defaults: last.defaults, clauses: last.clauseRefs.slice().sort((a, b) => a.order - b.order).map((c) => [c.clauseVersionId, c.isOptional]), attachments: last.attachments }
  return stable(draft) !== stable(old)
}
/** BR-T-03: archived templates cannot be selected but remain visible on the contracts that used them. */
export function setTemplateArchived(d: DB, id: string, archived: boolean): string | null {
  const t = d.templates.find((x) => x.id === id)
  if (!t) return 'القالب غير موجود'
  if (archived) t.status = 'Archived'
  else t.status = t.currentVersionNo ? 'Published' : 'Draft'
  return null
}
export const selectableTemplates = (db: DB, typeId: string) => db.templates.filter((t) => t.status === 'Published' && t.typeId === typeId)

// ───────────── contract terms ─────────────
export const termsOf = (db: DB, contractId: string) => db.terms.filter((t) => t.contractId === contractId).sort((a, b) => a.order - b.order)
const sectionOf = (db: DB, cvId: string) => clauseOfVersion(db, cvId)?.category ?? 'عام'

/** Template defaults as contract field values (applied at creation only, BR-T-02). */
export function templateDefaultsFor(db: DB, tvId: string, startDate: string): Partial<Contract> {
  const v = db.templateVersions.find((x) => x.id === tvId)
  if (!v) return {}
  const x = v.defaults
  return {
    templateVersionId: tvId, ...(x.durationMonths ? { endDate: addDays(addMonths(startDate, x.durationMonths), -1) } : {}), ...(x.renewalPolicy ? { renewalPolicy: x.renewalPolicy } : {}),
    ...(x.noticePeriodDays ? { noticePeriodDays: x.noticePeriodDays } : {}), ...(x.paymentTermId ? { paymentTermId: x.paymentTermId } : {}), ...(x.deliveryTerms ? { deliveryTerms: x.deliveryTerms } : {}),
  }
}
/** BR-T-02/04: copies the clause texts of a template version into the contract as frozen terms. */
export function copyTerms(d: DB, contractId: string, tvId: string): number {
  const v = d.templateVersions.find((x) => x.id === tvId)
  if (!v) return 0
  d.terms = d.terms.filter((t) => t.contractId !== contractId)
  v.clauseRefs.slice().sort((a, b) => a.order - b.order).forEach((r, i) => {
    const cv = d.clauseVersions.find((x) => x.id === r.clauseVersionId)!
    const cl = d.clauses.find((x) => x.id === cv.clauseId)!
    d.terms.push({ id: uid('trm'), contractId, order: i + 1, section: sectionOf(d, cv.id), title: cl.title, body: cv.body, clauseVersionId: cv.id, isOptional: r.isOptional, isIncluded: true, isFree: false })
  })
  return v.clauseRefs.length
}

const draftGuard = (d: DB, contractId: string): string | null => {
  const c = d.contracts.find((x) => x.id === contractId)
  if (!c) return 'العقد غير موجود'
  if (c.status !== 'Draft') return 'البنود مجمّدة بعد المسودة؛ التعديل بملحق'
  return null
}
export function toggleTerm(d: DB, termId: string): string | null {
  const t = d.terms.find((x) => x.id === termId)
  if (!t) return 'البند غير موجود'
  const g = draftGuard(d, t.contractId); if (g) return g
  if (!t.isOptional && !t.isFree) return 'بند إلزامي لا يُستبعد'
  t.isIncluded = !t.isIncluded
  return null
}
export function moveTerm(d: DB, termId: string, dir: -1 | 1): string | null {
  const t = d.terms.find((x) => x.id === termId)
  if (!t) return 'البند غير موجود'
  const g = draftGuard(d, t.contractId); if (g) return g
  const list = termsOf(d, t.contractId), i = list.findIndex((x) => x.id === termId), j = i + dir
  if (j < 0 || j >= list.length) return null
  ;[list[i].order, list[j].order] = [list[j].order, list[i].order]
  return null
}
export function addTerm(d: DB, contractId: string, input: { title: string; body: string; clauseVersionId?: string }): string | null {
  const g = draftGuard(d, contractId); if (g) return g
  if (!input.title.trim() || !input.body.trim()) return 'العنوان والنص مطلوبان'
  const order = Math.max(0, ...termsOf(d, contractId).map((t) => t.order)) + 1
  d.terms.push({ id: uid('trm'), contractId, order, section: input.clauseVersionId ? sectionOf(d, input.clauseVersionId) : 'بند خاص', title: input.title, body: input.body, clauseVersionId: input.clauseVersionId, isOptional: !input.clauseVersionId ? false : true, isIncluded: true, isFree: !input.clauseVersionId })
  return null
}
export function removeTerm(d: DB, termId: string): string | null {
  const t = d.terms.find((x) => x.id === termId)
  if (!t) return 'البند غير موجود'
  const g = draftGuard(d, t.contractId); if (g) return g
  if (!t.isFree && !t.isOptional) return 'بند إلزامي من القالب لا يُحذف'
  d.terms = d.terms.filter((x) => x.id !== termId)
  return null
}

// ───────────── print (BR-T-06) ─────────────
/** The printable documents of a contract. In the real system each is a Core DesignTemplate (designer UI with versions); here a CSS page per document. */
export const printDocDefs = [
  { id: 'contract', code: 'CONTRACT_AR_A4', name: 'العقد' },
  { id: 'summary', code: 'CONTRACT_SUMMARY_AR_A4', name: 'ملخص العقد' },
  { id: 'approval', code: 'APPROVAL_RECORD_AR_A4', name: 'سجل الاعتماد' },
  { id: 'fulfillment', code: 'FULFILLMENT_STMT_AR_A4', name: 'كشف تنفيذ الاتفاقية' },
  { id: 'obligations', code: 'OBLIGATIONS_STMT_AR_A4', name: 'كشف الالتزامات والدفعات' },
  { id: 'amendment', code: 'AMENDMENT_AR_A4', name: 'ملحق العقد' },
  { id: 'service', code: 'SERVICE_STMT_AR_A4', name: 'كشف الخدمة ومستوى الخدمة' },
] as const
export type PrintDocId = (typeof printDocDefs)[number]['id']
/** Documents that make sense for this contract (so the picker never offers an empty statement). */
export function printDocsFor(db: DB, c: Contract): PrintDocId[] {
  const has = (k: PrintDocId) => k === 'contract' || k === 'summary'
    || (k === 'approval' && db.approvalRequests.some((r) => r.contractId === c.id))
    || (k === 'fulfillment' && c.profile === 'Agreement')
    || (k === 'obligations' && (db.obligations.some((o) => o.contractId === c.id) || db.paymentItems.some((p) => p.contractId === c.id)))
    || (k === 'amendment' && db.amendments.some((a) => a.contractId === c.id))
    || (k === 'service' && c.profile === 'Service')
  return printDocDefs.map((d) => d.id).filter(has)
}
export const printCount = (db: DB, contractId: string) => db.printLog.filter((p) => p.contractId === contractId).length
export function logPrint(d: DB, contractId: string, doc: PrintDocId = 'contract'): string | null {
  const c = d.contracts.find((x) => x.id === contractId)
  if (!c) return 'العقد غير موجود'
  d.printLog.push({ id: uid('prt'), contractId, at: nowStamp(), byUserId: d.userId, draft: c.status === 'Draft', doc })
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: contractId, action: 'print', detail: `${printDocDefs.find((x) => x.id === doc)?.name ?? doc}${c.status === 'Draft' ? ' (مسودة)' : ''}` })
  return null
}
export const isDraftPrint = (c: Contract) => c.status === 'Draft'
export const todayText = () => dateText(today())
