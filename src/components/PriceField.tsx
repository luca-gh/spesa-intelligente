import { useId, useState } from 'react'
import { priceInputError, priceInputValue } from '../domain/math'

export function PriceField({
  label,
  name,
  value,
  required = true,
  placeholder = 'Es. 2,50',
}: {
  label: string
  name: string
  value?: string | number | null
  required?: boolean
  placeholder?: string
}) {
  const id = useId()
  const [error, setError] = useState('')
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      <input
        name={name}
        type="text"
        inputMode="decimal"
        defaultValue={priceInputValue(value)}
        required={required}
        placeholder={placeholder}
        maxLength={30}
        aria-labelledby={`${id}-label`}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        onChange={(event) => {
          const message = priceInputError(event.currentTarget.value)
          event.currentTarget.setCustomValidity(message)
          setError(message)
        }}
        onInvalid={(event) => {
          setError(priceInputError(event.currentTarget.value) || 'Prezzo non valido: inserisci un importo.')
        }}
      />
      <small className="muted" id={`${id}-help`}>
        Decimali con la virgola, es. 2,50.
      </small>
      {error && (
        <small className="form-error" role="alert" id={`${id}-error`}>
          {error}
        </small>
      )}
    </label>
  )
}
