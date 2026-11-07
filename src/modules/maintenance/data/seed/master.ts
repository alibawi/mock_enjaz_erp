// Master data seed — project brief §2/§4. Baghdad workshop, Iraqi names, IQD.
import type {
  AppUser, AssetCategory, ExpenseType, FailureCode, Item, MaintenanceType, Partner, Settings, StandardOperation, StockRow,
  Technician, TimeSlot, Warehouse, Workshop,
} from '../types'

export const users: AppUser[] = [
  { id: 'u-adv', name: 'سارة عبد الكريم', role: 'advisor', title: 'موظفة استقبال الصيانة' },
  { id: 'u-adv2', name: 'مصطفى جاسم', role: 'advisor', title: 'موظف استقبال الصيانة' },
  { id: 'u-tec', name: 'أحمد كاظم', role: 'technician', title: 'فني أول — ميكانيك' },
  { id: 'u-wm', name: 'حيدر عبد الأمير', role: 'workshopManager', title: 'مدير الورشة' },
  { id: 'u-wm2', name: 'علي الربيعي', role: 'workshopManager', title: 'مساعد مدير الورشة' },
  { id: 'u-dsp', name: 'زينب فاضل', role: 'dispatcher', title: 'منسقة الجدولة' },
  { id: 'u-wh', name: 'كرار حسين', role: 'warehouse', title: 'أمين مخزن قطع الغيار' },
  { id: 'u-acc', name: 'نور الهدى سالم', role: 'accountant', title: 'محاسبة المبيعات' },
  { id: 'u-fm', name: 'د. ليث العزاوي', role: 'financeManager', title: 'المدير المالي' },
  { id: 'u-adm', name: 'مسؤول النظام', role: 'admin', title: 'مسؤول النظام' },
]

export const warehouses: Warehouse[] = [
  { id: 'wh-1', code: 'WH-SP', name: 'مخزن قطع الغيار — الورشة الرئيسية', inventoryAccount: '1310' },
]

export const workshops: Workshop[] = [
  {
    id: 'ws-1', code: 'WS-BGD', name: 'ورشة بغداد الرئيسية — الدورة', warehouseId: 'wh-1',
    bays: [
      { id: 'bay-1', code: 'L1', name: 'الرافعة 1' },
      { id: 'bay-2', code: 'L2', name: 'الرافعة 2' },
      { id: 'bay-3', code: 'L3', name: 'الرافعة 3' },
      { id: 'bay-4', code: 'EL', name: 'منصة الكهرباء والتبريد' },
    ],
  },
]

export const expenseTypes: ExpenseType[] = [
  { id: 'et-sale', code: 'CUST', name: 'بيع لعميل', accountCode: '5110', accountName: 'تكلفة المبيعات', scope: 'customer' },
  { id: 'et-war', code: 'WARR', name: 'ضمان', accountCode: '5420', accountName: 'مصروف الضمان', scope: 'warranty' },
  { id: 'et-mach', code: 'INT-MACH', name: 'صيانة آلات ومعدات', accountCode: '5310', accountName: 'مصروف صيانة آلات ومعدات', scope: 'internal' },
  { id: 'et-veh', code: 'INT-VEH', name: 'صيانة سيارات', accountCode: '5320', accountName: 'مصروف صيانة سيارات', scope: 'internal' },
  { id: 'et-bld', code: 'INT-BLD', name: 'صيانة مبانٍ', accountCode: '5330', accountName: 'مصروف صيانة مبانٍ', scope: 'internal' },
  { id: 'et-gw', code: 'GOODWILL', name: 'حسن نية', accountCode: '5430', accountName: 'مصروف حسن نية', scope: 'goodwill' },
]

export const maintenanceTypes: MaintenanceType[] = [
  { id: 'mt-car', code: 'CAR-REP', name: 'إصلاح سيارات (ورشة)', kind: 'workshop', corrective: true, defaultExpenseTypeId: 'et-sale', active: true },
  { id: 'mt-svc', code: 'CAR-SVC', name: 'خدمة دورية للسيارات', kind: 'workshop', corrective: false, defaultExpenseTypeId: 'et-sale', active: true },
  { id: 'mt-ac', code: 'AC-FIELD', name: 'صيانة تكييف ميدانية', kind: 'field', corrective: true, defaultExpenseTypeId: 'et-sale', active: true },
  { id: 'mt-gen', code: 'GEN-FIELD', name: 'صيانة مولدات ميدانية', kind: 'field', corrective: true, defaultExpenseTypeId: 'et-sale', active: true },
  { id: 'mt-int', code: 'INT-EQP', name: 'صيانة داخلية للمعدات', kind: 'internal', corrective: true, defaultExpenseTypeId: 'et-mach', active: true },
  { id: 'mt-intv', code: 'INT-VEH', name: 'صيانة داخلية لسيارات الشركة', kind: 'internal', corrective: true, defaultExpenseTypeId: 'et-veh', active: true },
]

export const categories: AssetCategory[] = [
  { id: 'cat-car', code: 'CAR', name: 'سيارات', isVehicle: true, meterUnit: 'km', attributes: [] },
  { id: 'cat-ac', code: 'AC', name: 'مكيفات', isVehicle: false, attributes: [{ key: 'btu', label: 'السعة', unit: 'BTU' }, { key: 'gas', label: 'نوع الغاز' }, { key: 'type', label: 'النوع' }] },
  { id: 'cat-comp', code: 'COMP', name: 'ضواغط تكييف', isVehicle: false, attributes: [{ key: 'gas', label: 'نوع الغاز' }] },
  { id: 'cat-gen', code: 'GEN', name: 'مولدات', isVehicle: false, meterUnit: 'hours', attributes: [{ key: 'kva', label: 'القدرة', unit: 'KVA' }, { key: 'fuel', label: 'الوقود' }] },
  { id: 'cat-fl', code: 'FORK', name: 'رافعات شوكية', isVehicle: false, meterUnit: 'hours', attributes: [{ key: 'capacity', label: 'الحمولة', unit: 'طن' }] },
]

export const failureCodes: FailureCode[] = [
  { id: 'fc-brk', code: 'BRK-WEAR', name: 'تآكل فحمات/أقراص الفرامل', categoryId: 'cat-car' },
  { id: 'fc-oil', code: 'ENG-OIL', name: 'تسريب أو تلف زيت المحرك', categoryId: 'cat-car' },
  { id: 'fc-bat', code: 'ELC-BAT', name: 'عطل البطارية أو الشحن', categoryId: 'cat-car' },
  { id: 'fc-susp', code: 'SUSP', name: 'عطل نظام التعليق', categoryId: 'cat-car' },
  { id: 'fc-gas', code: 'AC-GAS', name: 'نقص غاز التبريد / تسريب', categoryId: 'cat-ac' },
  { id: 'fc-comp', code: 'AC-COMP', name: 'تلف الضاغط', categoryId: 'cat-ac' },
  { id: 'fc-pcb', code: 'AC-PCB', name: 'عطل لوحة التحكم', categoryId: 'cat-ac' },
  { id: 'fc-avr', code: 'GEN-AVR', name: 'عطل منظم الجهد AVR', categoryId: 'cat-gen' },
  { id: 'fc-inj', code: 'GEN-INJ', name: 'انسداد البخاخات', categoryId: 'cat-gen' },
  { id: 'fc-hyd', code: 'FL-HYD', name: 'تسريب هيدروليك', categoryId: 'cat-fl' },
]

export const items: Item[] = [
  // parts
  { id: 'it-oilf', code: 'P-OF-90915', name: 'فلتر زيت تويوتا', kind: 'part', uom: 'قطعة', price: 25_000, cost: 15_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-oil', code: 'P-OIL-5W30', name: 'زيت محرك 5W-30 (لتر)', kind: 'part', uom: 'لتر', price: 15_000, cost: 9_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-airf', code: 'P-AF-17801', name: 'فلتر هواء', kind: 'part', uom: 'قطعة', price: 20_000, cost: 11_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-pads', code: 'P-BP-04465', name: 'طقم فحمات فرامل أمامي', kind: 'part', uom: 'طقم', price: 50_000, cost: 30_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-disc', code: 'P-BD-43512', name: 'قرص فرامل أمامي', kind: 'part', uom: 'قطعة', price: 65_000, cost: 40_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-bat', code: 'P-BAT-70', name: 'بطارية 70 أمبير', kind: 'part', uom: 'قطعة', price: 140_000, cost: 95_000, revenueAccount: '4120', tracking: 'serial' },
  { id: 'it-shock', code: 'P-SH-48510', name: 'مساعد أمامي', kind: 'part', uom: 'قطعة', price: 85_000, cost: 55_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-gas', code: 'P-R410A', name: 'غاز تبريد R410A (كغم)', kind: 'part', uom: 'كغم', price: 30_000, cost: 18_000, revenueAccount: '4120', tracking: 'batch' },
  { id: 'it-cap', code: 'P-CAP-45', name: 'متسعة 45 مايكروفاراد', kind: 'part', uom: 'قطعة', price: 18_000, cost: 8_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-comp', code: 'P-COMP-24', name: 'ضاغط تكييف 24,000 BTU', kind: 'part', uom: 'قطعة', price: 950_000, cost: 800_000, revenueAccount: '4120', tracking: 'serial' },
  { id: 'it-pcb', code: 'P-PCB-LG', name: 'لوحة تحكم مكيف LG', kind: 'part', uom: 'قطعة', price: 120_000, cost: 70_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-avr', code: 'P-AVR-SX', name: 'منظم جهد AVR SX460', kind: 'part', uom: 'قطعة', price: 175_000, cost: 110_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-inj', code: 'P-INJ-CUM', name: 'بخاخ وقود مولد', kind: 'part', uom: 'قطعة', price: 210_000, cost: 140_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-dfil', code: 'P-FF-DSL', name: 'فلتر ديزل مولد', kind: 'part', uom: 'قطعة', price: 22_000, cost: 12_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-hose', code: 'P-HYD-HOSE', name: 'خرطوم هيدروليك', kind: 'part', uom: 'قطعة', price: 60_000, cost: 35_000, revenueAccount: '4120', tracking: 'none' },
  { id: 'it-sensor', code: 'P-O2-SNS', name: 'حساس أوكسجين', kind: 'part', uom: 'قطعة', price: 110_000, cost: 75_000, revenueAccount: '4120', tracking: 'none' },
  // services (labor)
  { id: 'sv-mech', code: 'S-LAB-MECH', name: 'عمالة ميكانيك (ساعة)', kind: 'service', uom: 'ساعة', price: 25_000, cost: 0, revenueAccount: '4210', tracking: 'none' },
  { id: 'sv-elec', code: 'S-LAB-ELEC', name: 'عمالة كهرباء (ساعة)', kind: 'service', uom: 'ساعة', price: 25_000, cost: 0, revenueAccount: '4210', tracking: 'none' },
  { id: 'sv-hvac', code: 'S-LAB-HVAC', name: 'عمالة تبريد وتكييف (ساعة)', kind: 'service', uom: 'ساعة', price: 30_000, cost: 0, revenueAccount: '4210', tracking: 'none' },
  { id: 'sv-diag', code: 'S-DIAG', name: 'رسم فحص وتشخيص', kind: 'service', uom: 'خدمة', price: 20_000, cost: 0, revenueAccount: '4220', tracking: 'none' },
  { id: 'sv-visit', code: 'S-VISIT', name: 'أجور زيارة ميدانية', kind: 'service', uom: 'زيارة', price: 25_000, cost: 0, tracking: 'none' },
  { id: 'sv-turn', code: 'S-TURN', name: 'خراطة أقراص (خدمة خارجية)', kind: 'service', uom: 'خدمة', price: 30_000, cost: 0, revenueAccount: '4230', tracking: 'none' },
]

export const stock: StockRow[] = [
  ['it-oilf', 42], ['it-oil', 260], ['it-airf', 18], ['it-pads', 9], ['it-disc', 6], ['it-bat', 5], ['it-shock', 4], ['it-gas', 35],
  ['it-cap', 20], ['it-comp', 1], ['it-pcb', 3], ['it-avr', 2], ['it-inj', 4], ['it-dfil', 12], ['it-hose', 3], ['it-sensor', 0],
].map(([itemId, onHand]) => ({ itemId: itemId as string, warehouseId: 'wh-1', onHand: onHand as number, reserved: 0 }))

export const operations: StandardOperation[] = [
  { id: 'op-oil', code: 'OP-OIL', name: 'تغيير زيت وفلتر', serviceItemId: 'sv-mech', standardHours: 1 },
  { id: 'op-brk', code: 'OP-BRK', name: 'تبديل فحمات وفحص الفرامل', serviceItemId: 'sv-mech', standardHours: 2 },
  { id: 'op-susp', code: 'OP-SUSP', name: 'تبديل المساعدات', serviceItemId: 'sv-mech', standardHours: 3 },
  { id: 'op-bat', code: 'OP-BAT', name: 'فحص وتبديل البطارية', serviceItemId: 'sv-elec', standardHours: 0.5 },
  { id: 'op-diag', code: 'OP-DIAG', name: 'فحص كمبيوتر وتشخيص', serviceItemId: 'sv-elec', standardHours: 1 },
  { id: 'op-acgas', code: 'OP-ACGAS', name: 'تعبئة غاز وفحص تسريب', serviceItemId: 'sv-hvac', standardHours: 1.5 },
  { id: 'op-accomp', code: 'OP-ACCOMP', name: 'تبديل ضاغط مكيف', serviceItemId: 'sv-hvac', standardHours: 4 },
  { id: 'op-acpcb', code: 'OP-ACPCB', name: 'تبديل لوحة تحكم مكيف', serviceItemId: 'sv-hvac', standardHours: 1 },
  { id: 'op-genavr', code: 'OP-GENAVR', name: 'تبديل منظم الجهد', serviceItemId: 'sv-elec', standardHours: 2 },
  { id: 'op-geninj', code: 'OP-GENINJ', name: 'تنظيف وتبديل البخاخات', serviceItemId: 'sv-mech', standardHours: 3 },
  { id: 'op-flhyd', code: 'OP-FLHYD', name: 'تبديل خرطوم هيدروليك', serviceItemId: 'sv-mech', standardHours: 2 },
]

export const technicians: Technician[] = [
  { id: 't-ahmed', employeeNo: 'EMP-1041', name: 'أحمد كاظم', title: 'seniorTechnician', standardRate: 18_000, phone: '0770 412 5530', area: 'الدورة', active: true },
  { id: 't-ali', employeeNo: 'EMP-1052', name: 'علي حسين', title: 'seniorTechnician', standardRate: 18_000, phone: '0771 228 9014', area: 'المنصور', active: true },
  { id: 't-hassan', employeeNo: 'EMP-1067', name: 'حسن جبار', title: 'technician', standardRate: 12_500, phone: '0780 551 3302', area: 'المنصور', active: true },
  { id: 't-mohammed', employeeNo: 'EMP-1073', name: 'محمد رحيم', title: 'technician', standardRate: 12_500, phone: '0772 904 1187', area: 'الدورة', active: true },
  { id: 't-yaser', employeeNo: 'EMP-1080', name: 'ياسر عبد الله', title: 'technician', standardRate: 12_500, phone: '0781 330 6721', area: 'الكرادة', active: true },
  { id: 't-omar', employeeNo: 'EMP-1088', name: 'عمر صباح', title: 'technician', standardRate: 12_500, phone: '0790 118 4456', area: 'زيونة', active: true },
  { id: 't-karim', employeeNo: 'EMP-1095', name: 'كريم ناصر', title: 'seniorTechnician', standardRate: 18_000, phone: '0773 612 9008', area: 'الكرادة', active: true },
  { id: 't-abbas', employeeNo: 'EMP-1102', name: 'عباس فالح', title: 'technician', standardRate: 12_500, phone: '0782 445 7719', area: 'الدورة', active: true },
  { id: 't-murtada', employeeNo: 'EMP-1110', name: 'مرتضى علي', title: 'technician', standardRate: 12_500, phone: '0774 907 2265', area: 'الشعب', active: true },
  { id: 't-sajjad', employeeNo: 'EMP-1117', name: 'سجاد كريم', title: 'technician', standardRate: 12_500, phone: '0791 552 0843', area: 'الأعظمية', active: true },
]

export const partners: Partner[] = [
  { id: 'p-int', code: 'C-INT', name: 'الشركة — استهلاك داخلي', kind: 'internal', phone: '—', area: 'الدورة', address: 'مقر الشركة، الدورة', accountCode: '—' },
  { id: 'p-ahmed', code: 'C-10231', name: 'أحمد عبد الرزاق', kind: 'customer', phone: '0770 118 2245', area: 'الكرادة', address: 'الكرادة داخل، زقاق 14، دار 7', accountCode: '1211' },
  { id: 'p-zaid', code: 'C-10244', name: 'زيد الخفاجي', kind: 'customer', phone: '0771 902 3318', area: 'المنصور', address: 'المنصور، شارع 14 رمضان، دار 22', accountCode: '1211' },
  { id: 'p-hiba', code: 'C-10251', name: 'هبة السامرائي', kind: 'customer', phone: '0780 445 0091', area: 'المنصور', address: 'حي الأميرات، فرع 7، دار 3', accountCode: '1211' },
  { id: 'p-muna', code: 'C-10266', name: 'منى الجبوري', kind: 'customer', phone: '0772 610 7734', area: 'زيونة', address: 'زيونة، شارع الربيعي، عمارة 4', accountCode: '1211' },
  { id: 'p-firas', code: 'C-10270', name: 'فراس الدليمي', kind: 'customer', phone: '0781 223 5541', area: 'الأعظمية', address: 'الأعظمية، شارع عمر بن عبد العزيز', accountCode: '1211' },
  { id: 'p-rasha', code: 'C-10283', name: 'رشا التميمي', kind: 'customer', phone: '0790 774 1102', area: 'الكرادة', address: 'الكرادة، ساحة الحرية، عمارة 2', accountCode: '1211' },
  { id: 'p-osama', code: 'C-10290', name: 'أسامة النعيمي', kind: 'customer', phone: '0773 309 8820', area: 'الشعب', address: 'الشعب، شارع 60، دار 41', accountCode: '1211' },
  { id: 'p-rafidain', code: 'C-20012', name: 'شركة الرافدين للتأجير', kind: 'customer', phone: '0770 500 1200', area: 'المنصور', address: 'المنصور، مجمع الرواد، الطابق 3', accountCode: '1212' },
  { id: 'p-alnoor', code: 'C-20025', name: 'مستشفى النور الأهلي', kind: 'customer', phone: '0780 800 4400', area: 'الكرادة', address: 'الكرادة، شارع 62', accountCode: '1212' },
  { id: 'p-dijla', code: 'C-20031', name: 'مدارس دجلة الأهلية', kind: 'customer', phone: '0771 650 9900', area: 'زيونة', address: 'زيونة، قرب جامع الرحمن', accountCode: '1212' },
  { id: 'p-tamimi', code: 'C-20040', name: 'سليم التميمي (مستأجر)', kind: 'customer', phone: '0782 118 6677', area: 'الدورة', address: 'الدورة، حي الميكانيك', accountCode: '1211' },
]

export const timeSlots: TimeSlot[] = [
  { id: 'ts-am', code: 'AM', name: 'صباحًا 8–12', start: '08:00', end: '12:00', capacity: 6 },
  { id: 'ts-pm', code: 'PM', name: 'ظهرًا 12–4', start: '12:00', end: '16:00', capacity: 6 },
]

export const settings: Settings = {
  consumptionMode: 'automatic',
  overIssueMode: 'block',
  internalPartnerId: 'p-int',
  approvalMode: 'elsa',
  approvalBands: [
    { upTo: 1_000_000, roles: [] },
    { upTo: 5_000_000, roles: ['workshopManager'] },
    { upTo: null, roles: ['workshopManager', 'financeManager'] },
  ],
  lineDiscountLimitPct: 10,
  internalCostLimit: 1_000_000,
  reworkWindowDays: 30,
  estimateValidityDays: 15,
  depositDefaultPercent: 40,
  defaultRevenueAccount: '4200',
  cogsAccount: '5110',
}
