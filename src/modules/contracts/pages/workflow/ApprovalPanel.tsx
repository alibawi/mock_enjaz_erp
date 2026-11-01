import { Link } from '../../router'
import { Card } from '../../components/ui'
import { StageTimeline, type Stage } from '../../components/display'
import { EmptyBlock } from '../../components/states'
import { eligibility, requestsOf } from '../../data/approval'
import { fmtDate, money } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { ApprovalRequest, Contract } from '../../data/types'

const statusText: Record<ApprovalRequest['status'], string> = { Pending: 'قيد الاعتماد', Approved: 'مُعتمد', Rejected: 'مرفوض', Cancelled: 'ملغى' }

/** W1 — approval tab: stage timeline of the Elsa request, who is up, and the past requests (BR-W-01…07). */
export function ApprovalPanel({ c }: { c: Contract }) {
  const { db } = useStore()
  const reqs = requestsOf(db, c.id)
  if (!reqs.length) {
    return <Card title="الاعتماد"><EmptyBlock title="لم يُرسل العقد للاعتماد بعد" hint={c.status === 'Draft' ? 'اضغط «إرسال للاعتماد» لبدء مسار Elsa المناسب لقيمة العقد.' : 'هذا العقد لا يتطلب مساراً للاعتماد.'} /></Card>
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Link className="btn" to={`/contracts/${c.id}/print?doc=approval`}>طباعة سجل الاعتماد</Link></div>
      {reqs.map((r, i) => {
        const actions = db.approvalActions.filter((a) => a.requestId === r.id)
        const stages: Stage[] = r.stages.map((s) => {
          const act = actions.find((a) => a.stageNo === s.no)
          return {
            no: s.no, label: s.label + (s.isLegalReview ? ' (مراجعة قانونية)' : ''), who: userName(db, s.userId), status: s.status,
            comment: act?.comment, at: act?.decidedAt, onBehalfOf: act?.onBehalfOfUserId ? userName(db, act.onBehalfOfUserId) : undefined,
          }
        }).map((s, k) => (actions.find((a) => a.stageNo === k + 1)?.approverUserId && actions.find((a) => a.stageNo === k + 1)!.approverUserId !== r.stages[k].userId
          ? { ...s, who: `${userName(db, actions.find((a) => a.stageNo === k + 1)!.approverUserId)}` } : s))
        const el = r.status === 'Pending' ? eligibility(db, r, db.userId) : null
        return (
          <Card key={r.id} title={`${i === 0 ? 'الطلب الحالي' : 'طلب سابق'} — ${statusText[r.status]}`}
            actions={<span className="text-[11px] text-gray-400" dir="ltr">{r.workflowInstanceId}</span>}>
            <div className="mb-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <div><div className="text-gray-500">المسار (Elsa)</div><div className="font-medium">{r.ruleName}</div></div>
              <div><div className="text-gray-500">القيمة المعتمدة للاختيار</div><div className="font-medium">{money(r.valueIQD, 'IQD')}</div></div>
              <div><div className="text-gray-500">أُرسل بواسطة</div><div className="font-medium">{userName(db, r.submittedBy)} — {fmtDate(r.submittedAt)}</div></div>
              <div><div className="text-gray-500">الحالة</div><div className="font-medium">{statusText[r.status]}{r.completedAt ? ` — ${fmtDate(r.completedAt)}` : ''}</div></div>
            </div>
            {el && (
              <div className={`mb-3 rounded-md px-3 py-2 text-xs ${el.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                {el.ok ? `أنت المعتمد للمرحلة ${r.currentStage}${el.onBehalfOf ? ` (بالنيابة عن ${userName(db, el.onBehalfOf)})` : ''} — استخدم زر «اعتماد» أعلى الصفحة أو شاشة مهامي.` : el.reason}
                <Link className="ms-2 underline" to="/tasks">مهامي</Link>
              </div>
            )}
            <StageTimeline stages={stages} />
          </Card>
        )
      })}
    </div>
  )
}
