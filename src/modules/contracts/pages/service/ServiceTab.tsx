import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { DateInput, ItemSelect } from '../../components/inputs'
import { Badge, Card, Field, FormGrid, Modal, NumInput } from '../../components/ui'
import { fmtDate, uid } from '../../data/format'
import { callSla, dayNames, fmtStamp, levelOf, serviceStats, warrantyEnds } from '../../data/service'
import { addAudit, useStore } from '../../data/store'
import type { Contract, CoveredItem, ServiceCall, ServiceLevel } from '../../data/types'
import { SlaBadge, statusText } from './Calls'

const Bar = ({ used, total, unit }: { used: number; total?: number; unit: string }) => total === undefined ? <span className="text-gray-400">غير محدد</span> : (
  <div className="min-w-[160px]"><div className="h-2 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${used > total ? 'bg-red-500' : used / total >= 0.8 ? 'bg-amber-500' : 'bg-navy'}`} style={{ width: `${Math.min(100, (used / total) * 100)}%` }} /></div>
    <div className="mt-0.5 flex justify-between text-[11px] text-gray-500"><span>{used} {unit}</span><span>من {total}</span></div></div>
)

/** S1 + S2 + S3 — service terms, weekly coverage with exclusions and covered items. Editable only in Draft (BR-S-07: later changes by amendment). */
export function ServiceTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const lvl = levelOf(db, c.id)
  const draft = c.status === 'Draft' && can('Contracts.Edit')
  const st = serviceStats(db, c)
  const [item, setItem] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [exc, setExc] = useState({ date: '', reason: '' })
  const items = db.coveredItems.filter((i) => i.contractId === c.id)
  const calls = db.serviceCalls.filter((x) => x.contractId === c.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 6)
  const exclusions = db.coverageExclusions.filter((x) => x.contractId === c.id).sort((a, b) => a.date.localeCompare(b.date))
  const we = warrantyEnds(db, c)

  const init = () => run((d) => {
    d.serviceLevels.push({ id: `sl-${c.id}`, contractId: c.id, responseHours: 4, resolutionHours: 24, limits: '' })
    ;[0, 1, 2, 3, 4].forEach((dw) => d.coverageWindows.push({ id: uid('cw'), contractId: c.id, dayOfWeek: dw, fromTime: '08:00', toTime: '16:00' }))
    addAudit(d, 'contract', c.id, 'service:init', '')
  }, 'هُيّئت بيانات الخدمة')
  const setL = (patch: Partial<ServiceLevel>) => run((d) => { const l = d.serviceLevels.find((x) => x.contractId === c.id)!; Object.assign(l, patch) })
  const setDay = (dw: number, on: boolean, from?: string, to?: string) => run((d) => {
    const cur = d.coverageWindows.filter((w) => w.contractId === c.id && w.dayOfWeek === dw)
    if (!on) { d.coverageWindows = d.coverageWindows.filter((w) => !(w.contractId === c.id && w.dayOfWeek === dw)); return }
    if (!cur.length) d.coverageWindows.push({ id: uid('cw'), contractId: c.id, dayOfWeek: dw, fromTime: from ?? '08:00', toTime: to ?? '16:00' })
    else if (from || to) { const w = cur[0]; if (from) w.fromTime = from; if (to) w.toTime = to; if (w.toTime <= w.fromTime) return 'نهاية النافذة يجب أن تتأخر عن بدايتها' }
  })

  if (!lvl) {
    return <Card title="الخدمة ومستوى الخدمة"><div className="py-8 text-center text-sm text-gray-500">لا بيانات خدمة لهذا العقد.{draft && <div className="mt-3"><button type="button" className="btn btn-primary" onClick={init}>تهيئة بيانات الخدمة</button></div>}</div></Card>
  }
  const covCols: Column<CoveredItem>[] = [
    { key: 'i', label: 'الصنف / الوصف', render: (i) => <div><div className="font-medium">{i.description}</div><div className="text-[11px] text-gray-400">{db.items.find((x) => x.id === i.itemId)?.name}</div></div> },
    { key: 's', label: 'الرقم التسلسلي', render: (i) => <span dir="ltr">{i.serial ?? '—'}</span> }, { key: 'a', label: 'بطاقة المعدة', render: (i) => <span className="text-xs text-gray-500" dir="ltr">{i.assetRef ?? '—'}</span> },
    { key: 'w', label: 'الضمان', render: (i) => (i.warrantyStart || i.warrantyEnd ? `${fmtDate(i.warrantyStart)} ← ${fmtDate(i.warrantyEnd)}` : '—') },
    ...(draft ? [{ key: 'x', label: '', render: (i: CoveredItem) => <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => run((d) => { d.coveredItems = d.coveredItems.filter((x) => x.id !== i.id) }, 'أُزيل الصنف')}><Trash2 className="h-4 w-4" /></button> }] : []),
  ]
  return (
    <div className="space-y-4">
      <Card title="مستوى الخدمة والكميات المشمولة">
        <FormGrid>
          <Field label="مهلة الاستجابة (ساعات عمل)"><NumInput value={lvl.responseHours} disabled={!draft} onChange={(n) => setL({ responseHours: n })} /></Field>
          <Field label="مهلة الحل (ساعات عمل)"><NumInput value={lvl.resolutionHours} disabled={!draft} onChange={(n) => setL({ resolutionHours: n })} /></Field>
          <Field label="الساعات المشمولة"><NumInput value={lvl.includedHours ?? 0} disabled={!draft} onChange={(n) => setL({ includedHours: n || undefined })} /></Field>
          <Field label="الزيارات المشمولة"><NumInput value={lvl.includedVisits ?? 0} disabled={!draft} onChange={(n) => setL({ includedVisits: n || undefined })} /></Field>
          <Field label="الضمان — من / إلى"><div className="flex gap-1"><DateInput value={lvl.warrantyStart ?? ''} disabled={!draft} onChange={(v) => setL({ warrantyStart: v || undefined })} /><DateInput value={lvl.warrantyEnd ?? ''} disabled={!draft} onChange={(v) => setL({ warrantyEnd: v || undefined })} /></div></Field>
          <Field label="الحدود والاستثناءات" span={5}><input className="inp" disabled={!draft} value={lvl.limits} onChange={(e) => setL({ limits: e.target.value })} /></Field>
        </FormGrid>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div><div className="mb-1 text-xs text-gray-500">الساعات المستهلكة</div><Bar used={st.hours} total={lvl.includedHours} unit="س" /></div>
          <div><div className="mb-1 text-xs text-gray-500">الزيارات المستهلكة</div><Bar used={st.visits} total={lvl.includedVisits} unit="زيارة" /></div>
          <div className="text-sm"><div className="mb-1 text-xs text-gray-500">أداء مستوى الخدمة</div>{st.slaPct === undefined ? '—' : <span className={st.slaPct < 80 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>{st.slaPct.toFixed(0)}% ضمن المهلة</span>} · {st.breaches} خرق · {st.calls} بلاغ{we && <div className="text-[11px] text-gray-500">ينتهي الضمان {fmtDate(we)}</div>}</div>
        </div>
        {!draft && <p className="mt-3 text-[11px] text-gray-400">شروط الخدمة مجمّدة بعد المسودة؛ التعديل عبر ملحق.</p>}
      </Card>

      <Card title="نوافذ التغطية الأسبوعية">
        <div className="grid gap-2 md:grid-cols-2">
          {dayNames.map((name, dw) => {
            const ws = db.coverageWindows.filter((w) => w.contractId === c.id && w.dayOfWeek === dw)
            return (
              <div key={dw} className="flex items-center gap-3 rounded border border-line px-3 py-1.5 text-sm">
                <label className="flex w-24 items-center gap-1.5"><input type="checkbox" disabled={!draft} checked={ws.length > 0} onChange={(e) => setDay(dw, e.target.checked)} />{name}</label>
                {ws.length === 0 ? <span className="text-xs text-gray-400">بلا تغطية</span> : draft
                  ? <span className="flex items-center gap-1"><input type="time" className="inp w-28" dir="ltr" value={ws[0].fromTime} onChange={(e) => setDay(dw, true, e.target.value)} />—<input type="time" className="inp w-28" dir="ltr" value={ws[0].toTime} onChange={(e) => setDay(dw, true, undefined, e.target.value)} /></span>
                  : <span className="text-xs" dir="ltr">{ws.map((w) => `${w.fromTime}–${w.toTime}`).join(' , ')}</span>}
              </div>)
          })}
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-gray-600">أيام الاستثناء (عطل وإغلاقات)</div>
          <div className="flex flex-wrap gap-2">
            {exclusions.map((x) => <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{fmtDate(x.date)} — {x.reason}{draft && <button type="button" onClick={() => run((d) => { d.coverageExclusions = d.coverageExclusions.filter((y) => y.id !== x.id) })}><Trash2 className="h-3 w-3 text-gray-400" /></button>}</span>)}
            {exclusions.length === 0 && <span className="text-xs text-gray-400">لا استثناءات</span>}
          </div>
          {draft && <div className="mt-2 flex items-end gap-2"><Field label="التاريخ"><DateInput value={exc.date} onChange={(v) => setExc({ ...exc, date: v })} /></Field><Field label="السبب"><input className="inp" value={exc.reason} onChange={(e) => setExc({ ...exc, reason: e.target.value })} /></Field>
            <button type="button" className="btn" disabled={!exc.date} onClick={() => { run((d) => { d.coverageExclusions.push({ id: uid('cx'), contractId: c.id, date: exc.date, reason: exc.reason || 'استثناء' }) }, 'أُضيف الاستثناء'); setExc({ date: '', reason: '' }) }}><Plus className="h-4 w-4" />إضافة</button></div>}
        </div>
      </Card>

      <Card title={`الأصناف المشمولة (${items.length})`} pad={false} actions={draft && <div className="flex gap-2"><button type="button" className="btn" onClick={() => setBulk(true)}>إضافة من أصناف العميل</button><button type="button" className="btn btn-primary" onClick={() => setItem(true)}><Plus className="h-4 w-4" />صنف</button></div>}>
        <DataTable rows={items} columns={covCols} emptyTitle="لا أصناف مشمولة" emptyHint="البلاغ يُغطّى فقط إذا كان صنفه أو رقمه التسلسلي مدرجاً هنا." />
        <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">بطاقات المعدات الفعلية من وحدة الأصول (قريباً)؛ هنا مرجع نصي فقط.</p>
      </Card>

      <Card title="آخر البلاغات" pad={false} actions={<span className="flex gap-2"><Link className="btn" to={`/contracts/${c.id}/print?doc=service`}>طباعة كشف الخدمة</Link><Link className="btn" to="/service/calls">محاكي البلاغات</Link></span>}>
        <DataTable rows={calls} compact emptyTitle="لا بلاغات" columns={[
          { key: 'n', label: 'البلاغ', render: (x: ServiceCall) => <span dir="ltr">{x.no}</span> }, { key: 'o', label: 'فُتح', render: (x: ServiceCall) => fmtStamp(x.openedAt) },
          { key: 's', label: 'الحالة', render: (x: ServiceCall) => <Badge tone="gray">{statusText[x.status]}</Badge> }, { key: 'l', label: 'SLA', render: (x: ServiceCall) => <SlaBadge s={callSla(db, x).worst} /> },
        ] as Column<ServiceCall>[]} />
      </Card>
      {item && <ItemDialog c={c} onClose={() => setItem(false)} />}
      {bulk && <BulkDialog c={c} onClose={() => setBulk(false)} />}
    </div>
  )
}

function ItemDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const [f, setF] = useState({ itemId: '', serial: '', description: '', ws: '', we: '' })
  const [err, setErr] = useState('')
  return (
    <Modal title="صنف مشمول بالخدمة" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
      <button type="button" className="btn btn-primary" onClick={() => { if (!f.itemId && !f.serial.trim()) return setErr('حدّد الصنف أو الرقم التسلسلي'); run((d) => { d.coveredItems.push({ id: uid('ci'), contractId: c.id, itemId: f.itemId || undefined, serial: f.serial.trim() || undefined, description: f.description || db.items.find((i) => i.id === f.itemId)?.name || f.serial, warrantyStart: f.ws || undefined, warrantyEnd: f.we || undefined }) }, 'أُضيف الصنف'); onClose() }}>إضافة</button></>}>
      <div className="space-y-3">
        <Field label="الصنف"><ItemSelect value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} /></Field>
        <Field label="الرقم التسلسلي"><input className="inp" dir="ltr" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field>
        <Field label="الوصف / الموقع"><input className="inp" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="بداية الضمان"><DateInput value={f.ws} onChange={(v) => setF({ ...f, ws: v })} /></Field><Field label="نهاية الضمان"><DateInput value={f.we} onChange={(v) => setF({ ...f, we: v })} /></Field></div>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

/** Bulk add: items already sold to the customer (delivery/invoice documents of the agreements simulator). */
function BulkDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const sold = [...new Set(db.mockDocs.filter((d) => d.partnerId === c.counterpartyId && ['DLN', 'INV'].includes(d.docType) && d.state === 'Active').flatMap((d) => d.lines.map((l) => l.itemId)))]
    .filter((id) => !db.coveredItems.some((i) => i.contractId === c.id && i.itemId === id))
  const [sel, setSel] = useState<string[]>([])
  return (
    <Modal title="أصناف العميل المُسلَّمة" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
      <button type="button" className="btn btn-primary" disabled={!sel.length} onClick={() => { run((d) => { sel.forEach((id) => d.coveredItems.push({ id: uid('ci'), contractId: c.id, itemId: id, description: d.items.find((i) => i.id === id)?.name ?? id })) }, `أُضيف ${sel.length} صنف`); onClose() }}>إضافة المحدد</button></>}>
      {sold.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">لا أصناف مُسلَّمة لهذا العميل غير مشمولة بعد.</p> : (
        <ul className="space-y-1">{sold.map((id) => <li key={id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, id] : x.filter((y) => y !== id)))} />{db.items.find((i) => i.id === id)?.name}</label></li>)}</ul>)}
    </Modal>
  )
}
