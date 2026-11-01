// Elsa approval simulation (plan doc 09 §2, BR-W-01…07). The real stages and thresholds are Elsa workflow definitions configured by
// the organization; here they are rows of `db.stageRules`. The engine is generic over the subject (contract / amendment / termination).
import { today } from './asof'
import { convertAmount } from './currency'
import { nowStamp, uid } from './format'
import { can as canRole } from './permissions'
import { getSetting } from './settings'
import type { ApprovalDelegation, ApprovalRequest, ApprovalStageRule, Contract, DB, StageStatus, SubjectType, TaskItem } from './types'

export const valueIQD = (db: DB, c: Contract) => (c.contractValue ? Math.round(convertAmount(db, c.contractValue, c.currency, 'IQD', today())) : 0)

const specificity = (r: ApprovalStageRule) => (r.typeId ? 2 : 0) + (r.organizationId ? 1 : 0)

/** BR-W-01: first matching active rule (most specific wins) by subject, type, organization and value in IQD. */
export function selectRule(db: DB, subjectType: SubjectType, c: Contract): ApprovalStageRule | undefined {
  const v = valueIQD(db, c)
  return db.stageRules
    .filter((r) => r.isActive && r.subjectType === subjectType && v >= r.minValueIQD && (r.maxValueIQD === undefined || v < r.maxValueIQD)
      && (!r.typeId || r.typeId === c.typeId) && (!r.organizationId || r.organizationId === c.organizationId))
    .sort((a, b) => specificity(b) - specificity(a))[0]
}

export const openRequest = (db: DB, subjectType: SubjectType, subjectId: string) =>
  db.approvalRequests.find((r) => r.subjectType === subjectType && r.subjectId === subjectId && r.status === 'Pending')
export const requestsOf = (db: DB, contractId: string) => db.approvalRequests.filter((r) => r.contractId === contractId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

/** BR-W-06: a delegation makes `toUserId` an eligible approver for `fromUserId`'s stages when active, in dates and in scope. */
export function delegationFor(db: DB, fromUserId: string, toUserId: string, c: Contract, date = today()): ApprovalDelegation | undefined {
  return db.delegations.find((x) => x.isActive && x.fromUserId === fromUserId && x.toUserId === toUserId && x.fromDate <= date && date <= x.toDate
    && (x.scopeType === 'All' || (x.scopeType === 'ContractType' && x.scopeId === c.typeId) || (x.scopeType === 'Organization' && x.scopeId === c.organizationId)))
}

export interface Eligibility { ok: boolean; onBehalfOf?: string; reason?: string; stageNo?: number }

/** BR-W-03/06 + legal-review rule: can `userId` decide the current stage of the request? */
export function eligibility(db: DB, req: ApprovalRequest | undefined, userId: string): Eligibility {
  if (!req || req.status !== 'Pending') return { ok: false, reason: 'لا يوجد طلب اعتماد مفتوح' }
  const stage = req.stages.find((s) => s.no === req.currentStage)
  if (!stage) return { ok: false, reason: 'لا توجد مرحلة مفتوحة' }
  const c = db.contracts.find((x) => x.id === req.contractId)!
  const user = db.users.find((u) => u.id === userId)
  if (!user) return { ok: false, reason: 'مستخدم غير معروف' }
  const stageUser = db.users.find((u) => u.id === stage.userId)
  const direct = stage.userId === userId
  const del = direct ? undefined : delegationFor(db, stage.userId, userId, c)
  if (!direct && !del) return { ok: false, stageNo: stage.no, reason: `المرحلة ${stage.no} (${stage.label}) بانتظار ${stageUser?.name ?? stage.userId}` }
  const creator = req.subjectType === 'Amendment' ? db.amendments.find((a) => a.id === req.subjectId)?.createdBy : c.createdBy
  if (creator === userId && !getSetting<boolean>(db, 'Approval.AllowCreatorApproval')) return { ok: false, stageNo: stage.no, reason: 'لا يجوز لمنشئ العقد اعتماده (فصل المهام)' }
  if (stage.isLegalReview && !canRole(db.rolePerms, user.role, 'Contracts.ViewConfidential')) return { ok: false, stageNo: stage.no, reason: 'مرحلة المراجعة القانونية تتطلب صلاحية «عرض العقود السرية»' }
  return { ok: true, onBehalfOf: del ? stage.userId : undefined, stageNo: stage.no }
}

const openTask = (d: DB, req: ApprovalRequest, stageNo: number, subjectLabel: string) => {
  const st = req.stages.find((s) => s.no === stageNo)!
  const t: TaskItem = {
    id: uid('task'), requestId: req.id, contractId: req.contractId, subjectType: req.subjectType, stageNo, assignedUserId: st.userId, status: 'Open', result: 'Pending',
    title: `${subjectLabel} — المرحلة ${stageNo}: ${st.label}`, createdAt: nowStamp(),
  }
  d.tasks.push(t)
  return t
}

const subjectLabel = (t: SubjectType) => (t === 'Contract' ? 'اعتماد عقد' : t === 'Amendment' ? 'اعتماد ملحق' : 'اعتماد إنهاء')

/** Starts an approval request (BR-W-02: one open request per subject). Returns an error message or the request. */
export function startApproval(d: DB, subjectType: SubjectType, subjectId: string, c: Contract): string | ApprovalRequest {
  if (openRequest(d, subjectType, subjectId)) return 'يوجد طلب اعتماد مفتوح لهذا الموضوع'
  const rule = selectRule(d, subjectType, c)
  if (!rule) return 'لا يوجد مسار اعتماد مضبوط (Elsa) يطابق هذا العقد — راجع «مراحل الاعتماد» في الإعدادات'
  const req: ApprovalRequest = {
    id: uid('apr'), subjectType, subjectId, contractId: c.id, ruleId: rule.id, ruleName: rule.name,
    stages: rule.stages.map((s) => ({ ...s, status: (s.no === 1 ? 'open' : 'waiting') as StageStatus })),
    workflowInstanceId: `wf-${Math.random().toString(36).slice(2, 8)}`, status: 'Pending', currentStage: 1, valueIQD: valueIQD(d, c),
    submittedBy: d.userId, submittedAt: nowStamp(),
  }
  d.approvalRequests.push(req)
  openTask(d, req, 1, subjectLabel(subjectType))
  return req
}

export type Decision = { error: string } | { outcome: 'next' | 'approved' | 'rejected'; request: ApprovalRequest }

/** BR-W-04/05: records one stage decision. Opens the next stage, or completes the request. The caller applies the contract status change. */
export function decide(d: DB, requestId: string, decision: 'Approved' | 'Rejected', comment: string, actorId = d.userId): Decision {
  const req = d.approvalRequests.find((r) => r.id === requestId)
  if (!req || req.status !== 'Pending') return { error: 'الطلب غير مفتوح' }
  const el = eligibility(d, req, actorId)
  if (!el.ok) return { error: el.reason ?? 'غير مخوّل' }
  if (decision === 'Rejected' && !comment.trim()) return { error: 'سبب الرفض مطلوب' }
  const stage = req.stages.find((s) => s.no === req.currentStage)!
  const task = d.tasks.find((t) => t.requestId === req.id && t.stageNo === stage.no && t.status === 'Open')
  if (d.approvalActions.some((a) => a.requestId === req.id && a.stageNo === stage.no)) return { error: 'سُجّل قرار هذه المرحلة مسبقاً' }
  d.approvalActions.push({
    id: uid('act'), requestId: req.id, stageNo: stage.no, approverUserId: actorId, onBehalfOfUserId: el.onBehalfOf, decision, comment: comment.trim(), taskId: task?.id ?? '', decidedAt: nowStamp(),
  })
  if (task) { task.status = 'Completed'; task.result = decision === 'Approved' ? 'Approved' : 'Rejected'; task.completedAt = nowStamp() }
  if (decision === 'Rejected') {
    stage.status = 'rejected'; req.status = 'Rejected'; req.completedAt = nowStamp()
    req.stages.filter((s) => s.status === 'waiting').forEach((s) => { s.status = 'waiting' })
    return { outcome: 'rejected', request: req }
  }
  stage.status = 'approved'
  const next = req.stages.find((s) => s.no === stage.no + 1)
  if (next) {
    next.status = 'open'; req.currentStage = next.no
    openTask(d, req, next.no, subjectLabel(req.subjectType))
    return { outcome: 'next', request: req }
  }
  req.status = 'Approved'; req.completedAt = nowStamp()
  return { outcome: 'approved', request: req }
}

/** Open tasks the user can act on: assigned to them or delegated to them (BR-W-06). */
export function tasksFor(db: DB, userId: string) {
  return db.tasks.filter((t) => {
    if (t.status !== 'Open') return false
    if (t.assignedUserId === userId) return true
    const c = db.contracts.find((x) => x.id === t.contractId)
    return !!c && !!delegationFor(db, t.assignedUserId, userId, c)
  })
}
