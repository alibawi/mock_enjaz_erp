# 07 — API and CQRS Design

Conventions verified in `docs/backend-architecture` and `jasim_api/docs/CLAUDE.md`:
- Controller → thin `AppService` → `IMediator.Send(command/query)` → handler. Commands/queries are `IRequest<T>` classes in `Application.Contracts/Entities/<Entity>/`; handlers in `Application/Api/<Entity>/Handlers/{Commands,Query}`; validators in `Validations/`.
- Naming: `<Entity><Action>Command` + `<Entity><Action>CommandHandler`; `<Entity>Get…Query`. Route style `api/<module-kebab>/<entity-kebab>` (e.g. `api/core/business-partner`) → **`api/contracts-management/contract`**.
- Mapster for DTOs; FluentValidation; `BusinessException` codes `ContractsManagement:<Code>`.
- **Legal transitions are explicit commands/endpoints; there is no generic `PUT status` and no unrestricted entity CRUD for Contract.** The only generic CRUD is for configuration entities (types, policies, templates).

## 1. Commands (state-changing)

Common to all: `[Authorize(permission)]`, loads the aggregate, calls a domain method, saves history, publishes events after commit, returns the refreshed `ContractDto` (or a small result). Org authority is enforced when loading the aggregate (`ApplyDataAuthority`).

| Command | Purpose | Permission | Validation (FluentValidation + domain) | Transaction & events | Idempotency |
|---|---|---|---|---|---|
| `ContractCreateCommand` | create Draft (header, parties, lines) | `Contracts.Create` | type active; partner type vs direction; dates; currency exists; line rules; number via numbering | 1 UoW; none | client `RequestId` optional (header `Idempotency-Key`) |
| `ContractUpdateDraftCommand` | edit Draft (all fields, line/party sync) | `Contracts.Edit` | status Draft; concurrency stamp required | 1 UoW | stamp |
| `ContractUpdateMetadataCommand` | edit non-legal fields on any non-terminal status (owner, responsible, notes, reminder override, tags) | `Contracts.Edit` | whitelist | 1 UoW | stamp |
| `ContractSubmitCommand` | T1 | `Contracts.Submit` | doc 03 T1 | creates approval request; notify | state check (already PendingApproval ⇒ no-op error `AlreadySubmitted`) |
| `ContractApproveCommand` / `ContractRejectCommand` | final outcome of the approval workflow (system-initiated by the Elsa workflow; manual use only for users with the permission) | `Contracts.Approve` / `.Reject` or workflow identity | contract `PendingApproval`, request id matches, approver ≠ creator | status Approved / back to Draft; `ContractApprovedEvent` | state check |
| `ContractSendForSignatureCommand` | T5 | `Contracts.Activate` | RequiresSignature | history | state |
| `ContractRecordSignatureCommand` | add `ContractSignature` | `Contracts.Edit` | role/party valid; DMS doc exists | 1 UoW | UQ role+signer |
| `ContractActivateCommand` | T6 | `Contracts.Activate` | signatures if required; effective date; balance rows created for lines | version 1 + balances + `ContractActivatedEvent` | state |
| `ContractSuspendCommand` / `ContractResumeCommand` | T8/T9 | `Contracts.Suspend` | reason | event | state |
| `ContractTerminateCommand` | T11 | `Contracts.Terminate` (+approval if policy) | reason, termination date | cancels obligations; `ContractTerminatedEvent` | state |
| `ContractCancelCommand` | T2 | `Contracts.Cancel` | status Draft; reason | history | state |
| `ContractCloseCommand` | T13/T14 | `Contracts.Terminate` | reason | event | state |
| `ContractReopenCommand` | T7 | `Contracts.Edit` | status Approved/PendingSignature | clears approval | state |
| `ContractAmendmentCreateCommand` / `…UpdateCommand` | draft an amendment | `Contracts.Amend` | contract Active/OnHold/Expired(grace); no other open amendment; base version = current | 1 UoW | UQ open amendment |
| `ContractAmendmentSubmitCommand` / `…ApproveCommand` / `…RejectCommand` / `…CancelCommand` | amendment approval | `Contracts.Amend` / `Contracts.Approve` | as contract | approval request | – |
| `ContractAmendmentApplyCommand` | apply at/after effective date | `Contracts.Amend` | stale-version check; commitment ≥ counters; line number rules | one UoW: contract change + `ContractVersion` + history; `ContractAmendedEvent` | state `Applied` ⇒ no-op |
| `ContractRenewCommand` | create successor Draft from a contract (copy lines w/ counters reset) | `Contracts.Renew` | status Active/Expired(grace); not already renewed | new Contract; link | UQ `RenewedFromContractId` filtered |
| `ContractDocumentLinkAddCommand` / `…RemoveCommand` | manual link for General contracts | `Contracts.Edit` | doc type exists, same org | – | UQ |
| `ContractFulfillmentRecalculateCommand` | rebuild balances of a contract/line from ledger | `Contracts.Fulfillment.Recalculate` | – | balance rows rewritten atomically | inherently idempotent |
| `AgreementDocumentLineChangedHandler` (event handler, not an API) | apply source-line contribution | system | doc 08 | own UoW | ledger UQ |
| `ContractTypeCreate/Update/Deactivate` | configuration | `ContractTypes.Manage` | unique code; profile rules | – | – |
| `ContractApprovalStageRecordCommand` | called by the Elsa workflow (MediatR activity) after each decided stage | workflow identity or `Contracts.Approve` | request id matches, stage not yet recorded, approver ≠ creator | one action row | UQ `(RequestId, StageNo)` |
| (Tracks A/B) `ContractObligationAdd/Update/Complete/Accept/Waive`, `ContractPaymentScheduleItemAdd/Update/Link`, `ContractTemplateCreate/Publish/Archive`, `ContractClauseCreate/Publish` | as named | `Obligations.Manage`, `Obligations.Complete`, `Templates.Manage`, … | – | – | – |

Error handling: domain rules → `BusinessException(code)` (HTTP 403/400 by ABP mapping; concurrency → 409; not found/forbidden by org authority → 404 to avoid leaking existence).

## 2. Queries

| Query | Purpose | Notes |
|---|---|---|
| `ContractGetByIdQuery` → `ContractDto` | detail (header, parties, lines with balances, signatures, available actions) | applies data authority; hides Confidential without permission; includes `AllowedActions[]` computed from status + user permissions so the UI never guesses |
| `ContractGetListQuery` (DevExtreme `LoadOptions`) → paged `ContractListDto` | grid | projection only, server-side filter/sort/group, summary |
| `ContractGetTimelineQuery` | status history + amendments + approval actions + versions merged chronologically | |
| `ContractVersionGetListQuery`, `ContractVersionGetQuery` (`Compare`, Track D) | version list/payload/diff | |
| `ContractGetFulfillmentQuery` | lines with Committed/Released/Fulfilled/Invoiced/Remaining and recent ledger entries | |
| `ContractFulfillmentEntryGetListQuery` | ledger drill-down (by line/document) | |
| `ContractGetExpiringQuery(days)` | dashboard | uses index `(Status, NoticeDeadline/EndDate)` |
| `ContractGetFinancialSummaryQuery` | amounts table of doc 02 §2.8 | paid/outstanding via `IAgreementDocumentSource` |
| `ContractDocumentGetListQuery` | DMS documents for the contract | `Attachments.View` + org authority + confidentiality; proxy to DMS |
| `ContractAuditChangesQuery` | ABP entity-change history | mirrors `Get<Entity>AuditChangesHandler` |
| `ContractDashboardQuery` | KPI counts by status/type, expiring, awaiting approval/signature | |
| `ContractTypeGet…`, `ContractLookup…` (partners/items via Core/Inventory integration) | lookups | |
| `AgreementResolveQuery` (integration, see doc 08) | applicable agreement line | |

## 3. REST endpoints (controller `ContractController`, route `api/contracts-management/contract`)

| Verb & route | Maps to | Request → response |
|---|---|---|
| `GET /` | list | DevExtreme load options (`skip,take,sort,filter,group,totalSummary,requireTotalCount`) → `LoadResult<ContractListDto>` |
| `GET /{id}` | detail | → `ContractDto` |
| `POST /` | create | `ContractCreateDto` → `ContractDto` |
| `PUT /{id}` | update draft | `ContractUpdateDraftDto` (+`ConcurrencyStamp`) |
| `PATCH /{id}/metadata` | non-legal edit | |
| `DELETE /{id}` | delete draft (rare) | restricted |
| `POST /{id}/submit` `/approve` `/reject` `/send-for-signature` `/activate` `/suspend` `/resume` `/terminate` `/cancel` `/close` `/reopen` | transitions | `{ reason?, date?, comment? }` → `ContractDto` |
| `POST /{id}/signatures` | record signature | |
| `GET /{id}/timeline` `GET /{id}/versions` `GET /{id}/versions/{no}` `GET /{id}/versions/compare?from=&to=` | history | |
| `GET /{id}/fulfillment` `GET /{id}/fulfillment/entries` `POST /{id}/fulfillment/recalculate` | fulfillment | |
| `GET /{id}/documents` `POST /{id}/documents` (multipart → DMS, `Attachments.Upload`) `GET /documents/{docId}/download` | attachments | |
| `GET/POST /{id}/links` `DELETE /{id}/links/{linkId}` | document links | |
| `POST /{id}/renew` | successor | |
| `GET /{id}/financial-summary` | amounts | |
| `GET /{id}/audit` | audit | |
| `GET /expiring?days=` `GET /dashboard` | dashboards | |
| `api/contracts-management/contract-amendment` — `GET /{id}`, `GET /by-contract/{contractId}`, `POST`, `PUT /{id}`, `POST /{id}/submit|approve|reject|apply|cancel` | amendments | |
| `api/contracts-management/contract-type` — CRUD (generic) | configuration | |
| `api/contracts-management/approval/pending` | my pending approvals | |
| `api/contracts-management/report/{name}` | reports (doc 11) | |

Pagination/filtering: DevExtreme `LoadOptions` pattern as used by existing list handlers; no unbounded list endpoint; `take` capped at 500.

## 4. Key DTOs (names/properties only)

- `ContractListDto`: Id, ContractNumber, Title, TypeName, Profile, Direction, Status, CounterpartyName, OwnerName, Currency, ContractValue, StartDate, EndDate, DaysToExpiry, NoticeDeadline, FulfillmentPercent, Confidentiality, OrganizationId, hasPendingAmendment, flags[].
- `ContractDto`: all header fields, `Parties[]`, `Lines[]` (each with `LineNum`, commitment fields, `Balance{Released,Fulfilled,Invoiced,Remaining}`), `Signatures[]`, `VersionNo`, `AllowedActions[]`, `ConcurrencyStamp`.
- `AgreementLineResolutionDto` (integration): `ContractId, ContractNumber, LineNum, ItemId, UnitPrice, DiscountPercent, Currency, PriceFixed, EnforceMax, RemainingQty, RemainingValue, MinRelease, MaxRelease, PaymentTermId, DeliveryTerms, ProjectId, CostCenterId, Warnings[]`.
- `ContractAmendmentDto`: Id, No, Type, Status, EffectiveDate, ChangeSet (typed list), Reason, ApprovalState.
- Request DTOs are the `*Command` classes themselves (project pattern); validators beside handlers.

## 5. Validation catalogue (selected codes)

`InvalidStatusTransition`, `ContractLocked`, `DuplicateContractNumber`, `CounterpartyTypeMismatch`, `InvalidDateRange`, `NoticePeriodExceedsDuration`, `LineNumDuplicate`, `CommitmentBelowFulfilled`, `AmendmentStale`, `OpenAmendmentExists`, `SignatureRequired`, `ApproverNotEligible`, `SegregationOfDuties`, `AgreementNotActive`, `AgreementExpired`, `AgreementLineExhausted`, `PriceFixedViolation`, `ContractCannotBeDeleted`, `RenewalAlreadyExists`. All localised in `en.json/ar.json`.

## 6. DevExtreme integration
Reuse the same load-options parsing helper used by other list handlers (to be located in Phase 3 by searching a list handler, e.g. `SaleOrderGetListQueryHandler`; not re-verified here — assumption A-07). Grid columns map 1:1 to `ContractListDto`; grouping/summary restricted to indexed columns.

## 7. Security on endpoints
- `[Authorize]` with the specific permission on every action; `AllowedActions[]` uses `IAuthorizationService` so UI hides buttons consistently.
- No endpoint accepts `Status`, `VersionNo`, `ActivatedOn`, balances or ledger values from clients.
- Idempotency: transitions are state-checked; create supports optional `Idempotency-Key` header stored on the contract (`ExtraProperties["IdemKey"]`, unique per tenant) — P1.
