import { CalendarClock, Check, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { KPICard } from '../../components/display'
import { DateInput } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Badge, Card, Field, Modal, NumInput, Select, Tabs } from '../../components/ui'
import { today } from '../../data/asof'
import { fmtDate, money } from '../../data/format'
import {
  changeEligibility, changeKindLabel, changeLines, changeStatusLabel, changeStatusTone, changesOf, decideChange, generateFromTerm, hasInstallments,
  maxDeferrals, overdueDays, previewFromTerm, requestChange, validateChange, withdrawChange,
} from '../../data/installments'
import { userName } from '../../data/lifecycle'
import { itemsOf, payKindLabel } from '../../data/payments'
import { useStore } from '../../data/store'
import type { Contract, PaymentItem, ScheduleChange, ScheduleChangeKind } from '../../data/types'

/** Plan doc 16 BR-PI-01 — generate the schedule from a Finance payment term (Draft only). */
export function GenerateDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const [termId, setTermId] = useState(c.paymentTermId ?? db.paymentTerms.find(hasInstallments)?.id ?? '')
  const [base, setBase] = useState(c.startDate)
  const [err, setErr] = useState('')
  const preview = termId && base ? previewFromTerm(db, c, termId, base) : []
  const existing = itemsOf(db, c.id).length
  const save = () => {
    let fl = ''
    if (!run((d) => { const e = generateFromTerm(d, c.id, termId, base); if (e) fl = e; return e }, `وُلّد الجدول — ${preview.length} قسط`)) return setErr(fl)
    onClose()
  }
  return (
    <Modal wide title="توليد جدول الأقساط من شرط الدفع" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" disabled={!preview.length} onClick={save}>{existing ? 'استبدال الجدول' : 'توليد'}</button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="شرط الدفع (من موديول المالية)" required><Select value={termId} onChange={setTermId} options={db.paymentTerms.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}${hasInstallments(t) ? ` (${t.installments!.length} أقساط)` : ''}` }))} /></Field>
          <Field label="تاريخ الأساس" required hint="الأصل: تاريخ بداية العقد"><DateInput value={base} onChange={setBase} /></Field>
        </div>
        {existing > 0 && <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">سيُستبدل الجدول الحالي ({existing} قسط) بالكامل.</div>}
        <DataTable rows={preview} compact emptyTitle="اختر شرط الدفع" columns={[
          { key: 'n', label: '#', render: (p: PaymentItem) => p.itemNo }, { key: 'k', label: 'النوع', render: (p: PaymentItem) => payKindLabel[p.kind] },
          { key: 'd', label: 'الاستحقاق', render: (p: PaymentItem) => fmtDate(p.dueDate) }, { key: 'p', label: '%', num: true, render: (p: PaymentItem) => `${p.percent}%` },
          { key: 'a', label: 'المبلغ', num: true, render: (p: PaymentItem) => money(p.amount, p.currency) }, { key: 'x', label: 'الوصف', render: (p: PaymentItem) => <span className="text-xs text-gray-500">{p.notes}</span> },
        ] as Column<PaymentItem>[]} />
        <p className="text-[11px] text-gray-400">المبلغ = قيمة العقد × نسبة القسط، وفرق التقريب على القسط الأخير. الجدول نسخة: تعديل شرط الدفع لاحقاً لا يغيّره. بعد خروج العقد من المسودة يُغيَّر بطلبات تأجيل/تقسيم/دمج.</p>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
/** BR-PI-05…07 — request a deferral, split or merge (applied only after approval). */
export function ChangeDialog({ c, kind, items, onClose }: { c: Contract; kind: ScheduleChangeKind; items: PaymentItem[]; onClose: () => void }) {
  const { db, run } = useStore()
  const total = items.reduce((s, i) => s + i.amount, 0)
  const half = Math.round(total / 2)
  const [parts, setParts] = useState<{ dueDate: string; amount: number }[]>(
    kind === 'Split' ? [{ dueDate: items[0].dueDate, amount: half }, { dueDate: '', amount: total - half }] : [{ dueDate: '', amount: total }])
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const input = { contractId: c.id, kind, itemIds: items.map((i) => i.id), lines: changeLines(db, kind, items.map((i) => i.id), parts), reason }
  const issues = validateChange(db, input).filter((e) => e !== 'السبب مطلوب' && !e.startsWith('التاريخ مطلوب'))
  const setPart = (n: number, k: 'dueDate' | 'amount', v: string | number) => setParts((p) => p.map((x, i) => (i === n ? { ...x, [k]: v } : x)))
  const save = () => {
    let fl = ''
    if (!run((d) => { const e = requestChange(d, input); if (e) fl = e; return e }, 'أُرسل الطلب للاعتماد')) return setErr(fl)
    onClose()
  }
  const one = items[0]
  return (
    <Modal title={`طلب ${changeKindLabel[kind]} — ${items.map((i) => `القسط ${i.itemNo}`).join(' + ')}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>إرسال للاعتماد</button></>}>
      <div className="space-y-3 text-sm">
        <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {items.map((i) => <div key={i.id}>القسط {i.itemNo} — {money(i.amount, i.currency)} — يستحق {fmtDate(i.dueDate)}{i.rescheduleCount ? ` — أُجّل ${i.rescheduleCount} من ${maxDeferrals(db)}` : ''}</div>)}
        </div>
        {kind === 'Defer' && <Field label="تاريخ الاستحقاق الجديد" required hint={c.endDate ? `لا يتجاوز انتهاء العقد ${fmtDate(c.endDate)}` : undefined}><DateInput value={parts[0].dueDate} onChange={(v) => setPart(0, 'dueDate', v)} /></Field>}
        {kind === 'Merge' && <Field label={`تاريخ القسط المدمج (${money(total, c.currency)})`} required><DateInput value={parts[0].dueDate} onChange={(v) => setPart(0, 'dueDate', v)} /></Field>}
        {kind === 'Split' && (
          <div className="space-y-2">
            {parts.map((p, n) => (
              <div key={n} className="flex items-end gap-2">
                <span className="w-12 pb-2 text-xs text-gray-500">جزء {n + 1}</span>
                <div className="flex-1"><Field label="التاريخ" required><DateInput value={p.dueDate} onChange={(v) => setPart(n, 'dueDate', v)} /></Field></div>
                <div className="flex-1"><Field label={`المبلغ (${c.currency})`} required><NumInput value={p.amount} onChange={(v) => setPart(n, 'amount', v)} /></Field></div>
                {parts.length > 2 && <button type="button" className="mb-1 rounded p-1 text-gray-400 hover:text-red-600" title="حذف الجزء" onClick={() => setParts((x) => x.filter((_, i) => i !== n))}><Trash2 className="h-4 w-4" /></button>}
              </div>))}
            <div className="flex items-center justify-between text-xs">
              {parts.length < 12 && <button type="button" className="btn" onClick={() => setParts((x) => [...x, { dueDate: '', amount: 0 }])}><Plus className="h-3.5 w-3.5" />جزء</button>}
              <span>المجموع {money(parts.reduce((s, p) => s + p.amount, 0), c.currency)} من {money(one.amount, c.currency)}</span>
            </div>
          </div>)}
        <Field label="السبب" required><textarea className="inp h-20 py-1.5" value={reason} onChange={(e) => { setReason(e.target.value); setErr('') }} /></Field>
        {issues.map((w) => <div key={w} className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{w}</div>)}
        <p className="text-[11px] text-gray-400">لا يغيّر الطلب مجموع الجدول. الإعفاء أو تغيير المبلغ بملحق. يعتمده مستخدم آخر غير مقدّم الطلب.</p>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

/** Merge picker: choose two or more Planned items first. */
export function MergeDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db } = useStore()
  const [sel, setSel] = useState<string[]>([])
  const [go, setGo] = useState(false)
  const cand = itemsOf(db, c.id).filter((i) => i.status === 'Planned')
  if (go) return <ChangeDialog c={c} kind="Merge" items={cand.filter((i) => sel.includes(i.id))} onClose={onClose} />
  return (
    <Modal title="دمج أقساط" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" disabled={sel.length < 2} onClick={() => setGo(true)}>متابعة</button></>}>
      <ul className="space-y-1 text-sm">
        {cand.map((i) => (
          <li key={i.id}><label className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
            <input type="checkbox" checked={sel.includes(i.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} />
            القسط {i.itemNo} — {money(i.amount, i.currency)} — {fmtDate(i.dueDate)}
          </label></li>))}
        {!cand.length && <li className="py-4 text-center text-gray-400">لا أقساط غير مفوترة</li>}
      </ul>
    </Modal>
  )
}

const describe = (db: ReturnType<typeof useStore>['db'], ch: ScheduleChange, cur: Contract['currency']) => ch.lines.map((l, n) => {
  const it = l.itemId ? db.paymentItems.find((p) => p.id === l.itemId) : undefined
  const from = l.oldDueDate ? `${fmtDate(l.oldDueDate)} · ${money(l.oldAmount ?? 0, cur)}` : 'جديد'
  return <div key={n} className="text-xs">{it ? `القسط ${it.itemNo}` : l.newItemNo ? `القسط ${l.newItemNo}` : `جزء ${n + 1}`}: {from} ← <b>{fmtDate(l.newDueDate)} · {money(l.newAmount, cur)}</b></div>
})

/** Decision buttons shared by the contract card and the inbox. */
function Decide({ ch }: { ch: ScheduleChange }) {
  const { db, run, can } = useStore()
  const [rej, setRej] = useState(false)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  if (ch.status !== 'Pending') return null
  const el = changeEligibility(db, ch)
  const act = (approve: boolean) => { let fl = ''; if (!run((d) => { const e = decideChange(d, ch.id, approve, comment); if (e) fl = e; return e }, approve ? 'اعتُمد الطلب وطُبّق على الجدول' : 'رُفض الطلب')) setErr(fl); else setRej(false) }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {can('Schedule.ApproveChange') && <>
        <button type="button" className="btn btn-primary" disabled={!el.ok} title={el.reason} onClick={() => act(true)}><Check className="h-3.5 w-3.5" />اعتماد</button>
        <button type="button" className="btn btn-danger" disabled={!el.ok} title={el.reason} onClick={() => { setRej(true); setErr('') }}><X className="h-3.5 w-3.5" />رفض</button>
      </>}
      {ch.requestedBy === db.userId && <button type="button" className="btn" onClick={() => run((d) => withdrawChange(d, ch.id), 'سُحب الطلب')}>سحب</button>}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
      {rej && (
        <Modal title={`رفض طلب ${changeKindLabel[ch.kind]} #${ch.changeNo}`} onClose={() => setRej(false)} footer={<><button type="button" className="btn" onClick={() => setRej(false)}>تراجع</button><button type="button" className="btn btn-danger" onClick={() => act(false)}>تأكيد الرفض</button></>}>
          <Field label="سبب الرفض" required><textarea className="inp h-24 py-1.5" value={comment} onChange={(e) => { setComment(e.target.value); setErr('') }} /></Field>
          {err && <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
        </Modal>)}
    </div>
  )
}

/** Contract financial tab: history of schedule changes. */
export function ChangesCard({ c }: { c: Contract }) {
  const { db } = useStore()
  const rows = changesOf(db, c.id)
  const cols: Column<ScheduleChange>[] = [
    { key: 'n', label: '#', render: (x) => x.changeNo }, { key: 'k', label: 'النوع', render: (x) => changeKindLabel[x.kind] },
    { key: 'l', label: 'التغيير', render: (x) => <div>{describe(db, x, c.currency)}</div> },
    { key: 'r', label: 'السبب', render: (x) => <div className="max-w-56 text-xs">{x.reason}{x.comment && <div className="text-gray-400">القرار: {x.comment}</div>}</div> },
    { key: 'b', label: 'مقدّم/معتمد', render: (x) => <div className="text-xs">{userName(db, x.requestedBy)}{x.decidedBy && <div className="text-gray-400">{userName(db, x.decidedBy)}</div>}</div> },
    { key: 's', label: 'الحالة', render: (x) => <Badge tone={changeStatusTone[x.status]}>{changeStatusLabel[x.status]}</Badge> },
    { key: 'x', label: '', render: (x) => <Decide ch={x} /> },
  ]
  return <Card title="طلبات تغيير الجدول (تأجيل/تقسيم/دمج)" pad={false}><DataTable rows={rows} columns={cols} compact emptyTitle="لا طلبات" emptyHint="بعد خروج العقد من المسودة تُغيَّر تواريخ الأقساط بطلب يعتمده مستخدم آخر." /></Card>
}

/** Inbox page: pending requests to approve, and unbilled installments past their date (InstallmentOverdue). */
export default function ScheduleChangesPage() {
  const { db } = useStore()
  const [tab, setTab] = useState<'pending' | 'overdue' | 'all'>('pending')
  const contract = (id: string) => db.contracts.find((c) => c.id === id)!
  const pending = db.scheduleChanges.filter((x) => x.status === 'Pending')
  const overdue = db.paymentItems.filter((p) => overdueDays(p) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const deferred = db.paymentItems.filter((p) => (p.rescheduleCount ?? 0) > 0)
  const ccol = (id: string) => <Link className="text-navy underline-offset-2 hover:underline" to={`/contracts/${id}?tab=financial`} dir="ltr">{contract(id).number}</Link>
  const changeCols: Column<ScheduleChange>[] = [
    { key: 'c', label: 'العقد', render: (x) => <div>{ccol(x.contractId)}<div className="text-[11px] text-gray-400">{contract(x.contractId).title}</div></div> },
    { key: 'k', label: 'الطلب', render: (x) => `${changeKindLabel[x.kind]} #${x.changeNo}` },
    { key: 'l', label: 'التغيير', render: (x) => <div>{describe(db, x, contract(x.contractId).currency)}</div> },
    { key: 'r', label: 'السبب', render: (x) => <span className="text-xs">{x.reason}</span> },
    { key: 'b', label: 'مقدّم الطلب', render: (x) => <span className="text-xs">{userName(db, x.requestedBy)}</span> },
    { key: 's', label: 'الحالة', render: (x) => <Badge tone={changeStatusTone[x.status]}>{changeStatusLabel[x.status]}</Badge> },
    { key: 'x', label: '', render: (x) => <Decide ch={x} /> },
  ]
  const odCols: Column<PaymentItem>[] = [
    { key: 'c', label: 'العقد', render: (p) => ccol(p.contractId) }, { key: 'n', label: 'القسط', render: (p) => `${p.itemNo} — ${payKindLabel[p.kind]}` },
    { key: 'd', label: 'الاستحقاق', render: (p) => <div>{fmtDate(p.dueDate)}{p.originalDueDate && <div className="text-[11px] text-gray-400">الأصل {fmtDate(p.originalDueDate)}</div>}</div> },
    { key: 'o', label: 'أيام التأخر', num: true, render: (p) => <span className={overdueDays(p) > 7 ? 'font-semibold text-red-600' : 'text-amber-700'}>{overdueDays(p)}</span> },
    { key: 'a', label: 'المبلغ', num: true, render: (p) => money(p.amount, p.currency) },
    { key: 'r', label: 'مرات التأجيل', num: true, render: (p) => p.rescheduleCount ?? 0 },
    { key: 'q', label: 'طلب مفتوح', render: (p) => (pending.some((x) => x.itemIds.includes(p.id)) ? <Badge tone="amber">نعم</Badge> : '—') },
  ]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الالتزامات والمالية' }]} title="الأقساط: التأجيل والتقسيم والدمج" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="طلبات بانتظار الاعتماد" value={pending.length} tone="amber" icon={CalendarClock} />
        <KPICard label="أقساط متأخرة غير مفوترة" value={overdue.length} tone={overdue.length ? 'red' : 'gray'} hint={`حتى ${fmtDate(today())}`} />
        <KPICard label="أقساط مؤجلة" value={deferred.length} hint={`الحد ${maxDeferrals(db)} مرات للقسط`} />
        <KPICard label="طلبات معتمدة" value={db.scheduleChanges.filter((x) => x.status === 'Approved').length} tone="green" />
      </div>
      <Card pad={false}>
        <div className="px-3 pt-2"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'pending', label: 'بانتظار الاعتماد', count: pending.length }, { id: 'overdue', label: 'أقساط متأخرة', count: overdue.length }, { id: 'all', label: 'كل الطلبات', count: db.scheduleChanges.length }]} /></div>
        {tab === 'overdue'
          ? <DataTable rows={overdue} columns={odCols} emptyTitle="لا أقساط متأخرة" emptyHint="القسط المتأخر: تاريخه مضى ولم يُفوتر. يؤجَّل أو يُقسَّم من تبويب المالية في بطاقة العقد." />
          : <DataTable rows={(tab === 'pending' ? pending : [...db.scheduleChanges].reverse())} columns={changeCols} emptyTitle="لا طلبات" />}
      </Card>
      <p className="mt-3 text-[11px] text-gray-400">تأجيل أقساط الفاتورة بعد إصدارها وتسجيل التسديد يتمان في موديول المالية؛ العقد يقرأ المدفوع فقط.</p>
    </div>
  )
}
