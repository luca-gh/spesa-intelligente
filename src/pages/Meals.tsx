import { unitLabel } from '../domain/math'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Decimal from 'decimal.js'
import { CalendarDays, Star, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { useApp } from '../data/context'
import { insert, remove, rpc, update } from '../data/client'
import { ingredientProducts } from '../data/catalog'
import { MealShoppingEditor } from '../components/MealShoppingEditor'
import { mealName, mealShoppingRows, mealSlots } from '../data/mealShopping'
import { chosenIngredient } from '../data/recipeChoices'
import { SearchSelect } from '../components/SearchSelect'
import {
  AlternativeFields,
  IngredientAlternatives,
  IngredientChoices,
} from '../components/RecipeAlternatives'
import { convert, dateInZone, quantity, scale, units, type Unit } from '../domain/math'
import { previewDiff, type Contribution } from '../domain/planning'
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

export function Recipes() {
  const { data, act } = useApp()
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [selected, setSelected] = useState('')
  const [servings, setServings] = useState(2)
  const [ingredientCount, setIngredientCount] = useState(1)
  const [ingredientChoices, setIngredientChoices] = useState<Record<string, string>>({})
  const recipe = data.recipes.find((r) => r.id === selected)
  const ingredients = data.recipe_ingredients.filter((i) => i.recipe_id === selected)
  return (
    <>
      <SectionTitle eyebrow="LE COSE BUONE DA PORTARE IN TAVOLA" title="Il vostro ricettario." />
      <div className="inline">
        <label className="field grow">
          Cerca per titolo o ingrediente
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cosa cuciniamo?" />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={favorites} onChange={(e) => setFavorites(e.target.checked)} /> Solo
          preferite
        </label>
      </div>
      {recipe && (
        <Panel title={recipe.title}>
          <div className="inline">
            <p className="muted">
              Aggiungere ingredienti rimette in lista gli eventuali articoli rimossi corrispondenti.
            </p>
            <label className="field">
              Porzioni richieste
              <input
                type="number"
                min="1"
                max="100"
                value={servings}
                onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <span className="muted">Ricetta base per {recipe.base_servings} persone</span>
          </div>
          <ul className="ingredients">
            {ingredients.map((i) => (
              <li key={i.id}>
                <strong>
                  {scale(i.quantity, recipe.base_servings, servings, i.unit === 'pz' || i.unit === 'conf')}{' '}
                  {unitLabel(i.unit)}
                </strong>{' '}
                {data.generic_products.find((p) => p.id === i.generic_product_id)?.name}
                <IngredientAlternatives ingredient={i} />
                <ConfirmButton
                  message="Rimuovere questo ingrediente dalla ricetta? Le liste già create non cambieranno; i piani richiederanno una nuova anteprima."
                  onConfirm={() => remove('recipe_ingredients', i.id)}
                >
                  Rimuovi ingrediente
                </ConfirmButton>
              </li>
            ))}
          </ul>
          <p className="pre-line">{recipe.instructions}</p>
          {recipe.notes && <p>{recipe.notes}</p>}
          {recipe.source_url && (
            <a href={recipe.source_url} rel="noreferrer" target="_blank">
              Fonte della ricetta ↗
            </a>
          )}
          <p className="muted">
            Pezzi e confezioni sono arrotondati per eccesso; le altre quantità a 3 decimali. La ricetta
            originale non cambia.
          </p>
          <div className="inline">
            <button
              className="text-button"
              onClick={() => {
                const title = prompt('Titolo', recipe.title)
                if (title?.trim()) void act(() => update('recipes', recipe.id, { title: title.trim() }))
              }}
            >
              Rinomina
            </button>
            <button
              className="text-button"
              onClick={() => {
                const instructions = prompt('Procedimento', recipe.instructions)
                if (instructions !== null) void act(() => update('recipes', recipe.id, { instructions }))
              }}
            >
              Modifica procedimento
            </button>
            <button
              className="text-button"
              onClick={() => void act(() => rpc('duplicate_recipe', { p_recipe: recipe.id }))}
            >
              Duplica ricetta
            </button>
            <ConfirmButton
              message="Eliminare questa ricetta? I collegamenti ai pasti possono impedire l’eliminazione."
              onConfirm={async () => {
                await remove('recipes', recipe.id)
                setSelected('')
              }}
            >
              Elimina
            </ConfirmButton>
          </div>
          <Form
            className="inline-form"
            onSave={() =>
              rpc('add_recipe_choices_to_list', {
                p_recipe: recipe.id,
                p_list: data.shopping_lists[0]?.id,
                p_servings: servings,
                p_operation: crypto.randomUUID(),
                p_choices: Object.fromEntries(
                  ingredients.map((i) => [i.id, chosenIngredient(data, i, ingredientChoices)]),
                ),
              })
            }
          >
            <p className="muted">Gli ingredienti vengono aggiunti alla lista della spesa condivisa.</p>
            <IngredientChoices
              ingredients={ingredients}
              choices={ingredientChoices}
              onChange={(id, product) => setIngredientChoices((current) => ({ ...current, [id]: product }))}
            />
            <Submit>Aggiungi ingredienti</Submit>
          </Form>
        </Panel>
      )}
      <div className="cards">
        {data.recipes
          .filter(
            (r) =>
              !r.archived_at &&
              (!favorites || r.is_favorite) &&
              (r.title.toLowerCase().includes(search.toLowerCase()) ||
                data.recipe_ingredients
                  .filter((i) => i.recipe_id === r.id)
                  .some((i) =>
                    [
                      i.generic_product_id,
                      ...data.recipe_ingredient_alternatives
                        .filter((a) => a.ingredient_id === i.id)
                        .map((a) => a.generic_product_id),
                    ].some((id) =>
                      data.generic_products
                        .find((p) => p.id === id)
                        ?.name.toLowerCase()
                        .includes(search.toLowerCase()),
                    ),
                  )),
          )
          .map((r) => (
            <article className="panel recipe-card" key={r.id}>
              <div className="recipe-art" aria-hidden="true">
                ♧
              </div>
              <div className="panel-heading">
                <h2>
                  <button
                    className="text-button title-button"
                    onClick={() => {
                      setSelected(r.id)
                      setServings(r.base_servings)
                    }}
                  >
                    {r.title}
                  </button>
                </h2>
                <button
                  className="icon-button"
                  aria-label={`${r.is_favorite ? 'Rimuovi' : 'Aggiungi'} preferita ${r.title}`}
                  onClick={() => void act(() => update('recipes', r.id, { is_favorite: !r.is_favorite }))}
                >
                  <Star size={21} fill={r.is_favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p>
                {r.base_servings} porzioni ·{' '}
                {data.recipe_ingredients.filter((i) => i.recipe_id === r.id).length} ingredienti
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setSelected(r.id)
                  setServings(r.base_servings)
                }}
              >
                Apri ricetta →
              </button>
            </article>
          ))}
      </div>
      {!data.recipes.length && (
        <Empty title="Le vostre ricette del cuore">Inizia con un piatto che amate preparare.</Empty>
      )}
      <Panel title="Scrivi una ricetta">
        <Form
          onSave={(f) =>
            rpc('save_recipe', {
              p_title: text(f, 'title'),
              p_servings: Number(text(f, 'servings')),
              p_instructions: text(f, 'instructions'),
              p_source: text(f, 'source') || null,
              p_ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
                product_id: text(f, `product${i}`),
                quantity: quantity(text(f, `quantity${i}`)).toString(),
                unit: text(f, `unit${i}`),
                ...(f.getAll(`alternative${i}`).length
                  ? { alternatives: f.getAll(`alternative${i}`).map(String).filter(Boolean) }
                  : {}),
              })),
            })
          }
        >
          <div className="grid-form">
            <Field label="Titolo" name="title" />
            <Field label="Porzioni di base" name="servings" type="number" value="2" min={1} max={100} />
          </div>
          <fieldset>
            <legend>Ingredienti del catalogo</legend>
            {Array.from({ length: ingredientCount }, (_, i) => (
              <div className="ingredient-form" key={i}>
                <SearchSelect
                  label={`Ingrediente ${i + 1}`}
                  name={`product${i}`}
                  choices={ingredientProducts(data).map((g) => ({ value: g.id, label: g.name }))}
                />
                <Field label="Quantità" name={`quantity${i}`} value="1" />
                <Select label="Unità" name={`unit${i}`}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </Select>
                <AlternativeFields index={i} />
              </div>
            ))}
            <button
              className="text-button"
              type="button"
              onClick={() => setIngredientCount(Math.min(50, ingredientCount + 1))}
            >
              <Plus size={16} /> Altro ingrediente
            </button>
            {ingredientCount > 1 && (
              <button
                className="text-button"
                type="button"
                onClick={() => setIngredientCount(ingredientCount - 1)}
              >
                Rimuovi ultimo ingrediente
              </button>
            )}
          </fieldset>
          <label className="field">
            Procedimento
            <textarea name="instructions" required rows={5} />
          </label>
          <Field label="URL fonte (facoltativo)" name="source" type="url" required={false} />
          <Submit>Salva ricetta</Submit>
        </Form>
        <p className="muted">
          Importazione da URL e OCR: da completare nella fase 5. Puoi inserire e revisionare manualmente gli
          ingredienti.
        </p>
      </Panel>
    </>
  )
}
function monday(date: string) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function Meals() {
  const { data, household, act, itemQuantity, busy } = useApp()
  const [week, setWeek] = useState(monday(dateInZone(new Date(), household!.timezone)))
  const plan = data.meal_plans.find((p) => p.week_start === week)
  const entries = useMemo(
    () => data.meal_entries.filter((e) => e.meal_plan_id === plan?.id && e.meal_slot !== 'spuntino'),
    [data.meal_entries, plan?.id],
  )
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const selectedMeal = entries.find((e) => e.id === selectedMealId)
  const [freeMode, setFreeMode] = useState(false)
  const [mealUnit, setMealUnit] = useState<Unit>('pz')
  const [prepareRequested, setPrepareRequested] = useState(false)
  const previewRoot = useRef<HTMLDivElement>(null)
  const listId = data.shopping_lists[0]?.id ?? ''
  const [preview, setPreview] = useState<{
    version: number
    planVersion: number
    rows: { product_id: string; quantity: string; unit: Unit }[]
    changes: ReturnType<typeof previewDiff>
    listId: string
    planId: string
  } | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const buildPreview = useCallback(() => {
    const list = data.shopping_lists.find((l) => l.id === listId)
    if (!list || !plan) return
    const amounts = new Map<string, { product_id: string; quantity: string; unit: Unit }>()
    for (const entry of entries) {
      const parts = mealShoppingRows(data, entry, household!.default_diners)
      for (const p of parts) {
        const product = data.generic_products.find((g) => g.id === p.generic_product_id)!
        if (!product)
          throw new Error('Quantità non valida: un alimento del piano non è più disponibile. Ricarica.')
        const unit = product.canonical_unit ?? p.unit
        let q: Decimal
        try {
          q = convert(p.quantity, p.unit, unit)
        } catch {
          throw new Error(
            `Quantità non valida: l’unità di ${product.name} non è compatibile con il catalogo.`,
          )
        }
        const key = product.id + unit
        const old = amounts.get(key)
        amounts.set(key, { product_id: product.id, unit, quantity: q.plus(old?.quantity ?? 0).toString() })
      }
    }
    const items = data.shopping_list_items.filter((i) => i.list_id === list.id)
    const current: Contribution[] = data.list_item_contributions
      .filter((c) => items.some((i) => i.id === c.item_id))
      .map((c) => ({
        id: c.id,
        itemId: c.item_id,
        origin: c.origin_type,
        originId: c.origin_id,
        quantity: c.requested_quantity,
      }))
    const rows = [...amounts.values()]
    const proposed: Contribution[] = rows.map((r) => ({
      id: 'preview',
      itemId:
        items.find((i) => i.generic_product_id === r.product_id && i.unit === r.unit)?.id ??
        `new:${r.product_id}`,
      origin: 'plan',
      originId: plan.id,
      quantity: r.quantity,
    }))
    const purchased = Object.fromEntries(items.map((i) => [i.id, itemQuantity(i).bought]))
    setPreview({
      version: list.version,
      planVersion: plan.version,
      rows,
      changes: previewDiff(current, proposed, plan.id, purchased),
      listId: list.id,
      planId: plan.id,
    })
  }, [data, entries, household, listId, plan, itemQuantity])
  useEffect(() => {
    if (!prepareRequested || busy) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      setPrepareRequested(false)
      void act(async () => {
        buildPreview()
        setSelectedMealId(null)
      }, 'Anteprima pronta. La lista non è stata modificata.')
    })
    return () => {
      active = false
    }
  }, [prepareRequested, busy, buildPreview, act])
  useEffect(() => {
    if (!preview) return
    previewRoot.current?.focus({ preventScroll: true })
    previewRoot.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [preview])
  return (
    <>
      <SectionTitle eyebrow="UN’IDEA PER OGNI GIORNO" title="La settimana a tavola." />
      <div className="week-toolbar">
        <button
          className="icon-button"
          aria-label="Settimana precedente"
          onClick={() => {
            setWeek(addDays(week, -7))
            setPreview(null)
          }}
        >
          <ArrowLeft />
        </button>
        <strong>
          {new Date(week + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} —{' '}
          {new Date(addDays(week, 6) + 'T12:00:00').toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <button
          className="icon-button"
          aria-label="Settimana successiva"
          onClick={() => {
            setWeek(addDays(week, 7))
            setPreview(null)
          }}
        >
          <ArrowRight />
        </button>
      </div>
      {plan && (
        <div className="inline wrap plan-actions">
          <ConfirmButton
            message={`Eliminare definitivamente il piano settimanale dal ${new Date(week + 'T12:00:00').toLocaleDateString('it-IT')} al ${new Date(addDays(week, 6) + 'T12:00:00').toLocaleDateString('it-IT')}? Verranno eliminati tutti i pasti del piano. La lista della spesa, le quantità già trasferite, gli acquisti, le ricette e i modelli resteranno invariati. Non è possibile annullare questa operazione.`}
            success="Piano settimanale eliminato."
            onConfirm={async () => {
              await remove('meal_plans', plan.id)
              setPreview(null)
            }}
          >
            Elimina piano settimanale
          </ConfirmButton>
        </div>
      )}
      {!plan ? (
        <Panel title="Una settimana da organizzare">
          <p>Crea il piano e aggiungi ricette e alimenti nei vari momenti della giornata.</p>
          <button
            className="button"
            onClick={() => void act(() => insert('meal_plans', household!.id, { week_start: week }))}
          >
            <CalendarDays size={18} /> Crea piano settimanale
          </button>
        </Panel>
      ) : (
        <>
          <div className="week-grid">
            {days.map((day) => (
              <section className="day-card" key={day}>
                <h2>
                  {new Date(day + 'T12:00:00').toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                  })}
                </h2>
                {mealSlots.map(({ value: slot, label }) => (
                  <div className="meal-slot" key={slot}>
                    <h3>{label}</h3>
                    {entries
                      .filter((e) => e.meal_date === day && e.meal_slot === slot)
                      .map((e) => (
                        <div className="meal-chip" key={e.id}>
                          <button
                            type="button"
                            className="text-button meal-title"
                            aria-label={`Apri pasto ${mealName(data, e)} · ${e.meal_date} · ${label}`}
                            onClick={() => {
                              setPreview(null)
                              setSelectedMealId(e.id)
                            }}
                          >
                            {mealName(data, e)}
                            {!e.free_text && (
                              <small>
                                {e.recipe_id
                                  ? `${e.servings_override ?? household!.default_diners} persone`
                                  : `${e.quantity} ${unitLabel(e.unit)}`}
                              </small>
                            )}
                          </button>
                          <ConfirmButton
                            message="Rimuovere questo pasto? La lista cambierà solo dopo anteprima e conferma."
                            onConfirm={() => remove('meal_entries', e.id)}
                          >
                            ×
                          </ConfirmButton>
                        </div>
                      ))}
                    {!entries.some((e) => e.meal_date === day && e.meal_slot === slot) && (
                      <span className="slot-empty">Da decidere</span>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
          {selectedMeal && (
            <MealShoppingEditor
              key={selectedMeal.id}
              meal={selectedMeal}
              onClose={() => setSelectedMealId(null)}
              onPrepared={() => {
                setPreview(null)
                setPrepareRequested(true)
              }}
            />
          )}
          <Panel title="Aggiungi al calendario">
            <Form
              className="grid-form"
              onSave={(f) => {
                const ref = freeMode ? '' : text(f, 'component')
                const isRecipe = data.recipes.some((r) => r.id === ref)
                const amount = freeMode || isRecipe ? null : quantity(text(f, 'quantity'))
                if (amount) {
                  const canonical = data.generic_products.find((p) => p.id === ref)?.canonical_unit
                  try {
                    if (!amount.gt(0)) throw new Error('Non positivo')
                    if (canonical) convert(amount.toString(), text(f, 'unit') as Unit, canonical)
                  } catch {
                    throw new Error(
                      'Quantità non valida: scegli una quantità positiva e un’unità compatibile con l’alimento.',
                    )
                  }
                }
                return insert('meal_entries', household!.id, {
                  meal_plan_id: plan.id,
                  meal_date: text(f, 'day'),
                  meal_slot: text(f, 'slot'),
                  recipe_id: !freeMode && isRecipe ? ref : null,
                  generic_product_id: freeMode || isRecipe ? null : ref,
                  free_text: freeMode ? text(f, 'free_text') : null,
                  shopping_choices: {},
                  servings_override: !freeMode && text(f, 'servings') ? Number(text(f, 'servings')) : null,
                  quantity: amount?.toString() ?? null,
                  unit: freeMode || isRecipe ? null : text(f, 'unit'),
                })
              }}
            >
              <Select label="Giorno" name="day">
                {days.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <Select label="Pasto" name="slot">
                {mealSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </Select>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={freeMode}
                  onChange={(event) => setFreeMode(event.target.checked)}
                />
                Testo libero
              </label>
              {freeMode ? (
                <label className="field">
                  Descrizione del pasto
                  <input name="free_text" required maxLength={200} placeholder="Es. Cena fuori" />
                </label>
              ) : (
                <>
                  <SearchSelect
                    label="Ricetta o alimento"
                    name="component"
                    onSelect={(id) =>
                      setMealUnit(data.generic_products.find((p) => p.id === id)?.canonical_unit ?? 'pz')
                    }
                    choices={[
                      ...data.recipes
                        .filter((r) => !r.archived_at)
                        .map((r) => ({ value: r.id, label: r.title, kind: 'Ricetta' })),
                      ...ingredientProducts(data).map((g) => ({
                        value: g.id,
                        label: g.name,
                        kind: 'Alimento',
                      })),
                    ]}
                  />
                  <Field
                    label={`Persone (default ${household!.default_diners})`}
                    name="servings"
                    type="number"
                    min={1}
                    max={100}
                    required={false}
                  />
                  <Field label="Quantità per alimento semplice" name="quantity" value="1" />
                  <UnitSelect key={mealUnit} value={mealUnit} />
                </>
              )}
              <Submit>Aggiungi pasto</Submit>
            </Form>
          </Panel>
          <Panel title="Ingredienti nella lista">
            <p className="muted">
              Apri un pasto nel calendario per spuntare gli alimenti da comprare e scegliere le alternative.
            </p>
            <p className="muted">L’anteprima aggiorna gli ingredienti nella tua unica lista della spesa.</p>
            <button
              className="button"
              disabled={!listId || !!selectedMeal}
              onClick={() =>
                void act(async () => {
                  buildPreview()
                }, 'Anteprima pronta. La lista non è stata modificata.')
              }
            >
              Calcola anteprima delle differenze
            </button>
            <p className="muted">
              Solo i contributi di questa settimana verranno aggiornati. Quelli manuali e gli acquisti sono
              protetti. La versione viene ricontrollata alla conferma.
            </p>
            {preview && (
              <div className="diff" ref={previewRoot} tabIndex={-1}>
                <h3>Anteprima · versione lista {preview.version}</h3>
                {data.shopping_list_items
                  .filter(
                    (i) =>
                      i.list_id === preview.listId &&
                      i.archived_at &&
                      preview.rows.some((r) => r.product_id === i.generic_product_id && r.unit === i.unit),
                  )
                  .map((i) => (
                    <p key={i.id}>Verrà rimesso nella lista l’articolo rimosso: {i.name}.</p>
                  ))}
                {preview.changes.length ? (
                  preview.changes.map((c) => (
                    <p key={c.itemId}>
                      {data.shopping_list_items.find((i) => i.id === c.itemId)?.name ??
                        data.generic_products.find((g) => c.itemId === `new:${g.id}`)?.name}
                      : {c.before} → {c.after} ({new Decimal(c.delta).gt(0) ? '+' : ''}
                      {c.delta}) {c.conflict && '⚠ Quantità già acquistata superiore alla proposta'}
                    </p>
                  ))
                ) : (
                  <p>Nessuna differenza nelle quantità.</p>
                )}
                <div className="inline">
                  <button
                    className="button"
                    disabled={preview.changes.some((c) => c.conflict)}
                    onClick={() =>
                      void act(async () => {
                        await rpc('apply_plan_diff', {
                          p_list: preview.listId,
                          p_plan: preview.planId,
                          p_version: preview.version,
                          p_rows: preview.rows,
                          p_plan_version: preview.planVersion,
                        })
                        setPreview(null)
                      })
                    }
                  >
                    Conferma modifiche alla lista
                  </button>
                  <button className="text-button" onClick={() => setPreview(null)}>
                    Rifiuta anteprima
                  </button>
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Riutilizza il menu">
            <div className="inline">
              <button
                className="button secondary"
                onClick={() => {
                  const name = prompt('Nome del modello')
                  if (name?.trim())
                    void act(() =>
                      insert('meal_templates', household!.id, {
                        name: name.trim(),
                        entries_json: entries.map(({ id: _id, meal_plan_id: _plan, ...rest }) => ({
                          ...rest,
                          day_offset: days.indexOf(rest.meal_date),
                        })),
                      }),
                    )
                }}
              >
                Salva come modello
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  void act(() => rpc('duplicate_week', { p_plan: plan.id, p_week: addDays(week, 7) }))
                }
              >
                Duplica nella prossima settimana
              </button>
            </div>
            {data.meal_templates.map((t) => (
              <div className="data-row" key={t.id}>
                <strong>{t.name}</strong>
                <ConfirmButton
                  message="Aggiungere questo modello alla settimana? Gli ingredienti richiederanno una nuova anteprima prima di aggiornare la lista."
                  onConfirm={() => rpc('apply_template', { p_template: t.id, p_plan: plan.id })}
                >
                  Applica modello
                </ConfirmButton>
                <ConfirmButton
                  message="Eliminare il modello?"
                  onConfirm={() => remove('meal_templates', t.id)}
                >
                  Elimina
                </ConfirmButton>
              </div>
            ))}
          </Panel>
        </>
      )}
    </>
  )
}
