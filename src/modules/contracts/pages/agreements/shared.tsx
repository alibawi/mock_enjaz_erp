import { Badge } from '../../components/ui'
import { money, num } from '../../data/format'
import { reasonLabel, stateLabel } from '../../data/fulfillment'
import type { Contract, ContractLine, DB, DocState, LedgerReason } from '../../data/types'

export const qty = (n: number) => num(n, Number.isInteger(n) ? 0 : 2)
export const unitName = (db: DB, l: ContractLine) => db.uoms.find((u) => u.id === l.uomId)?.name ?? ''
/** A line amount in its own unit: quantity with UoM, or a value in the contract currency. */
export const fmtUnits = (db: DB, c: Contract, l: ContractLine, n: number) => (l.commitmentType === 'Quantity' ? `${qty(n)} ${unitName(db, l)}` : money(n, c.currency))
export const lineTarget = (db: DB, l: ContractLine) =>
  l.itemId ? db.items.find((i) => i.id === l.itemId)?.name ?? l.description
    : `${db.categories.find((k) => k.id === l.categoryId)?.name ?? ''}${l.includeSubcategories ? ' (مع التصنيفات الفرعية)' : ''}`

const stateTone: Record<DocState, 'green' | 'gray' | 'amber' | 'red'> = { Active: 'green', Cancelled: 'gray', Reversed: 'amber', Deleted: 'red', Unlinked: 'amber' }
export const DocStateBadge = ({ state }: { state: DocState }) => <Badge tone={stateTone[state]}>{stateLabel[state]}</Badge>

const reasonTone: Record<LedgerReason, 'green' | 'gray' | 'amber' | 'red' | 'blue'> = {
  Posted: 'green', Cancelled: 'gray', Returned: 'blue', Reversed: 'amber', Edited: 'blue', Recalculated: 'gray', Exceeded: 'red',
}
export const ReasonBadge = ({ reason }: { reason: LedgerReason }) => <Badge tone={reasonTone[reason]}>{reasonLabel[reason]}</Badge>

export const signed = (n: number, d = 0) => `${n > 0 ? '+' : ''}${num(n, Number.isInteger(n) ? 0 : d || 2)}`
