import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '../../components/DataTable'
import { BalanceBar } from '../../components/display'
import { CategorySelect, DateInput, ItemSelect } from '../../components/inputs'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { convertAmount } from '../../data/currency'
import { fmtDate, money, uid } from '../../data/format'
import { balanceOf, committedUnits, committedValue, counterUnits, hasDrift, netPrice, remaining, scheduleOf } from '../../data/fulfillment'
import { today } from '../../data/asof'
import { addAudit, useStore } from '../../data/store'
import type { Contract, ContractLine } from '../../data/types'
import { fmtUnits, lineTarget, qty } from './shared'

const editable = (c: Contract) => c.status === 'Draft'

/** A1 — commitment lines with balance bars. Draft agreements are editable (A2); the delivery schedule (A8) opens per line. */
export function AgreementLinesTab({ c }: { c: Contract }) {
  const { db, can, run } = useStore()
  const [edit, setEdit] = useState<ContractLine | 'new' | null>(null)
  const [sched, setSched] = useState<ContractLine | null>(null)
  const rows = db.lines.filter((l) => l.contractId === c.id)
  const canEdit = editable(c) && can('Contracts.Edit')
  const del = (l: ContractLine) => run((d) => {
    d.lines = d.lines.filter((x) => x.id !== l.id)
    d.schedules = d.schedules.filter((s) => s.lineId !== l.id)
    syncValue(d, c.id)
    addAudit(d, 'contract', c.id, 'line:delete', `بند ${l.lineNum}`)
  }, 'حُذف البند')
  const cols: Column<ContractLine>[] = [
    { key: 'n', label: '#', render: (l) => l.lineNum },
    { key: 'item', label: 'الصنف / التصنيف', render: (l) => <div><div className="font-medium">{lineTarget(db, l)}</div><div className="text-[11px] text-gray-400">{l.itemId ? db.items.find((i) => i.id === l.itemId)?.code : 'التزام على تصنيف'}</div></div> },
    { key: 'type', label: 'الالتزام', render: (l) => <div>{l.commitmentType === 'Quantity' ? 'كمية' : 'قيمة'}<div className="text-[11px] text-gray-500">{fmtUnits(db, c, l, committedUnits(l))}</div></div> },
    { key: 'price', label: 'السعر', num: true, render: (l) => (l.commitmentType === 'Quantity' ? <div>{money(netPrice(l), c.currency)}{l.discountPercent > 0 && <div className="text-[11px] text-gray-400">خصم {l.discountPercent}%</div>}</div> : '—') },
    {
      key: 'bal', label: 'الرصيد', render: (l) => {
        const b = balanceOf(db, l.id)
        const u = (k: 'Release' | 'Fulfill' | 'Invoice') => counterUnits(l, b, k)
        return <BalanceBar committed={committedUnits(l)} released={u('Release')} fulfilled={u('Fulfill')} invoiced={u('Invoice')} format={(n) => (l.commitmentType === 'Quantity' ? qty(n) : money(n, c.currency))} />
      },
    },
    {
      key: 'rem', label: 'المتبقي', num: true, render: (l) => {
        const r = remaining(db, c, l)
        return <span className={r.left < 0 ? 'font-semibold text-red-600' : r.pct >= 80 ? 'font-semibold text-amber-600' : ''}>{fmtUnits(db, c, l, r.left)}</span>
      },
    },
    {
      key: 'lim', label: 'القيود', render: (l) => (
        <div className="flex max-w-[170px] flex-wrap gap-1 text-[10px] text-gray-500">
          {l.enforceMax && <Badge tone="amber">حد أقصى</Badge>}
          {l.minRelease ? <span>أدنى {qty(l.minRelease)}</span> : null}{l.maxRelease ? <span>أعلى {qty(l.maxRelease)}</span> : null}
          {(l.validFrom || l.validTo) && <span>{fmtDate(l.validFrom)} ← {fmtDate(l.validTo)}</span>}
          {hasDrift(db, l.id) && <Badge tone="red">انحراف</Badge>}
        </div>) },
    { key: 'st', label: 'الحالة', render: (l) => <Badge tone={l.status === 'Open' ? 'green' : 'gray'}>{l.status === 'Open' ? 'مفتوح' : 'مغلق'}</Badge> },
    {
      key: 'x', label: '', render: (l) => (
        <div className="flex gap-1 text-gray-400">
          <button type="button" title="جدول التسليم" className="rounded p-1 hover:bg-gray-100 hover:text-navy" onClick={() => setSched(l)}><CalendarClock className="h-4 w-4" /></button>
          {canEdit && <button type="button" title="تعديل" className="rounded p-1 hover:bg-gray-100 hover:text-navy" onClick={() => setEdit(l)}><Pencil className="h-4 w-4" /></button>}
          {canEdit && <button type="button" title="حذف" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={() => del(l)}><Trash2 className="h-4 w-4" /></button>}
        </div>) },
  ]
  const total = rows.reduce((s, l) => s + committedValue(l), 0)
  return (
    <Card title="بنود الالتزام" pad={false} actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" />بند جديد</button>}>
      <DataTable rows={rows} columns={cols} emptyTitle="لا بنود" emptyHint="اتفاقية الالتزام تتطلب بنداً واحداً على الأقل قبل الإرسال." />
      <div className="flex flex-wrap justify-between gap-2 border-t border-line px-4 py-2 text-xs text-gray-500">
        <span>الأرصدة محسوبة من دفتر التنفيذ؛ الأساس الحالي لحساب المتبقي حسب إعداد «متى تُحتسب الكمية مستهلكة».</span>
        <span className="font-semibold text-gray-800">إجمالي الالتزام: {money(total, c.currency)}{c.currency !== 'IQD' && ` ≈ ${money(convertAmount(db, total, c.currency, 'IQD', today()), 'IQD')}`}</span>
      </div>
      {!canEdit && c.status !== 'Draft' && <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">بنود الاتفاقية مقفلة بعد الاعتماد؛ التعديل عبر ملحق (وحدة الملاحق).</p>}
      {edit && <LineDialog c={c} line={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {sched && <ScheduleDialog c={c} line={sched} onClose={() => setSched(null)} />}
    </Card>
  )
}

/** While Draft the contract value follows the sum of the commitments. */
function syncValue(d: ReturnType<typeof useStore>['db'], contractId: string) {
  const c = d.contracts.find((x) => x.id === contractId)
  if (c && c.status === 'Draft') c.contractValue = d.lines.filter((l) => l.contractId === contractId).reduce((s, l) => s + committedValue(l), 0) || undefined
}

/** A2 — line editor: item or category (with sub-categories), unit, commitment, price, limits, validity. */
function LineDialog({ c, line, onClose }: { c: Contract; line?: ContractLine; onClose: () => void }) {
  const { db, run } = useStore()
  const [target, setTarget] = useState<'item' | 'category'>(line?.categoryId ? 'category' : 'item')
  const [f, setF] = useState<ContractLine>(line ?? {
    id: '', contractId: c.id, lineNum: 0, description: '', commitmentType: 'Quantity', agreedQuantity: 0, unitPrice: 0, discountPercent: 0,
    priceFixed: true, enforceMax: false, status: 'Open', notes: '',
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof ContractLine>(k: K, v: ContractLine[K]) => setF((x) => ({ ...x, [k]: v }))
  const pickItem = (id: string) => {
    const it = db.items.find((i) => i.id === id)
    setF((x) => ({ ...x, itemId: id || undefined, categoryId: undefined, description: it?.name ?? '', uomId: it?.uomId, unitPrice: it ? Math.round(convertAmount(db, it.basePrice, it.currency, c.currency, today()) * 100) / 100 : x.unitPrice }))
  }
  const pickCat = (id: string) => setF((x) => ({ ...x, categoryId: id || undefined, itemId: undefined, description: db.categories.find((k) => k.id === id)?.name ?? '' }))
  const save = () => {
    if (target === 'item' && !f.itemId) return setErr('اختر الصنف')
    if (target === 'category' && !f.categoryId) return setErr('اختر التصنيف')
    if (f.commitmentType === 'Quantity' && !((f.agreedQuantity ?? 0) > 0)) return setErr('الكمية الملتزم بها مطلوبة')
    if (f.commitmentType === 'Value' && !((f.agreedValue ?? 0) > 0)) return setErr('القيمة الملتزم بها مطلوبة')
    if (f.minRelease && f.maxRelease && f.minRelease > f.maxRelease) return setErr('الحد الأدنى للإصدار أكبر من الحد الأقصى')
    if (f.validFrom && f.validTo && f.validTo < f.validFrom) return setErr('نهاية الصلاحية قبل بدايتها')
    if (db.lines.some((l) => l.contractId === c.id && l.id !== f.id && ((f.itemId && l.itemId === f.itemId) || (f.categoryId && l.categoryId === f.categoryId)))) return setErr('يوجد بند آخر لنفس الصنف/التصنيف في هذه الاتفاقية')
    run((d) => {
      const next = { ...f, itemId: target === 'item' ? f.itemId : undefined, categoryId: target === 'category' ? f.categoryId : undefined, includeSubcategories: target === 'category' ? !!f.includeSubcategories : undefined }
      if (line) d.lines = d.lines.map((x) => (x.id === line.id ? next : x))
      else {
        const num = Math.max(0, ...d.lines.filter((l) => l.contractId === c.id).map((l) => l.lineNum)) + 1
        d.lines.push({ ...next, id: `${c.id}-l${num}-${uid('x').slice(2, 5)}`, lineNum: num })
      }
      syncValue(d, c.id)
      addAudit(d, 'contract', c.id, line ? 'line:edit' : 'line:add', f.description)
    }, line ? 'حُدّث البند' : 'أُضيف البند')
    onClose()
  }
  return (
    <Modal wide title={line ? `تعديل البند ${line.lineNum}` : 'بند التزام جديد'} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>حفظ</button></>}>
      <div className="space-y-3">
        <FormGrid>
          <Field label="الالتزام على"><Select value={target} onChange={setTarget} options={[{ value: 'item', label: 'صنف محدد' }, { value: 'category', label: 'تصنيف أصناف' }]} /></Field>
          <Field label={target === 'item' ? 'الصنف' : 'التصنيف'} span={2} required>
            {target === 'item' ? <ItemSelect value={f.itemId ?? ''} onChange={pickItem} /> : <CategorySelect value={f.categoryId ?? ''} onChange={pickCat} />}
          </Field>
          {target === 'category' && <Field label="التصنيفات الفرعية"><label className="flex h-8 items-center gap-2 text-sm"><input type="checkbox" checked={!!f.includeSubcategories} onChange={(e) => set('includeSubcategories', e.target.checked)} />تشمل الفرعية</label></Field>}
          <Field label="نوع الالتزام"><Select value={f.commitmentType} onChange={(v) => set('commitmentType', v)} options={[{ value: 'Quantity', label: 'كمية' }, { value: 'Value', label: 'قيمة' }]} /></Field>
          <Field label="وحدة القياس"><Select value={f.uomId ?? ''} onChange={(v) => set('uomId', v || undefined)} placeholder="—" options={db.uoms.map((u) => ({ value: u.id, label: u.name }))} /></Field>
          {f.commitmentType === 'Quantity'
            ? <Field label="الكمية الملتزم بها" required><NumInput value={f.agreedQuantity ?? 0} onChange={(n) => set('agreedQuantity', n)} /></Field>
            : <Field label={`القيمة الملتزم بها (${c.currency})`} required><NumInput value={f.agreedValue ?? 0} onChange={(n) => set('agreedValue', n)} /></Field>}
          {f.commitmentType === 'Quantity' && <Field label={`سعر الوحدة (${c.currency})`}><NumInput value={f.unitPrice} onChange={(n) => set('unitPrice', n)} /></Field>}
          {f.commitmentType === 'Quantity' && <Field label="خصم %"><NumInput value={f.discountPercent} onChange={(n) => set('discountPercent', Math.min(100, n))} /></Field>}
          <Field label={`حد أدنى للإصدار (${f.commitmentType === 'Quantity' ? 'كمية' : 'قيمة'})`}><NumInput value={f.minRelease ?? 0} onChange={(n) => set('minRelease', n || undefined)} /></Field>
          <Field label="حد أقصى للإصدار"><NumInput value={f.maxRelease ?? 0} onChange={(n) => set('maxRelease', n || undefined)} /></Field>
          <Field label="صلاحية البند من"><DateInput value={f.validFrom ?? ''} onChange={(v) => set('validFrom', v || undefined)} /></Field>
          <Field label="إلى"><DateInput value={f.validTo ?? ''} onChange={(v) => set('validTo', v || undefined)} /></Field>
          <Field label="خيارات" span={2}>
            <div className="flex h-8 items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.priceFixed} onChange={(e) => set('priceFixed', e.target.checked)} />السعر ثابت</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.enforceMax} onChange={(e) => set('enforceMax', e.target.checked)} />منع تجاوز الالتزام الكلي</label>
            </div>
          </Field>
          <Field label="ملاحظات" span={3}><input className="inp" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </FormGrid>
        {f.commitmentType === 'Quantity' && <p className="text-[11px] text-gray-400">قيمة البند = الكمية × السعر الصافي = {money((f.agreedQuantity ?? 0) * f.unitPrice * (1 - f.discountPercent / 100), c.currency)}</p>}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

const schedTone = { Met: 'green', Late: 'red', Upcoming: 'blue' } as const
const schedLabel = { Met: 'مُنفَّذ', Late: 'متأخر', Upcoming: 'قادم' } as const

/** A8 — delivery schedule per line: informational, compared with the fulfilled quantity (BR-A-12, no orders are created). */
function ScheduleDialog({ c, line, onClose }: { c: Contract; line: ContractLine; onClose: () => void }) {
  const { db, run, can } = useStore()
  const [date, setDate] = useState('')
  const [q, setQ] = useState(0)
  const [note, setNote] = useState('')
  const rows = scheduleOf(db, line)
  const canEdit = can('Contracts.Edit') && !['Terminated', 'Cancelled', 'Closed', 'Expired'].includes(c.status)
  const scheduled = rows.reduce((s, r) => s + r.item.quantity, 0)
  const agreed = line.commitmentType === 'Quantity' ? line.agreedQuantity ?? 0 : 0
  const fulfilled = balanceOf(db, line.id).fulQ
  const add = () => {
    if (!date || !(q > 0)) return
    run((d) => { d.schedules.push({ id: uid('sch'), lineId: line.id, dueDate: date, quantity: q, note }); addAudit(d, 'contract', c.id, 'schedule:add', `بند ${line.lineNum} ${date}`) }, 'أُضيف موعد التسليم')
    setDate(''); setQ(0); setNote('')
  }
  return (
    <Modal wide title={`جدول التسليم — البند ${line.lineNum}: ${lineTarget(db, line)}`} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>إغلاق</button>}>
      {line.commitmentType === 'Value' ? <p className="text-sm text-gray-500">جدول التسليم بالكمية؛ هذا البند التزام بالقيمة.</p> : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">المجدول</div><div className="text-base font-bold tabular-nums">{qty(scheduled)}</div></div>
            <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">الملتزم</div><div className="text-base font-bold tabular-nums">{qty(agreed)}</div></div>
            <div className="rounded bg-gray-50 p-2"><div className="text-gray-500">المنفّذ فعلياً</div><div className="text-base font-bold tabular-nums">{qty(fulfilled)}</div></div>
          </div>
          {scheduled > agreed && <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">المجدول ({qty(scheduled)}) يزيد على الالتزام ({qty(agreed)}).</div>}
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-start text-xs text-gray-500"><th className="py-1.5 text-start">الموعد</th><th className="text-start">الكمية</th><th className="text-start">التراكمي</th><th className="text-start">الحالة</th><th className="text-start">ملاحظة</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">لا مواعيد تسليم</td></tr>}
              {rows.map((r) => (
                <tr key={r.item.id} className="border-b border-gray-100">
                  <td className="py-1.5">{fmtDate(r.item.dueDate)}</td><td className="tabular-nums">{qty(r.item.quantity)}</td><td className="tabular-nums">{qty(r.cumulative)}</td>
                  <td><Badge tone={schedTone[r.status]}>{schedLabel[r.status]}{r.status === 'Late' ? ` — عجز ${qty(r.shortfall)}` : ''}</Badge></td>
                  <td className="text-gray-500">{r.item.note}</td>
                  <td>{canEdit && <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => run((d) => { d.schedules = d.schedules.filter((x) => x.id !== r.item.id) }, 'حُذف الموعد')}><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="grid items-end gap-2 md:grid-cols-5">
              <Field label="الموعد"><DateInput value={date} onChange={setDate} /></Field>
              <Field label="الكمية"><NumInput value={q} onChange={setQ} /></Field>
              <Field label="ملاحظة" span={2}><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <button type="button" className="btn btn-primary" disabled={!date || !(q > 0)} onClick={add}><Plus className="h-4 w-4" />إضافة</button>
            </div>
          )}
          <p className="text-[11px] text-gray-400">الجدول إرشادي: لا يُنشئ أوامر تلقائياً. الحالة تقارن التراكمي المستحق بالمنفّذ فعلياً.</p>
        </div>
      )}
    </Modal>
  )
}
