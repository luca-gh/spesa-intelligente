import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
it('rende nuovamente disponibili gli archiviati, conserva prezzi, collegamenti e articoli rimossi', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth;create role authenticated nologin;create role anon nologin;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   alter default privileges in schema public grant all on tables to anon,authenticated;
   alter default privileges in schema public grant all on functions to anon,authenticated;
   create publication supabase_realtime;
   insert into auth.users values('00000000-0000-4000-8000-000000000099');
   select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false);`)
    const files = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const migration = files.find((f) => f.endsWith('_catalog_edit_prices_remove_archiving.sql'))!
    for (const file of files.filter((f) => f < migration))
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    await db.exec(`do $$ declare h uuid;s uuid;p uuid;r uuid;plan uuid;l uuid;i uuid;begin
   h:=public.create_household('Fixture archivio precedente');l:=public.ensure_shopping_list(h);
   insert into public.stores(household_id,name)values(h,'Negozio')returning id into s;
   p:=(public.save_catalog_product('Prodotto',p_quantity:=6,p_unit:='pz')->>'id')::uuid;
   perform public.set_product_prices(p,s,3,2,'package');
   insert into public.recipes(household_id,title,base_servings,archived_at)values(h,'Ricetta',2,now())returning id into r;
   insert into public.meal_plans(household_id,week_start,archived_at,version)values(h,'2026-11-23',now(),7)returning id into plan;
   insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id)values(h,plan,'2026-11-23','cena',r);
   i:=public.add_list_item(l,'Elemento rimosso',1,'pz');update public.shopping_list_items set archived_at=now()where id=i;
   insert into public.price_estimate_snapshots(household_id,list_id,store_id,estimated_total,coverage,shopping_date,detail_json,archived_at)values(h,l,s,3,1,'2026-11-23','{}',now());
   update public.generic_products set archived_at=now();update public.specific_products set archived_at=now();update public.stores set archived_at=now();
  end $$;`)
    const before = (await db.query('select version from meal_plans')).rows[0] as { version: number }
    await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'))
    for (const table of [
      'generic_products',
      'specific_products',
      'stores',
      'recipes',
      'meal_plans',
      'price_estimate_snapshots',
    ]) {
      expect((await db.query(`select archived_at from public.${table}`)).rows).toEqual([
        { archived_at: null },
      ])
      await expect(db.exec(`update public.${table} set archived_at=now()`)).rejects.toMatchObject({
        code: '23514',
      })
    }
    expect(
      ((await db.query('select version from meal_plans')).rows[0] as { version: number }).version,
    ).toBeGreaterThan(before.version)
    expect((await db.query('select price_amount,discounted_price_amount from product_prices')).rows).toEqual([
      { price_amount: '3.00', discounted_price_amount: '2.00' },
    ])
    expect((await db.query('select * from meal_entries')).rows).toHaveLength(1)
    expect((await db.query('select * from list_item_contributions')).rows).toHaveLength(1)
    expect(
      (await db.query('select archived_at is not null as removed from shopping_list_items')).rows,
    ).toEqual([{ removed: true }])
  } finally {
    await db.close()
  }
}, 60000)
