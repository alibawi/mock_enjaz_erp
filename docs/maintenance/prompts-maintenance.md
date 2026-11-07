# Prompts — Maintenance module

Run in order. Each prompt = one step + one entry in `docs/maintenance/WORKLOG.md`. **No commits** (owner decision 2026-11-07): leave changes for review. Stop at the end of every area (marked ⏸) for owner review. Every step ends with `npx tsc -b`, `npm run build`, `npm run check` and a browser pass of the touched routes (console clean).

## M0 — Module foundation

### M0.1 — scaffold and shell registration
```
Read WORKLOG.md (root) and docs/maintenance/WORKLOG.md first, then root CLAUDE.md and sections 1, 9 of docs/maintenance/spec-maintenance.md.
Build: src/modules/maintenance with router.tsx (base /maintenance via src/shell/routerShim.tsx), MaintenanceApp.tsx (topbar + empty routes for every screen in spec §8, ComingSoon for PM, contract coverage, drag board, skills), components/Layout.tsx (Topbar, PageHeader, maintenanceNav). Register the module: route in src/App.tsx, provider in src/main.tsx, third group in src/shell/Sidebar.tsx, card in src/shell/Hub.tsx. Add a "صيانة" row to the CLAUDE.md module table.
Not yet: data, real pages.
Do not commit; append a WORKLOG entry.
```

### M0.2 — UI kit
```
Read the WORKLOG files, then spec §8.
Build: copy src/modules/contracts/components (ui, DataTable, ListView, states, inputs, display, attachments) into the module and adapt imports to the module router; add WeekBoard (rows × 7 days grid, empty-slot click, item click), JournalPreview (debit/credit table), PrintSheet (A4 RTL frame using the existing print CSS), ModuleScreensGrid.
Not yet: pages using them.
Do not commit; append a WORKLOG entry.
```

### M0.3 — store, roles, demo date
```
Read the WORKLOG files, then spec §2, §5.
Build: data/types.ts (all spec §2 entities), data/asof.ts (today 2026-11-07), data/permissions.ts (8 roles, can(action)), data/store.tsx (own localStorage key, DATA_VERSION = 1, run(action) that applies a change and appends an AuditEntry, reset button, role switcher in Topbar), data/format.ts (IQD, Arabic dates, status labels and tones), seed skeleton (partners, items, stock, warehouse, technicians, settings defaults from brief §4).
Not yet: documents seed.
Do not commit; append a WORKLOG entry. ⏸ Checkpoint: owner checks menu, hub card, role switch, reset.
```

## Area 1 — master data and settings
### 1.1 — master data screen (S1)
```
Read the WORKLOG files, then spec §2 (master data), §8 S1.
Build: tabs for maintenance types, asset categories + attribute template editor, failure codes, standard operations, workshop + bays, expense types (account code + name), technicians (standard rate). DataTable + modal create/edit, validation (unique codes).
Not yet: settings.
Do not commit; append a WORKLOG entry.
```
### 1.2 — settings (S2)
```
Read the WORKLOG files, then spec §2 Settings, §4 BR-M-03/04/09/13/14/20.
Build: settings page: consumption mode, over-issue mode, internal partner, approval mode and bands editor, rework window, estimate validity, deposit default.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 2 — assets
### 2.1 — seed + list (S3)
```
Read the WORKLOG files, then spec §2 Assets, §8 S3.
Build: ~30 assets (cars with vehicle details, ACs with BTU/gas, generators with KVA, company forklift with fixed-asset ref, a compressor as child of an AC), meter readings history; list with filters and KPIs (by category, warranty valid, internal).
Do not commit; append a WORKLOG entry.
```
### 2.2 — asset card + form (S4, S5)
```
Read the WORKLOG files, then spec §8 S4–S5, BR-M-01.
Build: card tabs (data, vehicle, meters with add reading, history: requests/WOs/total cost from store, audit); form with attribute template fields and vehicle fields; serial uniqueness.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 3 — requests
### 3.1 — seed + list + intake (S6, S7)
```
Read the WORKLOG files, then spec §3 Request, §8 S6–S7.
Build: request seed linked to assets; list; intake form (asset picker with quick-create, complaint, meter, accessories); request card with status actions and link to estimate/WO; intake receipt print (PrintSheet).
Do not commit; append a WORKLOG entry. ⏸
```

## Area 4 — estimates and approval
### 4.1 — estimate engine + seed
```
Read the WORKLOG files, then spec §3 Estimate, §4 BR-M-03…09.
Build: data/estimate.ts — totals, approval-needed check, band routing, task creation, decide (no self-approval), withdraw, expire (as of today), revise (new version, supersede). Seed estimates in every status with approval history.
Do not commit; append a WORKLOG entry.
```
### 4.2 — estimate list + card (S8, S9)
```
Read the WORKLOG files, then spec §8 S8–S9.
Build: list with status tabs; card with lines editor (part/labor/service, coverage, discount), totals, approval timeline, versions, customer acceptance dialog (channel), submit/withdraw/revise/convert-to-WO actions by status and role, estimate print with customer approval box.
Do not commit; append a WORKLOG entry.
```
### 4.3 — my tasks (S10)
```
Read the WORKLOG files, then spec §8 S10, BR-M-05/08.
Build: inbox of approval tasks for the current role; approve / reject (reason mandatory); self-approval blocked with a clear message.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 5 — work orders
### 5.1 — WO engine + seed
```
Read the WORKLOG files, then spec §3 Work order/Consumption, §4 BR-M-10…15, 19…21.
Build: data/workorder.ts (transitions and guards), data/stock.ts (availability, reserve, release, issue with idempotency key, failure simulation when a part is short), data/journal.ts (issue journal by expense type). Seed ~45 WOs across all statuses, with parts, time, rework and a failed consumption.
Do not commit; append a WORKLOG entry.
```
### 5.2 — WO list + form (S11, S13)
```
Read the WORKLOG files, then spec §8 S11, S13.
Build: list tabs (status, overdue, waiting to schedule, failed consumption); create from approved estimate or direct internal WO (expense type required for internal).
Do not commit; append a WORKLOG entry.
```
### 5.3 — WO card (S12)
```
Read the WORKLOG files, then spec §8 S12, BR-M-11…15, 19…21.
Build: tabs summary, operations, parts (planned/reserved/consumed/issued, per-line expense type override by permission), time, schedule (bookings), billing, removed parts, history/audit; action bar by status (start → reserve, complete → failure code + reason dialog → auto issue or failure + retry, quality check, close, reopen, cancel); rework banner; job card print.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 6 — scheduling
### 6.1 — schedule engine + seed
```
Read the WORKLOG files, then spec §2 Booking/Leave, §4 BR-M-22…24.
Build: data/schedule.ts (conflict check across technicians and bays, leave check, slot capacity, state mapping to WOs). Seed bookings for the current and next week, leave from HR.
Do not commit; append a WORKLOG entry.
```
### 6.2 — board + booking dialog (S14)
```
Read the WORKLOG files, then spec §8 S14.
Build: WeekBoard with technician and bay rows, leave shading, week navigation; empty-slot click → dialog (workshop: WO + bay + times; field: WOs + technicians + slot + vehicle); booking click → move, cancel (reason), start, complete (choose finished operations). Conflicts shown as clear errors. "To schedule" side list.
Do not commit; append a WORKLOG entry.
```
### 6.3 — bookings list, route sheet, leave (S15, S16)
```
Read the WORKLOG files, then spec §8 S15–S16.
Build: bookings table with reschedule/cancel reasons; route sheet for a date and technician with print; leave list (source HR).
Do not commit; append a WORKLOG entry. ⏸
```

## Area 7 — billing
### 7.1 — billing engine
```
Read the WORKLOG files, then spec §3 Billing/payment, §4 BR-M-16…19.
Build: data/billing.ts — generate invoice (billable lines, revenue account, batch, journal), cancel (blocked if paid), reopen billing, receive deposit (on-account receipt), apply/reverse, receive payment, payment status O/P/C.
Do not commit; append a WORKLOG entry.
```
### 7.2 — billing screens (S17, S18)
```
Read the WORKLOG files, then spec §8 S17–S18.
Build: invoices tab, receipts tab (unapplied balance), invoice view with JournalPreview and "مُحاكى" tag, deposit dialog from WO, goods issues list with journals; WO billing tab wired.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 8 — labor
### 8.1 — time entries + variance (S19)
```
Read the WORKLOG files, then spec §8 S19, BR-M-25/26.
Build: time entries by technician/WO, supervisor confirm, monthly variance against simulated HR attendance, labor cost (report-only).
Do not commit; append a WORKLOG entry. ⏸
```

## Area 9 — reports and dashboard
### 9.1 — reports engine + screens (S20)
```
Read the WORKLOG files, then spec §6, §8 S20 and plan §28, §38.6.
Build: data/reports.ts computing every report from the store; reports page grouped (operations, performance, quality, finance, assets & customers, stock, approval, scheduling), each a table + CSS bar chart, with filters by period.
Do not commit; append a WORKLOG entry.
```
### 9.2 — module dashboard (S0)
```
Read the WORKLOG files, then spec §6.
Build: hub page = ModuleScreensGrid + KPI cards computed from the store, each linking to its filtered list.
Do not commit; append a WORKLOG entry. ⏸
```

## Area 10 — access, audit, polish
### 10.1 — permissions matrix + audit log (S21, S22)
```
Read the WORKLOG files, then spec §5, §8 S21–S22.
Build: role × action matrix (cosmetic toggles), audit log with filters.
Do not commit; append a WORKLOG entry.
```
### 10.2 — engine check + full walkthrough
```
Read the WORKLOG files.
Build: scripts/maintenance/flow-check.ts (request → estimate → approval → WO → booking → start → complete → issue → invoice → deposit application → payment → close; plus rework and failed consumption) and npm script check:maintenance added to "check". Browser walkthrough of the full flow in every role; realism review (no empty screens, zero console errors).
Do not commit; append a WORKLOG entry. ⏸ Final review.
```
