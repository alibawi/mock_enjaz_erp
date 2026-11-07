// Reports engine (S20) — plan §28.1–§28.7 (MVP rows) and §38.6. Every report is computed from the store for a period.
// Rows carry raw values; the column type tells the page how to format them. `chart` feeds the CSS bar chart (top values).
import { diffDays } from './asof'
import { balance, unapplied } from './billing'
import { totals } from './estimate'
import { woStatus } from './format'
import { toSchedule } from './schedule'
import { reservationShortages } from './stock'
import type { Booking, DB, WorkOrder } from './types'
import { isOpenWo, isOverdue, woCost } from './workorder'

export type ColType = 'text' | 'num' | 'hours' | 'iqd' | 'pct' | 'date' | 'days' | 'code'
export interface Col { key: string; label: string; type?: ColType }
export type Row = Record<string, string | number | undefined> & { id: string; link?: string }
export interface ReportResult { columns: Col[]; rows: Row[]; chart?: { label: string; value: number }[]; chartType?: ColType; headline?: string; note?: string }
export interface ReportDef { id: string; group: GroupId; title: string; question: string; run: (d: DB, p: Period) => ReportResult }
export interface Period { from: string; to: string; today: string }
export type GroupId = 'ops' | 'perf' | 'quality' | 'finance' | 'assets' | 'stock' | 'approval' | 'schedule'
export const groups: { id: GroupId; label: string; q: string }[] = [
  { id: 'ops', label: 'التشغيل اليومي', q: 'ماذا يحدث الآن؟' },
  { id: 'perf', label: 'أداء الورشة والفنيين', q: 'كم ننجز وبأي سرعة؟' },
  { id: 'quality', label: 'الجودة', q: 'هل نصلح من المرة الأولى؟' },
  { id: 'finance', label: 'المالية والربحية', q: 'هل نربح؟ وأين المال المعلّق؟' },
  { id: 'assets', label: 'الأصول والعملاء', q: 'من وماذا يكلّفنا ويدرّ علينا؟' },
  { id: 'stock', label: 'المخزون والقطع', q: 'ماذا نستهلك وماذا ينقصنا؟' },
  { id: 'approval', label: 'الاعتماد', q: 'أين يتأخر القرار؟' },
  { id: 'schedule', label: 'الجدولة', q: 'هل نستغل الفنيين ونصل في الموعد؟' },
]

const inP = (iso: string | undefined, p: Period) => !!iso && iso.slice(0, 10) >= p.from && iso.slice(0, 10) <= p.to
const hoursBetween = (a: string, b: string) => (new Date(`${b.length === 10 ? `${b}T00:00` : b}:00Z`).getTime() - new Date(`${a.length === 10 ? `${a}T00:00` : a}:00Z`).getTime()) / 3_600_000
const finished = (d: DB, p: Period) => d.workOrders.filter((w) => ['completed', 'closed'].includes(w.status) && inP(w.actualEnd, p))
const asset = (d: DB, id: string) => d.assets.find((a) => a.id === id)
const tech = (d: DB, id?: string) => d.technicians.find((t) => t.id === id)?.name ?? 'بلا فني'
const partner = (d: DB, id: string) => d.partners.find((p) => p.id === id)?.name ?? '—'
const item = (d: DB, id: string) => d.items.find((i) => i.id === id)?.name ?? id
const typeName = (d: DB, id: string) => d.maintenanceTypes.find((m) => m.id === id)?.name ?? id
const fc = (d: DB, id?: string) => d.failureCodes.find((f) => f.id === id)
const woLink = (w: WorkOrder) => `/work-orders/${w.id}`
const group = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, T[]>>((m, x) => { (m[key(x)] ??= []).push(x); return m }, {})
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)
const top = (rows: Row[], label: string, value: string, n = 10) => [...rows].sort((a, b) => Number(b[value]) - Number(a[value])).slice(0, n).map((r) => ({ label: String(r[label]), value: Number(r[value]) }))
const revenueOf = (d: DB, w: WorkOrder) => sum(d.invoices.filter((i) => i.workOrderId === w.id && !i.canceled), (i) => i.total)
const bookingHours = (b: Booking) => hoursBetween(`${b.date}T${b.start}`, `${b.date}T${b.end}`)
/** Rework of w = a later WO pointing to it. */
const reworkOf = (d: DB, w: WorkOrder) => d.workOrders.find((x) => x.reworkOfId === w.id)

export const reports: ReportDef[] = [
  // ---------- 28.1 operations ----------
  {
    id: 'wo-status', group: 'ops', title: 'أوامر العمل حسب الحالة', question: 'كم أمر عمل في كل حالة الآن؟',
    run: (d) => {
      const g = group(d.workOrders.filter((w) => w.status !== 'closed'), (w) => w.status)
      const rows = Object.entries(g).map(([s, ws]) => ({ id: s, status: woStatus[s as WorkOrder['status']].label, n: ws.length, overdue: ws.filter(isOverdue).length, link: '/work-orders?tab=all' }))
      return { columns: [{ key: 'status', label: 'الحالة' }, { key: 'n', label: 'العدد', type: 'num' }, { key: 'overdue', label: 'منها متأخرة', type: 'num' }], rows, chart: top(rows, 'status', 'n'), headline: `${sum(rows, (r) => Number(r.n))} أمر غير مغلق` }
    },
  },
  {
    id: 'overdue', group: 'ops', title: 'أوامر العمل المتأخرة', question: 'أي أوامر تجاوزت نهايتها المخططة ولماذا؟',
    run: (d, p) => {
      const rows = d.workOrders.filter(isOverdue).map((w) => ({ id: w.id, link: woLink(w), no: w.number, asset: asset(d, w.assetId)?.name, tech: tech(d, w.leadTechnicianId), end: w.plannedEnd, late: diffDays(p.today, w.plannedEnd!), status: woStatus[w.status].label, reason: w.holdReason ?? '' }))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'asset', label: 'الأصل' }, { key: 'tech', label: 'الفني' }, { key: 'end', label: 'النهاية المخططة', type: 'date' }, { key: 'late', label: 'التأخير', type: 'days' }, { key: 'status', label: 'الحالة' }, { key: 'reason', label: 'السبب' }], rows, chart: top(rows, 'no', 'late'), chartType: 'days', headline: `${rows.length} أمر متأخر` }
    },
  },
  {
    id: 'status-ageing', group: 'ops', title: 'متوسط البقاء في كل حالة', question: 'في أي حالة تقضي الأوامر أطول وقت؟',
    run: (d, p) => {
      const spans: Record<string, number[]> = {}
      for (const w of d.workOrders) {
        w.statusHistory.forEach((s, i) => {
          const next = w.statusHistory[i + 1]?.at ?? (isOpenWo(w) ? `${p.today}T12:00` : undefined)
          if (!next || ['closed', 'cancelled'].includes(s.to) || !(inP(s.at, p) || inP(next, p))) return
          ;(spans[s.to] ??= []).push(Math.max(0, hoursBetween(s.at, next) / 24))
        })
      }
      const rows = Object.entries(spans).map(([s, xs]) => ({ id: s, status: woStatus[s as WorkOrder['status']].label, avg: sum(xs, (x) => x) / xs.length, n: xs.length }))
      return { columns: [{ key: 'status', label: 'الحالة' }, { key: 'avg', label: 'متوسط الأيام', type: 'days' }, { key: 'n', label: 'عدد المرات', type: 'num' }], rows, chart: top(rows, 'status', 'avg'), chartType: 'days' }
    },
  },
  {
    id: 'failed-consumption', group: 'ops', title: 'فشل صرف القطع', question: 'أي أوامر لم يُرحَّل صرفها ولماذا؟',
    run: (d) => {
      const rows = d.workOrders.filter((w) => w.consumptionStatus === 'failed').map((w) => ({ id: w.id, link: woLink(w), no: w.number, asset: asset(d, w.assetId)?.name, end: w.actualEnd, reason: w.consumptionError }))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'asset', label: 'الأصل' }, { key: 'end', label: 'اكتمل', type: 'date' }, { key: 'reason', label: 'السبب' }], rows, headline: `${rows.length} أمر` }
    },
  },
  {
    id: 'reservations', group: 'ops', title: 'الحجوزات المفتوحة للقطع', question: 'ما القطع المحجوزة ومنذ متى؟',
    run: (d, p) => {
      const rows = d.workOrders.flatMap((w) => w.parts.filter((x) => x.reservedQty > 0).map((x) => ({ id: x.id, link: woLink(w), no: w.number, item: item(d, x.itemId), qty: x.reservedQty, value: x.reservedQty * (d.items.find((i) => i.id === x.itemId)?.cost ?? 0), age: w.actualStart ? diffDays(p.today, w.actualStart) : 0, status: woStatus[w.status].label })))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'item', label: 'القطعة' }, { key: 'qty', label: 'محجوز', type: 'num' }, { key: 'value', label: 'القيمة بالكلفة', type: 'iqd' }, { key: 'age', label: 'العمر', type: 'days' }, { key: 'status', label: 'حالة الأمر' }], rows, chart: top(rows, 'item', 'value'), chartType: 'iqd' }
    },
  },
  // ---------- 28.2 performance ----------
  {
    id: 'productivity', group: 'perf', title: 'إنتاجية الفنيين', question: 'كم من ساعات الحضور ذهبت إلى أوامر عمل مؤكَّدة؟',
    run: (d, p) => {
      const rows = d.technicians.filter((t) => t.active).map((t) => {
        const att = sum(d.attendance.filter((a) => a.technicianId === t.id && inP(a.date, p)), (a) => a.hours)
        const conf = sum(d.workOrders.flatMap((w) => w.timeEntries).filter((e) => e.technicianId === t.id && e.confirmedBy && inP(e.date, p)), (e) => e.hours)
        return { id: t.id, tech: t.name, att, conf, ratio: att ? (conf / att) * 100 : 0 }
      })
      return { columns: [{ key: 'tech', label: 'الفني' }, { key: 'att', label: 'الحضور', type: 'hours' }, { key: 'conf', label: 'ساعات مؤكَّدة', type: 'hours' }, { key: 'ratio', label: 'الإنتاجية', type: 'pct' }], rows, chart: top(rows, 'tech', 'ratio'), chartType: 'pct', note: 'بيانات العرض عيّنة من الأوامر مقابل حضور كامل — النسب منخفضة لهذا السبب.' }
    },
  },
  {
    id: 'hours-variance', group: 'perf', title: 'فرق الساعات مع الحضور (§36.15)', question: 'هل تتجاوز ساعات الأوامر الحضور لأي فني؟',
    run: (d, p) => {
      const rows = d.technicians.filter((t) => t.active).map((t) => {
        const att = sum(d.attendance.filter((a) => a.technicianId === t.id && inP(a.date, p) && a.date < p.today), (a) => a.hours)
        const logged = sum(d.workOrders.flatMap((w) => w.timeEntries).filter((e) => e.technicianId === t.id && inP(e.date, p) && e.date < p.today), (e) => e.hours)
        return { id: t.id, tech: t.name, att, logged, diff: logged - att, link: '/labor?tab=variance' }
      })
      return { columns: [{ key: 'tech', label: 'الفني' }, { key: 'att', label: 'الحضور (HR)', type: 'hours' }, { key: 'logged', label: 'ساعات الأوامر', type: 'hours' }, { key: 'diff', label: 'الفرق', type: 'hours' }], rows, note: 'للتحقق فقط — الحضور هو مصدر الأجر (الخيار i). التفاصيل اليومية في شاشة ساعات العمل.' }
    },
  },
  {
    id: 'repair-time', group: 'perf', title: 'متوسط زمن الإصلاح', question: 'كم يستغرق كل نوع صيانة من البدء إلى الإكمال؟',
    run: (d, p) => {
      const g = group(finished(d, p).filter((w) => w.actualStart), (w) => w.maintenanceTypeId)
      const rows = Object.entries(g).map(([t, ws]) => ({ id: t, type: typeName(d, t), n: ws.length, avg: sum(ws, (w) => hoursBetween(w.actualStart!, w.actualEnd!)) / ws.length }))
      return { columns: [{ key: 'type', label: 'نوع الصيانة' }, { key: 'n', label: 'أوامر', type: 'num' }, { key: 'avg', label: 'متوسط الساعات', type: 'hours' }], rows, chart: top(rows, 'type', 'avg'), chartType: 'hours' }
    },
  },
  {
    id: 'load', group: 'perf', title: 'حمل الورشة', question: 'كم أمرًا مفتوحًا على كل فني؟',
    run: (d) => {
      const g = group(d.workOrders.filter(isOpenWo), (w) => w.leadTechnicianId ?? '')
      const rows = Object.entries(g).map(([t, ws]) => ({ id: t || 'none', tech: tech(d, t || undefined), n: ws.length, active: ws.filter((w) => ['inProgress', 'qualityCheck'].includes(w.status)).length, waiting: ws.filter((w) => w.status.startsWith('waiting') || w.status === 'onHold').length }))
      return { columns: [{ key: 'tech', label: 'الفني المسؤول' }, { key: 'n', label: 'مفتوحة', type: 'num' }, { key: 'active', label: 'قيد التنفيذ', type: 'num' }, { key: 'waiting', label: 'معلّقة', type: 'num' }], rows, chart: top(rows, 'tech', 'n') }
    },
  },
  // ---------- 28.3 quality ----------
  {
    id: 'ftf', group: 'quality', title: 'نسبة الإصلاح من المرة الأولى', question: 'كم من الأعمال لم تحتج إعادة عمل؟',
    run: (d, p) => {
      const ws = finished(d, p).filter((w) => !w.reworkOfId)
      const g = group(ws, (w) => w.maintenanceTypeId)
      const rows = Object.entries(g).map(([t, xs]) => { const rw = xs.filter((w) => reworkOf(d, w)).length; return { id: t, type: typeName(d, t), n: xs.length, rework: rw, ftf: xs.length ? ((xs.length - rw) / xs.length) * 100 : 0 } })
      const all = ws.length ? ((ws.length - ws.filter((w) => reworkOf(d, w)).length) / ws.length) * 100 : 0
      return { columns: [{ key: 'type', label: 'نوع الصيانة' }, { key: 'n', label: 'أعمال', type: 'num' }, { key: 'rework', label: 'أُعيدت', type: 'num' }, { key: 'ftf', label: 'من المرة الأولى', type: 'pct' }], rows, chart: top(rows, 'type', 'ftf'), chartType: 'pct', headline: `${all.toFixed(1)}% من المرة الأولى` }
    },
  },
  {
    id: 'rework', group: 'quality', title: 'إعادة العمل حسب الفني وكود العطل', question: 'من وأي عطل يتكرر بعد الإصلاح؟',
    run: (d) => {
      const rows = d.workOrders.filter((w) => w.reworkOfId).map((w) => { const o = d.workOrders.find((x) => x.id === w.reworkOfId)!; return { id: w.id, link: woLink(w), no: w.number, orig: o.number, tech: tech(d, o.leadTechnicianId), code: fc(d, o.failureCodeId)?.code ?? '—', days: diffDays(w.createdAt, o.actualEnd!), status: woStatus[w.status].label } })
      return { columns: [{ key: 'no', label: 'أمر إعادة العمل', type: 'code' }, { key: 'orig', label: 'الأمر الأصلي', type: 'code' }, { key: 'tech', label: 'فني الأصلي' }, { key: 'code', label: 'كود العطل', type: 'code' }, { key: 'days', label: 'بعد', type: 'days' }, { key: 'status', label: 'الحالة' }], rows }
    },
  },
  {
    id: 'top-failures', group: 'quality', title: 'أكثر الأعطال تكرارًا', question: 'ما الأعطال المتكررة وعلى أي فئة وموديل؟',
    run: (d, p) => {
      const ws = finished(d, p).filter((w) => w.failureCodeId)
      const g = group(ws, (w) => `${w.failureCodeId}|${asset(d, w.assetId)?.brand} ${asset(d, w.assetId)?.model}`)
      const rows = Object.entries(g).map(([k, xs]) => { const [f, model] = k.split('|'); return { id: k, code: fc(d, f)?.code, name: fc(d, f)?.name, model, n: xs.length } })
      return { columns: [{ key: 'code', label: 'الكود', type: 'code' }, { key: 'name', label: 'العطل' }, { key: 'model', label: 'الموديل' }, { key: 'n', label: 'مرات', type: 'num' }], rows: rows.sort((a, b) => b.n - a.n), chart: top(rows, 'name', 'n') }
    },
  },
  // ---------- 28.4 finance ----------
  {
    id: 'profitability', group: 'finance', title: 'ربحية أوامر العمل', question: 'كم ربحنا من كل أمر بعد القطع والعمالة؟',
    run: (d, p) => {
      const rows = finished(d, p).filter((w) => revenueOf(d, w) > 0).map((w) => { const c = woCost(d, w); const rev = revenueOf(d, w); return { id: w.id, link: woLink(w), no: w.number, cust: partner(d, w.billingPartnerId), rev, parts: c.parts, labor: c.labor, margin: rev - c.total, pct: rev ? ((rev - c.total) / rev) * 100 : 0 } })
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'cust', label: 'العميل' }, { key: 'rev', label: 'الإيراد', type: 'iqd' }, { key: 'parts', label: 'كلفة القطع', type: 'iqd' }, { key: 'labor', label: 'كلفة العمالة', type: 'iqd' }, { key: 'margin', label: 'الهامش', type: 'iqd' }, { key: 'pct', label: '%', type: 'pct' }], rows, chart: top(rows, 'no', 'margin'), chartType: 'iqd', headline: `هامش ${sum(rows, (r) => r.margin).toLocaleString('en-US')} د.ع من إيراد ${sum(rows, (r) => r.rev).toLocaleString('en-US')}` }
    },
  },
  {
    id: 'estimate-accuracy', group: 'finance', title: 'دقة التقدير', question: 'هل تقترب الفاتورة من التقدير المعتمد؟',
    run: (d, p) => {
      const rows = finished(d, p).filter((w) => w.estimateId && revenueOf(d, w) > 0).map((w) => { const e = d.estimates.find((x) => x.id === w.estimateId)!; const est = totals(d, e).billable; const rev = revenueOf(d, w); return { id: w.id, link: woLink(w), no: w.number, by: d.users.find((u) => u.id === e.createdBy)?.name, est, rev, acc: est ? (rev / est) * 100 : 0 } })
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'by', label: 'المقدِّر' }, { key: 'est', label: 'التقدير', type: 'iqd' }, { key: 'rev', label: 'الفاتورة', type: 'iqd' }, { key: 'acc', label: 'الدقة', type: 'pct' }], rows }
    },
  },
  {
    id: 'expense-type', group: 'finance', title: 'الكلفة حسب نوع المصروف (1c)', question: 'على أي حسابات ذهبت كلفة القطع؟',
    run: (d, p) => {
      const lines = d.goodsIssues.filter((g) => !g.canceled && inP(g.date, p)).flatMap((g) => g.lines)
      const g = group(lines, (l) => l.expenseAccount)
      const rows = Object.entries(g).map(([a, ls]) => ({ id: a, acc: a, name: ls[0].expenseAccountName, v: sum(ls, (l) => l.qty * l.unitCost), link: '/billing/issues' }))
      return { columns: [{ key: 'acc', label: 'الحساب', type: 'code' }, { key: 'name', label: 'الاسم' }, { key: 'v', label: 'الكلفة', type: 'iqd' }], rows, chart: top(rows, 'name', 'v'), chartType: 'iqd' }
    },
  },
  {
    id: 'warranty-goodwill', group: 'finance', title: 'كلفة الضمان وحسن النية', question: 'ما الموديلات والقطع التي تكلّفنا ضمانًا أو حسن نية؟',
    run: (d, p) => {
      const rows = d.goodsIssues.filter((g) => !g.canceled && inP(g.date, p)).flatMap((g) => { const w = d.workOrders.find((x) => x.id === g.workOrderId)!; const a = asset(d, w.assetId); return g.lines.filter((l) => ['5420', '5430'].includes(l.expenseAccount)).map((l, i) => ({ id: `${g.id}-${i}`, link: woLink(w), kind: l.expenseAccount === '5420' ? 'ضمان' : 'حسن نية', model: `${a?.brand} ${a?.model}`, item: item(d, l.itemId), tech: tech(d, w.leadTechnicianId), v: l.qty * l.unitCost })) })
      return { columns: [{ key: 'kind', label: 'النوع' }, { key: 'model', label: 'الموديل' }, { key: 'item', label: 'القطعة' }, { key: 'tech', label: 'الفني' }, { key: 'v', label: 'الكلفة', type: 'iqd' }], rows, note: rows.length ? undefined : 'لا كلفة ضمان أو حسن نية مصروفة في الفترة — أمر إعادة العمل الحالي لم يكتمل بعد.' }
    },
  },
  {
    id: 'unapplied-deposits', group: 'finance', title: 'العربون غير المُسوّى', question: 'كم عربون مستلم لم يُسوَّ مع فاتورة؟',
    run: (d, p) => {
      const rows = d.receipts.filter((r) => r.onAccount && unapplied(r) > 0).map((r) => { const w = d.workOrders.find((x) => x.id === r.workOrderId); return { id: r.id, link: w ? woLink(w) : undefined, no: r.number, cust: partner(d, r.partnerId), wo: w?.number, st: w ? woStatus[w.status].label : '—', v: unapplied(r), age: diffDays(p.today, r.date) } })
      return { columns: [{ key: 'no', label: 'سند القبض', type: 'code' }, { key: 'cust', label: 'العميل' }, { key: 'wo', label: 'أمر العمل', type: 'code' }, { key: 'st', label: 'حالة الأمر' }, { key: 'v', label: 'غير مُسوّى', type: 'iqd' }, { key: 'age', label: 'العمر', type: 'days' }], rows, headline: `${sum(rows, (r) => r.v).toLocaleString('en-US')} د.ع` }
    },
  },
  {
    id: 'not-invoiced', group: 'finance', title: 'مكتملة غير مفوترة', question: 'أي إيراد متأخر لأن الفاتورة لم تصدر؟',
    run: (d, p) => {
      const rows = d.workOrders.filter((w) => ['completed', 'closed'].includes(w.status) && ['notInvoiced', 'invoiceCancelled'].includes(w.billingStatus)).map((w) => ({ id: w.id, link: woLink(w), no: w.number, cust: partner(d, w.billingPartnerId), end: w.actualEnd, age: diffDays(p.today, w.actualEnd!), cons: w.consumptionStatus === 'posted' || w.consumptionStatus === 'notRequired' ? 'جاهز' : 'الصرف معلّق' }))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'cust', label: 'العميل' }, { key: 'end', label: 'اكتمل', type: 'date' }, { key: 'age', label: 'منذ', type: 'days' }, { key: 'cons', label: 'الصرف' }], rows }
    },
  },
  {
    id: 'receivables', group: 'finance', title: 'الذمم المفتوحة', question: 'من يدين لنا وبكم؟',
    run: (d, p) => {
      const g = group(d.invoices.filter((i) => !i.canceled && balance(i) > 0), (i) => i.partnerId)
      const rows = Object.entries(g).map(([pid, is]) => ({ id: pid, cust: partner(d, pid), n: is.length, v: sum(is, balance), oldest: Math.max(...is.map((i) => diffDays(p.today, i.date))), link: '/billing?tab=invoices' }))
      return { columns: [{ key: 'cust', label: 'العميل' }, { key: 'n', label: 'فواتير', type: 'num' }, { key: 'v', label: 'المتبقي', type: 'iqd' }, { key: 'oldest', label: 'أقدم فاتورة', type: 'days' }], rows, chart: top(rows, 'cust', 'v'), chartType: 'iqd' }
    },
  },
  {
    id: 'reclass', group: 'finance', title: 'إعادة تصنيف المصروف (مؤقت حتى I2)', question: 'كم سيُرحَّل إلى تكلفة المبيعات وهو في الحقيقة مصروف آخر؟',
    run: (d, p) => {
      const lines = d.goodsIssues.filter((g) => !g.canceled && inP(g.date, p)).flatMap((g) => g.lines).filter((l) => l.expenseAccount !== d.settings.cogsAccount)
      const g = group(lines, (l) => l.expenseAccount)
      const rows = Object.entries(g).map(([a, ls]) => ({ id: a, intended: `${a} ${ls[0].expenseAccountName}`, posted: `${d.settings.cogsAccount} تكلفة المبيعات`, v: sum(ls, (l) => l.qty * l.unitCost) }))
      return { columns: [{ key: 'intended', label: 'الحساب المقصود' }, { key: 'posted', label: 'يُرحَّل حاليًا إلى' }, { key: 'v', label: 'المبلغ', type: 'iqd' }], rows, note: 'إلى أن يُضاف تخصيص الحساب في سند الصرف (I2)، تُرحَّل هذه المبالغ إلى تكلفة المبيعات وتحتاج قيد إعادة تصنيف.' }
    },
  },
  // ---------- 28.5 assets & customers ----------
  {
    id: 'asset-cost', group: 'assets', title: 'الكلفة التراكمية لكل أصل', question: 'أي أصول تكلّف أكثر في الصيانة؟',
    run: (d, p) => {
      const g = group(finished(d, p), (w) => w.assetId)
      const rows = Object.entries(g).map(([a, ws]) => ({ id: a, link: `/assets/${a}`, asset: asset(d, a)?.name, owner: asset(d, a)?.ownerKind === 'company' ? 'الشركة' : partner(d, asset(d, a)!.ownerPartnerId), n: ws.length, cost: sum(ws, (w) => woCost(d, w).total) }))
      return { columns: [{ key: 'asset', label: 'الأصل' }, { key: 'owner', label: 'المالك' }, { key: 'n', label: 'زيارات', type: 'num' }, { key: 'cost', label: 'الكلفة', type: 'iqd' }], rows: rows.sort((a, b) => b.cost - a.cost), chart: top(rows, 'asset', 'cost'), chartType: 'iqd' }
    },
  },
  {
    id: 'top-customers', group: 'assets', title: 'أهم العملاء', question: 'من يدرّ أكثر إيراد وزيارات؟',
    run: (d, p) => {
      const g = group(d.invoices.filter((i) => !i.canceled && inP(i.date, p)), (i) => i.partnerId)
      const total = sum(Object.values(g).flat(), (i) => i.total)
      const rows = Object.entries(g).map(([pid, is]) => ({ id: pid, cust: partner(d, pid), visits: new Set(is.map((i) => i.workOrderId)).size, rev: sum(is, (i) => i.total), share: total ? (sum(is, (i) => i.total) / total) * 100 : 0 }))
      return { columns: [{ key: 'cust', label: 'العميل' }, { key: 'visits', label: 'زيارات', type: 'num' }, { key: 'rev', label: 'الإيراد', type: 'iqd' }, { key: 'share', label: 'الحصة', type: 'pct' }], rows: rows.sort((a, b) => b.rev - a.rev), chart: top(rows, 'cust', 'rev'), chartType: 'iqd' }
    },
  },
  {
    id: 'vehicle-history', group: 'assets', title: 'سجل خدمة المركبات', question: 'متى وعند أي عداد خُدمت كل مركبة؟',
    run: (d, p) => {
      const rows = finished(d, p).filter((w) => d.vehicles.some((v) => v.assetId === w.assetId)).map((w) => ({ id: w.id, link: woLink(w), plate: d.vehicles.find((v) => v.assetId === w.assetId)?.plate, asset: asset(d, w.assetId)?.name, date: w.actualEnd, km: w.meterAtHandover, type: typeName(d, w.maintenanceTypeId), code: fc(d, w.failureCodeId)?.code ?? '' }))
      return { columns: [{ key: 'plate', label: 'اللوحة' }, { key: 'asset', label: 'المركبة' }, { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'km', label: 'العداد', type: 'num' }, { key: 'type', label: 'النوع' }, { key: 'code', label: 'العطل', type: 'code' }], rows: rows.sort((a, b) => String(b.date).localeCompare(String(a.date))) }
    },
  },
  // ---------- 28.6 stock ----------
  {
    id: 'parts-consumption', group: 'stock', title: 'استهلاك القطع', question: 'ما الكميات والكلف المصروفة لكل قطعة؟',
    run: (d, p) => {
      const g = group(d.goodsIssues.filter((x) => !x.canceled && inP(x.date, p)).flatMap((x) => x.lines), (l) => l.itemId)
      const rows = Object.entries(g).map(([i, ls]) => ({ id: i, item: item(d, i), qty: sum(ls, (l) => l.qty), cost: sum(ls, (l) => l.qty * l.unitCost), onHand: d.stock.find((s) => s.itemId === i)?.onHand ?? 0 }))
      return { columns: [{ key: 'item', label: 'القطعة' }, { key: 'qty', label: 'الكمية', type: 'num' }, { key: 'cost', label: 'الكلفة', type: 'iqd' }, { key: 'onHand', label: 'الرصيد الحالي', type: 'num' }], rows: rows.sort((a, b) => b.cost - a.cost), chart: top(rows, 'item', 'cost'), chartType: 'iqd' }
    },
  },
  {
    id: 'waiting-parts', group: 'stock', title: 'أوامر بانتظار قطع', question: 'ما القطع الناقصة التي توقف العمل؟',
    run: (d, p) => {
      const rows = d.workOrders.filter((w) => w.status === 'waitingParts' || (['planned', 'scheduled'].includes(w.status) && reservationShortages(d, w).length)).flatMap((w) => reservationShortages(d, w).map((s) => ({ id: `${w.id}-${s.itemId}`, link: woLink(w), no: w.number, item: s.name, need: s.need, avail: s.available, st: woStatus[w.status].label, wait: diffDays(p.today, w.statusHistory[w.statusHistory.length - 1].at) })))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'item', label: 'القطعة الناقصة' }, { key: 'need', label: 'مطلوب', type: 'num' }, { key: 'avail', label: 'متاح', type: 'num' }, { key: 'st', label: 'الحالة' }, { key: 'wait', label: 'منذ', type: 'days' }], rows, headline: `${new Set(rows.map((r) => r.item)).size} قطعة ناقصة توقف ${new Set(rows.map((r) => r.no)).size} أمر` }
    },
  },
  {
    id: 'removed-parts', group: 'stock', title: 'القطع المُزالة ومصيرها', question: 'ما الذي أُعيد للعميل أو أُتلف أو أُرجع للمورد؟',
    run: (d) => {
      const disp = { returnedToCustomer: 'أُعيدت للعميل', scrapped: 'أُتلفت', returnedToVendor: 'أُرجعت للمورد' } as const
      const rows = d.workOrders.flatMap((w) => w.removedParts.map((r) => ({ id: r.id, link: woLink(w), no: w.number, desc: r.description, serial: r.serial ?? '', disp: disp[r.disposition] })))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'desc', label: 'القطعة' }, { key: 'serial', label: 'التسلسلي', type: 'code' }, { key: 'disp', label: 'المصير' }], rows }
    },
  },
  // ---------- 28.7 approval ----------
  {
    id: 'approval-cycle', group: 'approval', title: 'زمن دورة الاعتماد', question: 'كم يستغرق كل معتمِد ومستوى لاتخاذ القرار؟',
    run: (d, p) => {
      const decided = d.approvals.filter((a) => a.decidedAt && a.decidedBy && a.decidedBy !== 'system' && inP(a.decidedAt, p))
      const g = group(decided, (a) => `${a.level}|${a.decidedBy}`)
      const rows = Object.entries(g).map(([k, as]) => { const [lvl, u] = k.split('|'); return { id: k, who: d.users.find((x) => x.id === u)?.name, lvl: Number(lvl), n: as.length, avg: sum(as, (a) => hoursBetween(a.submittedAt, a.decidedAt!)) / as.length } })
      const pending = d.approvals.filter((a) => a.status === 'pending').length
      return { columns: [{ key: 'who', label: 'المعتمِد' }, { key: 'lvl', label: 'المستوى', type: 'num' }, { key: 'n', label: 'قرارات', type: 'num' }, { key: 'avg', label: 'متوسط الساعات', type: 'hours' }], rows, chart: top(rows, 'who', 'avg'), chartType: 'hours', headline: `${pending} بانتظار القرار الآن` }
    },
  },
  {
    id: 'rejections', group: 'approval', title: 'الرفض والسحب', question: 'من تُرفض أو تُسحب تقديراته أكثر ولماذا؟',
    run: (d, p) => {
      const sub = d.approvals.filter((a) => a.level <= 1 && inP(a.submittedAt, p) && a.status !== 'waiting')
      const g = group(sub, (a) => a.submittedBy)
      const rows = Object.entries(g).map(([u, as]) => { const rej = as.filter((a) => a.status === 'rejected'); return { id: u, who: d.users.find((x) => x.id === u)?.name, n: as.length, rej: rej.length, wd: as.filter((a) => a.status === 'withdrawn').length, rate: as.length ? (rej.length / as.length) * 100 : 0, why: rej.map((a) => a.comment).filter(Boolean).join('؛ ') } })
      return { columns: [{ key: 'who', label: 'المقدِّم' }, { key: 'n', label: 'جولات', type: 'num' }, { key: 'rej', label: 'مرفوضة', type: 'num' }, { key: 'wd', label: 'مسحوبة', type: 'num' }, { key: 'rate', label: 'نسبة الرفض', type: 'pct' }, { key: 'why', label: 'الأسباب' }], rows }
    },
  },
  {
    id: 'acceptance', group: 'approval', title: 'موافقة العملاء', question: 'كم عرضًا يقبله العملاء أو يرفضونه أو ينتهي بلا رد؟',
    run: (d) => {
      const es = d.estimates.filter((e) => d.partners.find((p) => p.id === e.partnerId)?.kind === 'customer' && ['approved', 'expired'].includes(e.status))
      const rows = [
        { id: 'a', k: 'وافق', n: es.filter((e) => e.customerAcceptance?.decision === 'accepted').length },
        { id: 'd', k: 'رفض', n: es.filter((e) => e.customerAcceptance?.decision === 'declined').length },
        { id: 'x', k: 'انتهى بلا رد', n: es.filter((e) => e.status === 'expired').length },
        { id: 'w', k: 'بانتظار الرد', n: es.filter((e) => e.status === 'approved' && !e.customerAcceptance).length },
      ]
      const t = sum(rows, (r) => r.n)
      return { columns: [{ key: 'k', label: 'النتيجة' }, { key: 'n', label: 'عروض', type: 'num' }, { key: 'pct', label: 'النسبة', type: 'pct' }], rows: rows.map((r) => ({ ...r, pct: t ? (r.n / t) * 100 : 0 })), chart: rows.map((r) => ({ label: r.k, value: r.n })) }
    },
  },
  // ---------- 38.6 scheduling ----------
  {
    id: 'sched-util', group: 'schedule', title: 'استغلال جدول الفنيين', question: 'كم من الساعات المتاحة محجوزة لكل فني؟',
    run: (d, p) => {
      const rows = d.technicians.filter((t) => t.active).map((t) => {
        const booked = sum(d.bookings.filter((b) => b.status !== 'cancelled' && b.technicianIds.includes(t.id) && inP(b.date, p)), bookingHours)
        const avail = sum(d.attendance.filter((a) => a.technicianId === t.id && inP(a.date, p)), (a) => Math.min(a.hours, 8))
        return { id: t.id, tech: t.name, booked, avail, util: avail ? (booked / avail) * 100 : 0 }
      })
      return { columns: [{ key: 'tech', label: 'الفني' }, { key: 'booked', label: 'محجوز', type: 'hours' }, { key: 'avail', label: 'متاح (حضور)', type: 'hours' }, { key: 'util', label: 'الاستغلال', type: 'pct' }], rows, chart: top(rows, 'tech', 'booked'), chartType: 'hours', note: 'المتاح من الحضور المستورد (حتى أمس)؛ الحجوزات القادمة لا يقابلها حضور بعد.' }
    },
  },
  {
    id: 'booked-vs-logged', group: 'schedule', title: 'الساعات المحجوزة مقابل المسجّلة', question: 'هل تقدير مدة الحجز واقعي؟',
    run: (d, p) => {
      const rows = d.workOrders.filter((w) => w.bookingIds.length && w.timeEntries.length).map((w) => {
        const bs = d.bookings.filter((b) => w.bookingIds.includes(b.id) && b.status !== 'cancelled' && inP(b.date, p))
        const booked = sum(bs, (b) => bookingHours(b) * b.technicianIds.length / b.stops.length)
        const logged = sum(w.timeEntries, (e) => e.hours)
        return { id: w.id, link: woLink(w), no: w.number, type: typeName(d, w.maintenanceTypeId), booked, logged, diff: logged - booked }
      }).filter((r) => r.booked > 0)
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'type', label: 'النوع' }, { key: 'booked', label: 'محجوز', type: 'hours' }, { key: 'logged', label: 'مسجّل', type: 'hours' }, { key: 'diff', label: 'الفرق', type: 'hours' }], rows }
    },
  },
  {
    id: 'on-time', group: 'schedule', title: 'الوصول في الموعد (ميداني)', question: 'كم زيارة بدأت ضمن الفترة المحددة؟',
    run: (d, p) => {
      const rows = d.bookings.filter((b) => b.kind === 'field' && b.actualStart && inP(b.date, p)).map((b) => { const late = Math.round(hoursBetween(`${b.date}T${b.start}`, b.actualStart!) * 60); return { id: b.id, no: b.number, date: b.date, slot: `${b.start}–${b.end}`, late, ok: late <= 60 ? 'في الموعد' : 'متأخر' } })
      const ok = rows.filter((r) => r.ok === 'في الموعد').length
      return { columns: [{ key: 'no', label: 'الحجز', type: 'code' }, { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'slot', label: 'الفترة', type: 'code' }, { key: 'late', label: 'دقائق بعد بدء الفترة', type: 'num' }, { key: 'ok', label: 'النتيجة' }], rows, headline: rows.length ? `${Math.round((ok / rows.length) * 100)}% في الموعد (≤ 60 دقيقة)` : undefined }
    },
  },
  {
    id: 'resched-reasons', group: 'schedule', title: 'أسباب إعادة الجدولة والإلغاء', question: 'لماذا تتغير المواعيد؟',
    run: (d, p) => {
      const rows = d.bookings.filter((b) => (b.rescheduleReason || b.cancelReason) && b.date >= p.from).map((b) => ({ id: b.id, no: b.number, kind: b.cancelReason ? 'إلغاء' : 'إعادة جدولة', reason: b.cancelReason ?? b.rescheduleReason, date: b.date }))
      return { columns: [{ key: 'no', label: 'الحجز', type: 'code' }, { key: 'kind', label: 'النوع' }, { key: 'reason', label: 'السبب' }, { key: 'date', label: 'التاريخ', type: 'date' }], rows }
    },
  },
  {
    id: 'to-schedule', group: 'schedule', title: 'أوامر بانتظار الجدولة', question: 'أي أوامر معتمدة لم تُحجز بعد ومنذ متى؟',
    run: (d, p) => {
      const rows = toSchedule(d).map((w) => ({ id: w.id, link: woLink(w), no: w.number, asset: asset(d, w.assetId)?.name, st: woStatus[w.status].label, age: diffDays(p.today, w.createdAt) }))
      return { columns: [{ key: 'no', label: 'أمر العمل', type: 'code' }, { key: 'asset', label: 'الأصل' }, { key: 'st', label: 'الحالة' }, { key: 'age', label: 'منذ', type: 'days' }], rows, chart: top(rows, 'no', 'age'), chartType: 'days' }
    },
  },
]

