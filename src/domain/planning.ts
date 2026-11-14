import Decimal from 'decimal.js'
import { quantity } from './math'
export interface Contribution {
  id: string
  itemId: string
  origin: 'manual' | 'recipe' | 'plan'
  originId: string
  quantity: string
}
export interface Change {
  itemId: string
  before: string
  after: string
  delta: string
  conflict: boolean
}
export function previewDiff(
  current: Contribution[],
  proposed: Contribution[],
  originId: string,
  purchased: Record<string, string>,
): Change[] {
  const old = current.filter((c) => c.origin === 'plan' && c.originId === originId)
  if (proposed.some((c) => c.origin !== 'plan' || c.originId !== originId))
    throw new Error('Provenienza non valida.')
  const ids = new Set([...old, ...proposed].map((c) => c.itemId))
  const sum = (rows: Contribution[], itemId: string) =>
    rows.filter((c) => c.itemId === itemId).reduce((a, c) => a.plus(quantity(c.quantity)), new Decimal(0))
  return [...ids]
    .map((itemId) => {
      const before = sum(current, itemId)
      const after = before.minus(sum(old, itemId)).plus(sum(proposed, itemId))
      return {
        itemId,
        before: before.toString(),
        after: after.toString(),
        delta: after.minus(before).toString(),
        conflict: after.lt(purchased[itemId] ?? 0),
      }
    })
    .filter((c) => c.delta !== '0')
}
export interface PaidPurchase {
  total_paid: string | null
  quantity: string
  voided_at: string | null
  purchased_at: string
  store_id?: string | null
}
export function statistics(purchases: PaidPurchase[], from: string, to: string, zone = 'Europe/Rome') {
  const date = (p: PaidPurchase) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(p.purchased_at))
  const selected = purchases.filter((p) => !p.voided_at && date(p) >= from && date(p) <= to)
  return {
    total: selected.reduce((s, p) => s.plus(p.total_paid ?? 0), new Decimal(0)).toFixed(2),
    unpriced: selected.filter((p) => p.total_paid === null).length,
    count: selected.length,
  }
}
