# Spec — Module 8: settings-access (الإعدادات والصلاحيات)

Derived from plan docs 09 §3–4, 14 ADR-17/18/25, 02 §2.1, 03 §7, 05 §7.

## 1. Scope and relationships
System settings that change mock behaviour, the role × permission matrix, numbering series, approval stage table (from module 2), delegation permissions, and data-authority simulation (organization scope, confidentiality). Settings are read by modules 1–7 from the store defaults created in the foundation; this module provides the screens.

## 2. Data model
**SystemSetting** (key, value, group): 
- Agreements: `EnforcementMode` (None / Warn / Block; default Warn), `FulfillmentBasis` (Order / Delivery / Invoice; default Order), `ReturnsRestoreCommitment` (true), `OnFulfillmentFailure` (Rollback / KeepAndAlert; default Rollback), `Currency.ConversionRateSource` (ActivationRate / DocumentDateRate; default ActivationRate).
- Alerts: `Reminder.Days` ("30,15,7,1"), `Reminder.NoticeDays` ("14,7,1"), `Renewal.GraceDays` (90), `Approval.ReminderDays` (2).
- Approval: `Approval.AllowCreatorApproval` (false).
- Feature flags: `Obligations`, `Templates`, `Service`, `ESignature`, `RecurringBilling` (all on for the demo).
**Permission** (code, group, label) and **RolePermission** (role × permission). **NumberingSeries**: moduleName, subType (contract type code), prefix, nextNumber, size, example. **UserOrganization** (user → organization, dataAuthority: User / Org / System).
Permissions: Contracts.{Create, Edit, Delete, Submit, Approve, Reject, Activate, Suspend, Terminate, Cancel, Amend, Renew, ViewConfidential, Export, Attachments.{View, Upload, Download, Delete}, Fulfillment.Recalculate}, ContractTypes.Manage, Templates.Manage, Clauses.Manage, Obligations.{Manage, Complete, Accept}, ApprovalDelegations.Manage, Reports.

## 3. Status lifecycles
None (configuration entities). Changes are logged in the audit trail of settings.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-X-01 | Changing a setting takes effect immediately on later actions in the mock (not retroactively on recorded ledger entries). |
| BR-X-02 | The role switcher determines visible menus and enabled buttons from RolePermission; the matrix toggles are cosmetic but persisted. |
| BR-X-03 | Data authority: a user with Org scope sees only contracts of their organization; User scope only contracts they created; System scope all; confidential items per BR-C-12. |
| BR-X-04 | Numbering: contract numbers follow `CTR-{type}-{yyyy}-{nnnnnn}`; changing a series never renumbers existing contracts. |
| BR-X-05 | Feature flags off hide the related tabs and menus (obligations, templates, service, e-signature, billing automation). |
| BR-X-06 | Approval stage table edits apply to new submissions only; pending requests keep their snapshot. |
| BR-X-07 | A settings audit row records user, key, old, new, time. |

## 5. Permissions
Settings and matrix: مسؤول نظام only; stage table: مسؤول نظام and مدير عقود (view).

## 6. Module KPIs
Roles count, permissions granted per role (matrix summary), last settings change.

## 7. Integrations (placeholders)
ABP System Settings page, Elsa workflow designer link (button "فتح مصمم سير العمل" disabled/tooltip), Core numbering.

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| X1 | System settings `/settings` | grouped forms with descriptions and the effect of each value, reset to defaults |
| X2 | Permission matrix `/settings/permissions` | roles as columns, permission groups as rows, toggles |
| X3 | Numbering `/settings/numbering` | series list/editor with live example |
| X4 | Approval stages `/settings/approval-stages` | rules table with stage editor |
| X5 | Organizations and data authority `/settings/organizations` | users with scope; "view as" test panel |
| X6 | Settings audit | change log |
| X7 | Demo controls | demo "today" date (`asof`), reset demo data, error-simulation switch |

## 9. Build order
8.1 routes · 8.2 X1 settings + wiring to engines (re-test modules 3 and 2) · 8.3 X2 matrix + role switcher integration · 8.4 X3 numbering · 8.5 X4 stage table · 8.6 X5 data authority · 8.7 X6 audit + X7 demo controls · 8.8 KPIs · 8.9 flow test (flip enforcement/failure/currency settings and replay a simulator case).

## 10. Plan gaps logged
- None beyond defaults already recorded as recommendations in the plan.
