import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '../router'
import { confLabel, confTone, statusLabel, statusTone } from '../data/contractMeta'
import { today } from '../data/asof'
import { allowedActions, perform, type ActionDef } from '../data/lifecycle'
import { useStore } from '../data/store'
import type { Contract, ContractStatus, Confidentiality } from '../data/types'
import { DateInput } from './inputs'
import { Badge, Field, Modal } from './ui'

export const ContractStatusBadge = ({ status }: { status: ContractStatus }) => <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>

export const ConfidentialityBadge = ({ level }: { level: Confidentiality }) =>
  level === 'Normal' ? null : <span title={confLabel[level]}><Badge tone={confTone[level]}><Lock className="h-3 w-3" />{confLabel[level]}</Badge></span>

const okMessage: Record<string, string> = {
  submit: 'أُرسل العقد للاعتماد', approve: 'اعتُمد العقد', reject: 'رُفض العقد وأُعيد إلى مسودة', sendForSignature: 'أُرسل العقد للتوقيع', activate: 'فُعّل العقد',
  suspend: 'عُلّق العقد', resume: 'استُؤنف العقد', terminate: 'أُنهي العقد', close: 'أُغلق العقد', cancel: 'أُلغي العقد', reopen: 'أُعيد العقد إلى مسودة', delete: 'حُذفت المسودة',
}

/** C6: dialog that collects the reason / date an action needs, then runs it through the store. */
function TransitionDialog({ contract, def, onClose }: { contract: Contract; def: ActionDef; onClose: () => void }) {
  const { run } = useStore()
  const nav = useNavigate()
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(today())
  const [err, setErr] = useState('')
  const needReason = def.ask === 'reason' || def.ask === 'reasonDate'
  const needDate = def.ask === 'date' || def.ask === 'reasonDate'
  const go = () => {
    if (def.reasonRequired && !reason.trim()) return setErr('السبب مطلوب')
    let failure = ''
    const ok = run((d) => {
      const e = perform(d, contract.id, def.id, { reason, date })
      if (e) failure = e
      return e
    }, okMessage[def.id])
    if (!ok) return setErr(failure)
    onClose()
    if (def.id === 'delete') nav('/contracts')
  }
  return (
    <Modal title={`${def.label} — ${contract.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button>
        <button type="button" className={`btn ${def.danger ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}`} onClick={go}>تأكيد</button></>}>
      <div className="space-y-3">
        {!needReason && !needDate && <p className="text-sm text-gray-600">هل تريد تنفيذ «{def.label}» على هذا العقد؟</p>}
        {needDate && <Field label={def.id === 'terminate' ? 'تاريخ الإنهاء' : 'التاريخ'} required><DateInput value={date} onChange={setDate} /></Field>}
        {needReason && (
          <Field label="السبب" required={def.reasonRequired}>
            <textarea className="inp h-24 py-1.5" value={reason} onChange={(e) => { setReason(e.target.value); setErr('') }} placeholder="اكتب السبب أو الملاحظة" />
          </Field>
        )}
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}

/** Data-driven action bar: buttons come from allowedActions(db, contract) so UI and rules never diverge (doc 07). */
export function ContractActionBar({ contract }: { contract: Contract }) {
  const { db } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState<ActionDef | null>(null)
  const { run } = useStore()
  const actions = allowedActions(db, contract)
  const click = (a: ActionDef) => {
    if (a.blocked) return
    if (a.id === 'edit') return nav(`/contracts/${contract.id}/edit`)
    if (a.ask) return setOpen(a)
    run((d) => perform(d, contract.id, a.id), okMessage[a.id])
  }
  return (
    <>
      {actions.map((a) => (
        <button key={a.id} type="button" disabled={!!a.blocked} title={a.blocked} onClick={() => click(a)}
          className={`btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`}>{a.label}</button>
      ))}
      {open && <TransitionDialog contract={contract} def={open} onClose={() => setOpen(null)} />}
    </>
  )
}
