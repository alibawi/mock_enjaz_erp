// Asset registry seed (area 2): ~30 assets — customer cars, company vehicles, ACs (one with a compressor child),
// generators, forklifts. Warranty dates around the demo today 2026-11-07; references to fixed assets / contracts are soft.
import type { Asset, MeterReading, VehicleDetails } from '../types'

type A = Omit<Asset, 'attributes' | 'state'> & { attributes?: Record<string, string>; state?: Asset['state'] }
const a = (x: A): Asset => ({ state: 'active', attributes: {}, ...x })

export const assets: Asset[] = [
  // ---- customer cars (workshop) ----
  a({ id: 'as-01', code: 'AST-000301', name: 'تويوتا كامري 2021 — أحمد عبد الرزاق', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-ahmed', model: 'Camry LE', brand: 'Toyota', location: 'عند العميل', area: 'الكرادة', warrantyStart: '2021-03-01', warrantyEnd: '2027-03-01' }),
  a({ id: 'as-02', code: 'AST-000302', name: 'هيونداي إلنترا 2019 — رشا التميمي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-rasha', model: 'Elantra', brand: 'Hyundai', location: 'عند العميل', area: 'الكرادة', warrantyStart: '2019-06-10', warrantyEnd: '2022-06-10' }),
  a({ id: 'as-03', code: 'AST-000303', name: 'كيا سبورتاج 2023 — فراس الدليمي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-firas', model: 'Sportage', brand: 'Kia', location: 'عند العميل', area: 'الأعظمية', warrantyStart: '2023-02-15', warrantyEnd: '2028-02-15' }),
  a({ id: 'as-04', code: 'AST-000304', name: 'تويوتا لاندكروزر 2020 — أسامة النعيمي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-osama', model: 'Land Cruiser GXR', brand: 'Toyota', location: 'عند العميل', area: 'الشعب', warrantyStart: '2020-09-01', warrantyEnd: '2025-09-01' }),
  a({ id: 'as-05', code: 'AST-000305', name: 'نيسان صني 2022 — منى الجبوري', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-muna', model: 'Sunny', brand: 'Nissan', location: 'عند العميل', area: 'زيونة', warrantyStart: '2022-04-20', warrantyEnd: '2025-04-20' }),
  a({ id: 'as-06', code: 'AST-000306', name: 'شيفروليه ماليبو 2018 — زيد الخفاجي', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-zaid', model: 'Malibu', brand: 'Chevrolet', location: 'عند العميل', area: 'المنصور' }),
  // leased car: owner = leasing company, the lessee pays (decision §33-4)
  a({ id: 'as-07', code: 'AST-000307', name: 'تويوتا كورولا 2024 — مؤجرة (الرافدين)', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-rafidain', model: 'Corolla', brand: 'Toyota', location: 'لدى المستأجر سليم التميمي', area: 'الدورة', warrantyStart: '2024-01-10', warrantyEnd: '2027-01-10', contractRef: 'CTR-2024-000118' }),
  a({ id: 'as-08', code: 'AST-000308', name: 'هيونداي توسان 2022 — مؤجرة (الرافدين)', categoryId: 'cat-car', ownerKind: 'customer', ownerPartnerId: 'p-rafidain', model: 'Tucson', brand: 'Hyundai', location: 'معرض الرافدين — المنصور', area: 'المنصور', warrantyStart: '2022-05-01', warrantyEnd: '2026-11-20', contractRef: 'CTR-2022-000064' }),
  // ---- company vehicles (internal) ----
  a({ id: 'as-09', code: 'AST-000309', name: 'بيك أب تويوتا هايلوكس — توزيع', categoryId: 'cat-car', ownerKind: 'company', ownerPartnerId: 'p-int', model: 'Hilux', brand: 'Toyota', location: 'مرآب الشركة — الدورة', area: 'الدورة', fixedAssetRef: 'FA-VEH-0007', costCenter: 'CC-DIST' }),
  a({ id: 'as-10', code: 'AST-000310', name: 'فان هيونداي H1 — فريق الصيانة الميدانية', categoryId: 'cat-car', ownerKind: 'company', ownerPartnerId: 'p-int', model: 'H1', brand: 'Hyundai', location: 'مرآب الشركة — الدورة', area: 'الدورة', fixedAssetRef: 'FA-VEH-0011', costCenter: 'CC-MAINT' }),
  a({ id: 'as-11', code: 'AST-000311', name: 'فان هيونداي H1 — فريق الصيانة الميدانية 2', categoryId: 'cat-car', ownerKind: 'company', ownerPartnerId: 'p-int', model: 'H1', brand: 'Hyundai', location: 'مرآب الشركة — الدورة', area: 'الدورة', fixedAssetRef: 'FA-VEH-0012', costCenter: 'CC-MAINT' }),
  // ---- ACs (field) ----
  a({ id: 'as-12', code: 'AST-000312', name: 'مكيف LG سبلت 2 طن — دار زيد الخفاجي', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-zaid', serial: 'LG-24K-81230457', model: 'S24ET', brand: 'LG', location: 'المنصور، شارع 14 رمضان، دار 22 — غرفة الاستقبال', area: 'المنصور', warrantyStart: '2024-07-01', warrantyEnd: '2027-07-01', attributes: { btu: '24000', gas: 'R410A', type: 'سبلت جداري' } }),
  a({ id: 'as-13', code: 'AST-000313', name: 'ضاغط مكيف LG — ضمن مكيف زيد', categoryId: 'cat-comp', ownerKind: 'customer', ownerPartnerId: 'p-zaid', serial: 'CMP-LG-55102318', model: 'GJT240MAA', brand: 'LG', location: 'الوحدة الخارجية', area: 'المنصور', parentAssetId: 'as-12', warrantyStart: '2024-07-01', warrantyEnd: '2034-07-01', attributes: { gas: 'R410A' } }),
  a({ id: 'as-14', code: 'AST-000314', name: 'مكيف سامسونج 1.5 طن — دار هبة السامرائي', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-hiba', serial: 'SS-18K-30018842', model: 'AR18', brand: 'Samsung', location: 'حي الأميرات، فرع 7، دار 3', area: 'المنصور', warrantyStart: '2022-05-15', warrantyEnd: '2025-05-15', attributes: { btu: '18000', gas: 'R410A', type: 'سبلت جداري' } }),
  a({ id: 'as-15', code: 'AST-000315', name: 'مكيف جري 2 طن — شقة منى الجبوري', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-muna', serial: 'GR-24K-77120056', model: 'GWH24', brand: 'Gree', location: 'زيونة، شارع الربيعي، عمارة 4، شقة 9', area: 'زيونة', warrantyStart: '2025-06-01', warrantyEnd: '2027-06-01', attributes: { btu: '24000', gas: 'R32', type: 'سبلت جداري' } }),
  a({ id: 'as-16', code: 'AST-000316', name: 'مكيف كاسيت 4 طن — مستشفى النور (الطوارئ)', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-alnoor', serial: 'CR-48K-10220031', model: 'MCK48', brand: 'Carrier', location: 'مستشفى النور — قسم الطوارئ', area: 'الكرادة', warrantyStart: '2023-03-01', warrantyEnd: '2026-03-01', contractRef: 'CTR-2025-000203', attributes: { btu: '48000', gas: 'R410A', type: 'كاسيت سقفي' } }),
  a({ id: 'as-17', code: 'AST-000317', name: 'مكيف كاسيت 4 طن — مستشفى النور (العمليات)', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-alnoor', serial: 'CR-48K-10220032', model: 'MCK48', brand: 'Carrier', location: 'مستشفى النور — صالة العمليات', area: 'الكرادة', warrantyStart: '2023-03-01', warrantyEnd: '2026-03-01', contractRef: 'CTR-2025-000203', attributes: { btu: '48000', gas: 'R410A', type: 'كاسيت سقفي' } }),
  a({ id: 'as-18', code: 'AST-000318', name: 'مكيف مخفي 5 طن — مستشفى النور (الاستقبال)', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-alnoor', serial: 'CR-60K-10220077', model: 'MDT60', brand: 'Carrier', location: 'مستشفى النور — بهو الاستقبال', area: 'الكرادة', contractRef: 'CTR-2025-000203', attributes: { btu: '60000', gas: 'R410A', type: 'مخفي بمجاري' } }),
  a({ id: 'as-19', code: 'AST-000319', name: 'مكيف LG 2 طن — مدارس دجلة (الصف 4أ)', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-dijla', serial: 'LG-24K-81230990', model: 'S24ET', brand: 'LG', location: 'مدارس دجلة — الطابق الأول', area: 'زيونة', warrantyStart: '2025-08-20', warrantyEnd: '2028-08-20', attributes: { btu: '24000', gas: 'R410A', type: 'سبلت جداري' } }),
  a({ id: 'as-20', code: 'AST-000320', name: 'مكيف LG 2 طن — مدارس دجلة (الإدارة)', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-dijla', serial: 'LG-24K-81230991', model: 'S24ET', brand: 'LG', location: 'مدارس دجلة — غرفة الإدارة', area: 'زيونة', warrantyStart: '2025-08-20', warrantyEnd: '2028-08-20', attributes: { btu: '24000', gas: 'R410A', type: 'سبلت جداري' } }),
  a({ id: 'as-21', code: 'AST-000321', name: 'مكيف جري 2 طن — دار فراس الدليمي', categoryId: 'cat-ac', ownerKind: 'customer', ownerPartnerId: 'p-firas', serial: 'GR-24K-77120412', model: 'GWH24', brand: 'Gree', location: 'الأعظمية، شارع عمر بن عبد العزيز', area: 'الأعظمية', warrantyStart: '2021-05-01', warrantyEnd: '2023-05-01', attributes: { btu: '24000', gas: 'R410A', type: 'سبلت جداري' } }),
  a({ id: 'as-22', code: 'AST-000322', name: 'مكيف LG 1.5 طن — مكتب الإدارة (داخلي)', categoryId: 'cat-ac', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'LG-18K-81100321', model: 'S18EQ', brand: 'LG', location: 'مقر الشركة — مكتب المدير العام', area: 'الدورة', fixedAssetRef: 'FA-EQP-0142', costCenter: 'CC-ADMIN', attributes: { btu: '18000', gas: 'R410A', type: 'سبلت جداري' } }),
  // ---- generators (field) ----
  a({ id: 'as-23', code: 'AST-000323', name: 'مولد كمنز 250 KVA — مستشفى النور', categoryId: 'cat-gen', ownerKind: 'customer', ownerPartnerId: 'p-alnoor', serial: 'CUM-250-7731002', model: 'C250D5', brand: 'Cummins', location: 'مستشفى النور — غرفة المولدات', area: 'الكرادة', warrantyStart: '2024-01-01', warrantyEnd: '2026-01-01', contractRef: 'CTR-2025-000203', attributes: { kva: '250', fuel: 'ديزل' } }),
  a({ id: 'as-24', code: 'AST-000324', name: 'مولد بيركنز 100 KVA — مدارس دجلة', categoryId: 'cat-gen', ownerKind: 'customer', ownerPartnerId: 'p-dijla', serial: 'PRK-100-4410077', model: '1104C', brand: 'Perkins', location: 'مدارس دجلة — الساحة الخلفية', area: 'زيونة', attributes: { kva: '100', fuel: 'ديزل' } }),
  a({ id: 'as-25', code: 'AST-000325', name: 'مولد منزلي 30 KVA — دار أسامة النعيمي', categoryId: 'cat-gen', ownerKind: 'customer', ownerPartnerId: 'p-osama', serial: 'FGW-30-2290114', model: 'P30-3', brand: 'FG Wilson', location: 'الشعب، شارع 60، دار 41', area: 'الشعب', warrantyStart: '2025-02-01', warrantyEnd: '2026-02-01', attributes: { kva: '30', fuel: 'ديزل' } }),
  a({ id: 'as-26', code: 'AST-000326', name: 'مولد الشركة 500 KVA — المقر', categoryId: 'cat-gen', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'CUM-500-7731500', model: 'C500D5', brand: 'Cummins', location: 'مقر الشركة — الدورة', area: 'الدورة', fixedAssetRef: 'FA-EQP-0009', costCenter: 'CC-ADMIN', attributes: { kva: '500', fuel: 'ديزل' } }),
  // ---- forklifts (internal) ----
  a({ id: 'as-27', code: 'AST-000327', name: 'رافعة شوكية تويوتا 3 طن — المخزن', categoryId: 'cat-fl', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'TYT-FL-3T-20991', model: '8FD30', brand: 'Toyota', location: 'المخزن الرئيسي — الدورة', area: 'الدورة', fixedAssetRef: 'FA-EQP-0031', costCenter: 'CC-WH', attributes: { capacity: '3' } }),
  a({ id: 'as-28', code: 'AST-000328', name: 'رافعة شوكية هايستر 2.5 طن — المخزن', categoryId: 'cat-fl', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'HYS-FL-25-7712', model: 'H2.5FT', brand: 'Hyster', location: 'المخزن الرئيسي — الدورة', area: 'الدورة', fixedAssetRef: 'FA-EQP-0032', costCenter: 'CC-WH', attributes: { capacity: '2.5' } }),
  // ---- retired / loaned examples ----
  a({ id: 'as-29', code: 'AST-000329', name: 'مكيف ويستنغهاوس قديم — مكتب الاستقبال (متقاعد)', categoryId: 'cat-ac', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'WH-12K-0099120', model: 'WS12', brand: 'Westinghouse', location: 'مخزن السكراب', area: 'الدورة', state: 'retired', fixedAssetRef: 'FA-EQP-0101', attributes: { btu: '12000', gas: 'R22', type: 'سبلت جداري' } }),
  a({ id: 'as-30', code: 'AST-000330', name: 'مولد متنقل 20 KVA — معار لمدارس دجلة', categoryId: 'cat-gen', ownerKind: 'company', ownerPartnerId: 'p-int', serial: 'FGW-20-2291001', model: 'P20-3', brand: 'FG Wilson', location: 'معار — مدارس دجلة', area: 'زيونة', state: 'loaned', fixedAssetRef: 'FA-EQP-0118', attributes: { kva: '20', fuel: 'ديزل' } }),
]

export const vehicles: VehicleDetails[] = [
  { assetId: 'as-01', plate: 'بغداد 12345 أ', vin: '4T1B11HK5MU123456', make: 'Toyota', model: 'Camry LE', year: 2021, engineNo: '2AR-1182334', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أبيض لؤلؤي' },
  { assetId: 'as-02', plate: 'بغداد 48210 ب', vin: 'KMHD84LF4KU771230', make: 'Hyundai', model: 'Elantra', year: 2019, engineNo: 'G4FG-990124', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'فضي' },
  { assetId: 'as-03', plate: 'بغداد 77104 ج', vin: 'KNDPU3AF6P7002211', make: 'Kia', model: 'Sportage', year: 2023, engineNo: 'G4KN-301178', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'رمادي' },
  { assetId: 'as-04', plate: 'بغداد 30091 د', vin: 'JTMHV05J804223571', make: 'Toyota', model: 'Land Cruiser GXR', year: 2020, engineNo: '1GR-7710042', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أسود' },
  { assetId: 'as-05', plate: 'بغداد 55620 هـ', vin: '3N1CN8AP5NL812244', make: 'Nissan', model: 'Sunny', year: 2022, engineNo: 'HR15-551201', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أحمر' },
  { assetId: 'as-06', plate: 'بغداد 19803 و', vin: '1G1ZD5ST1JF190311', make: 'Chevrolet', model: 'Malibu', year: 2018, engineNo: 'LFV-880213', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أزرق داكن' },
  { assetId: 'as-07', plate: 'بغداد 90012 ز', vin: 'JTDB4MEE6R3001882', make: 'Toyota', model: 'Corolla', year: 2024, engineNo: '2ZR-6612094', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أبيض' },
  { assetId: 'as-08', plate: 'بغداد 90047 ز', vin: 'KM8J33A40NU501977', make: 'Hyundai', model: 'Tucson', year: 2022, engineNo: 'G4KJ-402219', fuel: 'بنزين', transmission: 'أوتوماتيك', color: 'أبيض' },
  { assetId: 'as-09', plate: 'حكومي 40021 أ', vin: 'MR0FB3CD2L0712290', make: 'Toyota', model: 'Hilux', year: 2020, engineNo: '2GD-3301142', fuel: 'ديزل', transmission: 'يدوي', color: 'أبيض' },
  { assetId: 'as-10', plate: 'حكومي 40033 أ', vin: 'KMJWA37KBMU220154', make: 'Hyundai', model: 'H1', year: 2021, engineNo: 'D4CB-2210931', fuel: 'ديزل', transmission: 'يدوي', color: 'أبيض' },
  { assetId: 'as-11', plate: 'حكومي 40034 أ', vin: 'KMJWA37KBMU220176', make: 'Hyundai', model: 'H1', year: 2021, engineNo: 'D4CB-2210977', fuel: 'ديزل', transmission: 'يدوي', color: 'أبيض' },
]

let n = 0
const r = (assetId: string, value: number, unit: 'km' | 'hours', at: string, source: MeterReading['source'] = 'manual', docRef?: string): MeterReading =>
  ({ id: `rd-${String(++n).padStart(3, '0')}`, assetId, value, unit, at, source, docRef })

export const readings: MeterReading[] = [
  r('as-01', 61_300, 'km', '2026-02-10', 'intake'), r('as-01', 76_900, 'km', '2026-07-22', 'intake'), r('as-01', 84_200, 'km', '2026-11-02', 'intake'),
  r('as-02', 142_800, 'km', '2026-05-03', 'intake'), r('as-02', 151_420, 'km', '2026-10-28', 'intake'),
  r('as-03', 18_250, 'km', '2026-09-14', 'intake'),
  r('as-04', 98_400, 'km', '2026-06-01', 'intake'), r('as-04', 107_950, 'km', '2026-10-20', 'intake'),
  r('as-05', 39_100, 'km', '2026-08-11', 'intake'),
  r('as-06', 188_300, 'km', '2026-09-30', 'intake'),
  r('as-07', 22_640, 'km', '2026-10-05', 'intake'),
  r('as-08', 71_020, 'km', '2026-11-04', 'intake'),
  r('as-09', 203_500, 'km', '2026-08-01'), r('as-09', 214_870, 'km', '2026-11-01'),
  r('as-10', 96_330, 'km', '2026-10-01'), r('as-11', 101_220, 'km', '2026-10-01'),
  r('as-23', 8_420, 'hours', '2026-08-15'), r('as-23', 9_110, 'hours', '2026-11-01'),
  r('as-24', 3_905, 'hours', '2026-09-20'),
  r('as-26', 12_640, 'hours', '2026-10-15'),
  r('as-27', 6_880, 'hours', '2026-09-01'), r('as-27', 7_215, 'hours', '2026-11-03'),
  r('as-28', 4_410, 'hours', '2026-10-10'),
]
