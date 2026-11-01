// Module 7 seed: service levels, weekly coverage windows, exclusions, covered items and 20 simulated calls driven through the real engine.
import { closeCall, openCall, respondCall, resolveCall, sweepBreaches } from '../service'
import type { DB } from '../types'

type W = [days: number[], from: string, to: string]
const sunThu = [0, 1, 2, 3, 4]
const levels: { c: string; resp: number; res: number; hours?: number; visits?: number; wStart?: string; wEnd?: string; limits: string; windows: W[]; excl: [string, string][] }[] = [
  { c: 'c-16', resp: 2, res: 24, hours: 40, visits: 8, limits: 'تغطية 24 ساعة عمل لإصلاح الأعطال الحرجة؛ قطع الغيار خارج العقد', windows: [[sunThu, '08:00', '20:00'], [[5], '08:00', '14:00']], excl: [['2026-10-04', 'عطلة رسمية']] },
  { c: 'c-17', resp: 4, res: 48, hours: 40, visits: 12, limits: 'أعمال الشبكة الكهربائية داخل نطاق المحطات المذكورة فقط', windows: [[sunThu, '08:00', '16:00']], excl: [['2026-10-14', 'عطلة رسمية']] },
  { c: 'c-18', resp: 8, res: 72, hours: 40, visits: 6, wStart: '2026-05-01', wEnd: '2028-04-30', limits: 'يغطي العيوب المصنعية فقط ويستثني سوء الاستخدام', windows: [[sunThu, '08:00', '16:00']], excl: [] },
  { c: 'c-19', resp: 4, res: 24, hours: 60, visits: 6, limits: 'عقد قيد الاعتماد', windows: [[sunThu, '08:00', '16:00']], excl: [] },
  { c: 'c-20', resp: 4, res: 48, hours: 60, visits: 6, limits: 'منتهٍ', windows: [[sunThu, '08:00', '16:00']], excl: [] },
]
const items: [c: string, item: string, serial: string | undefined, desc: string, ws?: string, we?: string][] = [
  ['c-16', 'it-11', 'GEN-250-A1', 'مولد ديزل 250 ك.ف.أ — قسم الطوارئ'], ['c-16', 'it-11', 'GEN-250-A2', 'مولد ديزل 250 ك.ف.أ — قسم العمليات'], ['c-16', 'it-12', 'GEN-500-B1', 'مولد ديزل 500 ك.ف.أ — المحطة الرئيسية'],
  ['c-17', 'it-10', 'TRN-250-77', 'محول توزيع 250 ك.ف.أ — المحطة 77'], ['c-17', 'it-8', undefined, 'كابلات 4×25 ملم² — شبكة التوزيع'],
  ['c-18', 'it-9', 'TRN-500-031', 'محول توزيع 500 ك.ف.أ', '2026-05-01', '2028-04-30'], ['c-18', 'it-11', 'GEN-250-C9', 'مولد ديزل 250 ك.ف.أ', '2026-05-01', '2026-12-20'],
  ['c-19', 'it-12', 'GEN-500-D2', 'مولد ديزل 500 ك.ف.أ — مبنى جديد'], ['c-20', 'it-12', 'GEN-500-X1', 'مكيف مركزي (محاكاة)'],
]
// [customer, item, serial, opened, severity, response at, resolve at, hours, visits, close?]
type Call = [string, string | undefined, string | undefined, string, 'Critical' | 'Normal', string?, string?, number?, number?]
const calls: Call[] = [
  ['p-c6', 'it-11', 'GEN-250-A1', '2026-08-04T09:00', 'Critical', '2026-08-04T09:40', '2026-08-04T17:00', 6, 1],
  ['p-c6', 'it-11', 'GEN-250-A2', '2026-08-17T10:00', 'Normal', '2026-08-17T11:30', '2026-08-18T12:00', 4, 1],
  ['p-c6', 'it-12', 'GEN-500-B1', '2026-09-08T13:00', 'Critical', '2026-09-08T16:30', '2026-09-09T10:00', 8, 2],
  ['p-c6', 'it-11', 'GEN-250-A1', '2026-09-20T18:30', 'Normal', '2026-09-20T19:00', '2026-09-21T14:00', 3, 1],
  ['p-c6', 'it-11', 'GEN-250-A1', '2026-09-27T10:00', 'Normal', '2026-09-27T10:20', '2026-09-27T12:00', 1.5, 0],
  ['p-c6', 'it-11', 'GEN-250-A2', '2026-10-02T09:00', 'Normal', '2026-10-02T09:30', '2026-10-02T13:00', 2, 1],
  ['p-c6', 'it-12', 'GEN-500-B1', '2026-10-10T21:00', 'Critical', '2026-10-11T08:30', '2026-10-11T16:00', 5, 1],
  ['p-c6', 'it-12', 'GEN-500-X9', '2026-10-15T10:00', 'Normal'],
  ['p-c6', 'it-11', 'GEN-250-A1', '2026-10-22T11:00', 'Normal', '2026-10-22T12:30'],
  ['p-c6', 'it-11', 'GEN-250-A2', '2026-10-29T10:00', 'Critical'],
  ['p-c7', 'it-10', 'TRN-250-77', '2026-08-09T09:00', 'Normal', '2026-08-09T11:00', '2026-08-10T11:00', 6, 1],
  ['p-c7', 'it-10', 'TRN-250-77', '2026-09-14T08:30', 'Critical', '2026-09-14T10:00', '2026-09-15T13:00', 10, 2],
  ['p-c7', 'it-8', undefined, '2026-10-05T10:00', 'Normal', '2026-10-05T13:00', '2026-10-07T09:00', 7, 1],
  ['p-c7', 'it-10', 'TRN-250-77', '2026-10-18T09:00', 'Normal', '2026-10-19T08:30'],
  ['p-c7', 'it-10', 'TRN-250-77', '2026-10-26T10:00', 'Normal'],
  ['p-c7', 'it-10', 'TRN-250-77', '2026-10-28T09:00', 'Critical', '2026-10-28T09:30', '2026-10-28T15:00', 4, 1],
  ['p-c10', 'it-9', 'TRN-500-031', '2026-06-02T09:00', 'Normal', '2026-06-02T15:00', '2026-06-04T10:00', 4, 1],
  ['p-c10', 'it-11', 'GEN-250-C9', '2026-09-21T10:00', 'Normal', '2026-09-21T11:00', '2026-09-22T12:00', 3, 1],
  ['p-c10', 'it-11', 'GEN-250-C9', '2026-10-12T10:00', 'Normal', '2026-10-12T12:00', '2026-10-13T11:00', 2, 1],
  ['p-c8', 'it-12', 'GEN-500-X1', '2026-10-20T09:00', 'Normal', '2026-10-20T10:00', '2026-10-20T15:00', 5, 1],
]

export function serviceSeed(db: DB) {
  db.serviceLevels = []; db.coverageWindows = []; db.coverageExclusions = []; db.coveredItems = []; db.serviceCalls = []; db.consumption = []; db.slaEvents = []
  levels.forEach((l) => {
    db.serviceLevels.push({ id: `sl-${l.c}`, contractId: l.c, responseHours: l.resp, resolutionHours: l.res, includedHours: l.hours, includedVisits: l.visits, warrantyStart: l.wStart, warrantyEnd: l.wEnd, limits: l.limits })
    l.windows.forEach(([days, from, to]) => days.forEach((dw) => db.coverageWindows.push({ id: `cw-${l.c}-${dw}-${from}`, contractId: l.c, dayOfWeek: dw, fromTime: from, toTime: to })))
    l.excl.forEach(([date, reason], k) => db.coverageExclusions.push({ id: `cx-${l.c}-${k}`, contractId: l.c, date, reason }))
  })
  items.forEach(([c, itemId, serial, description, ws, we], k) => db.coveredItems.push({ id: `ci-${k + 1}`, contractId: c, itemId, serial, assetRef: serial ? `AST-${String(100 + k).padStart(6, '0')}` : undefined, description, warrantyStart: ws, warrantyEnd: we }))
  calls.forEach(([customerId, itemId, serial, openedAt, severity, respAt, resAt, hours, visits], k) => {
    const call = openCall(db, { customerId, itemId, serial, severity, openedAt, description: ['عطل في نظام التشغيل التلقائي', 'ارتفاع حرارة المحرك', 'تسرب زيت', 'اهتزاز غير طبيعي', 'فشل في بدء التشغيل'][k % 5] })
    if (typeof call === 'string') throw new Error(`service seed call ${k}: ${call}`)
    if (respAt) { const e = respondCall(db, call.id, respAt); if (e) throw new Error(`service seed respond ${k}: ${e}`) }
    if (resAt) { const e = resolveCall(db, call.id, resAt, hours ?? 0, visits ?? 0); if (e) throw new Error(`service seed resolve ${k}: ${e}`); if (k % 3 === 0) closeCall(db, call.id, resAt) }
  })
  sweepBreaches(db)
}
