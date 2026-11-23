import { useApp } from '../data/context'
import type { Item } from '../data/types'
import { shoppingBrandPrices, type shoppingPrices } from '../data/shoppingPrices'
import { productFormat } from '../data/catalog'
import { pamDiscount, storePrice } from '../domain/storePrices'
import { unitPriceLabel } from '../domain/catalogPrices'
import { euro } from '../domain/math'

export function ShoppingItemPrices({
  item,
  estimates,
  remaining,
}: {
  item: Item
  estimates: ReturnType<typeof shoppingPrices>
  remaining: string
}) {
  const { data } = useApp()
  const stores = data.stores.filter((s) => !s.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const brands = shoppingBrandPrices(data, item, remaining)
  const prices = (brand?: (typeof brands)[number]) => (
    <dl
      className="item-prices"
      aria-label={`Prezzi previsti per ${item.name}${brand ? ` · ${brand.brand || 'Senza marca'}` : ''}`}
    >
      {stores.map((store) => {
        const line = brand
          ? brand.stores.find((s) => s.storeId === store.id)?.line
          : estimates.find((e) => e.storeId === store.id)?.lines.find((l) => l.itemId === item.id)
        const product = data.specific_products.find((p) => p.id === line?.productId)
        const price = data.product_prices.find(
          (p) => p.specific_product_id === product?.id && p.store_id === store.id,
        )
        return (
          <div key={store.id}>
            <dt>
              {store.name}
              {pamDiscount(store) && ' · −10%'}
            </dt>
            <dd>
              {line?.amount === null || line?.amount === undefined ? '-' : euro(line.amount)}
              {product && price && (
                <>
                  <small>{unitPriceLabel(storePrice(price.price_amount, store, false), product)}</small>
                  {brand && <small>{productFormat(product)}</small>}
                </>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
  if (!Number(remaining) || !stores.length) return null
  return brands.length ? (
    <div className="brand-prices">
      <p className="muted">Prezzi per marca. Il totale previsto usa l’alternativa compatibile meno cara.</p>
      {brands.map((brand) => (
        <section key={brand.brand} aria-label={`Marca ${brand.brand || 'Senza marca'}`}>
          <h4>{brand.brand || 'Senza marca'}</h4>
          {prices(brand)}
        </section>
      ))}
    </div>
  ) : (
    prices()
  )
}
