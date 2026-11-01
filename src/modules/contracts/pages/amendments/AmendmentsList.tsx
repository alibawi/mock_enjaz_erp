import { Link } from '../../router'
import { useState } from 'react'
import { KPICard } from '../../components/display'
import { FilterSelect } from '../../components/inputs'
import { ListView, type Column } from '../../components/ListView'
import { Tabs } from '../../components/ui'
import { amendStatusLabel, amendTypeLabel } from '../../data/amendments'
import { daysTo, fmtDate } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { AmendmentStatus, ContractAmendment } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { AmendStatusBadge } from './shared'

/** All amendments with module KPIs (by status, average time to approve, contracts with a pending amendment). */
export default function AmendmentsList() {
  const { db } = useStore()
  const [tab, setTab] = useState<AmendmentStatus | 'all'>('all')
  const [type, setType] = useState('')
  const api = useApi(() => {
    const times = db.approvalRequests.filter((r) => r.subjectType === 'Amendment' && r.status === 'Approved' && r.completedAt).map((r) => daysTo(r.completedAt!.slice(0, 10), r.submittedAt.slice(0, 10)))
    return {
      rows: db.amendments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      avg: times.length ? times.reduce((s, x) => s + x, 0) / times.length : 0,
      pendingContracts: new Set(db.amendments.filter((a) => ['PendingApproval', 'Approved'].includes(a.status)).map((a) => a.contractId)).size,
    }
  })
  const all = api.data?.rows ?? []
  const rows = all.filter((a) => (tab === 'all' || a.status === tab) && (!type || a.type === type))
  const cnt = (s: AmendmentStatus) => all.filter((a) => a.status === s).length
  const contract = (a: ContractAmendment) => db.contracts.find((c) => c.id === a.contractId)
  const cols: Column<ContractAmendment>[] = [
    { key: 'n', label: 'الملحق', render: (a) => <Link className="font-medium text-navy" to={`/contracts/${a.contractId}/amendments/${a.id}`}>ملحق {a.amendmentNo}</Link> },
    { key: 'c', label: 'العقد', render: (a) => <Link to={`/contracts/${a.contractId}`}><div dir="ltr" className="text-navy">{contract(a)?.number}</div><div className="max-w-[260px] truncate text-[11px] text-gray-500">{contract(a)?.title}</div></Link> },
    { key: 't', label: 'النوع', render: (a) => amendTypeLabel[a.type] },
    { key: 'r', label: 'السبب', render: (a) => <span className="line-clamp-2 max-w-[280px]">{a.reason}</span> },
    { key: 'e', label: 'السريان', render: (a) => fmtDate(a.effectiveDate) },
    { key: 's', label: 'الحالة', render: (a) => <AmendStatusBadge status={a.status} /> },
    { key: 'v', label: 'الإصدار', render: (a) => (a.appliedVersionNo ? `v${a.appliedVersionNo}` : '—') },
    { key: 'b', label: 'أنشأه', render: (a) => userName(db, a.createdBy) },
  ]
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPICard label="مسودة" value={cnt('Draft')} /><KPICard label="بانتظار الاعتماد" value={cnt('PendingApproval')} tone="amber" /><KPICard label="معتمدة تنتظر التطبيق" value={cnt('Approved')} tone="blue" />
        <KPICard label="عقود لها ملحق معلّق" value={api.data?.pendingContracts ?? 0} /><KPICard label="متوسط مدة اعتماد الملحق" value={`${(api.data?.avg ?? 0).toFixed(1)} يوم`} tone="green" />
      </div>
      <ListView title="الملاحق" crumbs={[{ label: 'الملاحق والتجديد' }, { label: 'الملاحق' }]} rows={rows} columns={cols} rowTo={(a) => `/contracts/${a.contractId}/amendments/${a.id}`} canNew={false} canExport={false}
        loading={api.loading} error={api.error} onRetry={api.reload} searchText={(a) => `${contract(a)?.number} ${contract(a)?.title} ${a.reason}`}
        tabs={<Tabs active={tab} onChange={setTab} tabs={[{ id: 'all', label: 'الكل', count: all.length }, ...(Object.keys(amendStatusLabel) as AmendmentStatus[]).map((s) => ({ id: s, label: amendStatusLabel[s], count: cnt(s) }))]} />}
        filters={<FilterSelect label="النوع" value={type} onChange={setType} options={Object.entries(amendTypeLabel).map(([value, label]) => ({ value, label }))} />}
        emptyTitle="لا ملاحق" emptyHint="تُنشأ الملاحق من تبويب «الملاحق» في بطاقة العقد." />
    </div>
  )
}
