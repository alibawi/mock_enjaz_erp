import { useState } from 'react'
import { useNavigate } from '../../router'
import { KPICard } from '../../components/display'
import { ListView, type Column } from '../../components/ListView'
import { Badge, Field, Modal, Select } from '../../components/ui'
import { fmtDate } from '../../data/format'
import { clauseUsage, createTemplate, hasUnpublishedChanges, templateUsage, templateVersions } from '../../data/templates'
import { useStore } from '../../data/store'
import type { ContractTemplate } from '../../data/types'
import { useApi } from '../../lib/useApi'

export const tplTone = { Draft: 'gray', Published: 'green', Archived: 'amber' } as const
export const tplLabel = { Draft: 'مسودة', Published: 'منشور', Archived: 'مؤرشف' } as const

/** T1 — templates list with version, usage and status, plus the module KPIs. */
export default function Templates() {
  const { db, can } = useStore()
  const nav = useNavigate()
  const [dlg, setDlg] = useState(false)
  const api = useApi(() => {
    const quarterStart = `${db.asOf.slice(0, 4)}-${String(Math.floor((Number(db.asOf.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
    const tplContracts = db.contracts.filter((c) => c.templateVersionId)
    const topClause = db.clauses.map((c) => ({ c, n: clauseUsage(db, c.id) })).sort((a, b) => b.n - a.n)[0]
    return {
      rows: db.templates.slice(), tplContracts: tplContracts.length, quarter: tplContracts.filter((c) => c.createdAt.slice(0, 10) >= quarterStart).length, topClause,
      topTemplate: db.templates.map((t) => ({ t, n: templateUsage(db, t.id) })).sort((a, b) => b.n - a.n)[0],
    }
  })
  const cols: Column<ContractTemplate>[] = [
    { key: 'code', label: 'الرمز', render: (t) => <span className="font-medium text-navy" dir="ltr">{t.code}</span> },
    { key: 'name', label: 'القالب', sort: (t) => t.name, render: (t) => t.name },
    { key: 'type', label: 'نوع العقد', render: (t) => db.contractTypes.find((x) => x.id === t.typeId)?.name },
    { key: 'ver', label: 'الإصدار', render: (t) => (t.currentVersionNo ? `v${t.currentVersionNo}` : '—') },
    { key: 'cl', label: 'البنود', num: true, render: (t) => (templateVersions(db, t.id)[0]?.clauseRefs.length ?? t.draft.clauses.length) },
    { key: 'use', label: 'عقود منشأة منه', num: true, sort: (t) => templateUsage(db, t.id), render: (t) => templateUsage(db, t.id) },
    { key: 'st', label: 'الحالة', render: (t) => <div className="flex flex-col gap-0.5"><Badge tone={tplTone[t.status]}>{tplLabel[t.status]}</Badge>{t.status === 'Published' && hasUnpublishedChanges(db, t) && <span className="text-[10px] text-amber-600">تغييرات غير منشورة</span>}</div> },
    { key: 'pub', label: 'آخر نشر', render: (t) => fmtDate(templateVersions(db, t.id)[0]?.publishedOn) },
  ]
  return (
    <>
      {api.data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPICard label="عقود أُنشئت من قوالب" value={api.data.tplContracts} /><KPICard label="خلال هذا الربع" value={api.data.quarter} tone="blue" />
          <KPICard label="الأكثر استخداماً (قالب)" value={api.data.topTemplate?.t.code ?? '—'} hint={api.data.topTemplate ? `${api.data.topTemplate.n} عقد` : undefined} />
          <KPICard label="الأكثر استخداماً (بند)" value={api.data.topClause?.c.code ?? '—'} hint={api.data.topClause ? `${api.data.topClause.c.title} — ${api.data.topClause.n} عقد` : undefined} />
        </div>)}
      <ListView title="قوالب العقود" crumbs={[{ label: 'القوالب والطباعة' }, { label: 'القوالب' }]} rows={api.data?.rows ?? []} columns={cols} rowTo={(t) => `/templates/${t.id}`}
        loading={api.loading} error={api.error} onRetry={api.reload} onNew={() => setDlg(true)} newLabel="قالب جديد" canNew={can('Templates.Manage')} canExport={false}
        searchText={(t) => `${t.code} ${t.name}`} emptyTitle="لا قوالب" />
      {dlg && <NewDialog onClose={() => setDlg(false)} onDone={(id) => nav(`/templates/${id}`)} />}
    </>
  )
}

function NewDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { db, run } = useStore()
  const [f, setF] = useState({ name: '', code: '', typeId: '' })
  const [err, setErr] = useState('')
  const go = () => {
    let id = '', fl = ''
    const ok = run((d) => { const r = createTemplate(d, f.name, f.code, f.typeId); if (typeof r === 'string') { fl = r; return r } id = r.id; return null }, 'أُنشئ القالب كمسودة')
    if (!ok) return setErr(fl)
    onClose(); onDone(id)
  }
  return (
    <Modal title="قالب جديد" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={go}>إنشاء</button></>}>
      <div className="space-y-3">
        <Field label="اسم القالب" required><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="الرمز" required><input className="inp" dir="ltr" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="TPL-XXX" /></Field>
        <Field label="نوع العقد" required><Select value={f.typeId} placeholder="اختر" onChange={(v) => setF({ ...f, typeId: v })} options={db.contractTypes.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))} /></Field>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
