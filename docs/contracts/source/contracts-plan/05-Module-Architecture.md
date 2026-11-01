# 05 — Module Architecture (ABP)

## 1. Placement decision (details in ADR-01)

| Option | Verdict |
|---|---|
| 1. Dedicated top-level module | **Chosen — and it already exists** as `modules/Enki.ContractsManagement` (empty template, wired into the host) |
| 2. Core submodule | Rejected: Core is the foundation everybody depends on and "doesn't depend on business modules" (`docs/backend-architecture/08-cross-module-communication.md`); contract lifecycle, approvals and fulfillment are business logic that would bloat Core and invert dependencies |
| 3. Shared contract domain with separate Sales/Procurement/Service integrations | Adopted as the *integration shape* inside option 1: one module, thin hooks in Sales/Procurement |

Naming: keep **`Enki.ContractsManagement`** (existing project names, `ContractsManagementDbProperties`, permission group `ContractsManagement`, schema `ContractsManagement`). All other modules follow `Enki.<Module>`; the host solution remains `JasimERP` (the EnkiERP rename was reverted — project memory).

## 2. Current state of the skeleton (verified)

```
modules/Enki.ContractsManagement/src/
  Domain.Shared  : ContractsManagementErrorCodes, DomainSharedModule, Localization/ContractsManagement/*.json (25 locales)
  Domain         : ContractsManagementDbProperties (Schema "ContractsManagement"), DomainModule (depends on EnkiCoreDomainModule), Settings
  Application.Contracts : Permissions (group only), RemoteServiceConsts, Samples/ISampleAppService + SampleDto
  Application    : ContractsManagementAppService (template), AutoMapperProfile (template)
  EntityFrameworkCore : ContractsManagementDbContext, IContractsManagementDbContext, ModelCreatingExtensions (reflection-applies IEntityTypeConfiguration<>)
  HttpApi        : ContractsManagementController (template), Samples/SampleController
```
Host wiring present in: `JasimERPDomainModule`, `JasimERPApplicationModule`, `JasimERPEntityFrameworkCoreModule`, `JasimERPDbContext` (`[ReplaceDbContext(typeof(IContractsManagementDbContext))]`, `builder.ConfigureContractsManagement()`), `JasimERPHttpApiHost` conventional-controller registration. **No `HttpApi.Client` project and no test projects exist** (other modules, e.g. Sales, have `Enki.Sales.{Application,Domain,EntityFrameworkCore}.Tests` + `TestBase`).

## 3. Target project structure

Follows `docs/backend-architecture/01-project-structure.md`.

```
Enki.ContractsManagement.Domain.Shared/
  Enums/ (ContractStatus, ContractProfile, ContractDirection, CommitmentType, FulfillmentEntryType, …)
  Constants/ContractsManagementConsts.cs
  Events/ (ContractActivatedEvent, …, AgreementDocumentLineChangedEvent)       ← inbound/outbound ETOs
  ContractsManagementErrorCodes.cs, Localization/ContractsManagement/{en,ar}.json
Enki.ContractsManagement.Domain/
  Entities/Contracts/{Contract, ContractParty, ContractLine, ContractTerm, ContractSignature, ContractFactory, IContractRepository}
  Entities/ContractTypes/…  Entities/Fulfillment/{ContractLineBalance, ContractFulfillmentEntry, IFulfillmentRepository}
  Entities/Amendments/…  Entities/Versions/…  Entities/Approvals/…  Entities/History/…  Entities/Links/…
  Services/{ContractStateMachine, AgreementLineResolver, FulfillmentLedgerService, ContractSnapshotBuilder, ContractNumberGenerator}
  Settings/ContractsManagementSettings (+provider)
Enki.ContractsManagement.Application.Contracts/
  Entities/Contracts/{ContractDto, ContractListDto, ContractCreateCommand, ContractSubmitCommand, …Query, IContractAppService, ContractPermissions}
  Integrations/{Agreements/IAgreementIntegrationService, IContractAccessIntegrationService, IAgreementDocumentSource}
  Permissions/ (definition provider)
Enki.ContractsManagement.Application/
  Api/Contracts/{ContractAppService, Handlers/Commands, Handlers/Query, Validations}
  Api/{ContractTypes, Amendments, Approvals, Fulfillment, Reports, Timeline}/…
  EventHandlers/{AgreementDocumentLineChangedEventHandler, …}
  Integrations/AgreementIntegrationService.cs
  BackgroundJobs/{ContractExpiryJob, ContractReminderJob, FulfillmentReconciliationJob}
Enki.ContractsManagement.EntityFrameworkCore/
  Entities/<Entity>/{<Entity>Configuration, <Entity>Repository, …QueryableExtensions}
Enki.ContractsManagement.HttpApi/
  Controllers/ContractController.cs, ContractTypeController.cs, …
(optional) Enki.ContractsManagement.HttpApi.Client/  — add only if the host needs typed proxies (other modules have it)
```

Responsibilities:
| Project | Responsibility | May reference |
|---|---|---|
| Domain.Shared | enums, constants, error codes, localization, **events (ETOs)** | nothing (+ABP localization) |
| Domain | aggregates, factories, repository interfaces, domain services | Domain.Shared, **Core.Domain** |
| Application.Contracts | DTOs, commands/queries (`IRequest<T>`), app-service + **integration service interfaces**, permissions | Domain.Shared, (Core.Application.Contracts for shared DTOs) |
| Application | MediatR handlers, validators, Mapster mappings, event handlers, jobs, integration implementations | Domain, Application.Contracts, **Core.Application(.Contracts)**, **Notification.Application.Contracts** (dispatcher), **Dms.Application.Contracts** (see §5) |
| EntityFrameworkCore | configurations, repositories | Domain |
| HttpApi | controllers | Application.Contracts |

## 4. Dependency rules and diagram

Rules:
1. Contracts depends only on **Core** (+Notification and DMS *contracts* projects). It never references Sales, Procurement, Finance, Inventory, Project, HR, CRM.
2. **Sales and Procurement reference `Enki.ContractsManagement.Application.Contracts` and `…Domain.Shared`** (integration interface + events). Direction is allowed because Contracts sits *below* them (same relation as Sales → Core, Sales → Finance integration services in the architecture doc).
3. Where Contracts must *ask* Sales/Procurement something (reconciliation, "paid amount of invoices"), it declares an interface in `Application.Contracts` (`IAgreementDocumentSource`) and **Sales/Procurement implement it** (dependency inversion) — no reverse reference.
4. Read operations → integration services; write notifications → events (as the architecture doc mandates); no repository access across modules.
5. Events carry ids and values only, are idempotent to process, and are published **after** the source transaction commits (pattern in `SaleOrderSubmitCommandHandler`).

```mermaid
flowchart LR
  Host[JasimERP Host / Application / EFCore] --> CM
  subgraph Business
    SAL[Enki.Sales]
    PRO[Enki.Procurement]
    HR[Enki.HR]
    PRJ[Enki.Project]
    MNT[Enki.Maintenance / AssetsManagement<br/>(future, empty today)]
  end
  SAL -->|IAgreementIntegrationService + events| CM
  PRO -->|IAgreementIntegrationService + events| CM
  MNT -.->|P2 coverage service| CM
  CM[Enki.ContractsManagement] --> CORE[Enki.Core]
  CM -->|INotificationDispatcher| NOT[Enki.Notification]
  CM -->|document attach/list| DMS[Enki.Dms]
  INV[Enki.Inventory] -->|return stock movements: events| CM
  SAL --> CORE
  PRO --> CORE
  SAL --> FIN[Enki.Finance]
  PRO --> FIN
  CM -. read-only via IAgreementDocumentSource implemented by SAL/PRO .-> SAL
  REP[Enki.Reporting] -->|query projections| CM
```
(Finance is *not* a dependency of Contracts: paid/outstanding derive from invoice documents owned by Sales/Procurement whose `PaidAmount` Finance maintains.)

## 5. Interaction per module

| Module | Interaction | Direction | Mechanism |
|---|---|---|---|
| Core | BusinessPartner validation/lookup, Currency, DocumentNumbering, CostCenter, OrganizationId, `ApplyDataAuthority`, `DocumentTypeData` | CM → Core | integration services / direct domain types in Core.Domain (allowed, foundation) |
| Finance | PaymentTerm id (soft); no calls | none | Finance remains unaware; paid amounts via invoices |
| Sales | resolve price/agreement line; validate before save; fulfillment events; implements `IAgreementDocumentSource` | Sales → CM (sync read + event), CM → Sales (inverted interface) | see doc 08 |
| Procurement | same | same | same |
| Inventory | item/UoM ids soft; category commitments (Track D) need an Inventory integration service for group membership | CM → Inventory (P1, via `IItemIntegrationService`, to be confirmed) | integration |
| CRM | none in R1 (module `src` empty at inspection) | – | – |
| Project | `ProjectId` soft reference; project-contract reports | none | – |
| HR | optional `EmployeeId` for responsible; employee validation via Core/HR integration (to verify) | CM → HR integration | – |
| DMS | attachments (`EntityType.Contract`); Contracts implements `IDocumentAccessPolicy` (declared in `Dms.Application.Contracts`) so every DMS endpoint asks Contracts before listing, viewing, downloading, uploading or deleting a contract document | CM → DMS.Application.Contracts (interface only); DMS never references Contracts | ADR-09, ADR-26 |
| Reporting | queries/DTO projections; print layouts (Track B) | Reporting → CM | read |
| Notification | alerts | CM → Notification | `INotificationDispatcher` |

## 6. Transaction boundaries and consistency

| Operation | Boundary | Consistency |
|---|---|---|
| Contract commands (create, submit, approve, activate…) | one UoW per command; contract aggregate + status history + version + (optional) approval request saved together | strong |
| Domain events (`ContractActivatedEvent`, …) | published after commit by the handler (existing pattern) | eventual |
| Document → fulfillment | Sales/Procurement transaction commits first; event handler in Contracts runs in its own UoW, writes ledger + balance atomically | eventual; reconciliation job repairs gaps (ADR-05) |
| Document creation guard (`EnforcementMode=Block`; failure handling per `OnFulfillmentFailure`, ADR-25) | synchronous `IAgreementIntegrationService.ValidateAndResolve` before the document is saved, followed by a **conditional** balance update inside the event handler; if the conditional update fails because of a race, the ledger records the entry with `Reason=Exceeded` flag and the owner is notified (soft-fail) unless the deployment enables synchronous "reserve in same UoW" mode (decision Q-01) | strong for sequential use; bounded race window otherwise |
| Amendments | single UoW: amendment `Applied` + contract change + `ContractVersion` + history | strong |

Idempotency: every handler checks the ledger contribution key before inserting; jobs dedupe by unique keys (doc 06).

## 7. Cross-cutting infrastructure

| Concern | Reuse |
|---|---|
| Multi-tenancy | `IMultiTenant` via base classes; jobs iterate tenants with `ITenantRepository` + `ICurrentTenant.Change` |
| Org data authority | `Enki.Core.Common.Querying.ApplyDataAuthority` on every list/detail query handler |
| Audit | ABP `[Audited]` + `GetXxxAuditChanges` handler pattern used by Sales (`GetSaleOrderAuditChangesHandler`) for a Contract audit-history endpoint |
| Validation | FluentValidation validators next to handlers; `BusinessException` codes in `ContractsManagementErrorCodes` |
| Mapping | Mapster only (delete the template AutoMapper profile) |
| Grids | DevExtreme load options as other list handlers do (see doc 07 §6) |
| Settings | ABP `SettingDefinitionProvider` on the System Settings page (as HR does): enforcement mode, fulfillment basis, returns restore, currency rate source, reminder days, grace days, approval options (ADR-17) |
| Permissions | `ContractPermissions` classes under `Application.Contracts/Entities/…` + definition provider |
| Localization | `ar.json`, `en.json` (prune the other 23 template locale files) |
