import { useState } from 'react'
import { DataTable, type Column } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { Card, NumInput } from '../../components/ui'
import { seriesExample, seriesList, updateSeries } from '../../data/admin'
import { useStore } from '../../data/store'
import { NoAccess } from './Settings'

type Row = ReturnType<typeof seriesList>[number] & { id: string }

/** X3 — numbering series per contract type with a live example. Changing a series never renumbers existing contracts (BR-X-04). */
export default function Numbering() {
  const { db, run, can } = useStore()
  const [edit, setEdit] = useState<Record<string, { prefix: string; next: number; size: number }>>({})
  const [err, setErr] = useState('')
  const rows: Row[] = seriesList(db).map((r) => ({ ...r, id: r.type.id }))
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }, { label: 'الترقيم' }]} title="الترقيم" /><NoAccess /></div>
  const cur = (r: Row) => edit[r.id] ?? { prefix: r.prefix, next: r.next, size: r.size }
  const save = (r: Row) => {
    const e = cur(r)
    let fl = ''
    const ok = run((d) => { const x = updateSeries(d, r.id, e); if (x) fl = x; return x }, `حُفظت سلسلة ${r.type.code}`)
    if (!ok) return setErr(fl)
    setErr(''); setEdit(({ [r.id]: _drop, ...rest }) => rest)
  }
  const cols: Column<Row>[] = [
    { key: 't', label: 'نوع العقد', render: (r) => <div><div className="font-medium">{r.type.name}</div><div className="text-[11px] text-gray-400" dir="ltr">{r.type.code}</div></div> },
    { key: 'p', label: 'البادئة', render: (r) => <input className="inp w-24" dir="ltr" value={cur(r).prefix} onChange={(e) => setEdit({ ...edit, [r.id]: { ...cur(r), prefix: e.target.value.toUpperCase() } })} /> },
    { key: 'n', label: 'الرقم التالي', render: (r) => <div className="w-32"><NumInput value={cur(r).next} onChange={(n) => setEdit({ ...edit, [r.id]: { ...cur(r), next: n } })} /></div> },
    { key: 's', label: 'الخانات', render: (r) => <div className="w-20"><NumInput value={cur(r).size} onChange={(n) => setEdit({ ...edit, [r.id]: { ...cur(r), size: n } })} /></div> },
    { key: 'e', label: 'مثال حي', render: (r) => <span className="font-medium text-navy" dir="ltr">{seriesExample(cur(r).prefix || '…', cur(r).next, cur(r).size)}</span> },
    { key: 'u', label: 'عقود قائمة', num: true, render: (r) => r.used },
    { key: 'x', label: '', render: (r) => (edit[r.id] ? <button type="button" className="btn btn-primary" onClick={() => save(r)}>حفظ</button> : null) },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'الترقيم' }]} title="سلاسل الترقيم" />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">صيغة الرقم <b dir="ltr">CTR-&#123;النوع&#125;-&#123;السنة&#125;-&#123;الرقم&#125;</b>. تغيير السلسلة يسري على العقود الجديدة فقط ولا يُعيد ترقيم القائمة؛ الرقم التالي لا يقل عن أعلى رقم مستخدم. الترقيم الفعلي من خدمة Core.</div>
      {err && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Card pad={false}><DataTable rows={rows} columns={cols} emptyTitle="لا أنواع" /></Card>
    </div>
  )
}
