import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, expect, it } from 'vitest'

const db = new PGlite()
let sql: string
beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/prepare-bootstrap.mjs'])
  sql = readFileSync('.tools/supabase-bootstrap.sql', 'utf8')
  await db.exec(`
    create schema auth;
    create role authenticated nologin;
    create role anon nologin;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create publication supabase_realtime;
  `)
}, 60000)
afterAll(async () => {
  await db.close()
})
it('bootstrap completo: dieci migrazioni, venti tabelle con RLS e quattro tabelle pubblicate', async () => {
  await db.exec(sql)
  const tables = await db.query<{ name: string; rls: boolean }>(
    `select c.relname as name,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`,
  )
  expect(tables.rows).toHaveLength(20)
  expect(tables.rows.every((t) => t.rls)).toBe(true)
  const publication = await db.query<{ tablename: string }>(
    "select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename",
  )
  expect(publication.rows.map((t) => t.tablename)).toEqual([
    'list_item_contributions',
    'purchases',
    'shopping_list_items',
    'shopping_lists',
  ])
})
it('bootstrap respinge una seconda esecuzione senza alterare lo schema esistente', async () => {
  await expect(db.exec(sql)).rejects.toThrow('Bootstrap annullato')
  await db.exec('rollback')
  expect((await db.query('select id from public.households')).rows).toHaveLength(0)
})
