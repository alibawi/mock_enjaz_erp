# 14 — Architecture Decisions, Assumptions and Open Questions

Status values: **Proposed** (awaiting product/architecture sign-off in Phase 1), **Accepted**. All are *Proposed* at the time of writing.

## 1. Decision records

### ADR-01 — Dedicated module `Enki.ContractsManagement` (reuse existing skeleton)
- **Context:** several modules need contracts; the host already references an empty `Enki.ContractsManagement`.
- **Alternatives:** (a) Core submodule; (b) agreements inside Sales and Procurement separately plus a legal-contract module; (c) dedicated module.
- **Decision:** (c). **Rationale:** Core must stay free of business logic (architecture doc); two copies of the commitment/fulfillment engine would diverge; `DocLineBase.AgreementId` is already shared across both document families. **Consequences:** Sales/Procurement take a dependency on the module’s *contracts* projects; one place to evolve.

### ADR-02 — One `Contract` aggregate with `Profile` (General/Agreement/Service) and configurable `ContractType`
- **Alternatives:** separate entities per category (SalesAgreement, PurchaseAgreement, ServiceContract, LegalContract); fully dynamic metadata model.
- **Decision:** single aggregate + profile-specific child data (lines for Agreement/Service) + `ContractType` flags + `ExtraProperties` for optional fields. **Rationale:** lifecycle, approvals, versions, documents, renewals are identical; per-category tables would duplicate them; dynamic metadata is unnecessary complexity. The brief’s caution about "not forcing every category into one generic model" is respected by profile-specific children and by keeping employment contracts and service operations outside.
- **Consequence:** profile is immutable after creation.

### ADR-03 — Dependency direction: Sales/Procurement → ContractsManagement → Core
- **Alternative:** ContractsManagement depends on Sales/Procurement to read documents.
- **Decision:** Contracts never references Sales, Procurement, Finance, Inventory. Reads that must go "up" use an interface declared in Contracts and implemented by Sales/Procurement (`IAgreementDocumentSource`). **Rationale:** avoids cycles; consistent with allowed-dependency list in the architecture doc.

### ADR-04 — Integration by integration service (reads) + event (writes)
- **Decision:** `IAgreementIntegrationService` for resolve/validate (sync, read-only); `AgreementDocumentLineChangedEvent` for fulfillment. **Rationale:** exactly the pattern in `08-cross-module-communication.md`. **Alternative rejected:** Contracts updating Sales line `OpenQty`/counters directly.

### ADR-05 — Fulfillment as append-only ledger with *contribution-state* events plus cached balances
- **Alternatives:** (a) increment/decrement events (not idempotent, order-sensitive); (b) compute on read by scanning Sales/Procurement lines (cross-module query, slow, no history); (c) mutable counters only (no audit, no rebuild).
- **Decision:** publishers send the current contribution of each line; consumer writes deltas into a ledger with unique keys and updates `ContractLineBalance` atomically; reconciliation job and recalculation command repair drift. **Rationale:** idempotent by construction, supports cancel/return/reversal uniformly, auditable, O(1) validation at document entry. **Cost:** one extra table and a nightly job.

### ADR-06 (revised by owner) — Approvals run on the existing Elsa workflow; Contracts keep lifecycle and history
- **Context:** the repository has Elsa 3 with `TaskItem` approval tasks and `EntityWorkflowSetting` triggers; the organization wants creator/approver separation and 3 or 5 stages depending on amount and policy.
- **Alternatives:** module-local approval policy tables (my first proposal); a new reusable approval engine.
- **Decision:** Elsa workflow definitions hold stages and thresholds; the Contracts module exposes `Submit`, `ApprovalStageRecord`, `Approve`, `Reject` commands and records history. **Rationale:** reuses what the organization already operates, no policy tables to build, policies change without code. **Consequences:** `ContractApprovalPolicy/Step` and their screens/permission removed; Submit depends on the workflow engine being configured (`ApprovalWorkflowNotConfigured`); Phase 3 verifies the trigger mechanism (doc 09 §2).

### ADR-07 — Immutability after approval; changes via effective-dated amendments with write-once version snapshots
- **Alternatives:** edit in place with audit log only; copy-on-write new contract per change.
- **Decision:** amendments + `ContractVersion` snapshots (JSON + hash). **Rationale:** legal history must not be overwritten; audit log alone is not a faithful point-in-time record; a new contract per change breaks commitment counters and links.

### ADR-08 — Renewal creates a successor contract; date-only extension is an amendment
- **Rationale:** counters reset per term (Odoo creates a renewal document; D365 re-confirms); evergreen date extension doesn’t need new commitments. `Renewed` is a closure reason, not a status.

### ADR-09 — Attachments through DMS; permissions and confidentiality enforced by Contracts
- **Decision:** DMS `Document` with `EntityType.Contract = 24`; Contracts endpoints enforce `Contracts.Attachments.{View,Upload,Download,Delete}` (Sales pattern), org authority and confidentiality. **Alternative:** own attachment table/blob container (kept as fallback if the DMS verification in §6.4 fails). **Owner's direction:** DMS has its permissions and document viewing follows the entity's attachment permissions, as in Sales.

### ADR-10 — No financial postings or invoice generation in Contract Management
- **Rationale:** brief and architecture require Finance ownership; recurring document generation already exists in Core/Sales/Procurement. Paid/outstanding derive from invoice documents.

### ADR-11 — Contract is not a `DocBase`
- **Rationale:** `DocBase` carries posting, period-lock, inventory, shipping and ~100 columns irrelevant to contracts; contracts have different lifecycle. Use the shared audited multi-tenant org base only.

### ADR-12 — Line-level agreement reference using existing `AgreementId/AgreementLineNum`
- **Rationale:** columns exist and are copied by Sales/Procurement transformations; no schema change; enforces immutable `LineNum`.

### ADR-13 — Feature flag `ContractsManagement.Enabled` (ABP tenant feature)
- **Rationale:** the Sales/Procurement hooks touch stable posting flows; the flag gives safe rollout/rollback (pattern: `ProjectFeatureDefinitionProvider`).

### ADR-14 — Jobs and notifications reuse Hangfire registration, per-tenant sweep and `INotificationDispatcher`
- **Rationale:** consistency with `PostingPeriodAutoCreateJob`, `AttendanceReminderJob`, Notification module.

### ADR-15 — Frontend stays Vue 3/Vuetify/DevExtreme
- **Context:** the brief assumed Angular; repository has none. **Decision:** build in `jasim_web` with Type A/B patterns. No new framework.

### ADR-16 — Counters kept in the contract line’s UoM and the contract currency; conversions via Core conversion data
- **Alternative:** store base-unit and system-currency only. **Rationale:** commitments are negotiated in contract terms; conversion rules are explicit and testable (open Q-06, Q-14).

## 2. Assumptions (not verified in code)

| ID | Assumption | Verify in |
|---|---|---|
| A-01 | `IDistributedEventBus` handlers run after the publisher commits and within an ABP UoW per handler (default local bus; no outbox configured for these events) | Phase 5 start (Q-01) |
| A-02 | `ConcurrencyStamp` is configured as concurrency token via `ConfigureByConvention()` | Phase 2 mapping test |
| A-03 | No generic approval-chain engine | **Resolved** | Elsa 3 + `TaskItem` approvals exist and are used (ADR-06 revised) |
| A-04 | Sales/Procurement UI already posts `AgreementId/AgreementLineNum` on line DTOs (fields exist in entities and transformers; DTO/UI presence not checked) | Phase 5 |
| A-05 | Multi-currency rule: use contract currency amounts when equal, else convert local value with the contract’s activation rate | Q-06 | Currency rule for documents in another currency | **Answered (owner)** | Any currency accepted; converted to the contract currency (ADR-18). Remaining detail: default rate source (ActivationRate recommended) |
| A-06 | Database is SQL Server (filtered unique indexes, `rowversion`, `ExecuteUpdate`) — stated in `jasim_api/docs/CLAUDE.md` | Phase 2 |
| A-07 | A shared DevExtreme load-options helper exists in the list query handlers | Phase 3 |
| A-08 | Printing infrastructure | **Resolved** | Core `DesignTemplate` with designer UI and versions (owner) |
| A-09 | Core exposes integration services for BusinessPartner/Currency lookups (pattern documented, exact interface names not enumerated) | Phase 2 |
| A-11 | Inventory lines copy `AgreementId` | **Resolved** | They do not (owner); base return line + `IAgreementDocumentSource` |
| A-10 | `NotificationCategory` has a usable value (or can be extended) for contracts | Phase 6 |

## 3. Out of scope for the first plan iteration
Legal clause negotiation workflow, redlining, AI clause extraction, vendor risk scoring, e-signature providers, budget control integration, intercompany agreements.

## 4. Risk register (summary)

| Risk | Impact | Mitigation |
|---|---|---|
| Double counting / drift | wrong remaining commitments | ADR-05, scenario tests, reconciliation |
| Hooks regress Sales/Procurement posting | financial/ops incidents | feature flag, characterization tests, owner review |
| DMS bypass of confidentiality | data leak | Phase 4 task, tests |
| Org authority not applied in a new query | data leak | review checklist, generated test over all query handlers |
| Scope creep (clauses/e-sign) | delay | priorities fixed in doc 13 |
| Hot migration snapshot conflicts | merge pain | single migration per phase, rebase before generating |
| Dependence on empty modules for service contracts | blocked R3 | explicit deferral |

## 5. Open questions (with recommendation)

| ID | Question | Blocking? | Recommendation |
|---|---|---|---|
| Q-01 | Are fulfillment events processed in-process after commit, or via an outbox/broker? Can we call the ledger service in the same UoW for strict max enforcement? | **Answered — §6.1** | Start with after-commit + soft-fail `Exceeded`; offer strict mode (same UoW) per tenant if load allows |
| Q-02 | Exact semantics of `SaleReturn` vs `ARCreditMemo` and `GoodsReturn` vs `PurchaseReturn` (goods vs financial) | **Answered — §6.2** (business side = management question 3) | Map goods returns to Fulfill(−) and credit documents to Invoice(−) per doc 08; confirm from code |
| Q-03 | Default `EnforcementMode` and `FulfillmentBasis` | **Answered (owner)** | System settings (ADR-17), defaults Warn + Order |
| Q-04 | Do agreements ever span organizations (group-level framework contracts)? | **Answered (owner)** | No: one organization per contract in R1 (ADR-19); revisit later |
| Q-05 | Is `DocumentNumberingManager` atomic under concurrency and per-org? (`DocumentNumbering` has no `OrganizationId`) | **Answered — §6.3** | rely on unique index + retry; add series per org via `GroupCode`/`BranchCode` if needed |
| Q-06 | Currency rule for documents in another currency | **Answered (owner)** | Any currency accepted; converted to the contract currency (ADR-18). Remaining detail: default rate source (ActivationRate recommended) |
| Q-07 | State of CRM module (`src` folder empty) and any CRM-owned contract-like concept | No | no R1 integration |
| Q-08 | Department model in Core (OrganizationUnit?) for `DepartmentId` | No | store `CostCenterId`/`ProjectId` only in R1 |
| Q-09 | Printing infrastructure for contract documents | **Answered (owner)** | `DesignTemplate` |
| Q-10 | Inventory item group/category entity | **Superseded by Q-22** | Category (hierarchical) |
| Q-11 | Does DMS authorize per `EntityType`? | **Answered — §6.4, §8, ADR-26** | Authentication only today; option A (access-policy hook) accepted |
| Q-12 | Bilingual names on lookup entities: one `Name` or `Name`+`NameAr`? | No | follow nearest example (`PaymentTerm.Name` single) and localise seed data keys |
| Q-13 | How `SaleBackOrder` interacts with orders/invoices for counting | No | excluded from counting in R1 |
| Q-14 | Which service converts UoM (Core `UomConversions`) | No | use it; otherwise reject mismatched UoM |
| Q-15 | Roadmap for Maintenance/AssetsManagement | **Answered (Q-20)** | Assets in progress, Maintenance planned |
| Q-16 | Per-tenant time zone for jobs | No | server local time as other jobs |
| Q-17 | Who approves contracts and at what thresholds | **Answered (owner)** | Elsa workflow definitions: creator submits, others approve, 3 or 5 stages by amount and organization policy (ADR-06). Remaining: the actual stage lists, configured by the administrator, not blocking development |

## 6. Code-backed answers (inspection of 2026-10-30)

Mapping to the management questionnaire (`management-questions-ar.html`): its question 1 = Q-17, question 2 = Q-03, question 3 = business side of Q-02, question 4 = Q-06, question 5 = Q-04.

### 6.1 Q-01 — Event delivery
**Evidence:** no `Volo.Abp.EventBus.*` provider package (RabbitMQ/Kafka/Azure), no `AbpDistributedEventBusOptions`, no outbox/inbox and no broker settings anywhere under `jasim_api/src` or `modules` (greps returned nothing). With no provider, ABP's `IDistributedEventBus` is the in-process `LocalDistributedEventBus` (framework default; not visible in the repo). The host calls `app.UseUnitOfWork()`.
Current publishing practice: Sales publishes after `InsertAsync(autoSave:true)` with the default `PublishAsync(event)`; Procurement `GoodReceiptPOCreateCommandHandler` publishes with **`onUnitOfWorkComplete: false`** (immediate dispatch inside the request transaction); `LandedCostCreateCommandHandler` passes `true`. Existing handlers deliberately **throw** to reject documents (Sales `OpenQtyEventHandler` throws `InvalidOperationException` on insufficient open quantity), so the codebase already relies on handler exceptions reaching the publisher.
**Conclusions:**
1. Events are in-process: no broker, outbox, retry or dead-lettering. A failed handler is not retried → the reconciliation job (doc 08 §3.6) is **mandatory**.
2. Strict enforcement is feasible: publish with `onUnitOfWorkComplete:false` so the Contracts handler runs inside the document's transaction and an exception rolls the document back. Use this mode when `EnforcementMode=Block`; after-commit publishing for `Warn/None`.
3. Remaining unknown (framework behaviour, not provable from the repo): exact commit/rollback ordering of the default (`true`) mode. **Action:** a short integration test at the start of Phase 5 (publish in both modes, throw in the handler, check whether the document row survives).

### 6.2 Q-02 — Return and credit documents (corrected with the owner's input)
Owner's rule, confirmed in code: returns are **two-phase**. `SaleReturn` is a customer return that needs a stock receipt (Inventory `GoodsReceipt` with `BaseDocType = Return`); until that receipt exists the returned quantity is reserved in the **inventory balance field `ReturnCommitted`** (`InventorySRCreatedEvent` → `b.ReturnCommitted += qty` in `InventoryBalanceEventHandler`). `PurchaseReturn` needs a stock issue (Inventory `GoodsIssue` with `BaseDocType = PurchaseReturn`, which `GoodsIssueCreateCommandHandler` treats as "quantity already reserved"); until then the quantity sits in **`ReturnOrdered`** (`InventoryPRCreatedEvent` → `b.ReturnOrdered += qty`). Both fields belong to the inventory balances, not to the documents. The receipt also publishes `OpenQtySaleReturnCreatedEvent`, which consumes the open quantity of the `SaleReturn`.

| Document | Finding | Counting consequence for agreements |
|---|---|---|
| `SaleReturn` (16) | Functional. Based on an `ARInvoice` line; posts a journal at creation; raises `InventorySRCreatedEvent` (→ `ReturnCommitted`) and `ReturnQuantityCreatedEvent` (→ `ReturnQty` on the invoice line). | **Invoice(−) at creation**; nothing for the pending quantity (already `ReturnCommitted` in the inventory balance) |
| Inventory `GoodsReceipt` (59) with base `Return` | The physical stock-in of the return. | **Fulfill(−)**; Release(−) when `ReturnsRestoreCommitment` |
| `PurchaseReturn` (26) | Functional. Based on `GoodsReceiptPO`, `APInvoice` or `PurchaseReturn`; posts a journal; raises `InventoryPRCreatedEvent` (→ `ReturnOrdered`). | Nothing counted at creation (pending quantity = `ReturnOrdered`); **Invoice(−) only when the base is `APInvoice`** |
| Inventory `GoodsIssue` (60) with base `PurchaseReturn` | The physical stock-out. | **Fulfill(−)**; Release(−) when restore flag |
| `ARCreditMemo` (25) | Scaffold: create handler copied from goods receipt, uses the `GoodsReceiptPO` code, no events/journal. | Excluded until Sales completes it |
| `GoodsReturn` (21) | Scaffold, same symptoms. | Excluded until Procurement completes it |

Design consequences (owner decision: no separate pending counter, because `ReturnCommitted`/`ReturnOrdered` already represent returns awaiting the stock movement): (1) Contracts count only Invoice(−) at the return document and Fulfill(−) at the physical movement; (2) Inventory becomes a third publisher of `AgreementDocumentLineChangedEvent` (stock movements of returns), with the agreement line found through the base return line (assumption A-11: inventory lines may not copy `AgreementId`; fall back to `IAgreementDocumentSource`); (3) the event line carries `BaseDocType`; (4) if a screen needs "returns in transit" it reads the inventory balance, not the contract ledger.

### 6.3 Q-05 — Document numbering (aligned with the owner)
The owner's rule: all documents use the Core numbering. Confirmed: real documents obtain `DocNum`/`DocRef` through Core's `DocumentNumberingFactory.GetNextNumberAsync` (called from `DocFactoryBase`), keyed by `(ModuleName, GroupCode, FiscalYear?, DocSubType?)` on the `NNM` table, tenant-wide. `DocumentNumberingManager.GenerateNumberAsync` exists but nothing calls it, so Contracts follow the factory path. Contracts are not `DocBase` documents, so the create command calls the factory directly with module `ContractsManagement` and `DocSubType` = contract type code, retrying up to 3× on `AbpDbConcurrencyException` (the numbering row is an audited concurrency-stamped entity); the filtered unique index `(TenantId, ContractNumber)` remains the last guard. No open question remains.

### 6.4 Q-11 — DMS and attachment permissions (corrected with the owner's input)
Owner's rule: DMS has its permissions, and viewing documents is governed by the owning entity's permissions, as Sales does. Confirmed pattern: entity permission classes define `<Entity>.Attachments` with children `.View`, `.Upload`, `.Delete`, `.Download` (e.g. `DeliveryPermissions`, `PriceListPermissions`, `TerminalPermissions`; also Finance and Core). Contracts adopt it: `ContractsManagement.Contracts.Attachments.{View,Upload,Download,Delete}`, enforced by Contracts attachment endpoints (plus org authority and confidentiality) before delegating to DMS. ADR-09 is restored to "attachments through DMS" with `EntityType.Contract = 24`.
What the inspection did and did not show (kept so it can be verified, not as a decision): the `<Entity>.Attachments.*` constants are only *defined* — no backend code referencing them was found outside the permission classes; in `DocumentAppService` all `[Authorize]` attributes are commented out and `FileController` (`/api/dms/file/get/{id}`, `/api/dms/file/by-filename/{fileName}`) has none. If DMS is protected somewhere I did not search (e.g. a gateway or the frontend only), contract files inherit that protection; if direct DMS calls can fetch a file by name, a user without the contract attachment permission could still reach it. **Owner action:** the owner will add the missing authorization to `DocumentAppService`/DMS endpoints in a separate session; Phase 4 depends on that work (prerequisite) and Contracts endpoints still enforce `Attachments.*` themselves. **Verification task (Phase 4, 30 minutes):** call a DMS download endpoint for a file of another entity with a user lacking the Sales attachment permission. If it succeeds, either exclude `EntityType.Contract` from the generic DMS endpoints or fall back to the alternative recorded in ADR-09 (own container). No change to the plan is needed if the check shows DMS is protected.

### ADR-17 — Business behaviour comes from system settings (ABP settings), contract types may override
- **Decision:** defaults live in tenant-level ABP settings editable in the System Settings page (the pattern HR uses): `ContractsManagement.Agreements.EnforcementMode` (None/Warn/Block, default Warn), `.Agreements.FulfillmentBasis` (Order/Delivery/Invoice, default Order), `.Agreements.ReturnsRestoreCommitment` (default true), `.Currency.ConversionRateSource` (ActivationRate/DocumentDateRate), `.Reminder.Days` (default "30,15,7,1"), `.Reminder.NoticeDays` ("14,7,1"), `.Renewal.GraceDays` (90), `.Approval.AllowCreatorApproval` (false), `.Agreements.OnFulfillmentFailure` (Rollback/KeepAndAlert, default Rollback; ADR-25), `.Jobs.*`. `ContractType` carries nullable overrides (null = use the setting). **Rationale:** the owner asked for configurable behaviour; settings are the existing mechanism (`SettingDefinitionProvider`, read fresh on each use like `AttendanceReminderJob`). **Cost:** one settings provider class and localisation keys.

### ADR-18 — Documents may be in any currency; values are converted to the contract currency
- **Decision (owner):** a linked document may use any currency. Rules: (1) quantity commitments are unaffected by currency; (2) value commitments: same currency → document amount; contract currency = system currency → `NetValueLocal`; otherwise convert `NetValueLocal` to the contract currency with the rate chosen by `Currency.ConversionRateSource`: **ActivationRate** (default; the rate stored on the contract at activation, stable and auditable) or **DocumentDateRate** (rate of the document date through `IContractExchangeRateProvider`, an interface declared in Contracts and implemented in Finance/host so Contracts never references Finance); (3) the ledger stores both the document amount and the contract-currency amount with the rate used, so history never changes when rates change; (4) `PriceFixed` price comparison applies only when document and contract currency are equal; otherwise the agreed price is shown converted as a suggestion and a warning (never a block).
- **Competitor evidence (official pages read):** none of the three documents a conversion rule for linked documents in another currency. Dynamics 365: on applying an agreement to a purchase order the user is prompted to transfer the agreement's currency to the order; value commitments are "a specific currency amount"; no rate/date rule found. Odoo: the blanket order has a currency changeable when multi-currency is on; whether a PO may differ and which rate applies is not stated; Odoo documents carry their own currency. SAP Business One (9.2 help): the blanket-agreement windows list no currency field and unit price is not tied to a currency; no mismatch rule documented. **So the rule above is a JasimERP design, not a copy of any reference system.**

### ADR-19 — Organizations: one organization per contract in R1
- **Evidence:** Dynamics 365 supports **intercompany** purchase/sales agreements by generating the corresponding agreement in the other legal entity, with synchronized fulfillment (official pages); the pages do not state whether an agreement can be used across legal entities. Odoo's blanket order has a Company field; the multi-company page returned no content, so sharing is **not verified**. SAP Business One's agreement pages mention no intercompany or sharing (**not found**; background knowledge that each company is a separate database is not from these pages).
- **Decision:** R1 keeps `OrganizationId` single-valued, which matches the data-authority model; cross-organization framework contracts, if needed, are modelled later as an allowed-organizations list (`ContractOrganization` rows) or as linked contracts (the D365 intercompany pattern). **Confirmed by the owner: one organization per contract in R1.**

## 7. Scope decision and consequences (owner adopted the recommendations and moved all second-release items into release 1)

Adopted questionnaire recommendations: returns **restore** the commitment (`ReturnsRestoreCommitment=true`); reminders at 30/15/7/1 days, notice reminders 14/7/1, renewal grace 90 days; three confidentiality levels (Normal/Confidential/Restricted) with employment contracts and NDAs defaulting to Confidential; escalation to the Contract Managers role; one organization per contract; approvals via Elsa; behaviour from system settings; any-currency conversion. The scope list of release 1 now includes everything the questionnaire had deferred.

### ADR-20 — Recurring-billing automation: Contracts schedule, Sales/Procurement create the documents
- **Conflict resolved:** ADR-10 says Contract Management creates no invoices or postings. Automation is therefore implemented through an interface declared in Contracts, `IContractBillingDocumentFactory` (create a billing document for a payment-schedule item), **implemented by Sales and Procurement** (inversion), reusing Core's `RecurringTransactionTemplate/Instance` engine and the existing daily generation jobs where they fit. Contracts never post; the generated documents go through the normal Sales/Procurement posting and approval flows (draft or open according to a setting). Each generated document carries the agreement link so the ledger counts it.
- **Verification (Q-19):** the existing jobs generate `SaleOrder` copies (Sales) and `PurchaseOrder`/`PurchaseBill` copies (Procurement); which sale billing document should be generated (order vs invoice) must be confirmed with the Sales owner.

### ADR-21 — Service contracts in release 1: contract side only until the service modules exist
`Enki.Maintenance` and `Enki.AssetsManagement` are empty templates. Release 1 delivers terms, coverage, targets, covered items by soft item/serial reference, consumption fields and the coverage lookup interface; it does not deliver service calls, equipment cards or SLA measurement. End-to-end acceptance for SLA waits for those modules (Q-20: who builds them and when). Tests use a fake coverage consumer.

### ADR-22 — Electronic signature through a provider abstraction
`IContractSignatureProvider` (send for signature, status callback, download signed document) with one adapter. **Provider not chosen (Q-18)**; until chosen, only the abstraction, the data model and a fake provider exist. Signed documents return to DMS as attachments with `Method=ExternalProvider` signatures. Legal validity is the provider's responsibility.

### New open questions
| ID | Question | Blocking? | Recommendation |
|---|---|---|---|
| Q-18 | Which e-signature provider | **Answered (owner)** | Not now: implemented later when a client requests it; release 1 builds only the provider abstraction + fake provider, feature flag off |
| Q-19 | Which document recurring billing creates | **Answered (owner)** | Any of: PurchaseOrder, PurchaseBill, PurchaseTemplate, SaleOrder, SaleInvoice, SalesTemplate; chosen per schedule |
| Q-20 | Maintenance/AssetsManagement plan | **Answered (owner)** | AssetsManagement is being implemented; Maintenance is planned in writing, not implemented. Service-contract integration follows when they ship |

### Effect on risk and planning
Release 1 is now roughly twice the earlier size. Mitigation: tracks A/B/C parallel after Phase 5, per-track feature flags (ADR-13 extended), and a pilot per track. The earlier statement that obligations, templates, service and e-signature are deferred in docs 00, 08 and 13 is superseded by this section.

### ADR-23 — Everything formerly planned for release 2 is now release 1 (owner decision)
Moved in: category commitments, version comparison, general bonus agreements, delivery schedules, auto-renewal, advanced risk flags, intercompany contracts, approval delegation. **Compatibility with earlier decisions:** intercompany does not break ADR-19 (one organization per contract) because it uses the Dynamics 365 pattern of two linked single-organization contracts; delegation is a Contracts-side table consulted by the commands and by the Elsa workflow, not a change to Elsa or Core `TaskItem`; delivery schedules stay informational (ADR-10: no automatic orders). **Conditions:** categories need the Inventory group model (Q-22); intercompany fulfillment sync needs intercompany documents (Q-21). Phase 13 (Track D) carries the work.

| ID | Question | Blocking? | Recommendation |
|---|---|---|---|
| Q-21 | Intercompany | **Answered (owner)** | Not applicable: all organizations belong to one company |
| Q-22 | Item group model | **Answered** | 'Item group' means Inventory `Category` (hierarchical via `ParentId`, `Item.CategoryId`); Contracts need an Inventory integration service for membership |

The statement in §7 and doc 13 that release 2 contains these items is superseded by this ADR.

## 8. Owner's answers and verifications (after the scope discussion)

**ADR-24 — Intercompany dropped.** All organizations belong to one company, so intercompany contracts, mirror contracts and intercompany fulfillment sync are removed from scope (FR-IC-*, Q-21). ADR-19 (one organization per contract) stands. Approval delegation stays.

**ADR-20 (updated) — Recurring billing document types.** A payment-schedule item or recurring schedule names its `BillingDocumentType` ∈ {PurchaseOrder, PurchaseBill, PurchaseTemplate, SaleOrder, SaleInvoice, SalesTemplate}. `IContractBillingDocumentFactory` is implemented by Sales (SaleOrder, SaleInvoice, SalesTemplate) and Procurement (PurchaseOrder, PurchaseBill, PurchaseTemplate). The templates are the existing Core recurring-transaction templates, so for them the factory creates/links a `RecurringTransactionTemplate` instead of a document.

**ADR-22 (updated) — E-signature later.** Build the `IContractSignatureProvider` abstraction, the data model and a fake provider; no real adapter until a client asks. Feature flag `ContractsManagement.ESignature` stays off.

**ADR-21 (updated) — Service contracts.** AssetsManagement is under implementation, Maintenance is planned but not built: contract-side delivery now, integration when they ship.

**Items to ignore:** `ARCreditMemo` and `GoodsReturn` are not used by the system (owner); they are excluded permanently from the counting table (not "until completed").

**§6.4 DMS — what the code shows now.** `DocumentAppService` now carries a class-level `[Authorize]` and its comment states the design: generic attachment endpoints require only an authenticated user, and access to the owning entity is governed by that page's permissions. This is the same model Sales uses, so ADR-09 stands unchanged: Contracts attachments are DMS `Document` rows with `EntityType.Contract`, gated in the Contracts UI/API by `Contracts.Attachments.*`. Correction after re-reading the updated code (commit `dac615bd79`): all three `FileController` actions now carry `[Authorize]`; the earlier note that they were open is obsolete. Remaining exposure is *authenticated-only* access: see ADR-26. For **Confidential/Restricted** contracts the plan therefore routes downloads through the Contracts endpoint and uses random file names. The Phase 4 dependency on separate DMS work is removed.

**A-11 resolved:** inventory lines do **not** copy `AgreementId` (owner). The Inventory hooks find the agreement through the base return line using `IAgreementDocumentSource.GetAgreementRefOfDocumentLineAsync` implemented by Sales/Procurement.

**A-08 resolved:** printing uses Core `DesignTemplate` (with versions and a report designer UI); contract print layouts are stored as design templates and rendered by the existing mechanism. Track B no longer depends on Reporting-module research.

**Elsa trigger resolved:** configured manually as an `EntityWorkflowSetting` row (doc 09 §2); no start code.

**Event order (Q-01 residual) kept as a short test in Phase 5**, explained with examples in the discussion.

**ADR-25 — What happens to the document when the contract handler fails (owner decision: cancel, or per system setting).**
Setting `ContractsManagement.Agreements.OnFulfillmentFailure`:
- **Rollback (default):** Sales/Procurement/Inventory publish `AgreementDocumentLineChangedEvent` with `onUnitOfWorkComplete:false` (immediate, inside the document's own transaction — the mode `GoodReceiptPOCreateCommandHandler` already uses). Any handler exception (max exceeded under `Block`, missing line, technical error) propagates and the whole document is cancelled with a clear message; nothing is saved.
- **KeepAndAlert:** the event is published after the commit. The document stays; a failed or `Exceeded` ledger entry is flagged, the contract owner is notified, and the nightly reconciliation job repairs or reports the drift.
Interplay with `EnforcementMode`: *Warn* produces warnings and never throws, so Rollback only triggers on real failures (technical errors, wrong partner/organization, expired or missing line when blocking is on); *Block* additionally throws on over-commitment. The publishers read the setting through a shared helper so all three modules behave the same. Example: SO line of 60 against remaining 50 — Block+Rollback: order refused; Block+KeepAndAlert: order saved, entry flagged `Exceeded`, owner alerted; Warn (either): order saved with a warning.
The residual test in Phase 5 only confirms that `onUnitOfWorkComplete:false` rolls the document back as expected.

### ADR-26 (ACCEPTED: option A) — Closing the DMS gap for contract documents
**Verified exposure (re-inspection):** with only `[Authorize]` (class level on `DocumentAppService`, action level on `FileController`), any logged-in user can: list **all** documents (`GetListAsync` has no filter by entity type), list by master id (`/api/app/document/by-master/{masterId}`), download by document id (`/api/app/document/download/{id}`) or by file name (`/api/dms/file/by-filename/{fileName}`, `/api/dms/file/get/{id}`), and **delete** any document (`DELETE /api/app/document/{id}` and bulk delete). Contract documents would be reachable this way regardless of `Contracts.Attachments.*`, organization authority or confidentiality. Random file names do not help because ids appear in the list responses.
**Options**
- **A (recommended): access-policy hook in DMS.** DMS defines `IDocumentAccessPolicy` (in `Dms.Application.Contracts`): `AppliesTo(EntityType)` and `CanAsync(entityType, entityId, DocumentOperation operation)` with operations List, View, Download, Upload, Delete. DMS handlers (list, by-master, download, download by name, image-by-entity, upload, delete, bulk delete) call every matching policy before acting and **filter** list results to documents the user may see. Contracts registers `ContractDocumentAccessPolicy`: loads the contract through the authorised query (`ApplyDataAuthority`), applies confidentiality (`ViewConfidential`) and maps operations to `Contracts.Attachments.{View,Download,Upload,Delete}`. Unknown/unauthorised → 404. Benefits: the generic attachment component keeps working on the contract page; the same hook can later protect Sales/Procurement attachments (their `Attachments.*` permissions are currently only defined). Cost: one interface plus changes in about eight DMS handlers; a policy lookup per request (cache the resolved policy list).
- **B: block the type in generic DMS and use an internal service.** DMS generic endpoints return 404 for `EntityType.Contract`; Contracts use a DMS `IDocumentIntegrationService` (no controller) behind their own endpoints. Strongest isolation, but needs a contract-specific attachment component and the same eight-handler change.
- **C: dedicated blob container and own metadata table** (the earlier fallback). No DMS change at all, but loses DMS versions and the shared component.
**Additional rules whichever option:** the generic list must never return documents of protected entity types without the policy; `DocumentDto` must not expose `BlobUrl`/`ContainerName` (check the DTO); log every download of Confidential/Restricted contract documents (audit); deleting a signed contract document is forbidden once the contract is Active (soft delete as a new version only) — enforced in the policy.
**Decision (owner): option A accepted.** B and C are recorded only as alternatives. The DMS work (below) is done in the DMS module and Phase 4 depends on it.

**DMS work package (prerequisite of Phase 4, ~1 week):** (1) `IDocumentAccessPolicy` + `DocumentOperation` enum in `Dms.Application.Contracts`; (2) a `DocumentAccessGuard` service that resolves policies for an `EntityType`, with **default allow** when no policy applies (so existing pages are unaffected); (3) call it in `GetListAsync`/list query (filter), `GetByMasterIdQuery`, `DownloadDocumentQuery`, image-by-entity and image-by-file-name queries, `UploadDocumentCommand`, `UploadManyDocumentsCommand`, `UploadFileCommand`, delete and bulk-delete; (4) 404 for denied documents (no existence leak); (5) check `DocumentDto` does not expose `BlobUrl`/`ContainerName`; (6) tests: no policy → unchanged behaviour (regression), policy deny → hidden from list and 404 on download/delete. Contracts work package: `ContractDocumentAccessPolicy` in `Enki.ContractsManagement.Application` (registered `ITransientDependency`), `EntityType.Contract = 24`.
