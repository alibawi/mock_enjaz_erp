import { useMemo, useState } from 'react'
import { useSearchParams } from '../../router'
import { ConfidentialityBadge, ContractStatusBadge } from '../../components/contract'
import { FilterSelect } from '../../components/inputs'
import { ListView, type Column } from '../../components/ListView'
import { Tabs } from '../../components/ui'
import { directionShort, profileLabel, statusLabel, statusOrder } from '../../data/contractMeta'
import { daysTo, fmtDate, money } from '../../data/format'
import { canSee, noticeDeadline, partnerName, typeOf, userName } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import type { Contract, ContractStatus } from '../../data/types'
import { useApi } from '../../lib/useApi'

interface Row { id: string; c: Contract; type: string; party: string; owner: string; org: string; left?: number; notice?: string }

const tone = (n?: number) => (n === undefined ? 'text-gray-400' : n < 0 ? 'text-red-600' : n <= 15 ? 'text-red-600 font-semibold' : n <= 30 ? 'text-amber-600 font-semibold' : 'text-gray-600')

/** C1 — contracts list: status tabs with counts, filters, search, permission-gated export. */
export default function ContractsList() {
  const { db, can } = useStore()
  const [tab, setTab] = useState<ContractStatus | 'all'>('all')
  const [sp] = useSearchParams()
  const [f, setF] = useState({ type: '', dir: '', profile: '', org: '', owner: '', partner: sp.get('partner') ?? '', expiring: '' })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))

  const api = useApi(() => db.contracts.filter((c) => canSee(db, c)).map<Row>((c) => ({
    id: c.id, c, type: typeOf(db, c).name, party: partnerName(db, c), owner: userName(db, c.ownerUserId),
    org: db.organizations.find((o) => o.id === c.organizationId)?.name ?? '', left: c.endDate ? daysTo(c.endDate) : undefined, notice: noticeDeadline(c),
  })))
  const all = api.data ?? []

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: all.length }
    all.forEach((r) => { m[r.c.status] = (m[r.c.status] ?? 0) + 1 })
    return m
  }, [all])

  const rows = all.filter((r) =>
    (tab === 'all' || r.c.status === tab) && (!f.type || r.c.typeId === f.type) && (!f.dir || r.c.direction === f.dir) && (!f.profile || r.c.profile === f.profile) &&
    (!f.org || r.c.organizationId === f.org) && (!f.owner || r.c.ownerUserId === f.owner) && (!f.partner || r.c.counterpartyId === f.partner) &&
    (!f.expiring || (r.left !== undefined && r.left >= 0 && r.left <= Number(f.expiring) && ['Active', 'OnHold'].includes(r.c.status))))

  const cols: Column<Row>[] = [
    { key: 'number', label: 'الرقم', sort: (r) => r.c.number, render: (r) => <span className="font-medium text-navy" dir="ltr">{r.c.number}</span> },
    { key: 'title', label: 'العنوان', sort: (r) => r.c.title, render: (r) => <div className="max-w-[320px]"><div className="truncate font-medium text-gray-900">{r.c.title}</div><div className="mt-0.5 flex gap-1"><ConfidentialityBadge level={r.c.confidentiality} /></div></div> },
    { key: 'type', label: 'النوع', sort: (r) => r.type, render: (r) => <div><div>{r.type}</div><div className="text-[11px] text-gray-400">{profileLabel[r.c.profile]} · {directionShort[r.c.direction]}</div></div> },
    { key: 'status', label: 'الحالة', sort: (r) => statusOrder.indexOf(r.c.status), render: (r) => <ContractStatusBadge status={r.c.status} /> },
    { key: 'party', label: 'الطرف الآخر', sort: (r) => r.party, render: (r) => <span className="line-clamp-2 max-w-[200px]">{r.party}</span> },
    { key: 'owner', label: 'المسؤول', sort: (r) => r.owner, render: (r) => r.owner },
    { key: 'value', label: 'القيمة', num: true, sort: (r) => (r.c.currency === 'USD' ? (r.c.contractValue ?? 0) * 1310 : r.c.contractValue ?? 0), render: (r) => (r.c.contractValue ? money(r.c.contractValue, r.c.currency) : '—') },
    { key: 'start', label: 'البداية', sort: (r) => r.c.startDate, render: (r) => fmtDate(r.c.startDate) },
    { key: 'end', label: 'النهاية', sort: (r) => r.c.endDate ?? '9999', render: (r) => (r.c.endDate ? fmtDate(r.c.endDate) : 'مفتوح') },
    {
      key: 'left', label: 'المتبقي', sort: (r) => r.left ?? 99999,
      render: (r) => (['Active', 'OnHold'].includes(r.c.status) && r.left !== undefined ? <span className={tone(r.left)}>{r.left} يوم</span> : <span className="text-gray-300">—</span>),
    },
    { key: 'notice', label: 'مهلة الإشعار', sort: (r) => r.notice ?? '9999', render: (r) => (r.notice && r.c.renewalPolicy !== 'None' ? fmtDate(r.notice) : '—') },
    { key: 'org', label: 'المنشأة', render: (r) => <span className="text-xs text-gray-500">{r.org}</span> },
  ]

  const opt = <T extends { id: string }>(a: T[], l: (x: T) => string) => a.map((x) => ({ value: x.id, label: l(x) }))
  return (
    <ListView
      title="العقود" rows={rows} columns={cols} rowTo={(r) => `/contracts/${r.id}`} newTo="/contracts/new" newLabel="عقد جديد" canNew={can('Contracts.Create')} canExport={can('Contracts.Export')}
      loading={api.loading} error={api.error} onRetry={api.reload}
      searchText={(r) => `${r.c.number} ${r.c.title} ${r.party} ${r.type} ${r.owner}`}
      kpis={all.length ? [
        { label: 'إجمالي العقود', value: String(all.length) },
        { label: 'سارية', value: String(counts.Active ?? 0) },
        { label: 'بانتظار الاعتماد أو التوقيع', value: String((counts.PendingApproval ?? 0) + (counts.PendingSignature ?? 0)) },
        { label: 'تنتهي خلال 30 يوماً', value: String(all.filter((r) => ['Active', 'OnHold'].includes(r.c.status) && r.left !== undefined && r.left >= 0 && r.left <= 30).length) },
      ] : undefined}
      tabs={<Tabs active={tab} onChange={setTab} tabs={[{ id: 'all', label: 'الكل', count: counts.all }, ...statusOrder.map((s) => ({ id: s, label: statusLabel[s], count: counts[s] ?? 0 }))]} />}
      filters={<>
        <FilterSelect label="النوع" value={f.type} onChange={set('type')} options={opt(db.contractTypes, (t) => t.name)} />
        <FilterSelect label="الاتجاه" value={f.dir} onChange={set('dir')} options={[{ value: 'Outgoing', label: 'صادر' }, { value: 'Incoming', label: 'وارد' }, { value: 'Internal', label: 'داخلي' }]} />
        <FilterSelect label="النوع العام" value={f.profile} onChange={set('profile')} options={Object.entries(profileLabel).map(([value, label]) => ({ value, label }))} />
        <FilterSelect label="المنشأة" value={f.org} onChange={set('org')} options={opt(db.organizations, (o) => o.name)} />
        <FilterSelect label="المسؤول" value={f.owner} onChange={set('owner')} options={opt(db.users, (u) => u.name)} />
        <FilterSelect label="الطرف" value={f.partner} onChange={set('partner')} options={opt(db.partners, (p) => p.name)} />
        <FilterSelect label="ينتهي خلال" value={f.expiring} onChange={set('expiring')} allLabel="—" options={[{ value: '15', label: '15 يوماً' }, { value: '30', label: '30 يوماً' }, { value: '60', label: '60 يوماً' }, { value: '90', label: '90 يوماً' }]} />
      </>}
      emptyTitle="لا توجد عقود مطابقة" emptyHint="غيّر الفلاتر أو التبويب، أو أنشئ عقداً جديداً."
    />
  )
}
