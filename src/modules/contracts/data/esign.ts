// E-signature provider simulation (plan ADR-22, BR-W-08/09). The real system only has the abstraction until a client asks for a
// provider; here a fake provider ("مزوّد تجريبي") returns signer events when the presenter presses the simulate buttons.
import { today } from './asof'
import { nowStamp, uid } from './format'
import { record, typeOf } from './lifecycle'
import { getSetting } from './settings'
import type { Contract, DB, SignatureRequest, SignatureSigner } from './types'

export const PROVIDER = 'مزوّد تجريبي'
export const requestsFor = (db: DB, contractId: string) => db.signatureRequests.filter((r) => r.contractId === contractId).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
export const openSignatureRequest = (db: DB, contractId: string) => db.signatureRequests.find((r) => r.contractId === contractId && ['Sent', 'PartiallySigned'].includes(r.status))

/** BR-W-08/09: can an e-signature request be sent now? Returns a reason when not. */
export function sendBlocked(db: DB, c: Contract): string | undefined {
  if (!getSetting<boolean>(db, 'Feature.ESignature')) return 'التوقيع الإلكتروني معطّل من إعدادات النظام'
  if (!typeOf(db, c).requiresSignature) return 'هذا النوع لا يتطلب توقيعاً'
  if (c.status !== 'Approved' && c.status !== 'PendingSignature') return 'يُرسل للتوقيع بعد اعتماد العقد'
  if (openSignatureRequest(db, c.id)) return 'يوجد طلب توقيع مفتوح'
  return undefined
}

export function sendForSignature(d: DB, contractId: string, signers: Omit<SignatureSigner, 'id' | 'status'>[]): string | null {
  const c = d.contracts.find((x) => x.id === contractId)
  if (!c) return 'العقد غير موجود'
  const why = sendBlocked(d, c)
  if (why) return why
  if (!signers.some((s) => s.role === 'Counterparty') || !signers.some((s) => s.role === 'Company')) return 'يلزم موقّع من الطرف الآخر وموقّع من الشركة'
  const req: SignatureRequest = {
    id: uid('sr'), contractId, provider: PROVIDER, status: 'Sent', externalId: `ENV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, sentAt: nowStamp(), sentBy: d.userId,
    signers: signers.map((s) => ({ ...s, id: uid('sg'), status: 'Pending' })),
  }
  d.signatureRequests.push(req)
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity: 'contract', entityId: contractId, action: 'esign:send', detail: `${PROVIDER} — ${req.externalId}` })
  if (c.status === 'Approved') record(d, c, 'PendingSignature', `أُرسل إلى ${PROVIDER}`)
  return null
}

/** Provider callback simulation: a signer signs or declines; the request completes when everybody signed. */
export function simulateSigner(d: DB, requestId: string, signerId: string, outcome: 'Signed' | 'Declined'): string | null {
  const req = d.signatureRequests.find((r) => r.id === requestId)
  const sg = req?.signers.find((s) => s.id === signerId)
  if (!req || !sg) return 'الطلب غير موجود'
  if (!['Sent', 'PartiallySigned'].includes(req.status)) return 'الطلب مغلق'
  if (sg.status !== 'Pending') return 'سُجّل قرار هذا الموقّع مسبقاً'
  const c = d.contracts.find((x) => x.id === req.contractId)!
  if (outcome === 'Declined') {
    sg.status = 'Declined'; req.status = 'Declined'
    d.audit.push({ id: uid('aud'), at: nowStamp(), userId: 'system', entity: 'contract', entityId: c.id, action: 'esign:declined', detail: `${sg.name} رفض التوقيع` })
    return null
  }
  sg.status = 'Signed'; sg.signedOn = today()
  if (req.signers.every((s) => s.status === 'Signed')) {
    req.status = 'Signed'
    const att = { id: uid('att'), ownerType: 'contract' as const, ownerId: c.id, subType: 'Signed' as const, fileName: `العقد-الموقع-إلكترونياً-${c.number}.pdf`, size: 540_000, contentType: 'application/pdf', uploadedBy: PROVIDER, uploadedAt: nowStamp(), version: 1 }
    d.attachments.push(att)
    req.signers.forEach((s, i) => {
      d.signatures = d.signatures.filter((x) => !(x.contractId === c.id && x.role === s.role))
      d.signatures.push({ id: uid('sig'), contractId: c.id, partyId: s.partyId, role: s.role, signerName: s.name, signerTitle: s.title, signedOn: s.signedOn ?? today(), method: 'ExternalProvider', attachmentId: att.id, externalSignatureId: `${req.externalId}-${i + 1}` })
    })
    d.audit.push({ id: uid('aud'), at: nowStamp(), userId: 'system', entity: 'contract', entityId: c.id, action: 'esign:signed', detail: `اكتمل التوقيع — ${req.externalId}` })
  } else req.status = 'PartiallySigned'
  return null
}

export function expireRequest(d: DB, requestId: string): string | null {
  const req = d.signatureRequests.find((r) => r.id === requestId)
  if (!req || !['Sent', 'PartiallySigned'].includes(req.status)) return 'الطلب مغلق'
  req.status = 'Expired'
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: 'system', entity: 'contract', entityId: req.contractId, action: 'esign:expired', detail: req.externalId })
  return null
}
