import { useState } from 'react'
import { Link } from '../../router'
import { KPICard } from '../../components/display'
import { PageHeader } from '../../components/Layout'
import { Card, Tabs } from '../../components/ui'
import { months } from '../../data/format'
import { addMonths } from '../../data/asof'
import { useStore } from '../../data/store'

/** S5 — SLA report: met / breached per contract and per customer, plus a six-month trend. */
export default function SlaReport() {
  const { db } = useStore()
  const [tab, setTab] = useState<'contract' | 'customer'>('contract')
  const ev = db.slaEvents
  const met = (xs: typeof ev) => xs.filter((e) => e.kind.endsWith('Met')).length
  const group = (key: (e: (typeof ev)[number]) => string) => {
    const m = new Map<string, typeof ev>()
    ev.forEach((e) => m.set(key(e), [...(m.get(key(e)) ?? []), e]))
    return [...m.entries()].map(([k, xs]) => ({ k, total: xs.length, met: met(xs), breached: xs.length - met(xs), calls: new Set(xs.map((x) => x.callId)).size }))
  }
  const byContract = group((e) => e.contractId), byCustomer = group((e) => db.serviceCalls.find((c) => c.id === e.callId)?.customerId ?? '')
  const rows = tab === 'contract' ? byContract : byCustomer
  const label = (k: string) => (tab === 'contract' ? db.contracts.find((c) => c.id === k)?.number : db.partners.find((p) => p.id === k)?.name) ?? k
  // trend: events grouped by month of the call
  const start = addMonths(`${db.asOf.slice(0, 7)}-01`, -5)
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(start, i).slice(0, 7)
    const xs = ev.filter((e) => e.at.startsWith(m))
    return { m, met: met(xs), breached: xs.length - met(xs) }
  })
  const max = Math.max(1, ...trend.map((t) => t.met + t.breached))
  const pct = ev.length ? (met(ev) / ev.length) * 100 : undefined
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الخدمة', to: '/service' }, { label: 'تقرير مستوى الخدمة' }]} title="تقرير مستوى الخدمة (SLA)" actions={<Link className="btn" to="/service/calls">محاكي البلاغات</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="قياسات SLA" value={ev.length} /><KPICard label="ضمن المهلة" value={pct === undefined ? '—' : `${pct.toFixed(0)}%`} tone={pct !== undefined && pct < 80 ? 'red' : 'green'} />
        <KPICard label="خروقات" value={ev.length - met(ev)} tone={ev.length - met(ev) ? 'red' : 'gray'} /><KPICard label="بلاغات غير مغطّاة" value={db.serviceCalls.filter((c) => !c.contractId).length} tone="amber" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="الاتجاه الشهري" className="xl:col-span-1">
          <div className="flex h-44 items-end gap-3">
            {trend.map((t) => (
              <div key={t.m} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-36 w-full flex-col justify-end"><div className="bg-red-400" style={{ height: `${(t.breached / max) * 100}%` }} title={`خروقات ${t.breached}`} /><div className="bg-emerald-500" style={{ height: `${(t.met / max) * 100}%` }} title={`ضمن المهلة ${t.met}`} /></div>
                <div className="text-[10px] text-gray-500">{months[Number(t.m.slice(5)) - 1]}</div>
              </div>))}
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-gray-500"><span className="flex items-center gap-1"><i className="h-2 w-2 bg-emerald-500" />ضمن المهلة</span><span className="flex items-center gap-1"><i className="h-2 w-2 bg-red-400" />خرق</span></div>
        </Card>
        <Card className="xl:col-span-2" title="الأداء" pad={false} actions={<span />}>
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'contract', label: 'حسب العقد' }, { id: 'customer', label: 'حسب العميل' }]} />
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">{tab === 'contract' ? 'العقد' : 'العميل'}</th><th className="text-start">بلاغات</th><th className="text-start">ضمن</th><th className="text-start">خرق</th><th className="text-start">النسبة</th></tr></thead>
            <tbody>
              {rows.map((r) => { const p = r.total ? (r.met / r.total) * 100 : 0; return (
                <tr key={r.k} className="border-b border-gray-100"><td className="px-3 py-2">{tab === 'contract' ? <Link className="text-navy" to={`/contracts/${r.k}`} dir="ltr">{label(r.k)}</Link> : label(r.k)}</td><td>{r.calls}</td><td className="text-emerald-700">{r.met}</td><td className={r.breached ? 'font-semibold text-red-600' : ''}>{r.breached}</td>
                  <td><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${p < 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${p}%` }} /></div>{p.toFixed(0)}%</div></td></tr>) })}
              {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">لا قياسات</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
