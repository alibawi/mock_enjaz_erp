import { PenLine, Send } from 'lucide-react'
import { useState } from 'react'
import { UserSelect } from '../../components/inputs'
import { Badge, Card, Field, Modal } from '../../components/ui'
import { expireRequest, PROVIDER, requestsFor, sendBlocked, sendForSignature, simulateSigner } from '../../data/esign'
import { fmtDate } from '../../data/format'
import { getSetting } from '../../data/settings'
import { useStore } from '../../data/store'
import type { Contract, SignatureRequest, SignatureSigner } from '../../data/types'

const reqTone = { Draft: 'gray', Sent: 'blue', PartiallySigned: 'amber', Signed: 'green', Declined: 'red', Expired: 'gray' } as const
const reqLabel = { Draft: 'مسودة', Sent: 'أُرسل', PartiallySigned: 'موقّع جزئياً', Signed: 'اكتمل التوقيع', Declined: 'مرفوض', Expired: 'منتهي الصلاحية' } as const
const sgTone = { Pending: 'amber', Signed: 'green', Declined: 'red' } as const
const sgLabel = { Pending: 'بانتظار التوقيع', Signed: 'وقّع', Declined: 'رفض' } as const

/** W4 — electronic-signature simulation with a fake provider (plan ADR-22): send, then simulate each signer's answer. */
export function ESignPanel({ c }: { c: Contract }) {
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState(false)
  if (!getSetting<boolean>(db, 'Feature.ESignature')) return null
  const reqs = requestsFor(db, c.id)
  const blocked = sendBlocked(db, c)
  const canAct = can('Contracts.Activate')
  const act = (fn: (d: typeof db) => string | null, ok: string) => run((d) => fn(d), ok)
  return (
    <Card title={`التوقيع الإلكتروني — ${PROVIDER} (محاكاة)`} actions={canAct && <button type="button" className="btn btn-primary" disabled={!!blocked} title={blocked} onClick={() => setDlg(true)}><Send className="h-4 w-4" />إرسال للتوقيع الإلكتروني</button>}>
      <p className="mb-3 text-xs text-gray-500">لم يُختر مزوّد فعلي بعد؛ يُنفَّذ المزوّد عند طلب العميل. هنا تضغط أزرار المحاكاة لاستقبال ردّ كل موقّع.{blocked && canAct ? ` — ${blocked}` : ''}</p>
      {reqs.length === 0 ? <div className="py-4 text-center text-sm text-gray-400">لا طلبات توقيع إلكتروني</div> : (
        <div className="space-y-3">
          {reqs.map((r: SignatureRequest) => (
            <div key={r.id} className="rounded-md border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium"><PenLine className="h-4 w-4 text-gray-400" /><span dir="ltr">{r.externalId}</span><Badge tone={reqTone[r.status]}>{reqLabel[r.status]}</Badge></div>
                <div className="text-[11px] text-gray-400">أُرسل {fmtDate(r.sentAt)}</div>
              </div>
              <ul className="divide-y divide-gray-100">
                {r.signers.map((s: SignatureSigner) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-1.5 text-sm">
                    <span className="min-w-[160px]"><span className="font-medium">{s.name}</span><span className="block text-[11px] text-gray-400">{s.role === 'Company' ? 'الشركة' : 'الطرف الآخر'} · {s.title}</span></span>
                    <Badge tone={sgTone[s.status]}>{sgLabel[s.status]}{s.signedOn ? ` ${fmtDate(s.signedOn)}` : ''}</Badge>
                    {s.status === 'Pending' && ['Sent', 'PartiallySigned'].includes(r.status) && canAct && (
                      <span className="ms-auto flex gap-1.5">
                        <button type="button" className="btn" onClick={() => act((d) => simulateSigner(d, r.id, s.id, 'Signed'), 'استُلم توقيع الموقّع (محاكاة)')}>محاكاة: وقّع</button>
                        <button type="button" className="btn btn-danger" onClick={() => act((d) => simulateSigner(d, r.id, s.id, 'Declined'), 'رفض الموقّع التوقيع (محاكاة)')}>محاكاة: رفض</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {['Sent', 'PartiallySigned'].includes(r.status) && canAct && <button type="button" className="btn mt-2" onClick={() => act((d) => expireRequest(d, r.id), 'انتهت صلاحية الطلب (محاكاة)')}>محاكاة: انتهاء الصلاحية</button>}
              {r.status === 'Signed' && <div className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">أُنشئت التواقيع (طريقة: مزوّد) وأُرفق المستند الموقّع؛ يمكن الآن تفعيل العقد.</div>}
              {r.status === 'Declined' && <div className="mt-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">رُفض التوقيع. أعد الطلب أو أعد العقد إلى مسودة.</div>}
            </div>
          ))}
        </div>
      )}
      {dlg && <SendDialog c={c} onClose={() => setDlg(false)} />}
    </Card>
  )
}

function SendDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const { db, run } = useStore()
  const parties = db.parties.filter((p) => p.contractId === c.id)
  const [picked, setPicked] = useState<string[]>(parties.filter((p) => p.isPrimary).map((p) => p.id))
  const [company, setCompany] = useState('u-gm')
  const [err, setErr] = useState('')
  const send = () => {
    const co = db.users.find((u) => u.id === company)
    const signers: Omit<SignatureSigner, 'id' | 'status'>[] = [
      ...parties.filter((p) => picked.includes(p.id)).map((p) => ({ role: 'Counterparty' as const, name: p.contactName || p.name, title: p.signatoryTitle, partyId: p.id })),
      ...(co ? [{ role: 'Company' as const, name: co.name, title: co.title }] : []),
    ]
    let failure = ''
    const ok = run((d) => { const e = sendForSignature(d, c.id, signers); if (e) failure = e; return e }, 'أُرسل العقد للتوقيع الإلكتروني (محاكاة)')
    if (!ok) return setErr(failure)
    onClose()
  }
  return (
    <Modal title="إرسال للتوقيع الإلكتروني" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>تراجع</button><button type="button" className="btn btn-primary" onClick={send}>إرسال</button></>}>
      <div className="space-y-3">
        <Field label="موقّعو الطرف الآخر">
          <div className="space-y-1">
            {parties.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))} />{p.contactName || p.name}<span className="text-[11px] text-gray-400">— {p.name}</span></label>
            ))}
          </div>
        </Field>
        <Field label="موقّع الشركة"><UserSelect value={company} onChange={setCompany} /></Field>
        <p className="text-[11px] text-gray-400">المزوّد: {PROVIDER}. بعد الإرسال تنتقل حالة العقد إلى «بانتظار التوقيع».</p>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      </div>
    </Modal>
  )
}
