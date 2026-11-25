import { useApp } from '../data/context'
import { shoppingPrices } from '../data/shoppingPrices'
import { euro } from '../domain/math'
import { pamDiscount } from '../domain/storePrices'

export function CurrentPriceComparison({
  compact = false,
  estimates: suppliedEstimates,
  discountEstimates: suppliedDiscountEstimates,
}: {
  compact?: boolean
  estimates?: ReturnType<typeof shoppingPrices>
  discountEstimates?: ReturnType<typeof shoppingPrices>
}) {
  const { data, itemQuantity } = useApp()
  const list = data.shopping_lists[0]
  const items = data.shopping_list_items
    .filter((i) => i.list_id === list?.id && !i.archived_at)
    .map((item) => ({ ...item, quantity: itemQuantity(item).remaining }))
  const estimates =
    suppliedEstimates ?? shoppingPrices(data, list?.id ?? '', (item) => itemQuantity(item).remaining)
  const discountEstimates =
    suppliedDiscountEstimates ??
    shoppingPrices(data, list?.id ?? '', (item) => itemQuantity(item).remaining, true)
  if (!items.some((i) => Number(i.quantity) > 0))
    return <p>Aggiungi articoli alla lista per confrontare i supermercati.</p>
  if (!estimates.length) return <p>Aggiungi un supermercato per confrontare i prezzi.</p>
  return (
    <div className="current-comparison">
      <p className="muted">
        {compact
          ? 'Totali previsti per tutta la lista. Un totale parziale comprende solo i prodotti con prezzo disponibile.'
          : 'Costi calcolati con i prezzi attuali del Catalogo: confezioni intere per i prodotti confezionati, quantità richiesta per i prezzi al kg/l. Il trattino indica un prezzo o formato mancante. Un totale parziale comprende solo i prodotti con prezzo disponibile.'}
      </p>
      <p className="muted">
        Il totale usa i prezzi interi. Il totale scontato usa solo i prezzi scontati inseriti, senza
        sostituire quelli mancanti con prezzi interi. Un totale parziale non copre tutta la lista.
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Prezzi previsti per supermercato">
        <table aria-label="Confronto supermercati">
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>{compact ? 'Totale' : 'Totale della lista'}</th>
              <th>{compact ? 'Prezzi noti' : 'Prodotti con prezzo'}</th>
              <th>Totale scontato</th>
              <th>Prezzi scontati noti</th>
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
                <td data-price-scenario="discounted">
                  {discountEstimates.find((e) => e.storeId === estimate.storeId)?.known
                    ? euro(discountEstimates.find((e) => e.storeId === estimate.storeId)!.total)
                    : '-'}
                  {!discountEstimates.find((e) => e.storeId === estimate.storeId)?.complete && (
                    <small>Parziale</small>
                  )}
                </td>
                <td>
                  {discountEstimates.find((e) => e.storeId === estimate.storeId)?.known ?? 0}/
                  {estimate.totalItems}
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
                            {' · Prezzo scontato: '}
                            {discountEstimates
                              .find((e) => e.storeId === estimate.storeId)
                              ?.lines.find((l) => l.itemId === line.itemId)?.amount != null
                              ? euro(
                                  discountEstimates
                                    .find((e) => e.storeId === estimate.storeId)!
                                    .lines.find((l) => l.itemId === line.itemId)!.amount!,
                                )
                              : '-'}
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
