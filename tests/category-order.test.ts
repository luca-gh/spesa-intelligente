import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-4000-8000-000000000081'
const bob = '00000000-0000-4000-8000-000000000082'
let home: string, other: string, fruit: string, dairy: string, fallback: string
let expected: Record<string, number>
const scalar = async (sql: string, params: unknown[] = []) =>
  Object.values((await db.query<Record<string, string>>(sql, params)).rows[0])[0]
const ranks = async () =>
  (
    await db.query('select id,name,sort_order from categories where household_id=$1 order by sort_order,id', [
      home,
    ])
  ).rows
beforeAll(async () => {
  await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
    create table auth.users(id uuid primary key);grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on functions to anon,authenticated;
    insert into auth.users values('${alice}'),('${bob}');create publication supabase_realtime;`)
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob])
  other = await scalar("select create_household('Altra famiglia')")
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice])
  await db.exec('set role authenticated')
  home = await scalar("select create_household('Categorie famiglia')")
  fruit = await scalar(
    "insert into categories(household_id,name,sort_order) values($1,'Frutta',20) returning id",
    [home],
  )
  dairy = await scalar(
    "insert into categories(household_id,name,sort_order) values($1,'Latticini',10) returning id",
    [home],
  )
  fallback = await scalar("select id from categories where household_id=$1 and name='Altri prodotti'", [home])
  expected = { [fruit]: 20, [dairy]: 10, [fallback]: 999 }
}, 60000)
afterAll(() => db.close())

it('salva l’intera sequenza in una transazione senza cambiare identità e nomi', async () => {
  await db.query('select reorder_categories($1,$2,$3)', [home, [fruit, dairy, fallback], expected])
  expect(await ranks()).toEqual([
    { id: fruit, name: 'Frutta', sort_order: 0 },
    { id: dairy, name: 'Latticini', sort_order: 1 },
    { id: fallback, name: 'Altri prodotti', sort_order: 2 },
  ])
})

it('rifiuta sequenze incomplete, duplicate, estranee e bozze obsolete senza aggiornamenti parziali', async () => {
  const before = await ranks()
  const current = { [fruit]: 0, [dairy]: 1, [fallback]: 2 }
  for (const ids of [
    [fruit, dairy],
    [fruit, fruit, fallback],
    [fruit, dairy, '00000000-0000-4000-8000-000000000099'],
    [fruit, dairy, null],
  ])
    await expect(db.query('select reorder_categories($1,$2,$3)', [home, ids, current])).rejects.toThrow(
      'Conflitto:',
    )
  await expect(
    db.query('select reorder_categories($1,$2,$3)', [home, [dairy, fruit, fallback], expected]),
  ).rejects.toThrow('Conflitto:')
  expect(await ranks()).toEqual(before)
})

it('rispetta RLS e privilegi: solo famiglia corrente, niente anon o SECURITY DEFINER', async () => {
  await expect(db.query('select reorder_categories($1,$2,$3)', [other, [], {}])).rejects.toThrow(
    'Accesso non consentito',
  )
  await db.exec('reset role;set role anon')
  await expect(db.query('select reorder_categories($1,$2,$3)', [home, [], {}])).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role')
  expect((await db.query("select prosecdef from pg_proc where proname='reorder_categories'")).rows).toEqual([
    { prosecdef: false },
  ])
  expect(
    (
      await db.query(
        "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='categories'",
      )
    ).rows,
  ).toEqual([{ tablename: 'categories' }])
})
