import { expect, it } from 'vitest'
import { catalogPriceLabel, unitPriceLabel, validatePriceBasis } from '../src/domain/catalogPrices'
import { compareCurrentPrices } from '../src/domain/currentPrices'
import { bulkPriceUnit, productFormat } from '../src/data/catalog'
import { emptyData } from '../src/data/types'
import { unitLabel } from '../src/domain/math'
const product = {
  id: 'p',
  name: 'Affettato',
  generic_product_id: 'g',
  brand: '',
  variant: '',
  barcode: null,
  package_quantity: null,
  package_unit: null,
}
const request = {
  id: 'i',
  generic_product_id: 'g',
  specific_product_id: null,
  quantity: '150',
  unit: 'g' as const,
}
it('prezzo al pezzo e litro minuscolo, anche con formati legacy', () => {
  expect(unitPriceLabel('3', { package_quantity: '6', package_unit: 'pz' })).toMatch(/0,50.*€\/pz/)
  expect(unitPriceLabel('0', { package_quantity: '1', package_unit: 'pz' })).toMatch(/0,00.*€\/pz/)
  expect(unitPriceLabel('3', product)).toBe('-')
  expect(productFormat({ package_quantity: '1', package_unit: 'L' })).toBe('1 l')
  expect(unitLabel('L')).toBe('l')
})
it('prezzo diretto replicato e compatibilità del formato', () => {
  expect(catalogPriceLabel('20', 'kg')).toBe(unitPriceLabel('20', product, 'kg'))
  expect(catalogPriceLabel('4', 'l')).toBe(unitPriceLabel('4', product, 'l'))
  expect(() => validatePriceBasis('pz', 'kg')).toThrow()
  expect(() => validatePriceBasis('g', 'l')).toThrow()
  expect(() => validatePriceBasis(null, 'kg')).not.toThrow()
})
it('sfusi: quantità esatta, confezione nota, mancante o incompatibile', () => {
  const prices = [{ specific_product_id: 'p', store_id: 's', price_amount: '20', price_basis: 'kg' as const }]
  const estimate = (item = request, p = product) => compareCurrentPrices('s', [item], [p], prices)
  expect(estimate().total).toBe('3.00')
  expect(estimate({ ...request, quantity: '1', unit: 'conf' as 'g' }).complete).toBe(false)
  expect(estimate({ ...request, unit: 'ml' as 'g' }).complete).toBe(false)
  expect(
    compareCurrentPrices(
      's',
      [{ ...request, unit: 'conf', quantity: '2' }],
      [{ ...product, package_quantity: '150', package_unit: 'g' }],
      prices,
    ).total,
  ).toBe('6.00')
  expect(
    compareCurrentPrices(
      's',
      [{ ...request, unit: 'ml', quantity: '250' }],
      [product],
      [{ ...prices[0], price_amount: '4', price_basis: 'l' }],
    ).total,
  ).toBe('1.00')
  expect(
    compareCurrentPrices(
      's',
      [request],
      [{ ...product, package_quantity: '100', package_unit: 'g' }],
      [{ ...prices[0], price_amount: '2', price_basis: 'package' }],
    ).total,
  ).toBe('4.00')
})
it('deduce unità sfuse solo da prezzi coerenti dei supermercati attivi', () => {
  const data = {
    ...emptyData,
    stores: [{ id: 's', name: 'Negozio', archived_at: null }],
    product_prices: [
      { specific_product_id: 'p', store_id: 's', price_amount: '20', price_basis: 'kg' as const },
    ],
  } as typeof emptyData
  expect(bulkPriceUnit(data, ['p'])).toBe('kg')
  expect(
    bulkPriceUnit(
      {
        ...data,
        product_prices: [
          ...data.product_prices,
          { specific_product_id: 'p', store_id: 's', price_amount: '2', price_basis: 'package' },
        ],
      },
      ['p'],
    ),
  ).toBeNull()
  expect(bulkPriceUnit({ ...data, stores: [] }, ['p'])).toBeNull()
})
