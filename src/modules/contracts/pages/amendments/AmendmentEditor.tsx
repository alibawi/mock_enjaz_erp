import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '../../router'
import { DateInput, ItemSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Badge, Card, Field, NumInput, Select } from '../../components/ui'
import { today } from '../../data/asof'
import { amendTypeLabel, createAmendment, floorOf, headerFields, openAmendment, submitAmendment, validateAmendment } from '../../data/amendments'
import { renewalLabel, partyRoleLabel } from '../../data/contractMeta'
import { committedUnits } from '../../data/fulfillment'
import { useStore } from '../../data/store'
import type { AmendmentType, ContractAmendment, ContractLine, HeaderChange, HeaderField, LineFields, LineOp, PartyOp, PartyRole, RenewalPolicy } from '../../data/types'
import { fmtUnits } from '../agreements/shared'
import { ChangeTable, describeChanges, headerText } from './shared'

const typeFields: Record<AmendmentType, HeaderField[]> = {
  ExtendTerm: ['endDate'], ChangeValue: ['contractValue'], ChangeLines: [], ChangeParties: [],
  ChangeTerms: ['deliveryTerms', 'paymentTermId', 'description', 'renewalPolicy', 'noticePeriodDays', 'autoRenewTermMonths'],
  Other: headerFields.map((f) => f.key),
}
type NewLine = { itemId: string; qty: number; price: number }

/** M2 — amendment editor: every change is entered next to the current value (old → new) with live counter warnings. */
export default function AmendmentEditor() {
  const { id, aid } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const c = db.contracts.find((x) => x.id === id)
  const existing = aid ? db.amendments.find((a) => a.id === aid) : undefined
  const open = c ? openAmendment(db, c.id) : undefined

  const [type, setType] = useState<AmendmentType>(existing?.type ?? (c?.profile === 'Agreement' ? 'ChangeLines' : 'ExtendTerm'))
  const [reason, setReason] = useState(existing?.reason ?? '')
  const [eff, setEff] = useState(existing?.effectiveDate ?? today())
  const [hdr, setHdr] = useState<Partial<Record<HeaderField, string | number>>>(() => Object.fromEntries((existing?.header ?? []).map((h) => [h.path, h.newValue ?? ''])))
  const [lineEdit, setLineEdit] = useState<Record<number, LineFields>>(() => Object.fromEntries((existing?.lineOps ?? []).filter((o) => o.op === 'Change').map((o) => [o.lineNum!, o.fields ?? {}])))
  const [closed, setClosed] = useState<number[]>((existing?.lineOps ?? []).filter((o) => o.op === 'Close').map((o) => o.lineNum!))
  const [added, setAdded] = useState<NewLine[]>((existing?.lineOps ?? []).filter((o) => o.op === 'Add').map((o) => ({ itemId: o.add?.itemId ?? '', qty: o.add?.agreedQuantity ?? 0, price: o.add?.unitPrice ?? 0 })))
  const [partyEdit, setPartyEdit] = useState<Record<string, NonNullable<PartyOp['fields']>>>(() => Object.fromEntries((existing?.partyOps ?? []).filter((o) => o.op === 'Change').map((o) => [o.partyId!, o.fields ?? {}])))
  const [removed, setRemoved] = useState<string[]>((existing?.partyOps ?? []).filter((o) => o.op === 'Remove').map((o) => o.partyId!))
  const [newParties, setNewParties] = useState<NonNullable<PartyOp['fields']>[]>((existing?.partyOps ?? []).filter((o) => o.op === 'Add').map((o) => o.fields ?? {}))
  const [err, setErr] = useState('')

  const lines = c ? db.lines.filter((l) => l.contractId === c.id) : []
  const parties = c ? db.parties.filter((p) => p.contractId === c.id) : []
  const cur = (k: HeaderField) => (c as unknown as Record<string, string | number | undefined>)?.[k]
  const showLines = c?.profile === 'Agreement' && (type === 'ChangeLines' || type === 'Other')
  const showParties = type === 'ChangeParties' || type === 'Other'
  const fields = typeFields[type].filter((k) => !(k === 'contractValue' && c?.profile === 'Agreement'))

  const draft = useMemo<Pick<ContractAmendment, 'type' | 'reason' | 'effectiveDate' | 'header' | 'lineOps' | 'partyOps'> | null>(() => {
    if (!c) return null
    const header: HeaderChange[] = fields.filter((k) => hdr[k] !== undefined && String(hdr[k]) !== String(cur(k) ?? '')).map((k) => ({ path: k, oldValue: cur(k), newValue: hdr[k] === '' ? undefined : hdr[k] }))
    const lineOps: LineOp[] = []
    if (showLines) {
      lines.forEach((l) => {
        if (closed.includes(l.lineNum)) { lineOps.push({ op: 'Close', lineNum: l.lineNum }); return }
        const f = lineEdit[l.lineNum]
        if (!f) return
        const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== undefined && v !== (l as unknown as Record<string, unknown>)[k])) as LineFields
        if (Object.keys(changed).length) lineOps.push({ op: 'Change', lineNum: l.lineNum, fields: changed, old: Object.fromEntries(Object.keys(changed).map((k) => [k, (l as unknown as Record<string, unknown>)[k]])) as LineFields })
      })
      added.filter((a) => a.itemId).forEach((a) => {
        const it = db.items.find((i) => i.id === a.itemId)!
        lineOps.push({ op: 'Add', add: { itemId: a.itemId, description: it.name, uomId: it.uomId, commitmentType: 'Quantity', agreedQuantity: a.qty, unitPrice: a.price, discountPercent: 0, priceFixed: true, enforceMax: true } })
      })
    }
    const partyOps: PartyOp[] = []
    if (showParties) {
      parties.forEach((p) => {
        if (removed.includes(p.id)) { partyOps.push({ op: 'Remove', partyId: p.id }); return }
        const f = partyEdit[p.id]
        const changed = f ? Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== undefined && v !== (p as unknown as Record<string, unknown>)[k])) : {}
        if (Object.keys(changed).length) partyOps.push({ op: 'Change', partyId: p.id, fields: changed })
      })
      newParties.filter((p) => p.name?.trim()).forEach((p) => partyOps.push({ op: 'Add', fields: p }))
    }
    return { type, reason, effectiveDate: eff, header, lineOps, partyOps }
  }, [c, type, reason, eff, hdr, lineEdit, closed, added, partyEdit, removed, newParties]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <EmptyBlock title="العقد غير موجود" />
  if (!can('Contracts.Amend')) return <EmptyBlock title="لا تملك صلاحية الملاحق" hint="صلاحية «ملاحق وتعديلات» مطلوبة." />
  if (open && open.id !== existing?.id) return <EmptyBlock title={`يوجد ملحق مفتوح (رقم ${open.amendmentNo})`} hint="ملحق واحد مفتوح لكل عقد: أنهِه أو ألغِه من تبويب الملاحق أولاً." />
  const probe = draft && { ...draft, id: existing?.id ?? 'tmp', contractId: c.id, amendmentNo: 0, status: 'Draft' as const, baseVersionNo: c.versionNo, createdBy: db.userId, createdAt: '' }
  const issues = probe ? validateAmendment(db, c, probe) : { errors: [], warnings: [] }

  const save = (submit: boolean) => {
    if (!draft) return
    let failure = ''
    let newId = existing?.id ?? ''
    const ok = run((d) => {
      const dc = d.contracts.find((x) => x.id === c.id)!
      const r = createAmendment(d, dc, draft, existing?.id)
      if (typeof r === 'string') { failure = r; return r }
      newId = r.id
      if (submit) { const e = submitAmendment(d, r.id); if (e) { failure = e; return e } }
      return null
    }, submit ? 'أُرسل الملحق للاعتماد' : 'حُفظت مسودة الملحق')
    if (!ok) return setErr(failure)
    nav(`/contracts/${c.id}/amendments/${newId}`)
  }
  const setH = (k: HeaderField, v: string | number) => setHdr((x) => ({ ...x, [k]: v }))
  const setLine = (n: number, f: LineFields) => setLineEdit((x) => ({ ...x, [n]: { ...x[n], ...f } }))

  return (
    <div>
      <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number, to: `/contracts/${c.id}` }, { label: existing ? `تعديل الملحق ${existing.amendmentNo}` : 'ملحق جديد' }]} title={existing ? `تعديل الملحق ${existing.amendmentNo}` : `ملحق جديد — ${c.number}`}
        actions={<><button type="button" className="btn" onClick={() => save(false)} disabled={!draft?.reason.trim()}>حفظ مسودة</button><button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={issues.errors.length > 0}>حفظ وإرسال للاعتماد</button></>} />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">الإصدار الحالي v{c.versionNo}. الملحق يُنشئ إصداراً جديداً غير قابل للتعديل عند تطبيقه بعد الاعتماد، ولا يغيّر المستندات والقيود القائمة.</div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="بيانات الملحق">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="نوع الملحق"><Select value={type} onChange={setType} options={(Object.keys(amendTypeLabel) as AmendmentType[]).filter((t) => !(t === 'ChangeLines' && c.profile !== 'Agreement')).map((t) => ({ value: t, label: amendTypeLabel[t] }))} /></Field>
              <Field label="تاريخ السريان" required><DateInput value={eff} onChange={setEff} /></Field>
              <Field label="الإصدار الأساسي"><div className="inp-ro">v{existing?.baseVersionNo ?? c.versionNo}</div></Field>
              <Field label="سبب الملحق" required span={3}><textarea className="inp h-16 py-1.5" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </div>
          </Card>

          {fields.length > 0 && (
            <Card title="الحقول — القديم ← الجديد" pad={false}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">الحقل</th><th className="text-start">الحالي</th><th className="text-start">الجديد</th></tr></thead>
                <tbody>
                  {fields.map((k) => {
                    const def = headerFields.find((f) => f.key === k)!
                    const v = hdr[k] ?? cur(k) ?? ''
                    const changed = hdr[k] !== undefined && String(hdr[k]) !== String(cur(k) ?? '')
                    return (
                      <tr key={k} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium">{def.label}</td>
                        <td className="text-gray-500">{headerText(db, c, k, cur(k))}</td>
                        <td className={`py-1.5 pe-3 ${changed ? 'bg-amber-50/60' : ''}`}>
                          {def.kind === 'date' && <DateInput value={String(v)} onChange={(x) => setH(k, x)} />}
                          {def.kind === 'number' && <NumInput value={Number(v) || 0} onChange={(n) => setH(k, n)} />}
                          {def.kind === 'text' && <input className="inp" value={String(v)} onChange={(e) => setH(k, e.target.value)} />}
                          {def.kind === 'renewal' && <Select value={String(v) as RenewalPolicy} onChange={(x) => setH(k, x)} options={(Object.keys(renewalLabel) as RenewalPolicy[]).map((x) => ({ value: x, label: renewalLabel[x] }))} />}
                          {def.kind === 'paymentTerm' && <Select value={String(v)} onChange={(x) => setH(k, x)} options={db.paymentTerms.map((p) => ({ value: p.id, label: p.name }))} />}
                        </td>
                      </tr>)
                  })}
                </tbody>
              </table>
            </Card>
          )}
          {type === 'ChangeValue' && c.profile === 'Agreement' && <Card><div className="text-sm text-gray-500">قيمة اتفاقية الالتزام تُحتسب من بنودها؛ اختر نوع «تعديل البنود».</div></Card>}

          {showLines && (
            <Card title="بنود الالتزام" pad={false}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-start">البند</th><th className="text-start">الالتزام الحالي</th><th className="text-start">الأدنى المسموح</th><th className="text-start">الالتزام الجديد</th><th className="text-start">سعر جديد</th><th className="text-start">إغلاق</th></tr></thead>
                <tbody>
                  {lines.filter((l) => l.status === 'Open').map((l: ContractLine) => {
                    const qtyKey = l.commitmentType === 'Quantity' ? 'agreedQuantity' : 'agreedValue'
                    const f = lineEdit[l.lineNum] ?? {}
                    const nv = (f[qtyKey] ?? committedUnits(l)) as number
                    const floor = floorOf(db, l.id)
                    return (
                      <tr key={l.id} className={`border-b border-gray-100 ${closed.includes(l.lineNum) ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2"><div className="font-medium">{l.lineNum}. {l.description}</div></td>
                        <td>{fmtUnits(db, c, l, committedUnits(l))}</td>
                        <td className="text-amber-700">{fmtUnits(db, c, l, floor)}</td>
                        <td className={`py-1.5 ${nv < floor ? 'bg-red-50' : f[qtyKey] !== undefined ? 'bg-amber-50/60' : ''}`}><NumInput value={nv} disabled={closed.includes(l.lineNum)} onChange={(n) => setLine(l.lineNum, { [qtyKey]: n })} />{nv < floor && <div className="text-[11px] text-red-600">أقل من المستهلك</div>}</td>
                        <td className="py-1.5 pe-2">{l.commitmentType === 'Quantity' ? <NumInput value={f.unitPrice ?? l.unitPrice} disabled={closed.includes(l.lineNum)} onChange={(n) => setLine(l.lineNum, { unitPrice: n })} /> : '—'}</td>
                        <td><input type="checkbox" checked={closed.includes(l.lineNum)} onChange={(e) => setClosed((x) => (e.target.checked ? [...x, l.lineNum] : x.filter((n) => n !== l.lineNum)))} /></td>
                      </tr>)
                  })}
                </tbody>
              </table>
              <div className="space-y-2 border-t border-line p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">بنود جديدة (تأخذ رقماً جديداً ولا يُعاد استخدام أرقام البنود)
                  <button type="button" className="btn" onClick={() => setAdded((x) => [...x, { itemId: '', qty: 0, price: 0 }])}><Plus className="h-4 w-4" />بند</button></div>
                {added.map((a, i) => (
                  <div key={i} className="grid items-end gap-2 md:grid-cols-4">
                    <Field label="الصنف"><ItemSelect value={a.itemId} onChange={(v) => setAdded((x) => x.map((y, k) => (k === i ? { ...y, itemId: v, price: db.items.find((it) => it.id === v)?.basePrice ?? y.price } : y)))} /></Field>
                    <Field label="الكمية"><NumInput value={a.qty} onChange={(n) => setAdded((x) => x.map((y, k) => (k === i ? { ...y, qty: n } : y)))} /></Field>
                    <Field label={`السعر (${c.currency})`}><NumInput value={a.price} onChange={(n) => setAdded((x) => x.map((y, k) => (k === i ? { ...y, price: n } : y)))} /></Field>
                    <button type="button" className="btn btn-danger" onClick={() => setAdded((x) => x.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                  </div>))}
              </div>
            </Card>
          )}

          {showParties && (
            <Card title="الأطراف" pad={false}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">الطرف</th><th className="text-start">الممثل</th><th className="text-start">صفة الموقّع</th><th className="text-start">البريد</th><th /></tr></thead>
                <tbody>
                  {parties.map((p) => {
                    const f = partyEdit[p.id] ?? {}
                    const gone = removed.includes(p.id)
                    const set = (k: 'contactName' | 'signatoryTitle' | 'email', v: string) => setPartyEdit((x) => ({ ...x, [p.id]: { ...x[p.id], [k]: v } }))
                    return (
                      <tr key={p.id} className={`border-b border-gray-100 ${gone ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="text-[11px] text-gray-400">{partyRoleLabel[p.role]}{p.isPrimary ? ' · رئيسي' : ''}</div></td>
                        <td className="py-1.5 pe-2"><input className="inp" disabled={gone} value={f.contactName ?? p.contactName} onChange={(e) => set('contactName', e.target.value)} /></td>
                        <td className="pe-2"><input className="inp" disabled={gone} value={f.signatoryTitle ?? p.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} /></td>
                        <td className="pe-2"><input className="inp" dir="ltr" disabled={gone} value={f.email ?? p.email} onChange={(e) => set('email', e.target.value)} /></td>
                        <td>{!p.isPrimary && <button type="button" title="حذف الطرف" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setRemoved((x) => (gone ? x.filter((i) => i !== p.id) : [...x, p.id]))}><Trash2 className="h-4 w-4" /></button>}</td>
                      </tr>)
                  })}
                </tbody>
              </table>
              <div className="space-y-2 border-t border-line p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">أطراف جديدة<button type="button" className="btn" onClick={() => setNewParties((x) => [...x, { role: 'Other' }])}><Plus className="h-4 w-4" />طرف</button></div>
                {newParties.map((p, i) => {
                  const set = (patch: NonNullable<PartyOp['fields']>) => setNewParties((x) => x.map((y, k) => (k === i ? { ...y, ...patch } : y)))
                  return (
                    <div key={i} className="grid items-end gap-2 md:grid-cols-5">
                      <Field label="الاسم"><input className="inp" value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></Field>
                      <Field label="الدور"><Select value={(p.role ?? 'Other') as PartyRole} onChange={(v) => set({ role: v })} options={(Object.keys(partyRoleLabel) as PartyRole[]).map((r) => ({ value: r, label: partyRoleLabel[r] }))} /></Field>
                      <Field label="الممثل"><input className="inp" value={p.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} /></Field>
                      <Field label="صفة الموقّع"><input className="inp" value={p.signatoryTitle ?? ''} onChange={(e) => set({ signatoryTitle: e.target.value })} /></Field>
                      <button type="button" className="btn btn-danger" onClick={() => setNewParties((x) => x.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                    </div>)
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {draft && <ChangeTable rows={describeChanges(db, c, draft)} title="ملخص التغييرات" />}
          <Card title="الفحص">
            {issues.errors.length === 0 && issues.warnings.length === 0 && <div className="text-sm text-emerald-700">لا ملاحظات.</div>}
            <ul className="space-y-1.5 text-xs">
              {issues.errors.map((e, i) => <li key={i} className="flex gap-1.5 rounded bg-red-50 px-2 py-1.5 text-red-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{e}</li>)}
              {issues.warnings.map((e, i) => <li key={i} className="rounded bg-amber-50 px-2 py-1.5 text-amber-800">{e}</li>)}
            </ul>
            {err && <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
            <div className="mt-3 flex flex-wrap gap-1.5"><Badge tone="blue">مسار الاعتماد حسب قيمة التغيير</Badge></div>
          </Card>
        </div>
      </div>
    </div>
  )
}
