import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../components/DataTable'
import { KPICard } from '../components/display'
import { FilterSelect } from '../components/inputs'
import { PageHeader } from '../components/Layout'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { Badge, Card, Modal, Tabs } from '../components/ui'
import { today } from '../data/asof'
import { dayName, fmtDate, iqd, months, num, pct } from '../data/format'
import { allEntries, confirmEntries, costOf, variance, type EntryRow, type Variance } from '../data/labor'
import { useStore } from '../data/store'
import { useApi } from '../lib/useApi'
import { Link, useSearchParams } from '../router'

type TabId = 'entries' | 'variance'
const MONTHS = ['2026-08', '2026-09', '2026-10', '2026-11']
const monthLabel = (m: string) => `${months[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`

/** Labor (S19): WO time lines with supervisor confirmation; monthly variance against HR attendance; labor cost (report-only). */
export default function Labor() {
  const { db, run, can } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'entries'
  const month = params.get('month') ?? today().slice(0, 7)
  const [tech, setTech] = useState('')
  const [state, setState] = useState('pending')
  const [sel, setSel] = useState<string[]>([])
  const [drill, setDrill] = useState<Variance | null>(null)
  const api = useApi(() => db.workOrders, [])
  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />

  const name = (id: string) => db.technicians.find((t) => t.id === id)?.name ?? '—'
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p) }
  const entries = allEntries(db)
  const rows = entries
    .filter((e) => e.date.startsWith(month) && (!tech || e.technicianId === tech) && (state === '' || (state === 'pending' ? !e.confirmedBy : !!e.confirmedBy)))
    .sort((a, b) => b.date.localeCompare(a.date))
  const inMonth = entries.filter((e) => e.date.startsWith(month))
  const v = variance(db, month, today())
  const confirmable = (e: EntryRow) => !e.confirmedBy && e.wo.status !== 'closed'
  const canConfirm = can('WorkOrders.ConfirmTime')

  return (
    <div>
      <PageHeader crumbs={[{ label: 'ساعات العمل' }]} title="ساعات العمل والحضور"
        actions={<label className="flex items-center gap-1.5 text-xs text-gray-500">الشهر
          <select className="inp w-auto" value={month} onChange={(e) => set('month', e.target.value)}>{MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        </label>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="ساعات بانتظار التأكيد" value={num(inMonth.filter((e) => !e.confirmedBy).reduce((s, e) => s + e.hours, 0), 1)} tone="amber" />
        <KPICard label="ساعات مؤكَّدة" value={num(inMonth.filter((e) => e.confirmedBy).reduce((s, e) => s + e.hours, 0), 1)} tone="green" />
        <KPICard label="كلفة العمالة (تقارير فقط)" value={iqd(inMonth.reduce((s, e) => s + costOf(db, e), 0))} />
        <KPICard label="أيام فيها استثناء" value={num(v.reduce((s, x) => s + x.issues, 0))} tone={v.some((x) => x.issues) ? 'red' : 'gray'} />
      </div>
      <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-900">
        قرار §36.15 (الخيار i): الحضور في الموارد البشرية هو المصدر الوحيد لأجر الإضافي. ساعات أوامر العمل للتحقق والمقارنة فقط ولا تُنشئ أجرًا، وكلفة العمالة للتقارير بلا قيد محاسبي.
      </div>

      <Card pad={false}>
        <Tabs<TabId> active={tab} onChange={(t) => set('tab', t)} tabs={[
          { id: 'entries', label: 'ساعات أوامر العمل', count: inMonth.length },
          { id: 'variance', label: 'المقارنة مع الحضور', count: v.reduce((s, x) => s + x.issues, 0) || undefined },
        ]} />
        {tab === 'entries' ? (
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-3">
                <FilterSelect label="الفني" value={tech} onChange={setTech} options={db.technicians.map((t) => ({ value: t.id, label: t.name }))} />
                <FilterSelect label="الحالة" value={state} onChange={setState} options={[{ value: 'pending', label: 'بانتظار التأكيد' }, { value: 'confirmed', label: 'مؤكَّدة' }]} />
              </div>
              {canConfirm && <button type="button" className="btn btn-primary" disabled={!sel.length} onClick={() => run((d) => confirmEntries(d, sel), `تم تأكيد ${sel.length} سطر`) && setSel([])}><CheckCircle2 className="h-4 w-4" />تأكيد المحدد ({sel.length})</button>}
            </div>
            <DataTable rows={rows} compact emptyTitle="لا توجد ساعات مطابقة" emptyHint={state === 'pending' ? 'كل ساعات هذا الشهر مؤكَّدة.' : undefined} columns={[
              ...(canConfirm ? [{
                key: 'sel', label: '', render: (e: EntryRow) => (confirmable(e)
                  ? <input type="checkbox" checked={sel.includes(e.id)} onChange={(x) => setSel(x.target.checked ? [...sel, e.id] : sel.filter((i) => i !== e.id))} onClick={(x) => x.stopPropagation()} /> : null),
              }] : []),
              { key: 'd', label: 'التاريخ', render: (e) => `${dayName(e.date)} ${fmtDate(e.date)}`, sort: (e) => e.date },
              { key: 't', label: 'الفني', render: (e) => name(e.technicianId), sort: (e) => name(e.technicianId) },
              { key: 'w', label: 'أمر العمل', render: (e) => <Link to={`/work-orders/${e.wo.id}`} className="font-mono text-[12px] text-navy hover:underline" dir="ltr">{e.wo.number}</Link> },
              { key: 'a', label: 'الأصل', render: (e) => db.assets.find((a) => a.id === e.wo.assetId)?.name },
              { key: 'h', label: 'الساعات', num: true, render: (e) => num(e.hours, 1), total: (rs) => num(rs.reduce((s, e) => s + e.hours, 0), 1) },
              { key: 'c', label: 'الفئة', render: (e) => (e.category === 'overtime' ? <Badge tone="amber">إضافي</Badge> : 'اعتيادي') },
              { key: 'k', label: 'الكلفة', num: true, render: (e) => iqd(costOf(db, e)), total: (rs) => iqd(rs.reduce((s, e) => s + costOf(db, e), 0)) },
              { key: 's', label: 'التأكيد', render: (e) => (e.confirmedBy ? <Badge tone="green">مؤكَّد — {db.users.find((u) => u.id === e.confirmedBy)?.name}</Badge> : <Badge tone="amber">بانتظار المشرف</Badge>) },
            ]} />
            {!canConfirm && <p className="mt-2 text-xs text-gray-500">التأكيد للمشرف (مدير الورشة). يُسجِّل الفني ساعاته من بطاقة أمر العمل.</p>}
          </div>
        ) : (
          <div className="p-4">
            <p className="mb-2 text-xs text-gray-500">حتى {fmtDate(today())} (حضور اليوم يُستورد بعد انتهاء الدوام). بيانات العرض تضم عيّنة من أوامر العمل فقط، لذا نسبة الاستغلال منخفضة؛ المهم هنا الأيام التي تتجاوز فيها ساعات الأوامر الحضور.</p>
            <DataTable rows={v.map((x) => ({ ...x, id: x.technicianId }))} compact onRowClick={(x) => setDrill(x)} columns={[
              { key: 't', label: 'الفني', render: (x) => name(x.technicianId), sort: (x) => name(x.technicianId) },
              { key: 'a', label: 'الحضور (HR)', num: true, render: (x) => num(x.attended, 1), sort: (x) => x.attended, total: (rs) => num(rs.reduce((s, x) => s + x.attended, 0), 1) },
              { key: 'ao', label: 'منه إضافي', num: true, render: (x) => num(x.attendedOvertime, 1) },
              { key: 'l', label: 'ساعات الأوامر', num: true, render: (x) => num(x.logged, 1), sort: (x) => x.logged, total: (rs) => num(rs.reduce((s, x) => s + x.logged, 0), 1) },
              { key: 'p', label: 'غير مؤكَّدة', num: true, render: (x) => (x.pending ? <span className="text-amber-700">{num(x.pending, 1)}</span> : '—') },
              { key: 'v', label: 'الفرق', num: true, render: (x) => <span className={x.variance > 0 ? 'font-semibold text-red-600' : 'text-gray-600'}>{num(x.variance, 1)}</span>, sort: (x) => x.variance },
              { key: 'u', label: 'الاستغلال', num: true, render: (x) => pct(x.utilization * 100), sort: (x) => x.utilization },
              { key: 'k', label: 'كلفة العمالة', num: true, render: (x) => iqd(x.cost), total: (rs) => iqd(rs.reduce((s, x) => s + x.cost, 0)) },
              { key: 'i', label: 'استثناءات', render: (x) => (x.issues ? <Badge tone="red"><AlertTriangle className="inline h-3 w-3" /> {x.issues}</Badge> : <Badge tone="green">لا يوجد</Badge>) },
            ]} />
          </div>
        )}
      </Card>

      {drill && (
        <Modal title={`${name(drill.technicianId)} — ${monthLabel(month)}`} wide onClose={() => setDrill(null)} footer={<button type="button" className="btn" onClick={() => setDrill(null)}>إغلاق</button>}>
          <p className="mb-2 text-xs text-gray-500">الحضور مستورد من الموارد البشرية (مُحاكى). الأيام التي تظهر فيها ساعات أوامر عمل أكثر من الحضور تُراجع مع HR — التصحيح المالي يتم في الحضور ثم الرواتب، لا في الصيانة.</p>
          <DataTable rows={drill.days.filter((x) => x.logged || x.issue || x.onLeave).map((x) => ({ ...x, id: x.date }))} compact emptyTitle="لا توجد ساعات أوامر عمل هذا الشهر" columns={[
            { key: 'd', label: 'اليوم', render: (x) => `${dayName(x.date)} ${fmtDate(x.date)}` },
            { key: 'a', label: 'الحضور', num: true, render: (x) => (x.onLeave ? <Badge tone="gray">إجازة</Badge> : num(x.attended, 1)) },
            { key: 'l', label: 'ساعات الأوامر', num: true, render: (x) => num(x.logged, 1) },
            { key: 'i', label: 'الملاحظة', render: (x) => (x.issue ? <span className="text-red-600">{x.issue}</span> : <span className="text-emerald-700">متوافق</span>) },
          ]} />
        </Modal>
      )}
    </div>
  )
}
