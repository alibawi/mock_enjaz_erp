import { Bell, CalendarClock, ChevronDown, ChevronLeft, Languages, Monitor, Plus, RotateCcw, Search, UserCog, ZapOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '../router'
import { addDays, today } from '../data/asof'
import { fmtDate } from '../data/format'
import { roleLabel } from '../data/permissions'
import { DATA_VERSION, useStore } from '../data/store'
import { useClickAway } from '../lib/useClickAway'
import { Confirm } from './ui'

/** Demo "today" control: lets the presenter move time forward to trigger expiry, reminders and overdue states. */
function DemoDate() {
  const { setAsOf, db } = useStore()
  const [open, setOpen] = useState(false)
  const shift = (n: number) => setAsOf(addDays(today(), n))
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
            {[1, 7, 30, 90].map((n) => <button key={n} type="button" className="btn justify-center px-0" onClick={() => shift(n)}>+{n}</button>)}
          </div>
          <input type="date" dir="ltr" className="inp mt-2" value={db.asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
          <button type="button" className="btn mt-2 w-full justify-center" onClick={() => setAsOf('2026-10-30')}>العودة إلى 2026-10-30</button>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-400">يؤثر على الانتهاء والتنبيهات والتأخر والتجديد التلقائي.</p>
        </div>
      )}
    </div>
  )
}

function RoleMenu() {
  const { db, user, setUser, run, reset, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState(false)
  const initials = user.name.split(' ').slice(0, 2).map((w) => w[0]).join('')
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
            <RotateCcw className="h-3.5 w-3.5" />إعادة تعيين البيانات التجريبية
          </button>
          <div className="px-3 pb-1 text-[10px] text-gray-400" dir="ltr">data v{DATA_VERSION}</div>
        </div>
      )}
      {ask && (
        <Confirm danger title="إعادة تعيين البيانات التجريبية" text="سيتم حذف كل التعديلات وإرجاع بيانات العرض الأصلية." onClose={() => setAsk(false)}
          onYes={() => { reset(); toast('تمت إعادة تعيين البيانات التجريبية'); window.location.hash = '#/' }} />
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
        {can('Contracts.Create') && (
          <button type="button" className="btn h-8 w-8 justify-center px-0" title="عقد جديد" onClick={() => nav('/contracts/new')}><Plus className="h-4 w-4" /></button>
        )}
        <div className="relative hidden lg:block">
          <Search className="absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
          <input className="inp w-72 ps-8" placeholder="بحث في العقود والأطراف والمستندات..." onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { nav(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`); e.currentTarget.value = '' } }} />
          <kbd className="absolute end-2 top-1.5 rounded border border-line bg-gray-50 px-1.5 text-[10px] text-gray-500" dir="ltr">⌘K</kbd>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <DemoDate />
        {[Monitor, Languages, Bell].map((I, i) => (
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
          {[{ label: 'إدارة العقود', to: '/' }, ...crumbs].map((c, i, arr) => (
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
