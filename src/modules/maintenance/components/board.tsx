import type { ReactNode } from 'react'
import { dayName, fmtDate, iqd, type Tone } from '../data/format'
import type { JournalLine } from '../data/types'

const toneCls: Record<Tone, string> = {
  gray: 'border-gray-300 bg-gray-50 text-gray-700',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  red: 'border-red-300 bg-red-50 text-red-800',
  blue: 'border-sky-300 bg-sky-50 text-sky-800',
}

export interface BoardRow { id: string; label: string; hint?: string; group?: string }
export interface BoardItem { id: string; rowId: string; date: string; title: string; subtitle?: string; tone: Tone }

/**
 * Weekly board: rows (technicians, bays) × 7 days. Click an empty cell to book, an item to act on it.
 * `blocked(rowId, date)` returns a reason (e.g. leave) that shades the cell and disables booking.
 */
export function WeekBoard({ rows, days, items, onEmpty, onItem, blocked, isToday }: {
  rows: BoardRow[]; days: string[]; items: BoardItem[]
  onEmpty?: (rowId: string, date: string) => void; onItem?: (id: string) => void
  blocked?: (rowId: string, date: string) => string | null; isToday?: (date: string) => boolean
}) {
  let lastGroup: string | undefined
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="w-44 border-b border-line bg-gray-50 px-2 py-2 text-start font-semibold text-gray-600">المورد</th>
            {days.map((d) => (
              <th key={d} className={`border-b border-s border-line px-2 py-2 text-start font-semibold ${isToday?.(d) ? 'bg-navy-50 text-navy' : 'bg-gray-50 text-gray-600'}`}>
                <div>{dayName(d)}</div><div className="text-[11px] font-normal text-gray-500">{fmtDate(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const header = r.group && r.group !== lastGroup
            lastGroup = r.group
            return [
              header ? (
                <tr key={`g-${r.group}`}><td colSpan={days.length + 1} className="bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500">{r.group}</td></tr>
              ) : null,
              <tr key={r.id} className="align-top">
                <td className="border-b border-line px-2 py-2">
                  <div className="font-semibold text-gray-800">{r.label}</div>
                  {r.hint && <div className="text-[11px] text-gray-500">{r.hint}</div>}
                </td>
                {days.map((d) => {
                  const reason = blocked?.(r.id, d) ?? null
                  const cellItems = items.filter((i) => i.rowId === r.id && i.date === d)
                  return (
                    <td key={d} className={`h-16 border-b border-s border-line p-1 ${reason ? 'bg-[repeating-linear-gradient(135deg,#f3f4f6,#f3f4f6_6px,#fff_6px,#fff_12px)]' : ''}`}>
                      <div className="flex h-full flex-col gap-1">
                        {cellItems.map((i) => (
                          <button key={i.id} type="button" onClick={() => onItem?.(i.id)}
                            className={`w-full rounded border px-1.5 py-1 text-start leading-tight hover:shadow-sm ${toneCls[i.tone]}`}>
                            <div className="truncate font-semibold">{i.title}</div>
                            {i.subtitle && <div className="truncate text-[11px] opacity-80">{i.subtitle}</div>}
                          </button>
                        ))}
                        {reason ? (
                          <div className="mt-auto text-center text-[10px] text-gray-500">{reason}</div>
                        ) : onEmpty ? (
                          <button type="button" onClick={() => onEmpty(r.id, d)} className="no-print mt-auto rounded py-0.5 text-[11px] text-gray-300 hover:bg-navy-50 hover:text-navy" title="حجز">+</button>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
              </tr>,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Simulated journal entry (debit/credit), shown on goods issues, invoices and receipts. */
export function JournalPreview({ lines, title = 'القيد المحاسبي (مُحاكى)' }: { lines: JournalLine[]; title?: string }) {
  const dr = lines.reduce((s, l) => s + l.debit, 0)
  const cr = lines.reduce((s, l) => s + l.credit, 0)
  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-line bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
        <span>{title}</span><span className="rounded bg-amber-50 px-1.5 text-[10px] font-normal text-amber-700">مُحاكى — في النظام الحقيقي: وحدة المالية</span>
      </div>
      <table className="w-full text-[12px]">
        <thead><tr className="text-gray-500"><th className="px-3 py-1 text-start font-normal">الحساب</th><th className="px-3 py-1 text-end font-normal">مدين</th><th className="px-3 py-1 text-end font-normal">دائن</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-3 py-1"><span className="font-mono text-gray-500" dir="ltr">{l.account}</span> {l.accountName}</td>
              <td className="px-3 py-1 text-end tabular-nums">{l.debit ? iqd(l.debit) : ''}</td>
              <td className="px-3 py-1 text-end tabular-nums">{l.credit ? iqd(l.credit) : ''}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-gray-50 font-semibold">
            <td className="px-3 py-1">المجموع</td><td className="px-3 py-1 text-end tabular-nums">{iqd(dr)}</td><td className="px-3 py-1 text-end tabular-nums">{iqd(cr)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** A4 print frame (RTL) for receipts, estimates, job cards and route sheets; uses the shared print CSS (.print-sheet in index.css). */
export function PrintSheet({ title, number, date, children, footer }: {
  title: string; number?: string; date?: string; children: ReactNode; footer?: ReactNode
}) {
  return (
    <div className="print-sheet mx-auto max-w-[794px] bg-white p-8 text-[13px] text-gray-900 shadow-sm print:shadow-none">
      <div className="mb-5 flex items-start justify-between border-b-2 border-navy pb-3">
        <div>
          <div className="text-lg font-bold text-navy">شركة إنجاز — مركز الصيانة</div>
          <div className="text-[11px] text-gray-500">بغداد — الدورة، حي الميكانيك · 0770 500 1200</div>
        </div>
        <div className="text-end">
          <div className="text-base font-bold">{title}</div>
          {number && <div className="font-mono text-[12px]" dir="ltr">{number}</div>}
          {date && <div className="text-[11px] text-gray-500">{fmtDate(date)}</div>}
        </div>
      </div>
      {children}
      {footer && <div className="mt-8 border-t border-line pt-3">{footer}</div>}
    </div>
  )
}
