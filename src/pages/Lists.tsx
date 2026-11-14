import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, ArrowLeft, Check, ShoppingBasket } from 'lucide-react'
import { useApp } from '../data/context'
import { insert, remove, rpc, update } from '../data/client'
import { euro, quantity } from '../domain/math'
import type { Item } from '../data/types'
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
  UnitSelect,
} from '../components/ui'

export function Lists() {
  const { '*': id } = useParams()
  return id ? <ListDetail id={id} /> : <ListIndex />
}
function ListIndex() {
  const { data, household, itemQuantity, act } = useApp()
  const [filter, setFilter] = useState('active')
  return (
    <>
      <SectionTitle eyebrow="UNA COSA IN MENO A CUI PENSARE" title="Le vostre liste." />
      <Panel title="Crea una lista">
        <Form
          className="inline-form"
          onSave={(f) => insert('shopping_lists', household!.id, { title: text(f, 'title') })}
        >
          <Field label="Titolo della lista" name="title" placeholder="La spesa della settimana" />
          <Submit>
            <Plus size={18} /> Crea lista
          </Submit>
        </Form>
      </Panel>
      <div className="tabs">
        {[
          ['active', 'Attive'],
          ['completed', 'Completate'],
          ['archived', 'Archiviate'],
        ].map(([value, label]) => (
          <button className={filter === value ? 'selected' : ''} key={value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="cards">
        {data.shopping_lists
          .filter((l) => l.status === filter)
          .map((list) => {
            const items = data.shopping_list_items.filter((i) => i.list_id === list.id)
            return (
              <article className="panel" key={list.id}>
                <span className="list-icon">
                  <ShoppingBasket />
                </span>
                <h2>
                  <Link to={`/liste/${list.id}`}>{list.title}</Link>
                </h2>
                <p>
                  {items.filter((i) => Number(itemQuantity(i).remaining) === 0).length} di {items.length}{' '}
                  acquistati
                </p>
                <div className="inline">
                  <Link className="button secondary" to={`/liste/${list.id}`}>
                    Apri lista
                  </Link>
                  <button
                    className="text-button"
                    onClick={() =>
                      void act(() =>
                        update('shopping_lists', list.id, {
                          status: filter === 'archived' ? 'active' : 'archived',
                        }),
                      )
                    }
                  >
                    {filter === 'archived' ? 'Ripristina' : 'Archivia'}
                  </button>
                  <ConfirmButton
                    message="Eliminare questa lista? Se contiene articoli o acquisti, l’eliminazione viene bloccata per preservare lo storico."
                    onConfirm={() => remove('shopping_lists', list.id)}
                  >
                    Elimina
                  </ConfirmButton>
                </div>
              </article>
            )
          })}
      </div>
      {!data.shopping_lists.some((l) => l.status === filter) && (
        <Empty title="Nessuna lista in questa sezione">
          Crea una lista per condividere quello che serve.
        </Empty>
      )}
    </>
  )
}
function ListDetail({ id }: { id: string }) {
  const { data, household, itemQuantity, act } = useApp()
  const list = data.shopping_lists.find((l) => l.id === id)
  const [shopping, setShopping] = useState(false)
  const [store, setStore] = useState('')
  const [search, setSearch] = useState('')
  const [buy, setBuy] = useState<string | null>(null)
  const [edit, setEdit] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [purchaseOperation, setPurchaseOperation] = useState(crypto.randomUUID())
  if (!list)
    return (
      <Empty title="Lista non disponibile">
        <Link to="/liste">Torna alle liste</Link>
      </Empty>
    )
  const items = data.shopping_list_items
    .filter((i) => i.list_id === id)
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
  const groups = [...new Set(pending.map((i) => categoryFor(i)?.name ?? 'Altri prodotti'))].sort((a, b) => {
    const order = (name: string) => data.categories.find((c) => c.name === name)?.sort_order ?? 999
    return order(a) - order(b) || a.localeCompare(b, 'it')
  })
  const frequent = new Map<string, { item: Item; count: number }>()
  for (const purchase of data.purchases.filter((p) => !p.voided_at)) {
    const old = data.shopping_list_items.find((i) => i.id === purchase.list_item_id)
    if (!old) continue
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
            <ConfirmButton
              message="Eliminare l’articolo e i suoi contributi? Lo storico degli acquisti impedisce l’eliminazione."
              onConfirm={() => rpc('remove_list_item', { p_item: item.id, p_version: listVersion })}
            >
              Elimina articolo
            </ConfirmButton>
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
      <Link className="back-link" to="/liste">
        <ArrowLeft size={17} /> Tutte le liste
      </Link>
      <SectionTitle eyebrow={`${pending.length} ARTICOLI DA ACQUISTARE`} title={list.title}>
        <button className="button" onClick={() => setShopping(!shopping)}>
          <ShoppingBasket size={18} />
          {shopping ? 'Chiudi modalità spesa' : 'Inizia la spesa'}
        </button>
      </SectionTitle>
      <div className="inline list-toolbar">
        <button
          className="text-button"
          onClick={() => {
            const title = window.prompt('Nuovo titolo', list.title)
            if (title?.trim()) void act(() => update('shopping_lists', id, { title: title.trim() }))
          }}
        >
          Rinomina
        </button>
        <button className="text-button" onClick={() => void act(() => rpc('duplicate_list', { p_list: id }))}>
          Duplica
        </button>
        <button
          className="text-button"
          onClick={() =>
            void act(() =>
              update('shopping_lists', id, { status: list.status === 'completed' ? 'active' : 'completed' }),
            )
          }
        >
          {list.status === 'completed' ? 'Riattiva' : 'Segna lista completata'}
        </button>
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
        <Form
          className="item-form"
          onSave={(f) => {
            const ref = text(f, 'product')
            const product = data.generic_products.find((g) => g.id === ref)
            const specific = data.specific_products.find((s) => s.id === ref)
            return rpc('add_list_item', {
              p_list: id,
              p_name: product?.name ?? specific?.name ?? text(f, 'name'),
              p_quantity: quantity(text(f, 'quantity')).toString(),
              p_unit: text(f, 'unit'),
              p_generic: product?.id ?? null,
              p_specific: specific?.id ?? null,
            })
          }}
        >
          <label className="field">
            Cerca nel catalogo
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Nome del prodotto…"
            />
          </label>
          <Select label="Prodotto (facoltativo)" name="product" required={false}>
            <option value="">Articolo libero</option>
            <optgroup label="Generici">
              {data.generic_products
                .filter((g) => g.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Commerciali">
              {data.specific_products
                .filter((s) => s.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          </Select>
          <Field
            label="Nome per articolo libero"
            name="name"
            required={false}
            placeholder="Es. pane fresco"
          />
          <Field label="Quantità" name="quantity" value="1" />
          <UnitSelect />
          <Submit>
            <Plus size={18} /> Aggiungi
          </Submit>
        </Form>
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
