import { useState } from 'react'
import { ContractStatusBadge } from '../../components/contract'
import { KPICard } from '../../components/display'
import { FilterSelect } from '../../components/inputs'
import { ListView, type Column } from '../../components/ListView'
import { daysTo, fmtDate } from '../../data/format'
import { canSee, partnerName } from '../../data/lifecycle'
import { serviceStats, warrantyEnds } from '../../data/service'
import { statusLabel } from '../../data/contractMeta'
import { useStore } from '../../data/store'
import type { Contract } from '../../data/types'
import { useApi } from '../../lib/useApi'

interface Row { id: string; c: Contract; s: ReturnType<typeof serviceStats>; we?: string }
const Bar = ({ pct, label }: { pct?: number; label: string }) => pct === undefined ? <span className="text-gray-300">—</span> : (
  <div className="min-w-[120px]"><div className="h-2 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-navy'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div><div className="mt-0.5 text-[10px] text-gray-500">{label} ({pct.toFixed(0)}%)</div></div>
)

/** S6 — service contracts list with utilisation of included hours, SLA and expiry; module KPIs on top. */
export default function ServiceList() {
  const { db } = useStore()
  const [st, setSt] = useState('')
  const api = useApi(() => {
    const rows = db.contracts.filter((c) => c.profile === 'Service' && canSee(db, c)).map<Row>((c) => ({ id: c.id, c, s: serviceStats(db, c), we: warrantyEnds(db, c) }))
    const month = db.asOf.slice(0, 7)
    const active = rows.filter((r) => r.c.status === 'Active')
    const ev = db.slaEvents
    const incl = active.reduce((s, r) => s + (r.s.level?.includedHours ?? 0), 0), used = active.reduce((s, r) => s + r.s.hours, 0)
    return {
      rows, active: active.length, slaPct: ev.length ? (ev.filter((e) => e.kind.endsWith('Met')).length / ev.length) * 100 : undefined,
      breachesMonth: ev.filter((e) => e.kind.endsWith('Breached') && e.at.startsWith(month)).length, incl, used,
      warranties: db.coveredItems.filter((i) => i.warrantyEnd && daysTo(i.warrantyEnd) >= 0 && daysTo(i.warrantyEnd) <= 60).length,
    }
  })
  const rows = (api.data?.rows ?? []).filter((r) => !st || r.c.status === st)
  const cols: Column<Row>[] = [
    { key: 'n', label: 'العقد', sort: (r) => r.c.number, render: (r) => <div><div className="font-medium text-navy" dir="ltr">{r.c.number}</div><div className="max-w-[260px] truncate text-[11px] text-gray-500">{r.c.title}</div></div> },
    { key: 'p', label: 'العميل', render: (r) => <span className="line-clamp-2 max-w-[180px]">{partnerName(db, r.c)}</span> },
    { key: 's', label: 'الحالة', render: (r) => <ContractStatusBadge status={r.c.status} /> },
    { key: 'sla', label: 'الاستجابة / الحل', render: (r) => (r.s.level ? `${r.s.level.responseHours}س / ${r.s.level.resolutionHours}س` : '—') },
    { key: 'h', label: 'الساعات المشمولة', sort: (r) => r.s.hoursPct ?? -1, render: (r) => <Bar pct={r.s.hoursPct} label={`${r.s.hours} من ${r.s.level?.includedHours}`} /> },
    { key: 'v', label: 'الزيارات', render: (r) => <Bar pct={r.s.visitsPct} label={`${r.s.visits} من ${r.s.level?.includedVisits}`} /> },
    { key: 'c', label: 'بلاغات', num: true, render: (r) => r.s.calls },
    { key: 'a', label: 'ضمن SLA', num: true, sort: (r) => r.s.slaPct ?? -1, render: (r) => (r.s.slaPct === undefined ? '—' : <span className={r.s.slaPct < 80 ? 'font-semibold text-red-600' : ''}>{r.s.slaPct.toFixed(0)}%</span>) },
    { key: 'e', label: 'الانتهاء', sort: (r) => r.c.endDate ?? '9999', render: (r) => <div>{fmtDate(r.c.endDate)}{r.c.endDate && ['Active', 'OnHold'].includes(r.c.status) && <div className="text-[11px] text-gray-400">{daysTo(r.c.endDate)} يوم</div>}</div> },
    { key: 'w', label: 'نهاية الضمان', render: (r) => fmtDate(r.we) },
  ]
  const k = api.data
  return (
    <div>
      {k && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <KPICard label="عقود خدمة سارية" value={k.active} /><KPICard label="بلاغات ضمن SLA" value={k.slaPct === undefined ? '—' : `${k.slaPct.toFixed(0)}%`} tone={k.slaPct !== undefined && k.slaPct < 80 ? 'red' : 'green'} to="/service/sla" />
          <KPICard label="خروقات هذا الشهر" value={k.breachesMonth} tone={k.breachesMonth ? 'red' : 'gray'} /><KPICard label="الساعات المستهلكة / المشمولة" value={`${k.used} / ${k.incl}`} hint={k.incl ? `${((k.used / k.incl) * 100).toFixed(0)}%` : undefined} />
          <KPICard label="ضمانات تنتهي خلال 60 يوماً" value={k.warranties} tone={k.warranties ? 'amber' : 'gray'} />
        </div>)}
      <ListView title="عقود الخدمة" crumbs={[{ label: 'الخدمة' }]} rows={rows} columns={cols} rowTo={(r) => `/contracts/${r.id}`} canNew={false} canExport={false} loading={api.loading} error={api.error} onRetry={api.reload}
        searchText={(r) => `${r.c.number} ${r.c.title} ${partnerName(db, r.c)}`} filters={<FilterSelect label="الحالة" value={st} onChange={setSt} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />}
        emptyTitle="لا عقود خدمة" emptyHint="تُنشأ من «عقد جديد» بنوع صيانة أو ضمان." />
    </div>
  )
}
