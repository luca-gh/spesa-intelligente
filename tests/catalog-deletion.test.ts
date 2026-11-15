import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'

const db = new PGlite()
beforeAll(async () => {
  await db.exec(`create schema auth; create role authenticated nologin; create role anon nologin;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on functions to anon,authenticated;
    create publication supabase_realtime;`)
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
}, 60000)
afterAll(() => db.close())
afterEach(() => db.exec('rollback; reset role'))

it('elimina tutti i collegamenti esatti, preserva altre marche e famiglie e annulla le fixture', async () => {
  const results = await db.exec(readFileSync('supabase/tests/catalog_deletion.sql', 'utf8'))
  expect(results.at(-1)?.rows).toEqual([
    {
      status: 'PASS',
      verification: 'Catalog deletion: links, history, shared brands, isolation and rollback verified',
    },
  ])
  expect((await db.query('select id from public.households')).rows).toHaveLength(0)
  expect((await db.query('select id from auth.users')).rows).toHaveLength(0)
}, 60000)

it('un errore durante la cancellazione annulla anche le rimozioni già eseguite', async () => {
  await db.exec(`insert into auth.users(id) values('00000000-0000-4000-8000-000000000091');
    select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',false);
    create function private.test_reject_product_delete() returns trigger language plpgsql as $$ begin raise exception 'Simulated failure'; end $$;
    create trigger test_reject_product_delete before delete on public.specific_products for each row execute function private.test_reject_product_delete();
    set role authenticated;`)
  const scalar = async (sql: string, params: unknown[] = []) =>
    Object.values((await db.query<Record<string, string>>(sql, params)).rows[0])[0]
  const home = await scalar("select create_household('Rollback fixture')")
  const list = await scalar('select ensure_shopping_list($1)', [home])
  const product = await scalar("select save_catalog_product('Prodotto rollback')->>'id'")
  const item = await scalar("select add_list_item($1,'Articolo rollback',1,'pz',p_specific:=$2)", [
    list,
    product,
  ])
  const purchase = await scalar('select record_purchase(gen_random_uuid(),$1,1,2,p_specific:=$2)', [
    item,
    product,
  ])
  const before = (await db.query('select version from shopping_lists where id=$1', [list])).rows
  await expect(db.query('select delete_catalog_product($1,true)', [product])).rejects.toThrow(
    'Simulated failure',
  )
  expect((await db.query('select version from shopping_lists where id=$1', [list])).rows).toEqual(before)
  expect((await db.query('select id from shopping_list_items where id=$1', [item])).rows).toHaveLength(1)
  expect((await db.query('select id from purchases where id=$1', [purchase])).rows).toHaveLength(1)
  expect(
    (await db.query('select id from list_item_contributions where item_id=$1', [item])).rows,
  ).toHaveLength(1)
  await db.exec('reset role')
})
