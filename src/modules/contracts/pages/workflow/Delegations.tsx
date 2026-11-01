import { useState } from 'react'
import { type Column } from '../../components/DataTable'
import { DateInput, SearchableSelect, UserSelect } from '../../components/inputs'
import { ListView } from '../../components/ListView'
import { Badge, Field, FormGrid, Modal, Select } from '../../components/ui'
import { fmtDate, uid } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { can as canRole } from '../../data/permissions'
import { addAudit, useStore } from '../../data/store'
import type { ApprovalDelegation } from '../../data/types'
import { useApi } from '../../lib/useApi'

const scopeLabel = { All: 'كل العقود', ContractType: 'نوع عقد', Organization: 'منشأة' } as const
type Row = ApprovalDelegation & { state: 'نشط' | 'منتهي' | 'قادم' | 'ملغى' }

/** W3 — delegations (BR-W-06): a delegate becomes an eligible approver for the delegator's stages in scope and dates. */
export default function Delegations() {
  const { db, run, can, user } = useStore()
  const [dlg, setDlg] = useState(false)
  const api = useApi(() => db.delegations.map<Row>((x) => ({ ...x, state: !x.isActive ? 'ملغى' : x.toDate < db.asOf ? 'منتهي' : x.fromDate > db.asOf ? 'قادم' : 'نشط' })))
  const mine = (x: ApprovalDelegation) => x.fromUserId === user.id || db.role === 'admin'
  const tone = { نشط: 'green', منتهي: 'gray', قادم: 'blue', ملغى: 'red' } as const
  const cols: Column<Row>[] = [
    { key: 'from', label: 'المفوِّض', sort: (r) => userName(db, r.fromUserId), render: (r) => userName(db, r.fromUserId) },
    { key: 'to', label: 'المفوَّض إليه', render: (r) => <span className="font-medium">{userName(db, r.toUserId)}</span> },
    { key: 'period', label: 'الفترة', sort: (r) => r.fromDate, render: (r) => `${fmtDate(r.fromDate)} ← ${fmtDate(r.toDate)}` },
    { key: 'scope', label: 'النطاق', render: (r) => `${scopeLabel[r.scopeType]}${r.scopeId ? ` — ${r.scopeType === 'ContractType' ? db.contractTypes.find((t) => t.id === r.scopeId)?.name : db.organizations.find((o) => o.id === r.scopeId)?.name}` : ''}` },
    { key: 'reason', label: 'السبب', render: (r) => r.reason },
    { key: 'state', label: 'الحالة', render: (r) => <Badge tone={tone[r.state]}>{r.state}</Badge> },
    { key: 'x', label: '', render: (r) => (r.isActive && can('ApprovalDelegations.Manage') && mine(r) ? <button type="button" className="btn btn-danger" onClick={(e) => { e.stopPropagation(); run((d) => { const x = d.delegations.find((y) => y.id === r.id)!; x.isActive = false; addAudit(d, 'delegation', r.id, 'revoke', `${userName(d, x.fromUserId)} ← ${userName(d, x.toUserId)}`) }, 'أُلغي التفويض') }}>إلغاء</button> : null) },
  ]
  return (
    <>
      <ListView title="تفويض الاعتماد" crumbs={[{ label: 'تفويض الاعتماد' }]} rows={api.data ?? []} columns={cols} loading={api.loading} error={api.error} onRetry={api.reload}
        searchText={(r) => `${userName(db, r.fromUserId)} ${userName(db, r.toUserId)} ${r.reason}`} canNew={can('ApprovalDelegations.Manage')} onNew={() => setDlg(true)} newLabel="تفويض جديد" canExport={false}
        emptyTitle="لا تفويضات" />
      {dlg && <DelegationDialog onClose={() => setDlg(false)} />}
    </>
  )
}

function DelegationDialog({ onClose }: { onClose: () => void }) {
  const { db, run, user } = useStore()
  const admin = db.role === 'admin'
  const [from, setFrom] = useState(user.id)
  const [to, setTo] = useState('')
  const [fromDate, setFromDate] = useState(db.asOf)
  const [toDate, setToDate] = useState(db.asOf)
  const [scopeType, setScopeType] = useState<ApprovalDelegation['scopeType']>('All')
  const [scopeId, setScopeId] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const delegate = db.users.find((u) => u.id === to)
  const save = () => {
    if (!to) return setErr('اختر المفوَّض إليه')
    if (to === from) return setErr('لا يمكن التفويض للنفس')
    if (toDate < fromDate) return setErr('تاريخ النهاية قبل البداية')
    if (!delegate || !canRole(db.rolePerms, delegate.role, 'Contracts.Approve')) return setErr('المفوَّض إليه لا يملك صلاحية «اعتماد»')
    if (scopeType !== 'All' && !scopeId) return setErr('حدّد النطاق')
    run((d) => { const id = uid('dlg'); d.delegations.push({ id, fromUserId: from, toUserId: to, fromDate, toDate, scopeType, scopeId: scopeType === 'All' ? undefined : scopeId, reason: reason.trim() || '—', isActive: true }); addAudit(d, 'delegation', id, 'create', `${userName(d, from)} → ${userName(d, to)}`) }, 'أُنشئ التفويض')
    onClose()
  }
  return (
    <Modal wide title="تفويض جديد" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={save}>حفظ</button></>}>
      <FormGrid>
        <Field label="المفوِّض" span={2}>{admin ? <UserSelect value={from} onChange={(v) => setFrom(v || user.id)} /> : <div className="inp-ro">{user.name}</div>}</Field>
        <Field label="المفوَّض إليه" required span={2}><UserSelect value={to} onChange={setTo} /></Field>
        <Field label="من تاريخ"><DateInput value={fromDate} onChange={setFromDate} /></Field>
        <Field label="إلى تاريخ"><DateInput value={toDate} onChange={setToDate} /></Field>
        <Field label="النطاق"><Select value={scopeType} onChange={(v: ApprovalDelegation['scopeType']) => { setScopeType(v); setScopeId('') }} options={(Object.keys(scopeLabel) as (keyof typeof scopeLabel)[]).map((k) => ({ value: k, label: scopeLabel[k] }))} /></Field>
        {scopeType !== 'All' && <Field label={scopeType === 'ContractType' ? 'النوع' : 'المنشأة'} span={2}>
          <SearchableSelect value={scopeId} onChange={setScopeId} options={scopeType === 'ContractType' ? db.contractTypes.map((t) => ({ value: t.id, label: t.name })) : db.organizations.map((o) => ({ value: o.id, label: o.name }))} /></Field>}
        <Field label="السبب" span={5}><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="إجازة، مهمة رسمية..." /></Field>
      </FormGrid>
      {err && <div className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
    </Modal>
  )
}
