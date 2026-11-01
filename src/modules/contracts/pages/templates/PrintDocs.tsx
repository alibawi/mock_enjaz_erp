import type { ReactNode } from 'react'
import { computeAlerts } from '../../data/alerts'
import { confLabel, directionLabel, profileLabel, renewalLabel, statusLabel } from '../../data/contractMeta'
import { fmtDate, fmtDateTime, money, num } from '../../data/format'
import { balanceOf, agreementCfg, committedUnits, committedValue, counterLabel, counterUnits, docMeta, netPrice, remaining } from '../../data/fulfillment'
import { partnerName, typeOf, userName } from '../../data/lifecycle'
import { effStatus, kindLabel, penaltyOf, statusLabel as oblLabel } from '../../data/obligations'
import { financialSummary, itemsOf, payKindLabel, effItemStatus, payStatusLabel } from '../../data/payments'
import { amendTypeLabel, amendStatusLabel } from '../../data/amendments'
import { callSla, consumed, dayNames, fmtStamp, levelOf } from '../../data/service'
import { resolveText, termsOf } from '../../data/templates'
import { useStore } from '../../data/store'
import type { Contract, ContractAmendment } from '../../data/types'
import { describeChanges } from '../amendments/shared'
import { fmtUnits, lineTarget, qty } from '../agreements/shared'

const th = 'border border-gray-300 bg-gray-100 px-2 py-1 text-start font-semibold'
const td = 'border border-gray-300 px-2 py-1'
export const H = ({ children }: { children: ReactNode }) => <h2 className="mb-1 mt-5 font-bold">{children}</h2>
function Table({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <table className="mb-2 w-full border-collapse text-xs">
      <thead><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k} className={td}>{c}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={head.length} className={`${td} text-center text-gray-400`}>لا بيانات</td></tr>}</tbody>
      {foot && <tfoot><tr className="bg-gray-50 font-semibold">{foot.map((c, k) => <td key={k} className={td}>{c}</td>)}</tr></tfoot>}
    </table>
  )
}
const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">{rows.map(([k, v]) => <div key={k} className="flex gap-2 border-b border-gray-100 py-0.5"><dt className="w-32 shrink-0 text-gray-500">{k}</dt><dd className="font-medium">{v ?? '—'}</dd></div>)}</dl>
)

/** A4 sheet shared by every printable document: letterhead, title, optional Draft watermark and footer (BR-T-06). */
export function Sheet({ c, title, code, children }: { c: Contract; title: string; code: string; children: ReactNode }) {
  const { db } = useStore()
  const org = db.organizations.find((o) => o.id === c.organizationId)
  const draft = c.status === 'Draft'
  return (
    <div className="print-sheet relative mx-auto min-h-[297mm] w-full max-w-[210mm] overflow-hidden bg-white p-[16mm] text-[13px] leading-7 text-gray-900 shadow-md">
      {draft && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="-rotate-[28deg] select-none text-[120px] font-bold tracking-widest text-gray-200/70">مسودة</span></div>}
      <div className="relative">
        <header className="mb-5 flex items-start justify-between border-b-2 border-navy pb-3">
          <div><div className="text-lg font-bold text-navy">{org?.name}</div><div className="text-xs text-gray-500">{org?.city}</div></div>
          <div className="text-end text-xs text-gray-600"><div>رقم العقد: <b dir="ltr">{c.number}</b></div><div>تاريخ الإصدار: {fmtDate(db.asOf)}</div></div>
        </header>
        <h1 className="mb-1 text-center text-xl font-bold">{title}</h1>
        <p className="mb-4 text-center text-xs text-gray-500">{c.title}</p>
        {children}
        <footer className="mt-10 border-t border-gray-300 pt-2 text-center text-[10px] text-gray-400">{c.number} · {userName(db, c.ownerUserId)} · {code}</footer>
      </div>
    </div>
  )
}

// ───────────── 1. contract ─────────────
export function ContractDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const t = typeOf(db, c)
  const org = db.organizations.find((o) => o.id === c.organizationId)
  const terms = termsOf(db, c.id).filter((x) => x.isIncluded)
  const lines = db.lines.filter((l) => l.contractId === c.id)
  const parties = db.parties.filter((p) => p.contractId === c.id)
  const company = db.users.find((u) => u.id === 'u-gm')
  const counterparty = parties.find((p) => p.isPrimary)
  const sigs = db.signatures.filter((s) => s.contractId === c.id)
  return (
    <Sheet c={c} title={`${t.name} — الإصدار ${c.versionNo ? `v${c.versionNo}` : 'غير مفعّل'}`} code="CONTRACT_AR_A4">
      <section className="mb-5">
        <h2 className="mb-1 font-bold">أطراف العقد</h2>
        <p>الطرف الأول: <b>{org?.name}</b>، ويمثله {company?.name} ({company?.title}).</p>
        <p>الطرف الثاني: <b>{partnerName(db, c)}</b>{counterparty ? `، ويمثله ${counterparty.contactName || '…………'} (${counterparty.signatoryTitle})` : ''}.</p>
        {parties.filter((p) => !p.isPrimary).map((p) => <p key={p.id}>{p.name} — {p.contactName} ({p.signatoryTitle}).</p>)}
        <p className="text-xs text-gray-500">المدة: {fmtDate(c.startDate)} ← {c.endDate ? fmtDate(c.endDate) : 'مفتوح'} — القيمة: {c.contractValue ? money(c.contractValue, c.currency) : 'غير محددة'}</p>
      </section>
      {lines.length > 0 && (
        <section className="mb-5"><h2 className="mb-1 font-bold">جدول البنود المتعاقد عليها</h2>
          <Table head={['#', 'الصنف / التصنيف', 'الكمية', 'سعر الوحدة', 'خصم %', 'القيمة']}
            rows={lines.map((l) => [l.lineNum, lineTarget(db, l), l.commitmentType === 'Quantity' ? fmtUnits(db, c, l, l.agreedQuantity ?? 0) : 'التزام بالقيمة', l.commitmentType === 'Quantity' ? num(netPrice(l) / (1 - l.discountPercent / 100)) : '—', l.discountPercent || '—', money(committedValue(l), c.currency)])}
            foot={['', '', '', '', 'الإجمالي', money(lines.reduce((s, l) => s + committedValue(l), 0), c.currency)]} /></section>)}
      <section className="mb-8"><h2 className="mb-2 font-bold">الشروط والأحكام</h2>
        {terms.length === 0 ? <p className="text-gray-400">…………………………………………………………</p> : <ol className="space-y-3">{terms.map((x, i) => <li key={x.id}><b>المادة ({i + 1}) — {x.title}</b><p>{resolveText(db, c, x.body)}</p></li>)}</ol>}
      </section>
      <section className="mt-10 grid grid-cols-2 gap-8 text-center">
        {[{ role: 'الطرف الأول', name: company?.name, title: company?.title, sig: sigs.find((s) => s.role === 'Company') }, { role: 'الطرف الثاني', name: counterparty?.contactName || partnerName(db, c), title: counterparty?.signatoryTitle, sig: sigs.find((s) => s.role === 'Counterparty') }].map((b) => (
          <div key={b.role}><div className="font-bold">{b.role}</div><div className="mt-1 text-xs text-gray-600">{b.name}{b.title ? ` — ${b.title}` : ''}</div>
            <div className="mx-auto mt-10 h-px w-48 bg-gray-400" /><div className="mt-1 text-[11px] text-gray-500">{b.sig ? `وُقّع بتاريخ ${fmtDate(b.sig.signedOn)}` : 'التوقيع والختم'}</div></div>))}
      </section>
    </Sheet>
  )
}

// ───────────── 2. summary sheet ─────────────
export function SummaryDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const t = typeOf(db, c)
  const parties = db.parties.filter((p) => p.contractId === c.id)
  const sigs = db.signatures.filter((s) => s.contractId === c.id)
  const atts = db.attachments.filter((a) => a.ownerId === c.id)
  const alerts = computeAlerts(db).filter((a) => a.contractId === c.id)
  const pt = db.paymentTerms.find((p) => p.id === c.paymentTermId)
  return (
    <Sheet c={c} title="ملخص العقد" code="CONTRACT_SUMMARY_AR_A4">
      <KV rows={[['النوع', `${t.name} (${profileLabel[c.profile]})`], ['الاتجاه', directionLabel[c.direction]], ['الحالة', statusLabel[c.status]], ['الإصدار', c.versionNo ? `v${c.versionNo}` : 'غير مفعّل'],
        ['الطرف الآخر', partnerName(db, c)], ['المسؤول', userName(db, c.ownerUserId)], ['المنشأة', db.organizations.find((o) => o.id === c.organizationId)?.name], ['السرية', confLabel[c.confidentiality]],
        ['البداية', fmtDate(c.startDate)], ['النهاية', c.endDate ? fmtDate(c.endDate) : 'مفتوح'], ['القيمة', c.contractValue ? money(c.contractValue, c.currency) : '—'], ['شرط الدفع', pt?.name],
        ['سياسة التجديد', renewalLabel[c.renewalPolicy]], ['مدة الإشعار', c.noticePeriodDays ? `${c.noticePeriodDays} يوم` : '—'], ['تفعيل العقد', c.activatedOn ? fmtDate(c.activatedOn) : '—'], ['العقد اللاحق', c.successorContractId ? db.contracts.find((x) => x.id === c.successorContractId)?.number : '—']]} />
      <H>الأطراف</H><Table head={['الاسم', 'الدور', 'الممثل', 'صفة الموقّع']} rows={parties.map((p) => [p.name, p.role === 'Counterparty' ? 'الطرف الآخر' : p.role, p.contactName, p.signatoryTitle])} />
      <H>التواقيع</H><Table head={['الدور', 'الموقّع', 'التاريخ', 'الطريقة']} rows={sigs.map((s) => [s.role === 'Company' ? 'الشركة' : 'الطرف الآخر', s.signerName, fmtDate(s.signedOn), s.method === 'ExternalProvider' ? 'مزوّد إلكتروني' : s.method === 'Uploaded' ? 'مستند مرفوع' : 'ورقي'])} />
      <H>المرفقات</H><Table head={['الملف', 'النوع', 'التاريخ']} rows={atts.map((a) => [a.fileName, a.subType, fmtDate(a.uploadedAt)])} />
      <H>تنبيهات قائمة</H>
      {alerts.length === 0 ? <p className="text-xs text-gray-400">لا تنبيهات</p> : <ul className="list-disc ps-5 text-xs">{alerts.map((a) => <li key={a.key}>{a.text}</li>)}</ul>}
    </Sheet>
  )
}

// ───────────── 3. approval record ─────────────
export function ApprovalDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const reqs = db.approvalRequests.filter((r) => r.contractId === c.id).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const subj = { Contract: 'العقد', Amendment: 'ملحق', Termination: 'إنهاء' } as const
  return (
    <Sheet c={c} title="سجل الاعتماد" code="APPROVAL_RECORD_AR_A4">
      {reqs.map((r) => (
        <section key={r.id} className="mb-5">
          <h2 className="mb-1 font-bold">{subj[r.subjectType]} — {r.ruleName} ({r.status === 'Approved' ? 'مُعتمد' : r.status === 'Rejected' ? 'مرفوض' : r.status === 'Pending' ? 'قيد الاعتماد' : 'ملغى'})</h2>
          <p className="mb-1 text-xs text-gray-500">أُرسل بواسطة {userName(db, r.submittedBy)} في {fmtDateTime(r.submittedAt)} — القيمة المعتمدة للاختيار {money(r.valueIQD, 'IQD')}</p>
          <Table head={['المرحلة', 'المعتمد', 'القرار', 'التاريخ', 'الملاحظة']} rows={r.stages.map((s) => {
            const a = db.approvalActions.find((x) => x.requestId === r.id && x.stageNo === s.no)
            return [`${s.no}. ${s.label}`, a ? `${userName(db, a.approverUserId)}${a.onBehalfOfUserId ? ` (بالنيابة عن ${userName(db, a.onBehalfOfUserId)})` : ''}` : userName(db, s.userId), a ? (a.decision === 'Approved' ? 'اعتماد' : 'رفض') : s.status === 'open' ? 'بانتظار القرار' : '—', a ? fmtDateTime(a.decidedAt) : '—', a?.comment || '—']
          })} />
        </section>))}
    </Sheet>
  )
}

// ───────────── 4. fulfillment statement ─────────────
export function FulfillmentDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const lines = db.lines.filter((l) => l.contractId === c.id)
  const cfg = agreementCfg(db, c)
  const basis = { Order: 'الأمر', Delivery: 'التسليم', Invoice: 'الفاتورة' }[cfg.basis]
  const ledger = db.ledger.filter((e) => e.contractId === c.id).sort((a, b) => a.sourceDocDate.localeCompare(b.sourceDocDate) || a.sequence - b.sequence)
  const u = (l: (typeof lines)[number], n: number) => fmtUnits(db, c, l, n)
  return (
    <Sheet c={c} title="كشف تنفيذ الاتفاقية" code="FULFILLMENT_STMT_AR_A4">
      <p className="mb-2 text-xs text-gray-600">الطرف: {partnerName(db, c)} — الفترة {fmtDate(c.startDate)} ← {c.endDate ? fmtDate(c.endDate) : 'مفتوح'} — العملة {c.currency} — أساس الاستهلاك: {basis}</p>
      <Table head={['#', 'البند', 'الملتزم', 'المحجوز', 'المنفّذ', 'المفوتر', 'المتبقي', '%']}
        rows={lines.map((l) => { const b = balanceOf(db, l.id), r = remaining(db, c, l); return [l.lineNum, lineTarget(db, l), u(l, committedUnits(l)), u(l, counterUnits(l, b, 'Release')), u(l, counterUnits(l, b, 'Fulfill')), u(l, counterUnits(l, b, 'Invoice')), u(l, r.left), `${num(r.pct, 1)}%`] })} />
      <H>حركات التنفيذ</H>
      <Table head={['التاريخ', 'المستند', 'البند', 'العدّاد', 'الكمية', `القيمة (${c.currency})`, 'السبب']}
        rows={ledger.map((e) => [fmtDate(e.sourceDocDate), `${e.sourceDocRef} — ${docMeta[e.sourceDocType].label}`, e.lineNum, counterLabel[e.entryType], `${e.quantityDelta > 0 ? '+' : ''}${qty(e.quantityDelta)}`, `${e.valueDelta > 0 ? '+' : ''}${num(e.valueDelta, c.currency === 'USD' ? 2 : 0)}`, { Posted: 'ترحيل', Cancelled: 'إلغاء', Returned: 'مرتجع', Reversed: 'عكس', Edited: 'تعديل', Recalculated: 'إعادة احتساب', Exceeded: 'تجاوز الحد' }[e.reason]])} />
      <p className="text-[11px] text-gray-500">الأرصدة محسوبة من دفتر التنفيذ؛ لا تُجرى قيود محاسبية من العقود.</p>
    </Sheet>
  )
}

// ───────────── 5. obligations and payments statement ─────────────
export function ObligationsDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const obls = db.obligations.filter((o) => o.contractId === c.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const pays = itemsOf(db, c.id)
  const s = financialSummary(db, c)
  return (
    <Sheet c={c} title="كشف الالتزامات والدفعات" code="OBLIGATIONS_STMT_AR_A4">
      <H>الالتزامات</H>
      <Table head={['الالتزام', 'النوع', 'الاستحقاق', 'المسؤول', 'الحالة', 'غرامة (عرض)']} rows={obls.map((o) => [o.title, kindLabel[o.kind], fmtDate(o.dueDate), db.employees.find((e) => e.id === o.responsibleEmployeeId)?.name ?? '—', oblLabel[effStatus(o)], penaltyOf(o) ? money(penaltyOf(o), c.currency) : '—'])} />
      <H>جدول الدفعات</H>
      <Table head={['#', 'النوع', 'الاستحقاق', 'النسبة', 'المبلغ', 'الحالة']} rows={pays.map((p) => [p.itemNo, payKindLabel[p.kind], fmtDate(p.dueDate), p.percent !== undefined ? `${p.percent}%` : '—', money(p.amount, p.currency), payStatusLabel[effItemStatus(p)]])}
        foot={['', '', '', '', money(pays.reduce((a, p) => a + p.amount, 0), c.currency), '']} />
      <H>الملخص المالي</H>
      <KV rows={[['قيمة العقد', money(s.contractValue, c.currency)], ['المخطط', money(s.plannedValue, c.currency)], ['المفوتر', money(s.invoicedValue, c.currency)], ['المدفوع', s.unsettled ? 'غير متاح' : money(s.paidValue, c.currency)],
        ['المستحق للتحصيل', s.outstanding === null ? 'غير متاح' : money(s.outstanding, c.currency)], ['المتبقي من الالتزام', money(s.remaining, c.currency)], ['المحتجز (عرض)', money(s.retentionHeld, c.currency)], ['الغرامات المستحقة (عرض)', money(s.penaltiesAccrued, c.currency)]]} />
    </Sheet>
  )
}

// ───────────── 6. amendment ─────────────
export function AmendmentDoc({ c, a }: { c: Contract; a: ContractAmendment | undefined }) {
  const { db } = useStore()
  if (!a) return <Sheet c={c} title="ملحق العقد" code="AMENDMENT_AR_A4"><p className="text-gray-400">لا ملحق.</p></Sheet>
  const req = db.approvalRequests.find((r) => r.id === a.approvalRequestId)
  return (
    <Sheet c={c} title={`ملحق رقم (${a.amendmentNo}) — ${amendTypeLabel[a.type]}`} code="AMENDMENT_AR_A4">
      <p className="mb-2">اتفق الطرفان — {partnerName(db, c)} من جهة والمنشأة من جهة أخرى — على تعديل العقد رقم <b dir="ltr">{c.number}</b> وفق ما يلي، ابتداءً من <b>{fmtDate(a.effectiveDate)}</b>.</p>
      <KV rows={[['الحالة', amendStatusLabel[a.status]], ['الإصدار الأساسي', `v${a.baseVersionNo}`], ['الإصدار الناتج', a.appliedVersionNo ? `v${a.appliedVersionNo}` : '—'], ['أنشأه', userName(db, a.createdBy)]]} />
      <H>السبب</H><p className="text-sm">{a.reason}</p>
      <H>التعديلات (القديم ← الجديد)</H>
      <Table head={['البند', 'القديم', 'الجديد']} rows={describeChanges(db, c, a).map((r) => [r.label, r.from ?? '—', r.to ?? (r.tone === 'removed' ? 'محذوف' : '—')])} />
      {req && (<><H>الاعتماد</H><Table head={['المرحلة', 'المعتمد', 'القرار', 'التاريخ']} rows={req.stages.map((s) => { const x = db.approvalActions.find((y) => y.requestId === req.id && y.stageNo === s.no); return [`${s.no}. ${s.label}`, userName(db, x?.approverUserId ?? s.userId), x ? (x.decision === 'Approved' ? 'اعتماد' : 'رفض') : '—', x ? fmtDateTime(x.decidedAt) : '—'] })} /></>)}
      <p className="mt-3 text-xs text-gray-500">باقي بنود العقد الأصلي سارية دون تغيير.</p>
    </Sheet>
  )
}

// ───────────── 7. service statement ─────────────
export function ServiceDoc({ c }: { c: Contract }) {
  const { db } = useStore()
  const l = levelOf(db, c.id), used = consumed(db, c.id)
  const wins = db.coverageWindows.filter((w) => w.contractId === c.id)
  const calls = db.serviceCalls.filter((x) => x.contractId === c.id).sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const slaText = { Within: 'ضمن المهلة', NearBreach: 'يقترب', Breached: 'خرق', Met: 'ضمن المهلة', 'n/a': '—' } as const
  return (
    <Sheet c={c} title="كشف الخدمة ومستوى الخدمة" code="SERVICE_STMT_AR_A4">
      <KV rows={[['مهلة الاستجابة', l ? `${l.responseHours} ساعة عمل` : '—'], ['مهلة الحل', l ? `${l.resolutionHours} ساعة عمل` : '—'], ['الساعات (مستهلك / مشمول)', `${used.hours} / ${l?.includedHours ?? '—'}`], ['الزيارات (مستهلك / مشمول)', `${used.visits} / ${l?.includedVisits ?? '—'}`], ['الضمان', l?.warrantyEnd ? `${fmtDate(l.warrantyStart)} ← ${fmtDate(l.warrantyEnd)}` : '—'], ['الحدود', l?.limits || '—']]} />
      <H>نوافذ التغطية</H><Table head={['اليوم', 'من', 'إلى']} rows={wins.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((w) => [dayNames[w.dayOfWeek], w.fromTime, w.toTime])} />
      <H>الأصناف المشمولة</H><Table head={['الوصف', 'الرقم التسلسلي', 'الضمان']} rows={db.coveredItems.filter((i) => i.contractId === c.id).map((i) => [i.description, i.serial ?? '—', i.warrantyEnd ? `حتى ${fmtDate(i.warrantyEnd)}` : '—'])} />
      <H>البلاغات</H>
      <Table head={['البلاغ', 'فُتح', 'استُجيب', 'حُلّ', 'الساعات', 'SLA', 'فوترة']} rows={calls.map((x) => [x.no, fmtStamp(x.openedAt), fmtStamp(x.respondedAt), fmtStamp(x.resolvedAt), x.hoursConsumed || '—', slaText[callSla(db, x).worst], x.billable ? 'قابل للفوترة' : '—'])} />
    </Sheet>
  )
}

