// Fulfillment engine for agreements (plan doc 08 §3, spec BR-A-01…12). Pure functions over a DB (call inside run()).
// Contribution model (BR-A-03): every source line's current contribution is compared with the ledger sum and the delta is appended.
import { today } from './asof'
import { rateOn } from './currency'
import { uid } from './format'
import { getSetting } from './settings'
import type {
  Contract, ContractLine, CounterType, CurrencyCode, DB, DocState, DocType, LedgerEntry, LedgerReason, LineBalance, MockDoc, MockDocLine,
} from './types'

export const COUNTERS: CounterType[] = ['Release', 'Fulfill', 'Invoice']
export const counterLabel: Record<CounterType, string> = { Release: 'محجوز (أمر)', Fulfill: 'منفّذ (تسليم/استلام)', Invoice: 'مفوتر' }
export const basisCounter = { Order: 'Release', Delivery: 'Fulfill', Invoice: 'Invoice' } as const

export const docMeta: Record<DocType, { label: string; side: 'Sales' | 'Purchase'; module: string }> = {
  SOR: { label: 'أمر بيع', side: 'Sales', module: 'المبيعات' }, DLN: { label: 'تسليم', side: 'Sales', module: 'المبيعات' },
  INV: { label: 'فاتورة بيع', side: 'Sales', module: 'المبيعات' }, RET: { label: 'مرتجع مبيعات', side: 'Sales', module: 'المبيعات' },
  SIN: { label: 'إدخال مخزني (مرتجع مبيعات)', side: 'Sales', module: 'المخزون' },
  POR: { label: 'أمر شراء', side: 'Purchase', module: 'المشتريات' }, PDN: { label: 'استلام بضاعة', side: 'Purchase', module: 'المشتريات' },
  PCH: { label: 'فاتورة شراء', side: 'Purchase', module: 'المشتريات' }, RPC: { label: 'مرتجع مشتريات', side: 'Purchase', module: 'المشتريات' },
  SOT: { label: 'إخراج مخزني (مرتجع مشتريات)', side: 'Purchase', module: 'المخزون' },
}
export const docTypesFor = (side: 'Sales' | 'Purchase'): DocType[] => (side === 'Sales' ? ['SOR', 'DLN', 'INV', 'RET', 'SIN'] : ['POR', 'PDN', 'PCH', 'RPC', 'SOT'])
/** Base document types a document may be created from. */
export const baseTypes: Record<DocType, DocType[]> = {
  SOR: [], DLN: ['SOR'], INV: ['SOR', 'DLN'], RET: ['INV', 'DLN'], SIN: ['RET'],
  POR: [], PDN: ['POR'], PCH: ['POR', 'PDN'], RPC: ['PCH', 'PDN'], SOT: ['RPC'],
}
const RETURNS: DocType[] = ['RET', 'SIN', 'RPC', 'SOT']
export const isReturn = (t: DocType) => RETURNS.includes(t)
export const stateLabel: Record<DocState, string> = { Active: 'فعّال', Cancelled: 'ملغى', Reversed: 'معكوس', Deleted: 'محذوف', Unlinked: 'فُكّ ربطه' }
export const reasonLabel: Record<LedgerReason, string> = {
  Posted: 'ترحيل', Cancelled: 'إلغاء', Returned: 'مرتجع', Reversed: 'عكس', Edited: 'تعديل', Recalculated: 'إعادة احتساب', Exceeded: 'تجاوز الحد',
}

const EPS = 1e-6
const pad = (n: number, w = 6) => String(n).padStart(w, '0')
const zero = (): LineBalance => ({ relQ: 0, relV: 0, fulQ: 0, fulV: 0, invQ: 0, invV: 0 })

// ───────────── configuration (type override > system setting) ─────────────
export function agreementCfg(db: DB, c: Contract) {
  const t = db.contractTypes.find((x) => x.id === c.typeId)
  return {
    mode: t?.enforcementMode ?? getSetting<'None' | 'Warn' | 'Block'>(db, 'Agreements.EnforcementMode'),
    basis: t?.fulfillmentBasis ?? getSetting<'Order' | 'Delivery' | 'Invoice'>(db, 'Agreements.FulfillmentBasis'),
    restore: t?.returnsRestoreCommitment ?? getSetting<boolean>(db, 'Agreements.ReturnsRestoreCommitment'),
    onFail: getSetting<'Rollback' | 'KeepAndAlert'>(db, 'Agreements.OnFulfillmentFailure'),
    rateSource: getSetting<'ActivationRate' | 'DocumentDateRate'>(db, 'Currency.ConversionRateSource'),
  }
}

// ───────────── lines, categories ─────────────
export const netPrice = (l: ContractLine) => l.unitPrice * (1 - l.discountPercent / 100)
/** Committed amount of a line in its own unit: quantity or value. */
export const committedUnits = (l: ContractLine) => (l.commitmentType === 'Quantity' ? l.agreedQuantity ?? 0 : l.agreedValue ?? 0)
/** Committed value in the contract currency (quantity lines are valued at their net price). */
export const committedValue = (l: ContractLine) => (l.commitmentType === 'Quantity' ? (l.agreedQuantity ?? 0) * netPrice(l) : l.agreedValue ?? 0)

/** True when `catId` equals `ancestor` or (with `deep`) sits below it. */
export function inCategory(db: DB, catId: string, ancestor: string, deep: boolean): boolean {
  if (catId === ancestor) return true
  if (!deep) return false
  const cat = db.categories.find((c) => c.id === catId)
  return cat?.parentId ? inCategory(db, cat.parentId, ancestor, true) : false
}
export function lineMatchesItem(db: DB, l: ContractLine, itemId: string): boolean {
  if (l.itemId) return l.itemId === itemId
  const item = db.items.find((i) => i.id === itemId)
  return !!(l.categoryId && item && inCategory(db, item.categoryId, l.categoryId, !!l.includeSubcategories))
}
/** Item-specific lines win over category lines of the same agreement. */
export function findLine(db: DB, c: Contract, itemId: string): ContractLine | undefined {
  const own = db.lines.filter((l) => l.contractId === c.id && l.status === 'Open' && lineMatchesItem(db, l, itemId))
  return own.find((l) => l.itemId) ?? own[0]
}

// ───────────── currency (BR-A-07, ADR-18) ─────────────
export function toContractValue(db: DB, c: Contract, doc: { currency: CurrencyCode; rate: number; date: string }, valueDoc: number): { value: number; rate: number } {
  if (doc.currency === c.currency) return { value: valueDoc, rate: 1 }
  const local = valueDoc * doc.rate
  if (c.currency === 'IQD') return { value: local, rate: doc.rate }
  const cfg = agreementCfg(db, c)
  const rate = cfg.rateSource === 'ActivationRate' ? c.exchangeRate ?? rateOn(db, c.currency, c.activatedOn ?? c.startDate) : rateOn(db, c.currency, doc.date)
  return { value: local / rate, rate }
}

// ───────────── contribution (BR-A-01, BR-A-02, BR-A-08) ─────────────
export type Signs = Partial<Record<CounterType, 1 | -1>>
export function counterSigns(db: DB, doc: MockDoc, restore: boolean): Signs {
  const base = doc.baseDocId ? db.mockDocs.find((x) => x.id === doc.baseDocId) : undefined
  const linkedBase = !!base && !!base.agreementId && base.agreementId === doc.agreementId
  const out: Signs = {}
  switch (doc.docType) {
    case 'SOR': case 'POR': out.Release = 1; break
    case 'DLN': case 'PDN': out.Fulfill = 1; if (!linkedBase) out.Release = 1; break
    case 'INV': case 'PCH':
      out.Invoice = 1
      if (!linkedBase) { out.Release = 1; if (doc.stockMovement) out.Fulfill = 1 } else if (doc.stockMovement && (base!.docType === 'SOR' || base!.docType === 'POR')) out.Fulfill = 1
      break
    case 'RET': if (restore) out.Invoice = -1; break
    case 'RPC': if (restore && base?.docType === 'PCH') out.Invoice = -1; break
    case 'SIN': case 'SOT': if (restore) { out.Fulfill = -1; out.Release = -1 } break
  }
  return out
}
export const signsOf = (db: DB, c: Contract, doc: MockDoc): Signs => (doc.state === 'Active' ? counterSigns(db, doc, agreementCfg(db, c).restore) : {})

// ───────────── ledger and balances ─────────────
export const ledgerOfLine = (db: DB, lineId: string) => db.ledger.filter((e) => e.lineId === lineId)

export function ledgerSums(db: DB, lineId: string): LineBalance {
  const b = zero()
  for (const e of db.ledger) {
    if (e.lineId !== lineId) continue
    if (e.entryType === 'Release') { b.relQ += e.quantityDelta; b.relV += e.valueDelta }
    else if (e.entryType === 'Fulfill') { b.fulQ += e.quantityDelta; b.fulV += e.valueDelta }
    else { b.invQ += e.quantityDelta; b.invV += e.valueDelta }
  }
  return b
}
export const balanceOf = (db: DB, lineId: string): LineBalance => db.balances[lineId] ?? zero()
export function rebuildBalances(d: DB, lineIds?: string[]) {
  const ids = lineIds ?? [...new Set([...d.lines.map((l) => l.id), ...Object.keys(d.balances)])]
  ids.forEach((id) => { d.balances[id] = ledgerSums(d, id) })
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.005
export const hasDrift = (db: DB, lineId: string) => {
  const s = ledgerSums(db, lineId), b = balanceOf(db, lineId)
  return !(near(s.relQ, b.relQ) && near(s.relV, b.relV) && near(s.fulQ, b.fulQ) && near(s.fulV, b.fulV) && near(s.invQ, b.invQ) && near(s.invV, b.invV))
}

/** Counter value of a line in the line's own unit (quantity or value) for the given counter. */
export function counterUnits(l: ContractLine, b: LineBalance, counter: CounterType): number {
  const q = counter === 'Release' ? b.relQ : counter === 'Fulfill' ? b.fulQ : b.invQ
  const v = counter === 'Release' ? b.relV : counter === 'Fulfill' ? b.fulV : b.invV
  return l.commitmentType === 'Quantity' ? q : v
}
export const counterValue = (b: LineBalance, counter: CounterType) => (counter === 'Release' ? b.relV : counter === 'Fulfill' ? b.fulV : b.invV)
export function remaining(db: DB, c: Contract, l: ContractLine) {
  const basis = basisCounter[agreementCfg(db, c).basis] as CounterType
  const used = counterUnits(l, balanceOf(db, l.id), basis)
  return { basis, used, left: committedUnits(l) - used, pct: committedUnits(l) > 0 ? (used / committedUnits(l)) * 100 : 0 }
}

export interface AgreementStats { committed: number; released: number; fulfilled: number; invoiced: number; basisUsed: number; pct: number; nearLines: number; exceededEntries: number; drift: number }
/** Totals of an agreement in its own currency (value basis; quantity lines valued at net price). */
export function agreementStats(db: DB, c: Contract): AgreementStats {
  const lines = db.lines.filter((l) => l.contractId === c.id)
  const basis = basisCounter[agreementCfg(db, c).basis] as CounterType
  const s: AgreementStats = { committed: 0, released: 0, fulfilled: 0, invoiced: 0, basisUsed: 0, pct: 0, nearLines: 0, exceededEntries: 0, drift: 0 }
  lines.forEach((l) => {
    const b = balanceOf(db, l.id)
    s.committed += committedValue(l); s.released += b.relV; s.fulfilled += b.fulV; s.invoiced += b.invV
    s.basisUsed += counterValue(b, basis)
    if (l.status === 'Open' && remaining(db, c, l).pct >= 80) s.nearLines++
    if (hasDrift(db, l.id)) s.drift++
  })
  s.exceededEntries = db.ledger.filter((e) => e.contractId === c.id && e.reason === 'Exceeded').length
  s.pct = s.committed > 0 ? (s.basisUsed / s.committed) * 100 : 0
  return s
}

// ───────────── syncing documents to the ledger (BR-A-03) ─────────────
interface Target { q: number; v: number; dv: number; rate: number }
function targetOf(db: DB, c: Contract, doc: MockDoc, ln: MockDocLine, signs: Signs, counter: CounterType): Target {
  const s = signs[counter]
  if (!s) return { q: 0, v: 0, dv: 0, rate: 1 }
  const conv = toContractValue(db, c, doc, ln.netValueDoc)
  return { q: s * ln.qty, v: s * conv.value, dv: s * ln.netValueDoc, rate: conv.rate }
}

/** Appends the delta between each source line's current contribution and its ledger sum. Returns the new entries. */
export function syncDoc(d: DB, doc: MockDoc, forced?: LedgerReason): LedgerEntry[] {
  const out: LedgerEntry[] = []
  const c = d.contracts.find((x) => x.id === doc.agreementId)
  if (!c) return out
  const signs = signsOf(d, c, doc)
  const touched: string[] = []
  for (const ln of doc.lines) {
    if (!ln.agreementLineNum) continue
    const line = d.lines.find((l) => l.contractId === c.id && l.lineNum === ln.agreementLineNum)
    if (!line) continue
    const prev = d.ledger.filter((e) => e.sourceLineId === ln.id)
    if (prev.some((e) => e.sourceRevision > doc.revision)) continue // older revision events are ignored
    let seq = prev.reduce((m, e) => Math.max(m, e.sequence), 0)
    for (const counter of COUNTERS) {
      const cur = prev.filter((e) => e.entryType === counter)
      const t = targetOf(d, c, doc, ln, signs, counter)
      const dq = t.q - cur.reduce((s, e) => s + e.quantityDelta, 0)
      const dv = t.v - cur.reduce((s, e) => s + e.valueDelta, 0)
      const ddv = t.dv - cur.reduce((s, e) => s + e.docValueDelta, 0)
      if (Math.abs(dq) < EPS && Math.abs(dv) < EPS) continue
      seq += 1
      const reason: LedgerReason = forced ?? (prev.length === 0 ? (isReturn(doc.docType) ? 'Returned' : 'Posted')
        : doc.state === 'Cancelled' || doc.state === 'Deleted' ? 'Cancelled' : doc.state === 'Reversed' || doc.state === 'Unlinked' ? 'Reversed' : 'Edited')
      const e: LedgerEntry = {
        id: `le-${d.ledger.length + 1}`, contractId: c.id, lineId: line.id, lineNum: line.lineNum, entryType: counter,
        sourceDocType: doc.docType, sourceDocId: doc.id, sourceLineId: ln.id, sourceDocRef: doc.ref, sourceDocDate: doc.date, sourceRevision: doc.revision, sequence: seq,
        quantityDelta: dq, valueDelta: dv, docCurrency: doc.currency, docValueDelta: ddv, rateUsed: t.rate, reason, createdOn: `${today()}T${new Date().toTimeString().slice(0, 5)}`,
      }
      d.ledger.push(e); out.push(e)
      if (!touched.includes(line.id)) touched.push(line.id)
    }
  }
  rebuildBalances(d, touched)
  return out
}

// ───────────── validation (BR-A-05, BR-A-06) ─────────────
export interface Issue { level: 'error' | 'warning'; text: string }

/** Checks the document against its agreement. Expects the doc's contribution to be already synced into `d`. */
export function validateDoc(d: DB, doc: MockDoc): Issue[] {
  const c = d.contracts.find((x) => x.id === doc.agreementId)
  if (!c || doc.state !== 'Active' || isReturn(doc.docType)) return []
  const cfg = agreementCfg(d, c)
  if (cfg.mode === 'None') return []
  const level = cfg.mode === 'Block' ? 'error' : 'warning'
  const out: Issue[] = []
  const add = (text: string) => out.push({ level, text })
  const signs = signsOf(d, c, doc)
  if (c.status !== 'Active') add(`الاتفاقية غير سارية (الحالة الحالية: ${c.status === 'OnHold' ? 'معلّقة' : c.status === 'Expired' ? 'منتهية' : c.status})`)
  if (doc.date < c.startDate || (c.endDate && doc.date > c.endDate)) add('تاريخ المستند خارج فترة الاتفاقية')
  if (c.counterpartyId && doc.partnerId !== c.counterpartyId) add('الطرف في المستند يختلف عن طرف الاتفاقية')
  if (doc.organizationId !== c.organizationId) add('منشأة المستند تختلف عن منشأة الاتفاقية')
  for (const ln of doc.lines) {
    if (!ln.agreementLineNum) continue
    const line = d.lines.find((l) => l.contractId === c.id && l.lineNum === ln.agreementLineNum)
    const tag = `البند ${ln.agreementLineNum}`
    if (!line) { add(`${tag}: غير موجود في الاتفاقية`); continue }
    if (line.status === 'Closed') add(`${tag}: البند مغلق`)
    if ((line.validFrom && doc.date < line.validFrom) || (line.validTo && doc.date > line.validTo)) add(`${tag}: تاريخ المستند خارج فترة صلاحية البند`)
    if (!lineMatchesItem(d, line, ln.itemId)) add(`${tag}: الصنف خارج نطاق البند`)
    if (c.overridesPrices && line.priceFixed && line.commitmentType === 'Quantity' && doc.currency === c.currency && Math.abs(ln.unitPrice - netPrice(line)) > 0.005) {
      add(`${tag}: السعر ${ln.unitPrice.toLocaleString('en-US')} يخالف السعر الثابت ${netPrice(line).toLocaleString('en-US')}`)
    }
    const conv = toContractValue(d, c, doc, ln.netValueDoc).value
    const size = line.commitmentType === 'Quantity' ? ln.qty : conv
    if (signs.Release === 1) {
      if (line.minRelease && size < line.minRelease) add(`${tag}: أقل من الحد الأدنى للإصدار (${line.minRelease.toLocaleString('en-US')})`)
      if (line.maxRelease && size > line.maxRelease) add(`${tag}: أكبر من الحد الأقصى للإصدار (${line.maxRelease.toLocaleString('en-US')})`)
    }
    const basis = basisCounter[cfg.basis] as CounterType
    if (line.enforceMax && (signs[basis] ?? 0) > 0) {
      const used = counterUnits(line, balanceOf(d, line.id), basis), cap = committedUnits(line)
      if (used > cap + EPS) add(`${tag}: تجاوز الالتزام — المستهلك ${used.toLocaleString('en-US', { maximumFractionDigits: 2 })} من ${cap.toLocaleString('en-US')} (زيادة ${(used - cap).toLocaleString('en-US', { maximumFractionDigits: 2 })})`)
    }
  }
  return out
}

// ───────────── documents: post / edit / state / return ─────────────
export interface DocSpec {
  docType: DocType; contractId: string; date: string; currency: CurrencyCode; rate?: number; baseDocId?: string; stockMovement?: boolean
  lines: { itemId: string; qty: number; unitPrice: number }[]; partnerId?: string; organizationId?: string
}
export interface Outcome { error?: string; issues: Issue[]; entries: LedgerEntry[]; doc?: MockDoc; kept?: boolean }

const makeLine = (docId: string, n: number, itemId: string, qty: number, price: number, rate: number, lineNum?: number): MockDocLine => ({
  id: `${docId}-l${n}`, itemId, qty, unitPrice: price, netValueDoc: qty * price, netValueLocal: qty * price * rate, agreementLineNum: lineNum,
})
const nextRef = (d: DB, t: DocType, date: string) => `${t}-${date.slice(0, 4)}-${pad(d.mockDocs.filter((x) => x.docType === t).length + 1)}`

/** Finalises a synced document: validates and applies the failure behaviour (BR-A-06). */
function finish(d: DB, doc: MockDoc, entries: LedgerEntry[], validate: boolean): Outcome {
  const c = d.contracts.find((x) => x.id === doc.agreementId)
  const issues = validate ? validateDoc(d, doc) : []
  const errors = issues.filter((i) => i.level === 'error')
  if (errors.length && c) {
    if (agreementCfg(d, c).onFail === 'Rollback') return { error: errors.map((e) => e.text).join('؛ '), issues, entries, doc }
    entries.forEach((e) => { e.reason = 'Exceeded' })
    return { issues, entries, doc, kept: true }
  }
  return { issues, entries, doc }
}

/** Creates and posts a document. On a Rollback failure the caller's run() discards the draft (returns the error). */
export function postDoc(d: DB, spec: DocSpec, opts: { validate?: boolean } = {}): Outcome {
  const c = d.contracts.find((x) => x.id === spec.contractId)
  if (!c) return { error: 'الاتفاقية غير موجودة', issues: [], entries: [] }
  if (!spec.lines.length || spec.lines.some((l) => !(l.qty > 0) || l.unitPrice < 0)) return { error: 'أدخل كمية صحيحة وسعراً غير سالب', issues: [], entries: [] }
  const base = spec.baseDocId ? d.mockDocs.find((x) => x.id === spec.baseDocId) : undefined
  if (isReturn(spec.docType) && !base) return { error: `${docMeta[spec.docType].label} يتطلب مستنداً أساسياً (${baseTypes[spec.docType].map((t) => docMeta[t].label).join(' أو ')})`, issues: [], entries: [] }
  if (base && !baseTypes[spec.docType].includes(base.docType)) return { error: 'نوع المستند الأساسي غير مناسب', issues: [], entries: [] }
  const rate = spec.rate ?? rateOn(d, spec.currency, spec.date)
  const id = `doc-${d.mockDocs.length + 1}`
  const doc: MockDoc = {
    id, docType: spec.docType, ref: nextRef(d, spec.docType, spec.date), date: spec.date, partnerId: spec.partnerId ?? c.counterpartyId ?? '',
    organizationId: spec.organizationId ?? c.organizationId, currency: spec.currency, rate, agreementId: c.id, baseDocId: spec.baseDocId,
    stockMovement: spec.stockMovement, state: 'Active', revision: 1, lines: [],
  }
  for (const [i, l] of spec.lines.entries()) {
    const baseLine = base?.lines.find((x) => x.itemId === l.itemId)
    const target = baseLine?.agreementLineNum ?? findLine(d, c, l.itemId)?.lineNum
    if (isReturn(spec.docType) && baseLine && l.qty > baseLine.qty + EPS) return { error: 'كمية المرتجع أكبر من كمية المستند الأساسي', issues: [], entries: [] }
    doc.lines.push(makeLine(id, i + 1, l.itemId, l.qty, l.unitPrice, rate, target))
  }
  d.mockDocs.push(doc)
  const entries = syncDoc(d, doc)
  d.audit.push({ id: uid('aud'), at: `${today()}T00:00`, userId: d.userId, entity: 'contract', entityId: c.id, action: 'doc:post', detail: doc.ref })
  return finish(d, doc, entries, opts.validate !== false)
}

export function editDoc(d: DB, docId: string, edits: { lineId: string; qty: number; unitPrice: number }[], date?: string): Outcome {
  const doc = d.mockDocs.find((x) => x.id === docId)
  if (!doc) return { error: 'المستند غير موجود', issues: [], entries: [] }
  if (doc.state !== 'Active') return { error: 'لا يمكن تعديل مستند غير فعّال', issues: [], entries: [] }
  if (edits.some((e) => !(e.qty > 0))) return { error: 'الكمية يجب أن تكون أكبر من صفر', issues: [], entries: [] }
  doc.revision += 1
  if (date) doc.date = date
  for (const e of edits) {
    const ln = doc.lines.find((l) => l.id === e.lineId)
    if (!ln) continue
    ln.qty = e.qty; ln.unitPrice = e.unitPrice; ln.netValueDoc = e.qty * e.unitPrice; ln.netValueLocal = e.qty * e.unitPrice * doc.rate
  }
  const entries = syncDoc(d, doc)
  d.audit.push({ id: uid('aud'), at: `${today()}T00:00`, userId: d.userId, entity: 'contract', entityId: doc.agreementId ?? '', action: 'doc:edit', detail: `${doc.ref} → r${doc.revision}` })
  return finish(d, doc, entries, true)
}

export function setDocState(d: DB, docId: string, state: DocState): Outcome {
  const doc = d.mockDocs.find((x) => x.id === docId)
  if (!doc) return { error: 'المستند غير موجود', issues: [], entries: [] }
  if (doc.state === state) return { error: 'المستند في هذه الحالة أصلاً', issues: [], entries: [] }
  doc.state = state; doc.revision += 1
  const entries = syncDoc(d, doc)
  d.audit.push({ id: uid('aud'), at: `${today()}T00:00`, userId: d.userId, entity: 'contract', entityId: doc.agreementId ?? '', action: `doc:${state}`, detail: doc.ref })
  return { issues: [], entries, doc }
}

/** Creates the return document (and optionally its inventory movement) based on `baseDocId`. */
export function createReturn(d: DB, baseDocId: string, qty: number, withStock: boolean): Outcome {
  const base = d.mockDocs.find((x) => x.id === baseDocId)
  if (!base || !base.agreementId) return { error: 'المستند الأساسي غير موجود', issues: [], entries: [] }
  const type: DocType | undefined = base.docType === 'INV' || base.docType === 'DLN' ? 'RET' : base.docType === 'PCH' || base.docType === 'PDN' ? 'RPC' : undefined
  if (!type) return { error: 'يُنشأ المرتجع من فاتورة أو تسليم/استلام فقط', issues: [], entries: [] }
  const ln = base.lines[0]
  const returned = d.mockDocs.filter((x) => x.baseDocId === base.id && isReturn(x.docType) && x.state === 'Active').reduce((s, x) => s + x.lines[0].qty, 0)
  if (qty + returned > ln.qty + EPS) return { error: `الكمية المتاحة للإرجاع ${ln.qty - returned}`, issues: [], entries: [] }
  const date = today() < base.date ? base.date : today()
  const first = postDoc(d, { docType: type, contractId: base.agreementId, date, currency: base.currency, rate: base.rate, baseDocId: base.id, lines: [{ itemId: ln.itemId, qty, unitPrice: ln.unitPrice }] }, { validate: false })
  if (first.error || !withStock) return first
  const second = postDoc(d, { docType: type === 'RET' ? 'SIN' : 'SOT', contractId: base.agreementId, date, currency: base.currency, rate: base.rate, baseDocId: first.doc!.id, lines: [{ itemId: ln.itemId, qty, unitPrice: ln.unitPrice }] }, { validate: false })
  return { ...second, entries: [...first.entries, ...second.entries] }
}

/** BR-A-11 — re-syncs every document of the agreement (inserting only deltas) and rebuilds the balances from the ledger. */
export function recalculate(d: DB, contractId: string): number {
  let n = 0
  d.mockDocs.filter((x) => x.agreementId === contractId).forEach((doc) => { n += syncDoc(d, doc, 'Recalculated').length })
  rebuildBalances(d, d.lines.filter((l) => l.contractId === contractId).map((l) => l.id))
  return n
}

/** Dry run on a copy: what posting would do (used by the simulator preview). */
export function previewPost(db: DB, spec: DocSpec): Outcome {
  const copy = structuredClone(db)
  const r = postDoc(copy, spec)
  return { ...r, doc: undefined, entries: r.entries }
}

// ───────────── resolution (BR-A-09) ─────────────
export interface Candidate {
  contract: Contract; line: ContractLine; left: number; pct: number; basis: CounterType
  /** Net price in the document currency; absent for general (bonus) agreements. */
  price?: number; priceFixed: boolean; priceNote: string; chosen: boolean; warnings: string[]
}
export function resolveLine(db: DB, q: { partnerId: string; itemId: string; date: string; currency: CurrencyCode; organizationId?: string }): Candidate[] {
  const out: Candidate[] = []
  for (const c of db.contracts) {
    if (c.profile !== 'Agreement' || c.status !== 'Active' || c.counterpartyId !== q.partnerId) continue
    if (q.organizationId && c.organizationId !== q.organizationId) continue
    if (q.date < c.startDate || (c.endDate && q.date > c.endDate)) continue
    for (const l of db.lines.filter((x) => x.contractId === c.id && x.status === 'Open' && lineMatchesItem(db, x, q.itemId))) {
      if ((l.validFrom && q.date < l.validFrom) || (l.validTo && q.date > l.validTo)) continue
      const r = remaining(db, c, l)
      const warnings: string[] = []
      if (r.left <= 0) warnings.push('لا متبقٍ من الالتزام')
      else if (r.pct >= 80) warnings.push(`استُهلك ${r.pct.toFixed(0)}% من الالتزام`)
      let price: number | undefined, note = 'اتفاقية عامة (مكافأة): تتبّع إجماليات فقط ولا تُغيّر السعر'
      const fixed = c.overridesPrices && l.priceFixed && l.commitmentType === 'Quantity'
      if (c.overridesPrices && l.commitmentType === 'Quantity') {
        if (q.currency === c.currency) { price = netPrice(l); note = fixed ? 'سعر ثابت من الاتفاقية' : 'سعر مرجعي من الاتفاقية' }
        else { price = (netPrice(l) * rateOn(db, c.currency, q.date)) / rateOn(db, q.currency, q.date); note = `سعر استرشادي محوّل من ${c.currency} — لا يُثبَّت عند اختلاف العملة` }
      } else if (c.overridesPrices) note = 'التزام بالقيمة: لا سعر للبند'
      out.push({ contract: c, line: l, left: r.left, pct: r.pct, basis: r.basis, price, priceFixed: fixed && q.currency === c.currency, priceNote: note, chosen: false, warnings })
    }
  }
  out.sort((a, b) => (a.contract.endDate ?? '9999').localeCompare(b.contract.endDate ?? '9999') || a.contract.number.localeCompare(b.contract.number))
  if (out[0]) out[0].chosen = true
  return out
}

// ───────────── delivery schedules (BR-A-12) ─────────────
export type ScheduleStatus = 'Met' | 'Late' | 'Upcoming'
export function scheduleOf(db: DB, line: ContractLine) {
  const fulfilled = balanceOf(db, line.id).fulQ
  let cum = 0
  return db.schedules.filter((s) => s.lineId === line.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((s) => {
    cum += s.quantity
    const status: ScheduleStatus = fulfilled + EPS >= cum ? 'Met' : s.dueDate < today() ? 'Late' : 'Upcoming'
    return { item: s, cumulative: cum, status, shortfall: Math.max(0, cum - fulfilled) }
  })
}
