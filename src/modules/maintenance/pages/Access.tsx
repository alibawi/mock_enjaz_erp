import { RotateCcw, UserCheck } from 'lucide-react'
import { Fragment } from 'react'
import { PageHeader } from '../components/Layout'
import { Badge, Card } from '../components/ui'
import { allPerms, roleLabel } from '../data/permissions'
import { resetRolePerms, setRolePerm } from '../data/settings'
import { useStore } from '../data/store'
import type { RoleId } from '../data/types'

const ROLES = Object.keys(roleLabel) as RoleId[]

/** Permissions matrix (S21): role × action from spec §5. Toggles apply to the whole mock immediately (sidebar, buttons, guards). */
export default function Access() {
  const { db, run, can, setUser } = useStore()
  const edit = can('Settings.Manage')
  const groups = [...new Set(allPerms.map((p) => p.group))]
  const usersOf = (r: RoleId) => db.users.filter((u) => u.role === r)

  return (
    <div>
      <PageHeader crumbs={[{ label: 'مصفوفة الصلاحيات' }]} title="مصفوفة الصلاحيات (الدور × الإجراء)"
        actions={edit && <button type="button" className="btn" onClick={() => run((d) => resetRolePerms(d), 'استُعيدت الصلاحيات الافتراضية')}><RotateCcw className="h-4 w-4" />استعادة الافتراضي</button>} />
      <p className="mb-3 text-sm text-gray-600">
        المصفوفة من المواصفات §5. {edit ? 'أي تغيير يسري فورًا على القائمة والأزرار في كل الشاشات (للعرض فقط — في النظام الحقيقي تُدار من إدارة الأدوار).' : 'للعرض فقط — التعديل لمدير الورشة أو مسؤول النظام.'}
        {' '}مسؤول النظام يملك كل الصلاحيات دائمًا.
      </p>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[980px]">
            <thead>
              <tr>
                <th className="min-w-[220px]">الإجراء</th>
                {ROLES.map((r) => (
                  <th key={r} className="!text-center">
                    <div className={r === db.role ? 'text-navy' : ''}>{roleLabel[r]}</div>
                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                      {usersOf(r).map((u) => (
                        <button key={u.id} type="button" title={`تبديل إلى ${u.name}`} onClick={() => setUser(u.id)}
                          className={`rounded px-1 text-[10px] font-normal ${u.id === db.userId ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}><UserCheck className="inline h-3 w-3" /> {u.name.split(' ')[0]}</button>
                      ))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr><td colSpan={ROLES.length + 1} className="bg-gray-50 text-[11px] font-semibold text-gray-500">{g}</td></tr>
                  {allPerms.filter((p) => p.group === g).map((p) => (
                    <tr key={p.code}>
                      <td><div>{p.label}</div><div className="font-mono text-[10px] text-gray-400" dir="ltr">{p.code}</div></td>
                      {ROLES.map((r) => {
                        const on = db.rolePerms[r]?.includes(p.code) ?? false
                        return (
                          <td key={r} className="!text-center">
                            <input type="checkbox" aria-label={`${roleLabel[r]} — ${p.label}`} checked={on} disabled={!edit || r === 'admin'}
                              onChange={(e) => run((d) => setRolePerm(d, r, p.code, e.target.checked), `${e.target.checked ? 'مُنحت' : 'سُحبت'}: ${roleLabel[r]} — ${p.label}`)} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr>
                <td className="text-[12px] text-gray-500">عدد الصلاحيات</td>
                {ROLES.map((r) => <td key={r} className="!text-center"><Badge tone={r === db.role ? 'blue' : 'gray'}>{db.rolePerms[r]?.length ?? 0}</Badge></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-gray-500">قواعد لا تتغير بالمصفوفة: لا يعتمد المستخدم تقديرًا قدّمه هو (فصل المهام)، ويعتمد كل مستوى الدورُ المحدد له في شرائح الاعتماد.</p>
    </div>
  )
}
