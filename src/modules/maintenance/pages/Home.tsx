import { AlarmClock, BadgeCheck, CalendarClock, FileSignature, PackageX, Receipt, TrendingUp, Users, Wallet, Wrench } from 'lucide-react'
import { PageHeader, maintenanceNav } from '../components/Layout'
import { KPICard, ModuleScreensGrid } from '../components/display'
import { diffDays, today, weekDays, weekStart } from '../data/asof'
import { dayName, fmtDate, iqd, num, woStatus } from '../data/format'
import { reports } from '../data/reports'
import { onLeave, toSchedule } from '../data/schedule'
import { useStore } from '../data/store'
import { isOpenWo, isOverdue, woCost } from '../data/workorder'

const hints: Record<string, string> = {
  '/requests': 'استلام الأصل وإيصال الاستلام وقراءة العداد',
  '/estimates': 'عرض سعر الإصلاح، الاعتماد الداخلي وموافقة العميل',
  '/tasks': 'تقديرات بانتظار قرارك حسب شريحة المبلغ',
  '/work-orders': 'التنفيذ، القطع والحجز والصرف التلقائي، الإغلاق',
  '/labor': 'ساعات الفنيين، التأكيد، الفرق مع الحضور',
  '/schedule': 'لوحة أسبوعية للفنيين والرافعات',
  '/schedule/bookings': 'كل الحجوزات وأسباب إعادة الجدولة',
  '/schedule/route-sheet': 'زيارات اليوم الميدانية بالعناوين',
  '/schedule/leave': 'إجازات معتمدة من الموارد البشرية',
  '/assets': 'بطاقة الأصل، العدادات، التاريخ',
  '/billing': 'فاتورة الخدمة، العربون والتخصيص والسداد',
  '/billing/issues': 'سندات الصرف وقيودها حسب نوع المصروف',
  '/reports': 'التشغيل، الأداء، الجودة، المالية، الجدولة',
  '/master-data': 'الأنواع، الأعطال، العمليات، الورشة، الفنيون',
  '/settings': 'الصرف، الاعتماد، العربون، إعادة العمل',
  '/access': 'الأدوار والصلاحيات',
  '/audit': 'كل تغيير: من ومتى وماذا',
}

/** Module landing (S0): KPI cards computed from the store (spec §6), each linking to its filtered list; then the screens grid. */
export default function Home() {
  const { db } = useStore()
  const t0 = today()
  const screens = maintenanceNav.filter((n) => n.to !== '/' && !n.sub).map((n) => ({ to: n.to, title: n.label, hint: hints[n.to] ?? 'قريباً', icon: n.icon, soon: n.soon }))
  const open = db.workOrders.filter(isOpenWo)
  const byStatus = (['inProgress', 'waitingParts', 'waitingCustomer', 'qualityCheck'] as const).map((s) => `${woStatus[s].label} ${open.filter((w) => w.status === s).length}`).join(' · ')
  const notInvoiced = db.workOrders.filter((w) => w.status === 'completed' && w.billingStatus === 'notInvoiced')
  const days = weekDays(weekStart(t0))
  const booked = db.bookings.filter((b) => b.status !== 'cancelled' && days.includes(b.date)).reduce((s, b) => { const [h1, m1] = b.start.split(':').map(Number); const [h2, m2] = b.end.split(':').map(Number); return s + ((h2 * 60 + m2 - h1 * 60 - m1) / 60) * b.technicianIds.length }, 0)
  const capacity = db.technicians.filter((t) => t.active).reduce((s, t) => s + days.slice(0, 6).filter((d) => !onLeave(db, t.id, d)).length * 8, 0)
  const ftf = reports.find((r) => r.id === 'ftf')!.run(db, { from: '2026-08-01', to: t0, today: t0 }).headline ?? '—'
  const month = t0.slice(0, 7)
  const mFinished = db.workOrders.filter((w) => ['completed', 'closed'].includes(w.status) && w.actualEnd?.startsWith(month))
  const revenue = db.invoices.filter((i) => !i.canceled && i.date.startsWith(month)).reduce((s, i) => s + i.total, 0)
  const cost = mFinished.reduce((s, w) => s + woCost(db, w).total, 0)
  const deposits = db.receipts.filter((r) => r.onAccount && r.amount > r.applied)
  const pendingEst = db.estimates.filter((e) => e.status === 'pendingApproval')
  const decided = db.approvals.filter((a) => a.decidedAt && a.decidedBy && a.decidedBy !== 'system')
  const avgApproval = decided.length ? decided.reduce((s, a) => s + diffDays(a.decidedAt!, a.submittedAt) + (Number(a.decidedAt!.slice(11, 13)) - Number(a.submittedAt.slice(11, 13))) / 24, 0) / decided.length : 0
  return (
    <div>
      <PageHeader crumbs={[{ label: 'لوحة الصيانة' }]} title="إدارة الصيانة" summary={{ label: 'اليوم', value: `${dayName(t0)} ${fmtDate(t0)}` }} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard label="أوامر عمل مفتوحة" value={num(open.length)} hint={byStatus} to="/work-orders" tone="blue" icon={Wrench} />
        <KPICard label="متأخرة عن الخطة" value={num(db.workOrders.filter(isOverdue).length)} to="/work-orders?tab=overdue" tone={db.workOrders.some(isOverdue) ? 'red' : 'gray'} icon={AlarmClock} />
        <KPICard label="مكتملة غير مفوترة" value={num(notInvoiced.length)} hint="إيراد متأخر" to="/billing" tone={notInvoiced.length ? 'amber' : 'gray'} icon={Receipt} />
        <KPICard label="فشل صرف القطع" value={num(db.workOrders.filter((w) => w.consumptionStatus === 'failed').length)} to="/work-orders?tab=failed" tone={db.workOrders.some((w) => w.consumptionStatus === 'failed') ? 'red' : 'gray'} icon={PackageX} />
        <KPICard label="بانتظار الجدولة" value={num(toSchedule(db).length)} to="/schedule" tone="amber" icon={CalendarClock} />
        <KPICard label="إشغال الفنيين هذا الأسبوع" value={`${num(capacity ? (booked / capacity) * 100 : 0, 0)}%`} hint={`${num(booked, 1)} س محجوزة`} to="/schedule" icon={Users} />
        <KPICard label="الإصلاح من المرة الأولى" value={ftf.split(' ')[0]} hint="منذ آب" to="/reports?r=ftf" tone="green" icon={BadgeCheck} />
        <KPICard label={`إيراد الشهر`} value={iqd(revenue)} hint={`هامش تقريبي ${iqd(revenue - cost)}`} to="/reports?r=profitability&p=month" tone="green" icon={TrendingUp} />
        <KPICard label="عربون غير مُسوّى" value={iqd(deposits.reduce((s, r) => s + r.amount - r.applied, 0))} hint={`${deposits.length} سند`} to="/billing?tab=receipts" icon={Wallet} />
        <KPICard label="تقديرات بانتظار الاعتماد" value={num(pendingEst.length)} hint={`متوسط الاعتماد ${num(avgApproval, 1)} يوم`} to="/estimates?tab=pendingApproval" tone="amber" icon={FileSignature} />
      </div>
      <ModuleScreensGrid screens={screens} />
    </div>
  )
}
