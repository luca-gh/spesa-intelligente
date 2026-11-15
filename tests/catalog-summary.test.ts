import { expect, it } from 'vitest'
import { catalogCategoryCounts } from '../src/data/catalog'
import { emptyData, type Data } from '../src/data/types'

const data: Data = {
  ...emptyData,
  categories: [
    { id: 'fruit', name: 'Frutta', sort_order: 1 },
    { id: 'other', name: 'Altri prodotti', sort_order: 2 },
    { id: 'empty', name: 'Categoria vuota', sort_order: 0 },
  ],
  generic_products: [
    { id: 'group', name: 'Mele', canonical_unit: 'g', category_id: 'fruit', is_catalog_group: true },
    { id: 'plain', name: 'Pere', canonical_unit: 'g', category_id: 'fruit' },
    { id: 'unassigned', name: 'Altro', canonical_unit: null, category_id: null },
    { id: 'explicit-other', name: 'Altro ancora', canonical_unit: null, category_id: 'other' },
    {
      id: 'hidden',
      name: 'Archiviato',
      canonical_unit: 'g',
      category_id: 'fruit',
      archived_at: '2026-11-15',
    },
  ],
  specific_products: [
    {
      id: 'brand-a',
      generic_product_id: 'group',
      name: 'Mele',
      brand: 'A',
      variant: '',
      barcode: null,
      package_quantity: null,
      package_unit: null,
    },
    {
      id: 'brand-b',
      generic_product_id: 'group',
      name: 'Mele',
      brand: 'B',
      variant: '',
      barcode: null,
      package_quantity: null,
      package_unit: null,
    },
    {
      id: 'archived-brand',
      generic_product_id: 'group',
      name: 'Mele',
      brand: 'C',
      variant: '',
      barcode: null,
      package_quantity: null,
      package_unit: null,
      archived_at: '2026-11-15',
    },
  ],
}

it('conta le schede attive senza duplicare i gruppi, mantiene categorie vuote e ordine familiare', () => {
  expect(catalogCategoryCounts(data)).toEqual({
    total: 5,
    rows: [
      { id: 'empty', name: 'Categoria vuota', count: 0 },
      { id: 'fruit', name: 'Frutta', count: 3 },
      { id: 'other', name: 'Altri prodotti', count: 2 },
    ],
  })
})

it('gestisce catalogo vuoto e prodotti senza categoria anche se Altri prodotti è stata eliminata', () => {
  expect(catalogCategoryCounts(emptyData)).toEqual({ total: 0, rows: [] })
  const result = catalogCategoryCounts({
    ...data,
    categories: data.categories.filter((c) => c.id !== 'other'),
  })
  expect(result.rows.at(-1)).toEqual({ id: null, name: 'Altri prodotti', count: 2 })
  expect(result.total).toBe(5)
})
