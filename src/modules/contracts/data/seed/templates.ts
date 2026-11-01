// Module 6 seed: clause library (25 clauses, some with a second version), 8 templates (one with v2, one archived, one never published),
// and frozen terms copied onto existing contracts through the real engine.
import { copyTerms, publishTemplate, saveClause, setTemplateArchived } from '../templates'
import type { ContractTemplate, DB, TemplateDefaults } from '../types'

const clauses: [code: string, title: string, category: string, body: string, v2?: string][] = [
  ['CL-001', 'التعريفات', 'عام', 'يُقصد بالعبارات التالية المعاني المبينة قرين كل منها: «الطرف الأول» {{company}}، «الطرف الثاني» {{counterparty}}، «العقد» هذا العقد رقم {{contractNumber}} وملاحقه.'],
  ['CL-002', 'نطاق العقد', 'عام', 'يلتزم الطرف الثاني بتنفيذ موضوع العقد «{{title}}» وفق المواصفات والشروط المتفق عليها وبما لا يخالف أحكام هذا العقد.'],
  ['CL-003', 'مدة العقد', 'عام', 'تبدأ مدة هذا العقد في {{startDate}} وتنتهي في {{endDate}} ما لم يُنهَ أو يُجدَّد وفق أحكامه.', 'تبدأ مدة هذا العقد في {{startDate}} وتنتهي في {{endDate}}، ويجوز تمديدها بملحق مكتوب يُعتمد قبل نهاية المدة بمدة لا تقل عن {{noticeDays}} يوماً.'],
  ['CL-004', 'القيمة وشروط الدفع', 'مالي', 'القيمة الإجمالية للعقد {{value}} {{currency}}، وتُسدَّد وفق شرط الدفع: {{paymentTerm}} من تاريخ استلام الفاتورة المستوفية للشروط.'],
  ['CL-005', 'التسليم والاستلام', 'فني', 'يُنفَّذ التسليم وفق الشروط التالية: {{deliveryTerms}}. ويُحرَّر محضر استلام موقّع من الطرفين عند كل دفعة.'],
  ['CL-006', 'الضمان', 'ضمان', 'يضمن الطرف الثاني جودة المواد والأعمال لمدة اثني عشر شهراً من تاريخ الاستلام، ويلتزم بإصلاح أو استبدال كل ما يظهر فيه عيب خلالها على نفقته.', 'يضمن الطرف الثاني جودة المواد والأعمال لمدة ثمانية عشر شهراً من تاريخ الاستلام النهائي، ويلتزم بإصلاح أو استبدال كل ما يظهر فيه عيب خلالها على نفقته.'],
  ['CL-007', 'غرامات التأخير', 'مالي', 'في حال التأخر في التنفيذ عن المواعيد المحددة تُفرض غرامة تأخير بنسبة (0.1%) من قيمة الجزء المتأخر عن كل يوم تأخير بحد أقصى (10%) من قيمة العقد.', 'في حال التأخر في التنفيذ عن المواعيد المحددة تُفرض غرامة تأخير بنسبة (0.1%) من قيمة الجزء المتأخر عن كل يوم تأخير بحد أقصى (5%) من قيمة العقد، ولا تُفرض إذا ثبت أن التأخير سببه الطرف الأول.'],
  ['CL-008', 'السرية', 'سرية', 'يلتزم الطرفان بالمحافظة على سرية المعلومات المتبادلة بينهما وعدم إفشائها لأي جهة خلال مدة العقد وبعد انتهائه لمدة ثلاث سنوات.'],
  ['CL-009', 'الملكية الفكرية', 'قانوني', 'تبقى حقوق الملكية الفكرية لكل طرف ملكاً له، وتؤول للطرف الأول حقوق المخرجات التي أُعدّت خصيصاً بموجب هذا العقد.'],
  ['CL-010', 'القوة القاهرة', 'قانوني', 'لا يُسأل أي من الطرفين عن التأخير الناتج عن قوة قاهرة بشرط إخطار الطرف الآخر كتابةً خلال سبعة أيام من وقوعها.'],
  ['CL-011', 'إنهاء العقد', 'إنهاء', 'يجوز لأي من الطرفين إنهاء العقد بإخطار كتابي مدته {{noticeDays}} يوماً، ويجوز للطرف الأول إنهاؤه فوراً عند إخلال الطرف الثاني بالتزاماته الجوهرية.', 'يجوز لأي من الطرفين إنهاء العقد بإخطار كتابي مدته {{noticeDays}} يوماً، ويجوز للطرف الأول إنهاؤه فوراً عند إخلال الطرف الثاني بالتزاماته الجوهرية دون إخلال بحقه في التعويض.'],
  ['CL-012', 'تسوية النزاعات', 'قانوني', 'تُحل الخلافات ودياً أولاً، فإن تعذّر ذلك أُحيلت إلى المحكمة المختصة في بغداد.'],
  ['CL-013', 'القانون الواجب التطبيق', 'قانوني', 'يخضع هذا العقد ويُفسَّر وفق القوانين النافذة في جمهورية العراق.'],
  ['CL-014', 'الإخطارات', 'عام', 'تُرسل الإخطارات بين الطرفين كتابةً إلى العنوان الموضح في هذا العقد، وتُعد منتجة لآثارها من تاريخ الاستلام.'],
  ['CL-015', 'التنازل عن العقد', 'قانوني', 'لا يجوز لأي من الطرفين التنازل عن حقوقه أو التزاماته بموجب هذا العقد أو التعاقد من الباطن دون موافقة الطرف الآخر الخطية.'],
  ['CL-016', 'التأمين', 'مالي', 'يلتزم الطرف الثاني بالتأمين على المواد والمعدات أثناء النقل والتسليم لصالح الطرف الأول.'],
  ['CL-017', 'مستوى الخدمة', 'فني', 'يلتزم الطرف الثاني بالاستجابة لطلبات الدعم خلال أربع ساعات عمل وإنجاز العطل الحرج خلال أربع وعشرين ساعة.', 'يلتزم الطرف الثاني بالاستجابة لطلبات الدعم خلال ساعتين في العطل الحرج وأربع ساعات في غيره، وإنجاز العطل الحرج خلال أربع وعشرين ساعة.'],
  ['CL-018', 'الصيانة الوقائية', 'فني', 'ينفّذ الطرف الثاني زيارات صيانة وقائية دورية وفق الجدول المرفق ويقدّم تقريراً بعد كل زيارة.'],
  ['CL-019', 'قطع الغيار', 'فني', 'تُورَّد قطع الغيار الأصلية بالأسعار المتفق عليها في ملحق الأسعار، وتُحاسب بشكل منفصل عن قيمة العقد.'],
  ['CL-020', 'الإيجار والمرافق', 'مالي', 'تُدفع أجرة الإيجار {{value}} {{currency}} وفق شرط الدفع {{paymentTerm}}، ويتحمل المستأجر فواتير المرافق.'],
  ['CL-021', 'تسليم العين المؤجرة', 'فني', 'تُسلَّم العين المؤجرة بحالتها الراهنة بمحضر معاينة، وتُعاد عند الانتهاء بالحالة نفسها عدا الاستهلاك المعتاد.'],
  ['CL-022', 'حدود مسؤولية المستشار', 'قانوني', 'لا تتجاوز مسؤولية المستشار قيمة الأتعاب المدفوعة عن الأعمال موضوع المطالبة.'],
  ['CL-023', 'حماية البيانات', 'سرية', 'يلتزم الطرفان بمعالجة البيانات الشخصية للأغراض المتفق عليها فقط وباتخاذ التدابير المناسبة لحمايتها.'],
  ['CL-024', 'مكافحة الفساد', 'قانوني', 'يتعهد الطرف الثاني بعدم تقديم أي منفعة غير مشروعة لموظفي الطرف الأول، ويُعد الإخلال بذلك سبباً للإنهاء الفوري.'],
  ['CL-025', 'التجديد', 'عام', 'يجوز تجديد العقد باتفاق الطرفين، وإذا كانت سياسة التجديد تلقائية فيُجدَّد لمدة مماثلة ما لم يُخطر أحدهما الآخر قبل {{noticeDays}} يوماً من انتهاء المدة.'],
]

interface T { code: string; name: string; typeId: string; defaults: TemplateDefaults; clauses: [string, boolean?][]; attachments?: string[]; v2?: { clauses?: [string, boolean?][]; defaults?: TemplateDefaults }; archive?: boolean; unpublished?: boolean }
const base = ['CL-001', 'CL-002', 'CL-003', 'CL-004']
const common: [string, boolean?][] = [['CL-010', true], ['CL-012'], ['CL-013'], ['CL-014', true]]
const templates: T[] = [
  { code: 'TPL-SA1', name: 'قالب اتفاقية توريد مبيعات', typeId: 'ct-sa1', defaults: { durationMonths: 12, renewalPolicy: 'Manual', noticePeriodDays: 30, paymentTermId: 'pt-60', deliveryTerms: 'التسليم في موقع العميل — أجور النقل على الشركة', approvalWorkflowLabel: 'مسار المبيعات (Elsa)' },
    clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-005'], ['CL-006'], ['CL-007', true], ['CL-008', true], ...common, ['CL-011'], ['CL-025', true]], attachments: ['ملحق-الأسعار.pdf'], v2: { clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-005'], ['CL-006'], ['CL-007', true], ['CL-008', true], ['CL-024', true], ...common, ['CL-011'], ['CL-025', true]] } },
  { code: 'TPL-PA1', name: 'قالب اتفاقية توريد مشتريات', typeId: 'ct-pa1', defaults: { durationMonths: 12, renewalPolicy: 'Manual', noticePeriodDays: 30, paymentTermId: 'pt-60', deliveryTerms: 'التسليم في مخازن الشركة — أجور النقل على المورد' },
    clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-005'], ['CL-006'], ['CL-007'], ['CL-016', true], ['CL-024'], ...common, ['CL-011']] },
  { code: 'TPL-PA2', name: 'قالب اتفاقية إطارية (مشتريات)', typeId: 'ct-pa2', defaults: { durationMonths: 24, renewalPolicy: 'Manual', noticePeriodDays: 45, paymentTermId: 'pt-30' }, clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-005'], ['CL-006'], ['CL-007'], ['CL-024'], ...common, ['CL-011'], ['CL-025']] },
  { code: 'TPL-SV1', name: 'قالب عقد صيانة دورية', typeId: 'ct-sv1', defaults: { durationMonths: 12, renewalPolicy: 'Auto', noticePeriodDays: 30, paymentTermId: 'pt-30', slaDefaults: 'استجابة 4 ساعات / إصلاح حرج 24 ساعة', billingDefaults: 'فاتورة ربع سنوية' },
    clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-017'], ['CL-018'], ['CL-019', true], ['CL-006', true], ['CL-008', true], ...common, ['CL-011'], ['CL-025']], v2: { clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-017'], ['CL-018'], ['CL-019', true], ['CL-006', true], ['CL-023', true], ['CL-008', true], ...common, ['CL-011'], ['CL-025']], defaults: { slaDefaults: 'استجابة ساعتان للعطل الحرج / إصلاح 24 ساعة' } } },
  { code: 'TPL-SV2', name: 'قالب عقد ضمان (قديم)', typeId: 'ct-sv2', defaults: { durationMonths: 24, renewalPolicy: 'None', paymentTermId: 'pt-60' }, clauses: [...base.map((c) => [c] as [string, boolean?]), ['CL-006'], ['CL-012'], ['CL-013']], archive: true },
  { code: 'TPL-NDA', name: 'قالب اتفاقية عدم إفصاح', typeId: 'ct-nda', defaults: { durationMonths: 36, renewalPolicy: 'None' }, clauses: [['CL-001'], ['CL-008'], ['CL-023'], ['CL-011'], ['CL-012'], ['CL-013']] },
  { code: 'TPL-LSE', name: 'قالب عقد إيجار', typeId: 'ct-lse', defaults: { durationMonths: 12, renewalPolicy: 'Manual', noticePeriodDays: 60 }, clauses: [['CL-001'], ['CL-003'], ['CL-020'], ['CL-021'], ['CL-016', true], ['CL-011'], ['CL-012'], ['CL-013']] },
  { code: 'TPL-CON', name: 'قالب عقد استشارات', typeId: 'ct-con', defaults: { durationMonths: 12, renewalPolicy: 'Manual', noticePeriodDays: 30 }, clauses: [['CL-001'], ['CL-002'], ['CL-003'], ['CL-004'], ['CL-022'], ['CL-008'], ['CL-009', true], ['CL-011'], ['CL-013']], unpublished: true },
]

/** [contract id, template code, template version no] — terms frozen from that version. */
const adoption: [string, string, number][] = [
  ['c-01', 'TPL-SA1', 1], ['c-03', 'TPL-SA1', 1], ['c-04', 'TPL-SA1', 1], ['c-06', 'TPL-SA1', 1], ['c-09', 'TPL-PA2', 1], ['c-10', 'TPL-PA1', 1], ['c-11', 'TPL-PA1', 1], ['c-12', 'TPL-PA1', 1],
  ['c-16', 'TPL-SV1', 1], ['c-17', 'TPL-SV1', 1], ['c-19', 'TPL-SV1', 1], ['c-22', 'TPL-LSE', 1], ['c-23', 'TPL-NDA', 1], ['c-07', 'TPL-SA1', 1],
]

export function templatesSeed(db: DB) {
  db.clauses = []; db.clauseVersions = []; db.templates = []; db.templateVersions = []; db.terms = []; db.printLog = []
  const admin = db.userId
  db.userId = 'u-leg'
  const clauseId = new Map<string, string>()
  clauses.forEach(([code, title, category, body, v2]) => {
    const c = saveClause(db, { code, title, category, body })
    if (typeof c === 'string') throw new Error(`clause ${code}: ${c}`)
    clauseId.set(code, c.id)
    if (v2) { const r = saveClause(db, { id: c.id, title, category, body: v2 }); if (typeof r === 'string') throw new Error(`clause v2 ${code}: ${r}`) }
  })
  // older clause versions were published earlier; templates v1 reference version 1 of the clause
  const v1Of = (code: string) => `${clauseId.get(code)}-v1`
  const origin: Record<string, ContractTemplate> = {}
  templates.forEach((t, i) => {
    const tpl: ContractTemplate = {
      id: `tpl-${i + 1}`, code: t.code, name: t.name, typeId: t.typeId, currentVersionNo: 0, status: 'Draft',
      draft: { defaults: structuredClone(t.defaults), clauses: t.clauses.map(([code, opt], k) => ({ clauseId: clauseId.get(code)!, order: k + 1, isOptional: !!opt })), attachments: t.attachments ?? [] },
    }
    db.templates.push(tpl); origin[t.code] = tpl
    if (t.unpublished) return
    const e = publishTemplate(db, tpl.id)
    if (e) throw new Error(`template ${t.code}: ${e}`)
    // version 1 must point at version 1 of every clause that later got a second version
    const v = db.templateVersions.find((x) => x.templateId === tpl.id && x.versionNo === 1)!
    v.clauseRefs.forEach((r) => { const cv = db.clauseVersions.find((x) => x.id === r.clauseVersionId)!; r.clauseVersionId = `${cv.clauseId}-v1` })
  })
  void v1Of
  // v2 of two templates (draft edited then published against the newest clause texts)
  templates.filter((t) => t.v2).forEach((t) => {
    const tpl = origin[t.code]
    if (t.v2!.clauses) tpl.draft.clauses = t.v2!.clauses.map(([code, opt], k) => ({ clauseId: clauseId.get(code)!, order: k + 1, isOptional: !!opt }))
    if (t.v2!.defaults) tpl.draft.defaults = { ...tpl.draft.defaults, ...t.v2!.defaults }
    const e = publishTemplate(db, tpl.id)
    if (e) throw new Error(`template v2 ${t.code}: ${e}`)
  })
  templates.filter((t) => t.archive).forEach((t) => setTemplateArchived(db, origin[t.code].id, true))
  // existing contracts adopted their template before it changed: frozen terms from the stated version
  adoption.forEach(([cid, code, vn]) => {
    const c = db.contracts.find((x) => x.id === cid)
    const v = db.templateVersions.find((x) => x.templateId === origin[code].id && x.versionNo === vn)
    if (!c || !v) return
    c.templateVersionId = v.id
    copyTerms(db, cid, v.id)
  })
  // a few optional clauses were switched off by their authors
  const off = db.terms.filter((t) => t.isOptional && t.contractId === 'c-04').slice(0, 1)
  off.forEach((t) => { t.isIncluded = false })
  db.userId = admin
}
