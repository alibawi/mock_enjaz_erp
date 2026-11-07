// Demo "today" (project brief: 2026-11-07). Business logic must use today(), never new Date(), so expiry,
// overdue and rework-window checks stay reproducible.
export const DEFAULT_TODAY = '2026-11-07'
let current = DEFAULT_TODAY

export const setToday = (d: string) => { current = d }
export const today = () => current

const MS = 86_400_000
const parse = (d: string) => { const [y, m, day] = d.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, day) }
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export const addDays = (d: string, n: number) => iso(parse(d) + n * MS)
/** a - b in days */
export const diffDays = (a: string, b: string) => Math.round((parse(a) - parse(b)) / MS)
export const isPast = (d: string) => d.slice(0, 10) < current
/** Start of the Iraqi working week (Saturday) for the schedule board; weekDays gives Saturday–Friday. */
export const weekStart = (d: string) => {
  const dow = new Date(parse(d)).getUTCDay() // 0 Sunday … 6 Saturday
  return addDays(d, -((dow + 1) % 7)) // back to Saturday
}
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i))
