// Estimates with their requests and approval history (area 4). Each one shows a rule of §20.1.4:
// auto-approval under the threshold, workshop-manager band, two levels above 5,000,000, line discount over the limit
// (rejected then revised), goodwill line, internal cost limit with self-approval blocked, expiry, customer acceptance.
import type { ApprovalRequest, AuditEntry, Estimate, EstimateLine, MaintRequest, Task } from '../types'

let ln = 0
const L = (kind: EstimateLine['kind'], itemId: string, qty: number, price: number, coverage: EstimateLine['coverage'] = 'paid', discountPct = 0): EstimateLine =>
  ({ id: `el-${++ln}`, kind, itemId, qty, price, discountPct, coverage })

type R = Omit<MaintRequest, 'number' | 'receivedBy' | 'accessories' | 'channel'> & { no: number; channel?: MaintRequest['channel']; accessories?: string; receivedBy?: string }
const q = ({ no, ...x }: R): MaintRequest => ({ number: `MRQ-2026-${String(no).padStart(6, '0')}`, receivedBy: 'u-adv', accessories: '', channel: 'walkIn', ...x })

export const requests: MaintRequest[] = [
  q({ no: 201, id: 'rq-201', assetId: 'as-04', partnerId: 'p-osama', maintenanceTypeId: 'mt-car', receivedAt: '2026-11-05T10:10', complaint: 'اهتزاز في المقود عند الفرملة على السرعات العالية.', meterAtIntake: 108_300, accessories: 'مفتاحان', status: 'inDiagnosis', estimateId: 'es-201' }),
  q({ no: 202, id: 'rq-202', assetId: 'as-12', partnerId: 'p-zaid', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-04T17:30', complaint: 'المكيف يفصل بعد دقائق، والضاغط لا يشتغل.', status: 'awaitingApproval', estimateId: 'es-202', channel: 'phone', contactName: 'زيد الخفاجي', contactPhone: '0771 902 3318' }),
  q({ no: 203, id: 'rq-203', assetId: 'as-17', partnerId: 'p-alnoor', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-02T09:00', complaint: 'ضعف تبريد في صالة العمليات — الوحدات الأربع للصالة تعمل بأقل من نصف قدرتها.', status: 'awaitingApproval', estimateId: 'es-203', channel: 'phone', contactName: 'م. سرى (صيانة المستشفى)', contactPhone: '0780 800 4400', receivedBy: 'u-adv2' }),
  q({ no: 204, id: 'rq-204', assetId: 'as-07', partnerId: 'p-rafidain', maintenanceTypeId: 'mt-svc', receivedAt: '2026-10-31T12:00', complaint: 'خدمة دورية 25,000 كم (يحضرها المستأجر سليم التميمي).', meterAtIntake: 24_980, status: 'approved', estimateId: 'es-204', contactName: 'سليم التميمي', contactPhone: '0782 118 6677' }),
  q({ no: 205, id: 'rq-205', assetId: 'as-19', partnerId: 'p-dijla', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-03T08:40', complaint: 'المكيف يبرد قليلًا ويصدر صوت طنين.', status: 'approved', estimateId: 'es-205', channel: 'phone', contactName: 'أ. عماد (إدارة المدرسة)', contactPhone: '0771 650 9900', receivedBy: 'u-adv2' }),
  q({ no: 206, id: 'rq-206', assetId: 'as-20', partnerId: 'p-dijla', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-02T10:15', complaint: 'شاشة المكيف لا تستجيب للريموت.', status: 'inDiagnosis', estimateId: 'es-206b', channel: 'phone', contactName: 'أ. عماد (إدارة المدرسة)', contactPhone: '0771 650 9900', receivedBy: 'u-adv2' }),
  q({ no: 207, id: 'rq-207', assetId: 'as-09', partnerId: 'p-int', maintenanceTypeId: 'mt-intv', receivedAt: '2026-11-06T07:45', complaint: 'بيك أب التوزيع: موعد تغيير الزيت وفلتر الهواء.', meterAtIntake: 215_100, status: 'approved', estimateId: 'es-207' }),
  q({ no: 208, id: 'rq-208', assetId: 'as-26', partnerId: 'p-int', maintenanceTypeId: 'mt-int', receivedAt: '2026-11-05T15:20', complaint: 'مولد المقر: دخان أسود وضعف في الحمل — البخاخات تحتاج تبديلًا.', status: 'awaitingApproval', estimateId: 'es-208', channel: 'phone', contactName: 'حيدر عبد الأمير', receivedBy: 'u-wm' }),
  q({ no: 209, id: 'rq-209', assetId: 'as-08', partnerId: 'p-rafidain', maintenanceTypeId: 'mt-car', receivedAt: '2026-10-14T11:00', complaint: 'بطارية ضعيفة وصعوبة في التشغيل الصباحي.', meterAtIntake: 70_850, status: 'inDiagnosis', estimateId: 'es-209', contactName: 'موظف الرافدين', contactPhone: '0770 500 1200' }),
  q({ no: 210, id: 'rq-210', assetId: 'as-18', partnerId: 'p-alnoor', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-06T09:30', complaint: 'تعبئة غاز بعد إصلاح سابق — العميل يطلب عدم احتساب الأجور.', status: 'awaitingApproval', estimateId: 'es-210', channel: 'phone', contactName: 'م. سرى (صيانة المستشفى)', contactPhone: '0780 800 4400' }),
]

type E = Omit<Estimate, 'number'> & { no: number }
const e = ({ no, ...x }: E): Estimate => ({ number: `MES-2026-${String(no).padStart(6, '0')}`, ...x })

export const estimates: Estimate[] = [
  e({ no: 41, id: 'es-201', requestId: 'rq-201', assetId: 'as-04', partnerId: 'p-osama', version: 1, status: 'draft', validUntil: '2026-11-20', createdBy: 'u-tec',
    lines: [L('part', 'it-pads', 1, 50_000), L('part', 'it-disc', 2, 65_000), L('service', 'sv-turn', 1, 30_000), L('labor', 'sv-mech', 2, 25_000)] }),
  e({ no: 42, id: 'es-202', requestId: 'rq-202', assetId: 'as-12', partnerId: 'p-zaid', version: 1, status: 'pendingApproval', validUntil: '2026-11-20', createdBy: 'u-adv', submittedBy: 'u-adv',
    lines: [L('part', 'it-comp', 1, 950_000, 'warranty'), L('part', 'it-gas', 3, 30_000), L('labor', 'sv-hvac', 4, 30_000)] }),
  e({ no: 43, id: 'es-203', requestId: 'rq-203', assetId: 'as-17', partnerId: 'p-alnoor', version: 1, status: 'pendingApproval', validUntil: '2026-11-17', createdBy: 'u-adv2', submittedBy: 'u-adv2',
    lines: [L('part', 'it-comp', 4, 950_000), L('part', 'it-gas', 20, 30_000), L('part', 'it-pcb', 4, 120_000), L('labor', 'sv-hvac', 16, 30_000)] }),
  e({ no: 44, id: 'es-204', requestId: 'rq-204', assetId: 'as-07', partnerId: 'p-rafidain', version: 1, status: 'approved', validUntil: '2026-11-15', createdBy: 'u-adv', submittedBy: 'u-adv',
    lines: [L('part', 'it-oil', 4, 15_000), L('part', 'it-oilf', 1, 25_000), L('part', 'it-airf', 1, 20_000), L('labor', 'sv-mech', 1, 25_000)] }),
  e({ no: 45, id: 'es-205', requestId: 'rq-205', assetId: 'as-19', partnerId: 'p-dijla', version: 1, status: 'approved', validUntil: '2026-11-18', createdBy: 'u-adv2', submittedBy: 'u-adv2',
    lines: [L('part', 'it-gas', 2, 30_000), L('part', 'it-cap', 1, 18_000), L('labor', 'sv-hvac', 1.5, 30_000)],
    customerAcceptance: { decision: 'accepted', channel: 'phone', by: 'u-adv2', at: '2026-11-05T10:20', note: 'وافق أ. عماد هاتفيًا' } }),
  e({ no: 46, id: 'es-206a', requestId: 'rq-206', assetId: 'as-20', partnerId: 'p-dijla', version: 1, status: 'rejected', validUntil: '2026-11-17', createdBy: 'u-adv2', submittedBy: 'u-adv2',
    lines: [L('part', 'it-pcb', 1, 120_000, 'paid', 25), L('labor', 'sv-hvac', 1, 30_000)] }),
  e({ no: 46, id: 'es-206b', requestId: 'rq-206', assetId: 'as-20', partnerId: 'p-dijla', version: 2, status: 'draft', validUntil: '2026-11-19', createdBy: 'u-adv2', supersedesId: 'es-206a',
    lines: [L('part', 'it-pcb', 1, 120_000, 'paid', 10), L('labor', 'sv-hvac', 1, 30_000)] }),
  e({ no: 47, id: 'es-207', requestId: 'rq-207', assetId: 'as-09', partnerId: 'p-int', version: 1, status: 'approved', validUntil: '2026-11-21', createdBy: 'u-tec', submittedBy: 'u-tec',
    lines: [L('part', 'it-oil', 7, 15_000), L('part', 'it-oilf', 1, 25_000), L('part', 'it-airf', 1, 20_000), L('labor', 'sv-mech', 1, 25_000)] }),
  e({ no: 48, id: 'es-208', requestId: 'rq-208', assetId: 'as-26', partnerId: 'p-int', version: 1, status: 'pendingApproval', validUntil: '2026-11-20', createdBy: 'u-wm', submittedBy: 'u-wm',
    lines: [L('part', 'it-inj', 8, 210_000), L('part', 'it-avr', 1, 175_000), L('part', 'it-dfil', 2, 22_000), L('labor', 'sv-mech', 6, 25_000)] }),
  e({ no: 49, id: 'es-209', requestId: 'rq-209', assetId: 'as-08', partnerId: 'p-rafidain', version: 1, status: 'expired', validUntil: '2026-10-29', createdBy: 'u-adv', submittedBy: 'u-adv',
    lines: [L('part', 'it-bat', 1, 140_000), L('labor', 'sv-elec', 0.5, 25_000)] }),
  e({ no: 50, id: 'es-210', requestId: 'rq-210', assetId: 'as-18', partnerId: 'p-alnoor', version: 1, status: 'pendingApproval', validUntil: '2026-11-21', createdBy: 'u-adv', submittedBy: 'u-adv',
    lines: [L('part', 'it-gas', 2, 30_000), L('labor', 'sv-hvac', 1, 30_000, 'goodwill')] }),
]

const ap = (x: ApprovalRequest) => x
export const approvals: ApprovalRequest[] = [
  ap({ id: 'ap-202-1', estimateId: 'es-202', round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'pending', submittedBy: 'u-adv', submittedAt: '2026-11-06T11:05', comment: 'المبلغ 1,160,000 د.ع ضمن شريحة تتطلب مدير الورشة' }),
  ap({ id: 'ap-203-1', estimateId: 'es-203', round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'approved', submittedBy: 'u-adv2', submittedAt: '2026-11-05T09:30', decidedBy: 'u-wm', decidedAt: '2026-11-06T13:10', comment: 'موافق فنيًا — الضواغط الأربعة تالفة حسب الفحص' }),
  ap({ id: 'ap-203-2', estimateId: 'es-203', round: 1, version: 1, level: 2, roles: ['financeManager'], status: 'pending', submittedBy: 'u-adv2', submittedAt: '2026-11-05T09:30' }),
  ap({ id: 'ap-204-0', estimateId: 'es-204', round: 1, version: 1, level: 0, roles: [], status: 'notRequired', submittedBy: 'u-adv', submittedAt: '2026-10-31T12:40', decidedBy: 'system', decidedAt: '2026-10-31T12:40', comment: 'تحت حد الاعتماد' }),
  ap({ id: 'ap-205-0', estimateId: 'es-205', round: 1, version: 1, level: 0, roles: [], status: 'notRequired', submittedBy: 'u-adv2', submittedAt: '2026-11-04T09:15', decidedBy: 'system', decidedAt: '2026-11-04T09:15', comment: 'تحت حد الاعتماد' }),
  ap({ id: 'ap-206-1', estimateId: 'es-206a', round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'rejected', submittedBy: 'u-adv2', submittedAt: '2026-11-03T10:00', decidedBy: 'u-wm', decidedAt: '2026-11-04T08:45', comment: 'الخصم 25% غير مبرر؛ الحد المسموح 10%' }),
  ap({ id: 'ap-207-0', estimateId: 'es-207', round: 1, version: 1, level: 0, roles: [], status: 'notRequired', submittedBy: 'u-tec', submittedAt: '2026-11-06T09:00', decidedBy: 'system', decidedAt: '2026-11-06T09:00', comment: 'تحت حد الاعتماد' }),
  ap({ id: 'ap-208-1', estimateId: 'es-208', round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'pending', submittedBy: 'u-wm', submittedAt: '2026-11-06T16:00', comment: 'المبلغ 2,049,000 د.ع ضمن شريحة تتطلب مدير الورشة؛ تكلفة صيانة داخلية 1,254,000 د.ع تتجاوز الحد 1,000,000 د.ع' }),
  ap({ id: 'ap-209-0', estimateId: 'es-209', round: 1, version: 1, level: 0, roles: [], status: 'notRequired', submittedBy: 'u-adv', submittedAt: '2026-10-14T13:00', decidedBy: 'system', decidedAt: '2026-10-14T13:00', comment: 'تحت حد الاعتماد' }),
  ap({ id: 'ap-210-1', estimateId: 'es-210', round: 1, version: 1, level: 1, roles: ['workshopManager'], status: 'pending', submittedBy: 'u-adv', submittedAt: '2026-11-06T10:10', comment: 'سطر بتغطية حسن نية' }),
]

export const tasks: Task[] = [
  { id: 'tk-202', kind: 'estimateApproval', refId: 'es-202', approvalRequestId: 'ap-202-1', roles: ['workshopManager'], status: 'open', createdAt: '2026-11-06T11:05' },
  { id: 'tk-203a', kind: 'estimateApproval', refId: 'es-203', approvalRequestId: 'ap-203-1', roles: ['workshopManager'], status: 'done', createdAt: '2026-11-05T09:30' },
  { id: 'tk-203b', kind: 'estimateApproval', refId: 'es-203', approvalRequestId: 'ap-203-2', roles: ['financeManager'], status: 'open', createdAt: '2026-11-06T13:10' },
  { id: 'tk-206', kind: 'estimateApproval', refId: 'es-206a', approvalRequestId: 'ap-206-1', roles: ['workshopManager'], status: 'done', createdAt: '2026-11-03T10:00' },
  { id: 'tk-208', kind: 'estimateApproval', refId: 'es-208', approvalRequestId: 'ap-208-1', roles: ['workshopManager'], status: 'open', createdAt: '2026-11-06T16:00' },
  { id: 'tk-210', kind: 'estimateApproval', refId: 'es-210', approvalRequestId: 'ap-210-1', roles: ['workshopManager'], status: 'open', createdAt: '2026-11-06T10:10' },
]

const au = (id: string, at: string, userId: string, entityId: string, action: string, detail = ''): AuditEntry => ({ id, at, userId, entity: 'estimate', entityId, action, detail })
export const audit: AuditEntry[] = [
  au('au-e1', '2026-10-14T13:00', 'u-adv', 'es-209', 'اعتماد تلقائي (لا يحتاج اعتمادًا)', 'MES-2026-000049 v1'),
  au('au-e2', '2026-10-30T00:01', 'u-adm', 'es-209', 'انتهاء صلاحية التقدير', 'MES-2026-000049 — 2026-10-29'),
  au('au-e3', '2026-10-31T12:40', 'u-adv', 'es-204', 'اعتماد تلقائي (لا يحتاج اعتمادًا)', 'MES-2026-000044 v1'),
  au('au-e4', '2026-11-03T10:00', 'u-adv2', 'es-206a', 'إرسال للاعتماد', 'الجولة 1 — مدير الورشة'),
  au('au-e5', '2026-11-04T08:45', 'u-wm', 'es-206a', 'رفض التقدير', 'الخصم 25% غير مبرر؛ الحد المسموح 10%'),
  au('au-e6', '2026-11-04T11:00', 'u-adv2', 'es-206b', 'مراجعة التقدير (نسخة جديدة)', 'MES-2026-000046 v2'),
  au('au-e7', '2026-11-04T09:15', 'u-adv2', 'es-205', 'اعتماد تلقائي (لا يحتاج اعتمادًا)', 'MES-2026-000045 v1'),
  au('au-e8', '2026-11-05T10:20', 'u-adv2', 'es-205', 'موافقة العميل', 'وافق أ. عماد هاتفيًا'),
  au('au-e9', '2026-11-05T09:30', 'u-adv2', 'es-203', 'إرسال للاعتماد', 'الجولة 1 — مدير الورشة ← المدير المالي'),
  au('au-e10', '2026-11-06T13:10', 'u-wm', 'es-203', 'اعتماد المستوى 1', 'يُحال إلى المدير المالي'),
  au('au-e11', '2026-11-06T09:00', 'u-tec', 'es-207', 'اعتماد تلقائي (لا يحتاج اعتمادًا)', 'MES-2026-000047 v1'),
  au('au-e12', '2026-11-06T10:10', 'u-adv', 'es-210', 'إرسال للاعتماد', 'الجولة 1 — مدير الورشة'),
  au('au-e13', '2026-11-06T11:05', 'u-adv', 'es-202', 'إرسال للاعتماد', 'الجولة 1 — مدير الورشة'),
  au('au-e14', '2026-11-06T16:00', 'u-wm', 'es-208', 'إرسال للاعتماد', 'الجولة 1 — مدير الورشة'),
]
