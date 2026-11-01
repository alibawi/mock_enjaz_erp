import { useState } from 'react'
import { ChipListEditor } from '../../components/inputs'
import { ListView, type Column } from '../../components/ListView'
import { Badge, Field, FormGrid, Modal, NumInput, Select } from '../../components/ui'
import { categoryLabel, confLabel, directionLabel, profileLabel, renewalLabel } from '../../data/contractMeta'
import { uid } from '../../data/format'
import { addAudit, useStore } from '../../data/store'
import type { Confidentiality, ContractType, Direction, RenewalPolicy, TypeCategory } from '../../data/types'
import { useApi } from '../../lib/useApi'

const empty = (): ContractType => ({
  id: '', code: '', prefix: '', name: '', category: 'Other', profile: 'General', defaultDirection: 'Incoming', requiresSignature: true, requiredSignatureRoles: ['Counterparty', 'Company'],
  requiresApproval: true, renewalPolicyDefault: 'Manual', defaultDurationMonths: 12, noticePeriodDaysDefault: 30, renewalGraceDays: 90, reminderDaysDefault: '30,15,7,1',
  isOpenEnded: false, requiresContractValue: true, requiresPaymentTerm: false, defaultConfidentiality: 'Normal', allowManualNumber: false, isActive: true,
})

/** C4 — contract types (permission ContractTypes.Manage). */
export default function ContractTypes() {
  const { db, can } = useStore()
  const [edit, setEdit] = useState<ContractType | null>(null)
  const api = useApi(() => db.contractTypes.map((t) => ({ ...t, used: db.contracts.filter((c) => c.typeId === t.id).length })))
  const cols: Column<ContractType & { used: number }>[] = [
    { key: 'code', label: 'الرمز', sort: (t) => t.code, render: (t) => <span dir="ltr" className="font-medium text-navy">{t.code}</span> },
    { key: 'name', label: 'الاسم', sort: (t) => t.name, render: (t) => t.name },
    { key: 'cat', label: 'التصنيف', render: (t) => categoryLabel[t.category] },
    { key: 'prof', label: 'النوع العام', render: (t) => profileLabel[t.profile] },
    { key: 'dir', label: 'الاتجاه', render: (t) => directionLabel[t.defaultDirection].split(' ')[0] },
    { key: 'sig', label: 'توقيع', render: (t) => (t.requiresSignature ? <Badge tone="green">مطلوب</Badge> : <Badge tone="gray">لا</Badge>) },
    { key: 'app', label: 'اعتماد', render: (t) => (t.requiresApproval ? <Badge tone="green">نعم</Badge> : <Badge tone="gray">لا</Badge>) },
    { key: 'used', label: 'عقود', num: true, sort: (t) => t.used, render: (t) => t.used },
    { key: 'act', label: 'الحالة', render: (t) => (t.isActive ? <Badge tone="green">فعّال</Badge> : <Badge tone="gray">معطّل</Badge>) },
  ]
  return (
    <>
      <ListView title="أنواع العقود" rows={api.data ?? []} columns={cols} loading={api.loading} error={api.error} onRetry={api.reload}
        searchText={(t) => `${t.code} ${t.name}`} canNew={can('ContractTypes.Manage')} onNew={() => setEdit(empty())} newLabel="نوع جديد" canExport={can('Contracts.Export')}
        onRowClick={(t) => can('ContractTypes.Manage') && setEdit(db.contractTypes.find((x) => x.id === t.id)!)} />
      {edit && <TypeDialog value={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function TypeDialog({ value, onClose }: { value: ContractType; onClose: () => void }) {
  const { db, run } = useStore()
  const [t, setT] = useState(value)
  const set = <K extends keyof ContractType>(k: K, v: ContractType[K]) => setT((x) => ({ ...x, [k]: v }))
  const dupe = db.contractTypes.some((x) => x.id !== t.id && x.code.toLowerCase() === t.code.trim().toLowerCase())
  const valid = t.code.trim() && t.name.trim() && t.prefix.trim() && !dupe
  const chk = (label: string, k: keyof ContractType) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(t[k])} onChange={(e) => set(k, e.target.checked as never)} />{label}</label>
  )
  const save = () => {
    run((d) => {
      if (t.id) { d.contractTypes[d.contractTypes.findIndex((x) => x.id === t.id)] = t; addAudit(d, 'contractType', t.id, 'edit', t.code) }
      else { const id = uid('ct'); d.contractTypes.push({ ...t, id }); addAudit(d, 'contractType', id, 'create', t.code) }
    }, 'حُفظ النوع')
    onClose()
  }
  return (
    <Modal wide title={t.id ? `تعديل النوع: ${t.name}` : 'نوع عقد جديد'} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" disabled={!valid} onClick={save}>حفظ</button></>}>
      <FormGrid>
        <Field label="الرمز" required hint={dupe ? 'الرمز مستخدم' : undefined}><input className="inp" dir="ltr" value={t.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="بادئة الترقيم" required><input className="inp" dir="ltr" value={t.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} /></Field>
        <Field label="الاسم" required span={2}><input className="inp" value={t.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="التصنيف"><Select value={t.category} onChange={(v: TypeCategory) => set('category', v)} options={(Object.keys(categoryLabel) as TypeCategory[]).map((k) => ({ value: k, label: categoryLabel[k] }))} /></Field>
        <Field label="النوع العام"><Select value={t.profile} onChange={(v) => set('profile', v)} options={(Object.keys(profileLabel) as (keyof typeof profileLabel)[]).map((k) => ({ value: k, label: profileLabel[k] }))} /></Field>
        <Field label="الاتجاه الافتراضي"><Select value={t.defaultDirection} onChange={(v: Direction) => set('defaultDirection', v)} options={(Object.keys(directionLabel) as Direction[]).map((k) => ({ value: k, label: directionLabel[k] }))} /></Field>
        <Field label="السرية الافتراضية"><Select value={t.defaultConfidentiality} onChange={(v: Confidentiality) => set('defaultConfidentiality', v)} options={(Object.keys(confLabel) as Confidentiality[]).map((k) => ({ value: k, label: confLabel[k] }))} /></Field>
        <Field label="سياسة التجديد الافتراضية"><Select value={t.renewalPolicyDefault} onChange={(v: RenewalPolicy) => set('renewalPolicyDefault', v)} options={(Object.keys(renewalLabel) as RenewalPolicy[]).map((k) => ({ value: k, label: renewalLabel[k] }))} /></Field>
        <Field label="المدة الافتراضية (شهر)"><NumInput value={t.defaultDurationMonths ?? 0} onChange={(n) => set('defaultDurationMonths', n || undefined)} /></Field>
        <Field label="مدة الإشعار الافتراضية (يوم)"><NumInput value={t.noticePeriodDaysDefault ?? 0} onChange={(n) => set('noticePeriodDaysDefault', n || undefined)} /></Field>
        <Field label="مدة السماح للتجديد (يوم)" hint="فارغ = من إعدادات النظام"><NumInput value={t.renewalGraceDays ?? 0} onChange={(n) => set('renewalGraceDays', n || undefined)} /></Field>
        <Field label="أدوار التوقيع المطلوبة" span={2}><ChipListEditor values={t.requiredSignatureRoles} onChange={(v) => set('requiredSignatureRoles', v)} placeholder="Counterparty أو Company" /></Field>
        <Field label="أيام تنبيه الانتهاء الافتراضية" span={2}><ChipListEditor values={(t.reminderDaysDefault ?? '').split(',').filter(Boolean)} onChange={(v) => set('reminderDaysDefault', v.join(','))} /></Field>
        <div className="grid gap-2 sm:col-span-2 md:col-span-5 md:grid-cols-3">
          {chk('يتطلب توقيعاً', 'requiresSignature')}{chk('يتطلب اعتماداً', 'requiresApproval')}{chk('مفتوح المدة', 'isOpenEnded')}
          {chk('قيمة العقد مطلوبة', 'requiresContractValue')}{chk('شرط الدفع مطلوب', 'requiresPaymentTerm')}{chk('يسمح بترقيم يدوي', 'allowManualNumber')}{chk('فعّال', 'isActive')}
        </div>
      </FormGrid>
    </Modal>
  )
}
