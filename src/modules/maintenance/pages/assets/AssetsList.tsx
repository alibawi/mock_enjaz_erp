import { useState } from 'react'
import { ListView } from '../../components/ListView'
import { FilterSelect } from '../../components/inputs'
import { Tabs } from '../../components/ui'
import { lastReading, warrantyState } from '../../data/assets'
import { num } from '../../data/format'
import { useStore } from '../../data/store'
import type { Asset } from '../../data/types'
import { useApi } from '../../lib/useApi'
import { useSearchParams } from '../../router'
import { StateBadge, WarrantyBadge } from './shared'

type TabId = 'all' | 'customer' | 'company' | 'warranty' | 'expiring' | 'inactive'

export default function AssetsList() {
  const { db, can } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) ?? 'all'
  const [cat, setCat] = useState('')
  const [area, setArea] = useState('')
  const api = useApi(() => db.assets, [])

  const plate = (id: string) => db.vehicles.find((v) => v.assetId === id)?.plate
  const owner = (a: Asset) => db.partners.find((p) => p.id === a.ownerPartnerId)?.name ?? '—'
  const catName = (id: string) => db.categories.find((c) => c.id === id)?.name ?? '—'
  const match = (a: Asset, t: TabId) => {
    const w = warrantyState(a)
    switch (t) {
      case 'all': return true
      case 'customer': return a.ownerKind === 'customer'
      case 'company': return a.ownerKind === 'company'
      case 'warranty': return w === 'valid' || w === 'expiring'
      case 'expiring': return w === 'expiring'
      case 'inactive': return a.state !== 'active'
    }
  }
  const base = (api.data ?? []).filter((a) => (!cat || a.categoryId === cat) && (!area || a.area === area))
  const rows = base.filter((a) => match(a, tab))
  const count = (t: TabId) => base.filter((a) => match(a, t)).length
  const areas = [...new Set(db.assets.map((a) => a.area).filter(Boolean))] as string[]

  return (
    <ListView<Asset>
      title="بطاقات الأصول"
      rows={rows}
      loading={api.loading}
      error={api.error}
      onRetry={api.reload}
      newTo="/assets/new"
      newLabel="أصل جديد"
      canNew={can('Assets.Manage')}
      rowTo={(a) => `/assets/${a.id}`}
      searchText={(a) => `${a.code} ${a.name} ${a.serial ?? ''} ${plate(a.id) ?? ''} ${owner(a)} ${a.brand} ${a.model}`}
      kpis={[
        { label: 'إجمالي الأصول', value: num(db.assets.length) },
        { label: 'أصول العملاء', value: num(db.assets.filter((a) => a.ownerKind === 'customer').length) },
        { label: 'ضمانها ساري', value: num(db.assets.filter((a) => ['valid', 'expiring'].includes(warrantyState(a))).length) },
        { label: 'ضمان ينتهي خلال 60 يومًا', value: num(db.assets.filter((a) => warrantyState(a) === 'expiring').length) },
      ]}
      tabs={
        <Tabs<TabId> active={tab} onChange={(t) => setParams({ tab: t })} tabs={[
          { id: 'all', label: 'الكل', count: count('all') },
          { id: 'customer', label: 'أصول العملاء', count: count('customer') },
          { id: 'company', label: 'أصول الشركة', count: count('company') },
          { id: 'warranty', label: 'ضمان ساري', count: count('warranty') },
          { id: 'expiring', label: 'ضمان ينتهي قريبًا', count: count('expiring') },
          { id: 'inactive', label: 'معار / متقاعد', count: count('inactive') },
        ]} />
      }
      filters={
        <>
          <FilterSelect label="الفئة" value={cat} onChange={setCat} options={db.categories.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect label="المنطقة" value={area} onChange={setArea} options={areas.map((x) => ({ value: x, label: x }))} />
        </>
      }
      columns={[
        { key: 'code', label: 'الرمز', render: (a) => <span className="font-mono text-[12px]" dir="ltr">{a.code}</span>, sort: (a) => a.code },
        { key: 'name', label: 'الأصل', render: (a) => <span className="font-medium text-gray-900">{a.name}</span>, sort: (a) => a.name },
        { key: 'cat', label: 'الفئة', render: (a) => catName(a.categoryId), sort: (a) => catName(a.categoryId) },
        { key: 'owner', label: 'المالك', render: (a) => owner(a), sort: (a) => owner(a) },
        { key: 'id', label: 'اللوحة / الرقم التسلسلي', render: (a) => <span dir={plate(a.id) ? undefined : 'ltr'} className="text-[12px]">{plate(a.id) ?? a.serial ?? '—'}</span> },
        { key: 'area', label: 'المنطقة', render: (a) => a.area ?? '—', sort: (a) => a.area ?? '' },
        { key: 'w', label: 'الضمان', render: (a) => <WarrantyBadge asset={a} />, sort: (a) => a.warrantyEnd ?? '' },
        {
          key: 'meter', label: 'آخر عداد', num: true, render: (a) => {
            const r = lastReading(db, a.id)
            return r ? `${num(r.value)} ${r.unit === 'km' ? 'كم' : 'س'}` : '—'
          },
        },
        { key: 'state', label: 'الحالة', render: (a) => <StateBadge asset={a} /> },
      ]}
      emptyTitle="لا توجد أصول مطابقة"
    />
  )
}
