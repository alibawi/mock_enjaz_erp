import { ArrowLeft } from 'lucide-react'
import { Badge, Card } from '../../components/ui'
import { amendStatusLabel, amendStatusTone, fieldLabel } from '../../data/amendments'
import { fmtDate, num } from '../../data/format'
import { renewalLabel } from '../../data/contractMeta'
import { partyRoleLabel } from '../../data/contractMeta'
import type { Contract, ContractAmendment, DB, HeaderField } from '../../data/types'

export const AmendStatusBadge = ({ status }: { status: ContractAmendment['status'] }) => <Badge tone={amendStatusTone[status]}>{amendStatusLabel[status]}</Badge>

const dash = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v))
export function headerText(db: DB, c: Contract, path: HeaderField, v: string | number | undefined): string {
  if (v === undefined || v === '') return '—'
  if (path === 'endDate') return fmtDate(String(v))
  if (path === 'contractValue') return `${num(Number(v), c.currency === 'USD' ? 2 : 0)} ${c.currency}`
  if (path === 'renewalPolicy') return renewalLabel[v as keyof typeof renewalLabel] ?? dash(v)
  if (path === 'paymentTermId') return db.paymentTerms.find((p) => p.id === v)?.name ?? dash(v)
  return typeof v === 'number' ? num(v) : String(v)
}

export interface ChangeRow { group: string; label: string; from?: string; to?: string; tone: 'changed' | 'added' | 'removed' }
/** Flat old → new description of an amendment's change set (editor preview and detail). */
export function describeChanges(db: DB, c: Contract, a: Pick<ContractAmendment, 'header' | 'lineOps' | 'partyOps'>): ChangeRow[] {
  const rows: ChangeRow[] = []
  a.header.forEach((h) => rows.push({ group: 'الرأس والشروط', label: fieldLabel(h.path), from: headerText(db, c, h.path, h.oldValue), to: headerText(db, c, h.path, h.newValue), tone: 'changed' }))
  const lf = { agreedQuantity: 'الكمية', agreedValue: 'القيمة', unitPrice: 'السعر', discountPercent: 'الخصم %', minRelease: 'حد أدنى', maxRelease: 'حد أقصى', validTo: 'صلاحية حتى', notes: 'ملاحظات' } as const
  a.lineOps.forEach((op) => {
    const line = op.lineNum ? db.lines.find((l) => l.contractId === c.id && l.lineNum === op.lineNum) : undefined
    const name = line ? `بند ${line.lineNum}: ${line.description}` : ''
    if (op.op === 'Add' && op.add) rows.push({ group: 'البنود', label: `بند جديد${op.lineNum ? ` ${op.lineNum}` : ''}: ${op.add.description}`, to: op.add.commitmentType === 'Quantity' ? `${num(op.add.agreedQuantity ?? 0)} × ${num(op.add.unitPrice)}` : num(op.add.agreedValue ?? 0), tone: 'added' })
    if (op.op === 'Close') rows.push({ group: 'البنود', label: name, from: 'مفتوح', to: 'مغلق', tone: 'changed' })
    if (op.op === 'Change') Object.entries(op.fields ?? {}).forEach(([k, v]) => {
      const old = (op.old as Record<string, unknown> | undefined)?.[k] ?? (line as unknown as Record<string, unknown> | undefined)?.[k]
      rows.push({ group: 'البنود', label: `${name} — ${lf[k as keyof typeof lf] ?? k}`, from: dash(typeof old === 'number' ? num(old) : old), to: dash(typeof v === 'number' ? num(v) : v), tone: 'changed' })
    })
  })
  a.partyOps.forEach((p) => {
    const party = p.partyId ? db.parties.find((x) => x.id === p.partyId) : undefined
    if (p.op === 'Add') rows.push({ group: 'الأطراف', label: `طرف جديد: ${p.fields?.name}`, to: `${partyRoleLabel[p.fields?.role ?? 'Other']} — ${p.fields?.contactName ?? ''}`, tone: 'added' })
    if (p.op === 'Remove') rows.push({ group: 'الأطراف', label: party?.name ?? '', from: party?.contactName, tone: 'removed' })
    if (p.op === 'Change') Object.entries(p.fields ?? {}).forEach(([k, v]) => rows.push({ group: 'الأطراف', label: `${party?.name} — ${{ contactName: 'الممثل', email: 'البريد', phone: 'الهاتف', signatoryTitle: 'صفة الموقّع', name: 'الاسم', role: 'الدور' }[k] ?? k}`, from: dash((party as unknown as Record<string, unknown>)?.[k]), to: dash(v), tone: 'changed' }))
  })
  return rows
}

export function ChangeTable({ rows, title = 'مجموعة التغييرات' }: { rows: ChangeRow[]; title?: string }) {
  return (
    <Card title={title} pad={false}>
      {rows.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">لا تغييرات بعد</div> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-start">البند المتغيّر</th><th className="text-start">القديم</th><th /><th className="text-start">الجديد</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-3 py-2"><div className="font-medium">{r.label}</div><div className="text-[11px] text-gray-400">{r.group}</div></td>
                <td className="text-red-600 line-through decoration-red-300">{r.from ?? ''}</td>
                <td><ArrowLeft className="h-4 w-4 text-gray-300" /></td>
                <td className={r.tone === 'removed' ? 'text-gray-400' : 'font-semibold text-emerald-700'}>{r.to ?? (r.tone === 'removed' ? 'محذوف' : '')}</td>
              </tr>))}
          </tbody>
        </table>)}
    </Card>
  )
}
