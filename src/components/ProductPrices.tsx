import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import type { Specific } from '../data/types'
import { productFormat } from '../data/catalog'
import { unitPriceLabel } from '../domain/catalogPrices'
import { euro, parsePrice, priceInputError, priceInputValue } from '../domain/math'
import { PriceField } from './PriceField'
import { ConfirmButton, Form, Panel, Submit, text } from './ui'

export function ProductPrices({ product }: { product: Specific }) {
  const { data, busy, online } = useApp()
  const [editor, setEditor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [revision, setRevision] = useState(0)
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
              <th>Prezzo confezione</th>
              <th>Prezzo al kg/l</th>
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
                  <td>{store.name}</td>
                  <td>{price ? euro(price.price_amount) : '-'}</td>
                  <td>{price ? unitPriceLabel(price.price_amount, product) : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !online || !!product.archived_at}
                      onClick={() => {
                        setDraft(price ? priceInputValue(price.price_amount) : '')
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
              await rpc('set_product_price', {
                p_product: product.id,
                p_store: editor,
                p_amount: parsePrice(text(f, 'amount')),
              })
              setEditor(null)
            }}
          >
            <h3>Prezzo attuale · {stores.find((s) => s.id === editor)?.name}</h3>
            <PriceField
              label="Prezzo per confezione (€)"
              name="amount"
              value={
                data.product_prices.find((p) => p.specific_product_id === product.id && p.store_id === editor)
                  ?.price_amount
              }
              onChange={setDraft}
            />
            <p role="status">
              Prezzo al kg/l:{' '}
              <strong>
                {draft && !priceInputError(draft) ? unitPriceLabel(parsePrice(draft), product) : '-'}
              </strong>
            </p>
            {!product.package_quantity || !['g', 'kg', 'ml', 'L'].includes(product.package_unit ?? '') ? (
              <p className="muted">
                Per il prezzo al kg/l indica un formato in grammi o millilitri nella scheda prodotto. Il
                prezzo per confezione può comunque essere salvato.
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
