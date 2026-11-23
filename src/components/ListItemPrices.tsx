import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import type { Item } from '../data/types'
import { productFormat } from '../data/catalog'
import { matchesShoppingProduct } from '../domain/currentPrices'
import { ProductPrices } from './ProductPrices'

export function ListItemPrices({ item, storeId }: { item: Item; storeId: string }) {
  const { data } = useApp()
  const candidates = data.specific_products
    .filter((p) => !p.archived_at && matchesShoppingProduct({ ...item, quantity: '1' }, p))
    .sort((a, b) =>
      [a.name, a.brand, productFormat(a)]
        .join(' ')
        .localeCompare([b.name, b.brand, productFormat(b)].join(' '), 'it'),
    )
  const [productId, setProductId] = useState(() => (candidates.length === 1 ? candidates[0].id : ''))
  const product = candidates.find((p) => p.id === productId)
  return (
    <div className="list-price-editor product-prices">
      {!candidates.length ? (
        <p>
          Per registrare un prezzo aggiungi prima il prodotto nel <Link to="/catalogo">Catalogo</Link>. Marca
          e formato possono rimanere vuoti.
        </p>
      ) : (
        <>
          <label className="field">
            Prodotto di cui modificare il prezzo
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Scegli il prodotto e il formato</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.name, p.brand, productFormat(p), p.variant, p.barcode].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
          {product && <ProductPrices key={product.id} product={product} initialStore={storeId} />}
        </>
      )}
    </div>
  )
}
