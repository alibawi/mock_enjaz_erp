import { useState } from 'react'
import { FilterSelect } from '../components/inputs'
import { ListView } from '../components/ListView'
import { Badge } from '../components/ui'
import { fmtDateTime, num } from '../data/format'
import { roleLabel } from '../data/permissions'
import { useStore } from '../data/store'
import type { AuditEntry, DB } from '../data/types'
import { useApi } from '../lib/useApi'
import { Link } from '../router'

const entityLabel: Record<string, string> = {
  workOrder: 'أمر عمل', estimate: 'تقدير', request: 'طلب', asset: 'أصل', booking: 'حجز', leave: 'إجازة', labor: 'ساعات', access: 'صلاحيات', settings: 'إعدادات', master: 'بيانات رئيسية', demo: 'العرض',
}
/** Readable reference + link for the audited document. */
function ref(d: DB, a: AuditEntry): { text: string; to?: string } {
  switch (a.entity) {
    case 'workOrder': { const w = d.workOrders.find((x) => x.id === a.entityId); return { text: w?.number ?? a.entityId, to: w && `/work-orders/${w.id}` } }
    case 'estimate': { const e = d.estimates.find((x) => x.id === a.entityId); return { text: e ? `${e.number} v${e.version}` : a.entityId, to: e && `/estimates/${e.id}` } }
    case 'request': { const r = d.requests.find((x) => x.id === a.entityId); return { text: r?.number ?? a.entityId, to: r && `/requests/${r.id}` } }
    case 'asset': { const s = d.assets.find((x) => x.id === a.entityId); return { text: s?.code ?? a.entityId, to: s && `/assets/${s.id}` } }
    case 'booking': return { text: d.bookings.find((x) => x.id === a.entityId)?.number ?? a.entityId, to: '/schedule/bookings?tab=all' }
    default: return { text: a.entityId }
  }
}

/** Audit log (S22): every state change — who (and role), when, what — filterable by entity, user and action. */
export default function Audit() {
  const { db } = useStore()
  const [entity, setEntity] = useState('')
  const [user, setUser] = useState('')
  const [from, setFrom] = useState('')
  const api = useApi(() => db.audit, [])
  const rows = (api.data ?? []).filter((a) => (!entity || a.entity === entity) && (!user || a.userId === user) && (!from || a.at.slice(0, 10) >= from)).sort((a, b) => b.at.localeCompare(a.at))
  const u = (id: string) => db.users.find((x) => x.id === id)
  const today = rows.filter((a) => a.at.startsWith(db.asOf)).length

  return (
    <ListView<AuditEntry>
      title="سجل التدقيق"
      crumbs={[{ label: 'سجل التدقيق' }]}
      rows={rows} loading={api.loading} error={api.error} onRetry={api.reload} canNew={false}
      searchText={(a) => `${a.action} ${a.detail} ${ref(db, a).text} ${u(a.userId)?.name ?? ''}`}
      kpis={[
        { label: 'كل الأحداث', value: num(db.audit.length) },
        { label: 'أحداث اليوم', value: num(today) },
        { label: 'مستخدمون', value: num(new Set(db.audit.map((a) => a.userId)).size) },
        { label: 'المعروض', value: num(rows.length) },
      ]}
      filters={<>
        <FilterSelect label="الكيان" value={entity} onChange={setEntity} options={[...new Set(db.audit.map((a) => a.entity))].map((e) => ({ value: e, label: entityLabel[e] ?? e }))} />
        <FilterSelect label="المستخدم" value={user} onChange={setUser} options={db.users.map((x) => ({ value: x.id, label: x.name }))} />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">من تاريخ<input type="date" className="inp w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      </>}
      emptyTitle="لا توجد أحداث مطابقة"
      columns={[
        { key: 'at', label: 'الوقت', render: (a) => fmtDateTime(a.at), sort: (a) => a.at },
        { key: 'u', label: 'المستخدم', render: (a) => <span>{u(a.userId)?.name ?? (a.userId === 'system' ? 'النظام' : a.userId)}{u(a.userId) && <span className="block text-[11px] text-gray-500">{roleLabel[u(a.userId)!.role]}</span>}</span> },
        { key: 'e', label: 'الكيان', render: (a) => <Badge tone="gray">{entityLabel[a.entity] ?? a.entity}</Badge> },
        { key: 'r', label: 'المرجع', render: (a) => { const r = ref(db, a); return r.to ? <Link to={r.to} className="font-mono text-[12px] text-navy hover:underline" dir="ltr" onClick={(x) => x.stopPropagation()}>{r.text}</Link> : <span className="font-mono text-[12px]" dir="ltr">{r.text}</span> } },
        { key: 'a', label: 'الإجراء', render: (a) => <span className="font-medium">{a.action}</span>, sort: (a) => a.action },
        { key: 'd', label: 'التفاصيل', className: 'max-w-md text-[12px] text-gray-600', render: (a) => a.detail },
      ]}
    />
  )
}
