import { useState } from 'react'
import { JournalPreview } from '../../components/board'
import { DataTable } from '../../components/DataTable'
import { FilterSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { Modal } from '../../components/ui'
import { fmtDateTime, iqd, num } from '../../data/format'
import { useStore } from '../../data/store'
import type { GoodsIssue } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { Link } from '../../router'
import { SimTag } from './shared'

const total = (g: GoodsIssue) => g.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)

/** Goods issues (S18, simulated Inventory): one per consumption posting, journal per expense type (decision 1c). */
export default function GoodsIssues() {
  const { db } = useStore()
  const [acc, setAcc] = useState('')
  const [open, setOpen] = useState<GoodsIssue | null>(null)
  const api = useApi(() => db.goodsIssues, [])
  const wo = (id: string) => db.workOrders.find((w) => w.id === id)
  const accounts = [...new Map(db.goodsIssues.flatMap((g) => g.lines).map((l) => [l.expenseAccount, l.expenseAccountName])).entries()]
  const rows = (api.data ?? []).filter((g) => !acc || g.lines.some((l) => l.expenseAccount === acc)).sort((a, b) => b.number.localeCompare(a.number))
  const byAcc = accounts.map(([code, name]) => ({ code, name, v: db.goodsIssues.flatMap((g) => g.lines).filter((l) => l.expenseAccount === code).reduce((s, l) => s + l.qty * l.unitCost, 0) }))

  return (
    <>
      <ListView<GoodsIssue>
        title="سندات صرف القطع"
        crumbs={[{ label: 'الفوترة والعربون', to: '/billing' }, { label: 'سندات الصرف' }]}
        rows={rows} loading={api.loading} error={api.error} onRetry={api.reload} canNew={false} onRowClick={setOpen}
        searchText={(g) => `${g.number} ${wo(g.workOrderId)?.number ?? ''}`}
        kpis={byAcc.sort((a, b) => b.v - a.v).slice(0, 4).map((x) => ({ label: `${x.code} ${x.name}`, value: iqd(x.v) }))}
        filters={<FilterSelect label="حساب المصروف" value={acc} onChange={setAcc} options={accounts.map(([c, n]) => ({ value: c, label: `${c} — ${n}` }))} />}
        emptyTitle="لا توجد سندات صرف"
        columns={[
          { key: 'no', label: 'سند الصرف', render: (g) => <span className="font-mono text-[12px]" dir="ltr">{g.number}</span>, sort: (g) => g.number },
          { key: 'd', label: 'التاريخ', render: (g) => fmtDateTime(g.date), sort: (g) => g.date },
          { key: 'w', label: 'أمر العمل', render: (g) => <Link to={`/work-orders/${g.workOrderId}`} className="font-mono text-[12px] text-navy hover:underline" dir="ltr" onClick={(e) => e.stopPropagation()}>{wo(g.workOrderId)?.number}</Link> },
          { key: 'p', label: 'الشريك', render: (g) => db.partners.find((p) => p.id === g.partnerId)?.name },
          { key: 'a', label: 'حسابات المصروف', render: (g) => <span className="font-mono text-[12px]" dir="ltr">{[...new Set(g.lines.map((l) => l.expenseAccount))].join(' · ')}</span> },
          { key: 'n', label: 'الأسطر', num: true, render: (g) => num(g.lines.length) },
          { key: 't', label: 'الكلفة', num: true, render: (g) => iqd(total(g)), sort: total, total: (rs) => iqd(rs.reduce((s, g) => s + total(g), 0)) },
        ]}
      />
      {open && (
        <Modal title={`سند صرف ${open.number}`} wide onClose={() => setOpen(null)} footer={<button type="button" className="btn" onClick={() => setOpen(null)}>إغلاق</button>}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">{fmtDateTime(open.date)} · {wo(open.workOrderId)?.number} <SimTag module="المخزون" /><span className="font-mono text-[11px] text-gray-400" dir="ltr">{open.idempotencyKey}</span></div>
          <DataTable rows={open.lines.map((l, i) => ({ ...l, id: String(i) }))} compact columns={[
            { key: 'i', label: 'القطعة', render: (l) => db.items.find((x) => x.id === l.itemId)?.name },
            { key: 'q', label: 'الكمية', num: true, render: (l) => num(l.qty) },
            { key: 'c', label: 'الكلفة', num: true, render: (l) => iqd(l.unitCost) },
            { key: 'a', label: 'حساب المصروف', render: (l) => <span><span className="font-mono text-gray-500" dir="ltr">{l.expenseAccount}</span> {l.expenseAccountName}</span> },
          ]} />
          <div className="mt-3"><JournalPreview lines={open.journal} /></div>
        </Modal>
      )}
    </>
  )
}
