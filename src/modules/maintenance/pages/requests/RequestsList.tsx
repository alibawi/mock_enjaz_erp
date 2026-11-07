import { useState } from 'react'
import { ListView } from '../../components/ListView'
import { FilterSelect } from '../../components/inputs'
import { Badge, Tabs } from '../../components/ui'
import { fmtDateTime, maintKindLabel, num, requestStatus } from '../../data/format'
import { isOpenRequest } from '../../data/requests'
import { useStore } from '../../data/store'
import type { MaintRequest, RequestStatus } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { useSearchParams } from '../../router'

type TabId = 'open' | 'all' | RequestStatus
export const channelLabel: Record<MaintRequest['channel'], string> = { walkIn: 'حضوري', phone: 'هاتف', whatsapp: 'واتساب' }

export default function RequestsList() {
  const { db, can } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'open'
  const [type, setType] = useState('')
  const api = useApi(() => db.requests, [])

  const asset = (id: string) => db.assets.find((a) => a.id === id)
  const plate = (id: string) => db.vehicles.find((v) => v.assetId === id)?.plate
  const partner = (id: string) => db.partners.find((p) => p.id === id)?.name ?? '—'
  const mtype = (id: string) => db.maintenanceTypes.find((m) => m.id === id)
  const match = (r: MaintRequest, t: TabId) => (t === 'all' ? true : t === 'open' ? isOpenRequest(r) : r.status === t)
  const base = (api.data ?? []).filter((r) => !type || r.maintenanceTypeId === type)
  const rows = base.filter((r) => match(r, tab)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  const count = (t: TabId) => base.filter((r) => match(r, t)).length
  const todayCount = db.requests.filter((r) => r.receivedAt.startsWith(db.asOf)).length

  return (
    <ListView<MaintRequest>
      title="طلبات الصيانة"
      rows={rows}
      loading={api.loading}
      error={api.error}
      onRetry={api.reload}
      newTo="/requests/new"
      newLabel="استلام طلب"
      canNew={can('Requests.Create')}
      rowTo={(r) => `/requests/${r.id}`}
      searchText={(r) => `${r.number} ${asset(r.assetId)?.name ?? ''} ${plate(r.assetId) ?? ''} ${asset(r.assetId)?.serial ?? ''} ${partner(r.partnerId)} ${r.complaint} ${r.contactPhone ?? ''}`}
      kpis={[
        { label: 'طلبات مفتوحة', value: num(db.requests.filter(isOpenRequest).length) },
        { label: 'مستلمة اليوم', value: num(todayCount) },
        { label: 'قيد التشخيص', value: num(db.requests.filter((r) => r.status === 'inDiagnosis').length) },
        { label: 'مسودات بانتظار الاستلام', value: num(db.requests.filter((r) => r.status === 'draft').length) },
      ]}
      tabs={
        <Tabs<TabId> active={tab} onChange={(t) => setParams({ tab: t })} tabs={[
          { id: 'open', label: 'المفتوحة', count: count('open') },
          { id: 'draft', label: requestStatus.draft.label, count: count('draft') },
          { id: 'received', label: requestStatus.received.label, count: count('received') },
          { id: 'inDiagnosis', label: requestStatus.inDiagnosis.label, count: count('inDiagnosis') },
          { id: 'awaitingApproval', label: requestStatus.awaitingApproval.label, count: count('awaitingApproval') },
          { id: 'closed', label: requestStatus.closed.label, count: count('closed') },
          { id: 'cancelled', label: requestStatus.cancelled.label, count: count('cancelled') },
          { id: 'all', label: 'الكل', count: count('all') },
        ]} />
      }
      filters={<FilterSelect label="نوع الصيانة" value={type} onChange={setType} options={db.maintenanceTypes.map((m) => ({ value: m.id, label: m.name }))} />}
      columns={[
        { key: 'no', label: 'رقم الطلب', render: (r) => <span className="font-mono text-[12px]" dir="ltr">{r.number}</span>, sort: (r) => r.number },
        { key: 'at', label: 'الاستلام', render: (r) => fmtDateTime(r.receivedAt), sort: (r) => r.receivedAt },
        { key: 'asset', label: 'الأصل', render: (r) => <span><span className="font-medium text-gray-900">{asset(r.assetId)?.name}</span>{plate(r.assetId) && <span className="ms-1 text-[11px] text-gray-500">{plate(r.assetId)}</span>}</span> },
        { key: 'partner', label: 'العميل', render: (r) => partner(r.partnerId), sort: (r) => partner(r.partnerId) },
        { key: 'type', label: 'النوع', render: (r) => { const m = mtype(r.maintenanceTypeId); return m ? `${m.name} · ${maintKindLabel[m.kind]}` : '—' } },
        { key: 'complaint', label: 'الشكوى', className: 'max-w-xs truncate', render: (r) => r.complaint },
        { key: 'ch', label: 'القناة', render: (r) => channelLabel[r.channel] },
        { key: 'st', label: 'الحالة', render: (r) => <span className="flex gap-1"><Badge tone={requestStatus[r.status].tone}>{requestStatus[r.status].label}</Badge>{r.reworkOfWorkOrderId && <Badge tone="amber">إعادة عمل</Badge>}</span> },
      ]}
      emptyTitle="لا توجد طلبات مطابقة"
    />
  )
}
