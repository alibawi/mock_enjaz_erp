import { warrantyState, type WarrantyState } from '../../data/assets'
import { Badge } from '../../components/ui'
import type { Tone } from '../../data/format'
import type { Asset } from '../../data/types'

export const warrantyMeta: Record<WarrantyState, { label: string; tone: Tone }> = {
  valid: { label: 'ضمان ساري', tone: 'green' },
  expiring: { label: 'ينتهي قريبًا', tone: 'amber' },
  expired: { label: 'ضمان منتهٍ', tone: 'red' },
  none: { label: 'بلا ضمان', tone: 'gray' },
}
export const stateMeta: Record<Asset['state'], { label: string; tone: Tone }> = {
  active: { label: 'فعال', tone: 'green' },
  loaned: { label: 'معار', tone: 'blue' },
  retired: { label: 'متقاعد', tone: 'gray' },
}

export const WarrantyBadge = ({ asset }: { asset: Asset }) => {
  const m = warrantyMeta[warrantyState(asset)]
  return <Badge tone={m.tone}>{m.label}</Badge>
}
export const StateBadge = ({ asset }: { asset: Asset }) => <Badge tone={stateMeta[asset.state].tone}>{stateMeta[asset.state].label}</Badge>

/** Reference to another module (fixed assets / contracts) — shown as a number only in this isolated mock. */
export const RefChip = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-600" title="رقم مرجعي فقط — الربط الفعلي لاحقًا">
      {label}: <span className="font-mono" dir="ltr">{value}</span>
    </span>
  ) : null
