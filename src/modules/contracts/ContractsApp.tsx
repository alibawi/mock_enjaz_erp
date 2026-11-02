import { Route, Routes, useLocation } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Topbar } from './components/Layout'
import AlertsCenter from './pages/contracts/AlertsCenter'
import ContractCard from './pages/contracts/ContractCard'
import ContractTypes from './pages/contracts/ContractTypes'
import ContractWizard from './pages/contracts/ContractWizard'
import ContractsList from './pages/contracts/ContractsList'
import AgreementsList from './pages/agreements/AgreementsList'
import Resolve from './pages/agreements/Resolve'
import Simulator from './pages/agreements/Simulator'
import AmendmentDetail from './pages/amendments/AmendmentDetail'
import AmendmentEditor from './pages/amendments/AmendmentEditor'
import AmendmentsList from './pages/amendments/AmendmentsList'
import Renewals from './pages/amendments/Renewals'
import { VersionCompare } from './pages/amendments/Tabs'
import ObligationsBoard from './pages/finance/Board'
import Payments from './pages/finance/Payments'
import ScheduleChangesPage from './pages/finance/ScheduleChanges'
import Clauses from './pages/templates/Clauses'
import Print from './pages/templates/Print'
import TemplateEditor from './pages/templates/TemplateEditor'
import Templates from './pages/templates/Templates'
import Calls from './pages/service/Calls'
import ServiceList from './pages/service/ServiceList'
import SlaReport from './pages/service/SlaReport'
import SettingsAudit from './pages/settings/Audit'
import Demo from './pages/settings/Demo'
import Matrix from './pages/settings/Matrix'
import Numbering from './pages/settings/Numbering'
import Organizations from './pages/settings/Organizations'
import Settings from './pages/settings/Settings'
import { ReportView, ReportsHub } from './pages/reports/Reports'
import SearchPage from './pages/reports/Search'
import Health from './pages/Health'
import Delegations from './pages/workflow/Delegations'
import ApprovalStages from './pages/workflow/ApprovalStages'
import Tasks from './pages/workflow/Tasks'
import Home from './pages/Home'

export default function ContractsApp() {
  // Keying on the path remounts forms when navigating between /x/new and /x/:id
  const { pathname } = useLocation()
  return (
    <>
      <Topbar />
      <main className="flex-1 overflow-y-auto p-5">
      <ErrorBoundary key={pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contracts" element={<ContractsList />} />
        <Route path="/contracts/new" element={<ContractWizard key={pathname} />} />
        <Route path="/contracts/:id" element={<ContractCard key={pathname} />} />
        <Route path="/contracts/:id/edit" element={<ContractWizard key={pathname} />} />
        <Route path="/contract-types" element={<ContractTypes />} />
        <Route path="/alerts" element={<AlertsCenter />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/delegations" element={<Delegations />} />
        <Route path="/settings/approval-stages" element={<ApprovalStages />} />
        <Route path="/agreements" element={<AgreementsList />} />
        <Route path="/agreements/simulator" element={<Simulator />} />
        <Route path="/agreements/resolve" element={<Resolve />} />
        <Route path="/contracts/:id/amend" element={<AmendmentEditor key={pathname} />} />
        <Route path="/contracts/:id/amend/:aid" element={<AmendmentEditor key={pathname} />} />
        <Route path="/contracts/:id/amendments/:aid" element={<AmendmentDetail key={pathname} />} />
        <Route path="/contracts/:id/versions/compare" element={<VersionCompare />} />
        <Route path="/amendments" element={<AmendmentsList />} />
        <Route path="/renewals" element={<Renewals />} />
        <Route path="/obligations" element={<ObligationsBoard />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/installments" element={<ScheduleChangesPage />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/:id" element={<TemplateEditor key={pathname} />} />
        <Route path="/clauses" element={<Clauses />} />
        <Route path="/contracts/:id/print" element={<Print />} />
        <Route path="/service" element={<ServiceList />} />
        <Route path="/service/calls" element={<Calls />} />
        <Route path="/service/sla" element={<SlaReport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/permissions" element={<Matrix />} />
        <Route path="/settings/numbering" element={<Numbering />} />
        <Route path="/settings/organizations" element={<Organizations />} />
        <Route path="/settings/audit" element={<SettingsAudit />} />
        <Route path="/settings/demo" element={<Demo />} />
        <Route path="/reports" element={<ReportsHub />} />
        <Route path="/reports/:id" element={<ReportView key={pathname} />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </ErrorBoundary>
    </main>
    </>
  )
}
