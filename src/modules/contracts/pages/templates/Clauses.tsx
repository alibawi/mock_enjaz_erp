import { useRef, useState } from 'react'
import { ListView, type Column } from '../../components/ListView'
import { FilterSelect } from '../../components/inputs'
import { Badge, Field, Modal, Select } from '../../components/ui'
import { fmtDateTime } from '../../data/format'
import { clauseCategories, clauseUsage, clauseVersions, currentClauseVersion, placeholderDefs, placeholdersIn, saveClause, validateClause } from '../../data/templates'
import { useStore } from '../../data/store'
import type { Clause } from '../../data/types'

/** T4 — clause library: list with usage, editor with placeholder chips and live validation, version history. */
export default function Clauses() {
  const { db, can } = useStore()
  const [sel, setSel] = useState<Clause | 'new' | null>(null)
  const [cat, setCat] = useState('')
  const rows = db.clauses.filter((c) => !cat || c.category === cat)
  const cols: Column<Clause>[] = [
    { key: 'code', label: 'الرمز', render: (c) => <span className="font-medium text-navy" dir="ltr">{c.code}</span> },
    { key: 't', label: 'العنوان', sort: (c) => c.title, render: (c) => <div><div className="font-medium">{c.title}</div><div className="line-clamp-1 max-w-[420px] text-[11px] text-gray-400">{currentClauseVersion(db, c.id)?.body}</div></div> },
    { key: 'c', label: 'التصنيف', render: (c) => <Badge tone="gray">{c.category}</Badge> },
    { key: 'v', label: 'الإصدار', num: true, render: (c) => `v${c.currentVersionNo}` },
    { key: 'ph', label: 'متغيرات', render: (c) => <span className="text-[11px] text-gray-500" dir="ltr">{placeholdersIn(currentClauseVersion(db, c.id)?.body ?? '').join(', ') || '—'}</span> },
    { key: 'u', label: 'عقود تستخدمه', num: true, sort: (c) => clauseUsage(db, c.id), render: (c) => clauseUsage(db, c.id) },
    { key: 'tp', label: 'قوالب', num: true, render: (c) => db.templates.filter((t) => t.draft.clauses.some((x) => x.clauseId === c.id)).length },
  ]
  return (
    <>
      <ListView title="مكتبة البنود" crumbs={[{ label: 'القوالب والطباعة' }, { label: 'البنود' }]} rows={rows} columns={cols} onRowClick={(c) => setSel(c)} onNew={() => setSel('new')} newLabel="بند جديد"
        canNew={can('Clauses.Manage')} canExport={false} searchText={(c) => `${c.code} ${c.title} ${currentClauseVersion(db, c.id)?.body}`}
        filters={<FilterSelect label="التصنيف" value={cat} onChange={setCat} options={clauseCategories.map((c) => ({ value: c, label: c }))} />} emptyTitle="لا بنود" />
      {sel && <ClauseDialog clause={sel === 'new' ? undefined : sel} onClose={() => setSel(null)} />}
    </>
  )
}

function ClauseDialog({ clause, onClose }: { clause?: Clause; onClose: () => void }) {
  const { db, run, can } = useStore()
  const cur = clause ? currentClauseVersion(db, clause.id) : undefined
  const [f, setF] = useState({ code: clause?.code ?? '', title: clause?.title ?? '', category: clause?.category ?? 'عام', body: cur?.body ?? '' })
  const [err, setErr] = useState('')
  const [viewV, setViewV] = useState<number | null>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const canEdit = can('Clauses.Manage')
  const issues = validateClause(f.body, f.title)
  const insert = (key: string) => {
    const el = ta.current, tag = `{{${key}}}`
    const s = el?.selectionStart ?? f.body.length, e = el?.selectionEnd ?? f.body.length
    setF((x) => ({ ...x, body: x.body.slice(0, s) + tag + x.body.slice(e) }))
  }
  const save = () => {
    let fl = ''
    const ok = run((d) => { const r = saveClause(d, { id: clause?.id, code: f.code, title: f.title, category: f.category, body: f.body }); if (typeof r === 'string') { fl = r; return r } return null }, clause ? 'نُشر إصدار جديد من البند' : 'أُضيف البند')
    if (!ok) return setErr(fl)
    onClose()
  }
  const versions = clause ? clauseVersions(db, clause.id) : []
  const shown = viewV ? versions.find((v) => v.versionNo === viewV) : undefined
  return (
    <Modal wide title={clause ? `${clause.code} — ${clause.title} (v${clause.currentVersionNo})` : 'بند جديد'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>إغلاق</button>{canEdit && <button type="button" className="btn btn-primary" disabled={issues.length > 0} onClick={save}>{clause ? `نشر إصدار ${clause.currentVersionNo + 1}` : 'حفظ'}</button>}</>}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <Field label="الرمز"><input className="inp" dir="ltr" disabled={!!clause || !canEdit} value={f.code} placeholder="تلقائي" onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="العنوان" required><input className="inp" disabled={!canEdit} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="التصنيف"><Select value={f.category} disabled={!canEdit} onChange={(v) => setF({ ...f, category: v })} options={clauseCategories.map((c) => ({ value: c, label: c }))} /></Field>
          </div>
          <Field label="نص البند (يدعم المتغيرات)" required>
            <textarea ref={ta} className="inp h-36 py-1.5 leading-7" disabled={!canEdit} value={f.body} onChange={(e) => { setF({ ...f, body: e.target.value }); setErr('') }} />
          </Field>
          {canEdit && <div className="flex flex-wrap gap-1">{placeholderDefs.map((p) => <button key={p.key} type="button" className="rounded border border-line bg-gray-50 px-1.5 py-0.5 text-[11px] hover:bg-gray-100" title={p.label} onClick={() => insert(p.key)}>{`{{${p.key}}}`}</button>)}</div>}
          {issues.length > 0 && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{issues.join(' — ')}</div>}
          {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          <p className="text-[11px] text-gray-400">النشر يحفظ إصداراً جديداً؛ العقود القائمة تحتفظ بنسختها المجمّدة من النص عند اختيار البند.</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-gray-600">الإصدارات</div>
          {versions.length === 0 ? <div className="text-xs text-gray-400">لا إصدارات بعد</div> : (
            <ul className="space-y-1">{versions.map((v) => <li key={v.id}><button type="button" onClick={() => setViewV(viewV === v.versionNo ? null : v.versionNo)} className={`w-full rounded border px-2 py-1.5 text-start text-xs ${viewV === v.versionNo ? 'border-navy bg-navy-50' : 'border-line hover:bg-gray-50'}`}>
              <b>v{v.versionNo}</b> <span className="text-gray-500">{fmtDateTime(v.publishedOn)}</span></button></li>)}</ul>)}
          {shown && <div className="mt-2 rounded bg-gray-50 p-2 text-xs leading-6 text-gray-700">{shown.body}</div>}
        </div>
      </div>
    </Modal>
  )
}
