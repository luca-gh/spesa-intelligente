import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Browser-only fixtures. PostgreSQL authorization is tested independently, not mocked here as proof of RLS.
async function login(page: Page, populated = false, catalog: Record<string, unknown[]> = {}) {
  const home = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Famiglia di test',
    default_diners: 2,
    timezone: 'Europe/Rome',
  }
  const list = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Spesa di test',
    status: 'active',
    version: 1,
    created_at: '2026-11-14T12:00:00Z',
  }
  const items: Record<string, unknown>[] = []
  const contributions: Record<string, unknown>[] = []
  const purchases: Record<string, unknown>[] = []
  if (populated) {
    items.push({
      id: 'item',
      list_id: list.id,
      name: 'Latte',
      unit: 'L',
      generic_product_id: null,
      specific_product_id: null,
      note: '',
      created_at: '2026-11-14T12:00:00Z',
    })
    contributions.push({
      id: 'manual',
      item_id: 'item',
      origin_type: 'manual',
      origin_id: 'item',
      requested_quantity: '2',
    })
  }
  const collections: Record<string, unknown[]> = {
    shopping_lists: [list],
    shopping_list_items: items,
    list_item_contributions: contributions,
    purchases,
    ...structuredClone(catalog),
  }
  const catalogSaveRequests: Record<string, unknown>[] = []
  const ensureListRequests: Record<string, unknown>[] = []
  const categoryOrderRequests: Record<string, unknown>[] = []
  const itemRequests: Record<string, unknown>[] = []
  const catalogDeleteRequests: { table: string; id: string }[] = []
  await page.route('https://fixture.supabase.test/**', async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()!
    let result: unknown
    if (table === 'ensure_shopping_list') {
      ensureListRequests.push(route.request().postDataJSON())
      if (!collections.shopping_lists.length) collections.shopping_lists.push(list)
      result = list.id
    } else if (table === 'households') result = home
    else if (table === 'save_catalog_product') {
      const body = route.request().postDataJSON()
      catalogSaveRequests.push(body)
      const generics = (collections.generic_products ??= []) as Record<string, unknown>[]
      const specifics = (collections.specific_products ??= []) as Record<string, unknown>[]
      let specific = body.p_specific ? specifics.find((p) => p.id === body.p_id) : undefined
      let generic =
        body.p_id && !body.p_specific
          ? generics.find((p) => p.id === body.p_id)
          : generics.find((p) => p.id === specific?.generic_product_id || p.name === body.p_name)
      if (!generic) {
        generic = {
          id: 'new-group-' + generics.length,
          name: body.p_name,
          category_id: body.p_category,
          canonical_unit: body.p_unit,
          is_catalog_group: true,
        }
        generics.push(generic)
      }
      generic.is_catalog_group = true
      generic.category_id = body.p_category
      if (!specific) {
        specific = { id: 'new-product-' + specifics.length }
        specifics.push(specific)
      }
      Object.assign(specific, {
        name: body.p_name,
        generic_product_id: generic.id,
        brand: body.p_brand,
        barcode: body.p_barcode,
        variant: body.p_variant,
        package_quantity: body.p_quantity,
        package_unit: body.p_unit,
      })
      result = { id: specific.id, specific: true }
    } else if (table === 'add_list_item') {
      const body = route.request().postDataJSON()
      itemRequests.push(body)
      const id = `item-new-${items.length + 1}`
      items.push({
        id,
        list_id: body.p_list,
        name: body.p_name,
        unit: body.p_unit,
        generic_product_id: body.p_generic,
        specific_product_id: body.p_specific,
        note: '',
        created_at: '2026-11-14T13:00:00Z',
      })
      contributions.push({
        id: 'new-manual',
        item_id: id,
        origin_type: 'manual',
        origin_id: id,
        requested_quantity: body.p_quantity,
      })
      result = id
    } else if (table === 'record_purchase') {
      const body = route.request().postDataJSON()
      purchases.push({
        id: body.p_id,
        list_item_id: body.p_item,
        quantity: body.p_quantity,
        total_paid: body.p_total,
        store_id: null,
        specific_product_id: null,
        unit: 'L',
        purchased_at: '2026-11-14T12:00:00Z',
        voided_at: null,
      })
      result = body.p_id
    } else if (table === 'shopping_lists' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      const next = { ...list, title: body.title }
      collections.shopping_lists.push(next)
      result = next
    } else if (table === 'set_record_archived') {
      const body = route.request().postDataJSON()
      const records = (collections[body.p_type] ?? []) as Record<string, unknown>[]
      const record = records.find((r) => r.id === body.p_id)
      if (record) record.archived_at = body.p_archived ? '2026-11-14T13:00:00Z' : null
      result = null
    } else if (table === 'reorder_categories') {
      const body = route.request().postDataJSON()
      categoryOrderRequests.push(body)
      for (const category of (collections.categories ?? []) as { id: string; sort_order: number }[])
        category.sort_order = body.p_ids.indexOf(category.id)
      result = null
    } else if (table === 'delete_category') {
      const { p_id } = route.request().postDataJSON()
      collections.categories = (collections.categories ?? []).filter((c) => (c as { id: string }).id !== p_id)
      for (const p of (collections.generic_products ?? []) as Record<string, unknown>[])
        if (p.category_id === p_id) p.category_id = null
      result = null
    } else if (
      [
        'generic_products',
        'specific_products',
        'stores',
        'store_discount_rules',
        'recipes',
        'recipe_ingredients',
        'meal_templates',
      ].includes(table) &&
      route.request().method() === 'DELETE'
    ) {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '') ?? ''
      catalogDeleteRequests.push({ table, id })
      const records = collections[table] as { id: string }[]
      const index = records.findIndex((record) => record.id === id)
      result = index >= 0 ? records.splice(index, 1)[0] : null
    } else result = collections[table] ?? []
    await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.addInitScript(() => {
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'fixture@example.invalid',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    }
    const token =
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
      '.' +
      btoa(JSON.stringify({ sub: user.id, exp: 4102444800, role: 'authenticated' })) +
      '.test-fixture'
    localStorage.setItem(
      'sb-fixture-auth-token',
      JSON.stringify({
        access_token: token,
        refresh_token: 'test-fixture',
        expires_at: 4102444800,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      }),
    )
  })
  return {
    itemRequests,
    catalogDeleteRequests,
    catalogSaveRequests,
    ensureListRequests,
    categoryOrderRequests,
  }
}

const productCatalog = {
  generic_products: [
    { id: 'generic-milk', name: 'Latte intero', canonical_unit: 'L', category_id: null },
    { id: 'generic-flour', name: 'Farina 00', canonical_unit: 'g', category_id: null },
  ],
  specific_products: [
    {
      id: 'specific-flour',
      generic_product_id: 'generic-flour',
      name: 'Farina fine',
      brand: 'Molino Test',
      variant: '00',
      package_quantity: '500',
      package_unit: 'g',
      barcode: '8000500037560',
    },
  ],
}

const categoryCatalog = {
  categories: [
    { id: 'fruit-category', name: 'Frutta', sort_order: 20 },
    { id: 'dairy-category', name: 'Latticini', sort_order: 10 },
    { id: 'other-category', name: 'Altri prodotti', sort_order: 999 },
  ],
  generic_products: [
    { id: 'fruit', name: 'Mele', category_id: 'fruit-category', canonical_unit: 'pz' },
    { id: 'dairy', name: 'Latte', category_id: 'dairy-category', canonical_unit: 'L' },
  ],
  shopping_list_items: [
    {
      id: 'fruit-item',
      list_id: '20000000-0000-4000-8000-000000000001',
      name: 'Mele',
      unit: 'pz',
      generic_product_id: 'fruit',
      created_at: '2026-11-14T12:00:00Z',
    },
    {
      id: 'milk-item',
      list_id: '20000000-0000-4000-8000-000000000001',
      name: 'Latte',
      unit: 'L',
      generic_product_id: 'dairy',
      created_at: '2026-11-14T12:00:00Z',
    },
  ],
  list_item_contributions: [
    {
      id: 'fruit-contribution',
      item_id: 'fruit-item',
      origin_type: 'manual',
      origin_id: 'fruit-item',
      requested_quantity: '2',
    },
    {
      id: 'milk-contribution',
      item_id: 'milk-item',
      origin_type: 'manual',
      origin_id: 'milk-item',
      requested_quantity: '1',
    },
  ],
}

test('categorie: trascinamento mouse, persistenza e ordine dei gruppi nella spesa', async ({ page }) => {
  const { categoryOrderRequests } = await login(page, false, categoryCatalog)
  await page.goto('/liste')
  await expect(page.locator('.category-group h3')).toHaveText(['Latticini', 'Frutta'])
  await page.goto('/catalogo')
  await expect(page.locator('.category-order-name')).toHaveText([
    '1. Latticini',
    '2. Frutta',
    '3. Altri prodotti',
  ])
  const handle = page.getByRole('button', { name: 'Sposta categoria Frutta', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const target = page.locator('[data-category-id="dairy-category"]')
  await target.scrollIntoViewIfNeeded()
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 24, to.y + 24, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => categoryOrderRequests.length).toBe(1)
  await expect(
    page.getByText('Ordine salvato. La lista della spesa segue questo ordine.', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.category-order-name')).toHaveText([
    '1. Frutta',
    '2. Latticini',
    '3. Altri prodotti',
  ])
  await page.reload()
  await expect(page.locator('.category-order-name')).toHaveText([
    '1. Frutta',
    '2. Latticini',
    '3. Altri prodotti',
  ])
  await page.goto('/liste')
  await expect(page.locator('.category-group h3')).toHaveText(['Frutta', 'Latticini'])
})

test('categorie: trascinamento touch e annullamento senza salvataggio', async ({ page, context }) => {
  const { categoryOrderRequests } = await login(page, false, categoryCatalog)
  await page.goto('/catalogo')
  const first = page.locator('[data-category-id="dairy-category"]')
  await first.scrollIntoViewIfNeeded()
  const from = (await page
    .getByRole('button', { name: 'Sposta categoria Frutta', exact: true })
    .boundingBox())!
  const to = (await first.boundingBox())!
  const session = await context.newCDPSession(page)
  const point = (x: number, y: number) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }]
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from.x + 22, from.y + 22),
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: point(to.x + 24, to.y + 24),
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(page.getByText('Spostamento annullato.', { exact: true })).toBeVisible()
  expect(categoryOrderRequests).toHaveLength(0)
  await expect(page.locator('.category-order-name').first()).toHaveText('1. Latticini')
  const newFrom = (await page
    .getByRole('button', { name: 'Sposta categoria Frutta', exact: true })
    .boundingBox())!
  const newTo = (await first.boundingBox())!
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(newFrom.x + 22, newFrom.y + 22),
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: point(newTo.x + 24, newTo.y + 24),
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => categoryOrderRequests.length).toBe(1)
  await expect(page.locator('.category-order-name').first()).toHaveText('1. Frutta')
})

test('categorie: tastiera e frecce, errore conserva ordine precedente, offline blocca', async ({
  page,
  context,
}) => {
  const { categoryOrderRequests } = await login(page, false, categoryCatalog)
  await page.goto('/catalogo')
  await page.getByRole('button', { name: 'Sposta categoria Frutta', exact: true }).focus()
  await page.keyboard.press('ArrowUp')
  await expect.poll(() => categoryOrderRequests.length).toBe(1)
  await expect(page.locator('.category-order-name').first()).toHaveText('1. Frutta')
  await expect(page.getByRole('button', { name: 'Sposta categoria Frutta', exact: true })).toBeEnabled()
  await page.route('**/rest/v1/rpc/reorder_categories', (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: 'P0001',
        message: 'Conflitto: le categorie sono cambiate. Ricarica le categorie e riprova.',
      },
    }),
  )
  await page.getByRole('button', { name: 'Sposta Frutta giù', exact: true }).click()
  await expect(page.getByText('Ordine non salvato.', { exact: false })).toBeVisible()
  await expect(page.locator('.category-order-name').first()).toHaveText('1. Frutta')
  await context.setOffline(true)
  await expect(page.getByRole('button', { name: 'Sposta categoria Frutta', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Sposta Frutta giù', exact: true })).toBeDisabled()
})

const scannedProduct = {
  barcode: '8000500037560',
  name: 'Latte parzialmente scremato',
  brand: 'Abit',
  size: '1',
  unit: 'L',
  categories: ['en:milks'],
  sourceUrl: 'https://world.openfoodfacts.org/product/8000500037560',
}

test('barcode: compila campi modificabili e salva solo dopo conferma', async ({ page }) => {
  const { catalogSaveRequests } = await login(page, false, {
    categories: [{ id: 'milk-category', name: 'Latticini', sort_order: 0 }],
  })
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: scannedProduct } }))
  await page.goto('/catalogo')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill(scannedProduct.barcode)
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue(scannedProduct.name)
  await expect(page.getByLabel('Marca (facoltativa)', { exact: true })).toHaveValue('Abit')
  await expect(page.getByRole('combobox', { name: 'Categoria', exact: true })).toHaveValue('milk-category')
  await expect(page.getByLabel('Quantità per confezione', { exact: true })).toHaveValue('1')
  expect(catalogSaveRequests).toHaveLength(0)
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte corretto')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect.poll(() => catalogSaveRequests.length).toBe(1)
  expect(catalogSaveRequests[0]).toMatchObject({
    p_name: 'Latte corretto',
    p_brand: 'Abit',
    p_unit: 'L',
    p_quantity: '1',
  })
})

test('barcode: conserva il testo scritto fino a conferma della sostituzione', async ({ page }) => {
  await login(page)
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: scannedProduct } }))
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Nome scritto a mano')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill(scannedProduct.barcode)
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(page.getByRole('button', { name: 'Usa dati trovati' })).toBeVisible()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('Nome scritto a mano')
  await page.getByRole('button', { name: 'Usa dati trovati' }).click()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue(scannedProduct.name)
})

test('barcode: apre un prodotto già presente senza interrogare la banca dati', async ({ page }) => {
  const { catalogSaveRequests } = await login(page, false, productCatalog)
  let requests = 0
  await page.route('**/api/products/*', (route) => {
    requests++
    return route.fulfill({ json: { product: null } })
  })
  await page.goto('/catalogo')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill(scannedProduct.barcode)
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await page.getByRole('button', { name: 'Apri scheda esistente' }).click()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('Farina fine')
  expect(requests).toBe(0)
  expect(catalogSaveRequests).toHaveLength(0)
})

test('barcode: dati parziali e servizio indisponibile mantengono inserimento manuale', async ({ page }) => {
  await login(page)
  await page.route('**/api/products/*', (route) =>
    route.fulfill({
      json: { product: { ...scannedProduct, name: '', brand: '', size: '', unit: '', categories: [] } },
    }),
  )
  await page.goto('/catalogo')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill(scannedProduct.barcode)
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(page.getByText('Nome da inserire manualmente.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Nome manuale')
  await page.route('**/api/products/*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Indisponibile' } }),
  )
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(page.getByText('Ricerca non disponibile.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('Nome manuale')
})

test('barcode: una risposta in ritardo non sovrascrive un EAN cambiato', async ({ page }) => {
  await login(page)
  let respond!: () => void
  const response = new Promise<void>((resolve) => {
    respond = resolve
  })
  await page.route('**/api/products/*', async (route) => {
    await response
    await route.fulfill({ json: { product: scannedProduct } })
  })
  await page.goto('/catalogo')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill(scannedProduct.barcode)
  const requested = page.waitForRequest('**/api/products/*')
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await requested
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('96385074')
  respond()
  await expect(page.getByText('Il campo EAN è cambiato', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('')
})

for (const native of [true, false]) {
  test(`barcode fotocamera: ${native ? 'lettore nativo' : 'decodifica ZXing reale'} e arresto stream`, async ({
    page,
  }) => {
    await login(page)
    await page.addInitScript(
      ({ native, code }) => {
        const left = [
          '0001101',
          '0011001',
          '0010011',
          '0111101',
          '0100011',
          '0110001',
          '0101111',
          '0111011',
          '0110111',
          '0001011',
        ]
        const alternate = [
          '0100111',
          '0110011',
          '0011011',
          '0100001',
          '0011101',
          '0111001',
          '0000101',
          '0010001',
          '0001001',
          '0010111',
        ]
        const parity = [
          'LLLLLL',
          'LLGLGG',
          'LLGGLG',
          'LLGGGL',
          'LGLLGG',
          'LGGLLG',
          'LGGGLL',
          'LGLGLG',
          'LGLGGL',
          'LGGLGL',
        ][Number(code[0])]
        let bits = '101'
        for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? left : alternate)[Number(code[i])]
        bits += '01010'
        for (let i = 7; i < 13; i++)
          bits += left[Number(code[i])]
            .split('')
            .map((bit) => (bit === '1' ? '0' : '1'))
            .join('')
        bits += '101'
        Object.defineProperty(window, 'BarcodeDetector', {
          configurable: true,
          value: native
            ? class {
                detect() {
                  return Promise.resolve([{ rawValue: code }])
                }
              }
            : undefined,
        })
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: async () => {
            const canvas = document.createElement('canvas')
            canvas.width = 500
            canvas.height = 220
            const ctx = canvas.getContext('2d')!
            const paint = () => {
              ctx.fillStyle = 'white'
              ctx.fillRect(0, 0, 500, 220)
              ctx.fillStyle = 'black'
              for (let i = 0; i < bits.length; i++) if (bits[i] === '1') ctx.fillRect(40 + i * 4, 25, 4, 160)
            }
            paint()
            const stream = canvas.captureStream(10)
            const interval = setInterval(paint, 100)
            const state = window as unknown as { cameraStopped: boolean }
            state.cameraStopped = false
            for (const track of stream.getTracks()) {
              const stop = track.stop.bind(track)
              track.stop = () => {
                state.cameraStopped = true
                clearInterval(interval)
                stop()
              }
            }
            return stream
          },
        })
      },
      { native, code: scannedProduct.barcode },
    )
    await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: scannedProduct } }))
    await page.goto('/scanner')
    await page.getByRole('button', { name: 'Scansiona barcode' }).click()
    await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue(scannedProduct.name, {
      timeout: 20000,
    })
    expect(await page.evaluate(() => (window as unknown as { cameraStopped: boolean }).cameraStopped)).toBe(
      true,
    )
  })
}

test('catalogo unico: salva con solo il nome, senza formato o campi obbligatori aggiuntivi', async ({
  page,
}) => {
  const { catalogSaveRequests } = await login(page)
  await page.goto('/catalogo')
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto', exact: true })).toBeVisible()
  await expect(page.getByLabel('Marca (facoltativa)', { exact: true })).not.toHaveAttribute('required', '')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte parzialmente scremato')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('Latte parzialmente scremato')
  await expect(page.locator('tbody tr')).toContainText('Formato non indicato')
  expect(catalogSaveRequests[0]).toMatchObject({
    p_name: 'Latte parzialmente scremato',
    p_brand: '',
    p_barcode: null,
    p_quantity: null,
    p_unit: null,
  })
})

test('catalogo unico: nome, categoria, marca ed EAN senza creare una seconda scheda', async ({ page }) => {
  const { catalogSaveRequests } = await login(page, false, {
    categories: [{ id: 'milk-category', name: 'Latticini', sort_order: 0 }],
  })
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte parzialmente scremato')
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('milk-category')
  await page.getByLabel('Marca (facoltativa)', { exact: true }).fill('Abit')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('96385074')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('Abit')
  await expect(page.locator('tbody tr')).toContainText('Latticini')
  expect(catalogSaveRequests[0]).toMatchObject({
    p_category: 'milk-category',
    p_brand: 'Abit',
    p_barcode: '96385074',
    p_quantity: null,
  })
  await page.goto('/prezzi')
  await expect(
    page.getByRole('combobox', { name: 'Prodotto', exact: true }).locator('option[value="new-product-0"]'),
  ).toHaveCount(1)
})

test('catalogo unico: aggiunta successiva del formato e rimozione dei dettagli facoltativi', async ({
  page,
}) => {
  const { catalogSaveRequests } = await login(page, false, {
    generic_products: [
      { id: 'group', name: 'Latte', canonical_unit: null, is_catalog_group: true, category_id: null },
    ],
    specific_products: [
      {
        id: 'card',
        name: 'Latte',
        generic_product_id: 'group',
        brand: 'Abit',
        barcode: null,
        variant: '',
        package_quantity: null,
        package_unit: null,
      },
    ],
  })
  await page.goto('/catalogo')
  await page.locator('tbody tr').getByRole('button', { name: 'Modifica', exact: true }).click()
  await page.getByText('Formato della confezione (facoltativo)', { exact: true }).click()
  await page.getByLabel('Quantità per confezione', { exact: true }).fill('1')
  await page.getByRole('combobox', { name: 'Unità del formato', exact: true }).selectOption('L')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('1 L')
  await page.locator('tbody tr').getByRole('button', { name: 'Modifica', exact: true }).click()
  await page.getByLabel('Marca (facoltativa)', { exact: true }).fill('')
  await page.getByLabel('Quantità per confezione', { exact: true }).fill('')
  await page.getByRole('combobox', { name: 'Unità del formato', exact: true }).selectOption('')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  expect(catalogSaveRequests[1]).toMatchObject({
    p_id: 'card',
    p_specific: true,
    p_brand: '',
    p_quantity: null,
    p_unit: null,
  })
})

test('catalogo unico: EAN errato e formato incompleto non inviano salvataggi', async ({ page }) => {
  const { catalogSaveRequests } = await login(page)
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('12345678')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'checksum' })).toBeVisible()
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('')
  await page.getByText('Formato della confezione (facoltativo)', { exact: true }).click()
  await page.getByLabel('Quantità per confezione', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'completa quantità' })).toBeVisible()
  expect(catalogSaveRequests).toHaveLength(0)
})

test('lista: un solo prodotto senza formato, con quantità modificabile e senza separazione dei tipi', async ({
  page,
}) => {
  const { itemRequests } = await login(page, true, {
    generic_products: [
      { id: 'group', name: 'Latte', canonical_unit: null, is_catalog_group: true, category_id: null },
    ],
    specific_products: [
      {
        id: 'card',
        name: 'Latte',
        generic_product_id: 'group',
        brand: 'Abit',
        barcode: null,
        variant: '',
        package_quantity: null,
        package_unit: null,
      },
    ],
  })
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  const select = page.getByRole('combobox', { name: /Prodotto.*facoltativo/ })
  await expect(select.locator('option')).toHaveCount(2)
  await expect(select.locator('optgroup')).toHaveCount(0)
  await select.selectOption('card')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  expect(itemRequests[0]).toMatchObject({ p_specific: 'card', p_quantity: '1', p_unit: 'pz' })
})

test('lista: il prodotto senza marca permette il confronto tra le marche disponibili', async ({ page }) => {
  const { itemRequests } = await login(page, true, {
    generic_products: [
      { id: 'group', name: 'Latte', canonical_unit: null, is_catalog_group: true, category_id: null },
    ],
    specific_products: [
      {
        id: 'card',
        name: 'Latte',
        generic_product_id: 'group',
        brand: '',
        barcode: null,
        variant: '',
        package_quantity: null,
        package_unit: null,
      },
    ],
  })
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await page.getByRole('combobox', { name: /Prodotto.*facoltativo/ }).selectOption('card')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item').filter({ hasText: 'Latte' })).toHaveCount(2)
  expect(itemRequests[0]).toMatchObject({
    p_generic: 'group',
    p_specific: null,
    p_quantity: '1',
    p_unit: 'pz',
  })
})

test('catalogo: ordine alfabetico automatico senza selettore', async ({ page }) => {
  await login(page, false, productCatalog)
  await page.goto('/catalogo')
  const names = page.locator('tbody tr td:first-child')
  await expect(names).toHaveText(['Farina 00', /Farina fine/, 'Latte intero'])
  await expect(page.getByRole('columnheader', { name: 'Prodotto', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await expect(page.getByLabel('Ordina prodotti', { exact: true })).toHaveCount(0)
  await page.getByLabel('Cerca prodotto, marca o barcode').fill('farina')
  await expect(names).toHaveText(['Farina 00', /Farina fine/])
})

test('catalogo: ordinamento alfabetico anche per i prodotti archiviati', async ({ page }) => {
  await login(page, false, {
    generic_products: [
      ...productCatalog.generic_products,
      {
        id: 'archived-generic',
        name: 'zucchine',
        canonical_unit: 'g',
        category_id: null,
        archived_at: '2026-11-14T12:00:00Z',
      },
    ],
    specific_products: [
      ...productCatalog.specific_products,
      {
        ...productCatalog.specific_products[0],
        id: 'archived-specific',
        name: 'Ananas',
        archived_at: '2026-11-14T12:00:00Z',
      },
    ],
  })
  await page.goto('/catalogo')
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  const names = page.locator('tbody tr td:first-child')
  await expect(names).toHaveText([/Ananas/, 'zucchine'])
  await expect(page.getByLabel('Ordina prodotti', { exact: true })).toHaveCount(0)
})

test('catalogo: elimina generico e commerciale inutilizzati e chiude la modifica', async ({ page }) => {
  const { catalogDeleteRequests } = await login(page, false, productCatalog)
  await page.goto('/catalogo')
  page.on('dialog', (dialog) => dialog.accept())
  const generic = page.getByRole('row', { name: /^Latte intero/ })
  await generic.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Modifica prodotto' })).toBeVisible()
  await generic.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(generic).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto' })).toBeVisible()
  const specific = page.getByRole('row', { name: /^Farina fine/ })
  await specific.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Modifica prodotto' })).toBeVisible()
  await specific.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(specific).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Prodotto eliminato dal catalogo.' })).toBeVisible()
  expect(catalogDeleteRequests).toEqual([
    { table: 'generic_products', id: 'generic-milk' },
    { table: 'specific_products', id: 'specific-flour' },
  ])
})
test('catalogo: annullare la conferma conserva il prodotto senza inviare DELETE', async ({ page }) => {
  const { catalogDeleteRequests } = await login(page, false, productCatalog)
  await page.goto('/catalogo')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Latte intero')
    await dialog.dismiss()
  })
  const row = page.getByRole('row', { name: /^Latte intero/ })
  await row.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(row).toBeVisible()
  expect(catalogDeleteRequests).toHaveLength(0)
})
for (const { table, rowName } of [
  { table: 'generic_products', rowName: /^Farina 00/ },
  { table: 'specific_products', rowName: /^Farina fine/ },
]) {
  test(`catalogo: ${table} in uso resta visibile con un messaggio comprensibile`, async ({ page }) => {
    await login(page, false, productCatalog)
    await page.route(`**/rest/v1/${table}?*`, async (route) => {
      if (route.request().method() === 'DELETE')
        await route.fulfill({
          status: 409,
          json: { code: '23503', message: 'foreign key constraint fixture_private_detail' },
        })
      else await route.fallback()
    })
    await page.goto('/catalogo')
    page.once('dialog', (dialog) => dialog.accept())
    const row = page.getByRole('row', { name: rowName })
    await row.getByRole('button', { name: 'Elimina', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Prodotto in uso:' })).toBeVisible()
    await expect(row).toBeVisible()
    await expect(page.getByText('fixture_private_detail', { exact: false })).toHaveCount(0)
  })
}

test('catalogo vuoto esplicito e articolo libero obbligatorio', async ({ page }) => {
  const { itemRequests } = await login(page, true)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await expect(page.getByText('Il catalogo è vuoto.', { exact: false })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Prodotto.*facoltativo/ })).toBeDisabled()
  const name = page.getByLabel('Nome per articolo libero')
  await expect(name).toHaveAttribute('required', '')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  expect(await name.evaluate((input) => input.matches(':invalid'))).toBe(true)
  expect(itemRequests).toHaveLength(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page
    .getByRole('form', { name: 'Aggiungi un articolo alla lista' })
    .screenshot({ path: `test-results/add-item-empty-${test.info().project.name}.png` })
})
test('prodotto commerciale: quantità del formato, unità e riferimento corretti, reset dopo salvataggio', async ({
  page,
}) => {
  const { itemRequests } = await login(page, true, productCatalog)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  const product = page.getByRole('combobox', { name: /Prodotto.*facoltativo/ })
  await product.selectOption('specific-flour')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('g')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('500')
  await expect(page.getByLabel('Nome per articolo libero')).toHaveCount(0)
  const accessibility = await new AxeBuilder({ page })
    .include('form[aria-label="Aggiungi un articolo alla lista"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page
    .getByRole('form', { name: 'Aggiungi un articolo alla lista' })
    .screenshot({ path: `test-results/add-item-product-${test.info().project.name}.png` })
  await page.getByLabel('Quantità', { exact: true }).fill('750')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Farina fine', { exact: true })).toBeVisible()
  expect(itemRequests[0]).toMatchObject({
    p_name: 'Farina fine',
    p_specific: 'specific-flour',
    p_generic: null,
    p_unit: 'g',
    p_quantity: '750',
  })
  await expect(product).toHaveValue('')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('pz')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1')
  await expect(page.getByLabel('Nome per articolo libero')).toHaveValue('')
})
test('generico: unità coerenti e conversione della quantità prima del salvataggio', async ({ page }) => {
  const { itemRequests } = await login(page, true, productCatalog)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await page.getByRole('combobox', { name: /Prodotto.*facoltativo/ }).selectOption('generic-milk')
  const unit = page.getByLabel('Unità', { exact: true })
  await expect(unit).toHaveValue('L')
  await expect(unit.getByRole('option', { name: 'g', exact: true })).toHaveCount(0)
  await unit.selectOption('ml')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1000')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(
    page.locator('.shopping-item .item-text').getByText('Latte intero', { exact: true }),
  ).toBeVisible()
  expect(itemRequests[0]).toMatchObject({
    p_name: 'Latte intero',
    p_specific: null,
    p_generic: 'generic-milk',
    p_unit: 'ml',
    p_quantity: '1000',
  })
})
test('ricerca per marca e codice, nessuna selezione nascosta quando il filtro cambia', async ({ page }) => {
  await login(page, true, productCatalog)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  const product = page.getByRole('combobox', { name: /Prodotto.*facoltativo/ })
  const search = page.getByLabel('Cerca nel catalogo')
  await product.selectOption('generic-milk')
  await search.fill('Molino')
  await expect(product).toHaveValue('')
  await expect(product.getByRole('option', { name: /Farina fine/ })).toHaveCount(1)
  await search.fill('8000500037560')
  await product.selectOption('specific-flour')
  await search.fill('senza corrispondenze')
  await expect(product).toHaveValue('')
  await expect(page.getByText('Nessun prodotto trovato.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nome per articolo libero')).toHaveAttribute('required', '')
})
test('errore di salvataggio conserva prodotto, quantità e ricerca per riprovare', async ({ page }) => {
  await login(page, true, productCatalog)
  let fail = true
  await page.route('**/rest/v1/rpc/add_list_item', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({
        status: 503,
        json: { message: 'Errore temporaneo di test', code: 'fixture_error' },
      })
    } else await route.fallback()
  })
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await page.getByLabel('Cerca nel catalogo').fill('Molino')
  const product = page.getByRole('combobox', { name: /Prodotto.*facoltativo/ })
  await product.selectOption('specific-flour')
  await page.getByLabel('Quantità', { exact: true }).fill('750')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Operazione non riuscita' })).toBeVisible()
  await expect(product).toHaveValue('specific-flour')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('750')
  await expect(page.getByLabel('Cerca nel catalogo')).toHaveValue('Molino')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Farina fine', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Cerca nel catalogo')).toHaveValue('')
})
test('accesso senza sessione e layout responsive', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bentornato a casa.' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('dashboard vuota reale e navigazione', async ({ page }) => {
  await login(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Le cose buone iniziano da qui.' })).toBeVisible()
  await expect(page.getByText('La lista è vuota')).toBeVisible()
  await expect(page.getByText('0,00 €', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('link', { name: 'Organizza la spesa' }).click()
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  await expect(page.getByLabel('Titolo della lista')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Crea lista', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Duplica', exact: true })).toHaveCount(0)
  await expect(page.locator('.bottom-nav a[href="/catalogo"]')).toHaveText('Catalogo')
  await expect(page.locator('.bottom-nav a[href="/liste"]')).toHaveCount(0)
  await page.getByRole('link', { name: 'Catalogo', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Il vostro catalogo.' })).toBeVisible()
})
test('Salvato scompare dopo quattro secondi e resta nascosto cambiando sezione', async ({ page }) => {
  await login(page, true)
  await page.clock.install()
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await page.getByLabel('Nome per articolo libero').fill('Pane')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.notice')).toHaveText('Salvato.')
  await page.clock.fastForward(4_000)
  await expect(page.locator('.notice')).toHaveCount(0)
  await page.locator('nav').getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Le cose buone iniziano da qui.' })).toBeVisible()
  await expect(page.locator('.notice')).toHaveCount(0)
})

test('lista unica: primo accesso idempotente, nessuna creazione aggiuntiva al refresh', async ({ page }) => {
  const { ensureListRequests } = await login(page, false, { shopping_lists: [] })
  await page.goto('/liste')
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  expect(ensureListRequests).toHaveLength(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  expect(ensureListRequests).toHaveLength(1)
})

test('lista unica: vecchi collegamenti aprono la stessa lista e mantengono gli articoli', async ({
  page,
}) => {
  await login(page, true)
  await page.goto('/liste/vecchia-lista')
  await expect(page.getByRole('button', { name: 'Registra acquisto Latte' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Segna lista completata' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Confronta prezzi →', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Lista', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Confronta la tua spesa' })).toBeVisible()
})

test('un secondo salvataggio rinnova la durata della conferma', async ({ page }) => {
  await login(page, true)
  await page.clock.install()
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await page.getByLabel('Nome per articolo libero').fill('Pane')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.notice')).toHaveText('Salvato.')
  await page.clock.fastForward(3_000)
  await page.getByLabel('Nome per articolo libero').fill('Mele')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Mele', { exact: true })).toBeVisible()
  await expect(page.locator('.notice')).toHaveText('Salvato.')
  await page.clock.fastForward(1_500)
  await expect(page.locator('.notice')).toHaveText('Salvato.')
  await page.clock.fastForward(2_500)
  await expect(page.locator('.notice')).toHaveCount(0)
})

test('aggiunta articolo e acquisto parziale senza prezzo', async ({ page }) => {
  await login(page, true)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  await page.getByLabel('Nome per articolo libero').fill('Pane')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Pane', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Registra acquisto Latte' }).click()
  await page.getByLabel('Quantità effettiva (L)', { exact: true }).fill('0,5')
  await page.getByRole('button', { name: 'Conferma acquisto' }).click()
  await expect(page.getByText('Prezzo non registrato', { exact: false })).toBeVisible()
  await expect(page.getByText(/1.5 L da acquistare/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('scanner manuale, checksum e nessun salvataggio implicito', async ({ page }) => {
  const { catalogSaveRequests } = await login(page)
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: null } }))
  await page.goto('/scanner')
  await page.getByLabel('Barcode manuale').fill('12345678')
  await page.getByRole('button', { name: 'Cerca e compila prodotto' }).click()
  await expect(page.getByText('Il checksum EAN non è valido.', { exact: false })).toBeVisible()
  await page.getByLabel('Barcode manuale').fill('8000500037560')
  await page.getByRole('button', { name: 'Cerca e compila prodotto' }).click()
  await expect(page.getByText('Prodotto non trovato nella banca dati.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true })).toHaveValue('8000500037560')
  expect(catalogSaveRequests).toHaveLength(0)
})
test('offline informa e blocca salvataggio', async ({ page, context }) => {
  await login(page)
  await page.goto('/liste')
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText('Sei offline. Le modifiche richiedono una connessione.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aggiungi', exact: true })).toBeDisabled()
})
test('accessibilità essenziale della dashboard', async ({ page }) => {
  await login(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Le cose buone iniziano da qui.' })).toBeVisible()
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([])
})
test('categoria già usata: eliminazione conserva i prodotti sotto Altri prodotti', async ({ page }) => {
  await login(page, false, {
    ...productCatalog,
    categories: [{ id: 'category', name: 'Dispensa', sort_order: 0 }],
    generic_products: [{ ...productCatalog.generic_products[0], category_id: 'category' }],
  })
  await page.goto('/catalogo')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Elimina categoria Dispensa', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Elimina categoria Dispensa', exact: true })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'Latte intero' })).toContainText('Altri prodotti')
})

test('prodotti archiviati: scompaiono dalle scelte e possono essere ripristinati', async ({ page }) => {
  await login(page, true, productCatalog)
  await page.goto('/catalogo')
  page.on('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('row')
    .filter({ hasText: 'Latte intero' })
    .getByRole('button', { name: 'Archivia', exact: true })
    .click()
  await expect(page.getByRole('row').filter({ hasText: 'Latte intero' })).toHaveCount(0)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await expect(
    page.getByRole('combobox', { name: /Prodotto.*facoltativo/ }).locator('option[value="generic-milk"]'),
  ).toHaveCount(0)
  await page.goto('/catalogo')
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  await page
    .getByRole('row')
    .filter({ hasText: 'Latte intero' })
    .getByRole('button', { name: 'Ripristina', exact: true })
    .click()
  await page.getByLabel('Mostra archiviati', { exact: true }).uncheck()
  await expect(page.getByRole('row').filter({ hasText: 'Latte intero' })).toBeVisible()
})

test('punti vendita: eliminazione definitiva, archiviazione e ripristino', async ({ page }) => {
  await login(page, false, {
    stores: [
      { id: 'store', name: 'Negozio Test', chain: '', address: 'Via Test', city: 'Roma', archived_at: null },
    ],
  })
  await page.goto('/negozi')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Archivia', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Negozio Test', exact: true })).toHaveCount(0)
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await page.getByLabel('Mostra archiviati', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Negozio Test', exact: true })).toHaveCount(0)
})

test('articolo con storico: archiviazione dalla lista e ripristino', async ({ page }) => {
  await login(page, true)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Archivia', exact: true }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(0)
  await page.getByLabel('Mostra articoli archiviati').check()
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText('Latte')
})

test('previsioni salvate: archiviazione ripristinabile mantiene importi', async ({ page }) => {
  await login(page, true, {
    price_estimate_snapshots: [
      {
        id: 'snapshot',
        list_id: '20000000-0000-4000-8000-000000000001',
        store_id: 'store',
        estimated_total: '12.34',
        coverage: 1,
        shopping_date: '2026-11-14',
        created_at: '2026-11-14T12:00:00Z',
        detail_json: {},
        archived_at: null,
      },
    ],
  })
  await page.goto('/statistiche')
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('details').last().locator('summary').click()
  await expect(page.locator('details').last()).toContainText('12,34')
  await page.getByRole('button', { name: 'Archivia', exact: true }).click()
  await expect(page.locator('details')).toHaveCount(0)
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  await page.locator('details').last().locator('summary').click()
  await expect(page.locator('details').last()).toContainText('12,34')
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await page.getByLabel('Mostra archiviati', { exact: true }).uncheck()
  await expect(page.locator('details')).toHaveCount(1)
})

test('ricette: rimozione ingrediente, archiviazione e ripristino', async ({ page }) => {
  await login(page, false, {
    ...productCatalog,
    recipes: [
      {
        id: 'recipe',
        title: 'Ricetta Test',
        base_servings: 2,
        instructions: 'Mescola',
        notes: '',
        is_favorite: false,
        source_url: null,
      },
    ],
    recipe_ingredients: [
      {
        id: 'ingredient',
        recipe_id: 'recipe',
        generic_product_id: 'generic-flour',
        quantity: '200',
        unit: 'g',
      },
    ],
  })
  await page.goto('/ricette')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Apri ricetta →', exact: true }).click()
  await page.getByRole('button', { name: 'Rimuovi ingrediente', exact: true }).click()
  await expect(page.locator('.ingredients li')).toHaveCount(0)
  await page.getByRole('button', { name: 'Archivia', exact: true }).click()
  await expect(page.locator('.recipe-card')).toHaveCount(0)
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  await page.getByRole('button', { name: 'Apri ricetta →', exact: true }).click()
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await page.getByLabel('Mostra archiviati', { exact: true }).uncheck()
  await expect(page.locator('.recipe-card')).toContainText('Ricetta Test')
})

test('piano settimanale archiviato nasconde il calendario ed è ripristinabile', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') })
  await login(page, false, {
    meal_plans: [
      { id: 'plan', week_start: '2026-11-16', linked_list_id: null, version: 1, archived_at: null },
    ],
  })
  await page.goto('/pasti')
  page.on('dialog', (dialog) => dialog.accept())
  await expect(page.locator('.week-grid')).toBeVisible()
  await page.getByRole('button', { name: 'Archivia', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Piano settimanale archiviato', exact: true })).toBeVisible()
  await expect(page.locator('.week-grid')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Crea piano settimanale/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await expect(page.locator('.week-grid')).toBeVisible()
})

test('sconti: una regola configurata può essere eliminata', async ({ page }) => {
  await login(page, false, {
    store_discount_rules: [
      { id: 'rule', name: 'Sconto Test', percentage: '10', active: true, confirmed: true, store_id: 'store' },
    ],
  })
  await page.goto('/prezzi')
  page.on('dialog', (dialog) => dialog.accept())
  const row = page.locator('.data-row').filter({ hasText: 'Sconto Test' })
  await row.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(row).toHaveCount(0)
})

test('permesso fotocamera negato offre inserimento manuale', async ({ page }) => {
  await login(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'BarcodeDetector', {
      value: class {
        detect() {
          return Promise.resolve([])
        }
      },
    })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
    })
  })
  await page.goto('/scanner')
  await page.getByRole('button', { name: 'Scansiona barcode' }).click()
  await expect(
    page.getByText('Fotocamera non disponibile o permesso negato.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Barcode manuale')).toBeVisible()
})
