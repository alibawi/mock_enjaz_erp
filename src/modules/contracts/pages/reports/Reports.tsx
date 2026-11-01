import { ArrowDown, ArrowUp, Download, Printer, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '../../router'
import { FilterSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Async, EmptyBlock } from '../../components/states'
import { Card } from '../../components/ui'
import { reportById, reports, toCsv, type Row } from '../../data/reports'
import { addAudit, useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'

const groups = ['العقود', 'التنفيذ', 'القيمة', 'المتابعة']

/** Report hub: R-01…R-17 grouped (spec R1–R4). */
export function ReportsHub() {
  const { can } = useStore()
  if (!can('Reports.View')) return <div><PageHeader crumbs={[{ label: 'التقارير' }]} title="التقارير" /><EmptyBlock title="لا تملك صلاحية «التقارير»" hint="بدّل الدور إلى مدير عقود أو مالية أو قانوني." /></div>
  return (
    <div>
      <PageHeader crumbs={[{ label: 'التقارير' }]} title="التقارير" />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">كل تقرير يطبّق صلاحية البيانات والسرية قبل حساب المجاميع، والقيم بكل عملة على حدة. التواريخ بحسب اليوم التجريبي. التصدير يتطلب صلاحية «تصدير».</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} title={g} pad={false}>
            <ul className="divide-y divide-line">
              {reports.filter((r) => r.group === g).map((r) => (
                <li key={r.id}><Link to={`/reports/${r.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50"><span className="w-12 shrink-0 text-xs font-semibold text-navy" dir="ltr">{r.code}</span><span><span className="block text-sm font-medium">{r.title}</span><span className="text-xs text-gray-500">{r.desc}</span></span></Link></li>))}
            </ul>
          </Card>))}
      </div>
    </div>
  )
}

const asNum = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : NaN }

/** Reusable report grid: filter bar, search, sortable columns, totals row, mock export (permission-gated) and print. */
export function ReportView() {
  const { id } = useParams()
  const { db, can, run } = useStore()
  const nav = useNavigate()
  const def = reportById(id ?? '')
  const [f, setF] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const api = useApi(() => (def ? def.build(db, f) : null), [id, JSON.stringify(f)])
  const res = api.data
  const rows = useMemo(() => {
    if (!res) return []
    let r = res.rows.filter((x) => !q || Object.values(x.cells).join(' ').toLowerCase().includes(q.toLowerCase()))
    if (sort) r = r.slice().sort((a, b) => { const x = a.cells[sort.key], y = b.cells[sort.key]; const nx = asNum(x), ny = asNum(y); return (Number.isNaN(nx) || Number.isNaN(ny) ? String(x ?? '').localeCompare(String(y ?? '')) : nx - ny) * sort.dir })
    return r
  }, [res, q, sort])
  if (!can('Reports.View')) return <EmptyBlock title="لا تملك صلاحية «التقارير»" />
  if (!def) return <EmptyBlock title="التقرير غير موجود" action={<button type="button" className="btn" onClick={() => nav('/reports')}>كل التقارير</button>} />
  const exportCsv = () => {
    if (!res) return
    const blob = new Blob([toCsv({ ...res, rows })], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${def.code}-${db.asOf}.csv`; a.click()
    URL.revokeObjectURL(a.href)
    run((d) => { addAudit(d, 'report', def.code, 'export', `${rows.length} صف`) }, 'نُزّل ملف CSV (محاكاة تصدير Excel)')
  }
  return (
    <div>
      <PageHeader crumbs={[{ label: 'التقارير', to: '/reports' }, { label: def.code }]} title={`${def.code} — ${def.title}`}
        actions={<><button type="button" className="btn" disabled={!can('Contracts.Export')} title={can('Contracts.Export') ? undefined : 'التصدير يتطلب صلاحية «تصدير»'} onClick={exportCsv}><Download className="h-4 w-4" />تصدير</button>
          <button type="button" className="btn" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button></>} />
      <p className="mb-3 text-xs text-gray-500">{def.desc} — بتاريخ {db.asOf}</p>
      <Card pad={false}>
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-64"><Search className="absolute start-2.5 top-2 h-4 w-4 text-gray-400" /><input className="inp ps-8" placeholder="بحث في النتائج..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {def.filters.map((fd) => <FilterSelect key={fd.key} label={fd.label} value={f[fd.key] ?? ''} onChange={(v) => setF((x) => ({ ...x, [fd.key]: v }))} options={fd.options(db)} />)}
          <span className="ms-auto text-xs text-gray-500">{rows.length} سجل</span>
        </div>
        <Async state={api}>
          {(r) => !r ? null : (
            <div className="overflow-x-auto">
              <table className="tbl w-full">
                <thead><tr>{r.cols.map((c) => (
                  <th key={c.key} className="cursor-pointer select-none whitespace-nowrap" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (-s.dir as 1 | -1) } : { key: c.key, dir: 1 }))}>
                    <span className="inline-flex items-center gap-1">{c.label}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span></th>))}</tr></thead>
                <tbody>
                  {rows.map((row: Row) => (
                    <tr key={row.id} className={row.to ? 'cursor-pointer' : ''} onClick={() => row.to && nav(row.to)}>
                      {r.cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{row.cells[c.key] === undefined ? '—' : typeof row.cells[c.key] === 'number' ? (row.cells[c.key] as number).toLocaleString('en-US') : row.cells[c.key]}</td>)}
                    </tr>))}
                  {rows.length === 0 && <tr><td colSpan={r.cols.length} className="py-10 text-center text-gray-400">لا نتائج مطابقة</td></tr>}
                </tbody>
                {r.foot && <tfoot><tr>{r.cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{r.foot![c.key] ?? ''}</td>)}</tr></tfoot>}
              </table>
              {r.note && <p className="border-t border-line px-4 py-2 text-[11px] text-gray-500">{r.note}</p>}
            </div>)}
        </Async>
      </Card>
      {!can('Contracts.Export') && <p className="mt-2 text-[11px] text-gray-400">التصدير معطّل لدورك (BR-R-04).</p>}
    </div>
  )
}
