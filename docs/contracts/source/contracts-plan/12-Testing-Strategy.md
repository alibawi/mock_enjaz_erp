# 12 — Testing Strategy

## 1. Frameworks and layout (verified conventions)

xUnit + Moq; test naming `Should_[Action]_When_[Condition]` (`jasim_api/docs/CLAUDE.md`); ABP integration tests inherit `AbpIntegratedTestBase<TModule>`. Sales shows the layout to copy: `Enki.Sales.TestBase`, `Enki.Sales.Domain.Tests`, `Enki.Sales.Application.Tests`, `Enki.Sales.EntityFrameworkCore.Tests` (plus `run-*-tests.bat`). `Enki.ContractsManagement` has **no** test projects yet → Phase 2 creates the four projects and adds them to `JasimERP.sln`.
Frontend: `vitest` unit tests and Playwright (`playwright.config.ts`, `tests/`) exist in `jasim_web`.
Test data builders: `ContractBuilder`, `AgreementLineBuilder`, `SourceLineEventBuilder` in TestBase.
Test IDs reference requirement IDs from doc 02.

## 2. Unit tests (Domain.Tests, no DB)

| Area | Cases (all with negative variants) | Req |
|---|---|---|
| State machine | every (from,to) pair in the matrix allowed/denied; reason-required transitions; Cancelled/Terminated/Closed are terminal | FR-LC-01 |
| Locking | legal fields throw `ContractLocked` after Submit; whitelisted metadata editable on Active | FR-LC-03 |
| Dates | Start ≤ End, notice ≤ duration, EffectiveDate rules, NoticeDeadline recalculation on date change, open-ended types | FR-MD |
| Counterparty rule | Outgoing→Customer, Incoming→Vendor, mismatch rejected | FR-MD-04 |
| Lines | LineNum unique & never reused (including after close), commitment-type field rules, Max ≥ Min, committed-value formula, rounding (6 dp) | FR-AG-01 |
| Activation | signature requirement matrix; version 1 snapshot content + hash stable (canonical JSON) | FR-LC-04, FR-LC-07 |
| Renewal | policy validation; successor copy resets counters, keeps LineNums? (new contract lines renumbered from 1; documented), `RenewedFromContractId` uniqueness; grace window | FR-RN |
| Amendment | one open amendment; stale base version; commitment below counters rejected; effective-dated price rule; closed lines retained | FR-CA |
| Commitment math | Remaining by basis (Order/Delivery/Invoice); percent; returns restore on/off; value vs quantity lines | FR-AG-06 |
| Ledger service | contribution delta algorithm: create, edit up/down, cancel, reverse, return, duplicate, out-of-order revision, negative-balance guard, `Exceeded` flag | FR-AG-07 |
| AgreementLineResolver | match by partner/item/date/org, validity edges (inclusive), tie-break determinism, General vs Specific price override, OnHold/Expired excluded | FR-AG-04 |
| AgreementCounterRules | table-driven test of doc 08 §3.1 mapping for every document code | FR-AG-05 |
| Approval commands | stage record idempotency, request-id mismatch, creator≠approver, single open request, Elsa unavailable/not configured | doc 09 |
| Notification rules | ReminderDays evaluation, dedup keys, timezone date boundaries | FR-RN-02 |

## 3. Integration tests (EntityFrameworkCore.Tests with ABP test DB, Application.Tests)

| Area | Cases |
|---|---|
| EF mappings | every configuration builds the model; round-trip of each entity; decimal precision (19,6) preserved; filtered unique indexes enforced (duplicate number, duplicate ledger key, second open amendment, duplicate notification log); FK Restrict (no cascade) verified by attempting parent delete |
| Concurrency | two parallel updates to same contract → one `AbpDbConcurrencyException`; 20 parallel fulfillment events on one line → balances equal ledger sum, no lost update (atomic update path); 2 workers processing the *same* event → exactly one entry |
| Authorization | each command denied without its permission; `AllowedActions` reflects permissions |
| Tenant isolation | tenant A cannot read/modify/link tenant B contract; unique number allowed to repeat across tenants; job processes tenants independently |
| Org data authority | users with User/Org/System levels see exactly the expected sets in list, detail, timeline, versions, ledger, reports, dashboard, `ResolveAsync`; unknown level → none |
| Confidentiality | Restricted contract invisible and attachments blocked without permission, including via list counts/aggregates |
| Domain events | `ContractActivatedEvent` etc. published after commit and not on rollback; handler idempotency (replay 3×) |
| Sales integration | with Sales test module: create SO line with agreement → event → Release; delivery → Fulfill; invoice → Invoice; return/credit memo; cancel; edit; scenario matrix S1–S15 (doc 08 §3.7) |
| Procurement integration | PO → GRPO → PurchaseBill → GoodsReturn/PurchaseReturn; same matrix |
| Finance | no posting side-effects (assert journal tables untouched); settlement query returns invoice `PaidAmount`; unavailable settlement degrades gracefully |
| Attachments | upload/list/download via DMS with `EntityType.Contract`; each `Attachments.*` permission denied/granted; org authority and confidentiality; a user without access to the contract gets 404; **DMS bypass matrix (ADR-26):** for a user without `Attachments.*` or without access to the contract's organization, each direct DMS endpoint (list, by-master, download by id, download by name, image, upload, upload-many, delete, bulk delete) returns empty/404; Restricted contracts hidden from the generic list; delete of an Active contract's document denied; download of Confidential documents audit-logged; documents of other entity types unaffected (regression) |
| Notifications | each rule produces one notification per (contract, rule, due date, recipient) across two job runs |
| Migrations | migration applies to empty DB and to a copy of an existing tenant DB; model snapshot has no pending changes (`dotnet ef migrations has-pending-model-changes` equivalent check) |
| Feature flag | with `ContractsManagement.Enabled=false` Sales/Procurement flows behave exactly as before (regression suite) |

## 4. End-to-end scenarios (API-level in .NET + Playwright for UI)

| E2E | Steps / assertions |
|---|---|
| E1 Create & activate | create Draft sales agreement with 2 lines → submit → approve → upload signed doc → record signature → activate; history has 4 rows; version 1 exists; balances created |
| E2 Approval | policy by value: below threshold single step, above two steps; rejection returns to Draft with reason; creator cannot approve |
| E3 Link sales orders | create SO using agreement price; price/discount copied; Released counter equals SO qty; over-max blocked (Block) or warned (Warn) |
| E4 Link purchase orders | same for incoming |
| E5 Partial fulfillment | SO 10 → delivery 6 → invoice 6 → remaining by basis computed; UI shows % |
| E6 Returns & reversals | return 2; credit memo; cancel invoice; ledger shows compensating entries; balances rebuilt equal |
| E7 Renewal | manual renewal creates Draft successor with reset counters; activating successor closes predecessor (`Renewed`); auto-renewal job idempotent |
| E8 Amendment | amend active contract: extend term + increase qty; version 2 stored; version 1 unchanged; old orders unchanged; attempt to cut below fulfilled fails |
| E9 Terminate | terminate with reason; new linking blocked; open order can still be delivered and counted; obligations cancelled except survivors |
| E10 Expiration notifications | time-travel clock (inject `IClock`): reminders at 30/15/7/1; second run sends none |
| E11 Security | org B user cannot access org A contract in any E2E step |

## 4b. Tests for the moved items
Category matching (membership at document date, overlap tie-break); schedule rows vs fulfillment dates; auto-renewal idempotency (two job runs, one successor); delegation (active/expired/out-of-scope, creator≠approver preserved, Elsa assignment uses the delegate); version compare (field-level diff of two snapshots, hash-verified); advanced risk flags (thresholds from settings).

## 5. Negative / security / performance tests

- Negative: invalid transitions via API, tampered DTO fields (status, balances, version) ignored/rejected, SQL-injection-style strings in filters (DevExtreme filter parser), oversized payloads, duplicate submit (double click), stale concurrency stamp, malformed events.
- Security: permission matrix test generated from the permission list (each endpoint × each permission); IDOR test (guess ids across org/tenant); file access.
- Performance (separate category, run on demand): 100k contracts list query p95; resolve latency with 10k active lines for one partner; 1M ledger rows balance recalculation; event handler throughput (1k docs/min).
- Frontend: vitest for stores/services, Playwright for E1, E3, E5 with RTL snapshot.

## 6. Acceptance-criteria rule
Every requirement in doc 02 has at least one test named `<ReqId>__<behaviour>`; the roadmap Definition-of-Done requires green tests for the phase’s requirement IDs plus the regression suites of touched modules (Sales/Procurement) — executed with `dotnet test` per module as documented in `jasim_api/docs/CLAUDE.md`.
