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
  const [discount, setDiscount] = useState(() =>
    priceInputValue(
      data.product_prices.find((p) => p.specific_product_id === product.id && p.store_id === initialStore)
        ?.discounted_price_amount,
    ),
  )
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
        Prezzo e prezzo scontato per ogni supermercato, inseriti da te e senza date di validità. Il trattino
        indica un dato non disponibile. I due importi usano lo stesso tipo di prezzo.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>Prezzo</th>
              <th>Prezzo al kg/l/pz</th>
              <th>Prezzo scontato</th>
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
                    {price?.price_amount != null
                      ? catalogPriceLabel(storePrice(price.price_amount, store), price.price_basis)
                      : '-'}
                  </td>
                  <td>
                    {price?.price_amount != null
                      ? unitPriceLabel(
                          storePrice(price.price_amount, store, false),
                          product,
                          price.price_basis,
                        )
                      : '-'}
                  </td>
                  <td>
                    {price?.discounted_price_amount != null ? (
                      <>
                        {catalogPriceLabel(
                          storePrice(price.discounted_price_amount, store),
                          price.price_basis,
                        )}
                        <small>
                          {unitPriceLabel(
                            storePrice(price.discounted_price_amount, store, false),
                            product,
                            price.price_basis,
                          )}
                        </small>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !online || !!product.archived_at}
                      onClick={() => {
                        setDraft(price ? priceInputValue(price.price_amount) : '')
                        setDiscount(priceInputValue(price?.discounted_price_amount))
                        setBasis(price?.price_basis ?? 'package')
                        setEditor(store.id)
                        setRevision((value) => value + 1)
                      }}
                    >
                      {price ? 'Modifica prezzo' : 'Inserisci prezzo'}
                    </button>
                    {price?.price_amount != null && (
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
                    {price?.discounted_price_amount != null && (
                      <ConfirmButton
                        message="Rimuovere solo il prezzo scontato di questo supermercato?"
                        onConfirm={async () => {
                          await rpc('clear_discounted_product_price', {
                            p_product: product.id,
                            p_store: store.id,
                          })
                          if (editor === store.id) setEditor(null)
                        }}
                      >
                        Rimuovi prezzo scontato
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
              const previous = data.product_prices.find(
                (p) => p.specific_product_id === product.id && p.store_id === editor,
              )
              if (discount.trim() || previous?.discounted_price_amount != null || !draft.trim()) {
                await rpc('set_product_prices', {
                  p_product: product.id,
                  p_store: editor,
                  p_amount: draft.trim() ? parsePrice(draft) : null,
                  p_discounted: discount.trim() ? parsePrice(discount) : null,
                  p_basis: basis,
                })
              } else
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
              required={false}
            />
            <p role="status">
              Prezzo al kg/l/pz:{' '}
              <strong>
                {draft && !priceInputError(draft) ? unitPriceLabel(parsePrice(draft), product, basis) : '-'}
              </strong>
            </p>
            <PriceField
              label="Prezzo scontato (€)"
              name="discounted_amount"
              rawValue={discount}
              onChange={setDiscount}
              required={false}
            />
            <p role="status">
              Prezzo scontato al kg/l/pz:{' '}
              <strong>
                {discount && !priceInputError(discount)
                  ? unitPriceLabel(parsePrice(discount), product, basis)
                  : '-'}
              </strong>
            </p>
            <p className="muted">
              Lascia vuoto un importo per rimuoverlo. Salvando entrambi i campi vuoti rimuovi entrambi i
              prezzi.
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
