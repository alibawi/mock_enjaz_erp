import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from '../router'
import { EmptyBlock, LoadingSkeleton } from './states'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  num?: boolean
  /** Enables header sorting; return a comparable value. */
  sort?: (row: T) => string | number
  total?: (rows: T[]) => ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({
  rows, columns, rowTo, onRowClick, loading, emptyTitle, emptyHint, selected, onToggle, compact,
}: {
  rows: T[]
  columns: Column<T>[]
  rowTo?: (r: T) => string
  onRowClick?: (r: T) => void
  loading?: boolean
  emptyTitle?: string
  emptyHint?: string
  /** Optional row selection. */
  selected?: string[]
  onToggle?: (id: string) => void
  compact?: boolean
}) {
  const nav = useNavigate()
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key)
    if (!col?.sort || !sort) return rows
    return [...rows].sort((a, b) => {
      const x = col.sort!(a), y = col.sort!(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sort.dir
    })
  }, [rows, columns, sort])
  const hasTotals = columns.some((c) => c.total)
  if (loading) return <LoadingSkeleton cols={Math.min(columns.length, 6)} />

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {onToggle && <th className="w-8" />}
            {columns.map((c) => {
              const on = sort?.key === c.key
              return (
                <th key={c.key} className={`${c.num ? '!text-end' : ''} ${c.sort ? 'cursor-pointer select-none' : ''}`}
                  onClick={() => c.sort && setSort(on && sort!.dir === 1 ? { key: c.key, dir: -1 } : { key: c.key, dir: 1 })}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sort && (on ? (sort!.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 text-gray-300" />)}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={`${rowTo || onRowClick ? 'cursor-pointer' : ''} ${compact ? '[&>td]:py-1' : ''}`}
              onClick={() => (rowTo ? nav(rowTo(r)) : onRowClick?.(r))}>
              {onToggle && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected?.includes(r.id) ?? false} onChange={() => onToggle(r.id)} />
                </td>
              )}
              {columns.map((c) => <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className ?? ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {hasTotals && sorted.length > 0 && (
          <tfoot>
            <tr>
              {onToggle && <td />}
              {columns.map((c, i) => <td key={c.key} className={c.num ? 'num' : ''}>{i === 0 ? 'المجموع:' : c.total?.(sorted)}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
      {sorted.length === 0 && <EmptyBlock title={emptyTitle ?? 'لا توجد سجلات مطابقة'} hint={emptyHint} />}
    </div>
  )
}
