// Labor (spec S19, BR-M-25/26; plan §36.15 option (i)): HR attendance is the only pay source; maintenance hours are
// validation and variance only. Labor cost = hours × the technician's standard rate, report-only (no journal).
import { addAudit } from './store'
import type { DB, TimeEntry, WorkOrder } from './types'

export interface EntryRow extends TimeEntry { wo: WorkOrder }
export const allEntries = (d: DB): EntryRow[] => d.workOrders.flatMap((wo) => wo.timeEntries.map((t) => ({ ...t, wo })))
export const rateOf = (d: DB, techId: string) => d.technicians.find((t) => t.id === techId)?.standardRate ?? 0
export const costOf = (d: DB, t: TimeEntry) => t.hours * rateOf(d, t.technicianId)
export const STD_DAY = 8

/** Supervisor confirmation of selected lines (BR-M-25). Closed WOs are already final. */
export function confirmEntries(d: DB, ids: string[]): string | null {
  let n = 0
  for (const w of d.workOrders) {
    if (w.status === 'closed') continue
    for (const t of w.timeEntries) if (ids.includes(t.id) && !t.confirmedBy) { t.confirmedBy = d.userId; n++ }
  }
  if (!n) return 'لا توجد أسطر بانتظار التأكيد ضمن الاختيار'
  addAudit(d, 'labor', 'time', 'تأكيد ساعات الفنيين', `${n} سطر`)
  return null
}

export interface DayCheck { date: string; attended: number; logged: number; onLeave: boolean; issue?: string }
export interface Variance {
  technicianId: string; attended: number; attendedOvertime: number; logged: number; loggedOvertime: number; pending: number
  variance: number; utilization: number; cost: number; days: DayCheck[]; issues: number
}

/** Monthly comparison of WO hours with HR attendance, per technician; daily exceptions where logged hours exceed attendance. */
export function variance(d: DB, month: string, upTo: string): Variance[] {
  const entries = allEntries(d).filter((t) => t.date.startsWith(month) && t.date < upTo)
  return d.technicians.filter((t) => t.active).map((tech) => {
    const att = d.attendance.filter((a) => a.technicianId === tech.id && a.date.startsWith(month) && a.date < upTo)
    const mine = entries.filter((e) => e.technicianId === tech.id)
    const dates = [...new Set([...att.map((a) => a.date), ...mine.map((e) => e.date)])].sort()
    const days: DayCheck[] = dates.map((date) => {
      const attended = att.find((a) => a.date === date)?.hours ?? 0
      const logged = mine.filter((e) => e.date === date).reduce((s, e) => s + e.hours, 0)
      const onLeave = d.leaves.some((l) => l.technicianId === tech.id && l.from <= date && date <= l.to)
      const issue = logged > 0 && attended === 0 ? (onLeave ? 'ساعات على أمر عمل في يوم إجازة' : 'ساعات على أمر عمل بلا حضور مسجّل') : logged > attended ? `ساعات الأوامر (${logged}) أكثر من الحضور (${attended})` : undefined
      return { date, attended, logged, onLeave, issue }
    })
    const attended = att.reduce((s, a) => s + a.hours, 0)
    const logged = mine.reduce((s, e) => s + e.hours, 0)
    return {
      technicianId: tech.id, attended, attendedOvertime: att.reduce((s, a) => s + Math.max(0, a.hours - STD_DAY), 0),
      logged, loggedOvertime: mine.filter((e) => e.category === 'overtime').reduce((s, e) => s + e.hours, 0), pending: mine.filter((e) => !e.confirmedBy).reduce((s, e) => s + e.hours, 0),
      variance: logged - attended, utilization: attended ? logged / attended : 0, cost: mine.reduce((s, e) => s + costOf(d, e), 0),
      days, issues: days.filter((x) => x.issue).length,
    }
  })
}
