import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'

it('migrazione catalogo: preserva prodotti, liste, acquisti e archiviazione preesistenti', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
      create table auth.users(id uuid primary key);grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      insert into auth.users values('00000000-0000-4000-8000-000000000099');
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false);`)
    const migration = '20261114221151_unified_catalog.sql'
    for (const file of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql') && !f.includes('realtime_storage') && f < migration)
      .sort())
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    const scalar = async (sql: string, params: unknown[] = []) =>
      Object.values((await db.query<Record<string, string>>(sql, params)).rows[0])[0]
    const home = await scalar("select create_household('Casa migrazione')")
    const plain = await scalar(
      "insert into generic_products(household_id,name,canonical_unit) values($1,'Latte precedente','L') returning id",
      [home],
    )
    const archived = await scalar(
      "insert into generic_products(household_id,name,canonical_unit,archived_at) values($1,'Archiviato precedente','pz',now()) returning id",
      [home],
    )
    const branded = await scalar(
      "insert into specific_products(household_id,generic_product_id,name,brand,package_quantity,package_unit) values($1,$2,'Latte confezione precedente','Abit',1,'L') returning id",
      [home, plain],
    )
    const oldList = await scalar(
      "insert into shopping_lists(household_id,title) values($1,'Lista precedente') returning id",
      [home],
    )
    const oldItem = await scalar("select add_list_item($1,'Latte precedente',2,'L',$2)", [oldList, plain])
    const purchase = await scalar(
      'select record_purchase(p_id:=gen_random_uuid(),p_item:=$1,p_quantity:=1,p_total:=2.50,p_specific:=$2)',
      [oldItem, branded],
    )
    const before = (await db.query('select * from purchases where id=$1', [purchase])).rows
    await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'))
    expect((await db.query('select * from purchases where id=$1', [purchase])).rows).toEqual(before)
    expect(await scalar('select generic_product_id from shopping_list_items where id=$1', [oldItem])).toBe(
      plain,
    )
    expect(
      Number(await scalar('select count(*) from specific_products where generic_product_id=$1', [plain])),
    ).toBe(1)
    expect(
      (
        await db.query(
          'select package_quantity,package_unit,archived_at is not null as archived from specific_products where generic_product_id=$1',
          [archived],
        )
      ).rows,
    ).toEqual([{ package_quantity: null, package_unit: null, archived: true }])
    expect(await scalar('select is_catalog_group from generic_products where id=$1', [plain])).toBe(true)
    expect(await scalar('select canonical_unit from generic_products where id=$1', [plain])).toBe('L')
  } finally {
    await db.close()
  }
}, 60000)
