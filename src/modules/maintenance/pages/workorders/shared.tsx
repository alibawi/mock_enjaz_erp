import { Badge } from '../../components/ui'
import { billingStatus, consumptionStatus, woStatus } from '../../data/format'
import type { WorkOrder } from '../../data/types'

export const WoBadge = ({ w }: { w: WorkOrder }) => <Badge tone={woStatus[w.status].tone}>{woStatus[w.status].label}</Badge>
export const ConsBadge = ({ w }: { w: WorkOrder }) => <Badge tone={consumptionStatus[w.consumptionStatus].tone}>{consumptionStatus[w.consumptionStatus].label}</Badge>
export const BillBadge = ({ w }: { w: WorkOrder }) => <Badge tone={billingStatus[w.billingStatus].tone}>{billingStatus[w.billingStatus].label}</Badge>
