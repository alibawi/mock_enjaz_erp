import { AlertTriangle, BellRing, CheckCheck, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { PageHeader } from '../../components/Layout'
import { Async, EmptyBlock } from '../../components/states'
import { Badge, Tabs } from '../../components/ui'
import { alertsForUser, ruleLabel, type Alert, type AlertRule } from '../../data/alerts'
import { fmtDate } from '../../data/format'
import { useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'

const sevTone = { danger: 'red', warn: 'amber', info: 'blue' } as const
const sevIcon = { danger: AlertTriangle, warn: BellRing, info: Info } as const

/** C5 — alerts center driven by the demo date and reminder settings (BR-C-14). */
export default function AlertsCenter() {
  const { db, run } = useStore()
  const [tab, setTab] = useState<'all' | AlertRule>('all')
  const api = useApi(() => alertsForUser(db))
  const seen = new Set(db.alertsSeen)
  const mark = (keys: string[]) => run((d) => { d.alertsSeen = Array.from(new Set([...d.alertsSeen, ...keys])) })
  return (
    <div>
      <PageHeader crumbs={[{ label: 'التنبيهات' }]} title="التنبيهات"
        actions={<button type="button" className="btn" onClick={() => mark((api.data ?? []).map((a) => a.key))}><CheckCheck className="h-4 w-4" />تعليم الكل كمقروء</button>} />
      <Async state={api}>
        {(all) => {
          const rows = all.filter((a) => tab === 'all' || a.rule === tab)
          const count = (r: AlertRule) => all.filter((a) => a.rule === r).length
          const tabs = [{ id: 'all' as const, label: 'الكل', count: all.length }, ...(Object.keys(ruleLabel) as AlertRule[]).map((r) => ({ id: r, label: ruleLabel[r], count: count(r) }))]
          return (
            <div className="card">
              <Tabs tabs={tabs} active={tab} onChange={setTab} />
              {rows.length === 0 ? <EmptyBlock title="لا تنبيهات" hint="قدّم اليوم التجريبي من الشريط العلوي لترى تنبيهات الانتهاء والإشعار." /> : (
                <ul className="divide-y divide-gray-100">
                  {rows.map((a: Alert) => {
                    const I = sevIcon[a.severity]
                    const read = seen.has(a.key)
                    return (
                      <li key={a.key} className={`flex items-start gap-3 px-4 py-3 ${read ? 'opacity-60' : ''}`}>
                        <I className={`mt-0.5 h-5 w-5 shrink-0 ${a.severity === 'danger' ? 'text-red-500' : a.severity === 'warn' ? 'text-amber-500' : 'text-sky-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">{a.text}<Badge tone={sevTone[a.severity]}>{ruleLabel[a.rule]}</Badge></div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            <Link className="text-navy underline" to={`/contracts/${a.contractId}`} dir="ltr">{a.contractNumber}</Link>
                            {a.dueDate && <span className="ms-2">الاستحقاق: {fmtDate(a.dueDate)}</span>}
                          </div>
                        </div>
                        {!read && <button type="button" className="btn" onClick={() => mark([a.key])}>مقروء</button>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        }}
      </Async>
    </div>
  )
}
