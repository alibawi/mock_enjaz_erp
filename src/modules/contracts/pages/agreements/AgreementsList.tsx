import { useMemo, useState } from 'react'
import { ConfidentialityBadge, ContractStatusBadge } from '../../components/contract'
import { BalanceBar } from '../../components/display'
import { FilterSelect } from '../../components/inputs'
import { ListView, type Column } from '../../components/ListView'
import { Tabs } from '../../components/ui'
import { today } from '../../data/asof'
import { statusLabel } from '../../data/contractMeta'
import { convertAmount } from '../../data/currency'
import { daysTo, fmtDate, money, num } from '../../data/format'
import { agreementCfg, agreementStats, type AgreementStats } from '../../data/fulfillment'
import { canSee, partnerName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { Contract } from '../../data/types'
import { useApi } from '../../lib/useApi'

interface Row { id: string; c: Contract; party: string; s: AgreementStats; left?: number }

/** A6 — agreements list with utilisation (by the fulfillment basis), remaining commitment and module KPIs. */
export default function AgreementsList() {
  const { db, can } = useStore()
  const [tab, setTab] = useState<'all' | 'sales' | 'purchase'>('all')
  const [f, setF] = useState({ status: '', mode: '', partner: '' })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))

  const api = useApi(() => db.contracts.filter((c) => c.profile === 'Agreement' && canSee(db, c)).map<Row>((c) => ({
    id: c.id, c, party: partnerName(db, c), s: agreementStats(db, c), left: c.endDate ? daysTo(c.endDate) : undefined,
  })))
  const all = api.data ?? []
  const rows = all.filter((r) => (tab === 'all' || (tab === 'sales') === (r.c.direction === 'Outgoing')) && (!f.status || r.c.status === f.status) && (!f.mode || r.c.agreementMode === f.mode) && (!f.partner || r.c.counterpartyId === f.partner))

  const tot = useMemo(() => {
    const t = { committed: 0, released: 0, fulfilled: 0, invoiced: 0, near: 0, exceeded: 0, drift: 0, active: 0 }
    all.filter((r) => ['Active', 'OnHold'].includes(r.c.status)).forEach((r) => {
      const cv = (n: number) => convertAmount(db, n, r.c.currency, 'IQD', today())
      t.committed += cv(r.s.committed); t.released += cv(r.s.released); t.fulfilled += cv(r.s.fulfilled); t.invoiced += cv(r.s.invoiced)
      t.near += r.s.nearLines; t.exceeded += r.s.exceededEntries; t.drift += r.s.drift; t.active += 1
    })
    return t
  }, [all, db])

  const cols: Column<Row>[] = [
    { key: 'number', label: 'الرقم', sort: (r) => r.c.number, render: (r) => <span className="font-medium text-navy" dir="ltr">{r.c.number}</span> },
    { key: 'title', label: 'العنوان', sort: (r) => r.c.title, render: (r) => <div className="max-w-[300px]"><div className="truncate font-medium">{r.c.title}</div><div className="mt-0.5 flex gap-1"><ConfidentialityBadge level={r.c.confidentiality} />{r.c.agreementMode === 'General' && <span className="rounded bg-violet-50 px-1.5 text-[10px] text-violet-700">اتفاقية عامة (مكافأة)</span>}</div></div> },
    { key: 'dir', label: 'النوع', render: (r) => (r.c.direction === 'Outgoing' ? 'مبيعات' : 'مشتريات') },
    { key: 'party', label: 'الطرف', sort: (r) => r.party, render: (r) => <span className="line-clamp-2 max-w-[180px]">{r.party}</span> },
    { key: 'status', label: 'الحالة', render: (r) => <ContractStatusBadge status={r.c.status} /> },
    { key: 'value', label: 'الالتزام', num: true, sort: (r) => r.s.committed, render: (r) => money(r.s.committed, r.c.currency) },
    { key: 'use', label: 'الاستهلاك', sort: (r) => r.s.pct, render: (r) => <BalanceBar committed={r.s.committed} released={r.s.released} fulfilled={r.s.fulfilled} invoiced={r.s.invoiced} format={(n) => num(n)} /> },
    { key: 'pct', label: `% (${agreementBasisLabel(db)})`, num: true, sort: (r) => r.s.pct, render: (r) => <span className={r.s.pct >= 95 ? 'font-semibold text-red-600' : r.s.pct >= 80 ? 'font-semibold text-amber-600' : ''}>{num(r.s.pct, 1)}%</span> },
    { key: 'rem', label: 'المتبقي', num: true, sort: (r) => r.s.committed - r.s.basisUsed, render: (r) => money(Math.max(0, r.s.committed - r.s.basisUsed), r.c.currency) },
    { key: 'end', label: 'الانتهاء', sort: (r) => r.c.endDate ?? '9999', render: (r) => <div>{fmtDate(r.c.endDate)}{r.left !== undefined && ['Active', 'OnHold'].includes(r.c.status) && <div className={`text-[11px] ${r.left <= 30 ? 'text-amber-600' : 'text-gray-400'}`}>{r.left} يوم</div>}</div> },
    { key: 'flag', label: 'تنبيه', render: (r) => (
      <div className="flex flex-col gap-0.5 text-[11px]">
        {r.s.nearLines > 0 && <span className="text-amber-600">{r.s.nearLines} بند قارب النفاد</span>}
        {r.s.exceededEntries > 0 && <span className="text-red-600">{r.s.exceededEntries} قيد تجاوز</span>}
        {r.s.drift > 0 && <span className="text-red-600">انحراف أرصدة</span>}
      </div>) },
  ]
  const bars = [['محجوز', tot.released, 'bg-sky-200'], ['منفّذ', tot.fulfilled, 'bg-sky-500'], ['مفوتر', tot.invoiced, 'bg-navy']] as const
  const opt = <T extends { id: string }>(a: T[], l: (x: T) => string) => a.map((x) => ({ value: x.id, label: l(x) }))
  const partnerIds = new Set(all.map((r) => r.c.counterpartyId))
  return (
    <ListView
      title="اتفاقيات المبيعات والمشتريات" crumbs={[{ label: 'الاتفاقيات' }]} rows={rows} columns={cols} rowTo={(r) => `/contracts/${r.id}`} newTo="/contracts/new" newLabel="اتفاقية جديدة" canNew={can('Contracts.Create')}
      loading={api.loading} error={api.error} onRetry={api.reload}
      searchText={(r) => `${r.c.number} ${r.c.title} ${r.party}`}
      kpis={all.length ? [
        { label: 'اتفاقيات سارية أو معلّقة', value: String(tot.active) },
        { label: 'إجمالي الالتزام (د.ع)', value: num(tot.committed) },
        { label: 'بنود قاربت النفاد (≥80%)', value: String(tot.near) },
        { label: 'قيود تجاوز / انحراف أرصدة', value: `${tot.exceeded} / ${tot.drift}` },
      ] : undefined}
      tabs={<>
        <div className="border-b border-line p-4">
          <div className="mb-2 text-xs font-semibold text-gray-600">الالتزام مقابل المحجوز والمنفّذ والمفوتر — الاتفاقيات السارية (بالدينار)</div>
          <div className="space-y-1.5">
            {bars.map(([label, v, cls]) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <span className="w-14 text-gray-500">{label}</span>
                <div className="h-3 flex-1 rounded-full bg-gray-100"><div className={`h-3 rounded-full ${cls}`} style={{ width: `${tot.committed ? Math.min(100, (v / tot.committed) * 100) : 0}%` }} /></div>
                <span className="w-44 text-end tabular-nums">{num(v)} <span className="text-gray-400">({tot.committed ? num((v / tot.committed) * 100, 0) : 0}%)</span></span>
              </div>
            ))}
            <div className="text-[11px] text-gray-400">الالتزام الكلي {num(tot.committed)} د.ع — القيم الدولارية محوّلة بسعر اليوم؛ بنود الكمية تُقيَّم بسعرها الصافي.</div>
          </div>
        </div>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: 'all', label: 'الكل', count: all.length }, { id: 'sales', label: 'اتفاقيات المبيعات', count: all.filter((r) => r.c.direction === 'Outgoing').length }, { id: 'purchase', label: 'اتفاقيات المشتريات', count: all.filter((r) => r.c.direction === 'Incoming').length }]} />
      </>}
      filters={<>
        <FilterSelect label="الحالة" value={f.status} onChange={set('status')} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />
        <FilterSelect label="النمط" value={f.mode} onChange={set('mode')} options={[{ value: 'Specific', label: 'اتفاقية محددة' }, { value: 'General', label: 'اتفاقية عامة (مكافأة)' }]} />
        <FilterSelect label="الطرف" value={f.partner} onChange={set('partner')} options={opt(db.partners.filter((p) => partnerIds.has(p.id)), (p) => p.name)} />
      </>}
      emptyTitle="لا توجد اتفاقيات مطابقة" emptyHint="أنشئ اتفاقية من «اتفاقية جديدة» واختر نوع عقد من نمط اتفاقية."
    />
  )
}

function agreementBasisLabel(db: ReturnType<typeof useStore>['db']) {
  const first = db.contracts.find((c) => c.profile === 'Agreement')
  const b = first ? agreementCfg(db, first).basis : 'Order'
  return b === 'Order' ? 'الأمر' : b === 'Delivery' ? 'التسليم' : 'الفاتورة'
}
