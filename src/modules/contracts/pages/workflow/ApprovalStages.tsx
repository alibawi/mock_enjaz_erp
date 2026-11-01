import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { UserSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Async } from '../../components/states'
import { Badge, Card, Field, Modal, NumInput, Select } from '../../components/ui'
import { deleteStageRule, saveStageRule, validateRule } from '../../data/admin'
import { money } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { ApprovalStageRule, SubjectType } from '../../data/types'
import { useApi } from '../../lib/useApi'

const subj = { Contract: 'العقود', Amendment: 'الملاحق', Termination: 'الإنهاء' } as const
const blank = (): ApprovalStageRule => ({ id: `rule-${Math.random().toString(36).slice(2, 7)}`, name: '', subjectType: 'Contract', minValueIQD: 0, isActive: true, stages: [{ no: 1, label: 'المدير', userId: 'u-mgr' }] })

/** X4 — approval stage rules (Elsa simulation). Everyone with access can view; «إدارة الإعدادات» edits. Edits apply to new submissions only (BR-X-06). */
export default function ApprovalStages() {
  const { db, can, run } = useStore()
  const [dlg, setDlg] = useState<ApprovalStageRule | null>(null)
  const [isNew, setIsNew] = useState(false)
  const api = useApi(() => db.stageRules)
  const edit = can('Settings.Manage')
  const pending = (id: string) => db.approvalRequests.filter((q) => q.ruleId === id && q.status === 'Pending').length
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'مراحل الاعتماد' }]} title="مراحل الاعتماد (Elsa)"
        actions={<>{<button type="button" className="btn" disabled title="يُفتح مصمم Elsa من النظام الحقيقي">فتح مصمم سير العمل</button>}{edit && <button type="button" className="btn btn-primary" onClick={() => { setDlg(blank()); setIsNew(true) }}><Plus className="h-4 w-4" />مسار جديد</button>}</>} />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">في النظام الحقيقي تُصمَّم المسارات في Elsa وتُربط بالكيان إعداداً يدوياً؛ هنا جدول مبسّط للعرض. التعديل يسري على الطلبات الجديدة فقط، والطلبات المعلّقة تحتفظ بمراحلها. الحدود المالية توضيحية.</div>
      <Async state={api}>
        {(rules) => (
          <div className="space-y-3">
            {rules.map((r) => (
              <Card key={r.id} title={r.name} actions={<span className="flex items-center gap-2"><Badge tone="blue">{subj[r.subjectType]}</Badge>{r.isActive ? <Badge tone="green">فعّال</Badge> : <Badge tone="gray">معطّل</Badge>}{pending(r.id) > 0 && <Badge tone="amber">{pending(r.id)} معلّق</Badge>}
                {edit && <><button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" title="تعديل" onClick={() => { setDlg(structuredClone(r)); setIsNew(false) }}><Pencil className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="حذف" onClick={() => run((d) => deleteStageRule(d, r.id), 'حُذف المسار')}><Trash2 className="h-4 w-4" /></button></>}</span>}>
                <div className="mb-3 text-xs text-gray-500">القيمة (بالدينار): من {money(r.minValueIQD)} {r.maxValueIQD ? `إلى أقل من ${money(r.maxValueIQD)}` : 'فما فوق'}{r.typeId ? ` — نوع: ${db.contractTypes.find((t) => t.id === r.typeId)?.name}` : ''}{r.organizationId ? ` — منشأة: ${db.organizations.find((o) => o.id === r.organizationId)?.name}` : ''}</div>
                <ol className="flex flex-wrap items-center gap-2 text-sm">
                  {r.stages.map((s, i) => (
                    <li key={s.no} className="flex items-center gap-2">
                      <span className={`rounded-md border px-3 py-1.5 ${s.isLegalReview ? 'border-amber-300 bg-amber-50' : 'border-line bg-white'}`}>
                        <span className="text-[11px] text-gray-400">{s.no}.</span> {s.label}<span className="block text-[11px] text-gray-500">{userName(db, s.userId)}{s.isLegalReview ? ' · مراجعة قانونية' : ''}</span>
                      </span>
                      {i < r.stages.length - 1 && <ArrowLeft className="h-4 w-4 text-gray-300" />}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>)}
      </Async>
      {dlg && <RuleDialog rule={dlg} isNew={isNew} onClose={() => setDlg(null)} />}
    </div>
  )
}

function RuleDialog({ rule, isNew, onClose }: { rule: ApprovalStageRule; isNew: boolean; onClose: () => void }) {
  const { db, run } = useStore()
  const [r, setR] = useState(rule)
  const [err, setErr] = useState('')
  const issues = validateRule(db, r)
  const set = <K extends keyof ApprovalStageRule>(k: K, v: ApprovalStageRule[K]) => setR((x) => ({ ...x, [k]: v }))
  const stage = (i: number, patch: Partial<ApprovalStageRule['stages'][number]>) => set('stages', r.stages.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, dir: -1 | 1) => { const l = r.stages.slice(); const j = i + dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; set('stages', l) }
  const save = () => {
    let fl = ''
    const ok = run((d) => { const e = saveStageRule(d, r); if (e) fl = e; return e }, isNew ? 'أُضيف المسار' : 'حُفظ المسار — للطلبات الجديدة فقط')
    if (!ok) return setErr(fl)
    onClose()
  }
  return (
    <Modal wide title={isNew ? 'مسار اعتماد جديد' : `تعديل: ${rule.name}`} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" disabled={issues.length > 0} title={issues[0]} onClick={save}>حفظ</button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="اسم المسار" required span={2}><input className="inp" value={r.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="الموضوع"><Select value={r.subjectType} onChange={(v: SubjectType) => set('subjectType', v)} options={(Object.keys(subj) as SubjectType[]).map((k) => ({ value: k, label: subj[k] }))} /></Field>
          <Field label="القيمة من (د.ع)"><NumInput value={r.minValueIQD} onChange={(n) => set('minValueIQD', n)} /></Field>
          <Field label="إلى أقل من (فارغ = بلا حد)"><NumInput value={r.maxValueIQD ?? 0} onChange={(n) => set('maxValueIQD', n || undefined)} /></Field>
          <Field label="نوع العقد (اختياري)"><Select value={r.typeId ?? ''} placeholder="كل الأنواع" onChange={(v) => set('typeId', v || undefined)} options={db.contractTypes.map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="المنشأة (اختياري)"><Select value={r.organizationId ?? ''} placeholder="كل المنشآت" onChange={(v) => set('organizationId', v || undefined)} options={db.organizations.map((o) => ({ value: o.id, label: o.name }))} /></Field>
          <Field label="الحالة"><label className="flex h-8 items-center gap-2 text-sm"><input type="checkbox" checked={r.isActive} onChange={(e) => set('isActive', e.target.checked)} />فعّال</label></Field>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">المراحل<button type="button" className="btn" onClick={() => set('stages', [...r.stages, { no: r.stages.length + 1, label: '', userId: 'u-mgr' }])}><Plus className="h-4 w-4" />مرحلة</button></div>
          <div className="space-y-2">
            {r.stages.map((s, i) => (
              <div key={i} className="grid items-end gap-2 rounded border border-line p-2 md:grid-cols-6">
                <span className="self-center text-center text-sm text-gray-400">{i + 1}</span>
                <Field label="الاسم" span={2}><input className="inp" value={s.label} onChange={(e) => stage(i, { label: e.target.value })} /></Field>
                <Field label="المعتمد" span={2}><UserSelect value={s.userId} onChange={(v) => stage(i, { userId: v })} /></Field>
                <div className="flex items-center gap-1 text-gray-400">
                  <label className="me-1 flex items-center gap-1 text-[11px] text-gray-600"><input type="checkbox" checked={!!s.isLegalReview} onChange={(e) => stage(i, { isLegalReview: e.target.checked || undefined })} />قانونية</label>
                  <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={() => set('stages', r.stages.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>))}
          </div>
        </div>
        {issues.length > 0 && <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{issues.join(' — ')}</div>}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
