import {
  Activity, BadgeCheck, BarChart3, Bell, Building2, Package, Wallet, CalendarClock, CalendarDays, CalendarOff, ChevronDown, ChevronLeft, ClipboardCheck, ClipboardList, FileCheck2, FileSearch,
  FileSignature, Gauge, GraduationCap, History, Inbox, Languages, LayoutDashboard, ListChecks, Lock, Monitor, Move, PackageMinus, Plus, Receipt,
  RotateCcw, Route, Search, Settings2, Timer, UserCog, Wrench, ZapOff, type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '../router'
import { addDays, DEFAULT_TODAY, today } from '../data/asof'
import { fmtDate } from '../data/format'
import { roleLabel } from '../data/permissions'
import { DATA_VERSION, useStore } from '../data/store'
import type { Perm } from '../data/types'
import { useClickAway } from '../lib/useClickAway'
import { Confirm } from './ui'

/** `sub` entries render as indented links under the item before them (report groups under «التقارير»). */
export interface MaintNavItem { to: string; label: string; icon: LucideIcon; section?: string; soon?: boolean; perm?: Perm; sub?: boolean }

/** Sidebar group of the maintenance module (rendered by src/shell/Sidebar.tsx); `soon` items are shown but not clickable. */
export const maintenanceNav: MaintNavItem[] = [
  { to: '/', label: 'لوحة الصيانة', icon: LayoutDashboard },
  { to: '/requests', label: 'طلبات الصيانة', icon: Inbox, section: 'الاستقبال والتقدير' },
  { to: '/estimates', label: 'التقديرات (عروض السعر)', icon: FileSignature },
  { to: '/tasks', label: 'مهامي (الاعتماد)', icon: ClipboardCheck },
  { to: '/work-orders', label: 'أوامر العمل', icon: Wrench, section: 'التنفيذ' },
  { to: '/labor', label: 'ساعات العمل', icon: Timer },
  { to: '/schedule', label: 'لوحة الجدولة', icon: CalendarDays, section: 'الجدولة' },
  { to: '/schedule/bookings', label: 'الحجوزات', icon: CalendarClock },
  { to: '/schedule/route-sheet', label: 'خط السير اليومي', icon: Route },
  { to: '/schedule/leave', label: 'إجازات الفنيين', icon: CalendarOff },
  { to: '/assets', label: 'بطاقات الأصول', icon: ClipboardList, section: 'الأصول' },
  { to: '/billing', label: 'الفواتير والعربون', icon: Receipt, section: 'الفوترة' },
  { to: '/billing/issues', label: 'سندات صرف القطع', icon: PackageMinus },
  { to: '/reports', label: 'التقارير', icon: BarChart3, section: 'التقارير' }, // visible to every role; the page explains who may open it
  { to: '/reports?g=ops', label: 'التشغيل اليومي', icon: Activity, sub: true },
  { to: '/reports?g=perf', label: 'أداء الورشة والفنيين', icon: Gauge, sub: true },
  { to: '/reports?g=quality', label: 'الجودة', icon: BadgeCheck, sub: true },
  { to: '/reports?g=finance', label: 'المالية والربحية', icon: Wallet, sub: true },
  { to: '/reports?g=assets', label: 'الأصول والعملاء', icon: Building2, sub: true },
  { to: '/reports?g=stock', label: 'المخزون والقطع', icon: Package, sub: true },
  { to: '/reports?g=approval', label: 'الاعتماد', icon: ClipboardCheck, sub: true },
  { to: '/reports?g=schedule', label: 'الجدولة', icon: CalendarDays, sub: true },
  { to: '/master-data', label: 'البيانات الرئيسية', icon: ListChecks, section: 'الإعداد' },
  { to: '/settings', label: 'إعدادات الصيانة', icon: Settings2 },
  { to: '/access', label: 'مصفوفة الصلاحيات', icon: Lock },
  { to: '/audit', label: 'سجل التدقيق', icon: History },
  { to: '/soon/pm', label: 'الصيانة الوقائية', icon: FileCheck2, section: 'قريباً', soon: true },
  { to: '/soon/coverage', label: 'تغطية عقود الخدمة', icon: FileSearch, soon: true },
  { to: '/soon/board', label: 'لوحة السحب والإفلات', icon: Move, soon: true },
  { to: '/soon/skills', label: 'مهارات الفنيين', icon: GraduationCap, soon: true },
]

/** Demo "today" control: moves time to trigger estimate expiry, overdue WOs and the rework window. */
function DemoDate() {
  const { setAsOf, db } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false))
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-gray-600 hover:bg-gray-50" title="التاريخ التجريبي">
        <CalendarClock className="h-4 w-4" />
        <span className="hidden sm:inline">اليوم التجريبي:</span><span className="font-semibold text-navy">{fmtDate(db.asOf)}</span>
      </button>
      {open && (
        <div className="absolute end-0 top-10 z-40 w-64 rounded-md border border-line bg-white p-3 shadow-lg">
          <div className="mb-2 text-[11px] font-semibold text-gray-400">تقديم التاريخ التجريبي</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 7, 15, 30].map((n) => <button key={n} type="button" className="btn justify-center px-0" onClick={() => setAsOf(addDays(today(), n))}>+{n}</button>)}
          </div>
          <input type="date" dir="ltr" className="inp mt-2" value={db.asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
          <button type="button" className="btn mt-2 w-full justify-center" onClick={() => setAsOf(DEFAULT_TODAY)}>العودة إلى {DEFAULT_TODAY}</button>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-400">يؤثر على انتهاء صلاحية التقديرات والتأخر ونافذة إعادة العمل.</p>
        </div>
      )}
    </div>
  )
}

function RoleMenu() {
  const { db, user, setUser, run, reset, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState(false)
  const initials = user.name.replace('د. ', '').split(' ').slice(0, 2).map((w) => w[0]).join('')
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false))
  return (
    <div className="relative ms-2 border-s border-line ps-3" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md p-1 hover:bg-gray-50">
        <div className="relative">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">{initials}</div>
          <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div className="hidden text-start leading-tight md:block">
          <div className="text-[13px] font-semibold">{user.name}</div>
          <div className="text-[11px] text-gray-500">{roleLabel[db.role]}</div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-40 w-64 rounded-md border border-line bg-white py-1 shadow-lg">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-400"><UserCog className="h-3.5 w-3.5" />العمل كمستخدم (يغيّر الدور والأزرار)</div>
          <div className="max-h-72 overflow-y-auto">
            {db.users.map((u) => (
              <button key={u.id} type="button" onClick={() => { setUser(u.id); setOpen(false) }}
                className={`block w-full px-3 py-1.5 text-start hover:bg-gray-50 ${db.userId === u.id ? 'bg-navy-50 font-semibold text-navy' : 'text-gray-700'}`}>
                <span className="block text-sm">{u.name}</span><span className="text-[11px] text-gray-500">{roleLabel[u.role]} — {u.title}</span>
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-line" />
          <button type="button" onClick={() => run((d) => { d.simulateError = !d.simulateError }, db.simulateError ? 'تم إيقاف محاكاة الخطأ' : 'محاكاة خطأ الخادم مفعّلة — أعد تحميل الشاشة')}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-start text-sm text-gray-700 hover:bg-gray-50">
            <ZapOff className="h-3.5 w-3.5" />{db.simulateError ? 'إيقاف محاكاة الخطأ' : 'محاكاة خطأ في الخادم'}
          </button>
          <button type="button" onClick={() => { setOpen(false); setAsk(true) }} className="flex w-full items-center gap-1.5 px-3 py-1.5 text-start text-sm text-red-600 hover:bg-red-50">
            <RotateCcw className="h-3.5 w-3.5" />إعادة تعيين بيانات الصيانة
          </button>
          <div className="px-3 pb-1 text-[10px] text-gray-400" dir="ltr">maintenance data v{DATA_VERSION}</div>
        </div>
      )}
      {ask && (
        <Confirm danger title="إعادة تعيين بيانات الصيانة" text="سيتم حذف كل التعديلات في وحدة الصيانة وإرجاع بيانات العرض الأصلية." onClose={() => setAsk(false)}
          onYes={() => { reset(); toast('تمت إعادة تعيين بيانات الصيانة'); window.location.hash = '#/' }} />
      )}
    </div>
  )
}

export function Topbar() {
  const nav = useNavigate()
  const { can } = useStore()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-4">
      <div className="flex items-center gap-2">
        {can('Requests.Create') && (
          <button type="button" className="btn h-8 w-8 justify-center px-0" title="طلب صيانة جديد" onClick={() => nav('/requests/new')}><Plus className="h-4 w-4" /></button>
        )}
        <div className="relative hidden lg:block">
          <Search className="absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
          <input className="inp w-72 ps-8" placeholder="بحث برقم أمر العمل أو اللوحة أو العميل..." onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { nav(`/work-orders?q=${encodeURIComponent(e.currentTarget.value.trim())}`); e.currentTarget.value = '' } }} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <DemoDate />
        {[Monitor, Languages, Bell, Gauge].map((I, i) => (
          <button key={i} type="button" className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100">
            <I className="h-[18px] w-[18px]" />
          </button>
        ))}
        <RoleMenu />
      </div>
    </header>
  )
}

export function PageHeader({ crumbs, title, actions, summary, badge }: {
  crumbs: { label: string; to?: string }[]; title: string; actions?: ReactNode
  summary?: { label: string; value: string }; badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <nav className="mb-1 flex items-center gap-1 text-xs text-gray-500">
          {[{ label: 'إدارة الصيانة', to: '/' }, ...crumbs].map((c, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              {c.to && i < arr.length - 1 ? <Link to={c.to} className="hover:text-navy">{c.label}</Link> : <span className="text-gray-700">{c.label}</span>}
              {i < arr.length - 1 && <ChevronLeft className="h-3 w-3" />}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {badge}
        </div>
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        {actions}
        {summary && (
          <div className="ms-2 border-s border-line ps-3 text-end leading-tight">
            <div className="text-[11px] text-gray-500">{summary.label}</div>
            <div className="text-sm font-bold tabular-nums text-navy" dir="ltr">{summary.value}</div>
          </div>
        )}
      </div>
    </div>
  )
}
