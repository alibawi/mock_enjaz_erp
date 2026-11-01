import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from '../../router'
import { KPICard } from '../../components/display'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Badge, Card, Select } from '../../components/ui'
import { changeSetting, resetSettings, settingsAudit } from '../../data/admin'
import { fmtDateTime } from '../../data/format'
import { userName } from '../../data/lifecycle'
import { allPerms, roleLabel } from '../../data/permissions'
import { defaultSettings, getSetting, settingDefs, type SettingDef } from '../../data/settings'
import { useStore } from '../../data/store'
import type { RoleId, SettingValue } from '../../data/types'

export function NoAccess() { return <EmptyBlock title="لا تملك صلاحية «إدارة الإعدادات»" hint="هذه الشاشة لمسؤول النظام فقط؛ بدّل الدور من الشريط العلوي." /> }

/** X1 — system settings grouped by area, each with its effect, default marker and reset; plus the module KPIs. */
export default function Settings() {
  const { db, run, can } = useStore()
  const defaults = defaultSettings()
  const groups = [...new Set(settingDefs.map((d) => d.group))]
  const last = settingsAudit(db)[0]
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }]} title="إعدادات النظام" /><NoAccess /></div>
  const apply = (key: SettingDef['key'], v: SettingValue) => run((d) => changeSetting(d, key, v), 'حُفظ الإعداد — يسري على الإجراءات اللاحقة')
  const roles = Object.keys(roleLabel) as RoleId[]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات' }]} title="إعدادات النظام"
        actions={<><button type="button" className="btn" disabled title="يُفتح مصمم Elsa من النظام الحقيقي" >فتح مصمم سير العمل</button>
          <button type="button" className="btn" onClick={() => run((d) => { const n = resetSettings(d); if (!n) return 'الإعدادات على قيمها الافتراضية أصلاً' }, 'أُعيدت كل الإعدادات إلى الافتراضي')}><RotateCcw className="h-4 w-4" />إعادة الكل إلى الافتراضي</button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="الأدوار" value={roles.length} to="/settings/permissions" />
        <KPICard label="الإعدادات المعدّلة عن الافتراضي" value={settingDefs.filter((d) => getSetting(db, d.key) !== defaults[d.key]).length} tone="blue" hint={`من ${settingDefs.length}`} />
        <KPICard label="آخر تغيير في الإعدادات" value={last ? fmtDateTime(last.at) : '—'} hint={last ? `${userName(db, last.userId)} — ${last.entityId}` : undefined} to="/settings/audit" />
        <KPICard label="الصلاحيات الممنوحة (متوسط/دور)" value={Math.round(roles.reduce((s, r) => s + db.rolePerms[r].length, 0) / roles.length)} hint={`من ${allPerms.length}`} to="/settings/permissions" />
      </div>
      <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">تغيير الإعداد يسري على الإجراءات اللاحقة فقط؛ القيود والمستندات المسجّلة لا يُعاد احتسابها. كل تغيير يُسجَّل في <Link className="underline" to="/settings/audit">سجل التدقيق</Link>.</div>
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g} title={g} actions={<button type="button" className="btn" onClick={() => run((d) => { const n = resetSettings(d, g); if (!n) return 'لا تغييرات في هذه المجموعة' }, `أُعيدت إعدادات «${g}»`)}><RotateCcw className="h-3.5 w-3.5" />افتراضي</button>} pad={false}>
            <ul className="divide-y divide-line">
              {settingDefs.filter((d) => d.group === g).map((d) => <SettingRow key={d.key} def={d} value={getSetting(db, d.key)} isDefault={getSetting(db, d.key) === defaults[d.key]} onApply={apply} onReset={() => apply(d.key, defaults[d.key])} />)}
            </ul>
          </Card>))}
      </div>
    </div>
  )
}

function SettingRow({ def, value, isDefault, onApply, onReset }: { def: SettingDef; value: SettingValue; isDefault: boolean; onApply: (k: SettingDef['key'], v: SettingValue) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(String(value))
  const commit = () => { if (draft !== String(value)) onApply(def.key, def.kind === 'number' ? Number(draft) : draft) }
  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 text-sm font-medium">{def.label}{!isDefault && <Badge tone="blue">معدّل</Badge>}</div>
        <p className="mt-0.5 text-xs text-gray-500">{def.description}</p>
        <div className="mt-0.5 text-[10px] text-gray-400" dir="ltr">{def.key}</div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {def.kind === 'select' && <Select value={String(value)} onChange={(v) => onApply(def.key, v)} options={def.options!} />}
          {def.kind === 'bool' && <label className="flex h-8 items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onApply(def.key, e.target.checked)} />{value ? 'مفعّل' : 'معطّل'}</label>}
          {(def.kind === 'number' || def.kind === 'text') && <input className="inp" dir="ltr" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />}
        </div>
        {!isDefault && <button type="button" title="إعادة إلى الافتراضي" className="mt-1 rounded p-1 text-gray-400 hover:bg-gray-100" onClick={onReset}><RotateCcw className="h-4 w-4" /></button>}
      </div>
    </li>
  )
}
