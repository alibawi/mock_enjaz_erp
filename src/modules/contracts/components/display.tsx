import { Check, ChevronLeft, Circle, Clock, X } from 'lucide-react'
import { Link } from '../router'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Tone } from '../data/format'

const toneText: Record<Tone, string> = { gray: 'text-gray-900', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', blue: 'text-sky-700' }

export function KPICard({ label, value, hint, tone = 'gray', icon: Icon, to }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: LucideIcon; to?: string
}) {
  const body = (
    <div className="card h-full px-4 py-3 transition hover:border-navy/40">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>{Icon && <Icon className="h-4 w-4 text-gray-300" />}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${toneText[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export interface TimelineItem { id: string; at: string; title: string; detail?: string; by?: string; tone?: Tone }
const dot: Record<Tone, string> = { gray: 'bg-gray-400', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-sky-500' }
export function Timeline({ items, empty = 'لا توجد أحداث' }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <div className="py-8 text-center text-sm text-gray-400">{empty}</div>
  return (
    <ol className="relative space-y-4 pe-4 ps-1">
      {items.map((i) => (
        <li key={i.id} className="relative flex gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[i.tone ?? 'gray']}`} />
          <div className="min-w-0 flex-1 border-b border-gray-100 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">{i.title}</span>
              <span className="text-[11px] text-gray-400" dir="ltr">{i.at.replace('T', ' ')}</span>
            </div>
            {i.detail && <div className="mt-0.5 text-xs text-gray-600">{i.detail}</div>}
            {i.by && <div className="mt-0.5 text-[11px] text-gray-400">{i.by}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Approval stage timeline (module 2 W1) — horizontal stepper with per-stage status. */
export interface Stage { no: number; label: string; who: string; status: 'waiting' | 'open' | 'approved' | 'rejected'; comment?: string; at?: string; onBehalfOf?: string }
export function StageTimeline({ stages }: { stages: Stage[] }) {
  const icon = { waiting: Circle, open: Clock, approved: Check, rejected: X } as const
  const cls = { waiting: 'border-gray-200 text-gray-300', open: 'border-amber-400 bg-amber-50 text-amber-600', approved: 'border-emerald-500 bg-emerald-50 text-emerald-600', rejected: 'border-red-500 bg-red-50 text-red-600' } as const
  return (
    <ol className="space-y-3">
      {stages.map((s) => {
        const I = icon[s.status]
        return (
          <li key={s.no} className="flex gap-3">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${cls[s.status]}`}><I className="h-3.5 w-3.5" /></span>
            <div className="flex-1 border-b border-gray-100 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.no}. {s.label}</span>
                <span className="text-[11px] text-gray-400">{s.at ? s.at.replace('T', ' ') : ''}</span>
              </div>
              <div className="text-xs text-gray-500">{s.who}{s.onBehalfOf ? ` — بالنيابة عن ${s.onBehalfOf}` : ''}</div>
              {s.comment && <div className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">{s.comment}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Commitment bar: segments are cumulative values against a committed total (module 3 A1). */
export function BalanceBar({ committed, released, fulfilled, invoiced, format }: {
  committed: number; released: number; fulfilled: number; invoiced: number; format?: (n: number) => string
}) {
  const f = format ?? ((n: number) => n.toLocaleString('en-US'))
  const w = (v: number) => `${committed > 0 ? Math.min(100, (v / committed) * 100) : 0}%`
  const used = committed > 0 ? (released / committed) * 100 : 0
  return (
    <div className="min-w-[160px]">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-100" title={`ملتزم ${f(committed)} — محجوز ${f(released)} — منفّذ ${f(fulfilled)} — مفوتر ${f(invoiced)}`}>
        <div className="absolute inset-y-0 start-0 bg-sky-200" style={{ width: w(released) }} />
        <div className="absolute inset-y-0 start-0 bg-sky-500" style={{ width: w(fulfilled) }} />
        <div className="absolute inset-y-0 start-0 bg-navy" style={{ width: w(invoiced) }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-gray-500">
        <span>{used.toFixed(0)}% محجوز</span><span>متبقٍ {f(Math.max(0, committed - released))}</span>
      </div>
    </div>
  )
}

export function ModuleScreensGrid({ screens }: { screens: { to: string; title: string; hint: string; icon: LucideIcon; soon?: boolean }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {screens.map(({ to, title, hint, icon: Icon, soon }) => {
        const inner = (
          <div className={`card flex h-full items-start gap-3 p-4 ${soon ? 'opacity-60' : 'transition hover:border-navy/40'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-navy-50 text-navy"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">{title}{soon && <span className="rounded bg-gray-100 px-1.5 text-[10px] font-normal text-gray-500">قريباً</span>}</div>
              <div className="mt-0.5 text-xs text-gray-500">{hint}</div>
            </div>
            {!soon && <ChevronLeft className="h-4 w-4 text-gray-300" />}
          </div>
        )
        return soon ? <div key={to}>{inner}</div> : <Link key={to} to={to}>{inner}</Link>
      })}
    </div>
  )
}
