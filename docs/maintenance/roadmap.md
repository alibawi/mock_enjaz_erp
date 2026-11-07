# Roadmap — Maintenance Management mock (module 3 of mock_enjaz_erp)

Source: `docs/maintenance/source/maintenance-management-implementation-plan.md` (approved JasimERP plan, last update 2026-11-07) and its HTML summary. Method: `docs/maintenance/source/mock-playbook-en.md`. Decisions: `docs/maintenance/project-brief.md` (confirmed 2026-11-07). Progress log: `docs/maintenance/WORKLOG.md`. Nothing here touches JasimERP.

## Architecture
- Same stack and merge rules as the other two modules (root `CLAUDE.md`): Vite + React 18 + TypeScript + Tailwind v3, HashRouter, `lucide-react`; no new dependency.
- `src/modules/maintenance/`
  - `MaintenanceApp.tsx` (topbar + routes), `router.tsx` (module router shim, base `/maintenance`).
  - `components/`: `Layout` (Topbar, PageHeader, `maintenanceNav`) and the UI kit, copied from `src/modules/contracts/components` and generalised inside this module (rule: no cross-module imports, no duplication inside the module). Includes `DataTable`, `ListView`, states (loading/empty/error), inputs (`SearchableSelect`, entity pickers), display (`StatusBadge`, `KPICard`, `Timeline`), `Modal`, attachments mock, plus new `WeekBoard`, `JournalPreview`, `PrintSheet`.
  - `data/`: `types.ts`, `store.tsx` (`useStore()`, `run()` for every state change + audit row, own `localStorage` key, `DATA_VERSION`), `asof.ts` (today = 2026-11-07), `permissions.ts` (8 roles), `settings.ts`, `format.ts`, `seed/`, and engines: `estimate.ts` (totals, approval routing), `workorder.ts` (state machine and guards), `stock.ts` (availability, reservation, issue simulation), `billing.ts` (invoice, deposit, application, payment status), `schedule.ts` (conflicts, leave, slots), `journal.ts` (simulated entries), `reports.ts`.
  - `pages/`: one folder per area (below).
- `scripts/maintenance/flow-check.ts` + `npm run check:maintenance`: engine check of the main flow (like the other modules' checks).
- Shell: third group in `src/shell/Sidebar.tsx`, third card in `src/shell/Hub.tsx`, route in `src/App.tsx`, provider in `src/main.tsx`. These are the only edits outside the module.

## Areas and build order (by dependency)
| # | Area | Why in this position |
|---|---|---|
| M0 | Module foundation: scaffold, router, kit, store, asof, permissions, seed skeleton, shell registration | Everything depends on it |
| 1 | **master-data** — maintenance types, asset categories + attribute templates, failure codes, standard operations, workshop + bays, expense types, technicians, settings | Pickers on every later screen |
| 2 | **assets** — asset card, vehicle extension, meters, history | Requests and WOs hang off the asset |
| 3 | **requests** — intake, receipt, print | First step of the flow |
| 4 | **estimates** — lines, coverage, versions, approval routing, task inbox, customer acceptance, print | Gate before work |
| 5 | **work-orders** — lifecycle, operations, parts, reservation, auto issue, failure code, removed parts, rework, job card print | Core entity |
| 6 | **scheduling** — weekly board, booking dialog, field trips, leave, bays, waiting list, route sheet print | Depends on WOs and technicians |
| 7 | **billing** — service invoice, deposit, application, payment, cancel/reopen, journal previews | Depends on completed WOs |
| 8 | **labor** — time entries, supervisor confirmation, attendance variance | Feeds reports |
| 9 | **reports** — module dashboard + §28 and §38.6 report set | Reads everything |
| 10 | **access** — permission matrix, audit log, polish, full-flow walkthrough | Cross-cutting, last |

"Coming soon" entries in the menu: preventive maintenance, contract coverage, drag-and-drop board, skills.

## Per-area sequence (playbook §9)
1 routes + menu links → 2 seed data → 3 list → 4 detail (fields, timeline, audit, related links) → 5 state machine + business rules → 6 create/edit forms and modals → 7 area-specific screens → 8 permission touchpoints → 9 KPIs → 10 browser flow test. **Stop after each area for owner review.**

## Verification every step
`npx tsc -b`, `npm run build`, `npm run check` (all modules), browser pass on the touched routes (console clean, RTL, role switch), WORKLOG entry. **No commits** (owner decision): changes are left for review.

## Rough effort
M0 ½ day · areas 1–3 ½ day each · 4 one day · 5 one and a half days · 6 one day · 7 one day · 8 ½ day · 9 one day · 10 ½ day. About 9 working days of build time, confidence medium (depends on review rounds).
