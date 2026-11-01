import { today } from './asof'
import type { CurrencyCode } from './types'

export type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue'

const decimals: Record<CurrencyCode, number> = { IQD: 0, USD: 2 }

export const num = (n: number, d = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const money = (n: number, cur: CurrencyCode = 'IQD') => `${num(n, decimals[cur])} ${cur}`
export const pct = (n: number) => `${num(n, 1)}%`

export const months = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']
/** 2026-10-30 -> 30 تشرين الأول 2026 */
export const fmtDate = (d?: string) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return `${day} ${months[m - 1]} ${y}`
}
export const fmtDateTime = (d: string) => `${fmtDate(d)} ${d.length > 10 ? d.slice(11, 16) : ''}`.trim()
export const daysTo = (d: string, from = today()) => {
  const [y1, m1, d1] = d.split('-').map(Number)
  const [y2, m2, d2] = from.split('-').map(Number)
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000)
}
/** Next sequential id with prefix, e.g. nextId('AUD', rows) */
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`
export const nowStamp = () => `${today()}T${new Date().toTimeString().slice(0, 5)}`
