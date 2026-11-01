import { Check, Pencil, Play, Plus, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '../../components/DataTable'
import { ChipListEditor, DateInput, EmployeeSelect } from '../../components/inputs'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { fmtDate, money } from '../../data/format'
import {
  completeObligation, completeOccurrence, daysLate, decideAcceptance, dependencyBlocker, effStatus, isOpen, kindLabel, newObligation, occurrenceStatus, penaltyLabel, penaltyOf,
  saveObligation, startObligation, statusLabel, statusTone, waiveObligation,
} from '../../data/obligations'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { Contract, Obligation, ObligationKind, PenaltyType } from '../../data/types'

export const StatusBadge = ({ o }: { o: Pick<Obligation, 'status' | 'dueDate' | 'recurrence'> }) => { const s = effStatus(o); return <Badge tone={statusTone[s]}>{statusLabel[s]}</Badge> }
const FILTERS = [['all', 'الكل'], ['open', 'مفتوحة'], ['overdue', 'متأخرة'], ['done', 'منجزة']] as const

/** Actions a row offers to the current user (shared by the tab and the board). */
export function useObligationActions() {
  const { db, run, can, user } = useStore()
  const exec = (fn: (d: typeof db) => string | null, ok: string) => run((d) => fn(d), ok)
  const mine = (o: Obligation) => can('Obligations.Manage') || (can('Obligations.Complete') && user.employeeId === o.responsibleEmployeeId)
  return {
    start: (o: Obligation) => exec((d) => startObligation(d, o.id), 'بدأ التنفيذ'),
    complete: (o: Obligation) => exec((d) => completeObligation(d, o.id), 'سُجّل الإنجاز'),
    accept: (o: Obligation) => exec((d) => decideAcceptance(d, o.id, true), 'قُبل الإنجاز'),
    reject: (o: Obligation, reason: string) => exec((d) => decideAcceptance(d, o.id, false, reason), 'رُفض الإنجاز وأُعيد للعمل'),
    waive: (o: Obligation) => exec((d) => waiveObligation(d, o.id), 'تُنوزل عن الالتزام'),
    mine, canAccept: can('Obligations.Accept'), canManage: can('Obligations.Manage'),
  }
}

/** O1 — obligations of the contract with quick actions; recurring ones list their occurrences below. */
export function ObligationsTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const act = useObligationActions()
  const [f, setF] = useState<(typeof FILTERS)[number][0]>('all')
  const [dlg, setDlg] = useState<Obligation | 'new' | null>(null)
  const [rej, setRej] = useState<Obligation | null>(null)
  const [reason, setReason] = useState('')
  const all = db.obligations.filter((o) => o.contractId === c.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const rows = all.filter((o) => f === 'all' || (f === 'open' && isOpen(o)) || (f === 'overdue' && effStatus(o) === 'Overdue') || (f === 'done' && ['Accepted', 'Waived', 'Cancelled'].includes(o.status)))
  const editable = !['Cancelled', 'Closed'].includes(c.status) && can('Obligations.Manage')
  const occ = db.occurrences.filter((x) => all.some((o) => o.id === x.obligationId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const cols: Column<Obligation>[] = [
    { key: 't', label: 'الالتزام', render: (o) => <div><div className="font-medium">{o.title}</div><div className="text-[11px] text-gray-400">{kindLabel[o.kind]}{o.recurrence ? ' · متكرر' : ''}{o.dependsOnId ? ` · يعتمد على: ${db.obligations.find((x) => x.id === o.dependsOnId)?.title}` : ''}</div></div> },
    { key: 'd', label: 'الاستحقاق', render: (o) => fmtDate(o.dueDate) },
    { key: 'r', label: 'المسؤول', render: (o) => <div className="text-xs">{db.employees.find((e) => e.id === o.responsibleEmployeeId)?.name ?? '—'}<div className="text-gray-400">{o.responsibleDepartment}</div></div> },
    { key: 's', label: 'الحالة', render: (o) => <div><StatusBadge o={o} />{o.completedBy && <div className="mt-0.5 text-[10px] text-gray-400">أنجزه {userName(db, o.completedBy)}</div>}</div> },
    { key: 'p', label: 'الغرامة (عرض فقط)', num: true, render: (o) => { const p = penaltyOf(o); return p ? <span className="text-red-600" title={`${daysLate(o)} يوم تأخير`}>{money(p, c.currency)}</span> : <span className="text-gray-300">—</span> } },
    {
      key: 'x', label: '', render: (o) => {
        const blocked = dependencyBlocker(db, o)
        return (
          <div className="flex flex-wrap gap-1">
            {['Planned', 'Rejected'].includes(o.status) && act.mine(o) && <button type="button" className="btn" disabled={!!blocked} title={blocked} onClick={() => act.start(o)}><Play className="h-3.5 w-3.5" />بدء</button>}
            {['Planned', 'InProgress', 'Rejected'].includes(o.status) && act.mine(o) && <button type="button" className="btn btn-primary" disabled={!!blocked} title={blocked} onClick={() => act.complete(o)}><Check className="h-3.5 w-3.5" />إنجاز</button>}
            {o.status === 'Completed' && act.canAccept && <button type="button" className="btn btn-primary" onClick={() => act.accept(o)}>قبول</button>}
            {o.status === 'Completed' && act.canAccept && <button type="button" className="btn btn-danger" onClick={() => { setRej(o); setReason('') }}><Undo2 className="h-3.5 w-3.5" />رفض</button>}
            {['Planned', 'InProgress', 'Rejected'].includes(o.status) && act.canManage && <button type="button" className="btn" onClick={() => act.waive(o)}>تنازل</button>}
            {editable && isOpen(o) && <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" title="تعديل" onClick={() => setDlg(o)}><Pencil className="h-4 w-4" /></button>}
          </div>)
      },
    },
  ]
  return (
    <div className="space-y-4">
      <Card title={`الالتزامات (${all.length})`} pad={false} actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-line text-xs">{FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setF(k)} className={`px-2.5 py-1 ${f === k ? 'bg-navy text-white' : 'text-gray-600'}`}>{l}</button>)}</div>
          {editable && <button type="button" className="btn btn-primary" onClick={() => setDlg('new')}><Plus className="h-4 w-4" />التزام جديد</button>}
        </div>}>
        <DataTable rows={rows} columns={cols} emptyTitle="لا التزامات" emptyHint="أضف مخرجات ومراحل وتقارير وغرامات التأخير الخاصة بالعقد." />
        <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">التأخر يُحتسب من تاريخ الاستحقاق والتاريخ التجريبي. الغرامات للعرض فقط ولا تُرحَّل محاسبياً. من أنجز الالتزام لا يقبله بنفسه.</p>
      </Card>
      {occ.length > 0 && (
        <Card title="أحداث الالتزامات المتكررة" pad={false}>
          <table className="w-full text-sm">
            <tbody>
              {occ.map((x) => {
                const o = all.find((y) => y.id === x.obligationId)!
                const st = occurrenceStatus(x)
                return (
                  <tr key={x.id} className="border-b border-gray-100">
                    <td className="px-4 py-2">{o.title}</td><td>{fmtDate(x.dueDate)}</td>
                    <td><Badge tone={st === 'Overdue' ? 'red' : st === 'Completed' ? 'green' : 'gray'}>{st === 'Overdue' ? 'متأخر' : st === 'Completed' ? `أُنجز ${fmtDate(x.completedOn)}` : st === 'Waived' ? 'ملغى' : 'مخطط'}</Badge></td>
                    <td className="pe-4 text-end">{x.status === 'Planned' && act.mine(o) && <button type="button" className="btn" onClick={() => run((d) => completeOccurrence(d, x.id), 'أُنجز الحدث')}>إنجاز</button>}</td>
                  </tr>)
              })}
            </tbody>
          </table>
        </Card>)}
      {dlg && <ObligationDialog c={c} o={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} />}
      {rej && (
        <Modal title={`رفض إنجاز: ${rej.title}`} onClose={() => setRej(null)} footer={<><button type="button" className="btn" onClick={() => setRej(null)}>تراجع</button>
          <button type="button" className="btn btn-danger" disabled={!reason.trim()} onClick={() => { act.reject(rej, reason); setRej(null) }}><X className="h-4 w-4" />رفض</button></>}>
          <Field label="سبب الرفض" required><textarea className="inp h-20 py-1.5" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </Modal>)}
    </div>
  )
}

/** O2 — full obligation dialog: recurrence, dependency, penalty, linked payment, attachments. */
export function ObligationDialog({ c, o, onClose }: { c: Contract; o?: Obligation; onClose: () => void }) {
  const { db, run, user } = useStore()
  const [f, setF] = useState<Obligation>(o ?? newObligation(c.id, user.id))
  const [rec, setRec] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>(o?.recurrence?.freq ?? 'none')
  const [err, setErr] = useState('')
  const set = <K extends keyof Obligation>(k: K, v: Obligation[K]) => setF((x) => ({ ...x, [k]: v }))
  const others = db.obligations.filter((x) => x.contractId === c.id && x.id !== f.id)
  const items = db.paymentItems.filter((p) => p.contractId === c.id)
  const save = () => {
    const next = { ...f, recurrence: rec === 'none' ? undefined : { ...(f.recurrence ?? {}), freq: rec } }
    let failure = ''
    const ok = run((d) => { const e = saveObligation(d, next); if (e) failure = e; return e }, o ? 'حُدّث الالتزام' : 'أُضيف الالتزام')
    if (!ok) return setErr(failure)
    onClose()
  }
  return (
    <Modal wide title={o ? 'تعديل الالتزام' : 'التزام جديد'} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>حفظ</button></>}>
      <div className="space-y-3">
        <FormGrid>
          <Field label="النوع"><Select value={f.kind} onChange={(v: ObligationKind) => set('kind', v)} options={(Object.keys(kindLabel) as ObligationKind[]).map((k) => ({ value: k, label: kindLabel[k] }))} /></Field>
          <Field label="العنوان" span={2} required><input className="inp" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="تاريخ الاستحقاق" required><DateInput value={f.dueDate} onChange={(v) => set('dueDate', v)} /></Field>
          <Field label="الموظف المسؤول"><EmployeeSelect value={f.responsibleEmployeeId ?? ''} onChange={(v) => { const e = db.employees.find((x) => x.id === v); setF((x) => ({ ...x, responsibleEmployeeId: v || undefined, responsibleDepartment: e?.department ?? x.responsibleDepartment })) }} /></Field>
          <Field label="الإدارة"><input className="inp" value={f.responsibleDepartment ?? ''} onChange={(e) => set('responsibleDepartment', e.target.value)} /></Field>
          <Field label="الكمية"><NumInput value={f.quantity ?? 0} onChange={(n) => set('quantity', n || undefined)} /></Field>
          <Field label={`القيمة (${c.currency})`}><NumInput value={f.value ?? 0} onChange={(n) => set('value', n || undefined)} /></Field>
          <Field label="خيارات">
            <div className="flex flex-col gap-1 text-xs">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.acceptanceRequired} onChange={(e) => set('acceptanceRequired', e.target.checked)} />يتطلب قبولاً</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.survivesTermination} onChange={(e) => set('survivesTermination', e.target.checked)} />يبقى بعد الإنهاء</label>
            </div>
          </Field>
          <Field label="الغرامة"><Select value={f.penaltyType} onChange={(v: PenaltyType) => set('penaltyType', v)} options={(Object.keys(penaltyLabel) as PenaltyType[]).map((k) => ({ value: k, label: penaltyLabel[k] }))} /></Field>
          <Field label={f.penaltyType === 'PercentPerDay' ? 'النسبة % لكل يوم' : 'المبلغ'}><NumInput value={f.penaltyRate ?? 0} disabled={f.penaltyType === 'None'} onChange={(n) => set('penaltyRate', n || undefined)} /></Field>
          <Field label="سقف الغرامة"><NumInput value={f.penaltyCap ?? 0} disabled={f.penaltyType === 'None'} onChange={(n) => set('penaltyCap', n || undefined)} /></Field>
          <Field label="التكرار"><Select value={rec} onChange={setRec} options={[{ value: 'none', label: 'بلا تكرار' }, { value: 'daily', label: 'يومي' }, { value: 'weekly', label: 'أسبوعي' }, { value: 'monthly', label: 'شهري' }, { value: 'yearly', label: 'سنوي' }]} /></Field>
          <Field label="عدد المرات"><NumInput value={f.recurrence?.count ?? 0} disabled={rec === 'none'} onChange={(n) => setF((x) => ({ ...x, recurrence: { freq: rec === 'none' ? 'monthly' : rec, ...x.recurrence, count: n || undefined } }))} /></Field>
          <Field label="أو حتى تاريخ"><DateInput value={f.recurrence?.until ?? ''} disabled={rec === 'none'} onChange={(v) => setF((x) => ({ ...x, recurrence: { freq: rec === 'none' ? 'monthly' : rec, ...x.recurrence, until: v || undefined } }))} /></Field>
          <Field label="يعتمد على التزام" span={2}><Select value={f.dependsOnId ?? ''} placeholder="— لا اعتماد —" onChange={(v) => set('dependsOnId', v || undefined)} options={others.map((x) => ({ value: x.id, label: x.title }))} /></Field>
          <Field label="دفعة مرتبطة" span={2}><Select value={f.linkedPaymentItemId ?? ''} placeholder="— بلا —" onChange={(v) => set('linkedPaymentItemId', v || undefined)} options={items.map((p) => ({ value: p.id, label: `دفعة ${p.itemNo}: ${money(p.amount, p.currency)} — ${p.dueDate}` }))} /></Field>
          <Field label="الوصف" span={5}><input className="inp" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="مرفقات (أسماء الملفات — محاكاة)" span={5}><ChipListEditor values={f.attachments} onChange={(v) => set('attachments', v)} placeholder="اسم الملف ثم Enter" /></Field>
        </FormGrid>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
