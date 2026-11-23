import { ArchiveButton, ArchiveFilter } from '../components/ArchiveButton'
import { useEffect, useRef, useState } from 'react'
import { BarcodeImport } from '../components/BarcodeImport'
import { CategoryOrder } from '../components/CategoryOrder'
import { ProductPrices } from '../components/ProductPrices'
import { barcodeSourceName, type BarcodeProduct } from '../domain/barcodeLookup'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Tag, Store as StoreIcon } from 'lucide-react'
import { useApp } from '../data/context'
import { insert, remove, removeCatalogProduct, rpc, update } from '../data/client'
import {
  convert,
  dateInZone,
  euro,
  quantity,
  parsePrice,
  units,
  validBarcode,
  type Unit,
} from '../domain/math'
import { PriceField } from '../components/PriceField'
import { estimate, rank } from '../domain/prices'
import {
  catalogProducts,
  productFormat,
  orderedCategories,
  catalogTotals,
  catalogFormatFields,
} from '../data/catalog'
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

export function Catalog() {
  const { data } = useApp()
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [productsExpanded, setProductsExpanded] = useState(true)
  const [selected, setSelected] = useState('')
  const [prefill, setPrefill] = useState<
    (BarcodeProduct & { category: string; variant?: string; message?: string }) | null
  >(null)
  const [catalogParams, setCatalogParams] = useSearchParams()
  const navigate = useNavigate()
  const fromList = catalogParams.get('origine') === 'lista'
  const [revision, setRevision] = useState(0)
  const editor = useRef<HTMLDivElement>(null)
  const pricePanel = useRef<HTMLDivElement>(null)
  const [focusPrices, setFocusPrices] = useState(false)
  useEffect(() => {
    if (!selected) return
    const name = focusPrices
      ? pricePanel.current
      : editor.current?.querySelector<HTMLInputElement>('input[name="name"]')
    name?.focus({ preventScroll: true })
    name?.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
  }, [selected, revision, focusPrices])
  const readDraft = () => new FormData(editor.current!.querySelector('form')!)
  const selectProduct = (key: string, prices = false) => {
    setSelected(key)
    setFocusPrices(prices)
    setPrefill(null)
    setRevision((value) => value + 1)
  }
  const categories = orderedCategories(data.categories)
  const allProducts = catalogProducts(data)
  const summary = catalogTotals(data)
  const editing = allProducts.find((entry) => entry.kind + ':' + entry.product.id === selected)
  const product = editing?.product
  const details = editing?.kind === 'specific' ? editing.product : undefined
  const format = catalogFormatFields(
    prefill?.size ?? details?.package_quantity,
    prefill?.unit ?? details?.package_unit,
  )
  const query = search.trim().toLocaleLowerCase('it')
  const products = allProducts.filter(
    (entry) =>
      !!entry.product.archived_at === archived &&
      [
        entry.product.name,
        entry.kind === 'specific' ? entry.product.brand : '',
        entry.kind === 'specific' ? entry.product.barcode : '',
      ]
        .join(' ')
        .toLocaleLowerCase('it')
        .includes(query),
  )
  return (
    <>
      <SectionTitle eyebrow="SAPERE COSA SCEGLIERE" title="Il vostro catalogo." />
      <Panel title="Riepilogo catalogo">
        <dl className="catalog-summary" aria-label="Totali del catalogo">
          <div>
            <dt>Prodotti attivi</dt>
            <dd>{summary.products}</dd>
          </div>
          <div>
            <dt>Categorie</dt>
            <dd>{summary.categories}</dd>
          </div>
        </dl>
      </Panel>
      {fromList && (
        <p className="callout">
          Completa e salva il prodotto: tornerai alla lista con il prodotto selezionato. Potrai controllare la
          quantità e premere Aggiungi. <Link to="/liste">Torna alla lista senza salvare</Link>
        </p>
      )}
      <Panel title={editing ? 'Modifica prodotto' : 'Nuovo prodotto'}>
        <p className="muted">
          È obbligatorio solo il nome. Puoi aggiungere o completare gli altri dettagli in seguito.
        </p>
        <div ref={editor}>
          <BarcodeImport
            key={`barcode:${selected}:${revision}`}
            initialCode={catalogParams.get('barcode') ?? ''}
            onConsumed={() =>
              setCatalogParams(
                (current) => {
                  current.delete('barcode')
                  return current
                },
                { replace: true },
              )
            }
            readDraft={readDraft}
            onOpen={(id) => selectProduct(`specific:${id}`)}
            onApply={(found, category) => {
              setPrefill({ ...found, category })
              setRevision((value) => value + 1)
            }}
            onCodeOnly={(barcode, message) => {
              const draft = readDraft()
              setPrefill({
                barcode,
                message,
                name: text(draft, 'name'),
                brand: text(draft, 'brand'),
                size: text(draft, 'size'),
                unit: text(draft, 'unit') as Unit | '',
                variant: text(draft, 'variant'),
                category: text(draft, 'category'),
                categories: [],
                sourceUrl: '',
              })
              setRevision((value) => value + 1)
            }}
          />
          {prefill && (
            <p className="callout" role="status">
              {prefill.message ??
                'Campi compilati dai dati disponibili. Verifica e completa prima di salvare.'}
              {!prefill.category && ' Categoria da scegliere manualmente.'}
              {!prefill.name && ' Nome da inserire manualmente.'}{' '}
              {prefill.sourceUrl && (
                <a href={prefill.sourceUrl} target="_blank" rel="noreferrer">
                  Fonte {barcodeSourceName(prefill)}
                </a>
              )}
            </p>
          )}
          <Form
            key={`form:${selected}:${revision}`}
            onSave={async (f) => {
              const barcode = text(f, 'barcode')
              const size = text(f, 'size')
              const unit = text(f, 'unit')
              if (barcode && !validBarcode(barcode))
                throw new Error('Quantità non valida: controlla il checksum del barcode EAN.')
              if (!!size !== !!unit)
                throw new Error(
                  'Quantità non valida: completa quantità e unità del formato, oppure lascia entrambi vuoti.',
                )
              const saved = await rpc('save_catalog_product', {
                p_id: product?.id ?? null,
                p_specific: editing?.kind === 'specific',
                p_name: text(f, 'name'),
                p_category: text(f, 'category') || null,
                p_brand: text(f, 'brand'),
                p_barcode: barcode || null,
                p_variant: text(f, 'variant'),
                p_quantity: size ? quantity(size).toString() : null,
                p_unit: unit || null,
              })
              selectProduct('')
              if (fromList && typeof saved?.id === 'string')
                navigate(`/liste?prodotto=${encodeURIComponent(saved.id)}`, { replace: true })
            }}
          >
            <div className="grid-form">
              <Field
                label="Nome prodotto"
                name="name"
                value={prefill?.name ?? product?.name}
                placeholder="Latte parzialmente scremato"
              />
              <Select
                label="Categoria"
                name="category"
                value={prefill?.category ?? editing?.categoryId ?? ''}
                required={false}
              >
                <option value="">Altri prodotti</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Field
                label="Marca (facoltativa)"
                name="brand"
                value={prefill?.brand ?? details?.brand}
                required={false}
                placeholder="Es. Abit"
              />
              <Field
                label="EAN-8 / EAN-13 (facoltativo)"
                name="barcode"
                value={prefill?.barcode ?? details?.barcode ?? ''}
                required={false}
              />
              <Field
                label="Variante / note sul prodotto (facoltative)"
                name="variant"
                value={prefill ? (prefill.variant ?? '') : details?.variant}
                required={false}
              />
            </div>
            <fieldset>
              <legend>Formato della confezione</legend>
              <p className="muted">
                Indicalo quando lo conosci: serve per confrontare quantità e prezzi. Se manca, la stima
                segnala il prezzo come non disponibile.
              </p>
              <div className="grid-form">
                <Field
                  label="Quantità per confezione"
                  name="size"
                  value={format.size}
                  required={false}
                  placeholder="Es. 1 oppure 500"
                />
                <Select label="Unità del formato" name="unit" value={format.unit} required={false}>
                  <option value="">Non indicata</option>
                  {units
                    .filter((unit) => unit !== 'kg' && unit !== 'L')
                    .map((unit) => (
                      <option key={unit}>{unit}</option>
                    ))}
                </Select>
              </div>
            </fieldset>
            <div className="inline">
              <Submit>Salva prodotto</Submit>
              {editing && (
                <button className="text-button" type="button" onClick={() => selectProduct('')}>
                  Annulla modifica
                </button>
              )}
            </div>
          </Form>
        </div>
      </Panel>
      {details && (
        <div ref={pricePanel} tabIndex={-1} className="product-prices">
          <ProductPrices key={details.id} product={details} />
        </div>
      )}
      <label className="field search-field">
        Cerca prodotto, marca o barcode
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setProductsExpanded(true)
          }}
          placeholder="Es. latte parzialmente scremato…"
        />
      </label>
      <details className="panel catalog-products" open={productsExpanded}>
        <summary
          onClick={(event) => {
            event.preventDefault()
            setProductsExpanded((expanded) => !expanded)
          }}
        >
          <h2>
            Prodotti <span className="count">{products.length}</span>
          </h2>
          <span className="text-button">{productsExpanded ? 'Riduci tabella' : 'Espandi tabella'}</span>
        </summary>
        <p className="muted">
          I prodotti sono sempre in ordine alfabetico per nome. Rimuovi dal catalogo elimina definitivamente
          anche i dati collegati e lo storico prezzi. Archivia conserva tutti i dati.
        </p>
        <ArchiveFilter value={archived} onChange={setArchived} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th aria-sort="ascending">Prodotto</th>
                <th>Categoria</th>
                <th>Marca</th>
                <th>EAN</th>
                <th>Formato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {products.map((entry) => {
                const p = entry.product
                const specific = entry.kind === 'specific' ? entry.product : undefined
                const table = entry.kind === 'specific' ? 'specific_products' : 'generic_products'
                const key = entry.kind + ':' + p.id
                return (
                  <tr key={key} data-product-id={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {specific?.variant && <small>{specific.variant}</small>}
                    </td>
                    <td>
                      {data.categories.find((c) => c.id === entry.categoryId)?.name ?? 'Altri prodotti'}
                    </td>
                    <td>{specific?.brand || '—'}</td>
                    <td>{specific?.barcode || '—'}</td>
                    <td>{specific ? productFormat(specific) : 'Non indicato'}</td>
                    <td>
                      <button className="text-button" onClick={() => selectProduct(key)}>
                        Modifica
                      </button>
                      {specific && (
                        <button className="text-button" onClick={() => selectProduct(key, true)}>
                          Prezzi
                        </button>
                      )}
                      <ArchiveButton
                        table={table}
                        record={p}
                        onDone={() => {
                          if (selected === key) selectProduct('')
                        }}
                      />
                      <ConfirmButton
                        message={`Eliminare definitivamente «${p.name}»${specific?.brand ? ` (${specific.brand})` : ''}? Verranno cancellati anche gli articoli collegati nella lista, gli acquisti, lo storico prezzi e le previsioni che li contengono. Se non restano altre marche o varianti dello stesso alimento, verrà tolto anche dagli ingredienti delle ricette, dai pasti e dai modelli. Le ricette e gli altri prodotti resteranno. Non è possibile annullare questa operazione.`}
                        success="Prodotto e dati collegati eliminati definitivamente."
                        onConfirm={async () => {
                          await removeCatalogProduct(table, p.id)
                          if (selected === key) selectProduct('')
                        }}
                      >
                        Rimuovi dal catalogo
                      </ConfirmButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <Empty title={archived ? 'Nessun prodotto archiviato' : 'Nessun prodotto in questa vista'}>
            Aggiungi un prodotto oppure modifica la ricerca.
          </Empty>
        )}
      </details>
      <p className="muted">
        <Link to="/negozi">Gestisci categorie e ordine delle corsie nei supermercati →</Link>
      </p>
    </>
  )
}
export function Stores() {
  const { data, household } = useApp()
  const [editing, setEditing] = useState('')
  const [archived, setArchived] = useState(false)
  const [categoryStoreId, setCategoryStoreId] = useState('')
  const categoryStore =
    data.stores.find((s) => s.id === categoryStoreId && !s.archived_at) ??
    data.stores.find((s) => !s.archived_at)
  const store = data.stores.find((s) => s.id === editing)
  return (
    <>
      <SectionTitle eyebrow="OGNI NEGOZIO HA LA SUA STORIA" title="I vostri supermercati." />
      <Panel title={store ? 'Modifica punto vendita' : 'Aggiungi un punto vendita'}>
        <Form
          key={editing}
          className="grid-form"
          onSave={async (f) => {
            const values = {
              name: text(f, 'name'),
              chain: text(f, 'chain'),
              address: text(f, 'address'),
              city: text(f, 'city'),
            }
            if (store) await update('stores', store.id, values)
            else await insert('stores', household!.id, values)
            setEditing('')
          }}
        >
          <Field label="Nome del punto vendita" name="name" value={store?.name} />
          <Field label="Catena" name="chain" required={false} value={store?.chain} />
          <Field label="Indirizzo" name="address" value={store?.address} />
          <Field label="Città" name="city" value={store?.city} />
          <Submit />
        </Form>
        <p className="muted">
          I prezzi e gli sconti sono specifici del singolo negozio. Non vengono trasferiti tra punti vendita
          della stessa catena.
        </p>
      </Panel>
      <div className="cards">
        {data.stores
          .filter((s) => !!s.archived_at === archived)
          .map((s) => (
            <article className="panel" key={s.id}>
              <StoreIcon className="green" />
              <h2>{s.name}</h2>
              <p>
                {s.chain}
                <br />
                {s.address}, {s.city}
              </p>
              {s.archived_at && <span className="pill">Archiviato</span>}
              <div className="inline">
                <button className="text-button" onClick={() => setEditing(s.id)}>
                  Modifica
                </button>
                <ArchiveButton
                  table="stores"
                  record={s}
                  onDone={() => {
                    if (editing === s.id) setEditing('')
                  }}
                />
                <ConfirmButton
                  message={`Eliminare il punto vendita «${s.name}»? Se ha dati collegati, usa Archivia per conservare lo storico.`}
                  success="Punto vendita eliminato."
                  onConfirm={async () => {
                    await remove('stores', s.id)
                    if (editing === s.id) setEditing('')
                  }}
                >
                  Elimina
                </ConfirmButton>
              </div>
            </article>
          ))}
      </div>
      <Panel title="Categorie e corsie dei supermercati">
        <p className="muted">
          Le categorie sono comuni. Ogni supermercato ha il proprio ordine; rinomina ed eliminazione valgono
          per tutti.
        </p>
        <Form
          className="inline-form"
          onSave={(f) =>
            insert('categories', household!.id, {
              name: text(f, 'name'),
              sort_order: Math.max(-1, ...data.categories.map((c) => c.sort_order)) + 1,
            })
          }
        >
          <Field label="Nuova categoria" name="name" />
          <Submit>
            <Plus size={16} /> Aggiungi
          </Submit>
        </Form>
        <label className="field">
          Supermercato per ordine categorie
          <select
            value={categoryStore?.id ?? ''}
            onChange={(event) => setCategoryStoreId(event.target.value)}
          >
            {!categoryStore && <option value="">Ordine iniziale: aggiungi un supermercato</option>}
            {data.stores
              .filter((s) => !s.archived_at)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <CategoryOrder key={categoryStore?.id ?? 'default'} storeId={categoryStore?.id} />
      </Panel>
      <ArchiveFilter value={archived} onChange={setArchived} />
      {!data.stores.length && (
        <Empty title="Dove fate la spesa?">Aggiungi il primo punto vendita per registrare i prezzi.</Empty>
      )}
    </>
  )
}
export function Prices() {
  const { data, household, itemQuantity, act } = useApp()
  const list = data.shopping_lists[0]?.id ?? ''
  const [date, setDate] = useState(dateInZone(new Date(), household!.timezone))
  const [ruleId, setRuleId] = useState('')
  const rule = data.store_discount_rules.find((r) => r.id === ruleId)
  const requested = data.shopping_list_items
    .filter((i) => i.list_id === list && !i.archived_at)
    .map((i) => ({ ...i, quantity: itemQuantity(i).remaining }))
  const estimates = rank(
    data.stores
      .filter((s) => !s.archived_at)
      .map((s) =>
        estimate(
          s.id,
          requested,
          data.specific_products.filter(
            (p) => !p.archived_at || requested.some((i) => i.specific_product_id === p.id),
          ),
          data.price_observations,
          data.store_discount_rules,
          date,
          household!.timezone,
        ),
      ),
  )
  return (
    <>
      <SectionTitle eyebrow="PREZZI CHIARI, SCELTE CONSAPEVOLI" title="Quanto costa la vostra spesa?" />
      <Panel title="Confronta la tua spesa">
        <div className="grid-form">
          <label className="field">
            Data prevista della spesa
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value)
              }}
            />
          </label>
        </div>
        <p className="muted">
          Stima per un solo supermercato alla volta, sulle quantità residue e sulle confezioni intere. Un
          prezzo storico non garantisce disponibilità né prezzo attuale. Sconti arrotondati per riga al
          centesimo.
        </p>
      </Panel>
      {list && (
        <div className="estimates">
          {estimates.map((e) => (
            <section className="panel" key={e.storeId}>
              <div className="panel-heading">
                <h2>{data.stores.find((s) => s.id === e.storeId)?.name}</h2>
                <span className={`pill ${e.complete ? '' : 'warning'}`}>
                  {e.complete ? 'Copertura completa' : `Parziale · ${e.known}/${e.totalItems}`}
                </span>
              </div>
              <div className="estimate-total">
                {euro(e.total)} <small>{e.complete ? 'totale stimato' : 'solo articoli con prezzo'}</small>
              </div>
              <p>
                Risparmio personale: {euro(e.savings)} · Rilevazione più vecchia:{' '}
                {e.oldest
                  ? new Date(e.oldest).toLocaleDateString('it-IT', { timeZone: household!.timezone })
                  : 'non disponibile'}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Articolo</th>
                      <th>Confezioni</th>
                      <th>Base</th>
                      <th>Sconto</th>
                      <th>Finale</th>
                      <th>Rilevazione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.itemId}>
                        <td>
                          {l.productName ?? requested.find((i) => i.id === l.itemId)?.name}
                          {l.promotional && <small>In promozione</small>}
                          {l.ruleName && <small>{l.ruleName}</small>}
                          {l.uncertain && <small>Altre rilevazioni incerte: verifica in negozio</small>}
                        </td>
                        <td>{l.packs || '—'}</td>
                        <td>{l.gross !== null ? euro(l.gross) : 'Prezzo sconosciuto'}</td>
                        <td>{euro(l.discount)}</td>
                        <td>{l.net !== null ? euro(l.net) : '—'}</td>
                        <td>
                          {l.observedAt
                            ? new Date(l.observedAt).toLocaleDateString('it-IT', {
                                timeZone: household!.timezone,
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button secondary"
                disabled={!e.totalItems}
                onClick={() =>
                  void act(() =>
                    rpc('save_estimate', {
                      p_list: list,
                      p_store: e.storeId,
                      p_total: e.total,
                      p_coverage: e.totalItems ? e.known / e.totalItems : 0,
                      p_date: date,
                      p_detail: e,
                    }),
                  )
                }
              >
                Salva previsione datata
              </button>
            </section>
          ))}
        </div>
      )}
      <div className="price-settings">
        <Panel title={rule ? 'Modifica sconto personale' : 'Sconto personale ricorrente'}>
          <Form
            key={ruleId}
            onSave={async (f) => {
              const values = {
                store_id: text(f, 'store'),
                name: text(f, 'name'),
                percentage: quantity(text(f, 'percent')).toString(),
                weekdays: f.getAll('days').map(Number),
                valid_from: text(f, 'start'),
                valid_to: text(f, 'end') || null,
                exclude_promotional_items: !f.has('stack'),
                confirmed: f.has('confirmed'),
                minimum_total: parsePrice(text(f, 'minimum') || '0'),
                maximum_discount: text(f, 'maximum') ? parsePrice(text(f, 'maximum')) : null,
                conditions_note: text(f, 'notes'),
                excluded_product_ids: f.getAll('excluded').map(String),
                priority: Number(text(f, 'priority')),
              }
              if (rule) await update('store_discount_rules', rule.id, values)
              else await insert('store_discount_rules', household!.id, values)
              setRuleId('')
            }}
          >
            <Field
              label="Nome della regola"
              name="name"
              value={rule?.name}
              placeholder="Sconto tessera del mercoledì"
            />
            <Select label="Solo in questo punto vendita" name="store" value={rule?.store_id}>
              <option value="">Seleziona negozio</option>
              {data.stores
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Field label="Percentuale (%)" name="percent" value={rule?.percentage ?? '10'} />
            <fieldset>
              <legend>Giorni della settimana</legend>
              <div className="inline wrap">
                {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day, i) => (
                  <label className="checkbox" key={day}>
                    <input
                      type="checkbox"
                      name="days"
                      value={i}
                      defaultChecked={rule?.weekdays.includes(i) ?? false}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Valido dal" name="start" type="date" value={rule?.valid_from ?? date} />
            <Field
              label="Valido fino al (facoltativo)"
              name="end"
              type="date"
              required={false}
              value={rule?.valid_to ?? ''}
            />
            <PriceField
              label="Soglia minima per riga (€)"
              name="minimum"
              value={rule?.minimum_total ?? '0'}
            />
            <PriceField
              label="Sconto massimo per riga (€), facoltativo"
              name="maximum"
              required={false}
              value={rule?.maximum_discount ?? ''}
            />
            <Field
              label="Priorità (si applica una sola regola per riga)"
              name="priority"
              type="number"
              value={rule?.priority ?? 0}
            />
            <label className="field">
              Prodotti esclusi
              <select multiple name="excluded" defaultValue={rule?.excluded_product_ids ?? []}>
                {data.specific_products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Condizioni, tessera ed esclusioni" name="notes" required={false} />
            <label className="checkbox">
              <input
                type="checkbox"
                name="stack"
                defaultChecked={rule ? !rule.exclude_promotional_items : false}
              />{' '}
              Condizioni verificate: cumulabile con prodotti in promozione
            </label>
            <label className="checkbox">
              <input type="checkbox" name="confirmed" defaultChecked={rule?.confirmed ?? false} /> Ho
              verificato le condizioni effettive del negozio
            </label>
            <Submit>Salva regola</Submit>
          </Form>
          <p className="muted">
            Le regole non confermate restano inattive nei calcoli. Ogni regola va configurata e confermata
            manualmente. Le soglie e i massimali attuali si riferiscono alla singola riga, non allo scontrino.
          </p>
        </Panel>
      </div>
      <Panel title="Regole configurate">
        {data.store_discount_rules.map((r) => (
          <div className="data-row" key={r.id}>
            <Tag size={18} />
            <div>
              <strong>
                {r.name} · {r.percentage}%
              </strong>
              <small>
                {data.stores.find((s) => s.id === r.store_id)?.name} · {r.active ? 'Attiva' : 'Disattivata'} ·{' '}
                {r.confirmed ? 'Confermata' : 'Da verificare'}
              </small>
            </div>
            <button className="text-button" onClick={() => setRuleId(r.id)}>
              Modifica
            </button>
            <button
              className="text-button"
              onClick={() => void act(() => update('store_discount_rules', r.id, { active: !r.active }))}
            >
              {r.active ? 'Disattiva' : 'Attiva'}
            </button>
            <ConfirmButton
              message={`Eliminare la regola «${r.name}»? Le previsioni già salvate non cambieranno.`}
              onConfirm={async () => {
                await remove('store_discount_rules', r.id)
                if (ruleId === r.id) setRuleId('')
              }}
            >
              Elimina
            </ConfirmButton>
          </div>
        ))}
        {!data.store_discount_rules.length && (
          <p className="muted">Nessuna regola. Nessuno sconto personale viene presunto.</p>
        )}
      </Panel>
      <p>
        <Link to="/catalogo">Inserisci, correggi e consulta i prezzi dei prodotti nel Catalogo →</Link>
      </p>
    </>
  )
}

// Explicitly reusable when importing ingredient quantities with compatible units.
export { convert }
