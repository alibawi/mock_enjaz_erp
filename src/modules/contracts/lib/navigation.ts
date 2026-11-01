import {
  AlarmClock, Building2, FileBarChart, History, SlidersHorizontal, BarChart3, BellRing, CalendarClock, ClipboardCheck, Coins, FileClock, FilePen, FileSignature, FileText, Files, Gauge, Handshake,
  Landmark, LayoutDashboard, ListChecks, Lock, Printer, Receipt, ScrollText, Settings2, ShieldCheck, Stethoscope, Tags, UserCog, Wrench, type LucideIcon,
} from 'lucide-react'
import { reports } from '../data/reports'

export interface NavItem { to: string; label: string; icon: LucideIcon; section?: string; soon?: boolean; module: string; feature?: 'Obligations' | 'Templates' | 'Service' }

/**
 * Sidebar of the contracts module. `soon: true` items are listed (so the demo shows the whole module) but not clickable yet;
 * each module step flips its items to live (roadmap step "scaffold empty routes + sidebar links").
 */
export const contractNav: NavItem[] = [
  { to: '/', label: 'لوحة المؤشرات', icon: LayoutDashboard, module: 'foundation' },
  { to: '/contracts', label: 'العقود', icon: FileText, section: 'العقود', module: 'contracts' },
  { to: '/contract-types', label: 'أنواع العقود', icon: Tags, module: 'contracts' },
  { to: '/alerts', label: 'التنبيهات', icon: BellRing, module: 'contracts' },
  { to: '/tasks', label: 'مهامي (الاعتماد)', icon: ClipboardCheck, section: 'الاعتماد والتوقيع', module: 'workflow' },
  { to: '/delegations', label: 'تفويض الاعتماد', icon: UserCog, module: 'workflow' },
  { to: '/agreements', label: 'اتفاقيات المبيعات والمشتريات', icon: Handshake, section: 'الاتفاقيات', module: 'agreements' },
  { to: '/agreements/simulator', label: 'محاكي المستندات', icon: Gauge, module: 'agreements' },
  { to: '/agreements/resolve', label: 'اختبار مطابقة الاتفاقية', icon: ShieldCheck, module: 'agreements' },
  { to: '/renewals', label: 'التجديدات', icon: CalendarClock, section: 'الملاحق والتجديد', module: 'amendments' },
  { to: '/amendments', label: 'الملاحق', icon: FilePen, module: 'amendments' },
  { to: '/obligations', label: 'الالتزامات والمراحل', icon: ListChecks, section: 'الالتزامات والمالية', feature: 'Obligations', module: 'obligations-finance' },
  { to: '/payments', label: 'جدول الدفعات والفوترة', icon: Receipt, feature: 'Obligations', module: 'obligations-finance' },
  { to: '/templates', label: 'قوالب العقود', icon: Files, section: 'القوالب والطباعة', feature: 'Templates', module: 'templates-print' },
  { to: '/clauses', label: 'مكتبة البنود', icon: ScrollText, feature: 'Templates', module: 'templates-print' },
  { to: '/service', label: 'عقود الخدمة', icon: Wrench, section: 'الخدمة', feature: 'Service', module: 'service' },
  { to: '/service/calls', label: 'مكالمات الخدمة (محاكاة)', icon: Stethoscope, feature: 'Service', module: 'service' },
  { to: '/service/sla', label: 'تقرير مستوى الخدمة', icon: AlarmClock, feature: 'Service', module: 'service' },
  { to: '/reports', label: 'كل التقارير', icon: BarChart3, section: 'التقارير', module: 'analytics' },
  // every report is its own menu item, grouped under «التقارير» (R-01…R-17)
  ...reports.map((r, i, all): NavItem => ({ to: `/reports/${r.id}`, label: `${r.code} — ${r.title}`, icon: FileBarChart, section: i === 0 || all[i - 1].group !== r.group ? `تقارير ${r.group}` : undefined, module: 'analytics' })),
  { to: '/settings', label: 'إعدادات النظام', icon: Settings2, section: 'الإعدادات', module: 'settings-access' },
  { to: '/settings/permissions', label: 'مصفوفة الصلاحيات', icon: Lock, module: 'settings-access' },
  { to: '/settings/numbering', label: 'الترقيم', icon: FileClock, module: 'settings-access' },
  { to: '/settings/approval-stages', label: 'مراحل الاعتماد', icon: Landmark, module: 'settings-access' },
  { to: '/settings/organizations', label: 'المنشآت وصلاحية البيانات', icon: Building2, module: 'settings-access' },
  { to: '/settings/audit', label: 'سجل تدقيق الإعدادات', icon: History, module: 'settings-access' },
  { to: '/settings/demo', label: 'أدوات العرض', icon: SlidersHorizontal, module: 'settings-access' },
  { to: '/health', label: 'فحص النظام', icon: Coins, section: 'النظام', module: 'foundation' },
]

/** Cards for the module landing (ModuleScreensGrid). */
export const iconFor = { FileSignature, Printer }
