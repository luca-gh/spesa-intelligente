import type { Category, Data } from './types'
import type { Product } from '../domain/prices'
import { convert, unitLabel, type Unit } from '../domain/math'
import { matchingChoices, type SearchChoice } from '../domain/choices'

export function catalogFormatFields(size: string | null | undefined, unit: Unit | '' | null | undefined) {
  if (unit === 'conf') return { size: '', unit: '' }
  if (unit === 'kg' || unit === 'L') {
    const base = unit === 'kg' ? 'g' : 'ml'
    return { size: size ? convert(size, unit, base).toString() : '', unit: base }
  }
  return { size: size ?? '', unit: unit ?? '' }
}

export function bulkPriceUnit(data: Data, productIds: string[]): Unit | null {
  const prices = data.product_prices.filter(
    (p) =>
      productIds.includes(p.specific_product_id) &&
      data.stores.some((s) => s.id === p.store_id && !s.archived_at),
  )
  const basis = prices[0]?.price_basis
  return prices.length && (basis === 'kg' || basis === 'l') && prices.every((p) => p.price_basis === basis)
    ? basis === 'kg'
      ? 'kg'
      : 'L'
    : null
}

export function orderedCategories(categories: Category[]) {
  return [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it') || a.id.localeCompare(b.id),
  )
}

export function storeCategories(data: Data, storeId: string) {
  const order = new Map(
    data.store_category_order.filter((o) => o.store_id === storeId).map((o) => [o.category_id, o.sort_order]),
  )
  return orderedCategories(
    data.categories.map((category) => ({
      ...category,
      sort_order: order.get(category.id) ?? category.sort_order,
    })),
  )
}

export function productFormat(product: Pick<Product, 'package_quantity' | 'package_unit'>) {
  return product.package_quantity && product.package_unit
    ? `${product.package_quantity} ${unitLabel(product.package_unit)}`
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

export function listProductGroups(data: Data) {
  const groups = new Map<
    string,
    {
      id: string
      name: string
      genericId: string | null
      products: Data['specific_products']
    }
  >()
  for (const entry of catalogProducts(data).filter((entry) => !entry.product.archived_at)) {
    const key = entry.product.name.trim()
    let group = groups.get(key)
    if (!group) {
      const genericId = entry.kind === 'generic' ? entry.product.id : entry.product.generic_product_id
      group = {
        id: entry.product.id,
        name: entry.product.name,
        genericId,
        products: [],
      }
      groups.set(key, group)
    }
    if (entry.kind === 'specific') group.products.push(entry.product)
  }
  return [...groups.values()]
}

export function catalogTotals(data: Data) {
  return {
    products: catalogProducts(data).filter((entry) => !entry.product.archived_at).length,
    categories: data.categories.length,
  }
}

export function listProductChoices(
  groups: ReturnType<typeof listProductGroups>,
  query: string,
  selectedValue = '',
) {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  const choices: (SearchChoice & { groupId: string; brand?: string })[] = []
  for (const group of groups) {
    choices.push({ value: group.id, groupId: group.id, label: group.name, sortLabel: group.name })
    for (const brand of new Set(group.products.map((p) => p.brand).filter(Boolean))) {
      const value = `brand:${group.id}:${encodeURIComponent(brand)}`
      if (
        value === selectedValue ||
        terms.some((term) => matchingChoices([{ value, label: brand }], term).length)
      )
        choices.push({
          value,
          groupId: group.id,
          brand,
          label: `${group.name} · ${brand}`,
          sortLabel: group.name,
        })
    }
  }
  return choices
}
