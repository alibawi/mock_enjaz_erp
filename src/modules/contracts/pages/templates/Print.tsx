import { Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from '../../router'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Select } from '../../components/ui'
import { amendTypeLabel } from '../../data/amendments'
import { canSee } from '../../data/lifecycle'
import { useStore } from '../../data/store'
import { logPrint, printCount, printDocDefs, printDocsFor, type PrintDocId } from '../../data/templates'
import { AmendmentDoc, ApprovalDoc, ContractDoc, FulfillmentDoc, ObligationsDoc, ServiceDoc, SummaryDoc } from './PrintDocs'

/** T7 — print centre: the set of printable documents of a contract (contract, summary, approval record, fulfillment / obligations / service statements, amendment). Each prints on A4 from a mock design template; printing is logged and Draft shows a watermark (BR-T-06). */
export default function Print() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const { db, run, can } = useStore()
  const c = db.contracts.find((x) => x.id === id)
  const [aid, setAid] = useState('')
  if (!c || !canSee(db, c)) return <EmptyBlock title="العقد غير موجود أو لا تملك صلاحية عرضه" />
  const avail = printDocsFor(db, c)
  const doc: PrintDocId = avail.includes(sp.get('doc') as PrintDocId) ? (sp.get('doc') as PrintDocId) : 'contract'
  const def = printDocDefs.find((d) => d.id === doc)!
  const amendments = db.amendments.filter((a) => a.contractId === c.id).sort((a, b) => b.amendmentNo - a.amendmentNo)
  const amendment = amendments.find((a) => a.id === aid) ?? amendments[0]
  const print = () => { run((d) => logPrint(d, c.id, doc)); window.setTimeout(() => window.print(), 50) }
  return (
    <div>
      <div className="no-print">
        <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number, to: `/contracts/${c.id}` }, { label: 'الطباعة' }]} title={`مركز الطباعة — ${c.number}`}
          actions={<><span className="text-xs text-gray-500">قالب التصميم: <b dir="ltr">{def.code}</b> · طُبع {printCount(db, c.id)} مرة</span><Link className="btn" to={`/contracts/${c.id}`}>رجوع</Link>
            <button type="button" className="btn btn-primary" disabled={!can('Contracts.View')} onClick={print}><Printer className="h-4 w-4" />طباعة</button></>} />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {printDocDefs.filter((d) => avail.includes(d.id)).map((d) => (
            <button key={d.id} type="button" onClick={() => setSp({ doc: d.id }, { replace: true })} className={`rounded-full border px-3 py-1 text-xs ${d.id === doc ? 'border-navy bg-navy text-white' : 'border-line bg-white text-gray-600 hover:bg-gray-50'}`}>{d.name}</button>))}
          {doc === 'amendment' && amendments.length > 1 && <div className="ms-2 w-64"><Select value={amendment?.id ?? ''} onChange={setAid} options={amendments.map((a) => ({ value: a.id, label: `ملحق ${a.amendmentNo} — ${amendTypeLabel[a.type]}` }))} /></div>}
        </div>
        {c.status === 'Draft' && <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">العقد مسودة: ستظهر على الصفحة علامة «مسودة» المائية.</div>}
      </div>
      {doc === 'contract' && <ContractDoc c={c} />}
      {doc === 'summary' && <SummaryDoc c={c} />}
      {doc === 'approval' && <ApprovalDoc c={c} />}
      {doc === 'fulfillment' && <FulfillmentDoc c={c} />}
      {doc === 'obligations' && <ObligationsDoc c={c} />}
      {doc === 'amendment' && <AmendmentDoc c={c} a={amendment} />}
      {doc === 'service' && <ServiceDoc c={c} />}
    </div>
  )
}
