import Decimal from 'decimal.js'
import { convert, money, packages } from './math'
import type { Product, RequestItem } from './prices'
import type { CurrentPrice } from '../data/types'

export function matchesShoppingProduct(item: RequestItem, product: Product) {
  if (
    item.specific_product_id
      ? product.id !== item.specific_product_id
      : !item.generic_product_id || product.generic_product_id !== item.generic_product_id
  )
    return false
  if (item.preferred_brand && product.brand !== item.preferred_brand) return false
  try {
    return (
      !item.preferred_package_quantity ||
      !item.preferred_package_unit ||
      !!(
        product.package_quantity &&
        product.package_unit &&
        convert(product.package_quantity, product.package_unit, item.preferred_package_unit).eq(
          item.preferred_package_quantity,
        )
      )
    )
  } catch {
    return false
  }
}

export function compareCurrentPrices(
  storeId: string,
  items: RequestItem[],
  products: Product[],
  prices: CurrentPrice[],
) {
  const lines = items
    .filter((item) => new Decimal(item.quantity).gt(0))
    .map((item) => {
      const candidates: { productId: string; productName: string; packs: number; amount: string }[] = []
      for (const product of products) {
        if (!matchesShoppingProduct(item, product)) continue
        const price = prices.find((p) => p.store_id === storeId && p.specific_product_id === product.id)
        if (!price) continue
        try {
          let packs: number
          if (item.unit === 'conf') packs = new Decimal(item.quantity).ceil().toNumber()
          else {
            if (!product.package_quantity || !product.package_unit) continue
            packs = packages(item.quantity, item.unit, product.package_quantity, product.package_unit)
          }
          candidates.push({
            productId: product.id,
            productName: product.name,
            packs,
            amount: money(new Decimal(price.price_amount).mul(packs)),
          })
        } catch {
          /* A package with an incompatible or missing format cannot fulfill this item. */
        }
      }
      candidates.sort((a, b) => new Decimal(a.amount).cmp(b.amount) || a.productId.localeCompare(b.productId))
      return { itemId: item.id, ...candidates[0], amount: candidates[0]?.amount ?? null }
    })
  const known = lines.filter((line) => line.amount !== null).length
  return {
    storeId,
    lines,
    known,
    totalItems: lines.length,
    complete: lines.length > 0 && known === lines.length,
    total: money(lines.reduce((sum, line) => sum.plus(line.amount ?? 0), new Decimal(0))),
  }
}
