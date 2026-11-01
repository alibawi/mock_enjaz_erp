# 13 — Implementation Roadmap

Principle: smallest useful production release (R1) first, preserve a clean architecture; by owner decision all former R2/R3 items are now inside R1 (tracks A–D). Phases are re-ordered from the brief’s suggestion to respect real dependencies (the module skeleton already exists; Sales/Procurement hooks need the domain + integration service first; the UI is built incrementally with each backend phase rather than as a late big-bang).

Complexity scale: S ≤ 3 days, M ≈ 1–2 weeks, L ≈ 2–4 weeks, XL > 4 weeks (one senior developer; indicative only, to be re-estimated after Phase 1).

| Phase | Name | Release | Complexity |
|---|---|---|---|
| 0 | Investigation & competitor analysis | **done (this plan)** | – |
| 1 | Decisions & prerequisites | R1 | S |
| 2 | Module foundation, domain, persistence | R1 | L |
| 3 | Lifecycle, permissions, approvals (API) | R1 | L |
| 4 | Documents, signatures, amendments, versions | R1 | L |
| 5 | Agreement engine + Sales/Procurement integration | R1 | XL |
| 6 | Notifications, jobs, reports (R1 set) | R1 | M |
| 7 | Vue frontend R1 | R1 | L |
| 8 | Hardening: tests, performance, security, docs, rollout | R1 | M |
| 9 | R1 track A: obligations, milestones, penalties, payment schedule, financial summary | R1 | XL |
| 10 | R1 track B: templates, clause library, contract terms, printing | R1 | L |
| 11 | R1 track C: service contracts/SLA (contract side), e-signature abstraction (no real provider until requested), recurring-billing automation | R1 | XL |
| 12 | Final hardening and rollout of the enlarged R1 | R1 | M |
| 13 | R1 track D: category commitments, delivery schedules, general bonus agreements, auto-renewal, version compare, advanced risk flags, approval delegation | R1 | XL |

(Phases 7 can start as soon as Phase 3 APIs are stable; Phases 4–6 are partly parallelisable by different developers: 4 and 6 are independent of 5.)

## Phase 1 — Decisions & prerequisites
- **Objective:** close blocking questions; fix R1 scope. **Scope:** answer Q-01…Q-06 (doc 14), confirm additive changes (doc 08 §2), confirm permissions names, get the DMS and Sales/Procurement owners’ buy-in.
- **Dependencies:** none. **Entities/commands/APIs/UI:** none. **Integration points:** none.
- **Tests:** none. **Acceptance:** doc 14 §5 has no *blocking* open question. **Risks:** late changes to counting rules. **DoD:** ADR statuses set to Accepted.

## Phase 2 — Module foundation, domain, persistence
- **Objective:** replace the template with the real domain and database. **Scope:**
  - Remove samples (`SampleController`, `ISampleAppService`, `SampleDto`, `ContractsManagementAppService`, AutoMapper profile); prune locale files to `ar`/`en`.
  - Domain.Shared enums/consts/errors/events; Domain entities for R1 tables (doc 04/06), factories, repositories, domain services (state machine, numbering, snapshot builder, resolver, ledger service), settings.
  - EFCore: configurations, repositories; **one migration** in the host project; seed types + numbering.
  - Create `Enki.ContractsManagement.{Domain,Application,EntityFrameworkCore}.Tests` + `TestBase`; add to solution. Additive Core changes: `DocumentTypeData.Contract`, DMS `EntityType.Contract = 24`.
- **Dependencies:** Phase 1. **Required entities:** ContractType, Contract (+Parties, Lines, Signatures), ContractLineBalance, FulfillmentEntry, StatusHistory, Version, Amendment, ApprovalRequest/Action, DocumentLink, NotificationLog. **Commands/queries:** none exposed yet (domain tests drive).
- **Tests:** domain unit tests (state machine, invariants, lines, ledger math), EF mapping tests, migration test. **Acceptance:** FR-LC-01/02/03, FR-AG-01/06 domain-level; build of whole solution green.
- **Risks:** migration conflicts with other branches (the file `JasimERPDbContextModelSnapshot.cs` is a hot file) → merge/rebase migration last; naming of `DocumentTypeData` code collision. **Complexity:** L. **DoD:** domain coverage ≥ 90 % on state machine & ledger; migration applied locally via DbMigrator; no AutoMapper left.

## Phase 3 — Lifecycle, permissions, approvals (API)
- **Objective:** a contract can be created, approved and activated through the API. **Scope:** permissions + definition provider + default role seeding; approval via the Elsa workflow (trigger, `ContractApprovalStageRecordCommand`, Approve/Reject commands; sample 3- and 5-stage workflow definitions delivered as seed/export) and commands Create/UpdateDraft/UpdateMetadata/Submit/Approve/Reject/SendForSignature/Activate/Suspend/Resume/Terminate/Cancel/Close/Reopen/RecordSignature; queries GetById/GetList/Timeline/Dashboard; ContractType CRUD; validators; controllers; `AllowedActions`; data authority + confidentiality in all queries; localization strings.
- **Dependencies:** Phase 2. **APIs:** doc 07 §3 (contract, type, policy, approval). **UI:** none (Swagger/Scalar + `.http` files).
- **Tests:** unit (validators/handlers), integration (authorization matrix, tenant, org authority, concurrency), E1, E2 (API). **Acceptance:** FR-MD-01…07, FR-LC-01…06, doc 09 rules. **Risks:** approval policy complexity → keep sequential single-approver steps. **Complexity:** L. **DoD:** all R1 lifecycle requirement tests green; Swagger documents every endpoint; no endpoint accepts status/version/balances.

## Phase 4 — Documents, signatures, amendments, versions
- **Scope:** DMS attach/list/download through Contracts endpoints with `Attachments.*` permissions and confidentiality gate (verify DMS generic endpoints, doc 14 §6.4); signature recording UI-ready endpoints; `ContractAmendment` commands (create/update/submit/approve/reject/apply/cancel), `ContractVersion` snapshots, version list/get, timeline/audit queries; interim rule (metadata whitelist) is replaced by amendments.
- **Dependencies:** Phase 3 and the **DMS work package of ADR-26** (access-policy hook; accepted option A). **Integration:** DMS (I-7). **Tests:** E8, FR-CA-03/04/05, FR-DS-01/02, attachment permission and DMS-bypass tests. **Acceptance:** snapshot immutability (no update path), stale-amendment rejection. **Risks:** a DMS endpoint missed by the hook (mitigated by the bypass test matrix). **Complexity:** L. **DoD:** versions hash-verified in tests.

## Phase 5 — Agreement engine and Sales/Procurement integration
- **Objective:** commitments, price resolution, fulfillment from real documents. **Scope:**
  - Contracts side: `IAgreementIntegrationService` (Resolve/Validate), event handler, `AgreementCounterRules`, reconciliation job, `FulfillmentRecalculate`, fulfillment queries, document links, `Exceeded` handling, feature flag.
  - Inventory side (via `jasim-inventory` agent): GoodsReceipt with base `Return` and GoodsIssue with base `PurchaseReturn` publish the physical-return events (doc 08 §3.1).
  - Sales side (via `jasim-sales` agent): resolve on line entry; validate before save; publish `AgreementDocumentLineChangedEvent` on create/update/post/cancel/delete for SaleQuotation (link only), SaleOrder, Delivery, SaleInvoice, SaleReturn, ARCreditMemo; implement `IAgreementDocumentSource`.
  - Procurement side (via `jasim-procurement`): PurchaseOrder, GoodsReceiptPO, PurchaseBill, GoodsReturn, PurchaseReturn.
  - Resolve Q-02 (return semantics), Q-13 (back orders), Q-01 (event atomicity) at the start.
- **Dependencies:** Phases 2–3 (Phase 4 not required). **Tests:** doc 08 scenario matrix S1–S15 in both modules, regression suites for Sales and Procurement with feature on/off, concurrency tests. **Acceptance:** FR-AG-01…08; `Σ ledger == balance` invariant under 20-way parallel load; no double counting in S4 and S9. **Risks:** touching ~11 handlers in stable posting flows; event ordering; UoM/currency conversion edge cases. **Mitigation:** hooks isolated in one `AgreementEventPublisher` per module; feature flag; characterization tests written first. **Complexity:** XL. **DoD:** Sales and Procurement owners sign off; drift report shows zero drift after a 1-week pilot tenant run.

## Phase 6 — Notifications, jobs, R1 reports
- **Scope:** `ContractExpiryJob`, `ContractReminderJob`, reconciliation job registration, notification templates (ar/en) and rules `ExpiryN`, `NoticeDeadline`, `Expired`, `ApprovalPending`, `SignatureMissing`, `Exceeded`; reports R-01…R-13, R-17 (queries + Excel export); settings.
- **Dependencies:** Phase 3 (and 5 for R-09/10/17). **Tests:** E10, dedup tests, report security tests. **Acceptance:** FR-RN-01/02, report filters respect org authority. **Risks:** Notification category/template gaps. **Complexity:** M. **DoD:** jobs registered in `ConfigureRecurringJobs()`, run twice with identical outcome.

## Phase 7 — Vue frontend (R1)
- **Scope:** screens 1–10 of doc 10 using Type A/B patterns; i18n ar/en + RTL; CASL; navigation; Sales/Procurement line-grid agreement badge (done by their frontend owners). Use `vue3-erp-developer` + `jasim-frontend-reviewer`.
- **Dependencies:** Phase 3 for core screens, 4 for documents/amendments, 5 for fulfillment/line badge, 6 for reports. **Tests:** vitest, Playwright E1/E3/E5, `typecheck`, `lint`, `build`. **Acceptance:** screens meet doc 10 field/permission/status behaviour; a11y/RTL checks. **Complexity:** L. **DoD:** reviewer agent clean; no hard-coded strings.

## Phase 8 — Hardening and rollout (end of R1)
- **Scope:** performance tests (doc 12 §5), security review (`/security-review`), data-authority penetration tests, load test of ledger path, backup/rollback plan for the migration, user guide (`docs/user_guid`), API docs, pilot tenant, enable feature per tenant, monitoring (log queries, Hangfire dashboard).
- **Acceptance:** NFR-05 targets met; zero critical findings. **Complexity:** M. **DoD:** production readiness checklist signed; rollback tested (disable feature; hooks no-op).

## Phases 9–13 — items moved into release 1 (owner decision)
Tracks A, B and C start after Phase 5 and can run in parallel by different developers; Phase 12 hardens everything together. Each track has its own migration and tests; none changes the behaviour delivered by Phases 2–8.

**Phase 9 — Track A: obligations, milestones, penalties, payment schedule, financial summary.** Entities `ContractObligation(+Occurrence)`, `ContractPaymentScheduleItem`; commands Add/Update/Complete/Accept/Waive and schedule item add/update/link; `ContractObligationJob`, `ContractBillingDueJob`; financial summary (invoiced from ledger, paid/outstanding through `IAgreementDocumentSource.GetSettlementAsync` implemented by Sales and Procurement); penalties as calculated display (fixed / per-day / percent with cap) — no postings; reports R-14, R-15; UI screens 11–12. Acceptance: FR-OB-01…05, FR-FM-01/02/05, FR-RN-03. Risks: settlement query accuracy for partial payments and credit notes.

**Phase 10 — Track B: templates, clauses, printing.** `ContractTemplate/Version/Clause`, `ContractTerm`; create-from-template copy semantics; printable contract (ar/en) stored and rendered as Core `DesignTemplate`s with the existing report designer; UI screen 13. Acceptance: FR-TP-01…03, FR-CA-01/02, FR-DS-03. Risk: print layout/RTL.

**Phase 11 — Track C: service contracts (contract side), e-signature, recurring-billing automation.**
- Service profile: `ContractServiceLevel`, coverage windows, covered items (item/serial soft references), included hours/quantity, consumption fields, `IContractServiceCoverageIntegrationService`, SLA-violation event inbound; **blocked for end-to-end testing by empty Maintenance/AssetsManagement** (ADR-21).
- E-signature: `IContractSignatureProvider` + one adapter + webhook callback recording `ContractSignature(Method=ExternalProvider)`; **blocked on provider choice** (Q-18).
- Recurring-billing automation: ADR-20 (Contracts schedule the work, Sales/Procurement create documents).
Acceptance: FR-SV-*, FR-DS-04, billing scenarios in doc 12.

**Phase 12 — Hardening of the whole of release 1.** Performance/security re-run, the three tracks' regression, pilot tenant, rollout switches per track (feature flags `ContractsManagement.Obligations`, `.Templates`, `.Service`, `.ESignature`, `.RecurringBilling`).

**Phase 13 — Track D: remaining items (owner moved them into release 1).** Runs in parallel with tracks A–C after Phase 5; hardening (Phase 12) covers it.
- Category/category commitments (`CategoryId`, Inventory integration service; blocked on the Inventory group model — Q-22).
- Delivery schedules (`ContractLineScheduleItem`), general bonus agreements (`OverridesPrices=false`, totals only, bonus calculation display), auto-renewal (`ContractRenewalJob`), version comparison API + UI, advanced risk flags (risk level, legal review flag, thresholds, expiring guarantees feeding Elsa stage conditions).
- Approval delegation: `ContractApprovalDelegation`, eligibility check in approval commands, delegate lookup for the Elsa workflow.
Acceptance: FR-AG-02/02a/09/10/10a, FR-CA-06, FR-RN-04..06/04a, FR-RK-02, FR-DL-01.

## Priority summary (after the owner's scope decision)

| Capability | Release |
|---|---|
| Types, master, parties, numbering, lifecycle, history, Elsa approvals, permissions, DMS documents, signatures record, amendments + versions | P0 / R1 |
| Agreement lines, commitments, price resolution, fulfillment ledger, Sales + Procurement + Inventory integration, reconciliation, any-currency conversion | P0 / R1 |
| Expiry/renewal reminders, reports, dashboard, system settings | P0 / R1 |
| Obligations, milestones, penalties, payment schedule, financial summary | P0 / R1 (Track A) |
| Templates, clause library, contract printing | P0 / R1 (Track B) |
| Service contracts/SLA (contract side), e-signature adapter, recurring-billing automation | P0 / R1 (Track C, with the blockers above) |
| Category commitments, version compare UI, general bonus agreements, delivery schedules, auto-renewal, advanced risk flags, delegation | P0 / R1 (Track D) |

No second release is currently planned; the only remaining backlog is optional custom fields, budget commitments and external CLM sync (unscheduled).
