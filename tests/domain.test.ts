import { describe, expect, it } from 'vitest'
import {
  convert,
  money,
  packages,
  remaining,
  scale,
  validBarcode,
  dateInZone,
  parsePrice,
  priceInputError,
  priceInputValue,
  quantity,
} from '../src/domain/math'
import {
  estimate,
  rank,
  resolvePrice,
  type Observation,
  type Product,
  type DiscountRule,
  type RequestItem,
} from '../src/domain/prices'
import { previewDiff, statistics } from '../src/domain/planning'

describe('prezzi con virgola', () => {
  it('accetta interi e decimali italiani senza cambiare il formato numerico interno', () => {
    for (const [input, expected] of [
      ['2,50', '2.50'],
      ['2,5', '2.50'],
      ['0', '0.00'],
      [' 1250,99 ', '1250.99'],
    ])
      expect(parsePrice(input)).toBe(expected)
    expect(quantity('1.25').toString()).toBe('1.25')
  })
  it('rifiuta punti, separatori delle migliaia e importi ambigui senza correggerli', () => {
    for (const input of ['2.50', '1.000,50', '2.', '.50']) {
      expect(priceInputError(input)).toContain('usa la virgola')
      expect(() => parsePrice(input)).toThrow('usa la virgola')
    }
    for (const input of ['', ' ', '-2,50', '2,501', '2,', '1e2', '€ 2,50'])
      expect(() => parsePrice(input)).toThrow('Prezzo non valido:')
    expect(priceInputError('')).toBe('')
  })
  it('mostra con la virgola i valori salvati lasciando vuoti quelli sconosciuti', () => {
    expect(priceInputValue('1250.5')).toBe('1250,50')
    expect(priceInputValue(0)).toBe('0,00')
    for (const value of [null, undefined, '']) expect(priceInputValue(value)).toBe('')
  })
})
const products: Product[] = [
  { id: 'a', generic_product_id: 'generic', name: 'Farina 500g', package_quantity: '500', package_unit: 'g' },
  { id: 'b', generic_product_id: 'generic', name: 'Farina 1kg', package_quantity: '1', package_unit: 'kg' },
]
const regular = (product: string, amount: string, store = 'store'): Observation => ({
  id: product + store,
  specific_product_id: product,
  store_id: store,
  price_amount: amount,
  kind: 'regular',
  observed_at: '2020-01-01T10:00:00Z',
  promotion_starts_at: null,
  promotion_ends_at: null,
  voided_at: null,
})
const item: RequestItem = {
  id: 'item',
  generic_product_id: 'generic',
  specific_product_id: null,
  quantity: '750',
  unit: 'g',
}
const rule: DiscountRule = {
  id: 'rule',
  store_id: 'store',
  name: 'Personale',
  percentage: '10',
  weekdays: [3],
  valid_from: '2026-01-01',
  valid_to: null,
  active: true,
  confirmed: true,
  exclude_promotional_items: true,
  priority: 1,
  minimum_total: '0',
  maximum_discount: null,
  excluded_product_ids: [],
}
const promo: Observation = {
  ...regular('a', '0.80'),
  id: 'promo',
  kind: 'promotion',
  observed_at: '2026-11-01T10:00:00Z',
  promotion_starts_at: '2026-11-01',
  promotion_ends_at: '2026-11-20',
}
describe('Quantità e denaro', () => {
  it('arrotonda decimalmente e accetta virgola', () => {
    expect(money('1.005')).toBe('1.01')
    expect(convert('0,75', 'kg', 'g').toString()).toBe('750')
  })
  it('750g richiedono due confezioni da 500g', () => expect(packages('750', 'g', '500', 'g')).toBe(2))
  it('non converte pezzi in grammi', () => expect(() => convert(1, 'pz', 'g')).toThrow())
  it('residui e surplus senza valori negativi', () => {
    expect(remaining(2, 0.5)).toEqual({ remaining: '1.5', surplus: '0' })
    expect(remaining(2, 3)).toEqual({ remaining: '0', surplus: '1' })
  })
  it('scala ricette e arrotonda i discreti per eccesso', () => {
    expect(scale('250', 2, 3)).toBe('375')
    expect(scale(1, 2, 3, true)).toBe('2')
  })
  it('valida checksum EAN8/13', () => {
    expect(validBarcode('8000500037560')).toBe(true)
    expect(validBarcode('12345678')).toBe(false)
    expect(validBarcode('96385074')).toBe(true)
  })
  it('presenta date nel fuso scelto', () =>
    expect(dateInZone(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18'))
})
it('un formato non indicato resta escluso dalle stime anche quando il prezzo è noto', () => {
  const result = estimate(
    'store',
    [item],
    [{ ...products[0], package_quantity: null, package_unit: null }],
    [regular('a', '1.20')],
    [],
    '2026-11-18',
  )
  expect(result.complete).toBe(false)
  expect(result.known).toBe(0)
  expect(result.lines[0].net).toBe(null)
})
describe('Prezzi, formati, copertura e regole ricorrenti', () => {
  it('sceglie confezioni compatibili meno costose per un generico', () => {
    const result = estimate(
      'store',
      [item],
      products,
      [regular('a', '1.20'), regular('b', '2.00')],
      [],
      '2026-11-18',
    )
    expect(result.total).toBe('2.00')
    expect(result.lines[0].productId).toBe('b')
  })
  it('rispetta un prodotto specifico', () => {
    const result = estimate(
      'store',
      [{ ...item, specific_product_id: 'a', generic_product_id: null }],
      products,
      [regular('a', '1.20'), regular('b', '2.00')],
      [],
      '2026-11-18',
    )
    expect(result.total).toBe('2.40')
  })
  it('usa ordinario vecchio senza soglia e ignora promo scaduta', () => {
    const price = resolvePrice(
      [regular('a', '1'), { ...promo, promotion_ends_at: '2026-11-10' }],
      'a',
      'store',
      '2026-11-18',
    )
    expect(price.selected?.kind).toBe('regular')
    expect(price.selected?.observed_at).toContain('2020')
  })
  it('offerta senza scadenza o senza ordinario lascia prezzo ignoto', () => {
    expect(
      resolvePrice([{ ...promo, promotion_ends_at: null }], 'a', 'store', '2026-11-18').selected,
    ).toBeUndefined()
    expect(
      resolvePrice([{ ...promo, promotion_ends_at: '2026-11-10' }], 'a', 'store', '2026-11-18').selected,
    ).toBeUndefined()
  })
  it.each([
    ['2026-11-17', '2.02'],
    ['2026-11-18', '1.82'],
    ['2026-11-19', '2.02'],
  ])('%s applica solo nel giorno previsto', (date, total) => {
    expect(estimate('store', [item], [products[0]], [regular('a', '1.01')], [rule], date).total).toBe(total)
  })
  it('non cumula con promozione, riprende ordinario dopo scadenza', () => {
    expect(
      estimate('store', [item], [products[0]], [regular('a', '1.00'), promo], [rule], '2026-11-18').total,
    ).toBe('1.60')
    expect(
      estimate(
        'store',
        [item],
        [products[0]],
        [regular('a', '1.00'), { ...promo, promotion_ends_at: '2026-11-10' }],
        [rule],
        '2026-11-18',
      ).total,
    ).toBe('1.80')
  })
  it('non applica regole non confermate o di altro punto vendita', () => {
    expect(
      estimate(
        'store',
        [item],
        [products[0]],
        [regular('a', '1')],
        [{ ...rule, confirmed: false }],
        '2026-11-18',
      ).total,
    ).toBe('2.00')
    expect(
      estimate(
        'same-chain-other-store',
        [item],
        products,
        [regular('a', '1', 'same-chain-other-store')],
        [rule],
        '2026-11-18',
      ).total,
    ).toBe('2.00')
  })
  it('non usa un prezzo di classificazione ignota', () => {
    expect(
      estimate('store', [item], products, [{ ...regular('a', '1'), kind: 'unknown' }], [rule], '2026-11-18')
        .complete,
    ).toBe(false)
  })
  it('incertezza promozionale sospende lo sconto personale anche con ordinario storico', () => {
    expect(
      estimate(
        'store',
        [item],
        [products[0]],
        [regular('a', '1'), { ...promo, promotion_ends_at: null }],
        [rule],
        '2026-11-18',
      ).total,
    ).toBe('2.00')
  })
  it('separa incompleti e ordinamento completo anche con prezzi uguali', () => {
    const complete = estimate('store', [item], products, [regular('a', '2')], [], '2026-11-18')
    const partial = estimate('other', [item], products, [], [], '2026-11-18')
    expect(rank([partial, complete])[0].complete).toBe(true)
    expect(partial.total).toBe('0.00')
    expect(partial.known).toBe(0)
    expect(rank([complete, { ...complete, storeId: 'aaa' }])[0].storeId).toBe('aaa')
  })
  it('ricalcola ranking cambiando data senza alterare lo storico', () => {
    const prices = [regular('a', '1'), regular('a', '0.95', 'other')]
    const calc = (date: string) =>
      rank(['store', 'other'].map((id) => estimate(id, [item], products, prices, [rule], date)))
    expect(calc('2026-11-17')[0].storeId).toBe('other')
    expect(calc('2026-11-18')[0].storeId).toBe('store')
    expect(prices[0].price_amount).toBe('1')
  })
})
describe('Provenienza e statistiche', () => {
  it('preserva manuali e segnala acquisti incompatibili in anteprima', () => {
    expect(
      previewDiff(
        [
          { id: 'm', itemId: 'i', origin: 'manual', originId: 'm', quantity: '2' },
          { id: 'p', itemId: 'i', origin: 'plan', originId: 'plan', quantity: '3' },
        ],
        [],
        'plan',
        { i: '3' },
      ),
    ).toEqual([{ itemId: 'i', before: '5', after: '2', delta: '-3', conflict: true }])
  })
  it('somma solo pagati reali non annullati e segnala copertura', () => {
    const base = { quantity: '1', purchased_at: '2026-11-18T12:00:00Z', voided_at: null }
    expect(
      statistics(
        [
          { ...base, total_paid: '1.82' },
          { ...base, total_paid: null },
          { ...base, total_paid: '3', voided_at: '2026-11-19' },
        ],
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual({ total: '1.82', unpriced: 1, count: 2 })
  })
})
