import { Route, Routes, useLocation } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Topbar } from './components/Layout'
import AssetCard from './pages/assets/AssetCard'
import AssetForm from './pages/assets/AssetForm'
import AssetsList from './pages/assets/AssetsList'
import EstimateCard from './pages/estimates/EstimateCard'
import EstimateNew from './pages/estimates/EstimateNew'
import EstimatePrint from './pages/estimates/EstimatePrint'
import EstimatesList from './pages/estimates/EstimatesList'
import Tasks from './pages/estimates/Tasks'
import Home from './pages/Home'
import Access from './pages/Access'
import Audit from './pages/Audit'
import Labor from './pages/Labor'
import Reports from './pages/Reports'
import RequestCard from './pages/requests/RequestCard'
import RequestForm from './pages/requests/RequestForm'
import RequestReceipt from './pages/requests/RequestReceipt'
import RequestsList from './pages/requests/RequestsList'
import MasterData from './pages/MasterData'
import Settings from './pages/Settings'
import { ComingSoon } from './pages/Placeholders'
import BillingHome from './pages/billing/BillingHome'
import GoodsIssues from './pages/billing/GoodsIssues'
import InvoiceView from './pages/billing/InvoiceView'
import BookingsList from './pages/schedule/BookingsList'
import LeaveList from './pages/schedule/LeaveList'
import RouteSheet from './pages/schedule/RouteSheet'
import ScheduleBoard from './pages/schedule/ScheduleBoard'
import JobCardPrint from './pages/workorders/JobCardPrint'
import WorkOrderCard from './pages/workorders/WorkOrderCard'
import WorkOrderForm from './pages/workorders/WorkOrderForm'
import WorkOrdersList from './pages/workorders/WorkOrdersList'

export default function MaintenanceApp() {
  // Keying on the path remounts forms when navigating between /x/new and /x/:id
  const { pathname } = useLocation()
  return (
    <>
      <Topbar />
      <main className="flex-1 overflow-y-auto p-5">
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/master-data" element={<MasterData />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/assets" element={<AssetsList />} />
            <Route path="/assets/new" element={<AssetForm key={pathname} />} />
            <Route path="/assets/:id" element={<AssetCard key={pathname} />} />
            <Route path="/assets/:id/edit" element={<AssetForm key={pathname} />} />
            <Route path="/requests" element={<RequestsList />} />
            <Route path="/requests/new" element={<RequestForm key={pathname} />} />
            <Route path="/requests/:id" element={<RequestCard key={pathname} />} />
            <Route path="/requests/:id/receipt" element={<RequestReceipt />} />
            <Route path="/estimates" element={<EstimatesList />} />
            <Route path="/estimates/new" element={<EstimateNew key={pathname} />} />
            <Route path="/estimates/:id" element={<EstimateCard key={pathname} />} />
            <Route path="/estimates/:id/print" element={<EstimatePrint />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/work-orders" element={<WorkOrdersList key={pathname} />} />
            <Route path="/work-orders/new" element={<WorkOrderForm key={pathname} />} />
            <Route path="/work-orders/:id" element={<WorkOrderCard key={pathname} />} />
            <Route path="/work-orders/:id/job-card" element={<JobCardPrint />} />
            <Route path="/schedule" element={<ScheduleBoard />} />
            <Route path="/schedule/bookings" element={<BookingsList />} />
            <Route path="/schedule/route-sheet" element={<RouteSheet />} />
            <Route path="/schedule/leave" element={<LeaveList />} />
            <Route path="/access" element={<Access />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/labor" element={<Labor key={pathname} />} />
            <Route path="/billing" element={<BillingHome key={pathname} />} />
            <Route path="/billing/issues" element={<GoodsIssues />} />
            <Route path="/billing/invoices/:id" element={<InvoiceView key={pathname} />} />
            <Route path="/soon/:feature" element={<ComingSoon />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  )
}
