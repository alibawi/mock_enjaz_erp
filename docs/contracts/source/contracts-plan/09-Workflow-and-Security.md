# 09 — Workflow, Permissions and Security

## 1. What exists (verified) and what is reused

| Existing | Finding | Decision |
|---|---|---|
| `DocBase.WorkflowStatus` (`Draft, Pending, Approved, Posted, Canceled, Reversed`), `ApprovedBy`, `SubmittedBy`, `ApprovalLevel`, `RejectionReason`; `IDocumentWorkflowModeProvider` reading ABP settings (`DirectPosting`, …) | Approval fields live on **documents**, driven by settings per document type | Not reused: a contract is not a `DocBase`. The *vocabulary* (Draft/Pending/Approved) is mirrored in statuses. |
| Core `WorkflowSetting`, `EntityWorkflowSetting` (entity type + operation → Elsa workflow definition/webhook), Elsa 3 in the host, `TaskItem` approvals | A full workflow engine with human tasks exists | **Used for contract approvals** (section 2) |
| Notification module | in-app/push with idempotent dispatcher and escalation | Used for approval tasks notifications |
| `ApplyDataAuthority` | org/user/system filter | Mandatory |



## 2. Approval design (ADR-06 revised): Elsa workflow, stages by amount and organization policy

Owner's decision: approvals run on the **existing Elsa workflow engine**. A creator submits the contract, a different user approves, and the number of stages (3, 5, …) depends on the amount and on the organization's policy.

What the repository provides (verified): Elsa 3 runs inside the API host (`ConfigureElsa`, workflows and runtime state in SQL Server, JavaScript/Liquid/C# expressions, custom activities discovered from the host assembly); business modules do not reference Elsa — workflows call module commands through MediatR activities; `TaskItem` (Core) is the human task (`Type=Approval`, `Result=Pending/Approved/Rejected`, `EntityType/EntityId/EntityRef/HyperlinkPage`, `NextWorkflowDefinitionId`, forms); `TaskItemUpdateStatusCommandHandler` starts the next workflow when a task is decided (`TriggerNextWorkflowAsync`); `EntityWorkflowSetting` maps (entity type, `Create|Update|Delete`) to an active workflow definition or webhook.

Division of responsibility:
| Concern | Owner |
|---|---|
| Which stages, who approves each stage, thresholds by amount, organization/type conditions, escalation | **Elsa workflow definitions** (edited by the organization's administrator; no code change per policy) |
| Contract states, locking, history, permissions, final state change | **Contracts module** (commands below) |
| Human task, inbox, form, decision | Core `TaskItem` |

Flow:
1. `ContractSubmitCommand` moves the contract `Draft → PendingApproval`, writes the history row and a `ContractApprovalRequest` (id, subject, `WorkflowInstanceId`), and saves. **The workflow is started by configuration, not by code** (owner: the service is activated manually): an administrator creates an `EntityWorkflowSetting` row (entity type `Contract`, operation `Update`, the Elsa workflow definition). Verified mechanism: `GenericEntityEventHandler` looks up settings by `entityType.Name` and operation for any entity, backed by `EntityWorkflowSettingsCacheService` (memory cache; call its refresh after changing settings). The workflow filters on `Status == PendingApproval` because the trigger fires on every update of the contract. Contracts contain no Elsa start code.
2. The workflow reads the contract (value, currency, type, organization, direction), computes the stage list (JavaScript/expression rules such as `value < X → 3 stages`, `else 5 stages`, optional legal-review stage), and creates one approval `TaskItem` per stage (`EntityType="Contract"`, `EntityId`, deep link to the contract page).
3. Each decided stage calls `ContractApprovalStageRecordCommand` (stage no., approver, decision, comment) through a MediatR activity so the contract keeps its own approval history.
4. After the last approve: `ContractApproveCommand` → `Approved`. Any reject: `ContractRejectCommand` → back to `Draft` with the comment.
5. Both system commands are accepted only from the workflow service identity or a user holding `Contracts.Approve`; they verify the contract is `PendingApproval` and the request id matches (`ApprovalRequestMismatch`), so a stray call cannot approve.

Rules enforced by the Contracts commands regardless of workflow design:
- Segregation of duties: the approver (`DecisionByUserId`) can never be the contract's creator (`ContractsManagement:SegregationOfDuties`), unless the tenant setting `ContractsManagement.Approval.AllowCreatorApproval` is on.
- Idempotency: a stage decision is unique by `(RequestId, StageNo)`; repeating it is a no-op.
- A contract can have only one open approval request.
- Modification of legally significant fields stays locked while `PendingApproval`.
- If the workflow engine is down or no workflow is configured, `Submit` fails with `ApprovalWorkflowNotConfigured` (or, when the type has `RequiresApproval=false`, goes straight to `Approved`).

Consequences for the design: the entities `ContractApprovalPolicy` and `ContractApprovalPolicyStep`, the policy matcher and the policy-management screen/permission are **removed**; amendments and terminations (approval subject types) use their own workflow definitions in the same way.

## 3. Permissions

Group `ContractsManagement` (existing constant), following the entity-permission pattern used in other modules (`<Entity>Permissions` classes + one `PermissionDefinitionProvider`, localised display names under `Permission:ContractsManagement…`).

| Permission | Meaning | Release |
|---|---|---|
| `ContractsManagement.Contracts` (Default) | view lists/details of authorised contracts | R1 |
| `.Contracts.Create` | create Draft | R1 |
| `.Contracts.Edit` | edit Draft; edit non-legal metadata; manage links/signatures/attachments | R1 |
| `.Contracts.Delete` | delete Draft | R1 |
| `.Contracts.Submit` | submit for approval | R1 |
| `.Contracts.Approve` / `.Contracts.Reject` | approval decisions (still checked against policy step) | R1 |
| `.Contracts.Activate` | send for signature, activate | R1 |
| `.Contracts.Suspend` | suspend/resume | R1 |
| `.Contracts.Terminate` | terminate/close | R1 |
| `.Contracts.Cancel` | cancel Draft | R1 |
| `.Contracts.Amend` | create/apply amendments | R1 |
| `.Contracts.Renew` | renewal/successor | R1 (manual) |
| `.Contracts.ViewConfidential` | see Confidential/Restricted contracts and their attachments | R1 |
| `.Contracts.Export` | export grid/reports | R1 |
| `.Contracts.Attachments` (+ `.View`, `.Upload`, `.Download`, `.Delete`) | attachment permissions, same shape as Sales (`DeliveryPermissions`, `PriceListPermissions`) | R1 |
| `.Contracts.Fulfillment.Recalculate` | rebuild balances | R1 |
| `.ContractTypes` (+ `.Manage`) | configure types | R1 |
| `.Templates` (+ `.Manage`), `.Clauses.Manage` | templates/clause library | R1 |
| `.Obligations` (+ `.Manage`, `.Complete`, `.Accept`) | obligations | R1 |
| `.ApprovalDelegations` (+ `.Manage`) | create/revoke approval delegations (own delegations need only `.Contracts.Approve`; managing others needs `.Manage`) | R1 |
| `.Reports` | reports/dashboard | R1 |

Default role grants are seeded by a `DefaultRolePermissionSeeder` (as `NotificationDefaultRolePermissionSeeder` does) per the role table in doc 03 §7.

## 4. Tenant isolation and organization data authority

- **Tenant:** all aggregates and children are `IMultiTenant`; ABP’s global filter applies automatically. Unique indexes carry `TenantId`. Host-level (tenant null) data is not shared with tenants. Jobs always run inside `currentTenant.Change(tenantId)` (pattern of `PostingPeriodAutoCreateJob`).
- **Org authority:** `ApplyDataAuthority(currentUser)` (User → `CreatorId`; Org → `OrganizationId`; System → none; unknown claim → fail-closed) is **not** an EF global filter: it must be applied explicitly. Therefore:
  1. Every query handler that returns contracts, children, ledger entries, timeline, versions, fulfillment, documents or reports starts from `IContractRepository.GetQueryableAsync().ApplyDataAuthority(currentUser)` (or a repository method that does).
  2. Child lists (lines, entries, versions…) are loaded **through** an authorised contract id; no endpoint lists children without the parent authorisation check.
  3. `ContractGetByIdQuery` returns 404 for contracts outside authority (does not reveal existence).
  4. Command handlers load the aggregate through the same authorised path before mutating.
  5. Integration services called by Sales/Procurement (`ResolveAsync`) additionally filter by the *document’s* `OrganizationId` (a document in org A cannot consume an agreement of org B). Cross-organization agreements (shared framework contracts) are out of R1 (Q-04 asks whether needed).
  6. Test (doc 12): a user with `Org` authority in org A cannot read, link, or act on an org B contract through any endpoint, report, or integration call.
- **Confidentiality:** `Confidentiality ∈ {Normal, Confidential, Restricted}`. Lists exclude Confidential/Restricted unless `ViewConfidential`; for `Restricted`, access is further limited to owner, responsible, approvers in the current request, and users with `ViewConfidential` + System authority. Attachments follow the contract’s level (ADR-09); server-side enforcement against direct DMS calls is ADR-26 (accepted: `IDocumentAccessPolicy` hook). Audit entries are readable only with contract access.
- **Unauthorized modification prevention:** no generic update endpoint; locked fields enforced in the aggregate (not just the UI); concurrency stamp; every transition recorded with user.

## 5. Auditability

| Mechanism | Covers |
|---|---|
| ABP `[Audited]` on aggregates + entity-change history (Sales exposes it via `Get<Entity>AuditChanges` handlers) | field-level changes of Contract and children |
| `ContractStatusHistory` | all status transitions, reason, user, time |
| `ContractVersion` snapshots | legally significant state at activation and each amendment (hash-protected) |
| `ContractApprovalAction` | who approved/rejected, when, comment |
| `ContractFulfillmentEntry` | every counter movement with source document |
| `ContractNotificationLog` | which alerts were sent |
Tamper evidence: `PayloadHash` (SHA-256 of canonical JSON) stored with each version; a verification endpoint recomputes it (R2).

## 6. Sensitive-data and abuse considerations
- Contract values and counterparties are commercially sensitive: no values in notification bodies for Restricted contracts (only title/number); logs never contain `InternalNotes`.
- Export permission is separate (`Export`); export of Confidential contracts requires `ViewConfidential`.
- Bulk operations (mass terminate/cancel) are not offered.
- Rate-limiting on `fulfillment/recalculate` (heavy): single concurrent run per contract (distributed lock via row-level `sp_getapplock` or the unique open recalculation marker — decide in Phase 5).
- File upload limits are those of DMS; Contracts endpoints additionally check the `Attachments.*` permission and contract access before delegating to DMS.
