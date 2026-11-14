import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const eve = '00000000-0000-4000-8000-000000000003'
let home: string, other: string, list: string, item: string, invite: string
const scalar = async (sql: string, params: unknown[] = []) =>
  Object.values((await db.query<Record<string, string>>(sql, params)).rows[0])[0]
async function as(user: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  await db.exec(`create schema auth; create role authenticated nologin; create role anon nologin;
    create table auth.users(id uuid primary key); grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    insert into auth.users values('${alice}'),('${bob}'),('${eve}');`)
  for (const file of [
    '202611140001_foundations.sql',
    '202611140002_planning.sql',
    '202611140004_workflows.sql',
    '202611140005_retention.sql',
    '202611140006_plan_versions.sql',
    '202611140007_barcode_validation.sql',
    '202611140008_explicit_privileges.sql',
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  await as(alice)
  home = await scalar("select public.create_household('Casa A')")
  invite = await scalar('select public.create_invite($1)', [home])
  list = await scalar("insert into shopping_lists(household_id,title) values($1,'Lista A') returning id", [
    home,
  ])
  item = await scalar("select add_list_item($1,'Latte',2,'L')", [list])
  await as(eve)
  other = await scalar("select public.create_household('Casa B')")
}, 60000)
afterAll(async () => {
  await db.close()
})
describe('RLS PostgreSQL reale e RPC', () => {
  it('isola letture e scritture tra famiglie', async () => {
    await as(eve)
    expect((await db.query('select * from shopping_lists')).rows).toHaveLength(0)
    await expect(
      db.query("insert into shopping_lists(household_id,title) values($1,'Intrusione')", [home]),
    ).rejects.toThrow()
    await expect(db.query("select add_list_item($1,'No',1,'pz')", [list])).rejects.toThrow()
    expect(
      (await db.query('update shopping_lists set title=$1 where id=$2 returning id', ['Intrusione', list]))
        .rows,
    ).toHaveLength(0)
  })
  it('accetta un invito una volta e abilita il secondo membro', async () => {
    await as(bob)
    expect(await scalar('select accept_invite($1)', [invite])).toBe(home)
    expect((await db.query('select * from shopping_lists')).rows).toHaveLength(1)
    await db.query("select add_list_item($1,'Pane',1,'pz')", [list])
    await as(alice)
    expect((await db.query('select * from shopping_list_items')).rows).toHaveLength(2)
    await as(eve)
    await expect(db.query('select accept_invite($1)', [invite])).rejects.toThrow()
  })
  it('blocca riferimenti a prodotti di altra famiglia anche da un membro autorizzato', async () => {
    await as(eve)
    const product = await scalar(
      "insert into generic_products(household_id,name,canonical_unit) values($1,'Segreto','g') returning id",
      [other],
    )
    await as(alice)
    await expect(db.query("select add_list_item($1,'No',1,'g',$2)", [list, product])).rejects.toThrow()
  })
  it('registra acquisti una sola volta e mantiene acquisti senza prezzo', async () => {
    await as(alice)
    const id = '00000000-0000-4000-8000-000000000010'
    await db.query('select record_purchase($1,$2,0.5)', [id, item])
    await db.query('select record_purchase($1,$2,0.5)', [id, item])
    expect((await db.query('select * from purchases')).rows).toHaveLength(1)
    expect((await db.query('select * from price_observations')).rows).toHaveLength(0)
    await expect(db.query('select record_purchase($1,$2,1)', [id, item])).rejects.toThrow()
    await db.query('select complete_purchase_price($1,1.25)', [id])
    await db.query('select void_purchase($1)', [id])
    expect((await db.query('select * from purchases where voided_at is null')).rows).toHaveLength(0)
    expect((await db.query('select * from purchases')).rows).toHaveLength(1)
  })
  it('rifiuta acquisti fuori famiglia', async () => {
    await as(eve)
    await expect(db.query('select record_purchase(gen_random_uuid(),$1,1)', [item])).rejects.toThrow()
    await expect(
      db.query(
        "insert into purchases(id,household_id,list_item_id,quantity,unit) values(gen_random_uuid(),$1,$2,1,'L')",
        [other, item],
      ),
    ).rejects.toThrow()
  })
  it('rifiuta un invito scaduto e un invito revocato', async () => {
    await as(alice)
    const token = await scalar('select create_invite($1)', [home])
    await db.exec('reset role')
    await db.query(
      "update household_invites set expires_at=now()-interval '1 day' where token_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",
      [token],
    )
    await as(bob)
    await db.query('select leave_household($1)', [home])
    await expect(db.query('select accept_invite($1)', [token])).rejects.toThrow('Invito non valido o scaduto')
    expect((await db.query('select * from shopping_lists')).rows).toHaveLength(0)
    await as(alice)
    const revoked = await scalar('select create_invite($1)', [home])
    const iid = await scalar(
      "select id from household_invites where token_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",
      [revoked],
    )
    await db.query('select revoke_invite($1)', [iid])
    await as(bob)
    await expect(db.query('select accept_invite($1)', [revoked])).rejects.toThrow()
  })
  it('diff transazionale: versione obsoleta, manuali e acquisti protetti', async () => {
    await as(alice)
    const product = await scalar(
      "insert into generic_products(household_id,name,canonical_unit) values($1,'Farina','g') returning id",
      [home],
    )
    const flour = await scalar("select add_list_item($1,'Farina',100,'g',$2)", [list, product])
    const plan = await scalar(
      "insert into meal_plans(household_id,week_start) values($1,'2026-11-16') returning id",
      [home],
    )
    let version = Number(await scalar('select version from shopping_lists where id=$1', [list]))
    const rows = JSON.stringify([{ product_id: product, unit: 'g', quantity: '200' }])
    await db.query('select apply_plan_diff($1,$2,$3,$4,1)', [list, plan, version, rows])
    expect(
      Number(
        await scalar('select sum(requested_quantity) from list_item_contributions where item_id=$1', [flour]),
      ),
    ).toBe(300)
    await expect(
      db.query('select apply_plan_diff($1,$2,$3,$4,1)', [list, plan, version, '[]']),
    ).rejects.toThrow('Lista modificata')
    await db.query('select record_purchase(gen_random_uuid(),$1,250)', [flour])
    version = Number(await scalar('select version from shopping_lists where id=$1', [list]))
    await expect(
      db.query('select apply_plan_diff($1,$2,$3,$4,1)', [list, plan, version, '[]']),
    ).rejects.toThrow('Conflitto')
    expect(
      Number(
        await scalar('select sum(requested_quantity) from list_item_contributions where item_id=$1', [flour]),
      ),
    ).toBe(300)
    expect(
      (
        await db.query("select * from list_item_contributions where item_id=$1 and origin_type='manual'", [
          flour,
        ])
      ).rows,
    ).toHaveLength(1)
  })
  it('nessuna tabella di famiglia senza RLS', async () => {
    await db.exec('reset role')
    const result = await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    )
    expect(result.rows).toHaveLength(0)
  })
  it('creazione ricetta atomica: ingredienti invalidi non lasciano bozze salvate', async () => {
    await as(alice)
    const before = Number(await scalar('select count(*) from recipes'))
    await expect(
      db.query("select save_recipe('Non salvare',2,'Test',null,$1)", [
        JSON.stringify([{ product_id: eve, quantity: '10', unit: 'g' }]),
      ]),
    ).rejects.toThrow()
    expect(Number(await scalar('select count(*) from recipes'))).toBe(before)
  })
  it('ricetta -> lista idempotente e duplicazione senza acquisti', async () => {
    await as(alice)
    const product = await scalar(
      "insert into generic_products(household_id,name,canonical_unit) values($1,'Uova','pz') returning id",
      [home],
    )
    const recipe = await scalar("select save_recipe('Uova in padella',2,'Cuoci',null,$1)", [
      JSON.stringify([{ product_id: product, quantity: '1', unit: 'pz' }]),
    ])
    const operation = '00000000-0000-4000-8000-000000000020'
    await db.query('select add_recipe_to_list($1,$2,3,$3)', [recipe, list, operation])
    await db.query('select add_recipe_to_list($1,$2,3,$3)', [recipe, list, operation])
    expect(
      Number(
        await scalar('select sum(requested_quantity) from list_item_contributions where origin_id=$1', [
          operation,
        ]),
      ),
    ).toBe(2)
    const copy = await scalar('select duplicate_list($1)', [list])
    expect(
      Number(await scalar('select count(*) from shopping_list_items where list_id=$1', [copy])),
    ).toBeGreaterThan(0)
    expect(
      Number(
        await scalar(
          'select count(*) from purchases p join shopping_list_items i on i.id=p.list_item_id where i.list_id=$1',
          [copy],
        ),
      ),
    ).toBe(0)
    const copyRecipe = await scalar('select duplicate_recipe($1)', [recipe])
    expect(
      Number(await scalar('select count(*) from recipe_ingredients where recipe_id=$1', [copyRecipe])),
    ).toBe(1)
  })
  it('piano modificato dopo anteprima viene respinto senza cambiare la lista', async () => {
    await as(alice)
    const plan = await scalar('select id from meal_plans where household_id=$1', [home])
    const product = await scalar("select id from generic_products where name='Uova'")
    const version = Number(await scalar('select version from shopping_lists where id=$1', [list]))
    const planVersion = Number(await scalar('select version from meal_plans where id=$1', [plan]))
    await db.query(
      "insert into meal_entries(household_id,meal_plan_id,meal_date,meal_slot,generic_product_id,quantity,unit) values($1,$2,'2026-11-16','pranzo',$3,2,'pz')",
      [home, plan, product],
    )
    await expect(
      db.query('select apply_plan_diff($1,$2,$3,$4,$5)', [list, plan, version, '[]', planVersion]),
    ).rejects.toThrow('piano è cambiato')
    expect(Number(await scalar('select version from shopping_lists where id=$1', [list]))).toBe(version)
  })
  it('snapshot immutabile e prezzi storici annullabili senza cancellazione', async () => {
    await as(alice)
    const product = await scalar(
      "insert into specific_products(household_id,name,package_quantity,package_unit) values($1,'Formato test',500,'g') returning id",
      [home],
    )
    const store = await scalar(
      "insert into stores(household_id,name) values($1,'Negozio test') returning id",
      [home],
    )
    const price = await scalar("select add_price($1,$2,1.99,'regular',now())", [product, store])
    const snapshot = await scalar("select save_estimate($1,$2,3.98,1,'2026-11-18','{}')", [list, store])
    await expect(
      db.query('update price_estimate_snapshots set estimated_total=0 where id=$1', [snapshot]),
    ).rejects.toThrow()
    await expect(db.query('delete from price_observations where id=$1', [price])).rejects.toThrow()
    await db.query('select void_price($1)', [price])
    expect(
      (await db.query('select * from price_observations where id=$1 and voided_at is not null', [price]))
        .rows,
    ).toHaveLength(1)
  })
  it('anon non può eseguire RPC né leggere dati familiari', async () => {
    await db.exec('reset role;set role anon')
    await expect(db.query('select * from shopping_lists')).rejects.toThrow()
    await expect(db.query("select create_household('Anon')")).rejects.toThrow()
  })
  it('rimuove i grant impliciti Supabase e limita le scritture protette alle RPC', async () => {
    await db.exec('reset role')
    const tables = await db.query<{ anon_read: boolean; authenticated_truncate: boolean }>(
      "select has_table_privilege('anon',c.oid,'SELECT') as anon_read,has_table_privilege('authenticated',c.oid,'TRUNCATE') as authenticated_truncate from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    )
    expect(tables.rows.every((t) => !t.anon_read && !t.authenticated_truncate)).toBe(true)
    const functions = await db.query<{ anon_execute: boolean; authenticated_execute: boolean }>(
      "select has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
    )
    expect(functions.rows).toHaveLength(22)
    expect(functions.rows.every((f) => !f.anon_execute && f.authenticated_execute)).toBe(true)
    expect(
      await scalar("select has_table_privilege('authenticated','public.purchases','INSERT')::text"),
    ).toBe('false')
  })
  it('checksum EAN verificato anche dal database', async () => {
    await as(alice)
    await db.query(
      "insert into specific_products(household_id,name,package_quantity,package_unit,barcode) values($1,'Barcode valido',1,'pz','8000500037560')",
      [home],
    )
    await expect(
      db.query(
        "insert into specific_products(household_id,name,package_quantity,package_unit,barcode) values($1,'Barcode errato',1,'pz','12345678')",
        [home],
      ),
    ).rejects.toThrow()
  })
  it('eliminazione famiglia richiede conferma e non tocca altre famiglie', async () => {
    await as(eve)
    await expect(db.query("select delete_household($1,'Sbagliato')", [other])).rejects.toThrow()
    await db.query("select delete_household($1,'Casa B')", [other])
    expect((await db.query('select * from households')).rows).toHaveLength(0)
    await as(alice)
    expect((await db.query('select * from households')).rows).toHaveLength(1)
  })
})
