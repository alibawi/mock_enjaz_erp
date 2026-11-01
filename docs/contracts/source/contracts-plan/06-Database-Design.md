# 06 — Database Design

## 1. Strategy (verified)

- **Single global migration stream:** `jasim_api/src/JasimERP.EntityFrameworkCore/Migrations` (latest at inspection: `20261023195632_change_landed_cost`, plus the `add migration for landed cost` commit). The module’s own `ContractsManagementDbContext` is *replaced* by `JasimERPDbContext` (`[ReplaceDbContext(typeof(IContractsManagementDbContext))]`, `builder.ConfigureContractsManagement()` already called). **No module-local migrations.**
- Entity configurations go in the module’s EFCore project (`IEntityTypeConfiguration<T>` classes — the skeleton’s `ApplyConfigurationsFromAssembly` picks them up) and are applied to the host model by the existing `ConfigureContractsManagement()` call.
- Migration is created once per phase that adds tables, with the command documented in `jasim_api/docs/CLAUDE.md`:
  `dotnet ef migrations add <Name> --project src/JasimERP.EntityFrameworkCore --startup-project src/JasimERP.HttpApi.Host` (then run `JasimERP.DbMigrator`). Use the `jasim-migrations` agent.
- **No change to existing tables** is required for R1: `DocLineBase.AgreementId/AgreementLineNum` columns already exist in all document line tables. The only existing-code changes are **additive enum/data values**: `EntityType.Contract = 24` (DMS), `DocumentTypeData.Contract`, Later phases add further additive enum values. Optional: a non-clustered index on `(AgreementId, AgreementLineNum)` for Sales/Procurement line tables to speed reconciliation — justified only if the reconciliation query shows a scan (doc 15 §P5).

## 2. Naming and general conventions

- Schema `ContractsManagement` (`ContractsManagementDbProperties.DbSchema`), `DbTablePrefix = ""`, plural PascalCase table names (`Contracts`, `ContractLines`…), column names = property names.
- Decimals: `HasPrecision(19, 6)` **explicitly on every decimal** (the Core repo notes the shared `BaseDbContext<T>` decimal(19,6) convention is not inherited everywhere — see comment in `DesignTemplateModelConfiguration`; being explicit removes the doubt).
- Strings: bounded `HasMaxLength`; JSON payloads `nvarchar(max)`.
- Dates: `date` for business dates (`DateOnly` mapped with `HasColumnType("date")`, as `DocBase.DueDate` does), `datetime2` for timestamps.
- Every table: `TenantId` (nullable Guid, `IMultiTenant` filter), `ConcurrencyStamp`/`ExtraProperties` (aggregate roots), full-audit columns and `IsDeleted` for audited roots, `OrganizationId` for org-scoped roots.
- FKs inside the schema use `DeleteBehavior.Restrict` (no cascade). Cross-module ids have **no FK**, only indexes.
- Unique indexes are **filtered** `[IsDeleted] = 0` (soft-delete aware) and include `TenantId`.

## 3. Tables

Legend: R1 core = first migrations; tracks A–D add later migrations in the same stream. Only the interesting columns are listed beyond the standard set; full property lists are in doc 04.

### 3.1 R1 tables

| Table | Key columns / types | Constraints & indexes |
|---|---|---|
| **ContractTypes** | Code nvarchar(20), Name nvarchar(150), Category int, Profile int, flags bit…, ReminderDaysDefault nvarchar(50), RenewalGraceDays int | UQ `(TenantId, Code)` filtered |
| **Contracts** | ContractNumber nvarchar(25), Title nvarchar(250), ContractTypeId, Profile, Direction, Status int, VersionNo int, CounterpartyId, CounterpartyName nvarchar(250), OwnerUserId, ResponsibleEmployeeId, ProjectId, CostCenterId, Currency nvarchar(3), ExchangeRate decimal(19,6), ContractValue decimal(19,6), PaymentTermId, StartDate/EndDate/SignatureDate/EffectiveDate/TerminationDate `date`, NoticeDeadline `date`, RenewalPolicy int, NoticePeriodDays int, AutoRenewTermMonths int, ReminderDaysOverride nvarchar(50), Confidentiality int, Language nvarchar(5), ParentContractId, RenewedFromContractId, SourceDocType nvarchar(10), SourceDocId, AgreementMode int, OverridesPrices bit, ClosureReason int, ActivatedOn datetime2, ActivatedBy | UQ `(TenantId, ContractNumber)` filtered; IX `(TenantId, OrganizationId, Status, EndDate)`; IX `(TenantId, CounterpartyId, Status)`; IX `(Status, NoticeDeadline)` WHERE Status=Active; IX `(OwnerUserId, Status)`; IX `(ParentContractId)`; FK ContractTypeId Restrict; self FKs NoAction; CHECK `EndDate IS NULL OR EndDate >= StartDate` |
| **ContractParties** | ContractId, Role, BusinessPartnerId, Name nvarchar(250), ContactName, Email, Phone, IsPrimary, SortOrder | IX `(ContractId)`; UQ `(ContractId, BusinessPartnerId, Role)` WHERE BusinessPartnerId IS NOT NULL |
| **ContractLines** | ContractId, LineNum int, ItemId, CategoryId (Track D), Description nvarchar(500), UomId, CommitmentType int, AgreedQuantity/AgreedValue/UnitPrice/DiscountPercent/MinRelease*/MaxRelease* decimal(19,6), ValidFrom/ValidTo date, PriceFixed, EnforceMax, Status | UQ `(ContractId, LineNum)`; IX `(TenantId, ItemId, ContractId)` (resolution); CHECK `LineNum>0` |
| **ContractLineBalances** | PK=ContractLineId, ContractId, ReleasedQty/Value, FulfilledQty/Value, InvoicedQty/Value decimal(19,6), LastSequence bigint, RowVersion `rowversion` | IX `(ContractId)`; CHECK balances ≥ 0 only when `AllowNegative=false` (not enforced in DB: returns after period close may transiently go negative — enforced in domain) |
| **ContractFulfillmentEntries** | ContractId, ContractLineId, LineNum, EntryType int, SourceDocType nvarchar(10), SourceDocId, SourceLineId, SourceDocRef nvarchar(25), SourceDocDate, SourceRevision bigint, Sequence int, QuantityDelta, ValueDelta, DocCurrency nvarchar(3), DocValueDelta, DocRate, Reason int, EventId, CreationTime, CreatorId | **UQ `(TenantId, SourceDocType, SourceLineId, EntryType, Sequence)`** (idempotency); IX `(ContractLineId, EntryType)`; IX `(SourceDocId)`; no soft delete; INSERT-only (app permission, no update repository method) |
| **ContractDocumentLinks** | ContractId, LinkType int, DocType nvarchar(10), DocId, DocRef nvarchar(25), DocDate, LinkedOn | UQ `(ContractId, DocType, DocId, LinkType)`; IX `(DocType, DocId)` |
| **ContractStatusHistory** | ContractId, FromStatus, ToStatus, ChangedBy, ChangedOn, Reason nvarchar(500), RelatedApprovalRequestId, RelatedAmendmentId | IX `(ContractId, ChangedOn)` |
| **ContractSignatures** | ContractId, PartyId, Role, SignerName nvarchar(200), SignerTitle, SignedOn date, Method int, DocumentId, ExternalSignatureId, RecordedBy | IX `(ContractId)` |
| **ContractVersions** | ContractId, VersionNo, Reason int, AmendmentId, Payload nvarchar(max), PayloadHash char(64), CreatedOn, CreatedBy | UQ `(ContractId, VersionNo)`; write-once |
| **ContractAmendments** | ContractId, AmendmentNo, Type, Status, Reason nvarchar(500), EffectiveDate date, BaseVersionNo, ChangeSet nvarchar(max), ApprovalRequestId, AppliedVersionNo, AppliedOn/By | UQ `(ContractId, AmendmentNo)`; **UQ filtered `(ContractId) WHERE Status IN (Draft, PendingApproval, Approved)`** → at most one open amendment |
| **ContractApprovalRequests**, **ContractApprovalActions** | SubjectType, SubjectId, ContractId, WorkflowInstanceId nvarchar(100), Status; actions: RequestId, StageNo, ApproverUserId, Decision, Comment, TaskItemId, DecidedOn | IX `(ContractId)`; UQ `(RequestId, StageNo)`; filtered UQ one Pending request per subject |
| **ContractNotificationLogs** | ContractId, RuleCode nvarchar(40), DueDate date, RecipientUserId, SentOn, NotificationId | **UQ `(TenantId, ContractId, RuleCode, DueDate, RecipientUserId)`** |

### 3.2 Track A–D tables (later migrations)
`ContractLineScheduleItems` (UQ `(ContractLineId, DueDate)`), `ContractApprovalDelegations` (IX `(ToUserId, FromDate, ToDate)`), `ContractTerms`, `ContractTemplates`, `ContractTemplateVersions`, `ContractTemplateClauses`, `ContractClauses`, `ContractClauseVersions`, `ContractObligations` (+ `ContractObligationOccurrences`, UQ `(ObligationId, DueDate)`), `ContractPaymentScheduleItems` (UQ `(ContractId, ItemNo)`), `ContractServiceLevels`, `ContractCoverageWindows`, `ContractCoveredAssets` — columns in doc 04 §2.15–2.17.

### 3.3 Not created
No journal/ledger tables, no attachment table, no notification table, no copies of partner/item/currency data.

## 4. Data-integrity mechanisms

| Concern | Mechanism |
|---|---|
| Concurrent updates to a contract | `ConcurrencyStamp` (ABP `IHasConcurrencyStamp`, part of `AggregateRoot`); `AbpDbConcurrencyException` mapped to HTTP 409; UI reloads |
| Duplicate contract numbers | numbering via Core `DocumentNumberingFactory.GetNextNumberAsync` (the path real documents use; the `DocumentNumberingManager` is unused) which relies on the `NNM` row's optimistic concurrency; the create command retries up to 3× on `AbpDbConcurrencyException`; filtered unique index is the last guard (doc 14 §6.3) |
| Duplicate notifications | UQ on `ContractNotificationLogs` + Notification module’s own `(SourceEventKey, SourceEntityId)` idempotency (uses key `contract.expiry.30|{contractId}|{dueDate}`) |
| Concurrent fulfillment updates | ledger UQ makes duplicate event processing a no-op; balance update is an **atomic SQL statement** (`UPDATE … SET ReleasedQty = ReleasedQty + @d … WHERE ContractLineId=@id [AND ReleasedQty+@d <= @max]`) via EF `ExecuteUpdateAsync`, fallback to `RowVersion` retry (max 5) |
| Contract amendments | single open amendment UQ + `BaseVersionNo` check + version UQ |
| Cancelled/reversed transactions | ledger **never deleted**; handler writes a compensating entry (contribution to 0) with `Sequence+1` |
| Historical documents | Sales/Procurement documents retain `AgreementId/LineNum` after contract termination/closure; ledger keeps entries |
| Contract deletion | soft delete only when `Status=Draft` and no children beyond header data (no links, no versions, no ledger); otherwise `ContractsManagement:ContractCannotBeDeleted`; Cancelled is the legal "delete" |
| Tenant isolation | `IMultiTenant` global filter + tenant-scoped unique indexes + integration test per aggregate (doc 12) |
| Org data authority | `OrganizationId` on Contract (and Types/Policies are tenant-level); query handlers call `ApplyDataAuthority`. Children are reached **only through** an authorised Contract query (never listed directly) |
| Soft delete | `FullAudited*`; unique indexes filtered; `DisableSoftDeleteFilter` action filter exists in Core for admin tools — not used by contract endpoints |

## 5. EF Core configuration notes

1. One `IEntityTypeConfiguration<T>` per entity in `Entities/<Entity>/<Entity>Configuration.cs`, calling `ConfigureByConvention()` for audited roots.
2. Enums stored as `int` (the project’s enums carry `[Display]` Arabic names; keep numeric values stable — never renumber).
3. JSON columns (`ChangeSet`, `Payload`, `WorkflowInstanceId`) are plain `nvarchar(max)` strings serialised by the domain/application layer (System.Text.Json), not EF JSON mapping, to keep snapshots byte-stable for `PayloadHash`.
4. `Contract.Lines/Parties/Terms/Signatures` mapped as navigations with backing fields (`HasMany(...).WithOne().HasForeignKey(...).OnDelete(Restrict)`), loaded explicitly (`Include`) in command handlers only; list queries use projections.
5. List-query projections (`ContractListDto`) via Mapster `ProjectToType` and `AsNoTracking`, as in `GeneralLedgerAccountIntegrationService`.
6. Repositories: `IContractRepository` (aggregate with children, `GetByNumberAsync`, `GetExpiringAsync(date)`), `IFulfillmentRepository` (`GetContributionAsync(sourceLineId, entryType)`, `InsertEntryAsync`, `TryAdjustBalanceAsync`), versions repository exposing **no Update/Delete**.
7. Seed: default `ContractType`s (Sales Agreement, Purchase Agreement, Service, NDA, Lease, Consulting) and `DocumentNumbering` series for module `ContractsManagement` through a `DataSeedContributor` in the module’s Domain (pattern used by `ArchiveDocumentTypeDataSeeder`).

## 6. Retention and growth

- Contracts, versions, ledger kept indefinitely (legal). Ledger growth ≈ documents × lines × 2; partitioning not needed below ~50 M rows; add a clustered key `(TenantId, ContractLineId, Id)` review if scans appear.
- `ContractNotificationLogs` can be purged after 2 years (setting) without functional impact.
- `ContractVersions.Payload` compress (gzip) only if size becomes an issue (YAGNI now).
