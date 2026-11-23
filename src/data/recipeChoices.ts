import type { Data, Ingredient } from './types'
export function chosenIngredient(data: Data, ingredient: Ingredient, choices: Record<string, string>) {
  return data.recipe_ingredient_alternatives.some(
    (a) => a.ingredient_id === ingredient.id && a.generic_product_id === choices[ingredient.id],
  )
    ? choices[ingredient.id]
    : ingredient.generic_product_id
}
