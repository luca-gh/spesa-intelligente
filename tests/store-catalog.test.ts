import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { unitPrice, latestProductPrice } from '../src/domain/catalogPrices'
import { emptyData } from '../src/data/types'
import { listProductGroups } from '../src/data/catalog'
import { estimate, type Observation } from '../src/domain/prices'
import { compareCurrentPrices } from '../src/domain/currentPrices'

const db = new PGlite()
beforeAll(async () => {
  await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on functions to anon,authenticated;
    create publication supabase_realtime;`)
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
}, 60000)
afterAll(() => db.close())
it('pasti: testo libero, scelte per pasto, duplicazione, modelli e isolamento', async () => {
  const result = await db.exec(readFileSync('supabase/tests/meal_shopping.sql', 'utf8'))
  expect(result.at(-1)?.rows[0]).toMatchObject({ status: 'PASS' })
  expect((await db.query('select id from households')).rows).toHaveLength(0)
}, 60000)
it('alternative ricette e opzione PAM: salvataggio, duplicazione, scelta, RLS e cascata', async () => {
  const result = await db.exec(readFileSync('supabase/tests/recipe_alternatives.sql', 'utf8'))
  expect(result.at(-1)?.rows[0]).toMatchObject({ status: 'PASS' })
  expect((await db.query('select id from households')).rows).toHaveLength(0)
}, 60000)
it('prezzi attuali: sostituzione senza storico, rimozione senza ripristino, RLS e cascata', async () => {
  const result = await db.exec(readFileSync('supabase/tests/current_prices.sql', 'utf8'))
  expect(result.at(-1)?.rows[0]).toMatchObject({ status: 'PASS' })
  expect((await db.query('select id from households')).rows).toHaveLength(0)
}, 60000)
it('confronta solo gli importi attuali, senza date, classificazioni o sconti', () => {
  const request = {
    id: 'item',
    generic_product_id: 'g',
    specific_product_id: null,
    quantity: '2',
    unit: 'conf' as const,
  }
  const prices = [
    { specific_product_id: 'p0', store_id: 's', price_amount: '2.50' },
    { specific_product_id: 'p1', store_id: 's', price_amount: '1.20' },
  ]
  expect(compareCurrentPrices('s', [request], products, prices).total).toBe('2.40')
  expect(compareCurrentPrices('s', [{ ...request, preferred_brand: 'A' }], products, prices).total).toBe(
    '5.00',
  )
  expect(
    compareCurrentPrices(
      's',
      [{ ...request, preferred_package_quantity: '1', preferred_package_unit: 'L' }],
      products,
      prices,
    ).complete,
  ).toBe(false)
  expect(compareCurrentPrices('missing', [request], products, prices).lines[0].amount).toBeNull()
})
it('ordini, preferenze e correzioni prezzi rispettano isolamento e atomicità PostgreSQL', async () => {
  const result = await db.exec(readFileSync('supabase/tests/store_catalog.sql', 'utf8'))
  expect(result.at(-1)?.rows[0]).toMatchObject({ status: 'PASS' })
  expect((await db.query('select id from households')).rows).toHaveLength(0)
  expect((await db.query('select id from auth.users')).rows).toHaveLength(0)
}, 60000)

it('prezzi unitari esatti per grammi, kg, ml, litri e formati non confrontabili', () => {
  expect(unitPrice('2.50', { package_quantity: '500', package_unit: 'g' })).toEqual({
    amount: '5.00',
    unit: 'kg',
  })
  expect(unitPrice('1.20', { package_quantity: '750', package_unit: 'ml' })).toEqual({
    amount: '1.60',
    unit: 'L',
  })
  expect(unitPrice('5', { package_quantity: '1.25', package_unit: 'kg' })).toEqual({
    amount: '4.00',
    unit: 'kg',
  })
  expect(unitPrice('0', { package_quantity: '1', package_unit: 'L' })).toEqual({ amount: '0.00', unit: 'L' })
  expect(unitPrice('2', { package_quantity: null, package_unit: null })).toBeNull()
  expect(unitPrice('2', { package_quantity: '4', package_unit: 'pz' })).toBeNull()
})
const products = ['A', 'B', 'A'].map((brand, index) => ({
  id: `p${index}`,
  name: 'Latte',
  generic_product_id: 'g',
  brand,
  variant: '',
  barcode: null,
  package_quantity: index === 2 ? '1000' : '500',
  package_unit: 'ml' as const,
}))
const observations: Observation[] = products.map((p, i) => ({
  id: `o${i}`,
  specific_product_id: p.id,
  store_id: 's',
  price_amount: `${i + 1}`,
  kind: 'regular',
  observed_at: '2026-11-20T12:00:00Z',
  promotion_starts_at: null,
  promotion_ends_at: null,
  voided_at: null,
}))
it('nomi unici senza marca e formato, esclusione archiviati e ultimo prezzo specifico del negozio', () => {
  const groups = listProductGroups({ ...emptyData, specific_products: products })
  expect(groups).toHaveLength(1)
  expect(groups[0].name).toBe('Latte')
  expect(groups[0].products).toHaveLength(3)
  const distinctNames = listProductGroups({
    ...emptyData,
    specific_products: [products[0], { ...products[1], name: 'latte', generic_product_id: 'other-group' }],
  })
  expect(distinctNames).toHaveLength(2)
  expect(distinctNames.map((g) => g.genericId)).toEqual(['g', 'other-group'])
  expect(
    latestProductPrice(
      [...observations, { ...observations[0], id: 'new', price_amount: '9', voided_at: '2026-11-22' }],
      'p0',
      's',
    )?.price_amount,
  ).toBe('1')
  expect(latestProductPrice(observations, 'p0', 'other')).toBeUndefined()
  expect(
    latestProductPrice(
      [
        { ...observations[0], id: 'z-old', created_at: '2026-11-20T12:00:01Z' },
        { ...observations[0], id: 'a-new', price_amount: '2', created_at: '2026-11-20T12:00:02Z' },
      ],
      'p0',
      's',
    )?.price_amount,
  ).toBe('2')
  expect(
    listProductGroups({
      ...emptyData,
      specific_products: products.map((p) => ({ ...p, archived_at: '2026-11-20' })),
    }),
  ).toHaveLength(0)
})
it('confronto rispetta marca e formato indipendenti, anche unità equivalenti e confezioni senza formato', () => {
  const request = {
    id: 'i',
    generic_product_id: 'g',
    specific_product_id: null,
    quantity: '1',
    unit: 'conf' as const,
  }
  const run = (preferences: object) =>
    estimate('s', [{ ...request, ...preferences }], products, observations, [], '2026-11-23').lines[0]
  expect(run({}).productId).toBe('p0')
  expect(run({ preferred_brand: 'B' }).productId).toBe('p1')
  expect(run({ preferred_package_quantity: '1', preferred_package_unit: 'L' }).productId).toBe('p2')
  expect(
    run({ preferred_brand: 'B', preferred_package_quantity: '1', preferred_package_unit: 'L' }).net,
  ).toBeNull()
  expect(
    estimate(
      's',
      [request],
      [{ ...products[0], package_quantity: null, package_unit: null }],
      observations,
      [],
      '2026-11-23',
    ).total,
  ).toBe('1.00')
})
