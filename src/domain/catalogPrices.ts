import { convert, euro, quantity, unitLabel, parsePrice, type Unit } from './math'
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

export type PriceBasis = 'package' | 'kg' | 'l'
export function unitPrice(
  amount: string,
  product: Pick<Product, 'package_quantity' | 'package_unit'>,
  basis: PriceBasis = 'package',
) {
  if (basis !== 'package')
    return { amount: quantity(amount).toFixed(2), unit: basis === 'l' ? ('L' as const) : ('kg' as const) }
  const unit: Unit | null =
    product.package_unit === 'g' || product.package_unit === 'kg'
      ? 'kg'
      : product.package_unit === 'ml' || product.package_unit === 'L'
        ? 'L'
        : product.package_unit === 'pz'
          ? 'pz'
          : null
  if (!unit || !product.package_quantity) return null
  const size = convert(product.package_quantity, product.package_unit!, unit)
  if (!size.gt(0)) return null
  return { amount: quantity(amount).div(size).toFixed(2), unit }
}

export function unitPriceLabel(
  amount: string,
  product: Pick<Product, 'package_quantity' | 'package_unit'>,
  basis: PriceBasis = 'package',
) {
  const price = unitPrice(amount, product, basis)
  return price ? `${euro(price.amount)}/${unitLabel(price.unit)}` : '-'
}
export function catalogPriceLabel(amount: string, basis: PriceBasis = 'package') {
  return basis === 'package' ? euro(amount) : `${euro(amount)}/${basis}`
}
export function validatePriceBasis(unit: string | null | undefined, basis: PriceBasis) {
  if (!unit || basis === 'package') return
  if (basis === 'kg' ? !['g', 'kg'].includes(unit) : !['ml', 'L'].includes(unit))
    throw new Error('Prezzo non valido: scegli un tipo di prezzo compatibile con il formato del prodotto.')
}
export function pricePreview(
  amount: string,
  product: Pick<Product, 'package_quantity' | 'package_unit'>,
  basis: PriceBasis,
) {
  try {
    return amount.trim() ? unitPriceLabel(parsePrice(amount), product, basis) : '-'
  } catch {
    return '-'
  }
}
