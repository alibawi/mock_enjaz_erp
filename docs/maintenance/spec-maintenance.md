# Spec — Maintenance Management (module 3)

Derived strictly from the approved plan (`source/maintenance-management-implementation-plan.md`, sections cited as §n). Anything the plan does not settle is marked **[mock]**: a demo assumption from `project-brief.md` §4, to change if the owner says so.

## 1. Scope and relationships
- **In:** master data and settings (§12, §33), asset registry with vehicle extension and meters (§12, HTML §5), maintenance request and intake receipt (§20), estimate with internal approval and customer acceptance (§20.1), work order with operations, parts, labor, reservation and automatic issue (§20, §21, §33 items 1e/1f/1g/5), removed parts and rework (§33 item 13), service invoice and deposit (§21.5, §33 item 8), technician and workshop scheduling (§38), working hours (§36.15), reports (§28, §38.6), permissions and audit.
- **Out ("قريباً"):** preventive maintenance (P10), contract coverage (§33 item 11), drag-and-drop board (SC8), skills (SC4), warranty claims to vendors, mobile.
- **Simulated integrations** (results generated inside the module, shown as real-looking documents): Inventory (stock, reservation, Goods Issue `GI-`), Sales (service invoice `INV-`, cancellation), Finance (on-account receipt `RC-`, application, journal entries), HR (attendance hours, approved leave), Scheduling (bookings `SCH-`), Elsa (approval tasks), Fixed Assets (`FA-` reference only), Contracts (`CTR-` reference only). No import from the other mock modules.

## 2. Data model
Ids are strings; money in IQD (integer); dates ISO; every entity has `createdAt/createdBy`.

**Master data**
| Entity | Fields |
|---|---|
| MaintenanceType | id, code, name, kind (`workshop`/`field`/`internal`), defaultExpenseTypeId?, active |
| AssetCategory | id, code, name, isVehicle, attributeTemplate: `{key,label,unit?}[]` |
| FailureCode | id, code, name, categoryId? |
| StandardOperation | id, code, name, serviceItemId, standardHours |
| Workshop | id, name, warehouseId; `bays: {id,code,name}[]` |
| ExpenseType | id, code, name, accountCode, accountName, scope (`customer`/`warranty`/`internal`/`goodwill`) |
| Technician | id, employeeNo, name, title (`technician`/`seniorTechnician`), standardRate, phone, area, active |
| Partner | id, name, kind (`customer`/`internal`), phone, area, address, accountCode |
| Item | id, code, name, kind (`part`/`service`), uom, price, cost, revenueAccount, tracked (`none`/`batch`/`serial`) |
| Stock | itemId, warehouseId, onHand, reserved |
| Settings | consumptionMode (`automatic`/`manual`), overIssueMode (`block`/`allowCompleteAndRetry`), internalPartnerId, approvalMode (`elsa`/`directTask`/`disabled`), approvalBands `{upTo, roles[]}[]`, reworkWindowDays (30), estimateValidityDays (15), depositDefaultPercent |

**Assets**
| Entity | Fields |
|---|---|
| Asset | id, code, name, categoryId, ownerKind (`customer`/`company`), ownerPartnerId, serial?, model, brand, location, parentAssetId?, warrantyStart?, warrantyEnd?, state (`active`/`loaned`/`retired`), attributes `{key:value}`, fixedAssetRef?, contractRef?, costCenter? |
| VehicleDetails | assetId, plate, vin, make, model, year, engineNo, fuel, transmission, color |
| MeterReading | id, assetId, value, unit (`km`/`hours`), at, source (`intake`/`handover`/`manual`), docRef? |

**Documents**
| Entity | Fields |
|---|---|
| Request (`MRQ`) | id, number, assetId, partnerId, receivedAt, receivedBy, complaint, meterAtIntake?, accessories, status, estimateId?, workOrderId? |
| Estimate (`MES`) | id, number, requestId, assetId, partnerId, version, status, validUntil, lines[], totals, submittedBy?, approvalRequestIds[], customerAcceptance? `{decision, channel, by, at, note}` |
| EstimateLine | id, kind (`part`/`labor`/`service`), itemId, qty, price, discountPct, coverage (`paid`/`warranty`/`goodwill`), total |
| ApprovalRequest | id, estimateId, round, version, level, status (`pending`/`approved`/`rejected`/`withdrawn`/`notRequired`), assignedRoles[], decidedBy?, decidedAt?, comment?, reason? |
| WorkOrder (`MWO`) | id, number, requestId?, estimateId?, assetId, partnerId (owner), billingPartnerId, maintenanceTypeId, expenseTypeId?, status, plannedStart?, plannedEnd?, actualStart?, actualEnd?, leadTechnicianId?, bookingIds[], failureCodeId?, repairReason?, meterAtHandover?, reworkOfId?, consumptionStatus (`notRequired`/`pending`/`posted`/`failed`), consumptionError?, billingStatus (`notInvoiced`/`invoiced`/`invoiceCancelled`/`notBillable`), depositRequired?, operations[], parts[], timeEntries[], removedParts[], statusHistory[] |
| WorkOrderOperation | id, operationId, description, plannedHours, done, doneByBookingId? |
| WorkOrderPart | id, itemId, plannedQty, reservedQty, consumedQty, issuedQty, unitCost?, coverage, expenseTypeId?, price |
| TimeEntry | id, technicianId, date, hours, category (`regular`/`overtime`), operationId?, confirmedBy? |
| RemovedPart | id, description, serial?, disposition (`returnedToCustomer`/`scrapped`/`returnedToVendor`) |
| StatusChange | from, to, at, by, reason? |
| Booking (`SCH`) | id, number, kind (`workshop`/`field`), date, start, end, slotId?, technicianIds[], bayId?, vehicle?, stops: `{workOrderId, order}[]`, status (`scheduled`/`rescheduled`/`inProgress`/`completed`/`cancelled`), rescheduleReason?, cancelReason?, actualStart?, actualEnd? |
| Leave | id, technicianId, from, to, source (`hr`/`manual`), note |
| AttendanceDay | technicianId, date, hours (HR simulation) |

**Simulated external documents**
| Entity | Fields |
|---|---|
| GoodsIssue (`GI`) | id, number, workOrderId, date, idempotencyKey, lines `{itemId, qty, unitCost, expenseAccount}`, canceled, journal |
| ServiceInvoice (`INV`) | id, number, workOrderId, batchNo, date, lines `{itemId, qty, price, revenueAccount}`, total, paidAmount, paymentStatus (`O`/`P`/`C`), canceled, journal |
| Receipt (`RC`) | id, number, partnerId, workOrderId?, date, amount, onAccount, applied, journal |
| Application | id, receiptId, invoiceId, amount, reversed |
| JournalEntry | lines `{account, debit, credit}` (display only) |
| AuditEntry | id, at, user, role, entity, entityId, action, detail |
| Task | id, kind (`estimateApproval`), refId, assignedRoles[], status, createdAt |

## 3. Status lifecycles
- **Request:** Draft → Received → InDiagnosis → AwaitingApproval → Approved → Closed (WO created) | Rejected | Cancelled (§20).
- **Estimate (§20.1.3):** Draft → PendingApproval → Approved | Rejected; Draft → Approved (approval not required, `notRequired` row); PendingApproval → Draft (withdraw); Approved/Rejected → Revise → new version Draft (old Approved → Superseded); → Expired (validity passed without customer acceptance); → Cancelled. Customer acceptance is a separate record on the Approved version.
- **Work order (§20):** Created → Planned → Scheduled → InProgress ⇄ WaitingParts / WaitingCustomer / OnHold → QualityCheck → Completed → Closed; Created/Planned/Scheduled/InProgress → Cancelled; Closed → InProgress (reopen, permission + reason).
- **Consumption (§21.4):** NotRequired | Pending → Posted | Failed → (retry) Posted.
- **Billing (§21.5.1):** NotInvoiced → Invoiced → InvoiceCancelled → (reopen billing) NotInvoiced; NotBillable.
- **Booking (§38):** Scheduled ⇄ Rescheduled → InProgress → Completed; → Cancelled.
- **Invoice payment status:** O → P → C (and back on reversal).

## 4. Business rules
| ID | Rule | Source |
|---|---|---|
| BR-M-01 | Asset serial is unique per organization; an asset may have no serial | §12, HTML §5 |
| BR-M-02 | Billing partner defaults to the asset owner; changing it needs `WorkOrders.ChangeBillingPartner` | §33 item 4 |
| BR-M-03 | Estimate needs approval if any: total > band threshold, any line discount > limit, any goodwill line or warranty override on expired warranty, internal cost > limit; otherwise auto-approved with a `notRequired` row | §20.1.4 rule 1 |
| BR-M-04 | Approval levels follow `approvalBands` (default: ≤1,000,000 auto; ≤5,000,000 workshop manager; above: workshop manager then finance manager) [mock] | §20.1.4 rule 2 |
| BR-M-05 | The submitter can never approve their own estimate | rule 3 |
| BR-M-06 | Customer acceptance is recorded only on an Approved version (decision, channel, by, at) | rule 4 |
| BR-M-07 | Validity date passed without acceptance (or warranty expired while pending) → Expired; a new version + approval is required | rule 5 |
| BR-M-08 | Withdraw while PendingApproval needs `Estimates.Withdraw`; open tasks are cancelled; rejection and withdrawal need a reason (mandatory) | rule 6, §28.8 |
| BR-M-09 | Approval mode `disabled` → every estimate auto-approved; `directTask` shown like Elsa in the mock | rule 8 |
| BR-M-10 | A WO can start only if its estimate is approved (or approval not required) and a technician is assigned | §20 |
| BR-M-11 | Starting a WO reserves planned parts; refused if any part is short | §33 item 5 |
| BR-M-12 | Completing a WO requires: failure code + repair reason (corrective types), all mandatory operations done, consumed qty ≤ available (`block`) | §33 1f, §28.8 |
| BR-M-13 | On completion with `automatic` mode a Goods Issue is created for consumed qty; unconsumed reservation is released; failure sets `consumptionStatus = failed` with a reason and a Retry action | §33 1e/1g, §21.4 |
| BR-M-14 | Issue line expense account = line expense type, else WO expense type, else COGS; partner = billing partner, else the internal partner | §33 1c/1d |
| BR-M-15 | Retry looks up an existing issue with the same idempotency key `WO:{id}:C{seq}` before creating one | §21.7 |
| BR-M-16 | Invoice is created posted and locked; only lines with billable coverage; revenue account from the item card, else default | §21.5 |
| BR-M-17 | An invoice with any paid amount cannot be cancelled; cancel → `InvoiceCancelled`; `ReopenBilling` → editable billing, next batch number | §21.5.1 |
| BR-M-18 | Deposit = on-account receipt linked to the WO; applied to the invoice when it is created; reversing the application returns it to on-account | §33 item 8 |
| BR-M-19 | A WO can be Closed only with consumption Posted/NotRequired and billing Invoiced/NotBillable | §20, §21.4 |
| BR-M-20 | A repeat fault on the same asset within `reworkWindowDays` creates a rework WO linked to the original with goodwill coverage (not billed) | §33 item 13 |
| BR-M-21 | Every removed part records a disposition | §33 item 13 |
| BR-M-22 | Booking: a technician or bay cannot be in two overlapping bookings; no booking on a leave day; field bookings respect slot capacity | §38.1, §38.5 |
| BR-M-23 | Booking created → WO Scheduled; booking started → WO InProgress; booking completed → finished operations marked, WO stays InProgress; booking cancelled → WO Planned | §38.4 |
| BR-M-24 | A field booking carries only WOs; a workshop booking has one WO and one bay | §38.2 |
| BR-M-25 | Time entries editable until the WO is Closed; supervisor confirms at completion | §36.15 |
| BR-M-26 | Labor cost = hours × technician standard rate; report-only, no journal | §33 item 7 |
| BR-M-27 | Every state change appends an audit entry (who, role, when, what) | playbook §5 |

## 5. Permissions (role × action)
Roles: SA service advisor, TEC technician, WM workshop manager, DSP dispatcher, WH warehouse keeper, ACC accountant, FM finance manager, ADM admin.

| Action | SA | TEC | WM | DSP | WH | ACC | FM | ADM |
|---|---|---|---|---|---|---|---|---|
| Master data / settings | | | ✓ | | | | | ✓ |
| Assets create/edit | ✓ | | ✓ | | | | | ✓ |
| Request create | ✓ | | ✓ | | | | | ✓ |
| Estimate create/submit | ✓ | ✓ | ✓ | | | | | ✓ |
| Estimate approve (by band) | | | ✓ | | | | ✓ | ✓ |
| Estimate withdraw | ✓ | ✓ | ✓ | | | | | ✓ |
| Customer acceptance | ✓ | | ✓ | | | | | ✓ |
| WO create / assign | ✓ | | ✓ | | | | | ✓ |
| WO start / complete / log time | | ✓ | ✓ | | | | | ✓ |
| Confirm time entries | | | ✓ | | | | | ✓ |
| Retry / manual consumption posting | | | ✓ | | ✓ | | | ✓ |
| Booking create / move / cancel | ✓ | | ✓ | ✓ | | | | ✓ |
| Generate invoice / receive deposit | ✓ | | | | | ✓ | | ✓ |
| Cancel invoice (simulated Sales) / reopen billing | | | | | | ✓ | ✓ | ✓ |
| Reopen WO / change billing partner / override expense type | | | ✓ | | | | | ✓ |
| Reports | | | ✓ | ✓ | | ✓ | ✓ | ✓ |

## 6. Module dashboard KPIs
Open WOs by status; overdue WOs; WOs completed not invoiced; failed consumption postings; WOs waiting to be scheduled; technician utilization this week; first-time-fix %; month revenue and margin; unapplied deposits; estimates pending approval (and average approval time).

## 7. Integrations (placeholders)
Each simulated external document shows a small "مُحاكى — في النظام الحقيقي: <module>" tag and a realistic number. Fixed asset and contract links are reference numbers with a "قريباً" tooltip. HR attendance and leave appear as an "مستورد من الموارد البشرية" list.

## 8. Complete screen list
| ID | Screen | Route | Notes |
|---|---|---|---|
| S0 | Module hub (screens grid) + dashboard KPIs | `/` | §6 |
| S1 | Master data (tabs: types, categories+templates, failure codes, operations, workshop+bays, expense types, technicians) | `/master-data` | list + modal edit per tab |
| S2 | Settings | `/settings` | §2 Settings |
| S3 | Assets list | `/assets` | filters: category, owner kind, warranty, state |
| S4 | Asset card | `/assets/:id` | tabs: data, vehicle, meters, history (requests, WOs, cost), audit |
| S5 | Asset form | `/assets/new`, `/assets/:id/edit` | template attributes, vehicle fields |
| S6 | Requests list | `/requests` | |
| S7 | Request card + intake form | `/requests/:id`, `/requests/new` | receipt print |
| S8 | Estimates list | `/estimates` | tabs by status |
| S9 | Estimate card | `/estimates/:id` | lines editor, totals, approval timeline, versions, customer acceptance, print |
| S10 | My approval tasks | `/tasks` | per role; approve/reject with reason |
| S11 | Work orders list | `/work-orders` | tabs by status, overdue, waiting to schedule |
| S12 | Work order card | `/work-orders/:id` | tabs: summary, operations, parts (planned/reserved/consumed/issued), time, schedule, billing, removed parts, history/audit; actions by status; job card print |
| S13 | Work order form | `/work-orders/new` | from estimate or direct (internal) |
| S14 | Schedule board | `/schedule` | week; rows technicians + bays; booking dialog; leave shading |
| S15 | Bookings list + route sheet | `/schedule/bookings`, `/schedule/route-sheet` | route sheet print |
| S16 | Leave (from HR) | `/schedule/leave` | |
| S17 | Billing: invoices + receipts | `/billing` | tabs; invoice view with journal; deposit receive/apply; cancel (simulated Sales) |
| S18 | Goods issues (simulated) | `/billing/issues` | journal per expense type |
| S19 | Time entries + attendance variance | `/labor` | confirm; variance by month |
| S20 | Reports | `/reports` | groups §28.1–28.7 + §38.6, each a table + small bar chart |
| S21 | Permissions matrix | `/access` | cosmetic toggles |
| S22 | Audit log | `/audit` | filter by entity, user, action |
| — | Coming soon | menu | PM, contract coverage, drag board, skills |

## 9. Build order
M0 foundation → 1 master data + settings (S1, S2) → 2 assets (S3–S5) → 3 requests (S6, S7) → 4 estimates + tasks (S8–S10) → 5 work orders (S11–S13, S18 partial) → 6 scheduling (S14–S16) → 7 billing (S17, S18) → 8 labor (S19) → 9 reports + dashboard (S0, S20) → 10 access, audit, polish (S21, S22). Prompts in `prompts-maintenance.md`.
