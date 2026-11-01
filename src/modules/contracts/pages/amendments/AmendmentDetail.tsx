import { useState } from 'react'
import { Link, useNavigate, useParams } from '../../router'
import { StageTimeline, type Stage } from '../../components/display'
import { PageHeader } from '../../components/Layout'
import { Async, EmptyBlock } from '../../components/states'
import { Card, Field, Modal } from '../../components/ui'
import { eligibility, openRequest } from '../../data/approval'
import { amendTypeLabel, applyAmendment, applyBlocker, cancelAmendment, decideAmendment, submitAmendment, validateAmendment, valueDelta } from '../../data/amendments'
import { fmtDate, money } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'
import { AmendStatusBadge, ChangeTable, describeChanges } from './shared'

/** M3 — amendment detail: change set, Elsa stages, decisions and the apply button (BR-M-05). */
export default function AmendmentDetail() {
  const { id, aid } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [dlg, setDlg] = useState<'Approved' | 'Rejected' | null>(null)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const api = useApi(() => db.amendments.find((a) => a.id === aid) ?? null, [aid])
  const c = db.contracts.find((x) => x.id === id)

  return (
    <Async state={api}>
      {(a) => {
        if (!a || !c || a.contractId !== c.id) return <EmptyBlock title="الملحق غير موجود" />
        const req = db.approvalRequests.find((r) => r.id === a.approvalRequestId)
        const actions = req ? db.approvalActions.filter((x) => x.requestId === req.id) : []
        const stages: Stage[] = (req?.stages ?? []).map((s) => {
          const act = actions.find((x) => x.stageNo === s.no)
          return { no: s.no, label: s.label, who: userName(db, act?.approverUserId ?? s.userId), status: s.status, comment: act?.comment, at: act?.decidedAt, onBehalfOf: act?.onBehalfOfUserId ? userName(db, act.onBehalfOfUserId) : undefined }
        })
        const el = a.status === 'PendingApproval' ? eligibility(db, openRequest(db, 'Amendment', a.id), db.userId) : null
        const blocker = applyBlocker(db, a)
        const issues = ['Draft', 'PendingApproval', 'Approved'].includes(a.status) ? validateAmendment(db, c, a) : null
        const delta = valueDelta(db, c, a)
        const exec = (fn: (d: typeof db) => string | null, ok: string, then?: () => void) => {
          let failure = ''
          const done = run((d) => { const e = fn(d); if (e) failure = e; return e }, ok)
          if (!done) setErr(failure); else { setErr(''); then?.() }
        }
        const decide = () => {
          if (dlg === 'Rejected' && !comment.trim()) return setErr('سبب الرفض مطلوب')
          exec((d) => decideAmendment(d, a.id, dlg!, comment), dlg === 'Approved' ? 'سُجّل الاعتماد' : 'رُفض الملحق', () => { setDlg(null); setComment('') })
        }
        const mine = can('Contracts.Amend')
        return (
          <div>
            <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number, to: `/contracts/${c.id}` }, { label: `ملحق ${a.amendmentNo}` }]} title={`ملحق ${a.amendmentNo} — ${amendTypeLabel[a.type]}`} badge={<AmendStatusBadge status={a.status} />}
              actions={<>
                <Link className="btn" to={`/contracts/${c.id}/print?doc=amendment`}>طباعة الملحق</Link>
                {a.status === 'Draft' && mine && <button type="button" className="btn" onClick={() => nav(`/contracts/${c.id}/amend/${a.id}`)}>تعديل</button>}
                {a.status === 'Draft' && mine && <button type="button" className="btn btn-primary" onClick={() => exec((d) => submitAmendment(d, a.id), 'أُرسل الملحق للاعتماد')}>إرسال للاعتماد</button>}
                {a.status === 'PendingApproval' && can('Contracts.Approve') && <button type="button" className="btn btn-primary" disabled={!el?.ok} title={el?.reason} onClick={() => { setDlg('Approved'); setErr('') }}>اعتماد</button>}
                {a.status === 'PendingApproval' && can('Contracts.Reject') && <button type="button" className="btn btn-danger" disabled={!el?.ok} title={el?.reason} onClick={() => { setDlg('Rejected'); setErr('') }}>رفض</button>}
                {a.status === 'Approved' && mine && <button type="button" className="btn btn-primary" disabled={!!blocker} title={blocker} onClick={() => exec((d) => applyAmendment(d, a.id), `طُبّق الملحق — إصدار جديد v${c.versionNo + 1}`)}>تطبيق الملحق</button>}
                {['Draft', 'PendingApproval', 'Approved'].includes(a.status) && mine && <button type="button" className="btn" onClick={() => exec((d) => cancelAmendment(d, a.id), 'أُلغي الملحق')}>إلغاء الملحق</button>}
              </>} />
            {err && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            {a.status === 'Approved' && blocker && <div className="mb-3 rounded bg-sky-50 px-3 py-2 text-sm text-sky-800">{blocker}</div>}
            {a.status === 'Applied' && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                طُبّق في {fmtDate(a.appliedOn)} ({a.appliedBy === 'system' ? 'تلقائياً بالنظام' : userName(db, a.appliedBy ?? '')}) فأصبح إصدار العقد v{a.appliedVersionNo}.
                <Link className="underline" to={`/contracts/${c.id}/versions/compare?from=${(a.appliedVersionNo ?? 2) - 1}&to=${a.appliedVersionNo}`}>مقارنة الإصدارين</Link>
              </div>)}
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <Card title="بيانات الملحق">
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div><div className="text-xs text-gray-500">تاريخ السريان</div><div className="font-medium">{fmtDate(a.effectiveDate)}</div></div>
                    <div><div className="text-xs text-gray-500">الإصدار الأساسي</div><div className="font-medium">v{a.baseVersionNo}{a.baseVersionNo !== c.versionNo && a.status !== 'Applied' ? <span className="ms-1 text-red-600">(قديم)</span> : ''}</div></div>
                    <div><div className="text-xs text-gray-500">أنشأه</div><div className="font-medium">{userName(db, a.createdBy)} — {fmtDate(a.createdAt)}</div></div>
                    <div><div className="text-xs text-gray-500">أثر القيمة</div><div className="font-medium">{delta ? `${delta > 0 ? '+' : ''}${money(delta, c.currency)}` : '—'}</div></div>
                    <div className="col-span-2 md:col-span-4"><div className="text-xs text-gray-500">السبب</div><div>{a.reason}</div></div>
                  </div>
                </Card>
                <ChangeTable rows={describeChanges(db, c, a)} />
                {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
                  <Card title="ملاحظات الفحص الحالية">
                    <ul className="space-y-1.5 text-xs">
                      {issues.errors.map((e, i) => <li key={i} className="rounded bg-red-50 px-2 py-1.5 text-red-700">{e}</li>)}
                      {issues.warnings.map((e, i) => <li key={i} className="rounded bg-amber-50 px-2 py-1.5 text-amber-800">{e}</li>)}
                    </ul>
                  </Card>)}
              </div>
              <Card title={req ? `الاعتماد — ${req.ruleName}` : 'الاعتماد'}>
                {req ? <StageTimeline stages={stages} /> : <div className="py-6 text-center text-sm text-gray-400">لم يُرسل للاعتماد بعد. مسار Elsa يُختار بحسب قيمة التغيير (حتى 100 مليون: مرحلتان، أكثر: ثلاث).</div>}
                {el && !el.ok && <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{el.reason}</div>}
                {req && <div className="mt-2 text-[11px] text-gray-400">منشئ الملحق لا يعتمده (فصل المهام).</div>}
              </Card>
            </div>
            {dlg && (
              <Modal title={dlg === 'Approved' ? 'اعتماد الملحق' : 'رفض الملحق'} onClose={() => setDlg(null)}
                footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className={`btn ${dlg === 'Rejected' ? 'btn-danger' : 'btn-primary'}`} onClick={decide}>تأكيد</button></>}>
                <Field label={dlg === 'Rejected' ? 'سبب الرفض' : 'ملاحظة (اختيارية)'} required={dlg === 'Rejected'}><textarea className="inp h-24 py-1.5" value={comment} onChange={(e) => { setComment(e.target.value); setErr('') }} /></Field>
                {err && <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
              </Modal>)}
          </div>
        )
      }}
    </Async>
  )
}
