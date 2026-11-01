# Spec — Module 1: contracts (العقود)

Derived from plan docs 02 §2.1–2.2, 2.5, 2.7, 03, 04 §2.1–2.9, 11 §3. Nothing here is invented; gaps are listed in §10.

## 1. Scope and relationships
Contract master data, contract types, parties, status lifecycle with history, attachments (mock), signature records, linked documents, renewal fields and alerts. Depends on foundation. Feeds: workflow (approval), agreements (lines), amendments (versions), obligations-finance, templates-print, service, analytics.

## 2. Data model
**ContractType**: code, name (ar), category (Sales, Procurement, Service, Legal, Lease, Project, Other), profile (General / Agreement / Service), defaultDirection, requiresSignature, requiredSignatureRoles[], requiresApproval, renewalPolicyDefault, defaultDurationMonths?, noticePeriodDaysDefault?, renewalGraceDays?, reminderDaysDefault?, enforcementMode? / fulfillmentBasis? / returnsRestoreCommitment? (nullable overrides of system settings), isOpenEnded, requiresContractValue, requiresPaymentTerm, defaultConfidentiality, isActive.
**Contract**: id, contractNumber (unique), title, typeId, profile, direction (Outgoing / Incoming / Internal), status, versionNo, counterpartyId (partner) or counterpartyName, ownerUserId, responsibleEmployeeId?, organizationId, projectId?, costCenterId?, currency, exchangeRate? (snapshot at activation), contractValue?, paymentTermId?, deliveryTerms?, startDate, endDate?, signatureDate?, effectiveDate?, terminationDate?, renewalPolicy (None/Manual/Auto), noticePeriodDays?, autoRenewTermMonths?, reminderDaysOverride?, noticeDeadline (computed), confidentiality (Normal/Confidential/Restricted), language, externalReference?, parentContractId?, renewedFromContractId?, sourceDoc?, agreementMode? (Specific/General), overridesPrices, closureReason?, activatedOn/By, description, internalNotes, createdBy/On.
**ContractParty**: contractId, role (Counterparty, Guarantor, Witness, Subcontractor, Beneficiary, Other), partnerId?, name, contactName, email, phone, signatoryTitle, isPrimary.
**ContractSignature**: contractId, partyId?, role, signerName, signerTitle, signedOn, method (Wet / Uploaded / ExternalProvider), attachmentId?, externalSignatureId?.
**Attachment (mock)**: id, ownerType, ownerId, subType (Draft/Signed/Appendix/Other), fileName, size, contentType, uploadedBy/On, version.
**StatusHistory**: contractId, from, to, by, on, reason, relatedApprovalId?, relatedAmendmentId?.
**DocumentLink**: contractId, linkType (Source, Release, Fulfillment, Invoice, Related), docType, docId, docRef, docDate.
**Alert**: contractId, ruleCode, dueDate, recipientRole, message, severity, seenAt?.
Partners, users, employees, organizations, cost centers, projects, payment terms, currencies come from the shared seed.

## 3. Status lifecycle
Draft → PendingApproval → Approved → (PendingSignature) → Active ⇄ OnHold; Active/OnHold → Expired (date); Active/OnHold/Expired → Terminated; Draft → Cancelled; Approved/PendingSignature → Draft (reopen); PendingApproval → Draft (reject); Active/Expired → Closed (completed / renewed); Expired → Active (extension amendment, within grace). Terminal: Terminated, Cancelled, Closed. (Plan doc 03 transition table T1–T15.)

## 4. Business rules
| ID | Rule |
|---|---|
| BR-C-01 | Contract number unique; generated from a numbering series; manual number only if the type allows. |
| BR-C-02 | Submit requires: title, type, direction, owner, organization, start date; end date unless open-ended; counterparty and currency/value per type flags; ≥1 line for Agreement profile. |
| BR-C-03 | Counterparty partner type must match direction (Outgoing → Customer, Incoming → Vendor). |
| BR-C-04 | `startDate ≤ endDate`; `noticePeriodDays ≤ duration`; `noticeDeadline = endDate − noticePeriodDays`. |
| BR-C-05 | After Submit, legally significant fields are locked (dates, value, counterparty, lines, terms); only metadata (owner, responsible, notes, reminders, attachments) stays editable; legal changes need an amendment (module 4). |
| BR-C-06 | Activation requires approval done and, if `requiresSignature`, all required signature roles recorded and ≥1 Signed attachment; effective date ≤ demo "today" else it stays Approved/PendingSignature. |
| BR-C-07 | Activation snapshots exchangeRate and writes version 1 (module 4 shows it). |
| BR-C-08 | Suspend/Resume need a reason; OnHold blocks new document links; resuming past end date goes to Expired. |
| BR-C-09 | Terminate needs reason and termination date ≥ start; open obligations cancelled except "survives termination". |
| BR-C-10 | Cancel only from Draft. Delete only Draft without links or history beyond creation. |
| BR-C-11 | Expiry is evaluated against the demo date (`asof`): Active/OnHold with endDate < today become Expired when the date is advanced. |
| BR-C-12 | Confidential/Restricted contracts are hidden from roles without `ViewConfidential` (list, search, counts). |
| BR-C-13 | Every action appends a StatusHistory/audit row with user and time. |
| BR-C-14 | Alerts: expiry at the days configured (default 30/15/7/1), notice deadline (14/7/1), approval pending, signature missing; one alert per (contract, rule, due date, recipient). |
| BR-C-15 | Parent/renewed-from links must not form cycles. |

## 5. Permissions (role × action)
Roles: منشئ عقد (requester), معتمد (approver), مدير عقود (manager), قانوني (legal), مبيعات (sales), مشتريات (procurement), مالية (finance), مسؤول نظام (admin). Actions: view, create, edit draft, submit, activate (+send for signature), suspend/resume, terminate/close, cancel, renew, view confidential, export, attachments (view/upload/download/delete). Matrix lives in `permissions.ts` and is shown in module 8; defaults per plan doc 03 §7.

## 6. Module KPIs
Active contracts (count / value per currency), expiring ≤ 30 days, expired awaiting renewal, awaiting approval, awaiting signature, contracts by status (donut), contracts by type (bars).

## 7. Integrations (placeholders)
DMS (attachments: mock upload), Notification (alerts center), Core (partners, numbering), HR (responsible employee), Project / cost centers (lookups). All simulated.

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| C1 | Contracts list `/contracts` | status tabs with counts, filters (type, direction, profile, org, owner, partner, dates, "expiring in N days", pending amendment), search, saved column set, export button (permission) |
| C2 | Contract card `/contracts/:id` | header strip (number, title, status chip, version, owner, key dates, data-driven action bar from allowed actions); tabs: General, Parties, Lines (agreements), Terms (templates-print), Attachments, Signatures, Approvals (workflow), Amendments and Versions (amendments), Fulfillment (agreements), Linked documents, Obligations and Financial (obligations-finance), Service (service), Timeline and audit |
| C3 | Create/Edit wizard `/contracts/new`, `/contracts/:id/edit` | 6 steps: type and direction → parties/dates/value/terms → lines → renewal and reminders → attachments → review and save as Draft / Submit; validation from §4 |
| C4 | Contract types `/contract-types` | list + dialog with all flags |
| C5 | Alerts center `/alerts` | list by rule with mark-as-read, link to contract |
| C6 | Transition dialogs | reason/date capture for suspend, resume, terminate, cancel, reopen, close |
| C7 | Linked-documents picker | mock documents of other modules (for General contracts) |
| C8 | Module landing | `ModuleScreensGrid` card grid |

## 9. Build order
1.1 scaffold routes + sidebar · 1.2 seed (types, 30 contracts, parties, history, alerts) + API · 1.3 C1 list · 1.4 C2 card General/Parties/Attachments/Signatures/Timeline · 1.5 state machine + rules (lifecycle.ts) · 1.6 C3 wizard + C6 dialogs + C4 types · 1.7 C5 alerts + renewal fields + C7 · 1.8 KPIs landing · 1.9 flow test.

## 10. Plan gaps logged
- Which department model to use (plan Q-08): mock stores cost center / project only.
- Named e-signature provider: simulated "مزوّد تجريبي".
