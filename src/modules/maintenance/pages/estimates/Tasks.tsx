import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, Modal, Tabs } from '../../components/ui'
import { decide, routing, totals } from '../../data/estimate'
import { fmtDateTime, iqd, num } from '../../data/format'
import { roleLabel } from '../../data/permissions'
import { useStore } from '../../data/store'
import type { Task } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { Link } from '../../router'
import { daysBetween } from './shared'

type TabId = 'mine' | 'all' | 'done'

/** Approval inbox (S10): tasks addressed to the current role; the decision re-checks role, round and self-approval. */
export default function Tasks() {
  const { db, run, user } = useStore()
  const [tab, setTab] = useState<TabId>('mine')
  const [dlg, setDlg] = useState<{ task: Task; approve: boolean; text: string } | null>(null)
  const api = useApi(() => db.tasks, [])

  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  const est = (t: Task) => db.estimates.find((e) => e.id === t.refId)!
  const ap = (t: Task) => db.approvals.find((a) => a.id === t.approvalRequestId)!
  const mine = (t: Task) => t.status === 'open' && (t.roles.includes(db.role) || db.role === 'admin')
  const rows = (api.data ?? []).filter((t) => (tab === 'mine' ? mine(t) : tab === 'all' ? t.status === 'open' : t.status !== 'open'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const userName = (u?: string) => db.users.find((x) => x.id === u)?.name ?? '—'
  const now = `${db.asOf}T12:00`

  return (
    <div>
      <PageHeader crumbs={[{ label: 'مهامي (الاعتماد)' }]} title="مهامي — اعتماد التقديرات"
        summary={{ label: `مهام ${roleLabel[db.role]}`, value: num((api.data ?? []).filter(mine).length) }} />
      <Card pad={false}>
        <Tabs<TabId> active={tab} onChange={setTab} tabs={[
          { id: 'mine', label: 'بانتظار قراري', count: (api.data ?? []).filter(mine).length },
          { id: 'all', label: 'كل المهام المفتوحة', count: (api.data ?? []).filter((t) => t.status === 'open').length },
          { id: 'done', label: 'منجزة / ملغاة', count: (api.data ?? []).filter((t) => t.status !== 'open').length },
        ]} />
        {api.loading ? <LoadingSkeleton /> : (
          <DataTable rows={rows} emptyTitle={tab === 'mine' ? 'لا توجد مهام بانتظار قرارك' : 'لا توجد مهام'} emptyHint={tab === 'mine' ? 'بدّل إلى مدير الورشة أو المدير المالي لرؤية مهام الاعتماد.' : undefined} columns={[
            { key: 'no', label: 'التقدير', render: (t) => <Link to={`/estimates/${t.refId}`} className="font-mono text-[12px] text-navy hover:underline" dir="ltr">{est(t).number} v{est(t).version}</Link> },
            { key: 'asset', label: 'الأصل / العميل', render: (t) => <span>{db.assets.find((a) => a.id === est(t).assetId)?.name}<span className="block text-[11px] text-gray-500">{db.partners.find((p) => p.id === est(t).partnerId)?.name}</span></span> },
            { key: 'amt', label: 'المبلغ', num: true, render: (t) => iqd(totals(db, est(t)).gross), sort: (t) => totals(db, est(t)).gross },
            { key: 'lvl', label: 'المستوى', render: (t) => <span>{ap(t).level} — {t.roles.map((r) => roleLabel[r]).join(' / ')}</span> },
            { key: 'why', label: 'سبب الاعتماد', className: 'max-w-xs text-[12px] text-gray-600', render: (t) => routing(db, est(t)).reasons.join('؛ ') },
            { key: 'by', label: 'المقدِّم', render: (t) => <span>{userName(est(t).submittedBy)}{est(t).submittedBy === user.id && <Badge tone="amber">أنت</Badge>}</span> },
            { key: 'age', label: 'منذ', render: (t) => (t.status === 'open' ? `${num(Math.max(0, daysBetween(t.createdAt, now)), 1)} يوم` : fmtDateTime(ap(t).decidedAt)) },
            {
              key: 'act', label: '', className: 'no-print', render: (t) => (t.status === 'open' && mine(t) ? (
                <span className="flex gap-1" onClick={(x) => x.stopPropagation()}>
                  <button type="button" className="btn h-7 px-2 text-emerald-700" onClick={() => setDlg({ task: t, approve: true, text: '' })}><CheckCircle2 className="h-4 w-4" />اعتماد</button>
                  <button type="button" className="btn h-7 px-2 text-red-600" onClick={() => setDlg({ task: t, approve: false, text: '' })}><XCircle className="h-4 w-4" />رفض</button>
                </span>
              ) : t.status !== 'open' ? <Badge tone={t.status === 'done' ? 'green' : 'gray'}>{t.status === 'done' ? 'منجزة' : 'ملغاة'}</Badge> : null),
            },
          ]} />
        )}
      </Card>

      {dlg && (
        <Modal title={dlg.approve ? 'اعتماد التقدير' : 'رفض التقدير'} onClose={() => setDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
            <button type="button" className={`btn ${dlg.approve ? 'btn-primary' : 'border-red-600 bg-red-600 text-white'}`} onClick={() => run((d) => decide(d, dlg.task.approvalRequestId, dlg.approve, dlg.text), dlg.approve ? 'تم الاعتماد' : 'تم الرفض') && setDlg(null)}>{dlg.approve ? 'اعتماد' : 'رفض'}</button></>}>
          <p className="mb-2 text-sm text-gray-600">{est(dlg.task).number} v{est(dlg.task).version} — {iqd(totals(db, est(dlg.task)).gross)}</p>
          <Field label={dlg.approve ? 'ملاحظة (اختيارية)' : 'سبب الرفض'} required={!dlg.approve}><textarea className="inp min-h-[70px] py-2" value={dlg.text} onChange={(x) => setDlg({ ...dlg, text: x.target.value })} /></Field>
        </Modal>
      )}
    </div>
  )
}
