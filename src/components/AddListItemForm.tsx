import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../data/context'
import { rpc } from '../data/client'
import { listProductGroups, productFormat } from '../data/catalog'
import { convert, quantity, units, type Unit } from '../domain/math'
import { Submit } from './ui'
import { ListBarcodePicker } from './ListBarcodePicker'
import { SearchSelect } from './SearchSelect'

export function AddListItemForm({ listId }: { listId: string }) {
  const { data, act, busy, online } = useApp()
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [brand, setBrand] = useState('')
  const [formatId, setFormatId] = useState('')
  const [exactId, setExactId] = useState('')
  const [name, setName] = useState('')
  const [requested, setRequested] = useState('1')
  const [unit, setUnit] = useState<Unit>('pz')
  const [error, setError] = useState('')
  const [scanRevision, setScanRevision] = useState(0)
  const [params, setParams] = useSearchParams()
  const incomingProduct = params.get('prodotto')
  const groups = listProductGroups(data)
  const group = groups.find((g) => g.id === productId)
  const specific = data.specific_products.find((p) => p.id === exactId && !p.archived_at)
  const candidates = group?.products.filter((p) => !brand || p.brand === brand) ?? []
  const brands = [...new Set(group?.products.map((p) => p.brand).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'it'),
  )
  const formats = candidates
    .filter((p) => p.package_quantity && p.package_unit)
    .filter((p, index, all) => all.findIndex((other) => productFormat(other) === productFormat(p)) === index)
  const format = candidates.find((p) => p.id === formatId)
  const baseUnit = format?.package_unit ?? specific?.package_unit
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
  const chooseProduct = useCallback(
    (id: string, exact = true) => {
      const all = listProductGroups(data)
      const next = all.find((g) => g.id === id || g.products.some((p) => p.id === id))
      const card = exact ? data.specific_products.find((p) => p.id === id) : undefined
      setProductId(next?.id ?? '')
      setBrand(card?.brand ?? '')
      setFormatId(card?.package_quantity && card.package_unit ? card.id : '')
      setExactId(card?.id ?? '')
      if (exact) setSearch('')
      setName('')
      setError('')
      setUnit(card?.package_unit ?? (next ? 'conf' : 'pz'))
      setRequested(card?.package_quantity ?? '1')
    },
    [data],
  )

  useEffect(() => {
    if (!incomingProduct || busy) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      if (data.specific_products.some((p) => p.id === incomingProduct && !p.archived_at))
        chooseProduct(incomingProduct)
      else setError('Prodotto non disponibile. Controlla il Catalogo oppure inserisci un articolo libero.')
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!group && !name.trim()) {
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
      rpc('add_shopping_product', {
        p_list: listId,
        p_name: group?.name ?? name.trim(),
        p_quantity: amount,
        p_unit: unit,
        p_generic: specific ? null : (group?.genericId ?? null),
        p_specific: specific?.id ?? null,
        p_brand: specific ? null : brand || null,
        p_package_quantity: specific ? null : (format?.package_quantity ?? null),
        p_package_unit: specific ? null : (format?.package_unit ?? null),
      }),
    )
    if (saved) {
      chooseProduct('')
      setScanRevision((v) => v + 1)
    }
  }

  return (
    <>
      <ListBarcodePicker key={scanRevision} onSelect={(id) => chooseProduct(id)} />
      <form className="form item-form" aria-label="Aggiungi un articolo alla lista" onSubmit={save}>
        <p className="muted item-help">
          Scegli il nome del prodotto. Marca e formato sono facoltativi; puoi anche aggiungere un articolo
          libero.
        </p>
        <SearchSelect
          className="catalog-product"
          label="Prodotto dal catalogo"
          name="product"
          choices={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={group?.id ?? ''}
          query={search}
          onQueryChange={setSearch}
          onSelect={(id) => {
            if (id || productId) chooseProduct(id, false)
          }}
          required={false}
          disabled={!groups.length}
          placeholder="Scrivi il nome del prodotto…"
          helpText="Scrivi il nome e seleziona un risultato. Poi puoi scegliere marca e formato."
          emptyText="Nessun prodotto trovato. Puoi scrivere il nome qui sotto per aggiungere un articolo libero."
        />
        {group && (
          <>
            {!!brands.length && (
              <label className="field">
                <span>Marca (facoltativa)</span>
                <select
                  aria-label="Marca (facoltativa)"
                  value={brand}
                  disabled={busy || !online}
                  onChange={(event) => {
                    setBrand(event.target.value)
                    setFormatId('')
                    setExactId('')
                    setRequested('1')
                    setUnit('conf')
                  }}
                >
                  <option value="">Qualsiasi marca</option>
                  {brands.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
            )}
            {!!formats.length && (
              <label className="field">
                <span>Formato (facoltativo)</span>
                <select
                  aria-label="Formato (facoltativo)"
                  value={
                    formats.some((p) => p.id === formatId)
                      ? formatId
                      : format
                        ? (formats.find((p) => productFormat(p) === productFormat(format))?.id ?? '')
                        : ''
                  }
                  disabled={busy || !online}
                  onChange={(event) => {
                    const next = candidates.find((p) => p.id === event.target.value)
                    setFormatId(event.target.value)
                    setExactId('')
                    setRequested(next?.package_quantity ?? '1')
                    setUnit(next?.package_unit ?? 'conf')
                  }}
                >
                  <option value="">Qualsiasi formato</option>
                  {formats.map((p) => (
                    <option key={p.id} value={p.id}>
                      {productFormat(p)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {specific && (
              <p className="muted item-help">
                Selezionato dal barcode: {specific.name}
                {specific.brand ? ` · ${specific.brand}` : ''} · {productFormat(specific)}.
              </p>
            )}
            <button
              type="button"
              className="text-button item-help"
              disabled={busy || !online}
              onClick={() => chooseProduct('')}
            >
              Scrivi un articolo libero
            </button>
          </>
        )}
        {!groups.length && (
          <p className="muted item-help">
            Il catalogo è vuoto. Scrivi il nome dell’articolo qui sotto oppure aggiungi prima un prodotto nel{' '}
            <Link to="/catalogo">Catalogo prodotti</Link>.
          </p>
        )}
        {!group && (
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
            onChange={(event) => {
              const next = event.target.value as Unit
              try {
                if (group) setRequested(convert(requested, unit, next).toString())
              } catch {
                /* Preserve incomplete quantity. */
              }
              setUnit(next)
              setError('')
            }}
          >
            {availableUnits.map((u) => (
              <option key={u}>{u}</option>
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
