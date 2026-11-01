# Prompts - Module 4 - amendments (الملاحق والنسخ والتجديد)

Run in order; each prompt = one commit + one WORKLOG entry. Stop after the last prompt for owner review.

## 4.1 - routes + seed

```
Read WORKLOG.md first, then read sections 1, 2 of docs/spec-amendments.md.

Build: Seed versions for active contracts and 6 amendments in different states.

Not yet: engine.

Commit with the message "feat(amendments): routes and seed" and append an entry to WORKLOG.md summarizing this step.
```

## 4.2 - versions tab M4

```
Read WORKLOG.md first, then read sections 8 (M4) of docs/spec-amendments.md.

Build: Version list with hash, reason, user; read-only version view.

Not yet: amendments.

Commit with the message "feat(amendments): versions tab" and append an entry to WORKLOG.md summarizing this step.
```

## 4.3 - amendments tab + editor

```
Read WORKLOG.md first, then read sections 8 (M1, M2) of docs/spec-amendments.md.

Build: List, editor with change editor in diff mode (old -> new), counter warnings.

Not yet: engine.

Commit with the message "feat(amendments): amendments editor" and append an entry to WORKLOG.md summarizing this step.
```

## 4.4 - amendment engine

```
Read WORKLOG.md first, then read sections 4 (BR-M-01..06) of docs/spec-amendments.md.

Build: One-open-amendment, stale check, version creation, counters guard, effective-date rule.

Not yet: compare.

Commit with the message "feat(amendments): amendment engine" and append an entry to WORKLOG.md summarizing this step.
```

## 4.5 - amendment detail + approval

```
Read WORKLOG.md first, then read sections 8 (M3), 4 (BR-M-05) of docs/spec-amendments.md.

Build: Detail with StageTimeline, apply button after approval.

Not yet: compare.

Commit with the message "feat(amendments): amendment detail" and append an entry to WORKLOG.md summarizing this step.
```

## 4.6 - version compare M5

```
Read WORKLOG.md first, then read sections 8 (M5), 4 (BR-M-06, BR-M-10) of docs/spec-amendments.md.

Build: Two-column diff grouped by header/lines/terms/parties; tamper-test button for admin.

Not yet: renewal.

Commit with the message "feat(amendments): version compare" and append an entry to WORKLOG.md summarizing this step.
```

## 4.7 - renewal M6/M7

```
Read WORKLOG.md first, then read sections 4 (BR-M-07..09), 8 (M6, M7) of docs/spec-amendments.md.

Build: Manual successor dialog, auto-renewal on demo-date advance, renewals-due list, grace-period handling.

Not yet: KPIs.

Commit with the message "feat(amendments): renewal and renewals due" and append an entry to WORKLOG.md summarizing this step.
```

## 4.8 - KPIs + flow test

```
Read WORKLOG.md first, then read sections 6 of docs/spec-amendments.md.

Build: Cards; flow: amend value and quantity -> approve -> apply -> compare v1/v2; try cutting below fulfilled; renew an expired contract.

Not yet: -.

Commit with the message "feat(amendments): KPIs and flow test" and append an entry to WORKLOG.md summarizing this step.
```
