// BR-C-14: alerts are computed from contracts, settings and the demo date; one alert per (contract, rule).
import { today } from './asof'
import { daysTo, fmtDate } from './format'
import { canSee, graceEnd, noticeDeadline, typeOf } from './lifecycle'
import { escalationDays, escalationLabel, isOpen, effStatus } from './obligations'
import { consumed, fmtStamp, levelOf } from './service'
import { daysSetting } from './settings'
import type { Contract, DB } from './types'

export type AlertRule = 'Expiry' | 'NoticeDeadline' | 'Expired' | 'ApprovalPending' | 'SignatureMissing' | 'Exceeded' | 'ObligationDue' | 'GuaranteeExpiry' | 'SlaBreach' | 'ServiceLimit'
export interface Alert {
  key: string; contractId: string; contractNumber: string; rule: AlertRule; severity: 'info' | 'warn' | 'danger'; text: string; dueDate?: string; recipient: 'owner+managers'
}
export const ruleLabel: Record<AlertRule, string> = {
  Expiry: 'قرب الانتهاء', NoticeDeadline: 'مهلة الإشعار', Expired: 'عقد منتهٍ', ApprovalPending: 'اعتماد معلّق', SignatureMissing: 'توقيع ناقص', Exceeded: 'تجاوز الالتزام', ObligationDue: 'استحقاق التزام', GuaranteeExpiry: 'انتهاء ضمان', SlaBreach: 'خرق مستوى الخدمة', ServiceLimit: 'تجاوز الساعات المشمولة',
}

const thresholds = (db: DB, c: Contract, which: 'expiry' | 'notice') => {
  if (which === 'notice') return daysSetting(db, 'Reminder.NoticeDays')
  const raw = c.reminderDaysOverride ?? typeOf(db, c).reminderDaysDefault
  const list = raw ? raw.split(',').map((x) => Number(x.trim())).filter((n) => n > 0).sort((a, b) => b - a) : []
  return list.length ? list : daysSetting(db, 'Reminder.Days')
}
const lastMove = (db: DB, c: Contract) => db.history.filter((h) => h.contractId === c.id).map((h) => h.at.slice(0, 10)).sort().pop() ?? c.createdAt.slice(0, 10)

export function computeAlerts(db: DB): Alert[] {
  const out: Alert[] = []
  const push = (c: Contract, rule: AlertRule, severity: Alert['severity'], text: string, dueDate?: string, suffix = '') =>
    out.push({ key: `${c.id}|${rule}${suffix}`, contractId: c.id, contractNumber: c.number, rule, severity, text, dueDate, recipient: 'owner+managers' })

  db.contracts.forEach((c) => {
    if ((c.status === 'Active' || c.status === 'OnHold') && c.endDate) {
      const left = daysTo(c.endDate)
      const hit = thresholds(db, c, 'expiry').filter((t) => left >= 0 && left <= t).sort((a, b) => a - b)[0]
      if (hit !== undefined) push(c, 'Expiry', left <= 7 ? 'danger' : left <= 15 ? 'warn' : 'info', `ينتهي العقد خلال ${left} يوماً (${fmtDate(c.endDate)})`, c.endDate, `|${hit}`)
      const nd = noticeDeadline(c)
      if (nd && c.renewalPolicy !== 'None') {
        const nl = daysTo(nd)
        const nh = thresholds(db, c, 'notice').filter((t) => nl >= 0 && nl <= t).sort((a, b) => a - b)[0]
        if (nh !== undefined) push(c, 'NoticeDeadline', nl <= 1 ? 'danger' : 'warn', `آخر موعد للإشعار بعدم التجديد بعد ${nl} يوماً (${fmtDate(nd)})`, nd, `|${nh}`)
        else if (nl < 0 && left >= 0) push(c, 'NoticeDeadline', 'danger', `فات موعد الإشعار (${fmtDate(nd)}) والعقد ما زال سارياً`, nd, '|past')
      }
    }
    if (c.status === 'Expired') {
      const ge = graceEnd(db, c)
      const rem = ge ? daysTo(ge) : 0
      push(c, 'Expired', 'danger', rem >= 0 ? `انتهى العقد ويمكن تجديده خلال ${rem} يوماً (مدة السماح)` : 'انتهى العقد وخرج عن مدة السماح؛ التجديد بعقد جديد فقط', ge)
    }
    if (c.status === 'PendingApproval' && daysTo(today(), lastMove(db, c)) >= Number(db.settings['Approval.ReminderDays'])) {
      push(c, 'ApprovalPending', 'warn', `اعتماد العقد معلّق منذ ${daysTo(today(), lastMove(db, c))} يوماً`)
    }
    if (c.status === 'PendingSignature' && daysTo(today(), lastMove(db, c)) >= 3) {
      push(c, 'SignatureMissing', 'warn', `العقد بانتظار التوقيع منذ ${daysTo(today(), lastMove(db, c))} يوماً`)
    }
    const over = db.ledger.filter((e) => e.contractId === c.id && e.reason === 'Exceeded').length
    if (over) push(c, 'Exceeded', 'danger', `${over} قيد تجاوز في دفتر التنفيذ — مستندات حُفظت رغم تجاوز الحد، يلزم المراجعة`)
  })
  // BR-O-01: escalation at due -3d, 0, +1d, +7d (the latest point reached); BR-O-09: guarantees at 30 and 7 days
  db.obligations.filter((o) => isOpen(o) && o.status !== 'Completed').forEach((o) => {
    const c = db.contracts.find((x) => x.id === o.contractId)
    if (!c || ['Cancelled', 'Closed'].includes(c.status)) return
    const from = daysTo(today(), o.dueDate)
    const hit = [...escalationDays].reverse().find((t) => from >= t)
    if (hit === undefined || from > 14) return
    push(c, 'ObligationDue', effStatus(o) === 'Overdue' ? 'danger' : 'warn', `${o.title}: ${escalationLabel(from)} (${fmtDate(o.dueDate)})`, o.dueDate, `|${o.id}|${hit}`)
  })
  db.guarantees.filter((g) => g.status === 'Active').forEach((g) => {
    const c = db.contracts.find((x) => x.id === g.contractId)
    const left = daysTo(g.expiryDate)
    const hit = [30, 7].filter((t) => left >= 0 && left <= t).sort((a, b) => a - b)[0]
    if (c && hit !== undefined) push(c, 'GuaranteeExpiry', left <= 7 ? 'danger' : 'warn', `ضمان ${g.issuer} ينتهي خلال ${left} يوماً (${fmtDate(g.expiryDate)})`, g.expiryDate, `|${g.id}|${hit}`)
  })
  // BR-S-06: SLA breaches of the last 30 days (one alert per call); BR-S-04: included hours/visits exceeded
  db.slaEvents.filter((e) => e.kind.endsWith('Breached') && daysTo(today(), e.at.slice(0, 10)) <= 30).forEach((e) => {
    const c = db.contracts.find((x) => x.id === e.contractId), call = db.serviceCalls.find((x) => x.id === e.callId)
    if (c && call) push(c, 'SlaBreach', 'danger', `البلاغ ${call.no}: ${e.kind === 'ResponseBreached' ? 'تجاوز مهلة الاستجابة' : 'تجاوز مهلة الحل'} (${fmtStamp(e.at)})`, e.at.slice(0, 10), `|${call.id}|${e.kind}`)
  })
  db.contracts.filter((c) => c.profile === 'Service' && ['Active', 'OnHold'].includes(c.status)).forEach((c) => {
    const l = levelOf(db, c.id), u = consumed(db, c.id)
    if (l && ((l.includedHours !== undefined && u.hours > l.includedHours) || (l.includedVisits !== undefined && u.visits > l.includedVisits))) push(c, 'ServiceLimit', 'warn', `تجاوز الساعات/الزيارات المشمولة (${u.hours} س، ${u.visits} زيارة) — البلاغات القادمة قابلة للفوترة`)
  })
  const sev = { danger: 0, warn: 1, info: 2 }
  return out.sort((a, b) => sev[a.severity] - sev[b.severity] || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
}

/** Alerts shown to the current user: their own contracts, or all for managers and admins (spec BR-C-14). */
export const alertsForUser = (db: DB) =>
  computeAlerts(db).filter((a) => {
    const c = db.contracts.find((x) => x.id === a.contractId)!
    if (!canSee(db, c)) return false
    return db.role === 'admin' || db.role === 'manager' || c.ownerUserId === db.userId
  })
