// Referential-integrity checks over the seed/DB. Used by scripts/integrity-check.ts (npm run check) and the /health screen.
// Module steps append their own checks (ledger = balances, version continuity, ...).
import { hashOf } from './amendments'
import { wouldCycle } from './obligations'
import { COUNTERS, hasDrift, signsOf } from './fulfillment'
import type { DB } from './types'

export function checkFoundation(db: DB): string[] {
  const errs: string[] = []
  const ids = (a: { id: string }[]) => new Set(a.map((x) => x.id))
  const dup = (name: string, a: { id: string }[]) => { if (ids(a).size !== a.length) errs.push(`${name}: duplicate ids`) }
  ;(['organizations', 'users', 'employees', 'partners', 'uoms', 'categories', 'items', 'paymentTerms', 'costCenters', 'projects'] as const).forEach((k) => dup(k, db[k]))

  const org = ids(db.organizations), emp = ids(db.employees), uom = ids(db.uoms), cat = ids(db.categories), pt = ids(db.paymentTerms)
  db.users.forEach((u) => {
    if (!org.has(u.orgId)) errs.push(`user ${u.id}: unknown org ${u.orgId}`)
    if (u.employeeId && !emp.has(u.employeeId)) errs.push(`user ${u.id}: unknown employee ${u.employeeId}`)
  })
  db.employees.forEach((e) => { if (!org.has(e.orgId)) errs.push(`employee ${e.id}: unknown org`) })
  db.partners.forEach((p) => { if (!pt.has(p.paymentTermId)) errs.push(`partner ${p.id}: unknown payment term`) })
  db.categories.forEach((c) => { if (c.parentId && !cat.has(c.parentId)) errs.push(`category ${c.id}: unknown parent`) })
  db.items.forEach((i) => {
    if (!cat.has(i.categoryId)) errs.push(`item ${i.id}: unknown category`)
    if (!uom.has(i.uomId)) errs.push(`item ${i.id}: unknown uom`)
  })
  if (!db.users.some((u) => u.id === db.userId && u.role === db.role)) errs.push('current user does not match current role')
  const roles = new Set(db.users.map((u) => u.role))
  Object.keys(db.rolePerms).forEach((r) => { if (!roles.has(r as never)) errs.push(`no user has role ${r}`) })
  errs.push(...checkContracts(db), ...checkWorkflow(db), ...checkAgreements(db), ...checkAmendments(db), ...checkFinance(db), ...checkTemplates(db), ...checkService(db))
  return errs
}

/** Module 1: contracts, parties, signatures, history, lines, numbering. */
export function checkContracts(db: DB): string[] {
  const errs: string[] = []
  const ct = new Set(db.contractTypes.map((t) => t.id)), cs = new Set(db.contracts.map((c) => c.id))
  const partner = new Set(db.partners.map((p) => p.id)), user = new Set([...db.users.map((u) => u.id), 'system'])
  const numbers = new Set<string>()
  db.contracts.forEach((c) => {
    if (!ct.has(c.typeId)) errs.push(`contract ${c.id}: unknown type`)
    if (c.counterpartyId && !partner.has(c.counterpartyId)) errs.push(`contract ${c.id}: unknown partner`)
    if (!user.has(c.ownerUserId)) errs.push(`contract ${c.id}: unknown owner`)
    if (c.renewedFromContractId && !cs.has(c.renewedFromContractId)) errs.push(`contract ${c.id}: unknown renewedFrom`)
    if (numbers.has(c.number)) errs.push(`contract ${c.id}: duplicate number ${c.number}`)
    numbers.add(c.number)
    if (c.endDate && c.endDate < c.startDate) errs.push(`contract ${c.id}: end before start`)
    const last = db.history.filter((h) => h.contractId === c.id).sort((a, b) => a.at.localeCompare(b.at)).pop()
    if (!last) errs.push(`contract ${c.id}: no history`)
    else if (last.to !== c.status) errs.push(`contract ${c.id}: last history ${last.to} != status ${c.status}`)
    if (c.profile === 'Agreement' && !['Cancelled'].includes(c.status) && !db.lines.some((l) => l.contractId === c.id)) errs.push(`agreement ${c.id}: no lines`)
  })
  db.parties.forEach((p) => { if (!cs.has(p.contractId)) errs.push(`party ${p.id}: unknown contract`) })
  db.lines.forEach((l) => { if (!cs.has(l.contractId)) errs.push(`line ${l.id}: unknown contract`) })
  db.signatures.forEach((s) => { if (!cs.has(s.contractId)) errs.push(`signature ${s.id}: unknown contract`) })
  db.attachments.forEach((a) => { if (!cs.has(a.ownerId)) errs.push(`attachment ${a.id}: unknown contract`) })
  db.links.forEach((l) => { if (!cs.has(l.contractId)) errs.push(`link ${l.id}: unknown contract`) })
  const types = new Map(db.contractTypes.map((t) => [t.id, t]))
  db.contracts.filter((c) => ['Active', 'OnHold', 'Expired', 'Terminated', 'Closed'].includes(c.status)).forEach((c) => {
    const t = types.get(c.typeId)
    if (t?.requiresSignature) {
      const have = new Set(db.signatures.filter((s) => s.contractId === c.id).map((s) => s.role))
      t.requiredSignatureRoles.forEach((r) => { if (!have.has(r)) errs.push(`contract ${c.id}: missing signature ${r}`) })
    }
  })
  return errs
}

/** Module 2: approval requests, tasks, actions, delegations, signature requests. */
export function checkWorkflow(db: DB): string[] {
  const errs: string[] = []
  const cs = new Map(db.contracts.map((c) => [c.id, c]))
  db.stageRules.forEach((r) => r.stages.forEach((s, i) => { if (s.no !== i + 1) errs.push(`rule ${r.id}: stage numbers not contiguous`) }))
  const open = new Map<string, number>()
  db.approvalRequests.forEach((r) => {
    const c = cs.get(r.contractId)
    if (!c) { errs.push(`request ${r.id}: unknown contract`); return }
    if (r.status === 'Pending') {
      open.set(r.subjectId, (open.get(r.subjectId) ?? 0) + 1)
      const t = db.tasks.find((x) => x.requestId === r.id && x.stageNo === r.currentStage && x.status === 'Open')
      if (!t) errs.push(`request ${r.id}: no open task for stage ${r.currentStage}`)
      else if (t.assignedUserId !== r.stages[r.currentStage - 1].userId) errs.push(`request ${r.id}: task assignee differs from stage user`)
    }
    if (r.status === 'Approved' && r.stages.some((s) => s.status !== 'approved')) errs.push(`request ${r.id}: approved with unapproved stages`)
    const acts = db.approvalActions.filter((a) => a.requestId === r.id)
    if (acts.length !== r.stages.filter((s) => s.status === 'approved' || s.status === 'rejected').length) errs.push(`request ${r.id}: actions count != decided stages`)
    acts.forEach((a) => { if (a.approverUserId === c.createdBy) errs.push(`request ${r.id}: creator approved own contract (stage ${a.stageNo})`) })
  })
  open.forEach((n, id) => { if (n > 1) errs.push(`subject ${id}: ${n} open requests`) })
  db.contracts.forEach((c) => {
    if (c.status === 'PendingApproval' && !db.approvalRequests.some((r) => r.subjectId === c.id && r.subjectType === 'Contract' && r.status === 'Pending')) errs.push(`contract ${c.id}: PendingApproval without an open request`)
  })
  const users = new Set(db.users.map((u) => u.id))
  db.delegations.forEach((d) => { if (!users.has(d.fromUserId) || !users.has(d.toUserId)) errs.push(`delegation ${d.id}: unknown user`); if (d.toDate < d.fromDate) errs.push(`delegation ${d.id}: dates reversed`) })
  db.signatureRequests.forEach((r) => {
    if (!cs.has(r.contractId)) errs.push(`signature request ${r.id}: unknown contract`)
    if (r.status === 'Signed' && r.signers.some((s) => s.status !== 'Signed')) errs.push(`signature request ${r.id}: Signed with pending signers`)
  })
  return errs
}

/** Module 3: documents, ledger = current contribution of every source line, ledger = balances, schedules. */
export function checkAgreements(db: DB): string[] {
  const errs: string[] = []
  const cs = new Map(db.contracts.map((c) => [c.id, c]))
  const docs = new Map(db.mockDocs.map((d) => [d.id, d]))
  if (docs.size !== db.mockDocs.length) errs.push('mockDocs: duplicate ids')
  db.mockDocs.forEach((doc) => {
    if (doc.agreementId && !cs.has(doc.agreementId)) errs.push(`doc ${doc.ref}: unknown agreement`)
    if (doc.baseDocId && !docs.has(doc.baseDocId)) errs.push(`doc ${doc.ref}: unknown base document`)
    const c = doc.agreementId ? cs.get(doc.agreementId) : undefined
    if (!c) return
    const signs = signsOf(db, c, doc)
    doc.lines.forEach((ln) => {
      if (!ln.agreementLineNum) return
      const line = db.lines.find((l) => l.contractId === c.id && l.lineNum === ln.agreementLineNum)
      if (!line) { errs.push(`doc ${doc.ref}: unknown agreement line ${ln.agreementLineNum}`); return }
      COUNTERS.forEach((ct) => {
        const q = db.ledger.filter((e) => e.sourceLineId === ln.id && e.entryType === ct).reduce((s, e) => s + e.quantityDelta, 0)
        const want = (signs[ct] ?? 0) * ln.qty
        if (Math.abs(q - want) > 0.0001) errs.push(`doc ${doc.ref} line ${ln.id}: ledger ${ct} ${q} != contribution ${want}`)
      })
    })
  })
  const ids = new Set<string>()
  db.ledger.forEach((e) => {
    if (ids.has(e.id)) errs.push(`ledger ${e.id}: duplicate`)
    ids.add(e.id)
    if (!cs.has(e.contractId)) errs.push(`ledger ${e.id}: unknown contract`)
    if (!docs.has(e.sourceDocId)) errs.push(`ledger ${e.id}: unknown source document`)
    if (!db.lines.some((l) => l.id === e.lineId)) errs.push(`ledger ${e.id}: unknown line`)
  })
  db.lines.forEach((l) => { if (hasDrift(db, l.id)) errs.push(`line ${l.id}: balance differs from ledger sum`) })
  const lines = new Set(db.lines.map((l) => l.id))
  db.schedules.forEach((s) => { if (!lines.has(s.lineId)) errs.push(`schedule ${s.id}: unknown line`) })
  return errs
}

/** Module 4: versions are contiguous, hashes match, one open amendment per contract, renewal links are symmetric. */
export function checkAmendments(db: DB): string[] {
  const errs: string[] = []
  const cs = new Map(db.contracts.map((c) => [c.id, c]))
  db.contracts.forEach((c) => {
    const vs = db.versions.filter((v) => v.contractId === c.id).sort((a, b) => a.versionNo - b.versionNo)
    if (c.versionNo >= 1) {
      if (vs.length !== c.versionNo || vs.some((v, i) => v.versionNo !== i + 1)) errs.push(`contract ${c.id}: versions not contiguous 1..${c.versionNo}`)
      if (vs[0] && vs[0].reason === 'Amendment') errs.push(`contract ${c.id}: first version is an amendment`)
    } else if (vs.length) errs.push(`contract ${c.id}: versions on a never-activated contract`)
    if (c.successorContractId) {
      const s = cs.get(c.successorContractId)
      if (!s || s.renewedFromContractId !== c.id) errs.push(`contract ${c.id}: successor link not symmetric`)
    }
    if (c.renewedFromContractId && cs.get(c.renewedFromContractId)?.successorContractId !== c.id) errs.push(`contract ${c.id}: predecessor link not symmetric`)
    const nums = db.lines.filter((l) => l.contractId === c.id).map((l) => l.lineNum)
    if (new Set(nums).size !== nums.length) errs.push(`contract ${c.id}: duplicate line numbers`)
    if (db.amendments.filter((a) => a.contractId === c.id && ['Draft', 'PendingApproval', 'Approved'].includes(a.status)).length > 1) errs.push(`contract ${c.id}: more than one open amendment`)
  })
  db.versions.forEach((v) => { if (hashOf(v.payload) !== v.payloadHash) errs.push(`version ${v.id}: hash mismatch`) })
  db.amendments.forEach((a) => {
    if (!cs.has(a.contractId)) errs.push(`amendment ${a.id}: unknown contract`)
    if (a.status === 'Applied' && !db.versions.some((v) => v.contractId === a.contractId && v.amendmentId === a.id && v.versionNo === a.appliedVersionNo)) errs.push(`amendment ${a.id}: applied without its version`)
    if (a.status === 'PendingApproval' && !db.approvalRequests.some((r) => r.subjectId === a.id && r.status === 'Pending')) errs.push(`amendment ${a.id}: pending without an open request`)
    if (a.status === 'Approved' && !db.approvalRequests.some((r) => r.subjectId === a.id && r.status === 'Approved')) errs.push(`amendment ${a.id}: approved without an approved request`)
  })
  return errs
}

/** Module 5: obligations, dependencies, occurrences, payment schedule and billing records. */
export function checkFinance(db: DB): string[] {
  const errs: string[] = []
  const cs = new Map(db.contracts.map((c) => [c.id, c]))
  const obl = new Map(db.obligations.map((o) => [o.id, o]))
  const pay = new Map(db.paymentItems.map((p) => [p.id, p]))
  if (obl.size !== db.obligations.length) errs.push('obligations: duplicate ids')
  db.obligations.forEach((o) => {
    if (!cs.has(o.contractId)) errs.push(`obligation ${o.id}: unknown contract`)
    if (o.dependsOnId) {
      const dep = obl.get(o.dependsOnId)
      if (!dep || dep.contractId !== o.contractId) errs.push(`obligation ${o.id}: bad dependency`)
      else if (wouldCycle(db, o.id, o.dependsOnId)) errs.push(`obligation ${o.id}: dependency cycle`)
    }
    if (o.linkedPaymentItemId && !pay.has(o.linkedPaymentItemId)) errs.push(`obligation ${o.id}: unknown payment item`)
    if (o.status === 'Accepted' && !o.acceptedBy) errs.push(`obligation ${o.id}: accepted without acceptor`)
    if (o.status === 'Accepted' && o.acceptanceRequired && o.acceptedBy === o.completedBy) errs.push(`obligation ${o.id}: completer accepted own work`)
  })
  const keys = new Set<string>()
  db.occurrences.forEach((x) => {
    const k = `${x.obligationId}|${x.dueDate}`
    if (keys.has(k)) errs.push(`occurrence ${k}: duplicate`)
    keys.add(k)
    if (!obl.has(x.obligationId)) errs.push(`occurrence ${x.id}: unknown obligation`)
  })
  db.paymentItems.forEach((p) => {
    if (!cs.has(p.contractId)) errs.push(`payment ${p.id}: unknown contract`)
    if (p.obligationId && !obl.has(p.obligationId)) errs.push(`payment ${p.id}: unknown obligation`)
    if (['Invoiced', 'Paid'].includes(p.status) && !db.billingLog.some((b) => b.paymentItemId === p.id)) errs.push(`payment ${p.id}: billed without a billing record`)
  })
  db.billingLog.forEach((b) => {
    if (!pay.has(b.paymentItemId)) errs.push(`billing ${b.id}: unknown payment item`)
    if (b.ledgerDocId && !db.mockDocs.some((d) => d.id === b.ledgerDocId)) errs.push(`billing ${b.id}: unknown ledger document`)
  })
  db.guarantees.forEach((g) => { if (!cs.has(g.contractId)) errs.push(`guarantee ${g.id}: unknown contract`) })
  db.contracts.forEach((c) => {
    const items = db.paymentItems.filter((p) => p.contractId === c.id && p.status !== 'Cancelled')
    if (items.reduce((s, p) => s + (p.percent ?? 0), 0) > 100.0001) errs.push(`contract ${c.id}: payment percents exceed 100`)
    if (c.status === 'Terminated') db.obligations.filter((o) => o.contractId === c.id && !o.survivesTermination && !['Cancelled', 'Accepted', 'Waived'].includes(o.status)).forEach((o) => errs.push(`obligation ${o.id}: open after termination`))
  })
  return errs
}

/** Module 6: clause/template versions are contiguous, template versions reference real clause versions, terms are frozen copies. */
export function checkTemplates(db: DB): string[] {
  const errs: string[] = []
  db.clauses.forEach((c) => {
    const vs = db.clauseVersions.filter((v) => v.clauseId === c.id).sort((a, b) => a.versionNo - b.versionNo)
    if (vs.length !== c.currentVersionNo || vs.some((v, i) => v.versionNo !== i + 1)) errs.push(`clause ${c.code}: versions not contiguous`)
  })
  const cvs = new Set(db.clauseVersions.map((v) => v.id))
  db.templates.forEach((t) => {
    const vs = db.templateVersions.filter((v) => v.templateId === t.id).sort((a, b) => a.versionNo - b.versionNo)
    if (vs.length !== t.currentVersionNo || vs.some((v, i) => v.versionNo !== i + 1)) errs.push(`template ${t.code}: versions not contiguous`)
    if (t.status === 'Draft' && t.currentVersionNo) errs.push(`template ${t.code}: Draft with versions`)
    if (!db.contractTypes.some((x) => x.id === t.typeId)) errs.push(`template ${t.code}: unknown type`)
  })
  db.templateVersions.forEach((v) => v.clauseRefs.forEach((r) => { if (!cvs.has(r.clauseVersionId)) errs.push(`template version ${v.id}: unknown clause version`) }))
  const tvs = new Set(db.templateVersions.map((v) => v.id))
  db.contracts.forEach((c) => {
    if (c.templateVersionId && !tvs.has(c.templateVersionId)) errs.push(`contract ${c.id}: unknown template version`)
    const orders = db.terms.filter((t) => t.contractId === c.id).map((t) => t.order)
    if (new Set(orders).size !== orders.length) errs.push(`contract ${c.id}: duplicate term order`)
  })
  db.terms.forEach((t) => {
    if (!db.contracts.some((c) => c.id === t.contractId)) errs.push(`term ${t.id}: unknown contract`)
    if (t.clauseVersionId && !cvs.has(t.clauseVersionId)) errs.push(`term ${t.id}: unknown clause version`)
    if (t.clauseVersionId && db.clauseVersions.find((v) => v.id === t.clauseVersionId)!.body !== t.body) errs.push(`term ${t.id}: body differs from its clause version (not a frozen copy)`)
  })
  return errs
}

/** Module 7: levels/windows/items reference service contracts, calls are consistent with their contract and timestamps, consumption matches resolved calls. */
export function checkService(db: DB): string[] {
  const errs: string[] = []
  const svc = new Map(db.contracts.filter((c) => c.profile === 'Service').map((c) => [c.id, c]))
  db.serviceLevels.forEach((l) => { if (!svc.has(l.contractId)) errs.push(`service level ${l.id}: not a service contract`) })
  if (new Set(db.serviceLevels.map((l) => l.contractId)).size !== db.serviceLevels.length) errs.push('service levels: more than one per contract')
  db.coverageWindows.forEach((w) => { if (!svc.has(w.contractId) || w.toTime <= w.fromTime || w.dayOfWeek < 0 || w.dayOfWeek > 6) errs.push(`coverage window ${w.id}: invalid`) })
  db.coveredItems.forEach((i) => { if (!svc.has(i.contractId)) errs.push(`covered item ${i.id}: not a service contract`); if (i.warrantyStart && i.warrantyEnd && i.warrantyEnd < i.warrantyStart) errs.push(`covered item ${i.id}: warranty dates reversed`) })
  db.serviceCalls.forEach((c) => {
    if (c.contractId && !svc.has(c.contractId)) errs.push(`call ${c.no}: unknown contract`)
    if (c.respondedAt && c.respondedAt < c.openedAt) errs.push(`call ${c.no}: responded before opening`)
    if (c.resolvedAt && c.resolvedAt < (c.respondedAt ?? c.openedAt)) errs.push(`call ${c.no}: resolved before responding`)
    if (['Resolved', 'Closed'].includes(c.status) && !c.resolvedAt) errs.push(`call ${c.no}: ${c.status} without resolution time`)
    if (c.contractId && c.resolvedAt && !db.consumption.some((x) => x.callId === c.id)) errs.push(`call ${c.no}: resolved without consumption`)
  })
  db.consumption.forEach((x) => { if (!db.serviceCalls.some((c) => c.id === x.callId)) errs.push(`consumption ${x.id}: unknown call`) })
  const seen = new Set<string>()
  db.slaEvents.forEach((e) => {
    const k = `${e.callId}|${e.kind.startsWith('Response') ? 'R' : 'S'}`
    if (seen.has(k)) errs.push(`sla event ${e.id}: duplicate ${k}`)
    seen.add(k)
  })
  return errs
}
