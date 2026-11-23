import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import { quantity } from '../domain/math'
import { AddListItemForm } from '../components/AddListItemForm'
import type { Item } from '../data/types'
import { productFormat, storeCategories } from '../data/catalog'
import { Empty, Field, Form, Panel, SectionTitle, Submit, text } from '../components/ui'

export function Lists() {
  const { data } = useApp()
  const list = data.shopping_lists[0]
  return list ? (
    <ListDetail key={list.id} id={list.id} />
  ) : (
    <Empty title="Lista non disponibile">Ricarica la pagina per ritrovare la lista della spesa.</Empty>
  )
}

function ListDetail({ id }: { id: string }) {
  const { data, household, itemQuantity, act, busy, online } = useApp()
  const [showArchived, setShowArchived] = useState(false)
  const [storeId, setStoreId] = useState(() => localStorage.getItem(`shopping-store:${household!.id}`) ?? '')
  const store = data.stores.find((s) => s.id === storeId && !s.archived_at)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const list = data.shopping_lists.find((l) => l.id === id)!
  const items = data.shopping_list_items
    .filter((i) => i.list_id === id && !i.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name, 'it') || a.created_at.localeCompare(b.created_at))
  const pending = items.filter((i) => Number(itemQuantity(i).remaining) > 0)
  const done = items.filter((i) => Number(itemQuantity(i).remaining) === 0)
  const categoryFor = (item: Item) => {
    const specific = data.specific_products.find((s) => s.id === item.specific_product_id)
    const generic = data.generic_products.find(
      (g) => g.id === (item.generic_product_id ?? specific?.generic_product_id),
    )
    return data.categories.find((c) => c.id === generic?.category_id)
  }
  const order = new Map(storeCategories(data, store?.id ?? '').map((c, index) => [c.id, index]))
  const groups = [...new Set(pending.map((i) => categoryFor(i)?.id ?? ''))].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  )
  const archive = (item: Item, removed: boolean) =>
    act(
      async () => {
        await rpc('set_record_archived', {
          p_type: 'shopping_list_items',
          p_id: item.id,
          p_archived: removed,
          p_version: list.version,
        })
        setEdit(null)
      },
      removed ? 'Articolo rimosso dalla lista.' : 'Articolo rimesso nella lista.',
    )
  const renderItem = (item: Item) => {
    const q = itemQuantity(item)
    const specific = data.specific_products.find((s) => s.id === item.specific_product_id)
    const brand = specific?.brand ?? item.preferred_brand
    const format =
      specific ??
      (item.preferred_package_quantity && item.preferred_package_unit
        ? { package_quantity: item.preferred_package_quantity, package_unit: item.preferred_package_unit }
        : null)
    return (
      <article className="shopping-item" key={item.id}>
        <div className="item-heading">
          <div className="item-text">
            <strong>{item.name}</strong>
            <small>
              {q.remaining} {item.unit} da acquistare{brand && ` · ${brand}`}
              {format && ` · ${productFormat(format)}`}
              {item.note && ` · ${item.note}`}
            </small>
          </div>
        </div>
        <div className="inline wrap item-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || !online}
            onClick={() => void archive(item, true)}
            aria-label={`Rimuovi dalla lista ${item.name}`}
          >
            Rimuovi dalla lista
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setEdit(edit === item.id ? null : item.id)}
          >
            Modifica quantità
          </button>
        </div>
        {edit === item.id && (
          <Form
            onSave={async (f) => {
              await rpc('update_manual_item', {
                p_item: item.id,
                p_version: list.version,
                p_quantity: quantity(text(f, 'quantity')).toString(),
                p_note: text(f, 'note'),
              })
              setEdit(null)
            }}
          >
            <Field
              label="Quantità manuale"
              name="quantity"
              value={
                data.list_item_contributions.find((c) => c.item_id === item.id && c.origin_type === 'manual')
                  ?.requested_quantity ?? '0'
              }
            />
            <Field label="Note" name="note" value={item.note} required={false} />
            <Submit />
          </Form>
        )}
      </article>
    )
  }
  return (
    <>
      <SectionTitle eyebrow={`${pending.length} ARTICOLI DA ACQUISTARE`} title="La lista della spesa." />
      <label className="field">
        Supermercato per la spesa
        <select
          aria-label="Supermercato per la spesa"
          value={store?.id ?? ''}
          onChange={(event) => {
            setStoreId(event.target.value)
            localStorage.setItem(`shopping-store:${household!.id}`, event.target.value)
          }}
        >
          <option value="">Ordine iniziale delle categorie</option>
          {data.stores
            .filter((s) => !s.archived_at)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <p className="muted">
        Aggiungi ciò che serve e rimuovi ciò che hai preso. Puoi rimettere gli articoli rimossi nella lista.
        Aggiorna i prezzi dal <Link to="/catalogo">Catalogo</Link> quando sei a casa.
      </p>
      <label className="field search-field">
        Filtra articoli
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca nella lista…"
        />
      </label>
      <section className="panel">
        <h2>
          Da acquistare <span className="count">{pending.length}</span>
        </h2>
        {groups.map((group) => {
          const rows = pending.filter(
            (i) =>
              (categoryFor(i)?.id ?? '') === group &&
              i.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')),
          )
          return (
            !!rows.length && (
              <div className="category-group" key={group}>
                <h3>{data.categories.find((c) => c.id === group)?.name ?? 'Altri prodotti'}</h3>
                {rows.map(renderItem)}
              </div>
            )
          )
        })}
        {!pending.length && <Empty title="La lista è vuota.">Aggiungi un articolo per cominciare.</Empty>}
      </section>
      <Panel title="Aggiungi alla lista">
        <AddListItemForm key={id} listId={id} />
      </Panel>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        Mostra articoli rimossi
      </label>
      {showArchived && (
        <Panel title="Articoli rimossi dalla lista">
          {data.shopping_list_items
            .filter((i) => i.list_id === id && i.archived_at)
            .map((item) => (
              <div className="data-row" key={item.id}>
                <span>{item.name}</span>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy || !online}
                  onClick={() => void archive(item, false)}
                >
                  Rimetti nella lista
                </button>
              </div>
            ))}
        </Panel>
      )}
      {!!done.length && (
        <details className="panel">
          <summary>Articoli già acquistati in precedenza</summary>
          {done.map(renderItem)}
        </details>
      )}
    </>
  )
}
