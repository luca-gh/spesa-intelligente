import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { isPrivilegedKey } from '../domain/config'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const valid =
  z.url().safeParse(url).success &&
  typeof key === 'string' &&
  key.length > 10 &&
  !key.startsWith('sb_secret_')
// Refuse a legacy service-role JWT as well as the newer secret key format.
export const client =
  valid && !isPrivilegedKey(key)
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null
export function requireClient() {
  if (!navigator.onLine) throw new Error('Sei offline. Riconnettiti per salvare.')
  if (!client) throw new Error('Configura Supabase per utilizzare i dati di famiglia.')
  return client
}
export function safeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : ''
  const known = [
    'Sei offline',
    'Configura Supabase',
    'Lista modificata',
    'Conflitto:',
    'Invito non valido',
    'Hai già una famiglia',
    'Ultimo membro',
    'Quantità non valida',
    'Chiave già usata',
    'Articolo con storico',
    'Limite inviti',
    'Prodotto in uso:',
    'Prezzo non valido:',
  ]
  if (known.some((prefix) => message.startsWith(prefix))) return message
  if (/Invalid login credentials/.test(message)) return 'Email o password non corrette.'
  if (/Email not confirmed/.test(message)) return 'Conferma il tuo indirizzo email prima di accedere.'
  if (/unique|duplicate/.test(message)) return 'Questo elemento esiste già. Controlla i duplicati.'
  if (/foreign key/.test(message))
    return 'L’elemento è collegato ad altri dati. Rimuovi prima i collegamenti indicati e riprova.'
  return 'Operazione non riuscita. Controlla connessione, dati e autorizzazioni, poi riprova.'
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  return data
}
export async function insert(table: string, household: string, values: Record<string, unknown>) {
  const { data, error } = await requireClient()
    .from(table)
    .insert({ ...values, household_id: household })
    .select()
    .single()
  if (error) throw error
  return data as { id: string }
}
export async function update(table: string, id: string, values: Record<string, unknown>) {
  const { error } = await requireClient().from(table).update(values).eq('id', id).select('id').single()
  if (error) throw error
}
export async function remove(table: string, id: string) {
  const { error } = await requireClient().from(table).delete().eq('id', id).select('id').single()
  if (error) throw error
}
export async function removeCatalogProduct(table: 'generic_products' | 'specific_products', id: string) {
  await rpc('delete_catalog_product', { p_id: id, p_specific: table === 'specific_products' })
}
