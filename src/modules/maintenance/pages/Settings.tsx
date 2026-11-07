import { Plus, RotateCcw, Save, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { PartnerSelect } from '../components/inputs'
import { Card, Field, FormGrid, NumInput, Select } from '../components/ui'
import { iqd } from '../data/format'
import { roleLabel } from '../data/permissions'
import { saveSettings } from '../data/settings'
import { useStore } from '../data/store'
import type { ApprovalBand, ApprovalMode, ConsumptionMode, OverIssueMode, RoleId, Settings as S } from '../data/types'

const approverRoles: RoleId[] = ['workshopManager', 'financeManager']

/** Approval bands (rule 1–2 of §20.1.4): each band = amount ceiling + ordered approver roles; first band with no roles = auto-approve. */
function BandsEditor({ value, onChange, disabled }: { value: ApprovalBand[]; onChange: (v: ApprovalBand[]) => void; disabled: boolean }) {
  const upd = (i: number, p: Partial<ApprovalBand>) => onChange(value.map((b, j) => (j === i ? { ...b, ...p } : b)))
  const toggle = (i: number, r: RoleId) => {
    const roles = value[i].roles.includes(r) ? value[i].roles.filter((x) => x !== r) : [...value[i].roles, r]
    upd(i, { roles: approverRoles.filter((x) => roles.includes(x)) }) // keep level order: workshop manager, then finance
  }
  const from = (i: number) => (i === 0 ? 0 : (value[i - 1].upTo ?? 0) + 1)
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>من</th><th>إلى</th><th>مستويات الاعتماد (بالترتيب)</th><th /></tr></thead>
        <tbody>
          {value.map((b, i) => {
            const last = i === value.length - 1
            return (
              <tr key={i}>
                <td className="num">{iqd(from(i))}</td>
                <td className="w-48">{last ? <span className="text-gray-500">بلا حد أعلى</span> : <NumInput disabled={disabled} value={b.upTo ?? 0} onChange={(n) => upd(i, { upTo: n })} />}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-3">
                    {approverRoles.map((r) => (
                      <label key={r} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" disabled={disabled} checked={b.roles.includes(r)} onChange={() => toggle(i, r)} />{roleLabel[r]}
                      </label>
                    ))}
                    {b.roles.length === 0 && <span className="text-xs text-emerald-700">اعتماد تلقائي (يُسجَّل في التدقيق)</span>}
                    {b.roles.length > 1 && <span className="text-xs text-gray-500">{b.roles.map((r) => roleLabel[r]).join(' ← ')}</span>}
                  </div>
                </td>
                <td className="w-10">
                  {!disabled && !last && value.length > 1 && (
                    <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" className="btn mt-2" onClick={() => {
          const prev = value.length > 1 ? (value[value.length - 2].upTo ?? 0) : 0
          onChange([...value.slice(0, -1), { upTo: prev + 1_000_000, roles: ['workshopManager'] }, value[value.length - 1]])
        }}><Plus className="h-4 w-4" />شريحة</button>
      )}
    </div>
  )
}

export default function Settings() {
  const { db, run, can } = useStore()
  const edit = can('MasterData.Manage')
  const [s, setS] = useState<S>(() => structuredClone(db.settings))
  const set = (p: Partial<S>) => setS((x) => ({ ...x, ...p }))
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings)

  return (
    <div>
      <PageHeader crumbs={[{ label: 'إعدادات الصيانة' }]} title="إعدادات الصيانة"
        actions={edit && (
          <>
            <button type="button" className="btn" disabled={!dirty} onClick={() => setS(structuredClone(db.settings))}><RotateCcw className="h-4 w-4" />تراجع</button>
            <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => run((d) => saveSettings(d, s), 'تم حفظ الإعدادات')}><Save className="h-4 w-4" />حفظ</button>
          </>
        )} />
      {!edit && <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">للعرض فقط — تعديل الإعدادات لمدير الورشة ومسؤول النظام.</div>}

      <div className="space-y-4">
        <Card title="صرف القطع والمخزون">
          <FormGrid>
            <Field label="صرف القطع عند إكمال أمر العمل" span={2} hint="تلقائي: يُنشأ سند الصرف فور الإكمال (القرار 1g). يدوي: يبقى بانتظار أمين المخزن.">
              <Select<ConsumptionMode> disabled={!edit} value={s.consumptionMode} onChange={(consumptionMode) => set({ consumptionMode })}
                options={[{ value: 'automatic', label: 'تلقائي (الافتراضي)' }, { value: 'manual', label: 'يدوي' }]} />
            </Field>
            <Field label="كمية أكبر من المتاح" span={3} hint="منع: لا يكتمل أمر العمل إذا زادت الكمية المستهلكة عن المتاح (القرار 1f). السماح: يكتمل ويفشل الصرف حتى يصل المخزون ثم يُعاد.">
              <Select<OverIssueMode> disabled={!edit} value={s.overIssueMode} onChange={(overIssueMode) => set({ overIssueMode })}
                options={[{ value: 'block', label: 'منع إكمال أمر العمل (الافتراضي)' }, { value: 'allowCompleteAndRetry', label: 'السماح بالإكمال وإعادة الصرف لاحقًا' }]} />
            </Field>
            <Field label="الشريك الداخلي لسندات الصرف" span={2} hint="يُستخدم حين لا توجد جهة مُحمَّلة على أمر العمل (القرار 1d).">
              <PartnerSelect kind="internal" disabled={!edit} value={s.internalPartnerId} onChange={(internalPartnerId) => set({ internalPartnerId })} />
            </Field>
            <Field label="حساب تكلفة المبيعات"><input className="inp" dir="ltr" disabled={!edit} value={s.cogsAccount} onChange={(e) => set({ cogsAccount: e.target.value })} /></Field>
            <Field label="حساب الإيراد الافتراضي" hint="حين لا يوجد حساب على بطاقة المادة"><input className="inp" dir="ltr" disabled={!edit} value={s.defaultRevenueAccount} onChange={(e) => set({ defaultRevenueAccount: e.target.value })} /></Field>
          </FormGrid>
        </Card>

        <Card title="اعتماد التقدير (§20.1.4)">
          <FormGrid>
            <Field label="وضع الاعتماد" span={2} hint="Elsa: سير عمل · مهام مباشرة: بأسلوب التصنيع · معطّل: كل التقديرات تُعتمد تلقائيًا.">
              <Select<ApprovalMode> disabled={!edit} value={s.approvalMode} onChange={(approvalMode) => set({ approvalMode })}
                options={[{ value: 'elsa', label: 'Elsa (الافتراضي)' }, { value: 'directTask', label: 'مهام مباشرة' }, { value: 'disabled', label: 'معطّل' }]} />
            </Field>
            <Field label="حد خصم السطر %" hint="خصم أعلى يستوجب الاعتماد"><NumInput disabled={!edit} value={s.lineDiscountLimitPct} onChange={(lineDiscountLimitPct) => set({ lineDiscountLimitPct })} /></Field>
            <Field label="حد تكلفة الصيانة الداخلية" hint="أعلى منه يستوجب الاعتماد"><NumInput disabled={!edit} value={s.internalCostLimit} onChange={(internalCostLimit) => set({ internalCostLimit })} /></Field>
            <Field label="صلاحية التقدير (يوم)"><NumInput disabled={!edit} value={s.estimateValidityDays} onChange={(estimateValidityDays) => set({ estimateValidityDays })} /></Field>
          </FormGrid>
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-gray-600">شرائح المبالغ ومستويات الاعتماد</div>
            <BandsEditor disabled={!edit} value={s.approvalBands} onChange={(approvalBands) => set({ approvalBands })} />
            <p className="mt-2 text-[11px] text-gray-500">لا يعتمد المُقدِّم تقديره بنفسه في أي مستوى. حسن النية أو تجاوز ضمان منتهٍ يستوجب الاعتماد مهما كان المبلغ.</p>
          </div>
        </Card>

        <Card title="الفوترة وإعادة العمل">
          <FormGrid>
            <Field label="نسبة العربون الافتراضية %" hint="عربون سند قبض على الحساب (القرار 8)"><NumInput disabled={!edit} value={s.depositDefaultPercent} onChange={(depositDefaultPercent) => set({ depositDefaultPercent })} /></Field>
            <Field label="مدة إعادة العمل (يوم)" hint="تكرار العطل خلالها = أمر إعادة عمل بتغطية حسن نية (القرار 13)"><NumInput disabled={!edit} value={s.reworkWindowDays} onChange={(reworkWindowDays) => set({ reworkWindowDays })} /></Field>
          </FormGrid>
        </Card>
      </div>
    </div>
  )
}
