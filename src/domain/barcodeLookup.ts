import Decimal from 'decimal.js'
import type { Unit } from './math'

export const barcodeSources = {
  food: { name: 'Open Food Facts', origin: 'https://world.openfoodfacts.org' },
  beauty: { name: 'Open Beauty Facts', origin: 'https://world.openbeautyfacts.org' },
  product: { name: 'Open Products Facts', origin: 'https://world.openproductsfacts.org' },
} as const
export type BarcodeSource = keyof typeof barcodeSources
export function barcodeSourceName(product: Pick<BarcodeProduct, 'source'>) {
  return barcodeSources[product.source ?? 'food']?.name ?? 'Banca dati prodotti'
}

export interface BarcodeProduct {
  barcode: string
  name: string
  brand: string
  size: string
  unit: Unit | ''
  categories: string[]
  sourceUrl: string
  source?: BarcodeSource
}
const clean = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
    : ''

function format(amount: unknown, rawUnit: unknown): { size: string; unit: Unit | '' } {
  const raw = typeof amount === 'number' && Number.isFinite(amount) ? String(amount) : clean(amount)
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return { size: '', unit: '' }
  const conversions: Record<string, [Unit, string]> = {
    g: ['g', '1'],
    kg: ['kg', '1'],
    mg: ['g', '0.001'],
    ml: ['ml', '1'],
    cl: ['ml', '10'],
    dl: ['ml', '100'],
    l: ['L', '1'],
    pz: ['pz', '1'],
    pezzi: ['pz', '1'],
    pezzo: ['pz', '1'],
    pieces: ['pz', '1'],
    piece: ['pz', '1'],
    pcs: ['pz', '1'],
    pc: ['pz', '1'],
    conf: ['conf', '1'],
  }
  const conversion = conversions[clean(rawUnit).toLowerCase()]
  if (!conversion) return { size: '', unit: '' }
  const quantity = new Decimal(raw.replace(',', '.')).mul(conversion[1])
  if (!quantity.gt(0) || quantity.gt('99999999999.999') || quantity.decimalPlaces() > 3)
    return { size: '', unit: '' }
  return { size: quantity.toString(), unit: conversion[0] }
}

export function parseBarcodeProduct(
  barcode: string,
  value: unknown,
  source: BarcodeSource = 'food',
): BarcodeProduct | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (body.status === 0 || body.status === 'failure' || body.status === 'not_found') return null
  const product = body.product
  if (!product || typeof product !== 'object') return null
  const p = product as Record<string, unknown>
  if (p.product_type === 'petfood') return null
  const returnedCode = clean(p.code ?? body.code)
  if (returnedCode && returnedCode.replace(/^0+/, '') !== barcode.replace(/^0+/, ''))
    throw new Error('Codice restituito non corrispondente')
  let pack = format(p.product_quantity, p.product_quantity_unit)
  if (!pack.size) {
    const match = clean(p.quantity).match(
      /^(\d+(?:[.,]\d+)?)\s*(kg|mg|g|ml|cl|dl|l|pz|pezzi|pezzo|pieces|piece|pcs|pc|conf)$/i,
    )
    if (match) pack = format(match[1], match[2])
  }
  const tags = Array.isArray(p.categories_tags) ? p.categories_tags : []
  return {
    barcode,
    name:
      clean(p.generic_name_it) || clean(p.product_name_it) || clean(p.generic_name) || clean(p.product_name),
    brand: clean(p.brands),
    ...pack,
    categories: [...tags, ...clean(p.categories).split(',')].map(clean).filter(Boolean).slice(0, 80),
    source,
    sourceUrl: `${barcodeSources[source].origin}/product/${barcode}`,
  }
}

const normalized = (value: string) =>
  value
    .replace(/^[a-z]{2}:/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const categoryGroups = [
  {
    tags: [
      'dairies',
      'milks',
      'semi skimmed milks',
      'skimmed milks',
      'whole milks',
      'yogurts',
      'cheeses',
      'latticini',
      'latte',
      'formaggi',
    ],
    names: ['latticini', 'latte e latticini', 'latte e derivati', 'latticini e uova'],
  },
  {
    tags: ['pastas', 'pasta', 'rices', 'rice', 'cereals', 'cereali'],
    names: ['pasta e riso', 'pasta riso e cereali', 'cereali'],
  },
  { tags: ['fruits', 'fresh fruits', 'frutta'], names: ['frutta', 'frutta e verdura', 'ortofrutta'] },
  {
    tags: ['vegetables', 'fresh vegetables', 'verdure', 'verdura'],
    names: ['verdura', 'verdure', 'frutta e verdura', 'ortofrutta'],
  },
  { tags: ['meats', 'carne'], names: ['carne', 'carne e pesce'] },
  { tags: ['fishes', 'seafood', 'pesce'], names: ['pesce', 'carne e pesce'] },
  { tags: ['beverages', 'waters', 'fruit juices', 'bevande'], names: ['bevande'] },
  { tags: ['breads', 'pane'], names: ['pane', 'pane e prodotti da forno', 'panetteria'] },
  {
    tags: [
      'personal care',
      'hair care',
      'shampoo',
      'shampoos',
      'shampoo conditioner',
      'soaps',
      'hand soaps',
      'shower gels',
      'deodorants',
      'toothpastes',
    ],
    names: ['igiene personale', 'cura della persona', 'cura persona', 'igiene e bellezza', 'igiene'],
  },
  { tags: ['cosmetics', 'makeup', 'make up'], names: ['cosmetici', 'cosmesi', 'bellezza'] },
  {
    tags: [
      'cleaning products',
      'household cleaners',
      'detergents',
      'laundry detergents',
      'dishwashing liquids',
    ],
    names: ['cura della casa', 'pulizia casa', 'pulizia della casa', 'detersivi', 'prodotti per la casa'],
  },
  {
    tags: ['toilet papers', 'paper towels', 'tissues'],
    names: ['carta e monouso', 'carta', 'prodotti per la casa'],
  },
]
export function barcodeCategory(categories: { id: string; name: string }[], terms: string[]) {
  const tags = new Set(terms.map(normalized))
  const names = new Set([...tags])
  for (const group of categoryGroups)
    if (group.tags.some((tag) => tags.has(tag))) for (const name of group.names) names.add(name)
  const matches = categories.filter((category) => names.has(normalized(category.name)))
  return matches.length === 1 ? matches[0].id : ''
}
