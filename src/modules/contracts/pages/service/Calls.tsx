import { AlertTriangle, CheckCircle2, ClipboardX, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { ItemSelect, PartnerSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Badge, Card, Field, Modal, NumInput, Select } from '../../components/ui'
import { today } from '../../data/asof'
import {
  callSla, closeCall, countdown, coverageFor, deadlinesFor, demoNow, fmtMins, fmtStamp, isInCoverage, levelOf, openCall, respondCall, resolveCall, type SlaState,
} from '../../data/service'
import { useStore } from '../../data/store'
import type { CallStatus, ServiceCall } from '../../data/types'

export const statusText: Record<CallStatus, string> = { Open: 'مفتوح', Responded: 'تمت الاستجابة', Resolved: 'محلول', Closed: 'مغلق' }
const slaText: Record<SlaState | 'n/a', string> = { Within: 'ضمن المهلة', NearBreach: 'يقترب من الخرق', Breached: 'خرق', Met: 'ضمن المهلة (أُنجز)', 'n/a': 'غير مغطّى' }
const slaTone = { Within: 'green', NearBreach: 'amber', Breached: 'red', Met: 'green', 'n/a': 'gray' } as const
export const SlaBadge = ({ s }: { s: SlaState | 'n/a' }) => <Badge tone={slaTone[s]}>{slaText[s]}</Badge>

/** S4 — service-call simulator. A demo aid standing in for the Assets/Maintenance modules (not built yet). */
export default function Calls() {
  const { db, run, can } = useStore()
  const canAct = can('Contracts.Edit') || can('Obligations.Complete')
  const [f, setF] = useState({ customerId: 'p-c6', itemId: 'it-11', serial: 'GEN-250-A1', severity: 'Normal' as 'Critical' | 'Normal', description: '', openedAt: `${today()}T10:00` })
  const [dlg, setDlg] = useState<{ kind: 'respond' | 'resolve'; call: ServiceCall } | null>(null)
  const [err, setErr] = useState('')
  const cov = f.customerId && (f.itemId || f.serial) ? coverageFor(db, { customerId: f.customerId, itemId: f.itemId || undefined, serial: f.serial.trim() || undefined, date: f.openedAt.slice(0, 10) }) : undefined
  const dl = cov?.contract ? deadlinesFor(db, cov.contract.id, f.openedAt) : undefined
  const lvl = cov?.contract ? levelOf(db, cov.contract.id) : undefined
  const outside = cov?.contract ? !isInCoverage(db, cov.contract.id, f.openedAt) : false
  const calls = db.serviceCalls.slice().sort((a, b) => b.openedAt.localeCompare(a.openedAt))

  const open = () => {
    let fl = ''
    const ok = run((d) => { const r = openCall(d, { ...f, itemId: f.itemId || undefined }); if (typeof r === 'string') { fl = r; return r } return null }, 'فُتح البلاغ')
    if (!ok) return setErr(fl)
    setErr(''); setF((x) => ({ ...x, description: '' }))
  }
  const cols: Column<ServiceCall>[] = [
    { key: 'n', label: 'البلاغ', render: (c) => <div><span className="font-medium" dir="ltr">{c.no}</span><div className="text-[11px] text-gray-400">{c.severity === 'Critical' ? 'حرج' : 'عادي'}</div></div> },
    { key: 'cu', label: 'العميل / المعدة', render: (c) => <div className="text-xs">{db.partners.find((p) => p.id === c.customerId)?.name}<div className="text-gray-400" dir="ltr">{c.serial ?? db.items.find((i) => i.id === c.itemId)?.name}</div></div> },
    { key: 'ct', label: 'العقد', render: (c) => { const k = db.contracts.find((x) => x.id === c.contractId); return k ? <Link className="text-navy" to={`/contracts/${k.id}`} dir="ltr">{k.number}</Link> : <Badge tone="gray">غير مغطّى</Badge> } },
    { key: 'o', label: 'فُتح', render: (c) => <div className="text-xs">{fmtStamp(c.openedAt)}{c.outsideCoverage && <div className="text-amber-600">خارج ساعات التغطية</div>}</div> },
    { key: 'd', label: 'المهل', render: (c) => <div className="text-[11px] text-gray-500">{c.responseDue ? `استجابة ${fmtStamp(c.responseDue)}` : '—'}<br />{c.resolutionDue ? `حل ${fmtStamp(c.resolutionDue)}` : ''}</div> },
    { key: 's', label: 'الحالة', render: (c) => <div><Badge tone={c.status === 'Closed' ? 'gray' : c.status === 'Resolved' ? 'green' : 'blue'}>{statusText[c.status]}</Badge>{c.billable && <div className="text-[10px] text-red-600">قابل للفوترة</div>}</div> },
    { key: 'sla', label: 'SLA', render: (c) => { const s = callSla(db, c), cd = countdown(db, c); return <div><SlaBadge s={s.worst} />{cd && <div className={`mt-0.5 text-[10px] ${cd.mins < 0 ? 'text-red-600' : 'text-gray-500'}`}>{fmtMins(cd.mins)} {cd.label}</div>}</div> } },
    { key: 'x', label: '', render: (c) => !canAct ? null : (
      <div className="flex gap-1">
        {c.status === 'Open' && <button type="button" className="btn" onClick={() => { setDlg({ kind: 'respond', call: c }); setErr('') }}>استجابة</button>}
        {['Open', 'Responded'].includes(c.status) && <button type="button" className="btn btn-primary" onClick={() => { setDlg({ kind: 'resolve', call: c }); setErr('') }}>حل</button>}
        {c.status === 'Resolved' && <button type="button" className="btn" onClick={() => run((d) => closeCall(d, c.id), 'أُغلق البلاغ')}>إغلاق</button>}
      </div>) },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الخدمة', to: '/service' }, { label: 'محاكي البلاغات' }]} title="محاكي بلاغات الخدمة" actions={<Link className="btn" to="/service/sla">تقرير مستوى الخدمة</Link>} />
      <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900"><Wrench className="mt-0.5 h-4 w-4 shrink-0" />أداة عرض فقط: في النظام الحقيقي تُفتح البلاغات وأوامر العمل من وحدتي الأصول والصيانة (قريباً) ويقيس SLA منهما؛ هنا نحاكيها لإظهار البحث عن التغطية وحساب المهل واستهلاك الساعات. ساعة العرض {demoNow(db).slice(11)} من التاريخ التجريبي.</div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="بلاغ جديد" className="xl:col-span-1">
          <div className="space-y-3">
            <Field label="العميل"><PartnerSelect kind="customer" value={f.customerId} onChange={(v) => setF({ ...f, customerId: v })} /></Field>
            <Field label="الصنف"><ItemSelect value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} /></Field>
            <Field label="الرقم التسلسلي"><input className="inp" dir="ltr" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الأهمية"><Select value={f.severity} onChange={(v) => setF({ ...f, severity: v })} options={[{ value: 'Normal', label: 'عادي' }, { value: 'Critical', label: 'حرج' }]} /></Field>
              <Field label="وقت الفتح"><input type="datetime-local" className="inp" dir="ltr" value={f.openedAt} onChange={(e) => setF({ ...f, openedAt: e.target.value })} /></Field>
            </div>
            <Field label="وصف العطل" required><input className="inp" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <button type="button" className="btn btn-primary w-full justify-center" disabled={!canAct} onClick={open}>فتح البلاغ</button>
            {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          </div>
        </Card>
        <Card title="نتيجة البحث عن التغطية" className="xl:col-span-2">
          {!cov ? <div className="py-6 text-center text-sm text-gray-400">أدخل العميل والصنف أو الرقم التسلسلي.</div> : cov.contract ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />مغطّى بالعقد <Link to={`/contracts/${cov.contract.id}`} className="underline" dir="ltr">{cov.contract.number}</Link></div>
              <div className="text-gray-600">{cov.contract.title}</div>
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">المعدة</div>{cov.item?.description}</div>
                <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">الاستجابة ({lvl?.responseHours}س عمل)</div>{fmtStamp(dl?.responseDue)}</div>
                <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">الحل ({lvl?.resolutionHours}س عمل)</div>{fmtStamp(dl?.resolutionDue)}</div>
                <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">الضمان</div>{cov.item?.warrantyEnd ? `حتى ${cov.item.warrantyEnd}` : '—'}</div>
              </div>
              {outside && <div className="flex items-center gap-1.5 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4" />وقت الفتح خارج ساعات التغطية: يُسمح بالبلاغ مع تنبيه، وتبدأ المهل من أول نافذة تغطية.</div>}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-red-700"><ClipboardX className="h-4 w-4" />غير مغطّى بعقد خدمة — يُفتح البلاغ قابلاً للفوترة</div>
              {cov.reasons.length > 0 && <ul className="space-y-1 text-xs text-gray-600">{cov.reasons.map((r) => <li key={r.contract.id}><Link className="text-navy" to={`/contracts/${r.contract.id}`} dir="ltr">{r.contract.number}</Link> — {r.reason}</li>)}</ul>}
              {cov.reasons.length === 0 && <p className="text-xs text-gray-500">لا عقد خدمة لهذا العميل.</p>}
            </div>)}
        </Card>
      </div>
      <Card title={`البلاغات (${calls.length})`} pad={false} className="mt-4"><DataTable rows={calls} columns={cols} compact emptyTitle="لا بلاغات" /></Card>
      {dlg && <ActionDialog kind={dlg.kind} call={dlg.call} onClose={() => setDlg(null)} />}
    </div>
  )
}

function ActionDialog({ kind, call, onClose }: { kind: 'respond' | 'resolve'; call: ServiceCall; onClose: () => void }) {
  const { db, run } = useStore()
  const [at, setAt] = useState(() => { const base = call.respondedAt ?? call.openedAt, now = demoNow(db); return now > base ? now : base })
  const [hours, setHours] = useState(2)
  const [visits, setVisits] = useState(1)
  const [err, setErr] = useState('')
  const l = call.contractId ? levelOf(db, call.contractId) : undefined
  const go = () => {
    let fl = ''
    const ok = run((d) => { const e = kind === 'respond' ? respondCall(d, call.id, at) : resolveCall(d, call.id, at, hours, visits); if (e) fl = e; return e }, kind === 'respond' ? 'سُجّلت الاستجابة' : 'حُلّ البلاغ')
    if (!ok) return setErr(fl)
    onClose()
  }
  return (
    <Modal title={`${kind === 'respond' ? 'استجابة' : 'حل'} — ${call.no}`} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={go}>تأكيد</button></>}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">فُتح {fmtStamp(call.openedAt)}{call.responseDue ? ` — مهلة الاستجابة ${fmtStamp(call.responseDue)}` : ''}{kind === 'resolve' && call.resolutionDue ? ` — مهلة الحل ${fmtStamp(call.resolutionDue)}` : ''}</p>
        <Field label={kind === 'respond' ? 'وقت الاستجابة' : 'وقت الحل'}><input type="datetime-local" className="inp" dir="ltr" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
        {kind === 'resolve' && <div className="grid grid-cols-2 gap-3"><Field label="الساعات المستهلكة"><NumInput value={hours} onChange={setHours} /></Field><Field label="الزيارات"><NumInput value={visits} onChange={setVisits} /></Field></div>}
        {kind === 'resolve' && l && <p className="text-[11px] text-gray-400">المشمول: {l.includedHours ?? '—'} ساعة، {l.includedVisits ?? '—'} زيارة. التجاوز يجعل البلاغ قابلاً للفوترة.</p>}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
