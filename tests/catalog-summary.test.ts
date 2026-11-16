import { expect, it } from 'vitest'
import { catalogTotals, catalogFormatFields } from '../src/data/catalog'
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

it('mostra kg e L in g e ml senza perdere quantità o alterare bozze nelle altre unità', () => {
  expect(catalogFormatFields('1,25', 'kg')).toEqual({ size: '1250', unit: 'g' })
  expect(catalogFormatFields('0.75', 'L')).toEqual({ size: '750', unit: 'ml' })
  expect(catalogFormatFields('1.234', 'kg')).toEqual({ size: '1234', unit: 'g' })
  expect(catalogFormatFields(null, null)).toEqual({ size: '', unit: '' })
  expect(catalogFormatFields('bozza', 'g')).toEqual({ size: 'bozza', unit: 'g' })
})

it('conta prodotti attivi senza duplicare i gruppi e tutte le categorie, anche vuote', () => {
  expect(catalogTotals(data)).toEqual({ products: 5, categories: 3 })
})

it('gestisce catalogo vuoto e prodotti senza categoria anche se Altri prodotti è stata eliminata', () => {
  expect(catalogTotals(emptyData)).toEqual({ products: 0, categories: 0 })
  const result = catalogTotals({
    ...data,
    categories: data.categories.filter((c) => c.id !== 'other'),
  })
  expect(result).toEqual({ products: 5, categories: 2 })
})
