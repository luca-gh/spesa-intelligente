import { expect, it } from 'vitest'
import { emptyData } from '../src/data/types'
import { pricesForStore, shoppingBrandPrices, shoppingPrices } from '../src/data/shoppingPrices'
function fixture() {
  const data = structuredClone(emptyData)
  data.stores = [{ id: 's', name: 'Negozio', chain: '', address: '', city: '', archived_at: null }]
  data.specific_products = ['A', 'B'].map((brand, i) => ({
    id: 'p' + i,
    name: 'Latte',
    brand,
    variant: '',
    barcode: null,
    generic_product_id: 'g',
    package_quantity: '500',
    package_unit: 'ml' as const,
  }))
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
  data.product_prices = [
    { specific_product_id: 'p0', store_id: 's', price_amount: '3', discounted_price_amount: '2.50' },
    { specific_product_id: 'p1', store_id: 's', price_amount: '4', discounted_price_amount: '2' },
  ]
  return data
}
it('confronta i due scenari con alternative meno care indipendenti e dettagli per marca', () => {
  const data = fixture()
  expect(shoppingPrices(data, 'l', () => '2')[0]).toMatchObject({
    total: '6.00',
    complete: true,
    lines: [{ productId: 'p0', amount: '6.00' }],
  })
  expect(shoppingPrices(data, 'l', () => '2', true)[0]).toMatchObject({
    total: '4.00',
    complete: true,
    lines: [{ productId: 'p1', amount: '4.00' }],
  })
  expect(
    shoppingBrandPrices(data, data.shopping_list_items[0], '2', true).map((b) => b.stores[0].line.amount),
  ).toEqual(['5.00', '4.00'])
  expect(data.product_prices[0].price_amount).toBe('3')
})
it('prezzi mancanti a trattino: nessun ripiego automatico e copertura separata', () => {
  const data = fixture()
  data.product_prices[0].discounted_price_amount = null
  data.product_prices[1].discounted_price_amount = null
  expect(shoppingPrices(data, 'l', () => '1', true)[0]).toMatchObject({
    known: 0,
    complete: false,
    lines: [{ amount: null }],
  })
  data.product_prices[0].price_amount = null
  data.product_prices[0].discounted_price_amount = '0'
  data.shopping_list_items[0].preferred_brand = 'A'
  expect(shoppingPrices(data, 'l', () => '1')[0].known).toBe(0)
  expect(shoppingPrices(data, 'l', () => '1', true)[0]).toMatchObject({
    total: '0.00',
    known: 1,
    complete: true,
  })
})
it('PAM applicato una sola volta a ciascuno scenario, senza mutare gli importi salvati', () => {
  const data = fixture()
  data.stores[0].name = 'PAM'
  data.stores[0].pam_discount_enabled = true
  expect(shoppingPrices(data, 'l', () => '2')[0].total).toBe('5.40')
  expect(shoppingPrices(data, 'l', () => '2', true)[0].total).toBe('3.60')
  expect(data.product_prices[1].discounted_price_amount).toBe('2')
})
it('due importi al kg usano la stessa quantità esatta e rispettano il supermercato', () => {
  const data = fixture()
  data.specific_products[0].package_unit = 'g' as 'ml'
  data.product_prices = [
    {
      specific_product_id: 'p0',
      store_id: 's',
      price_amount: '20',
      discounted_price_amount: '15',
      price_basis: 'kg',
    },
  ]
  data.shopping_list_items[0].unit = 'g'
  expect(shoppingPrices(data, 'l', () => '150')[0].total).toBe('3.00')
  expect(shoppingPrices(data, 'l', () => '150', true)[0].total).toBe('2.25')
  expect(pricesForStore(data, data.stores[0], true)[0].price_basis).toBe('kg')
  data.product_prices[0].store_id = 'other'
  expect(shoppingPrices(data, 'l', () => '150', true)[0].known).toBe(0)
})
