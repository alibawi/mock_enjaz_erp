// Module 2 seed: Elsa stage rules (illustrative thresholds, editable in settings), delegations, and the approval history of the
// contracts in the contracts seed (completed requests for approved contracts, partial ones for contracts still pending).
import { addDays } from '../asof'
import { selectRule, valueIQD } from '../approval'
import type { ApprovalAction, ApprovalDelegation, ApprovalRequest, ApprovalStageDef, ApprovalStageRule, DB, SignatureRequest, StageStatus, TaskItem } from '../types'

const S = (no: number, label: string, userId: string, isLegalReview = false): ApprovalStageDef => ({ no, label, userId, isLegalReview })
const MANAGER = (n = 1) => S(n, 'مدير العقود', 'u-mgr')
const FINANCE = (n: number) => S(n, 'المدير المالي', 'u-fd')
const GM = (n: number) => S(n, 'المدير العام', 'u-gm')

export const stageRules: ApprovalStageRule[] = [
  { id: 'rule-a', name: 'عقود حتى 25 مليون دينار (3 مراحل)', subjectType: 'Contract', minValueIQD: 0, maxValueIQD: 25_000_000, isActive: true, stages: [MANAGER(), FINANCE(2), GM(3)] },
  { id: 'rule-b', name: 'عقود من 25 إلى 250 مليون دينار (5 مراحل)', subjectType: 'Contract', minValueIQD: 25_000_000, maxValueIQD: 250_000_000, isActive: true,
    stages: [MANAGER(), FINANCE(2), S(3, 'المستشار القانوني', 'u-leg'), S(4, 'مدير الإدارة القانونية والعقود', 'u-app'), GM(5)] },
  { id: 'rule-c', name: 'عقود أكثر من 250 مليون دينار (5 مراحل مع مراجعة قانونية)', subjectType: 'Contract', minValueIQD: 250_000_000, isActive: true,
    stages: [MANAGER(), FINANCE(2), S(3, 'مراجعة المستشار القانوني', 'u-leg', true), S(4, 'مراجعة الإدارة القانونية والعقود', 'u-app', true), GM(5)] },
  { id: 'rule-am-1', name: 'ملاحق حتى 100 مليون دينار (مرحلتان)', subjectType: 'Amendment', minValueIQD: 0, maxValueIQD: 100_000_000, isActive: true, stages: [MANAGER(), FINANCE(2)] },
  { id: 'rule-am-2', name: 'ملاحق أكثر من 100 مليون دينار (3 مراحل)', subjectType: 'Amendment', minValueIQD: 100_000_000, isActive: true, stages: [MANAGER(), FINANCE(2), GM(3)] },
  { id: 'rule-term', name: 'إنهاء العقود (مرحلتان)', subjectType: 'Termination', minValueIQD: 0, isActive: true, stages: [MANAGER(), GM(2)] },
]

export const delegations: ApprovalDelegation[] = [
  { id: 'dlg-1', fromUserId: 'u-gm', toUserId: 'u-app', fromDate: '2026-10-25', toDate: '2026-11-10', scopeType: 'All', reason: 'إجازة المدير العام', isActive: true },
  { id: 'dlg-2', fromUserId: 'u-fd', toUserId: 'u-leg', fromDate: '2026-09-01', toDate: '2026-09-15', scopeType: 'All', reason: 'مهمة رسمية خارج البلد', isActive: true },
  { id: 'dlg-3', fromUserId: 'u-mgr', toUserId: 'u-app', fromDate: '2026-12-01', toDate: '2026-12-15', scopeType: 'ContractType', scopeId: 'ct-sa1', reason: 'إجازة مرتقبة لمديرة العقود', isActive: true },
]

/** How many stages are already approved for contracts still PendingApproval in the contracts seed. */
const pendingProgress: Record<string, number> = { 'c-06': 1, 'c-19': 0, 'c-30': 2 }
const comments = ['موافق وفق الشروط المعروضة', 'تمت مراجعة البنود المالية — موافق', 'لا ملاحظات قانونية — موافق', 'موافق مع التوصية بمتابعة التنفيذ', 'اعتماد نهائي']

/** Mutates `db` (already containing contracts, history, signatures, rules and users). */
export function workflowSeed(db: DB): void {
  db.stageRules = structuredClone(stageRules)
  db.delegations = structuredClone(delegations)
  db.approvalRequests = []; db.approvalActions = []; db.tasks = []; db.signatureRequests = []

  db.contracts.forEach((c, idx) => {
    const t = db.contractTypes.find((x) => x.id === c.typeId)!
    const submitted = db.history.find((h) => h.contractId === c.id && h.to === 'PendingApproval')
    if (!t.requiresApproval || !submitted) return
    const rule = selectRule(db, 'Contract', c)
    if (!rule) return
    const done = c.status === 'PendingApproval' ? pendingProgress[c.id] ?? 0 : rule.stages.length
    const approvedAt = db.history.find((h) => h.contractId === c.id && h.to === 'Approved')?.at
    const day0 = submitted.at.slice(0, 10)
    const stageAt = (k: number) => (approvedAt && k === rule.stages.length ? approvedAt : `${addDays(day0, Math.floor(k / 2))}T${String(10 + (k % 5) * 2).padStart(2, '0')}:20`)
    const req: ApprovalRequest = {
      id: `apr-${c.id}`, subjectType: 'Contract', subjectId: c.id, contractId: c.id, ruleId: rule.id, ruleName: rule.name,
      stages: rule.stages.map((s) => ({ ...s, status: (s.no <= done ? 'approved' : s.no === done + 1 ? 'open' : 'waiting') as StageStatus })),
      workflowInstanceId: `wf-${String(idx + 1).padStart(4, '0')}`, status: c.status === 'PendingApproval' ? 'Pending' : 'Approved', currentStage: Math.min(done + 1, rule.stages.length),
      valueIQD: valueIQD(db, c), submittedBy: submitted.byUserId, submittedAt: submitted.at, completedAt: c.status === 'PendingApproval' ? undefined : approvedAt,
    }
    db.approvalRequests.push(req)
    rule.stages.forEach((s) => {
      const finished = s.no <= done
      const task: TaskItem = {
        id: `task-${c.id}-${s.no}`, requestId: req.id, contractId: c.id, subjectType: 'Contract', stageNo: s.no, assignedUserId: s.userId,
        status: finished ? 'Completed' : 'Open', result: finished ? 'Approved' : 'Pending', title: `اعتماد عقد — المرحلة ${s.no}: ${s.label}`,
        createdAt: s.no === 1 ? submitted.at : stageAt(s.no - 1), completedAt: finished ? stageAt(s.no) : undefined,
      }
      if (finished || s.no === done + 1) db.tasks.push(task)
      if (finished) {
        const a: ApprovalAction = { id: `act-${c.id}-${s.no}`, requestId: req.id, stageNo: s.no, approverUserId: s.userId, decision: 'Approved', comment: comments[(idx + s.no) % comments.length], taskId: task.id, decidedAt: stageAt(s.no) }
        db.approvalActions.push(a)
      }
    })
  })

  // e-signature requests: contracts whose signatures came through the provider, plus the one half-signed contract
  db.contracts.forEach((c) => {
    const sigs = db.signatures.filter((s) => s.contractId === c.id)
    if (!sigs.length || !sigs.some((s) => s.method === 'ExternalProvider')) return
    const signers: SignatureRequest['signers'] = sigs.map((s) => ({ id: s.id, role: s.role === 'Company' ? 'Company' : 'Counterparty', name: s.signerName, title: s.signerTitle, partyId: s.partyId, status: 'Signed', signedOn: s.signedOn }))
    if (c.status === 'PendingSignature') {
      const cp = db.parties.find((p) => p.contractId === c.id && p.isPrimary)!
      signers.push({ id: `${c.id}-sg-cp`, role: 'Counterparty', name: cp.contactName, title: cp.signatoryTitle, partyId: cp.id, status: 'Pending' })
    }
    db.signatureRequests.push({
      id: `sr-${c.id}`, contractId: c.id, provider: 'مزوّد تجريبي', status: c.status === 'PendingSignature' ? 'PartiallySigned' : 'Signed',
      signers, externalId: sigs.find((s) => s.externalSignatureId)?.externalSignatureId?.replace('SIG', 'ENV') ?? `ENV-${c.id}`,
      sentAt: `${addDays(sigs[0].signedOn, -2)}T11:00`, sentBy: 'u-mgr',
    })
  })
}
