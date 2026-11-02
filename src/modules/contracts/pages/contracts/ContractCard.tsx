import { useState } from 'react'
import { Link, useParams, useSearchParams } from '../../router'
import { ConfidentialityBadge, ContractActionBar, ContractStatusBadge } from '../../components/contract'
import { PageHeader } from '../../components/Layout'
import { Async, EmptyBlock } from '../../components/states'
import { Tabs } from '../../components/ui'
import { directionShort, profileLabel } from '../../data/contractMeta'
import { daysTo, fmtDate, money } from '../../data/format'
import { canSee, noticeDeadline, partnerName, typeOf, userName } from '../../data/lifecycle'
import { predecessorOf, successorOf } from '../../data/renewal'
import { getSetting } from '../../data/settings'
import { useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'
import { ApprovalPanel } from '../workflow/ApprovalPanel'
import { ESignPanel } from '../workflow/ESignPanel'
import { AgreementLinesTab } from '../agreements/AgreementLines'
import { AgreementDocs, FulfillmentTab } from '../agreements/Fulfillment'
import { AmendmentsTab, VersionsTab } from '../amendments/Tabs'
import { RenewButton } from '../amendments/Renewals'
import { FinancialTab } from '../finance/FinancialTab'
import { ObligationsTab } from '../finance/ObligationsTab'
import { TermsTab } from '../templates/TermsTab'
import { ServiceTab } from '../service/ServiceTab'
import { AttachmentsTab, GeneralTab, LinksTab, LinesTab, PartiesTab, SignaturesTab, TimelineTab } from './tabs'

type Tab = 'general' | 'parties' | 'lines' | 'terms' | 'attachments' | 'signatures' | 'approvals' | 'amendments' | 'versions' | 'fulfillment' | 'links' | 'obligations' | 'financial' | 'service' | 'timeline'

/** C2 — contract card. Tabs of later modules show a «قريباً» placeholder gated by feature flags (spec §8). */
export default function ContractCard() {
  const { id } = useParams()
  const { db } = useStore()
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab | null) ?? 'general')
  const api = useApi(() => db.contracts.find((c) => c.id === id) ?? null, [id])

  return (
    <Async state={api}>
      {(c) => {
        if (!c || !canSee(db, c)) {
          return <EmptyBlock title={c ? 'لا تملك صلاحية عرض هذا العقد' : 'العقد غير موجود'} hint={c ? 'العقود السرية تتطلب صلاحية «عرض العقود السرية».' : 'ربما حُذف أو الرابط غير صحيح.'} />
        }
        const t = typeOf(db, c)
        const left = c.endDate ? daysTo(c.endDate) : undefined
        const nd = noticeDeadline(c)
        const pred = predecessorOf(db, c), succ = successorOf(db, c)
        const feature = (k: 'Obligations' | 'Templates' | 'Service') => getSetting<boolean>(db, `Feature.${k}`)
        const tabs: { id: Tab; label: string; count?: number }[] = [
          { id: 'general', label: 'البيانات العامة' },
          { id: 'parties', label: 'الأطراف', count: db.parties.filter((p) => p.contractId === c.id).length },
          ...(c.profile !== 'General' ? [{ id: 'lines' as Tab, label: 'البنود', count: db.lines.filter((l) => l.contractId === c.id).length }] : []),
          ...(feature('Templates') ? [{ id: 'terms' as Tab, label: 'البنود القانونية' }] : []),
          { id: 'attachments', label: 'المرفقات', count: db.attachments.filter((a) => a.ownerId === c.id).length },
          { id: 'signatures', label: 'التواقيع', count: db.signatures.filter((s) => s.contractId === c.id).length },
          { id: 'approvals', label: 'الاعتماد' },
          { id: 'amendments', label: 'الملاحق' },
          { id: 'versions', label: 'النسخ' },
          ...(c.profile === 'Agreement' ? [{ id: 'fulfillment' as Tab, label: 'التنفيذ' }] : []),
          { id: 'links', label: 'المستندات المرتبطة', count: db.links.filter((l) => l.contractId === c.id).length },
          ...(feature('Obligations') ? [{ id: 'obligations' as Tab, label: 'الالتزامات' }, { id: 'financial' as Tab, label: 'المالية' }] : []),
          ...(c.profile === 'Service' && feature('Service') ? [{ id: 'service' as Tab, label: 'الخدمة' }] : []),
          { id: 'timeline', label: 'السجل والتدقيق' },
        ]
        const body = (() => {
          switch (tab) {
            case 'general': return <GeneralTab c={c} />
            case 'parties': return <PartiesTab c={c} />
            case 'lines': return c.profile === 'Agreement' ? <AgreementLinesTab c={c} /> : <LinesTab c={c} />
            case 'attachments': return <AttachmentsTab c={c} />
            case 'signatures': return <div className="space-y-4"><ESignPanel c={c} /><SignaturesTab c={c} /></div>
            case 'approvals': return <ApprovalPanel c={c} />
            case 'links': return <div className="space-y-4">{c.profile === 'Agreement' && <AgreementDocs c={c} />}<LinksTab c={c} /></div>
            case 'timeline': return <TimelineTab c={c} />
            case 'terms': return <TermsTab c={c} />
            case 'amendments': return <AmendmentsTab c={c} />
            case 'versions': return <VersionsTab c={c} />
            case 'fulfillment': return <FulfillmentTab c={c} />
            case 'obligations': return <ObligationsTab c={c} />
            case 'financial': return <FinancialTab c={c} />
            case 'service': return <ServiceTab c={c} />
          }
        })()
        return (
          <div>
            <PageHeader crumbs={[{ label: 'العقود', to: '/contracts' }, { label: c.number }]} title={c.title}
              badge={<span className="flex items-center gap-1.5"><ContractStatusBadge status={c.status} /><ConfidentialityBadge level={c.confidentiality} /></span>}
              actions={<><Link className="btn" to={`/contracts/${c.id}/print`}>طباعة</Link><RenewButton c={c} /><ContractActionBar contract={c} /></>} />
            {(pred || succ) && (
              <div className="mb-3 flex flex-wrap gap-4 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
                {pred && <span>جُدِّد من: <Link className="underline" to={`/contracts/${pred.id}`} dir="ltr">{pred.number}</Link></span>}
                {succ && <span>العقد اللاحق: <Link className="underline" to={`/contracts/${succ.id}`} dir="ltr">{succ.number}</Link> ({succ.status === 'Draft' ? 'مسودة' : succ.status})</span>}
              </div>
            )}
            <div className="card mb-4 grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm md:grid-cols-4 xl:grid-cols-6">
              {[
                ['الرقم', <span key="n" dir="ltr">{c.number}</span>],
                ['النوع', `${t.name} · ${profileLabel[c.profile]} · ${directionShort[c.direction]}`],
                ['الطرف الآخر', partnerName(db, c)],
                ['المسؤول', userName(db, c.ownerUserId)],
                ['القيمة', c.contractValue ? money(c.contractValue, c.currency) : '—'],
                ['النسخة', c.versionNo ? `v${c.versionNo}` : 'لم يُفعَّل'],
                ['البداية', fmtDate(c.startDate)],
                ['النهاية', c.endDate ? `${fmtDate(c.endDate)}${left !== undefined && ['Active', 'OnHold'].includes(c.status) ? ` (متبقٍ ${left} يوم)` : ''}` : 'مفتوح'],
                ['مهلة الإشعار', nd && c.renewalPolicy !== 'None' ? fmtDate(nd) : '—'],
              ].map(([k, v], i) => (
                <div key={i}><div className="text-[11px] text-gray-500">{k as string}</div><div className="font-medium text-gray-900">{v}</div></div>
              ))}
            </div>
            <div className="card">
              <Tabs tabs={tabs} active={tab} onChange={setTab} />
              <div className="p-4">{body}</div>
            </div>
          </div>
        )
      }}
    </Async>
  )
}
