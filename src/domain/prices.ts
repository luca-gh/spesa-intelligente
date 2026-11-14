import Decimal from 'decimal.js'
import { dateInZone, money, packages, type Unit } from './math'

export interface Product {
  id: string
  generic_product_id: string | null
  name: string
  package_quantity: string | null
  package_unit: Unit | null
}
export interface Observation {
  id: string
  specific_product_id: string
  store_id: string
  price_amount: string
  kind: 'regular' | 'promotion' | 'unknown'
  observed_at: string
  promotion_starts_at: string | null
  promotion_ends_at: string | null
  voided_at: string | null
}
export interface DiscountRule {
  id: string
  store_id: string
  name: string
  percentage: string
  weekdays: number[]
  valid_from: string
  valid_to: string | null
  active: boolean
  confirmed: boolean
  exclude_promotional_items: boolean
  priority: number
  minimum_total: string
  maximum_discount: string | null
  excluded_product_ids: string[]
}
export interface RequestItem {
  id: string
  generic_product_id: string | null
  specific_product_id: string | null
  quantity: string
  unit: Unit
}
export function resolvePrice(
  observations: Observation[],
  productId: string,
  storeId: string,
  date: string,
  zone = 'Europe/Rome',
) {
  const candidates = observations
    .filter(
      (p) =>
        !p.voided_at &&
        p.specific_product_id === productId &&
        p.store_id === storeId &&
        dateInZone(new Date(p.observed_at), zone) <= date,
    )
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.id.localeCompare(b.id))
  const regular = candidates.find((p) => p.kind === 'regular')
  const promotion = candidates.find(
    (p) =>
      p.kind === 'promotion' &&
      p.promotion_starts_at &&
      p.promotion_ends_at &&
      p.promotion_starts_at <= date &&
      p.promotion_ends_at >= date,
  )
  // A valid promotion is selected explicitly, even if it is not cheaper than a historical regular price.
  const selected = promotion ?? regular
  return {
    selected,
    uncertain: candidates.some(
      (p) => p.kind === 'unknown' || (p.kind === 'promotion' && !p.promotion_ends_at),
    ),
    regular,
    promotion,
  }
}
export interface EstimateLine {
  itemId: string
  productId: string | null
  productName: string | null
  packs: number
  gross: string | null
  discount: string
  net: string | null
  observedAt: string | null
  promotional: boolean
  uncertain: boolean
  ruleName: string | null
}
export interface Estimate {
  storeId: string
  complete: boolean
  known: number
  totalItems: number
  total: string
  savings: string
  oldest: string | null
  lines: EstimateLine[]
}
export function estimate(
  storeId: string,
  items: RequestItem[],
  products: Product[],
  observations: Observation[],
  rules: DiscountRule[],
  date: string,
  zone = 'Europe/Rome',
): Estimate {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const eligibleRules = rules
    .filter(
      (r) =>
        r.store_id === storeId &&
        r.active &&
        r.confirmed &&
        r.weekdays.includes(weekday) &&
        r.valid_from <= date &&
        (!r.valid_to || r.valid_to >= date),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  const lines: EstimateLine[] = items
    .filter((item) => new Decimal(item.quantity).gt(0))
    .map((item) => {
      const options = products.filter((p) =>
        item.specific_product_id
          ? p.id === item.specific_product_id
          : !!item.generic_product_id && p.generic_product_id === item.generic_product_id,
      )
      const candidates: EstimateLine[] = []
      for (const product of options) {
        if (!product.package_quantity || !product.package_unit) continue
        const price = resolvePrice(observations, product.id, storeId, date, zone)
        if (!price.selected) continue
        let count: number
        try {
          count = packages(item.quantity, item.unit, product.package_quantity, product.package_unit)
        } catch {
          continue
        }
        const gross = new Decimal(price.selected.price_amount).mul(count)
        // Only one confirmed rule per line. Thresholds are evaluated on this line, explicitly in the UI.
        const rule = !price.uncertain
          ? eligibleRules.find(
              (r) =>
                !r.excluded_product_ids.includes(product.id) &&
                (!r.exclude_promotional_items || price.selected!.kind !== 'promotion') &&
                gross.gte(r.minimum_total),
            )
          : undefined
        const discount = rule
          ? Decimal.min(gross.mul(rule.percentage).div(100), rule.maximum_discount ?? gross).toDecimalPlaces(
              2,
            )
          : new Decimal(0)
        candidates.push({
          itemId: item.id,
          productId: product.id,
          productName: product.name,
          packs: count,
          gross: money(gross),
          discount: money(discount),
          net: money(gross.minus(discount)),
          observedAt: price.selected.observed_at,
          promotional: price.selected.kind === 'promotion',
          uncertain: price.uncertain,
          ruleName: rule?.name ?? null,
        })
      }
      candidates.sort((a, b) => new Decimal(a.net!).cmp(b.net!) || a.productId!.localeCompare(b.productId!))
      return (
        candidates[0] ?? {
          itemId: item.id,
          productId: null,
          productName: null,
          packs: 0,
          gross: null,
          discount: '0.00',
          net: null,
          observedAt: null,
          promotional: false,
          uncertain: false,
          ruleName: null,
        }
      )
    })
  const known = lines.filter((l) => l.net !== null)
  return {
    storeId,
    complete: known.length === lines.length && lines.length > 0,
    known: known.length,
    totalItems: lines.length,
    total: money(known.reduce((s, l) => s.plus(l.net!), new Decimal(0))),
    savings: money(known.reduce((s, l) => s.plus(l.discount), new Decimal(0))),
    oldest: known.map((l) => l.observedAt!).sort()[0] ?? null,
    lines,
  }
}
export function rank(estimates: Estimate[]): Estimate[] {
  return [...estimates].sort(
    (a, b) =>
      Number(b.complete) - Number(a.complete) ||
      (a.complete && b.complete ? new Decimal(a.total).cmp(b.total) : 0) ||
      a.storeId.localeCompare(b.storeId),
  )
}
