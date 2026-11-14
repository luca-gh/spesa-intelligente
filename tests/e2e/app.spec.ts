import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Browser-only fixtures. PostgreSQL authorization is tested independently, not mocked here as proof of RLS.
async function login(page: Page, populated = false) {
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
  }
  await page.route('https://fixture.supabase.test/**', async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()!
    let result: unknown
    if (table === 'households') result = home
    else if (table === 'add_list_item') {
      const body = route.request().postDataJSON()
      items.push({
        id: 'item-new',
        list_id: body.p_list,
        name: body.p_name,
        unit: body.p_unit,
        generic_product_id: null,
        specific_product_id: null,
        note: '',
        created_at: '2026-11-14T13:00:00Z',
      })
      contributions.push({
        id: 'new-manual',
        item_id: 'item-new',
        origin_type: 'manual',
        origin_id: 'item-new',
        requested_quantity: body.p_quantity,
      })
      result = 'item-new'
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
}
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
