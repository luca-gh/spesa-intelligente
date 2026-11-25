import { ArchiveButton, ArchiveFilter } from '../components/ArchiveButton'
import { useEffect, useRef, useState } from 'react'
import { BarcodeImport } from '../components/BarcodeImport'
import { CategoryOrder } from '../components/CategoryOrder'
import { ProductPrices } from '../components/ProductPrices'
import { CurrentPriceComparison } from '../components/CurrentPriceComparison'
import { barcodeSourceName, type BarcodeProduct } from '../domain/barcodeLookup'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Store as StoreIcon } from 'lucide-react'
import { useApp } from '../data/context'
import { insert, remove, removeCatalogProduct, rpc, update } from '../data/client'
import { convert, parsePrice, quantity, validBarcode, type Unit } from '../domain/math'
import {
  catalogPriceLabel,
  unitPriceLabel,
  validatePriceBasis,
  type PriceBasis,
} from '../domain/catalogPrices'
import { PriceField } from '../components/PriceField'
import { PriceBasisSelect } from '../components/PriceBasisSelect'
import { isPam, pamDiscount, storePrice } from '../domain/storePrices'
import { PamDiscountToggle } from '../components/PamDiscountToggle'
import {
  catalogProducts,
  productFormat,
  catalogTotals,
  catalogFormatFields,
  bulkPriceUnit,
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
  const { data, act, busy, online } = useApp()
  const stores = data.stores.filter((s) => !s.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [productsExpanded, setProductsExpanded] = useState(true)
  const [selected, setSelected] = useState('')
  const [initialStore, setInitialStore] = useState('')
  const [initialAmount, setInitialAmount] = useState('')
  const [initialBasis, setInitialBasis] = useState<PriceBasis>('package')
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
    setInitialStore('')
    setInitialAmount('')
    setInitialBasis('package')
    setRevision((value) => value + 1)
  }
  const categories = [...data.categories, { id: '', name: 'Altri prodotti' }].sort((a, b) =>
    a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }),
  )
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
              const values = {
                p_id: product?.id ?? null,
                p_specific: editing?.kind === 'specific',
                p_name: text(f, 'name'),
                p_category: text(f, 'category') || null,
                p_brand: text(f, 'brand'),
                p_barcode: barcode || null,
                p_variant: text(f, 'variant'),
                p_quantity: size ? quantity(size).toString() : null,
                p_unit: unit || null,
              }
              const withPrice = !editing && (!!initialStore || !!initialAmount.trim())
              if (withPrice && (!initialStore || !initialAmount.trim()))
                throw new Error('Prezzo non valido: completa supermercato e importo iniziale.')
              if (withPrice) validatePriceBasis(unit || null, initialBasis)
              const saved = withPrice
                ? await rpc('create_catalog_product_with_price', {
                    p_product: values,
                    p_store: initialStore,
                    p_amount: parsePrice(initialAmount),
                    p_basis: initialBasis,
                  })
                : await rpc('save_catalog_product', values)
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
                Serve per calcolare il prezzo al kg/l/pz e confrontare quantità diverse. Puoi lasciarlo vuoto.
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
                  {['g', 'ml', 'pz'].map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </Select>
              </div>
            </fieldset>
            {!editing && (
              <fieldset>
                <legend>Prezzo iniziale</legend>
                {stores.length ? (
                  <>
                    <p className="muted">
                      Puoi salvare subito il prezzo di un supermercato, oppure lasciare questi campi vuoti.
                      Per i prodotti sfusi scegli €/kg o €/l.
                    </p>
                    <label className="field">
                      Supermercato del prezzo iniziale
                      <select
                        aria-label="Supermercato del prezzo iniziale"
                        name="initial_store"
                        value={initialStore}
                        onChange={(e) => setInitialStore(e.target.value)}
                        disabled={busy || !online}
                      >
                        <option value="">Non inserire un prezzo</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PriceBasisSelect value={initialBasis} onChange={setInitialBasis} name="initial_basis" />
                    <PriceField
                      label="Prezzo iniziale (€)"
                      name="initial_amount"
                      rawValue={initialAmount}
                      onChange={setInitialAmount}
                      required={false}
                    />
                  </>
                ) : (
                  <p className="muted">
                    Aggiungi un <Link to="/negozi">supermercato</Link> per registrare un prezzo iniziale.
                  </p>
                )}
              </fieldset>
            )}
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
          anche i dati collegati e i prezzi. Archivia conserva tutti i dati.
        </p>
        <ArchiveFilter value={archived} onChange={setArchived} />
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Prodotti del catalogo">
          <table>
            <thead>
              <tr>
                <th aria-sort="ascending">Prodotto</th>
                <th>Marca</th>
                <th>Formato</th>
                <th>Prezzi</th>
                <th>Categoria</th>
                <th>EAN</th>
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
                    <td>{specific?.brand || '—'}</td>
                    <td>{specific ? productFormat(specific) : 'Non indicato'}</td>
                    <td>
                      <dl className="catalog-store-prices">
                        {stores.map((store) => {
                          const price =
                            specific &&
                            data.product_prices.find(
                              (price) =>
                                price.specific_product_id === specific.id && price.store_id === store.id,
                            )
                          return (
                            <div key={store.id}>
                              <dt>
                                {store.name}
                                {pamDiscount(store) && ' · −10%'}
                              </dt>
                              <dd>
                                {price
                                  ? catalogPriceLabel(
                                      storePrice(price.price_amount, store),
                                      price.price_basis,
                                    )
                                  : '-'}
                                {price && specific && (
                                  <small>
                                    {unitPriceLabel(
                                      storePrice(price.price_amount, store, false),
                                      specific,
                                      price.price_basis,
                                    )}
                                  </small>
                                )}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                      {!stores.length && <span>-</span>}
                    </td>
                    <td>
                      {data.categories.find((c) => c.id === entry.categoryId)?.name ?? 'Altri prodotti'}
                    </td>
                    <td>{specific?.barcode || '—'}</td>
                    <td>
                      {!p.archived_at && (
                        <button
                          className="text-button"
                          disabled={busy || !online || !data.shopping_lists[0]}
                          onClick={() =>
                            void act(
                              () =>
                                rpc('add_shopping_product', {
                                  p_list: data.shopping_lists[0].id,
                                  p_name: p.name,
                                  p_quantity: '1',
                                  p_unit:
                                    specific && !specific.package_unit
                                      ? (bulkPriceUnit(data, [specific.id]) ?? 'conf')
                                      : 'conf',
                                  p_generic: specific ? null : p.id,
                                  p_specific: specific?.id ?? null,
                                  p_brand: null,
                                  p_package_quantity: null,
                                  p_package_unit: null,
                                }),
                              'Prodotto aggiunto alla lista.',
                            )
                          }
                        >
                          Aggiungi alla lista
                        </button>
                      )}
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
                        message={`Eliminare definitivamente «${p.name}»${specific?.brand ? ` (${specific.brand})` : ''}? Verranno cancellati anche gli articoli collegati nella lista, gli acquisti, i prezzi e i collegamenti. Se non restano altre marche o varianti dello stesso alimento, verrà tolto anche dagli ingredienti delle ricette, dai pasti e dai modelli. Le ricette e gli altri prodotti resteranno. Non è possibile annullare questa operazione.`}
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
  const [params] = useSearchParams()
  const [compareOpen, setCompareOpen] = useState(() => params.get('confronto') === '1')
  const { data, household } = useApp()
  const [editing, setEditing] = useState('')
  const [editRevision, setEditRevision] = useState(0)
  const storeEditor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editing) return
    const input = storeEditor.current?.querySelector<HTMLInputElement>('input[name="name"]')
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [editing, editRevision])
  const [archived, setArchived] = useState(false)
  const [categoryStoreId, setCategoryStoreId] = useState('')
  const categoryStore =
    data.stores.find((s) => s.id === categoryStoreId && !s.archived_at) ??
    data.stores.find((s) => !s.archived_at)
  const store = data.stores.find((s) => s.id === editing)
  return (
    <>
      <SectionTitle eyebrow="SCEGLI DOVE FARE LA SPESA" title="I vostri supermercati." />
      <details className="panel" open={compareOpen}>
        <summary
          onClick={(event) => {
            event.preventDefault()
            setCompareOpen((open) => !open)
          }}
        >
          Confronta il costo della lista
        </summary>
        {compareOpen && <CurrentPriceComparison />}
      </details>
      <Panel title={store ? 'Modifica punto vendita' : 'Aggiungi un punto vendita'}>
        <div ref={storeEditor}>
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
              if (store)
                await update('stores', store.id, {
                  ...values,
                  pam_discount_enabled: isPam(values) && !!store.pam_discount_enabled,
                })
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
        </div>
        <p className="muted">
          I prezzi sono specifici del singolo negozio. Non vengono trasferiti tra punti vendita della stessa
          catena.
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
              <PamDiscountToggle store={s} />
              <div className="inline">
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(s.id)
                    setEditRevision((value) => value + 1)
                  }}
                >
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
                  message={`Eliminare il punto vendita «${s.name}»? Verranno rimossi anche i suoi prezzi attuali. Puoi usare Archivia per nasconderlo senza eliminarlo.`}
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
// Explicitly reusable when importing ingredient quantities with compatible units.
export { convert }
