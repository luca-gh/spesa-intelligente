import Decimal from 'decimal.js'
import { compareCurrentPrices } from '../domain/currentPrices'
import type { Data, Item } from './types'
import { storePrice } from '../domain/storePrices'

export function shoppingPrices(data: Data, listId: string, remaining: (item: Item) => string) {
  const items = data.shopping_list_items
    .filter((i) => i.list_id === listId && !i.archived_at)
    .map((item) => ({ ...item, quantity: remaining(item) }))
  const products = data.specific_products.filter(
    (p) => !p.archived_at || items.some((i) => i.specific_product_id === p.id),
  )
  return data.stores
    .filter((s) => !s.archived_at)
    .map((store) =>
      compareCurrentPrices(
        store.id,
        items,
        products,
        data.product_prices.map((price) =>
          price.store_id === store.id
            ? { ...price, price_amount: storePrice(price.price_amount, store, false) }
            : price,
        ),
      ),
    )
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        (a.complete && b.complete ? new Decimal(a.total).cmp(b.total) : b.known - a.known) ||
        a.storeId.localeCompare(b.storeId),
    )
}
