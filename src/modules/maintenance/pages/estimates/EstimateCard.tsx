import { Ban, CheckCircle2, Copy, Plus, Printer, Save, Send, Trash2, Undo2, UserCheck, Wrench, XCircle } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { StageTimeline, Timeline } from '../../components/display'
import { ItemSelect } from '../../components/inputs'
import { EmptyBlock, ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { canConvert, cancelEstimate, decide, isInternal, lineTotal, openApprovalFor, recordAcceptance, revise, roundsOf, routing, saveLines, submit, totals, withdraw } from '../../data/estimate'
import { coverageLabel, estimateStatus, fmtDate, fmtDateTime, iqd, lineKindLabel, num, uid } from '../../data/format'
import { roleLabel } from '../../data/permissions'
import { useStore } from '../../data/store'
import type { AcceptanceChannel, Coverage, EstimateLine, LineKind } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { Link, useNavigate, useParams } from '../../router'
import { WarrantyBadge } from '../assets/shared'
import { channelLabel, stagesOf } from './shared'

type Dlg =
  | { k: 'withdraw' | 'cancel'; text: string }
  | { k: 'accept'; decision: 'accepted' | 'declined'; channel: AcceptanceChannel; note: string }
  | { k: 'decide'; approve: boolean; text: string }

export default function EstimateCard() {
  const { id } = useParams()
  const { db, run, can, user } = useStore()
  const nav = useNavigate()
  const api = useApi(() => db.estimates.find((x) => x.id === id) ?? null, [id])
  const [draft, setDraft] = useState<EstimateLine[] | null>(null)
  const [dlg, setDlg] = useState<Dlg | null>(null)

  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />
  const e = db.estimates.find((x) => x.id === id)
  if (!e) return <EmptyBlock title="التقدير غير موجود" action={<Link to="/estimates" className="btn">العودة</Link>} />

  const asset = db.assets.find((a) => a.id === e.assetId)
  const partner = db.partners.find((p) => p.id === e.partnerId)
  const req = db.requests.find((r) => r.id === e.requestId)
  const lines = draft ?? e.lines
  const t = totals(db, { ...e, lines })
  const rt = routing(db, { ...e, lines })
  const editable = e.status === 'draft' && can('Estimates.Create')
  const open = openApprovalFor(db, e)
  const canDecide = !!open && (open.roles.includes(db.role) || db.role === 'admin') && can('Estimates.Approve')
  const self = e.submittedBy === user.id
  const versions = db.estimates.filter((x) => x.requestId === e.requestId).sort((a, b) => b.version - a.version)
  const pastRounds = [...new Set(roundsOf(db, e.id).map((a) => a.round))].sort((a, b) => b - a).slice(1)
  const userName = (u?: string) => (u === 'system' ? 'النظام' : db.users.find((x) => x.id === u)?.name ?? '—')
  const audit = db.audit.filter((x) => x.entity === 'estimate' && versions.some((v) => v.id === x.entityId)).sort((a, b) => b.at.localeCompare(a.at))
  const wo = db.workOrders.find((w) => w.estimateId === e.id)
  const internal = isInternal(db, e)
  const item = (iid: string) => db.items.find((i) => i.id === iid)

  const setLine = (i: number, p: Partial<EstimateLine>) => setDraft(lines.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const addLine = (kind: LineKind) => setDraft([...lines, { id: uid('el'), kind, itemId: '', qty: 1, price: 0, discountPct: 0, coverage: 'paid' }])
  const persist = () => draft && run((d) => saveLines(d, e.id, draft), 'تم حفظ الأسطر') && setDraft(null)
  const doSubmit = () => {
    if (draft && !run((d) => saveLines(d, e.id, draft))) return
    setDraft(null)
    run((d) => submit(d, e.id), rt.required ? 'أُرسل التقدير للاعتماد' : 'اعتُمد التقدير تلقائيًا — تحت حد الاعتماد')
  }
  const doRevise = () => { const nid = uid('es'); if (run((d) => revise(d, e.id, nid), 'تم إنشاء نسخة جديدة')) nav(`/estimates/${nid}`) }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'التقديرات', to: '/estimates' }, { label: `${e.number} v${e.version}` }]}
        title={`تقدير ${e.number}`}
        badge={<>
          <Badge tone="gray">نسخة {e.version}</Badge>
          <Badge tone={estimateStatus[e.status].tone}>{estimateStatus[e.status].label}</Badge>
          {e.customerAcceptance && <Badge tone={e.customerAcceptance.decision === 'accepted' ? 'green' : 'red'}>{e.customerAcceptance.decision === 'accepted' ? 'وافق العميل' : 'رفض العميل'}</Badge>}
          {internal && <Badge tone="gray">صيانة داخلية</Badge>}
        </>}
        summary={{ label: 'على العميل', value: iqd(t.billable) }}
        actions={<>
          {editable && <button type="button" className="btn btn-primary" onClick={doSubmit}><Send className="h-4 w-4" />{rt.required ? 'إرسال للاعتماد' : 'اعتماد (تحت الحد)'}</button>}
          {canDecide && <>
            <button type="button" className="btn btn-primary" onClick={() => setDlg({ k: 'decide', approve: true, text: '' })}><CheckCircle2 className="h-4 w-4" />اعتماد</button>
            <button type="button" className="btn text-red-600" onClick={() => setDlg({ k: 'decide', approve: false, text: '' })}><XCircle className="h-4 w-4" />رفض</button>
          </>}
          {e.status === 'pendingApproval' && can('Estimates.Withdraw') && <button type="button" className="btn" onClick={() => setDlg({ k: 'withdraw', text: '' })}><Undo2 className="h-4 w-4" />سحب</button>}
          {e.status === 'approved' && !internal && !e.customerAcceptance && can('Estimates.CustomerAcceptance') && (
            <button type="button" className="btn btn-primary" onClick={() => setDlg({ k: 'accept', decision: 'accepted', channel: 'phone', note: '' })}><UserCheck className="h-4 w-4" />رد العميل</button>
          )}
          {canConvert(db, e) && can('WorkOrders.Create') && <button type="button" className="btn btn-primary" onClick={() => nav(`/work-orders/new?estimate=${e.id}`)}><Wrench className="h-4 w-4" />إنشاء أمر عمل</button>}
          {['approved', 'rejected', 'expired'].includes(e.status) && e.customerAcceptance?.decision !== 'accepted' && !wo && can('Estimates.Create') && (
            <button type="button" className="btn" onClick={doRevise}><Copy className="h-4 w-4" />مراجعة (نسخة جديدة)</button>
          )}
          <button type="button" className="btn" onClick={() => nav(`/estimates/${e.id}/print`)}><Printer className="h-4 w-4" />طباعة</button>
          {!['cancelled', 'superseded'].includes(e.status) && !wo && e.customerAcceptance?.decision !== 'accepted' && can('Estimates.Create') && (
            <button type="button" className="btn text-red-600" onClick={() => setDlg({ k: 'cancel', text: '' })}><Ban className="h-4 w-4" />إلغاء</button>
          )}
        </>}
      />

      {canDecide && self && <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">أنت من قدّم هذا التقدير — لا يمكنك اعتماده (فصل المهام). يعتمده زميل بنفس الدور.</div>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="الأصل والطلب" pad>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span><span className="text-gray-500">الأصل: </span><Link to={`/assets/${asset?.id}`} className="text-navy hover:underline">{asset?.name}</Link></span>
              {asset && <WarrantyBadge asset={asset} />}
              <span><span className="text-gray-500">العميل: </span>{partner?.name}</span>
              <span><span className="text-gray-500">الطلب: </span><Link to={`/requests/${req?.id}`} className="font-mono text-navy hover:underline" dir="ltr">{req?.number}</Link></span>
              <span><span className="text-gray-500">صالح حتى: </span>{fmtDate(e.validUntil)}</span>
              {wo && <span><span className="text-gray-500">أمر العمل: </span><Link to={`/work-orders/${wo.id}`} className="font-mono text-navy hover:underline" dir="ltr">{wo.number}</Link></span>}
            </div>
            {req && <p className="mt-2 text-sm text-gray-600">الشكوى: {req.complaint}</p>}
          </Card>

          <Card title="أسطر التقدير" pad={false} actions={editable && <>
            <button type="button" className="btn" onClick={() => addLine('part')}><Plus className="h-4 w-4" />قطعة</button>
            <button type="button" className="btn" onClick={() => addLine('labor')}><Plus className="h-4 w-4" />عمالة</button>
            <button type="button" className="btn" onClick={() => addLine('service')}><Plus className="h-4 w-4" />خدمة</button>
            {draft && <button type="button" className="btn btn-primary" onClick={persist}><Save className="h-4 w-4" />حفظ الأسطر</button>}
          </>}>
            {editable ? (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>النوع</th><th className="min-w-[220px]">المادة / الخدمة</th><th className="w-24">الكمية</th><th className="w-32">السعر</th><th className="w-20">خصم %</th><th className="w-28">التغطية</th><th className="!text-end">المجموع</th><th /></tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.id}>
                        <td>{lineKindLabel[l.kind]}</td>
                        <td><ItemSelect kind={l.kind === 'part' ? 'part' : 'service'} value={l.itemId} onChange={(itemId) => setLine(i, { itemId, price: item(itemId)?.price ?? 0 })} /></td>
                        <td><NumInput value={l.qty} onChange={(qty) => setLine(i, { qty })} /></td>
                        <td><NumInput value={l.price} onChange={(price) => setLine(i, { price })} /></td>
                        <td><NumInput value={l.discountPct} onChange={(discountPct) => setLine(i, { discountPct })} /></td>
                        <td><Select<Coverage> value={l.coverage} onChange={(coverage) => setLine(i, { coverage })} options={(Object.keys(coverageLabel) as Coverage[]).map((c) => ({ value: c, label: coverageLabel[c] }))} /></td>
                        <td className="num">{iqd(lineTotal(l))}</td>
                        <td><button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => setDraft(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lines.length === 0 && <EmptyBlock title="لا توجد أسطر" hint="أضف القطع والعمالة والخدمات المتوقعة." />}
              </div>
            ) : (
              <DataTable rows={lines} compact columns={[
                { key: 'k', label: 'النوع', render: (l) => lineKindLabel[l.kind] },
                { key: 'i', label: 'المادة / الخدمة', render: (l) => item(l.itemId)?.name ?? '—' },
                { key: 'q', label: 'الكمية', num: true, render: (l) => num(l.qty, l.qty % 1 ? 1 : 0) },
                { key: 'p', label: 'السعر', num: true, render: (l) => iqd(l.price) },
                { key: 'd', label: 'خصم', num: true, render: (l) => (l.discountPct ? `${l.discountPct}%` : '—') },
                { key: 'c', label: 'التغطية', render: (l) => <Badge tone={l.coverage === 'paid' ? 'gray' : l.coverage === 'warranty' ? 'blue' : 'amber'}>{coverageLabel[l.coverage]}</Badge> },
                { key: 't', label: 'المجموع', num: true, render: (l) => iqd(lineTotal(l)), total: (rs) => iqd(rs.reduce((s, l) => s + lineTotal(l), 0)) },
              ]} />
            )}
          </Card>

          <Card title="سجل التقدير (كل النسخ)">
            <Timeline items={audit.map((x) => ({ id: x.id, at: fmtDateTime(x.at), title: x.action, detail: x.detail, by: userName(x.userId) }))} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="الإجماليات">
            <dl className="space-y-1.5 text-sm">
              {[['القطع', t.parts], ['العمالة والخدمات', t.labor], ['الإجمالي قبل التغطية', t.gross], ['ضمن الضمان', t.warranty], ['حسن نية (مجاني)', t.goodwill]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><dt className="text-gray-500">{k}</dt><dd className="tabular-nums">{iqd(v as number)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line pt-1.5 font-bold text-navy"><dt>على العميل</dt><dd className="tabular-nums">{iqd(t.billable)}</dd></div>
            </dl>
          </Card>

          <Card title="الاعتماد الداخلي">
            {e.status === 'draft' ? (
              <div className="text-sm">
                <div className={`mb-2 font-semibold ${rt.required ? 'text-amber-700' : 'text-emerald-700'}`}>{rt.required ? `يحتاج اعتمادًا: ${rt.levels.map((l) => roleLabel[l[0]]).join(' ← ')}` : 'لا يحتاج اعتمادًا — يُعتمد تلقائيًا عند الإرسال'}</div>
                {rt.reasons.length > 0 && <ul className="list-disc space-y-1 ps-5 text-xs text-gray-600">{rt.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              </div>
            ) : (
              <StageTimeline stages={stagesOf(db, e)} />
            )}
            {pastRounds.length > 0 && <p className="mt-2 text-[11px] text-gray-500">جولات سابقة: {pastRounds.length} (في السجل)</p>}
          </Card>

          {!internal && (
            <Card title="موافقة العميل">
              {e.customerAcceptance ? (
                <div className="text-sm">
                  <Badge tone={e.customerAcceptance.decision === 'accepted' ? 'green' : 'red'}>{e.customerAcceptance.decision === 'accepted' ? 'وافق' : 'رفض'}</Badge>
                  <div className="mt-2 text-xs text-gray-600">{channelLabel[e.customerAcceptance.channel]} — {fmtDateTime(e.customerAcceptance.at)} — سجّلها {userName(e.customerAcceptance.by)}</div>
                  {e.customerAcceptance.note && <div className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs">{e.customerAcceptance.note}</div>}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{e.status === 'approved' ? 'بانتظار رد العميل قبل ' + fmtDate(e.validUntil) : 'تُسجَّل بعد الاعتماد الداخلي (منفصلة عنه).'}</p>
              )}
            </Card>
          )}

          <Card title="النسخ">
            <ul className="space-y-1.5 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between">
                  {v.id === e.id ? <span className="font-semibold">نسخة {v.version} (المعروضة)</span> : <Link to={`/estimates/${v.id}`} className="text-navy hover:underline">نسخة {v.version}</Link>}
                  <Badge tone={estimateStatus[v.status].tone}>{estimateStatus[v.status].label}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {dlg && (dlg.k === 'withdraw' || dlg.k === 'cancel') && (
        <Modal title={dlg.k === 'withdraw' ? 'سحب التقدير من الاعتماد' : 'إلغاء التقدير'} onClose={() => setDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
            <button type="button" className="btn btn-primary" onClick={() => run((d) => (dlg.k === 'withdraw' ? withdraw(d, e.id, dlg.text) : cancelEstimate(d, e.id, dlg.text)), dlg.k === 'withdraw' ? 'سُحب التقدير وعاد مسودة' : 'أُلغي التقدير') && setDlg(null)}>تأكيد</button></>}>
          <Field label="السبب" required><textarea className="inp min-h-[70px] py-2" value={dlg.text} onChange={(x) => setDlg({ ...dlg, text: x.target.value })} /></Field>
        </Modal>
      )}
      {dlg?.k === 'decide' && open && (
        <Modal title={dlg.approve ? `اعتماد المستوى ${open.level}` : 'رفض التقدير'} onClose={() => setDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
            <button type="button" className={`btn ${dlg.approve ? 'btn-primary' : 'border-red-600 bg-red-600 text-white'}`} onClick={() => run((d) => decide(d, open.id, dlg.approve, dlg.text), dlg.approve ? 'تم الاعتماد' : 'تم الرفض') && setDlg(null)}>{dlg.approve ? 'اعتماد' : 'رفض'}</button></>}>
          <p className="mb-2 text-sm text-gray-600">{e.number} v{e.version} — {iqd(t.gross)}</p>
          <Field label={dlg.approve ? 'ملاحظة (اختيارية)' : 'سبب الرفض'} required={!dlg.approve}><textarea className="inp min-h-[70px] py-2" value={dlg.text} onChange={(x) => setDlg({ ...dlg, text: x.target.value })} /></Field>
        </Modal>
      )}
      {dlg?.k === 'accept' && (
        <Modal title="رد العميل على التقدير" onClose={() => setDlg(null)}
          footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button>
            <button type="button" className="btn btn-primary" onClick={() => run((d) => recordAcceptance(d, e.id, dlg.decision, dlg.channel, dlg.note), 'تم تسجيل رد العميل') && setDlg(null)}>حفظ</button></>}>
          <FormGrid>
            <Field label="القرار" span={2}><Select value={dlg.decision} onChange={(decision) => setDlg({ ...dlg, decision: decision as 'accepted' | 'declined' })} options={[{ value: 'accepted', label: 'وافق' }, { value: 'declined', label: 'رفض' }]} /></Field>
            <Field label="القناة" span={3}><Select<AcceptanceChannel> value={dlg.channel} onChange={(channel) => setDlg({ ...dlg, channel })} options={(Object.keys(channelLabel) as AcceptanceChannel[]).map((c) => ({ value: c, label: channelLabel[c] }))} /></Field>
            <Field label={dlg.decision === 'declined' ? 'سبب الرفض' : 'ملاحظة'} required={dlg.decision === 'declined'} span={5}><textarea className="inp min-h-[60px] py-2" value={dlg.note} onChange={(x) => setDlg({ ...dlg, note: x.target.value })} /></Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
