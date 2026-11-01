# Spec — Module 2: workflow (الاعتماد والتوقيع)

Derived from plan doc 09 §2 (Elsa approvals, ADR-06 revised), 03 §3 T1–T7, 02 §2.5 (signatures), ADR-22 (e-signature abstraction), FR-DL-01 (delegation).

## 1. Scope and relationships
Simulates the Elsa approval workflow for contracts, amendments and terminations: stage lists by amount, approver tasks (TaskItem-like inbox), decisions, creator ≠ approver, delegation, and the e-signature provider simulation. Depends on contracts; used by amendments (amendment approvals) and settings-access (stage table screen).

## 2. Data model
**ApprovalStageRule** (settings table): minValue, maxValue?, currency (IQD basis), stages[] (stageNo, label, role or userId, isLegalReview), organizationId?, contractTypeId?, subjectType (Contract / Amendment / Termination). Seed: below 25,000,000 IQD → 3 stages (manager, finance, general manager); 25,000,000–250,000,000 → 5 stages (manager, finance, legal, finance director, general manager); above → 5 stages with extra legal review. (Illustrative thresholds, editable.)
**ApprovalRequest**: id, subjectType, subjectId, contractId, workflowInstanceId (mock id), status (Pending, Approved, Rejected, Cancelled), currentStage, submittedBy/On, completedOn.
**ApprovalAction**: requestId, stageNo, approverUserId, onBehalfOfUserId?, decision (Approved / Rejected), comment, taskItemId, decidedOn.
**TaskItem** (mock): id, type=Approval, status (Open, Completed, Cancelled), result (Pending, Approved, Rejected), assignedUserId, entityType=Contract, entityId, hyperlink, createdOn.
**ApprovalDelegation**: fromUserId, toUserId, fromDate, toDate, scopeType (All / ContractType / Organization), scopeId?, isActive.
**SignatureRequest** (e-sign simulation): contractId, provider "مزوّد تجريبي", status (Draft, Sent, PartiallySigned, Signed, Declined, Expired), signers[] (partyId, name, status, signedOn), externalSignatureId, sentOn.

## 3. Status lifecycles
Approval request: Pending → Approved | Rejected | Cancelled. Stage: Waiting → Open → Approved | Rejected. TaskItem: Open → Completed | Cancelled. Signature request: Draft → Sent → PartiallySigned → Signed | Declined | Expired. Contract effects: submit → PendingApproval; all stages approved → Approved; any rejection → back to Draft with the comment.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-W-01 | Submit picks the first matching ApprovalStageRule (subject type, type, organization, value converted to IQD); no rule and type requires approval → block with "workflow not configured"; type without approval goes straight to Approved. |
| BR-W-02 | One open request per subject. |
| BR-W-03 | The approver can never be the contract creator unless system setting `AllowCreatorApproval` is on. |
| BR-W-04 | A stage opens only when the previous stage is approved; each stage decision is recorded once. |
| BR-W-05 | A rejection (comment mandatory) returns the contract to Draft and closes the request. |
| BR-W-06 | An active delegation makes the delegate an eligible approver for the delegator's tasks in scope and dates; the action records `onBehalfOf`; expired delegations are ignored. |
| BR-W-07 | Locked fields stay locked during PendingApproval. |
| BR-W-08 | E-signature: "send" is available when the type requires signatures and the contract is Approved; simulated provider events (signed/declined) advance the request; a Signed request creates ContractSignature rows (method ExternalProvider) and a Signed attachment. |
| BR-W-09 | Feature flag setting `ESignature` off hides sending (default on in the demo). |

## 5. Permissions
Approve / reject (approver, manager, legal, finance as per stage), submit (requester, manager), send for signature and activate (manager), manage delegations (own: any approver; others: admin). Matrix in module 8.

## 6. Module KPIs
Open approval tasks (current role), average approval time, contracts waiting per stage, signature requests by status.

## 7. Integrations (placeholders)
Elsa (stage simulation), Core TaskItem inbox (mock inbox), e-signature provider (mock).

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| W1 | Approvals tab on the contract card | stage timeline (`StageTimeline`) with approver, status, comment, task link; action buttons for the eligible user |
| W2 | My tasks `/tasks` | open approval tasks for the current role/user (includes delegated); approve / reject dialog with comment |
| W3 | Delegations `/delegations` | list + dialog (period, scope), activate/revoke |
| W4 | Signatures tab + send-for-signature dialog | signers from parties; provider status; simulate buttons (signed / declined) |
| W5 | Approval stage table `/settings/approval-stages` | CRUD of ApprovalStageRule (built in module 8; read-only preview here) |

## 9. Build order
2.1 routes + seed (rules, tasks, delegations, signature requests) · 2.2 W1 stage timeline · 2.3 approval engine (`approval.ts`) with BR-W-01…07 · 2.4 W2 tasks inbox + decision dialog · 2.5 W3 delegations · 2.6 W4 e-sign simulation · 2.7 KPIs · 2.8 flow test (create → submit → approve across stages → sign → activate).

## 10. Plan gaps logged
- Threshold values and stage owners are the organization's policy (plan Q-17 left them to configuration); the seed values are illustrative.
- The Elsa trigger is configuration in the real system; the mock simply starts the simulation at Submit.
