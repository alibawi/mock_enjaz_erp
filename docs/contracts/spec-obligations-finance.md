# Spec — Module 5: obligations-finance (الالتزامات والدفعات والملخص المالي)

Derived from plan docs 02 §2.6 and 2.8, 04 §2.15–2.16, 08 §4, 14 ADR-20, 11 §3.

## 1. Scope and relationships
Obligations (deliverables, milestones, penalties, recurrence, dependencies), payment schedule with advance/retention/guarantee metadata, recurring-billing automation (mock creation of sales/purchase documents), and the financial summary (contract value, committed, released, fulfilled, invoiced, paid, outstanding, remaining). No accounting entries. Depends on contracts and agreements.

## 2. Data model
**Obligation**: contractId, kind (Deliverable, Milestone, Payment, Reporting, SLA, Recurring, Other), title, description, dueDate, responsibleEmployeeId, responsibleDepartment, quantity?, value?, status (Planned, InProgress, Completed, Accepted, Rejected, Waived, Overdue), completedOn/By, acceptedOn/By, acceptanceRequired, survivesTermination, penaltyType (None, FixedPerDay, PercentPerDay, Fixed), penaltyRate?, penaltyCap?, recurrenceRule? (daily/weekly/monthly/yearly + count/until), dependsOnObligationId?, linkedPaymentItemId?, attachments.
**ObligationOccurrence**: obligationId, dueDate, status.
**PaymentScheduleItem**: contractId, itemNo, kind (Advance, Milestone, Periodic, Retention, Final), dueDate, percent?, amount, currency, obligationId?, status (Planned, Due, Invoiced, Paid, Cancelled), billingDocType? (PurchaseOrder, PurchaseBill, PurchaseTemplate, SaleOrder, SaleInvoice, SalesTemplate), invoiceDocId?, notes.
**FinancialSummary** (computed): contractValue, plannedValue, committedValue, releasedValue, fulfilledValue, invoicedValue, paidValue, outstanding, remaining, retentionHeld, penaltiesAccrued.
**Guarantee** (metadata): type (Performance, Advance, Retention), amount, issuer, expiryDate, status.
Invoice settlement source: mock invoices of module 3 carry paidAmount.

## 3. Status lifecycles
Obligation: Planned → InProgress → Completed → Accepted | Rejected(→InProgress); Planned/InProgress → Waived; past due ⇒ Overdue (derived from demo date); contract termination ⇒ open obligations Cancelled unless survivesTermination. Payment item: Planned → Due (date) → Invoiced → Paid | Cancelled.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-O-01 | Overdue derives from due date vs demo date for non-final obligations; escalation alerts at due −3d, 0, +1d, +7d. |
| BR-O-02 | Acceptance by a user different from the completer when the obligation requires acceptance. |
| BR-O-03 | Recurring obligations generate occurrences (unique per date), idempotent when the date advances. |
| BR-O-04 | Dependencies must be acyclic; an obligation cannot start before its dependency is Completed. |
| BR-O-05 | Penalty = display-only calculation: FixedPerDay × days late, PercentPerDay × value × days, Fixed; capped by penaltyCap. No postings. |
| BR-O-06 | Payment schedule total of percents ≤ 100 % and amounts ≤ contract value unless flagged; invoiced items freeze when an amendment re-plans the rest. |
| BR-O-07 | Billing automation (mock): when an item is Due, "Create billing document" creates a mock document of `billingDocType` (order / bill / invoice / template) linked to the contract through the agreements simulator; Contracts never post. Templates create a recurring-template record instead of a document. |
| BR-O-08 | Financial summary rules: invoiced from the ledger (module 3); paid = sum of paid amounts of linked invoices; outstanding = invoiced − paid (credits already netted); remaining = committed − basis counter; unavailable settlement shows "غير متاح" rather than stale numbers. |
| BR-O-09 | Guarantee expiry alerts at 30 and 7 days. |
| BR-O-10 | Retention % held from paid amount shown as retentionHeld; display only. |

## 5. Permissions
Manage obligations (manager, requester in Draft), complete (responsible employee), accept (manager/legal), manage payment schedule (manager/finance), create billing documents (finance/manager). Matrix in module 8.

## 6. Module KPIs
Open vs overdue obligations, upcoming milestones (30 d), billing due (7 d), invoiced vs paid vs outstanding, penalties accrued.

## 7. Integrations (placeholders)
Sales/Procurement document creation (mock), Finance payments (paid amounts seed), recurring templates (mock).

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| O1 | Obligations tab (card) | grid + status filters, quick complete/accept |
| O2 | Obligation dialog | all fields, recurrence, dependency picker, penalty, attachments |
| O3 | Obligations board `/obligations` | cross-contract list/kanban by status, overdue highlight |
| O4 | Payment schedule tab | grid, totals check, billing-document button |
| O5 | Payment item dialog | amounts, percent, link to obligation, billing doc type |
| O6 | Financial tab | cards (value, committed, released, fulfilled, invoiced, paid, outstanding, remaining), table by currency, guarantee panel |
| O7 | Billing log | documents created from schedule items with status |

## 9. Build order
5.1 routes + seed (25 obligations, occurrences, 20 payment items, guarantees) · 5.2 O1 + O2 · 5.3 obligation engine (BR-O-01…05) · 5.4 O3 board · 5.5 O4 + O5 + billing automation (BR-O-06/07) · 5.6 O6 financial summary + O7 · 5.7 KPIs · 5.8 flow test (complete → accept; overdue by advancing the demo date; create invoice from a due item).

## 10. Plan gaps logged
- Which sale billing document the real recurrence creates is the Sales owner's decision (plan Q-19); the mock lets each item choose among the six types.
