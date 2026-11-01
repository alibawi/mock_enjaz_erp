# Prompts - Module 5 - obligations-finance (الالتزامات والمالية)

Run in order; each prompt = one commit + one WORKLOG entry. Stop after the last prompt for owner review.

## 5.1 - routes + seed

```
Read WORKLOG.md first, then read sections 1, 2 of docs/spec-obligations-finance.md.

Build: Routes /obligations and the billing log; seed 25 obligations, occurrences, 20 payment items, guarantees.

Not yet: engine.

Commit with the message "feat(obligations-finance): routes and seed" and append an entry to WORKLOG.md summarizing this step.
```

## 5.2 - obligations tab + dialog

```
Read WORKLOG.md first, then read sections 8 (O1, O2) of docs/spec-obligations-finance.md.

Build: Grid with status filters, quick complete/accept, full dialog with recurrence, dependency, penalty, attachments.

Not yet: engine.

Commit with the message "feat(obligations-finance): obligations tab and dialog" and append an entry to WORKLOG.md summarizing this step.
```

## 5.3 - obligation engine

```
Read WORKLOG.md first, then read sections 4 (BR-O-01..05) of docs/spec-obligations-finance.md.

Build: Overdue by demo date, acceptance rule, recurring occurrences, dependencies, display-only penalties, termination effect.

Not yet: board.

Commit with the message "feat(obligations-finance): obligation engine" and append an entry to WORKLOG.md summarizing this step.
```

## 5.4 - obligations board O3

```
Read WORKLOG.md first, then read sections 8 (O3) of docs/spec-obligations-finance.md.

Build: Cross-contract list/kanban by status.

Not yet: payments.

Commit with the message "feat(obligations-finance): obligations board" and append an entry to WORKLOG.md summarizing this step.
```

## 5.5 - payment schedule + billing automation

```
Read WORKLOG.md first, then read sections 4 (BR-O-06, BR-O-07), 8 (O4, O5) of docs/spec-obligations-finance.md.

Build: Grid with totals check, item dialog, create-billing-document creating mock documents or recurring-template records via the agreements simulator.

Not yet: summary.

Commit with the message "feat(obligations-finance): payment schedule and billing" and append an entry to WORKLOG.md summarizing this step.
```

## 5.6 - financial tab + billing log

```
Read WORKLOG.md first, then read sections 4 (BR-O-08..10), 8 (O6, O7) of docs/spec-obligations-finance.md.

Build: Cards and per-currency table, guarantees panel, billing log, unavailable handling.

Not yet: KPIs.

Commit with the message "feat(obligations-finance): financial summary" and append an entry to WORKLOG.md summarizing this step.
```

## 5.7 - KPIs + flow test

```
Read WORKLOG.md first, then read sections 6 of docs/spec-obligations-finance.md.

Build: Cards; flow: complete -> accept; overdue via demo date; create invoice from a due item and see it in the ledger.

Not yet: -.

Commit with the message "feat(obligations-finance): KPIs and flow test" and append an entry to WORKLOG.md summarizing this step.
```
