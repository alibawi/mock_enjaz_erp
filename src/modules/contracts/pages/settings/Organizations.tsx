import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { Badge, Card, Select } from '../../components/ui'
import { authorityLabel, setUserScope } from '../../data/admin'
import { canSeeAs, userName } from '../../data/lifecycle'
import { roleLabel } from '../../data/permissions'
import { useStore } from '../../data/store'
import type { AppUser, DataAuthority } from '../../data/types'
import { NoAccess } from './Settings'

/** X5 — organizations and data authority (BR-X-03) with a "view as" test panel. */
export default function Organizations() {
  const { db, run, can } = useStore()
  const [as, setAs] = useState('u-bsr')
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }, { label: 'المنشآت' }]} title="المنشآت وصلاحية البيانات" /><NoAccess /></div>
  const visible = db.contracts.filter((c) => canSeeAs(db, as, c))
  const hidden = db.contracts.length - visible.length
  const orgName = (id: string) => db.organizations.find((o) => o.id === id)?.name
  const cols: Column<AppUser>[] = [
    { key: 'n', label: 'المستخدم', render: (u) => <div><div className="font-medium">{u.name}</div><div className="text-[11px] text-gray-400">{u.title}</div></div> },
    { key: 'r', label: 'الدور', render: (u) => roleLabel[u.role] },
    { key: 'o', label: 'المنشأة', render: (u) => orgName(u.orgId) },
    { key: 's', label: 'صلاحية البيانات', render: (u) => <div className="w-56"><Select value={db.userScopes[u.id] ?? 'System'} onChange={(v: DataAuthority) => run((d) => setUserScope(d, u.id, v), 'حُفظت صلاحية البيانات')} options={(Object.keys(authorityLabel) as DataAuthority[]).map((k) => ({ value: k, label: authorityLabel[k] }))} /></div> },
    { key: 'v', label: 'عقود مرئية', num: true, render: (u) => db.contracts.filter((c) => canSeeAs(db, u.id, c)).length },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'المنشآت' }]} title="المنشآت وصلاحية البيانات" />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">مستخدم بصلاحية «منشأة» يرى عقود منشأته وما يملكه فقط، و«مستخدم» ما يخصه فقط، و«النظام» الكل. العقود السرية تتبع صلاحية «عرض العقود السرية» إضافة إلى ذلك.</div>
      <div className="mb-3 grid gap-2 md:grid-cols-4">{db.organizations.map((o) => <div key={o.id} className="card px-3 py-2 text-sm"><div className="font-medium">{o.name}</div><div className="text-[11px] text-gray-400">{o.city} · {db.contracts.filter((c) => c.organizationId === o.id).length} عقد</div></div>)}</div>
      <Card pad={false}><DataTable rows={db.users} columns={cols} emptyTitle="لا مستخدمون" /></Card>
      <Card title="اختبار «عرض كـ»" className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="w-72"><Select value={as} onChange={setAs} options={db.users.map((u) => ({ value: u.id, label: `${u.name} — ${roleLabel[u.role]}` }))} /></div>
          <Badge tone="blue">{authorityLabel[db.userScopes[as] ?? 'System']}</Badge>
          <span className="text-sm">يرى <b>{visible.length}</b> من {db.contracts.length} عقد — <span className="text-gray-500">يُخفى عنه {hidden}</span></span>
        </div>
        <ul className="grid gap-1 text-xs md:grid-cols-2">
          {visible.slice(0, 10).map((c) => <li key={c.id}><Link className="text-navy" to={`/contracts/${c.id}`} dir="ltr">{c.number}</Link> <span className="text-gray-500">{orgName(c.organizationId)} — {userName(db, c.ownerUserId)}</span></li>)}
          {visible.length > 10 && <li className="text-gray-400">… و{visible.length - 10} آخرين</li>}
        </ul>
      </Card>
    </div>
  )
}
