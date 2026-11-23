import type { Data, Meal } from './types'
import { scale } from '../domain/math'

export const mealSlots = [
  { value: 'colazione', label: 'Colazione' },
  { value: 'pranzo', label: 'Pranzo' },
  { value: 'cena', label: 'Cena' },
]
export function mealName(data: Data, meal: Meal) {
  return (
    meal.free_text ||
    data.recipes.find((r) => r.id === meal.recipe_id)?.title ||
    data.generic_products.find((g) => g.id === meal.generic_product_id)?.name ||
    'Pasto'
  )
}
export function mealOptions(data: Data, meal: Meal, diners: number) {
  const recipe = data.recipes.find((r) => r.id === meal.recipe_id)
  if (recipe)
    return data.recipe_ingredients
      .filter((i) => i.recipe_id === recipe.id)
      .map((i) => ({
        key: i.id,
        productId: i.generic_product_id,
        unit: i.unit,
        quantity: scale(
          i.quantity,
          recipe.base_servings,
          meal.servings_override ?? diners,
          i.unit === 'pz' || i.unit === 'conf',
        ),
        alternatives: data.recipe_ingredient_alternatives
          .filter((a) => a.ingredient_id === i.id)
          .map((a) => a.generic_product_id),
      }))
  return meal.generic_product_id
    ? [
        {
          key: 'food',
          productId: meal.generic_product_id,
          quantity: meal.quantity!,
          unit: meal.unit!,
          alternatives: [] as string[],
        },
      ]
    : []
}
export function mealChoices(data: Data, meal: Meal, diners: number) {
  return Object.fromEntries(
    mealOptions(data, meal, diners).flatMap((option) => {
      const selected = meal.shopping_choices == null ? option.productId : meal.shopping_choices[option.key]
      return selected && [option.productId, ...option.alternatives].includes(selected)
        ? [[option.key, selected]]
        : []
    }),
  )
}
export function mealShoppingRows(data: Data, meal: Meal, diners: number) {
  const choices = mealChoices(data, meal, diners)
  return mealOptions(data, meal, diners)
    .filter((option) => choices[option.key])
    .map((option) => ({
      generic_product_id: choices[option.key],
      quantity: option.quantity,
      unit: option.unit,
    }))
}
