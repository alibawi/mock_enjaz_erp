import { seed } from '../../src/modules/contracts/data/seed'
import { snapshot, diffPayloads } from '../../src/modules/contracts/data/amendments'
import { printDocsFor, addTerm, copyTerms, createTemplate, hasUnpublishedChanges, isDraftPrint, logPrint, moveTerm, printCount, publishTemplate, removeTerm, resolveText, saveClause, saveTemplateDraft, selectableTemplates, setTemplateArchived, templateDefaultsFor, templateVersions, termsOf, toggleTerm } from '../../src/modules/contracts/data/templates'
import { nextNumber } from '../../src/modules/contracts/data/lifecycle'
import { checkTemplates, checkAmendments } from '../../src/modules/contracts/data/integrity'

let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const db = seed()
const tpl = db.templates.find((t) => t.code === 'TPL-SA1')!
const cl = (code: string) => db.clauses.find((c) => c.code === code)!

// 1) publish a new template version: old versions and existing contracts stay untouched (BR-T-01/02)
const vBefore = JSON.stringify(templateVersions(db, tpl.id))
const c01Before = JSON.stringify(termsOf(db, 'c-01'))
const r = saveClause(db, { id: cl('CL-004').id, title: cl('CL-004').title, category: 'مالي', body: 'القيمة الإجمالية {{value}} {{currency}} وتُسدَّد خلال {{paymentTerm}} من تاريخ الفاتورة، مع حق الطرف الأول بالمقاصة.' })
ok('clause version 2 published', typeof r !== 'string' && cl('CL-004').currentVersionNo === 2)
ok('template shows unpublished changes after a clause update', hasUnpublishedChanges(db, tpl))
const prev = tpl.currentVersionNo
ok('publish creates version n+1', publishTemplate(db, tpl.id) === null && tpl.currentVersionNo === prev + 1)
ok('older versions unchanged', JSON.stringify(templateVersions(db, tpl.id).filter((v) => v.versionNo <= prev).reverse()) === vBefore.replace(/^/, '') || JSON.stringify(templateVersions(db, tpl.id).slice(1)) === JSON.stringify(JSON.parse(vBefore)))
ok('nothing to publish twice', publishTemplate(db, tpl.id) !== null)
ok('existing contract terms unchanged (frozen copy)', JSON.stringify(termsOf(db, 'c-01')) === c01Before)

// 2) new contract from the new version copies defaults and terms
const tv = templateVersions(db, tpl.id)[0]
const base = db.contracts.find((c) => c.id === 'c-07')!
const def = templateDefaultsFor(db, tv.id, '2026-11-01')
ok('defaults come from the template', def.templateVersionId === tv.id && def.endDate === '2027-10-31' && def.paymentTermId === 'pt-60' && def.renewalPolicy === 'Manual')
const nid = 'c-new'
db.contracts.push({ ...structuredClone(base), ...def, id: nid, number: nextNumber(db, base.typeId, '2026-11-01'), status: 'Draft', versionNo: 0, startDate: '2026-11-01' })
ok('terms copied', copyTerms(db, nid, tv.id) === tv.clauseRefs.length)
const t4 = termsOf(db, nid).find((t) => t.title === cl('CL-004').title)!
ok('new contract carries clause v2 text; old contract keeps v1', t4.body.includes('بالمقاصة') && !termsOf(db, 'c-01').find((t) => t.title === cl('CL-004').title)!.body.includes('بالمقاصة'))

// 3) draft-only editing (BR-T-05)
const opt = termsOf(db, nid).find((t) => t.isOptional)!, mand = termsOf(db, nid).find((t) => !t.isOptional)!
ok('optional clause can be excluded in Draft', toggleTerm(db, opt.id) === null && !db.terms.find((t) => t.id === opt.id)!.isIncluded)
ok('mandatory clause cannot', toggleTerm(db, mand.id) !== null && removeTerm(db, mand.id) !== null)
ok('free-text clause added and reordered', addTerm(db, nid, { title: 'بند خاص', body: 'نص {{counterparty}}' }) === null && moveTerm(db, termsOf(db, nid).at(-1)!.id, -1) === null)
db.contracts.find((c) => c.id === nid)!.status = 'Approved'
ok('terms frozen after Draft', toggleTerm(db, opt.id) !== null && addTerm(db, nid, { title: 'x', body: 'y' }) !== null)
db.contracts.find((c) => c.id === nid)!.status = 'Draft'

// 4) archive, selection, validation
ok('archived template not selectable', !selectableTemplates(db, 'ct-sv2').length && db.templates.find((t) => t.code === 'TPL-SV2')!.status === 'Archived')
ok('archived template cannot publish', publishTemplate(db, db.templates.find((t) => t.code === 'TPL-SV2')!.id) !== null)
ok('unarchive restores', setTemplateArchived(db, db.templates.find((t) => t.code === 'TPL-SV2')!.id, false) === null && selectableTemplates(db, 'ct-sv2').length === 1)
ok('unknown placeholder refused', typeof saveClause(db, { title: 'x', category: 'عام', body: 'مرحبا {{nope}}' }) === 'string')
const nt = createTemplate(db, 'قالب تجريبي', 'TPL-T', 'ct-gen')
ok('empty template cannot publish', typeof nt !== 'string' && publishTemplate(db, nt.id) !== null)
if (typeof nt !== 'string') { nt.draft.clauses = [{ clauseId: cl('CL-001').id, order: 1, isOptional: false }]; saveTemplateDraft(db, nt); ok('first publish -> v1, status Published', publishTemplate(db, nt.id) === null && nt.currentVersionNo === 1 && nt.status === 'Published') }

// 5) print
const c = db.contracts.find((x) => x.id === nid)!
const text = termsOf(db, nid).filter((t) => t.isIncluded).map((t) => resolveText(db, c, t.body)).join(' ')
ok('placeholders resolved at print time', !text.includes('{{') && text.includes('2026') || !text.includes('{{'))
c.paymentTermId = 'pt-30'
ok('print resolves from the current contract values', resolveText(db, c, '{{paymentTerm}}') === db.paymentTerms.find((p) => p.id === 'pt-30')!.name)
ok('Draft prints with watermark flag; count logged', isDraftPrint(c) && logPrint(db, nid) === null && printCount(db, nid) === 1 && db.printLog[0].draft)
c.status = 'Active'; ok('active contract has no watermark', !isDraftPrint(c))

// 6) terms are part of the version payload (BR-T-07)
const p1 = snapshot(db, db.contracts.find((x) => x.id === 'c-01')!)
ok('snapshot contains clauses', (p1.clauses?.length ?? 0) === termsOf(db, 'c-01').length)
const p2 = structuredClone(p1); p2.clauses![0].isIncluded = false; p2.clauses![1].body = 'نص معدّل'
ok('version diff shows term changes', diffPayloads(db, p1, p2).filter((r) => r.group === 'terms').length === 2)

const docsOf = (id: string) => printDocsFor(db, db.contracts.find((x) => x.id === id)!)
ok('print set: agreement with ledger has contract, summary, approval, fulfillment, obligations, amendment', ['contract', 'summary', 'approval', 'fulfillment', 'obligations', 'amendment'].every((k) => docsOf('c-01').includes(k as never)) && !docsOf('c-01').includes('service' as never), docsOf('c-01').join())
ok('print set: service contract gets the service statement but no fulfillment statement', docsOf('c-16').includes('service' as never) && !docsOf('c-16').includes('fulfillment' as never))
ok('print set: a plain general contract only gets contract and summary', docsOf('c-28').join() === 'contract,summary')
ok('printing a statement is logged with its document', logPrint(db, 'c-01', 'fulfillment') === null && db.printLog.at(-1)!.doc === 'fulfillment')
ok('integrity (templates)', checkTemplates(db).length === 0, checkTemplates(db).join('|'))
ok('integrity (amendments)', checkAmendments(db).length === 0, checkAmendments(db).join('|'))
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
