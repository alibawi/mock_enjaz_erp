# Prompts - Module 3 - agreements (اتفاقيات المبيعات والمشتريات والتنفيذ)

Run in order; each prompt = one commit + one WORKLOG entry. Stop after the last prompt for owner review.

## 3.1 - routes + seed

```
Read WORKLOG.md first, then read sections 1, 2 of docs/spec-agreements.md.

Build: Routes /agreements, /agreements/simulator, /agreements/resolve; seed categories (hierarchy), items, 15 agreements, 70 lines, linked documents, 120 ledger entries, delivery schedules; reconcile balances.

Not yet: engine.

Commit with the message "feat(agreements): routes and seed" and append an entry to WORKLOG.md summarizing this step.
```

## 3.2 - agreements list A6

```
Read WORKLOG.md first, then read sections 8 (A6) of docs/spec-agreements.md.

Build: Tabs sales/purchase, utilisation %, remaining, expiry, filters.

Not yet: lines.

Commit with the message "feat(agreements): agreements list" and append an entry to WORKLOG.md summarizing this step.
```

## 3.3 - lines tab + editor

```
Read WORKLOG.md first, then read sections 8 (A1, A2) of docs/spec-agreements.md.

Build: Grid with BalanceBar; line dialog with item/category picker (+ sub-categories), UoM, commitment type, price, discount, limits, validity.

Not yet: engine.

Commit with the message "feat(agreements): lines tab and editor" and append an entry to WORKLOG.md summarizing this step.
```

## 3.4 - fulfillment engine

```
Read WORKLOG.md first, then read sections 4, 3 of docs/spec-agreements.md.

Build: fulfillment.ts + currency.ts implementing BR-A-01..11 and npm run check (ledger equals balances for every line).

Not yet: screens.

Commit with the message "feat(agreements): fulfillment engine" and append an entry to WORKLOG.md summarizing this step.
```

## 3.5 - fulfillment + documents tabs

```
Read WORKLOG.md first, then read sections 8 (A3, A4) of docs/spec-agreements.md.

Build: Per-line summary, ledger drill-down with revisions and reasons, recalculate, drift indicator, linked documents list.

Not yet: simulator.

Commit with the message "feat(agreements): fulfillment and documents tabs" and append an entry to WORKLOG.md summarizing this step.
```

## 3.6 - simulator A5

```
Read WORKLOG.md first, then read sections 8 (A5), 4 (BR-A-05, BR-A-06, BR-A-07) of docs/spec-agreements.md.

Build: Create a mock document line against an agreement; post/edit/cancel/return/reverse; show validation, warnings, ledger entries, balances; honour EnforcementMode, OnFulfillmentFailure and currency settings.

Not yet: resolver.

Commit with the message "feat(agreements): demo document simulator" and append an entry to WORKLOG.md summarizing this step.
```

## 3.7 - resolver, schedule, bonus, category

```
Read WORKLOG.md first, then read sections 4 (BR-A-09, BR-A-12), 8 (A7, A8) of docs/spec-agreements.md.

Build: Resolution test screen, delivery schedule editor, general (bonus) agreements, category commitments with sub-categories.

Not yet: KPIs.

Commit with the message "feat(agreements): resolver and schedules" and append an entry to WORKLOG.md summarizing this step.
```

## 3.8 - KPIs + flow test

```
Read WORKLOG.md first, then read sections 6 of docs/spec-agreements.md.

Build: Utilisation, near-exhaustion, exceeded counts; flow test of SO 10 -> delivery 6 -> invoice 6 -> return 2 -> cancel; USD document on an IQD contract; Block+Rollback vs KeepAndAlert.

Not yet: -.

Commit with the message "feat(agreements): KPIs and flow test" and append an entry to WORKLOG.md summarizing this step.
```
