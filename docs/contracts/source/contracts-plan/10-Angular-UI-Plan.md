# 10 — Frontend UI Plan (file name kept per the requested deliverable list; the frontend is **Vue 3, not Angular**)

## 0. Frontend reality check (verified)

`jasim_web` is a **Vue 3.4 (Composition API, `<script setup>`) + TypeScript + Vuetify 3.6 + DevExtreme / devextreme-vue ~23.2 + Tailwind + Pinia 2.2 + Vue Router (file-based `src/pages`) + vue-i18n 9 (Arabic/English) + CASL 6 + SignalR + Vite** application (`jasim_web/CLAUDE.md`, `package.json`). There is **no Angular application** in the repository, so no frontend setup is "missing"; the Contract UI is built in the existing app. Do **not** introduce Angular or another component library.

Existing guidance to follow (read before Phase 8): `jasim_web/TYPE_A_PAGE_PATTERN.md` (master-detail documents, reference `sale-invoice`), `TYPE_B_PAGE_PATTERN.md` (simple CRUD, reference `price-list`), `GRID_VALIDATION_GUIDE.md`, `GRID_FILTERING_ENHANCEMENT.md`, `ENKI_UI_DESIGN_GUIDE.md`, and the `jasim-frontend` skill (XView/BaseGrid, `BaseCrudStore`, `BaseCrudService`, CASL gating, i18n). Folder layout: module code in `src/modules/contracts-management/{components,services,stores,types}`; **all pages in `src/pages/contracts-management/...`** (file-based routing; modules must not contain pages — project rule); navigation entry in `src/navigation`.

## 1. Screens

Pattern legend: **A** = Type A (header + line grids + workflow actions), **B** = Type B (grid + dialog/CRUD), **D** = dashboard/custom.

| # | Screen | Pattern | Rel. |
|---|---|---|---|
| 1 | Contract dashboard | D | R1 |
| 2 | Contract list | B-style grid (DevExtreme) | R1 |
| 3 | Contract detail / edit (tabs) | A | R1 |
| 4 | Create wizard | A (stepper variant) | R1 |
| 5 | Contract types | B | R1 |
| 6 | (removed) approval stages are configured in the existing Elsa workflow designer | – | – |
| 7 | My approvals | grid | R1 |
| 8 | Amendments (within detail + create dialog) | A sub-view | R1 |
| 9 | Fulfillment tracking (within detail + standalone report) | grid | R1 |
| 10 | Reports (status, expiring, fulfillment, awaiting approval) | grid+filter | R1 |
| 11 | Obligations & milestones | grid + dialog | R1 |
| 12 | Payment schedule & financial summary | grid + cards | R1 |
| 13 | Templates / clause library | B | R1 |
| 14 | Version history & compare | D | R1 |
| 15 | Service coverage & SLA | A sub-view | R1 |
| 16 | Approval delegation | dialog + grid | R1 |

### 1.1 Contract list (`/contracts-management/contracts`)
- **Purpose:** find and act on contracts. **Data:** `GET api/contracts-management/contract` with DevExtreme load options (server-side).
- **Columns:** Number, Title, Type, Direction, Status (chip with colour), Counterparty, Owner, Currency, Value, Start, End, Days to expiry (colour thresholds), Notice deadline, Fulfillment % (agreements), Confidentiality icon, Org, flags (⚠ expiring, ✍ missing signature, ⏳ awaiting approval).
- **Search/filter:** quick search (number/title/counterparty), status multi-select, type, direction, profile, org, owner, date range, "expiring within N days", has-pending-amendment; saved filters (grid state persistence as other grids).
- **Actions:** New, Open, Export (permission), per-row contextual transitions from `AllowedActions[]`.
- **Permissions:** CASL subject `Contract`, actions `read/create/export`; row actions from server list.
- **Localization:** all labels i18n keys `contracts.*`; dates formatted via existing date utils (`test-date-formatting.js` shows a known formatting pitfall — use the shared formatter); RTL via Vuetify `rtl`.

### 1.2 Contract detail (`/contracts-management/contracts/:id`)
Header strip: number, title, status chip, version, owner, key dates, **action bar** (buttons rendered from `AllowedActions[]`: Submit, Approve, Reject, Send for signature, Activate, Suspend/Resume, Terminate, Amend, Renew, Close, Cancel). Tabs:
1. **General** — fields per doc 02 §2.1.1; editable only in Draft (fields locked otherwise with lock icon + tooltip; metadata editable per whitelist).
2. **Parties** — grid (role, partner lookup, contact, signatory).
3. **Lines** (Agreement/Service) — grid: LineNum, Item, Description, UoM, Commitment type, Agreed qty/value, Price, Disc %, Min/Max, PriceFixed, EnforceMax, Valid from/to, and **balance columns** Released / Fulfilled / Invoiced / Remaining / % (read-only, from `ContractLineBalance`). Draft editable, otherwise read-only; changes via Amendment.
4. **Terms & clauses**.
5. **Documents** — DMS list/upload with subtype (Draft/Signed/Appendix) and download, gated by `Attachments.View/Upload/Download/Delete` like the Sales screens; confidential gating.
6. **Signatures** — record signer/date/method/linked document.
7. **Approvals** — current request, stage history (from `ContractApprovalAction`), link to the pending `TaskItem`; the decision itself is made in the existing task inbox.
8. **Amendments** & **Versions** — list; create amendment dialog (type, effective date, change editor reusing the lines grid in "diff mode"); versions list (compare R2).
9. **Fulfillment** — line summary + ledger drill-down (source document links open the Sales/Procurement document page).
10. **Linked documents** — `ContractDocumentLink` list with deep links.
11. **Obligations**, **Financial**, **Service** (all R1; Service tab limited to contract terms until the service modules exist).
12. **Timeline & audit** — merged history (status, approvals, amendments, notifications) + audit changes.
- **Validation:** client-side with the project’s validation approach (see `GRID_VALIDATION_GUIDE.md`) mirroring server codes; server errors mapped to field messages via error codes.
- **Status-dependent behaviour:** form disabled by status; banners: "Awaiting approval", "Expired — renewal window open until …", "On hold — new documents blocked".
- **Concurrency:** carries `concurrencyStamp`; 409 → reload prompt.

### 1.3 Create wizard
Steps: (1) type & direction → (2) parties/dates/value/terms → (3) lines (Agreement) → (4) renewal & reminders → (5) attachments → (6) review & save as Draft / Submit. Wizard uses the same components as the detail tabs. Template picker appears in step 1 in R2.

### 1.4 Configuration screens
- **Contract types (Type B):** grid + dialog; fields from doc 04 §2.1; permission `ContractTypes.Manage`.

### 1.5 Dashboard
Cards: Active contracts, Expiring ≤ 30 days, Awaiting approval, Awaiting signature, Overdue obligations, Commitment utilisation top-10; lists link to filtered grid. Charts via DevExtreme charts (already a dependency) using the project’s chart components.

### 1.6 Reports
Filter bar + grid + export; defined in doc 11. Printing of contract documents (R1) through the existing report viewer mechanism (verify what the web uses for `.repx` printing — `jasim-report-builder` agent describes a "print dialog" pattern).

### 1.7 Cross-module UI hooks (done by the Sales/Procurement frontend owners)
- Sales order/invoice and purchase order/bill **line grids**: after item selection call resolve endpoint; show an "Agreement" badge/column (contract number + line) with remaining quantity, allow "remove link"; header shows "Linked agreement(s)" read-only.
- Business-partner page (Core): tab "Contracts" listing contracts of that partner.

## 2. Permissions in the UI
CASL subjects/actions mirror backend permissions; route meta `action/subject` gating and `$can` checks as in existing pages; nav items hidden without `Contract:read`. Server-provided `AllowedActions` is the source for transition buttons so UI and API never diverge.

## 3. State and services
- `ContractService` extends `BaseCrudService` for read/list; custom methods for each transition (`submit(id, body)`, …); `AgreementService.resolve(...)` for document pages.
- Pinia store `useContractStore` (extends `BaseCrudStore`) holds current contract; actions refresh from the DTO returned by each transition.
- Types generated/handwritten in `types/` aligned with DTOs of doc 07.

## 4. Localization and RTL
Keys under `contracts.*` in both locale files; status/enum labels from enum maps; numbers/dates by locale; all tables RTL-safe (Vuetify/DevExtreme RTL option — follow how existing grids set it); Arabic/English contract print layouts in R2.

## 5. Frontend risks / notes
- Large lines grid performance → DevExtreme virtual scrolling, server-side balances only on the detail tab.
- The Type A pattern expects document-style workflow buttons; contracts have more states — keep the action bar data-driven.
- Playwright tests exist (`playwright.config.ts`, `tests/`): add E2E specs per doc 12.
