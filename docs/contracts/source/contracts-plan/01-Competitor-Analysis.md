# 01 — Competitor Analysis (SAP Business One, Odoo, Dynamics 365)

Research date: 2026-10-30. Method: official documentation pages were fetched and read; secondary articles were used **only** to locate pages and are never cited as evidence. Anything not found on a page that was actually read is marked **NV (not verified)**. Fetch failures are listed in §6 so gaps are transparent.

## 1. Evidence classes

| Tag | Meaning |
|---|---|
| **[N]** | Confirmed native functionality on an official page that was read |
| **[D]** | Confirmed, but depends on another application, module, edition or feature switch |
| **[C]** | Requires customization/extension (no official page found that provides it natively) |
| **[NV]** | Not verified — not found on any page read, or the page could not be fetched |

## 2. Product-by-product findings

### 2.1 SAP Business One — Blanket Agreements vs Service Contracts (distinct concepts)

Pages read (all official):
- SBO 9.2 "Blanket Agreement: General Tab" — `https://help.sap.com/saphelp_sbo92/helpdata/en/95/35bc394bd84f19bdad840e054374e0/content.htm`
- SBO 9.2 "Blanket Agreements" overview — `https://help.sap.com/saphelp_sbo92/helpdata/en/99/f34ef644104dbcb75527fbe2780ede/content.htm`
- SBO 8.82 "Blanket Agreement: Items Tab" — `https://help.sap.com/doc/saphelp_sbo882/8.82/en-US/9e/4cb594dcb646f0831d3ad979a8e4af/content.htm`
- SAP Learning "Implementing the Service Process in SAP Business One" — `https://learning.sap.com/courses/managing-logistics-in-sap-business-one/implementing-the-service-process-in-sap-business-one` (release not stated on page)

Verified facts:
- **Two blanket-agreement types** [N]: *General* (volume/turnover target, year-end bonus) and *Specific* (special discount per transaction / delivery schedule).
- **Price precedence** [N]: field "Ignore Prices Specified in Blanket Agreement" is ticked and locked for General (price-list special prices win) and unticked and locked for Specific (agreement prices win).
- **Status values** [N]: Approved, On Hold, Draft, Terminated. Only Approved allows documents; Terminated blocks regardless of termination date.
- **Renewal** [N]: "Renewal" checkbox plus "Reminder" (number of days/weeks/months before expiry).
- **Owner** [N]: employee responsible for the agreement.
- **Items tab** [N]: Planned Quantity, Unit Price, Cumulative Quantity, Cumulative Amount (system-filled), Open Quantity (= planned − cumulative), Open Amount.
- **Automatic linking** [N]: when a valid agreement exists, sales/purchasing documents are linked automatically; the user can remove the link.
- **Service contracts are a separate Service-module feature** [N]: types *Customer*, *Item Group*, *Serial Number*; service types *Warranty* and a regular type; templates with default values per contract type; response and resolution time in hours/days; coverage by day/hour incl. holidays; covered "Parts, Labor, Travel"; warranty contract auto-created when an A/R invoice/delivery of a serialized item is created and the item master has a serial-number warranty template; service calls search for a contract with the customer, warn outside coverage, compute resolution deadline; a "Service Contract Report" lists contract statuses.
- Not verified (**NV**): item-vs-monetary "agreement method"; planned *amount* at agreement level; start/end/signing dates (only Termination Date was seen); any approval workflow; document- vs row-level link granularity; a "Blanket Agreement Fulfillment" report (seen only in a secondary article, so not counted); attachments; payment-term/discount behaviour; reminder behaviour for service-contract expiry.

### 2.2 Odoo (docs v18.0 / saas-18.1)

Pages read: Purchase blanket orders `https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase/manage_deals/blanket_orders.html`; Calls for tenders `.../calls_for_tenders.html`; Subscriptions `https://www.odoo.com/documentation/saas-18.1/applications/sales/subscriptions.html` (+ `/plans.html`, `/renewals.html`, `/closing.html`); Time & materials `https://www.odoo.com/documentation/18.0/applications/sales/sales/invoicing/time_materials.html`; Payroll (HR contracts) `https://www.odoo.com/documentation/18.0/applications/hr/payroll.html`; Sign `https://www.odoo.com/documentation/18.0/applications/productivity/sign.html`; Helpdesk SLA `https://www.odoo.com/documentation/18.0/applications/services/helpdesk/overview/sla.html`; Sales index `https://www.odoo.com/documentation/18.0/applications/sales/sales.html`.
*Caveat:* several pages returned mostly navigation text; their body content was summarised by the fetch tool, so wording should be re-checked before quoting.

Verified facts:
- **Purchase Agreements** require the "Purchase Agreements" setting [D]. Types: *Blanket Order* and *Call for Tenders* [N]. Blanket fields: Vendor, Buyer, Agreement Type, Currency, Agreement Validity (date range), Reference, Operation Type, Company; lines: Product, Quantity, Unit Price. States: **Draft → Confirmed** only. Prices must be set manually (otherwise 0). "New Quotation" creates an RfQ; an **Ordered** quantity field updates automatically; **no Remaining field** was described. Behaviour on expiry: NV.
- **No sales-side blanket order/agreement** found in the Sales index [NV/absent].
- **Subscriptions** are a separate app [D]: recurring plans (duration forever/fixed, self-closable, automatic closing for unpaid), **Renew** creates a *renewal quotation* (new document), **Close** records a reason and a "Churned" tag, recurring invoicing with billing period (weeks/months/years; days not allowed), upsell quotations. A subscription is **recurring revenue**, not a legal contract.
- **Time & materials** [D]: needs Project + Accounting + Timesheets; service products invoiced "Based on Timesheets"; expenses re-invoiced via Expenses app. Fixed-price/milestone billing page: NV (not fetched).
- **HR contracts** exist only inside Payroll (employee contract with pay structure, schedule, expiry notice period) [D]; no general Contracts app found [NV/absent].
- **Odoo Sign** is a separate app (templates, roles, validity dates, reminders; signed docs stored in Documents) [D].
- **Helpdesk SLA** [D]: policies per team with priority/tags/customers criteria, target stage, working-hours deadlines, satisfied/failed tags, "SLA Status Analysis" report. Not tied to a contract record on the page read.
- Quotation templates (reusable configurations): the dedicated page returned empty; the subscriptions pages state a quotation template becomes a subscription plan when a recurrence is set [D].
- Not found: amendments/versioning, clause library, obligations, agreement approval workflow [NV].

### 2.3 Microsoft Dynamics 365 (by application)

**Supply Chain Management** (pages read, all `learn.microsoft.com/en-us/dynamics365/supply-chain/...`): `procurement/purchase-agreements`, `procurement/tasks/create-purchase-agreement`, `sales-marketing/sales-agreements`, `procurement/contract-lifecycle-management/clm-use` (+ `developer/clm-enable`), and the archived release plan `release-plan/2025wave1/finance-supply-chain/dynamics365-supply-chain-management/support-contract-lifecycle-management-source-pay-flexible-integration`.

Verified facts (all [N] in Supply Chain Management unless noted):
- Purchase agreement = commitment to buy a quantity or amount across multiple POs; **sales agreement** is the mirror (formerly "blanket sales orders").
- **Four commitment types**: product quantity, product value, product category value, value (any product/category).
- Validity from effective/expiration dates; the PO receipt date / sales order requested ship date must fall inside.
- Price/discount fields only for quantity commitments; value types allow discount % only.
- Policies: **"Max is enforced"**, **"Price and discount is fixed"** (a changed price breaks the link and the line stops counting), **minimum/maximum release amount**.
- **Fulfillment tab** shows remaining quantity/amount; related-information shows contributing order and invoice lines.
- **Linking:** an agreement can be selected only when the order is *created* (purchase); sales allows "Remove link"/"Create link"; returns linked to the original order reduce the commitment, one agreement per return; link is per order line, header terms (payment, delivery) copied to the order header.
- **Versions:** confirming stores the version in a **history table**; previews/prints of all confirmations; an unconfirmed agreement keeps no history.
- **Status**: *Effective* and *Closed* are named; *On hold* appears on the CLM page. "Finished" not found.
- **Responsible workers:** primary and secondary, inherited from classification. **Financial dimensions** copied to release orders (changes affect only new orders). **Intercompany** agreements synchronised.
- **Integrated external CLM** (v10.0.42+, feature switch): contracts list is read-only in SCM and synced from the external system; external-owned purchase agreements skip approval workflow, have limited editing, cannot be deleted; supports purchase agreements and NDAs; not supported for intercompany. → Microsoft **delegates general legal CLM to an external system**.
- Approval workflow for non-external agreements: **NV** (not described on pages read). Attachments/audit beyond version history: **NV**.

**Field Service** [D] (`field-service/set-up-customer-agreements`, `set-up-agreements-work-orders`, `set-up-agreements-invoices`): agreements auto-generate work orders and invoices; status Estimate → Active (→ Canceled); booking setup with recurrence, "Generate Work Orders Day in Advance", incident types and customer assets; **Agreement Invoice Setup** with its own recurrence, generated in advance by a background job. "Expired" status not found.

**Customer Service** [D] (`customer-service/administer/define-service-level-agreements`): SLA KPIs (first response, resolve by), SLA items with business hours, pause/resume, warn/fail durations, statuses succeeded / nearing noncompliance / noncompliant. Holiday calendar not named.

**Finance** [D]: *Subscription billing* — only an **archived 2022 release-plan page** was readable (contracts with automated and evergreen renewals, billing schedules, usage-based pricing, MRR report). Current documentation not retrieved → treat details as **NV**. **Project Operations** contracts: **NV** (not attempted).

## 3. Comparison matrix

| # | Business capability | SAP Business One | Odoo | Dynamics 365 | Source / evidence | Recommended JasimERP behavior | Pri | Cx |
|---|---|---|---|---|---|---|---|---|
| 1 | Commercial agreement entity (sales & purchase) | Blanket Agreement, Sales + Purchasing [N] | Purchase Agreement (blanket, tender) only; no sales side [D/NV] | Sales + Purchase Agreements in SCM [N] | SAP overview; Odoo blanket page + Sales index; D365 agreement pages | One `Contract` with `Profile=Agreement`, direction Outgoing (sales) / Incoming (purchase) | P0 | M |
| 2 | Agreement kinds | General (bonus) vs Specific (price/discount) [N] | Blanket vs Call for tenders [N] | 4 commitment types per line [N] | SAP General tab; Odoo; D365 | Per-line `CommitmentType`; contract-level `OverridesPrices` (Specific) flag; General volume-bonus = P1 flag only | P0 | M |
| 3 | Item vs monetary commitment | Item rows w/ planned qty [N]; monetary method [NV] | Qty × unit price lines [N]; no value commitment [NV] | Quantity and value commitments [N] | SAP Items tab; D365 | Support `Quantity` and `Value` commitment per line in P0; `ItemGroup`/category commitment P1 | P0/P1 | M |
| 4 | Validity dates | Termination date [N]; start/end [NV] | Agreement Validity range [N]; expiry behaviour [NV] | Effective + expiration; order date must be inside [N] | SAP, Odoo, D365 | Start/End/Signature/Effective dates; order date outside range → block (configurable) | P0 | S |
| 5 | Status model | Draft/Approved/On Hold/Terminated [N] | Draft/Confirmed [N] | Effective/Closed/On hold [N] | SAP General tab; Odoo; D365 CLM page | 10-state lifecycle (doc 03) | P0 | M |
| 6 | Approval | [NV] | [NV] | Workflow for SCM-owned; bypassed for external CLM [N] | D365 CLM page | Elsa workflow stages by value/org (ADR-06) | P0 | M |
| 7 | Agreed price & discount | Unit price; price precedence flag [N]; discount [NV] | Unit price manual [N] | Unit price + discount % (qty type); "price fixed" [N] | SAP, Odoo, D365 | Line price/discount; `PriceFixed` flag; price resolution service | P0 | M |
| 8 | Payment & delivery terms | [NV] | — [NV] | Header payment/delivery terms copied to order [N] | D365 | Header `PaymentTermId`, `DeliveryTerms` copied by Sales/Procurement on release | P0 | S |
| 9 | Min/max release | [NV] | [NV] | Min/max release amount; "Max is enforced" [N] | D365 | Per-line `MinRelease`, `MaxRelease`, `EnforceMax` | P0 | M |
| 10 | Delivery schedule / release frequency | Mentioned for Specific type in overview [N, shallow] | [NV] | [NV] | SAP overview | `ContractLine` has optional release windows; full delivery schedule = P2 | P2 | M |
| 11 | Link documents to agreement | Automatic; removable [N]; granularity [NV] | New Quotation from agreement; PO list via smart button [N] | At order creation; per line; remove/create link; returns [N] | SAP, Odoo, D365 | Line-level `(AgreementId, AgreementLineNum)` already in `DocLineBase`; auto-suggest + manual remove | P0 | L |
| 12 | Fulfillment tracking | Cumulative/open qty & amount [N]; report [NV] | "Ordered" only; no remaining [N] | Fulfillment tab with remaining; contributing lines [N] | SAP Items tab; Odoo; D365 | Ledger + balances: Released / Fulfilled / Invoiced / Remaining (doc 08) | P0 | L |
| 13 | Return handling | Portion of returns % [N, shallow] | [NV] | Return reduces commitment, linked once [N] | SAP Items tab; D365 sales | Returns post compensating ledger entries (configurable restore) | P0 | M |
| 14 | Versions / amendments | [NV] | [NV] | Confirmation history table; CLM Amend externally [N] | D365 | Effective-dated `ContractAmendment` + immutable `ContractVersion` snapshot | P0 | L |
| 15 | Templates | Service-contract templates [N]; blanket templates [NV] | Quotation template → subscription plan [D] | [NV] | SAP learning; Odoo plans | `ContractTemplate` versioned, copy-on-create (R2) | P1 | M |
| 16 | Clause library | [NV] | [NV] | [NV] (external CLM) | — | Not native in any reference → built minimal in R1 Track B | P1 | M |
| 17 | Attachments / documents | [NV] | Chatter/Documents/Sign separate apps [D] | [NV] | Odoo Sign page | DMS `Document` with `EntityType.Contract` + `Contracts.Attachments.*` permissions | P0 | S |
| 18 | E-signature | [NV] | Odoo Sign separate app [D] | via external CLM [D] | Odoo Sign; D365 CLM | P0 record uploaded signed document + signer dates; provider integration P2 | P0/P2 | S/L |
| 19 | Renewal & reminders | Renewal flag + reminder [N] | Renew = new renewal quotation [D, Subscriptions] | Evergreen/automated renewals in Finance subscription billing [D, archived page] | SAP General tab; Odoo renewals; D365 release plan | Reminder rules (P0); renewal creates successor contract (P1) | P0/P1 | M |
| 20 | Owner / responsible | Owner [N] | Buyer [N] | Primary + secondary worker [N] | all three | `OwnerUserId`, `ResponsibleEmployeeId` | P0 | S |
| 21 | Financial dimensions | [NV] | [NV] | Copied to release orders [N] | D365 | Project / CostCenter on header; copied by Sales/Procurement when creating from agreement | P0 | S |
| 22 | Service / warranty contract | Service contract + warranty auto-created from serialized sale [N] | Helpdesk SLA, Field Service; T&M via Timesheets [D] | Field Service agreements [D]; Customer Service SLA [D] | SAP learning; Odoo; D365 | Separate `Service` profile, P2, blocked on Maintenance/Assets modules | P2 | XL |
| 23 | SLA response/resolution | On contract [N] | Helpdesk SLA policy [D] | SLA KPIs with pause/resume + hours [D] | SAP learning; Odoo SLA; D365 CS | Store targets + coverage on service contract; measurement by service module | P2 | L |
| 24 | Recurring billing | [NV] | Subscriptions recurring invoices [D] | Field Service agreement invoices [D]; Finance subscription billing [D] | Odoo; D365 FS | Payment schedule items + events; **no invoice generation** in contracts (reuse Core recurring templates, doc 08) | P1 | L |
| 25 | Fixed-price vs T&M service | [NV] | T&M via timesheets [D] | [NV] | Odoo T&M page | Out of scope (Project/Timesheet modules) | P2 | — |
| 26 | Intercompany agreements | [NV] | [NV] | Synchronised agreements [N] | D365 purchase page | Out of scope | P2 | L |
| 27 | External CLM integration | — | — | Supported (read-only sync) [N] | D365 CLM | `ExternalReference` fields now; integration P2 | P2 | M |
| 28 | General legal contract (NDA, lease…) | — | HR contract in Payroll only [D] | NDAs via external CLM [N] | Odoo payroll; D365 CLM | `General` profile with obligations — **beyond competitor evidence**; thin in R1 | P0 (thin) | M |
| 29 | Reporting | Service contract report [N] | SLA analysis; MRR [D] | Fulfillment tab [N] | SAP learning; Odoo; D365 | 4 reports R1, more R2 (doc 11) | P0 | M |
| 30 | Audit | [NV] | Chatter log [D, not fetched] | Confirmation history [N] | D365 | ABP audit + `ContractStatusHistory` + versions | P0 | S |

> **Note on priorities:** the Pri column was assigned before the owner moved all P1/P2 items into release 1. Treat every row marked P1 or P2 as release 1 (tracks A–D in doc 13), except 'Out of scope' rows (T&M billing, external CLM sync).

## 4. Take-aways used in the design

1. Keep **agreements** (commitment engine) and **service contracts** (coverage/SLA) separate profiles; all three vendors separate them.
2. Copy D365's per-line policies (price fixed, max enforced, min/max release) and SAP's cumulative/open counters; add what both lack — a **remaining** value for value commitments in the same screen (Odoo shows only "ordered").
3. Version snapshots on confirmation (D365) are the minimal legally defensible history; JasimERP extends it with effective-dated amendments.
4. Odoo's "renewal = new document" is the right model for agreements (commitment counters reset); an *extension amendment* covers evergreen date changes.
5. The competitors do **not** model obligations/clauses natively; these are JasimERP value-adds and are sequenced after the commitment engine.

## 5. Source list (pages actually read)

SAP: the three `help.sap.com` pages in §2.1; `learning.sap.com` service-process course.
Odoo: pages in §2.2.
Microsoft: `learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-agreements`; `.../procurement/tasks/create-purchase-agreement`; `.../sales-marketing/sales-agreements`; `.../procurement/contract-lifecycle-management/clm-use`; `.../clm-use` → `developer/clm-enable`; `learn.microsoft.com/en-us/dynamics365/field-service/set-up-customer-agreements`; `.../set-up-agreements-work-orders`; `.../set-up-agreements-invoices`; `.../customer-service/administer/define-service-level-agreements`; archived `previous-versions/dynamics365-release-plan/2022wave1/finance-operations/dynamics365-finance/subscription-billing-recurring-contract-billing`.

## 6. Retrieval failures (so gaps are not hidden)

- SAP: `learning.sap.com/.../using-blanket-agreement-in-purchasing-documents-1` → 404; both `blogs.sap.com` 2019 posts → 403. No `help.sap.com` Service-module page was read.
- Odoo: 18.0 `agreements.html`, `expense.html`, `quote_template.html` returned empty bodies.
- Microsoft: `field-service/create-agreement`, `customer-service/administer/create-slas`, `finance/accounts-receivable/subscription-billing-overview` → 404; CLM folder index → 404; Project Operations not attempted.
- **Action before Phase 5:** re-verify SAP monetary agreements and D365 agreement approval workflow with a Microsoft/SAP consultant or live tenant; none of the design depends on them.
