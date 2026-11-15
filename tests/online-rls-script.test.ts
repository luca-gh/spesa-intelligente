import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it.each([
  [
    'online_rls',
    'Due membri, isolamento famiglie, acquisto parziale idempotente, uscita e anon verificati; fixture annullate',
  ],
  [
    'meal_plan_deletion',
    'Plan deletion: meals removed, list/history/recipes/templates retained, RLS and rollback verified',
  ],
])(
  'lo script SQL %s isola le famiglie e annulla tutte le fixture',
  async (script, verification) => {
    const db = new PGlite()
    try {
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
      const results = await db.exec(readFileSync(`supabase/tests/${script}.sql`, 'utf8'))
      expect(results.at(-1)?.rows).toEqual([
        {
          status: 'PASS',
          verification,
        },
      ])
      expect((await db.query('select * from public.households')).rows).toHaveLength(0)
      expect((await db.query('select * from auth.users')).rows).toHaveLength(0)
    } finally {
      await db.close()
    }
  },
  60000,
)
