import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'

const migration = readdirSync('supabase/migrations').find((f) => f.endsWith('_single_shopping_list.sql'))!
const sql = readFileSync('supabase/migrations/' + migration, 'utf8')
const alice = '00000000-0000-4000-8000-000000000091'
const bob = '00000000-0000-4000-8000-000000000092'
async function setup() {
  const db = new PGlite()
  await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
    create table auth.users(id uuid primary key);grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on functions to anon,authenticated;
    insert into auth.users values('${alice}'),('${bob}');`)
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql') && f < migration && !f.includes('realtime_storage'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  const scalar = async (query: string, params: unknown[] = []) =>
    Object.values((await db.query<Record<string, string>>(query, params)).rows[0])[0]
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice])
  const home = await scalar("select create_household('Casa lista unica')")
  return { db, home, scalar }
}

it('lista unica: migrazione conserva articoli, acquisti, contributi e collegamento al piano', async () => {
  const { db, home, scalar } = await setup()
  try {
    const list = await scalar(
      "insert into shopping_lists(household_id,title,status) values($1,'Lista precedente','completed') returning id",
      [home],
    )
    const item = await scalar("select add_list_item($1,'Latte',2,'L')", [list])
    await db.query('select record_purchase(p_id:=gen_random_uuid(),p_item:=$1,p_quantity:=1,p_total:=2.50)', [
      item,
    ])
    await db.query(
      "insert into meal_plans(household_id,week_start,linked_list_id) values($1,'2026-11-16',$2)",
      [home, list],
    )
    const before = {}
    for (const table of ['shopping_list_items', 'list_item_contributions', 'purchases', 'meal_plans'])
      Object.assign(before, { [table]: (await db.query('select * from ' + table)).rows })
    await db.exec(sql)
    expect(await scalar('select id from shopping_lists')).toBe(list)
    expect(await scalar('select status from shopping_lists')).toBe('active')
    for (const [table, rows] of Object.entries(before))
      expect((await db.query('select * from ' + table)).rows).toEqual(rows)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice])
    await db.exec('set role authenticated')
    expect(await scalar('select ensure_shopping_list($1)', [home])).toBe(list)
    expect(await scalar('select ensure_shopping_list($1)', [home])).toBe(list)
    await expect(
      db.query("insert into shopping_lists(household_id,title) values($1,'Seconda')", [home]),
    ).rejects.toThrow('shopping_lists_one_per_household')
    await expect(db.query("update shopping_lists set status='archived' where id=$1", [list])).rejects.toThrow(
      'shopping_lists_always_active',
    )
    await expect(db.query('select duplicate_list($1)', [list])).rejects.toThrow('permission denied')
  } finally {
    await db.close()
  }
}, 60000)

it('lista unica: creazione idempotente soggetta a RLS, accesso estraneo e anon negati', async () => {
  const { db, home, scalar } = await setup()
  try {
    await db.exec(sql)
    await db.exec('set role authenticated')
    const list = await scalar('select ensure_shopping_list($1)', [home])
    expect(await scalar('select ensure_shopping_list($1)', [home])).toBe(list)
    expect(Number(await scalar('select count(*) from shopping_lists'))).toBe(1)
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob])
    const other = await scalar("select create_household('Altra famiglia')")
    await db.exec('set role authenticated')
    await expect(db.query('select ensure_shopping_list($1)', [home])).rejects.toThrow(
      'Accesso non consentito',
    )
    expect(await scalar('select ensure_shopping_list($1)', [other])).not.toBe(list)
    await db.exec('reset role; set role anon')
    await expect(db.query('select ensure_shopping_list($1)', [home])).rejects.toThrow('permission denied')
    await db.exec('reset role')
    expect(
      (await db.query("select prosecdef from pg_proc where proname='ensure_shopping_list'")).rows,
    ).toEqual([{ prosecdef: false }])
  } finally {
    await db.close()
  }
}, 60000)

it('lista unica: interrompe la migrazione se trova liste legacy multiple, senza eliminare dati', async () => {
  const { db, home } = await setup()
  try {
    await db.query("insert into shopping_lists(household_id,title) values($1,'Prima'),($1,'Seconda')", [home])
    await expect(db.exec('begin;' + sql + 'commit;')).rejects.toThrow('riconciliare le liste multiple')
    await db.exec('rollback')
    expect((await db.query('select title from shopping_lists order by title')).rows).toEqual([
      { title: 'Prima' },
      { title: 'Seconda' },
    ])
  } finally {
    await db.close()
  }
}, 60000)
