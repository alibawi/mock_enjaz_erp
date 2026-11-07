import { ListView } from '../../components/ListView'
import { Badge, Tabs } from '../../components/ui'
import { daysBetween } from './shared'
import { canConvert, isInternal, totals } from '../../data/estimate'
import { estimateStatus, fmtDate, iqd, num } from '../../data/format'
import { useStore } from '../../data/store'
import type { Estimate, EstimateStatus } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { useSearchParams } from '../../router'

type TabId = 'active' | 'awaitingCustomer' | 'ready' | 'all' | EstimateStatus

export default function EstimatesList() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'active'
  const api = useApi(() => db.estimates, [])

  const asset = (id: string) => db.assets.find((a) => a.id === id)
  const partner = (id: string) => db.partners.find((p) => p.id === id)?.name ?? '—'
  const awaitingCustomer = (e: Estimate) => e.status === 'approved' && !e.customerAcceptance && !isInternal(db, e)
  const match = (e: Estimate, t: TabId) => {
    switch (t) {
      case 'all': return true
      case 'active': return ['draft', 'pendingApproval', 'approved'].includes(e.status) && !db.workOrders.some((w) => w.estimateId === e.id)
      case 'awaitingCustomer': return awaitingCustomer(e)
      case 'ready': return canConvert(db, e)
      default: return e.status === t
    }
  }
  const rows = (api.data ?? []).filter((e) => match(e, tab)).sort((a, b) => b.number.localeCompare(a.number) || b.version - a.version)
  const count = (t: TabId) => (api.data ?? []).filter((e) => match(e, t)).length
  const pending = db.estimates.filter((e) => e.status === 'pendingApproval')
  const decided = db.approvals.filter((a) => a.decidedAt && a.status !== 'notRequired')
  const avgDays = decided.length ? decided.reduce((s, a) => s + daysBetween(a.submittedAt, a.decidedAt!), 0) / decided.length : 0

  return (
    <ListView<Estimate>
      title="التقديرات (عروض سعر الإصلاح)"
      rows={rows}
      loading={api.loading}
      error={api.error}
      onRetry={api.reload}
      rowTo={(e) => `/estimates/${e.id}`}
      searchText={(e) => `${e.number} ${asset(e.assetId)?.name ?? ''} ${partner(e.partnerId)}`}
      kpis={[
        { label: 'بانتظار الاعتماد', value: num(pending.length) },
        { label: 'قيمة ما ينتظر الاعتماد', value: iqd(pending.reduce((s, e) => s + totals(db, e).gross, 0)) },
        { label: 'معتمدة بانتظار رد العميل', value: num(db.estimates.filter(awaitingCustomer).length) },
        { label: 'متوسط زمن الاعتماد', value: `${num(avgDays, 1)} يوم` },
      ]}
      tabs={
        <Tabs<TabId> active={tab} onChange={(t) => setParams({ tab: t })} tabs={[
          { id: 'active', label: 'الجارية', count: count('active') },
          { id: 'draft', label: estimateStatus.draft.label, count: count('draft') },
          { id: 'pendingApproval', label: estimateStatus.pendingApproval.label, count: count('pendingApproval') },
          { id: 'awaitingCustomer', label: 'بانتظار رد العميل', count: count('awaitingCustomer') },
          { id: 'ready', label: 'جاهزة لأمر عمل', count: count('ready') },
          { id: 'rejected', label: estimateStatus.rejected.label, count: count('rejected') },
          { id: 'expired', label: estimateStatus.expired.label, count: count('expired') },
          { id: 'all', label: 'الكل', count: count('all') },
        ]} />
      }
      columns={[
        { key: 'no', label: 'رقم التقدير', render: (e) => <span className="font-mono text-[12px]" dir="ltr">{e.number} v{e.version}</span>, sort: (e) => e.number + e.version },
        { key: 'asset', label: 'الأصل', render: (e) => <span className="font-medium text-gray-900">{asset(e.assetId)?.name}</span> },
        { key: 'partner', label: 'العميل', render: (e) => partner(e.partnerId), sort: (e) => partner(e.partnerId) },
        { key: 'gross', label: 'الإجمالي', num: true, render: (e) => iqd(totals(db, e).gross), sort: (e) => totals(db, e).gross },
        { key: 'bill', label: 'على العميل', num: true, render: (e) => iqd(totals(db, e).billable) },
        { key: 'valid', label: 'صالح حتى', render: (e) => fmtDate(e.validUntil), sort: (e) => e.validUntil },
        {
          key: 'st', label: 'الحالة', render: (e) => (
            <span className="flex flex-wrap gap-1">
              <Badge tone={estimateStatus[e.status].tone}>{estimateStatus[e.status].label}</Badge>
              {e.customerAcceptance && <Badge tone={e.customerAcceptance.decision === 'accepted' ? 'green' : 'red'}>{e.customerAcceptance.decision === 'accepted' ? 'وافق العميل' : 'رفض العميل'}</Badge>}
              {isInternal(db, e) && <Badge tone="gray">داخلي</Badge>}
            </span>
          ),
        },
      ]}
      emptyTitle="لا توجد تقديرات مطابقة"
    />
  )
}
