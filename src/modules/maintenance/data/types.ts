// Data model of the maintenance mock — spec-maintenance.md §2. Money is IQD (integer), dates are ISO strings.

export type RoleId = 'advisor' | 'technician' | 'workshopManager' | 'dispatcher' | 'warehouse' | 'accountant' | 'financeManager' | 'admin'

export type Perm =
  | 'MasterData.Manage'
  | 'Assets.Manage'
  | 'Requests.Create'
  | 'Estimates.Create'
  | 'Estimates.Approve'
  | 'Estimates.Withdraw'
  | 'Estimates.CustomerAcceptance'
  | 'WorkOrders.Create'
  | 'WorkOrders.Execute'
  | 'WorkOrders.ConfirmTime'
  | 'WorkOrders.PostConsumption'
  | 'WorkOrders.Reopen'
  | 'WorkOrders.ChangeBillingPartner'
  | 'WorkOrders.OverrideExpenseType'
  | 'Schedule.Manage'
  | 'Billing.Generate'
  | 'Billing.Cancel'
  | 'Reports.View'
  | 'Settings.Manage'

export interface AppUser { id: string; name: string; role: RoleId; title: string }

// ---------- master data ----------
export type MaintKind = 'workshop' | 'field' | 'internal'
export interface MaintenanceType { id: string; code: string; name: string; kind: MaintKind; corrective: boolean; defaultExpenseTypeId?: string; active: boolean }
export interface AttributeDef { key: string; label: string; unit?: string }
export interface AssetCategory { id: string; code: string; name: string; isVehicle: boolean; meterUnit?: 'km' | 'hours'; attributes: AttributeDef[] }
export interface FailureCode { id: string; code: string; name: string; categoryId?: string }
export interface StandardOperation { id: string; code: string; name: string; serviceItemId: string; standardHours: number }
export interface Bay { id: string; code: string; name: string }
export interface Workshop { id: string; code: string; name: string; warehouseId: string; bays: Bay[] }
export type ExpenseScope = 'customer' | 'warranty' | 'internal' | 'goodwill'
export interface ExpenseType { id: string; code: string; name: string; accountCode: string; accountName: string; scope: ExpenseScope }
export type TechTitle = 'technician' | 'seniorTechnician'
export interface Technician { id: string; employeeNo: string; name: string; title: TechTitle; standardRate: number; phone: string; area: string; active: boolean }
export type PartnerKind = 'customer' | 'internal'
export interface Partner { id: string; code: string; name: string; kind: PartnerKind; phone: string; area: string; address: string; accountCode: string }
export type ItemKind = 'part' | 'service'
export type Tracking = 'none' | 'batch' | 'serial'
export interface Item { id: string; code: string; name: string; kind: ItemKind; uom: string; price: number; cost: number; revenueAccount?: string; tracking: Tracking }
export interface Warehouse { id: string; code: string; name: string; inventoryAccount: string }
export interface StockRow { itemId: string; warehouseId: string; onHand: number; reserved: number }

export type ConsumptionMode = 'automatic' | 'manual'
export type OverIssueMode = 'block' | 'allowCompleteAndRetry'
export type ApprovalMode = 'elsa' | 'directTask' | 'disabled'
export interface ApprovalBand { upTo: number | null; roles: RoleId[] }
export interface Settings {
  consumptionMode: ConsumptionMode
  overIssueMode: OverIssueMode
  internalPartnerId: string
  approvalMode: ApprovalMode
  approvalBands: ApprovalBand[]
  lineDiscountLimitPct: number
  internalCostLimit: number
  reworkWindowDays: number
  estimateValidityDays: number
  depositDefaultPercent: number
  defaultRevenueAccount: string
  cogsAccount: string
}

// ---------- assets ----------
export type OwnerKind = 'customer' | 'company'
export type AssetState = 'active' | 'loaned' | 'retired'
export interface Asset {
  id: string; code: string; name: string; categoryId: string; ownerKind: OwnerKind; ownerPartnerId: string
  serial?: string; model: string; brand: string; location: string; area?: string; parentAssetId?: string
  warrantyStart?: string; warrantyEnd?: string; state: AssetState; attributes: Record<string, string>
  fixedAssetRef?: string; contractRef?: string; costCenter?: string
}
export interface VehicleDetails { assetId: string; plate: string; vin: string; make: string; model: string; year: number; engineNo: string; fuel: string; transmission: string; color: string }
export type ReadingSource = 'intake' | 'handover' | 'manual'
export interface MeterReading { id: string; assetId: string; value: number; unit: 'km' | 'hours'; at: string; source: ReadingSource; docRef?: string }

// ---------- documents ----------
export type RequestStatus = 'draft' | 'received' | 'inDiagnosis' | 'awaitingApproval' | 'approved' | 'closed' | 'rejected' | 'cancelled'
export interface MaintRequest {
  id: string; number: string; assetId: string; partnerId: string; maintenanceTypeId: string; receivedAt: string; receivedBy: string
  complaint: string; meterAtIntake?: number; accessories: string; status: RequestStatus; estimateId?: string; workOrderId?: string
  channel: 'walkIn' | 'phone' | 'whatsapp'; contactName?: string; contactPhone?: string; cancelReason?: string; reworkOfWorkOrderId?: string
}

export type EstimateStatus = 'draft' | 'pendingApproval' | 'approved' | 'rejected' | 'superseded' | 'expired' | 'cancelled'
export type LineKind = 'part' | 'labor' | 'service'
export type Coverage = 'paid' | 'warranty' | 'goodwill'
export interface EstimateLine { id: string; kind: LineKind; itemId: string; qty: number; price: number; discountPct: number; coverage: Coverage }
export type AcceptanceChannel = 'inPerson' | 'phone' | 'whatsapp' | 'email'
export interface CustomerAcceptance { decision: 'accepted' | 'declined'; channel: AcceptanceChannel; by: string; at: string; note?: string }
export interface Estimate {
  id: string; number: string; requestId: string; assetId: string; partnerId: string; version: number; status: EstimateStatus
  validUntil: string; lines: EstimateLine[]; createdBy: string; submittedBy?: string; supersedesId?: string
  customerAcceptance?: CustomerAcceptance
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'notRequired' | 'waiting'
export interface ApprovalRequest {
  id: string; estimateId: string; round: number; version: number; level: number; roles: RoleId[]; status: ApprovalStatus
  submittedBy: string; submittedAt: string; decidedBy?: string; decidedAt?: string; comment?: string
}

export type WorkOrderStatus =
  | 'created' | 'planned' | 'scheduled' | 'inProgress' | 'waitingParts' | 'waitingCustomer' | 'onHold'
  | 'qualityCheck' | 'completed' | 'closed' | 'cancelled'
export type ConsumptionStatus = 'notRequired' | 'pending' | 'posted' | 'failed'
export type BillingStatus = 'notInvoiced' | 'invoiced' | 'invoiceCancelled' | 'notBillable'
export interface WorkOrderOperation { id: string; operationId: string; description: string; plannedHours: number; done: boolean; doneByBookingId?: string }
export interface WorkOrderPart {
  id: string; itemId: string; plannedQty: number; reservedQty: number; consumedQty: number; issuedQty: number
  unitCost?: number; price: number; coverage: Coverage; expenseTypeId?: string
}
export interface TimeEntry { id: string; technicianId: string; date: string; hours: number; category: 'regular' | 'overtime'; operationId?: string; confirmedBy?: string }
export type Disposition = 'returnedToCustomer' | 'scrapped' | 'returnedToVendor'
export interface RemovedPart { id: string; description: string; serial?: string; disposition: Disposition }
export interface StatusChange { from: WorkOrderStatus | null; to: WorkOrderStatus; at: string; by: string; reason?: string }
/** Billable labor / service lines carried from the estimate (invoiced in area 7). */
export interface WorkOrderService { id: string; itemId: string; qty: number; price: number; coverage: Coverage }
export interface WorkOrder {
  id: string; number: string; requestId?: string; estimateId?: string; assetId: string; partnerId: string; billingPartnerId: string
  maintenanceTypeId: string; expenseTypeId?: string; status: WorkOrderStatus
  plannedStart?: string; plannedEnd?: string; actualStart?: string; actualEnd?: string; leadTechnicianId?: string
  bookingIds: string[]; failureCodeId?: string; repairReason?: string; meterAtHandover?: number; reworkOfId?: string
  consumptionSeq: number; consumptionStatus: ConsumptionStatus; consumptionError?: string
  billingStatus: BillingStatus; billingBatch: number; depositRequired?: number
  operations: WorkOrderOperation[]; parts: WorkOrderPart[]; services: WorkOrderService[]; timeEntries: TimeEntry[]; removedParts: RemovedPart[]; statusHistory: StatusChange[]
  createdAt: string; holdReason?: string; cancelReason?: string; qcResult?: 'passed' | 'failed'; goodsIssueIds: string[]
}

export type BookingKind = 'workshop' | 'field'
export type BookingStatus = 'scheduled' | 'rescheduled' | 'inProgress' | 'completed' | 'cancelled'
export interface Booking {
  id: string; number: string; kind: BookingKind; date: string; start: string; end: string; slotId?: string
  technicianIds: string[]; bayId?: string; vehicle?: string; stops: { workOrderId: string; order: number }[]
  status: BookingStatus; rescheduleReason?: string; cancelReason?: string; actualStart?: string; actualEnd?: string
}
export interface TimeSlot { id: string; code: string; name: string; start: string; end: string; capacity: number }
export interface Leave { id: string; technicianId: string; from: string; to: string; source: 'hr' | 'manual'; note: string }
export interface AttendanceDay { technicianId: string; date: string; hours: number }

// ---------- simulated external documents ----------
export interface JournalLine { account: string; accountName: string; debit: number; credit: number }
export interface GoodsIssue {
  id: string; number: string; workOrderId: string; date: string; partnerId: string; idempotencyKey: string; canceled: boolean
  lines: { itemId: string; qty: number; unitCost: number; expenseAccount: string; expenseAccountName: string }[]; journal: JournalLine[]
}
export type PaymentStatus = 'O' | 'P' | 'C'
export interface ServiceInvoice {
  id: string; number: string; workOrderId: string; batchNo: number; date: string; partnerId: string
  lines: { itemId: string; qty: number; price: number; revenueAccount: string }[]; total: number; paidAmount: number
  paymentStatus: PaymentStatus; canceled: boolean; journal: JournalLine[]
}
export interface Receipt { id: string; number: string; partnerId: string; workOrderId?: string; date: string; amount: number; onAccount: boolean; applied: number; journal: JournalLine[] }
export interface Application { id: string; receiptId: string; invoiceId: string; amount: number; date: string; reversed: boolean }

export interface AuditEntry { id: string; at: string; userId: string; entity: string; entityId: string; action: string; detail: string }
export interface Task { id: string; kind: 'estimateApproval'; refId: string; approvalRequestId: string; roles: RoleId[]; status: 'open' | 'done' | 'cancelled'; createdAt: string }

export interface Counters { [prefix: string]: number }

export interface DB {
  asOf: string
  role: RoleId
  userId: string
  simulateError: boolean
  rolePerms: Record<RoleId, Perm[]>
  users: AppUser[]
  settings: Settings
  maintenanceTypes: MaintenanceType[]
  categories: AssetCategory[]
  failureCodes: FailureCode[]
  operations: StandardOperation[]
  workshops: Workshop[]
  expenseTypes: ExpenseType[]
  technicians: Technician[]
  partners: Partner[]
  items: Item[]
  warehouses: Warehouse[]
  stock: StockRow[]
  timeSlots: TimeSlot[]
  assets: Asset[]
  vehicles: VehicleDetails[]
  readings: MeterReading[]
  requests: MaintRequest[]
  estimates: Estimate[]
  approvals: ApprovalRequest[]
  tasks: Task[]
  workOrders: WorkOrder[]
  bookings: Booking[]
  leaves: Leave[]
  attendance: AttendanceDay[]
  goodsIssues: GoodsIssue[]
  invoices: ServiceInvoice[]
  receipts: Receipt[]
  applications: Application[]
  audit: AuditEntry[]
  counters: Counters
}
