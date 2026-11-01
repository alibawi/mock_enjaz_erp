import { useState } from 'react'
import { type Column } from '../../components/DataTable'
import { FilterSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { PageHeader } from '../../components/Layout'
import { AUDIT_ENTITIES, entityLabel, settingsAudit } from '../../data/admin'
import { fmtDateTime } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { AuditRow } from '../../data/types'
import { NoAccess } from './Settings'

/** X6 — settings audit: who changed which setting, from what to what, and when (BR-X-07). */
export default function SettingsAudit() {
  const { db, can } = useStore()
  const [kind, setKind] = useState('')
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }, { label: 'التدقيق' }]} title="سجل تدقيق الإعدادات" /><NoAccess /></div>
  const rows = settingsAudit(db).filter((a) => !kind || a.entity === kind)
  const cols: Column<AuditRow>[] = [
    { key: 'at', label: 'الوقت', render: (a) => fmtDateTime(a.at) }, { key: 'u', label: 'المستخدم', render: (a) => userName(db, a.userId) },
    { key: 'e', label: 'النوع', render: (a) => entityLabel[a.entity] ?? a.entity }, { key: 'k', label: 'المفتاح', render: (a) => <span dir="ltr" className="text-xs">{a.entityId}</span> },
    { key: 'd', label: 'التغيير (القديم ← الجديد)', render: (a) => a.detail },
  ]
  return (
    <ListView title="سجل تدقيق الإعدادات" crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'التدقيق' }]} rows={rows} columns={cols} canNew={false} canExport={false}
      searchText={(a) => `${a.entityId} ${a.detail} ${userName(db, a.userId)}`}
      filters={<FilterSelect label="النوع" value={kind} onChange={setKind} options={AUDIT_ENTITIES.map((k) => ({ value: k, label: entityLabel[k] }))} />}
      emptyTitle="لا تغييرات مسجّلة" emptyHint="كل تعديل على الإعدادات أو الصلاحيات أو الترقيم أو المراحل يظهر هنا." />
  )
}
