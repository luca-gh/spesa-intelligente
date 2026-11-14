import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
const base = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!base || !key) {
  console.error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY in .env.')
  process.exit(1)
}
const headers = { apikey: key, Accept: 'application/json' }
const expectedTables = [
  'households',
  'profiles',
  'household_members',
  'household_invites',
  'categories',
  'generic_products',
  'specific_products',
  'stores',
  'price_observations',
  'store_discount_rules',
  'shopping_lists',
  'shopping_list_items',
  'list_item_contributions',
  'purchases',
  'recipes',
  'recipe_ingredients',
  'meal_plans',
  'meal_entries',
  'meal_templates',
  'price_estimate_snapshots',
]
async function request(path) {
  const response = await fetch(new URL(path, base), { headers, signal: AbortSignal.timeout(15000) })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}
const auth = await request('/auth/v1/settings')
console.log(`Auth: HTTP ${auth.status}`)
if (auth.status !== 200) {
  console.error('URL/chiave non accettati o progetto non raggiungibile. Nessun dato modificato.')
  process.exit(1)
}
console.log(`Email/password: ${auth.body?.external?.email ? 'abilitata' : 'da verificare'}`)
console.log(
  `Conferma email: ${auth.body?.mailer_autoconfirm === false ? 'richiesta' : 'verificare nelle impostazioni Auth'}`,
)
const results = await Promise.all(
  expectedTables.map(async (table) => {
    // Zero rows requested. This probe never reads household records or alters the database.
    const result = await request(`/rest/v1/${table}?select=*&limit=0`)
    const status =
      result.status === 200
        ? 'PRESENTE'
        : result.body?.code === '42501' && result.body?.message === `permission denied for table ${table}`
          ? 'PROTETTA'
          : result.body?.code === 'PGRST205'
            ? 'NON ESPOSTA'
            : result.body?.code === '42501'
              ? 'ACCESSO NEGATO'
              : 'NON VERIFICATA'
    return { table, status, http: result.status, code: result.body?.code }
  }),
)
for (const result of results)
  console.log(
    `${result.table}: ${result.status} (HTTP ${result.http}${result.code ? `, ${result.code}` : ''})`,
  )
console.log('Questa verifica non certifica RLS, colonne, RPC, Realtime o sessioni autenticate.')
process.exitCode = results.every((r) => r.status === 'PRESENTE' || r.status === 'PROTETTA') ? 0 : 2
