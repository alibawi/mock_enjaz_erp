# Spec — Module 4: amendments (الملاحق والنسخ والتجديد)

Derived from plan docs 02 §2.4 and 2.7, 03 §3–5, 04 §2.11–2.12, FR-CA-03…06, FR-RN-04…06, FR-RN-04a.

## 1. Scope and relationships
Effective-dated amendments of active contracts, write-once version snapshots with hash, version comparison, renewal by successor contract and auto-renewal. Depends on contracts, workflow (amendment approval) and agreements (lines and counters). Used by templates-print (terms in versions).

## 2. Data model
**ContractAmendment**: id, contractId, amendmentNo, type (ExtendTerm, ChangeValue, ChangeLines, ChangeParties, ChangeTerms, Other), status (Draft, PendingApproval, Approved, Applied, Rejected, Cancelled), reason, effectiveDate, baseVersionNo, changeSet[] ({path, oldValue, newValue} for header; line operations Add / Change / Close with lineNum), approvalRequestId?, appliedVersionNo?, appliedOn/By.
**ContractVersion**: contractId, versionNo, reason (Activation / Amendment / Renewal), amendmentId?, payload (frozen JSON: header, parties, lines, terms, signatures), payloadHash (display, short), createdOn/By. Write-once.
**RenewalInfo** (on contract): renewalPolicy, noticePeriodDays, autoRenewTermMonths, renewedFromContractId, successorContractId.

## 3. Status lifecycle
Amendment: Draft → PendingApproval → Approved → Applied; Draft/PendingApproval/Approved → Cancelled; PendingApproval → Rejected. At most one open (non-final) amendment per contract. Contract: Active/OnHold/Expired(grace) may be amended; Expired → Active on applied ExtendTerm within grace.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-M-01 | One open amendment per contract; base version must equal current version at apply time, else "amendment is stale". |
| BR-M-02 | Applying an amendment writes a new immutable ContractVersion (state before change preserved), bumps `versionNo`, appends history, and never edits earlier versions. |
| BR-M-03 | A line's commitment can never be reduced below its released/fulfilled/invoiced counters; closed lines stay; new lines get new lineNums (never reused). |
| BR-M-04 | Price/discount changes affect documents created at or after the effective date only; existing documents and ledger are untouched. |
| BR-M-05 | Amendments are approved by the workflow (subject type Amendment); creator ≠ approver. |
| BR-M-06 | Version compare shows field-level differences between any two versions (header, lines, terms, parties). |
| BR-M-07 | Manual renewal creates a successor Draft copying lines (counters reset, lines renumbered from 1) with `renewedFromContractId`; the predecessor closes with reason Renewed when the successor activates; one successor per contract. |
| BR-M-08 | Auto-renewal (policy Auto, no termination notice by the notice deadline) creates the successor as Draft (or activates it when the type allows) exactly once, evaluated when the demo date advances. |
| BR-M-09 | An expired contract can be renewed within `renewalGraceDays` (default 90) by extension amendment or successor; afterwards only by successor. |
| BR-M-10 | Version payload hash is shown and recomputed on view; a mismatch is flagged (demo tamper test button available to admin). |

## 5. Permissions
Amend (manager), renew (manager), view versions (all with contract access), approve amendments (approvers by stage), tamper test (admin). Matrix in module 8.

## 6. Module KPIs
Amendments by status, average time to approve, contracts with pending amendment, renewals due (≤ 60 days), auto-renewals created.

## 7. Integrations (placeholders)
Workflow (module 2), agreements counters (module 3), notifications (renewal reminders).

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| M1 | Amendments tab (card) | list with status, type, effective date, applied version; open amendment banner |
| M2 | Amendment editor `/contracts/:id/amend` | type, reason, effective date, change editor (header fields and lines in diff mode showing old → new), warnings for counters, submit for approval |
| M3 | Amendment detail | change set, approval stages (reuses `StageTimeline`), apply button after approval |
| M4 | Versions tab | list with version number, reason, hash, date, user |
| M5 | Version compare `/contracts/:id/versions/compare?from=&to=` | two-column diff, grouped by header / lines / terms / parties |
| M6 | Renewal dialog | manual successor with preview; link to successor and predecessor |
| M7 | Renewals due list `/renewals` | contracts approaching expiry or notice deadline, auto-renewal indicator |

## 9. Build order
4.1 routes + seed (versions for active contracts, 6 amendments in various states) · 4.2 M4 versions tab · 4.3 M1 + M2 editor + diff · 4.4 amendment engine (rules BR-M-01…06) · 4.5 M3 + approval wiring · 4.6 M5 compare · 4.7 M6 renewal + BR-M-07…09 + M7 · 4.8 KPIs · 4.9 flow test (amend value and quantity → approve → apply → compare v1/v2; try cutting below fulfilled; renew expired).

## 10. Plan gaps logged
- Hash algorithm is shown as a short hex string (display only, not cryptographic).
