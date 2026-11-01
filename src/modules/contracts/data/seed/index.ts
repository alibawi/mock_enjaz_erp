import { DEFAULT_TODAY } from '../asof'
import { defaultRolePerms } from '../permissions'
import { defaultSettings } from '../settings'
import type { DB } from '../types'
import { contractTypes, contractsSeed } from './contracts'
import * as s from './shared'
import { agreementsSeed } from './agreements'
import { amendmentsSeed } from './amendments'
import { financeSeed } from './finance'
import { serviceSeed } from './service'
import { templatesSeed } from './templates'
import { workflowSeed } from './workflow'

/** Fresh demo database. Module seeds (contracts, agreements, ...) are merged here by each module step. */
export function seed(): DB {
  const cs = contractsSeed()
  const db: DB = {
    role: 'admin',
    userId: 'u-adm',
    asOf: DEFAULT_TODAY,
    simulateError: false,
    settings: defaultSettings(),
    rolePerms: structuredClone(defaultRolePerms),
    organizations: s.organizations,
    users: s.users,
    employees: s.employees,
    partners: s.partners,
    currencies: s.currencies,
    rates: s.rates,
    uoms: s.uoms,
    categories: s.categories,
    items: s.items,
    paymentTerms: s.paymentTerms,
    costCenters: s.costCenters,
    projects: s.projects,
    audit: [],
    notices: [],
    contractTypes,
    contracts: cs.contracts,
    parties: cs.parties,
    signatures: cs.signatures,
    history: cs.history,
    links: cs.links,
    lines: cs.lines,
    attachments: cs.attachments,
    alertsSeen: [],
    numbering: cs.numbering,
    stageRules: [],
    approvalRequests: [],
    approvalActions: [],
    tasks: [],
    delegations: [],
    signatureRequests: [],
    mockDocs: [],
    ledger: [],
    balances: {},
    schedules: [],
    amendments: [],
    versions: [],
    obligations: [],
    occurrences: [],
    paymentItems: [],
    billingLog: [],
    guarantees: [],
    clauses: [],
    clauseVersions: [],
    templates: [],
    templateVersions: [],
    terms: [],
    printLog: [],
    serviceLevels: [],
    coverageWindows: [],
    coverageExclusions: [],
    coveredItems: [],
    serviceCalls: [],
    consumption: [],
    slaEvents: [],
    userScopes: { 'u-req': 'Org', 'u-sal': 'Org', 'u-pro': 'Org', 'u-bsr': 'Org', 'u-app': 'System', 'u-mgr': 'System', 'u-leg': 'System', 'u-fin': 'System', 'u-adm': 'System', 'u-fd': 'System', 'u-gm': 'System' },
  }
  workflowSeed(db)
  agreementsSeed(db)
  templatesSeed(db)
  amendmentsSeed(db)
  financeSeed(db)
  serviceSeed(db)
  return db
}
