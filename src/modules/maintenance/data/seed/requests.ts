// Requests at the front of the flow (area 3): drafts, received, in diagnosis, cancelled. Requests that already have
// an estimate or a work order are seeded with those documents (areas 4–5). Numbers MRQ-2026-000101…112.
import type { MaintRequest } from '../types'

type R = Omit<MaintRequest, 'number' | 'accessories' | 'receivedBy'> & { no: number; accessories?: string; receivedBy?: string }
const q = ({ no, ...x }: R): MaintRequest => ({ number: `MRQ-2026-${String(no).padStart(6, '0')}`, accessories: '', receivedBy: 'u-adv', ...x })

export const requests: MaintRequest[] = [
  q({ no: 101, id: 'rq-101', assetId: 'as-02', partnerId: 'p-rasha', maintenanceTypeId: 'mt-car', receivedAt: '2026-11-06T09:15', complaint: 'صوت طقطقة من الجهة الأمامية اليمنى عند المطبات، وسحب للمقود يمينًا.', meterAtIntake: 151_880, accessories: 'مفتاح احتياط، إطار احتياط', status: 'inDiagnosis', channel: 'walkIn' }),
  q({ no: 102, id: 'rq-102', assetId: 'as-06', partnerId: 'p-zaid', maintenanceTypeId: 'mt-car', receivedAt: '2026-11-06T11:40', complaint: 'لمبة فحص المحرك مضاءة واستهلاك وقود عالٍ.', meterAtIntake: 189_420, accessories: 'مفتاح واحد', status: 'received', channel: 'walkIn' }),
  q({ no: 103, id: 'rq-103', assetId: 'as-14', partnerId: 'p-hiba', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-07T08:20', complaint: 'المكيف يعمل لكن لا يبرد، والوحدة الخارجية تصدر صوتًا عاليًا.', status: 'received', channel: 'phone', contactName: 'هبة السامرائي', contactPhone: '0780 445 0091', receivedBy: 'u-adv2' }),
  q({ no: 104, id: 'rq-104', assetId: 'as-24', partnerId: 'p-dijla', maintenanceTypeId: 'mt-gen', receivedAt: '2026-11-07T09:05', complaint: 'المولد يطفئ بعد عشر دقائق من التشغيل تحت الحمل.', status: 'draft', channel: 'phone', contactName: 'أ. عماد (إدارة المدرسة)', contactPhone: '0771 650 9900', receivedBy: 'u-adv2' }),
  q({ no: 105, id: 'rq-105', assetId: 'as-03', partnerId: 'p-firas', maintenanceTypeId: 'mt-svc', receivedAt: '2026-11-07T10:30', complaint: 'خدمة دورية 20,000 كم: تغيير زيت وفلاتر وفحص عام.', meterAtIntake: 20_140, accessories: '—', status: 'draft', channel: 'whatsapp', contactName: 'فراس الدليمي', contactPhone: '0781 223 5541' }),
  q({ no: 106, id: 'rq-106', assetId: 'as-28', partnerId: 'p-int', maintenanceTypeId: 'mt-int', receivedAt: '2026-11-05T13:10', complaint: 'تسريب زيت هيدروليك من ذراع الرفع، والشوكة تنزل ببطء تحت الحمل.', meterAtIntake: 4_590, status: 'inDiagnosis', channel: 'phone', contactName: 'كرار حسين (المخزن)', contactPhone: '—', receivedBy: 'u-adv2' }),
  q({ no: 107, id: 'rq-107', assetId: 'as-21', partnerId: 'p-firas', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-04T16:45', complaint: 'تسريب ماء من الوحدة الداخلية.', status: 'cancelled', channel: 'phone', contactName: 'فراس الدليمي', contactPhone: '0781 223 5541', cancelReason: 'العميل أصلح العطل بنفسه (تنظيف أنبوب التصريف)' }),
  q({ no: 108, id: 'rq-108', assetId: 'as-05', partnerId: 'p-muna', maintenanceTypeId: 'mt-car', receivedAt: '2026-11-03T10:00', complaint: 'البطارية تفرغ بعد يومين من الوقوف.', meterAtIntake: 41_020, accessories: 'مفتاح واحد', status: 'cancelled', channel: 'walkIn', cancelReason: 'العميل فضّل الوكالة لأن العطل قد يكون ضمن ضمان البطارية' }),
  q({ no: 109, id: 'rq-109', assetId: 'as-16', partnerId: 'p-alnoor', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-07T07:50', complaint: 'مكيف الطوارئ لا يعمل — شاشة الريموت تعرض الخطأ E5.', status: 'received', channel: 'phone', contactName: 'م. سرى (صيانة المستشفى)', contactPhone: '0780 800 4400', receivedBy: 'u-adv2' }),
  q({ no: 110, id: 'rq-110', assetId: 'as-25', partnerId: 'p-osama', maintenanceTypeId: 'mt-gen', receivedAt: '2026-11-06T18:20', complaint: 'دخان أسود كثيف عند التشغيل.', status: 'inDiagnosis', channel: 'whatsapp', contactName: 'أسامة النعيمي', contactPhone: '0773 309 8820' }),
  q({ no: 111, id: 'rq-111', assetId: 'as-10', partnerId: 'p-int', maintenanceTypeId: 'mt-intv', receivedAt: '2026-11-07T08:00', complaint: 'فان الفريق الميداني: صوت احتكاك عند الفرملة.', meterAtIntake: 97_010, status: 'received', channel: 'walkIn' }),
  q({ no: 112, id: 'rq-112', assetId: 'as-15', partnerId: 'p-muna', maintenanceTypeId: 'mt-ac', receivedAt: '2026-11-07T12:10', complaint: 'تنظيف وفحص قبل الشتاء (تحويل إلى التدفئة).', status: 'draft', channel: 'whatsapp', contactName: 'منى الجبوري', contactPhone: '0772 610 7734' }),
]

/** Intake readings that the received/in-diagnosis seed requests already recorded. */
export const intakeReadings = requests
  .filter((r) => r.meterAtIntake && r.status !== 'draft' && r.status !== 'cancelled')
  .map((r, i) => ({ id: `rd-rq-${i + 1}`, assetId: r.assetId, value: r.meterAtIntake!, unit: (r.assetId === 'as-28' ? 'hours' : 'km') as 'km' | 'hours', at: r.receivedAt.slice(0, 10), source: 'intake' as const, docRef: r.number }))
