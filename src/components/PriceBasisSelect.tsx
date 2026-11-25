import type { PriceBasis } from '../domain/catalogPrices'
import { useApp } from '../data/context'
export function PriceBasisSelect({
  value,
  onChange,
  name = 'price_basis',
}: {
  value: PriceBasis
  onChange: (value: PriceBasis) => void
  name?: string
}) {
  const { busy, online } = useApp()
  return (
    <label className="field">
      Tipo di prezzo
      <select
        aria-label="Tipo di prezzo"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value as PriceBasis)}
        disabled={busy || !online}
      >
        <option value="package">Prezzo del prodotto</option>
        <option value="kg">€/kg</option>
        <option value="l">€/l</option>
      </select>
    </label>
  )
}
