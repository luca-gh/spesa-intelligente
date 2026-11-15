import { validBarcode } from '../../../src/domain/math.ts'
import { parseBarcodeProduct } from '../../../src/domain/barcodeLookup.ts'

export interface LookupContext {
  request: Request
  params: { barcode?: string | string[] }
  waitUntil?: (work: Promise<unknown>) => void
}
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }
export async function onRequest(context: LookupContext): Promise<Response> {
  if (context.request.method !== 'GET')
    return Response.json(
      { error: 'Metodo non consentito' },
      { status: 405, headers: { ...headers, Allow: 'GET' } },
    )
  const code = typeof context.params.barcode === 'string' ? context.params.barcode : ''
  if (!validBarcode(code)) return Response.json({ error: 'Codice EAN non valido' }, { status: 400, headers })
  const origin = context.request.headers.get('Origin')
  if (origin && origin !== new URL(context.request.url).origin)
    return Response.json({ error: 'Origine non consentita' }, { status: 403, headers })
  const cache = (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default
  const cacheKey = new Request(new URL(`/api/products/${code}`, context.request.url))
  const hit = await cache?.match(cacheKey)
  if (hit) return hit
  try {
    const url = new URL(`https://world.openfoodfacts.org/api/v3/product/${code}.json`)
    url.searchParams.set(
      'fields',
      'code,generic_name_it,generic_name,product_name_it,product_name,brands,quantity,product_quantity,product_quantity_unit,categories_tags,categories',
    )
    url.searchParams.set('lc', 'it')
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SpesaIntelligente/0.1.0 (https://github.com/luca-gh/spesa-intelligente)',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok && upstream.status !== 404) throw new Error('Servizio non disponibile')
    const product = upstream.status === 404 ? null : parseBarcodeProduct(code, await upstream.json())
    const response = Response.json(
      { product },
      { headers: { ...headers, 'Cache-Control': `public, max-age=${product ? 86400 : 300}` } },
    )
    if (cache) {
      const write = cache.put(cacheKey, response.clone())
      if (context.waitUntil) context.waitUntil(write)
      else await write
    }
    return response
  } catch {
    return Response.json(
      { error: 'Ricerca non disponibile. Riprova oppure completa i dati manualmente.' },
      { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } },
    )
  }
}
