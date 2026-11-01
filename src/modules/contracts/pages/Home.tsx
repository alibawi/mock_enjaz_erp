import { AlarmClock, BarChart3, BellRing, CalendarClock, ClipboardCheck, Coins, FileText, Files, FilePen, FileSignature, Gauge, Handshake, ListChecks, Settings2, ShieldAlert, Wrench } from 'lucide-react'
import { Link } from '../router'
import { KPICard, ModuleScreensGrid } from '../components/display'
import { PageHeader } from '../components/Layout'
import { Async } from '../components/states'
import { Card } from '../components/ui'
import { alertsForUser } from '../data/alerts'
import { statusLabel, statusOrder } from '../data/contractMeta'
import { daysTo, fmtDate, money, num } from '../data/format'
import { partnerName, typeOf } from '../data/lifecycle'
import { dashboard } from '../data/reports'
import { useStore } from '../data/store'
import type { ContractStatus } from '../data/types'
import { useApi } from '../lib/useApi'

const color: Record<ContractStatus, string> = {
  Draft: '#9ca3af', PendingApproval: '#f59e0b', Approved: '#38bdf8', PendingSignature: '#fbbf24', Active: '#10b981', OnHold: '#fb923c', Expired: '#ef4444', Terminated: '#b91c1c', Cancelled: '#d1d5db', Closed: '#6366f1',
}

/** Donut by status — plain SVG, no chart library (brief). */
function Donut({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let acc = 0
  const r = 42, c = 2 * Math.PI * r
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 110 110" className="h-36 w-36 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {data.filter((d) => d.value).map((d) => {
          const len = (d.value / total) * c
          const el = <circle key={d.key} cx="55" cy="55" r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
          acc += len
          return el
        })}
        <text x="55" y="55" transform="rotate(90 55 55)" textAnchor="middle" dominantBaseline="middle" className="fill-gray-800 text-[18px] font-bold">{total}</text>
      </svg>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {data.filter((d) => d.value).map((d) => <li key={d.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}<span className="ms-auto font-semibold tabular-nums">{d.value}</span></li>)}
      </ul>
    </div>
  )
}

/** R0 — executive dashboard: figures from every module, filtered by the user's data authority and confidentiality (BR-R-01). SVG/CSS charts only. */
export default function Home() {
  const { db } = useStore()
  const api = useApi(() => {
    const d = dashboard(db)
    const types = db.contractTypes.map((t) => ({ name: t.name, n: d.vis.filter((c) => c.typeId === t.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n)
    return { ...d, types, alerts: alertsForUser(db) }
  })
  return (
    <div>
      <PageHeader crumbs={[{ label: 'لوحة المؤشرات' }]} title="لوحة المؤشرات التنفيذية" actions={<Link to="/reports" className="btn"><BarChart3 className="h-4 w-4" />كل التقارير</Link>} />
      <Async state={api}>
        {(d) => (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <KPICard label="عقود سارية" value={d.active.length} icon={FileSignature} tone="green" to="/reports/active" hint={<span className="flex flex-wrap gap-x-2"><span dir="ltr">{money(d.value.IQD, 'IQD')}</span><span dir="ltr">{money(d.value.USD, 'USD')}</span></span>} />
              <KPICard label="تنتهي خلال 30 يوماً" value={d.expiring.length} icon={AlarmClock} tone={d.expiring.length ? 'amber' : 'gray'} to="/reports/expiring" />
              <KPICard label="بانتظار الاعتماد" value={d.approval} icon={ClipboardCheck} tone="amber" to="/reports/awaiting-approval" />
              <KPICard label="بانتظار التوقيع" value={d.signature} icon={FilePen} tone="amber" to="/reports/awaiting-signature" />
              <KPICard label="التزامات متأخرة" value={d.overdue} icon={ListChecks} tone={d.overdue ? 'red' : 'gray'} to="/obligations" />
              <KPICard label="فوترة مستحقة (≤ 7 أيام)" value={d.billingDue} icon={Coins} tone={d.billingDue ? 'amber' : 'gray'} to="/payments" />
              <KPICard label="ضمن مستوى الخدمة" value={d.slaPct === undefined ? '—' : `${d.slaPct.toFixed(0)}%`} icon={Wrench} tone={d.slaPct !== undefined && d.slaPct < 80 ? 'red' : 'green'} to="/service/sla" />
              <KPICard label="انحراف التنفيذ" value={d.drift} icon={ShieldAlert} tone={d.drift ? 'red' : 'green'} to="/reports/drift" hint={d.drift ? 'يلزم إعادة احتساب' : 'سليم'} />
              <KPICard label="تنبيهات لك" value={d.alerts.length} icon={BellRing} tone={d.alerts.length ? 'red' : 'gray'} to="/alerts" />
              <KPICard label="عقود منتهية تنتظر التجديد" value={d.vis.filter((c) => c.status === 'Expired').length} icon={CalendarClock} tone="red" to="/renewals" />
            </div>
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <Card title="العقود حسب الحالة"><Donut data={statusOrder.map((s) => ({ key: s, label: statusLabel[s], value: d.vis.filter((c) => c.status === s).length, color: color[s] }))} /></Card>
              <Card title="العقود حسب النوع">
                <ul className="space-y-2 text-xs">
                  {d.types.map((t) => (
                    <li key={t.name}><div className="mb-0.5 flex justify-between"><span>{t.name}</span><span className="font-semibold tabular-nums">{t.n}</span></div>
                      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-navy" style={{ width: `${(t.n / d.types[0].n) * 100}%` }} /></div></li>))}
                </ul>
              </Card>
              <Card title="تنتهي قريباً" actions={<Link to="/reports/expiring" className="text-xs text-navy underline">الكل</Link>}>
                {d.expiring.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">لا عقود تنتهي خلال 30 يوماً</div> : (
                  <ul className="divide-y divide-gray-100 text-sm">
                    {d.expiring.slice(0, 6).map((c) => (
                      <li key={c.id}><Link to={`/contracts/${c.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-navy">
                        <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="text-[11px] text-gray-500">{partnerName(db, c)} · {typeOf(db, c).name}</span></span>
                        <span className={`shrink-0 text-xs font-semibold ${daysTo(c.endDate!) <= 15 ? 'text-red-600' : 'text-amber-600'}`}>{daysTo(c.endDate!)} يوم<span className="block font-normal text-gray-400">{fmtDate(c.endDate)}</span></span>
                      </Link></li>))}
                  </ul>)}
              </Card>
            </div>
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <Card title="أعلى استهلاك للالتزامات (أكثر 10)" actions={<Link to="/reports/remaining" className="text-xs text-navy underline">التفاصيل</Link>}>
                {d.utilisation.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">لا اتفاقيات</div> : (
                  <ul className="space-y-2 text-xs">
                    {d.utilisation.map(({ c, s }) => (
                      <li key={c.id}><Link to={`/contracts/${c.id}`} className="mb-0.5 flex justify-between hover:text-navy"><span className="truncate">{c.title}</span><span className={`font-semibold tabular-nums ${s.pct >= 95 ? 'text-red-600' : s.pct >= 80 ? 'text-amber-600' : ''}`}>{num(s.pct, 0)}%</span></Link>
                        <div className="h-2 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${s.pct >= 95 ? 'bg-red-500' : s.pct >= 80 ? 'bg-amber-500' : 'bg-navy'}`} style={{ width: `${Math.min(100, s.pct)}%` }} /></div></li>))}
                  </ul>)}
              </Card>
              <Card title="آخر التنبيهات" actions={<Link to="/alerts" className="text-xs text-navy underline">الكل</Link>}>
                {d.alerts.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">لا تنبيهات</div> : (
                  <ul className="divide-y divide-gray-100 text-sm">
                    {d.alerts.slice(0, 7).map((a) => (
                      <li key={a.key}><Link to={`/contracts/${a.contractId}`} className="flex items-start gap-2 py-1.5 hover:text-navy"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === 'danger' ? 'bg-red-500' : a.severity === 'warn' ? 'bg-amber-500' : 'bg-sky-500'}`} /><span><span className="block">{a.text}</span><span className="text-[11px] text-gray-400" dir="ltr">{a.contractNumber}</span></span></Link></li>))}
                  </ul>)}
              </Card>
            </div>
          </>)}
      </Async>
      <Card title="وحدات النظام">
        <ModuleScreensGrid screens={[
          { to: '/contracts', title: 'العقود', hint: 'القائمة، البطاقة، الدورة، الأطراف والمرفقات، التنبيهات', icon: FileText },
          { to: '/tasks', title: 'الاعتماد والتوقيع', hint: 'مراحل Elsa، المهام، التفويض، التوقيع الإلكتروني', icon: ClipboardCheck },
          { to: '/agreements', title: 'الاتفاقيات والتنفيذ', hint: 'بنود الالتزام ودفتر التنفيذ وتحويل العملات', icon: Handshake },
          { to: '/amendments', title: 'الملاحق والنسخ والتجديد', hint: 'ملاحق بتاريخ سريان، مقارنة النسخ، التجديد', icon: FilePen },
          { to: '/obligations', title: 'الالتزامات والمالية', hint: 'المراحل والغرامات وجدول الدفعات والملخص المالي', icon: ListChecks },
          { to: '/templates', title: 'القوالب والطباعة', hint: 'القوالب، مكتبة البنود، معاينة الطباعة', icon: Files },
          { to: '/service', title: 'عقود الخدمة', hint: 'التغطية ومستوى الخدمة والاستهلاك', icon: Wrench },
          { to: '/settings', title: 'الإعدادات والصلاحيات', hint: 'إعدادات النظام ومصفوفة الصلاحيات والترقيم', icon: Settings2 },
          { to: '/reports', title: 'التقارير', hint: 'التقارير R-01…R-17 والبحث الشامل', icon: BarChart3 },
          { to: '/service/calls', title: 'محاكي بلاغات الخدمة', hint: 'تغطية ومهل SLA واستهلاك', icon: Gauge },
        ]} />
      </Card>
    </div>
  )
}
