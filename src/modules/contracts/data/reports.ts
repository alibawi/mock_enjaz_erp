// Reports R-01…R-18 and the global search (spec BR-R-01…06). Computed views only: every report starts from the contracts the current user may see
// (data authority + confidentiality) and derives everything else from them, so aggregates are filtered before totals.
import { addDays, today } from './asof'
import { convertAmount, rateOn } from './currency'
import { statusLabel } from './contractMeta'
import { daysTo, fmtDate, money, num } from './format'
import { agreementCfg, agreementStats, balanceOf, committedUnits, counterUnits, hasDrift, ledgerSums, remaining } from './fulfillment'
import { amendStatusLabel, amendTypeLabel } from './amendments'
import { canSee, graceEnd, missingSignatureRoles, noticeDeadline, partnerName, typeOf, userName } from './lifecycle'
import { effStatus, isOpen, kindLabel, penaltyOf, statusLabel as oblLabel } from './obligations'
import { overdueDays } from './installments'
import { effItemStatus, financialSummary, payStatusLabel } from './payments'
import { serviceStats } from './service'
import { openRequest } from './approval'
import type { Contract, ContractLine, CurrencyCode, DB } from './types'

export interface Col { key: string; label: string; num?: boolean }
export interface Row { id: string; to?: string; cells: Record<string, string | number | undefined> }
export interface ReportResult { cols: Col[]; rows: Row[]; foot?: Record<string, string | number>; note?: string }
export interface FilterDef { key: string; label: string; options: (db: DB) => { value: string; label: string }[] }
export interface ReportDef { id: string; code: string; title: string; group: string; desc: string; filters: FilterDef[]; build: (db: DB, f: Record<string, string>) => ReportResult }

export const visibleContracts = (db: DB) => db.contracts.filter((c) => canSee(db, c))
const visibleIds = (db: DB) => new Set(visibleContracts(db).map((c) => c.id))
const val = (c: Contract) => (c.contractValue ? money(c.contractValue, c.currency) : '—')
const CURS: CurrencyCode[] = ['IQD', 'USD']

// ───────────── filters ─────────────
const opt = <T extends { id: string }>(a: T[], l: (x: T) => string) => a.map((x) => ({ value: x.id, label: l(x) }))
const F = {
  type: { key: 'type', label: 'النوع', options: (db: DB) => opt(db.contractTypes, (t) => t.name) },
  direction: { key: 'direction', label: 'الاتجاه', options: () => [{ value: 'Outgoing', label: 'صادر (مبيعات)' }, { value: 'Incoming', label: 'وارد (مشتريات)' }, { value: 'Internal', label: 'داخلي' }] },
  org: { key: 'org', label: 'المنشأة', options: (db: DB) => opt(db.organizations, (o) => o.name) },
  partner: { key: 'partner', label: 'الطرف', options: (db: DB) => opt(db.partners, (p) => p.name) },
  status: { key: 'status', label: 'الحالة', options: () => Object.entries(statusLabel).map(([value, label]) => ({ value, label })) },
  item: { key: 'item', label: 'الصنف', options: (db: DB) => opt(db.items, (i) => i.name) },
  contract: { key: 'contract', label: 'العقد', options: (db: DB) => opt(db.contracts.filter((c) => c.profile === 'Agreement'), (c) => c.number) },
  days: { key: 'days', label: 'خلال', options: () => [{ value: '30', label: '30 يوماً' }, { value: '60', label: '60 يوماً' }, { value: '90', label: '90 يوماً' }] },
  cur: { key: 'cur', label: 'عملة التقرير', options: () => [{ value: 'IQD', label: 'تحويل إلى الدينار (بسعر اليوم)' }] },
}
const baseFilters = [F.type, F.direction, F.org]
const applyBase = (db: DB, list: Contract[], f: Record<string, string>) =>
  list.filter((c) => (!f.type || c.typeId === f.type) && (!f.direction || c.direction === f.direction) && (!f.org || c.organizationId === f.org) && (!f.partner || c.counterpartyId === f.partner) && (!f.status || c.status === f.status) && (!f.contract || c.id === f.contract) && canSee(db, c))

// ───────────── contract listings ─────────────
const contractCols: Col[] = [
  { key: 'number', label: 'الرقم' }, { key: 'title', label: 'العنوان' }, { key: 'partner', label: 'الطرف' }, { key: 'type', label: 'النوع' }, { key: 'status', label: 'الحالة' },
  { key: 'value', label: 'القيمة', num: true }, { key: 'start', label: 'البداية' }, { key: 'end', label: 'النهاية' },
]
const contractRow = (db: DB, c: Contract, extra: Row['cells'] = {}): Row => ({
  id: c.id, to: `/contracts/${c.id}`,
  cells: { number: c.number, title: c.title, partner: partnerName(db, c), type: typeOf(db, c).name, status: statusLabel[c.status], value: val(c), start: fmtDate(c.startDate), end: c.endDate ? fmtDate(c.endDate) : 'مفتوح', ...extra },
})
/** Per-currency value totals as a footer map (BR-R-02: never summed across currencies). */
const perCurrency = (list: Contract[]) => Object.fromEntries(CURS.map((cur) => [cur, list.filter((c) => c.currency === cur).reduce((s, c) => s + (c.contractValue ?? 0), 0)])) as Record<CurrencyCode, number>
const curFoot = (list: Contract[]) => { const t = perCurrency(list); return `${num(t.IQD)} IQD + ${num(t.USD, 2)} USD` }
const listReport = (id: string, code: string, title: string, desc: string, pick: (db: DB, f: Record<string, string>) => Contract[], extraCols: Col[] = [], extra?: (db: DB, c: Contract) => Row['cells'], filters: FilterDef[] = baseFilters): ReportDef => ({
  id, code, title, group: 'العقود', desc, filters,
  build: (db, f) => { const list = pick(db, f); return { cols: [...contractCols, ...extraCols], rows: list.map((c) => contractRow(db, c, extra?.(db, c))), foot: { number: `${list.length} عقد`, value: curFoot(list) } } },
})
const active = (db: DB, f: Record<string, string>) => applyBase(db, db.contracts.filter((c) => c.status === 'Active'), f)

// ───────────── grouped reports ─────────────
function groupReport(group: (db: DB, c: Contract) => { key: string; label: string }, firstLabel: string): (db: DB, f: Record<string, string>) => ReportResult {
  return (db, f) => {
    const list = applyBase(db, db.contracts, f)
    const m = new Map<string, { label: string; cs: Contract[] }>()
    list.forEach((c) => { const g = group(db, c); m.set(g.key, { label: g.label, cs: [...(m.get(g.key)?.cs ?? []), c] }) })
    const rows: Row[] = [...m.entries()].map(([k, g]) => ({ id: k, cells: { name: g.label, count: g.cs.length, active: g.cs.filter((c) => c.status === 'Active').length, iqd: money(perCurrency(g.cs).IQD, 'IQD'), usd: money(perCurrency(g.cs).USD, 'USD') } }))
    return { cols: [{ key: 'name', label: firstLabel }, { key: 'count', label: 'العقود', num: true }, { key: 'active', label: 'سارية', num: true }, { key: 'iqd', label: 'القيمة (IQD)', num: true }, { key: 'usd', label: 'القيمة (USD)', num: true }], rows, foot: { name: 'الإجمالي', count: list.length, active: list.filter((c) => c.status === 'Active').length, iqd: money(perCurrency(list).IQD, 'IQD'), usd: money(perCurrency(list).USD, 'USD') }, note: 'القيم بكل عملة على حدة ولا تُجمع عبر العملات (BR-R-02).' }
  }
}
function valueReport(by: 'partner' | 'org'): (db: DB, f: Record<string, string>) => ReportResult {
  return (db, f) => {
    const list = applyBase(db, db.contracts.filter((c) => !['Draft', 'Cancelled'].includes(c.status)), f)
    const m = new Map<string, Contract[]>()
    list.forEach((c) => { const k = by === 'partner' ? c.counterpartyId ?? c.counterpartyName ?? '—' : c.organizationId; m.set(k, [...(m.get(k) ?? []), c]) })
    const label = (k: string) => (by === 'partner' ? db.partners.find((p) => p.id === k)?.name ?? k : db.organizations.find((o) => o.id === k)?.name ?? k)
    const conv = f.cur === 'IQD'
    const total = (cs: Contract[]) => cs.reduce((s, c) => s + convertAmount(db, c.contractValue ?? 0, c.currency, 'IQD', today()), 0)
    const rows: Row[] = [...m.entries()].map(([k, cs]) => ({ id: k, cells: conv
      ? { name: label(k), count: cs.length, total: money(total(cs), 'IQD') }
      : { name: label(k), count: cs.length, iqd: money(perCurrency(cs).IQD, 'IQD'), usd: money(perCurrency(cs).USD, 'USD'), active: cs.filter((c) => c.status === 'Active').length } }))
      .sort((a, b) => (b.cells.count as number) - (a.cells.count as number))
    const cols: Col[] = conv ? [{ key: 'name', label: by === 'partner' ? 'الطرف' : 'المنشأة' }, { key: 'count', label: 'العقود', num: true }, { key: 'total', label: 'القيمة (IQD)', num: true }]
      : [{ key: 'name', label: by === 'partner' ? 'الطرف' : 'المنشأة' }, { key: 'count', label: 'العقود', num: true }, { key: 'active', label: 'سارية', num: true }, { key: 'iqd', label: 'القيمة (IQD)', num: true }, { key: 'usd', label: 'القيمة (USD)', num: true }]
    return { cols, rows, foot: (conv ? { name: 'الإجمالي', total: money(total(list), 'IQD') } : { name: 'الإجمالي', iqd: money(perCurrency(list).IQD, 'IQD'), usd: money(perCurrency(list).USD, 'USD') }) as Record<string, string>,
      note: conv ? `محوّلة إلى الدينار بسعر اليوم: 1 USD = ${num(rateOn(db, 'USD', today()))} IQD` : 'القيم بكل عملة على حدة؛ اختر «عملة التقرير» لتحويلها بسعر معلن.' }
  }
}

// ───────────── fulfillment ─────────────
const lineRows = (db: DB, f: Record<string, string>) => {
  const ids = new Set(applyBase(db, db.contracts.filter((c) => c.profile === 'Agreement'), f).map((c) => c.id))
  return db.lines.filter((l) => ids.has(l.contractId) && (!f.item || l.itemId === f.item))
}
const lineName = (db: DB, l: ContractLine) => l.itemId ? db.items.find((i) => i.id === l.itemId)?.name ?? l.description : `${db.categories.find((k) => k.id === l.categoryId)?.name ?? ''} (تصنيف)`
const u = (db: DB, c: Contract, l: ContractLine, n: number) => (l.commitmentType === 'Quantity' ? `${num(n, Number.isInteger(n) ? 0 : 2)} ${db.uoms.find((x) => x.id === l.uomId)?.name ?? ''}` : money(n, c.currency))

// ───────────── registry ─────────────
export const reports: ReportDef[] = [
  { id: 'by-status', code: 'R-01', title: 'العقود حسب الحالة', group: 'العقود', desc: 'عدد وقيمة العقود في كل حالة', filters: baseFilters, build: groupReport((_db, c) => ({ key: c.status, label: statusLabel[c.status] }), 'الحالة') },
  { id: 'by-type', code: 'R-02', title: 'العقود حسب النوع', group: 'العقود', desc: 'عدد وقيمة العقود لكل نوع', filters: [F.direction, F.org], build: groupReport((db, c) => ({ key: c.typeId, label: typeOf(db, c).name }), 'النوع') },
  listReport('active', 'R-03', 'العقود السارية', 'كل العقود السارية بقيمها', (db, f) => active(db, f)),
  { id: 'expiring', code: 'R-04', title: 'عقود تنتهي أو تقترب مهلة إشعارها', group: 'العقود', desc: 'خلال عدد الأيام المحدد', filters: [F.days, ...baseFilters],
    build: (db, f) => {
      const n = Number(f.days || 30)
      const list = applyBase(db, db.contracts.filter((c) => ['Active', 'OnHold'].includes(c.status) && c.endDate), f)
        .filter((c) => daysTo(c.endDate!) >= 0 && daysTo(c.endDate!) <= n || (noticeDeadline(c) && c.renewalPolicy !== 'None' && daysTo(noticeDeadline(c)!) >= 0 && daysTo(noticeDeadline(c)!) <= n)).sort((a, b) => a.endDate!.localeCompare(b.endDate!))
      return { cols: [...contractCols, { key: 'left', label: 'المتبقي', num: true }, { key: 'notice', label: 'مهلة الإشعار' }, { key: 'policy', label: 'التجديد' }],
        rows: list.map((c) => contractRow(db, c, { left: `${daysTo(c.endDate!)} يوم`, notice: noticeDeadline(c) && c.renewalPolicy !== 'None' ? fmtDate(noticeDeadline(c)) : '—', policy: c.renewalPolicy === 'Auto' ? 'تلقائي' : c.renewalPolicy === 'Manual' ? 'يدوي' : 'بلا' })), foot: { number: `${list.length} عقد`, value: curFoot(list) } }
    } },
  listReport('expired', 'R-05', 'العقود المنتهية', 'منتهية ضمن مدة السماح وخارجها', (db, f) => applyBase(db, db.contracts.filter((c) => c.status === 'Expired'), f), [{ key: 'grace', label: 'مدة السماح' }],
    (db, c) => { const g = graceEnd(db, c); return { grace: g ? (daysTo(g) >= 0 ? `متبقٍ ${daysTo(g)} يوم` : 'انتهت') : '—' } }),
  listReport('awaiting-approval', 'R-06', 'بانتظار الاعتماد', 'مع المرحلة الحالية والمعتمد', (db, f) => applyBase(db, db.contracts.filter((c) => c.status === 'PendingApproval'), f), [{ key: 'stage', label: 'المرحلة الحالية' }, { key: 'approver', label: 'المعتمد' }],
    (db, c) => { const r = openRequest(db, 'Contract', c.id); const s = r?.stages.find((x) => x.no === r.currentStage); return { stage: s ? `${s.no}. ${s.label}` : '—', approver: s ? userName(db, s.userId) : '—' } }),
  listReport('awaiting-signature', 'R-07', 'بانتظار التوقيع', 'مع الأدوار الناقصة', (db, f) => applyBase(db, db.contracts.filter((c) => ['Approved', 'PendingSignature'].includes(c.status)), f), [{ key: 'missing', label: 'تواقيع ناقصة' }],
    (db, c) => ({ missing: missingSignatureRoles(db, c).map((r) => (r === 'Company' ? 'الشركة' : r === 'Counterparty' ? 'الطرف الآخر' : r)).join('، ') || '—' })),
  listReport('renewal', 'R-08', 'عقود تحتاج تجديداً', 'سارية أو منتهية بلا عقد لاحق وتنتهي خلال 90 يوماً', (db, f) => applyBase(db, db.contracts.filter((c) => !c.successorContractId && c.endDate && (c.status === 'Expired' || (['Active', 'OnHold'].includes(c.status) && daysTo(c.endDate) <= 90))), f), [{ key: 'policy', label: 'التجديد' }],
    (_db, c) => ({ policy: c.renewalPolicy === 'Auto' ? 'تلقائي' : c.renewalPolicy === 'Manual' ? 'يدوي' : 'بلا' })),

  { id: 'fulfillment', code: 'R-09', title: 'تنفيذ الالتزامات', group: 'التنفيذ', desc: 'الملتزم والمحجوز والمنفّذ والمفوتر لكل بند', filters: [F.partner, F.item, F.org, F.contract, F.direction],
    build: (db, f) => {
      const ls = lineRows(db, f)
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'partner', label: 'الطرف' }, { key: 'line', label: 'البند' }, { key: 'committed', label: 'الملتزم', num: true }, { key: 'released', label: 'المحجوز', num: true }, { key: 'fulfilled', label: 'المنفّذ', num: true }, { key: 'invoiced', label: 'المفوتر', num: true }, { key: 'pct', label: '% (حسب الأساس)', num: true }],
        rows: ls.map((l) => { const c = db.contracts.find((x) => x.id === l.contractId)!, b = balanceOf(db, l.id); return { id: l.id, to: `/contracts/${c.id}`, cells: { contract: c.number, partner: partnerName(db, c), line: `${l.lineNum}. ${lineName(db, l)}`, committed: u(db, c, l, committedUnits(l)), released: u(db, c, l, counterUnits(l, b, 'Release')), fulfilled: u(db, c, l, counterUnits(l, b, 'Fulfill')), invoiced: u(db, c, l, counterUnits(l, b, 'Invoice')), pct: `${num(remaining(db, c, l).pct, 1)}%` } } }),
        foot: { contract: `${ls.length} بند` }, note: 'الكميات بوحدات البنود؛ بنود القيمة بعملة العقد.' }
    } },
  { id: 'remaining', code: 'R-10', title: 'الالتزامات المتبقية', group: 'التنفيذ', desc: 'المتبقي من كل بند بحسب أساس الاستهلاك', filters: [F.partner, F.item, F.org, F.contract, F.direction],
    build: (db, f) => {
      const ls = lineRows(db, f).filter((l) => l.status === 'Open')
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'partner', label: 'الطرف' }, { key: 'line', label: 'البند' }, { key: 'left', label: 'المتبقي', num: true }, { key: 'pct', label: 'المستهلك %', num: true }, { key: 'end', label: 'ينتهي' }],
        rows: ls.map((l) => { const c = db.contracts.find((x) => x.id === l.contractId)!, r = remaining(db, c, l); return { id: l.id, to: `/contracts/${c.id}`, cells: { contract: c.number, partner: partnerName(db, c), line: `${l.lineNum}. ${lineName(db, l)}`, left: u(db, c, l, r.left), pct: `${num(r.pct, 1)}%`, end: fmtDate(c.endDate) } } }).sort((a, b) => parseFloat(String(b.cells.pct)) - parseFloat(String(a.cells.pct))),
        note: `الأساس: ${db.contracts.find((c) => c.profile === 'Agreement') ? { Order: 'الأمر', Delivery: 'التسليم', Invoice: 'الفاتورة' }[agreementCfg(db, db.contracts.find((c) => c.profile === 'Agreement')!).basis] : ''} — مرتبة من الأقرب للنفاد.` }
    } },
  { id: 'value-partner', code: 'R-11', title: 'القيمة حسب الطرف', group: 'القيمة', desc: 'عقود وقيم كل عميل/مورد', filters: [F.type, F.direction, F.org, F.cur], build: valueReport('partner') },
  { id: 'value-org', code: 'R-12', title: 'القيمة حسب المنشأة', group: 'القيمة', desc: 'عقود وقيم كل منشأة', filters: [F.type, F.direction, F.cur], build: valueReport('org') },

  { id: 'amendments', code: 'R-13', title: 'سجل الملاحق', group: 'المتابعة', desc: 'كل الملاحق وحالاتها', filters: [F.type],
    build: (db, f) => {
      const ids = visibleIds(db)
      const list = db.amendments.filter((a) => ids.has(a.contractId) && (!f.type || db.contracts.find((c) => c.id === a.contractId)?.typeId === f.type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'no', label: 'الملحق', num: true }, { key: 'type', label: 'النوع' }, { key: 'reason', label: 'السبب' }, { key: 'eff', label: 'السريان' }, { key: 'status', label: 'الحالة' }, { key: 'ver', label: 'الإصدار' }],
        rows: list.map((a) => ({ id: a.id, to: `/contracts/${a.contractId}/amendments/${a.id}`, cells: { contract: db.contracts.find((c) => c.id === a.contractId)?.number, no: a.amendmentNo, type: amendTypeLabel[a.type], reason: a.reason, eff: fmtDate(a.effectiveDate), status: amendStatusLabel[a.status], ver: a.appliedVersionNo ? `v${a.appliedVersionNo}` : '—' } })), foot: { contract: `${list.length} ملحق` } }
    } },
  { id: 'obligations', code: 'R-14', title: 'الالتزامات والمراحل المتأخرة', group: 'المتابعة', desc: 'الالتزامات المفتوحة والمتأخرة وغراماتها', filters: [{ key: 'only', label: 'العرض', options: () => [{ value: 'overdue', label: 'المتأخرة فقط' }, { value: 'milestones', label: 'المراحل فقط' }] }],
    build: (db, f) => {
      const ids = visibleIds(db)
      const list = db.obligations.filter((o) => ids.has(o.contractId) && isOpen(o) && (f.only !== 'overdue' || effStatus(o) === 'Overdue') && (f.only !== 'milestones' || o.kind === 'Milestone')).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      return { cols: [{ key: 'title', label: 'الالتزام' }, { key: 'kind', label: 'النوع' }, { key: 'contract', label: 'العقد' }, { key: 'who', label: 'المسؤول' }, { key: 'due', label: 'الاستحقاق' }, { key: 'status', label: 'الحالة' }, { key: 'late', label: 'أيام التأخير', num: true }, { key: 'pen', label: 'غرامة (عرض)', num: true }],
        rows: list.map((o) => { const c = db.contracts.find((x) => x.id === o.contractId)!, st = effStatus(o); return { id: o.id, to: `/contracts/${c.id}`, cells: { title: o.title, kind: kindLabel[o.kind], contract: c.number, who: db.employees.find((e) => e.id === o.responsibleEmployeeId)?.name ?? '—', due: fmtDate(o.dueDate), status: oblLabel[st], late: st === 'Overdue' ? -daysTo(o.dueDate) : '—', pen: penaltyOf(o) ? money(penaltyOf(o), c.currency) : '—' } } }),
        foot: { title: `${list.length} التزام`, late: `${list.filter((o) => effStatus(o) === 'Overdue').length} متأخر` } }
    } },
  { id: 'exposure', code: 'R-15', title: 'التعرض المالي', group: 'المتابعة', desc: 'المفوتر والمدفوع والمستحق والمحتجز والغرامات والضمانات', filters: [F.type, F.org],
    build: (db, f) => {
      const list = applyBase(db, db.contracts.filter((c) => ['Active', 'OnHold', 'Expired', 'Terminated'].includes(c.status)), f)
      const rows: Row[] = list.map((c) => { const s = financialSummary(db, c), g = db.guarantees.filter((x) => x.contractId === c.id && x.status === 'Active').reduce((a, x) => a + x.amount, 0); return { id: c.id, to: `/contracts/${c.id}`, cells: { contract: c.number, partner: partnerName(db, c), cur: c.currency, invoiced: money(s.invoicedValue, c.currency), paid: s.unsettled ? 'غير متاح' : money(s.paidValue, c.currency), out: s.outstanding === null ? 'غير متاح' : money(s.outstanding, c.currency), ret: money(s.retentionHeld, c.currency), pen: money(s.penaltiesAccrued, c.currency), gar: g ? money(g, c.currency) : '—' } } })
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'partner', label: 'الطرف' }, { key: 'cur', label: 'العملة' }, { key: 'invoiced', label: 'المفوتر', num: true }, { key: 'paid', label: 'المدفوع', num: true }, { key: 'out', label: 'المستحق', num: true }, { key: 'ret', label: 'المحتجز', num: true }, { key: 'pen', label: 'غرامات (عرض)', num: true }, { key: 'gar', label: 'ضمانات فعّالة', num: true }], rows, note: 'بعملة كل عقد؛ «غير متاح» حين لا تتوفر تسوية Finance للفواتير.' }
    } },
  { id: 'sla', code: 'R-16', title: 'أداء مستوى الخدمة', group: 'المتابعة', desc: 'ضمن المهلة والخروقات واستهلاك الساعات لعقود الخدمة', filters: [F.org],
    build: (db, f) => {
      const list = applyBase(db, db.contracts.filter((c) => c.profile === 'Service'), f)
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'partner', label: 'العميل' }, { key: 'calls', label: 'بلاغات', num: true }, { key: 'pct', label: 'ضمن SLA', num: true }, { key: 'br', label: 'خروقات', num: true }, { key: 'hours', label: 'الساعات (مستهلك/مشمول)', num: true }, { key: 'visits', label: 'الزيارات', num: true }],
        rows: list.map((c) => { const s = serviceStats(db, c); return { id: c.id, to: `/contracts/${c.id}`, cells: { contract: c.number, partner: partnerName(db, c), calls: s.calls, pct: s.slaPct === undefined ? '—' : `${s.slaPct.toFixed(0)}%`, br: s.breaches, hours: `${s.hours} / ${s.level?.includedHours ?? '—'}`, visits: `${s.visits} / ${s.level?.includedVisits ?? '—'}` } } }) }
    } },
  { id: 'drift', code: 'R-17', title: 'انحراف التنفيذ', group: 'المتابعة', desc: 'مطابقة أرصدة البنود مع دفتر التنفيذ — يجب أن تكون صفراً', filters: [F.contract],
    build: (db, f) => {
      const ls = lineRows(db, f)
      const rows: Row[] = ls.map((l) => { const c = db.contracts.find((x) => x.id === l.contractId)!, s = ledgerSums(db, l.id), b = balanceOf(db, l.id), d = hasDrift(db, l.id); return { id: l.id, to: `/contracts/${c.id}`, cells: { contract: c.number, line: `${l.lineNum}. ${lineName(db, l)}`, ledger: `${num(s.relQ, 2)} / ${num(s.fulQ, 2)} / ${num(s.invQ, 2)}`, bal: `${num(b.relQ, 2)} / ${num(b.fulQ, 2)} / ${num(b.invQ, 2)}`, st: d ? 'انحراف' : 'سليم' } } })
      const bad = rows.filter((r) => r.cells.st === 'انحراف').length
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'line', label: 'البند' }, { key: 'ledger', label: 'الدفتر (محجوز/منفّذ/مفوتر)' }, { key: 'bal', label: 'الرصيد' }, { key: 'st', label: 'الحالة' }], rows, foot: { contract: `${rows.length} بند`, st: bad ? `${bad} منحرف` : 'صفر انحراف' }, note: 'الانحراف يظهر فقط إذا أُفسد رصيد أو فُقد حدث (محاكاة من تبويب التنفيذ)؛ «إعادة الاحتساب» تعالجه.' }
    } },
  { id: 'installments', code: 'R-18', title: 'الأقساط المستحقة والمتأخرة', group: 'المتابعة', desc: 'أقساط الجدول غير المسددة: الاستحقاق وأيام التأخر ومرات التأجيل', filters: [F.partner, F.direction, { key: 'only', label: 'العرض', options: () => [{ value: 'overdue', label: 'المتأخرة غير المفوترة' }, { value: 'deferred', label: 'المؤجلة' }, { value: 'unpaid', label: 'مفوترة بلا سداد كامل' }] }],
    build: (db, f) => {
      const cs = new Map(applyBase(db, db.contracts, f).map((c) => [c.id, c]))
      const list = db.paymentItems.filter((p) => cs.has(p.contractId) && !['Paid', 'Cancelled'].includes(p.status)
        && (f.only !== 'overdue' || overdueDays(p) > 0) && (f.only !== 'deferred' || (p.rescheduleCount ?? 0) > 0) && (f.only !== 'unpaid' || p.status === 'Invoiced')).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      const open = (id: string) => db.scheduleChanges.some((x) => x.status === 'Pending' && x.itemIds.includes(id))
      const rows: Row[] = list.map((p) => { const c = cs.get(p.contractId)!; return { id: p.id, to: `/contracts/${c.id}?tab=financial`, cells: {
        contract: c.number, partner: partnerName(db, c), no: p.itemNo, due: fmtDate(p.dueDate), orig: p.originalDueDate ? fmtDate(p.originalDueDate) : '—', late: overdueDays(p) || '—',
        amount: money(p.amount, p.currency), paid: p.paidAmount !== undefined ? money(p.paidAmount, p.currency) : p.status === 'Invoiced' ? 'غير متاح' : '—', status: payStatusLabel[effItemStatus(p)], def: p.rescheduleCount ?? 0, req: open(p.id) ? 'طلب مفتوح' : '' } } })
      const sum = (cur: CurrencyCode) => list.filter((p) => p.currency === cur).reduce((s, p) => s + p.amount - (p.paidAmount ?? 0), 0)
      return { cols: [{ key: 'contract', label: 'العقد' }, { key: 'partner', label: 'الطرف' }, { key: 'no', label: 'القسط', num: true }, { key: 'due', label: 'الاستحقاق' }, { key: 'orig', label: 'الاستحقاق الأصلي' }, { key: 'late', label: 'أيام التأخر', num: true }, { key: 'amount', label: 'المبلغ', num: true }, { key: 'paid', label: 'المدفوع', num: true }, { key: 'status', label: 'الحالة' }, { key: 'def', label: 'مرات التأجيل', num: true }, { key: 'req', label: 'تغيير معلّق' }],
        rows, foot: { contract: `${list.length} قسط`, amount: `${num(sum('IQD'))} IQD + ${num(sum('USD'), 2)} USD غير مسدد` }, note: 'أيام التأخر للأقساط غير المفوترة فقط؛ تأخر سداد الفاتورة يُتابع في المالية.' }
    } },
]
export const reportById = (id: string) => reports.find((r) => r.id === id)

// ───────────── export (mock) ─────────────
export function toCsv(res: ReportResult): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return '﻿' + [res.cols.map((c) => esc(c.label)).join(','), ...res.rows.map((r) => res.cols.map((c) => esc(r.cells[c.key])).join(','))].join('\r\n')
}

// ───────────── dashboard (R0) ─────────────
export function dashboard(db: DB) {
  const vis = visibleContracts(db), ids = new Set(vis.map((c) => c.id))
  const by = (s: Contract['status']) => vis.filter((c) => c.status === s)
  const act = by('Active')
  const stats = vis.filter((c) => c.profile === 'Agreement' && ['Active', 'OnHold'].includes(c.status)).map((c) => ({ c, s: agreementStats(db, c) }))
  const ev = db.slaEvents.filter((e) => ids.has(e.contractId))
  const drift = db.lines.filter((l) => ids.has(l.contractId) && hasDrift(db, l.id)).length
  return {
    vis, active: act, value: perCurrency(act),
    expiring: vis.filter((c) => ['Active', 'OnHold'].includes(c.status) && c.endDate && daysTo(c.endDate) >= 0 && daysTo(c.endDate) <= 30).sort((a, b) => a.endDate!.localeCompare(b.endDate!)),
    approval: by('PendingApproval').length, signature: by('PendingSignature').length + by('Approved').length,
    overdue: db.obligations.filter((o) => ids.has(o.contractId) && effStatus(o) === 'Overdue').length,
    utilisation: stats.sort((a, b) => b.s.pct - a.s.pct).slice(0, 10), drift,
    slaPct: ev.length ? (ev.filter((e) => e.kind.endsWith('Met')).length / ev.length) * 100 : undefined,
    billingDue: db.paymentItems.filter((p) => ids.has(p.contractId) && p.status === 'Planned' && p.dueDate <= addDays(today(), 7)).length,
  }
}

// ───────────── global search (BR-R-06) ─────────────
export interface Hit { group: string; id: string; title: string; sub: string; to: string }
export function globalSearch(db: DB, q: string): Hit[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(t))
  const vis = visibleContracts(db), ids = new Set(vis.map((c) => c.id))
  const out: Hit[] = []
  vis.filter((c) => has(c.number, c.title, partnerName(db, c), c.externalReference)).forEach((c) => out.push({ group: 'العقود', id: c.id, title: `${c.number} — ${c.title}`, sub: `${partnerName(db, c)} · ${statusLabel[c.status]}`, to: `/contracts/${c.id}` }))
  db.partners.filter((p) => has(p.name, p.code, p.contact, p.city)).forEach((p) => out.push({ group: 'الأطراف', id: p.id, title: p.name, sub: `${p.code} · ${p.kind === 'customer' ? 'عميل' : 'مورد'} · ${p.city}`, to: `/contracts?partner=${p.id}` }))
  db.mockDocs.filter((d) => d.agreementId && ids.has(d.agreementId) && has(d.ref)).forEach((d) => out.push({ group: 'المستندات', id: d.id, title: d.ref, sub: `مستند منفّذ لاتفاقية ${db.contracts.find((c) => c.id === d.agreementId)?.number}`, to: `/contracts/${d.agreementId}` }))
  db.billingLog.filter((b) => ids.has(b.contractId) && has(b.ref)).forEach((b) => out.push({ group: 'المستندات', id: b.id, title: b.ref, sub: `فوترة — ${db.contracts.find((c) => c.id === b.contractId)?.number}`, to: `/contracts/${b.contractId}` }))
  db.links.filter((l) => ids.has(l.contractId) && has(l.docRef)).forEach((l) => out.push({ group: 'المستندات', id: l.id, title: l.docRef, sub: `مستند مرتبط — ${db.contracts.find((c) => c.id === l.contractId)?.number}`, to: `/contracts/${l.contractId}` }))
  db.clauses.filter((c) => has(c.title, c.code)).forEach((c) => out.push({ group: 'البنود', id: c.id, title: `${c.code} — ${c.title}`, sub: `${c.category} · v${c.currentVersionNo}`, to: '/clauses' }))
  db.templates.filter((x) => has(x.name, x.code)).forEach((x) => out.push({ group: 'القوالب', id: x.id, title: `${x.code} — ${x.name}`, sub: x.status, to: `/templates/${x.id}` }))
  db.terms.filter((x) => ids.has(x.contractId) && has(x.title)).slice(0, 8).forEach((x) => out.push({ group: 'بنود العقود', id: x.id, title: x.title, sub: db.contracts.find((c) => c.id === x.contractId)?.number ?? '', to: `/contracts/${x.contractId}` }))
  db.obligations.filter((o) => ids.has(o.contractId) && has(o.title)).forEach((o) => out.push({ group: 'الالتزامات', id: o.id, title: o.title, sub: db.contracts.find((c) => c.id === o.contractId)?.number ?? '', to: `/contracts/${o.contractId}` }))
  return out
}
