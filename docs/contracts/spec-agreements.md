# Spec — Module 3: agreements (اتفاقيات المبيعات والمشتريات والتنفيذ)

Derived from plan docs 02 §2.9, 04 §2.4–2.7 and 2.18, 08 §3 (fulfillment engine), 14 ADR-17/18/25, §6.2.

## 1. Scope and relationships
Agreement profile contracts: commitment lines, price resolution, fulfillment ledger, balances, linked documents of Sales / Procurement / Inventory (mock), returns, currency conversion, delivery schedules, general (bonus) agreements, category commitments. Depends on contracts and settings; feeds obligations-finance (invoiced) and analytics.

## 2. Data model
**ContractLine**: contractId, lineNum (immutable, unique per contract; used as AgreementLineNum), itemId? or categoryId? (+ includeSubcategories), description, uomId, commitmentType (Quantity / Value), agreedQuantity?, agreedValue?, unitPrice, discountPercent, priceFixed, enforceMax, minRelease(qty/value)?, maxRelease(qty/value)?, validFrom?, validTo?, status (Open / Closed), notes.
**LineBalance** (derived cache): lineId, released, fulfilled, invoiced (qty and value, contract currency).
**LedgerEntry** (append-only): contractId, lineId, lineNum, entryType (Release / Fulfill / Invoice), sourceDocType, sourceDocId, sourceLineId, sourceDocRef, sourceDocDate, sourceRevision, sequence, quantityDelta, valueDelta (contract currency), docCurrency, docValueDelta, rateUsed, reason (Posted / Cancelled / Returned / Reversed / Edited / Recalculated / Exceeded), createdOn.
**LinkedDocument** (mock Sales/Procurement/Inventory docs): docType code (SOR order, DLN delivery, INV invoice, RET return, POR order, PDN goods receipt, PCH bill, RPC purchase return, SIN/SOT inventory receipt/issue for returns), docId, ref, date, partnerId, currency, rate, lines[] (lineId, itemId, qty, netValueDoc, netValueLocal, agreementId?, agreementLineNum?, baseDocType?, state: Active / Cancelled / Reversed / Deleted / Unlinked).
**DeliveryScheduleItem**: lineId, dueDate, quantity, value?, note.
**Category** (shared seed): id, code, name, parentId (hierarchy). **Item**: id, code, name, categoryId, uomId, baseUomFactor.

## 3. Status lifecycles
Line: Open → Closed. Document line contribution state: Active / Cancelled / Reversed / Deleted / Unlinked (contribution 0 unless Active). Contract lifecycle from module 1 governs whether new links are allowed (Active only).

## 4. Business rules
| ID | Rule |
|---|---|
| BR-A-01 | Counter mapping by document type (plan doc 08 §3.1): Sales order (SOR) → Release; Delivery (DLN) → Fulfill; Invoice (INV) → Invoice; Sale return (RET) → Invoice(−) at creation, Fulfill(−) and Release(−, if restore setting) at the inventory receipt (SIN) with base Return; Purchase order (POR) → Release; Goods receipt (PDN) → Fulfill; Purchase bill (PCH) → Invoice; Purchase return (RPC) → Invoice(−) only when based on a bill, Fulfill(−) and Release(−) at the inventory issue (SOT) with base purchase return. Documents not used by the system (credit memo, goods return) and POS are excluded. |
| BR-A-02 | A document counts toward Release only if it has no agreement-linked base line; direct invoice with stock movement counts Release+Fulfill+Invoice once. |
| BR-A-03 | Contribution model: each source line's current contribution is compared with the ledger sum; the delta is inserted as a new entry (sequence+1); equal ⇒ no entry; events with an older revision are ignored. |
| BR-A-04 | Remaining by basis (setting `FulfillmentBasis`: Order / Delivery / Invoice, default Order) = committed − counter(basis). |
| BR-A-05 | Pre-save validation: contract Active, document date inside contract and line validity, partner and organization match, min release, max (if enforce) against remaining + previous contribution; price fixed only when currencies equal. `EnforcementMode` (None / Warn / Block, default Warn) decides warning vs error. |
| BR-A-06 | Failure behaviour setting `OnFulfillmentFailure`: Rollback (default; document refused with message) / KeepAndAlert (document kept, entry flagged Exceeded, owner alerted). Warn mode never throws. |
| BR-A-07 | Any currency accepted: same currency → document amount; contract currency = system currency → local value; otherwise local value converted with `ConversionRateSource` (ActivationRate default / DocumentDateRate). Ledger keeps document amount, contract amount and rate used. Quantity commitments ignore currency. |
| BR-A-08 | Returns restore the commitment per setting `ReturnsRestoreCommitment` (default true). |
| BR-A-09 | Resolution picks a line by partner/item(or category incl. sub-categories)/date/organization; tie-break earliest end date then lowest contract number; General (bonus) agreements track totals and never override prices. |
| BR-A-10 | Amendments cannot reduce a line's commitment below its released/fulfilled/invoiced counters (enforced in module 4). |
| BR-A-11 | Recalculate rebuilds balances from the ledger; the integrity check must show ledger sum = balance for every line. |
| BR-A-12 | Delivery schedule rows are informational: fulfillment is compared to due dates; no automatic orders. |

## 5. Permissions
View fulfillment (sales/procurement/finance/manager), manage lines in Draft (requester/manager), recalculate (manager/admin), create linked mock documents for the demo (sales, procurement). Matrix in module 8.

## 6. Module KPIs
Committed vs released vs fulfilled vs invoiced (bars), remaining commitments by partner, lines near exhaustion (≥ 80 %), exceeded entries count, fulfillment drift (should be 0).

## 7. Integrations (placeholders)
Sales (SOR, DLN, INV, RET), Procurement (POR, PDN, PCH, RPC), Inventory (SIN/SOT return movements, categories), Finance (exchange rates) — all simulated by the "demo documents" simulator below.

## 8. Complete screen list
| ID | Screen | Notes |
|---|---|---|
| A1 | Lines tab (card) | grid with commitment fields and balance bar (`BalanceBar`: released / fulfilled / invoiced / remaining %); Draft editable, otherwise read-only |
| A2 | Line editor dialog | item or category picker, UoM, commitment type, price, discount, limits, validity, schedule |
| A3 | Fulfillment tab | per-line summary, ledger drill-down (source document links, reasons, revisions), recalculate button, drift indicator |
| A4 | Linked documents tab | documents list with type, date, currency, contribution, state |
| A5 | Demo document simulator `/agreements/simulator` | create a mock sales/purchase document line against an agreement (qty, price, currency, date), post / edit / cancel / return it, and see validation, warnings, ledger entries, balances, failure behaviour per settings |
| A6 | Agreements list `/agreements` | contracts with profile Agreement, utilisation %, remaining, expiry; tabs sales / purchase |
| A7 | Resolution test `/agreements/resolve` | enter partner, item, date, currency → shows matching line, price, remaining, warnings |
| A8 | Delivery schedule editor | per-line schedule grid with fulfilment vs due date |

## 9. Build order
3.1 routes + seed (categories, items, 15 agreements, 70 lines, 120 ledger entries, linked docs) · 3.2 A6 list · 3.3 A1 lines tab + A2 editor · 3.4 fulfillment engine (`fulfillment.ts`, `currency.ts`) with BR-A-01…11 and `npm run check` ledger = balances · 3.5 A3 fulfillment tab + A4 documents · 3.6 A5 simulator (post/edit/cancel/return/reverse, failure modes) · 3.7 A7 resolver + A8 schedule + bonus and category rules · 3.8 KPIs · 3.9 flow test (SO 10 → delivery 6 → invoice 6 → return 2 → cancel; USD document against IQD contract; Block+Rollback vs KeepAndAlert).

## 10. Plan gaps logged
- Exact UI for the Inventory category-membership service is a placeholder lookup.
- SAP/Odoo/D365 show no documented currency rule; behaviour is the plan's own (ADR-18).
