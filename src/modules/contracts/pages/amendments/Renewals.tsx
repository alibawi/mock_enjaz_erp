import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { KPICard } from '../../components/display'
import { DateInput } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Async } from '../../components/states'
import { Badge, Card, Field, Modal } from '../../components/ui'
import { renewalLabel } from '../../data/contractMeta'
import { fmtDate, money } from '../../data/format'
import { partnerName } from '../../data/lifecycle'
import { renewBlocker, renewalDefaults, renewalsDue, renewContract, successorOf, type RenewalDue } from '../../data/renewal'
import { useStore } from '../../data/store'
import type { Contract } from '../../data/types'
import { useApi } from '../../lib/useApi'

/** M6 — manual renewal: preview the successor Draft (lines copied, counters reset), then create it. */
export function RenewButton({ c, label = 'تجديد' }: { c: Contract; label?: string }) {
  const { db, can } = useStore()
  const [open, setOpen] = useState(false)
  if (!can('Contracts.Renew')) return null
  const blocked = renewBlocker(db, c)
  return (
    <>
      <button type="button" className="btn" disabled={!!blocked} title={blocked ?? undefined} onClick={() => setOpen(true)}><RefreshCw className="h-4 w-4" />{label}</button>
      {open && <RenewDialog c={c} onClose={() => setOpen(false)} />}
    </>
  )
}

function RenewDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const nav = useNavigate()
  const def = renewalDefaults(db, c)
  const [start, setStart] = useState(def.startDate)
  const [end, setEnd] = useState(def.endDate)
  const [err, setErr] = useState('')
  const lines = db.lines.filter((l) => l.contractId === c.id && l.status === 'Open')
  const go = () => {
    let id = ''
    let failure = ''
    const ok = run((d) => { const r = renewContract(d, c.id, { startDate: start, endDate: end }); if (typeof r === 'string') { failure = r; return r } id = r.id; return null }, 'أُنشئ العقد اللاحق كمسودة')
    if (!ok) return setErr(failure)
    onClose()
    nav(`/contracts/${id}`)
  }
  return (
    <Modal title={`تجديد ${c.number}`} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={go}>إنشاء العقد اللاحق</button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-gray-600">يُنشأ عقد جديد بحالة مسودة بنفس الأطراف والبنود المفتوحة (تُرقَّم من 1 وتُصفَّر أرصدتها)، ويُغلق هذا العقد بسبب «جُدِّد» عند تفعيل العقد اللاحق.</p>
        <div className="grid grid-cols-2 gap-3"><Field label="بداية العقد اللاحق"><DateInput value={start} onChange={setStart} /></Field><Field label="نهايته"><DateInput value={end} onChange={setEnd} /></Field></div>
        <div className="grid grid-cols-3 gap-2 rounded bg-gray-50 p-3 text-center text-xs">
          <div><div className="text-gray-500">بنود منسوخة</div><div className="text-base font-bold">{lines.length}</div></div>
          <div><div className="text-gray-500">القيمة</div><div className="text-base font-bold">{c.contractValue ? money(c.contractValue, c.currency) : '—'}</div></div>
          <div><div className="text-gray-500">سياسة التجديد</div><div className="text-base font-bold">{renewalLabel[c.renewalPolicy]}</div></div>
        </div>
        {c.status === 'Expired' && <p className="text-[11px] text-amber-700">العقد منتهٍ؛ يمكن التمديد بملحق ما دامت مدة السماح قائمة، أما بعدها فبعقد لاحق فقط.</p>}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

/** M7 — renewals due: contracts approaching the end or the notice deadline, plus expired ones still inside the grace window. */
export default function Renewals() {
  const { db } = useStore()
  const api = useApi(() => ({
    rows: renewalsDue(db, 60),
    autoCreated: db.audit.filter((a) => a.action === 'renewal:auto').length,
    drafts: db.contracts.filter((c) => c.renewedFromContractId && c.status === 'Draft').length,
    pending: db.amendments.filter((a) => a.status === 'PendingApproval').length,
  }))
  const cols: Column<RenewalDue>[] = [
    { key: 'n', label: 'العقد', render: (r) => <Link className="text-navy" to={`/contracts/${r.c.id}`}><div className="font-medium" dir="ltr">{r.c.number}</div><div className="max-w-[300px] truncate text-[11px] text-gray-500">{r.c.title}</div></Link> },
    { key: 'p', label: 'الطرف', render: (r) => <span className="line-clamp-2 max-w-[180px]">{partnerName(db, r.c)}</span> },
    { key: 'end', label: 'النهاية', sort: (r) => r.c.endDate ?? '', render: (r) => fmtDate(r.c.endDate) },
    { key: 'left', label: 'المتبقي', sort: (r) => r.endsIn, render: (r) => (r.endsIn < 0 ? <span className="text-red-600">منتهٍ منذ {-r.endsIn} يوم</span> : <span className={r.endsIn <= 15 ? 'font-semibold text-red-600' : 'text-amber-600'}>{r.endsIn} يوم</span>) },
    { key: 'notice', label: 'مهلة الإشعار', render: (r) => (r.noticeIn === undefined ? '—' : r.noticeIn < 0 ? <span className="text-red-600">فاتت منذ {-r.noticeIn} يوم</span> : `بعد ${r.noticeIn} يوم`) },
    { key: 'pol', label: 'السياسة', render: (r) => (r.c.renewalPolicy === 'Auto' ? <Badge tone="blue">تلقائي</Badge> : <span className="text-xs">{renewalLabel[r.c.renewalPolicy]}</span>) },
    { key: 'grace', label: 'مدة السماح', render: (r) => (r.graceLeft === undefined ? '—' : r.graceLeft >= 0 ? <span className="text-amber-700">متبقٍ {r.graceLeft} يوم (تمديد أو عقد لاحق)</span> : <span className="text-red-600">انتهت — عقد لاحق فقط</span>) },
    { key: 'st', label: 'الحالة', render: (r) => <Badge tone={r.urgency === 'overdue' ? 'red' : r.urgency === 'notice' ? 'amber' : 'blue'}>{r.urgency === 'overdue' ? 'منتهٍ' : r.urgency === 'notice' ? 'فات الإشعار' : 'يقترب'}</Badge> },
    { key: 'x', label: '', render: (r) => <RenewButton c={r.c} /> },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الملاحق والتجديد' }, { label: 'التجديدات' }]} title="التجديدات المستحقة" />
      <Async state={api}>
        {(d) => (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <KPICard label="تجديدات مستحقة (≤ 60 يوماً)" value={d.rows.length} tone={d.rows.length ? 'amber' : 'gray'} />
              <KPICard label="تجديدات تلقائية أُنشئت" value={d.autoCreated} tone="blue" hint="مرة واحدة لكل عقد" />
              <KPICard label="عقود لاحقة بانتظار الاعتماد (مسودات)" value={d.drafts} />
              <KPICard label="ملاحق بانتظار الاعتماد" value={d.pending} tone={d.pending ? 'amber' : 'gray'} to="/amendments" />
            </div>
            <Card pad={false}>
              <DataTable rows={d.rows.map((r) => ({ ...r, id: r.c.id }))} columns={cols as Column<RenewalDue & { id: string }>[]} emptyTitle="لا تجديدات مستحقة" emptyHint="تظهر العقود التي تنتهي خلال 60 يوماً أو بلغت مهلة الإشعار." />
              <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">التجديد التلقائي: عند حلول مهلة الإشعار دون تعديل السياسة، يُنشأ العقد اللاحق كمسودة مرة واحدة عند تقدّم التاريخ التجريبي. لإيقافه عدّل سياسة التجديد بملحق قبل المهلة.</p>
            </Card>
            {db.contracts.some((c) => successorOf(db, c)) && (
              <Card title="سلاسل التجديد" className="mt-4">
                <ul className="space-y-1 text-sm">{db.contracts.filter((c) => c.successorContractId).map((c) => { const s = successorOf(db, c)!; return <li key={c.id}><Link className="text-navy" to={`/contracts/${c.id}`} dir="ltr">{c.number}</Link> ← <Link className="text-navy" to={`/contracts/${s.id}`} dir="ltr">{s.number}</Link> <span className="text-xs text-gray-500">({s.status === 'Draft' ? 'مسودة' : s.status})</span></li> })}</ul>
              </Card>)}
          </>)}
      </Async>
    </div>
  )
}
