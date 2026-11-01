import { AlertTriangle, ArrowLeftRight, Ban, CheckCircle2, Pencil, Undo2, Unlink2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { BalanceBar } from '../../components/display'
import { DateInput, SearchableSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { Card, Field, Modal, NumInput, Select } from '../../components/ui'
import { today } from '../../data/asof'
import { convertAmount, rateOn } from '../../data/currency'
import { fmtDate, money, num } from '../../data/format'
import {
  agreementCfg, balanceOf, baseTypes, counterLabel, counterUnits, createReturn, docMeta, docTypesFor, editDoc, findLine, isReturn, lineMatchesItem, netPrice,
  postDoc, previewPost, remaining, setDocState, signsOf, type DocSpec, type Issue, type Outcome,
} from '../../data/fulfillment'
import { changeSetting } from '../../data/admin'
import { settingDefs } from '../../data/settings'
import { useStore } from '../../data/store'
import type { Contract, CurrencyCode, DocType, MockDoc, SettingKey } from '../../data/types'
import { DocStateBadge, fmtUnits, lineTarget, qty, ReasonBadge, signed } from './shared'

const quick: SettingKey[] = ['Agreements.EnforcementMode', 'Agreements.OnFulfillmentFailure', 'Agreements.FulfillmentBasis', 'Agreements.ReturnsRestoreCommitment', 'Currency.ConversionRateSource']

/** A5 — demo document simulator: creates mock Sales/Procurement/Inventory documents against an agreement and shows what the contract handler does. */
export default function Simulator() {
  const { db, run, can, toast } = useStore()
  const canAct = can('Contracts.Edit')
  const agreements = db.contracts.filter((c) => c.profile === 'Agreement' && !['Draft', 'Cancelled'].includes(c.status))
  const [cid, setCid] = useState(() => agreements.find((c) => c.status === 'Active')?.id ?? '')
  const c = db.contracts.find((x) => x.id === cid)
  const side = c?.direction === 'Incoming' ? 'Purchase' : 'Sales'
  const [docType, setDocType] = useState<DocType>('SOR')
  const [itemId, setItemId] = useState('')
  const [q, setQ] = useState(100)
  const [price, setPrice] = useState<number | null>(null)
  const [cur, setCur] = useState<CurrencyCode | ''>('')
  const [rate, setRate] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [baseId, setBaseId] = useState('')
  const [stock, setStock] = useState(false)
  const [last, setLast] = useState<{ title: string; out: Outcome } | null>(null)
  const [dlg, setDlg] = useState<{ kind: 'edit' | 'return'; doc: MockDoc } | null>(null)

  const types = docTypesFor(side)
  const type: DocType = types.includes(docType) ? docType : types[0]
  const myLines = c ? db.lines.filter((l) => l.contractId === c.id) : []
  const itemOptions = c ? db.items.filter((i) => myLines.some((l) => lineMatchesItem(db, l, i.id))) : []
  const item = itemId && itemOptions.some((i) => i.id === itemId) ? itemId : itemOptions[0]?.id ?? ''
  const line = c && item ? findLine(db, c, item) : undefined
  const currency: CurrencyCode = cur || c?.currency || 'IQD'
  const docRate = currency === 'IQD' ? 1 : rate ?? rateOn(db, currency, date)
  const baseOptions = db.mockDocs.filter((d) => d.agreementId === cid && baseTypes[type].includes(d.docType) && d.state === 'Active')
  const baseDoc = baseOptions.find((d) => d.id === baseId)
  const baseLine = baseDoc?.lines.find((l) => l.itemId === item)
  // price defaults: base document line, else the agreement line price (converted when the document currency differs)
  const defaultPrice = baseLine && baseDoc && baseDoc.currency === currency ? baseLine.unitPrice
    : line && c && line.commitmentType === 'Quantity' ? Math.round(((netPrice(line) * rateOn(db, c.currency, date)) / rateOn(db, currency, date)) * 100) / 100
    : (() => { const it = db.items.find((i) => i.id === item); return it ? Math.round(convertAmount(db, it.basePrice, it.currency, currency, date) * 100) / 100 : 0 })()
  const unitPrice = price ?? defaultPrice
  const needsBase = isReturn(type)
  const spec: DocSpec | null = c && item && q > 0 && (!needsBase || baseDoc) ? {
    docType: type, contractId: c.id, date, currency, rate: docRate, baseDocId: baseDoc?.id, stockMovement: stock, lines: [{ itemId: item, qty: q, unitPrice }],
  } : null
  const preview = useMemo(() => (spec ? previewPost(db, spec) : null), [db, spec ? JSON.stringify(spec) : '']) // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = c ? agreementCfg(db, c) : null

  const post = () => {
    if (!spec || !c) return
    const out = previewPost(db, spec)
    const ok = run((d) => { const r = postDoc(d, spec); return r.error ?? null }, out.kept ? 'حُفظ المستند ووُسمت القيود «تجاوز» (حفظ مع تنبيه)' : `رُحّل ${docMeta[type].label}`)
    setLast({ title: `${docMeta[type].label} — ${ok ? (out.kept ? 'حُفظ مع تنبيه' : 'رُحّل') : 'رُفض وأُلغي'}`, out })
    if (ok) { setPrice(null); setBaseId('') }
  }
  const act = (title: string, fn: (d: typeof db) => Outcome) => {
    let out: Outcome = { issues: [], entries: [] }
    const ok = run((d) => { out = fn(d); return out.error ?? null }, title)
    setLast({ title: `${title}${ok ? '' : ' — رُفض'}`, out })
  }

  const docs = db.mockDocs.filter((d) => d.agreementId === cid).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }))
  const docCols: Column<MockDoc>[] = [
    { key: 'ref', label: 'المستند', render: (d) => <div><span className="font-medium" dir="ltr">{d.ref}</span><div className="text-[11px] text-gray-400">{docMeta[d.docType].label}</div></div> },
    { key: 'date', label: 'التاريخ', render: (d) => fmtDate(d.date) },
    { key: 'lines', label: 'الأصناف', render: (d) => <div className="text-xs">{d.lines.map((l) => <div key={l.id}>{db.items.find((i) => i.id === l.itemId)?.name} × {qty(l.qty)}</div>)}</div> },
    { key: 'val', label: 'القيمة', num: true, render: (d) => <span dir="ltr">{money(d.lines.reduce((s, l) => s + l.netValueDoc, 0), d.currency)}</span> },
    { key: 'contrib', label: 'المساهمة', render: (d) => { const s = c ? signsOf(db, c, d) : {}; const t = (['Release', 'Fulfill', 'Invoice'] as const).filter((k) => s[k]).map((k) => `${counterLabel[k].split(' ')[0]} ${s[k]! > 0 ? '+' : '−'}`).join(' · '); return <span className="text-xs">{t || <span className="text-gray-300">—</span>}</span> } },
    { key: 'st', label: 'الحالة', render: (d) => <div><DocStateBadge state={d.state} /><div className="text-[10px] text-gray-400">r{d.revision}</div></div> },
    ...(canAct ? [{
      key: 'x', label: '', render: (d: MockDoc) => (
        <div className="flex flex-wrap gap-1 text-gray-500">
          {d.state === 'Active' && <button type="button" title="تعديل" className="rounded p-1 hover:bg-gray-100" onClick={() => setDlg({ kind: 'edit', doc: d })}><Pencil className="h-4 w-4" /></button>}
          {d.state === 'Active' && ['INV', 'DLN', 'PCH', 'PDN'].includes(d.docType) && <button type="button" title="مرتجع" className="rounded p-1 hover:bg-gray-100" onClick={() => setDlg({ kind: 'return', doc: d })}><Undo2 className="h-4 w-4" /></button>}
          {d.state === 'Active' && <button type="button" title="إلغاء" className="rounded p-1 hover:bg-gray-100" onClick={() => act(`أُلغي ${d.ref}`, (x) => setDocState(x, d.id, 'Cancelled'))}><XCircle className="h-4 w-4" /></button>}
          {d.state === 'Active' && <button type="button" title="عكس" className="rounded p-1 hover:bg-gray-100" onClick={() => act(`عُكس ${d.ref}`, (x) => setDocState(x, d.id, 'Reversed'))}><ArrowLeftRight className="h-4 w-4" /></button>}
          {d.state === 'Active' && <button type="button" title="فك الربط بالاتفاقية" className="rounded p-1 hover:bg-gray-100" onClick={() => act(`فُكّ ربط ${d.ref}`, (x) => setDocState(x, d.id, 'Unlinked'))}><Unlink2 className="h-4 w-4" /></button>}
          {d.state === 'Active' && <button type="button" title="حذف" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={() => act(`حُذف ${d.ref}`, (x) => setDocState(x, d.id, 'Deleted'))}><Ban className="h-4 w-4" /></button>}
        </div>) }] : []),
  ]
  const setSetting = (key: SettingKey, v: string | boolean) => run((d) => changeSetting(d, key, v), 'تغيّر الإعداد (يسري فوراً على المحاكاة)')

  return (
    <div>
      <PageHeader crumbs={[{ label: 'الاتفاقيات', to: '/agreements' }, { label: 'محاكي المستندات' }]} title="محاكي مستندات المبيعات والمشتريات"
        actions={<Link to="/agreements/resolve" className="btn">اختبار مطابقة الاتفاقية</Link>} />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">في النظام الحقيقي تُنشأ هذه المستندات من وحدات المبيعات والمشتريات والمخزون ويستدعي معالج العقد عند الحفظ؛ هنا نحاكي المستند وردّ فعل العقد معاً، ويمكنك تبديل إعدادات النظام ومشاهدة الأثر.</div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="مستند جديد">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="الاتفاقية" span={2}>
                <SearchableSelect clearable={false} value={cid} onChange={(v) => { setCid(v); setItemId(''); setBaseId(''); setPrice(null); setCur('') }}
                  options={agreements.map((a) => ({ value: a.id, label: `${a.number} — ${a.title}`, hint: a.status === 'Active' ? undefined : a.status === 'OnHold' ? 'معلّقة' : a.status }))} />
              </Field>
              <Field label="نوع المستند"><Select value={type} onChange={(v) => { setDocType(v); setBaseId(''); setPrice(null) }} options={types.map((t) => ({ value: t, label: `${docMeta[t].label} (${t})` }))} /></Field>
              <Field label="الصنف"><Select value={item} onChange={(v) => { setItemId(v); setPrice(null); setBaseId('') }} options={itemOptions.map((i) => ({ value: i.id, label: i.name }))} /></Field>
              <Field label="الكمية"><NumInput value={q} onChange={setQ} /></Field>
              <Field label={`سعر الوحدة (${currency})`} hint={line && c ? `بند الاتفاقية ${line.lineNum}: ${line.commitmentType === 'Quantity' ? money(netPrice(line), c.currency) : 'التزام بالقيمة'}` : undefined}><NumInput value={unitPrice} onChange={setPrice} /></Field>
              <Field label="عملة المستند"><Select value={currency} onChange={(v) => { setCur(v); setPrice(null); setRate(null) }} options={db.currencies.map((x) => ({ value: x.code, label: `${x.code} — ${x.name}` }))} /></Field>
              <Field label="سعر الصرف (د.ع)"><NumInput value={docRate} onChange={setRate} disabled={currency === 'IQD'} /></Field>
              <Field label="تاريخ المستند"><DateInput value={date} onChange={setDate} /></Field>
              {baseTypes[type].length > 0 && (
                <Field label={needsBase ? 'المستند الأساسي (مطلوب)' : 'المستند الأساسي (اختياري)'} span={2}>
                  <SearchableSelect value={baseId} onChange={setBaseId} placeholder="بدون أساس — مستند مباشر" options={baseOptions.map((d) => ({ value: d.id, label: `${d.ref} — ${docMeta[d.docType].label}`, hint: d.lines.map((l) => qty(l.qty)).join('/') }))} />
                </Field>
              )}
              {(type === 'INV' || type === 'PCH') && <Field label="حركة مخزنية"><label className="flex h-8 items-center gap-2 text-sm"><input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} />الفاتورة تُنشئ حركة مخزنية</label></Field>}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="btn btn-primary" disabled={!spec || !canAct} title={!canAct ? 'تتطلب صلاحية تعديل العقود' : undefined} onClick={post}>ترحيل المستند</button>
              {!spec && needsBase && <span className="text-xs text-gray-500">اختر المستند الأساسي للمرتجع.</span>}
              <span className="ms-auto text-xs text-gray-400">القيمة: {money(q * unitPrice, currency)}{c && currency !== c.currency ? ` ← عملة العقد ${c.currency}` : ''}</span>
            </div>
          </Card>

          {preview && c && (
            <Card title="المعاينة قبل الترحيل (ما سيفعله معالج العقد)">
              <Verdict out={preview} />
              <IssuesList issues={preview.issues} />
              <EntriesTable c={c} entries={preview.entries} empty="لا قيود: المستند لا يساهم في عدّادات هذه الاتفاقية بحسب نوعه وإعداداتك." />
            </Card>
          )}
          {last && c && (
            <Card title={`آخر عملية: ${last.title}`}>
              <IssuesList issues={last.out.issues} />
              {last.out.error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{last.out.error}</div>}
              <EntriesTable c={c} entries={last.out.entries} empty="لا قيود جديدة." />
            </Card>
          )}
          <Card title={`مستندات الاتفاقية (${docs.length})`} pad={false}>
            <DataTable rows={docs} columns={docCols} compact emptyTitle="لا مستندات" />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="إعدادات النظام المؤثرة">
            <div className="space-y-3 text-sm">
              {quick.map((k) => {
                const def = settingDefs.find((x) => x.key === k)!
                const v = db.settings[k]
                return (
                  <Field key={k} label={def.label}>
                    {def.kind === 'bool'
                      ? <label className="flex items-center gap-2"><input type="checkbox" checked={!!v} onChange={(e) => setSetting(k, e.target.checked)} />{v ? 'نعم' : 'لا'}</label>
                      : <Select value={String(v)} onChange={(x) => setSetting(k, x)} options={def.options!} />}
                  </Field>
                )
              })}
              <p className="text-[11px] text-gray-400">نوع العقد قد يتجاوز بعض هذه الإعدادات. تُدار كلها في «إعدادات النظام».</p>
            </div>
          </Card>
          {c && (
            <Card title="أرصدة بنود الاتفاقية">
              <div className="space-y-3">
                {myLines.map((l) => {
                  const b = balanceOf(db, l.id), r = remaining(db, c, l)
                  const u = (k: 'Release' | 'Fulfill' | 'Invoice') => counterUnits(l, b, k)
                  return (
                    <div key={l.id} className={l.id === line?.id ? 'rounded-md ring-1 ring-navy/30' : ''}>
                      <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{l.lineNum}. {lineTarget(db, l)}</span><span className={r.left < 0 ? 'text-red-600' : 'text-gray-500'}>متبقٍ {fmtUnits(db, c, l, r.left)}</span></div>
                      <BalanceBar committed={l.commitmentType === 'Quantity' ? l.agreedQuantity ?? 0 : l.agreedValue ?? 0} released={u('Release')} fulfilled={u('Fulfill')} invoiced={u('Invoice')} format={(n) => num(n)} />
                    </div>)
                })}
              </div>
              <div className="mt-3 flex justify-end"><Link to={`/contracts/${c.id}`} className="text-xs text-navy underline">فتح الاتفاقية</Link></div>
            </Card>
          )}
          {cfg && c && <div className="text-[11px] text-gray-400">الاتفاقية بحالة «{c.status === 'Active' ? 'سارية' : c.status === 'OnHold' ? 'معلّقة' : c.status}» — الإنفاذ الحالي: {cfg.mode === 'None' ? 'تتبع فقط' : cfg.mode === 'Warn' ? 'تحذير' : 'منع'}.</div>}
        </div>
      </div>
      {dlg?.kind === 'edit' && c && <EditDialog doc={dlg.doc} onClose={() => setDlg(null)} onDone={act} />}
      {dlg?.kind === 'return' && <ReturnDialog doc={dlg.doc} onClose={() => setDlg(null)} onDone={act} toast={toast} />}
    </div>
  )
}

function Verdict({ out }: { out: Outcome }) {
  const errs = out.issues.filter((i) => i.level === 'error').length
  if (out.error) return <div className="mb-2 flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"><XCircle className="h-4 w-4" />سيُرفض المستند ولا يُحفظ: {out.error}</div>
  if (out.kept) return <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />سيُحفظ المستند ويُوسم «تجاوز» ويُنبَّه المسؤول ({errs} مخالفة).</div>
  if (out.issues.length) return <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />سيُحفظ المستند مع {out.issues.length} تحذير.</div>
  return <div className="mb-2 flex items-center gap-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />سيُحفظ المستند دون ملاحظات.</div>
}
function IssuesList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null
  return <ul className="mb-3 space-y-1 text-xs">{issues.map((i, k) => <li key={k} className={`rounded px-2 py-1 ${i.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{i.level === 'error' ? 'خطأ' : 'تحذير'}: {i.text}</li>)}</ul>
}
function EntriesTable({ c, entries, empty }: { c: Contract; entries: Outcome['entries']; empty: string }) {
  if (!entries.length) return <div className="py-3 text-center text-sm text-gray-400">{empty}</div>
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-line text-xs text-gray-500"><th className="py-1 text-start">البند</th><th className="text-start">العدّاد</th><th className="text-start">الكمية</th><th className="text-start">القيمة ({c.currency})</th><th className="text-start">سعر التحويل</th><th className="text-start">السبب</th></tr></thead>
      <tbody>{entries.map((e) => (
        <tr key={e.id} className="border-b border-gray-100">
          <td className="py-1">{e.lineNum}</td><td>{counterLabel[e.entryType]}</td>
          <td className={`tabular-nums ${e.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{signed(e.quantityDelta)}</td>
          <td className="tabular-nums">{signed(e.valueDelta, c.currency === 'USD' ? 2 : 0)}{e.docCurrency !== c.currency && <span className="ms-1 text-[11px] text-gray-400">({signed(e.docValueDelta, e.docCurrency === 'USD' ? 2 : 0)} {e.docCurrency})</span>}</td>
          <td className="tabular-nums">{e.rateUsed === 1 ? '—' : num(e.rateUsed, 2)}</td><td><ReasonBadge reason={e.reason} /></td>
        </tr>))}</tbody>
    </table>
  )
}

function EditDialog({ doc, onClose, onDone }: { doc: MockDoc; onClose: () => void; onDone: (t: string, fn: (d: ReturnType<typeof useStore>['db']) => Outcome) => void }) {
  const [rows, setRows] = useState(doc.lines.map((l) => ({ lineId: l.id, qty: l.qty, unitPrice: l.unitPrice })))
  const [date, setDate] = useState(doc.date)
  const { db } = useStore()
  return (
    <Modal title={`تعديل ${doc.ref} (نسخة ${doc.revision} ← ${doc.revision + 1})`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => { onDone(`عُدّل ${doc.ref}`, (d) => editDoc(d, doc.id, rows, date)); onClose() }}>حفظ التعديل</button></>}>
      <div className="space-y-3">
        <Field label="التاريخ"><DateInput value={date} onChange={setDate} /></Field>
        {rows.map((r, i) => (
          <div key={r.lineId} className="grid grid-cols-2 gap-3">
            <Field label={`${db.items.find((x) => x.id === doc.lines[i].itemId)?.name} — الكمية`}><NumInput value={r.qty} onChange={(n) => setRows((x) => x.map((y, k) => (k === i ? { ...y, qty: n } : y)))} /></Field>
            <Field label={`السعر (${doc.currency})`}><NumInput value={r.unitPrice} onChange={(n) => setRows((x) => x.map((y, k) => (k === i ? { ...y, unitPrice: n } : y)))} /></Field>
          </div>
        ))}
        <p className="text-[11px] text-gray-400">يُضيف النظام قيد فرق بنسخة أعلى؛ لا يُعدَّل أي قيد سابق.</p>
      </div>
    </Modal>
  )
}

function ReturnDialog({ doc, onClose, onDone, toast }: { doc: MockDoc; onClose: () => void; onDone: (t: string, fn: (d: ReturnType<typeof useStore>['db']) => Outcome) => void; toast: (m: string, t?: 'ok' | 'err') => void }) {
  const [n, setN] = useState(Math.min(2, doc.lines[0].qty))
  const [stock, setStock] = useState(true)
  return (
    <Modal title={`مرتجع من ${doc.ref}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => { if (!(n > 0)) return toast('أدخل كمية', 'err'); onDone(`أُنشئ مرتجع ${n} من ${doc.ref}`, (d) => createReturn(d, doc.id, n, stock)); onClose() }}>إنشاء المرتجع</button></>}>
      <div className="space-y-3">
        <Field label={`كمية المرتجع (من ${qty(doc.lines[0].qty)})`}><NumInput value={n} onChange={setN} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} />إنشاء الحركة المخزنية ({['INV', 'DLN'].includes(doc.docType) ? 'إدخال مخزني' : 'إخراج مخزني'}) — عندها يعود الالتزام</label>
        <p className="text-[11px] text-gray-400">مرتجع المبيعات يخصم من الفاتورة عند إنشائه، ويخصم من المنفّذ والمحجوز عند الإدخال المخزني؛ بحسب إعداد «إعادة المرتجع إلى رصيد العقد».</p>
        {doc.docType === 'PDN' && <p className="text-[11px] text-amber-700">مرتجع مبني على استلام (بلا فاتورة) لا يخصم من المفوتر.</p>}
      </div>
    </Modal>
  )
}
