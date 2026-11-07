import { ChevronLeft, ClipboardList, FileSignature, Menu, Wrench, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { assetNav } from '../modules/assets/components/Layout'
import { ASSETS_BASE } from '../modules/assets/router'
import { featureOn } from '../modules/contracts/data/admin'
import { useStore as useContractsStore } from '../modules/contracts/data/store'
import { contractNav } from '../modules/contracts/lib/navigation'
import { CONTRACTS_BASE } from '../modules/contracts/router'
import { maintenanceNav } from '../modules/maintenance/components/Layout'
import { useStore as useMaintenanceStore } from '../modules/maintenance/data/store'
import { MAINTENANCE_BASE } from '../modules/maintenance/router'

interface NavEntry { to: string; label: string; icon: LucideIcon; section?: string; soon?: boolean; sub?: boolean }

const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-gray-700 hover:bg-gray-100'

function ModuleGroup({ base, title, icon: Icon, entries, endPaths, collapsed }: {
  base: string; title: string; icon: LucideIcon; entries: NavEntry[]; endPaths: string[]; collapsed: boolean
}) {
  const loc = useLocation()
  const active = loc.pathname === base || loc.pathname.startsWith(`${base}/`)
  const [manual, setManual] = useState<boolean | null>(null)
  const open = manual ?? active
  const full = (to: string) => base + (to === '/' ? '' : to)

  return (
    <div className={`rounded-md ${active ? 'bg-navy-50' : ''}`}>
      <button type="button" onClick={() => setManual(!open)} className={`${item} font-semibold text-navy ${active ? 'hover:bg-navy-50' : ''}`} title={title}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <><span className="flex-1 text-start">{title}</span><ChevronLeft className={`h-3.5 w-3.5 transition ${open ? '-rotate-90' : ''}`} /></>}
      </button>
      {open && (
        <div className="space-y-0.5 pb-1.5">
          {entries.map(({ to, label, icon: EntryIcon, section, soon, sub }) => {
            if (sub) {
              if (collapsed) return null
              const [path, query = ''] = full(to).split('?')
              const wanted = new URLSearchParams(query).get('r')
              const current = loc.pathname === path && (new URLSearchParams(loc.search).get('r') ?? 'register') === wanted
              return (
                <Link key={to} to={full(to)} className={`flex items-center gap-1 rounded-md py-1 pe-2 ps-12 text-[12px] ${current ? 'font-semibold text-navy' : 'text-gray-500 hover:text-navy'}`}>
                  <EntryIcon className="h-3 w-3 shrink-0" />{label}
                </Link>
              )
            }
            return (
              <div key={to}>
                {section && !collapsed && <div className="pe-2 ps-7 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{section}</div>}
                {soon ? (
                  <div title={`${label} — قريباً`} className={`flex items-center gap-2 rounded-md py-1.5 text-[13px] text-gray-400 ${collapsed ? 'justify-center px-2' : 'pe-2 ps-7'}`}>
                    <EntryIcon className="h-4 w-4 shrink-0" />
                    {!collapsed && <><span className="flex-1">{label}</span><span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-400">قريباً</span></>}
                  </div>
                ) : (
                  <NavLink to={full(to)} end={endPaths.includes(to)} title={label}
                    className={({ isActive }) => `flex items-center gap-2 rounded-md py-1.5 text-[13px] ${collapsed ? 'justify-center px-2' : 'pe-2 ps-7'} ${isActive ? 'bg-white font-semibold text-navy shadow-sm' : 'text-gray-600 hover:text-navy'}`}>
                    <EntryIcon className="h-4 w-4 shrink-0" />
                    {!collapsed && label}
                  </NavLink>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { can, db } = useContractsStore()
  const { can: canMaint } = useMaintenanceStore()
  const maintenanceEntries = maintenanceNav.filter((n) => !n.perm || canMaint(n.perm))
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900)
  const contractEntries = contractNav.filter((n) => (n.module !== 'analytics' || can('Reports.View')) && (!n.feature || featureOn(db, n.feature)) && (n.module !== 'settings-access' || n.to === '/settings/approval-stages' || can('Settings.Manage')))

  return (
    <aside className={`flex shrink-0 flex-col border-s border-line bg-white transition-all ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
      <div className="flex h-14 items-center justify-between border-b border-line px-3">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-navy to-sky-700 text-xs font-bold text-white ring-2 ring-navy/10">E</div>
            <span className="text-base font-bold tracking-wide text-navy" dir="ltr">ENKI ERP</span>
          </Link>
        )}
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Menu className="h-5 w-5" /></button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <ModuleGroup base={ASSETS_BASE} title="الموجودات الثابتة" icon={ClipboardList} entries={assetNav} endPaths={['/']} collapsed={collapsed} />
        <ModuleGroup base={CONTRACTS_BASE} title="إدارة العقود" icon={FileSignature} entries={contractEntries} endPaths={['/', '/reports', '/service', '/agreements']} collapsed={collapsed} />
        <ModuleGroup base={MAINTENANCE_BASE} title="إدارة الصيانة" icon={Wrench} entries={maintenanceEntries} endPaths={['/', '/schedule', '/billing']} collapsed={collapsed} />

      </nav>

    </aside>
  )
}
