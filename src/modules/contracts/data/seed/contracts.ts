// Module 1 seed: 12 contract types and 30 contracts across all statuses (fictional Iraqi counterparties, IQD and USD).
// Everything derived from the `rows` table so parties, signatures, attachments, history and lines stay consistent.
import { addDays } from '../asof'
import type {
  Confidentiality, Contract, ContractAttachmentRow, ContractLine, ContractParty, ContractSignature, ContractStatus, ContractType, CurrencyCode,
  DocumentLink, RenewalPolicy, StatusHistory,
} from '../types'
import { items, partners, users } from './shared'

const TODAY = '2026-10-30'

const T = (id: string, code: string, prefix: string, name: string, category: ContractType['category'], profile: ContractType['profile'], dir: ContractType['defaultDirection'], o: Partial<ContractType> = {}): ContractType => ({
  id, code, prefix, name, category, profile, defaultDirection: dir, requiresSignature: true, requiredSignatureRoles: ['Counterparty', 'Company'], requiresApproval: true,
  renewalPolicyDefault: 'Manual', defaultDurationMonths: 12, noticePeriodDaysDefault: 30, renewalGraceDays: 90, reminderDaysDefault: '30,15,7,1',
  isOpenEnded: false, requiresContractValue: true, requiresPaymentTerm: false, defaultConfidentiality: 'Normal', allowManualNumber: false, isActive: true, ...o,
})

export const contractTypes: ContractType[] = [
  T('ct-sa1', 'SA-001', 'SA', 'اتفاقية توريد مبيعات', 'Sales', 'Agreement', 'Outgoing', { requiresPaymentTerm: true }),
  T('ct-sa2', 'SA-002', 'SV', 'اتفاقية التزام قيمة (مبيعات)', 'Sales', 'Agreement', 'Outgoing', { requiresPaymentTerm: true }),
  T('ct-pa1', 'PA-001', 'PA', 'اتفاقية توريد مشتريات', 'Procurement', 'Agreement', 'Incoming', { requiresPaymentTerm: true }),
  T('ct-pa2', 'PA-002', 'FW', 'اتفاقية إطارية (مشتريات)', 'Procurement', 'Agreement', 'Incoming', { defaultDurationMonths: 24, requiresPaymentTerm: true }),
  T('ct-sv1', 'SV-001', 'MN', 'عقد صيانة دورية', 'Service', 'Service', 'Outgoing', { renewalPolicyDefault: 'Auto' }),
  T('ct-sv2', 'SV-002', 'WR', 'عقد ضمان', 'Service', 'Service', 'Outgoing', { defaultDurationMonths: 24, renewalPolicyDefault: 'None' }),
  T('ct-nda', 'LG-NDA', 'NDA', 'اتفاقية عدم إفصاح', 'Legal', 'General', 'Incoming', { requiresContractValue: false, isOpenEnded: true, renewalPolicyDefault: 'None', defaultConfidentiality: 'Confidential', defaultDurationMonths: 36 }),
  T('ct-con', 'LG-CON', 'CON', 'عقد استشارات', 'Legal', 'General', 'Incoming', { requiredSignatureRoles: ['Counterparty', 'Company'] }),
  T('ct-lse', 'LG-LSE', 'LSE', 'عقد إيجار', 'Lease', 'General', 'Incoming', { requiresPaymentTerm: false, noticePeriodDaysDefault: 60 }),
  T('ct-prj', 'PRJ-001', 'PRJ', 'عقد مشروع', 'Project', 'General', 'Incoming', { defaultDurationMonths: 18 }),
  T('ct-gen', 'LG-GEN', 'GEN', 'عقد قانوني عام', 'Other', 'General', 'Incoming', { requiresContractValue: false }),
  T('ct-int', 'INT-001', 'INT', 'اتفاقية داخلية', 'Other', 'General', 'Internal', { requiresSignature: false, requiredSignatureRoles: [], requiresApproval: false, requiresContractValue: false, renewalPolicyDefault: 'None' }),
]

type Item = [itemId: string, qty: number, price: number, disc?: number]
interface Row {
  t: string; title: string; st: ContractStatus; own: string; org?: string; cur?: CurrencyCode
  p?: string; cname?: string; start: string; end?: string; val?: number; items?: Item[]
  rp?: RenewalPolicy; notice?: number; autoM?: number; conf?: Confidentiality; pt?: string; prj?: string; cc?: string
  term?: string; renewedFrom?: string; closure?: Contract['closureReason']; mode?: 'Specific' | 'General'; hold?: string; ext?: string; resp?: string
}
const R = (r: Row) => r

const rows: Row[] = [
  // ── اتفاقيات المبيعات (صادر)
  R({ t: 'ct-sa1', title: 'اتفاقية توريد إسمنت ورمل — شركة الفرات للإنشاءات', st: 'Active', own: 'u-sal', p: 'p-c1', start: '2026-01-15', end: '2027-01-14', items: [['it-1', 12000, 95000], ['it-5', 8000, 18000]], rp: 'Manual', notice: 30, pt: 'pt-60', prj: 'prj-1', cc: 'cc-200', mode: 'Specific', resp: 'emp-5' }),
  R({ t: 'ct-sa2', title: 'اتفاقية التزام قيمة مواد البناء — مجموعة دجلة التجارية', st: 'Active', own: 'u-sal', p: 'p-c2', start: '2026-03-01', end: '2026-12-05', val: 300_000_000, rp: 'Manual', notice: 20, pt: 'pt-30', cc: 'cc-200', mode: 'General', resp: 'emp-5' }),
  R({ t: 'ct-sa1', title: 'اتفاقية توريد حديد تسليح — مصنع الميناء للحديد', st: 'Active', own: 'u-sal', cur: 'USD', p: 'p-c4', start: '2026-02-01', end: '2026-11-12', items: [['it-3', 800, 780]], rp: 'Auto', notice: 15, autoM: 12, pt: 'pt-60', cc: 'cc-200', mode: 'Specific', resp: 'emp-5' }),
  R({ t: 'ct-sa1', title: 'اتفاقية توريد كابلات ومحولات — شركة السومرية للطاقة', st: 'Active', own: 'u-sal', p: 'p-c7', start: '2026-05-01', end: '2027-04-30', items: [['it-7', 30000, 14500], ['it-10', 20, 19_400_000]], rp: 'Manual', notice: 45, pt: 'pt-60', prj: 'prj-2', cc: 'cc-200', mode: 'Specific', resp: 'emp-5' }),
  R({ t: 'ct-sa1', title: 'اتفاقية أثاث مكتبي — جامعة الحكمة الأهلية', st: 'OnHold', own: 'u-sal', p: 'p-c10', start: '2026-04-01', end: '2027-03-31', items: [['it-13', 150, 650000], ['it-14', 300, 185000]], rp: 'Manual', notice: 30, pt: 'pt-60', cc: 'cc-200', mode: 'Specific', hold: 'تعليق مؤقت بطلب العميل لحين تحديد موقع التسليم' }),
  R({ t: 'ct-sa1', title: 'اتفاقية مواد غذائية — شركة بابل للصناعات الغذائية', st: 'PendingApproval', own: 'u-sal', p: 'p-c3', start: '2026-11-15', end: '2027-11-14', items: [['it-18', 6000, 32000], ['it-19', 4000, 41000]], rp: 'Manual', notice: 30, pt: 'pt-30', cc: 'cc-200', mode: 'Specific' }),
  R({ t: 'ct-sa1', title: 'اتفاقية مولدات ديزل — شركة كردستان للمقاولات', st: 'Draft', own: 'u-req', org: 'org-3', cur: 'USD', p: 'p-c5', start: '2026-12-01', end: '2027-11-30', items: [['it-11', 10, 38000], ['it-12', 12, 62000, 3]], rp: 'Manual', notice: 30, pt: 'pt-90', cc: 'cc-200', mode: 'Specific' }),
  R({ t: 'ct-sa1', title: 'اتفاقية توريد رمل وحصى — مؤسسة النخيل للتجهيزات', st: 'Expired', own: 'u-sal', p: 'p-c8', start: '2025-10-01', end: '2026-09-30', items: [['it-5', 5000, 17500], ['it-6', 3000, 23500]], rp: 'Manual', notice: 30, pt: 'pt-30', cc: 'cc-200', mode: 'Specific' }),
  // ── اتفاقيات المشتريات (وارد)
  R({ t: 'ct-pa2', title: 'اتفاقية إطارية — شركة العراق للإسمنت والمواد', st: 'Active', own: 'u-pro', p: 'p-v1', start: '2026-01-01', end: '2026-12-31', items: [['it-1', 9000, 92000], ['it-2', 1500, 110000]], rp: 'Manual', notice: 45, pt: 'pt-30', cc: 'cc-300', mode: 'Specific', resp: 'emp-6' }),
  R({ t: 'ct-pa1', title: 'اتفاقية توريد حديد تسليح — شركة بغداد للحديد والصلب', st: 'Active', own: 'u-pro', cur: 'USD', p: 'p-v2', start: '2026-03-15', end: '2027-03-14', items: [['it-3', 500, 760], ['it-4', 200, 770]], rp: 'Manual', notice: 30, pt: 'pt-60', cc: 'cc-300', mode: 'Specific', resp: 'emp-6' }),
  R({ t: 'ct-pa1', title: 'اتفاقية محولات ومولدات — الأهلية للمعدات الثقيلة', st: 'Active', own: 'u-pro', cur: 'USD', p: 'p-v3', start: '2026-06-01', end: '2027-05-31', items: [['it-9', 10, 24000], ['it-11', 8, 37000]], rp: 'Manual', notice: 60, pt: 'pt-90', prj: 'prj-2', cc: 'cc-300', mode: 'Specific', resp: 'emp-6' }),
  R({ t: 'ct-pa1', title: 'اتفاقية كابلات نحاسية — شركة الشرق للتجهيزات الكهربائية', st: 'PendingSignature', own: 'u-pro', org: 'org-2', p: 'p-v4', start: '2026-11-01', end: '2027-10-31', items: [['it-7', 25000, 14000], ['it-8', 10000, 20500]], rp: 'Manual', notice: 30, pt: 'pt-60', cc: 'cc-300', mode: 'Specific' }),
  R({ t: 'ct-pa1', title: 'اتفاقية أثاث مكتبي — شركة سومر للأثاث المكتبي', st: 'Approved', own: 'u-pro', p: 'p-v10', start: '2026-11-10', end: '2027-11-09', items: [['it-13', 120, 630000], ['it-15', 200, 232000]], rp: 'None', pt: 'pt-30', cc: 'cc-300', mode: 'Specific' }),
  R({ t: 'ct-pa1', title: 'اتفاقية وقود وزيوت — مجموعة الخليج العربي للتوريدات', st: 'Terminated', own: 'u-pro', cur: 'USD', p: 'p-v9', start: '2026-01-20', end: '2026-12-31', term: '2026-08-15', items: [['it-16', 1_000_000, 0.5], ['it-17', 40000, 4.2]], rp: 'None', pt: 'pt-60', cc: 'cc-300', mode: 'Specific' }),
  R({ t: 'ct-pa1', title: 'اتفاقية مواد بناء — شركة العراق للإسمنت (فرع أربيل)', st: 'Draft', own: 'u-req', org: 'org-3', p: 'p-v1', start: '2026-12-01', end: '2027-11-30', items: [['it-1', 6000, 93000], ['it-6', 4000, 23000]], rp: 'Manual', notice: 30, pt: 'pt-30', cc: 'cc-300', mode: 'Specific' }),
  // ── عقود الخدمة
  R({ t: 'ct-sv1', title: 'عقد صيانة دورية لمولدات مستشفى الرافدين', st: 'Active', own: 'u-mgr', p: 'p-c6', start: '2026-02-01', end: '2027-01-31', val: 96_000_000, rp: 'Auto', notice: 30, autoM: 12, pt: 'pt-30', cc: 'cc-500', resp: 'emp-13' }),
  R({ t: 'ct-sv1', title: 'عقد صيانة شبكة كهرباء — شركة السومرية للطاقة', st: 'Active', own: 'u-mgr', org: 'org-2', p: 'p-c7', start: '2026-07-01', end: '2027-06-30', val: 150_000_000, rp: 'Manual', notice: 45, pt: 'pt-60', prj: 'prj-2', cc: 'cc-500', resp: 'emp-13' }),
  R({ t: 'ct-sv2', title: 'عقد ضمان معدات — جامعة الحكمة الأهلية', st: 'Active', own: 'u-mgr', cur: 'USD', p: 'p-c10', start: '2026-05-01', end: '2028-04-30', val: 45_000, rp: 'None', pt: 'pt-60', cc: 'cc-500', resp: 'emp-13' }),
  R({ t: 'ct-sv1', title: 'عقد دعم فني ومعدات طبية — مستشفى الرافدين', st: 'PendingApproval', own: 'u-mgr', p: 'p-c6', start: '2026-11-20', end: '2027-11-19', val: 60_000_000, rp: 'Auto', notice: 30, autoM: 12, pt: 'pt-30', cc: 'cc-500' }),
  R({ t: 'ct-sv1', title: 'عقد صيانة مكيفات — مؤسسة النخيل للتجهيزات', st: 'Expired', own: 'u-mgr', p: 'p-c8', start: '2025-10-15', end: '2026-10-15', val: 32_000_000, rp: 'Manual', notice: 30, pt: 'pt-30', cc: 'cc-500' }),
  // ── عقود عامة
  R({ t: 'ct-lse', title: 'عقد إيجار مخزن الدورة 2025', st: 'Closed', own: 'u-req', cname: 'السيد قاسم هادي الأسدي', start: '2025-01-01', end: '2025-12-31', val: 90_000_000, rp: 'Manual', notice: 60, closure: 'Renewed', cc: 'cc-500' }),
  R({ t: 'ct-lse', title: 'عقد إيجار مخزن الدورة 2026 (تجديد)', st: 'Active', own: 'u-req', cname: 'السيد قاسم هادي الأسدي', start: '2026-01-01', end: '2026-12-31', val: 96_000_000, rp: 'Manual', notice: 60, renewedFrom: 'c-21', cc: 'cc-500' }),
  R({ t: 'ct-nda', title: 'اتفاقية عدم إفصاح — شركة النور للتقنيات', st: 'Active', own: 'u-mgr', p: 'p-v6', start: '2026-10-15', end: '2029-10-14', conf: 'Confidential', rp: 'None' }),
  R({ t: 'ct-con', title: 'عقد استشارات قانونية — مكتب المحامي سامر ناظم', st: 'Active', own: 'u-mgr', cname: 'مكتب المحامي سامر ناظم الجنابي', start: '2026-01-01', end: '2026-12-31', val: 48_000_000, conf: 'Restricted', rp: 'Manual', notice: 30, cc: 'cc-100' }),
  R({ t: 'ct-prj', title: 'عقد مشروع توسعة المستودعات — مؤسسة الفجر للخدمات اللوجستية', st: 'OnHold', own: 'u-mgr', p: 'p-v7', start: '2026-03-01', end: '2027-02-28', val: 780_000_000, rp: 'None', pt: 'pt-60', prj: 'prj-4', cc: 'cc-400', resp: 'emp-12', hold: 'تعليق لحين استكمال الترخيص البلدي' }),
  R({ t: 'ct-lse', title: 'عقد إيجار مكتب فرع أربيل', st: 'Draft', own: 'u-req', org: 'org-3', cname: 'شركة أربيل العقارية', start: '2026-12-01', end: '2027-11-30', val: 54_000_000, rp: 'Manual', notice: 60, cc: 'cc-500' }),
  R({ t: 'ct-con', title: 'عقد استشارات هندسية — مكتب الرافدين الهندسي', st: 'Cancelled', own: 'u-req', cname: 'مكتب الرافدين الهندسي', start: '2026-09-01', end: '2027-02-28', val: 36_000_000, rp: 'None', cc: 'cc-400' }),
  R({ t: 'ct-int', title: 'اتفاقية مستوى خدمة داخلية — تقنية المعلومات', st: 'Active', own: 'u-mgr', cname: 'إدارة تقنية المعلومات', start: '2026-01-01', end: '2026-12-31', rp: 'None' }),
  R({ t: 'ct-prj', title: 'عقد صيانة مبنى الإدارة', st: 'Closed', own: 'u-mgr', p: 'p-v8', start: '2025-06-01', end: '2026-06-30', val: 120_000_000, rp: 'None', closure: 'Completed', pt: 'pt-60', cc: 'cc-400' }),
  R({ t: 'ct-con', title: 'عقد استشارات مالية وتدقيق — شركة الأفق للتدقيق', st: 'PendingApproval', own: 'u-req', cname: 'شركة الأفق للتدقيق والمحاسبة', start: '2026-11-15', end: '2027-05-14', val: 75_000_000, conf: 'Restricted', rp: 'Manual', notice: 30, cc: 'cc-100' }),
]

const byId = <T extends { id: string }>(a: T[]) => new Map(a.map((x) => [x.id, x]))
const typeMap = byId(contractTypes), itemMap = byId(items), partnerMap = byId(partners), userMap = byId(users)
const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const cid = (n: number) => `c-${pad(n)}`

export interface ContractSeed {
  contracts: Contract[]; parties: ContractParty[]; signatures: ContractSignature[]; history: StatusHistory[]; links: DocumentLink[]
  lines: ContractLine[]; attachments: ContractAttachmentRow[]; numbering: Record<string, number>
}

export function contractsSeed(): ContractSeed {
  const contracts: Contract[] = [], parties: ContractParty[] = [], signatures: ContractSignature[] = [], history: StatusHistory[] = []
  const lines: ContractLine[] = [], attachments: ContractAttachmentRow[] = [], links: DocumentLink[] = []
  const numbering: Record<string, number> = {}

  rows.forEach((r, i) => {
    const n = i + 1, id = cid(n), type = typeMap.get(r.t)!
    const cur = r.cur ?? 'IQD'
    const year = r.start.slice(0, 4)
    numbering[type.prefix] = (numbering[type.prefix] ?? 0) + 1
    const number = `CTR-${type.prefix}-${year}-${pad(numbering[type.prefix], 6)}`
    const partner = r.p ? partnerMap.get(r.p) : undefined
    // in-flight contracts were created a few days ago (so pending-approval alerts look realistic); others before their start date
    const inFlight = ['Draft', 'PendingApproval', 'Approved', 'PendingSignature'].includes(r.st)
    const created = inFlight ? addDays(TODAY, -(3 + (n % 5))) : [addDays(r.start, -28 - n), addDays(TODAY, -3)].sort()[0]
    const createdAt = `${created}T09:00`

    const lineRows = (r.items ?? []).map((it, k): ContractLine => {
      const item = itemMap.get(it[0])!
      return {
        id: `${id}-l${k + 1}`, contractId: id, lineNum: k + 1, itemId: item.id, description: item.name, uomId: item.uomId, commitmentType: 'Quantity',
        agreedQuantity: it[1], unitPrice: it[2], discountPercent: it[3] ?? 0, priceFixed: true, enforceMax: false,
        status: 'Open', notes: '',
      }
    })
    if (r.t === 'ct-sa2') {
      lineRows.push({ id: `${id}-l1`, contractId: id, lineNum: 1, categoryId: 'cat-bld', includeSubcategories: true, description: 'مواد البناء (إسمنت، حديد، ركام)', commitmentType: 'Value', agreedValue: 300_000_000, unitPrice: 0, discountPercent: 0, priceFixed: false, enforceMax: true, status: 'Open', notes: 'التزام بالقيمة لكل مواد البناء' })
    }
    lines.push(...lineRows)
    const computed = lineRows.reduce((s, l) => s + (l.commitmentType === 'Quantity' ? (l.agreedQuantity ?? 0) * l.unitPrice * (1 - l.discountPercent / 100) : (l.agreedValue ?? 0)), 0)
    const value = r.val ?? (computed || undefined)
    const signed = ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st) && type.requiresSignature
    const effective = signed || r.st === 'Approved' || r.st === 'PendingSignature' ? r.start : undefined
    const owner = userMap.get(r.own)!
    const c: Contract = {
      id, number, title: r.title, typeId: type.id, profile: type.profile, direction: type.defaultDirection, status: r.st,
      versionNo: ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st) ? 1 : 0,
      counterpartyId: partner?.id, counterpartyName: partner ? undefined : r.cname, ownerUserId: r.own, responsibleEmployeeId: r.resp ?? owner.employeeId,
      organizationId: r.org ?? owner.orgId, projectId: r.prj, costCenterId: r.cc, currency: cur,
      exchangeRate: cur === 'USD' && ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st) ? 1310 : undefined,
      contractValue: value, paymentTermId: r.pt ?? partner?.paymentTermId, deliveryTerms: type.profile === 'Agreement' ? 'التسليم في موقع العميل — أجور النقل على المورد' : undefined,
      startDate: r.start, endDate: r.end, signatureDate: signed ? addDays(r.start, -4) : undefined, effectiveDate: effective, terminationDate: r.term,
      renewalPolicy: r.rp ?? type.renewalPolicyDefault, noticePeriodDays: r.notice, autoRenewTermMonths: r.autoM, confidentiality: r.conf ?? type.defaultConfidentiality,
      language: 'ar', externalReference: type.profile === 'Agreement' ? `PO-${year}-${pad(100 + n, 4)}` : undefined,
      renewedFromContractId: r.renewedFrom, agreementMode: r.mode, overridesPrices: r.mode === 'Specific',
      closureReason: r.closure, activatedOn: ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st) ? addDays(r.start, -2) : undefined,
      activatedBy: ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st) ? 'u-mgr' : undefined,
      description: `${type.name} مع ${partner?.name ?? r.cname ?? 'الجهة المعنية'} وفق الشروط والأحكام المتفق عليها.`,
      internalNotes: r.hold ?? '', createdBy: r.own === 'u-mgr' || r.own === 'u-sal' || r.own === 'u-pro' ? 'u-req' : r.own, createdAt,
    }
    contracts.push(c)

    // parties
    parties.push({
      id: `${id}-p1`, contractId: id, role: 'Counterparty', partnerId: partner?.id, name: partner?.name ?? r.cname ?? 'إدارة تقنية المعلومات',
      contactName: partner?.contact ?? 'المخوّل بالتوقيع', email: partner?.email ?? 'contact@example.iq', phone: partner?.phone ?? '07700000000', signatoryTitle: 'المدير المفوّض', isPrimary: true,
    })
    if (type.profile === 'Agreement' && n % 3 === 0) {
      parties.push({ id: `${id}-p2`, contractId: id, role: 'Guarantor', name: 'مصرف الرافدين — فرع الكرادة', contactName: 'مدير الضمانات', email: 'guarantees@rafidain.example.iq', phone: '07801110000', signatoryTitle: 'مدير الفرع', isPrimary: false })
    }
    if (type.category === 'Project') {
      parties.push({ id: `${id}-p2`, contractId: id, role: 'Witness', name: 'مكتب الأمين للاستشارات الهندسية', contactName: 'م. ضياء الأمين', email: 'info@alameen.example.iq', phone: '07901112222', signatoryTitle: 'مهندس مقيم', isPrimary: false })
    }

    // attachments (draft doc for all; signed pdf for signed contracts)
    const att = (k: string, sub: ContractAttachmentRow['subType'], name: string, size: number, at: string): ContractAttachmentRow => ({
      id: `${id}-a${k}`, ownerType: 'contract', ownerId: id, subType: sub, fileName: name, size, contentType: name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedBy: 'u-req', uploadedAt: at, version: 1,
    })
    attachments.push(att('1', 'Draft', `مسودة-${number}.docx`, 180_000 + n * 3_100, createdAt))
    if (signed || (r.st === 'PendingSignature')) attachments.push(att('2', 'Signed', `العقد-الموقع-${number}.pdf`, 620_000 + n * 4_700, `${addDays(r.start, -4)}T12:00`))
    if (type.category === 'Project' || n % 4 === 0) attachments.push(att('3', 'Appendix', `ملحق-الأسعار-${number}.pdf`, 210_000 + n * 1_900, `${addDays(r.start, -6)}T10:00`))

    // signatures
    if (signed || r.st === 'PendingSignature') {
      const when = addDays(r.start, -4)
      const company = userMap.get('u-gm')!
      const method = n % 2 ? 'ExternalProvider' : 'Uploaded'
      if (r.st === 'PendingSignature') {
        signatures.push({ id: `${id}-s1`, contractId: id, partyId: `${id}-p1`, role: 'Company', signerName: company.name, signerTitle: company.title, signedOn: addDays(TODAY, -1), method: 'ExternalProvider', externalSignatureId: `SIG-${pad(n, 5)}` })
      } else {
        signatures.push(
          { id: `${id}-s1`, contractId: id, partyId: `${id}-p1`, role: 'Counterparty', signerName: partner?.contact ?? 'المخوّل بالتوقيع', signerTitle: 'المدير المفوّض', signedOn: when, method, attachmentId: `${id}-a2`, externalSignatureId: method === 'ExternalProvider' ? `SIG-${pad(n, 5)}` : undefined },
          { id: `${id}-s2`, contractId: id, role: 'Company', signerName: company.name, signerTitle: company.title, signedOn: when, method, attachmentId: `${id}-a2`, externalSignatureId: method === 'ExternalProvider' ? `SIG-${pad(n, 5)}B` : undefined },
        )
      }
    }

    // history: created, then the path to the current status
    const path: ContractStatus[] = ['Draft']
    const add = (s: ContractStatus) => path.push(s)
    const beyondDraft = r.st !== 'Draft' && r.st !== 'Cancelled'
    if (beyondDraft) {
      add('PendingApproval')
      if (r.st !== 'PendingApproval') { add('Approved'); if (type.requiresSignature && r.st !== 'Approved') add('PendingSignature') }
      if (['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(r.st)) add('Active')
      if (r.st === 'OnHold') add('OnHold')
      if (r.st === 'Expired') add('Expired')
      if (r.st === 'Terminated') add('Terminated')
      if (r.st === 'Closed') add('Closed')
    }
    if (r.st === 'Cancelled') add('Cancelled')
    const base = createdAt.slice(0, 10)
    path.forEach((s, k) => {
      const at = s === 'Active' ? `${c.activatedOn}T10:00`
        : s === 'Expired' ? `${addDays(r.end ?? TODAY, 1)}T00:05`
        : s === 'Terminated' ? `${r.term}T11:00`
        : s === 'Closed' ? `${r.closure === 'Renewed' ? addDays(r.end ?? TODAY, 0) : r.end}T08:00`
        : s === 'OnHold' ? `${addDays(TODAY, -12 - (n % 7))}T14:30`
        : `${[addDays(base, k), c.activatedOn ? addDays(c.activatedOn, -1) : TODAY].sort()[0]}T${pad(9 + k)}:15`
      history.push({
        id: `${id}-h${k}`, contractId: id, from: k ? path[k - 1] : undefined, to: s, byUserId: s === 'Expired' ? 'u-adm' : s === 'Active' || s === 'PendingSignature' ? 'u-mgr' : s === 'Approved' ? 'u-gm' : s === 'PendingApproval' ? c.createdBy : c.createdBy,
        at, reason: s === 'OnHold' ? r.hold : s === 'Terminated' ? 'إنهاء بالاتفاق بعد تغيير خطة التوريد' : s === 'Cancelled' ? 'صرف النظر عن التعاقد' : s === 'Closed' ? (r.closure === 'Renewed' ? 'جُدِّد بعقد لاحق' : 'اكتمل التنفيذ') : undefined,
      })
    })
  })

  // related links
  links.push(
    { id: 'lk-1', contractId: 'c-22', linkType: 'Source', docType: 'CTR', docId: 'c-21', docRef: contracts[20].number, docDate: '2025-12-20' },
    { id: 'lk-2', contractId: 'c-25', linkType: 'Related', docType: 'PRJ', docId: 'prj-4', docRef: 'PRJ-04', docDate: '2026-02-20' },
    { id: 'lk-3', contractId: 'c-16', linkType: 'Related', docType: 'AST', docId: 'ast-77', docRef: 'AST-000077 (مولد 500 ك.ف.أ)', docDate: '2026-01-25' },
    { id: 'lk-4', contractId: 'c-17', linkType: 'Related', docType: 'AST', docId: 'ast-91', docRef: 'AST-000091 (محول 250 ك.ف.أ)', docDate: '2026-06-20' },
    { id: 'lk-5', contractId: 'c-01', linkType: 'Source', docType: 'SQT', docId: 'sqt-118', docRef: 'SQT-2025-000118', docDate: '2025-12-28' },
    { id: 'lk-6', contractId: 'c-09', linkType: 'Source', docType: 'PRQ', docId: 'prq-044', docRef: 'PRQ-2025-000044', docDate: '2025-12-10' },
  )
  return { contracts, parties, signatures, history, links, lines, attachments, numbering }
}
