import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import { catalogProducts, productFormat } from '../data/catalog'
import { convert, quantity, units, type Unit } from '../domain/math'
import { Submit } from './ui'
import { ListBarcodePicker } from './ListBarcodePicker'
import { SearchSelect } from './SearchSelect'

export function AddListItemForm({ listId }: { listId: string }) {
  const { data, act, busy, online } = useApp()
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [requested, setRequested] = useState('1')
  const [unit, setUnit] = useState<Unit>('pz')
  const [error, setError] = useState('')
  const [scanRevision, setScanRevision] = useState(0)
  const [params, setParams] = useSearchParams()
  const incomingProduct = params.get('prodotto')
  const allChoices = catalogProducts(data).filter(({ product }) => !product.archived_at)
  const currentChoice = allChoices.find(({ product }) => product.id === productId)
  const generic = currentChoice?.kind === 'generic' ? currentChoice.product : undefined
  const specific = currentChoice?.kind === 'specific' ? currentChoice.product : undefined
  const selected = generic ?? specific
  const anyBrand = !!specific?.generic_product_id && !specific.brand && !specific.barcode && !specific.variant
  const hasCatalog = allChoices.length > 0
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
  const choices = allChoices.map((entry) => ({
    value: entry.product.id,
    sortLabel: entry.product.name,
    label:
      entry.kind === 'specific'
        ? [entry.product.name, entry.product.brand, entry.product.variant, productFormat(entry.product)]
            .filter(Boolean)
            .join(' · ')
        : entry.product.name,
    searchText:
      entry.kind === 'specific'
        ? [
            entry.product.barcode,
            data.generic_products.find((g) => g.id === entry.product.generic_product_id)?.name,
          ]
            .filter(Boolean)
            .join(' ')
        : '',
  }))

  const chooseProduct = useCallback(
    (id: string) => {
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
    },
    [data.generic_products, data.specific_products],
  )

  useEffect(() => {
    if (!incomingProduct || busy) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      const product = data.specific_products.find((p) => p.id === incomingProduct && !p.archived_at)
      if (product) {
        setSearch('')
        chooseProduct(product.id)
      } else setError('Prodotto non disponibile. Controlla il Catalogo oppure inserisci un articolo libero.')
      setParams(
        (current) => {
          current.delete('prodotto')
          return current
        },
        { replace: true },
      )
    })
    return () => {
      active = false
    }
  }, [incomingProduct, busy, data.specific_products, chooseProduct, setParams])

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
      setScanRevision((value) => value + 1)
    }
  }

  return (
    <>
      <ListBarcodePicker
        key={scanRevision}
        onSelect={(id) => {
          setSearch('')
          chooseProduct(id)
        }}
      />
      <form className="form item-form" aria-label="Aggiungi un articolo alla lista" onSubmit={save}>
        <p className="muted item-help">
          Scegli un prodotto già presente nel catalogo per collegare categoria, formato e confronto prezzi.
          Puoi anche scrivere un articolo libero, che resta solo nella lista.
        </p>
        <SearchSelect
          className="catalog-product"
          label="Prodotto dal catalogo"
          name="product"
          choices={choices}
          value={selected?.id ?? ''}
          query={search}
          onQueryChange={setSearch}
          onSelect={(id) => {
            if (id || productId) chooseProduct(id)
          }}
          required={false}
          disabled={!hasCatalog}
          placeholder="Scrivi nome, marca o barcode…"
          helpText="Scrivi per cercare e seleziona un risultato, oppure inserisci un articolo libero qui sotto."
          emptyText="Nessun prodotto trovato. Puoi scrivere il nome qui sotto per aggiungere un articolo libero."
        />
        {selected && (
          <button
            type="button"
            className="text-button item-help"
            disabled={busy || !online}
            onClick={() => {
              setSearch('')
              chooseProduct('')
            }}
          >
            Scrivi un articolo libero
          </button>
        )}
        {!hasCatalog && (
          <p className="muted item-help">
            Il catalogo è vuoto. Scrivi il nome dell’articolo qui sotto oppure aggiungi prima un prodotto nel{' '}
            <Link to="/catalogo">Catalogo prodotti</Link>.
          </p>
        )}
        {specific?.package_quantity && specific.package_unit ? (
          <p className="muted item-help">
            Formato selezionato: {specific.package_quantity} {specific.package_unit} per confezione. La
            quantità iniziale corrisponde a una confezione: puoi modificarla.
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
    </>
  )
}
