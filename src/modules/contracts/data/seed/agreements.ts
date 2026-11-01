// Module 3 seed: line limits, mock Sales/Procurement/Inventory documents and delivery schedules.
// The ledger is produced by the real engine (postDoc), so ledger = documents = balances by construction.
import { postDoc, rebuildBalances, setDocState, editDoc, netPrice, findLine } from '../fulfillment'
import type { CurrencyCode, DB, DocType } from '../types'

type L = [itemId: string, qty: number, price?: number]
interface S {
  key: string; c: string; t: DocType; date: string; lines: L[]; base?: string; cur?: CurrencyCode; rate?: number; stock?: boolean
  then?: 'cancel' | 'reverse' | ['edit', number]
}
const S = (key: string, c: string, t: DocType, date: string, lines: L[], extra: Partial<S> = {}): S => ({ key, c, t, date, lines, ...extra })

const specs: S[] = [
  // c-01 — sales, cement and sand (IQD)
  S('a1', 'c-01', 'SOR', '2026-02-01', [['it-1', 4000], ['it-5', 3000]]),
  S('a2', 'c-01', 'DLN', '2026-02-20', [['it-1', 2500], ['it-5', 1800]], { base: 'a1' }),
  S('a3', 'c-01', 'INV', '2026-02-25', [['it-1', 2500], ['it-5', 1800]], { base: 'a2' }),
  S('a4', 'c-01', 'SOR', '2026-05-10', [['it-1', 5000], ['it-5', 2500]]),
  S('a5', 'c-01', 'DLN', '2026-06-02', [['it-1', 3500], ['it-5', 2000]], { base: 'a4' }),
  S('a6', 'c-01', 'INV', '2026-06-10', [['it-1', 3500], ['it-5', 2000]], { base: 'a5' }),
  S('a7', 'c-01', 'RET', '2026-06-20', [['it-1', 300]], { base: 'a6' }),
  S('a8', 'c-01', 'SIN', '2026-06-22', [['it-1', 300]], { base: 'a7' }),
  S('a9', 'c-01', 'SOR', '2026-07-15', [['it-1', 1000]], { then: 'cancel' }),
  S('a10', 'c-01', 'SOR', '2026-09-15', [['it-1', 2000]]),
  S('a11', 'c-01', 'DLN', '2026-10-12', [['it-1', 1500]], { base: 'a10' }),
  // c-02 — general (bonus) agreement: value commitment on the whole building-materials category
  S('b1', 'c-02', 'SOR', '2026-04-05', [['it-1', 1000, 95000]]),
  S('b2', 'c-02', 'DLN', '2026-04-25', [['it-1', 1000, 95000]], { base: 'b1' }),
  S('b3', 'c-02', 'INV', '2026-05-02', [['it-1', 1000, 95000]], { base: 'b2' }),
  S('b4', 'c-02', 'SOR', '2026-06-18', [['it-5', 4000, 18000]]),
  S('b5', 'c-02', 'DLN', '2026-07-10', [['it-5', 3000, 18000]], { base: 'b4' }),
  S('b6', 'c-02', 'INV', '2026-08-12', [['it-3', 60, 780]], { cur: 'USD', stock: true }), // direct invoice with stock movement, USD document on an IQD contract
  S('b7', 'c-02', 'SOR', '2026-09-20', [['it-2', 500, 112000]]),
  // c-03 — sales of rebar, USD contract
  S('c1', 'c-03', 'SOR', '2026-03-01', [['it-3', 300]]),
  S('c2', 'c-03', 'DLN', '2026-03-20', [['it-3', 300]], { base: 'c1' }),
  S('c3', 'c-03', 'INV', '2026-03-25', [['it-3', 300]], { base: 'c2' }),
  S('c4', 'c-03', 'SOR', '2026-05-15', [['it-3', 250, 1021800]], { cur: 'IQD' }), // IQD document against a USD contract
  S('c5', 'c-03', 'DLN', '2026-06-10', [['it-3', 250, 1021800]], { base: 'c4', cur: 'IQD' }),
  S('c6', 'c-03', 'SOR', '2026-09-01', [['it-3', 150]]),
  S('c7', 'c-03', 'DLN', '2026-09-20', [['it-3', 100]], { base: 'c6' }),
  // c-04 — cables and transformers
  S('d1', 'c-04', 'SOR', '2026-06-01', [['it-7', 12000], ['it-10', 8]]),
  S('d2', 'c-04', 'DLN', '2026-06-30', [['it-7', 12000], ['it-10', 5]], { base: 'd1' }),
  S('d3', 'c-04', 'INV', '2026-07-05', [['it-7', 12000], ['it-10', 5]], { base: 'd2' }),
  S('d4', 'c-04', 'SOR', '2026-09-10', [['it-7', 8000], ['it-10', 6]]),
  S('d5', 'c-04', 'DLN', '2026-10-05', [['it-7', 5000]], { base: 'd4' }),
  // c-05 — furniture (on hold now)
  S('e1', 'c-05', 'SOR', '2026-04-20', [['it-13', 50], ['it-14', 100]]),
  S('e2', 'c-05', 'DLN', '2026-05-15', [['it-13', 50], ['it-14', 100]], { base: 'e1' }),
  S('e3', 'c-05', 'INV', '2026-05-20', [['it-13', 50], ['it-14', 100]], { base: 'e2' }),
  S('e4', 'c-05', 'SOR', '2026-07-01', [['it-13', 40], ['it-14', 90]]),
  // c-08 — expired sand and gravel
  S('f1', 'c-08', 'SOR', '2025-11-05', [['it-5', 3000], ['it-6', 1500]]),
  S('f2', 'c-08', 'DLN', '2025-11-25', [['it-5', 3000], ['it-6', 1500]], { base: 'f1' }),
  S('f3', 'c-08', 'INV', '2025-12-01', [['it-5', 3000], ['it-6', 1500]], { base: 'f2' }),
  S('f4', 'c-08', 'SOR', '2026-03-10', [['it-5', 1800], ['it-6', 1200]]),
  S('f5', 'c-08', 'DLN', '2026-04-02', [['it-5', 1800], ['it-6', 1200]], { base: 'f4' }),
  S('f6', 'c-08', 'INV', '2026-04-10', [['it-5', 1800], ['it-6', 1200]], { base: 'f5' }),
  // c-09 — purchases of cement (IQD)
  S('g1', 'c-09', 'POR', '2026-02-10', [['it-1', 3000], ['it-2', 500]]),
  S('g2', 'c-09', 'PDN', '2026-03-01', [['it-1', 3000], ['it-2', 400]], { base: 'g1' }),
  S('g3', 'c-09', 'PCH', '2026-03-10', [['it-1', 3000], ['it-2', 400]], { base: 'g2' }),
  S('g4', 'c-09', 'POR', '2026-05-05', [['it-1', 3000]]),
  S('g5', 'c-09', 'PDN', '2026-05-28', [['it-1', 2800]], { base: 'g4' }),
  S('g6', 'c-09', 'PCH', '2026-06-05', [['it-1', 2800]], { base: 'g5' }),
  S('g7', 'c-09', 'RPC', '2026-06-20', [['it-1', 200]], { base: 'g6' }),
  S('g8', 'c-09', 'SOT', '2026-06-22', [['it-1', 200]], { base: 'g7' }),
  S('g9', 'c-09', 'POR', '2026-08-20', [['it-2', 600]], { then: ['edit', 500] }),
  S('g10', 'c-09', 'PDN', '2026-09-15', [['it-2', 500]], { base: 'g9' }),
  // c-10 — purchases of rebar, USD contract
  S('h1', 'c-10', 'POR', '2026-04-01', [['it-3', 200], ['it-4', 100]]),
  S('h2', 'c-10', 'PDN', '2026-04-25', [['it-3', 200], ['it-4', 80]], { base: 'h1' }),
  S('h3', 'c-10', 'PCH', '2026-05-02', [['it-3', 200], ['it-4', 80]], { base: 'h2' }),
  S('h4', 'c-10', 'POR', '2026-07-10', [['it-3', 150]]),
  S('h5', 'c-10', 'PDN', '2026-08-02', [['it-3', 150]], { base: 'h4' }),
  S('h6', 'c-10', 'PCH', '2026-08-10', [['it-3', 150, 995600]], { base: 'h5', cur: 'IQD' }), // bill in IQD against a USD contract
  // c-11 — transformers and generators, USD contract
  S('i1', 'c-11', 'POR', '2026-06-20', [['it-9', 4], ['it-11', 3]]),
  S('i2', 'c-11', 'PDN', '2026-07-25', [['it-9', 4], ['it-11', 2]], { base: 'i1' }),
  S('i3', 'c-11', 'PCH', '2026-08-01', [['it-9', 4], ['it-11', 2]], { base: 'i2' }),
  S('i4', 'c-11', 'POR', '2026-09-12', [['it-9', 3]]),
  // c-14 — terminated fuel agreement, USD
  S('j1', 'c-14', 'POR', '2026-02-10', [['it-16', 300000], ['it-17', 10000]]),
  S('j2', 'c-14', 'PDN', '2026-03-05', [['it-16', 300000], ['it-17', 10000]], { base: 'j1' }),
  S('j3', 'c-14', 'PCH', '2026-03-10', [['it-16', 300000], ['it-17', 10000]], { base: 'j2' }),
  S('j4', 'c-14', 'POR', '2026-05-20', [['it-16', 200000]]),
  S('j5', 'c-14', 'PDN', '2026-06-15', [['it-16', 200000]], { base: 'j4' }),
  S('j6', 'c-14', 'PCH', '2026-06-20', [['it-16', 200000]], { base: 'j5' }),
]

/** Line limits (min/max release, enforced caps, validity) layered over the module-1 lines. */
const limits: Record<string, Partial<{ enforceMax: boolean; minRelease: number; maxRelease: number; validFrom: string; validTo: string }>> = {
  'c-01-l1': { enforceMax: true, minRelease: 500, maxRelease: 6000 }, 'c-01-l2': { enforceMax: true },
  'c-03-l1': { enforceMax: true, maxRelease: 400 },
  'c-04-l1': { enforceMax: true }, 'c-04-l2': { enforceMax: true, minRelease: 2, validFrom: '2026-06-01', validTo: '2027-03-31' },
  'c-08-l1': { enforceMax: true },
  'c-09-l1': { enforceMax: true }, 'c-09-l2': { enforceMax: true },
  'c-11-l1': { enforceMax: true }, 'c-11-l2': { enforceMax: true },
}

const sched: [lineId: string, due: string, qty: number, note: string][] = [
  ['c-01-l1', '2026-03-15', 1500, 'دفعة أولى'], ['c-01-l1', '2026-06-15', 3000, 'دفعة ثانية'], ['c-01-l1', '2026-09-15', 3000, 'دفعة ثالثة'],
  ['c-01-l1', '2026-12-15', 2500, 'دفعة رابعة'], ['c-01-l1', '2027-01-10', 2000, 'الدفعة الأخيرة'],
  ['c-03-l1', '2026-04-30', 300, 'شحنة نيسان'], ['c-03-l1', '2026-07-31', 300, 'شحنة تموز'], ['c-03-l1', '2026-10-31', 200, 'شحنة تشرين الأول'],
  ['c-09-l1', '2026-03-31', 3000, 'ربع أول'], ['c-09-l1', '2026-06-30', 3000, 'ربع ثانٍ'], ['c-09-l1', '2026-09-30', 3000, 'ربع ثالث'],
  ['c-04-l2', '2026-07-15', 5, 'دفعة أولى'], ['c-04-l2', '2026-11-15', 6, 'دفعة ثانية'], ['c-04-l2', '2027-02-15', 9, 'دفعة ثالثة'],
]

export function agreementsSeed(db: DB) {
  db.mockDocs = []; db.ledger = []; db.balances = {}; db.schedules = []
  db.lines.forEach((l) => { const o = limits[l.id]; if (o) Object.assign(l, o) })
  const ids = new Map<string, string>()
  for (const s of specs) {
    const c = db.contracts.find((x) => x.id === s.c)!
    const lines = s.lines.map(([itemId, qty, price]) => {
      const line = findLine(db, c, itemId)
      return { itemId, qty, unitPrice: price ?? (line ? netPrice(line) : 0) }
    })
    const r = postDoc(db, { docType: s.t, contractId: s.c, date: s.date, currency: s.cur ?? c.currency, rate: s.cur === 'IQD' ? 1 : s.rate, baseDocId: s.base ? ids.get(s.base) : undefined, stockMovement: s.stock, lines }, { validate: false })
    if (r.error || !r.doc) throw new Error(`agreement seed ${s.key}: ${r.error}`)
    ids.set(s.key, r.doc.id)
    if (s.then === 'cancel') setDocState(db, r.doc.id, 'Cancelled')
    else if (s.then === 'reverse') setDocState(db, r.doc.id, 'Reversed')
    else if (s.then) editDoc(db, r.doc.id, [{ lineId: r.doc.lines[0].id, qty: s.then[1], unitPrice: r.doc.lines[0].unitPrice }])
  }
  sched.forEach(([lineId, dueDate, quantity, note], i) => db.schedules.push({ id: `sch-${i + 1}`, lineId, dueDate, quantity, note }))
  rebuildBalances(db)
  // fulfilment documents are linked through the ledger; the module-1 sample links stay for source documents (quotations, requests)
}
