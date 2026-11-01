// Currency helpers (module 3 extends this with document-to-contract conversion, ADR-18).
import type { CurrencyCode, DB } from './types'

/** IQD per 1 unit of `code`, effective on `date` (latest rate on or before the date; IQD = 1). */
export function rateOn(db: DB, code: CurrencyCode, date: string): number {
  if (code === 'IQD') return 1
  const list = db.rates.filter((r) => r.code === code).sort((a, b) => a.date.localeCompare(b.date))
  const hit = [...list].reverse().find((r) => r.date <= date) ?? list[0]
  return hit?.rate ?? 1
}

/** Converts an amount between currencies through IQD using the rates on `date`. */
export function convertAmount(db: DB, amount: number, from: CurrencyCode, to: CurrencyCode, date: string): number {
  if (from === to) return amount
  return (amount * rateOn(db, from, date)) / rateOn(db, to, date)
}
