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
  discountEstimates,
  remaining,
}: {
  item: Item
  estimates: ReturnType<typeof shoppingPrices>
  discountEstimates: ReturnType<typeof shoppingPrices>
  remaining: string
}) {
  const { data } = useApp()
  const stores = data.stores.filter((s) => !s.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const brands = shoppingBrandPrices(data, item, remaining)
  const discountedBrands = shoppingBrandPrices(data, item, remaining, true)
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
        const discountedLine = brand
          ? discountedBrands.find((b) => b.brand === brand.brand)?.stores.find((s) => s.storeId === store.id)
              ?.line
          : discountEstimates.find((e) => e.storeId === store.id)?.lines.find((l) => l.itemId === item.id)
        const discountedProduct = data.specific_products.find((p) => p.id === discountedLine?.productId)
        const discountedPrice = data.product_prices.find(
          (p) => p.specific_product_id === discountedProduct?.id && p.store_id === store.id,
        )
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
              {product && price?.price_amount != null && (
                <>
                  <small>
                    {unitPriceLabel(storePrice(price.price_amount, store, false), product, price.price_basis)}
                  </small>
                  {brand && <small>{productFormat(product)}</small>}
                </>
              )}
              <div className="discount-price" data-price-scenario="discounted">
                <span className="muted">Prezzo scontato: </span>
                {discountedLine?.amount != null ? euro(discountedLine.amount) : '-'}
                {discountedProduct && discountedPrice?.discounted_price_amount != null && (
                  <>
                    <small>
                      {unitPriceLabel(
                        storePrice(discountedPrice.discounted_price_amount, store, false),
                        discountedProduct,
                        discountedPrice.price_basis,
                      )}
                    </small>
                    {brand && <small>{productFormat(discountedProduct)}</small>}
                  </>
                )}
              </div>
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
