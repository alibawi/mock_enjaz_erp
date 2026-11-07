// Estimate engine — spec §3 Estimate, BR-M-03…09; plan §20.1.3 lifecycle and §20.1.4 rules. Called inside run().
import { addDays, today } from './asof'
import { warrantyState } from './assets'
import { iqd, nowStamp, uid } from './format'
import { roleLabel } from './permissions'
import { addAudit, nextNumber } from './store'
import type { ApprovalRequest, DB, Estimate, EstimateLine, RoleId } from './types'

export const lineTotal = (l: EstimateLine) => Math.round(l.qty * l.price * (1 - l.discountPct / 100))

export function totals(d: DB, e: Estimate) {
  const by = (c: EstimateLine['coverage']) => e.lines.filter((l) => l.coverage === c).reduce((s, l) => s + lineTotal(l), 0)
  const gross = e.lines.reduce((s, l) => s + lineTotal(l), 0)
  const cost = e.lines.reduce((s, l) => s + l.qty * (d.items.find((i) => i.id === l.itemId)?.cost ?? 0), 0)
  return { gross, billable: by('paid'), warranty: by('warranty'), goodwill: by('goodwill'), parts: e.lines.filter((l) => l.kind === 'part').reduce((s, l) => s + lineTotal(l), 0), labor: e.lines.filter((l) => l.kind !== 'part').reduce((s, l) => s + lineTotal(l), 0), cost }
}

export interface Routing { required: boolean; reasons: string[]; levels: RoleId[][]; amount: number }

/** Rule 1 (any criterion → approval) and rule 2 (band levels). Approval mode "disabled" auto-approves everything (rule 8). */
export function routing(d: DB, e: Estimate): Routing {
  const s = d.settings
  const t = totals(d, e)
  const asset = d.assets.find((a) => a.id === e.assetId)
  const amount = t.gross
  const band = s.approvalBands.find((b) => b.upTo === null || amount <= b.upTo) ?? s.approvalBands[s.approvalBands.length - 1]
  const reasons: string[] = []
  if (band.roles.length) reasons.push(`المبلغ ${iqd(amount)} ضمن شريحة تتطلب ${band.roles.map((r) => roleLabel[r]).join(' ثم ')}`)
  const disc = e.lines.filter((l) => l.discountPct > s.lineDiscountLimitPct)
  if (disc.length) reasons.push(`خصم سطر يتجاوز ${s.lineDiscountLimitPct}% (${disc.map((l) => `${l.discountPct}%`).join('، ')})`)
  if (e.lines.some((l) => l.coverage === 'goodwill')) reasons.push('سطر بتغطية حسن نية')
  if (asset && e.lines.some((l) => l.coverage === 'warranty') && warrantyState(asset) === 'expired') reasons.push('تغطية ضمان على أصل منتهي الضمان')
  if (asset?.ownerKind === 'company' && t.cost > s.internalCostLimit) reasons.push(`تكلفة صيانة داخلية ${iqd(t.cost)} تتجاوز الحد ${iqd(s.internalCostLimit)}`)
  if (s.approvalMode === 'disabled') return { required: false, reasons: ['وضع الاعتماد معطّل — اعتماد تلقائي'], levels: [], amount }
  const levels = band.roles.length ? band.roles.map((r) => [r]) : reasons.length ? [['workshopManager' as RoleId]] : []
  return { required: levels.length > 0, reasons, levels, amount }
}

export const roundsOf = (d: DB, estimateId: string) => d.approvals.filter((a) => a.estimateId === estimateId)
export const currentRound = (d: DB, e: Estimate) => {
  const rs = roundsOf(d, e.id)
  const max = rs.reduce((m, a) => Math.max(m, a.round), 0)
  return rs.filter((a) => a.round === max).sort((a, b) => a.level - b.level)
}
export const openApprovalFor = (d: DB, e: Estimate) => currentRound(d, e).find((a) => a.status === 'pending')

function setRequest(d: DB, e: Estimate, status: DB['requests'][number]['status']) {
  const r = d.requests.find((x) => x.id === e.requestId)
  if (r && !['closed', 'cancelled'].includes(r.status)) r.status = status
}

/** New draft estimate for a received / in-diagnosis request. */
export function createEstimate(d: DB, requestId: string, id: string): string | null {
  const r = d.requests.find((x) => x.id === requestId)
  if (!r) return 'الطلب غير موجود'
  if (!['received', 'inDiagnosis'].includes(r.status)) return 'يُعدّ التقدير لطلب مستلم أو قيد التشخيص'
  if (r.estimateId) return 'للطلب تقدير مسبق — استخدم المراجعة لإنشاء نسخة جديدة'
  const e: Estimate = {
    id, number: nextNumber(d, 'MES'), requestId, assetId: r.assetId, partnerId: r.partnerId, version: 1, status: 'draft',
    validUntil: addDays(today(), d.settings.estimateValidityDays), lines: [], createdBy: d.userId,
  }
  if (r.reworkOfWorkOrderId) e.lines.push({ id: uid('el'), kind: 'service', itemId: 'sv-diag', qty: 1, price: 20_000, discountPct: 0, coverage: 'goodwill' })
  d.estimates.push(e)
  r.estimateId = id
  r.status = 'inDiagnosis'
  addAudit(d, 'estimate', id, 'إنشاء تقدير', `${e.number} للطلب ${r.number}`)
  return null
}

export function saveLines(d: DB, id: string, lines: EstimateLine[]): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || e.status !== 'draft') return 'تُعدَّل أسطر التقدير في حالة المسودة فقط'
  for (const l of lines) {
    if (!l.itemId) return 'كل سطر يحتاج مادة أو خدمة'
    if (!(l.qty > 0)) return 'الكمية يجب أن تكون أكبر من صفر'
    if (l.price < 0 || l.discountPct < 0 || l.discountPct > 100) return 'السعر أو الخصم غير صحيح'
  }
  e.lines = lines
  addAudit(d, 'estimate', id, 'تعديل أسطر التقدير', `${lines.length} سطر`)
  return null
}

/** Draft → PendingApproval (or Approved with a "notRequired" row). Opens the first-level task. */
export function submit(d: DB, id: string): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || e.status !== 'draft') return 'يُرسل التقدير من حالة المسودة فقط'
  if (e.lines.length === 0) return 'أضف سطرًا واحدًا على الأقل'
  if (e.validUntil < today()) e.validUntil = addDays(today(), d.settings.estimateValidityDays)
  const rt = routing(d, e)
  const round = roundsOf(d, id).reduce((m, a) => Math.max(m, a.round), 0) + 1
  e.submittedBy = d.userId
  const base = { estimateId: id, round, version: e.version, submittedBy: d.userId, submittedAt: nowStamp() }
  if (!rt.required) {
    d.approvals.push({ ...base, id: uid('ap'), level: 0, roles: [], status: 'notRequired', decidedBy: 'system', decidedAt: nowStamp(), comment: rt.reasons.join('؛ ') || 'تحت حد الاعتماد' })
    e.status = 'approved'
    setRequest(d, e, 'approved')
    addAudit(d, 'estimate', id, 'اعتماد تلقائي (لا يحتاج اعتمادًا)', `${e.number} v${e.version}`)
    return null
  }
  rt.levels.forEach((roles, i) => {
    const ap: ApprovalRequest = { ...base, id: uid('ap'), level: i + 1, roles, status: i === 0 ? 'pending' : 'waiting', comment: i === 0 ? rt.reasons.join('؛ ') : undefined }
    d.approvals.push(ap)
    if (i === 0) d.tasks.push({ id: uid('tk'), kind: 'estimateApproval', refId: id, approvalRequestId: ap.id, roles, status: 'open', createdAt: nowStamp() })
  })
  e.status = 'pendingApproval'
  setRequest(d, e, 'awaitingApproval')
  addAudit(d, 'estimate', id, 'إرسال للاعتماد', `الجولة ${round} — ${rt.levels.map((l) => roleLabel[l[0]]).join(' ← ')}`)
  return null
}

/** Rule 3 (no self-approval), role check, idempotency; reject needs a reason (§28.8). */
export function decide(d: DB, approvalId: string, approve: boolean, comment: string): string | null {
  const ap = d.approvals.find((a) => a.id === approvalId)
  const e = d.estimates.find((x) => x.id === ap?.estimateId)
  if (!ap || !e) return 'طلب الاعتماد غير موجود'
  if (ap.status !== 'pending' || e.status !== 'pendingApproval') return 'تم اتخاذ القرار مسبقًا'
  if (!ap.roles.includes(d.role) && d.role !== 'admin') return `هذا القرار لـ ${ap.roles.map((r) => roleLabel[r]).join(' / ')}`
  if (e.submittedBy === d.userId) return 'لا يمكنك اعتماد تقدير قدّمته بنفسك (فصل المهام)'
  if (!approve && !comment.trim()) return 'سبب الرفض إلزامي'
  ap.status = approve ? 'approved' : 'rejected'
  ap.decidedBy = d.userId
  ap.decidedAt = nowStamp()
  ap.comment = comment.trim() || ap.comment
  d.tasks.filter((t) => t.approvalRequestId === ap.id && t.status === 'open').forEach((t) => { t.status = 'done' })
  if (!approve) {
    e.status = 'rejected'
    currentRound(d, e).filter((a) => a.status === 'waiting').forEach((a) => { a.status = 'withdrawn' })
    setRequest(d, e, 'inDiagnosis')
    addAudit(d, 'estimate', e.id, 'رفض التقدير', comment.trim())
    return null
  }
  const next = currentRound(d, e).find((a) => a.status === 'waiting')
  if (next) {
    next.status = 'pending'
    d.tasks.push({ id: uid('tk'), kind: 'estimateApproval', refId: e.id, approvalRequestId: next.id, roles: next.roles, status: 'open', createdAt: nowStamp() })
    addAudit(d, 'estimate', e.id, `اعتماد المستوى ${ap.level}`, `يُحال إلى ${roleLabel[next.roles[0]]}`)
    return null
  }
  e.status = 'approved'
  setRequest(d, e, 'approved')
  addAudit(d, 'estimate', e.id, 'اعتماد نهائي للتقدير', `${e.number} v${e.version}`)
  return null
}

/** Rule 6: the submitter (with permission) pulls it back to Draft; open tasks are cancelled. */
export function withdraw(d: DB, id: string, reason: string): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || e.status !== 'pendingApproval') return 'يُسحب التقدير وهو بانتظار الاعتماد فقط'
  if (!reason.trim()) return 'سبب السحب إلزامي'
  currentRound(d, e).filter((a) => a.status === 'pending' || a.status === 'waiting').forEach((a) => { a.status = 'withdrawn'; a.comment = reason.trim() })
  d.tasks.filter((t) => t.refId === id && t.status === 'open').forEach((t) => { t.status = 'cancelled' })
  e.status = 'draft'
  setRequest(d, e, 'inDiagnosis')
  addAudit(d, 'estimate', id, 'سحب التقدير من الاعتماد', reason.trim())
  return null
}

/** Revise: a new Draft version copying the lines; an Approved version becomes Superseded. Approval never carries over. */
export function revise(d: DB, id: string, newId: string): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || !['approved', 'rejected', 'expired'].includes(e.status)) return 'تُراجَع نسخة معتمدة أو مرفوضة أو منتهية فقط'
  if (e.customerAcceptance?.decision === 'accepted') return 'وافق العميل على هذه النسخة — لا تُراجَع'
  const v = d.estimates.filter((x) => x.requestId === e.requestId).reduce((m, x) => Math.max(m, x.version), 0) + 1
  const copy: Estimate = { ...structuredClone(e), id: newId, version: v, status: 'draft', submittedBy: undefined, customerAcceptance: undefined, supersedesId: e.id,
    createdBy: d.userId, validUntil: addDays(today(), d.settings.estimateValidityDays), lines: e.lines.map((l) => ({ ...l, id: uid('el') })) }
  if (e.status === 'approved') e.status = 'superseded'
  d.estimates.push(copy)
  const r = d.requests.find((x) => x.id === e.requestId)
  if (r) { r.estimateId = newId; if (!['closed', 'cancelled'].includes(r.status)) r.status = 'inDiagnosis' }
  addAudit(d, 'estimate', newId, 'مراجعة التقدير (نسخة جديدة)', `${e.number} v${v}`)
  return null
}

/** Rule 4: customer acceptance is a separate record on the approved version. */
export function recordAcceptance(d: DB, id: string, decision: 'accepted' | 'declined', channel: NonNullable<Estimate['customerAcceptance']>['channel'], note: string): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || e.status !== 'approved') return 'تُسجَّل موافقة العميل على نسخة معتمدة فقط'
  if (isInternal(d, e)) return 'صيانة داخلية — لا تحتاج موافقة عميل'
  if (e.customerAcceptance) return 'سُجّل رد العميل مسبقًا'
  if (e.validUntil < today()) return 'انتهت صلاحية التقدير — راجعه بنسخة جديدة'
  if (decision === 'declined' && !note.trim()) return 'اذكر سبب رفض العميل'
  e.customerAcceptance = { decision, channel, by: d.userId, at: nowStamp(), note: note.trim() || undefined }
  if (decision === 'declined') setRequest(d, e, 'rejected')
  addAudit(d, 'estimate', id, decision === 'accepted' ? 'موافقة العميل' : 'رفض العميل', note.trim())
  return null
}

export function cancelEstimate(d: DB, id: string, reason: string): string | null {
  const e = d.estimates.find((x) => x.id === id)
  if (!e || ['cancelled', 'superseded'].includes(e.status) || e.customerAcceptance?.decision === 'accepted') return 'لا يمكن إلغاء هذا التقدير'
  if (d.workOrders.some((w) => w.estimateId === id)) return 'التقدير مرتبط بأمر عمل'
  if (!reason.trim()) return 'سبب الإلغاء إلزامي'
  if (e.status === 'pendingApproval') {
    currentRound(d, e).filter((a) => a.status === 'pending' || a.status === 'waiting').forEach((a) => { a.status = 'withdrawn' })
    d.tasks.filter((t) => t.refId === id && t.status === 'open').forEach((t) => { t.status = 'cancelled' })
  }
  e.status = 'cancelled'
  setRequest(d, e, 'inDiagnosis')
  const r = d.requests.find((x) => x.id === e.requestId)
  if (r && r.estimateId === id) r.estimateId = undefined
  addAudit(d, 'estimate', id, 'إلغاء التقدير', reason.trim())
  return null
}

/** Rule 5: an approved estimate not accepted by the customer before its validity date lapses (run when the demo date moves). */
export function sweepExpiry(d: DB): number {
  let n = 0
  for (const e of d.estimates) {
    if (e.status === 'approved' && !e.customerAcceptance && e.validUntil < today() && !isInternal(d, e) && !d.workOrders.some((w) => w.estimateId === e.id)) {
      e.status = 'expired'
      setRequest(d, e, 'inDiagnosis')
      addAudit(d, 'estimate', e.id, 'انتهاء صلاحية التقدير', `${e.number} — ${e.validUntil}`)
      n++
    }
  }
  return n
}

/** Internal (company-asset) estimates need no customer acceptance. */
export const isInternal = (d: DB, e: Estimate) => d.assets.find((a) => a.id === e.assetId)?.ownerKind === 'company'

export const canConvert = (d: DB, e: Estimate) =>
  e.status === 'approved' && (isInternal(d, e) || e.customerAcceptance?.decision === 'accepted') && !d.workOrders.some((w) => w.estimateId === e.id)
