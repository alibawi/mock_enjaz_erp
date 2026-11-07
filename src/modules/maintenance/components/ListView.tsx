import { Download, Plus, Printer, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from '../router'
import { DataTable, type Column } from './DataTable'
import { PageHeader } from './Layout'
import { ErrorState } from './states'
import { useStore } from '../data/store'

export type { Column }

/** Standard list page: header + optional KPIs + tabs + search + filters + DataTable with loading/error states. */
export function ListView<T extends { id: string }>({
  title, crumbs, rows, columns, newTo, newLabel = 'جديد', rowTo, onRowClick, searchText, filters, kpis, onNew, tabs, canNew = true,
  canExport = true, loading, error, onRetry, extraActions, emptyTitle, emptyHint,
}: {
  title: string
  crumbs?: { label: string; to?: string }[]
  rows: T[]
  columns: Column<T>[]
  newTo?: string
  newLabel?: string
  onNew?: () => void
  rowTo?: (r: T) => string
  onRowClick?: (r: T) => void
  tabs?: ReactNode
  canNew?: boolean
  canExport?: boolean
  searchText: (r: T) => string
  filters?: ReactNode
  kpis?: { label: string; value: string }[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  extraActions?: ReactNode
  emptyTitle?: string
  emptyHint?: string
}) {
  const nav = useNavigate()
  const { toast } = useStore()
  const [q, setQ] = useState('')
  const shown = useMemo(() => rows.filter((r) => !q || searchText(r).toLowerCase().includes(q.toLowerCase())), [rows, q, searchText])

  return (
    <div>
      <PageHeader
        crumbs={crumbs ?? [{ label: title }]}
        title={title}
        actions={
          <>
            {extraActions}
            {canExport && <button type="button" className="btn" onClick={() => toast('تم تصدير القائمة إلى Excel (محاكاة)')}><Download className="h-4 w-4" />تصدير</button>}
            <button type="button" className="btn" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button>
            {(newTo || onNew) && canNew && (
              <button type="button" className="btn btn-primary" onClick={() => (onNew ? onNew() : nav(newTo!))}><Plus className="h-4 w-4" />{newLabel}</button>
            )}
          </>
        }
      />
      {kpis && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="card px-4 py-3">
              <div className="text-xs text-gray-500">{k.label}</div>
              <div className="mt-1 break-all text-base font-bold tabular-nums text-gray-900 xl:text-lg">{k.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        {tabs}
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-64">
            <Search className="absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
            <input className="inp ps-8" placeholder="بحث في القائمة..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {filters}
          <span className="ms-auto text-xs text-gray-500">{loading ? '...' : `${shown.length} سجل`}</span>
        </div>
        {error ? <ErrorState message={error} onRetry={onRetry} /> : (
          <DataTable rows={shown} columns={columns} rowTo={rowTo} onRowClick={onRowClick} loading={loading} emptyTitle={emptyTitle} emptyHint={emptyHint} />
        )}
      </div>
    </div>
  )
}
