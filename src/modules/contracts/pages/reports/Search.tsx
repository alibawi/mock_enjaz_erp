import { Search as SearchIcon } from 'lucide-react'
import { Link, useSearchParams } from '../../router'
import { PageHeader } from '../../components/Layout'
import { EmptyBlock } from '../../components/states'
import { Card } from '../../components/ui'
import { globalSearch } from '../../data/reports'
import { useStore } from '../../data/store'

/** R5 — global search grouped by entity; contracts and everything derived from them respect confidentiality and data authority (BR-R-06). */
export default function SearchPage() {
  const { db } = useStore()
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const hits = globalSearch(db, q)
  const groups = [...new Set(hits.map((h) => h.group))]
  return (
    <div>
      <PageHeader crumbs={[{ label: 'البحث' }]} title="البحث الشامل" />
      <div className="relative mb-4 max-w-xl"><SearchIcon className="absolute start-3 top-2.5 h-4 w-4 text-gray-400" /><input autoFocus className="inp ps-9" placeholder="رقم عقد، عنوان، طرف، مستند، بند..." value={q} onChange={(e) => setSp({ q: e.target.value }, { replace: true })} /></div>
      {q.trim().length < 2 ? <EmptyBlock title="اكتب حرفين على الأقل" hint="يبحث في العقود والأطراف والمستندات والبنود والقوالب والالتزامات." />
        : hits.length === 0 ? <EmptyBlock title="لا نتائج" hint={`لا شيء يطابق «${q}» ضمن ما يحق لك رؤيته.`} /> : (
          <div className="space-y-4">
            <div className="text-xs text-gray-500">{hits.length} نتيجة</div>
            {groups.map((g) => (
              <Card key={g} title={`${g} (${hits.filter((h) => h.group === g).length})`} pad={false}>
                <ul className="divide-y divide-line">
                  {hits.filter((h) => h.group === g).slice(0, 12).map((h) => <li key={h.id}><Link to={h.to} className="block px-4 py-2 hover:bg-gray-50"><div className="text-sm font-medium text-gray-900">{h.title}</div><div className="text-xs text-gray-500">{h.sub}</div></Link></li>)}
                </ul>
              </Card>))}
          </div>)}
    </div>
  )
}
