import { validBarcode } from '../../../src/domain/math.ts'
import { barcodeSources, parseBarcodeProduct, type BarcodeSource } from '../../../src/domain/barcodeLookup.ts'

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
  // Older installed clients label every result as food; keep their existing contract.
  const supermarket = new URL(context.request.url).searchParams.get('scope') === 'supermarket'
  const cacheKey = new Request(
    new URL(`/api/products/${code}${supermarket ? '?sources=supermarket-v2' : ''}`, context.request.url),
  )
  const hit = await cache?.match(cacheKey)
  if (hit) return hit
  let failure = 'network'
  try {
    const deadline = Date.now() + 10000
    let errors = false
    async function lookup(source: BarcodeSource) {
      let reason = 'network'
      try {
        const url = new URL(`/api/v3/product/${code}.json`, barcodeSources[source].origin)
        url.searchParams.set(
          'fields',
          'code,product_type,generic_name_it,generic_name,product_name_it,product_name,brands,quantity,product_quantity,product_quantity_unit,categories_tags,categories',
        )
        url.searchParams.set('lc', 'it')
        url.searchParams.set('product_type', source)
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error('Tempo esaurito')
        const upstream = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'SpesaIntelligente/0.1.0 (https://github.com/luca-gh/spesa-intelligente)',
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(Math.min(8000, remaining)),
        })
        reason = `upstream-${upstream.status}`
        if (!upstream.ok && upstream.status !== 404) throw new Error('Servizio non disponibile')
        reason = 'invalid-response'
        return upstream.status === 404 ? null : parseBarcodeProduct(code, await upstream.json(), source)
      } catch {
        errors = true
        failure = reason
        return null
      }
    }
    // Preserve the food fast path. Only missing/unavailable food starts the other fixed sources.
    let product = await lookup('food')
    if (!product && supermarket) {
      const alternatives = await Promise.all([lookup('beauty'), lookup('product')])
      product = alternatives.find((candidate) => candidate !== null) ?? null
    }
    // A partial outage is not proof that a barcode is absent from every source.
    if (!product && errors) throw new Error('Ricerca incompleta')
    const response = Response.json(
      { product },
      { headers: { ...headers, 'Cache-Control': `public, max-age=${product ? 86400 : 300}` } },
    )
    if (cache) {
      failure = 'cache-write'
      const write = cache.put(cacheKey, response.clone())
      if (context.waitUntil) context.waitUntil(write)
      else await write
    }
    return response
  } catch {
    return Response.json(
      { error: 'Ricerca non disponibile. Riprova oppure completa i dati manualmente.' },
      { status: 503, headers: { ...headers, 'Cache-Control': 'no-store', 'X-Lookup-Status': failure } },
    )
  }
}
