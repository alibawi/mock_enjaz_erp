// Simulated journal entries (display only — the real postings belong to Inventory, Sales and Finance).
import type { DB, GoodsIssue, JournalLine } from './types'

/** Goods Issue: Dr expense account per line group (expense type / COGS), Cr warehouse inventory account (§21, decision 1c). */
export function issueJournal(d: DB, gi: GoodsIssue): JournalLine[] {
  const wh = d.warehouses[0]
  const groups = new Map<string, JournalLine>()
  for (const l of gi.lines) {
    const amount = Math.round(l.qty * l.unitCost)
    const g = groups.get(l.expenseAccount) ?? { account: l.expenseAccount, accountName: l.expenseAccountName, debit: 0, credit: 0 }
    g.debit += amount
    groups.set(l.expenseAccount, g)
  }
  const total = [...groups.values()].reduce((s, g) => s + g.debit, 0)
  return [...groups.values(), { account: wh.inventoryAccount, accountName: `المخزون — ${wh.name}`, debit: 0, credit: total }]
}
