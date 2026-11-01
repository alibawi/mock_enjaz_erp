// Module 4 seed: version 1 for every activated contract, then amendments in every state created through the real engine.
import { applyAmendment, createAmendment, decideAmendment, hashOf, snapshot, submitAmendment } from '../amendments'
import { autoRenew } from '../renewal'
import type { ContractAmendment, DB, HeaderChange, LineOp, PartyOp } from '../types'

type In = { type: ContractAmendment['type']; reason: string; effectiveDate: string; header?: HeaderChange[]; lineOps?: LineOp[]; partyOps?: PartyOp[] }

export function amendmentsSeed(db: DB) {
  db.amendments = []; db.versions = []
  db.contracts.filter((c) => c.versionNo >= 1).forEach((c) => {
    const payload = snapshot(db, c)
    db.versions.push({
      id: `ver-${c.id}-1`, contractId: c.id, versionNo: 1, reason: c.renewedFromContractId ? 'Renewal' : 'Activation', payload, payloadHash: hashOf(payload),
      createdOn: `${c.activatedOn ?? c.startDate}T10:00`, createdBy: c.activatedBy ?? 'u-mgr',
    })
  })
  const c21 = db.contracts.find((c) => c.id === 'c-21'), c22 = db.contracts.find((c) => c.id === 'c-22')
  if (c21 && c22) c21.successorContractId = c22.id

  const admin = db.userId
  const as = <T,>(userId: string, fn: () => T): T => { db.userId = userId; try { return fn() } finally { db.userId = admin } }
  const must = (e: string | null | undefined, what: string) => { if (e) throw new Error(`amendments seed ${what}: ${e}`) }
  const make = (cid: string, creator: string, i: In, upTo: 'Draft' | 'Pending' | 'Approved' | 'Applied' | 'Rejected', approvers: string[] = []) => {
    const c = db.contracts.find((x) => x.id === cid)!
    const r = as(creator, () => createAmendment(db, c, { type: i.type, reason: i.reason, effectiveDate: i.effectiveDate, header: i.header ?? [], lineOps: i.lineOps ?? [], partyOps: i.partyOps ?? [] }))
    if (typeof r === 'string') throw new Error(`amendments seed ${cid}: ${r}`)
    if (upTo === 'Draft') return r
    must(as(creator, () => submitAmendment(db, r.id)), `${cid} submit`)
    approvers.forEach((u, k) => {
      const reject = upTo === 'Rejected' && k === approvers.length - 1
      must(as(u, () => decideAmendment(db, r.id, reject ? 'Rejected' : 'Approved', reject ? 'القيمة المطلوبة غير مبررة بجدول الأعمال' : 'موافق')), `${cid} decide ${u}`)
    })
    if (upTo === 'Applied') must(as(creator, () => applyAmendment(db, r.id)), `${cid} apply`)
    return r
  }
  const oldOf = (cid: string, k: keyof import('../types').Contract) => (db.contracts.find((c) => c.id === cid) as unknown as Record<string, string | number | undefined>)[k as string]

  // Applied
  make('c-09', 'u-pro', { type: 'ExtendTerm', reason: 'تمديد موسم التوريد بسبب تأخر مشاريع العميل', effectiveDate: '2026-09-01', header: [{ path: 'endDate', oldValue: oldOf('c-09', 'endDate'), newValue: '2027-03-31' }] }, 'Applied', ['u-mgr', 'u-fd'])
  make('c-01', 'u-sal', {
    type: 'ChangeLines', reason: 'زيادة كمية الرمل وتعديل السعر بعد ارتفاع كلفة النقل', effectiveDate: '2026-08-01',
    lineOps: [{ op: 'Change', lineNum: 2, fields: { agreedQuantity: 9000, unitPrice: 18500 }, old: { agreedQuantity: 8000, unitPrice: 18000 } }],
  }, 'Applied', ['u-mgr', 'u-fd'])
  make('c-16', 'u-req', { type: 'ChangeValue', reason: 'إضافة زيارات صيانة طارئة إلى العقد', effectiveDate: '2026-07-01', header: [{ path: 'contractValue', oldValue: oldOf('c-16', 'contractValue'), newValue: 108_000_000 }] }, 'Applied', ['u-mgr', 'u-fd'])
  make('c-10', 'u-pro', {
    type: 'ChangeParties', reason: 'إضافة ممثل المورد للشؤون القانونية', effectiveDate: '2026-10-01',
    partyOps: [{ op: 'Add', fields: { name: 'مكتب الأمين للاستشارات القانونية', role: 'Witness', contactName: 'الأستاذ فارس الأمين', email: 'legal@alameen.example.iq', phone: '07901234567', signatoryTitle: 'مستشار قانوني' } }],
  }, 'Applied', ['u-mgr', 'u-fd'])
  // Pending at stage 2 of 3 (value change above 100M)
  make('c-04', 'u-sal', {
    type: 'ChangeLines', reason: 'توسعة الاتفاقية لتشمل كابلات 4×25 وزيادة كمية الكابلات الحالية', effectiveDate: '2026-11-10',
    lineOps: [
      { op: 'Change', lineNum: 1, fields: { agreedQuantity: 40000 }, old: { agreedQuantity: 30000 } },
      { op: 'Add', add: { itemId: 'it-8', description: 'كابل نحاسي 4×25 ملم²', uomId: 'u-m', commitmentType: 'Quantity', agreedQuantity: 5000, unitPrice: 21000, discountPercent: 0, priceFixed: true, enforceMax: true } },
    ],
  }, 'Pending', ['u-mgr'])
  // Approved, waiting for its effective date
  make('c-11', 'u-pro', {
    type: 'ChangeTerms', reason: 'تقصير فترة الدفع وتعديل شروط التسليم', effectiveDate: '2026-12-01',
    header: [{ path: 'paymentTermId', oldValue: oldOf('c-11', 'paymentTermId'), newValue: 'pt-60' }, { path: 'deliveryTerms', oldValue: oldOf('c-11', 'deliveryTerms'), newValue: 'التسليم في مخزن الشركة — أجور النقل والتفريغ على المورد' }],
  }, 'Approved', ['u-mgr', 'u-fd'])
  // Draft on an on-hold contract
  make('c-05', 'u-sal', { type: 'ExtendTerm', reason: 'تمديد المدة بعد استئناف الاتفاقية', effectiveDate: '2026-11-15', header: [{ path: 'endDate', oldValue: oldOf('c-05', 'endDate'), newValue: '2027-06-30' }] }, 'Draft')
  // Rejected at the second stage
  make('c-17', 'u-req', { type: 'ChangeValue', reason: 'رفع قيمة العقد لتغطية قطع غيار إضافية', effectiveDate: '2026-11-01', header: [{ path: 'contractValue', oldValue: oldOf('c-17', 'contractValue'), newValue: 210_000_000 }] }, 'Rejected', ['u-mgr', 'u-fd'])

  autoRenew(db) // contracts already past their notice deadline get their one Draft successor
}
