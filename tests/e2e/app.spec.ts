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
    shopping_lists: populated ? [list] : [],
    shopping_list_items: items,
    list_item_contributions: contributions,
    purchases,
    ...structuredClone(catalog),
  }
  const itemRequests: Record<string, unknown>[] = []
  const catalogDeleteRequests: { table: string; id: string }[] = []
  await page.route('https://fixture.supabase.test/**', async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()!
    let result: unknown
    if (table === 'households') result = home
    else if (table === 'add_list_item') {
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
    } else if (
      ['generic_products', 'specific_products'].includes(table) &&
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
  return { itemRequests, catalogDeleteRequests }
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

test('catalogo: elimina generico e commerciale inutilizzati e chiude la modifica', async ({ page }) => {
  const { catalogDeleteRequests } = await login(page, false, productCatalog)
  await page.goto('/catalogo')
  page.on('dialog', (dialog) => dialog.accept())
  const generic = page.getByRole('row', { name: /^Latte intero Generico/ })
  await generic.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Modifica prodotto generico' })).toBeVisible()
  await generic.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(generic).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto generico' })).toBeVisible()
  const specific = page.getByRole('row', { name: /^Farina fine/ })
  await specific.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Modifica prodotto commerciale' })).toBeVisible()
  await specific.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(specific).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto commerciale' })).toBeVisible()
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
  const row = page.getByRole('row', { name: /^Latte intero Generico/ })
  await row.getByRole('button', { name: 'Elimina', exact: true }).click()
  await expect(row).toBeVisible()
  expect(catalogDeleteRequests).toHaveLength(0)
})
for (const { table, rowName } of [
  { table: 'generic_products', rowName: /^Farina 00 Generico/ },
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
  await expect(page.getByText('La prima lista vi aspetta')).toBeVisible()
  await expect(page.getByText('0,00 €', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('link', { name: 'Organizza la spesa' }).click()
  await page.getByLabel('Titolo della lista').fill('Lista creata nel browser')
  await page.getByRole('button', { name: 'Crea lista', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Lista creata nel browser' })).toBeVisible()
})
test('aggiunta articolo e acquisto parziale senza prezzo', async ({ page }) => {
  await login(page, true)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Spesa di test' })).toBeVisible()
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
  await login(page)
  await page.goto('/scanner')
  await page.getByLabel('Barcode manuale').fill('12345678')
  await page.getByRole('button', { name: 'Cerca e conferma codice' }).click()
  await expect(page.getByText('Il checksum EAN non è valido.', { exact: false })).toBeVisible()
  await page.getByLabel('Barcode manuale').fill('8000500037560')
  await page.getByRole('button', { name: 'Cerca e conferma codice' }).click()
  await expect(page.getByText('Barcode valido, prodotto assente', { exact: false })).toBeVisible()
})
test('offline informa e blocca salvataggio', async ({ page, context }) => {
  await login(page)
  await page.goto('/liste')
  await expect(page.getByRole('heading', { name: 'Le vostre liste.' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText('Sei offline. Le modifiche richiedono una connessione.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crea lista', exact: true })).toBeDisabled()
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
  await page.getByRole('button', { name: 'Apri fotocamera' }).click()
  await expect(
    page.getByText('Fotocamera non disponibile o permesso negato.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Barcode manuale')).toBeVisible()
})
