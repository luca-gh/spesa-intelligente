import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'

it('importa l’ultimo importo disponibile una sola volta, senza filtri promozionali o temporali', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
      grant usage on schema auth to authenticated;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      alter default privileges in schema public grant all on tables to anon,authenticated;
      alter default privileges in schema public grant all on functions to anon,authenticated;
      create publication supabase_realtime;
      insert into auth.users values('00000000-0000-4000-8000-000000000031');
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000031',false);`)
    const files = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const migration = files.find((f) => f.endsWith('_current_catalog_prices.sql'))!
    for (const file of files.filter((f) => f < migration))
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    await db.exec(`set role authenticated;
      do $$ declare h uuid; p uuid; s uuid; begin
        h:=create_household('Migration fixture');
        insert into stores(household_id,name) values(h,'Negozio') returning id into s;
        p:=(save_catalog_product('Latte')->>'id')::uuid;
        perform add_price(p,s,3,'regular','2019-01-01');
        perform add_price(p,s,1.2,'promotion','2020-01-01','2020-01-01','2020-01-02');
        perform void_price(add_price(p,s,9,'unknown','2021-01-01'));
      end $$;reset role;`)
    await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'))
    await db.exec('set role authenticated')
    expect((await db.query('select price_amount from product_prices')).rows).toEqual([
      { price_amount: '1.20' },
    ])
    expect((await db.query('select count(*)::int as n from price_observations')).rows).toEqual([{ n: 3 }])
    await db.exec('reset role')
    for (const file of files.filter((f) => f > migration))
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    expect(
      (await db.query('select price_amount,discounted_price_amount,price_basis from product_prices')).rows,
    ).toEqual([{ price_amount: '1.20', discounted_price_amount: null, price_basis: 'package' }])
  } finally {
    await db.close()
  }
}, 60000)
