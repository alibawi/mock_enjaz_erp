// Contract state machine and business rules BR-C-01…15 (plan doc 03 T1–T15, doc 02 §2.1–2.2).
// Module 2 replaces the approval stub (submit/approve/reject) with the Elsa stage engine; everything else stays.
import { addDays, today } from './asof'
import { createVersion } from './amendments'
import { cancelOnTermination } from './obligations'
import { decide, eligibility, openRequest, startApproval } from './approval'
import { rateOn } from './currency'
import { nowStamp, uid } from './format'
import { can as canRole } from './permissions'
import { getSetting } from './settings'
import type { Contract, ContractStatus, DB, Perm } from './types'

export type ActionId =
  | 'edit' | 'submit' | 'approve' | 'reject' | 'sendForSignature' | 'activate' | 'suspend' | 'resume'
  | 'terminate' | 'close' | 'cancel' | 'reopen' | 'delete'

export interface ActionDef {
  id: ActionId; label: string; perm: Perm
  /** What the dialog must collect before running the action. */
  ask?: 'reason' | 'date' | 'reasonDate' | 'confirm'
  /** The reason is mandatory. */
  reasonRequired?: boolean
  primary?: boolean; danger?: boolean
  /** Why the action exists but cannot run now (shown as a tooltip, button disabled). */
  blocked?: string
}

export const typeOf = (db: DB, c: Contract) => db.contractTypes.find((t) => t.id === c.typeId)!
export const userName = (db: DB, id: string) => (id === 'system' ? 'النظام' : db.users.find((u) => u.id === id)?.name ?? id)
export const partnerName = (db: DB, c: Contract) => (c.counterpartyId ? db.partners.find((p) => p.id === c.counterpartyId)?.name : c.counterpartyName) ?? '—'
export const noticeDeadline = (c: Contract) => (c.endDate && c.noticePeriodDays ? addDays(c.endDate, -c.noticePeriodDays) : undefined)
export const graceDays = (db: DB, c: Contract) => typeOf(db, c).renewalGraceDays ?? Number(getSetting(db, 'Renewal.GraceDays'))
/** End of the renewal grace window for an expired contract. */
export const graceEnd = (db: DB, c: Contract) => (c.endDate ? addDays(c.endDate, graceDays(db, c)) : undefined)

/** BR-C-12: confidential items are hidden from roles without ViewConfidential (owners keep access). */
export function canSeeAs(db: DB, userId: string, c: Contract): boolean {
  const u = db.users.find((x) => x.id === userId)
  if (!u) return false
  // BR-X-03 data authority: User = own contracts, Org = own organization, System = everything
  const scope = db.userScopes?.[userId] ?? 'System'
  if (scope === 'Org' && c.organizationId !== u.orgId && c.ownerUserId !== userId) return false
  if (scope === 'User' && c.ownerUserId !== userId && c.createdBy !== userId) return false
  if (c.confidentiality === 'Normal') return true
  return canRole(db.rolePerms, u.role, 'Contracts.ViewConfidential') || c.ownerUserId === userId || u.role === 'admin'
}
export const canSee = (db: DB, c: Contract): boolean => canSeeAs(db, db.userId, c)

/** Signature roles still missing for activation (BR-C-06). */
export function missingSignatureRoles(db: DB, c: Contract): string[] {
  const t = typeOf(db, c)
  if (!t.requiresSignature) return []
  const have = new Set(db.signatures.filter((s) => s.contractId === c.id).map((s) => s.role))
  return t.requiredSignatureRoles.filter((r) => !have.has(r))
}
export const hasSignedAttachment = (db: DB, c: Contract) => db.attachments.some((a) => a.ownerId === c.id && a.subType === 'Signed')

/** BR-C-02, 03, 04: what must be fixed before Submit. */
export function validateSubmit(db: DB, c: Contract): string[] {
  const t = typeOf(db, c)
  const e: string[] = []
  if (!c.title.trim()) e.push('العنوان مطلوب')
  if (c.direction !== 'Internal' && !c.counterpartyId && !c.counterpartyName?.trim()) e.push('الطرف الآخر مطلوب')
  if (t.profile !== 'General' && !c.counterpartyId) e.push('اتفاقيات الالتزام وعقود الخدمة تتطلب طرفاً مسجلاً في الأطراف')
  if (c.counterpartyId) {
    const p = db.partners.find((x) => x.id === c.counterpartyId)
    if (p && c.direction === 'Outgoing' && p.kind !== 'customer') e.push('العقد الصادر يتطلب عميلاً (BR-C-03)')
    if (p && c.direction === 'Incoming' && p.kind !== 'vendor') e.push('العقد الوارد يتطلب مورداً (BR-C-03)')
  }
  if (!c.startDate) e.push('تاريخ البداية مطلوب')
  if (!t.isOpenEnded && !c.endDate) e.push('تاريخ النهاية مطلوب')
  if (c.endDate && c.startDate && c.endDate < c.startDate) e.push('تاريخ النهاية يجب ألا يسبق تاريخ البداية')
  if (c.endDate && c.startDate && c.noticePeriodDays) {
    const duration = Math.round((Date.parse(c.endDate) - Date.parse(c.startDate)) / 86_400_000)
    if (c.noticePeriodDays > duration) e.push('مدة الإشعار أطول من مدة العقد')
  }
  if (c.renewalPolicy !== 'None' && !c.noticePeriodDays) e.push('سياسة التجديد تتطلب تحديد مدة الإشعار')
  if (c.renewalPolicy === 'Auto' && !c.autoRenewTermMonths) e.push('التجديد التلقائي يتطلب مدة التجديد بالأشهر')
  if (t.requiresContractValue && !(c.contractValue && c.contractValue > 0)) e.push('قيمة العقد مطلوبة لهذا النوع')
  if (t.requiresPaymentTerm && !c.paymentTermId) e.push('شرط الدفع مطلوب لهذا النوع')
  if (t.profile === 'Agreement' && !db.lines.some((l) => l.contractId === c.id && l.status === 'Open')) e.push('اتفاقية الالتزام تتطلب بنداً واحداً على الأقل')
  return e
}

/** Actions the current role may run on the contract now (BR-C-05…10, doc 03 transitions). */
export function allowedActions(db: DB, c: Contract): ActionDef[] {
  const t = typeOf(db, c)
  const out: ActionDef[] = []
  const can = (p: Perm) => canRole(db.rolePerms, db.role, p)
  const add = (a: ActionDef) => { if (can(a.perm)) out.push(a) }
  const sigMissing = missingSignatureRoles(db, c)
  const graceOver = c.status === 'Expired' && graceEnd(db, c) && today() > graceEnd(db, c)!

  switch (c.status) {
    case 'Draft':
      add({ id: 'edit', label: 'تعديل', perm: 'Contracts.Edit' })
      add({ id: 'submit', label: t.requiresApproval ? 'إرسال للاعتماد' : 'اعتماد مباشر', perm: 'Contracts.Submit', primary: true, ask: 'confirm' })
      add({ id: 'cancel', label: 'إلغاء', perm: 'Contracts.Cancel', ask: 'reason', reasonRequired: true, danger: true })
      if (!db.history.some((h) => h.contractId === c.id && h.from) && !db.links.some((l) => l.contractId === c.id)) add({ id: 'delete', label: 'حذف المسودة', perm: 'Contracts.Delete', ask: 'confirm', danger: true })
      break
    case 'PendingApproval':
      {
        const req = openRequest(db, 'Contract', c.id)
        const el = eligibility(db, req, db.userId)
        add({ id: 'approve', label: req ? `اعتماد (المرحلة ${req.currentStage} من ${req.stages.length})` : 'اعتماد', perm: 'Contracts.Approve', primary: el.ok, ask: 'reason', blocked: el.ok ? undefined : el.reason })
        add({ id: 'reject', label: 'رفض', perm: 'Contracts.Reject', ask: 'reason', reasonRequired: true, danger: true, blocked: el.ok ? undefined : el.reason })
      }
      break
    case 'Approved':
    case 'PendingSignature':
      if (c.status === 'Approved' && t.requiresSignature) add({ id: 'sendForSignature', label: 'إرسال للتوقيع', perm: 'Contracts.Activate', primary: true, ask: 'confirm' })
      add({
        id: 'activate', label: 'تفعيل العقد', perm: 'Contracts.Activate', primary: c.status === 'PendingSignature' || !t.requiresSignature, ask: 'confirm',
        blocked: sigMissing.length ? `تواقيع ناقصة: ${sigMissing.map((r) => (r === 'Company' ? 'الشركة' : r === 'Counterparty' ? 'الطرف الآخر' : r)).join('، ')}`
          : t.requiresSignature && !hasSignedAttachment(db, c) ? 'يلزم إرفاق مستند موقّع'
          : (c.effectiveDate ?? c.startDate) > today() ? `تاريخ السريان ${c.effectiveDate ?? c.startDate} لم يحن بعد — يُفعَّل تلقائياً عند حلوله إذا اكتملت التواقيع` : undefined,
      })
      add({ id: 'reopen', label: 'إعادة إلى مسودة', perm: 'Contracts.Edit', ask: 'reason', reasonRequired: true })
      break
    case 'Active':
      add({ id: 'edit', label: 'تعديل البيانات غير القانونية', perm: 'Contracts.Edit' })
      add({ id: 'suspend', label: 'تعليق', perm: 'Contracts.Suspend', ask: 'reason', reasonRequired: true })
      add({ id: 'terminate', label: 'إنهاء', perm: 'Contracts.Terminate', ask: 'reasonDate', reasonRequired: true, danger: true })
      add({ id: 'close', label: 'إغلاق (اكتمل)', perm: 'Contracts.Terminate', ask: 'reason' })
      break
    case 'OnHold':
      add({ id: 'edit', label: 'تعديل البيانات غير القانونية', perm: 'Contracts.Edit' })
      add({ id: 'resume', label: 'استئناف', perm: 'Contracts.Suspend', primary: true, ask: 'reason', reasonRequired: true })
      add({ id: 'terminate', label: 'إنهاء', perm: 'Contracts.Terminate', ask: 'reasonDate', reasonRequired: true, danger: true })
      break
    case 'Expired':
      add({ id: 'terminate', label: 'إنهاء', perm: 'Contracts.Terminate', ask: 'reasonDate', reasonRequired: true, danger: true, blocked: graceOver ? 'انتهت مدة السماح' : undefined })
      add({ id: 'close', label: 'إغلاق', perm: 'Contracts.Terminate', ask: 'reason' })
      break
    default:
      break
  }
  return out
}

/** BR-M-07: when a renewal successor activates, its predecessor closes with reason Renewed. */
function closePredecessor(d: DB, c: Contract, by: string) {
  const p = c.renewedFromContractId ? d.contracts.find((x) => x.id === c.renewedFromContractId) : undefined
  if (!p || !['Active', 'OnHold', 'Expired'].includes(p.status)) return
  d.history.push({ id: uid('h'), contractId: p.id, from: p.status, to: 'Closed', byUserId: by, at: nowStamp(), reason: `جُدِّد بالعقد ${c.number}` })
  p.status = 'Closed'; p.closureReason = 'Renewed'
}

export const record = (d: DB, c: Contract, to: ContractStatus, reason?: string) => {
  d.history.push({ id: uid('h'), contractId: c.id, from: c.status, to, byUserId: d.userId, at: nowStamp(), reason })
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: c.id, action: `status:${c.status}->${to}`, detail: reason ?? '' })
  c.status = to
}

/** Runs an action on a draft DB. Returns an error message, or null on success. */
export function perform(d: DB, id: string, action: ActionId, p: { reason?: string; date?: string } = {}): string | null {
  const c = d.contracts.find((x) => x.id === id)
  if (!c) return 'العقد غير موجود'
  const def = allowedActions(d, c).find((a) => a.id === action)
  if (!def) return 'هذا الإجراء غير متاح في الحالة أو الصلاحية الحالية'
  if (def.blocked) return def.blocked
  if (def.reasonRequired && !p.reason?.trim()) return 'السبب مطلوب'
  const t = typeOf(d, c)

  switch (action) {
    case 'submit': {
      const errs = validateSubmit(d, c)
      if (errs.length) return errs.join(' — ')
      if (!t.requiresApproval) { record(d, c, 'PendingApproval', 'بدون مسار اعتماد'); record(d, c, 'Approved', 'النوع لا يتطلب اعتماداً'); return null }
      const started = startApproval(d, 'Contract', c.id, c)
      if (typeof started === 'string') return started
      record(d, c, 'PendingApproval', p.reason)
      return null
    }
    case 'approve': {
      const req = openRequest(d, 'Contract', c.id)
      if (!req) return 'لا يوجد طلب اعتماد مفتوح'
      const stageNo = req.currentStage
      const r = decide(d, req.id, 'Approved', p.reason ?? '')
      if ('error' in r) return r.error
      if (r.outcome === 'approved') record(d, c, 'Approved', 'اكتملت مراحل الاعتماد')
      else d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: c.id, action: 'approval:stage', detail: `اعتُمدت المرحلة ${stageNo} — الآن المرحلة ${r.request.currentStage}` })
      return null
    }
    case 'reject': {
      const req = openRequest(d, 'Contract', c.id)
      if (!req) return 'لا يوجد طلب اعتماد مفتوح'
      const r = decide(d, req.id, 'Rejected', p.reason ?? '')
      if ('error' in r) return r.error
      record(d, c, 'Draft', `رُفض في المرحلة ${req.currentStage}: ${p.reason}`)
      return null
    }
    case 'sendForSignature': record(d, c, 'PendingSignature'); return null
    case 'reopen': record(d, c, 'Draft', p.reason); return null
    case 'activate': {
      c.activatedOn = today(); c.activatedBy = d.userId; c.versionNo = 1
      c.effectiveDate ??= c.startDate
      c.signatureDate = d.signatures.filter((s) => s.contractId === c.id).map((s) => s.signedOn).sort().pop() ?? c.signatureDate
      if (c.currency !== 'IQD') c.exchangeRate = rateOn(d, c.currency, today()) // BR-C-07 snapshot
      record(d, c, 'Active')
      createVersion(d, c, c.renewedFromContractId ? 'Renewal' : 'Activation')
      closePredecessor(d, c, d.userId)
      return null
    }
    case 'suspend': record(d, c, 'OnHold', p.reason); c.internalNotes = p.reason ?? c.internalNotes; return null
    case 'resume':
      if (c.endDate && c.endDate < today()) { record(d, c, 'Expired', `${p.reason} — تجاوز تاريخ النهاية`); return null }
      record(d, c, 'Active', p.reason); return null
    case 'terminate':
      if (!p.date) return 'تاريخ الإنهاء مطلوب'
      if (p.date < c.startDate) return 'تاريخ الإنهاء لا يسبق تاريخ البداية'
      c.terminationDate = p.date
      cancelOnTermination(d, c)
      record(d, c, 'Terminated', p.reason); return null
    case 'close': c.closureReason = 'Completed'; record(d, c, 'Closed', p.reason || 'اكتمل التنفيذ'); return null
    case 'cancel': record(d, c, 'Cancelled', p.reason); return null
    case 'delete':
      d.contracts = d.contracts.filter((x) => x.id !== id)
      d.parties = d.parties.filter((x) => x.contractId !== id)
      d.lines = d.lines.filter((x) => x.contractId !== id)
      d.attachments = d.attachments.filter((x) => x.ownerId !== id)
      d.signatures = d.signatures.filter((x) => x.contractId !== id)
      d.terms = d.terms.filter((x) => x.contractId !== id)
      d.history = d.history.filter((x) => x.contractId !== id)
      d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: id, action: 'delete', detail: c.number })
      return null
    default: return null
  }
}

/** BR-C-11 + BR-C-06: expires Active/OnHold contracts past their end date and promotes signed contracts whose effective date arrived. Called whenever the demo date changes. */
export function syncTime(d: DB): number {
  let n = 0
  d.contracts.forEach((c) => {
    if ((c.status === 'Approved' || c.status === 'PendingSignature') && (c.effectiveDate ?? c.startDate) <= d.asOf && !missingSignatureRoles(d, c).length
      && (!typeOf(d, c).requiresSignature || hasSignedAttachment(d, c))) {
      c.activatedOn = d.asOf; c.activatedBy = 'system'; c.versionNo = 1; c.effectiveDate ??= c.startDate
      if (c.currency !== 'IQD') c.exchangeRate = rateOn(d, c.currency, d.asOf)
      d.history.push({ id: uid('h'), contractId: c.id, from: c.status, to: 'Active', byUserId: 'system', at: `${d.asOf}T00:10`, reason: 'حلّ تاريخ السريان واكتملت التواقيع' })
      d.audit.push({ id: uid('aud'), at: nowStamp(), userId: 'system', entity: 'contract', entityId: c.id, action: 'status:auto-activate', detail: c.number })
      c.status = 'Active'
      const prev = d.userId; d.userId = 'system'
      createVersion(d, c, c.renewedFromContractId ? 'Renewal' : 'Activation', undefined, `${d.asOf}T00:10`)
      d.userId = prev
      closePredecessor(d, c, 'system')
      n++
    }
    if ((c.status === 'Active' || c.status === 'OnHold') && c.endDate && c.endDate < d.asOf) {
      d.history.push({ id: uid('h'), contractId: c.id, from: c.status, to: 'Expired', byUserId: 'system', at: `${addDays(c.endDate, 1)}T00:05`, reason: 'انتهت مدة العقد (تقدّم التاريخ التجريبي)' })
      d.audit.push({ id: uid('aud'), at: nowStamp(), userId: 'system', entity: 'contract', entityId: c.id, action: 'status:expired', detail: c.number })
      c.status = 'Expired'
      n++
    }
  })
  return n
}

/** Next contract number for a type (BR-C-01): CTR-{prefix}-{year}-{nnnnnn}. Mutates the counter. */
export function nextNumber(d: DB, typeId: string, startDate: string): string {
  const t = d.contractTypes.find((x) => x.id === typeId)!
  d.numbering[t.prefix] = (d.numbering[t.prefix] ?? 0) + 1
  return `CTR-${t.prefix}-${startDate.slice(0, 4)}-${String(d.numbering[t.prefix]).padStart(t.numberSize ?? 6, '0')}`
}
