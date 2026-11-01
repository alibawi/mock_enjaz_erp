import { CheckCircle2, ClipboardCheck, Clock, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { KPICard } from '../../components/display'
import { type Column } from '../../components/DataTable'
import { ListView } from '../../components/ListView'
import { Field, Modal, Tabs } from '../../components/ui'
import { delegationFor, eligibility, tasksFor } from '../../data/approval'
import { daysTo, fmtDate, money } from '../../data/format'
import { decideAmendment } from '../../data/amendments'
import { perform, userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { TaskItem } from '../../data/types'
import { useApi } from '../../lib/useApi'

type Row = TaskItem & { number: string; contractTitle: string; value: string; delegated?: string; blocked?: string }

/** W2 — my tasks: open approval tasks assigned to me or delegated to me; approve / reject with a comment. */
export default function Tasks() {
  const { db, run, can } = useStore()
  const [tab, setTab] = useState<'mine' | 'all' | 'done'>('mine')
  const [dlg, setDlg] = useState<{ t: Row; decision: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')

  const api = useApi(() => {
    const decorate = (t: TaskItem): Row => {
      const c = db.contracts.find((x) => x.id === t.contractId)!
      const req = db.approvalRequests.find((r) => r.id === t.requestId)
      const el = eligibility(db, req, db.userId)
      const delegated = t.assignedUserId !== db.userId && delegationFor(db, t.assignedUserId, db.userId, c) ? userName(db, t.assignedUserId) : undefined
      return { ...t, number: c.number, contractTitle: c.title, value: c.contractValue ? money(c.contractValue, c.currency) : '—', delegated, blocked: t.status === 'Open' && !el.ok ? el.reason : undefined }
    }
    const mine = tasksFor(db, db.userId).map(decorate)
    const all = db.tasks.filter((t) => t.status === 'Open').map(decorate)
    const done = db.tasks.filter((t) => t.status === 'Completed' && (t.assignedUserId === db.userId || db.approvalActions.some((a) => a.taskId === t.id && a.approverUserId === db.userId))).map(decorate)
    const times = db.approvalRequests.filter((r) => r.status === 'Approved' && r.completedAt).map((r) => daysTo(r.completedAt!.slice(0, 10), r.submittedAt.slice(0, 10)))
    const waiting: Record<number, number> = {}
    db.approvalRequests.filter((r) => r.status === 'Pending').forEach((r) => { waiting[r.currentStage] = (waiting[r.currentStage] ?? 0) + 1 })
    return { mine, all, done, avg: times.length ? times.reduce((s, x) => s + x, 0) / times.length : 0, waiting }
  })

  const rows = tab === 'mine' ? api.data?.mine : tab === 'all' ? api.data?.all : api.data?.done
  const cols: Column<Row>[] = [
    { key: 'task', label: 'المهمة', sort: (r) => r.title, render: (r) => <div><div className="font-medium text-gray-900">{r.title}</div>{r.delegated && <div className="text-[11px] text-amber-600">بالنيابة عن {r.delegated}</div>}</div> },
    { key: 'contract', label: 'العقد', render: (r) => <Link className="text-navy underline" to={`/contracts/${r.contractId}`}><div dir="ltr" className="text-start">{r.number}</div><div className="max-w-[260px] truncate text-[11px] text-gray-500">{r.contractTitle}</div></Link> },
    { key: 'value', label: 'القيمة', num: true, render: (r) => r.value },
    { key: 'who', label: 'المُسنَد إليه', render: (r) => userName(db, r.assignedUserId) },
    { key: 'since', label: 'منذ / اكتملت', render: (r) => (r.status === 'Open' ? `${daysTo(db.asOf, r.createdAt.slice(0, 10))} يوم` : fmtDate(r.completedAt)) },
    { key: 'res', label: 'النتيجة', render: (r) => (r.status === 'Open' ? <span className="text-amber-600">مفتوحة</span> : r.result === 'Approved' ? <span className="text-emerald-600">اعتُمد</span> : <span className="text-red-600">رُفض</span>) },
    { key: 'act', label: '', render: (r) => r.status !== 'Open' ? null : (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-primary" disabled={!can('Contracts.Approve') || !!r.blocked} title={r.blocked} onClick={() => { setDlg({ t: r, decision: 'approve' }); setComment(''); setErr('') }}>اعتماد</button>
        <button type="button" className="btn btn-danger" disabled={!can('Contracts.Reject') || !!r.blocked} title={r.blocked} onClick={() => { setDlg({ t: r, decision: 'reject' }); setComment(''); setErr('') }}>رفض</button>
      </div>) },
  ]

  const submit = () => {
    if (!dlg) return
    if (dlg.decision === 'reject' && !comment.trim()) return setErr('سبب الرفض مطلوب')
    let failure = ''
    const ok = run((d) => { const e = dlg.t.subjectType === 'Amendment' ? decideAmendment(d, d.approvalRequests.find((r) => r.id === dlg.t.requestId)!.subjectId, dlg.decision === 'approve' ? 'Approved' : 'Rejected', comment) : perform(d, dlg.t.contractId, dlg.decision, { reason: comment }); if (e) failure = e; return e }, dlg.decision === 'approve' ? 'سُجّل الاعتماد' : 'رُفض الطلب')
    if (!ok) return setErr(failure)
    setDlg(null)
  }

  return (
    <>
      <ListView
        title="مهامي (الاعتماد)" crumbs={[{ label: 'مهامي' }]} rows={rows ?? []} columns={cols} rowTo={(r) => `/contracts/${r.contractId}`}
        loading={api.loading} error={api.error} onRetry={api.reload} canNew={false} canExport={false} searchText={(r) => `${r.title} ${r.number} ${r.contractTitle}`}
        tabs={<Tabs active={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'مفتوحة لي', count: api.data?.mine.length }, { id: 'all', label: 'كل المهام المفتوحة', count: api.data?.all.length }, { id: 'done', label: 'المكتملة' }]} />}
        emptyTitle={tab === 'mine' ? 'لا مهام اعتماد بانتظارك' : 'لا مهام'} emptyHint="بدّل المستخدم من الشريط العلوي (مثلاً المدير المالي) لتظهر مهام مرحلته."
      />
      {api.data && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPICard label="مهامي المفتوحة" value={api.data.mine.length} icon={ClipboardCheck} tone={api.data.mine.length ? 'amber' : 'gray'} />
          <KPICard label="طلبات اعتماد قيد المسار" value={Object.values(api.data.waiting).reduce((s, x) => s + x, 0)} icon={Clock} hint={Object.entries(api.data.waiting).map(([k, v]) => `م${k}: ${v}`).join(' · ') || undefined} />
          <KPICard label="متوسط مدة الاعتماد" value={`${api.data.avg.toFixed(1)} يوم`} icon={CheckCircle2} tone="green" />
          <KPICard label="طلبات اعتماد مرفوضة" value={db.approvalRequests.filter((r) => r.status === 'Rejected').length} icon={XCircle} tone="red" />
        </div>
      )}
      {dlg && (
        <Modal title={`${dlg.decision === 'approve' ? 'اعتماد' : 'رفض'} — ${dlg.t.number}`} onClose={() => setDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
            <button type="button" className={`btn ${dlg.decision === 'reject' ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}`} onClick={submit}>تأكيد</button></>}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{dlg.t.title}</p>
            <Field label={dlg.decision === 'reject' ? 'سبب الرفض' : 'ملاحظة (اختيارية)'} required={dlg.decision === 'reject'}>
              <textarea className="inp h-24 py-1.5" value={comment} onChange={(e) => { setComment(e.target.value); setErr('') }} />
            </Field>
            {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          </div>
        </Modal>
      )}
    </>
  )
}
