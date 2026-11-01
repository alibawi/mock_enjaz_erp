# 11 — Reports, Dashboards, Background Jobs and Notifications

## 1. Existing infrastructure (verified)

| Capability | Finding |
|---|---|
| Background jobs | **Hangfire** (`AddHangfire`, `AddHangfireServer`, dashboard in Host). Recurring jobs are registered centrally in `JasimERPHttpApiHostModule.ConfigureRecurringJobs()` with `RecurringJob.AddOrUpdate<TJob>(id, j => j.ExecuteAsync(args…), Cron…, new RecurringJobOptions{ TimeZone = TimeZoneInfo.Local })`. Job classes are plain `ITransientDependency` types with `ExecuteAsync`. Multi-tenant sweep pattern: `PostingPeriodAutoCreateJob` (host + every tenant, `currentTenant.Change`, own UoW per tenant, failing tenant logged and skipped). Settings-driven cadence pattern: `AttendanceReminderJob` (hourly tick + settings, idempotency delegated to Notification dispatcher). Idempotent-instance pattern: `ProcurementRecurringTransactionGenerationJob`. |
| Notifications | `INotificationDispatcher.NotifyAsync(NotifyRequest)` (template by `EventKey`, `SourceEventKey` + `SourceEntityId` idempotency, channels in-app/push, severity), `NotificationEscalationJob` (hourly escalation by `EventKey` policy in appsettings `NotificationEscalation`), `NotificationsMaintenanceJob`. |
| Reporting | `Enki.Reporting` module exists; report scaffolding pattern ("Account Statement": Manager + Excel export handler + `.repx` layout + `ReportDataSeeder`) is documented in the `jasim-report-builder` agent definition. Not re-inspected in depth (Assumption A-08). |

## 2. Jobs

| Job (id) | Schedule | What it does | Idempotency | Error handling |
|---|---|---|---|---|
| `ContractExpiryJob` (`contracts-expiry`) | daily 01:30, `TimeZoneInfo.Local` (setting later) | per tenant: Active/OnHold contracts with `EndDate < today` → `MarkExpired` (history + `ContractExpiredEvent`); Approved/PendingSignature with signature complete and `EffectiveDate ≤ today` → Activate (if flagged auto-activate) | state guard (already Expired = skip) | per-tenant try/catch + log; continues |
| `ContractReminderJob` (`contracts-reminders`) | daily 07:00 | evaluates rules (§3) for the tenant; sends via dispatcher; inserts `ContractNotificationLog` | UQ `(contract, rule, dueDate, recipient)` + dispatcher key | skip failed recipient; retry next day (the log row is written **after** successful dispatch) |
| `ContractFulfillmentReconciliationJob` (`contracts-fulfillment-reconcile`) | nightly 02:30 | doc 08 §3.6 | ledger contribution model (re-run safe) | per-contract isolation; drift report to Contract Admin role |
| `ContractObligationJob` (R1) | daily 07:15 | overdue detection, recurring occurrence generation, upcoming due alerts | UQ `(obligation, dueDate)` | per-tenant |
| `ContractRenewalJob` (R1) | daily 06:00 | auto-renewal successor creation when `RenewalPolicy=Auto` and no termination notice | `RenewedFromContractId` unique | per-contract |
| `ContractBillingDueJob` (R1) | daily 07:30 | payment-schedule items due within X days → notification + `ContractBillingDueEvent`; creates the billing documents of recurring schedules through `IContractBillingDocumentFactory` (ADR-20) | log UQ | per-tenant |
Time zone: business dates are `date` values; comparisons use the tenant’s date computed from `TimeZoneInfo.Local` like other jobs; a per-tenant time-zone setting is a P2 improvement (Q-16). Retries: Hangfire default retry for exceptions that escape; handlers catch per item so one bad contract never fails a sweep. Logging: one summary line per tenant (`scanned, expired, notified, errors`).
Registration: add the three R1 jobs to `ConfigureRecurringJobs()` in the host (the only host change).

## 3. Notification rules

| Rule code | Trigger | Default schedule | Recipients | Escalation | Release |
|---|---|---|---|---|---|
| `ExpiryN` | `EndDate − today ∈ ReminderDays` (default 30,15,7,1) for Active contracts | each day matching | owner, responsible employee | at 7 and 1 days also Contract Managers (role) | R1 |
| `NoticeDeadline` | `NoticeDeadline − today ∈ {14,7,1}` and `RenewalPolicy≠None` | | owner, responsible | Contract Managers at 1 day | R1 |
| `Expired` | job transitions to Expired | once | owner, managers | – | R1 |
| `ApprovalPending` | request pending > `ApprovalReminderDays` (setting, default 2) | every 2 days | current step approvers | after 5 days to Contract Admin | R1 |
| `SignatureMissing` | status `PendingSignature` > N days | every 3 days | owner | managers after 7 days | R1 |
| `Exceeded` | ledger entry flagged `Exceeded` | immediately | owner | – | R1 |
| `Threshold` | line Remaining% crosses 20% / 0% | once per threshold | owner | – | R1 |
| `ObligationDue` / `ObligationOverdue` / `MilestoneMissed` | obligation dates | −3d, 0, +1d, +7d | responsible employee/department | owner then managers | R1 |
| `BillingDue` | payment-schedule item due in 7 days | | owner, finance contact (role) | – | R1 |
| `SlaViolation` | reported by service module | – | service owner | – | R1 |
| `GuaranteeExpiring` | guarantee date − 30/7 | | owner | – | R1 |
Delivery: `NotifyRequest` with `SourceModule="ContractsManagement"`, `EventKey=contracts.<rule>`, `SourceEventKey=<RuleCode>`, `SourceEntityId=<contractId>|<dueDate:yyyy-MM-dd>|<recipient>`; channels default in-app (+ push per user preference). Templates are seeded as `NotificationTemplate` rows (ar/en). Recipients are resolved through role/user lookups of Core; if a recipient is missing the owner is used.
Duplicate prevention: (1) our UQ log, (2) dispatcher’s `(SourceEventKey, SourceEntityId)`, (3) job-level "already notified today" check by reading the log first.
Configurable: reminder days at type default and per-contract override; thresholds and job windows via ABP settings (`ContractsManagementSettings`).

## 4. Reports

All reports: server-side queries as projections on the authorised contract queryable (`ApplyDataAuthority`), filterable, exportable to Excel (permission `Export`); no new tables. "Avoid duplicating Finance reports": financial statements, receivable aging and customer/vendor statements remain Finance reports; contract reports only show contract-linked totals.

| # | Report | Source data | Filters | Calculations | Notes | Rel. |
|---|---|---|---|---|---|---|
| R-01 | Contracts by status | Contracts | org, type, direction, date range | count/value by status | dashboard donut | R1 |
| R-02 | Contracts by type | Contracts | same | count/value by type | | R1 |
| R-03 | Active contracts | Contracts (Active) | partner, owner, org, type | list + days to expiry | | R1 |
| R-04 | Expiring / notice deadline | Contracts | days (30/60/90), org, type | `EndDate − today`, `NoticeDeadline − today` | index on `(Status, NoticeDeadline)` | R1 |
| R-05 | Expired contracts | Contracts | period, renewal-eligible | days since expiry; grace remaining | | R1 |
| R-06 | Awaiting approval | ApprovalRequests+Contracts | approver, age | age in days | | R1 |
| R-07 | Awaiting signature | Contracts (PendingSignature) | owner, age | | | R1 |
| R-08 | Requiring renewal | Contracts | window | `RenewalPolicy≠None` and EndDate/Notice within window | | R1 |
| R-09 | Commitment fulfillment (qty & value) | Lines + Balances | partner, item, org, contract, direction | committed, released, fulfilled, invoiced, remaining, % | primary agreement report | R1 |
| R-10 | Remaining commitments | Balances | partner/item/direction | remaining qty/value | | R1 |
| R-11 | Contract value by customer/vendor | Contracts | direction, org | Σ ContractValue, Σ committed in contract currency (no FX aggregation across currencies unless a reporting currency is chosen — shown per currency) | | R1 |
| R-12 | Contract value by organization | Contracts | | same | | R1 |
| R-13 | Amendment history | Amendments+Versions | contract, period | list with change summary | | R1 |
| R-14 | Obligations & overdue milestones | Obligations | owner, dept, status | overdue days | | R1 |
| R-15 | Financial exposure | ledger + settlement | partner | invoiced, paid, outstanding, remaining commitment | paid via integration | R1 |
| R-16 | Service-level performance | service module | | | | R1 |
| R-17 | Fulfillment drift (admin) | reconciliation job output | | | | R1 |

Security: same org authority and confidentiality rules as lists; confidential contracts excluded from aggregates for users without permission (aggregate queries pre-filter, not post-filter, to avoid leaking totals).
Printing/layout: contract documents and the fulfillment statement use Core `DesignTemplate` (designer UI, versions) — verified present; the report-builder pattern is only needed for the standard grids' Excel export.

## 5. Dashboard KPIs (R1)
Active count/value (per currency), expiring 30d, awaiting approval, awaiting signature, top 10 utilisation, fulfillment drift alerts; each KPI = one indexed query, cached per request only (no application cache until measured).
