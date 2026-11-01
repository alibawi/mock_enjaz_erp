# Spec — Module 9: analytics (لوحة المؤشرات والتقارير)

Derived from plan docs 11 §4–5 (reports R-01…R-17, dashboard), 02 §2.11, 09 §4.

## 1. Scope and relationships
Executive dashboard, the report set, global search and the unified alerts view. Reads every other module; adds no data. Last in the build order.

## 2. Data model
Computed views only: `ContractSummaryRow`, `FulfillmentRow`, `ObligationRow`, `ExposureRow`, `SlaRow`, `AmendmentRow` derived from the store. A saved-filter record (name, report, filters) per user.

## 3. Status lifecycles
None.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-R-01 | Every report applies the same data authority and confidentiality filters as lists (aggregates are filtered before totals, never after). |
| BR-R-02 | Values are shown per currency; no cross-currency totals unless the user picks a reporting currency and the report states the rate used. |
| BR-R-03 | Dates are evaluated against the demo date. |
| BR-R-04 | Exports (Excel/CSV mock) require the Export permission. |
| BR-R-05 | Drift report must show zero drift unless the simulator injected a missing event. |
| BR-R-06 | Global search matches contract number/title, partner, document references and clause titles, respecting confidentiality. |

## 5. Permissions
Reports (manager, finance, legal, sales, procurement, admin); export (permission); view confidential figures requires ViewConfidential. Matrix in module 8.

## 6. KPIs (dashboard)
Active count/value per currency, expiring 30 d, awaiting approval, awaiting signature, overdue obligations, commitment utilisation top 10, fulfillment drift alerts, SLA within-target %, billing due 7 d.

## 7. Integrations (placeholders)
Excel export (mock download of a CSV), print.

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| R0 | Executive dashboard `/` | cards, status donut, type bars, expiring list, utilisation bars, alerts feed |
| R1 | Contracts by status (R-01), by type (R-02), active (R-03), expiring/notice (R-04), expired (R-05), awaiting approval (R-06), awaiting signature (R-07), requiring renewal (R-08) | filter bar + grid + export |
| R2 | Value by partner (R-11), by organization (R-12) | grouped grids/bars |
| R3 | Commitment fulfillment (R-09), remaining commitments (R-10) | filters partner/item/organization/contract/direction |
| R4 | Amendment history (R-13), obligations and overdue milestones (R-14), financial exposure (R-15), SLA performance (R-16), fulfillment drift (R-17) | |
| R5 | Global search results | grouped by entity |
| R6 | Alerts feed `/alerts` | shared with module 1 C5, unified here |

## 9. Build order
9.1 routes + sidebar report list · 9.2 report grid component + R-01…R-08 · 9.3 R-09…R-12 · 9.4 R-13…R-17 · 9.5 R0 dashboard · 9.6 global search · 9.7 export mock · 9.8 data-authority checks · 9.9 final flow test.

## 10. Plan gaps logged
- Charts are plain SVG/CSS (no chart library) by the brief.
