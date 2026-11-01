import { Lock, RotateCcw } from 'lucide-react'
import { Fragment } from 'react'
import { PageHeader } from '../../components/Layout'
import { Card } from '../../components/ui'
import { resetMatrix, setRolePerm } from '../../data/admin'
import { allPerms, roleLabel } from '../../data/permissions'
import { useStore } from '../../data/store'
import type { RoleId } from '../../data/types'
import { NoAccess } from './Settings'

/** X2 — role × permission matrix. Toggles persist and drive the role switcher: menus and buttons read the same matrix (BR-X-02). */
export default function Matrix() {
  const { db, run, can } = useStore()
  const roles = Object.keys(roleLabel) as RoleId[]
  const groups = [...new Set(allPerms.map((p) => p.group))]
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }, { label: 'الصلاحيات' }]} title="مصفوفة الصلاحيات" /><NoAccess /></div>
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'الصلاحيات' }]} title="مصفوفة الصلاحيات"
        actions={<button type="button" className="btn" onClick={() => run((d) => resetMatrix(d), 'أُعيدت المصفوفة إلى الافتراضي')}><RotateCcw className="h-4 w-4" />افتراضي</button>} />
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">بدّل الدور من الشريط العلوي لترى أثر التغيير فوراً على القوائم والأزرار. صلاحيات مسؤول النظام ثابتة.</div>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-50 text-xs text-gray-600">
                <th className="sticky start-0 bg-gray-50 px-3 py-2 text-start">الصلاحية</th>
                {roles.map((r) => <th key={r} className="px-2 py-2 text-center font-medium">{roleLabel[r]}{r === 'admin' && <Lock className="mx-auto mt-0.5 h-3 w-3 text-gray-400" />}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="bg-gray-100/70"><td colSpan={roles.length + 1} className="px-3 py-1 text-xs font-semibold text-gray-600">{g}</td></tr>
                  {allPerms.filter((p) => p.group === g).map((p) => (
                    <tr key={p.code} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="sticky start-0 bg-white px-3 py-1.5"><div>{p.label}</div><div className="text-[10px] text-gray-400" dir="ltr">{p.code}</div></td>
                      {roles.map((r) => (
                        <td key={r} className="text-center">
                          <input type="checkbox" disabled={r === 'admin'} checked={db.rolePerms[r].includes(p.code)} onChange={(e) => run((d) => setRolePerm(d, r, p.code, e.target.checked))} />
                        </td>))}
                    </tr>))}
                </Fragment>))}
            </tbody>
            <tfoot><tr className="border-t border-line bg-gray-50 text-xs"><td className="px-3 py-2 font-semibold">المجموع</td>{roles.map((r) => <td key={r} className="text-center font-semibold tabular-nums">{db.rolePerms[r].length}</td>)}</tr></tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
