# 08 — Integration Design

Principle (from `docs/backend-architecture/08-cross-module-communication.md`): reads through **integration services**, writes/notifications through **events**; no cross-module entity references; handlers idempotent. Every integration below names: source of truth, trigger, contract, error handling, release.

## 1. Integration summary

| # | Integration | Source of truth | Mechanism | Release |
|---|---|---|---|---|
| I-1 | Business partner / currency / cost center / org lookup & validation | Core | Core integration services (e.g. `IBusinessPartnerIntegrationService` pattern) | R1 |
| I-2 | Document numbering | Core `DocumentNumbering` | `DocumentNumberingManager` | R1 |
| I-3 | Agreement price/line resolution and pre-save validation | Contract Management | `IAgreementIntegrationService` (sync, read-only) called by Sales/Procurement | R1 |
| I-4 | Fulfillment feed (Sales) | Sales documents | event `AgreementDocumentLineChangedEvent` → Contracts | R1 |
| I-5 | Fulfillment feed (Procurement) | Procurement documents | same event | R1 |
| I-5b | Fulfillment feed (Inventory: stock movements of returns) | Inventory GoodsReceipt/GoodsIssue based on returns | same event | R1 |
| I-6 | Reconciliation | Sales/Procurement documents | Contracts job calls `IAgreementDocumentSource` implemented by Sales/Procurement | R1 (job) |
| I-7 | Attachments | DMS `Document` (`EntityType.Contract`) behind Contracts endpoints guarded by `Attachments.*` permissions | DMS service | R1 |
| I-8 | Notifications | Notification | `INotificationDispatcher.NotifyAsync` | R1 |
| I-9 | Invoice settlement (paid/outstanding) | Sales/Procurement invoices (Finance-maintained `PaidAmount`) | `IAgreementDocumentSource.GetSettlementAsync` | R1 (track) |
| I-10 | Payment-schedule → invoice | Sales/Procurement | manual link / recurring template link / `ContractBillingDueEvent` | R1 (track) |
| I-11 | Project / cost-center dimensions | Project / Core | soft ids, copied onto documents created from an agreement | R1 (ids) |
| I-12 | Inventory categories for category commitments | Inventory | integration service (to be defined) | R1 (track) |
| I-13 | HR responsible employee | HR | soft id + lookup | R1 |
| I-14 | Service coverage lookup | Contract Management → service module | `IContractServiceCoverageIntegrationService` | R3 (blocked) |
| I-15 | Reporting | Contract Management data | read DTO/queries; print layouts as Core `DesignTemplate`s | R1 |
| I-16 | CRM | – | none (module `src` empty at inspection) | – |
| I-17 | Finance posting | Finance | **none** — Contract Management never posts | – |

## 2. Additive changes to existing modules (require owner review)

| Module | Change | Why |
|---|---|---|
| Core.Domain.Shared | `DocumentTypeData.Contract = new("Contract","1470000117","CTR","Contract")` (pick next unused code; verify no collision) | `BaseType` strings, numbering, documents list |
| Core / host | seed `DocumentNumbering` rows for module `ContractsManagement` | numbering |
| Sales.Application | after create/update/post/cancel/delete of SaleQuotation, SaleOrder, Delivery, SaleInvoice, SaleReturn, ARCreditMemo handlers: call resolver on line entry (UI-driven) and publish `AgreementDocumentLineChangedEvent` for lines with `AgreementId` | fulfillment |
| Procurement.Application | same for PurchaseOrder, GoodsReceiptPO, PurchaseBill, GoodsReturn, PurchaseReturn (PurchaseRequest: resolution only) | fulfillment |
| Sales / Procurement | implement `IAgreementDocumentSource` | reconciliation / settlement |
| Inventory.Application | publish `AgreementDocumentLineChangedEvent` from GoodsReceipt (base Return) and GoodsIssue (base PurchaseReturn) create/delete handlers; resolve the agreement line through the base return line | physical returns |
| Core.Domain.Shared | `EntityType.Contract = 24` and `EntityType.ContractObligation = 25` (DMS) | attachments |
| Host `ConfigureRecurringJobs()` | register `contracts-expiry`, `contracts-reminders`, `contracts-fulfillment-reconcile` | jobs |
| Notification | add `NotificationTemplate` rows for `contracts.*` event keys (+ category if `NotificationCategory` lacks a fit — verify) | alerts |
| ABP Feature | `ContractsManagement.Enabled` (tenant feature, same mechanism as `ProjectFeatureDefinitionProvider`) | rollout switch; Sales/Procurement hooks no-op when disabled |

No schema change to Sales/Procurement/Finance tables in R1.

## 3. Fulfillment engine (I-3 … I-6)

### 3.1 What counts: document → counter mapping (only document types that exist)

Keyed by `DocumentTypeData` code. `+` adds, `−` reverses. "Link only" = used for price/line resolution but never counted.

| Module | Document (code) | Release | Fulfill | Invoice | Notes |
|---|---|---|---|---|---|
| Sales | SalesQuotation (23) | – | – | – | link only; price resolution |
| Sales | SalesOrder (17), SalesOrderEcommerce (19) | + | – | – | open order consumes commitment ("Released") |
| Sales | SaleBackOrder (14) | – | – | – | derived from unfulfilled invoice lines (`InvoiceToBackOrderTransformer`); counted nowhere to avoid double counting (**Q-13**) |
| Sales | Delivery (15) | only if no agreement-linked base line | + | – | |
| Sales | ARInvoice (13) | only if no agreement-linked base line | + only if it moves stock itself (`UpdateInventory=true` and base is not a Delivery) | + | |
| Sales | Return (16) | – | – (physical return counted by the Inventory receipt below) | − | functional: based on an ARInvoice line, posts a journal at creation, and **reserves the returned quantity in `ReturnCommitted` (inventory balance) until a stock receipt is created**; the pending quantity is already tracked by the inventory balance, so nothing is counted for it here |
| Inventory | GoodsReceipt (59) with `BaseDocType = Return (16)` | − (if `ReturnsRestoreCommitment`) | − | – | the physical stock-in of the return |
| Sales | ARCreditMemo (25) | – | – | – | **not used in the system** (owner): ignored |
| Sales | CashSaleInvoice/Return (POS 013/016) | excluded | excluded | excluded | POS has no agreements |
| Procurement | PurchaseOrder (22) | + | – | – | |
| Procurement | GoodsReceiptPO (20) | only if no agreement-linked base line | + | – | |
| Procurement | APInvoice/PurchaseBill (18) | only if no agreement-linked base line | + only if it receives stock itself | + | |
| Procurement | GoodsReturn (21) | – | – | – | **not used in the system** (owner): ignored |
| Procurement | PurchaseReturn (26) | – | – (counted by the Inventory issue below) | − only when the base document is APInvoice | functional; base may be GoodsReceiptPO, APInvoice or PurchaseReturn; **reserves the quantity in `ReturnOrdered` (inventory balance) until a stock issue is created**; pending quantity is tracked by the inventory balance, nothing counted here |
| Inventory | GoodsIssue (60) with `BaseDocType = PurchaseReturn (26)` | − (if restore) | − | – | the physical stock-out of the return |
| Procurement | PurchaseRequest (1470000113), LandedCost (69), LandedCostRelease (68) | – | – | – | not agreement documents |
| Others | any other document | – | – | – | |

The mapping is implemented **once** as `AgreementCounterRules` (Domain.Shared). Publishers (Sales/Procurement) call it to set `CountsAsRelease/Fulfill/Invoice`; the Contracts handler validates the flags against the same table and rejects inconsistent events (defence in depth). *Q-02 resolved from the code (doc 14 §6.2); the product question on whether returns restore the commitment remains (management question 3).*

### 3.2 Contribution model (idempotent by construction)

A source line’s effect on a counter is not "an increment event" but a **state**: *"this line currently contributes quantity Q and value V to counter C"* (0 when cancelled, reversed, deleted or unlinked). The publisher sends the **current** state of every agreement-linked line of the document after each change. The consumer computes `delta = newContribution − Σ(existing ledger deltas for (SourceLineId, EntryType))`; if `delta = 0` nothing is written. Consequences: duplicates and replays are no-ops; edits, cancels, reversals and returns are all the same code path; out-of-order delivery is handled by `SourceRevision` (publisher sends the document’s monotonic revision, e.g. `LastModificationTime` ticks or concurrency stamp hash; consumer ignores an event older than the last applied revision for that source line).

Event contract (Domain.Shared):
```
AgreementDocumentLineChangedEvent {
  EventId, SourceModule, SourceDocType, SourceDocId, SourceDocRef, SourceDocDate, SourceRevision,
  OrganizationId, PartnerId, DocCurrency, DocRate, SystemCurrency,
  Lines[] { SourceLineId, AgreementId, AgreementLineNum, ItemId, UomId, BaseDocType, State(Active|Cancelled|Reversed|Deleted|Unlinked),
            IsReturn, Quantity, InvQty, NetValueDoc, NetValueLocal, CountsAsRelease, CountsAsFulfillment, CountsAsInvoice }
}
```
- `NetValue` = line total after line discount **and after distributed header discount, before tax** (`LineTotal(FC) − HdrDiscAmt(FC)`); freight excluded.
- Contract-currency value (ADR-18): same currency as the contract → `NetValueDoc`; contract currency = system currency → `NetValueLocal`; otherwise `NetValueLocal` converted with the rate chosen by the setting `Currency.ConversionRateSource` (`ActivationRate` = rate stored on the contract at activation; `DocumentDateRate` = rate of the document date from `IContractExchangeRateProvider`, implemented outside Contracts). The ledger stores `DocValueDelta`, `ValueDelta` (contract currency) and `DocRate`/rate used. Quantity commitments ignore currency.
- Quantity in the **contract line’s UoM**; if the document UoM differs, convert via Core UoM conversions using `InvQty`; no conversion available → event rejected with `UomMismatch` and surfaced in the reconciliation report.
- `State` ≠ Active ⇒ contribution 0.

### 3.3 Consumer algorithm (`AgreementDocumentLineChangedEventHandler`)
For each line (own UoW per document, retries 3×):
1. Load contract + line by `(AgreementId, AgreementLineNum)`; unknown ⇒ log + skip (also written to a `rejected` log table in R2).
2. Validate organization and partner match the contract (data corruption guard); contract status may be anything (ledger must continue after Terminated/Expired so cancels and returns stay consistent). Only *new links* are blocked, and that is a pre-save check (I-3), not here.
3. For each of the three counters flagged: `contribution = State==Active ? sign × (qty, value) : 0`; `current = SUM(ledger)`; `delta = contribution − current`; skip if 0 and revision not newer.
4. Insert ledger entry `(SourceDocType, SourceLineId, EntryType, Sequence = lastSeq+1)`; unique-violation ⇒ another worker did the same ⇒ re-read and recompute (delta then 0).
5. Atomic balance update `Released += delta` (conditional on max when `EnforceMax` and `EnforcementMode=Block` and delta > 0). Failure of the condition or any handler error follows the system setting `OnFulfillmentFailure` (ADR-25): **Rollback** (default) = the event was published with `onUnitOfWorkComplete:false`, the handler throws and the document is cancelled; **KeepAndAlert** = after-commit publishing, the entry is written with `Reason = Exceeded`/failed flag and the owner is notified. `EnforcementMode` decides only *whether* over-commitment counts as an error (Block) or a warning (Warn/None). Events are in-process only (no broker/outbox, doc 14 §6.1), so the reconciliation job is the only retry mechanism.
6. Upsert `ContractDocumentLink` (Release/Fulfillment/Invoice).
7. Failure behaviour follows the system setting `Agreements.OnFulfillmentFailure` (ADR-25): Rollback = publisher uses `onUnitOfWorkComplete:false` and a handler exception cancels the document; KeepAndAlert = after-commit publishing with flag + alert.
8. Publish nothing further (avoid event storms); threshold notifications (80%/100%) are computed by a job.

### 3.4 Pre-save validation and price resolution (I-3)

```csharp
public interface IAgreementIntegrationService
{
    Task<AgreementLineResolutionDto?> ResolveAsync(ResolveAgreementInput input, CancellationToken ct = default);
    Task<AgreementValidationResult> ValidateAsync(ValidateAgreementInput input, CancellationToken ct = default);
}
```
`ResolveAsync(OrganizationId, PartnerId, Direction, ItemId, UomId, DocType, DocDate, DocCurrency)`:
1. Candidate lines: contract `Active`, `Profile=Agreement`, matching direction, `OrganizationId`, `CounterpartyId == PartnerId`, line `Open`, line item = `ItemId` (or value line with null item), `DocDate` within contract and line validity. `OverridesPrices=false` (General) contracts are returned with `PriceFixed=false` and never alter the price.
2. Tie-break: earliest `EndDate`, then lowest `ContractNumber`. (SAP overlap behaviour not documented; this is our deterministic rule.)
3. Returns remaining quantity/value by the type’s `FulfillmentBasis`, min/max release, payment & delivery terms, dimensions to copy.
`ValidateAsync(AgreementId, LineNum, DocType, DocDate, Quantity, Value, PreviousContribution)`: checks status (`AgreementNotActive`), dates (`AgreementExpired`), partner, min release, `EnforceMax` against `Remaining + PreviousContribution`; `PriceFixed` vs entered price. Behaviour by `EnforcementMode`: *Block* ⇒ errors; *Warn* ⇒ warnings only; *None* ⇒ tracking only. Sales/Procurement call it from create/update handlers **before** saving; the UI calls `ResolveAsync` when an item is chosen and sets `AgreementId/AgreementLineNum` on the line (Sales line DTOs already carry the fields).
Modification rules (aligned with D365 behaviour): date outside validity or price change on a `PriceFixed` line ⇒ in *Block* mode rejected; in *Warn* mode the link is removed (`State=Unlinked`) with a warning.

### 3.5 Header-level vs line-level
The link is **line-level** (`DocLineBase.AgreementId/AgreementLineNum`, already stored). Header-level behaviours: Sales/Procurement copy contract header terms (payment term, delivery terms, project, cost center) into the document header when the first agreement line is chosen or when the UI picks "create from agreement"; the document-list "linked contract" column is derived from lines; `ContractDocumentLink` provides contract→document navigation.

### 3.6 Reconciliation (I-6)
```csharp
public interface IAgreementDocumentSource   // declared in Contracts.Application.Contracts, implemented by Sales and Procurement
{
    string SourceModule { get; }
    IAsyncEnumerable<AgreementLineSnapshot> GetLinkedLinesAsync(Guid agreementId, CancellationToken ct);   // all lines carrying AgreementId
    Task<List<InvoiceSettlementDto>> GetSettlementAsync(IEnumerable<Guid> invoiceIds, CancellationToken ct);
    Task<AgreementRefDto?> GetAgreementRefOfDocumentLineAsync(string docType, Guid lineId, CancellationToken ct); // used by Inventory hooks: inventory lines do NOT copy AgreementId (owner), so the agreement is found through the base return line
}
```
`ContractFulfillmentReconciliationJob` (nightly, per tenant): for each Active/OnHold/Expired contract modified-or-touched in the last N days, recompute contributions from the sources via the same mapping, compare with ledger sums, auto-correct drift by writing entries with `Reason=Recalculated`, and produce a drift report (count/size); alert if drift > 0 more than twice for the same contract (indicates a missing publisher hook). Manual `ContractFulfillmentRecalculateCommand` for one contract.

### 3.7 Scenario matrix (acceptance tests, doc 12)

| # | Scenario | Expected counters (qty) |
|---|---|---|
| S1 | SO line 10 posted/opened | Release 10 |
| S2 | Delivery from that SO line, 6 | Fulfill 6; Release 10 unchanged |
| S3 | Invoice from that delivery, 6 | Invoice 6 |
| S4 | Direct invoice (no base) 5, moves stock | Release 5, Fulfill 5, Invoice 5 |
| S5 | Edit SO line 10→12 | Release 12 (delta +2) |
| S6 | Cancel SO | Release 0; delivered/invoiced downstream unaffected |
| S7 | Same event twice | no new entry |
| S8 | Cancel event arrives before create | create ignored when its revision is older |
| S9 | Return 2 of delivered 6 | Fulfill 4 (and Release 8 if restore enabled) |
| S10 | Credit memo for invoice 6 | Invoice 0 |
| S11 | Remove agreement link from a posted-draft line | contribution 0 |
| S12 | Attempt to amend line below Fulfilled | rejected |
| S13 | Exceed max under Block | validation error at entry; race ⇒ `Exceeded` flag + alert |
| S14 | Contract terminated, later cancel of an old order | ledger still updated |
| S15 | Recalculate | balances equal ledger sums |

## 4. Finance and money (I-9, I-10, I-17)

| Amount | Where computed | Truth |
|---|---|---|
| Invoiced | ledger `Invoice` counter | posted Sales/Procurement invoice lines |
| Paid | `GetSettlementAsync` → Σ `PaidAmount` (invoice header, maintained by Finance payment applications; `DocBase.PaidAmount/PaidAmountFC`) | Finance via the invoice |
| Outstanding | Invoiced − Paid (credits already in Invoiced) | derived |
| Credit notes | negative Invoice contribution | ARCreditMemo/PurchaseReturn |
| Advance payments | tracked on payment schedule item as `Advance`; the actual receipt is Finance’s `IncomingPayment/Advance` (soft link, display only) | Finance |
| Retention / penalty / guarantee | metadata + computed display (Track A); postings, if any, are created by users in Finance | Finance |
Error handling: if settlement query fails the financial summary shows "unavailable" for paid/outstanding, never stale numbers. No Finance event consumption in R1.
Recurring billing: Core has `RecurringTransactionTemplate/Instance` and Sales/Procurement daily jobs that copy SaleOrder/PurchaseOrder. Contract Management therefore **does not generate invoices**; a payment-schedule item may reference a recurring template id (soft) and publishes `ContractBillingDueEvent` + notification so the responsible user (or a future automation) acts.

## 5. Documents (I-7) — DMS protected by an access-policy hook (ADR-26)
Files are stored as DMS `Document` rows (`EntityType.Contract`, `EntityId = contractId`). The UI uses Contracts endpoints that check `ContractsManagement.Contracts.Attachments.{View,Upload,Download,Delete}` (same shape as `DeliveryPermissions`/`PriceListPermissions` in Sales), org authority and confidentiality before delegating to DMS. DMS generic endpoints require only an authenticated user, so protection is enforced by the accepted policy hook (ADR-26): `ContractDocumentAccessPolicy` (implementing `IDocumentAccessPolicy`) is called by DMS for list, by-master, download, download-by-name, image, upload and delete operations; it loads the contract through the authorised query (organization authority), applies confidentiality and maps the operation to `Contracts.Attachments.{View,Download,Upload,Delete}`; denial returns 404; the generic list filters protected documents. Deleting a document of an Active contract is denied (new version instead). Downloads of Confidential/Restricted documents are audit-logged.

## 6. Notifications (I-8)
`INotifyRequest`: `RecipientUserId`, `Category`, `EventKey` (`contracts.expiry`, `contracts.notice-deadline`, `contracts.approval-pending`, `contracts.signature-missing`, `contracts.exceeded`, `contracts.threshold`), `SourceModule="ContractsManagement"`, `SourceEventKey` = rule code, `SourceEntityId` = `{contractId}|{dueDate}`, `Placeholders` (number, title, counterparty, date), `DeepLink` `/contracts-management/contracts/{id}`, `Severity`. Idempotency delegated to the dispatcher plus our log.

## 7. Dependency on empty modules
Maintenance and AssetsManagement are empty ABP templates: the `Service` profile is therefore documentation-only until they gain equipment/service-call entities. CRM `src` empty: no integration. Both are tracked as open questions Q-07/Q-15.
