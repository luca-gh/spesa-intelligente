import { convert, euro, quantity, type Unit } from './math'
import type { Observation, Product } from './prices'

export function latestProductPrice(observations: Observation[], productId: string, storeId: string) {
  return observations
    .filter((o) => !o.voided_at && o.specific_product_id === productId && o.store_id === storeId)
    .sort(
      (a, b) =>
        b.observed_at.localeCompare(a.observed_at) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
        b.id.localeCompare(a.id),
    )[0]
}

export function unitPrice(amount: string, product: Pick<Product, 'package_quantity' | 'package_unit'>) {
  const unit: Unit | null =
    product.package_unit === 'g' || product.package_unit === 'kg'
      ? 'kg'
      : product.package_unit === 'ml' || product.package_unit === 'L'
        ? 'L'
        : null
  if (!unit || !product.package_quantity) return null
  const size = convert(product.package_quantity, product.package_unit!, unit)
  if (!size.gt(0)) return null
  return { amount: quantity(amount).div(size).toFixed(2), unit }
}

export function unitPriceLabel(amount: string, product: Pick<Product, 'package_quantity' | 'package_unit'>) {
  const price = unitPrice(amount, product)
  return price ? `${euro(price.amount)}/${price.unit === 'L' ? 'l' : 'kg'}` : '-'
}
