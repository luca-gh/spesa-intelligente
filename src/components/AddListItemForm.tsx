import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import { catalogProducts, productFormat } from '../data/catalog'
import { convert, quantity, units, type Unit } from '../domain/math'
import { Submit } from './ui'

export function AddListItemForm({ listId }: { listId: string }) {
  const { data, act, busy, online } = useApp()
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [requested, setRequested] = useState('1')
  const [unit, setUnit] = useState<Unit>('pz')
  const [error, setError] = useState('')
  const helpId = useId()
  const generic = data.generic_products.find((product) => product.id === productId)
  const specific = data.specific_products.find((product) => product.id === productId)
  const selected = generic ?? specific
  const anyBrand = !!specific?.generic_product_id && !specific.brand && !specific.barcode && !specific.variant
  const allChoices = catalogProducts(data)
  const hasCatalog = allChoices.some(({ product }) => !product.archived_at)
  const baseUnit = generic?.canonical_unit ?? specific?.package_unit
  const availableUnits = baseUnit
    ? units.filter((candidate) => {
        try {
          convert('1', candidate, baseUnit)
          return true
        } catch {
          return false
        }
      })
    : units
  const query = search.trim().toLocaleLowerCase('it')
  const generics = data.generic_products
    .filter((p) => !p.is_catalog_group)
    .filter((p) => !p.archived_at)
    .filter((product) => product.name.toLocaleLowerCase('it').includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const specifics = data.specific_products
    .filter((p) => !p.archived_at)
    .filter((product) =>
      [
        product.name,
        product.brand,
        product.variant,
        product.barcode,
        data.generic_products.find((g) => g.id === product.generic_product_id)?.name,
      ]
        .join(' ')
        .toLocaleLowerCase('it')
        .includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const genericIds = new Set(generics.map((p) => p.id))
  const specificIds = new Set(specifics.map((p) => p.id))

  function chooseProduct(id: string) {
    setProductId(id)
    setName('')
    setError('')
    const nextGeneric = data.generic_products.find((product) => product.id === id)
    const nextSpecific = data.specific_products.find((product) => product.id === id)
    setUnit(
      nextGeneric?.canonical_unit ??
        nextSpecific?.package_unit ??
        data.generic_products.find((g) => g.id === nextSpecific?.generic_product_id)?.canonical_unit ??
        'pz',
    )
    setRequested(nextSpecific?.package_quantity ?? '1')
  }

  function changeUnit(next: Unit) {
    if (selected) {
      try {
        setRequested(convert(requested, unit, next).toString())
      } catch {
        /* Keep incomplete input available for correction. */
      }
    }
    setUnit(next)
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!selected && !name.trim()) {
      setError('Scrivi il nome dell’articolo oppure scegli un prodotto dal catalogo.')
      return
    }
    let amount: string
    try {
      const parsed = quantity(requested)
      if (!parsed.gt(0)) throw new Error('Non positivo')
      if (baseUnit) convert(parsed.toString(), unit, baseUnit)
      amount = parsed.toString()
    } catch {
      setError('Inserisci una quantità maggiore di zero e un’unità compatibile con il prodotto.')
      return
    }
    const saved = await act(() =>
      rpc('add_list_item', {
        p_list: listId,
        p_name: selected?.name ?? name.trim(),
        p_quantity: amount,
        p_unit: unit,
        p_generic: generic?.id ?? (anyBrand ? specific!.generic_product_id : null),
        p_specific: anyBrand ? null : (specific?.id ?? null),
      }),
    )
    if (saved) {
      setSearch('')
      chooseProduct('')
    }
  }

  return (
    <form
      className={`form item-form ${hasCatalog ? '' : 'empty-catalog'}`}
      aria-label="Aggiungi un articolo alla lista"
      onSubmit={save}
    >
      <p className="muted item-help" id={helpId}>
        Scegli un prodotto già presente nel catalogo per collegare categoria, formato e confronto prezzi. Puoi
        anche scrivere un articolo libero, che resta solo nella lista.
      </p>
      {hasCatalog && (
        <label className="field catalog-search">
          <span>Cerca nel catalogo</span>
          <input
            value={search}
            maxLength={200}
            disabled={busy || !online}
            placeholder="Nome, marca o barcode…"
            onChange={(event) => {
              setSearch(event.target.value)
              if (productId) chooseProduct('')
            }}
          />
        </label>
      )}
      <label className="field catalog-product">
        <span>Prodotto dal catalogo (facoltativo)</span>
        <select
          name="product"
          aria-label="Prodotto dal catalogo (facoltativo)"
          value={selected?.id ?? ''}
          disabled={!hasCatalog || busy || !online}
          aria-describedby={helpId}
          onChange={(event) => chooseProduct(event.target.value)}
        >
          <option value="">Nessuno: scrivi un articolo libero</option>
          {allChoices
            .filter((entry) =>
              entry.kind === 'generic' ? genericIds.has(entry.product.id) : specificIds.has(entry.product.id),
            )
            .map((entry) => (
              <option key={entry.kind + entry.product.id} value={entry.product.id}>
                {entry.product.name}
                {entry.kind === 'specific'
                  ? [entry.product.brand, entry.product.variant, productFormat(entry.product)]
                      .filter(Boolean)
                      .map((value) => ` · ${value}`)
                      .join('')
                  : ''}
              </option>
            ))}
        </select>
      </label>
      {!hasCatalog && (
        <p className="muted item-help">
          Il catalogo è vuoto. Scrivi il nome dell’articolo qui sotto oppure aggiungi prima un prodotto nel{' '}
          <Link to="/catalogo">Catalogo prodotti</Link>.
        </p>
      )}
      {hasCatalog && generics.length + specifics.length === 0 && (
        <p className="muted item-help" role="status">
          Nessun prodotto trovato. Puoi scrivere il nome qui sotto per aggiungere un articolo libero.
        </p>
      )}
      {specific?.package_quantity && specific.package_unit ? (
        <p className="muted item-help">
          Formato selezionato: {specific.package_quantity} {specific.package_unit} per confezione. La quantità
          iniziale corrisponde a una confezione: puoi modificarla.
        </p>
      ) : specific ? (
        <p className="muted item-help">
          Formato non indicato: scegli quantità e unità per questa lista. Il confronto prezzi richiede il
          formato della confezione nel catalogo.
        </p>
      ) : null}
      {(generic || anyBrand) && (
        <p className="muted item-help">
          Non è indicata una marca: il confronto considera i formati disponibili per questo prodotto.
        </p>
      )}
      {!selected && (
        <label className="field item-name">
          <span>Nome per articolo libero</span>
          <input
            name="name"
            value={name}
            required
            disabled={busy || !online}
            maxLength={200}
            placeholder="Es. pane fresco"
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
          />
        </label>
      )}
      <label className="field">
        <span>Quantità</span>
        <input
          name="quantity"
          value={requested}
          inputMode="decimal"
          required
          disabled={busy || !online}
          maxLength={30}
          onChange={(event) => {
            setRequested(event.target.value)
            setError('')
          }}
        />
      </label>
      <label className="field">
        <span>Unità</span>
        <select
          name="unit"
          aria-label="Unità"
          value={unit}
          disabled={busy || !online}
          onChange={(event) => changeUnit(event.target.value as Unit)}
        >
          {availableUnits.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {error && (
        <p className="item-help form-error" role="alert">
          {error}
        </p>
      )}
      <Submit>
        <Plus size={18} /> Aggiungi
      </Submit>
    </form>
  )
}
