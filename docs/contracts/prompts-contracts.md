# Prompts - Module 1 - contracts (العقود)

Run in order; each prompt = one commit + one WORKLOG entry. Stop after the last prompt for owner review.

## 1.1 - scaffold empty routes + sidebar links

```
Read WORKLOG.md first, then read sections 1, 8 of docs/spec-contracts.md.

Build: Empty routes for C1-C8 and the module landing (ModuleScreensGrid), sidebar entries under the contracts section.

Not yet: data, behaviour.

Commit with the message "feat(contracts): scaffold empty routes" and append an entry to WORKLOG.md summarizing this step.
```

## 1.2 - seed + mock API

```
Read WORKLOG.md first, then read sections 2, 4 of docs/spec-contracts.md.

Build: src/data/seed/contracts.ts: 12 contract types, 30 contracts across all statuses (mixed Iraqi counterparties, IQD and USD), parties, history, attachments, signatures, alerts; mockApi functions with 300-600 ms latency and an error-simulation switch.

Not yet: screens.

Commit with the message "feat(contracts): add seed data and mock api" and append an entry to WORKLOG.md summarizing this step.
```

## 1.3 - contracts list C1

```
Read WORKLOG.md first, then read sections 8 (C1) of docs/spec-contracts.md.

Build: List with status tabs and counts, filters (type, direction, profile, organization, owner, partner, dates, expiring in N days), search, column set, export button gated by permission; use ListView/DataTable/StatusBadge/FilterSelect.

Not yet: card, forms.

Commit with the message "feat(contracts): contracts list screen" and append an entry to WORKLOG.md summarizing this step.
```

## 1.4 - contract card C2 (core tabs)

```
Read WORKLOG.md first, then read sections 2, 8 (C2) of docs/spec-contracts.md.

Build: Header strip, General, Parties, Attachments (mock upload/preview), Signatures, Linked documents, Timeline and audit tabs; tabs of later modules appear as coming-soon placeholders gated by feature flags.

Not yet: state machine, forms.

Commit with the message "feat(contracts): contract card core tabs" and append an entry to WORKLOG.md summarizing this step.
```

## 1.5 - state machine and rules

```
Read WORKLOG.md first, then read sections 3, 4 of docs/spec-contracts.md.

Build: lifecycle.ts with transitions T1-T15, guards BR-C-01..15, allowed-actions function; every action appends history; action bar driven by allowed actions + permissions.

Not yet: create/edit forms.

Commit with the message "feat(contracts): status state machine and business rules" and append an entry to WORKLOG.md summarizing this step.
```

## 1.6 - wizard, dialogs, types

```
Read WORKLOG.md first, then read sections 8 (C3, C4, C6) of docs/spec-contracts.md.

Build: Create/Edit wizard (6 steps) with validation from section 4, transition dialogs (reason/date), contract types list and dialog.

Not yet: alerts.

Commit with the message "feat(contracts): create wizard and type management" and append an entry to WORKLOG.md summarizing this step.
```

## 1.7 - alerts, renewal fields, links

```
Read WORKLOG.md first, then read sections 4 (BR-C-11, BR-C-14), 8 (C5, C7) of docs/spec-contracts.md.

Build: Alerts center driven by the demo date and reminder settings, renewal fields on the card, linked-documents picker.

Not yet: KPIs.

Commit with the message "feat(contracts): alerts and linked documents" and append an entry to WORKLOG.md summarizing this step.
```

## 1.8 - module KPIs

```
Read WORKLOG.md first, then read sections 6 of docs/spec-contracts.md.

Build: Landing cards and charts computed from the store.

Not yet: -.

Commit with the message "feat(contracts): module KPI dashboard" and append an entry to WORKLOG.md summarizing this step.
```

## 1.9 - flow test

```
Read WORKLOG.md first, then read sections - of docs/spec-contracts.md.

Build: Run create -> submit (stub approve until module 2) -> activate -> suspend -> resume -> terminate; advance the demo date to force expiry; report results in WORKLOG; give the owner a checklist and stop.

Not yet: -.

Commit with the message "feat(contracts): flow test notes" and append an entry to WORKLOG.md summarizing this step.
```
