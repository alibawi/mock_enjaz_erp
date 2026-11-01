import { GitCompareArrows, Plus, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '../../router'
import { DataTable, type Column } from '../../components/DataTable'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Badge, Card, Modal, Select } from '../../components/ui'
import { amendTypeLabel, amendmentsOf, canAmendStatus, diffPayloads, hashOf, hashValid, openAmendment, versionsOf, type DiffRow } from '../../data/amendments'
import { fmtDateTime } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { Contract, ContractAmendment, ContractVersion } from '../../data/types'
import { AmendStatusBadge } from './shared'

const reasonLabel = { Activation: 'تفعيل العقد', Amendment: 'ملحق', Renewal: 'تجديد' } as const

/** M1 — amendments tab of the contract card. */
export function AmendmentsTab({ c }: { c: Contract }) {
  const { db, can } = useStore()
  const nav = useNavigate()
  const rows = amendmentsOf(db, c.id)
  const open = openAmendment(db, c.id)
  const blocked = canAmendStatus(db, c)
  const cols: Column<ContractAmendment>[] = [
    { key: 'no', label: 'الرقم', render: (a) => <Link className="font-medium text-navy" to={`/contracts/${c.id}/amendments/${a.id}`}>ملحق {a.amendmentNo}</Link> },
    { key: 'type', label: 'النوع', render: (a) => amendTypeLabel[a.type] },
    { key: 'reason', label: 'السبب', render: (a) => <span className="line-clamp-2 max-w-[320px]">{a.reason}</span> },
    { key: 'eff', label: 'تاريخ السريان', render: (a) => a.effectiveDate },
    { key: 'st', label: 'الحالة', render: (a) => <AmendStatusBadge status={a.status} /> },
    { key: 'ver', label: 'الإصدار الناتج', render: (a) => (a.appliedVersionNo ? `v${a.appliedVersionNo}` : '—') },
    { key: 'by', label: 'أنشأه', render: (a) => userName(db, a.createdBy) },
  ]
  return (
    <Card title="الملاحق" pad={false} actions={can('Contracts.Amend') && <button type="button" className="btn btn-primary" disabled={!!open || !!blocked} title={open ? `يوجد ملحق مفتوح (رقم ${open.amendmentNo})` : blocked ?? undefined} onClick={() => nav(`/contracts/${c.id}/amend`)}><Plus className="h-4 w-4" />ملحق جديد</button>}>
      {open && <div className="border-b border-line bg-amber-50 px-4 py-2 text-xs text-amber-800">يوجد ملحق مفتوح: <Link className="underline" to={`/contracts/${c.id}/amendments/${open.id}`}>ملحق {open.amendmentNo}</Link> ({amendTypeLabel[open.type]}) — لا يُنشأ ملحق آخر قبل إنهائه.</div>}
      <DataTable rows={rows} columns={cols} emptyTitle="لا ملاحق" emptyHint={blocked ?? 'تعديل العقد السائر يتم بملحق يُعتمد ثم يُطبَّق بتاريخ سريان.'} />
    </Card>
  )
}

/** M4 — versions tab: write-once snapshots with a short hash recomputed on view (BR-M-10). */
export function VersionsTab({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const nav = useNavigate()
  const [view, setView] = useState<ContractVersion | null>(null)
  const rows = versionsOf(db, c.id)
  const cols: Column<ContractVersion>[] = [
    { key: 'v', label: 'الإصدار', render: (v) => <span className="font-semibold">v{v.versionNo}{v.versionNo === c.versionNo && <Badge tone="green">الحالي</Badge>}</span> },
    { key: 'r', label: 'السبب', render: (v) => { const a = db.amendments.find((x) => x.id === v.amendmentId); return <div>{reasonLabel[v.reason]}{a && <Link className="ms-1 text-navy underline" to={`/contracts/${c.id}/amendments/${a.id}`}>ملحق {a.amendmentNo}</Link>}</div> } },
    { key: 'h', label: 'البصمة', render: (v) => (hashValid(v) ? <span className="inline-flex items-center gap-1 text-emerald-700" dir="ltr"><ShieldCheck className="h-4 w-4" />{v.payloadHash}</span> : <span className="inline-flex items-center gap-1 font-semibold text-red-600" dir="ltr"><ShieldAlert className="h-4 w-4" />{v.payloadHash} — لا تطابق</span>) },
    { key: 'd', label: 'التاريخ', render: (v) => fmtDateTime(v.createdOn) },
    { key: 'u', label: 'بواسطة', render: (v) => userName(db, v.createdBy) },
    { key: 'x', label: '', render: (v) => (
      <div className="flex gap-1.5">
        <button type="button" className="btn" onClick={() => setView(v)}>عرض</button>
        {v.versionNo > 1 && <button type="button" className="btn" onClick={() => nav(`/contracts/${c.id}/versions/compare?from=${v.versionNo - 1}&to=${v.versionNo}`)}><GitCompareArrows className="h-4 w-4" />مقارنة بالسابق</button>}
        {can('Settings.Manage') && <button type="button" className="btn" title="اختبار للعرض: يغيّر محتوى الإصدار دون تحديث البصمة" onClick={() => run((d) => { const x = d.versions.find((y) => y.id === v.id)!; x.payload.header.contractValue = Number(x.payload.header.contractValue ?? 0) + 1 }, 'عُدّل محتوى الإصدار (اختبار عبث)')}>اختبار عبث</button>}
      </div>) },
  ]
  return (
    <Card title="إصدارات العقد" pad={false} actions={rows.length > 1 && <Link className="btn" to={`/contracts/${c.id}/versions/compare?from=${rows[rows.length - 1].versionNo}&to=${rows[0].versionNo}`}><GitCompareArrows className="h-4 w-4" />مقارنة الأول بالأحدث</Link>}>
      <DataTable rows={rows} columns={cols} emptyTitle="لا إصدارات" emptyHint="يُنشأ الإصدار الأول عند تفعيل العقد، وكل ملحق مُطبَّق يضيف إصداراً لا يُعدَّل." />
      <p className="border-t border-line px-4 py-2 text-[11px] text-gray-400">الإصدارات للقراءة فقط. البصمة تُعاد حسابها عند كل عرض؛ أي اختلاف يُنبَّه إليه.</p>
      {view && <VersionView v={view} onClose={() => setView(null)} />}
    </Card>
  )
}

function VersionView({ v, onClose }: { v: ContractVersion; onClose: () => void }) {
  const { db } = useStore()
  const p = v.payload
  const ok = hashOf(p) === v.payloadHash
  return (
    <Modal wide title={`الإصدار v${v.versionNo} (للقراءة فقط)`} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>إغلاق</button>}>
      <div className="space-y-3 text-sm">
        <div className={`rounded px-3 py-2 text-xs ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} dir="ltr">{ok ? `hash ${v.payloadHash} ✔` : `hash mismatch: stored ${v.payloadHash} / computed ${hashOf(p)}`}</div>
        <section><h4 className="mb-1 font-semibold">الرأس</h4><div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">{Object.entries(p.header).map(([k, x]) => <div key={k}><span className="text-gray-500">{k}: </span><span dir="auto">{String(x ?? '—')}</span></div>)}</div></section>
        <section><h4 className="mb-1 font-semibold">الشروط</h4><div className="space-y-1 text-xs">{Object.entries(p.terms).map(([k, x]) => <div key={k}><span className="text-gray-500">{k === 'paymentTermId' ? 'شرط الدفع' : k}: </span>{k === 'paymentTermId' ? db.paymentTerms.find((t) => t.id === x)?.name ?? String(x ?? '—') : String(x ?? '—')}</div>)}</div></section>
        <section><h4 className="mb-1 font-semibold">البنود ({p.lines.length})</h4><ul className="space-y-0.5 text-xs">{p.lines.map((l) => <li key={l.lineNum}>{l.lineNum}. {l.description} — {l.commitmentType === 'Quantity' ? `${l.agreedQuantity} × ${l.unitPrice}` : l.agreedValue} <span className="text-gray-400">({l.status === 'Open' ? 'مفتوح' : 'مغلق'})</span></li>)}</ul></section>
        <section><h4 className="mb-1 font-semibold">الأطراف ({p.parties.length}) والتواقيع ({p.signatures.length})</h4><ul className="space-y-0.5 text-xs">{p.parties.map((x) => <li key={x.id}>{x.name} — {x.contactName}</li>)}</ul></section>
      </div>
    </Modal>
  )
}

const groups: { id: DiffRow['group']; label: string }[] = [{ id: 'header', label: 'الرأس' }, { id: 'lines', label: 'البنود' }, { id: 'terms', label: 'الشروط' }, { id: 'parties', label: 'الأطراف' }]

/** M5 — two-column comparison of any two versions, grouped by header / lines / terms / parties. */
export function VersionCompare() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const { db } = useStore()
  const c = db.contracts.find((x) => x.id === id)
  if (!c) return <EmptyBlock title="العقد غير موجود" />
  const vs = versionsOf(db, c.id).slice().reverse()
  if (vs.length < 2) return <div><PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number, to: `/contracts/${c.id}` }, { label: 'مقارنة الإصدارات' }]} title="مقارنة الإصدارات" /><EmptyBlock title="لا يوجد إصدار ثانٍ للمقارنة" hint="تظهر المقارنة بعد تطبيق ملحق واحد على الأقل." /></div>
  const fromNo = Number(sp.get('from')) || vs[0].versionNo, toNo = Number(sp.get('to')) || vs[vs.length - 1].versionNo
  const a = vs.find((v) => v.versionNo === fromNo) ?? vs[0], b = vs.find((v) => v.versionNo === toNo) ?? vs[vs.length - 1]
  const rows = diffPayloads(db, a.payload, b.payload)
  const opts = vs.map((v) => ({ value: String(v.versionNo), label: `v${v.versionNo} — ${reasonLabel[v.reason]}` }))
  const bad = [a, b].filter((v) => !hashValid(v))
  return (
    <div>
      <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number, to: `/contracts/${c.id}` }, { label: 'مقارنة الإصدارات' }]} title={`مقارنة الإصدارات — ${c.number}`} />
      <Card className="mb-4">
        <div className="grid items-end gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">من إصدار<Select value={String(a.versionNo)} onChange={(v) => setSp({ from: v, to: String(b.versionNo) })} options={opts} /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">إلى إصدار<Select value={String(b.versionNo)} onChange={(v) => setSp({ from: String(a.versionNo), to: v })} options={opts} /></label>
          <div className="text-xs text-gray-500 md:col-span-2">{rows.length} فرق — <span dir="ltr">{a.payloadHash}</span> ← <span dir="ltr">{b.payloadHash}</span></div>
        </div>
      </Card>
      {bad.length > 0 && <div className="mb-3 flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"><ShieldAlert className="h-4 w-4" />تنبيه: بصمة الإصدار {bad.map((v) => `v${v.versionNo}`).join(' و')} لا تطابق محتواه — احتمال عبث.</div>}
      <div className="space-y-4">
        {groups.map((g) => {
          const list = rows.filter((r) => r.group === g.id)
          return (
            <Card key={g.id} title={`${g.label} (${list.length})`} pad={false}>
              {list.length === 0 ? <div className="px-4 py-4 text-sm text-gray-400">لا فروق</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">الحقل</th><th className="text-start">v{a.versionNo}</th><th className="text-start">v{b.versionNo}</th></tr></thead>
                  <tbody>{list.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium">{r.label}{r.kind === 'added' && <Badge tone="green">جديد</Badge>}{r.kind === 'removed' && <Badge tone="red">محذوف</Badge>}</td>
                      <td className="bg-red-50/40 text-red-700">{r.from ?? '—'}</td><td className="bg-emerald-50/40 font-semibold text-emerald-700">{r.to ?? '—'}</td>
                    </tr>))}</tbody>
                </table>)}
            </Card>)
        })}
      </div>
    </div>
  )
}
