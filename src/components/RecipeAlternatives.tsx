import { useState } from 'react'
import { useApp } from '../data/context'
import { ingredientProducts } from '../data/catalog'
import { insert, remove } from '../data/client'
import type { Ingredient } from '../data/types'
import { SearchSelect } from './SearchSelect'
import { Form, Submit, text } from './ui'

export function AlternativeFields({ index }: { index: number }) {
  const { data } = useApp()
  const [count, setCount] = useState(0)
  return (
    <div className="ingredient-alternatives">
      {Array.from({ length: count }, (_, n) => (
        <SearchSelect
          key={n}
          label={`Alternativa ${n + 1} per ingrediente ${index + 1}`}
          name={`alternative${index}`}
          choices={ingredientProducts(data).map((p) => ({ value: p.id, label: p.name }))}
        />
      ))}
      <p className="muted">Le alternative usano la stessa quantità e unità dell’ingrediente.</p>
      <div className="inline wrap">
        <button
          className="text-button"
          type="button"
          disabled={count >= 20}
          onClick={() => setCount(count + 1)}
        >
          Aggiungi alternativa
        </button>
        {count > 0 && (
          <button className="text-button" type="button" onClick={() => setCount(count - 1)}>
            Rimuovi ultima alternativa
          </button>
        )}
      </div>
    </div>
  )
}

export function IngredientAlternatives({ ingredient }: { ingredient: Ingredient }) {
  const { data, household, act, busy, online } = useApp()
  const alternatives = data.recipe_ingredient_alternatives.filter((a) => a.ingredient_id === ingredient.id)
  const [revision, setRevision] = useState(0)
  return (
    <div className="ingredient-alternatives">
      {alternatives.map((a) => (
        <div className="inline wrap" key={a.id}>
          <span>oppure {data.generic_products.find((p) => p.id === a.generic_product_id)?.name}</span>
          <button
            className="text-button"
            type="button"
            disabled={busy || !online}
            onClick={() => void act(() => remove('recipe_ingredient_alternatives', a.id))}
          >
            Rimuovi alternativa
          </button>
        </div>
      ))}
      <details>
        <summary>Gestisci alternative</summary>
        <p className="muted">
          Stessa quantità e unità: {ingredient.quantity} {ingredient.unit}.
        </p>
        <Form
          key={revision}
          onSave={async (f) => {
            await insert('recipe_ingredient_alternatives', household!.id, {
              ingredient_id: ingredient.id,
              generic_product_id: text(f, 'alternative'),
            })
            setRevision((value) => value + 1)
          }}
        >
          <SearchSelect
            label="Prodotto alternativo"
            name="alternative"
            choices={ingredientProducts(data)
              .filter(
                (p) =>
                  p.id !== ingredient.generic_product_id &&
                  !alternatives.some((a) => a.generic_product_id === p.id),
              )
              .map((p) => ({ value: p.id, label: p.name }))}
          />
          <Submit>Aggiungi alternativa</Submit>
        </Form>
      </details>
    </div>
  )
}

export function IngredientChoices({
  ingredients,
  choices,
  onChange,
}: {
  ingredients: Ingredient[]
  choices: Record<string, string>
  onChange: (id: string, product: string) => void
}) {
  const { data } = useApp()
  return (
    <>
      {ingredients.map((ingredient) => {
        const alternatives = data.recipe_ingredient_alternatives.filter(
          (a) => a.ingredient_id === ingredient.id,
        )
        if (!alternatives.length) return null
        const ids = [ingredient.generic_product_id, ...alternatives.map((a) => a.generic_product_id)]
        const name =
          data.generic_products.find((p) => p.id === ingredient.generic_product_id)?.name ?? 'Ingrediente'
        return (
          <label className="field" key={ingredient.id}>
            Usa per ingrediente {name}
            <select
              aria-label={`Usa per ingrediente ${name}`}
              value={
                ids.includes(choices[ingredient.id]) ? choices[ingredient.id] : ingredient.generic_product_id
              }
              onChange={(event) => onChange(ingredient.id, event.target.value)}
            >
              {ids.map((id) => (
                <option key={id} value={id}>
                  {data.generic_products.find((p) => p.id === id)?.name}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </>
  )
}
