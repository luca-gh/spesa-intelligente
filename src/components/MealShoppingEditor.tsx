import { unitLabel } from '../domain/math'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../data/context'
import type { Meal } from '../data/types'
import { update } from '../data/client'
import { mealChoices, mealName, mealOptions } from '../data/mealShopping'
import { Panel, Submit } from './ui'

export function MealShoppingEditor({
  meal,
  onPrepared,
  onClose,
}: {
  meal: Meal
  onPrepared: () => void
  onClose: () => void
}) {
  const { data, household, busy, online, act } = useApp()
  const options = mealOptions(data, meal, household!.default_diners)
  const [choices, setChoices] = useState(() => mealChoices(data, meal, household!.default_diners))
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    root.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [])
  return (
    <div ref={root} tabIndex={-1} className="meal-shopping-editor">
      <Panel title={`Da comprare per ${mealName(data, meal)}`}>
        <p className="muted">
          Spunta solo ciò che manca. Le quantità tengono conto delle persone del pasto. La lista cambia dopo
          l’anteprima e la conferma.
        </p>
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault()
            const valid = Object.fromEntries(
              options
                .filter((o) => choices[o.key] && [o.productId, ...o.alternatives].includes(choices[o.key]))
                .map((o) => [o.key, choices[o.key]]),
            )
            if (await act(() => update('meal_entries', meal.id, { shopping_choices: valid }))) onPrepared()
          }}
        >
          {options.map((option) => {
            const name = data.generic_products.find((p) => p.id === option.productId)?.name ?? 'Alimento'
            return (
              <div key={option.key} className="meal-food-choice">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    disabled={busy || !online}
                    checked={!!choices[option.key]}
                    onChange={(event) =>
                      setChoices((current) => {
                        const next = { ...current }
                        if (event.target.checked) next[option.key] = option.productId
                        else delete next[option.key]
                        return next
                      })
                    }
                  />
                  {name} · {option.quantity} {unitLabel(option.unit)}
                </label>
                {!!option.alternatives.length && (
                  <label className="field">
                    Alternativa per {name}
                    <select
                      aria-label={`Alternativa per ${name}`}
                      disabled={busy || !online || !choices[option.key]}
                      value={choices[option.key] ?? option.productId}
                      onChange={(event) =>
                        setChoices((current) => ({ ...current, [option.key]: event.target.value }))
                      }
                    >
                      {[option.productId, ...option.alternatives].map((id) => (
                        <option key={id} value={id}>
                          {data.generic_products.find((p) => p.id === id)?.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )
          })}
          {!options.length && <p>Questo pasto a testo libero non aggiunge prodotti alla spesa.</p>}
          {!!options.length && <Submit>Salva selezione e prepara lista</Submit>}
          <button type="button" className="text-button" onClick={onClose}>
            Chiudi pasto
          </button>
        </form>
      </Panel>
    </div>
  )
}
