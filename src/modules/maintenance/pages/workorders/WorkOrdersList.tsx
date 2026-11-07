import { Plus } from 'lucide-react'
import { FilterSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { Badge, Tabs } from '../../components/ui'
import { fmtDate, maintKindLabel, num, woStatus } from '../../data/format'
import { useStore } from '../../data/store'
import type { WorkOrder } from '../../data/types'
import { ACTIVE_WORK, isOpenWo, isOverdue, kindOf } from '../../data/workorder'
import { useApi } from '../../lib/useApi'
import { Link, useSearchParams } from '../../router'
import { BillBadge, ConsBadge, WoBadge } from './shared'

type TabId = 'open' | 'toSchedule' | 'active' | 'waiting' | 'overdue' | 'failed' | 'toClose' | 'closed' | 'all'

/** Work orders list (S11). The topbar search lands here with ?q=. */
export default function WorkOrdersList() {
  const { db, can } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'open'
  const q = params.get('q') ?? ''
  const tech = params.get('tech') ?? ''
  const api = useApi(() => db.workOrders, [])

  const asset = (id: string) => db.assets.find((a) => a.id === id)
  const plate = (id: string) => db.vehicles.find((v) => v.assetId === id)?.plate ?? ''
  const partner = (id: string) => db.partners.find((p) => p.id === id)?.name ?? '—'
  const techName = (id?: string) => db.technicians.find((t) => t.id === id)?.name ?? '—'
  const match = (w: WorkOrder, t: TabId) => {
    switch (t) {
      case 'open': return isOpenWo(w)
      case 'toSchedule': return ['created', 'planned'].includes(w.status)
      case 'active': return w.status === 'inProgress' || w.status === 'qualityCheck'
      case 'waiting': return ['waitingParts', 'waitingCustomer', 'onHold'].includes(w.status)
      case 'overdue': return isOverdue(w)
      case 'failed': return w.consumptionStatus === 'failed'
      case 'toClose': return w.status === 'completed'
      case 'closed': return w.status === 'closed' || w.status === 'cancelled'
      default: return true
    }
  }
  const text = (w: WorkOrder) => `${w.number} ${asset(w.assetId)?.name ?? ''} ${asset(w.assetId)?.code ?? ''} ${plate(w.assetId)} ${partner(w.billingPartnerId)}`
  const all = (api.data ?? []).filter((w) => (!q || text(w).includes(q)) && (!tech || w.leadTechnicianId === tech))
  const rows = all.filter((w) => match(w, q ? 'all' : tab)).sort((a, b) => b.number.localeCompare(a.number))
  const count = (t: TabId) => all.filter((w) => match(w, t)).length
  const active = db.workOrders.filter((w) => ACTIVE_WORK.includes(w.status))

  return (
    <ListView<WorkOrder>
      title="أوامر العمل"
      rows={rows}
      loading={api.loading}
      error={api.error}
      onRetry={api.reload}
      rowTo={(w) => `/work-orders/${w.id}`}
      searchText={text}
      canNew={false}
      extraActions={can('WorkOrders.Create') && <Link to="/work-orders/new" className="btn btn-primary"><Plus className="h-4 w-4" />أمر عمل داخلي</Link>}
      kpis={[
        { label: 'مفتوحة', value: num(db.workOrders.filter(isOpenWo).length) },
        { label: 'قيد التنفيذ الآن', value: num(active.length) },
        { label: 'متأخرة عن الخطة', value: num(db.workOrders.filter(isOverdue).length) },
        { label: 'فشل الصرف', value: num(db.workOrders.filter((w) => w.consumptionStatus === 'failed').length) },
      ]}
      filters={<FilterSelect label="الفني" value={tech} onChange={(v) => { const p = new URLSearchParams(params); if (v) p.set('tech', v); else p.delete('tech'); setParams(p) }}
        options={db.technicians.map((t) => ({ value: t.id, label: t.name }))} />}
      tabs={
        <>
          {q && <div className="flex items-center gap-2 border-b border-line bg-amber-50 px-4 py-2 text-sm">نتائج البحث عن «{q}» <button type="button" className="text-navy underline" onClick={() => setParams({ tab })}>مسح</button></div>}
          <Tabs<TabId> active={q ? 'all' : tab} onChange={(t) => setParams({ tab: t })} tabs={[
            { id: 'open', label: 'المفتوحة', count: count('open') },
            { id: 'toSchedule', label: 'بانتظار الجدولة', count: count('toSchedule') },
            { id: 'active', label: 'قيد التنفيذ / الفحص', count: count('active') },
            { id: 'waiting', label: 'معلّقة', count: count('waiting') },
            { id: 'overdue', label: 'متأخرة', count: count('overdue') },
            { id: 'failed', label: 'فشل الصرف', count: count('failed') },
            { id: 'toClose', label: 'مكتملة بانتظار الإغلاق', count: count('toClose') },
            { id: 'closed', label: 'مغلقة / ملغاة', count: count('closed') },
            { id: 'all', label: 'الكل', count: count('all') },
          ]} />
        </>
      }
      columns={[
        { key: 'no', label: 'رقم أمر العمل', render: (w) => <span className="font-mono text-[12px]" dir="ltr">{w.number}</span>, sort: (w) => w.number },
        { key: 'asset', label: 'الأصل', render: (w) => <span><span className="font-medium text-gray-900">{asset(w.assetId)?.name}</span>{plate(w.assetId) && <span className="block text-[11px] text-gray-500">{plate(w.assetId)}</span>}</span> },
        { key: 'partner', label: 'الجهة المُفوتَرة', render: (w) => partner(w.billingPartnerId), sort: (w) => partner(w.billingPartnerId) },
        { key: 'kind', label: 'النوع', render: (w) => { const k = kindOf(db, w); return k ? <Badge tone={k === 'internal' ? 'gray' : k === 'field' ? 'blue' : 'amber'}>{maintKindLabel[k]}</Badge> : '—' } },
        { key: 'tech', label: 'الفني', render: (w) => techName(w.leadTechnicianId), sort: (w) => techName(w.leadTechnicianId) },
        { key: 'plan', label: 'الخطة', render: (w) => (w.plannedStart ? <span className={isOverdue(w) ? 'font-semibold text-red-600' : ''}>{fmtDate(w.plannedStart)}{w.plannedEnd && w.plannedEnd.slice(0, 10) !== w.plannedStart.slice(0, 10) ? ` ← ${fmtDate(w.plannedEnd)}` : ''}</span> : '—'), sort: (w) => w.plannedStart ?? '' },
        { key: 'st', label: 'الحالة', render: (w) => <span className="flex flex-wrap gap-1"><WoBadge w={w} />{w.reworkOfId && <Badge tone="red">إعادة عمل</Badge>}</span>, sort: (w) => woStatus[w.status].label },
        { key: 'cons', label: 'الصرف', render: (w) => <ConsBadge w={w} /> },
        { key: 'bill', label: 'الفوترة', render: (w) => <BillBadge w={w} /> },
      ]}
      emptyTitle={q ? 'لا توجد أوامر عمل مطابقة للبحث' : 'لا توجد أوامر عمل في هذا التبويب'}
    />
  )
}
