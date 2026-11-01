# 00 — Executive Summary: Contract Management for JasimERP

> Status: **planning only**. No source file, migration, or configuration was changed to produce these documents.
> Date of investigation: 2026-10-30. Repository state: `master`, last commit `79d3ba44f`.
> Document set: `00`–`15` in this folder. Read `14-Architecture-Decisions.md` for the rationale behind every decision summarised here.

## 1. Objective

Introduce an enterprise-grade, multi-tenant Contract Management capability that:

1. Manages the **lifecycle** of a contract (draft → approval → signature → active → expiry/renewal/termination) with immutable legal history.
2. Tracks **commitments** (quantity and value) for sales and procurement agreements and their **fulfillment** from real Sales/Procurement documents.
3. Holds **parties, documents, obligations, renewals, notifications** and links to business documents.
4. Never duplicates the ledger or document engines already owned by Finance, Sales, Procurement and DMS.
5. Can host additional contract types later through configuration, not code forks.

## 2. Findings that change the brief (verified in the repository)

The brief gave initial context and asked that it be verified. These items differ or add information:

| # | Brief said | Repository reality | Consequence |
|---|---|---|---|
| F1 | Angular is the intended web frontend | **Vue 3.4 + Vuetify 3.6 + DevExtreme 23.2 + Pinia + CASL + vue-i18n** in `jasim_web` (`jasim_web/CLAUDE.md`, `package.json`). No Angular project exists. | The UI plan (doc 10) targets Vue/Vuetify/DevExtreme using the existing Type A / Type B page patterns. No new framework is introduced. |
| F2 | ABP 9.2.0 | `Volo.Abp.*` packages are **9.1.1** in module csproj files. | Plan targets 9.1.1; no 9.2-only API is used. |
| F3 | Module must be created | **`modules/Enki.ContractsManagement` already exists** as an empty ABP template (Domain, Domain.Shared, Application, Application.Contracts, EntityFrameworkCore, HttpApi), already referenced by the host (`JasimERPDomainModule`, `JasimERPApplicationModule`, `JasimERPEntityFrameworkCoreModule`, `JasimERPDbContext` with `[ReplaceDbContext(IContractsManagementDbContext)]` and `builder.ConfigureContractsManagement()`, conventional-controller registration in the Host). Schema constant `ContractsManagement`. It contains only template samples (`SampleController`, `ISampleAppService`, `ContractsManagementAppService`, an AutoMapper profile). | No new module project is needed. Phase 2 *replaces the template samples* with real code. The AutoMapper profile must be removed (project policy is Mapster). |
| F4 | (not mentioned) | `DocLineBase` already carries **`AgreementId` (Guid?) and `AgreementLineNum` (int?)** mapped to columns in `BaseDocLineModelConfiguration`; `SaleOrder` and `PurchaseOrder` already copy them when transforming source lines. There is **no Agreement entity, FK, or logic** anywhere. `DocBase` has no header-level agreement field. | The integration hook is line-level and already persisted. The design uses `(AgreementId, AgreementLineNum)` as the stable reference, so **`ContractLine.LineNum` must be immutable and unique per contract**. No migration on Sales/Procurement tables is needed for the P0 link. |
| F5 | Shared Finance, Core | Confirmed. `DocBase` (Core) provides `WorkflowStatus`, `ApprovedBy`, `PostedBy`, `CanceledBy`, `ReversedBy`, `PaidAmount`, `ProjectId`, `CostCenterId`, `PaymentTermId`, period locking. | A contract is **not** a `DocBase` (no posting, no period lock, no journal). It is a standalone aggregate on `MultiTenantAuditedAggregateRootWithUserAndOrgBase<Guid>`. |
| F6 | Angular / "centralized migration" | Migrations live **only** in `src/JasimERP.EntityFrameworkCore/Migrations` (latest `20261023195632_change_landed_cost`, then `add migration for landed cost` commit). | One migration stream in the host project (first migration in Phase 2; later phases add their own). |
| F7 | Approval workflows "if available" | Core has `WorkflowSetting` + `EntityWorkflowSetting` (Elsa webhook triggers per entity/operation) and `DocumentWorkflowMode` settings (`DirectPosting` etc.). Elsa 3 runs in the host with `TaskItem` approvals; owner decision: approvals run on Elsa with stages by amount and organization policy. | Contracts expose lifecycle commands; Elsa workflow definitions hold the stages (ADR-06 revised, doc 09 §2). |
| F8 | Notification infrastructure | `Enki.Notification` has `INotificationDispatcher.NotifyAsync(NotifyRequest)` with built-in idempotency `(SourceEventKey, SourceEntityId)`, templates, in-app + push, escalation job. | Contract alerts go through it; no custom notification entity. |
| F9 | Background jobs | **Hangfire**; recurring jobs registered in `JasimERPHttpApiHostModule.ConfigureRecurringJobs()`; per-tenant sweep pattern in `PostingPeriodAutoCreateJob`. | Contract jobs follow this pattern exactly. |
| F10 | Attachments/DMS | `Enki.Dms` `Document` is polymorphic (`EntityType` + `EntityId`) and every entity module defines `<Entity>.Attachments.{View,Upload,Download,Delete}` permissions (Sales, Finance, Core). In code, however, no backend check of those permissions was found and the DMS app service/file controller carry no active `[Authorize]` (doc 14 §6.4). | Contract files **stay in DMS** (`EntityType.Contract`) following the Sales pattern: `ContractsManagement.Contracts.Attachments.*` permissions, enforced server-side by Contracts endpoints. DMS's generic endpoints only require authentication, so the accepted ADR-26 adds an access-policy hook in DMS that Contracts implements. |
| F11 | Service / maintenance contracts | `Enki.Maintenance` and `Enki.AssetsManagement` exist **only as empty ABP templates** (settings classes only). No equipment, serial-card, service-call or work-order entity exists. | Service contracts/SLA: schema is designed (P2) but **cannot be integrated** with anything until those modules exist. |
| F12 | CRM | `modules/Enki.CRM` contains docs/solution but its `src` folder was empty at inspection (see Open Question Q-07). | No CRM integration planned for R1. |
| F13 | Purchase quotations | Procurement documents that exist: `PurchaseRequest`, `PurchaseOrder`, `GoodsReceiptPO`, `PurchaseBill`, `PurchaseReturn`, `GoodsReturn`, `LandedCost`. **No purchase quotation/RFQ.** Sales: `SaleQuotation`, `SaleOrder`, `SaleBackOrder`, `Delivery`, `SaleInvoice`, `SaleReturn`, `ARCreditMemo`, POS cash documents. | Only existing document types are linked (doc 08). Purchase quotations are not in scope. POS documents are excluded. |

## 3. Competitor research conclusions (detail in `01-Competitor-Analysis.md`)

- **Blanket/agreement ≠ service contract ≠ subscription ≠ legal CLM.** All three vendors separate them. SAP B1 has Blanket Agreements (Sales module/Purchasing) and a separate Service module contracts. Odoo has only a *purchase-side* blanket order, separate Subscriptions, Helpdesk SLA, and an optional Sign app. Dynamics 365 has agreements in Supply Chain Management, agreements-for-service in Field Service, SLAs in Customer Service, and delegates general legal CLM to an *external* system via an integration.
- **No competitor evidence of a native general-purpose legal contract module** with clauses, obligations and amendments. The brief's wider scope (legal contracts, obligations) therefore goes beyond the three references and is designed from first principles, kept deliberately thin in R1.
- Proven, repeatable patterns worth copying: per-line commitment types (D365), "price fixed / max enforced" switches (D365), cumulative/open quantity-and-amount on agreement lines (SAP), automatic link of documents to a valid specific agreement (SAP), confirmation-time version snapshot (D365), renewal reminder (SAP) and renewal-as-new-document (Odoo), coverage/response/resolution on service contracts (SAP, D365 Customer Service).
- Several requested capabilities could **not** be verified from official documentation (SAP monetary-agreement method, SAP agreement approval workflow, Odoo agreement states beyond Draft/Confirmed, D365 general approval workflow). They are marked *Not verified* and the JasimERP behaviour is a design decision, not a copy.

## 4. Architecture recommendation

1. **Dedicated module `Enki.ContractsManagement`** (the existing skeleton) — not a Core submodule, not per-module agreement code (ADR-01).
2. **One central contract aggregate with a *profile*:** `General` or `Agreement` (commitment lines) in R1; `Service` profile (contract side) behind its own feature flag. Behaviour differences are driven by a configurable `ContractType`, not by subclassing (ADR-02).
3. **Sales/Procurement stay owners of operational documents.** Contract Management owns commitments and fulfillment; Sales/Procurement call an *integration service* to resolve/validate an agreement line and publish *events* when a linked document changes state. Dependency direction: `Sales/Procurement → ContractsManagement.(Application.Contracts|Domain.Shared) → Core`. Contracts never references Sales, Procurement or Finance (ADR-03, ADR-04).
4. **Fulfillment = append-only ledger + cached balances**, idempotent by source-line key; balances are rebuildable from the ledger (ADR-05).
5. **Finance owns money.** Contract Management stores no postings; "invoiced/paid/outstanding" are derived from posted Sales/Procurement invoice documents and their `PaidAmount` (source of truth: the invoice documents, which Finance payment applications update) (doc 04 §6, doc 08).
6. **Frontend:** Vue 3/Vuetify/DevExtreme with Type A (document-style detail) and Type B (CRUD) patterns (doc 10).

## 5. Release 1 scope (updated: the second-release items were moved into release 1 by the owner)

R1 = Phases 1–13 of the roadmap (doc 13). **In:** everything from the first scope (contract types, master data, lifecycle, Elsa approvals, signed-document recording via DMS, agreement lines with price resolution, fulfillment ledger fed by Sales/Procurement/Inventory documents, amendments with version snapshots, reminders, reports, system settings, any-currency conversion, Vue pages) **plus** obligations/milestones/penalties, payment schedule and financial summary, templates and clause library, printable contracts, service/maintenance contracts and SLA (contract side), electronic-signature adapter, and recurring-billing automation.

**Conditions on the newly added items** (doc 14 §7): service contracts cannot be tested end-to-end until Maintenance/AssetsManagement exist (ADR-21); the e-signature adapter needs a chosen provider (Q-18); recurring-billing automation creates documents through Sales/Procurement, never inside Contracts (ADR-20, Q-19).

**Also in release 1 (Track D, owner decision):** category commitments, version comparison UI, general bonus agreements, delivery schedules, auto-renewal, advanced risk flags, approval delegation (intercompany contracts dropped: all organizations belong to one company). No second release is planned; the backlog holds only optional custom fields, budget commitments and external CLM sync.

## 6. Highest risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Fulfillment double-counting / drift | Same `AgreementId` is copied down a chain (order → delivery → invoice) | Per-document-type counter mapping, per-source-line unique key, compensating entries only, `RecalculateFulfillment` from ledger and nightly reconciliation (doc 08 §3.6) |
| Modifying Sales/Procurement handlers | ~10 handlers across two modules; regressions in stable posting flows | Additive hooks behind a feature flag/setting, written by the Sales/Procurement specialist agents; tests first (doc 12) |
| Event handling is in-process only (no broker/outbox) | A failed handler is not retried | System setting `OnFulfillmentFailure` (Rollback by default) + nightly reconciliation job (ADR-25, doc 14 §6.1) |
| Very large release 1 | Obligations, templates, service, e-signature, billing automation and track D all moved into R1 | Tracks A–D in parallel after Phase 5, per-track feature flags and pilots (doc 13) |
| Service contracts depend on unfinished modules | AssetsManagement in progress, Maintenance only planned | Contract-side delivery now, integration later (ADR-21) |
| DMS lets any logged-in user list/download/delete documents | Contract files could be reached around the contract permissions | DMS access-policy hook (ADR-26, accepted) is a prerequisite of Phase 4 |
| Org data-authority bypass | Filter is applied by extension in query handlers, not by an EF global filter | Mandatory `ApplyDataAuthority` in every contract query handler + test (doc 09) |

## 7. Exact next steps before implementation starts

Owner decisions are complete (doc 14 §5–§8). What remains:
1. Phase 1 (prompt P1): none of the questions blocks it any more; use it to record the final scope and ADR statuses.
2. Phase 2 (prompt P2): clean the skeleton, build the domain and the single migration.
3. In parallel, the DMS owner implements the ADR-26 access-policy hook (prompt P4a) — needed before Phase 4.
4. Before Phase 5: the short event-transaction test (does `onUnitOfWorkComplete:false` roll the document back?) and the Inventory category-membership service for track D.
5. Track C items that wait for external input: e-signature provider (only when a client asks), service integration (AssetsManagement/Maintenance), and which billing document types the Sales/Procurement owners confirm.

## 8. Document map

| Doc | Content |
|---|---|
| 01 | Official-source competitor analysis and comparison matrix |
| 02 | Functional + non-functional requirements, acceptance criteria |
| 03 | Contract categories, lifecycle, transitions |
| 04 | Domain model, aggregates, ERD |
| 05 | ABP module architecture and dependencies |
| 06 | Database design |
| 07 | CQRS and API design |
| 08 | Integration design (fulfillment engine) |
| 09 | Workflow, permissions, security |
| 10 | Vue UI plan |
| 11 | Reports, jobs, notifications |
| 12 | Testing strategy |
| 13 | Roadmap |
| 14 | ADRs, assumptions, open questions |
| 15 | Implementation prompt sequence |
