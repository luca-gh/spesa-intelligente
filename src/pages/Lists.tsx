import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, ShoppingBasket } from 'lucide-react'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import { euro, quantity } from '../domain/math'
import { AddListItemForm } from '../components/AddListItemForm'
import type { Item } from '../data/types'
import { orderedCategories } from '../data/catalog'
import {
  ConfirmButton,
  Empty,
  Field,
  Form,
  Panel,
  SectionTitle,
  Select,
  Submit,
  text,
} from '../components/ui'

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
  const { data, household, itemQuantity, act } = useApp()
  const list = data.shopping_lists.find((l) => l.id === id)
  const [shopping, setShopping] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [store, setStore] = useState('')
  const [search, setSearch] = useState('')
  const [buy, setBuy] = useState<string | null>(null)
  const [edit, setEdit] = useState<string | null>(null)
  const [purchaseOperation, setPurchaseOperation] = useState(crypto.randomUUID())
  if (!list)
    return (
      <Empty title="Lista non disponibile">
        <Link to="/liste">Apri la lista della spesa</Link>
      </Empty>
    )
  const items = data.shopping_list_items
    .filter((i) => i.list_id === id && !i.archived_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const pending = items.filter((i) => Number(itemQuantity(i).remaining) > 0)
  const done = items.filter((i) => Number(itemQuantity(i).remaining) === 0)
  const categoryFor = (item: Item) => {
    const specific = data.specific_products.find((s) => s.id === item.specific_product_id)
    const generic = data.generic_products.find(
      (g) => g.id === (item.generic_product_id ?? specific?.generic_product_id),
    )
    return data.categories.find((c) => c.id === generic?.category_id)
  }
  const categoryOrder = new Map(
    orderedCategories(data.categories).map((category, index) => [category.name, index]),
  )
  const groups = [...new Set(pending.map((i) => categoryFor(i)?.name ?? 'Altri prodotti'))].sort(
    (a, b) =>
      (categoryOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      a.localeCompare(b, 'it'),
  )
  const frequent = new Map<string, { item: Item; count: number }>()
  for (const purchase of data.purchases.filter((p) => !p.voided_at)) {
    const old = data.shopping_list_items.find((i) => i.id === purchase.list_item_id)
    if (
      !old ||
      old.archived_at ||
      data.generic_products.find((g) => g.id === old.generic_product_id)?.archived_at ||
      data.specific_products.find((s) => s.id === old.specific_product_id)?.archived_at
    )
      continue
    const key =
      (old.specific_product_id ?? old.generic_product_id ?? old.name.trim().toLocaleLowerCase('it')) +
      ':' +
      old.unit
    frequent.set(key, { item: old, count: (frequent.get(key)?.count ?? 0) + 1 })
  }
  const listVersion = list.version
  const renderItem = (item: Item) => {
    const q = itemQuantity(item)
    const specific = data.specific_products.find((s) => s.id === item.specific_product_id)
    const generic = data.generic_products.find(
      (g) => g.id === (item.generic_product_id ?? specific?.generic_product_id),
    )
    const category = data.categories.find((c) => c.id === generic?.category_id)?.name ?? 'Altri prodotti'
    return (
      <article className="shopping-item" key={item.id}>
        <div className="item-heading">
          <button
            className={`check-button ${Number(q.remaining) === 0 ? 'checked' : ''}`}
            aria-label={`Registra acquisto ${item.name}`}
            onClick={() => {
              setPurchaseOperation(crypto.randomUUID())
              setBuy(buy === item.id ? null : item.id)
            }}
          >
            <Check size={20} />
          </button>
          <div className="item-text">
            <strong>{item.name}</strong>
            <small>
              {q.remaining} {item.unit} da acquistare · {q.bought}/{q.requested} acquistati{' '}
              {Number(q.surplus) > 0 && `· surplus ${q.surplus}`}
              <br />
              {category}
              {item.note && ` · ${item.note}`}
            </small>
          </div>
        </div>
        <div className="inline wrap item-actions">
          <ConfirmButton
            message={`Rimuovere «${item.name}» dalla lista della spesa? Lo storico degli acquisti e il catalogo saranno conservati.`}
            success="Articolo rimosso dalla lista. Storico acquisti e catalogo conservati."
            onConfirm={async () => {
              await rpc('set_record_archived', {
                p_type: 'shopping_list_items',
                p_id: item.id,
                p_archived: true,
                p_version: listVersion,
              })
              setBuy(null)
              setEdit(null)
            }}
          >
            Rimuovi dalla lista
          </ConfirmButton>
          <button className="text-button" onClick={() => setEdit(edit === item.id ? null : item.id)}>
            Modifica
          </button>
        </div>
        {edit === item.id && (
          <Form
            onSave={async (f) => {
              await rpc('update_manual_item', {
                p_item: item.id,
                p_version: listVersion,
                p_quantity: quantity(text(f, 'quantity')).toString(),
                p_note: text(f, 'note'),
              })
              setEdit(null)
            }}
          >
            <p className="muted">
              Modifica il contributo manuale. Ricette, pasti e acquisti restano separati.
            </p>
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
        {buy === item.id && (
          <Form
            className="purchase-form"
            onSave={async (f) => {
              await rpc('record_purchase', {
                p_id: purchaseOperation,
                p_item: item.id,
                p_quantity: quantity(text(f, 'quantity')).toString(),
                p_total: text(f, 'paid') ? quantity(text(f, 'paid')).toFixed(2) : null,
                p_store: text(f, 'store') || null,
                p_specific: text(f, 'specific') || item.specific_product_id,
                p_promotional: text(f, 'promo') === '' ? null : text(f, 'promo') === 'true',
                p_date: new Date(text(f, 'date') + 'T12:00:00').toISOString(),
                p_gross: text(f, 'gross') ? quantity(text(f, 'gross')).toFixed(2) : null,
              })
              setBuy(null)
            }}
          >
            <Field
              label={`Quantità effettiva (${item.unit})`}
              name="quantity"
              value={Number(q.remaining) > 0 ? q.remaining : '1'}
            />
            <Field
              label="Totale pagato (€), facoltativo"
              name="paid"
              required={false}
              placeholder="Prezzo sconosciuto"
            />
            <Field label="Lordo prima dello sconto (€), facoltativo" name="gross" required={false} />
            <Field
              label="Data acquisto"
              name="date"
              type="date"
              value={new Intl.DateTimeFormat('en-CA', { timeZone: household!.timezone }).format(new Date())}
            />
            <Select label="Punto vendita" name="store" value={store} required={false}>
              <option value="">Non specificato</option>
              {data.stores
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Select
              label="Prodotto commerciale"
              name="specific"
              value={item.specific_product_id ?? ''}
              required={false}
            >
              <option value="">Non specificato</option>
              {data.specific_products
                .filter((s) => !s.archived_at || s.id === item.specific_product_id)
                .filter((s) =>
                  item.specific_product_id
                    ? s.id === item.specific_product_id
                    : !item.generic_product_id || s.generic_product_id === item.generic_product_id,
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Select label="Era in promozione?" name="promo" required={false}>
              <option value="">Non so</option>
              <option value="true">Sì</option>
              <option value="false">No</option>
            </Select>
            <Submit>Conferma acquisto</Submit>
            <p className="muted">Il prezzo può restare vuoto. Nessun prezzo di catalogo viene inventato.</p>
          </Form>
        )}
        {data.purchases
          .filter((p) => p.list_item_id === item.id && !p.voided_at)
          .map((p) => (
            <div className="purchase-row" key={p.id}>
              <span>
                {p.quantity} {p.unit} · {p.total_paid === null ? 'Prezzo non registrato' : euro(p.total_paid)}
              </span>
              {p.total_paid === null && (
                <Form
                  className="inline-form"
                  onSave={(f) =>
                    rpc('complete_purchase_price', {
                      p_id: p.id,
                      p_total: quantity(text(f, 'paid')).toFixed(2),
                    })
                  }
                >
                  <Field label="Totale pagato (€)" name="paid" />
                  <Submit>Aggiungi prezzo</Submit>
                </Form>
              )}
              <ConfirmButton
                message="Annullare questo acquisto? Il record resta nello storico, escluso dai totali."
                onConfirm={() => rpc('void_purchase', { p_id: p.id })}
              >
                Annulla acquisto
              </ConfirmButton>
            </div>
          ))}
      </article>
    )
  }
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={17} /> Home
      </Link>
      <SectionTitle eyebrow={`${pending.length} ARTICOLI DA ACQUISTARE`} title="La lista della spesa.">
        <button className="button" onClick={() => setShopping(!shopping)}>
          <ShoppingBasket size={18} />
          {shopping ? 'Chiudi modalità spesa' : 'Inizia la spesa'}
        </button>
      </SectionTitle>
      <div className="inline list-toolbar">
        <Link to={`/prezzi?lista=${id}`}>Confronta prezzi →</Link>
      </div>
      {shopping && (
        <div className="callout">
          <h2>Modalità spesa</h2>
          <label className="field">
            Punto vendita preselezionato
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="">Seleziona negozio</option>
              {data.stores
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Registra quantità e pagato per ogni articolo. Puoi acquistare una parte e completare il prezzo
            dopo.
          </p>
          <Link to={`/prezzi?lista=${id}`}>Calcola e salva la previsione prima della spesa →</Link>
        </div>
      )}
      {frequent.size > 0 && (
        <Panel title="Acquistati spesso">
          <p className="muted">
            Dagli acquisti reali non annullati. Ogni pulsante aggiunge 1 unità indicata; puoi poi correggere
            la quantità.
          </p>
          <div className="inline wrap">
            {[...frequent.values()]
              .sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name, 'it'))
              .slice(0, 8)
              .map(({ item }) => (
                <button
                  className="button secondary"
                  key={item.id}
                  onClick={() =>
                    void act(() =>
                      rpc('add_list_item', {
                        p_list: id,
                        p_name: item.name,
                        p_quantity: '1',
                        p_unit: item.unit,
                        p_generic: item.generic_product_id,
                        p_specific: item.specific_product_id,
                      }),
                    )
                  }
                >
                  {item.name} · 1 {item.unit}
                </button>
              ))}
          </div>
        </Panel>
      )}
      <Panel title="Aggiungi alla lista">
        <AddListItemForm key={id} listId={id} />
      </Panel>
      <label className="field search-field">
        Filtra articoli
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nella lista…" />
      </label>
      <section className="panel">
        <h2>
          Da acquistare <span className="count">{pending.length}</span>
        </h2>
        {groups.map((group) => {
          const rows = pending.filter(
            (i) =>
              (categoryFor(i)?.name ?? 'Altri prodotti') === group &&
              i.name.toLowerCase().includes(search.toLowerCase()),
          )
          return rows.length > 0 ? (
            <div className="category-group" key={group}>
              <h3>{group}</h3>
              {rows.map(renderItem)}
            </div>
          ) : null
        })}
        {!pending.length && (
          <Empty title={items.length ? 'Tutto acquistato!' : 'Una lista, tante possibilità.'}>
            {items.length
              ? 'Puoi sempre correggere gli acquisti qui sotto.'
              : 'Aggiungi il primo articolo per cominciare.'}
          </Empty>
        )}
      </section>
      <label className="checkbox">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Mostra articoli rimossi
      </label>
      {showArchived && (
        <Panel title="Articoli rimossi dalla lista">
          {data.shopping_list_items
            .filter((i) => i.list_id === id && i.archived_at)
            .map((i) => (
              <div className="data-row" key={i.id}>
                <span>{i.name}</span>
                <ConfirmButton
                  message={`Rimettere «${i.name}» nella lista della spesa?`}
                  success="Articolo rimesso nella lista della spesa."
                  onConfirm={() =>
                    rpc('set_record_archived', {
                      p_type: 'shopping_list_items',
                      p_id: i.id,
                      p_archived: false,
                      p_version: listVersion,
                    })
                  }
                >
                  Rimetti nella lista
                </ConfirmButton>
              </div>
            ))}
        </Panel>
      )}
      {done.length > 0 && (
        <section className="panel">
          <h2>
            Acquistati <span className="count">{done.length}</span>
          </h2>
          {done.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())).map(renderItem)}
        </section>
      )}
    </>
  )
}
