import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { KPICard } from '../../components/display'
import { FilterSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Async } from '../../components/states'
import { Card } from '../../components/ui'
import { daysTo, fmtDate, money, num } from '../../data/format'
import { effStatus, isOpen, kindLabel, penaltyOf, statusLabel, type EffStatus } from '../../data/obligations'
import { effItemStatus, financialSummary, toIQD } from '../../data/payments'
import { useStore } from '../../data/store'
import type { Obligation } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { StatusBadge, useObligationActions } from './ObligationsTab'

const columns: { key: EffStatus; tone: string }[] = [
  { key: 'Overdue', tone: 'border-red-300 bg-red-50' }, { key: 'Planned', tone: 'border-gray-200 bg-gray-50' }, { key: 'InProgress', tone: 'border-sky-200 bg-sky-50' },
  { key: 'Completed', tone: 'border-amber-200 bg-amber-50' }, { key: 'Accepted', tone: 'border-emerald-200 bg-emerald-50' }, { key: 'Rejected', tone: 'border-red-200 bg-red-50/50' },
]

/** O3 — cross-contract obligations board (kanban / list) with module KPIs. */
export default function ObligationsBoard() {
  const { db } = useStore()
  const act = useObligationActions()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [f, setF] = useState({ contract: '', kind: '', who: '' })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const api = useApi(() => {
    const kpiContracts = db.contracts.filter((c) => ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(c.status))
    const sums = kpiContracts.map((c) => ({ c, s: financialSummary(db, c) }))
    const open = db.obligations.filter(isOpen)
    return {
      open: open.length, overdue: open.filter((o) => effStatus(o) === 'Overdue').length,
      milestones: db.obligations.filter((o) => o.kind === 'Milestone' && isOpen(o) && daysTo(o.dueDate) >= 0 && daysTo(o.dueDate) <= 30).length,
      billingDue: db.paymentItems.filter((p) => effItemStatus(p) === 'Due' || (p.status === 'Planned' && daysTo(p.dueDate) <= 7)).length,
      invoiced: sums.reduce((a, x) => a + toIQD(db, x.s.invoicedValue, x.s.currency), 0),
      paid: sums.reduce((a, x) => a + toIQD(db, x.s.paidValue, x.s.currency), 0),
      penalties: db.obligations.reduce((a, o) => a + toIQD(db, penaltyOf(o), db.contracts.find((c) => c.id === o.contractId)?.currency ?? 'IQD'), 0),
    }
  })
  const rows = db.obligations.filter((o) => (!f.contract || o.contractId === f.contract) && (!f.kind || o.kind === f.kind) && (!f.who || o.responsibleEmployeeId === f.who))
  const contract = (o: Obligation) => db.contracts.find((c) => c.id === o.contractId)!
  const cols: Column<Obligation>[] = [
    { key: 't', label: 'الالتزام', render: (o) => <div><div className="font-medium">{o.title}</div><div className="text-[11px] text-gray-400">{kindLabel[o.kind]}</div></div> },
    { key: 'c', label: 'العقد', render: (o) => <Link className="text-navy" to={`/contracts/${o.contractId}`} dir="ltr">{contract(o).number}</Link> },
    { key: 'd', label: 'الاستحقاق', sort: (o) => o.dueDate, render: (o) => fmtDate(o.dueDate) },
    { key: 'w', label: 'المسؤول', render: (o) => db.employees.find((e) => e.id === o.responsibleEmployeeId)?.name ?? '—' },
    { key: 's', label: 'الحالة', render: (o) => <StatusBadge o={o} /> },
    { key: 'p', label: 'غرامة (عرض)', num: true, render: (o) => { const p = penaltyOf(o); return p ? money(p, contract(o).currency) : '—' } },
  ]
  const opt = <T extends { id: string }>(a: T[], l: (x: T) => string) => a.map((x) => ({ value: x.id, label: l(x) }))
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الالتزامات والمالية' }, { label: 'الالتزامات' }]} title="لوحة الالتزامات"
        actions={<div className="flex rounded-md border border-line bg-white text-xs">
          <button type="button" onClick={() => setView('kanban')} className={`flex items-center gap-1 px-3 py-1.5 ${view === 'kanban' ? 'bg-navy text-white' : ''}`}><LayoutGrid className="h-4 w-4" />لوحة</button>
          <button type="button" onClick={() => setView('list')} className={`flex items-center gap-1 px-3 py-1.5 ${view === 'list' ? 'bg-navy text-white' : ''}`}><List className="h-4 w-4" />قائمة</button></div>} />
      <Async state={api}>
        {(k) => (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <KPICard label="التزامات مفتوحة" value={k.open} /><KPICard label="متأخرة" value={k.overdue} tone={k.overdue ? 'red' : 'gray'} />
            <KPICard label="مراحل خلال 30 يوماً" value={k.milestones} tone="blue" /><KPICard label="فوترة مستحقة (≤ 7 أيام)" value={k.billingDue} tone={k.billingDue ? 'amber' : 'gray'} to="/payments" />
            <KPICard label="مفوتر (د.ع)" value={num(k.invoiced)} /><KPICard label="مدفوع (د.ع)" value={num(k.paid)} tone="green" hint={`متبقٍ للتحصيل ${num(Math.max(0, k.invoiced - k.paid))}`} />
            <KPICard label="غرامات مستحقة (عرض)" value={num(k.penalties)} tone={k.penalties ? 'red' : 'gray'} />
          </div>)}
      </Async>
      <Card className="mb-4"><div className="flex flex-wrap gap-2">
        <FilterSelect label="العقد" value={f.contract} onChange={set('contract')} options={opt(db.contracts.filter((c) => db.obligations.some((o) => o.contractId === c.id)), (c) => c.number)} />
        <FilterSelect label="النوع" value={f.kind} onChange={set('kind')} options={Object.entries(kindLabel).map(([value, label]) => ({ value, label }))} />
        <FilterSelect label="المسؤول" value={f.who} onChange={set('who')} options={opt(db.employees, (e) => e.name)} />
        <span className="ms-auto self-center text-xs text-gray-500">{rows.length} التزام</span></div></Card>
      {view === 'list' ? <Card pad={false}><DataTable rows={rows} columns={cols} rowTo={(o) => `/contracts/${o.contractId}`} emptyTitle="لا التزامات" /></Card> : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {columns.map((col) => {
            const list = rows.filter((o) => effStatus(o) === col.key).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            return (
              <div key={col.key} className={`rounded-md border ${col.tone} p-2`}>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700">{statusLabel[col.key]}<span className="rounded-full bg-white px-1.5 text-[11px] text-gray-500">{list.length}</span></div>
                <div className="space-y-2">
                  {list.map((o) => (
                    <div key={o.id} className="rounded-md border border-line bg-white p-2 text-xs shadow-sm">
                      <Link to={`/contracts/${o.contractId}`} className="block font-medium text-gray-900 hover:text-navy">{o.title}</Link>
                      <div className="mt-0.5 text-gray-500" dir="ltr">{contract(o).number}</div>
                      <div className="mt-1 flex items-center justify-between text-gray-500"><span>{fmtDate(o.dueDate)}</span>{penaltyOf(o) > 0 && <span className="text-red-600">{money(penaltyOf(o), contract(o).currency)}</span>}</div>
                      <div className="mt-1 flex gap-1">
                        {['Planned', 'InProgress', 'Rejected'].includes(o.status) && act.mine(o) && <button type="button" className="rounded border border-line px-1.5 py-0.5 hover:bg-gray-50" onClick={() => act.complete(o)}>إنجاز</button>}
                        {o.status === 'Completed' && act.canAccept && <button type="button" className="rounded border border-line px-1.5 py-0.5 hover:bg-gray-50" onClick={() => act.accept(o)}>قبول</button>}
                      </div>
                    </div>))}
                  {list.length === 0 && <div className="py-4 text-center text-[11px] text-gray-400">لا شيء</div>}
                </div>
              </div>)
          })}
        </div>)}
    </div>
  )
}
