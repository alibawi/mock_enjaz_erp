// Foundation types shared by every module. Module-specific entities are added to DB by each module step.

export type RoleId = 'requester' | 'approver' | 'manager' | 'legal' | 'sales' | 'procurement' | 'finance' | 'admin'

export type Perm =
  | 'Contracts.View' | 'Contracts.Create' | 'Contracts.Edit' | 'Contracts.Delete' | 'Contracts.Submit' | 'Contracts.Approve'
  | 'Contracts.Reject' | 'Contracts.Activate' | 'Contracts.Suspend' | 'Contracts.Terminate' | 'Contracts.Cancel'
  | 'Contracts.Amend' | 'Contracts.Renew' | 'Contracts.ViewConfidential' | 'Contracts.Export'
  | 'Attachments.View' | 'Attachments.Upload' | 'Attachments.Download' | 'Attachments.Delete'
  | 'Fulfillment.Recalculate' | 'ContractTypes.Manage' | 'Templates.Manage' | 'Clauses.Manage'
  | 'Obligations.Manage' | 'Obligations.Complete' | 'Obligations.Accept' | 'ApprovalDelegations.Manage'
  | 'Reports.View' | 'Settings.Manage'

export type CurrencyCode = 'IQD' | 'USD'
/** BR-X-03: how much of the data a user may see. */
export type DataAuthority = 'User' | 'Org' | 'System'

export interface Organization { id: string; code: string; name: string; city: string }
export interface AppUser { id: string; name: string; title: string; role: RoleId; orgId: string; employeeId?: string }
export interface Employee { id: string; name: string; title: string; department: string; orgId: string }
export interface Partner {
  id: string; code: string; name: string; kind: 'customer' | 'vendor'; city: string; contact: string; phone: string; email: string
  paymentTermId: string; currency: CurrencyCode
}
export interface Currency { code: CurrencyCode; name: string; decimals: number; symbol: string }
/** Rate = IQD per 1 unit of `code`, effective from `date` (used by ActivationRate / DocumentDateRate). */
export interface ExchangeRate { code: CurrencyCode; date: string; rate: number }
export interface Uom { id: string; code: string; name: string }
export interface Category { id: string; code: string; name: string; parentId?: string }
export interface Item { id: string; code: string; name: string; categoryId: string; uomId: string; basePrice: number; currency: CurrencyCode }
export interface PaymentTerm { id: string; code: string; name: string; days: number }
export interface CostCenter { id: string; code: string; name: string }
export interface Project { id: string; code: string; name: string }

/** Append-only audit row written by every state-changing action. */
export interface AuditRow { id: string; at: string; userId: string; entity: string; entityId: string; action: string; detail: string }

export type SettingKey =
  | 'Agreements.EnforcementMode' | 'Agreements.FulfillmentBasis' | 'Agreements.ReturnsRestoreCommitment'
  | 'Agreements.OnFulfillmentFailure' | 'Currency.ConversionRateSource'
  | 'Reminder.Days' | 'Reminder.NoticeDays' | 'Renewal.GraceDays' | 'Approval.ReminderDays' | 'Approval.AllowCreatorApproval'
  | 'Feature.Obligations' | 'Feature.Templates' | 'Feature.Service' | 'Feature.ESignature' | 'Feature.RecurringBilling'
export type SettingValue = string | number | boolean

export interface Notice { id: string; at: string; text: string; tone: 'info' | 'warn' | 'danger'; seen: boolean }

// ───────────── Module 1: contracts ─────────────
export type ContractStatus =
  | 'Draft' | 'PendingApproval' | 'Approved' | 'PendingSignature' | 'Active' | 'OnHold' | 'Expired' | 'Terminated' | 'Cancelled' | 'Closed'
export type ContractProfile = 'General' | 'Agreement' | 'Service'
export type Direction = 'Outgoing' | 'Incoming' | 'Internal'
export type Confidentiality = 'Normal' | 'Confidential' | 'Restricted'
export type RenewalPolicy = 'None' | 'Manual' | 'Auto'
export type TypeCategory = 'Sales' | 'Procurement' | 'Service' | 'Legal' | 'Lease' | 'Project' | 'Other'
export type PartyRole = 'Counterparty' | 'Guarantor' | 'Witness' | 'Subcontractor' | 'Beneficiary' | 'Other'
export type SignatureMethod = 'Wet' | 'Uploaded' | 'ExternalProvider'
export type ClosureReason = 'Completed' | 'Renewed' | 'Archived'
export type LinkType = 'Source' | 'Release' | 'Fulfillment' | 'Invoice' | 'Related'

export interface ContractType {
  id: string; code: string; prefix: string; name: string; category: TypeCategory; profile: ContractProfile; defaultDirection: Direction
  requiresSignature: boolean; requiredSignatureRoles: string[]; requiresApproval: boolean
  renewalPolicyDefault: RenewalPolicy; defaultDurationMonths?: number; noticePeriodDaysDefault?: number
  renewalGraceDays?: number; reminderDaysDefault?: string
  /** Nullable overrides of the system settings (null = use the setting). */
  enforcementMode?: 'None' | 'Warn' | 'Block'; fulfillmentBasis?: 'Order' | 'Delivery' | 'Invoice'; returnsRestoreCommitment?: boolean
  isOpenEnded: boolean; requiresContractValue: boolean; requiresPaymentTerm: boolean; defaultConfidentiality: Confidentiality
  allowManualNumber: boolean; isActive: boolean
  /** Digits of the serial part of the contract number (default 6). */
  numberSize?: number
}

export interface Contract {
  id: string; number: string; title: string; typeId: string; profile: ContractProfile; direction: Direction; status: ContractStatus; versionNo: number
  counterpartyId?: string; counterpartyName?: string; ownerUserId: string; responsibleEmployeeId?: string; organizationId: string
  projectId?: string; costCenterId?: string; currency: CurrencyCode; exchangeRate?: number; contractValue?: number
  paymentTermId?: string; deliveryTerms?: string
  startDate: string; endDate?: string; signatureDate?: string; effectiveDate?: string; terminationDate?: string
  renewalPolicy: RenewalPolicy; noticePeriodDays?: number; autoRenewTermMonths?: number; reminderDaysOverride?: string
  confidentiality: Confidentiality; language: 'ar'; externalReference?: string
  parentContractId?: string; renewedFromContractId?: string; successorContractId?: string; templateVersionId?: string
  agreementMode?: 'Specific' | 'General'; overridesPrices: boolean
  closureReason?: ClosureReason; activatedOn?: string; activatedBy?: string
  description: string; internalNotes: string; createdBy: string; createdAt: string
}

export interface ContractParty {
  id: string; contractId: string; role: PartyRole; partnerId?: string; name: string; contactName: string; email: string; phone: string
  signatoryTitle: string; isPrimary: boolean
}
export interface ContractSignature {
  id: string; contractId: string; partyId?: string; role: string; signerName: string; signerTitle: string; signedOn: string
  method: SignatureMethod; attachmentId?: string; externalSignatureId?: string
}
export interface StatusHistory {
  id: string; contractId: string; from?: ContractStatus; to: ContractStatus; byUserId: string; at: string; reason?: string
}
export interface DocumentLink { id: string; contractId: string; linkType: LinkType; docType: string; docId: string; docRef: string; docDate: string }

/** Agreement/Service commitment line (full engine in module 3). */
export interface ContractLine {
  id: string; contractId: string; lineNum: number; itemId?: string; categoryId?: string; includeSubcategories?: boolean; description: string; uomId?: string
  commitmentType: 'Quantity' | 'Value'; agreedQuantity?: number; agreedValue?: number; unitPrice: number; discountPercent: number
  priceFixed: boolean; enforceMax: boolean; minRelease?: number; maxRelease?: number; validFrom?: string; validTo?: string
  status: 'Open' | 'Closed'; notes: string
}

export interface ContractAttachmentRow {
  id: string; ownerType: 'contract'; ownerId: string; subType: 'Draft' | 'Signed' | 'Appendix' | 'Other'
  fileName: string; size: number; contentType: string; uploadedBy: string; uploadedAt: string; version: number
}

// ───────────── Module 2: workflow (Elsa approval simulation, tasks, delegation, e-signature) ─────────────
export type SubjectType = 'Contract' | 'Amendment' | 'Termination'
export interface ApprovalStageDef { no: number; label: string; userId: string; isLegalReview?: boolean }
export interface ApprovalStageRule {
  id: string; name: string; subjectType: SubjectType; typeId?: string; organizationId?: string
  /** Contract value converted to IQD. */
  minValueIQD: number; maxValueIQD?: number; stages: ApprovalStageDef[]; isActive: boolean
}
export type StageStatus = 'waiting' | 'open' | 'approved' | 'rejected'
export interface ApprovalRequest {
  id: string; subjectType: SubjectType; subjectId: string; contractId: string; ruleId: string; ruleName: string
  /** Snapshot of the stages at submission (later rule edits do not change a pending request). */
  stages: (ApprovalStageDef & { status: StageStatus })[]
  workflowInstanceId: string; status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'; currentStage: number
  valueIQD: number; submittedBy: string; submittedAt: string; completedAt?: string
}
export interface ApprovalAction {
  id: string; requestId: string; stageNo: number; approverUserId: string; onBehalfOfUserId?: string
  decision: 'Approved' | 'Rejected'; comment: string; taskId: string; decidedAt: string
}
export interface TaskItem {
  id: string; requestId: string; contractId: string; subjectType: SubjectType; stageNo: number; assignedUserId: string
  status: 'Open' | 'Completed' | 'Cancelled'; result: 'Pending' | 'Approved' | 'Rejected'; title: string; createdAt: string; completedAt?: string
}
export interface ApprovalDelegation {
  id: string; fromUserId: string; toUserId: string; fromDate: string; toDate: string
  scopeType: 'All' | 'ContractType' | 'Organization'; scopeId?: string; reason: string; isActive: boolean
}
export type SignatureRequestStatus = 'Draft' | 'Sent' | 'PartiallySigned' | 'Signed' | 'Declined' | 'Expired'
export interface SignatureSigner { id: string; role: 'Counterparty' | 'Company'; name: string; title: string; partyId?: string; status: 'Pending' | 'Signed' | 'Declined'; signedOn?: string }
export interface SignatureRequest {
  id: string; contractId: string; provider: string; status: SignatureRequestStatus; signers: SignatureSigner[]; externalId: string; sentAt: string; sentBy: string
}

// ───────────── Module 3: agreements (fulfillment ledger, mock Sales/Procurement/Inventory documents) ─────────────
export type DocType = 'SOR' | 'DLN' | 'INV' | 'RET' | 'SIN' | 'POR' | 'PDN' | 'PCH' | 'RPC' | 'SOT'
export type DocState = 'Active' | 'Cancelled' | 'Reversed' | 'Deleted' | 'Unlinked'
export type CounterType = 'Release' | 'Fulfill' | 'Invoice'
export type LedgerReason = 'Posted' | 'Cancelled' | 'Returned' | 'Reversed' | 'Edited' | 'Recalculated' | 'Exceeded'
export interface MockDocLine {
  id: string; itemId: string; qty: number
  /** Unit price and net value in the document currency; local value in IQD. */
  unitPrice: number; netValueDoc: number; netValueLocal: number; agreementLineNum?: number
}
/** A document of the Sales / Procurement / Inventory modules, simulated by the demo document simulator. */
export interface MockDoc {
  id: string; docType: DocType; ref: string; date: string; partnerId: string; organizationId: string; currency: CurrencyCode
  /** IQD per 1 unit of `currency` on the document. */
  rate: number; agreementId?: string; baseDocId?: string; stockMovement?: boolean; state: DocState; revision: number; lines: MockDocLine[]
}
export interface LedgerEntry {
  id: string; contractId: string; lineId: string; lineNum: number; entryType: CounterType
  sourceDocType: DocType; sourceDocId: string; sourceLineId: string; sourceDocRef: string; sourceDocDate: string; sourceRevision: number; sequence: number
  quantityDelta: number; valueDelta: number; docCurrency: CurrencyCode; docValueDelta: number; rateUsed: number; reason: LedgerReason; createdOn: string
}
/** Derived cache of the ledger per line (recalculate rebuilds it). Values in the contract currency. */
export interface LineBalance { relQ: number; relV: number; fulQ: number; fulV: number; invQ: number; invV: number }
export interface DeliveryScheduleItem { id: string; lineId: string; dueDate: string; quantity: number; value?: number; note: string }

// ───────────── Module 4: amendments, versions, renewal ─────────────
export type AmendmentType = 'ExtendTerm' | 'ChangeValue' | 'ChangeLines' | 'ChangeParties' | 'ChangeTerms' | 'Other'
export type AmendmentStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Applied' | 'Rejected' | 'Cancelled'
export type HeaderField = 'endDate' | 'contractValue' | 'renewalPolicy' | 'noticePeriodDays' | 'autoRenewTermMonths' | 'deliveryTerms' | 'paymentTermId' | 'description'
export interface HeaderChange { path: HeaderField; oldValue: string | number | undefined; newValue: string | number | undefined }
export type LineFields = Partial<Pick<ContractLine, 'agreedQuantity' | 'agreedValue' | 'unitPrice' | 'discountPercent' | 'minRelease' | 'maxRelease' | 'validTo' | 'notes'>>
/** Add creates a line with a new lineNum (never reused); Change edits the listed fields; Close keeps the line but stops new releases. */
export interface LineOp {
  op: 'Add' | 'Change' | 'Close'; lineNum?: number; fields?: LineFields; old?: LineFields
  add?: Pick<ContractLine, 'itemId' | 'categoryId' | 'includeSubcategories' | 'description' | 'uomId' | 'commitmentType' | 'agreedQuantity' | 'agreedValue' | 'unitPrice' | 'discountPercent' | 'priceFixed' | 'enforceMax'>
}
export interface PartyOp { op: 'Add' | 'Change' | 'Remove'; partyId?: string; fields?: Partial<Pick<ContractParty, 'name' | 'role' | 'contactName' | 'email' | 'phone' | 'signatoryTitle'>>; old?: Partial<ContractParty> }
export interface ContractAmendment {
  id: string; contractId: string; amendmentNo: number; type: AmendmentType; status: AmendmentStatus; reason: string; effectiveDate: string; baseVersionNo: number
  header: HeaderChange[]; lineOps: LineOp[]; partyOps: PartyOp[]; approvalRequestId?: string
  appliedVersionNo?: number; appliedOn?: string; appliedBy?: string; createdBy: string; createdAt: string; decidedAt?: string
}
export interface VersionPayload {
  header: Record<string, string | number | undefined>
  terms: Record<string, string | number | undefined>
  parties: Pick<ContractParty, 'id' | 'role' | 'name' | 'contactName' | 'email' | 'phone' | 'signatoryTitle'>[]
  lines: Pick<ContractLine, 'lineNum' | 'itemId' | 'categoryId' | 'description' | 'commitmentType' | 'agreedQuantity' | 'agreedValue' | 'unitPrice' | 'discountPercent' | 'minRelease' | 'maxRelease' | 'validTo' | 'status' | 'notes'>[]
  signatures: { role: string; signerName: string; signedOn: string }[]
  clauses?: { order: number; title: string; body: string; isIncluded: boolean }[]
}
export interface ContractVersion {
  id: string; contractId: string; versionNo: number; reason: 'Activation' | 'Amendment' | 'Renewal'; amendmentId?: string
  payload: VersionPayload; payloadHash: string; createdOn: string; createdBy: string
}

// ───────────── Module 5: obligations, payment schedule, billing, guarantees ─────────────
export type ObligationKind = 'Deliverable' | 'Milestone' | 'Payment' | 'Reporting' | 'SLA' | 'Recurring' | 'Other'
export type ObligationStatus = 'Planned' | 'InProgress' | 'Completed' | 'Accepted' | 'Rejected' | 'Waived' | 'Cancelled'
export type PenaltyType = 'None' | 'FixedPerDay' | 'PercentPerDay' | 'Fixed'
export interface Recurrence { freq: 'daily' | 'weekly' | 'monthly' | 'yearly'; count?: number; until?: string }
export interface Obligation {
  id: string; contractId: string; kind: ObligationKind; title: string; description: string; dueDate: string
  responsibleEmployeeId?: string; responsibleDepartment?: string; quantity?: number; value?: number; status: ObligationStatus
  completedOn?: string; completedBy?: string; acceptedOn?: string; acceptedBy?: string; acceptanceRequired: boolean; survivesTermination: boolean
  penaltyType: PenaltyType; penaltyRate?: number; penaltyCap?: number; recurrence?: Recurrence; dependsOnId?: string; linkedPaymentItemId?: string
  attachments: string[]; createdBy: string; createdAt: string
}
export interface ObligationOccurrence { id: string; obligationId: string; dueDate: string; status: 'Planned' | 'Completed' | 'Waived'; completedOn?: string }
export type PaymentKind = 'Advance' | 'Milestone' | 'Periodic' | 'Retention' | 'Final'
export type PaymentStatus = 'Planned' | 'Due' | 'Invoiced' | 'Paid' | 'Cancelled'
export type BillingDocType = 'PurchaseOrder' | 'PurchaseBill' | 'PurchaseTemplate' | 'SaleOrder' | 'SaleInvoice' | 'SalesTemplate'
export interface PaymentItem {
  id: string; contractId: string; itemNo: number; kind: PaymentKind; dueDate: string; percent?: number; amount: number; currency: CurrencyCode
  obligationId?: string; agreementLineNum?: number; status: PaymentStatus; billingDocType?: BillingDocType; billingId?: string
  /** Undefined while the settlement from Finance is unknown. */
  paidAmount?: number; paidOn?: string; notes: string
}
export interface BillingRecord {
  id: string; contractId: string; paymentItemId: string; docType: BillingDocType; ref: string; date: string; amount: number; currency: CurrencyCode
  template: boolean; ledgerDocId?: string; note: string; createdBy: string
}
export interface Guarantee { id: string; contractId: string; type: 'Performance' | 'Advance' | 'Retention'; amount: number; currency: CurrencyCode; issuer: string; expiryDate: string; status: 'Active' | 'Expired' | 'Released' }

// ───────────── Module 6: templates, clauses, contract terms, print ─────────────
export interface Clause { id: string; code: string; title: string; category: string; currentVersionNo: number; isActive: boolean }
export interface ClauseVersion { id: string; clauseId: string; versionNo: number; body: string; publishedOn: string; publishedBy: string }
export interface TemplateDefaults {
  durationMonths?: number; renewalPolicy?: RenewalPolicy; noticePeriodDays?: number; paymentTermId?: string; deliveryTerms?: string
  approvalWorkflowLabel?: string; billingDefaults?: string; slaDefaults?: string
}
/** Working copy of a template: clauses are referenced by clause (the version is fixed at publish). */
export interface TemplateDraft { defaults: TemplateDefaults; clauses: { clauseId: string; order: number; isOptional: boolean }[]; attachments: string[] }
export interface ContractTemplate { id: string; code: string; name: string; typeId: string; currentVersionNo: number; status: 'Draft' | 'Published' | 'Archived'; draft: TemplateDraft }
export interface TemplateVersion {
  id: string; templateId: string; versionNo: number; defaults: TemplateDefaults; clauseRefs: { clauseVersionId: string; order: number; isOptional: boolean }[]
  attachments: string[]; publishedOn: string; publishedBy: string
}
export interface ContractTerm {
  id: string; contractId: string; order: number; section: string; title: string; body: string; clauseVersionId?: string; isOptional: boolean; isIncluded: boolean; isFree: boolean
}
export interface PrintLogEntry { id: string; contractId: string; at: string; byUserId: string; draft: boolean; doc?: string }

// ───────────── Module 7: service contracts (coverage, SLA, service-call simulator) ─────────────
export interface ServiceLevel {
  id: string; contractId: string; responseHours: number; resolutionHours: number; includedHours?: number; includedVisits?: number
  warrantyStart?: string; warrantyEnd?: string; limits: string
}
export interface CoverageWindow { id: string; contractId: string; dayOfWeek: number; fromTime: string; toTime: string }
export interface CoverageExclusion { id: string; contractId: string; date: string; reason: string }
export interface CoveredItem { id: string; contractId: string; itemId?: string; serial?: string; assetRef?: string; description: string; warrantyStart?: string; warrantyEnd?: string }
export type CallStatus = 'Open' | 'Responded' | 'Resolved' | 'Closed'
export interface ServiceCall {
  id: string; no: string; customerId: string; itemId?: string; serial?: string; description: string; severity: 'Critical' | 'Normal'
  /** Local date-time (YYYY-MM-DDTHH:mm). */
  openedAt: string; status: CallStatus; respondedAt?: string; resolvedAt?: string; closedAt?: string
  contractId?: string; hoursConsumed: number; visits: number; outsideCoverage: boolean; billable: boolean; responseDue?: string; resolutionDue?: string; note: string
}
export interface ServiceConsumption { id: string; contractId: string; callId: string; hours: number; visits: number; date: string }
export interface SlaEvent { id: string; callId: string; contractId: string; kind: 'ResponseMet' | 'ResponseBreached' | 'ResolutionMet' | 'ResolutionBreached'; at: string }

export interface DB {
  /** Current role and user (role switcher). */
  role: RoleId
  userId: string
  /** Demo "today" (YYYY-MM-DD). Business logic reads it through asof.ts. */
  asOf: string
  /** When true, mockApi calls fail (to show error states). */
  simulateError: boolean
  settings: Record<SettingKey, SettingValue>
  rolePerms: Record<RoleId, Perm[]>
  organizations: Organization[]
  users: AppUser[]
  employees: Employee[]
  partners: Partner[]
  currencies: Currency[]
  rates: ExchangeRate[]
  uoms: Uom[]
  categories: Category[]
  items: Item[]
  paymentTerms: PaymentTerm[]
  costCenters: CostCenter[]
  projects: Project[]
  audit: AuditRow[]
  notices: Notice[]
  contractTypes: ContractType[]
  contracts: Contract[]
  parties: ContractParty[]
  signatures: ContractSignature[]
  history: StatusHistory[]
  links: DocumentLink[]
  lines: ContractLine[]
  attachments: ContractAttachmentRow[]
  /** Alert keys the current user marked as read. */
  alertsSeen: string[]
  /** Per-type sequence counters for contract numbers. */
  numbering: Record<string, number>
  stageRules: ApprovalStageRule[]
  approvalRequests: ApprovalRequest[]
  approvalActions: ApprovalAction[]
  tasks: TaskItem[]
  delegations: ApprovalDelegation[]
  signatureRequests: SignatureRequest[]
  mockDocs: MockDoc[]
  ledger: LedgerEntry[]
  balances: Record<string, LineBalance>
  schedules: DeliveryScheduleItem[]
  amendments: ContractAmendment[]
  versions: ContractVersion[]
  obligations: Obligation[]
  occurrences: ObligationOccurrence[]
  paymentItems: PaymentItem[]
  billingLog: BillingRecord[]
  guarantees: Guarantee[]
  clauses: Clause[]
  clauseVersions: ClauseVersion[]
  templates: ContractTemplate[]
  templateVersions: TemplateVersion[]
  terms: ContractTerm[]
  printLog: PrintLogEntry[]
  serviceLevels: ServiceLevel[]
  coverageWindows: CoverageWindow[]
  coverageExclusions: CoverageExclusion[]
  coveredItems: CoveredItem[]
  serviceCalls: ServiceCall[]
  consumption: ServiceConsumption[]
  slaEvents: SlaEvent[]
  userScopes: Record<string, DataAuthority>
}
