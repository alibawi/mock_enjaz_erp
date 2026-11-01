import { Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '../../router'
import { AttachmentList, AttachmentUploader } from '../../components/attachments'
import { ChipListEditor, DateInput, EmployeeSelect, ItemSelect, OrganizationSelect, PartnerSelect, SearchableSelect, UserSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Card, Field, FormGrid, NumInput, Select } from '../../components/ui'
import { addDays, addMonths, today } from '../../data/asof'
import { convertAmount } from '../../data/currency'
import { confLabel, directionLabel, profileLabel, renewalLabel } from '../../data/contractMeta'
import { fmtDate, money, nowStamp, uid } from '../../data/format'
import { copyTerms, selectableTemplates, templateDefaultsFor } from '../../data/templates'
import { canSee, nextNumber, partnerName, perform, validateSubmit } from '../../data/lifecycle'
import { addAudit, useStore } from '../../data/store'
import type { Confidentiality, Contract, ContractAttachmentRow, ContractLine, CurrencyCode, Direction, RenewalPolicy } from '../../data/types'

const round = (n: number, cur: CurrencyCode) => (cur === 'IQD' ? Math.round(n) : Math.round(n * 100) / 100)
const steps = ['النوع والاتجاه', 'الأطراف والتواريخ والقيمة', 'البنود', 'التجديد والتنبيهات', 'المرفقات', 'المراجعة والحفظ']

const blank = (userId: string, orgId: string): Contract => ({
  id: '', number: '', title: '', typeId: '', profile: 'General', direction: 'Outgoing', status: 'Draft', versionNo: 0, ownerUserId: userId, organizationId: orgId,
  currency: 'IQD', startDate: today(), renewalPolicy: 'None', confidentiality: 'Normal', language: 'ar', overridesPrices: false, description: '', internalNotes: '',
  createdBy: userId, createdAt: '',
})

/** C3 — create / edit wizard. Legally significant fields lock once the contract leaves Draft (BR-C-05). */
export default function ContractWizard() {
  const { id } = useParams()
  const nav = useNavigate()
  const { db, run, can, user } = useStore()
  const existing = id ? db.contracts.find((c) => c.id === id) : undefined
  const locked = !!existing && existing.status !== 'Draft'
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Contract>(() => structuredClone(existing ?? blank(user.id, user.orgId)))
  const [lines, setLines] = useState<ContractLine[]>(() => structuredClone(db.lines.filter((l) => l.contractId === existing?.id)))
  const [pending, setPending] = useState<ContractAttachmentRow[]>([])
  const [errs, setErrs] = useState<string[]>([])

  const type = db.contractTypes.find((t) => t.id === f.typeId)
  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setF((x) => ({ ...x, [k]: v }))
  const pickPartner = (v: string) => {
    const p = db.partners.find((x) => x.id === v)
    setF((x) => ({ ...x, counterpartyId: v || undefined, paymentTermId: x.paymentTermId ?? p?.paymentTermId, currency: p && !locked && !x.contractValue && !lines.length ? p.currency : x.currency }))
  }
  const partnerKind = f.direction === 'Outgoing' ? 'customer' : f.direction === 'Incoming' ? 'vendor' : undefined

  const pickType = (typeId: string) => {
    const t = db.contractTypes.find((x) => x.id === typeId)
    if (!t) return set('typeId', '')
    setF((x) => ({
      ...x, typeId, profile: t.profile, direction: t.defaultDirection, confidentiality: t.defaultConfidentiality, renewalPolicy: t.renewalPolicyDefault,
      noticePeriodDays: t.noticePeriodDaysDefault, reminderDaysOverride: t.reminderDaysDefault,
      endDate: t.isOpenEnded ? undefined : t.defaultDurationMonths ? addDays(addMonths(x.startDate, t.defaultDurationMonths), -1) : x.endDate,
      counterpartyId: undefined, overridesPrices: t.profile === 'Agreement',
      agreementMode: t.profile === 'Agreement' ? 'Specific' : undefined,
    }))
    if (t.profile !== 'Agreement') setLines([])
  }

  const total = useMemo(() => lines.reduce((s, l) => s + (l.commitmentType === 'Quantity' ? (l.agreedQuantity ?? 0) * l.unitPrice * (1 - l.discountPercent / 100) : l.agreedValue ?? 0), 0), [lines])

  // assembled contract for validation (lines supplied through a temporary draft DB view)
  const problems = (): string[] => {
    const tmp = structuredClone(db)
    tmp.lines = [...tmp.lines.filter((l) => l.contractId !== (existing?.id ?? '__new')), ...lines.map((l) => ({ ...l, contractId: existing?.id ?? '__new' }))]
    const c = { ...f, id: existing?.id ?? '__new', contractValue: f.contractValue ?? (f.profile === 'Agreement' && lines.length ? Math.round(total) : undefined) }
    tmp.contracts = [...tmp.contracts.filter((x) => x.id !== c.id), c]
    return validateSubmit(tmp, c)
  }

  const persist = (submit: boolean) => {
    if (!f.typeId || !f.title.trim()) { setErrs(['اختر النوع واكتب العنوان على الأقل']); setStep(0); return }
    if (submit) { const p = problems(); if (p.length) { setErrs(p); setStep(5); return } }
    let savedId = existing?.id ?? ''
    let failure = ''
    const ok = run((d) => {
      if (existing) {
        const i = d.contracts.findIndex((c) => c.id === existing.id)
        d.contracts[i] = { ...f }
        addAudit(d, 'contract', existing.id, 'edit', locked ? 'تعديل البيانات غير القانونية' : 'تعديل المسودة')
      } else {
        const nid = `c-${String(d.contracts.length + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 5)}`
        savedId = nid
        d.contracts.push({ ...f, id: nid, number: nextNumber(d, f.typeId, f.startDate), createdBy: d.userId, createdAt: nowStamp(), status: 'Draft', versionNo: 0, ownerUserId: f.ownerUserId })
        d.history.push({ id: uid('h'), contractId: nid, to: 'Draft', byUserId: d.userId, at: nowStamp(), reason: 'إنشاء' })
        if (f.templateVersionId) copyTerms(d, nid, f.templateVersionId) // BR-T-02: frozen copy, no live link
        addAudit(d, 'contract', nid, 'create', f.title)
        const partner = d.partners.find((p) => p.id === f.counterpartyId)
        d.parties.push({ id: uid('pty'), contractId: nid, role: 'Counterparty', partnerId: partner?.id, name: partner?.name ?? f.counterpartyName ?? 'إدارة داخلية', contactName: partner?.contact ?? '', email: partner?.email ?? '', phone: partner?.phone ?? '', signatoryTitle: 'المدير المفوّض', isPrimary: true })
      }
      const cid = savedId
      if (!locked) {
        d.lines = [...d.lines.filter((l) => l.contractId !== cid), ...lines.map((l, k) => ({ ...l, contractId: cid, lineNum: k + 1, id: `${cid}-l${k + 1}` }))]
        const c = d.contracts.find((x) => x.id === cid)!
        if (c.profile === 'Agreement' && lines.length && !f.contractValue) c.contractValue = Math.round(total)
        const primary = d.parties.find((p) => p.contractId === cid && p.isPrimary)
        if (primary && existing) {
          const partner = d.partners.find((p) => p.id === f.counterpartyId)
          primary.partnerId = partner?.id; primary.name = partner?.name ?? f.counterpartyName ?? primary.name
        }
      }
      d.attachments.push(...pending.map((a) => ({ ...a, ownerId: cid })))
      if (submit) { const e = perform(d, cid, 'submit', {}); if (e) { failure = e; return e } }
      return null
    }, submit ? 'حُفظ العقد وأُرسل للاعتماد' : existing ? 'حُفظت التعديلات' : 'حُفظ العقد كمسودة')
    if (!ok) { setErrs(failure ? failure.split(' — ') : ['تعذر الحفظ']); return }
    nav(`/contracts/${savedId}`)
  }

  if (existing && !canSee(db, existing)) return <EmptyBlock title="لا تملك صلاحية تعديل هذا العقد" />
  if (existing && !can('Contracts.Edit')) return <EmptyBlock title="لا تملك صلاحية التعديل" />
  if (!existing && !can('Contracts.Create')) return <EmptyBlock title="لا تملك صلاحية إنشاء العقود" />

  const next = () => {
    const e: string[] = []
    if (step === 0) { if (!f.typeId) e.push('اختر نوع العقد'); if (!f.title.trim()) e.push('العنوان مطلوب') }
    if (step === 1 && !locked) {
      if (f.direction !== 'Internal' && !f.counterpartyId && !f.counterpartyName?.trim()) e.push('الطرف الآخر مطلوب')
      if (!f.startDate) e.push('تاريخ البداية مطلوب')
      if (f.endDate && f.endDate < f.startDate) e.push('تاريخ النهاية يجب ألا يسبق البداية')
    }
    setErrs(e)
    if (!e.length) setStep((s) => Math.min(5, s + 1))
  }

  const addLine = () => setLines((l) => [...l, { id: uid('ln'), contractId: '', lineNum: l.length + 1, description: '', commitmentType: 'Quantity', agreedQuantity: 1, unitPrice: 0, discountPercent: 0, priceFixed: true, enforceMax: false, status: 'Open', notes: '' }])
  const patchLine = (i: number, p: Partial<ContractLine>) => setLines((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))

  return (
    <div>
      <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: existing ? `تعديل ${existing.number}` : 'عقد جديد' }]} title={existing ? `تعديل: ${existing.title}` : 'عقد جديد'} />
      {locked && <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">العقد في حالة «{existing!.status === 'Active' ? 'ساري' : existing!.status}» — لا يمكن تعديل الحقول القانونية (التواريخ، القيمة، الطرف، البنود). التعديل القانوني يتم عبر ملحق.</div>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <button key={s} type="button" onClick={() => setStep(i)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${i === step ? 'border-navy bg-navy text-white' : i < step ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line bg-white text-gray-500'}`}>
            {i < step ? <Check className="h-3 w-3" /> : <span className="font-semibold">{i + 1}</span>}{s}
          </button>
        ))}
      </div>

      {errs.length > 0 && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"><ul className="list-disc ps-5">{errs.map((e) => <li key={e}>{e}</li>)}</ul></div>}

      {step === 0 && (
        <Card title="النوع والاتجاه">
          <FormGrid>
            <Field label="نوع العقد" required span={2}>
              <SearchableSelect value={f.typeId} onChange={pickType} disabled={locked} clearable={false}
                options={db.contractTypes.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name, hint: profileLabel[t.profile] }))} />
            </Field>
            {!existing && (
              <Field label="القالب (اختياري)" span={2} hint="ينسخ القيم الافتراضية والبنود القانونية ولا يرتبط بالقالب لاحقاً">
                <Select value={f.templateVersionId ?? ''} placeholder="بدون قالب" disabled={!f.typeId}
                  onChange={(v) => setF((x) => (v ? { ...x, ...templateDefaultsFor(db, v, x.startDate) } : { ...x, templateVersionId: undefined }))}
                  options={selectableTemplates(db, f.typeId).map((tp) => ({ value: tp.id + '-v' + tp.currentVersionNo, label: `${tp.name} (v${tp.currentVersionNo})` }))} />
              </Field>
            )}
            <Field label="الاتجاه" required>
              <Select value={f.direction} onChange={(v: Direction) => { set('direction', v); set('counterpartyId', undefined) }} disabled={locked} options={(Object.keys(directionLabel) as Direction[]).map((d) => ({ value: d, label: directionLabel[d] }))} />
            </Field>
            <Field label="المنشأة" required><OrganizationSelect value={f.organizationId} onChange={(v) => set('organizationId', v)} disabled={locked} /></Field>
            <Field label="مسؤول العقد" required><UserSelect value={f.ownerUserId} onChange={(v) => set('ownerUserId', v)} /></Field>
            <Field label="العنوان" required span={3}><input className="inp" value={f.title} disabled={locked} onChange={(e) => set('title', e.target.value)} placeholder="مثال: اتفاقية توريد إسمنت — شركة الفرات للإنشاءات" /></Field>
            <Field label="السرية"><Select value={f.confidentiality} onChange={(v: Confidentiality) => set('confidentiality', v)} options={(Object.keys(confLabel) as Confidentiality[]).map((k) => ({ value: k, label: confLabel[k] }))} /></Field>
            <Field label="مرجع خارجي"><input className="inp" dir="ltr" value={f.externalReference ?? ''} onChange={(e) => set('externalReference', e.target.value)} /></Field>
          </FormGrid>
          {type && <p className="mt-3 rounded bg-navy-50 px-3 py-2 text-xs text-navy">{profileLabel[type.profile]} — {type.requiresApproval ? 'يمر بمسار الاعتماد' : 'بدون اعتماد'} — {type.requiresSignature ? 'يتطلب توقيع الطرفين' : 'لا يتطلب توقيعاً'}{type.isOpenEnded ? ' — مفتوح المدة' : ''}</p>}
        </Card>
      )}

      {step === 1 && (
        <Card title="الأطراف والتواريخ والقيمة">
          <FormGrid>
            <Field label={`الطرف الآخر ${partnerKind ? (partnerKind === 'customer' ? '(عميل)' : '(مورد)') : ''}`} required span={2}>
              {f.profile === 'General' || f.direction === 'Internal'
                ? <div className="grid gap-1.5"><PartnerSelect kind={partnerKind} value={f.counterpartyId ?? ''} onChange={pickPartner} disabled={locked} />
                  {!f.counterpartyId && <input className="inp" placeholder="أو اسم الطرف (غير مسجل)" value={f.counterpartyName ?? ''} disabled={locked} onChange={(e) => set('counterpartyName', e.target.value)} />}</div>
                : <PartnerSelect kind={partnerKind} value={f.counterpartyId ?? ''} onChange={pickPartner} disabled={locked} />}
            </Field>
            <Field label="الموظف المسؤول"><EmployeeSelect value={f.responsibleEmployeeId ?? ''} onChange={(v) => set('responsibleEmployeeId', v || undefined)} /></Field>
            <Field label="تاريخ البداية" required><DateInput value={f.startDate} onChange={(v) => set('startDate', v)} disabled={locked} /></Field>
            <Field label={type?.isOpenEnded ? 'تاريخ النهاية (اختياري)' : 'تاريخ النهاية'} required={!type?.isOpenEnded}><DateInput value={f.endDate ?? ''} onChange={(v) => set('endDate', v || undefined)} disabled={locked} /></Field>
            <Field label="العملة"><Select value={f.currency} onChange={(v: CurrencyCode) => set('currency', v)} disabled={locked} options={db.currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} /></Field>
            <Field label="قيمة العقد" required={type?.requiresContractValue} hint={f.profile === 'Agreement' && lines.length ? `مجموع البنود: ${money(total, f.currency)}` : undefined}>
              <NumInput value={f.contractValue ?? 0} onChange={(n) => set('contractValue', n || undefined)} disabled={locked} />
            </Field>
            <Field label="شرط الدفع" required={type?.requiresPaymentTerm}><SearchableSelect value={f.paymentTermId ?? ''} onChange={(v) => set('paymentTermId', v || undefined)} disabled={locked} options={db.paymentTerms.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            <Field label="شروط التسليم" span={2}><input className="inp" value={f.deliveryTerms ?? ''} disabled={locked} onChange={(e) => set('deliveryTerms', e.target.value || undefined)} /></Field>
            <Field label="المشروع"><SearchableSelect value={f.projectId ?? ''} onChange={(v) => set('projectId', v || undefined)} disabled={locked} options={db.projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} /></Field>
            <Field label="مركز الكلفة"><SearchableSelect value={f.costCenterId ?? ''} onChange={(v) => set('costCenterId', v || undefined)} disabled={locked} options={db.costCenters.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} /></Field>
            <Field label="الوصف" span={3}><textarea className="inp h-20 py-1.5" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="ملاحظات داخلية" span={2}><textarea className="inp h-20 py-1.5" value={f.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} /></Field>
          </FormGrid>
        </Card>
      )}

      {step === 2 && (
        <Card title="البنود" actions={f.profile === 'Agreement' && !locked && <button type="button" className="btn" onClick={addLine}>إضافة بند</button>}>
          {f.profile !== 'Agreement' ? <EmptyBlock title="لا بنود لهذا النوع" hint={f.profile === 'Service' ? 'التغطية والأصناف المشمولة تُضاف في وحدة عقود الخدمة.' : 'البنود خاصة باتفاقيات الالتزام.'} /> : (
            <div className="space-y-2">
              {lines.length === 0 && <EmptyBlock title="لا بنود بعد" hint="اتفاقية الالتزام تتطلب بنداً واحداً على الأقل قبل الإرسال للاعتماد." />}
              {lines.map((l, i) => {
                const item = db.items.find((x) => x.id === l.itemId)
                return (
                  <div key={l.id} className="grid grid-cols-12 items-end gap-2 rounded-md border border-line p-2">
                    <div className="col-span-4"><div className="mb-1 text-[11px] text-gray-500">الصنف</div>
                      <ItemSelect value={l.itemId ?? ''} disabled={locked} onChange={(v) => { const it = db.items.find((x) => x.id === v); patchLine(i, { itemId: v || undefined, description: it?.name ?? '', uomId: it?.uomId, unitPrice: it ? (it.currency === f.currency ? it.basePrice : round(convertAmount(db, it.basePrice, it.currency, f.currency, today()), f.currency)) : l.unitPrice }) }} /></div>
                    <div className="col-span-2"><div className="mb-1 text-[11px] text-gray-500">الكمية</div><NumInput value={l.agreedQuantity ?? 0} disabled={locked} onChange={(n) => patchLine(i, { agreedQuantity: n })} /></div>
                    <div className="col-span-2"><div className="mb-1 text-[11px] text-gray-500">السعر ({f.currency})</div><NumInput value={l.unitPrice} disabled={locked} onChange={(n) => patchLine(i, { unitPrice: n })} /></div>
                    <div className="col-span-1"><div className="mb-1 text-[11px] text-gray-500">خصم %</div><NumInput value={l.discountPercent} disabled={locked} onChange={(n) => patchLine(i, { discountPercent: n })} /></div>
                    <div className="col-span-2 text-end text-xs text-gray-500">{item ? item.code : ''}<div className="font-semibold text-gray-900">{money((l.agreedQuantity ?? 0) * l.unitPrice * (1 - l.discountPercent / 100), f.currency)}</div></div>
                    <div className="col-span-1 text-end">{!locked && <button type="button" className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setLines((x) => x.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>}</div>
                  </div>
                )
              })}
              {lines.length > 0 && <div className="text-end text-sm font-semibold">المجموع: {money(total, f.currency)}</div>}
              <p className="text-[11px] text-gray-400">محرّر البنود الكامل (التصنيفات، الحدود، الصلاحية، السعر الثابت) في وحدة «الاتفاقيات والتنفيذ».</p>
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card title="التجديد والتنبيهات">
          <FormGrid>
            <Field label="سياسة التجديد"><Select value={f.renewalPolicy} onChange={(v: RenewalPolicy) => set('renewalPolicy', v)} disabled={locked} options={(Object.keys(renewalLabel) as RenewalPolicy[]).map((k) => ({ value: k, label: renewalLabel[k] }))} /></Field>
            <Field label="مدة الإشعار (يوم)" required={f.renewalPolicy !== 'None'}><NumInput value={f.noticePeriodDays ?? 0} disabled={locked || f.renewalPolicy === 'None'} onChange={(n) => set('noticePeriodDays', n || undefined)} /></Field>
            <Field label="مدة التجديد التلقائي (شهر)" required={f.renewalPolicy === 'Auto'}><NumInput value={f.autoRenewTermMonths ?? 0} disabled={locked || f.renewalPolicy !== 'Auto'} onChange={(n) => set('autoRenewTermMonths', n || undefined)} /></Field>
            <Field label="أيام تنبيه الانتهاء" span={3} hint="تتجاوز إعدادات النظام لهذا العقد؛ اتركها فارغة لاستخدام الإعدادات.">
              <ChipListEditor values={(f.reminderDaysOverride ?? '').split(',').map((x) => x.trim()).filter(Boolean)} onChange={(v) => set('reminderDaysOverride', v.filter((x) => /^\d+$/.test(x)).join(',') || undefined)} placeholder="مثال: 30 ثم Enter" />
            </Field>
          </FormGrid>
          {f.endDate && f.noticePeriodDays ? <p className="mt-3 text-xs text-gray-500">آخر موعد للإشعار: <strong>{fmtDate(addDays(f.endDate, -f.noticePeriodDays))}</strong></p> : null}
        </Card>
      )}

      {step === 4 && (
        <Card title="المرفقات (محاكاة)" actions={<AttachmentUploader onPick={(a) => setPending((p) => [...p, { id: uid('att'), ownerType: 'contract', ownerId: '', subType: 'Draft', ...a, uploadedBy: user.name, uploadedAt: nowStamp(), version: 1 }])} />}>
          <AttachmentList items={[...db.attachments.filter((a) => a.ownerId === existing?.id), ...pending]} canDelete onDelete={(a) => setPending((p) => p.filter((x) => x.id !== a.id))} />
        </Card>
      )}

      {step === 5 && (
        <Card title="المراجعة">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            {[['العنوان', f.title], ['النوع', type?.name], ['الاتجاه', directionLabel[f.direction]], ['الطرف الآخر', partnerName(db, f)], ['القيمة', f.contractValue ? money(f.contractValue, f.currency) : '—'],
              ['المدة', `${fmtDate(f.startDate)} ← ${f.endDate ? fmtDate(f.endDate) : 'مفتوح'}`], ['التجديد', renewalLabel[f.renewalPolicy]], ['البنود', String(lines.length)], ['المرفقات الجديدة', String(pending.length)]].map(([k, v]) => (
              <div key={k as string}><dt className="text-[11px] text-gray-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
          </dl>
          {(() => { const p = problems(); return p.length ? <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"><div className="mb-1 font-semibold">قبل الإرسال للاعتماد يجب إصلاح:</div><ul className="list-disc ps-5">{p.map((x) => <li key={x}>{x}</li>)}</ul></div> : <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">البيانات مكتملة وجاهزة للإرسال للاعتماد.</div> })()}
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}><ChevronRight className="h-4 w-4" />السابق</button>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => nav(existing ? `/contracts/${existing.id}` : '/contracts')}>إلغاء</button>
          <button type="button" className="btn" onClick={() => persist(false)}>{existing ? 'حفظ التعديلات' : 'حفظ كمسودة'}</button>
          {step === 5 && !locked && can('Contracts.Submit') && <button type="button" className="btn btn-primary" onClick={() => persist(true)}>حفظ وإرسال للاعتماد</button>}
          {step < 5 && <button type="button" className="btn btn-primary" onClick={next}>التالي<ChevronLeft className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  )
}
