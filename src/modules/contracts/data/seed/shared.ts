// Shared master data (fictional Iraqi entities). Module seeds add their own arrays and reference these ids.
import type { AppUser, Category, CostCenter, Currency, Employee, ExchangeRate, Item, Organization, Partner, PaymentTerm, Project, Uom } from '../types'

export const organizations: Organization[] = [
  { id: 'org-1', code: 'HQ', name: 'إنكي القابضة — المقر الرئيسي', city: 'بغداد' },
  { id: 'org-2', code: 'BSR', name: 'إنكي — فرع البصرة', city: 'البصرة' },
  { id: 'org-3', code: 'EBL', name: 'إنكي — فرع أربيل', city: 'أربيل' },
]

export const users: AppUser[] = [
  { id: 'u-req', name: 'هدى كاظم الجبوري', title: 'موظفة عقود', role: 'requester', orgId: 'org-1', employeeId: 'emp-1' },
  { id: 'u-app', name: 'أحمد صالح العبيدي', title: 'مدير الإدارة القانونية والعقود', role: 'approver', orgId: 'org-1', employeeId: 'emp-2' },
  { id: 'u-mgr', name: 'سارة حسين النعيمي', title: 'مديرة العقود', role: 'manager', orgId: 'org-1', employeeId: 'emp-3' },
  { id: 'u-leg', name: 'علي ناصر الربيعي', title: 'المستشار القانوني', role: 'legal', orgId: 'org-1', employeeId: 'emp-4' },
  { id: 'u-sal', name: 'مصطفى جاسم الساعدي', title: 'مدير المبيعات', role: 'sales', orgId: 'org-1', employeeId: 'emp-5' },
  { id: 'u-pro', name: 'زينب عبد الله الخفاجي', title: 'مديرة المشتريات', role: 'procurement', orgId: 'org-1', employeeId: 'emp-6' },
  { id: 'u-fin', name: 'ياسر محمود الدليمي', title: 'محاسب أول', role: 'finance', orgId: 'org-1', employeeId: 'emp-7' },
  { id: 'u-adm', name: 'ليث فاضل الشمري', title: 'مسؤول النظام', role: 'admin', orgId: 'org-1', employeeId: 'emp-8' },
  { id: 'u-fd', name: 'نبيل سلمان الحمداني', title: 'المدير المالي', role: 'approver', orgId: 'org-1', employeeId: 'emp-9' },
  { id: 'u-gm', name: 'عبد الرحمن إبراهيم الحيدري', title: 'المدير العام', role: 'approver', orgId: 'org-1', employeeId: 'emp-10' },
  { id: 'u-bsr', name: 'حيدر كريم الموسوي', title: 'مدير فرع البصرة', role: 'requester', orgId: 'org-2', employeeId: 'emp-11' },
]

export const employees: Employee[] = [
  { id: 'emp-1', name: 'هدى كاظم الجبوري', title: 'موظفة عقود', department: 'العقود', orgId: 'org-1' },
  { id: 'emp-2', name: 'أحمد صالح العبيدي', title: 'مدير الإدارة القانونية والعقود', department: 'الشؤون القانونية', orgId: 'org-1' },
  { id: 'emp-3', name: 'سارة حسين النعيمي', title: 'مديرة العقود', department: 'العقود', orgId: 'org-1' },
  { id: 'emp-4', name: 'علي ناصر الربيعي', title: 'المستشار القانوني', department: 'الشؤون القانونية', orgId: 'org-1' },
  { id: 'emp-5', name: 'مصطفى جاسم الساعدي', title: 'مدير المبيعات', department: 'المبيعات', orgId: 'org-1' },
  { id: 'emp-6', name: 'زينب عبد الله الخفاجي', title: 'مديرة المشتريات', department: 'المشتريات', orgId: 'org-1' },
  { id: 'emp-7', name: 'ياسر محمود الدليمي', title: 'محاسب أول', department: 'المالية', orgId: 'org-1' },
  { id: 'emp-8', name: 'ليث فاضل الشمري', title: 'مسؤول النظام', department: 'تقنية المعلومات', orgId: 'org-1' },
  { id: 'emp-9', name: 'نبيل سلمان الحمداني', title: 'المدير المالي', department: 'المالية', orgId: 'org-1' },
  { id: 'emp-10', name: 'عبد الرحمن إبراهيم الحيدري', title: 'المدير العام', department: 'الإدارة العليا', orgId: 'org-1' },
  { id: 'emp-11', name: 'حيدر كريم الموسوي', title: 'مدير فرع البصرة', department: 'العمليات', orgId: 'org-2' },
  { id: 'emp-12', name: 'رنا طارق السامرائي', title: 'مهندسة مشاريع', department: 'المشاريع', orgId: 'org-1' },
  { id: 'emp-13', name: 'كرار عباس الزبيدي', title: 'مشرف صيانة', department: 'الصيانة', orgId: 'org-2' },
  { id: 'emp-14', name: 'دلال أحمد البرزنجي', title: 'مسؤولة مشتريات أربيل', department: 'المشتريات', orgId: 'org-3' },
]

export const paymentTerms: PaymentTerm[] = [
  { id: 'pt-0', code: 'CASH', name: 'نقداً عند التسليم', days: 0 },
  { id: 'pt-30', code: 'NET30', name: 'صافي 30 يوماً', days: 30 },
  { id: 'pt-60', code: 'NET60', name: 'صافي 60 يوماً', days: 60 },
  { id: 'pt-90', code: 'NET90', name: 'صافي 90 يوماً', days: 90 },
]

const P = (id: string, code: string, name: string, kind: Partner['kind'], city: string, contact: string, phone: string, pt: string, currency: Partner['currency'] = 'IQD'): Partner => ({
  id, code, name, kind, city, contact, phone, email: `info@${code.toLowerCase()}.example.iq`, paymentTermId: pt, currency,
})
export const partners: Partner[] = [
  P('p-c1', 'C-0001', 'شركة الفرات للإنشاءات', 'customer', 'بغداد', 'م. صباح رشيد', '07701234501', 'pt-60'),
  P('p-c2', 'C-0002', 'مجموعة دجلة التجارية', 'customer', 'بغداد', 'أ. ميثاق علي', '07801234502', 'pt-30'),
  P('p-c3', 'C-0003', 'شركة بابل للصناعات الغذائية', 'customer', 'الحلة', 'أ. سهى حسن', '07901234503', 'pt-30'),
  P('p-c4', 'C-0004', 'مصنع الميناء للحديد', 'customer', 'البصرة', 'م. فلاح عادل', '07701234504', 'pt-60', 'USD'),
  P('p-c5', 'C-0005', 'شركة كردستان للمقاولات', 'customer', 'أربيل', 'م. شيرزاد كاوه', '07501234505', 'pt-90', 'USD'),
  P('p-c6', 'C-0006', 'مستشفى الرافدين الأهلي', 'customer', 'بغداد', 'د. ريم جواد', '07801234506', 'pt-30'),
  P('p-c7', 'C-0007', 'شركة السومرية للطاقة', 'customer', 'الناصرية', 'م. علاء سعدون', '07701234507', 'pt-60'),
  P('p-c8', 'C-0008', 'مؤسسة النخيل للتجهيزات', 'customer', 'كربلاء', 'أ. حسين وائل', '07801234508', 'pt-30'),
  P('p-c9', 'C-0009', 'شركة أور للنقل', 'customer', 'الناصرية', 'أ. جنان فؤاد', '07901234509', 'pt-30'),
  P('p-c10', 'C-0010', 'جامعة الحكمة الأهلية', 'customer', 'بغداد', 'د. باسل مهدي', '07701234510', 'pt-60'),
  P('p-v1', 'V-0001', 'شركة العراق للإسمنت والمواد', 'vendor', 'السليمانية', 'م. كارزان هوشيار', '07701234601', 'pt-30'),
  P('p-v2', 'V-0002', 'شركة بغداد للحديد والصلب', 'vendor', 'بغداد', 'أ. رعد منصور', '07801234602', 'pt-60', 'USD'),
  P('p-v3', 'V-0003', 'الأهلية للمعدات الثقيلة', 'vendor', 'بغداد', 'م. أسامة جمال', '07901234603', 'pt-90', 'USD'),
  P('p-v4', 'V-0004', 'شركة الشرق للتجهيزات الكهربائية', 'vendor', 'البصرة', 'م. عمار خضير', '07701234604', 'pt-60'),
  P('p-v5', 'V-0005', 'مصنع الأمل للبلاستيك', 'vendor', 'كركوك', 'أ. بيريفان نجم', '07501234605', 'pt-30'),
  P('p-v6', 'V-0006', 'شركة النور للتقنيات', 'vendor', 'بغداد', 'م. تبارك سالم', '07801234606', 'pt-30', 'USD'),
  P('p-v7', 'V-0007', 'مؤسسة الفجر للخدمات اللوجستية', 'vendor', 'البصرة', 'أ. عقيل ستار', '07701234607', 'pt-30'),
  P('p-v8', 'V-0008', 'شركة التحدي للصيانة والتشغيل', 'vendor', 'أربيل', 'م. هيوا بكر', '07501234608', 'pt-60'),
  P('p-v9', 'V-0009', 'مجموعة الخليج العربي للتوريدات', 'vendor', 'البصرة', 'أ. مازن شاكر', '07901234609', 'pt-60', 'USD'),
  P('p-v10', 'V-0010', 'شركة سومر للأثاث المكتبي', 'vendor', 'بغداد', 'أ. هالة رياض', '07701234610', 'pt-30'),
]

export const currencies: Currency[] = [
  { code: 'IQD', name: 'دينار عراقي', decimals: 0, symbol: 'د.ع' },
  { code: 'USD', name: 'دولار أمريكي', decimals: 2, symbol: '$' },
]
/** IQD per 1 USD; effective from date. */
export const rates: ExchangeRate[] = [
  { code: 'USD', date: '2025-01-01', rate: 1310 },
  { code: 'USD', date: '2026-01-01', rate: 1310 },
  { code: 'USD', date: '2026-04-01', rate: 1312 },
  { code: 'USD', date: '2026-07-01', rate: 1308 },
  { code: 'USD', date: '2026-10-01', rate: 1310 },
]

export const uoms: Uom[] = [
  { id: 'u-pcs', code: 'PCS', name: 'قطعة' }, { id: 'u-ton', code: 'TON', name: 'طن' }, { id: 'u-m3', code: 'M3', name: 'متر مكعب' },
  { id: 'u-kg', code: 'KG', name: 'كغم' }, { id: 'u-box', code: 'BOX', name: 'صندوق' }, { id: 'u-hr', code: 'HR', name: 'ساعة' },
  { id: 'u-l', code: 'L', name: 'لتر' }, { id: 'u-m', code: 'M', name: 'متر' },
]

export const categories: Category[] = [
  { id: 'cat-bld', code: 'BLD', name: 'مواد البناء' },
  { id: 'cat-cem', code: 'BLD-CEM', name: 'الإسمنت', parentId: 'cat-bld' },
  { id: 'cat-stl', code: 'BLD-STL', name: 'حديد التسليح', parentId: 'cat-bld' },
  { id: 'cat-agg', code: 'BLD-AGG', name: 'الركام والرمل', parentId: 'cat-bld' },
  { id: 'cat-elc', code: 'ELC', name: 'المواد الكهربائية' },
  { id: 'cat-cab', code: 'ELC-CAB', name: 'الكابلات', parentId: 'cat-elc' },
  { id: 'cat-trn', code: 'ELC-TRN', name: 'المحولات', parentId: 'cat-elc' },
  { id: 'cat-heq', code: 'HEQ', name: 'المعدات الثقيلة' },
  { id: 'cat-gen', code: 'HEQ-GEN', name: 'المولدات', parentId: 'cat-heq' },
  { id: 'cat-ofc', code: 'OFC', name: 'مستلزمات المكاتب' },
  { id: 'cat-fur', code: 'OFC-FUR', name: 'الأثاث المكتبي', parentId: 'cat-ofc' },
  { id: 'cat-fnb', code: 'FNB', name: 'المواد الغذائية' },
  { id: 'cat-fuel', code: 'FUEL', name: 'الوقود والزيوت' },
]

const I = (id: string, code: string, name: string, categoryId: string, uomId: string, basePrice: number, currency: Item['currency'] = 'IQD'): Item => ({ id, code, name, categoryId, uomId, basePrice, currency })
export const items: Item[] = [
  I('it-1', 'CEM-001', 'إسمنت بورتلاندي عادي', 'cat-cem', 'u-ton', 95_000),
  I('it-2', 'CEM-002', 'إسمنت مقاوم للكبريتات', 'cat-cem', 'u-ton', 112_000),
  I('it-3', 'STL-016', 'حديد تسليح 16 ملم', 'cat-stl', 'u-ton', 780, 'USD'),
  I('it-4', 'STL-012', 'حديد تسليح 12 ملم', 'cat-stl', 'u-ton', 790, 'USD'),
  I('it-5', 'AGG-001', 'رمل مغسول', 'cat-agg', 'u-m3', 18_000),
  I('it-6', 'AGG-002', 'حصى مجروش 20 ملم', 'cat-agg', 'u-m3', 24_000),
  I('it-7', 'CAB-416', 'كابل نحاسي 4×16 ملم²', 'cat-cab', 'u-m', 14_500),
  I('it-8', 'CAB-425', 'كابل نحاسي 4×25 ملم²', 'cat-cab', 'u-m', 21_000),
  I('it-9', 'TRN-500', 'محول توزيع 500 ك.ف.أ', 'cat-trn', 'u-pcs', 24_500, 'USD'),
  I('it-10', 'TRN-250', 'محول توزيع 250 ك.ف.أ', 'cat-trn', 'u-pcs', 14_800, 'USD'),
  I('it-11', 'GEN-250', 'مولد ديزل 250 ك.ف.أ', 'cat-gen', 'u-pcs', 38_000, 'USD'),
  I('it-12', 'GEN-500', 'مولد ديزل 500 ك.ف.أ', 'cat-gen', 'u-pcs', 62_000, 'USD'),
  I('it-13', 'FUR-101', 'مكتب مدير خشبي', 'cat-fur', 'u-pcs', 650_000),
  I('it-14', 'FUR-102', 'كرسي مكتبي طبي', 'cat-fur', 'u-pcs', 185_000),
  I('it-15', 'FUR-103', 'خزانة ملفات معدنية', 'cat-fur', 'u-pcs', 240_000),
  I('it-16', 'FUEL-D', 'زيت الغاز (ديزل)', 'cat-fuel', 'u-l', 650),
  I('it-17', 'FUEL-O', 'زيت محركات 15W40', 'cat-fuel', 'u-l', 5_500),
  I('it-18', 'FNB-001', 'رز مستورد 25 كغم', 'cat-fnb', 'u-box', 32_000),
  I('it-19', 'FNB-002', 'زيت طعام 18 لتر', 'cat-fnb', 'u-box', 41_000),
  I('it-20', 'SVC-MNT', 'خدمة صيانة دورية (ساعة عمل)', 'cat-ofc', 'u-hr', 65_000),
]

export const costCenters: CostCenter[] = [
  { id: 'cc-100', code: 'CC-100', name: 'الإدارة العامة' }, { id: 'cc-200', code: 'CC-200', name: 'المبيعات' }, { id: 'cc-300', code: 'CC-300', name: 'المشتريات' },
  { id: 'cc-400', code: 'CC-400', name: 'المشاريع' }, { id: 'cc-500', code: 'CC-500', name: 'العمليات والصيانة' },
]
export const projects: Project[] = [
  { id: 'prj-1', code: 'PRJ-01', name: 'مجمع الكرادة السكني' }, { id: 'prj-2', code: 'PRJ-02', name: 'شبكة كهرباء البصرة' },
  { id: 'prj-3', code: 'PRJ-03', name: 'مستشفى أربيل التخصصي' }, { id: 'prj-4', code: 'PRJ-04', name: 'توسعة المستودعات' },
]
