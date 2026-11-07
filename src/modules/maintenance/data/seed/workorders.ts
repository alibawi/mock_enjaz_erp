// Work orders (area 5): ~28 closed history jobs (Aug → 5 Nov) that feed the asset history, reports and rework check,
// plus 16 current jobs covering every status of the work-order lifecycle. Each customer job carries the request and the
// approved + accepted estimate it came from; internal jobs are direct work orders. Goods issues carry a simulated journal.
import type {
  ApprovalRequest, Asset, AuditEntry, Coverage, Estimate, EstimateLine, GoodsIssue, JournalLine, MaintRequest, MeterReading,
  Partner, StatusChange, TimeEntry, VehicleDetails, WorkOrder, WorkOrderStatus,
} from '../types'
import { expenseTypes, items, operations, warehouses } from './master'

// ---------- extra customers and assets for the current jobs ----------
export const partners: Partner[] = [
  { id: 'p-hussein', code: 'C-10302', name: 'حسين العبيدي', kind: 'customer', phone: '0770 902 4417', area: 'الدورة', address: 'الدورة، حي الميكانيك، دار 22', accountCode: '1211' },
  { id: 'p-noor', code: 'C-10315', name: 'نور الساعدي', kind: 'customer', phone: '0781 640 2290', area: 'المنصور', address: 'المنصور، شارع الأميرات', accountCode: '1211' },
  { id: 'p-wafa', code: 'C-10321', name: 'وفاء الحسني', kind: 'customer', phone: '0772 115 9083', area: 'زيونة', address: 'زيونة، قرب جامع الرحمن', accountCode: '1211' },
  { id: 'p-sama', code: 'C-20052', name: 'شركة سما بغداد للنقل', kind: 'customer', phone: '0790 300 7788', area: 'الشعب', address: 'الشعب، المنطقة الصناعية', accountCode: '1211' },
]

type A = Omit<Asset, 'attributes' | 'state' | 'location'> & { location?: string; attributes?: Record<string, string> }
const a = (x: A): Asset => ({ state: 'active', attributes: {}, location: 'عند العميل', ...x })
export const assets: Asset[] = [
  a({ id: 'as-31', code: 'AST-000331', name: 'تويوتا كورولا 2019 — حسين العبيدي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-hussein', model: 'Corolla XLi', brand: 'Toyota', area: 'الدورة', warrantyStart: '2019-04-01', warrantyEnd: '2022-04-01' }),
  a({ id: 'as-32', code: 'AST-000332', name: 'كيا سيراتو 2020 — نور الساعدي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-noor', model: 'Cerato', brand: 'Kia', area: 'المنصور', warrantyStart: '2020-01-20', warrantyEnd: '2025-01-20' }),
  a({ id: 'as-33', code: 'AST-000333', name: 'تويوتا كامري 2017 — وفاء الحسني', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-wafa', model: 'Camry GL', brand: 'Toyota', area: 'زيونة' }),
  a({ id: 'as-34', code: 'AST-000334', name: 'هيونداي أكسنت 2023 — سما (رقم 7)', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-sama', model: 'Accent', brand: 'Hyundai', area: 'الشعب', warrantyStart: '2023-05-01', warrantyEnd: '2026-05-01' }),
  a({ id: 'as-35', code: 'AST-000335', name: 'هيونداي أكسنت 2023 — سما (رقم 9)', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-sama', model: 'Accent', brand: 'Hyundai', area: 'الشعب', warrantyStart: '2023-05-01', warrantyEnd: '2026-05-01' }),
  a({ id: 'as-36', code: 'AST-000336', name: 'ميتسوبيشي باجيرو 2016 — حسين العبيدي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-hussein', model: 'Pajero GLS', brand: 'Mitsubishi', area: 'الدورة' }),
  a({ id: 'as-37', code: 'AST-000337', name: 'كيا أوبتيما 2018 — رشا التميمي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-rasha', model: 'Optima', brand: 'Kia', area: 'الكرادة' }),
  a({ id: 'as-38', code: 'AST-000338', name: 'تويوتا هايلوكس 2021 — سما (نقل بضائع)', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-sama', model: 'Hilux', brand: 'Toyota', area: 'الشعب', warrantyStart: '2021-08-01', warrantyEnd: '2024-08-01' }),
  a({ id: 'as-39', code: 'AST-000339', name: 'لكزس ES 2019 — أحمد عبد الرزاق', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-ahmed', model: 'ES 350', brand: 'Lexus', area: 'الكرادة' }),
  a({ id: 'as-40', code: 'AST-000340', name: 'مكيف سامسونج 2 طن — عيادة هبة السامرائي', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-hiba', serial: 'SM-24K-55102', model: 'AR24', brand: 'Samsung', location: 'عيادة — المنصور', area: 'المنصور', attributes: { btu: '24000' } }),
]
const v = (assetId: string, plate: string, make: string, model: string, year: number, color: string): VehicleDetails =>
  ({ assetId, plate, vin: `VIN${assetId.slice(3)}${year}X${plate.replace(/\D/g, '')}`, make, model, year, engineNo: `ENG-${assetId.slice(3)}${year}`, fuel: 'بنزين', transmission: 'أوتوماتيك', color })
export const vehicles: VehicleDetails[] = [
  v('as-31', 'بغداد 51022 هـ', 'Toyota', 'Corolla XLi', 2019, 'أبيض'), v('as-32', 'بغداد 66310 و', 'Kia', 'Cerato', 2020, 'أحمر'),
  v('as-33', 'بغداد 20887 أ', 'Toyota', 'Camry GL', 2017, 'ذهبي'), v('as-34', 'بغداد 90107 ب', 'Hyundai', 'Accent', 2023, 'أبيض'),
  v('as-35', 'بغداد 90109 ب', 'Hyundai', 'Accent', 2023, 'أبيض'), v('as-36', 'بغداد 14452 ج', 'Mitsubishi', 'Pajero GLS', 2016, 'فضي'),
  v('as-37', 'بغداد 38861 د', 'Kia', 'Optima', 2018, 'أسود'), v('as-38', 'بغداد 90120 ب', 'Toyota', 'Hilux', 2021, 'أبيض'),
  v('as-39', 'بغداد 70011 هـ', 'Lexus', 'ES 350', 2019, 'رصاصي'),
]

// ---------- generator ----------
type Ln = [EstimateLine['kind'], string, number, Coverage?]
interface Spec {
  key: string; asset: string; owner: string; mt: string; day: string; lines: Ln[]; tech: string; complaint: string
  fc?: string; why?: string; meter?: number; et?: string; status?: WorkOrderStatus; days?: number; reworkOf?: string; channel?: MaintRequest['channel']
}

const internalTypes = ['mt-int', 'mt-intv']
const pad = (n: number) => String(n).padStart(6, '0')
const addD = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const item = (id: string) => items.find((i) => i.id === id)!
const et = (id: string) => expenseTypes.find((e) => e.id === id)!

export const requests: MaintRequest[] = []
export const estimates: Estimate[] = []
export const approvals: ApprovalRequest[] = []
export const workOrders: WorkOrder[] = []
export const goodsIssues: GoodsIssue[] = []
export const readings: MeterReading[] = []
export const audit: AuditEntry[] = []
const reservations: { itemId: string; qty: number }[] = []

let rqNo = 0, esNo = 0, cNo = 0, woNo = 0, giNo = 0, lnNo = 0, auNo = 0
const au = (at: string, userId: string, entity: string, entityId: string, action: string, detail = '') =>
  audit.push({ id: `au-w${++auNo}`, at, userId, entity, entityId, action, detail })

/** Builds one job. `stage` says how far the lifecycle got; history jobs run to closed. */
function job(s: Spec, stage: WorkOrderStatus, extra: (w: WorkOrder) => void = () => {}) {
  const internal = internalTypes.includes(s.mt)
  const rework = !!s.reworkOf
  const start = `${s.day}T09:00`
  const endDay = addD(s.day, s.days ?? 0)
  const lines: EstimateLine[] = s.lines.map(([kind, itemId, qty, coverage]) => ({ id: `el-w${++lnNo}`, kind, itemId, qty, price: item(itemId).price, discountPct: 0, coverage: coverage ?? (rework ? 'goodwill' : 'paid') }))
  const woId = `wo-${s.key}`
  let requestId: string | undefined
  let estimateId: string | undefined
  const history = stage === 'closed'
  const prep = s.day > '2026-11-07' ? '2026-11-06' : addD(s.day, -1)

  if (!internal) {
    requestId = `rq-${s.key}`; estimateId = `es-${s.key}`
    const accepted = prep
    if (!history) cNo += 1
    requests.push({
      id: requestId, number: `MRQ-2026-${pad(history ? ++rqNo : 300 + cNo)}`, assetId: s.asset, partnerId: s.owner, maintenanceTypeId: s.mt,
      receivedAt: `${addD(prep, -1)}T10:00`, receivedBy: 'u-adv', complaint: s.complaint, meterAtIntake: s.meter ? s.meter - 5 : undefined, accessories: '',
      status: 'closed', estimateId, workOrderId: woId, channel: s.channel ?? 'walkIn', reworkOfWorkOrderId: s.reworkOf,
    })
    const gw = lines.some((l) => l.coverage === 'goodwill')
    estimates.push({
      id: estimateId, number: `MES-2026-${pad(history ? ++esNo : 50 + cNo)}`, requestId, assetId: s.asset, partnerId: s.owner, version: 1, status: 'approved',
      validUntil: addD(s.day, 12), lines, createdBy: 'u-tec', submittedBy: 'u-adv',
      customerAcceptance: { decision: 'accepted', channel: s.channel === 'phone' ? 'phone' : 'inPerson', by: 'u-adv', at: `${accepted}T13:00` },
    })
    approvals.push(gw
      ? { id: `ap-${s.key}`, estimateId, round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'approved', submittedBy: 'u-adv', submittedAt: `${accepted}T10:00`, decidedBy: 'u-wm', decidedAt: `${accepted}T12:00`, comment: rework ? 'إعادة عمل ضمن فترة الضمان — مجانًا' : 'حسن نية' }
      : { id: `ap-${s.key}`, estimateId, round: 1, version: 1, level: 0, roles: [], status: 'notRequired', submittedBy: 'u-adv', submittedAt: `${accepted}T10:00`, decidedBy: 'system', decidedAt: `${accepted}T10:00`, comment: 'تحت حد الاعتماد' })
  }

  const expenseTypeId = s.et ?? (rework ? 'et-gw' : internal ? (s.mt === 'mt-intv' ? 'et-veh' : 'et-mach') : 'et-sale')
  const path: WorkOrderStatus[] = ['created', 'planned', 'scheduled', 'inProgress', 'qualityCheck', 'completed', 'closed']
  const reached = (st: WorkOrderStatus) => {
    const order = ['created', 'planned', 'scheduled', 'inProgress', 'waitingParts', 'waitingCustomer', 'onHold', 'qualityCheck', 'completed', 'closed']
    const at = stage === 'cancelled' ? 1 : order.indexOf(stage)
    return order.indexOf(st) <= at
  }
  const started = reached('inProgress')
  const done = reached('qualityCheck')
  const finished = reached('completed')
  const by = (st: WorkOrderStatus) => (st === 'closed' ? 'u-wm' : st === 'created' ? 'u-adv' : st === 'planned' ? 'u-wm' : 'u-tec')
  const stamps: Record<string, string> = { created: `${prep}T14:00`, planned: `${prep}T15:00`, scheduled: `${prep}T16:00`, inProgress: start, qualityCheck: `${endDay}T14:00`, completed: `${endDay}T15:00`, closed: `${addD(endDay, 1)}T10:00` }
  const statusHistory: StatusChange[] = []
  let prev: WorkOrderStatus | null = null
  for (const st of path) {
    if (!reached(st) || (st === 'scheduled' && !['scheduled'].includes(stage) && !history)) continue
    if (st === 'scheduled' && history) continue
    statusHistory.push({ from: prev, to: st, at: stamps[st], by: by(st) })
    prev = st
  }
  if (!['created', 'planned', 'scheduled', 'inProgress', 'qualityCheck', 'completed', 'closed'].includes(stage)) {
    statusHistory.push({ from: prev, to: stage, at: `${s.day}T12:00`, by: stage === 'cancelled' ? 'u-wm' : 'u-tec' })
  }

  const isPart = (l: EstimateLine) => l.kind === 'part'
  const w: WorkOrder = {
    id: woId, number: `MWO-2026-${pad(++woNo)}`, requestId, estimateId, assetId: s.asset, partnerId: s.owner, billingPartnerId: s.owner,
    maintenanceTypeId: s.mt, expenseTypeId, status: stage,
    plannedStart: reached('planned') ? start : undefined, plannedEnd: reached('planned') ? `${endDay}T16:00` : undefined,
    actualStart: started ? start : undefined, actualEnd: finished ? stamps.completed : undefined, leadTechnicianId: reached('planned') ? s.tech : undefined,
    bookingIds: [], failureCodeId: finished ? s.fc : undefined, repairReason: finished ? s.why : undefined, meterAtHandover: finished ? s.meter : undefined, reworkOfId: s.reworkOf,
    consumptionSeq: 0, consumptionStatus: lines.some(isPart) ? 'pending' : 'notRequired', billingStatus: 'notInvoiced', billingBatch: 0,
    parts: lines.filter(isPart).map((l, i) => ({
      id: `wp-${s.key}-${i}`, itemId: l.itemId, plannedQty: l.qty, reservedQty: started && !done ? l.qty : 0, consumedQty: done ? l.qty : 0, issuedQty: 0, price: l.price,
      coverage: l.coverage, expenseTypeId: l.coverage === 'warranty' ? 'et-war' : l.coverage === 'goodwill' ? 'et-gw' : undefined,
    })),
    services: lines.filter((l) => !isPart(l)).map((l, i) => ({ id: `ws-${s.key}-${i}`, itemId: l.itemId, qty: l.qty, price: l.price, coverage: l.coverage })),
    operations: lines.filter((l) => l.kind === 'labor').map((l, i) => {
      const op = operations.find((o) => o.serviceItemId === l.itemId && s.complaint.length > 0 && o.id === opFor(s))
      return { id: `wop-${s.key}-${i}`, operationId: op?.id ?? '', description: op?.name ?? item(l.itemId).name, plannedHours: l.qty, done: done }
    }),
    timeEntries: [], removedParts: [], statusHistory, createdAt: stamps.created, goodsIssueIds: [],
  }
  const paid = w.parts.some((p) => p.coverage === 'paid') || w.services.some((x) => x.coverage === 'paid')
  w.billingStatus = internal || !paid ? 'notBillable' : history ? 'invoiced' : 'notInvoiced'
  if (history && w.billingStatus === 'invoiced') w.billingBatch = 1
  if (internal) w.billingPartnerId = 'p-int'

  // labor hours on the job (confirmed on history jobs)
  if (started) {
    const hours = w.operations.reduce((t, o) => t + o.plannedHours, 0) || 1
    const te: TimeEntry = { id: `te-${s.key}-1`, technicianId: s.tech, date: s.day, hours: done ? hours : Math.max(0.5, Math.round(hours / 2 * 2) / 2), category: 'regular', confirmedBy: history ? 'u-wm' : undefined }
    w.timeEntries.push(te)
    if (history && hours >= 2) w.timeEntries.push({ id: `te-${s.key}-2`, technicianId: s.tech === 't-hassan' ? 't-mohammed' : 't-hassan', date: s.day, hours: 1, category: 'regular', confirmedBy: 'u-wm' })
  }

  // goods issue for completed jobs (history and the posted current one)
  if (finished && w.parts.length && stage !== 'cancelled') {
    w.consumptionStatus = 'posted'
    issue(w, stamps.completed)
  }
  if (history && s.meter) readings.push({ id: `rd-w-${s.key}`, assetId: s.asset, value: s.meter, unit: s.asset >= 'as-23' && s.asset <= 'as-30' ? 'hours' : 'km', at: endDay, source: 'handover', docRef: w.number })
  extra(w)
  for (const p of w.parts) if (p.reservedQty) reservations.push({ itemId: p.itemId, qty: p.reservedQty })
  workOrders.push(w)
  au(stamps.created, 'u-adv', 'workOrder', w.id, internal ? 'إنشاء أمر عمل داخلي مباشر' : 'إنشاء أمر عمل من التقدير', w.number)
  if (history) au(stamps.closed, 'u-wm', 'workOrder', w.id, 'إغلاق أمر العمل')
  return w
}

function opFor(s: Spec) {
  const t = s.complaint
  if (/فرامل|فرمل|فحمات/.test(t)) return 'op-brk'
  if (/زيت|خدمة/.test(t)) return 'op-oil'
  if (/مساعد|تعليق/.test(t)) return 'op-susp'
  if (/بطارية|تشغيل/.test(t)) return 'op-bat'
  if (/لوحة|شاشة/.test(t)) return 'op-acpcb'
  if (/غاز|تبريد/.test(t)) return 'op-acgas'
  if (/منظم|جهد/.test(t)) return 'op-genavr'
  if (/بخاخ|دخان|ديزل/.test(t)) return 'op-geninj'
  if (/هيدروليك/.test(t)) return 'op-flhyd'
  if (/فحص|حساس/.test(t)) return 'op-diag'
  return ''
}

function issue(w: WorkOrder, at: string) {
  const wh = warehouses[0]
  const lines = w.parts.filter((p) => p.consumedQty > p.issuedQty).map((p) => {
    const e = et(p.expenseTypeId ?? w.expenseTypeId ?? 'et-sale')
    return { itemId: p.itemId, qty: p.consumedQty - p.issuedQty, unitCost: item(p.itemId).cost, expenseAccount: e.accountCode, expenseAccountName: e.accountName }
  })
  const groups = new Map<string, JournalLine>()
  for (const l of lines) {
    const g = groups.get(l.expenseAccount) ?? { account: l.expenseAccount, accountName: l.expenseAccountName, debit: 0, credit: 0 }
    g.debit += l.qty * l.unitCost
    groups.set(l.expenseAccount, g)
  }
  const total = [...groups.values()].reduce((t, g) => t + g.debit, 0)
  const gi: GoodsIssue = {
    id: `gi-${w.id.slice(3)}`, number: `GI-2026-${pad(++giNo)}`, workOrderId: w.id, date: at, partnerId: w.billingPartnerId === 'p-int' || w.partnerId === 'p-int' ? 'p-int' : w.billingPartnerId,
    idempotencyKey: `WO:${w.id}:C1`, canceled: false, lines, journal: [...groups.values(), { account: wh.inventoryAccount, accountName: `المخزون — ${wh.name}`, debit: 0, credit: total }],
  }
  for (const p of w.parts) { p.issuedQty = p.consumedQty; p.unitCost = item(p.itemId).cost; p.reservedQty = 0 }
  w.consumptionSeq = 1
  w.goodsIssueIds.push(gi.id)
  goodsIssues.push(gi)
  au(at, 'u-tec', 'workOrder', w.id, 'صرف القطع (سند صرف مُحاكى)', `${gi.number} — ${lines.length} سطر`)
}

// ---------- history: closed jobs Aug → 5 Nov ----------
const H = (key: string, asset: string, owner: string, mt: string, day: string, complaint: string, lines: Ln[], tech: string, fc?: string, why?: string, meter?: number, more: Partial<Spec> = {}) =>
  job({ key, asset, owner, mt, day, complaint, lines, tech, fc, why, meter, ...more }, 'closed')

H('h01', 'as-02', 'p-rasha', 'mt-car', '2026-08-03', 'صوت صرير عند الفرملة', [['part', 'it-pads', 1], ['labor', 'sv-mech', 2]], 't-hassan', 'fc-brk', 'فحمات منتهية', 145_100)
H('h02', 'as-12', 'p-zaid', 'mt-ac', '2026-08-05', 'المكيف لا يبرد — نقص غاز', [['part', 'it-gas', 2], ['labor', 'sv-hvac', 1.5]], 't-karim', 'fc-gas', 'تسريب بسيط في الوصلة — أُحكم وعُبئ', undefined, { channel: 'phone' })
H('h03', 'as-09', 'p-int', 'mt-intv', '2026-08-09', 'تغيير زيت دوري لبيك أب التوزيع', [['part', 'it-oil', 7], ['part', 'it-oilf', 1], ['labor', 'sv-mech', 1]], 't-mohammed', 'fc-oil', 'خدمة دورية', 205_900)
H('h04', 'as-16', 'p-alnoor', 'mt-ac', '2026-08-12', 'شاشة المكيف مطفأة — لوحة التحكم', [['part', 'it-pcb', 1], ['labor', 'sv-hvac', 1]], 't-karim', 'fc-pcb', 'احتراق اللوحة بسبب تذبذب الكهرباء', undefined, { channel: 'phone' })
H('h05', 'as-04', 'p-osama', 'mt-svc', '2026-08-17', 'خدمة دورية — زيت وفلاتر', [['part', 'it-oil', 6], ['part', 'it-oilf', 1], ['part', 'it-airf', 1], ['labor', 'sv-mech', 1]], 't-ahmed', undefined, undefined, 101_200)
H('h06', 'as-23', 'p-alnoor', 'mt-gen', '2026-08-20', 'دخان أسود من المولد — بخاخات', [['part', 'it-inj', 2], ['part', 'it-dfil', 2], ['labor', 'sv-mech', 3], ['service', 'sv-visit', 1]], 't-ali', 'fc-inj', 'وقود رديء سد البخاخات', 8_460, { channel: 'phone', days: 1 })
H('h07', 'as-07', 'p-rafidain', 'mt-svc', '2026-08-24', 'خدمة دورية 15,000 كم', [['part', 'it-oil', 4], ['part', 'it-oilf', 1], ['labor', 'sv-mech', 1]], 't-mohammed', undefined, undefined, 15_020)
H('h08', 'as-27', 'p-int', 'mt-int', '2026-08-28', 'تسريب هيدروليك من الرافعة', [['part', 'it-hose', 1], ['labor', 'sv-mech', 2]], 't-abbas', 'fc-hyd', 'تشقق خرطوم الرفع', 6_850)
H('h09', 'as-06', 'p-zaid', 'mt-car', '2026-09-02', 'صعوبة تشغيل — بطارية', [['part', 'it-bat', 1], ['labor', 'sv-elec', 0.5]], 't-omar', 'fc-bat', 'بطارية منتهية العمر', 186_900)
H('h10', 'as-19', 'p-dijla', 'mt-ac', '2026-09-07', 'ضعف تبريد في الصف — غاز ومتسعة', [['part', 'it-gas', 3], ['part', 'it-cap', 1], ['labor', 'sv-hvac', 1.5]], 't-yaser', 'fc-gas', 'متسعة ضعيفة ونقص غاز', undefined, { channel: 'phone' })
H('h11', 'as-21', 'p-firas', 'mt-ac', '2026-09-11', 'تعبئة غاز قبل الصيف المتأخر', [['part', 'it-gas', 2], ['labor', 'sv-hvac', 1]], 't-karim', 'fc-gas', 'نقص غاز', undefined, { channel: 'whatsapp' })
H('h12', 'as-08', 'p-rafidain', 'mt-car', '2026-09-15', 'طقطقة من التعليق الأمامي', [['part', 'it-shock', 2], ['labor', 'sv-mech', 3]], 't-hassan', 'fc-susp', 'مساعدات تالفة', 68_700, { days: 1 })
H('h13', 'as-24', 'p-dijla', 'mt-gen', '2026-09-18', 'تذبذب جهد المولد — منظم', [['part', 'it-avr', 1], ['labor', 'sv-elec', 2], ['service', 'sv-visit', 1]], 't-ali', 'fc-avr', 'منظم الجهد تالف', 3_900, { channel: 'phone' })
H('h14', 'as-10', 'p-int', 'mt-intv', '2026-09-22', 'فان الفريق: فرامل أمامية', [['part', 'it-pads', 1], ['labor', 'sv-mech', 2]], 't-abbas', 'fc-brk', 'تآكل طبيعي', 94_800)
H('h15', 'as-03', 'p-firas', 'mt-svc', '2026-09-26', 'خدمة دورية 18,000 كم', [['part', 'it-oil', 5], ['part', 'it-oilf', 1], ['part', 'it-airf', 1], ['labor', 'sv-mech', 1]], 't-ahmed', undefined, undefined, 18_400, { channel: 'whatsapp' })
H('h16', 'as-17', 'p-alnoor', 'mt-ac', '2026-09-30', 'مكيف العمليات: لوحة وغاز', [['part', 'it-pcb', 1], ['part', 'it-gas', 3], ['labor', 'sv-hvac', 2]], 't-karim', 'fc-pcb', 'عطل حساس اللوحة ونقص غاز', undefined, { channel: 'phone' })
H('h17', 'as-26', 'p-int', 'mt-int', '2026-10-04', 'مولد المقر: فلاتر الديزل', [['part', 'it-dfil', 4], ['labor', 'sv-mech', 2]], 't-murtada', 'fc-inj', 'فلاتر مسدودة', 12_600)
H('h18', 'as-02', 'p-rasha', 'mt-svc', '2026-10-08', 'خدمة دورية — زيت وفلتر', [['part', 'it-oil', 5], ['part', 'it-oilf', 1], ['labor', 'sv-mech', 1]], 't-mohammed', undefined, undefined, 149_300)
const brakesAs05 = H('h19', 'as-05', 'p-muna', 'mt-car', '2026-10-12', 'صوت احتكاك عند الفرملة', [['part', 'it-pads', 1], ['part', 'it-disc', 2], ['labor', 'sv-mech', 2], ['service', 'sv-turn', 1]], 't-hassan', 'fc-brk', 'أقراص متآكلة وفحمات منتهية', 40_200)
H('h20', 'as-20', 'p-dijla', 'mt-ac', '2026-10-15', 'تعبئة غاز لمكيف الإدارة', [['part', 'it-gas', 2], ['labor', 'sv-hvac', 1, 'goodwill']], 't-yaser', 'fc-gas', 'نقص غاز — الأجور مجانًا لعقد المدرسة', undefined, { channel: 'phone' })
H('h21', 'as-28', 'p-int', 'mt-int', '2026-10-18', 'تسريب هيدروليك — الرافعة 2', [['part', 'it-hose', 1], ['labor', 'sv-mech', 2]], 't-abbas', 'fc-hyd', 'وصلة مرتخية وخرطوم متشقق', 4_450)
H('h22', 'as-04', 'p-osama', 'mt-car', '2026-10-20', 'ضعف في التشغيل الصباحي', [['part', 'it-bat', 1], ['labor', 'sv-elec', 0.5]], 't-omar', 'fc-bat', 'بطارية ضعيفة', 107_960)
H('h23', 'as-18', 'p-alnoor', 'mt-ac', '2026-10-22', 'ضعف تبريد في الاستقبال', [['part', 'it-gas', 3], ['labor', 'sv-hvac', 1.5]], 't-karim', 'fc-gas', 'تسريب في الوحدة الخارجية — لُحم', undefined, { channel: 'phone' })
H('h24', 'as-01', 'p-ahmed', 'mt-car', '2026-10-25', 'صوت صرير في الفرامل الأمامية', [['part', 'it-pads', 1], ['part', 'it-disc', 2], ['labor', 'sv-mech', 2]], 't-hassan', 'fc-brk', 'فحمات وأقراص متآكلة', 83_950)
H('h25', 'as-07', 'p-rafidain', 'mt-car', '2026-10-27', 'البطارية لا تشحن — ضمن الضمان', [['part', 'it-bat', 1, 'warranty'], ['labor', 'sv-elec', 0.5, 'warranty']], 't-omar', 'fc-bat', 'خلل تصنيعي في البطارية — ضمان', 23_100)
H('h26', 'as-11', 'p-int', 'mt-intv', '2026-10-29', 'فان الفريق 2: خدمة دورية', [['part', 'it-oil', 6], ['part', 'it-oilf', 1], ['part', 'it-airf', 1], ['labor', 'sv-mech', 1]], 't-mohammed', 'fc-oil', 'خدمة دورية', 101_300)
H('h27', 'as-15', 'p-muna', 'mt-ac', '2026-11-01', 'المكيف لا يبرد جيدًا', [['part', 'it-gas', 2], ['labor', 'sv-hvac', 1]], 't-yaser', 'fc-gas', 'نقص غاز', undefined, { channel: 'whatsapp' })
H('h28', 'as-09', 'p-int', 'mt-intv', '2026-11-03', 'بيك أب التوزيع: صعوبة تشغيل', [['part', 'it-bat', 1], ['labor', 'sv-elec', 0.5]], 't-omar', 'fc-bat', 'بطارية منتهية', 214_950)
H('h29', 'as-25', 'p-osama', 'mt-gen', '2026-08-30', 'فلتر ديزل وصيانة عامة للمولد المنزلي', [['part', 'it-dfil', 1], ['labor', 'sv-mech', 1], ['service', 'sv-visit', 1]], 't-ali', 'fc-inj', 'فلتر مسدود', undefined, { channel: 'whatsapp' })

// ---------- current jobs — one per lifecycle state ----------
const C = (s: Omit<Spec, 'tech'> & { tech?: string }, stage: WorkOrderStatus, extra?: (w: WorkOrder) => void) => job({ tech: 't-hassan', ...s } as Spec, stage, extra)

C({ key: 'c01', asset: 'as-31', owner: 'p-hussein', mt: 'mt-svc', day: '2026-11-09', complaint: 'خدمة دورية — زيت وفلاتر', lines: [['part', 'it-oil', 4], ['part', 'it-oilf', 1], ['part', 'it-airf', 1], ['labor', 'sv-mech', 1]] }, 'created')
C({ key: 'c02', asset: 'as-32', owner: 'p-noor', mt: 'mt-car', day: '2026-11-09', complaint: 'صوت صرير عند الفرملة', lines: [['part', 'it-pads', 1], ['labor', 'sv-mech', 2]], tech: 't-hassan' }, 'planned')
C({ key: 'c03', asset: 'as-33', owner: 'p-wafa', mt: 'mt-car', day: '2026-11-08', complaint: 'لمبة المحرك مضاءة — حساس أوكسجين', lines: [['part', 'it-sensor', 1], ['labor', 'sv-elec', 1], ['service', 'sv-diag', 1]], tech: 't-omar' }, 'planned')
C({ key: 'c04', asset: 'as-34', owner: 'p-sama', mt: 'mt-car', day: '2026-11-10', complaint: 'تبديل مساعدات أمامية — نظام التعليق', lines: [['part', 'it-shock', 2], ['labor', 'sv-mech', 3]], tech: 't-ahmed', days: 1 }, 'scheduled')
C({ key: 'c05', asset: 'as-21', owner: 'p-firas', mt: 'mt-ac', day: '2026-11-09', complaint: 'ضعف تبريد — فحص تسريب وتعبئة غاز', lines: [['part', 'it-gas', 2], ['labor', 'sv-hvac', 1.5], ['service', 'sv-visit', 1]], tech: 't-karim', channel: 'phone' }, 'scheduled')
C({ key: 'c06', asset: 'as-35', owner: 'p-sama', mt: 'mt-svc', day: '2026-11-11', complaint: 'خدمة دورية — زيت وفلتر', lines: [['part', 'it-oil', 4], ['part', 'it-oilf', 1], ['labor', 'sv-mech', 1]], tech: 't-mohammed' }, 'scheduled')
C({ key: 'c07', asset: 'as-36', owner: 'p-hussein', mt: 'mt-car', day: '2026-11-07', complaint: 'صعوبة تشغيل — بطارية وفحص كمبيوتر', lines: [['part', 'it-bat', 1], ['labor', 'sv-elec', 0.5], ['service', 'sv-diag', 1]], tech: 't-omar' }, 'inProgress', (w) => {
  w.operations[0].done = true // ready for the quality check
})
C({ key: 'c08', asset: 'as-37', owner: 'p-rasha', mt: 'mt-car', day: '2026-11-06', complaint: 'لمبة المحرك واستهلاك وقود — حساس أوكسجين وزيت', lines: [['part', 'it-sensor', 1], ['part', 'it-oil', 4], ['labor', 'sv-elec', 1]], tech: 't-ahmed' }, 'waitingParts', (w) => {
  w.parts[0].reservedQty = 0 // the sensor is out of stock
  w.holdReason = 'حساس الأوكسجين غير متوفر — طلب شراء لدى المشتريات'
})
C({ key: 'c09', asset: 'as-23', owner: 'p-alnoor', mt: 'mt-gen', day: '2026-11-05', complaint: 'تذبذب جهد المولد — منظم الجهد', lines: [['part', 'it-avr', 1], ['labor', 'sv-elec', 2], ['service', 'sv-visit', 1]], tech: 't-ali', channel: 'phone' }, 'waitingCustomer', (w) => {
  w.holdReason = 'بانتظار موافقة المستشفى على إيقاف المولد ساعتين أثناء الدوام'
})
C({ key: 'c10', asset: 'as-22', owner: 'p-int', mt: 'mt-int', day: '2026-11-04', complaint: 'مكيف مكتب المدير: تعبئة غاز', lines: [['part', 'it-gas', 1], ['labor', 'sv-hvac', 1]], tech: 't-yaser', et: 'et-bld' }, 'onHold', (w) => {
  w.holdReason = 'بانتظار إخلاء مكتب المدير العام (اجتماعات طوال الأسبوع)'
})
C({ key: 'c11', asset: 'as-38', owner: 'p-sama', mt: 'mt-car', day: '2026-11-06', complaint: 'اهتزاز عند الفرملة — فحمات وأقراص', lines: [['part', 'it-pads', 1], ['part', 'it-disc', 2], ['labor', 'sv-mech', 2]], tech: 't-hassan', days: 1 }, 'qualityCheck', (w) => {
  w.parts.forEach((p) => { p.reservedQty = p.plannedQty }) // still held until the issue
  w.removedParts.push({ id: 'rp-c11-1', description: 'قرصا فرامل أماميان متآكلان', disposition: 'returnedToCustomer' })
})
C({ key: 'c12', asset: 'as-39', owner: 'p-ahmed', mt: 'mt-svc', day: '2026-11-06', complaint: 'خدمة دورية — زيت وفلاتر', lines: [['part', 'it-oil', 5], ['part', 'it-oilf', 1], ['part', 'it-airf', 1], ['labor', 'sv-mech', 1]], tech: 't-mohammed', meter: 96_400 }, 'completed')
C({ key: 'c13', asset: 'as-27', owner: 'p-int', mt: 'mt-int', day: '2026-11-05', complaint: 'تسريب هيدروليك من ذراع الرفع', lines: [['part', 'it-hose', 1], ['labor', 'sv-mech', 2]], tech: 't-abbas', fc: 'fc-hyd', why: 'خرطوم الرفع متشقق', meter: 7_240 }, 'completed', (w) => {
  // the automatic issue failed: the parts stay reserved and the order waits for a retry (§21.4)
  goodsIssues.splice(goodsIssues.findIndex((g) => g.workOrderId === w.id), 1)
  giNo -= 1
  audit.splice(audit.findIndex((x) => x.entityId === w.id && x.action.startsWith('صرف')), 1)
  w.goodsIssueIds = []
  w.consumptionSeq = 0
  w.parts.forEach((p) => { p.issuedQty = 0; p.unitCost = undefined; p.reservedQty = p.consumedQty })
  w.consumptionStatus = 'failed'
  w.consumptionError = 'لا توجد فترة محاسبية مفتوحة لتاريخ الصرف 2026-11-05 (فترة أكتوبر/نوفمبر مغلقة مؤقتًا للجرد)'
  au('2026-11-05T15:00', 'u-tec', 'workOrder', w.id, 'فشل صرف القطع', w.consumptionError)
})
C({ key: 'c14', asset: 'as-30', owner: 'p-int', mt: 'mt-int', day: '2026-11-04', complaint: 'المولد المعار: تبديل فلتر الديزل قبل إعادته', lines: [['part', 'it-dfil', 1], ['labor', 'sv-mech', 1]], tech: 't-murtada', fc: 'fc-inj', why: 'صيانة قبل الإرجاع' }, 'completed')
C({ key: 'c15', asset: 'as-40', owner: 'p-hiba', mt: 'mt-ac', day: '2026-11-08', complaint: 'تبديل لوحة تحكم المكيف', lines: [['part', 'it-pcb', 1], ['labor', 'sv-hvac', 1]], tech: 't-karim', channel: 'phone' }, 'cancelled', (w) => {
  w.cancelReason = 'العميلة اشترت مكيفًا جديدًا ولا ترغب في الإصلاح'
  w.consumptionStatus = 'notRequired'
  w.billingStatus = 'notBillable'
  w.statusHistory[w.statusHistory.length - 1].reason = w.cancelReason
})
C({ key: 'c16', asset: 'as-05', owner: 'p-muna', mt: 'mt-car', day: '2026-11-07', complaint: 'عودة صوت الفرامل بعد الإصلاح السابق', lines: [['part', 'it-pads', 1], ['labor', 'sv-mech', 1]], tech: 't-hassan', reworkOf: brakesAs05.id }, 'inProgress')


/** Free stock already held by the open jobs above — added to the master stock rows in seed(). */
export const reserved = reservations.reduce<Record<string, number>>((m, r) => ({ ...m, [r.itemId]: (m[r.itemId] ?? 0) + r.qty }), {})
/** Current documents are numbered MRQ 301+ / MES 51+; history uses 1…n. */
export const counters = { 'MRQ-2026': 300 + cNo, 'MES-2026': 50 + cNo, 'MWO-2026': woNo, 'GI-2026': giNo }
