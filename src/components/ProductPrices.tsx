import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import type { Specific } from '../data/types'
import { productFormat } from '../data/catalog'
import { pamDiscount, storePrice } from '../domain/storePrices'
import {
  catalogPriceLabel,
  unitPriceLabel,
  validatePriceBasis,
  type PriceBasis,
} from '../domain/catalogPrices'
import { PriceBasisSelect } from './PriceBasisSelect'
import { parsePrice, priceInputError, priceInputValue } from '../domain/math'
import { PriceField } from './PriceField'
import { ConfirmButton, Form, Panel, Submit, text } from './ui'

export function ProductPrices({ product, initialStore = '' }: { product: Specific; initialStore?: string }) {
  const { data, busy, online } = useApp()
  const [editor, setEditor] = useState<string | null>(() =>
    data.stores.some((s) => s.id === initialStore && !s.archived_at) ? initialStore : null,
  )
  const [draft, setDraft] = useState(() => {
    const price = data.product_prices.find(
      (p) => p.specific_product_id === product.id && p.store_id === initialStore,
    )
    return price ? priceInputValue(price.price_amount) : ''
  })
  const [revision, setRevision] = useState(0)
  const [basis, setBasis] = useState<PriceBasis>(
    () =>
      data.product_prices.find((p) => p.specific_product_id === product.id && p.store_id === initialStore)
        ?.price_basis ?? 'package',
  )
  const editorRoot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editor) return
    const input = editorRoot.current?.querySelector<HTMLInputElement>('input[name="amount"]')
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [editor, revision])
  const stores = data.stores.filter((s) => !s.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  return (
    <Panel title={`Prezzi di ${product.name}`}>
      <p>{[product.brand, product.variant, productFormat(product)].filter(Boolean).join(' · ')}</p>
      <p className="muted">
        Un prezzo attuale per ogni supermercato. Quando lo modifichi, sostituisci il precedente. Il trattino
        indica un dato non disponibile.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>Prezzo</th>
              <th>Prezzo al kg/l/pz</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const price = data.product_prices.find(
                (p) => p.specific_product_id === product.id && p.store_id === store.id,
              )
              return (
                <tr key={store.id} aria-label={`Prezzo presso ${store.name}`}>
                  <td>
                    {store.name}
                    {pamDiscount(store) && <small>Sconto PAM 10%</small>}
                  </td>
                  <td>
                    {price
                      ? catalogPriceLabel(storePrice(price.price_amount, store), price.price_basis)
                      : '-'}
                  </td>
                  <td>
                    {price
                      ? unitPriceLabel(
                          storePrice(price.price_amount, store, false),
                          product,
                          price.price_basis,
                        )
                      : '-'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !online || !!product.archived_at}
                      onClick={() => {
                        setDraft(price ? priceInputValue(price.price_amount) : '')
                        setBasis(price?.price_basis ?? 'package')
                        setEditor(store.id)
                        setRevision((value) => value + 1)
                      }}
                    >
                      {price ? 'Modifica prezzo' : 'Inserisci prezzo'}
                    </button>
                    {price && (
                      <ConfirmButton
                        message="Rimuovere il prezzo di questo supermercato? Potrai inserirlo nuovamente."
                        onConfirm={async () => {
                          await rpc('clear_product_price', { p_product: product.id, p_store: store.id })
                          if (editor === store.id) setEditor(null)
                        }}
                      >
                        Rimuovi prezzo
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!stores.length && (
        <p>
          Aggiungi un <Link to="/negozi">supermercato</Link> per registrare i prezzi.
        </p>
      )}
      <div ref={editorRoot}>
        {editor && (
          <Form
            key={`${editor}:${revision}`}
            onSave={async (f) => {
              validatePriceBasis(product.package_unit, basis)
              await rpc(basis === 'package' ? 'set_product_price' : 'set_product_price_basis', {
                p_product: product.id,
                p_store: editor,
                p_amount: parsePrice(text(f, 'amount')),
                ...(basis === 'package' ? {} : { p_basis: basis }),
              })
              setEditor(null)
            }}
          >
            <h3>Prezzo attuale · {stores.find((s) => s.id === editor)?.name}</h3>
            {stores.some((s) => s.id === editor && pamDiscount(s)) && (
              <p className="muted">
                Inserisci il prezzo prima dello sconto PAM. Il 10% viene applicato automaticamente alle stime,
                senza cambiare il prezzo salvato.
              </p>
            )}
            <PriceBasisSelect value={basis} onChange={setBasis} />
            <PriceField
              label={
                basis === 'package'
                  ? 'Prezzo per confezione (€)'
                  : basis === 'kg'
                    ? 'Prezzo al kg (€)'
                    : 'Prezzo al litro (€)'
              }
              name="amount"
              value={
                data.product_prices.find((p) => p.specific_product_id === product.id && p.store_id === editor)
                  ?.price_amount
              }
              onChange={setDraft}
              rawValue={draft}
            />
            <p role="status">
              Prezzo al kg/l/pz:{' '}
              <strong>
                {draft && !priceInputError(draft) ? unitPriceLabel(parsePrice(draft), product, basis) : '-'}
              </strong>
            </p>
            {basis === 'package' &&
            (!product.package_quantity ||
              !['g', 'kg', 'ml', 'L', 'pz'].includes(product.package_unit ?? '')) ? (
              <p className="muted">
                Per il prezzo al kg/l/pz indica il formato del prodotto. Per i prodotti sfusi puoi scegliere
                direttamente €/kg o €/l.
              </p>
            ) : null}
            <div className="inline">
              <Submit>Salva prezzo</Submit>
              <button type="button" className="text-button" onClick={() => setEditor(null)}>
                Annulla modifica prezzo
              </button>
            </div>
          </Form>
        )}
      </div>
    </Panel>
  )
}
