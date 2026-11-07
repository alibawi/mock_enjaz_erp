// Simulated HR attendance (area 8) for the active technicians, 1 Aug → 6 Nov (today's attendance is imported after the day
// ends). Saturday–Thursday 8 hours, Friday a 5-hour shift, some overtime evenings, nothing on leave days. Two seeded exceptions:
// Ahmed has WO hours on 6 Nov without an attendance record; Hassan left after one hour on 12 Oct but logged two on a WO.
import type { AttendanceDay } from '../types'
import { technicians } from './master'
import { leaves } from './schedule'

const days: string[] = []
for (let t = Date.UTC(2026, 7, 1); t <= Date.UTC(2026, 10, 6); t += 86_400_000) {
  const d = new Date(t)
  days.push(d.toISOString().slice(0, 10))
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export const attendance: AttendanceDay[] = []
for (const tech of technicians.filter((t) => t.active)) {
  for (const date of days) {
    if (leaves.some((l) => l.technicianId === tech.id && l.from <= date && date <= l.to)) continue
    if (tech.id === 't-ahmed' && date === '2026-11-06') continue // missing punch — shows as an exception
    const h = hash(tech.id + date)
    const friday = new Date(`${date}T00:00:00Z`).getUTCDay() === 5
    let hours = friday ? 5 : 8 // Friday: short shift for urgent jobs
    if (h % 9 === 0) hours += 2 // overtime evening (paid by Payroll from attendance only — §36.15 option i)
    if (h % 23 === 0) hours = 4 // half day
    if (tech.id === 't-hassan' && date === '2026-10-12') hours = 1
    attendance.push({ technicianId: tech.id, date, hours })
  }
}
