import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import type { Specific } from '../data/types'
import { productFormat } from '../data/catalog'
import { latestProductPrice, unitPriceLabel } from '../domain/catalogPrices'
import { dateInZone, euro, parsePrice, priceInputError, priceInputValue } from '../domain/math'
import type { Observation } from '../domain/prices'
import { PriceField } from './PriceField'
import { ConfirmButton, Field, Form, Panel, Select, Submit, text } from './ui'

export function ProductPrices({ product }: { product: Specific }) {
  const { data, household, busy, online } = useApp()
  const [editor, setEditor] = useState<{ store: string; previous?: Observation } | null>(null)
  const [draft, setDraft] = useState('')
  const editorRoot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editor) return
    const input = editorRoot.current?.querySelector<HTMLInputElement>('input[name="amount"]')
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [editor])
  const stores = data.stores.filter((s) => !s.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const history = data.price_observations
    .filter((o) => o.specific_product_id === product.id)
    .sort(
      (a, b) =>
        b.observed_at.localeCompare(a.observed_at) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
        b.id.localeCompare(a.id),
    )
  function edit(store: string, previous?: Observation) {
    setDraft(previous ? priceInputValue(previous.price_amount) : '')
    setEditor({ store, previous })
  }
  return (
    <Panel title={`Prezzi di ${product.name}`}>
      <p>{[product.brand, product.variant, productFormat(product)].filter(Boolean).join(' · ')}</p>
      <p className="muted">
        Ultimo prezzo registrato per ogni supermercato. Il trattino indica un dato non disponibile; la data
        indica quando è stato rilevato.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supermercato</th>
              <th>Prezzo confezione</th>
              <th>Prezzo al kg/l</th>
              <th>Rilevato il</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const price = latestProductPrice(history, product.id, store.id)
              return (
                <tr key={store.id} aria-label={`Prezzo presso ${store.name}`}>
                  <td>{store.name}</td>
                  <td>
                    {price ? euro(price.price_amount) : '-'}
                    {price && (
                      <small>
                        {price.kind === 'promotion'
                          ? 'Promozione'
                          : price.kind === 'unknown'
                            ? 'Tipo non determinato'
                            : 'Ordinario'}
                      </small>
                    )}
                  </td>
                  <td>{price ? unitPriceLabel(price.price_amount, product) : '-'}</td>
                  <td>
                    {price
                      ? new Date(price.observed_at).toLocaleDateString('it-IT', {
                          timeZone: household!.timezone,
                        })
                      : '-'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !online || !!product.archived_at}
                      onClick={() => edit(store.id)}
                    >
                      {price ? 'Aggiorna prezzo' : 'Inserisci prezzo'}
                    </button>
                    {price && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy || !online || !!product.archived_at}
                        onClick={() => edit(store.id, price)}
                      >
                        Correggi prezzo
                      </button>
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
            key={`${editor.store}:${editor.previous?.id ?? 'new'}`}
            onSave={async (f) => {
              const values = {
                p_amount: parsePrice(text(f, 'amount')),
                p_kind: text(f, 'kind'),
                p_observed: new Date(text(f, 'date') + 'T12:00:00').toISOString(),
                p_start: text(f, 'start') || null,
                p_end: text(f, 'end') || null,
              }
              if (editor.previous) await rpc('correct_catalog_price', { ...values, p_id: editor.previous.id })
              else await rpc('add_price', { ...values, p_product: product.id, p_store: editor.store })
              setEditor(null)
            }}
          >
            <h3>
              {editor.previous ? 'Correggi prezzo' : 'Nuovo prezzo'} ·{' '}
              {stores.find((s) => s.id === editor.store)?.name}
            </h3>
            <p className="muted">
              {editor.previous
                ? 'La rilevazione precedente rimane nello storico come annullata.'
                : 'Il nuovo prezzo si aggiunge allo storico, conservando i prezzi precedenti.'}
            </p>
            <PriceField
              label="Prezzo per confezione (€)"
              name="amount"
              value={editor.previous?.price_amount}
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
            <Select label="Tipo di prezzo accertato" name="kind" value={editor.previous?.kind ?? 'regular'}>
              <option value="regular">Ordinario</option>
              <option value="promotion">Promozione</option>
              <option value="unknown">Non determinato (escluso dalla stima)</option>
            </Select>
            <Field
              label="Data rilevazione"
              name="date"
              type="date"
              value={
                editor.previous
                  ? dateInZone(new Date(editor.previous.observed_at), household!.timezone)
                  : dateInZone(new Date(), household!.timezone)
              }
            />
            <Field
              label="Inizio promo"
              name="start"
              type="date"
              required={false}
              value={editor.previous?.promotion_starts_at ?? ''}
            />
            <Field
              label="Fine promo"
              name="end"
              type="date"
              required={false}
              value={editor.previous?.promotion_ends_at ?? ''}
            />
            <div className="inline">
              <Submit>Salva prezzo</Submit>
              <button type="button" className="text-button" onClick={() => setEditor(null)}>
                Annulla modifica prezzo
              </button>
            </div>
          </Form>
        )}
      </div>
      {!!history.length && (
        <details>
          <summary>Storico prezzi del prodotto</summary>
          {history.map((price) => (
            <div className="data-row" key={price.id}>
              <span>
                {data.stores.find((s) => s.id === price.store_id)?.name ?? '-'} · {euro(price.price_amount)} ·{' '}
                {unitPriceLabel(price.price_amount, product)} ·{' '}
                {new Date(price.observed_at).toLocaleDateString('it-IT', { timeZone: household!.timezone })}
                {price.voided_at && ' · ANNULLATO'}
              </span>
              {!price.voided_at && (
                <ConfirmButton
                  message="Annullare questa rilevazione? Resterà nello storico ma sarà esclusa dal riepilogo e dai confronti."
                  onConfirm={() => rpc('void_price', { p_id: price.id })}
                >
                  Annulla rilevazione
                </ConfirmButton>
              )}
            </div>
          ))}
        </details>
      )}
    </Panel>
  )
}
