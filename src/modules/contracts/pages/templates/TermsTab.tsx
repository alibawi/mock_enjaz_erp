import { ArrowDown, ArrowUp, Plus, Printer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { SearchableSelect } from '../../components/inputs'
import { Badge, Card, Field, Modal } from '../../components/ui'
import { addTerm, currentClauseVersion, moveTerm, removeTerm, resolveText, termsOf, toggleTerm } from '../../data/templates'
import { useStore } from '../../data/store'
import type { Contract } from '../../data/types'

/** T5 — legal terms tab: frozen clause copies with include toggles, free-text clauses and ordering while the contract is Draft. */
export function TermsTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [free, setFree] = useState(false)
  const terms = termsOf(db, c.id)
  const draft = c.status === 'Draft' && can('Contracts.Edit')
  const tv = c.templateVersionId ? db.templateVersions.find((v) => v.id === c.templateVersionId) : undefined
  const tpl = tv ? db.templates.find((t) => t.id === tv.templateId) : undefined
  const exec = (fn: (d: typeof db) => string | null, ok?: string) => run((d) => fn(d), ok)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <span>{tpl ? <>أُنشئ من القالب <b dir="ltr">{tpl.code}</b> الإصدار v{tv!.versionNo}{tpl.status === 'Archived' ? ' (مؤرشف)' : tpl.currentVersionNo > tv!.versionNo ? ` — يوجد إصدار أحدث v${tpl.currentVersionNo} لا يؤثر على هذا العقد` : ''}</> : 'عقد بلا قالب — بنوده خاصة أو مضافة من المكتبة'}</span>
        <Link className="btn" to={`/contracts/${c.id}/print`}><Printer className="h-4 w-4" />معاينة الطباعة</Link>
      </div>
      <Card title={`البنود القانونية (${terms.filter((t) => t.isIncluded).length} من ${terms.length})`} pad={false} actions={draft && (
        <div className="flex items-center gap-2">
          <div className="w-64"><SearchableSelect clearable={false} value="" placeholder="إضافة بند من المكتبة..." onChange={(id) => { const cl = db.clauses.find((x) => x.id === id); if (cl) exec((d) => addTerm(d, c.id, { title: cl.title, body: currentClauseVersion(d, cl.id).body, clauseVersionId: currentClauseVersion(d, cl.id).id }), 'نُسخ البند إلى العقد') }}
            options={db.clauses.filter((x) => x.isActive && !terms.some((t) => t.title === x.title)).map((x) => ({ value: x.id, label: x.title, hint: x.code }))} /></div>
          <button type="button" className="btn" onClick={() => setFree(true)}><Plus className="h-4 w-4" />بند خاص</button>
        </div>)}>
        {terms.length === 0 ? <div className="px-4 py-8 text-center text-sm text-gray-400">لا بنود قانونية. اختر قالباً عند إنشاء العقد أو أضف بنوداً من المكتبة.</div> : (
          <ol className="divide-y divide-line">
            {terms.map((t, i) => (
              <li key={t.id} className={`flex gap-3 px-4 py-3 ${t.isIncluded ? '' : 'opacity-50'}`}>
                <span className="mt-0.5 w-6 shrink-0 text-gray-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{t.title}{t.isFree && <Badge tone="blue">بند خاص</Badge>}{t.isOptional && !t.isFree && <Badge tone="gray">اختياري</Badge>}{!t.isIncluded && <Badge tone="amber">مستبعد</Badge>}</div>
                  <p className="mt-1 text-xs leading-6 text-gray-600">{resolveText(db, c, t.body)}</p>
                </div>
                {draft && (
                  <div className="flex shrink-0 items-start gap-0.5 text-gray-400">
                    {(t.isOptional || t.isFree) && <label className="me-2 flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={t.isIncluded} onChange={() => exec((d) => toggleTerm(d, t.id))} />تضمين</label>}
                    <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => exec((d) => moveTerm(d, t.id, -1))}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => exec((d) => moveTerm(d, t.id, 1))}><ArrowDown className="h-4 w-4" /></button>
                    {(t.isFree || t.isOptional) && <button type="button" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={() => exec((d) => removeTerm(d, t.id), 'حُذف البند')}><Trash2 className="h-4 w-4" /></button>}
                  </div>)}
              </li>))}
          </ol>)}
        <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">{c.status === 'Draft' ? 'يمكن تضمين/استبعاد البنود الاختيارية وترتيبها حتى إرسال العقد؛ النص المعروض بعد حلّ المتغيرات من بيانات العقد.' : 'البنود مجمّدة بعد المسودة؛ التعديل بملحق.'}</p>
      </Card>
      {free && <FreeDialog c={c} onClose={() => setFree(false)} />}
    </div>
  )
}

function FreeDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { run } = useStore()
  const [f, setF] = useState({ title: '', body: '' })
  const [err, setErr] = useState('')
  return (
    <Modal title="بند خاص بالعقد" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
      <button type="button" className="btn btn-primary" onClick={() => { let fl = ''; if (!run((d) => { const e = addTerm(d, c.id, f); if (e) fl = e; return e }, 'أُضيف البند الخاص')) return setErr(fl); onClose() }}>إضافة</button></>}>
      <div className="space-y-3">
        <Field label="العنوان" required><input className="inp" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="النص" required hint="يمكن استخدام المتغيرات مثل {{counterparty}} و{{value}}"><textarea className="inp h-28 py-1.5" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
