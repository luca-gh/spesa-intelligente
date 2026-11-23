import Decimal from 'decimal.js'
import { useApp } from '../data/context'
import { compareCurrentPrices } from '../domain/currentPrices'
import { euro } from '../domain/math'

export function CurrentPriceComparison() {
  const { data, itemQuantity } = useApp()
  const list = data.shopping_lists[0]
  const items = data.shopping_list_items
    .filter((i) => i.list_id === list?.id && !i.archived_at)
    .map((item) => ({ ...item, quantity: itemQuantity(item).remaining }))
  const products = data.specific_products.filter(
    (p) => !p.archived_at || items.some((i) => i.specific_product_id === p.id),
  )
  const estimates = data.stores
    .filter((s) => !s.archived_at)
    .map((store) => compareCurrentPrices(store.id, items, products, data.product_prices))
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        (a.complete && b.complete ? new Decimal(a.total).cmp(b.total) : b.known - a.known) ||
        a.storeId.localeCompare(b.storeId),
    )
  if (!items.some((i) => Number(i.quantity) > 0))
    return <p>Aggiungi articoli alla lista per confrontare i supermercati.</p>
  if (!estimates.length) return <p>Aggiungi un supermercato per confrontare i prezzi.</p>
  return (
    <div className="current-comparison">
      <p className="muted">
        Costi calcolati con i prezzi attuali del Catalogo, sulle quantità della lista e sulle confezioni
        intere. Il trattino indica un prezzo o formato mancante. Un totale parziale comprende solo i prodotti
        con prezzo disponibile.
      </p>
      <div className="table-wrap">
        <table aria-label="Confronto supermercati">
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>Totale della lista</th>
              <th>Prodotti con prezzo</th>
              <th>Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((estimate) => (
              <tr key={estimate.storeId}>
                <td>{data.stores.find((s) => s.id === estimate.storeId)?.name}</td>
                <td>
                  {estimate.known ? euro(estimate.total) : '-'}
                  {!estimate.complete && <small>Parziale</small>}
                </td>
                <td>
                  {estimate.known}/{estimate.totalItems}
                </td>
                <td>
                  <details>
                    <summary>Vedi prodotti</summary>
                    <ul>
                      {estimate.lines.map((line) => (
                        <li key={line.itemId}>
                          {items.find((i) => i.id === line.itemId)?.name}:{' '}
                          {line.amount === null ? '-' : euro(line.amount)}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
