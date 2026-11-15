import type { Category, Data } from './types'
import type { Product } from '../domain/prices'

export function orderedCategories(categories: Category[]) {
  return [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it') || a.id.localeCompare(b.id),
  )
}

export function productFormat(product: Pick<Product, 'package_quantity' | 'package_unit'>) {
  return product.package_quantity && product.package_unit
    ? `${product.package_quantity} ${product.package_unit}`
    : 'Formato non indicato'
}

export function catalogProducts(data: Data) {
  const generics = new Map(data.generic_products.map((g) => [g.id, g]))
  return [
    ...data.generic_products
      .filter((g) => !g.is_catalog_group)
      .map((product) => ({ kind: 'generic' as const, product, categoryId: product.category_id })),
    ...data.specific_products.map((product) => ({
      kind: 'specific' as const,
      product,
      categoryId: generics.get(product.generic_product_id ?? '')?.category_id ?? null,
    })),
  ].sort(
    (a, b) =>
      a.product.name.localeCompare(b.product.name, 'it', { sensitivity: 'base', numeric: true }) ||
      a.kind.localeCompare(b.kind) ||
      a.product.id.localeCompare(b.product.id),
  )
}

export function ingredientProducts(data: Data) {
  const activeGroups = new Set(
    data.specific_products.filter((s) => !s.archived_at).map((s) => s.generic_product_id),
  )
  return data.generic_products.filter((g) => (g.is_catalog_group ? activeGroups.has(g.id) : !g.archived_at))
}
