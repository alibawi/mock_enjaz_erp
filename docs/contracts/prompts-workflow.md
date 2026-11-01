# Prompts - Module 2 - workflow (الاعتماد والتوقيع)

Run in order; each prompt = one commit + one WORKLOG entry. Stop after the last prompt for owner review.

## 2.1 - routes + seed

```
Read WORKLOG.md first, then read sections 1, 3 of docs/spec-workflow.md.

Build: Routes /tasks and /delegations; seed ApprovalStageRule (3 and 5 stage rules), requests, tasks, delegations, signature requests.

Not yet: engine.

Commit with the message "feat(workflow): routes and seed" and append an entry to WORKLOG.md summarizing this step.
```

## 2.2 - stage timeline W1

```
Read WORKLOG.md first, then read sections 8 (W1) of docs/spec-workflow.md.

Build: StageTimeline component and the Approvals tab on the contract card with approver, status, comment and task link.

Not yet: engine.

Commit with the message "feat(workflow): stage timeline" and append an entry to WORKLOG.md summarizing this step.
```

## 2.3 - approval engine

```
Read WORKLOG.md first, then read sections 4 of docs/spec-workflow.md.

Build: approval.ts implementing BR-W-01..07 (rule selection by value in IQD, sequential stages, creator not approver, delegation, rejection to Draft); wire Submit/Approve/Reject in lifecycle.ts replacing the stub.

Not yet: inbox.

Commit with the message "feat(workflow): approval engine" and append an entry to WORKLOG.md summarizing this step.
```

## 2.4 - tasks inbox W2

```
Read WORKLOG.md first, then read sections 8 (W2) of docs/spec-workflow.md.

Build: My tasks for current role/user including delegated; approve/reject dialog with mandatory comment on rejection.

Not yet: delegations.

Commit with the message "feat(workflow): tasks inbox" and append an entry to WORKLOG.md summarizing this step.
```

## 2.5 - delegations W3

```
Read WORKLOG.md first, then read sections 8 (W3), 4 (BR-W-06) of docs/spec-workflow.md.

Build: List and dialog (period, scope), activate/revoke, effect on the inbox with onBehalfOf.

Not yet: e-sign.

Commit with the message "feat(workflow): delegations" and append an entry to WORKLOG.md summarizing this step.
```

## 2.6 - e-signature simulation W4

```
Read WORKLOG.md first, then read sections 8 (W4), 4 (BR-W-08, BR-W-09) of docs/spec-workflow.md.

Build: Send-for-signature dialog from parties, provider status flow with simulate buttons, creation of signatures and a Signed attachment.

Not yet: KPIs.

Commit with the message "feat(workflow): e-signature simulation" and append an entry to WORKLOG.md summarizing this step.
```

## 2.7 - KPIs + flow test

```
Read WORKLOG.md first, then read sections 6, 9 of docs/spec-workflow.md.

Build: Cards (open tasks, average time, waiting per stage) and a full flow test across 3- and 5-stage contracts including a rejection and a delegation.

Not yet: -.

Commit with the message "feat(workflow): KPIs and flow test" and append an entry to WORKLOG.md summarizing this step.
```
