import Decimal from 'decimal.js'
import { compareCurrentPrices, matchesShoppingProduct } from '../domain/currentPrices'
import type { Data, Item, Store } from './types'
import { storePrice } from '../domain/storePrices'

export function pricesForStore(data: Data, store: Store, discounted = false) {
  return data.product_prices.map((price) => {
    const amount = discounted ? price.discounted_price_amount : price.price_amount
    return {
      ...price,
      price_amount:
        amount == null ? null : price.store_id === store.id ? storePrice(amount, store, false) : amount,
    }
  })
}

export function shoppingBrandPrices(data: Data, item: Item, remaining: string, discounted = false) {
  if (item.specific_product_id || item.preferred_brand) return []
  const request = { ...item, quantity: remaining }
  const products = data.specific_products.filter((p) => !p.archived_at && matchesShoppingProduct(request, p))
  const brands = [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'it'))
  if (brands.length < 2) return []
  return brands.map((brand) => ({
    brand,
    stores: data.stores
      .filter((s) => !s.archived_at)
      .sort((a, b) => a.name.localeCompare(b.name, 'it'))
      .map((store) => ({
        storeId: store.id,
        line: compareCurrentPrices(
          store.id,
          [request],
          products.filter((p) => p.brand === brand),
          pricesForStore(data, store, discounted),
        ).lines[0],
      })),
  }))
}

export function shoppingPrices(
  data: Data,
  listId: string,
  remaining: (item: Item) => string,
  discounted = false,
) {
  const items = data.shopping_list_items
    .filter((i) => i.list_id === listId && !i.archived_at)
    .map((item) => ({ ...item, quantity: remaining(item) }))
  const products = data.specific_products.filter(
    (p) => !p.archived_at || items.some((i) => i.specific_product_id === p.id),
  )
  return data.stores
    .filter((s) => !s.archived_at)
    .map((store) => compareCurrentPrices(store.id, items, products, pricesForStore(data, store, discounted)))
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        (a.complete && b.complete ? new Decimal(a.total).cmp(b.total) : b.known - a.known) ||
        a.storeId.localeCompare(b.storeId),
    )
}
