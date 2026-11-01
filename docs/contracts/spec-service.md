# Spec — Module 7: service (عقود الخدمة والصيانة واتفاقيات مستوى الخدمة)

Derived from plan docs 02 §2.10 (FR-SV), 03 §1, 04 §2.17, 14 ADR-21, 01 (SAP service contracts, D365 SLA, Odoo helpdesk SLA).

## 1. Scope and relationships
Service profile contracts: coverage windows and exclusions, covered items by item/serial reference, warranty, included hours/visits, response/resolution targets, contract consumption, SLA violation events. The real system delivers the contract side only (equipment cards, service calls and SLA measurement belong to the Assets/Maintenance modules, not yet built), so the mock includes a small **service-call simulator** purely to demonstrate coverage lookup and consumption. Depends on contracts and obligations (SLA obligations).

## 2. Data model
**ServiceLevel**: contractId, responseHours, resolutionHours, calendarId, includedHours?, includedVisits?, limits, warrantyStart?, warrantyEnd?.
**CoverageWindow**: serviceLevelId, dayOfWeek, fromTime, toTime, isExcluded (holidays/exclusions list with dates).
**CoveredItem**: contractId, itemId?, serial?, assetRef? (soft), description, warrantyStart?, warrantyEnd?.
**ServiceCall** (simulator only): id, customerId, itemId/serial, openedOn, severity, status (Open, Responded, Resolved, Closed), respondedOn, resolvedOn, coveredByContractId?, hoursConsumed, outsideCoverage flag.
**Consumption**: contractId, callId, hours, visits, date.
**SlaEvent**: callId, kind (ResponseMet, ResponseBreached, ResolutionMet, ResolutionBreached), at.

## 3. Status lifecycles
Service contract follows module 1. Service call: Open → Responded → Resolved → Closed. SLA status per call: Within, NearBreach (≥ 80 % of target), Breached.

## 4. Business rules
| ID | Rule |
|---|---|
| BR-S-01 | Coverage lookup: an Active service contract of the customer that covers the item/serial on the call date; none ⇒ "غير مغطّى". |
| BR-S-02 | Outside coverage hours: call is flagged outside coverage (warning, not blocked). |
| BR-S-03 | Response and resolution deadlines = opened time + target hours counted inside coverage windows only, skipping exclusions. |
| BR-S-04 | Consumption deducts included hours/visits; exceeding the limit marks the call as billable and raises an alert. |
| BR-S-05 | Warranty contracts cover items only inside warranty dates. |
| BR-S-06 | SLA breach creates an SlaEvent, an alert to the service owner and counts in the SLA report. |
| BR-S-07 | Service contract terms are frozen like other contracts; changes via amendments. |

## 5. Permissions
Manage service terms (manager), open/close calls in the simulator (any role marked service/maintenance, admin), view SLA (manager, finance, sales). Matrix in module 8.

## 6. Module KPIs
Active service contracts, calls within SLA %, breaches this month, hours consumed vs included, warranties expiring ≤ 60 days.

## 7. Integrations (placeholders)
Assets (equipment cards), Maintenance (service calls, work orders), HR (technicians), Notification — shown as "قريباً" links; the simulator stands in.

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| S1 | Service tab (card) | SLA targets, included quantities, warranty, limits |
| S2 | Coverage editor | weekly windows grid + exclusions list |
| S3 | Covered items | grid with search, bulk add from a customer's items |
| S4 | Service calls simulator `/service/calls` | open call, coverage lookup, respond / resolve, consumption, deadline countdown, SLA status |
| S5 | SLA report `/service/sla` | by contract and customer: met/near/breached, trend chart |
| S6 | Service contracts list `/service` | utilisation of included hours, expiry |

## 9. Build order
7.1 routes + seed (5 service contracts, windows, covered items, 20 calls) · 7.2 S6 list · 7.3 S1 + S2 + S3 · 7.4 coverage/deadline engine (BR-S-01…05) · 7.5 S4 simulator · 7.6 S5 report · 7.7 KPIs · 7.8 flow test.

## 10. Plan gaps logged
- Plan marks end-to-end SLA as blocked until the Assets/Maintenance modules exist; the simulator is a demo aid, flagged as such in the UI.
