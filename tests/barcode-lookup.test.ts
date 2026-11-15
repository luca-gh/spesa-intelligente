import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseBarcodeProduct, barcodeCategory } from '../src/domain/barcodeLookup'
import { onRequest } from '../functions/api/products/[barcode]'

const code = '8000500037560'
afterEach(() => vi.unstubAllGlobals())
describe('dati da barcode', () => {
  it('preferisce il nome generico italiano e converte i formati espliciti', () => {
    expect(
      parseBarcodeProduct(code, {
        product: {
          code,
          generic_name_it: ' Latte parzialmente scremato ',
          product_name: 'Other',
          brands: 'Abit',
          quantity: '50 cl',
          categories_tags: ['en:milks'],
        },
      }),
    ).toMatchObject({ name: 'Latte parzialmente scremato', brand: 'Abit', size: '500', unit: 'ml' })
  })
  it('non inventa nome o formato per dati mancanti e multipack ambigui', () => {
    expect(parseBarcodeProduct(code, { product: { brands: 'Abit', quantity: '6 x 1 L' } })).toMatchObject({
      name: '',
      brand: 'Abit',
      size: '',
      unit: '',
    })
  })
  it('usa quantità e unità strutturate senza inferire unità assenti', () => {
    expect(
      parseBarcodeProduct(code, { product: { product_quantity: 0.75, product_quantity_unit: 'L' } }),
    ).toMatchObject({ size: '0.75', unit: 'L' })
    expect(parseBarcodeProduct(code, { product: { product_quantity: 500 } })).toMatchObject({
      size: '',
      unit: '',
    })
  })
  it('rifiuta una risposta relativa a un altro prodotto', () => {
    expect(() => parseBarcodeProduct(code, { product: { code: '96385074' } })).toThrow('non corrispondente')
    expect(parseBarcodeProduct(code, { status: 0 })).toBeNull()
  })
  it('propone solo una categoria esistente e non ambigua', () => {
    expect(barcodeCategory([{ id: 'milk', name: 'Latticini' }], ['en:milks'])).toBe('milk')
    expect(
      barcodeCategory(
        [
          { id: 'milk', name: 'Latticini' },
          { id: 'other', name: 'Latte e derivati' },
        ],
        ['en:milks'],
      ),
    ).toBe('')
    expect(barcodeCategory([{ id: 'unknown', name: 'Altro' }], ['en:milks'])).toBe('')
  })
  it('normalizza cosmetici e prodotti per la casa con la fonte corretta', () => {
    expect(
      parseBarcodeProduct(
        code,
        { product: { code, product_type: 'beauty', product_name: 'Shampoo', quantity: '400 ml' } },
        'beauty',
      ),
    ).toMatchObject({
      name: 'Shampoo',
      source: 'beauty',
      sourceUrl: `https://world.openbeautyfacts.org/product/${code}`,
      size: '400',
      unit: 'ml',
    })
    expect(
      parseBarcodeProduct(
        code,
        { product: { product_type: 'product', product_name_it: 'Carta', quantity: '12 pieces' } },
        'product',
      ),
    ).toMatchObject({
      name: 'Carta',
      source: 'product',
      sourceUrl: `https://world.openproductsfacts.org/product/${code}`,
      size: '12',
      unit: 'pz',
    })
    expect(
      barcodeCategory([{ id: 'care', name: 'Igiene personale' }], ['en:personal-care', 'en:shampoo']),
    ).toBe('care')
    expect(barcodeCategory([{ id: 'home', name: 'Detersivi' }], ['en:laundry-detergents'])).toBe('home')
  })
  it('ignora record dichiarati per animali anche se restituiti da una fonte ammessa', () => {
    expect(
      parseBarcodeProduct(code, { product: { product_type: 'petfood', product_name: 'Cibo animali' } }),
    ).toBeNull()
    expect(parseBarcodeProduct(code, { product: { product_type: 'petfood' } }, 'product')).toBeNull()
  })
})
describe('ricerca pubblica isolata dai dati privati', () => {
  it.each([
    ['POST', code, 405],
    ['GET', '12345678', 400],
    ['GET', 'https://example.com', 400],
  ])('blocca metodo/codice non ammessi: %s %s', async (method, barcode, status) => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const response = await onRequest({
      request: new Request('https://app.test/api/products/' + code, { method }),
      params: { barcode },
    })
    expect(response.status).toBe(status)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rifiuta richieste browser da un’altra origine', async () => {
    const response = await onRequest({
      request: new Request('https://app.test/api/products/' + code, {
        headers: { Origin: 'https://other.test' },
      }),
      params: { barcode: code },
    })
    expect(response.status).toBe(403)
  })
  it('interroga soltanto il provider previsto, senza inoltrare credenziali', async () => {
    vi.stubGlobal('caches', undefined)
    const upstream = vi
      .fn()
      .mockResolvedValue(Response.json({ product: { code, product_name_it: 'Latte', quantity: '1 L' } }))
    vi.stubGlobal('fetch', upstream)
    const response = await onRequest({
      request: new Request('https://app.test/api/products/' + code, {
        headers: { Authorization: 'Bearer private-fixture', Cookie: 'private=fixture' },
      }),
      params: { barcode: code },
    })
    expect(response.status).toBe(200)
    const [url, options] = upstream.mock.calls[0]
    expect(url.origin).toBe('https://world.openfoodfacts.org')
    // Workers rejects redirect: 'error' before sending the request. Manual never follows redirects.
    expect(options.redirect).toBe('manual')
    expect(options.headers.Authorization).toBeUndefined()
    expect(options.headers.Cookie).toBeUndefined()
    expect(options.headers['User-Agent']).toContain('SpesaIntelligente/')
    expect(await response.json()).toMatchObject({ product: { name: 'Latte', size: '1', unit: 'L' } })
    expect(upstream).toHaveBeenCalledTimes(1)
  })
  it('gestisce codice non trovato ed errori del provider', async () => {
    vi.stubGlobal('caches', undefined)
    const upstream = vi.fn().mockImplementation(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', upstream)
    const context = {
      request: new Request('https://app.test/api/products/' + code + '?scope=supermarket'),
      params: { barcode: code },
    }
    expect(await (await onRequest(context)).json()).toEqual({ product: null })
    expect(upstream).toHaveBeenCalledTimes(3)
    upstream.mockImplementation(async () => new Response('', { status: 429 }))
    const failed = await onRequest(context)
    expect(failed.status).toBe(503)
    expect(failed.headers.get('Cache-Control')).toBe('no-store')
    upstream.mockImplementation(
      async () => new Response('', { status: 302, headers: { Location: 'https://other.test' } }),
    )
    const redirected = await onRequest(context)
    expect(redirected.status).toBe(503)
    expect(redirected.headers.get('X-Lookup-Status')).toBe('upstream-302')
    expect(upstream).toHaveBeenCalledTimes(9)
  })
  it('riutilizza la cache pubblica senza interrogare di nuovo il provider', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(Response.json({ product: null })) },
    })
    expect(
      (
        await onRequest({
          request: new Request('https://app.test/api/products/' + code),
          params: { barcode: code },
        })
      ).status,
    ).toBe(200)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('mantiene solo alimentari per client precedenti, evitando attribuzioni errate', async () => {
    vi.stubGlobal('caches', undefined)
    const upstream = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', upstream)
    const response = await onRequest({
      request: new Request('https://app.test/api/products/' + code),
      params: { barcode: code },
    })
    expect(await response.json()).toEqual({ product: null })
    expect(upstream).toHaveBeenCalledTimes(1)
  })
  it.each(['beauty', 'product'] as const)(
    'cerca nella fonte %s dopo un codice alimentare assente',
    async (source) => {
      vi.stubGlobal('caches', undefined)
      const upstream = vi.fn(async (url: URL) =>
        url.hostname === `world.open${source === 'beauty' ? 'beauty' : 'products'}facts.org`
          ? Response.json({
              product: {
                code,
                product_type: source,
                product_name_it: source === 'beauty' ? 'Shampoo' : 'Detersivo',
                quantity: '1 L',
              },
            })
          : new Response('', { status: 404 }),
      )
      vi.stubGlobal('fetch', upstream)
      const response = await onRequest({
        request: new Request(`https://app.test/api/products/${code}?scope=supermarket`),
        params: { barcode: code },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ product: { source, size: '1', unit: 'L' } })
      expect(upstream).toHaveBeenCalledTimes(3)
      for (const [url] of upstream.mock.calls) {
        expect([
          'world.openfoodfacts.org',
          'world.openbeautyfacts.org',
          'world.openproductsfacts.org',
        ]).toContain(url.hostname)
        expect(url.searchParams.get('product_type')).not.toBe('all')
        expect(url.pathname).toBe(`/api/v3/product/${code}.json`)
      }
    },
  )
  it('un errore alimentare non impedisce un risultato cosmetico', async () => {
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) =>
        url.hostname === 'world.openfoodfacts.org'
          ? new Response('', { status: 503 })
          : url.hostname === 'world.openbeautyfacts.org'
            ? Response.json({ product: { code, product_type: 'beauty', product_name: 'Sapone' } })
            : new Response('', { status: 404 }),
      ),
    )
    const response = await onRequest({
      request: new Request(`https://app.test/api/products/${code}?scope=supermarket`),
      params: { barcode: code },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ product: { name: 'Sapone', source: 'beauty' } })
  })
  it('non segue redirect verso database per animali o altri host', async () => {
    vi.stubGlobal('caches', undefined)
    const upstream = vi.fn(async (url: URL) =>
      url.hostname === 'world.openfoodfacts.org'
        ? new Response('', {
            status: 302,
            headers: { Location: `https://world.openpetfoodfacts.org/api/v3/product/${code}.json` },
          })
        : new Response('', { status: 404 }),
    )
    vi.stubGlobal('fetch', upstream)
    const response = await onRequest({
      request: new Request(`https://app.test/api/products/${code}?scope=supermarket`),
      params: { barcode: code },
    })
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(upstream.mock.calls.map(([url]) => url.hostname)).toEqual([
      'world.openfoodfacts.org',
      'world.openbeautyfacts.org',
      'world.openproductsfacts.org',
    ])
  })
})
