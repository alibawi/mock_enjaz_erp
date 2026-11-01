import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from '../../router'
import { ChipListEditor, SearchableSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { renewalLabel } from '../../data/contractMeta'
import { fmtDateTime } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { addAudit, useStore } from '../../data/store'
import {
  clauseOfVersion, currentClauseVersion, hasUnpublishedChanges, publishTemplate, saveTemplateDraft, setTemplateArchived, templateUsage, templateVersions, validateTemplate,
} from '../../data/templates'
import type { ContractTemplate, RenewalPolicy, TemplateVersion } from '../../data/types'
import { tplLabel, tplTone } from './Templates'

/** T2 + T3 — template working copy (defaults, clause picker with order/optional) and its immutable version history. */
export default function TemplateEditor() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const stored = db.templates.find((t) => t.id === id)
  const [t, setT] = useState<ContractTemplate | undefined>(stored && structuredClone(stored))
  const [view, setView] = useState<TemplateVersion | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (stored && !t) setT(structuredClone(stored)) }, [stored]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!stored || !t) return <EmptyBlock title="القالب غير موجود" />
  const canManage = can('Templates.Manage') && stored.status !== 'Archived'
  const versions = templateVersions(db, stored.id)
  const dirty = JSON.stringify(t.draft) !== JSON.stringify(stored.draft)
  const issues = validateTemplate(db, t)
  const df = t.draft.defaults
  const setD = <K extends keyof typeof df>(k: K, v: (typeof df)[K]) => setT({ ...t, draft: { ...t.draft, defaults: { ...df, [k]: v } } })
  const list = t.draft.clauses.slice().sort((a, b) => a.order - b.order)
  const setList = (l: typeof list) => setT({ ...t, draft: { ...t.draft, clauses: l.map((c, i) => ({ ...c, order: i + 1 })) } })
  const move = (i: number, dir: -1 | 1) => { const l = list.slice(); const j = i + dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setList(l) }
  const exec = (fn: (d: typeof db) => string | null, ok: string) => { let f = ''; if (!run((d) => { const e = fn(d); if (e) f = e; return e }, ok)) setErr(f); else setErr('') }
  const save = () => exec((d) => saveTemplateDraft(d, t), 'حُفظت مسودة القالب')
  const publish = () => exec((d) => { const e = saveTemplateDraft(d, t) ?? publishTemplate(d, t.id); if (!e) addAudit(d, 'template', t.id, 'publish', `v${d.templates.find((x) => x.id === t.id)!.currentVersionNo}`); return e }, 'نُشر إصدار جديد من القالب')
  const unpublished = hasUnpublishedChanges(db, { ...t })

  return (
    <div>
      <PageHeader crumbs={[{ label: 'القوالب', to: '/templates' }, { label: t.code }]} title={t.name} badge={<Badge tone={tplTone[stored.status]}>{tplLabel[stored.status]}</Badge>}
        actions={canManage && <>
          <button type="button" className="btn" disabled={!dirty} onClick={save}>حفظ المسودة</button>
          <button type="button" className="btn btn-primary" disabled={issues.length > 0 || (!unpublished && !dirty)} title={issues[0]} onClick={publish}>نشر إصدار {stored.currentVersionNo + 1}</button>
          <button type="button" className="btn" onClick={() => exec((d) => setTemplateArchived(d, t.id, true), 'أُرشف القالب')}>أرشفة</button></>}
      />
      {stored.status === 'Archived' && <div className="mb-3 flex items-center justify-between rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">القالب مؤرشف: لا يُختار لعقود جديدة، ويبقى ظاهراً على العقود التي استخدمته.{can('Templates.Manage') && <button type="button" className="btn" onClick={() => exec((d) => setTemplateArchived(d, t.id, false), 'أُعيد تفعيل القالب')}>إلغاء الأرشفة</button>}</div>}
      {err && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">النشر ينشئ إصداراً جديداً ولا يغيّر الإصدارات السابقة ولا العقود المنشأة منها؛ العقد ينسخ البنود وقت إنشائه ولا يرتبط بالقالب لاحقاً. {templateUsage(db, stored.id)} عقد أُنشئ من هذا القالب.</div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="القيم الافتراضية للعقد الجديد">
            <FormGrid>
              <Field label="المدة (شهر)"><NumInput value={df.durationMonths ?? 0} disabled={!canManage} onChange={(n) => setD('durationMonths', n || undefined)} /></Field>
              <Field label="سياسة التجديد"><Select value={df.renewalPolicy ?? ''} placeholder="—" disabled={!canManage} onChange={(v: RenewalPolicy) => setD('renewalPolicy', v || undefined)} options={(Object.keys(renewalLabel) as RenewalPolicy[]).map((k) => ({ value: k, label: renewalLabel[k] }))} /></Field>
              <Field label="مدة الإشعار (يوم)"><NumInput value={df.noticePeriodDays ?? 0} disabled={!canManage} onChange={(n) => setD('noticePeriodDays', n || undefined)} /></Field>
              <Field label="شرط الدفع"><Select value={df.paymentTermId ?? ''} placeholder="—" disabled={!canManage} onChange={(v) => setD('paymentTermId', v || undefined)} options={db.paymentTerms.map((p) => ({ value: p.id, label: p.name }))} /></Field>
              <Field label="مسار الاعتماد (وصف)"><input className="inp" disabled={!canManage} value={df.approvalWorkflowLabel ?? ''} onChange={(e) => setD('approvalWorkflowLabel', e.target.value || undefined)} /></Field>
              <Field label="شروط التسليم" span={3}><input className="inp" disabled={!canManage} value={df.deliveryTerms ?? ''} onChange={(e) => setD('deliveryTerms', e.target.value || undefined)} /></Field>
              <Field label="افتراضيات الفوترة" span={2}><input className="inp" disabled={!canManage} value={df.billingDefaults ?? ''} onChange={(e) => setD('billingDefaults', e.target.value || undefined)} /></Field>
              <Field label="افتراضيات مستوى الخدمة" span={2}><input className="inp" disabled={!canManage} value={df.slaDefaults ?? ''} onChange={(e) => setD('slaDefaults', e.target.value || undefined)} /></Field>
              <Field label="مرفقات القالب (أسماء)" span={5}><ChipListEditor values={t.draft.attachments} disabled={!canManage} onChange={(v) => setT({ ...t, draft: { ...t.draft, attachments: v } })} placeholder="اسم الملف ثم Enter" /></Field>
            </FormGrid>
          </Card>
          <Card title={`البنود (${list.length})`} pad={false} actions={canManage && (
            <div className="w-72"><SearchableSelect clearable={false} value="" placeholder="إضافة بند من المكتبة..." onChange={(cid) => cid && setList([...list, { clauseId: cid, order: list.length + 1, isOptional: false }])}
              options={db.clauses.filter((c) => c.isActive && !list.some((x) => x.clauseId === c.id)).map((c) => ({ value: c.id, label: c.title, hint: c.code }))} /></div>)}>
            <table className="w-full text-sm">
              <tbody>
                {list.map((r, i) => {
                  const c = db.clauses.find((x) => x.id === r.clauseId)!
                  const cur = currentClauseVersion(db, c.id)
                  return (
                    <tr key={r.clauseId} className="border-b border-gray-100">
                      <td className="w-8 px-3 py-2 text-gray-400">{i + 1}</td>
                      <td><div className="font-medium">{c.title}</div><div className="line-clamp-1 max-w-[420px] text-[11px] text-gray-400">{cur.body}</div></td>
                      <td className="text-xs text-gray-500"><span dir="ltr">{c.code}</span> · v{cur.versionNo}</td>
                      <td><label className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={!canManage} checked={r.isOptional} onChange={(e) => setList(list.map((x) => (x.clauseId === r.clauseId ? { ...x, isOptional: e.target.checked } : x)))} />اختياري</label></td>
                      <td className="pe-3 text-end">{canManage && <span className="inline-flex gap-0.5 text-gray-400">
                        <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={() => setList(list.filter((x) => x.clauseId !== r.clauseId))}><Trash2 className="h-4 w-4" /></button></span>}</td>
                    </tr>)
                })}
                {list.length === 0 && <tr><td className="py-6 text-center text-gray-400"><Plus className="mx-auto h-4 w-4" />أضف بنوداً من المكتبة</td></tr>}
              </tbody>
            </table>
            {issues.length > 0 && <div className="border-t border-line px-4 py-2 text-xs text-red-600">{issues.join(' — ')}</div>}
          </Card>
        </div>
        <Card title="إصدارات القالب" pad={false}>
          {versions.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">لم يُنشر بعد</div> : (
            <ul className="divide-y divide-line">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div><div className="font-semibold">v{v.versionNo}{v.versionNo === stored.currentVersionNo && <span className="ms-1 text-[11px] font-normal text-emerald-700">الحالي</span>}</div>
                    <div className="text-[11px] text-gray-500">{fmtDateTime(v.publishedOn)} — {userName(db, v.publishedBy)} · {v.clauseRefs.length} بند</div></div>
                  <button type="button" className="btn" onClick={() => setView(v)}>عرض</button>
                </li>))}
            </ul>)}
        </Card>
      </div>
      {view && (
        <Modal wide title={`${stored.code} — الإصدار v${view.versionNo} (للقراءة فقط)`} onClose={() => setView(null)} footer={<button type="button" className="btn" onClick={() => setView(null)}>إغلاق</button>}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">{Object.entries(view.defaults).map(([k, x]) => <div key={k}><span className="text-gray-500">{k}: </span>{String(x)}</div>)}</div>
            <ol className="space-y-2">{view.clauseRefs.map((r) => { const cv = db.clauseVersions.find((x) => x.id === r.clauseVersionId)!; const cl = clauseOfVersion(db, cv.id)!
              return <li key={r.clauseVersionId} className="rounded border border-line p-2"><div className="flex justify-between font-medium">{r.order}. {cl.title}<span className="text-[11px] font-normal text-gray-400" dir="ltr">{cl.code} v{cv.versionNo}{r.isOptional ? ' · optional' : ''}</span></div><p className="mt-1 text-xs leading-6 text-gray-600">{cv.body}</p></li> })}</ol>
          </div>
        </Modal>)}
    </div>
  )
}
