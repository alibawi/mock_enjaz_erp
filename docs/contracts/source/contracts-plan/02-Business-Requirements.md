# 02 — Business Requirements

Priorities: **P0** = initial production release (R1), **P1/P2** are no longer used for planned work: by owner decision all former P1/P2 items are P0 (release 1); the unscheduled backlog is marked *Backlog*. IDs are referenced by tests (`12-Testing-Strategy.md`) and the roadmap.
Existing/New/Reuse labels follow the brief: *Reuse* = existing JasimERP component used as is, *Extend* = additive change, *New* = built in `Enki.ContractsManagement`.

> **Scope update (owner decision):** the items previously planned for the second release are now part of **release 1 / P0**: obligations, milestones and penalties; payment schedule and financial summary; templates and clause library; printable contracts; service/maintenance contracts and SLA; electronic signature; recurring-billing automation. FR-TP-* (templates), FR-SV-* (service) and the items above are P0. The remaining second-release items were also moved into release 1 by the owner: category commitments (FR-AG-02), general bonus agreements (FR-AG-09), delivery schedules (FR-AG-10), version-comparison UI (FR-CA-06), renewal automation (FR-RN-04..06), advanced risk flags (FR-RK-02), and approval delegation (FR-DL); intercompany contracts were **dropped** because all organizations belong to one company (ADR-24). No release 2 is planned; only an unscheduled backlog remains (optional custom fields FR-MD-06, budget commitments FR-FM-04, external CLM sync, idempotency-key header). Dependencies and conditions for the newly added items are in doc 14 (ADR-20..22, Q-18..Q-20).

## 1. Scope and boundary (summary — rationale in doc 03 §1 and ADR-01/02)

| Area | Owner | Contract Management provides |
|---|---|---|
| Contract identity, parties, terms, lifecycle, approvals, amendments, documents, renewals, alerts | **Enki.ContractsManagement** (New) | everything |
| Sales/Procurement agreements (commitments, fulfillment, price resolution) | **Enki.ContractsManagement** `Profile=Agreement`; Sales/Procurement own the *documents* | commitment lines, ledger, integration service |
| Service/maintenance contracts, SLA | `Profile=Service`; service calls/work orders belong to a future Maintenance/Assets implementation | contract + coverage + targets only |
| Employment contracts | HR (Employee). Not a contract profile in R1. | optional soft link `EmployeeId` on a `General` contract |
| Lease / real-estate / consulting / NDA / project contracts | Contract Management `General` profile configured by `ContractType` | obligations (R2), payment schedule (R2) |
| Money (postings, receivables, payables) | **Finance / Sales / Procurement** | read-only derived figures |

## 2. Functional requirements

### 2.1 Contract master data (FR-MD)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-MD-01 | Create a contract with number, title, type, direction, counterparty, owner, organization, currency, dates | P0 | Given valid input, contract is created in `Draft` with generated unique number; tenant and organization set from current context |
| FR-MD-02 | Contract number generated through Core `DocumentNumbering` (module `ContractsManagement`) with manual override only if the type allows it | P0 | Two concurrent creates never produce the same number; duplicate manual number rejected with `ContractsManagement:DuplicateContractNumber` |
| FR-MD-03 | Field classification (common / type-specific / calculated / optional) per §2.1.1 | P0 | Mandatory fields enforced by `ContractType` flags at submit time, not at draft save |
| FR-MD-04 | Counterparty is a Core `BusinessPartner` (customer/vendor/agent) or free-text for non-registered parties | P0 | For `Agreement` profile, counterparty BP is mandatory and its type must match direction (Outgoing → Customer, Incoming → Vendor) |
| FR-MD-05 | Parent / renewed-from relations | P0 | `ParentContractId` (framework → call-off) and `RenewedFromContractId` stored; cycles rejected |
| FR-MD-06 | Optional configurable fields stored in ABP `ExtraProperties` | Backlog | Type-level field definitions drive UI; values validated server-side |
| FR-MD-07 | Confidentiality classification (Normal, Confidential, Restricted) | P0 | Restricted/Confidential contracts hidden from users without `ViewConfidential` even if org-authority would allow |

#### 2.1.1 Field classification

| Class | Fields |
|---|---|
| **Common (all contracts)** | Id, ContractNumber, Title, ContractTypeId, Direction, Status, OrganizationId, TenantId, CounterpartyId (BP) or CounterpartyName, OwnerUserId, ResponsibleEmployeeId, DepartmentId*, ProjectId, CostCenterId, Currency, ExchangeRate (snapshot at signature), StartDate, EndDate, SignatureDate, EffectiveDate, Description, InternalNotes, Confidentiality, Language (`ar`/`en`), ExternalReference, ParentContractId, RenewedFromContractId, SourceDocType/SourceDocId (e.g. quotation) |
| **Type-specific** | Agreement: `AgreementMode` (Specific/General), `EnforcementMode`, `FulfillmentBasis`, `OverridesPrices`, lines. Service: coverage, SLA. General: none beyond common. Renewal-capable: RenewalPolicy, NoticePeriodDays, AutoRenewTermMonths |
| **Calculated (not authoritative, never edited)** | Version number, ReleasedValue, FulfilledValue, InvoicedValue, RemainingValue, PaidValue, OutstandingValue, DaysToExpiry, FulfillmentPercent |
| **Optional configurable** | PaymentTermId, DeliveryTerms, TaxTreatment, Guarantee info, custom fields (ExtraProperties) |

\* DepartmentId: Core exposes `OrganizationUnitTypes`/cost centers; the department model must be confirmed (Q-08). Until then only `CostCenterId` and `ProjectId` are stored.

#### 2.1.2 Mandatory fields by profile (enforced on Submit)

| Field | General | Agreement | Service |
|---|---|---|---|
| Title, Type, Direction, Owner, Organization | ✔ | ✔ | ✔ |
| CounterpartyId | optional (name allowed) | ✔ | ✔ |
| Start & End date | ✔ unless `OpenEnded` type flag | ✔ | ✔ |
| Currency | if `ContractValue` required | ✔ | ✔ |
| ContractValue | per type flag | optional (lines drive) | optional |
| Lines (≥1) | – | ✔ | ✔ (covered items) |
| NoticePeriodDays | if RenewalPolicy ≠ None | if RenewalPolicy ≠ None | ✔ |
| PaymentTermId | – | recommended (warn) | ✔ |

### 2.2 Lifecycle (FR-LC) — details in doc 03

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-LC-01 | Only valid transitions per doc 03 table; others raise `ContractsManagement:InvalidStatusTransition` | P0 | Domain unit test for every pair in the matrix |
| FR-LC-02 | Every transition writes an immutable `ContractStatusHistory` row (from, to, user, time, reason) | P0 | History count = transition count; rows cannot be updated or deleted |
| FR-LC-03 | Draft is freely editable; after `PendingApproval` the legally significant fields are locked | P0 | Update command on locked field returns `ContractsManagement:ContractLocked` |
| FR-LC-04 | Activation requires signature record(s) per type flag `RequiresSignature` | P0 | With flag on and no signed document/signature row, Activate fails |
| FR-LC-05 | Expired detected by job when `EndDate < today` and status Active | P0 | Job run twice produces one history row and one notification |
| FR-LC-06 | Terminate/Cancel/Hold/Resume semantics per doc 03 | P0 | Per-transition tests |
| FR-LC-07 | Historical versions preserved; every amendment creates a version | P0 | Version N payload equals state before amendment N+1 |

### 2.3 Templates (FR-TP) — P1

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-TP-01 | `ContractTemplate` + immutable `ContractTemplateVersion` carrying default duration, renewal policy, payment term, clause set, approval policy, attachment list, billing/SLA defaults | Publishing creates version n+1; version n unchanged |
| FR-TP-02 | Creating a contract from a template **copies** values and records `TemplateVersionId`; no live link | Editing a template never changes an existing contract (test) |
| FR-TP-03 | Template archival | Archived template not selectable, still readable from contracts that used it |

### 2.4 Clauses and amendments (FR-CA)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-CA-01 | Clause library with versions (Standard / Optional) | P0 | Contract clause instance stores `ClauseVersionId` + frozen text |
| FR-CA-02 | Contract-specific (free-text) clauses | P0 | Stored as `ContractTerm` with `ClauseVersionId = null` |
| FR-CA-03 | Amendment request → approval → apply with **effective date**; types: ExtendTerm, ChangeValue, ChangeLines, ChangeParties, ChangeTerms, Other | P0 (Extend, Value, Lines) / P1 (rest) | Applied amendment increments `VersionNo`, writes `ContractVersion` snapshot of the **pre-amendment** state, leaves earlier snapshots untouched |
| FR-CA-04 | Amendment may not reduce a line's committed quantity/value below its released/fulfilled counters | P0 | Rejected with `ContractsManagement:CommitmentBelowFulfilled` |
| FR-CA-05 | Price/discount changes apply only to documents created at/after effective date; existing documents are not recalculated | P0 | Integration test: pre-existing order line price unchanged after amendment |
| FR-CA-06 | Version comparison (field-level diff) | P0 | Diff service returns changed paths |

### 2.5 Documents and signatures (FR-DS)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-DS-01 | Attach multiple files through DMS `Document` (`EntityType.Contract`, `EntityId = contractId`), `DocumentSubType` ∈ {Draft, Signed, Appendix, Other} | P0 | Upload requires `Contracts.Attachments.Upload`, listing `Attachments.View`, download `Attachments.Download`, delete `Attachments.Delete` (Sales pattern); Confidential contracts additionally require `ViewConfidential` |
| FR-DS-02 | Record signatures: signer name, party role, signed date, method (`Wet`, `Uploaded`, `ExternalProvider`), linked DMS document | P0 | `ContractSignature` rows; Activation rule FR-LC-04 |
| FR-DS-03 | Printable contract document (ar/en) from template | P0 | Uses existing Reporting/DesignTemplate infrastructure (verify, Q-09) |
| FR-DS-04 | Legally valid e-signature provider integration | P0 | Out of scope; `ExternalProvider` method and `ExternalSignatureId` reserved |

Distinction: release 1 **records that a signed document was obtained** (all contracts) and adds a **signature-provider abstraction** (`IContractSignatureProvider`) with one adapter for the provider the organization selects (Q-18); legal validity of an electronic signature is the provider's, not the system's.

### 2.6 Obligations and milestones (FR-OB) — P1

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-OB-01 | `ContractObligation` with kind (Deliverable, Milestone, Payment, Reporting, SLA, Recurring, Other), due date, responsible employee/department, quantity/value, status (Planned, InProgress, Completed, Accepted, Rejected, Waived, Overdue), dependencies, penalty rule | Completing sets `CompletedOn/By`; acceptance by a different user than completer if type flag says so |
| FR-OB-02 | Recurring obligations generate occurrences (iCal-style simple rule: daily/weekly/monthly/yearly + count/until) | Occurrence generation idempotent per `(ObligationId, DueDate)` |
| FR-OB-03 | Overdue detection by job; escalation | Doc 11 |
| FR-OB-04 | On termination, open obligations → `Cancelled` unless flagged `SurvivesTermination` (e.g., confidentiality) | Test |
| FR-OB-05 | Supporting documents via DMS (`EntityType.ContractObligation`) | – |

### 2.7 Renewals and notifications (FR-RN) — details in doc 11

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-RN-01 | Fields: `RenewalPolicy` (None/Manual/Auto), `NoticePeriodDays`, `AutoRenewTermMonths`, `RenewalReminderDays[]` | P0 | Validation: Auto requires term; notice ≤ duration |
| FR-RN-02 | Rules fire: expiry (30/15/7/1 days default), notice-deadline, pending approval > N days, missing signature > N days | P0 | One notification per `(contract, rule, dueDate, recipient)` ever |
| FR-RN-03 | Overdue obligation, milestone, SLA, upcoming billing, commitment threshold (e.g. 80%/100% fulfilled) alerts | P0 | – |
| FR-RN-04 | Manual renewal creates a successor Draft contract copying lines (counters reset), `RenewedFromContractId` set; predecessor closed with reason `Renewed` when successor activates | P0 | Test |
| FR-RN-05 | Auto-renewal at EndDate when no termination notice was given | P0 | Creates successor in `Draft` (configurable to auto-activate); idempotent |
| FR-RN-06 | Expired contract may be renewed within `RenewalGraceDays` (type setting, default 90) | P0 | – |

### 2.8 Financial management (FR-FM)

Rules: **no ledger, no postings, no invoice generation inside Contract Management.**

| Amount | Definition | Source of truth | Pri |
|---|---|---|---|
| Contract value | Signed headline amount in contract currency (`Contract.ContractValue`, input) | Contract | P0 |
| Planned value | Σ payment-schedule items or Σ line planned amounts | Contract | P0 |
| Committed value | Σ line commitments: qty × agreed unit price after discount, or line value cap | Contract lines | P0 |
| Released value | Σ posted/open Sales/Purchase **orders** linked to lines | Fulfillment ledger (derived from Sales/Procurement events) | P0 |
| Fulfilled value | Σ **deliveries / goods receipts** | Ledger | P0 |
| Invoiced value | Σ posted **invoices** − credit/returns | Ledger (fed by invoice events); invoice amounts owned by Sales/Procurement | P0 |
| Paid value | Σ `PaidAmount` of linked invoices (document field maintained by Finance payment applications) | Sales/Procurement invoice documents (Finance-maintained) | P0 |
| Outstanding | Invoiced − Paid (net of credits) | derived | P0 |
| Remaining | Committed − basis counter (basis per type: Released by default) | derived | P0 |

| ID | Requirement | Pri |
|---|---|---|
| FR-FM-01 | Payment schedule items (date/milestone/percent/amount, linked obligation) with status Planned/Due/Invoiced/Paid and link to the invoice document; **no auto invoice** | P0 |
| FR-FM-02 | Advance payment, retention %, penalty and guarantee metadata | P0 |
| FR-FM-03 | Documents may be in any currency; value commitments convert the document amount to the contract currency with the rate source from settings (ADR-18); the ledger keeps document amount, contract amount and rate | P0 |
| FR-FM-04 | Budget commitments to Finance | Backlog |
| FR-FM-05 | Billing events: "payment-schedule item due" notification and `ContractBillingDueEvent` event so Sales/Procurement recurring templates or users can act | P0 |

### 2.9 Sales and procurement commitments (FR-AG)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-AG-01 | Agreement lines: Item **or** service item, UoM, `CommitmentType` (Quantity/Value), agreed qty, agreed value cap, unit price, discount %, currency (= contract), min/max release, validity override dates, `PriceFixed`, `EnforceMax` | P0 | Line `LineNum` immutable unique per contract |
| FR-AG-02 | Category / procurement-category commitments | P0 | After confirming Inventory group/category model (Q-10) |
| FR-AG-03 | Entire-contract monetary commitment (no lines) | P0 | `Value` line with no item (`ItemId` null) matches any item |
| FR-AG-04 | Resolve applicable agreement line for (partner, item, doc date, organization, direction) | P0 | Returns highest-priority match; deterministic tie-break (earliest end date, then lowest number) |
| FR-AG-05 | Link types: SaleQuotation (price only, no counters), SaleOrder, Delivery, SaleInvoice, SaleReturn, ARCreditMemo; PurchaseOrder, GoodsReceiptPO, PurchaseBill, GoodsReturn, PurchaseReturn (POS and others excluded) | P0 | Mapping table in doc 08 §3 |
| FR-AG-06 | Counters: Released, Fulfilled, Invoiced (qty and value) per line; Remaining per basis | P0 | `Σ ledger == balance` invariant test |
| FR-AG-07 | Document create/post/cancel/return/reverse update ledger idempotently, never double-count | P0 | Doc 08 §4 scenarios |
| FR-AG-08 | Header-level reference | P0 | Derived: a document is "linked" if any line carries `AgreementId`; no new header column in R1 |
| FR-AG-09 | General (bonus/volume) agreement: tracks totals only, does not override price | P0 | `OverridesPrices=false` |
| FR-AG-10 | Delivery schedule per line | P0 | – |

### 2.10 Service contracts and SLA (FR-SV) — P0 (contract side)

Covered customers/products/serials, warranty period, covered service types, included hours/quantity, response/resolution targets, coverage calendar and exclusions, limits, consumption. Release 1 builds the **contract side** (terms, coverage, targets, covered items by item/serial reference, included quantities, consumption fields, `IContractServiceCoverageIntegrationService`). Equipment cards, service calls and SLA *measurement* need Maintenance/AssetsManagement (currently empty templates) and cannot be integrated or end-to-end tested until those exist (ADR-21). Contract Management stores terms and exposes `IContractServiceCoverageIntegrationService.GetCoverageAsync(partnerId, assetId, at)`; consumption is posted back by the service module via event.

### 2.11 Risk and compliance (FR-RK)

| ID | Requirement | Pri |
|---|---|---|
| FR-RK-01 | Computed risk flags on list/dashboard: expiring ≤ N days, no signature, overdue obligation, fulfillment > threshold, expiring guarantee, value above approval threshold | P0 (first 3) / P1 |
| FR-RK-02 | Manual `RiskLevel` (Low/Medium/High) + `LegalReviewRequired` flags feeding approval conditions | P0 |
| FR-RK-03 | No risk-scoring engine | – |

### 2.12 Additional release-1 items (moved from the former second release)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-DL-01 | **Approval delegation**: a user may delegate approvals to another user for a period (`ContractApprovalDelegation`: from, to, from-date, to-date, scope = all / type / organization) | P0 | A delegate counts as an eligible approver; the stage record shows `OnBehalfOf`; creator≠approver still enforced; expired delegations ignored; the Elsa workflow queries the active delegate when assigning a task |
| FR-AG-02a | Category / procurement-category commitments match any item belonging to the group at document date | P0 (conditional) | Inventory `Category` is hierarchical (`ParentId`); `Item.CategoryId`; needs an Inventory integration service answering 'is item X in category C (optionally including sub-categories) at date D' (Q-22) |
| FR-AG-10a | Delivery schedule per line: planned release dates and quantities; late/early release shown against the schedule; no automatic order creation | P0 | Schedule rows `ContractLineScheduleItem(LineNum, DueDate, Quantity)`; fulfillment compared by date |
| FR-RN-04a | Auto-renewal job creates the successor as Draft (or activates it when the type allows) exactly once | P0 | Idempotent by `RenewedFromContractId` |

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Multi-tenancy | Every entity `IMultiTenant`; unique indexes include `TenantId`; jobs iterate host + each tenant like `PostingPeriodAutoCreateJob` |
| NFR-02 | Org authority | All list/detail queries apply `ApplyDataAuthority(currentUser)` (User/Org/System); fail-closed behaviour is inherited |
| NFR-03 | Audit | `[Audited]` aggregates (ABP audit); status history, amendments, versions, ledger are append-only |
| NFR-04 | Soft delete | `FullAudited*` base; Draft-without-links only deletable; never hard delete |
| NFR-05 | Performance | Contract list p95 < 500 ms at 100k contracts (server-side paging/filtering via DevExtreme load options); ledger insert + balance update < 50 ms; documents with agreement line resolution add < 30 ms |
| NFR-06 | Concurrency | Optimistic concurrency (`ConcurrencyStamp`) on aggregates; balance row uses atomic conditional update + retry |
| NFR-07 | Idempotency | Every event handler and every job safe to re-run |
| NFR-08 | Localization | `ar` and `en` JSON under `Domain.Shared/Localization/ContractsManagement` (the template’s ~25 other locale files should be pruned to the project’s languages) |
| NFR-09 | Security | Confidential attachments gated; no entity CRUD endpoints for legal transitions |
| NFR-10 | Maintainability | Follows module layout in `docs/backend-architecture/01-project-structure.md`; MediatR + FluentValidation + Mapster; no AutoMapper |
| NFR-11 | Observability | Structured logs for each fulfillment event with `ContractId, LineNum, SourceDocId`; metric "ledger entries rejected" |
| NFR-12 | Data retention | Contracts, versions, ledger retained indefinitely (soft-delete only); notification log purge follows Notification module retention |

## 4. Traceability

Requirement IDs are used as test names (`FR-AG-07_...`) and as Definition-of-Done checklist items in `13-Implementation-Roadmap.md`.
