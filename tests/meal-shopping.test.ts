import { expect, it } from 'vitest'
import { emptyData, type Meal } from '../src/data/types'
import { mealChoices, mealName, mealShoppingRows, mealSlots } from '../src/data/mealShopping'
import { shoppingBrandPrices } from '../src/data/shoppingPrices'

const data = structuredClone(emptyData)
data.generic_products = [
  { id: 'p', name: 'Penne', canonical_unit: 'g', category_id: null },
  { id: 'f', name: 'Fusilli', canonical_unit: 'g', category_id: null },
]
data.recipes = [
  {
    id: 'r',
    title: 'Pasta',
    base_servings: 2,
    instructions: '',
    notes: '',
    is_favorite: false,
    source_url: null,
  },
]
data.recipe_ingredients = [{ id: 'i', recipe_id: 'r', generic_product_id: 'p', quantity: '200', unit: 'g' }]
data.recipe_ingredient_alternatives = [{ id: 'a', ingredient_id: 'i', generic_product_id: 'f' }]
const meal: Meal = {
  id: 'm',
  meal_plan_id: 'plan',
  meal_date: '2026-11-23',
  meal_slot: 'pranzo',
  recipe_id: 'r',
  generic_product_id: null,
  quantity: null,
  unit: null,
  servings_override: 4,
}

it('tre momenti della giornata con nomi maiuscoli e testo libero senza alimenti inventati', () => {
  expect(mealSlots.map((s) => s.label)).toEqual(['Colazione', 'Pranzo', 'Cena'])
  const free = { ...meal, recipe_id: null, free_text: 'Cena fuori', shopping_choices: {} }
  expect(mealName(data, free)).toBe('Cena fuori')
  expect(mealShoppingRows(data, free, 2)).toEqual([])
})
it('pasti precedenti compatibili, nuovi pasti vuoti e solo la selezione scalata', () => {
  expect(mealShoppingRows(data, meal, 2)).toEqual([{ generic_product_id: 'p', quantity: '400', unit: 'g' }])
  expect(mealShoppingRows(data, { ...meal, shopping_choices: {} }, 2)).toEqual([])
  expect(mealShoppingRows(data, { ...meal, shopping_choices: { i: 'f' } }, 2)).toEqual([
    { generic_product_id: 'f', quantity: '400', unit: 'g' },
  ])
  expect(mealChoices(data, { ...meal, shopping_choices: { i: 'foreign' } }, 2)).toEqual({})
})
it('scelte rimosse ignorate e alimento semplice selezionabile senza quantità arbitrarie', () => {
  const simple = {
    ...meal,
    recipe_id: null,
    generic_product_id: 'p',
    quantity: '250',
    unit: 'g' as const,
    shopping_choices: { food: 'p' },
  }
  expect(mealShoppingRows(data, simple, 2)).toEqual([{ generic_product_id: 'p', quantity: '250', unit: 'g' }])
  expect(mealShoppingRows(data, { ...simple, shopping_choices: {} }, 2)).toEqual([])
  expect(
    mealChoices(
      { ...data, recipe_ingredient_alternatives: [] },
      { ...meal, shopping_choices: { i: 'f' } },
      2,
    ),
  ).toEqual({})
})
it('prezzi per ogni marca e supermercato, formati compatibili, trattini e PAM rispettati', () => {
  const d = structuredClone(emptyData)
  d.stores = [
    { id: 's', name: 'PAM', chain: '', pam_discount_enabled: true, address: '', city: '', archived_at: null },
    { id: 'empty', name: 'Altro', chain: '', address: '', city: '', archived_at: null },
  ]
  d.specific_products = ['A', 'B', ''].map((brand, n) => ({
    id: `p${n}`,
    name: 'Latte',
    generic_product_id: 'g',
    brand,
    variant: '',
    barcode: null,
    package_quantity: '500',
    package_unit: 'ml' as const,
  }))
  d.product_prices = [
    { specific_product_id: 'p0', store_id: 's', price_amount: '2' },
    { specific_product_id: 'p1', store_id: 's', price_amount: '3' },
  ]
  const item = {
    id: 'i',
    list_id: 'l',
    name: 'Latte',
    generic_product_id: 'g',
    specific_product_id: null,
    note: '',
    created_at: '',
    unit: 'conf' as const,
  }
  const brands = shoppingBrandPrices(d, item, '2')
  expect(brands.map((b) => b.brand)).toEqual(['', 'A', 'B'])
  expect(brands.find((b) => b.brand === 'A')!.stores.find((s) => s.storeId === 's')!.line.amount).toBe('3.60')
  expect(brands.find((b) => b.brand === 'B')!.stores.find((s) => s.storeId === 's')!.line.amount).toBe('5.40')
  expect(brands[0].stores.every((s) => s.line.amount === null)).toBe(true)
  expect(shoppingBrandPrices(d, { ...item, preferred_brand: 'A' }, '2')).toEqual([])
  expect(shoppingBrandPrices(d, { ...item, specific_product_id: 'p0' }, '2')).toEqual([])
})
