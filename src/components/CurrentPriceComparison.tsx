import { useApp } from '../data/context'
import { shoppingPrices } from '../data/shoppingPrices'
import { euro } from '../domain/math'
import { pamDiscount } from '../domain/storePrices'

export function CurrentPriceComparison({
  compact = false,
  estimates: suppliedEstimates,
}: {
  compact?: boolean
  estimates?: ReturnType<typeof shoppingPrices>
}) {
  const { data, itemQuantity } = useApp()
  const list = data.shopping_lists[0]
  const items = data.shopping_list_items
    .filter((i) => i.list_id === list?.id && !i.archived_at)
    .map((item) => ({ ...item, quantity: itemQuantity(item).remaining }))
  const estimates =
    suppliedEstimates ?? shoppingPrices(data, list?.id ?? '', (item) => itemQuantity(item).remaining)
  if (!items.some((i) => Number(i.quantity) > 0))
    return <p>Aggiungi articoli alla lista per confrontare i supermercati.</p>
  if (!estimates.length) return <p>Aggiungi un supermercato per confrontare i prezzi.</p>
  return (
    <div className="current-comparison">
      <p className="muted">
        {compact
          ? 'Totali previsti per tutta la lista. Un totale parziale comprende solo i prodotti con prezzo disponibile.'
          : 'Costi calcolati con i prezzi attuali del Catalogo, sulle quantità della lista e sulle confezioni intere. Il trattino indica un prezzo o formato mancante. Un totale parziale comprende solo i prodotti con prezzo disponibile.'}
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Prezzi previsti per supermercato">
        <table aria-label="Confronto supermercati">
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>{compact ? 'Totale' : 'Totale della lista'}</th>
              <th>{compact ? 'Prezzi noti' : 'Prodotti con prezzo'}</th>
              {!compact && <th>Dettaglio</th>}
            </tr>
          </thead>
          <tbody>
            {estimates.map((estimate) => (
              <tr key={estimate.storeId}>
                <td>
                  {data.stores.find((s) => s.id === estimate.storeId)?.name}
                  {data.stores.some((s) => s.id === estimate.storeId && pamDiscount(s)) && (
                    <small>Sconto PAM 10%</small>
                  )}
                </td>
                <td>
                  {estimate.known ? euro(estimate.total) : '-'}
                  {!estimate.complete && <small>Parziale</small>}
                </td>
                <td>
                  {estimate.known}/{estimate.totalItems}
                </td>
                {!compact && (
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
