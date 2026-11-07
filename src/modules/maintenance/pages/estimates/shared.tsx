import type { Stage } from '../../components/display'
import { currentRound } from '../../data/estimate'
import { roleLabel } from '../../data/permissions'
import type { DB, Estimate } from '../../data/types'

/** Days between two "YYYY-MM-DDTHH:mm" stamps (fractional). */
export const daysBetween = (a: string, b: string) => (Date.parse(b.replace('T', ' ')) - Date.parse(a.replace('T', ' '))) / 86_400_000

export const channelLabel = { inPerson: 'حضوري', phone: 'هاتف', whatsapp: 'واتساب', email: 'بريد إلكتروني' } as const

/** The current approval round as stepper stages (rule 2 levels, decisions and comments). */
export function stagesOf(db: DB, e: Estimate): Stage[] {
  const name = (u?: string) => (u === 'system' ? 'النظام' : db.users.find((x) => x.id === u)?.name)
  return currentRound(db, e).map((a) => ({
    no: a.level || 1,
    label: a.level === 0 ? 'اعتماد تلقائي — تحت حد الاعتماد' : `اعتماد ${a.roles.map((r) => roleLabel[r]).join(' / ')}`,
    who: a.decidedBy ? `${name(a.decidedBy)}` : a.status === 'pending' ? 'بانتظار القرار' : a.status === 'withdrawn' ? 'سُحب' : 'لم يصل بعد',
    status: a.status === 'approved' || a.status === 'notRequired' ? 'approved' : a.status === 'rejected' ? 'rejected' : a.status === 'pending' ? 'open' : 'waiting',
    comment: a.comment,
    at: a.decidedAt ?? (a.status === 'pending' ? a.submittedAt : undefined),
  }))
}
