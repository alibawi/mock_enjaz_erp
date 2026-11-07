import { AlertTriangle, Ban, CheckCircle2, ClipboardCheck, FileText, Lock, Wallet, Pause, Play, Plus, Printer, RefreshCw, RotateCcw, Trash2, UserCog, XCircle } from 'lucide-react'
import { useState } from 'react'
import { JournalPreview } from '../../components/board'
import { DataTable } from '../../components/DataTable'
import { Timeline } from '../../components/display'
import { ItemSelect, PartnerSelect, SearchableSelect, TechnicianSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock, ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select, Tabs } from '../../components/ui'
import { today } from '../../data/asof'
import { bookingStatus, timeRange, uid, coverageLabel, dispositionLabel, fmtDate, fmtDateTime, iqd, maintKindLabel, num, woStatus } from '../../data/format'
import { available, expenseAccountOf } from '../../data/stock'
import { useStore } from '../../data/store'
import type { Disposition } from '../../data/types'
import {
  addOperation, addPart, addRemovedPart, addTime, cancel, close, complete, confirmTime, kindOf, pause, plan, qualityResult, removePart,
  removeTime, reopen, resume, retryConsumption, setBillingPartner, setConsumed, setPartExpenseType, start, toggleOperation, toQualityCheck, woCost,
} from '../../data/workorder'
import { useApi } from '../../lib/useApi'
import { canInvoice, depositsOf, generateInvoice, invoicesOf, reopenBilling } from '../../data/billing'
import { DepositDialog, PayBadge } from '../billing/shared'
import { Link, useNavigate, useParams } from '../../router'
import { WarrantyBadge } from '../assets/shared'
import { BillBadge, ConsBadge, WoBadge } from './shared'

type TabId = 'summary' | 'operations' | 'parts' | 'time' | 'schedule' | 'billing' | 'removed' | 'history'
type Dlg =
  | { k: 'plan'; tech: string; start: string; end: string }
  | { k: 'pause'; to: 'waitingParts' | 'waitingCustomer' | 'onHold'; reason: string }
  | { k: 'qc'; passed: boolean; note: string }
  | { k: 'complete'; fc: string; why: string; meter: number }
  | { k: 'cancel' | 'reopen'; reason: string }
  | { k: 'part'; itemId: string; qty: number }
  | { k: 'op'; operationId: string }
  | { k: 'time'; technicianId: string; date: string; hours: number; category: 'regular' | 'overtime' }
  | { k: 'removed'; description: string; serial: string; disposition: Disposition }
  | { k: 'billing'; partnerId: string }

const PRE = ['created', 'planned', 'scheduled']
const WORK = ['inProgress', 'waitingParts', 'waitingCustomer', 'onHold', 'qualityCheck']

/** Work order card (S12): lifecycle actions by status, parts with reservation / consumption / issue, time, removed parts, journal. */
export default function WorkOrderCard() {
  const { id } = useParams()
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const api = useApi(() => db.workOrders.find((x) => x.id === id) ?? null, [id])
  const [tab, setTab] = useState<TabId>('summary')
  const [dlg, setDlg] = useState<Dlg | null>(null)
  const [deposit, setDeposit] = useState(false)

  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />
  const w = db.workOrders.find((x) => x.id === id)
  if (!w) return <EmptyBlock title="أمر العمل غير موجود" action={<Link to="/work-orders" className="btn">العودة</Link>} />

  const asset = db.assets.find((a) => a.id === w.assetId)
  const vehicle = db.vehicles.find((v) => v.assetId === w.assetId)
  const owner = db.partners.find((p) => p.id === w.partnerId)
  const billing = db.partners.find((p) => p.id === w.billingPartnerId)
  const type = db.maintenanceTypes.find((m) => m.id === w.maintenanceTypeId)
  const req = db.requests.find((r) => r.id === w.requestId)
  const est = db.estimates.find((e) => e.id === w.estimateId)
  const original = db.workOrders.find((x) => x.id === w.reworkOfId)
  const reworks = db.workOrders.filter((x) => x.reworkOfId === w.id)
  const item = (iid: string) => db.items.find((i) => i.id === iid)
  const tech = (tid?: string) => db.technicians.find((t) => t.id === tid)?.name ?? '—'
  const userName = (u?: string) => db.users.find((x) => x.id === u)?.name ?? (u === 'system' ? 'النظام' : '—')
  const issues = db.goodsIssues.filter((g) => w.goodsIssueIds.includes(g.id))
  const bookings = db.bookings.filter((b) => b.stops.some((s) => s.workOrderId === w.id))
  const audit = db.audit.filter((x) => x.entity === 'workOrder' && x.entityId === w.id).sort((a, b) => b.at.localeCompare(a.at))
  const cost = woCost(db, w)
  const kind = kindOf(db, w)
  const internal = kind === 'internal'
  const exec = can('WorkOrders.Execute')
  const manage = can('WorkOrders.Create')
  const working = WORK.includes(w.status)
  const unit = db.categories.find((c) => c.id === asset?.categoryId)?.meterUnit
  const lastMeter = db.readings.filter((r) => r.assetId === w.assetId).sort((a, b) => b.value - a.value)[0]
  const billable = (q: number, price: number, c: string) => (c === 'paid' ? q * price : 0)
  const partsValue = w.parts.reduce((s, p) => s + billable(Math.max(p.consumedQty, p.issuedQty) || p.plannedQty, p.price, p.coverage), 0)
  const servicesValue = w.services.reduce((s, x) => s + billable(x.qty, x.price, x.coverage), 0)
  const pendingTime = w.timeEntries.filter((t) => !t.confirmedBy).length
  const woInvoices = invoicesOf(db, w.id)
  const deposits = depositsOf(db, w.id)
  const invoiceErr = canInvoice(db, w)
  const go = (fn: Parameters<typeof run>[0], ok: string) => run(fn, ok) && setDlg(null)

  const actions = (
    <>
      {PRE.includes(w.status) && manage && <button type="button" className="btn" onClick={() => setDlg({ k: 'plan', tech: w.leadTechnicianId ?? '', start: w.plannedStart ?? `${today()}T09:00`, end: w.plannedEnd ?? `${today()}T16:00` })}><UserCog className="h-4 w-4" />{w.status === 'created' ? 'تخطيط وتعيين فني' : 'تعديل الخطة'}</button>}
      {['planned', 'scheduled'].includes(w.status) && exec && <button type="button" className="btn btn-primary" onClick={() => run((d) => start(d, w.id), 'بدأ العمل وحُجزت القطع')}><Play className="h-4 w-4" />بدء العمل</button>}
      {w.status === 'inProgress' && exec && <>
        <button type="button" className="btn btn-primary" onClick={() => run((d) => toQualityCheck(d, w.id), 'أُحيل لفحص الجودة')}><ClipboardCheck className="h-4 w-4" />فحص الجودة</button>
        <button type="button" className="btn" onClick={() => setDlg({ k: 'complete', fc: w.failureCodeId ?? '', why: w.repairReason ?? '', meter: 0 })}><CheckCircle2 className="h-4 w-4" />إكمال مباشرة</button>
        <button type="button" className="btn" onClick={() => setDlg({ k: 'pause', to: 'waitingParts', reason: '' })}><Pause className="h-4 w-4" />تعليق</button>
      </>}
      {['waitingParts', 'waitingCustomer', 'onHold'].includes(w.status) && exec && <button type="button" className="btn btn-primary" onClick={() => run((d) => resume(d, w.id), 'استؤنف العمل')}><Play className="h-4 w-4" />استئناف</button>}
      {w.status === 'qualityCheck' && exec && <>
        <button type="button" className="btn btn-primary" onClick={() => setDlg({ k: 'complete', fc: w.failureCodeId ?? '', why: w.repairReason ?? '', meter: 0 })}><CheckCircle2 className="h-4 w-4" />نجح الفحص — إكمال</button>
        <button type="button" className="btn text-red-600" onClick={() => setDlg({ k: 'qc', passed: false, note: '' })}><XCircle className="h-4 w-4" />لم ينجح — إعادة</button>
      </>}
      {w.status === 'completed' && ['failed', 'pending'].includes(w.consumptionStatus) && can('WorkOrders.PostConsumption') && (
        <button type="button" className="btn btn-primary" onClick={() => run((d) => retryConsumption(d, w.id), 'رُحِّل سند الصرف')}><RefreshCw className="h-4 w-4" />{w.consumptionStatus === 'failed' ? 'إعادة محاولة الصرف' : 'ترحيل الصرف'}</button>
      )}
      {w.status === 'completed' && manage && <button type="button" className="btn btn-primary" onClick={() => run((d) => close(d, w.id), 'أُغلق أمر العمل')}><Lock className="h-4 w-4" />إغلاق</button>}
      {w.status === 'closed' && can('WorkOrders.Reopen') && <button type="button" className="btn" onClick={() => setDlg({ k: 'reopen', reason: '' })}><RotateCcw className="h-4 w-4" />إعادة فتح</button>}
      <button type="button" className="btn" onClick={() => nav(`/work-orders/${w.id}/job-card`)}><Printer className="h-4 w-4" />بطاقة العمل</button>
      {[...PRE, 'inProgress', 'waitingParts', 'waitingCustomer', 'onHold'].includes(w.status) && manage && <button type="button" className="btn text-red-600" onClick={() => setDlg({ k: 'cancel', reason: '' })}><Ban className="h-4 w-4" />إلغاء</button>}
    </>
  )

  const gate = w.status === 'completed' && (
    <div className="mb-3 rounded-md border border-line bg-white px-3 py-2 text-sm">
      <div className="mb-1 font-semibold text-gray-700">شروط الإغلاق (BR-M-19)</div>
      <div className="flex flex-wrap gap-4">
        <span className={['posted', 'notRequired'].includes(w.consumptionStatus) ? 'text-emerald-700' : 'text-red-600'}>{['posted', 'notRequired'].includes(w.consumptionStatus) ? '✓' : '✗'} صرف القطع: <ConsBadge w={w} /></span>
        <span className={['invoiced', 'notBillable'].includes(w.billingStatus) ? 'text-emerald-700' : 'text-red-600'}>{['invoiced', 'notBillable'].includes(w.billingStatus) ? '✓' : '✗'} الفوترة: <BillBadge w={w} />{w.billingStatus === 'notInvoiced' && can('Billing.Generate') && <button type="button" className="ms-2 text-xs text-navy underline" onClick={() => setTab('billing')}>إصدار الفاتورة</button>}{w.billingStatus === 'invoiceCancelled' && <span className="ms-1 text-xs text-gray-500">(أعد فتح الفوترة وأصدر دفعة جديدة)</span>}</span>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'أوامر العمل', to: '/work-orders' }, { label: w.number }]}
        title={`أمر عمل ${w.number}`}
        badge={<><WoBadge w={w} />{kind && <Badge tone="gray">{maintKindLabel[kind]}</Badge>}{w.reworkOfId && <Badge tone="red">إعادة عمل</Badge>}</>}
        summary={{ label: internal ? 'التكلفة حتى الآن' : 'قيمة قابلة للفوترة', value: iqd(internal ? cost.total : partsValue + servicesValue) }}
        actions={actions}
      />

      {original && <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle className="h-4 w-4" />إعادة عمل للأمر <Link to={`/work-orders/${original.id}`} className="font-mono underline" dir="ltr">{original.number}</Link> المكتمل في {fmtDate(original.actualEnd)} — بلا فوترة، على مصروف حسن النية.</div>}
      {w.consumptionStatus === 'failed' && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><b>فشل الصرف التلقائي:</b> {w.consumptionError} — أمر العمل مكتمل والقطع ما زالت محجوزة؛ أعد المحاولة بعد المعالجة (صلاحية ترحيل الصرف).</div>}
      {w.holdReason && ['waitingParts', 'waitingCustomer', 'onHold'].includes(w.status) && <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{woStatus[w.status].label}: {w.holdReason}</div>}
      {gate}

      <Card pad={false}>
        <Tabs<TabId> active={tab} onChange={setTab} tabs={[
          { id: 'summary', label: 'الملخص' },
          { id: 'operations', label: 'العمليات', count: w.operations.length },
          { id: 'parts', label: 'القطع', count: w.parts.length },
          { id: 'time', label: 'الساعات', count: w.timeEntries.length },
          { id: 'schedule', label: 'الجدولة', count: bookings.length },
          { id: 'billing', label: 'الصرف والفوترة', count: issues.length },
          { id: 'removed', label: 'القطع المُزالة', count: w.removedParts.length },
          { id: 'history', label: 'السجل', count: audit.length },
        ]} />
        <div className="p-4">
          {tab === 'summary' && (
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-3 text-sm xl:col-span-2">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span><span className="text-gray-500">الأصل: </span><Link to={`/assets/${asset?.id}`} className="text-navy hover:underline">{asset?.name}</Link></span>
                  {vehicle && <span className="text-gray-600">{vehicle.plate}</span>}
                  {asset && <WarrantyBadge asset={asset} />}
                </div>
                <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  <div><span className="text-gray-500">المالك: </span>{owner?.name}</div>
                  <div className="flex items-center gap-2"><span className="text-gray-500">الجهة المُفوتَرة: </span>{internal ? 'استهلاك داخلي' : billing?.name}
                    {!internal && can('WorkOrders.ChangeBillingPartner') && ['created', 'planned', 'scheduled', 'inProgress'].includes(w.status) && <button type="button" className="text-xs text-navy underline" onClick={() => setDlg({ k: 'billing', partnerId: w.billingPartnerId })}>تغيير</button>}</div>
                  <div><span className="text-gray-500">نوع الصيانة: </span>{type?.name}</div>
                  <div><span className="text-gray-500">نوع المصروف: </span>{db.expenseTypes.find((e) => e.id === w.expenseTypeId)?.name ?? '—'} <span className="font-mono text-xs text-gray-500" dir="ltr">{expenseAccountOf(db, w).code}</span></div>
                  <div><span className="text-gray-500">الفني المسؤول: </span>{tech(w.leadTechnicianId)}</div>
                  <div><span className="text-gray-500">الخطة: </span>{w.plannedStart ? `${fmtDateTime(w.plannedStart)} ← ${fmtDateTime(w.plannedEnd)}` : '—'}</div>
                  <div><span className="text-gray-500">التنفيذ الفعلي: </span>{w.actualStart ? `${fmtDateTime(w.actualStart)} ← ${fmtDateTime(w.actualEnd)}` : '—'}</div>
                  {w.depositRequired ? <div><span className="text-gray-500">عربون مطلوب: </span>{iqd(w.depositRequired)}</div> : null}
                  {req && <div><span className="text-gray-500">الطلب: </span><Link to={`/requests/${req.id}`} className="font-mono text-navy hover:underline" dir="ltr">{req.number}</Link></div>}
                  {est && <div><span className="text-gray-500">التقدير: </span><Link to={`/estimates/${est.id}`} className="font-mono text-navy hover:underline" dir="ltr">{est.number} v{est.version}</Link></div>}
                </div>
                {req && <p className="rounded bg-gray-50 px-3 py-2 text-gray-700">الشكوى: {req.complaint}</p>}
                {(w.failureCodeId || w.repairReason) && <div className="rounded border border-line px-3 py-2"><span className="text-gray-500">كود العطل: </span>{db.failureCodes.find((f) => f.id === w.failureCodeId)?.code} — {db.failureCodes.find((f) => f.id === w.failureCodeId)?.name}<div className="text-gray-600">سبب الإصلاح: {w.repairReason}</div></div>}
                {w.cancelReason && <p className="rounded bg-red-50 px-3 py-2 text-red-800">سبب الإلغاء: {w.cancelReason}</p>}
                {reworks.length > 0 && <p className="rounded bg-amber-50 px-3 py-2 text-amber-800">أوامر إعادة عمل لاحقة: {reworks.map((r) => <Link key={r.id} to={`/work-orders/${r.id}`} className="ms-1 font-mono underline" dir="ltr">{r.number}</Link>)}</p>}
              </div>
              <div className="space-y-3">
                <dl className="space-y-1.5 rounded-md border border-line p-3 text-sm">
                  <div className="mb-1 font-semibold text-gray-700">الحالة المالية</div>
                  <div className="flex justify-between"><dt className="text-gray-500">الصرف</dt><dd><ConsBadge w={w} /></dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">الفوترة</dt><dd><BillBadge w={w} /></dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">قطع (للعميل)</dt><dd className="tabular-nums">{iqd(partsValue)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">عمالة وخدمات (للعميل)</dt><dd className="tabular-nums">{iqd(servicesValue)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-1.5"><dt className="text-gray-500">تكلفة القطع المصروفة</dt><dd className="tabular-nums">{iqd(cost.parts)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">تكلفة العمالة (تقارير فقط)</dt><dd className="tabular-nums">{iqd(cost.labor)}</dd></div>
                </dl>
                <div className="rounded-md border border-line p-3 text-sm">
                  <div className="mb-2 font-semibold text-gray-700">مسار الحالة</div>
                  <ol className="space-y-1 text-xs">
                    {w.statusHistory.map((s, i) => <li key={i} className="flex justify-between gap-2"><span><Badge tone={woStatus[s.to].tone}>{woStatus[s.to].label}</Badge>{s.reason && <span className="ms-1 text-gray-500">{s.reason}</span>}</span><span className="text-gray-500">{fmtDateTime(s.at)} · {userName(s.by)}</span></li>)}
                  </ol>
                </div>
              </div>
            </div>
          )}

          {tab === 'operations' && (
            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-500">تُعلَّم العمليات منجزة أثناء التنفيذ؛ الإحالة للفحص والإكمال تتطلبان إنجازها كلها.</p>
                {manage && !['completed', 'closed', 'cancelled'].includes(w.status) && <button type="button" className="btn" onClick={() => setDlg({ k: 'op', operationId: '' })}><Plus className="h-4 w-4" />عملية قياسية</button>}
              </div>
              <DataTable rows={w.operations} compact emptyTitle="لا توجد عمليات" columns={[
                { key: 'd', label: 'العملية', render: (o) => <span>{o.description}{o.operationId && <span className="ms-1 font-mono text-[11px] text-gray-400" dir="ltr">{db.operations.find((x) => x.id === o.operationId)?.code}</span>}</span> },
                { key: 'h', label: 'ساعات مخططة', num: true, render: (o) => num(o.plannedHours, 1), total: (rs) => num(rs.reduce((s, o) => s + o.plannedHours, 0), 1) },
                { key: 'x', label: 'منجزة', render: (o) => <label className="flex items-center gap-2"><input type="checkbox" checked={o.done} disabled={!exec || !working || w.status === 'qualityCheck'} onChange={() => run((d) => toggleOperation(d, w.id, o.id))} />{o.done ? <Badge tone="green">منجزة</Badge> : <Badge tone="gray">لم تُنجز</Badge>}</label> },
              ]} />
            </div>
          )}

          {tab === 'parts' && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-500">تُحجز القطع عند البدء، وتُسجَّل الكمية المستهلكة أثناء العمل، وتُصرف تلقائيًا عند الإكمال ({db.settings.consumptionMode === 'automatic' ? 'صرف تلقائي' : 'صرف يدوي'} · {db.settings.overIssueMode === 'block' ? 'منع الإكمال إذا تجاوز الاستهلاك المتاح' : 'السماح بالإكمال وإعادة المحاولة'}).</p>
                {exec && !['completed', 'closed', 'cancelled'].includes(w.status) && <button type="button" className="btn" onClick={() => setDlg({ k: 'part', itemId: '', qty: 1 })}><Plus className="h-4 w-4" />قطعة</button>}
              </div>
              <DataTable rows={w.parts} compact emptyTitle="لا توجد قطع" columns={[
                { key: 'i', label: 'القطعة', render: (p) => <span>{item(p.itemId)?.name}<span className="block font-mono text-[11px] text-gray-400" dir="ltr">{item(p.itemId)?.code}</span></span> },
                { key: 'pl', label: 'مخطط', num: true, render: (p) => num(p.plannedQty) },
                { key: 'rs', label: 'محجوز', num: true, render: (p) => <span className={p.reservedQty < p.plannedQty - p.issuedQty && working ? 'text-red-600' : ''}>{num(p.reservedQty)}</span> },
                { key: 'cs', label: 'مستهلك', num: true, render: (p) => (exec && ['inProgress', 'qualityCheck', 'waitingParts', 'waitingCustomer', 'onHold'].includes(w.status) && p.issuedQty === 0
                  ? <div className="w-20"><NumInput value={p.consumedQty} onChange={(q) => run((d) => setConsumed(d, w.id, p.id, q))} /></div> : num(p.consumedQty)) },
                { key: 'is', label: 'مصروف', num: true, render: (p) => num(p.issuedQty) },
                { key: 'av', label: 'متاح بالمخزن', num: true, render: (p) => <span className={available(db, p.itemId) <= 0 ? 'text-red-600' : 'text-gray-500'}>{num(available(db, p.itemId))}</span> },
                { key: 'cv', label: 'التغطية', render: (p) => <Badge tone={p.coverage === 'paid' ? 'gray' : p.coverage === 'warranty' ? 'blue' : 'amber'}>{coverageLabel[p.coverage]}</Badge> },
                {
                  key: 'et', label: 'نوع المصروف (الحساب)', render: (p) => (can('WorkOrders.OverrideExpenseType') && p.issuedQty === 0 && !['closed', 'cancelled'].includes(w.status)
                    ? <div className="w-44"><Select value={p.expenseTypeId ?? ''} onChange={(v) => run((d) => setPartExpenseType(d, w.id, p.id, v), 'تم تغيير نوع المصروف')} placeholder="حسب أمر العمل" options={[{ value: '', label: 'حسب أمر العمل' }, ...db.expenseTypes.map((e) => ({ value: e.id, label: `${e.name} (${e.accountCode})` }))]} /></div>
                    : <span className="text-[12px]">{expenseAccountOf(db, w, p.expenseTypeId).name} <span className="font-mono text-gray-400" dir="ltr">{expenseAccountOf(db, w, p.expenseTypeId).code}</span></span>),
                },
                { key: 'pr', label: 'سعر البيع', num: true, render: (p) => iqd(p.price) },
                { key: 'x', label: '', render: (p) => (exec && p.issuedQty === 0 && p.consumedQty === 0 && !['completed', 'closed', 'cancelled'].includes(w.status) ? <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => run((d) => removePart(d, w.id, p.id), 'حُذف السطر')}><Trash2 className="h-4 w-4" /></button> : null) },
              ]} />
              {w.services.length > 0 && <>
                <div className="mb-1 mt-4 text-sm font-semibold text-gray-700">أسطر العمالة والخدمات (للفوترة)</div>
                <DataTable rows={w.services} compact columns={[
                  { key: 'i', label: 'الخدمة', render: (s) => item(s.itemId)?.name },
                  { key: 'q', label: 'الكمية', num: true, render: (s) => num(s.qty, s.qty % 1 ? 1 : 0) },
                  { key: 'p', label: 'السعر', num: true, render: (s) => iqd(s.price) },
                  { key: 'c', label: 'التغطية', render: (s) => <Badge tone={s.coverage === 'paid' ? 'gray' : s.coverage === 'warranty' ? 'blue' : 'amber'}>{coverageLabel[s.coverage]}</Badge> },
                  { key: 't', label: 'للعميل', num: true, render: (s) => iqd(billable(s.qty, s.price, s.coverage)), total: (rs) => iqd(rs.reduce((t, s) => t + billable(s.qty, s.price, s.coverage), 0)) },
                ]} />
              </>}
            </div>
          )}

          {tab === 'time' && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-500">تُعدَّل الساعات حتى الإغلاق؛ يؤكدها المشرف عند الإكمال. التكلفة = الساعات × سعر الفني القياسي (للتقارير فقط).</p>
                <span className="flex gap-2">
                  {exec && !['created', 'closed', 'cancelled'].includes(w.status) && <button type="button" className="btn" onClick={() => setDlg({ k: 'time', technicianId: w.leadTechnicianId ?? '', date: today(), hours: 1, category: 'regular' })}><Plus className="h-4 w-4" />تسجيل ساعات</button>}
                  {can('WorkOrders.ConfirmTime') && pendingTime > 0 && w.status !== 'closed' && <button type="button" className="btn btn-primary" onClick={() => run((d) => confirmTime(d, w.id), 'تم تأكيد الساعات')}><CheckCircle2 className="h-4 w-4" />تأكيد ({pendingTime})</button>}
                </span>
              </div>
              <DataTable rows={w.timeEntries} compact emptyTitle="لا توجد ساعات مسجلة" columns={[
                { key: 'd', label: 'التاريخ', render: (t) => fmtDate(t.date), sort: (t) => t.date },
                { key: 't', label: 'الفني', render: (t) => tech(t.technicianId) },
                { key: 'h', label: 'الساعات', num: true, render: (t) => num(t.hours, 1), total: (rs) => num(rs.reduce((s, t) => s + t.hours, 0), 1) },
                { key: 'c', label: 'الفئة', render: (t) => (t.category === 'overtime' ? <Badge tone="amber">إضافي</Badge> : 'اعتيادي') },
                { key: 'k', label: 'التكلفة', num: true, render: (t) => iqd(t.hours * (db.technicians.find((x) => x.id === t.technicianId)?.standardRate ?? 0)) },
                { key: 'f', label: 'التأكيد', render: (t) => (t.confirmedBy ? <Badge tone="green">مؤكَّد — {userName(t.confirmedBy)}</Badge> : <Badge tone="amber">بانتظار المشرف</Badge>) },
                { key: 'x', label: '', render: (t) => (!t.confirmedBy && exec && w.status !== 'closed' ? <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => run((d) => removeTime(d, w.id, t.id), 'حُذف السطر')}><Trash2 className="h-4 w-4" /></button> : null) },
              ]} />
            </div>
          )}

          {tab === 'schedule' && (
            bookings.length === 0
              ? <EmptyBlock title="لا توجد حجوزات لهذا الأمر" hint="تُحجز المواعيد من لوحة الجدولة الأسبوعية (المنطقة 6): الحجز يحوّل الأمر إلى «مجدول»." />
              : <DataTable rows={bookings} compact columns={[
                { key: 'n', label: 'الحجز', render: (b) => <span className="font-mono text-[12px]" dir="ltr">{b.number}</span> },
                { key: 'd', label: 'التاريخ', render: (b) => `${fmtDate(b.date)} ${timeRange(b.start, b.end)}` },
                { key: 't', label: 'الفنيون', render: (b) => b.technicianIds.map(tech).join('، ') },
                { key: 's', label: 'الحالة', render: (b) => <Badge tone={bookingStatus[b.status].tone}>{bookingStatus[b.status].label}</Badge> },
              ]} />
          )}

          {tab === 'billing' && (
            <div className="space-y-4">
              {issues.length === 0 && <EmptyBlock title="لا توجد سندات صرف بعد" hint={w.consumptionStatus === 'failed' ? 'فشل الصرف التلقائي — أعد المحاولة من شريط الإجراءات.' : 'يُنشأ سند الصرف تلقائيًا عند إكمال أمر العمل.'} />}
              {issues.map((g) => (
                <div key={g.id} className="rounded-md border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><b>سند صرف</b> <span className="font-mono" dir="ltr">{g.number}</span> — {fmtDateTime(g.date)} <span className="rounded bg-amber-50 px-1.5 text-[10px] text-amber-700">مُحاكى — في النظام الحقيقي: المخزون</span></span>
                    <span className="font-mono text-[11px] text-gray-400" dir="ltr">{g.idempotencyKey}</span>
                  </div>
                  <DataTable rows={g.lines.map((l, i) => ({ ...l, id: String(i) }))} compact columns={[
                    { key: 'i', label: 'القطعة', render: (l) => item(l.itemId)?.name },
                    { key: 'q', label: 'الكمية', num: true, render: (l) => num(l.qty) },
                    { key: 'c', label: 'الكلفة', num: true, render: (l) => iqd(l.unitCost) },
                    { key: 'a', label: 'حساب المصروف', render: (l) => <span><span className="font-mono text-gray-500" dir="ltr">{l.expenseAccount}</span> {l.expenseAccountName}</span> },
                    { key: 't', label: 'المجموع', num: true, render: (l) => iqd(l.qty * l.unitCost) },
                  ]} />
                  <div className="mt-3"><JournalPreview lines={g.journal} /></div>
                </div>
              ))}
              <div className="rounded-md border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-gray-700">الفوترة: <BillBadge w={w} />{w.billingBatch > 0 && <span className="ms-1 text-xs text-gray-500">آخر دفعة {w.billingBatch}</span>}</span>
                  <span className="flex flex-wrap gap-2">
                    {w.billingStatus === 'notInvoiced' && can('Billing.Generate') && <button type="button" className="btn btn-primary" title={invoiceErr ?? ''} disabled={!!invoiceErr} onClick={() => { const iid = uid('inv'); if (run((d) => generateInvoice(d, w.id, iid), 'صدرت الفاتورة')) nav(`/billing/invoices/${iid}`) }}><FileText className="h-4 w-4" />إصدار فاتورة</button>}
                    {w.billingStatus === 'invoiceCancelled' && can('Billing.Cancel') && <button type="button" className="btn" onClick={() => run((d) => reopenBilling(d, w.id), 'أُعيد فتح الفوترة')}><RotateCcw className="h-4 w-4" />إعادة فتح الفوترة</button>}
                    {!['notBillable', 'invoiced'].includes(w.billingStatus) && !['cancelled', 'closed'].includes(w.status) && can('Billing.Generate') && <button type="button" className="btn" onClick={() => setDeposit(true)}><Wallet className="h-4 w-4" />استلام عربون</button>}
                  </span>
                </div>
                {w.billingStatus === 'notBillable' && <p className="text-sm text-gray-500">لا يُفوتر (داخلي / ضمان / حسن نية).</p>}
                {w.billingStatus === 'notInvoiced' && invoiceErr && <p className="text-xs text-amber-700">{invoiceErr}</p>}
                {w.depositRequired ? <p className="text-sm">عربون مطلوب {iqd(w.depositRequired)} — مستلم {iqd(deposits.reduce((t, r) => t + r.amount, 0))}{deposits.reduce((t, r) => t + r.amount, 0) < w.depositRequired && <span className="ms-1 text-amber-700">(لم يُستكمل)</span>}</p> : null}
                {(woInvoices.length > 0 || deposits.length > 0) && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {woInvoices.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2"><Link to={`/billing/invoices/${i.id}`} className="font-mono text-navy hover:underline" dir="ltr">{i.number}</Link><span className="text-gray-500">دفعة {i.batchNo} · {fmtDate(i.date)}</span><span className="tabular-nums">{iqd(i.total)}</span><PayBadge i={i} />{!i.canceled && i.paidAmount < i.total && <span className="text-xs text-gray-500">متبقٍ {iqd(i.total - i.paidAmount)}</span>}</li>)}
                    {deposits.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2"><span className="font-mono" dir="ltr">{r.number}</span><span className="text-gray-500">عربون · {fmtDate(r.date)}</span><span className="tabular-nums">{iqd(r.amount)}</span>{r.amount - r.applied > 0 ? <Badge tone="amber">غير مُسوّى {iqd(r.amount - r.applied)}</Badge> : <Badge tone="green">مُسوّى</Badge>}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'removed' && (
            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-500">كل قطعة مُزالة يجب تحديد مصيرها قبل الإكمال.</p>
                {exec && !['completed', 'closed', 'cancelled'].includes(w.status) && <button type="button" className="btn" onClick={() => setDlg({ k: 'removed', description: '', serial: '', disposition: 'returnedToCustomer' })}><Plus className="h-4 w-4" />قطعة مُزالة</button>}
              </div>
              <DataTable rows={w.removedParts} compact emptyTitle="لا توجد قطع مُزالة" columns={[
                { key: 'd', label: 'الوصف', render: (r) => r.description },
                { key: 's', label: 'الرقم التسلسلي', render: (r) => <span dir="ltr">{r.serial || '—'}</span> },
                { key: 'p', label: 'المصير', render: (r) => dispositionLabel[r.disposition] },
              ]} />
            </div>
          )}

          {tab === 'history' && <Timeline items={audit.map((x) => ({ id: x.id, at: fmtDateTime(x.at), title: x.action, detail: x.detail, by: userName(x.userId) }))} />}
        </div>
      </Card>

      {deposit && <DepositDialog woId={w.id} suggested={Math.max(0, (w.depositRequired ?? Math.round((partsValue + servicesValue) * db.settings.depositDefaultPercent / 100)) - deposits.reduce((t, r) => t + r.amount, 0))} onClose={() => setDeposit(false)} />}
      {dlg?.k === 'plan' && (
        <Modal title="تخطيط أمر العمل" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => plan(d, w.id, dlg.tech, dlg.start, dlg.end), 'تم حفظ الخطة')}>حفظ</button></>}>
          <FormGrid>
            <Field label="الفني المسؤول" required span={3}><TechnicianSelect value={dlg.tech} onChange={(v) => setDlg({ ...dlg, tech: v })} /></Field>
            <Field label="بداية مخططة"><input type="datetime-local" className="inp" value={dlg.start} onChange={(e) => setDlg({ ...dlg, start: e.target.value })} /></Field>
            <Field label="نهاية مخططة"><input type="datetime-local" className="inp" value={dlg.end} onChange={(e) => setDlg({ ...dlg, end: e.target.value })} /></Field>
          </FormGrid>
        </Modal>
      )}
      {dlg?.k === 'pause' && (
        <Modal title="تعليق أمر العمل" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => pause(d, w.id, dlg.to, dlg.reason), 'عُلّق أمر العمل')}>تعليق</button></>}>
          <FormGrid>
            <Field label="الحالة" span={3}><Select value={dlg.to} onChange={(v) => setDlg({ ...dlg, to: v as typeof dlg.to })} options={[{ value: 'waitingParts', label: woStatus.waitingParts.label }, { value: 'waitingCustomer', label: woStatus.waitingCustomer.label }, { value: 'onHold', label: woStatus.onHold.label }]} /></Field>
            <Field label="السبب" required span={3}><textarea className="inp min-h-[70px] py-2" value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} /></Field>
          </FormGrid>
        </Modal>
      )}
      {dlg?.k === 'qc' && (
        <Modal title="لم ينجح فحص الجودة" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => qualityResult(d, w.id, false, dlg.note), 'أُعيد الأمر إلى التنفيذ')}>إعادة للتنفيذ</button></>}>
          <Field label="ما الذي لم ينجح؟" required><textarea className="inp min-h-[70px] py-2" value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} /></Field>
        </Modal>
      )}
      {dlg?.k === 'complete' && (
        <Modal title="إكمال أمر العمل" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
          <button type="button" className="btn btn-primary" onClick={() => go((d) => { if (w.status === 'qualityCheck') { const e = qualityResult(d, w.id, true, ''); if (e) return e } return complete(d, w.id, { failureCodeId: dlg.fc || undefined, repairReason: dlg.why, meterAtHandover: dlg.meter || undefined }) }, db.settings.consumptionMode === 'automatic' ? 'اكتمل أمر العمل — ومحاولة الصرف التلقائي نُفذت' : 'اكتمل أمر العمل')}>إكمال</button></>}>
          <FormGrid>
            <Field label="كود العطل" required={!!type?.corrective} span={3}>
              <SearchableSelect value={dlg.fc} onChange={(v) => setDlg({ ...dlg, fc: v })} placeholder="اختر كود العطل"
                options={db.failureCodes.filter((f) => !f.categoryId || f.categoryId === asset?.categoryId).map((f) => ({ value: f.id, label: `${f.code} — ${f.name}` }))} />
            </Field>
            <Field label="سبب الإصلاح" required={!!type?.corrective} span={3}><textarea className="inp min-h-[60px] py-2" value={dlg.why} onChange={(e) => setDlg({ ...dlg, why: e.target.value })} /></Field>
            {unit && <Field label={`قراءة التسليم (${unit === 'km' ? 'كم' : 'ساعة'})`} hint={lastMeter ? `آخر قراءة ${num(lastMeter.value)}` : undefined}><NumInput value={dlg.meter} onChange={(m) => setDlg({ ...dlg, meter: m })} /></Field>}
          </FormGrid>
          <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
            سيُصرف: {w.parts.filter((p) => p.consumedQty > p.issuedQty).map((p) => `${item(p.itemId)?.name} × ${p.consumedQty - p.issuedQty}`).join('، ') || 'لا شيء (لم تُسجَّل كميات مستهلكة — يُحرَّر المحجوز)'}
            {w.parts.some((p) => p.consumedQty === 0 && p.plannedQty > 0) && <div className="mt-1 text-amber-700">تنبيه: قطع مخططة بلا استهلاك مسجّل — سيُعاد حجزها إلى المخزون.</div>}
          </div>
        </Modal>
      )}
      {(dlg?.k === 'cancel' || dlg?.k === 'reopen') && (
        <Modal title={dlg.k === 'cancel' ? 'إلغاء أمر العمل' : 'إعادة فتح أمر العمل'} onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
          <button type="button" className={`btn ${dlg.k === 'cancel' ? 'border-red-600 bg-red-600 text-white' : 'btn-primary'}`} onClick={() => go((d) => (dlg.k === 'cancel' ? cancel(d, w.id, dlg.reason) : reopen(d, w.id, dlg.reason)), dlg.k === 'cancel' ? 'أُلغي أمر العمل وحُرّرت القطع المحجوزة' : 'أُعيد فتح أمر العمل')}>{dlg.k === 'cancel' ? 'إلغاء الأمر' : 'إعادة فتح'}</button></>}>
          <Field label="السبب" required><textarea className="inp min-h-[70px] py-2" value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} /></Field>
        </Modal>
      )}
      {dlg?.k === 'part' && (
        <Modal title="إضافة قطعة" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => addPart(d, w.id, dlg.itemId, dlg.qty), 'أُضيفت القطعة')}>إضافة</button></>}>
          <FormGrid>
            <Field label="القطعة" required span={2}><ItemSelect kind="part" value={dlg.itemId} onChange={(v) => setDlg({ ...dlg, itemId: v })} /></Field>
            <Field label="الكمية" required hint={dlg.itemId ? `متاح ${num(available(db, dlg.itemId))}` : undefined}><NumInput value={dlg.qty} onChange={(q) => setDlg({ ...dlg, qty: q })} /></Field>
          </FormGrid>
          {!internal && !w.reworkOfId && <p className="mt-2 text-xs text-amber-700">قطعة إضافية لم تكن في التقدير — أبلغ العميل (تُفوتر بسعر البيع).</p>}
        </Modal>
      )}
      {dlg?.k === 'op' && (
        <Modal title="إضافة عملية قياسية" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => addOperation(d, w.id, dlg.operationId), 'أُضيفت العملية')}>إضافة</button></>}>
          <Field label="العملية"><SearchableSelect value={dlg.operationId} onChange={(v) => setDlg({ ...dlg, operationId: v })} options={db.operations.map((o) => ({ value: o.id, label: o.name, hint: `${o.code} · ${o.standardHours} س` }))} /></Field>
        </Modal>
      )}
      {dlg?.k === 'time' && (
        <Modal title="تسجيل ساعات" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => addTime(d, w.id, { technicianId: dlg.technicianId, date: dlg.date, hours: dlg.hours, category: dlg.category }), 'سُجّلت الساعات')}>تسجيل</button></>}>
          <FormGrid>
            <Field label="الفني" required span={2}><TechnicianSelect value={dlg.technicianId} onChange={(v) => setDlg({ ...dlg, technicianId: v })} /></Field>
            <Field label="التاريخ"><input type="date" className="inp" value={dlg.date} max={today()} onChange={(e) => setDlg({ ...dlg, date: e.target.value })} /></Field>
            <Field label="الساعات" required><NumInput value={dlg.hours} onChange={(h) => setDlg({ ...dlg, hours: h })} /></Field>
            <Field label="الفئة"><Select value={dlg.category} onChange={(v) => setDlg({ ...dlg, category: v as 'regular' | 'overtime' })} options={[{ value: 'regular', label: 'اعتيادي' }, { value: 'overtime', label: 'إضافي' }]} /></Field>
          </FormGrid>
        </Modal>
      )}
      {dlg?.k === 'removed' && (
        <Modal title="قطعة مُزالة" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => addRemovedPart(d, w.id, { description: dlg.description, serial: dlg.serial || undefined, disposition: dlg.disposition }), 'سُجّلت القطعة المُزالة')}>حفظ</button></>}>
          <FormGrid>
            <Field label="الوصف" required span={2}><input className="inp" value={dlg.description} onChange={(e) => setDlg({ ...dlg, description: e.target.value })} /></Field>
            <Field label="الرقم التسلسلي"><input className="inp" dir="ltr" value={dlg.serial} onChange={(e) => setDlg({ ...dlg, serial: e.target.value })} /></Field>
            <Field label="المصير" required span={3}><Select value={dlg.disposition} onChange={(v) => setDlg({ ...dlg, disposition: v as Disposition })} options={(Object.keys(dispositionLabel) as Disposition[]).map((k) => ({ value: k, label: dispositionLabel[k] }))} /></Field>
          </FormGrid>
        </Modal>
      )}
      {dlg?.k === 'billing' && (
        <Modal title="تغيير الجهة المُفوتَرة" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => go((d) => setBillingPartner(d, w.id, dlg.partnerId), 'تم تغيير الجهة المُفوتَرة')}>حفظ</button></>}>
          <Field label="العميل الذي يدفع" hint="مثال: المستأجر يدفع بدل شركة التأجير المالكة"><PartnerSelect kind="customer" value={dlg.partnerId} onChange={(v) => setDlg({ ...dlg, partnerId: v })} /></Field>
        </Modal>
      )}
    </div>
  )
}

