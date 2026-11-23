import { expect, it } from 'vitest'
import { isPam, storePrice } from '../src/domain/storePrices'
import { shoppingPrices } from '../src/data/shoppingPrices'
import { emptyData } from '../src/data/types'
import { chosenIngredient } from '../src/data/recipeChoices'

it('sconto solo PAM, opzionale, prezzo originale immutato e arrotondamento per confezione', () => {
  const pam = { name: 'PAM Torino', chain: 'Pam', pam_discount_enabled: true }
  expect(isPam(pam)).toBe(true)
  expect(isPam({ name: 'Spampinato', chain: '' })).toBe(false)
  expect(storePrice('2.55', pam)).toBe('2.30')
  expect(storePrice('2.55', { ...pam, pam_discount_enabled: false })).toBe('2.55')
  expect(storePrice('2.55', { ...pam, name: 'Altro', chain: '' })).toBe('2.55')
  expect(storePrice('0', pam)).toBe('0.00')
})
it('sconto coerente fra articolo e totale, arrotondato dopo la quantità, senza creare prezzi mancanti', () => {
  const data = structuredClone(emptyData)
  data.stores = [
    {
      id: 'pam',
      name: 'PAM',
      chain: '',
      address: '',
      city: '',
      archived_at: null,
      pam_discount_enabled: true,
    },
  ]
  data.specific_products = [
    {
      id: 'p',
      name: 'Latte',
      brand: '',
      variant: '',
      barcode: null,
      generic_product_id: 'g',
      package_quantity: '1',
      package_unit: 'L',
    },
  ]
  data.product_prices = [{ specific_product_id: 'p', store_id: 'pam', price_amount: '2.55' }]
  data.shopping_list_items = [
    {
      id: 'i',
      list_id: 'l',
      name: 'Latte',
      generic_product_id: 'g',
      specific_product_id: null,
      unit: 'conf',
      note: '',
      created_at: '',
    },
  ]
  const result = shoppingPrices(data, 'l', () => '2')[0]
  expect(result.total).toBe('4.59')
  expect(result.lines[0].amount).toBe('4.59')
  expect(data.product_prices[0].price_amount).toBe('2.55')
  data.product_prices = []
  expect(shoppingPrices(data, 'l', () => '2')[0].lines[0].amount).toBeNull()
})
it('scelta alternativa valida e ripiego sul principale quando viene rimossa', () => {
  const data = structuredClone(emptyData)
  const ingredient = {
    id: 'i',
    recipe_id: 'r',
    generic_product_id: 'penne',
    quantity: '200',
    unit: 'g' as const,
  }
  data.recipe_ingredient_alternatives = [{ id: 'a', ingredient_id: 'i', generic_product_id: 'fusilli' }]
  expect(chosenIngredient(data, ingredient, { i: 'fusilli' })).toBe('fusilli')
  expect(chosenIngredient(data, ingredient, { i: 'other' })).toBe('penne')
  data.recipe_ingredient_alternatives = []
  expect(chosenIngredient(data, ingredient, { i: 'fusilli' })).toBe('penne')
})
