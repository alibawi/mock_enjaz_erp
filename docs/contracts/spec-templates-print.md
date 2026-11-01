# Spec — Module 6: templates-print (القوالب والبنود والطباعة)

Derived from plan docs 02 §2.3–2.5 (FR-TP, FR-CA-01/02, FR-DS-03), 04 §2.10 and 2.17, 14 A-08 (design templates).

## 1. Scope and relationships
Versioned contract templates, clause library with versions, contract terms (frozen copies), creating a contract from a template, and the printable contract (A4 Arabic) from a design template. Depends on contracts and amendments.

## 2. Data model
**ContractTemplate**: code, name, typeId, currentVersionNo, isActive. **TemplateVersion** (immutable): versionNo, defaults {durationMonths, renewalPolicy, noticePeriodDays, paymentTermId, deliveryTerms, approvalWorkflowLabel, billingDefaults, slaDefaults}, clauseRefs[] (clauseVersionId, order, isOptional), attachments[] (names), publishedOn/By.
**Clause**: code, title, category (عام، مالي، قانوني، سرية، إنهاء…). **ClauseVersion**: versionNo, body (Arabic text with `{{placeholders}}` such as {{counterparty}}, {{startDate}}, {{value}}), publishedOn.
**ContractTerm**: contractId, order, section, title, body (frozen), clauseVersionId?, isOptional, isIncluded.
**DesignTemplate** (mock): code "CONTRACT_AR_A4", name, layout options {header, footer, signature block, watermark Draft}.

## 3. Status lifecycles
Template: Draft → Published (creates new version) → Archived. Clause: versions published; older versions stay readable. Contract term: included/excluded while the contract is Draft; frozen afterwards (changes via amendment).

## 4. Business rules
| ID | Rule |
|---|---|
| BR-T-01 | Publishing a template creates version n+1; version n never changes. |
| BR-T-02 | Creating a contract from a template copies defaults and terms and stores `templateVersionId`; there is no live link, so later template edits never change existing contracts. |
| BR-T-03 | Archived templates cannot be selected but stay visible on contracts that used them. |
| BR-T-04 | Clause text is copied into the contract term at selection time (frozen); placeholders are resolved at print time from the contract. |
| BR-T-05 | Optional clauses can be toggled only while the contract is Draft. |
| BR-T-06 | Print preview shows the current version text; a printed Draft shows a "مسودة" watermark; print count is logged. |
| BR-T-07 | Terms are part of the version payload (module 4). |

## 5. Permissions
Manage templates and clauses (manager, legal), use templates (requester, manager), print (all with contract access), export (permission). Matrix in module 8.

## 6. Module KPIs
Templates by usage, clauses by usage, contracts created from templates this quarter.

## 7. Integrations (placeholders)
Core DesignTemplate designer (mock layout options), DMS (printed PDF saved as attachment, mock).

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| T1 | Templates list `/templates` | with version, usage count, status |
| T2 | Template editor | defaults, clause picker with reorder, optional flags, publish |
| T3 | Template versions | history with read-only view |
| T4 | Clause library `/clauses` | list, editor with placeholders, versions |
| T5 | Terms tab (card) | clause list with include toggles, free-text clause, reorder (Draft) |
| T6 | New contract from template | picker in the wizard step 1 |
| T7 | Print preview `/contracts/:id/print` | A4 Arabic page: header, parties, terms with resolved placeholders, lines table for agreements, signature block, print button (browser print), watermark |

## 9. Build order
6.1 routes + seed (8 templates, 25 clauses with versions) · 6.2 T1 + T3 · 6.3 T2 + publish engine · 6.4 T4 · 6.5 T5 + T6 wiring · 6.6 T7 print preview · 6.7 KPIs · 6.8 flow test (publish v2 → existing contract unchanged → new contract from v2 → print).

## 10. Plan gaps logged
- The real print engine is the Core design-template renderer; the mock approximates it with a CSS print page.
