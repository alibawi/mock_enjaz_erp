import { Eye, Link2, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from '../../router'
import { AttachmentList, AttachmentUploader, subTypeLabel } from '../../components/attachments'
import { DataTable, type Column } from '../../components/DataTable'
import { DateInput, SearchableSelect } from '../../components/inputs'
import { EmptyBlock } from '../../components/states'
import { Timeline, type TimelineItem } from '../../components/display'
import { Badge, Card, Field, FormGrid, Modal, NumInput, ReadOnly, Select } from '../../components/ui'
import { closureLabel, confLabel, directionLabel, linkTypeLabel, partyRoleLabel, profileLabel, renewalLabel, sigMethodLabel, statusLabel, statusTone } from '../../data/contractMeta'
import { fmtDate, money, nowStamp, uid } from '../../data/format'
import { noticeDeadline, partnerName, typeOf, userName } from '../../data/lifecycle'
import { addAudit, useStore } from '../../data/store'
import type { Contract, ContractParty, ContractSignature, DocumentLink, LinkType, PartyRole, SignatureMethod } from '../../data/types'

const dash = (v?: ReactNode) => (v === undefined || v === null || v === '' ? '—' : v)

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}><FormGrid>{children}</FormGrid></Card>
}
const Info = ({ label, children, span }: { label: string; children: ReactNode; span?: number }) => <Field label={label} span={span}><ReadOnly>{dash(children)}</ReadOnly></Field>

/** Editable only while Draft (BR-C-05). */
export const isDraft = (c: Contract) => c.status === 'Draft'

export function GeneralTab({ c }: { c: Contract }) {
  const { db } = useStore()
  const t = typeOf(db, c)
  const org = db.organizations.find((o) => o.id === c.organizationId)?.name
  const emp = db.employees.find((e) => e.id === c.responsibleEmployeeId)
  const pt = db.paymentTerms.find((p) => p.id === c.paymentTermId)
  const nd = noticeDeadline(c)
  const rel = (id?: string) => { const x = db.contracts.find((k) => k.id === id); return x ? <Link className="text-navy underline" to={`/contracts/${x.id}`}>{x.number}</Link> : undefined }
  return (
    <div className="space-y-4">
      <Group title="الهوية">
        <Info label="رقم العقد"><span dir="ltr">{c.number}</span></Info>
        <Info label="النوع">{t.name}</Info>
        <Info label="النوع العام">{profileLabel[c.profile]}</Info>
        <Info label="الاتجاه">{directionLabel[c.direction]}</Info>
        <Info label="رقم النسخة">{c.versionNo ? `v${c.versionNo}` : 'لم يُفعَّل'}</Info>
        <Info label="المنشأة">{org}</Info>
        <Info label="مسؤول العقد">{userName(db, c.ownerUserId)}</Info>
        <Info label="الموظف المسؤول">{emp ? `${emp.name} — ${emp.department}` : undefined}</Info>
        <Info label="السرية">{confLabel[c.confidentiality]}</Info>
        <Info label="مرجع خارجي">{c.externalReference}</Info>
        <Info label="مشروع">{db.projects.find((p) => p.id === c.projectId)?.name}</Info>
        <Info label="مركز الكلفة">{db.costCenters.find((p) => p.id === c.costCenterId)?.name}</Info>
      </Group>
      <Group title="الطرف والقيمة">
        <Info label="الطرف الآخر" span={2}>{partnerName(db, c)}</Info>
        <Info label="العملة">{c.currency}</Info>
        <Info label="قيمة العقد">{c.contractValue ? money(c.contractValue, c.currency) : undefined}</Info>
        <Info label="سعر الصرف عند التفعيل (IQD)">{c.exchangeRate ? c.exchangeRate.toLocaleString('en-US') : undefined}</Info>
        <Info label="شرط الدفع">{pt?.name}</Info>
        <Info label="شروط التسليم" span={2}>{c.deliveryTerms}</Info>
        {c.profile === 'Agreement' && <Info label="نوع الاتفاقية">{c.agreementMode === 'General' ? 'عامة (تتبع الإجماليات دون تغيير الأسعار)' : 'محددة (تُطبَّق أسعارها)'}</Info>}
      </Group>
      <Group title="التواريخ والتجديد">
        <Info label="البداية">{fmtDate(c.startDate)}</Info>
        <Info label="النهاية">{c.endDate ? fmtDate(c.endDate) : 'مفتوح'}</Info>
        <Info label="تاريخ التوقيع">{c.signatureDate ? fmtDate(c.signatureDate) : undefined}</Info>
        <Info label="تاريخ السريان">{c.effectiveDate ? fmtDate(c.effectiveDate) : undefined}</Info>
        <Info label="تاريخ الإنهاء">{c.terminationDate ? fmtDate(c.terminationDate) : undefined}</Info>
        <Info label="آخر موعد للإشعار">{nd ? fmtDate(nd) : undefined}</Info>
        <Info label="سياسة التجديد">{renewalLabel[c.renewalPolicy]}</Info>
        <Info label="مدة الإشعار (يوم)">{c.noticePeriodDays}</Info>
        <Info label="مدة التجديد التلقائي (شهر)">{c.autoRenewTermMonths}</Info>
        <Info label="أيام التنبيه">{c.reminderDaysOverride ?? t.reminderDaysDefault ?? 'من إعدادات النظام'}</Info>
        <Info label="فُعّل بتاريخ">{c.activatedOn ? `${fmtDate(c.activatedOn)} — ${userName(db, c.activatedBy ?? '')}` : undefined}</Info>
        {c.closureReason && <Info label="سبب الإغلاق">{closureLabel[c.closureReason]}</Info>}
      </Group>
      <Group title="علاقات وملاحظات">
        <Info label="تجديد للعقد">{rel(c.renewedFromContractId)}</Info>
        <Info label="عقد لاحق (تجديد)">{rel(db.contracts.find((k) => k.renewedFromContractId === c.id)?.id)}</Info>
        <Info label="العقد الأب">{rel(c.parentContractId)}</Info>
        <Info label="الوصف" span={3}>{c.description}</Info>
        <Info label="ملاحظات داخلية" span={3}>{c.internalNotes}</Info>
      </Group>
    </div>
  )
}

// ───────── parties ─────────
export function PartiesTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState(false)
  const rows = db.parties.filter((p) => p.contractId === c.id)
  const editable = isDraft(c) && can('Contracts.Edit')
  const cols: Column<ContractParty>[] = [
    { key: 'role', label: 'الصفة', render: (p) => <span>{partyRoleLabel[p.role]}{p.isPrimary && <span className="ms-1 text-[11px] text-navy">(رئيسي)</span>}</span> },
    { key: 'name', label: 'الاسم', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'contact', label: 'جهة الاتصال', render: (p) => p.contactName },
    { key: 'title', label: 'صفة المفوّض', render: (p) => p.signatoryTitle },
    { key: 'phone', label: 'الهاتف', render: (p) => <span dir="ltr">{p.phone}</span> },
    ...(editable ? [{ key: 'x', label: '', render: (p: ContractParty) => !p.isPrimary ? <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => run((d) => { d.parties = d.parties.filter((x) => x.id !== p.id); addAudit(d, 'contract', c.id, 'party:remove', p.name) }, 'حُذف الطرف')}><Trash2 className="h-4 w-4" /></button> : null }] : []),
  ]
  return (
    <Card title="الأطراف" actions={editable && <button type="button" className="btn" onClick={() => setDlg(true)}><Plus className="h-4 w-4" />إضافة طرف</button>} pad={false}>
      <DataTable rows={rows} columns={cols} emptyTitle="لا أطراف" />
      {!isDraft(c) && <p className="border-t border-line px-4 py-2 text-xs text-gray-400">الأطراف مقفلة بعد الإرسال للاعتماد؛ التغيير عبر ملحق (وحدة الملاحق).</p>}
      {dlg && <PartyDialog contract={c} onClose={() => setDlg(false)} />}
    </Card>
  )
}
function PartyDialog({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const [role, setRole] = useState<PartyRole>('Guarantor')
  const [partner, setPartner] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [title, setTitle] = useState('')
  const p = db.partners.find((x) => x.id === partner)
  const save = () => {
    const finalName = p?.name ?? name.trim()
    if (!finalName) return false
    run((d) => {
      d.parties.push({ id: uid('pty'), contractId: contract.id, role, partnerId: p?.id, name: finalName, contactName: p?.contact ?? contact, email: p?.email ?? '', phone: p?.phone ?? '', signatoryTitle: title, isPrimary: false })
      addAudit(d, 'contract', contract.id, 'party:add', finalName)
    }, 'أُضيف الطرف')
    onClose()
    return true
  }
  return (
    <Modal title="إضافة طرف" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save} disabled={!p && !name.trim()}>إضافة</button></>}>
      <div className="grid gap-3">
        <Field label="الصفة"><Select value={role} onChange={setRole} options={(Object.keys(partyRoleLabel) as PartyRole[]).filter((r) => r !== 'Counterparty').map((r) => ({ value: r, label: partyRoleLabel[r] }))} /></Field>
        <Field label="طرف مسجّل (اختياري)"><SearchableSelect value={partner} onChange={setPartner} options={db.partners.map((x) => ({ value: x.id, label: x.name, hint: x.code }))} /></Field>
        {!p && <><Field label="الاسم" required><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="جهة الاتصال"><input className="inp" value={contact} onChange={(e) => setContact(e.target.value)} /></Field></>}
        <Field label="صفة المفوّض بالتوقيع"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

// ───────── lines (read-only here; the editor and engine arrive with module 3) ─────────
export function LinesTab({ c }: { c: Contract }) {
  const { db } = useStore()
  const rows = db.lines.filter((l) => l.contractId === c.id)
  const committed = (l: typeof rows[number]) => (l.commitmentType === 'Quantity' ? (l.agreedQuantity ?? 0) * l.unitPrice * (1 - l.discountPercent / 100) : l.agreedValue ?? 0)
  const cols: Column<typeof rows[number]>[] = [
    { key: 'n', label: '#', render: (l) => l.lineNum },
    { key: 'item', label: 'الصنف / التصنيف', render: (l) => <div><div className="font-medium">{l.description}</div><div className="text-[11px] text-gray-400">{l.itemId ? db.items.find((i) => i.id === l.itemId)?.code : `تصنيف: ${db.categories.find((k) => k.id === l.categoryId)?.name}`}</div></div> },
    { key: 'type', label: 'نوع الالتزام', render: (l) => (l.commitmentType === 'Quantity' ? 'كمية' : 'قيمة') },
    { key: 'qty', label: 'الكمية / القيمة', num: true, render: (l) => (l.commitmentType === 'Quantity' ? `${(l.agreedQuantity ?? 0).toLocaleString('en-US')} ${db.uoms.find((u) => u.id === l.uomId)?.name ?? ''}` : money(l.agreedValue ?? 0, c.currency)) },
    { key: 'price', label: 'السعر', num: true, render: (l) => (l.commitmentType === 'Quantity' ? money(l.unitPrice, c.currency) : '—') },
    { key: 'disc', label: 'خصم %', num: true, render: (l) => l.discountPercent },
    { key: 'total', label: 'القيمة الملتزم بها', num: true, render: (l) => money(committed(l), c.currency), total: (r) => money(r.reduce((s, l) => s + committed(l), 0), c.currency) },
    { key: 'st', label: 'الحالة', render: (l) => <Badge tone={l.status === 'Open' ? 'green' : 'gray'}>{l.status === 'Open' ? 'مفتوح' : 'مغلق'}</Badge> },
  ]
  return (
    <Card title="بنود الالتزام" pad={false}>
      <DataTable rows={rows} columns={cols} emptyTitle="لا بنود" emptyHint={c.profile === 'Agreement' ? 'اتفاقية الالتزام تتطلب بنداً واحداً على الأقل قبل الإرسال.' : undefined} />
      <p className="border-t border-line px-4 py-2 text-xs text-gray-400">عرض فقط في هذه المرحلة؛ المحرّر ودفتر التنفيذ والمتبقي تُضاف في وحدة «الاتفاقيات والتنفيذ».</p>
    </Card>
  )
}

// ───────── attachments ─────────
export function AttachmentsTab({ c }: { c: Contract }) {
  const { db, run, can, user } = useStore()
  const [sub, setSub] = useState<'Draft' | 'Signed' | 'Appendix' | 'Other'>('Other')
  const [preview, setPreview] = useState<string | null>(null)
  const items = db.attachments.filter((a) => a.ownerId === c.id)
  const terminal = ['Terminated', 'Cancelled', 'Closed'].includes(c.status)
  const pv = items.find((a) => a.id === preview)
  return (
    <Card title="المرفقات (محاكاة DMS)" actions={can('Attachments.Upload') && !terminal && (
      <div className="flex items-center gap-2">
        <Select value={sub} onChange={setSub} options={(Object.keys(subTypeLabel) as (keyof typeof subTypeLabel)[]).map((k) => ({ value: k, label: subTypeLabel[k] }))} />
        <AttachmentUploader onPick={(f) => run((d) => {
          const v = d.attachments.filter((a) => a.ownerId === c.id && a.fileName === f.fileName).length + 1
          d.attachments.push({ id: uid('att'), ownerType: 'contract', ownerId: c.id, subType: sub, ...f, uploadedBy: user.name, uploadedAt: nowStamp(), version: v })
          addAudit(d, 'contract', c.id, 'attachment:add', f.fileName)
        }, 'أُضيف المرفق (محاكاة)')} />
      </div>)}>
      {can('Attachments.View') ? (
        <AttachmentList items={items} onPreview={(a) => setPreview(a.id)} canDownload={can('Attachments.Download')} canDelete={can('Attachments.Delete') && !terminal}
          onDelete={(a) => run((d) => { d.attachments = d.attachments.filter((x) => x.id !== a.id); addAudit(d, 'contract', c.id, 'attachment:delete', a.fileName) }, 'حُذف المرفق')} />
      ) : <EmptyBlock title="لا تملك صلاحية عرض المرفقات" />}
      {pv && (
        <Modal title={pv.fileName} onClose={() => setPreview(null)} wide>
          <div className="grid place-items-center rounded-md border border-dashed border-line bg-gray-50 py-16 text-center">
            <Eye className="mb-2 h-8 w-8 text-gray-300" />
            <div className="text-sm font-medium text-gray-700">معاينة وهمية للمستند</div>
            <div className="mt-1 text-xs text-gray-500">{subTypeLabel[pv.subType]} · نسخة {pv.version} · {Math.round(pv.size / 1024)} KB</div>
            <div className="mt-3 text-[11px] text-gray-400">لا يُرفع الملف فعلياً في هذا النموذج.</div>
          </div>
        </Modal>
      )}
    </Card>
  )
}

// ───────── signatures ─────────
export function SignaturesTab({ c }: { c: Contract }) {
  const { db, can } = useStore()
  const [dlg, setDlg] = useState(false)
  const t = typeOf(db, c)
  const rows = db.signatures.filter((s) => s.contractId === c.id)
  const missing = t.requiredSignatureRoles.filter((r) => !rows.some((s) => s.role === r))
  const canRecord = can('Contracts.Edit') && ['Approved', 'PendingSignature'].includes(c.status)
  const roleName = (r: string) => (r === 'Company' ? 'الشركة' : r === 'Counterparty' ? 'الطرف الآخر' : r)
  const cols: Column<ContractSignature>[] = [
    { key: 'role', label: 'الصفة', render: (s) => roleName(s.role) },
    { key: 'name', label: 'الموقِّع', render: (s) => <div><div className="font-medium">{s.signerName}</div><div className="text-[11px] text-gray-400">{s.signerTitle}</div></div> },
    { key: 'on', label: 'التاريخ', render: (s) => fmtDate(s.signedOn) },
    { key: 'm', label: 'الطريقة', render: (s) => sigMethodLabel[s.method] },
    { key: 'ext', label: 'مرجع المزوّد', render: (s) => (s.externalSignatureId ? <span dir="ltr" className="text-xs">{s.externalSignatureId}</span> : '—') },
    { key: 'doc', label: 'المستند', render: (s) => db.attachments.find((a) => a.id === s.attachmentId)?.fileName ?? '—' },
  ]
  return (
    <Card title="التواقيع" actions={canRecord && <button type="button" className="btn" onClick={() => setDlg(true)}><Plus className="h-4 w-4" />تسجيل توقيع</button>} pad={false}>
      {t.requiresSignature && (
        <div className={`border-b border-line px-4 py-2 text-xs ${missing.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {missing.length ? `تواقيع ناقصة: ${missing.map(roleName).join('، ')}` : 'اكتملت التواقيع المطلوبة'}
          {!db.attachments.some((a) => a.ownerId === c.id && a.subType === 'Signed') && ' — ولا يوجد مستند موقّع مرفق'}
        </div>
      )}
      {!t.requiresSignature && <div className="border-b border-line bg-gray-50 px-4 py-2 text-xs text-gray-500">هذا النوع لا يتطلب توقيعاً.</div>}
      <DataTable rows={rows} columns={cols} emptyTitle="لا تواقيع مسجلة" />
      <p className="border-t border-line px-4 py-2 text-xs text-gray-400">تُسجَّل هنا التواقيع الورقية أو المستندات الموقّعة المرفوعة؛ التوقيع الإلكتروني عبر المزوّد في اللوحة أعلاه.</p>
      {dlg && <SignatureDialog contract={c} onClose={() => setDlg(false)} />}
    </Card>
  )
}
function SignatureDialog({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const t = typeOf(db, contract)
  const [role, setRole] = useState(t.requiredSignatureRoles[0] ?? 'Company')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(db.asOf)
  const [method, setMethod] = useState<SignatureMethod>('Uploaded')
  const [att, setAtt] = useState('')
  const signedAtts = db.attachments.filter((a) => a.ownerId === contract.id && a.subType === 'Signed')
  const save = () => {
    run((d) => { d.signatures.push({ id: uid('sig'), contractId: contract.id, role, signerName: name.trim(), signerTitle: title, signedOn: date, method, attachmentId: att || undefined }); addAudit(d, 'contract', contract.id, 'signature:add', `${role} — ${name}`) }, 'سُجّل التوقيع')
    onClose()
  }
  return (
    <Modal title="تسجيل توقيع" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={save}>تسجيل</button></>}>
      <div className="grid gap-3">
        <Field label="صفة الموقّع"><Select value={role} onChange={setRole} options={[...t.requiredSignatureRoles, 'Other'].map((r) => ({ value: r, label: r === 'Company' ? 'الشركة' : r === 'Counterparty' ? 'الطرف الآخر' : 'أخرى' }))} /></Field>
        <Field label="اسم الموقّع" required><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="صفته"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="تاريخ التوقيع"><DateInput value={date} onChange={setDate} /></Field>
        <Field label="الطريقة"><Select value={method} onChange={setMethod} options={(Object.keys(sigMethodLabel) as SignatureMethod[]).map((m) => ({ value: m, label: sigMethodLabel[m] }))} /></Field>
        <Field label="المستند الموقّع" hint={signedAtts.length ? undefined : 'ارفع مستنداً بصنف «موقّع» من تبويب المرفقات أولاً'}>
          <SearchableSelect value={att} onChange={setAtt} options={signedAtts.map((a) => ({ value: a.id, label: a.fileName }))} placeholder="اختياري" />
        </Field>
      </div>
    </Modal>
  )
}

// ───────── linked documents (C7) ─────────
const mockDocs: { docType: string; docId: string; docRef: string; docDate: string; label: string }[] = [
  { docType: 'SQT', docId: 'sqt-231', docRef: 'SQT-2026-000231', docDate: '2026-09-02', label: 'عرض سعر مبيعات' },
  { docType: 'SQT', docId: 'sqt-244', docRef: 'SQT-2026-000244', docDate: '2026-10-05', label: 'عرض سعر مبيعات' },
  { docType: 'PRQ', docId: 'prq-061', docRef: 'PRQ-2026-000061', docDate: '2026-08-18', label: 'طلب شراء' },
  { docType: 'PRJ', docId: 'prj-1', docRef: 'PRJ-01', docDate: '2026-01-10', label: 'مشروع مجمع الكرادة السكني' },
  { docType: 'PRJ', docId: 'prj-3', docRef: 'PRJ-03', docDate: '2026-02-10', label: 'مشروع مستشفى أربيل' },
  { docType: 'AST', docId: 'ast-105', docRef: 'AST-000105', docDate: '2026-04-12', label: 'أصل ثابت — رافعة شوكية' },
  { docType: 'RT', docId: 'rt-9', docRef: 'RT-000009', docDate: '2026-06-30', label: 'قالب تكرار مبيعات' },
]
export function LinksTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState(false)
  const rows = db.links.filter((l) => l.contractId === c.id)
  const cols: Column<DocumentLink>[] = [
    { key: 't', label: 'نوع الربط', render: (l) => linkTypeLabel[l.linkType] },
    { key: 'doc', label: 'المستند', render: (l) => <span className="font-medium" dir="auto">{l.docRef}</span> },
    { key: 'dt', label: 'نوع المستند', render: (l) => <span dir="ltr">{l.docType}</span> },
    { key: 'd', label: 'التاريخ', render: (l) => fmtDate(l.docDate) },
    ...(can('Contracts.Edit') && !['Cancelled', 'Closed', 'Terminated'].includes(c.status) ? [{ key: 'x', label: '', render: (l: DocumentLink) => <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => run((d) => { d.links = d.links.filter((x) => x.id !== l.id); addAudit(d, 'contract', c.id, 'link:remove', l.docRef) }, 'أُزيل الربط')}><Trash2 className="h-4 w-4" /></button> }] : []),
  ]
  return (
    <Card title="المستندات المرتبطة (محاكاة)" actions={can('Contracts.Edit') && !['Cancelled', 'Closed', 'Terminated'].includes(c.status) && <button type="button" className="btn" onClick={() => setDlg(true)}><Link2 className="h-4 w-4" />ربط مستند</button>} pad={false}>
      <DataTable rows={rows} columns={cols} emptyTitle="لا مستندات مرتبطة" emptyHint="مستندات المبيعات والمشتريات المنفِّذة للاتفاقية تظهر هنا تلقائياً مع وحدة الاتفاقيات." />
      {dlg && <LinkDialog c={c} onClose={() => setDlg(false)} />}
    </Card>
  )
}
function LinkDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { run } = useStore()
  const [doc, setDoc] = useState('')
  const [type, setType] = useState<LinkType>('Related')
  const d0 = mockDocs.find((x) => x.docId === doc)
  return (
    <Modal title="ربط مستند" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
      <button type="button" className="btn btn-primary" disabled={!d0} onClick={() => { run((d) => { d.links.push({ id: uid('lk'), contractId: c.id, linkType: type, docType: d0!.docType, docId: d0!.docId, docRef: d0!.docRef, docDate: d0!.docDate }); addAudit(d, 'contract', c.id, 'link:add', d0!.docRef) }, 'رُبط المستند'); onClose() }}>ربط</button></>}>
      <div className="grid gap-3">
        <Field label="المستند"><SearchableSelect value={doc} onChange={setDoc} options={mockDocs.map((m) => ({ value: m.docId, label: `${m.docRef} — ${m.label}`, hint: m.docType }))} /></Field>
        <Field label="نوع الربط"><Select value={type} onChange={setType} options={(['Source', 'Related'] as LinkType[]).map((k) => ({ value: k, label: linkTypeLabel[k] }))} /></Field>
        <p className="text-[11px] text-gray-400">قائمة مستندات تجريبية من وحدات أخرى (محاكاة).</p>
      </div>
    </Modal>
  )
}

// ───────── timeline + audit ─────────
export function TimelineTab({ c }: { c: Contract }) {
  const { db } = useStore()
  const status: TimelineItem[] = db.history.filter((h) => h.contractId === c.id).map((h) => ({
    id: h.id, at: h.at, tone: statusTone[h.to], title: `${h.from ? statusLabel[h.from] : 'إنشاء'} ← ${statusLabel[h.to]}`, detail: h.reason, by: userName(db, h.byUserId),
  }))
  const other: TimelineItem[] = db.audit.filter((a) => a.entity === 'contract' && a.entityId === c.id && !a.action.startsWith('status:')).map((a) => ({
    id: a.id, at: a.at, tone: 'gray', title: auditLabel[a.action.split(':')[0]] ? `${auditLabel[a.action.split(':')[0]]} ${a.detail}` : a.action, by: userName(db, a.userId),
  }))
  const items = [...status, ...other].sort((a, b) => b.at.localeCompare(a.at))
  return <Card title="السجل الزمني والتدقيق"><Timeline items={items} /></Card>
}
const auditLabel: Record<string, string> = { party: 'الأطراف:', attachment: 'المرفقات:', signature: 'التوقيع:', link: 'الربط:', edit: 'تعديل:', create: 'إنشاء:' }

export const SoonTab = ({ title, module }: { title: string; module: string }) => (
  <Card title={title}><EmptyBlock title="قريباً" hint={`يُبنى في وحدة «${module}».`} /></Card>
)
export { NumInput }
