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

export function catalogCategoryCounts(data: Data) {
  const categories = orderedCategories(data.categories)
  const fallback = categories.find((c) => c.name === 'Altri prodotti')
  const counts = new Map<string | null, number>()
  const categoryIds = new Set(categories.map((c) => c.id))
  let total = 0
  for (const entry of catalogProducts(data)) {
    if (entry.product.archived_at) continue
    const categoryId =
      entry.categoryId && categoryIds.has(entry.categoryId) ? entry.categoryId : (fallback?.id ?? null)
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1)
    total++
  }
  const rows = categories.map((c) => ({
    id: c.id as string | null,
    name: c.name,
    count: counts.get(c.id) ?? 0,
  }))
  if (counts.has(null)) rows.push({ id: null, name: 'Altri prodotti', count: counts.get(null)! })
  return { total, rows }
}
