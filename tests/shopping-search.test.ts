import { expect, it } from 'vitest'
import { emptyData } from '../src/data/types'
import { listProductChoices, listProductGroups } from '../src/data/catalog'
import { matchingChoices } from '../src/domain/choices'
import { shoppingPrices } from '../src/data/shoppingPrices'

const products = ['Nutella', 'Nutella', 'Altra marca'].map((brand, index) => ({
  id: `p${index}`,
  generic_product_id: 'g',
  name: 'Crema spalmabile',
  brand,
  variant: '',
  barcode: null,
  package_quantity: index === 1 ? '750' : '400',
  package_unit: 'g' as const,
}))
const data = { ...emptyData, specific_products: products }
const groups = listProductGroups(data)
it('cerca il nome generico senza imporre una marca e cerca la marca senza imporre un formato', () => {
  expect(matchingChoices(listProductChoices(groups, 'crema'), 'crema')).toMatchObject([
    { label: 'Crema spalmabile', groupId: groups[0].id },
  ])
  const choices = matchingChoices(listProductChoices(groups, 'NUTELLA'), 'NUTELLA')
  expect(choices).toHaveLength(1)
  expect(choices[0]).toMatchObject({ label: 'Crema spalmabile · Nutella', brand: 'Nutella' })
  expect(groups[0].products.filter((p) => p.brand === 'Nutella')).toHaveLength(2)
})
it('gestisce nomi e marche insieme, accenti, omonimi e selezione mantenuta senza confondere gli ID', () => {
  const all = listProductGroups({
    ...data,
    specific_products: [
      ...products,
      { ...products[0], id: 'biscuit', name: 'Biscotti', generic_product_id: 'b' },
      { ...products[0], id: 'coffee', name: 'Caffè', generic_product_id: 'c', brand: 'Caffè Test' },
    ],
  })
  const matches = matchingChoices(listProductChoices(all, 'nutella'), 'nutella')
  expect(matches.map((c) => c.label)).toEqual(['Biscotti · Nutella', 'Crema spalmabile · Nutella'])
  expect(new Set(matches.map((c) => c.value)).size).toBe(2)
  const selected = matchingChoices(listProductChoices(all, 'crema nut'), 'crema nut')[0]
  expect(selected.label).toBe('Crema spalmabile · Nutella')
  expect(listProductChoices(all, '', selected.value).find((c) => c.value === selected.value)?.brand).toBe(
    'Nutella',
  )
  expect(matchingChoices(listProductChoices(all, 'CAFFE TEST'), 'CAFFE TEST')[0].label).toBe(
    'Caffè · Caffè Test',
  )
})
it('non suggerisce marche di prodotti archiviati', () => {
  const active = listProductGroups({
    ...data,
    specific_products: products.map((p) => ({
      ...p,
      archived_at: p.brand === 'Nutella' ? '2026-11-23' : null,
    })),
  })
  expect(matchingChoices(listProductChoices(active, 'nutella'), 'nutella')).toEqual([])
})
it('condivide totali e prezzi articolo, rispetta la marca, esclude rimossi/completati e negozi archiviati', () => {
  const base = {
    generic_product_id: 'g',
    specific_product_id: null,
    name: 'Crema spalmabile',
    list_id: 'list',
    unit: 'conf' as const,
    note: '',
    created_at: '',
    preferred_brand: 'Nutella',
  }
  const estimates = shoppingPrices(
    {
      ...data,
      stores: ['a', 'b', 'hidden'].map((id) => ({
        id,
        name: id,
        chain: '',
        city: '',
        address: '',
        archived_at: id === 'hidden' ? '2026-11-23' : null,
      })),
      shopping_list_items: [
        { ...base, id: 'active' },
        { ...base, id: 'removed', archived_at: '2026-11-23' },
        { ...base, id: 'done' },
      ],
      product_prices: [
        { specific_product_id: 'p0', store_id: 'a', price_amount: '4.00' },
        { specific_product_id: 'p2', store_id: 'a', price_amount: '1.00' },
        { specific_product_id: 'p2', store_id: 'b', price_amount: '0.50' },
      ],
    },
    'list',
    (item) => (item.id === 'done' ? '0' : '2'),
  )
  expect(estimates.map((e) => e.storeId)).toEqual(['a', 'b'])
  expect(estimates[0]).toMatchObject({ total: '8.00', complete: true, totalItems: 1 })
  expect(estimates[0].lines[0]).toMatchObject({ itemId: 'active', productId: 'p0', amount: '8.00' })
  expect(estimates[1].lines[0].amount).toBeNull()
})
