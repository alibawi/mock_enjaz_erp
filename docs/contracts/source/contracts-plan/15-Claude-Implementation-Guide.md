# 15 — Implementation Guide: prompts for future Claude sessions

How to use: run **one prompt per session**, in order. Each prompt is self-contained (a new session has no memory of this one) and refers to the plan documents in `docs/planning/contracts/`. Paste the **Common preamble** at the top of every prompt.

## Common preamble (include in every session)

```
Context: JasimERP, repo root D:\Projects\Git\Enki-Erp\JasimERP. Backend jasim_api (.NET 9, ABP 9.1.1, modular monolith, MediatR+FluentValidation+Mapster, EF Core, SQL Server, Hangfire), frontend jasim_web (Vue 3 + Vuetify + DevExtreme + Pinia + CASL; NOT Angular).
We are implementing the Contract Management module in the existing skeleton modules/Enki.ContractsManagement. The authoritative plan is docs/planning/contracts/ (read 00, 14 and the documents named below before coding; if code contradicts the plan, stop and report instead of improvising).
Rules: follow docs/backend-architecture/* and jasim_api/docs/CLAUDE.md. Use Mapster (no AutoMapper). Entities: private setters, factories, BusinessException codes "ContractsManagement:<Code>". Cross-module references are soft Guid ids; never reference Sales/Procurement/Finance from Enki.ContractsManagement. One global migration in src/JasimERP.EntityFrameworkCore (use the jasim-migrations agent), never module-local migrations. Do not commit, branch or push; leave changes uncommitted for review. Do not create markdown files other than those requested. After coding run dotnet build and the relevant tests, report exact results, list files changed, and list any deviation from the plan.
```

---

## Prompt P1 — Decisions and prerequisites (no code)
```
Read docs 00, 08, 14. Inspect the code to answer Q-01 (event delivery semantics: look at AbpDistributedEventBusOptions / outbox config and how SaleOrder handlers publish), Q-02 (what SaleReturn, ARCreditMemo, GoodsReturn, PurchaseReturn represent), Q-05 (DocumentNumberingManager atomicity), Q-11 (DMS authorization per EntityType), A-03, A-04, A-09, A-10. Produce a short findings table appended to docs/planning/contracts/14-Architecture-Decisions.md §5 (update statuses only) and list the product questions Q-03, Q-04, Q-06, Q-17 for the owner. No source changes.
Done when: every blocking question has a code-backed answer or an explicit product question.
```

## Prompt P2 — Foundation, domain, persistence (Phase 2)
```
Read docs 04, 05, 06, 02 §2.1–2.2. Implement Phase 2 of docs/planning/contracts/13-Implementation-Roadmap.md:
1) Remove template samples and AutoMapper profile from modules/Enki.ContractsManagement; keep only ar/en localization files; update module classes.
2) Domain.Shared: enums, consts, error codes, localization keys, events (incl. AgreementDocumentLineChangedEvent, AgreementCounterRules skeleton).
3) Domain: R1 entities exactly as doc 04 (Contract + Parties/Lines/Signatures, ContractType, ContractLineBalance, ContractFulfillmentEntry, StatusHistory, Version, Amendment, ApprovalRequest/Action, DocumentLink, NotificationLog), factories, repository interfaces, domain services (ContractStateMachine, ContractSnapshotBuilder, AgreementLineResolver, FulfillmentLedgerService, ContractNumberGenerator).
4) EntityFrameworkCore: configurations (decimal(19,6) explicit, filtered unique indexes, Restrict FKs), repositories.
5) Additive changes: DocumentTypeData.Contract, DMS EntityType.Contract = 24; seed ContractTypes and DocumentNumbering (use DocumentNumberingFactory, the Core numbering path used by all documents).
6) Create test projects (TestBase, Domain.Tests, Application.Tests, EntityFrameworkCore.Tests) mirroring Enki.Sales tests and add to JasimERP.sln.
7) Use the jasim-migrations agent to create ONE migration "add_contracts_management_r1".
Write domain unit tests (state machine, lines, ledger delta algorithm, commitment math) and EF mapping tests.
Done when: solution builds, tests green, migration reviewed (script inspected for schema ContractsManagement, indexes, precision), no AutoMapper left.
```

## Prompt P3 — Lifecycle, permissions, approvals API (Phase 3)
```
Read docs 03, 07, 09. Implement permissions (+ definition provider, default role seeding), commands/queries/handlers/validators/DTOs/AppServices/controllers for contract lifecycle, ContractType and the approval commands used by the Elsa workflow (read docs/TASKITEM_ELSA_WORKFLOWS.md and the EntityWorkflowSetting code first; build sample 3- and 5-stage workflows) as in doc 07 §1–3, including AllowedActions, ApplyDataAuthority on every query, confidentiality filtering, concurrency stamp handling, audit-changes query, dashboard counts. No generic status update endpoint. Add .http test file. Tests: authorization matrix, tenant isolation, org authority, concurrency, E1/E2 at API level. Use the jasim-tester agent for tests and the jasim-reviewer agent at the end.
Done when: FR-MD and FR-LC tests green; every endpoint documented in Swagger; reviewer findings addressed.
```

## Prompt P4a — DMS access-policy hook (prerequisite of P4; run in the DMS module)
```
Read docs 14 (ADR-26) and 08 section 5. In Enki.Dms: add IDocumentAccessPolicy and DocumentOperation to Dms.Application.Contracts, a DocumentAccessGuard (default allow when no policy applies), and call it in every list/view/download/upload/delete handler and the FileController-backed queries; filter lists; return 404 on denial; verify DocumentDto exposes no BlobUrl/ContainerName. Add regression tests proving unchanged behaviour with no policy registered, and deny tests with a fake policy. Do not reference Enki.ContractsManagement.
Done when: tests green and the endpoint matrix of ADR-26 is covered.
```

## Prompt P4 — Documents, signatures, amendments, versions (Phase 4)
```
Read docs 03 §5, 07, 08 §5, 09 §4. Add EntityType.Contract = 24 and implement ContractDocumentAccessPolicy (IDocumentAccessPolicy from P4a): organization authority via the authorised contract query, confidentiality, Attachments.View/Upload/Download/Delete mapping, Active-contract delete denial, audit log for Confidential downloads; the contract page uses the generic DMS attachment endpoints. Test the full DMS bypass matrix of docs 12 and 14 (ADR-26), signature recording, amendment commands/queries, ContractVersion snapshots with SHA-256 hash, timeline/version queries. Enforce: one open amendment, stale base version rejection, commitment never below counters, previous snapshots immutable (repository exposes no update/delete). Tests: E8, FR-CA-03/04/05, FR-DS-01/02.
Done when: tests green; snapshot immutability proven by tests; reviewer clean.
```

## Prompt P5a — Agreement engine inside Contracts (Phase 5, part 1)
```
Read docs 04 §2.4–2.7, 08 §3. Implement in Enki.ContractsManagement only: IAgreementIntegrationService (Resolve/Validate) + implementation, AgreementCounterRules (full table of doc 08 §3.1), AgreementDocumentLineChangedEventHandler (contribution/delta algorithm, SourceRevision ordering, Exceeded flag, DocumentLink upsert), balance atomic update, FulfillmentRecalculateCommand, IAgreementDocumentSource interface, fulfillment queries, reconciliation job class, feature definition ContractsManagement.Enabled. Tests: table-driven counter rules; scenario matrix S1–S15 with synthetic events; 20-way parallel handler test proving no lost updates and ledger==balance.
Done when: all S1–S15 pass at Contracts level; no reference to Sales/Procurement assemblies.
```

## Prompt P5b — Sales hooks (Phase 5, part 2) — run with the jasim-sales agent
```
Read docs 08 and 12 §3. In Enki.Sales: (1) add a SalesAgreementEventPublisher that builds AgreementDocumentLineChangedEvent (current contribution of every line carrying AgreementId; Removed/Unlinked states for lines that lost the link) and call it after create/update/post/cancel/delete/reversal of SaleQuotation (resolution only), SaleOrder, Delivery, SaleInvoice, SaleReturn, ARCreditMemo; (2) call IAgreementIntegrationService.ValidateAsync before save and expose Resolve for the UI; (3) implement IAgreementDocumentSource; (4) everything is a no-op when the ContractsManagement.Enabled feature is off. First write characterization tests of the existing flows, then add hook tests (scenarios S1–S11 from the Sales side). POS documents are excluded. Do not change posting/journal/inventory logic.
Done when: Sales regression suite green with feature off AND on; scenario tests pass; list of touched handlers provided.
```

## Prompt P5e — Inventory hooks (Phase 5) — run with the jasim-inventory agent
```
Read docs 08 section 3.1 and 14 section 6.2. In Enki.Inventory: when a GoodsReceipt has BaseDocType == Return (SaleReturn) or a GoodsIssue has BaseDocType == PurchaseReturn, publish AgreementDocumentLineChangedEvent for lines whose base return line carries an AgreementId (look up through IAgreementDocumentSource if inventory lines do not copy AgreementId), also on delete/cancel. Do not change ReturnCommitted/ReturnOrdered logic. Feature-flagged; regression suite with flag on/off.
```

## Prompt P5c — Procurement hooks (Phase 5, part 3) — run with the jasim-procurement agent
```
Same as P5b for Enki.Procurement: PurchaseRequest (resolution only), PurchaseOrder, GoodsReceiptPO, PurchaseBill, GoodsReturn, PurchaseReturn; LandedCost is excluded. Mirror counter rules of doc 08 §3.1 (incoming direction).
```

## Prompt P5d — Integration verification
```
Read docs 08 §3.7 and 12. Write cross-module integration tests (Application.Tests in a host-level test project or the Contracts tests referencing Sales and Procurement test modules) covering S1–S15 end-to-end with real documents, plus reconciliation job drift detection (deliberately drop an event and assert repair). Report any mismatch between counter rules and actual document behaviour (especially SaleInvoice vs Delivery inventory movement) and fix the rules in docs and code.
```

## Prompt P6 — Notifications, jobs, reports (Phase 6)
```
Read docs 11 and 09. Implement ContractExpiryJob, ContractReminderJob (rules ExpiryN, NoticeDeadline, Expired, ApprovalPending, SignatureMissing, Exceeded) following PostingPeriodAutoCreateJob (tenant loop) and the Notification dispatcher contract; register jobs in JasimERPHttpApiHostModule.ConfigureRecurringJobs(); seed notification templates ar/en; settings definitions; reports R-01…R-13 and R-17 as authorised projections with Excel export (use the jasim-report-builder agent only for printable layouts, not for these grids). Tests: E10 with injected IClock, dedup across two runs, report org-authority tests.
Done when: jobs idempotent (second run = zero notifications), reports pass security tests.
```

## Prompt P7 — Vue frontend R1 (Phase 7) — run with the vue3-erp-developer agent, then jasim-frontend-reviewer
```
Load the jasim-frontend skill. Read docs 10 and 07. Build screens 1–10 in jasim_web: pages under src/pages/contracts-management/**, module code under src/modules/contracts-management/{components,services,stores,types}, navigation, CASL subjects/actions, i18n (ar/en incl. RTL). Use Type A for contract detail (data-driven action bar from AllowedActions), Type B for types/policies, DevExtreme grids with server-side load options. Add the agreement badge/resolve call to Sales and Procurement document line grids only through the shared line component, coordinating with the sales/procurement frontends. Run npm typecheck, lint, build, vitest, and Playwright E1/E3/E5.
Done when: reviewer agent reports no blocking findings; no hard-coded strings; RTL verified.
```

## Prompt P8 — Hardening and rollout (Phase 8)
```
Read docs 12 §5, 09, 13 Phase 8. Run /security-review on the diff; verify every query handler applies ApplyDataAuthority (write a reflection-based test that fails if a handler in Enki.ContractsManagement.Application queries Contract repositories without it); run performance tests of doc 12; produce rollback notes (feature off), user guide in docs/user_guid, and a pilot checklist. Fix findings.
Done when: no critical/high findings; NFR-05 numbers recorded.
```

## Prompts P9–P13 — release-1 tracks A, B, C and D (one prompt each)
Track A (P9): obligations/milestones → payment schedule + financial summary (settlement via IAgreementDocumentSource) → templates + clause library + ContractTerm → printable documents → advanced approval conditions/risk flags → auto-renewal job → category commitments. Each prompt: "Read docs 02 §2.x, 04 §2.x, 06 §3.2, 11; implement <item> with tests and acceptance criteria listed in the requirement IDs; no change to R1 behaviour; extend the existing migration stream with a new migration."

## Review gate after every prompt
Ask the `jasim-reviewer` agent to audit the diff against docs 05, 09 and 14 (multi-tenancy, org authority, module boundaries, thin AppServices, no finance postings) before starting the next prompt.

Track B (P10): templates, clause library, ContractTerm, printing. Track C (P11): service contract side, e-signature adapter (Q-18), recurring-billing automation through IContractBillingDocumentFactory (ADR-20, Q-19). Track D (P13): category commitments (Q-22), delivery schedules, general bonus agreements, auto-renewal job, version compare, advanced risk flags, approval delegation. Hardening prompt P12 comes after the tracks. Each prompt: read the docs named in its roadmap phase, implement with tests and the listed requirement IDs, add a new migration to the single stream, keep R1 behaviour of earlier phases unchanged, finish with the jasim-reviewer gate.
