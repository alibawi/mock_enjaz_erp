import { Download } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/Layout'
import { EmptyBlock, ErrorState, LoadingSkeleton } from '../components/states'
import { Card } from '../components/ui'
import { addDays, today } from '../data/asof'
import { fmtDate, iqd, num } from '../data/format'
import { groups, reports, type ColType, type GroupId, type Row } from '../data/reports'
import { roleLabel } from '../data/permissions'
import { useStore } from '../data/store'
import type { RoleId } from '../data/types'
import { useApi } from '../lib/useApi'
import { Link, useNavigate, useSearchParams } from '../router'

const fmt = (v: unknown, t: ColType = 'text') => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v !== 'number') return t === 'date' ? fmtDate(String(v)) : String(v)
  switch (t) {
    case 'iqd': return iqd(Math.round(v))
    case 'pct': return `${num(v, 1)}%`
    case 'hours': return `${num(v, 1)} س`
    case 'days': return `${num(v, v % 1 ? 1 : 0)} يوم`
    default: return num(v, v % 1 ? 1 : 0)
  }
}

/** Reports (S20): plan §28.1–28.7 + §38.6, grouped by the question they answer; period filter, bar chart, table, CSV. */
export default function Reports() {
  const { db, can, setUser } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const t0 = today()
  const presets = [
    { id: 'month', label: 'هذا الشهر', from: `${t0.slice(0, 8)}01` },
    { id: '30', label: 'آخر 30 يومًا', from: addDays(t0, -30) },
    { id: 'all', label: 'منذ آب 2026', from: '2026-08-01' },
  ]
  const preset = params.get('p') ?? 'all'
  const from = params.get('from') ?? presets.find((x) => x.id === preset)?.from ?? '2026-08-01'
  const to = params.get('to') ?? t0
  const g = params.get('g') as GroupId | null
  const inGroup = g ? reports.filter((r) => r.group === g) : reports
  const id = params.get('r') ?? inGroup[0]?.id ?? 'wo-status'
  const def = inGroup.find((r) => r.id === id) ?? inGroup[0] ?? reports[0]
  const api = useApi(() => def.run(db, { from, to, today: t0 }), [id, from, to])
  const set = (patch: Record<string, string | null>) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v) } setParams(p) }
  const res = def.run(db, { from, to, today: t0 })
  const maxV = Math.max(1, ...(res.chart ?? []).map((c) => Math.abs(c.value)))
  const csv = () => {
    const lines = [res.columns.map((c) => c.label).join(','), ...res.rows.map((r) => res.columns.map((c) => `"${fmt(r[c.key], c.type).replace(/"/g, '""')}"`).join(','))]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }))
    a.download = `${def.id}-${from}-${to}.csv`
    a.click()
  }

  if (!can('Reports.View')) {
    const allowed = (Object.keys(roleLabel) as RoleId[]).filter((r) => db.rolePerms[r]?.includes('Reports.View'))
    return (
      <div>
        <PageHeader crumbs={[{ label: 'التقارير' }]} title="تقارير الصيانة" />
        <EmptyBlock title="دورك الحالي لا يملك صلاحية عرض التقارير"
          hint={`التقارير متاحة لـ: ${allowed.map((r) => roleLabel[r]).join('، ')}. بدّل المستخدم من القائمة أعلى الشاشة، أو امنح الصلاحية من «مصفوفة الصلاحيات».`}
          action={<div className="flex flex-wrap justify-center gap-2">{db.users.filter((u) => allowed.includes(u.role) && u.role !== 'admin').map((u) => <button key={u.id} type="button" className="btn" onClick={() => setUser(u.id)}>الدخول كـ {u.name} ({roleLabel[u.role]})</button>)}</div>} />
      </div>
    )
  }
  return (
    <div>
      <PageHeader crumbs={[{ label: 'التقارير' }]} title="تقارير الصيانة"
        actions={<>
          {presets.map((x) => <button key={x.id} type="button" className={`btn ${!params.get('from') && preset === x.id ? 'btn-primary' : ''}`} onClick={() => set({ p: x.id, from: null, to: null })}>{x.label}</button>)}
          <label className="flex items-center gap-1 text-xs text-gray-500">من<input type="date" className="inp w-auto" value={from} onChange={(e) => set({ from: e.target.value, to })} /></label>
          <label className="flex items-center gap-1 text-xs text-gray-500">إلى<input type="date" className="inp w-auto" value={to} onChange={(e) => set({ from, to: e.target.value })} /></label>
        </>} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card pad={false}>
          <nav className="max-h-[75vh] overflow-y-auto py-2 text-sm">
            {g && <button type="button" onClick={() => set({ g: null })} className="mb-1 block w-full px-3 py-1 text-start text-[12px] text-navy underline">عرض كل مجموعات التقارير ({reports.length})</button>}
            {groups.filter((x) => !g || x.id === g).map((g) => (
              <div key={g.id} className="mb-2">
                <div className="px-3 py-1 text-[11px] font-semibold text-gray-500">{g.label} <span className="font-normal text-gray-400">— {g.q}</span></div>
                {reports.filter((r) => r.group === (g.id as GroupId)).map((r) => (
                  <button key={r.id} type="button" onClick={() => set({ r: r.id })}
                    className={`block w-full px-3 py-1.5 text-start hover:bg-gray-50 ${r.id === def.id ? 'border-s-2 border-navy bg-navy-50 font-semibold text-navy' : 'text-gray-700'}`}>{r.title}</button>
                ))}
              </div>
            ))}
          </nav>
        </Card>
        <div className="min-w-0 space-y-4">
          {api.error ? <ErrorState message={api.error} onRetry={api.reload} /> : api.loading ? <LoadingSkeleton /> : <>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] text-gray-500">{groups.find((g) => g.id === def.group)?.label} · {fmtDate(from)} ← {fmtDate(to)}</div>
                  <h2 className="text-lg font-bold text-navy">{def.title}</h2>
                  <p className="text-sm text-gray-600">{def.question}</p>
                </div>
                <div className="flex items-center gap-3">
                  {res.headline && <div className="rounded-md bg-navy-50 px-3 py-2 text-sm font-bold text-navy">{res.headline}</div>}
                  <button type="button" className="btn" disabled={!res.rows.length} onClick={csv}><Download className="h-4 w-4" />CSV</button>
                </div>
              </div>
              {res.note && <p className="mt-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{res.note}</p>}
              {res.chart && res.chart.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {res.chart.map((c, i) => (
                    <div key={i} className="grid grid-cols-[minmax(120px,220px)_1fr_auto] items-center gap-2 text-[12px]">
                      <span className="truncate text-gray-700" title={c.label}>{c.label}</span>
                      <span className="h-4 rounded-sm bg-gray-100"><span className="block h-4 rounded-sm bg-navy/70" style={{ inlineSize: `${(Math.abs(c.value) / maxV) * 100}%` }} /></span>
                      <span className="tabular-nums text-gray-600">{fmt(c.value, res.chartType ?? 'num')}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card pad={false}>
              {res.rows.length === 0 ? <EmptyBlock title="لا توجد بيانات في الفترة" hint="جرّب «منذ آب 2026» أو وسّع الفترة." /> : (
                <DataTable<Row> rows={res.rows} onRowClick={(r) => r.link && nav(r.link)} columns={res.columns.map((c) => ({
                  key: c.key, label: c.label, num: !!c.type && !['text', 'date', 'code'].includes(c.type),
                  sort: (r: Row) => r[c.key] ?? '',
                  render: (r: Row) => (c.type === 'code' ? <span className="font-mono text-[12px]" dir="ltr">{fmt(r[c.key], 'text')}</span> : fmt(r[c.key], c.type)),
                }))} />
              )}
            </Card>
            <p className="text-[11px] text-gray-400">المصدر: خطة الصيانة §28 و§38.6 · الأرقام محسوبة من بيانات العرض. <Link to="/labor" className="underline">ساعات العمل</Link> · <Link to="/billing" className="underline">الفوترة</Link></p>
          </>}
        </div>
      </div>
    </div>
  )
}
