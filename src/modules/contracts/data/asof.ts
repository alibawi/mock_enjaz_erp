// Demo "today": business logic must use today() so expiry, reminders and overdue checks are testable (CLAUDE.md).
let current = '2026-10-30'

export const DEFAULT_TODAY = '2026-10-30'
export const setToday = (d: string) => { current = d }
export const today = () => current

const MS = 86_400_000
const parse = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day) }
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export const addDays = (d: string, n: number) => iso(parse(d) + n * MS)
export const diffDays = (a: string, b: string) => Math.round((parse(a) - parse(b)) / MS) // a - b
export const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  return iso(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last)))
}
/** True when d is on or before today. */
export const isPast = (d: string) => d <= current
