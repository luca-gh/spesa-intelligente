import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('prezzi sfusi: nuovo prodotto con prezzo iniziale e prezzo al pezzo', async ({ page }) => {
  const { priceRequests, catalogSaveRequests } = await login(page, false, {
    stores: [{ id: 's', name: 'Negozio' }],
  })
  await page.goto('/catalogo')
  await expect(
    page.getByRole('combobox', { name: 'Unità del formato', exact: true }).locator('option'),
  ).toHaveText(['Non indicata', 'g', 'ml', 'pz'])
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Uova')
  await page.getByLabel('Quantità per confezione', { exact: true }).fill('6')
  await page.getByRole('combobox', { name: 'Unità del formato', exact: true }).selectOption('pz')
  await page
    .getByRole('combobox', { name: 'Supermercato del prezzo iniziale', exact: true })
    .selectOption('s')
  const amount = page.getByRole('textbox', { name: 'Prezzo iniziale (€)', exact: true })
  await amount.fill('3.00')
  await expect(amount).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  expect(catalogSaveRequests).toHaveLength(0)
  await amount.fill('3,00')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  const row = page.getByRole('row', { name: /^Uova/ })
  await expect(row).toContainText(/0,50\s*€\/pz/)
  expect(priceRequests[0]).toMatchObject({ p_amount: '3.00', p_basis: 'package', p_store: 's' })
  await row.getByRole('button', { name: 'Prezzi', exact: true }).click()
  await page
    .getByRole('row', { name: 'Prezzo presso Negozio', exact: true })
    .getByRole('button', { name: 'Modifica prezzo', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true }).fill('4,20')
  await expect(page.getByRole('status').filter({ hasText: 'Prezzo al kg/l/pz' })).toContainText(
    /0,70\s*€\/pz/,
  )
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect(row).toContainText(/0,70\s*€\/pz/)
})

test('prezzi sfusi: €/kg senza formato, quantità esatta e modifica in €/l', async ({ page }) => {
  const { priceRequests, itemRequests } = await login(page, false, { stores: [{ id: 's', name: 'Negozio' }] })
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Affettato')
  await page
    .getByRole('combobox', { name: 'Supermercato del prezzo iniziale', exact: true })
    .selectOption('s')
  await page.getByRole('combobox', { name: 'Tipo di prezzo', exact: true }).selectOption('kg')
  await page.getByRole('textbox', { name: 'Prezzo iniziale (€)', exact: true }).fill('20,00')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  const row = page.getByRole('row', { name: /^Affettato/ })
  await expect(row.locator('td').nth(3).locator('dd')).toContainText(/20,00\s*€\/kg/)
  await expect(row.locator('td').nth(3).locator('small')).toHaveText(/20,00\s*€\/kg/)
  await page.goto('/liste')
  await chooseListProduct(page, 'Affettato')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('kg')
  await page.getByLabel('Unità', { exact: true }).selectOption('g')
  await page.getByLabel('Quantità', { exact: true }).fill('150')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item .item-prices')).toContainText(/3,00\s*€/)
  expect(itemRequests[0]).toMatchObject({ p_quantity: '150', p_unit: 'g' })
  await page.goto('/catalogo')
  await row.getByRole('button', { name: 'Prezzi', exact: true }).click()
  await page
    .getByRole('row', { name: 'Prezzo presso Negozio', exact: true })
    .getByRole('button', { name: 'Modifica prezzo', exact: true })
    .click()
  await expect(page.getByRole('combobox', { name: 'Tipo di prezzo', exact: true })).toHaveValue('kg')
  await page.getByRole('combobox', { name: 'Tipo di prezzo', exact: true }).selectOption('l')
  await page.getByRole('textbox', { name: 'Prezzo al litro (€)', exact: true }).fill('4,00')
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  expect(priceRequests.at(-1)).toMatchObject({ p_amount: '4.00', p_basis: 'l' })
  await page.reload()
  await expect(row.locator('td').nth(3).locator('dd')).toContainText(/4,00\s*€\/l/)
  await page.goto('/liste')
  await chooseListProduct(page, 'Affettato')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('L')
  await expect(page.getByLabel('Unità', { exact: true }).locator('option')).toHaveText(['ml', 'l'])
})

test('prezzi sfusi: errore salvataggio mantiene prodotto e prezzo nel modulo', async ({ page }) => {
  const { catalogSaveRequests } = await login(page, false, { stores: [{ id: 's', name: 'Negozio' }] })
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Da salvare')
  await page.getByRole('textbox', { name: 'Prezzo iniziale (€)', exact: true }).fill('2,50')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'completa supermercato e importo' })).toBeVisible()
  expect(catalogSaveRequests).toHaveLength(0)
  await page
    .getByRole('combobox', { name: 'Supermercato del prezzo iniziale', exact: true })
    .selectOption('s')
  await page.route('**/rpc/create_catalog_product_with_price', (route) =>
    route.fulfill({ status: 503, json: { message: 'Servizio temporaneamente non disponibile' } }),
  )
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Operazione non riuscita' })).toBeVisible()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('Da salvare')
  await expect(page.getByRole('textbox', { name: 'Prezzo iniziale (€)', exact: true })).toHaveValue('2,50')
  expect(catalogSaveRequests).toHaveLength(0)
  await expect(page.locator('tbody tr')).toHaveCount(0)
})

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
  const recipeSaveRequests: Record<string, unknown>[] = []
  const recipeAddRequests: Record<string, unknown>[] = []
  const planRequests: Record<string, unknown>[] = []
  const mealRequests: Record<string, unknown>[] = []
  const itemRequests: Record<string, unknown>[] = []
  const priceRequests: Record<string, unknown>[] = []
  const purchaseRequests: Record<string, unknown>[] = []
  const completionRequests: Record<string, unknown>[] = []
  const discountRequests: Record<string, unknown>[] = []
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
    else if (table === 'save_catalog_product' || table === 'create_catalog_product_with_price') {
      const request = route.request().postDataJSON()
      const body = table === 'create_catalog_product_with_price' ? request.p_product : request
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
      if (table === 'create_catalog_product_with_price') {
        priceRequests.push(request)
        ;(collections.product_prices ??= []).push({
          specific_product_id: specific.id,
          store_id: request.p_store,
          price_amount: request.p_amount,
          price_basis: request.p_basis,
        })
      }
    } else if (table === 'delete_catalog_product') {
      const { p_id, p_specific } = route.request().postDataJSON()
      const table = p_specific ? 'specific_products' : 'generic_products'
      catalogDeleteRequests.push({ table, id: p_id })
      const records = collections[table] as Record<string, unknown>[]
      const selected = records.find((r) => r.id === p_id)
      const specifics = (collections.specific_products ?? []) as Record<string, unknown>[]
      const group = p_specific ? selected?.generic_product_id : p_id
      const deletedSpecifics = new Set(
        p_specific ? [p_id] : specifics.filter((r) => r.generic_product_id === group).map((r) => r.id),
      )
      const deleteGroup =
        group && !specifics.some((r) => r.generic_product_id === group && !deletedSpecifics.has(r.id))
      collections.specific_products = specifics.filter((r) => !deletedSpecifics.has(r.id))
      collections.generic_products = (collections.generic_products as Record<string, unknown>[]).filter(
        (r) => !(deleteGroup && r.id === group),
      )
      const deletedItems = new Set(
        ((collections.shopping_list_items ?? []) as Record<string, unknown>[])
          .filter(
            (r) =>
              deletedSpecifics.has(r.specific_product_id) || (deleteGroup && r.generic_product_id === group),
          )
          .map((r) => r.id),
      )
      for (const target of [
        'shopping_list_items',
        'purchases',
        'price_observations',
        'product_prices',
        'list_item_contributions',
        'recipe_ingredients',
        'meal_entries',
      ])
        collections[target] = ((collections[target] ?? []) as Record<string, unknown>[]).filter(
          (r) =>
            !deletedSpecifics.has(r.specific_product_id) &&
            !(deleteGroup && r.generic_product_id === group) &&
            !deletedItems.has(r.id) &&
            !deletedItems.has(r.list_item_id) &&
            !deletedItems.has(r.item_id),
        )
      result = null
    } else if (table === 'add_list_item' || table === 'add_shopping_product') {
      const body = route.request().postDataJSON()
      itemRequests.push(body)
      const id = `item-new-${collections.shopping_list_items.length + 1}`
      ;(collections.shopping_list_items as Record<string, unknown>[]).push({
        id,
        list_id: body.p_list,
        name: body.p_name,
        unit: body.p_unit,
        generic_product_id: body.p_generic,
        specific_product_id: body.p_specific,
        note: '',
        preferred_brand: body.p_brand ?? null,
        preferred_package_quantity: body.p_package_quantity ?? null,
        preferred_package_unit: body.p_package_unit ?? null,
        created_at: '2026-11-14T13:00:00Z',
      })
      ;(collections.list_item_contributions as Record<string, unknown>[]).push({
        id: id + '-manual',
        item_id: id,
        origin_type: 'manual',
        origin_id: id,
        requested_quantity: body.p_quantity,
      })
      result = id
    } else if (table === 'update_manual_item') {
      const body = route.request().postDataJSON()
      const contribution = (collections.list_item_contributions as Record<string, unknown>[]).find(
        (c) => c.item_id === body.p_item && c.origin_type === 'manual',
      )
      if (contribution) contribution.requested_quantity = body.p_quantity
      const item = (collections.shopping_list_items as Record<string, unknown>[]).find(
        (i) => i.id === body.p_item,
      )
      if (item) item.note = body.p_note
      result = null
    } else if (table === 'record_purchase') {
      const body = route.request().postDataJSON()
      purchaseRequests.push(body)
      collections.purchases.push({
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
    } else if (table === 'complete_purchase_price') {
      const body = route.request().postDataJSON()
      completionRequests.push(body)
      const purchase = (collections.purchases as Record<string, unknown>[]).find((p) => p.id === body.p_id)
      if (purchase) purchase.total_paid = body.p_total
      result = null
    } else if (table === 'set_product_price' || table === 'set_product_price_basis') {
      const body = route.request().postDataJSON()
      priceRequests.push(body)
      const prices = (collections.product_prices ??= []) as Record<string, unknown>[]
      const previous = prices.find(
        (p) => p.specific_product_id === body.p_product && p.store_id === body.p_store,
      )
      if (previous) {
        previous.price_amount = body.p_amount
        previous.price_basis = body.p_basis ?? 'package'
      } else
        prices.push({
          specific_product_id: body.p_product,
          store_id: body.p_store,
          price_amount: body.p_amount,
          ...(body.p_basis ? { price_basis: body.p_basis } : {}),
        })
      result = null
    } else if (table === 'clear_product_price') {
      const body = route.request().postDataJSON()
      collections.product_prices = ((collections.product_prices ?? []) as Record<string, unknown>[]).filter(
        (p) => !(p.specific_product_id === body.p_product && p.store_id === body.p_store),
      )
      result = null
    } else if (table === 'add_price' || table === 'correct_catalog_price') {
      const body = route.request().postDataJSON()
      priceRequests.push(body)
      const previous = (collections.price_observations as Record<string, unknown>[] | undefined)?.find(
        (p) => p.id === body.p_id,
      )
      if (previous) previous.voided_at = '2026-11-23T12:00:00Z'
      ;(collections.price_observations ??= []).push({
        id: `price-${priceRequests.length}`,
        specific_product_id: previous?.specific_product_id ?? body.p_product,
        store_id: previous?.store_id ?? body.p_store,
        price_amount: body.p_amount,
        kind: body.p_kind,
        observed_at: body.p_observed,
        created_at: new Date(Date.now() + priceRequests.length).toISOString(),
        voided_at: null,
      })
      result = null
    } else if (table === 'store_discount_rules' && ['POST', 'PATCH'].includes(route.request().method())) {
      const body = route.request().postDataJSON()
      discountRequests.push(body)
      const rules = (collections.store_discount_rules ??= []) as Record<string, unknown>[]
      const rule = rules.find((r) => r.id === url.searchParams.get('id')?.replace(/^eq\./, ''))
      if (rule) Object.assign(rule, body)
      else rules.push({ id: `rule-${rules.length}`, active: true, ...body })
      result = rule ?? rules.at(-1)
    } else if (table === 'stores' && route.request().method() === 'PATCH') {
      const store = (collections.stores as Record<string, unknown>[]).find(
        (s) => s.id === url.searchParams.get('id')?.replace(/^eq\./, ''),
      )!
      Object.assign(store, route.request().postDataJSON())
      result = store
    } else if (table === 'recipe_ingredient_alternatives' && route.request().method() === 'POST') {
      result = {
        id: 'alternative-new-' + (collections.recipe_ingredient_alternatives ?? []).length,
        ...route.request().postDataJSON(),
      }
      ;(collections.recipe_ingredient_alternatives ??= []).push(result)
    } else if (table === 'add_recipe_choices_to_list') {
      const body = route.request().postDataJSON()
      recipeAddRequests.push(body)
      const recipe = (collections.recipes as Record<string, unknown>[]).find((r) => r.id === body.p_recipe)!
      for (const ingredient of (collections.recipe_ingredients as Record<string, unknown>[]).filter(
        (i) => i.recipe_id === body.p_recipe,
      )) {
        const productId = body.p_choices[ingredient.id as string] ?? ingredient.generic_product_id
        const product = (collections.generic_products as Record<string, unknown>[]).find(
          (p) => p.id === productId,
        )!
        const id = 'recipe-item-' + collections.shopping_list_items.length
        collections.shopping_list_items.push({
          id,
          list_id: body.p_list,
          name: product.name,
          generic_product_id: productId,
          specific_product_id: null,
          unit: ingredient.unit,
          note: '',
          created_at: '2026-11-23',
        })
        collections.list_item_contributions.push({
          id: 'c-' + id,
          item_id: id,
          origin_type: 'recipe',
          origin_id: body.p_operation,
          requested_quantity: String(
            (Number(ingredient.quantity) * body.p_servings) / Number(recipe.base_servings),
          ),
        })
      }
      result = null
    } else if (table === 'save_recipe') {
      const body = route.request().postDataJSON()
      recipeSaveRequests.push(body)
      const id = `recipe-new-${recipeSaveRequests.length}`
      ;(collections.recipes ??= []).push({
        id,
        title: body.p_title,
        base_servings: body.p_servings,
        instructions: body.p_instructions,
        is_favorite: false,
      })
      for (const [index, ingredient] of body.p_ingredients.entries()) {
        ;(collections.recipe_ingredients ??= []).push({
          id: `${id}-${index}`,
          recipe_id: id,
          generic_product_id: ingredient.product_id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })
        for (const [n, product] of (ingredient.alternatives ?? []).entries())
          (collections.recipe_ingredient_alternatives ??= []).push({
            id: `${id}-${index}-alt-${n}`,
            ingredient_id: `${id}-${index}`,
            generic_product_id: product,
          })
      }
      result = id
    } else if (table === 'meal_entries' && route.request().method() === 'PATCH') {
      const meal = (collections.meal_entries as Record<string, unknown>[]).find(
        (m) => m.id === url.searchParams.get('id')?.replace(/^eq\./, ''),
      )!
      Object.assign(meal, route.request().postDataJSON())
      const plan = (collections.meal_plans as Record<string, unknown>[]).find(
        (p) => p.id === meal.meal_plan_id,
      )!
      plan.version = Number(plan.version) + 1
      result = meal
    } else if (table === 'apply_plan_diff') {
      const body = route.request().postDataJSON()
      planRequests.push(body)
      const items = collections.shopping_list_items as Record<string, unknown>[]
      collections.list_item_contributions = (
        collections.list_item_contributions as Record<string, unknown>[]
      ).filter(
        (c) =>
          !(
            c.origin_type === 'plan' &&
            c.origin_id === body.p_plan &&
            items.some((i) => i.id === c.item_id && i.list_id === body.p_list)
          ),
      )
      for (const row of body.p_rows) {
        let item = items.find(
          (i) => i.list_id === body.p_list && i.generic_product_id === row.product_id && i.unit === row.unit,
        )
        if (!item) {
          const product = (collections.generic_products as Record<string, unknown>[]).find(
            (g) => g.id === row.product_id,
          )!
          item = {
            id: `plan-item-${items.length}`,
            list_id: body.p_list,
            generic_product_id: row.product_id,
            specific_product_id: null,
            unit: row.unit,
            name: product.name,
            note: '',
            created_at: '2026-11-23',
          }
          items.push(item)
        }
        collections.list_item_contributions.push({
          id: 'plan-' + item.id,
          item_id: item.id,
          origin_type: 'plan',
          origin_id: body.p_plan,
          requested_quantity: row.quantity,
        })
      }
      list.version++
      result = null
    } else if (table === 'meal_entries' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      mealRequests.push(body)
      const entry = { id: `meal-new-${mealRequests.length}`, ...body }
      ;(collections.meal_entries ??= []).push(entry)
      result = entry
    } else if (table === 'meal_plans' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      const plan = {
        id: `new-plan-${(collections.meal_plans ?? []).length}`,
        version: 1,
        archived_at: null,
        ...body,
      }
      ;(collections.meal_plans ??= []).push(plan)
      result = plan
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
    } else if (table === 'void_price') {
      const { p_id } = route.request().postDataJSON()
      const price = (collections.price_observations as Record<string, unknown>[]).find((p) => p.id === p_id)
      if (price) price.voided_at = '2026-11-23T12:00:00Z'
      result = null
    } else if (table === 'reorder_store_categories') {
      const body = route.request().postDataJSON()
      categoryOrderRequests.push(body)
      for (const entry of (collections.store_category_order ?? []) as {
        store_id: string
        category_id: string
        sort_order: number
      }[])
        if (entry.store_id === body.p_store) entry.sort_order = body.p_ids.indexOf(entry.category_id)
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
        'recipe_ingredient_alternatives',
        'meal_templates',
        'meal_entries',
        'meal_plans',
      ].includes(table) &&
      route.request().method() === 'DELETE'
    ) {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '') ?? ''
      catalogDeleteRequests.push({ table, id })
      const records = collections[table] as { id: string }[]
      const index = records.findIndex((record) => record.id === id)
      result = index >= 0 ? records.splice(index, 1)[0] : null
      if (table === 'meal_plans')
        collections.meal_entries = ((collections.meal_entries ?? []) as { meal_plan_id: string }[]).filter(
          (entry) => entry.meal_plan_id !== id,
        )
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
    collections,
    priceRequests,
    purchaseRequests,
    completionRequests,
    discountRequests,
    itemRequests,
    catalogDeleteRequests,
    catalogSaveRequests,
    ensureListRequests,
    categoryOrderRequests,
    recipeSaveRequests,
    recipeAddRequests,
    planRequests,
    mealRequests,
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

const spreadCatalog = {
  generic_products: [
    {
      id: 'spread-g',
      name: 'Crema spalmabile',
      canonical_unit: 'g',
      category_id: null,
      is_catalog_group: true,
    },
  ],
  specific_products: [
    {
      id: 'nut-small',
      generic_product_id: 'spread-g',
      name: 'Crema spalmabile',
      brand: 'Nutella',
      variant: '',
      barcode: null,
      package_quantity: '400',
      package_unit: 'g',
    },
    {
      id: 'nut-big',
      generic_product_id: 'spread-g',
      name: 'Crema spalmabile',
      brand: 'Nutella',
      variant: '',
      barcode: null,
      package_quantity: '750',
      package_unit: 'g',
    },
    {
      id: 'private',
      generic_product_id: 'spread-g',
      name: 'Crema spalmabile',
      brand: 'Altra marca',
      variant: '',
      barcode: null,
      package_quantity: '400',
      package_unit: 'g',
    },
  ],
  stores: [
    { id: 'a', name: 'Negozio A' },
    { id: 'b', name: 'Negozio B' },
    { id: 'c', name: 'Negozio C' },
    { id: 'hidden', name: 'Negozio archiviato', archived_at: '2026-11-23' },
  ],
  product_prices: [
    { specific_product_id: 'nut-small', store_id: 'a', price_amount: '4.00' },
    { specific_product_id: 'nut-small', store_id: 'b', price_amount: '5.00' },
    { specific_product_id: 'nut-big', store_id: 'a', price_amount: '6.00' },
    { specific_product_id: 'private', store_id: 'a', price_amount: '1.00' },
    { specific_product_id: 'private', store_id: 'b', price_amount: '0.50' },
    { specific_product_id: 'private', store_id: 'c', price_amount: '0.40' },
  ],
}

test('catalogo categorie: menu alfabetico indipendente dall’ordine delle corsie', async ({ page }) => {
  const { collections } = await login(page, false, {
    categories: [
      { id: 'z', name: 'Zucchero', sort_order: 0 },
      { id: 'f', name: 'Frutta', sort_order: 1 },
      { id: 'a', name: 'Acqua', sort_order: 2 },
    ],
  })
  await page.goto('/catalogo')
  await expect(page.getByLabel('Categoria', { exact: true }).locator('option')).toHaveText([
    'Acqua',
    'Altri prodotti',
    'Frutta',
    'Zucchero',
  ])
  expect((collections.categories as { name: string }[]).map((c) => c.name)).toEqual([
    'Zucchero',
    'Frutta',
    'Acqua',
  ])
})

test('prezzi marche: prodotto generico mostra ogni marca e ogni negozio con totale senza doppioni', async ({
  page,
}) => {
  await login(page, false, spreadCatalog)
  await page.goto('/liste')
  await chooseListProduct(page, 'Crema spalmabile', 'Crema spalmabile')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  const article = page.getByRole('article', { name: 'Crema spalmabile', exact: true })
  const nutella = article.getByRole('region', { name: 'Marca Nutella', exact: true })
  const other = article.getByRole('region', { name: 'Marca Altra marca', exact: true })
  await expect(nutella.locator('dt')).toHaveText(['Negozio A', 'Negozio B', 'Negozio C'])
  await expect(nutella.locator('.item-prices > div').filter({ hasText: 'Negozio A' })).toContainText(
    /4,00\s*€/,
  )
  await expect(
    nutella.locator('.item-prices > div').filter({ hasText: 'Negozio C' }).locator('dd'),
  ).toHaveText('-')
  await expect(other.locator('.item-prices > div').filter({ hasText: 'Negozio A' })).toContainText(/1,00\s*€/)
  await expect(other.locator('.item-prices > div').filter({ hasText: 'Negozio C' })).toContainText(/0,40\s*€/)
  const total = page
    .getByRole('table', { name: 'Confronto supermercati' })
    .getByRole('row')
    .filter({ hasText: 'Negozio A' })
  await expect(total).toContainText(/1,00\s*€/)
  await expect(total).not.toContainText(/5,00\s*€/)
  const accessibility = await new AxeBuilder({ page })
    .include('.brand-prices')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations.map((v) => v.id)).toEqual([])
  await article.screenshot({ path: `test-results/brands-${test.info().project.name}.png` })
})

const calendarCatalog = {
  generic_products: [
    { id: 'penne', name: 'Penne', canonical_unit: 'g', category_id: null },
    { id: 'fusilli', name: 'Fusilli', canonical_unit: 'g', category_id: null },
    { id: 'passata', name: 'Passata', canonical_unit: 'g', category_id: null },
  ],
  recipes: [
    {
      id: 'pasta',
      title: 'Pasta al sugo',
      base_servings: 2,
      instructions: 'Cuoci',
      notes: '',
      is_favorite: false,
    },
  ],
  recipe_ingredients: [
    { id: 'pasta-i', recipe_id: 'pasta', generic_product_id: 'penne', quantity: '200', unit: 'g' },
    { id: 'sauce-i', recipe_id: 'pasta', generic_product_id: 'passata', quantity: '100', unit: 'g' },
  ],
  recipe_ingredient_alternatives: [{ id: 'alt', ingredient_id: 'pasta-i', generic_product_id: 'fusilli' }],
  meal_plans: [{ id: 'plan', week_start: '2026-11-23', version: 1, archived_at: null }],
}

test('calendario spesa: tre pasti maiuscoli, testo libero persistente ed eliminabile senza prodotti inventati', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') })
  const { mealRequests, collections } = await login(page, false, {
    ...calendarCatalog,
    meal_entries: [
      {
        id: 'old-snack',
        meal_plan_id: 'plan',
        meal_date: '2026-11-23',
        meal_slot: 'spuntino',
        generic_product_id: 'penne',
        quantity: '1',
        unit: 'g',
        recipe_id: null,
      },
    ],
  })
  await page.goto('/pasti')
  await expect(page.getByLabel('Pasto', { exact: true }).locator('option')).toHaveText([
    'Colazione',
    'Pranzo',
    'Cena',
  ])
  await expect(page.locator('.meal-slot')).toHaveCount(21)
  await expect(page.getByText('Spuntino', { exact: false })).toHaveCount(0)
  await page.getByLabel('Testo libero', { exact: true }).check()
  await page.getByLabel('Descrizione del pasto', { exact: true }).fill('Cena fuori')
  await page.getByLabel('Pasto', { exact: true }).selectOption('cena')
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  await expect.poll(() => mealRequests.length).toBe(1)
  expect(mealRequests[0]).toMatchObject({
    free_text: 'Cena fuori',
    recipe_id: null,
    generic_product_id: null,
    quantity: null,
    unit: null,
    shopping_choices: {},
  })
  await page.reload()
  await page.getByRole('button', { name: 'Apri pasto Cena fuori · 2026-11-23 · Cena', exact: true }).click()
  await expect(
    page.getByText('Questo pasto a testo libero non aggiunge prodotti alla spesa.', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.meal-shopping-editor input[type="checkbox"]')).toHaveCount(0)
  expect(collections.shopping_list_items).toHaveLength(0)
  page.on('dialog', (d) => d.accept())
  await page
    .locator('.meal-chip')
    .filter({ hasText: 'Cena fuori' })
    .getByRole('button', { name: '×', exact: true })
    .click()
  await expect(page.getByRole('button', { name: /Apri pasto Cena fuori/ })).toHaveCount(0)
})

test('calendario spesa: apri ricetta, spunta solo ciò che manca, alternativa e lista senza duplicati', async ({
  page,
}) => {
  test.setTimeout(60000)
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') })
  const { planRequests, collections } = await login(page, false, calendarCatalog)
  await page.goto('/pasti')
  const component = page.getByRole('combobox', { name: 'Ricetta o alimento', exact: true })
  await component.fill('Pasta al sugo')
  await component.press('ArrowDown')
  await component.press('Enter')
  await page.getByLabel('Pasto', { exact: true }).selectOption('pranzo')
  await page.getByLabel('Persone (default 2)', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  const open = page.getByRole('button', {
    name: 'Apri pasto Pasta al sugo · 2026-11-23 · Pranzo',
    exact: true,
  })
  await open.click()
  const pasta = page.getByRole('checkbox', { name: 'Penne · 400 g', exact: true })
  await expect(pasta).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Passata · 200 g', exact: true })).not.toBeChecked()
  await pasta.check()
  await page.getByLabel('Alternativa per Penne', { exact: true }).selectOption('fusilli')
  const accessibility = await new AxeBuilder({ page })
    .include('.meal-shopping-editor')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([])
  await page
    .locator('.meal-shopping-editor')
    .screenshot({ path: `test-results/meal-selection-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Salva selezione e prepara lista', exact: true }).click()
  await expect(page.locator('.diff')).toContainText('Fusilli: 0 → 400')
  await expect(page.locator('.diff')).not.toContainText('Passata')
  await page.getByRole('button', { name: 'Conferma modifiche alla lista', exact: true }).click()
  await expect.poll(() => planRequests.length).toBe(1)
  expect(planRequests[0].p_rows).toEqual([{ product_id: 'fusilli', quantity: '400', unit: 'g' }])
  await page.reload()
  await open.click()
  await expect(pasta).toBeChecked()
  await expect(page.getByLabel('Alternativa per Penne', { exact: true })).toHaveValue('fusilli')
  await page.getByRole('button', { name: 'Salva selezione e prepara lista', exact: true }).click()
  await expect(page.locator('.diff')).toContainText('Nessuna differenza nelle quantità.')
  await page.getByRole('button', { name: 'Conferma modifiche alla lista', exact: true }).click()
  await expect.poll(() => planRequests.length).toBe(2)
  expect(collections.list_item_contributions).toHaveLength(1)
  await page.goto('/liste')
  await expect(page.getByRole('article', { name: 'Fusilli', exact: true })).toContainText('400 g')
  await expect(page.getByRole('article', { name: 'Passata', exact: true })).toHaveCount(0)
})

test('calendario spesa: alimento semplice, errore conserva le spunte e offline blocca il salvataggio', async ({
  page,
  context,
}) => {
  test.setTimeout(60000)
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') })
  const { planRequests, mealRequests } = await login(page, false, calendarCatalog)
  await page.goto('/pasti')
  const component = page.getByRole('combobox', { name: 'Ricetta o alimento', exact: true })
  await component.fill('Passata')
  await component.press('ArrowDown')
  await component.press('Enter')
  await page.getByLabel('Quantità per alimento semplice', { exact: true }).fill('50')
  await expect(page.getByRole('combobox', { name: 'Unità', exact: true })).toHaveValue('g')
  await page.getByRole('combobox', { name: 'Unità', exact: true }).selectOption('pz')
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  await expect(page.locator('.notice')).toContainText('Quantità non valida:')
  expect(mealRequests).toHaveLength(0)
  await page.getByRole('combobox', { name: 'Unità', exact: true }).selectOption('g')
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  await page.getByRole('button', { name: 'Apri pasto Passata · 2026-11-23 · Colazione', exact: true }).click()
  const food = page.getByRole('checkbox', { name: 'Passata · 50 g', exact: true })
  await food.check()
  let fail = true
  await page.route('**/rest/v1/meal_entries?*', async (route) => {
    if (route.request().method() === 'PATCH' && fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  const save = page.getByRole('button', { name: 'Salva selezione e prepara lista', exact: true })
  await save.click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(food).toBeChecked()
  await expect(page.locator('.diff')).toHaveCount(0)
  expect(planRequests).toHaveLength(0)
  await context.setOffline(true)
  await expect(save).toBeDisabled()
  await context.setOffline(false)
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.locator('.diff')).toContainText('Passata: 0 → 50')
  await page.getByRole('button', { name: 'Conferma modifiche alla lista', exact: true }).click()
  await expect.poll(() => planRequests.length).toBe(1)
  expect(planRequests[0].p_rows).toEqual([{ product_id: 'passata', quantity: '50', unit: 'g' }])
})

test('opzioni lista: ordinamento decrescente per negozio, categoria e prezzi assenti in fondo', async ({
  page,
}) => {
  await login(page, false, {
    categories: [
      { id: 'fruit', name: 'Frutta', sort_order: 0 },
      { id: 'dairy', name: 'Latticini', sort_order: 1 },
    ],
    generic_products: [
      { id: 'g1', name: 'Mele', category_id: 'fruit', canonical_unit: 'g', is_catalog_group: true },
      { id: 'g2', name: 'Latte', category_id: 'dairy', canonical_unit: 'ml', is_catalog_group: true },
    ],
    specific_products: [
      {
        id: 'p1',
        generic_product_id: 'g1',
        name: 'Mele',
        brand: '',
        package_quantity: '500',
        package_unit: 'g',
      },
      {
        id: 'p2',
        generic_product_id: 'g2',
        name: 'Latte',
        brand: '',
        package_quantity: '1000',
        package_unit: 'ml',
      },
    ],
    stores: [
      { id: 'a', name: 'Negozio A' },
      { id: 'b', name: 'Negozio B' },
    ],
    product_prices: [
      { specific_product_id: 'p1', store_id: 'a', price_amount: '2' },
      { specific_product_id: 'p2', store_id: 'a', price_amount: '4' },
      { specific_product_id: 'p1', store_id: 'b', price_amount: '6' },
      { specific_product_id: 'p2', store_id: 'b', price_amount: '1' },
    ],
  })
  await page.goto('/liste')
  for (const name of ['Mele', 'Latte']) {
    await chooseListProduct(page, name, name)
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  }
  await page.getByLabel('Nome per articolo libero', { exact: true }).fill('Sale')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByLabel('Ordina la lista').locator('option[value="price"]')).toBeDisabled()
  await page.getByLabel('Supermercato per la spesa', { exact: true }).selectOption('a')
  await page.getByLabel('Ordina la lista').selectOption('price')
  await expect(page.locator('.shopping-item .item-text strong')).toHaveText(['Latte', 'Mele', 'Sale'])
  await page.getByLabel('Supermercato per la spesa', { exact: true }).selectOption('b')
  await expect(page.locator('.shopping-item .item-text strong')).toHaveText(['Mele', 'Latte', 'Sale'])
  await page.getByLabel('Ordina la lista').selectOption('category')
  await expect(page.locator('.category-group > h3')).toHaveText(['Frutta', 'Latticini', 'Altri prodotti'])
})

test('opzioni lista: sconto PAM condiviso, reversibile, prezzi e kg coerenti senza alterare il prezzo salvato', async ({
  page,
}) => {
  test.setTimeout(60000)
  const { collections } = await login(page, false, {
    ...spreadCatalog,
    stores: [
      { id: 'a', name: 'PAM Centro', chain: 'PAM', pam_discount_enabled: false },
      { id: 'b', name: 'Negozio B' },
    ],
  })
  await page.goto('/catalogo')
  await page
    .locator('tr[data-product-id="nut-small"]')
    .getByRole('button', { name: 'Aggiungi alla lista', exact: true })
    .click()
  await page.goto('/liste')
  await page.getByLabel('Supermercato per la spesa', { exact: true }).selectOption('a')
  const toggle = page.getByRole('checkbox', { name: 'Calcola sconto PAM del 10% · PAM Centro', exact: true })
  await toggle.check()
  await expect(toggle).toBeChecked()
  const article = page.getByRole('article', { name: 'Crema spalmabile · Nutella', exact: true })
  await expect(article.locator('.item-prices > div').filter({ hasText: 'PAM Centro' })).toContainText(
    /3,60\s*€/,
  )
  await expect(
    article.locator('.item-prices > div').filter({ hasText: 'PAM Centro' }).locator('small'),
  ).toHaveText(/9,00\s*€\/kg/)
  await expect(
    page
      .getByRole('table', { name: 'Confronto supermercati' })
      .getByRole('row')
      .filter({ hasText: 'PAM Centro' }),
  ).toContainText(/3,60\s*€/)
  expect(collections.product_prices).toContainEqual({
    specific_product_id: 'nut-small',
    store_id: 'a',
    price_amount: '4.00',
  })
  await article.screenshot({ path: `test-results/pam-${test.info().project.name}.png` })
  await page.reload()
  await expect(toggle).toBeChecked()
  await page.goto('/catalogo')
  await expect(page.locator('tr[data-product-id="nut-small"] .catalog-store-prices')).toContainText(
    /3,60\s*€/,
  )
  await page.goto('/negozi')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await page.goto('/liste')
  await expect(article.locator('.item-prices > div').filter({ hasText: 'PAM Centro' })).toContainText(
    /4,00\s*€/,
  )
  await page.getByLabel('Supermercato per la spesa', { exact: true }).selectOption('b')
  await expect(toggle).toHaveCount(0)
})

test('alternative ricetta: crea penne oppure fusilli, scegli fusilli e rimuovi solo alternativa', async ({
  page,
}) => {
  test.setTimeout(60000)
  const { recipeSaveRequests, recipeAddRequests } = await login(page, false, {
    generic_products: [
      { id: 'penne', name: 'Penne', canonical_unit: 'g', category_id: null },
      { id: 'fusilli', name: 'Fusilli', canonical_unit: 'g', category_id: null },
      { id: 'passata', name: 'Passata di pomodoro', canonical_unit: 'g', category_id: null },
    ],
  })
  await page.goto('/ricette')
  await page.getByLabel('Titolo', { exact: true }).fill('Pasta al sugo')
  const select = async (label: string, value: string) => {
    const input = page.getByRole('combobox', { name: label, exact: true })
    await input.fill(value)
    await input.press('ArrowDown')
    await input.press('Enter')
  }
  await select('Ingrediente 1', 'Penne')
  await page.locator('input[name="quantity0"]').fill('200')
  await page.locator('select[name="unit0"]').selectOption('g')
  await page.getByRole('button', { name: 'Aggiungi alternativa', exact: true }).click()
  await select('Alternativa 1 per ingrediente 1', 'Fusilli')
  await page.getByRole('button', { name: 'Altro ingrediente', exact: true }).click()
  await select('Ingrediente 2', 'Passata')
  await page.locator('input[name="quantity1"]').fill('100')
  await page.locator('select[name="unit1"]').selectOption('g')
  await page.getByLabel('Procedimento', { exact: true }).fill('Cuoci la pasta e aggiungi la passata.')
  await page.getByRole('button', { name: 'Salva ricetta', exact: true }).click()
  await expect.poll(() => recipeSaveRequests.length).toBe(1)
  expect(recipeSaveRequests[0].p_ingredients).toEqual([
    { product_id: 'penne', quantity: '200', unit: 'g', alternatives: ['fusilli'] },
    { product_id: 'passata', quantity: '100', unit: 'g' },
  ])
  await page.reload()
  await page.getByRole('button', { name: 'Apri ricetta →', exact: true }).click()
  await expect(page.getByText('oppure Fusilli', { exact: true })).toBeVisible()
  await page.getByLabel('Usa per ingrediente Penne', { exact: true }).selectOption('fusilli')
  await page.getByRole('button', { name: 'Aggiungi ingredienti', exact: true }).click()
  await expect.poll(() => recipeAddRequests.length).toBe(1)
  expect(recipeAddRequests[0].p_choices).toMatchObject({ 'recipe-new-1-0': 'fusilli' })
  await page.getByRole('button', { name: 'Rimuovi alternativa', exact: true }).click()
  await expect(page.getByText('oppure Fusilli', { exact: true })).toHaveCount(0)
  await expect(page.locator('.ingredients li').first()).toContainText('Penne')
  await page.locator('.ingredients li').first().getByText('Gestisci alternative', { exact: true }).click()
  const alternative = page.getByRole('combobox', { name: 'Prodotto alternativo', exact: true }).first()
  await alternative.fill('Fusilli')
  await alternative.press('ArrowDown')
  await alternative.press('Enter')
  await page
    .locator('.ingredients li')
    .first()
    .getByRole('button', { name: 'Aggiungi alternativa', exact: true })
    .click()
  await expect(page.getByText('oppure Fusilli', { exact: true })).toBeVisible()
  const accessibility = await new AxeBuilder({ page })
    .include('.ingredients')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([])
  await page
    .locator('.ingredients')
    .screenshot({ path: `test-results/alternatives-${test.info().project.name}.png` })
  await page.goto('/liste')
  await expect(page.getByRole('article', { name: 'Fusilli', exact: true })).toContainText('200 g')
  await expect(page.getByRole('article', { name: 'Penne', exact: true })).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Passata di pomodoro', exact: true })).toBeVisible()
})

test('alternative ricetta: piano pasti usa una sola scelta e invalida l’anteprima quando cambia', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') })
  await login(page, false, {
    generic_products: [
      { id: 'penne', name: 'Penne', canonical_unit: 'g', category_id: null },
      { id: 'fusilli', name: 'Fusilli', canonical_unit: 'g', category_id: null },
    ],
    recipes: [
      { id: 'r', title: 'Pasta', base_servings: 2, instructions: 'Cuoci', notes: '', is_favorite: false },
    ],
    recipe_ingredients: [
      { id: 'i', recipe_id: 'r', generic_product_id: 'penne', quantity: '200', unit: 'g' },
    ],
    recipe_ingredient_alternatives: [{ id: 'alt', ingredient_id: 'i', generic_product_id: 'fusilli' }],
    meal_plans: [{ id: 'plan', week_start: '2026-11-23', version: 1, archived_at: null }],
    meal_entries: [
      {
        id: 'meal',
        meal_plan_id: 'plan',
        meal_date: '2026-11-23',
        meal_slot: 'pranzo',
        recipe_id: 'r',
        generic_product_id: null,
        servings_override: 4,
      },
    ],
  })
  const requests: Record<string, unknown>[] = []
  await page.route('**/rest/v1/rpc/apply_plan_diff', async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ json: null })
  })
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Apri pasto Pasta · 2026-11-23 · Pranzo', exact: true }).click()
  const choice = page.getByLabel('Alternativa per Penne', { exact: true })
  await choice.selectOption('fusilli')
  await page.getByRole('button', { name: 'Salva selezione e prepara lista', exact: true }).click()
  await expect(page.locator('.diff')).toContainText('Fusilli: 0 → 400')
  await expect(page.locator('.diff')).not.toContainText('Penne')
  await page.getByRole('button', { name: 'Apri pasto Pasta · 2026-11-23 · Pranzo', exact: true }).click()
  await expect(page.locator('.diff')).toHaveCount(0)
  await choice.selectOption('penne')
  await page.getByRole('button', { name: 'Salva selezione e prepara lista', exact: true }).click()
  await expect(page.locator('.diff')).toContainText('Penne: 0 → 400')
  await page.getByRole('button', { name: 'Conferma modifiche alla lista', exact: true }).click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].p_rows).toEqual([{ product_id: 'penne', quantity: '400', unit: 'g' }])
})

test('lista marca: cerca Nutella, salva nome e marca esatta senza imporre il formato', async ({ page }) => {
  const { itemRequests } = await login(page, false, spreadCatalog)
  await page.goto('/liste')
  await chooseListProduct(page, 'Crema spalmabile · Nutella', 'NUTEL')
  await expect(page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true })).toHaveValue(
    'Nutella',
  )
  await expect(page.getByRole('combobox', { name: 'Formato (facoltativo)', exact: true })).toHaveValue('')
  expect(itemRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
  expect(itemRequests[0]).toMatchObject({
    p_name: 'Crema spalmabile',
    p_generic: 'spread-g',
    p_specific: null,
    p_brand: 'Nutella',
    p_package_quantity: null,
    p_unit: 'conf',
  })
  const article = page.getByRole('article', { name: 'Crema spalmabile · Nutella', exact: true })
  await expect(article.locator('strong')).toHaveText('Crema spalmabile · Nutella')
  await expect(
    article.locator('.item-prices > div').filter({ hasText: 'Negozio A' }).locator('dd'),
  ).toHaveText(/4,00\s*€/)
  await expect(
    article.locator('.item-prices > div').filter({ hasText: 'Negozio B' }).locator('dd'),
  ).toHaveText(/5,00\s*€/)
  await expect(
    article.locator('.item-prices > div').filter({ hasText: 'Negozio C' }).locator('dd'),
  ).toHaveText('-')
  await expect(article.locator('.item-prices')).not.toContainText('Negozio archiviato')
  const accessibility = await new AxeBuilder({ page })
    .include('main.content')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({
    path: 'test-results/brand-prices-' + test.info().project.name + '.png',
    fullPage: true,
  })
  await page.reload()
  await expect(article.locator('strong')).toHaveText('Crema spalmabile · Nutella')
})

test('lista marca: cambio ricerca elimina la marca e un errore di salvataggio conserva la scelta', async ({
  page,
}) => {
  const { itemRequests } = await login(page, false, {
    ...spreadCatalog,
    generic_products: [
      ...spreadCatalog.generic_products,
      { id: 'milk-g', name: 'Latte', canonical_unit: null, category_id: null, is_catalog_group: true },
    ],
    specific_products: [
      ...spreadCatalog.specific_products,
      {
        id: 'milk',
        generic_product_id: 'milk-g',
        name: 'Latte',
        brand: '',
        variant: '',
        barcode: null,
        package_quantity: null,
        package_unit: null,
      },
    ],
  })
  await page.goto('/liste')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await product.fill('Nutella')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  expect(itemRequests).toHaveLength(0)
  await chooseListProduct(page, 'Crema spalmabile · Nutella', 'crema nut')
  await chooseListProduct(page, 'Latte', 'latte')
  await expect(page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
  expect(itemRequests[0]).toMatchObject({ p_generic: 'milk-g', p_brand: null })
  let fail = true
  await page.route('**/rest/v1/rpc/add_shopping_product', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  await chooseListProduct(page, 'Crema spalmabile · Nutella', 'nutella')
  await page.getByLabel('Quantità', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(product).toHaveValue('Crema spalmabile · Nutella')
  await expect(page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true })).toHaveValue(
    'Nutella',
  )
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('2')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(2)
  expect(itemRequests[1]).toMatchObject({ p_brand: 'Nutella', p_quantity: '2', p_package_quantity: null })
  await expect(product).toHaveValue('')
})

test('lista prezzi: totali e prezzi articolo si aggiornano con quantità, rimozione e ripristino', async ({
  page,
}) => {
  await login(page, false, {
    ...spreadCatalog,
    shopping_list_items: [
      {
        id: 'spread',
        list_id: '20000000-0000-4000-8000-000000000001',
        name: 'Crema spalmabile',
        generic_product_id: 'spread-g',
        specific_product_id: null,
        preferred_brand: 'Nutella',
        unit: 'conf',
        note: '',
      },
    ],
    list_item_contributions: [
      {
        id: 'manual-spread',
        item_id: 'spread',
        origin_type: 'manual',
        origin_id: 'spread',
        requested_quantity: '1',
      },
    ],
  })
  await page.goto('/liste')
  const summary = page.getByRole('table', { name: 'Confronto supermercati', exact: true })
  const totalA = summary.getByRole('row').filter({ hasText: 'Negozio A' }).getByRole('cell').nth(1)
  await expect(totalA).toHaveText(/4,00\s*€/)
  const article = page.getByRole('article', { name: 'Crema spalmabile · Nutella', exact: true })
  await article.getByRole('button', { name: 'Modifica quantità', exact: true }).click()
  await article.getByLabel('Quantità manuale', { exact: true }).fill('2')
  await article.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(totalA).toHaveText(/8,00\s*€/)
  await expect(
    article.locator('.item-prices > div').filter({ hasText: 'Negozio B' }).locator('dd'),
  ).toHaveText(/10,00\s*€/)
  await page.getByLabel('Nome per articolo libero').fill('Sale sfuso')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(summary.getByRole('row').filter({ hasText: 'Negozio A' })).toContainText('1/2')
  await expect(totalA).toContainText('Parziale')
  await page.getByLabel('Filtra articoli', { exact: true }).fill('Nutella')
  await expect(article).toBeVisible()
  await expect(page.getByRole('article', { name: 'Sale sfuso', exact: true })).toHaveCount(0)
  await expect(summary.getByRole('row').filter({ hasText: 'Negozio A' })).toContainText('1/2')
  await page.getByLabel('Filtra articoli', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Rimuovi dalla lista Crema spalmabile', exact: true }).click()
  await expect(totalA).toContainText('-')
  await page.getByLabel('Mostra articoli rimossi', { exact: true }).check()
  await page
    .locator('.data-row')
    .filter({ hasText: 'Crema spalmabile · Nutella' })
    .getByRole('button', { name: 'Rimetti nella lista', exact: true })
    .click()
  await expect(totalA).toContainText(/8,00\s*€/)
  await expect(article).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })).toHaveCount(0)
})

test('catalogo prezzi: riepilogo negozi, virgola, calcolo kg e sostituzione del prezzo attuale', async ({
  page,
}) => {
  const { priceRequests, collections } = await login(page, false, {
    ...productCatalog,
    stores: [
      { id: 'store', name: 'Negozio test' },
      { id: 'empty-store', name: 'Altro negozio' },
    ],
  })
  await page.goto('/catalogo')
  await page
    .getByRole('row', { name: /^Farina fine/ })
    .getByRole('button', { name: 'Prezzi', exact: true })
    .click()
  const row = page.getByRole('row', { name: 'Prezzo presso Negozio test', exact: true })
  const missing = page.getByRole('row', { name: 'Prezzo presso Altro negozio', exact: true })
  await expect(missing.getByRole('cell').nth(1)).toHaveText('-')
  await row.getByRole('button', { name: 'Inserisci prezzo', exact: true }).click()
  const price = page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })
  await price.fill('2.50')
  await expect(price).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('usa la virgola')
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  expect(priceRequests).toHaveLength(0)
  await price.fill('2,50')
  const accessibility = await new AxeBuilder({ page })
    .include('.product-prices')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((node) => node.target) })),
  ).toEqual([])
  await expect(page.getByRole('status').filter({ hasText: 'Prezzo al kg/l' })).toContainText(/5,00\s*€\/kg/)
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(1)
  expect(priceRequests[0]).toMatchObject({ p_amount: '2.50', p_product: 'specific-flour', p_store: 'store' })
  await expect(row.getByRole('cell').nth(1)).toContainText(/2,50\s*€/)
  await expect(missing.getByRole('cell').nth(1)).toHaveText('-')
  await row.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  await price.fill('0')
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(2)
  expect(priceRequests[1].p_amount).toBe('0.00')
  expect(collections.product_prices).toHaveLength(1)
  expect(Object.keys(priceRequests[1]).sort()).toEqual(['p_amount', 'p_product', 'p_store'])
  await expect(page.getByText('Storico prezzi del prodotto')).toHaveCount(0)
  await expect(page.getByLabel('Data rilevazione')).toHaveCount(0)
  await expect(page.getByLabel('Tipo di prezzo accertato')).toHaveCount(0)
})

test('catalogo prezzi: modifica recuperabile, calcolo litro e rimozione senza ritorno del prezzo precedente', async ({
  page,
}) => {
  const { priceRequests, collections } = await login(page, false, {
    generic_products: [
      { id: 'g', name: 'Latte', canonical_unit: 'ml', category_id: null, is_catalog_group: true },
    ],
    specific_products: [
      {
        id: 'milk',
        generic_product_id: 'g',
        name: 'Latte',
        brand: 'A',
        package_quantity: '750',
        package_unit: 'ml',
        variant: '',
        barcode: null,
      },
    ],
    stores: [{ id: 'store', name: 'Negozio' }],
    product_prices: [{ specific_product_id: 'milk', store_id: 'store', price_amount: '1.50' }],
  })
  let fail = true
  await page.route('**/rest/v1/rpc/set_product_price', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  await page.goto('/catalogo')
  await page
    .getByRole('row', { name: /^Latte/ })
    .getByRole('button', { name: 'Prezzi', exact: true })
    .click()
  await page.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  const price = page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })
  await expect(price).toHaveValue('1,50')
  await price.fill('9,00')
  await page.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  await expect(price).toHaveValue('1,50')
  await expect(price).toBeFocused()
  await price.fill('1,20')
  await expect(page.getByRole('status').filter({ hasText: 'Prezzo al kg/l' })).toContainText(/1,60\s*€\/l/)
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(price).toHaveValue('1,20')
  await page.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(1)
  expect(priceRequests[0]).toMatchObject({ p_product: 'milk', p_store: 'store', p_amount: '1.20' })
  expect(collections.product_prices).toHaveLength(1)
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  await page.getByRole('button', { name: 'Rimuovi prezzo', exact: true }).click()
  await expect(
    page.getByRole('row', { name: 'Prezzo presso Negozio', exact: true }).getByRole('cell').nth(1),
  ).toHaveText('-')
  expect(collections.product_prices).toHaveLength(0)
  await expect(price).toHaveCount(0)
})

test('catalogo prezzi: formato sconosciuto mostra trattino, editor lista solo su richiesta', async ({
  page,
}) => {
  await login(page, true, {
    ...productCatalog,
    specific_products: productCatalog.specific_products.map((p) => ({
      ...p,
      package_quantity: null,
      package_unit: null,
    })),
    stores: [{ id: 's', name: 'Negozio' }],
  })
  await page.goto('/catalogo')
  await page
    .getByRole('row', { name: /^Farina fine/ })
    .getByRole('button', { name: 'Prezzi', exact: true })
    .click()
  await page.getByRole('button', { name: 'Inserisci prezzo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true }).fill('2,50')
  await expect(page.getByRole('status').filter({ hasText: 'Prezzo al kg/l' })).toContainText('-')
  await page.goto('/liste')
  await expect(
    page.getByRole('button', { name: /Registra acquisto|Conferma acquisto|Inizia la spesa/ }),
  ).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /pagato|Prezzo|Lordo/ })).toHaveCount(0)
  await page.goto('/prezzi')
  await expect(page.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })).toHaveCount(0)
})

test('catalogo prezzi: colonne ordinate, supermercati impilati e aggiunta diretta del prodotto esatto', async ({
  page,
}) => {
  const { itemRequests, priceRequests } = await login(page, false, spreadCatalog)
  await page.goto('/catalogo')
  const table = page.getByRole('region', { name: 'Prodotti del catalogo', exact: true })
  await expect(table.getByRole('columnheader')).toHaveText([
    'Prodotto',
    'Marca',
    'Formato',
    'Prezzi',
    'Categoria',
    'EAN',
    'Azioni',
  ])
  const row = table.locator('tr[data-product-id="nut-small"]')
  const prices = row.locator('.catalog-store-prices')
  await expect(prices.locator('dt')).toHaveText(['Negozio A', 'Negozio B', 'Negozio C'])
  await expect(prices.locator('dd').first()).toContainText(/4,00\s*€/)
  await expect(prices.locator('dd small').first()).toHaveText(/10,00\s*€\/kg/)
  await expect(prices.locator('dd').last()).toHaveText('-')
  const positions = await prices
    .locator('dt')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top))
  expect(positions[1]).toBeGreaterThan(positions[0])
  await row.getByRole('button', { name: 'Aggiungi alla lista', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
  expect(itemRequests[0]).toMatchObject({
    p_name: 'Crema spalmabile',
    p_specific: 'nut-small',
    p_quantity: '1',
    p_unit: 'conf',
  })
  await page.goto('/liste')
  const article = page.getByRole('article', { name: 'Crema spalmabile · Nutella', exact: true })
  await expect(article).toContainText('400 g')
  const editQuantity = await article
    .getByRole('button', { name: 'Modifica quantità', exact: true })
    .boundingBox()
  const editPrice = await article.getByRole('button', { name: 'Modifica prezzo', exact: true }).boundingBox()
  expect(Math.abs(editQuantity!.y - editPrice!.y)).toBeLessThan(1)
  const priceA = article.locator('.item-prices > div').filter({ hasText: 'Negozio A' })
  await expect(priceA.locator('small')).toHaveText(/10,00\s*€\/kg/)
  await page.getByRole('combobox', { name: 'Supermercato per la spesa', exact: true }).selectOption('a')
  await article.getByRole('button', { name: 'Modifica quantità', exact: true }).click()
  await article.getByLabel('Quantità manuale', { exact: true }).fill('2')
  await article.getByRole('button', { name: 'Salva', exact: true }).click()
  await article.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  const input = article.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })
  await expect(input).toHaveValue('4,00')
  await expect(input).toBeFocused()
  await input.fill('2.50')
  await article.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  expect(priceRequests).toHaveLength(0)
  await input.fill('2,50')
  await article.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(1)
  expect(priceRequests[0]).toMatchObject({ p_product: 'nut-small', p_store: 'a', p_amount: '2.50' })
  await expect(priceA.locator('dd')).toContainText(/5,00\s*€/)
  await expect(priceA.locator('small')).toHaveText(/6,25\s*€\/kg/)
  await expect(
    page
      .getByRole('table', { name: 'Confronto supermercati' })
      .getByRole('row')
      .filter({ hasText: 'Negozio A' }),
  ).toContainText(/5,00\s*€/)
  await page.goto('/catalogo')
  await expect(row.locator('.catalog-store-prices dd').first()).toContainText(/2,50\s*€/)
  await expect(row.locator('.catalog-store-prices small').first()).toHaveText(/6,25\s*€\/kg/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('lista prezzi: scelta esplicita del formato, recupero errore e nessuna modifica alle altre marche', async ({
  page,
}) => {
  const { priceRequests, collections } = await login(page, false, spreadCatalog)
  await page.goto('/liste')
  await chooseListProduct(page, 'Crema spalmabile · Nutella', 'Nutella')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  const article = page.getByRole('article', { name: 'Crema spalmabile · Nutella', exact: true })
  await article.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  const product = article.getByRole('combobox', { name: 'Prodotto di cui modificare il prezzo', exact: true })
  await expect(product).toHaveValue('')
  await expect(product.locator('option')).toHaveCount(3)
  await expect(product).not.toContainText('Altra marca')
  await product.selectOption('nut-big')
  await article
    .getByRole('row', { name: 'Prezzo presso Negozio A', exact: true })
    .getByRole('button', { name: 'Modifica prezzo', exact: true })
    .click()
  const input = article.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })
  await expect(input).toHaveValue('6,00')
  let fail = true
  await page.route('**/rest/v1/rpc/set_product_price', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  await input.fill('2,00')
  await article.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(input).toHaveValue('2,00')
  await article.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(1)
  expect(priceRequests[0]).toMatchObject({ p_product: 'nut-big', p_store: 'a', p_amount: '2.00' })
  expect(collections.product_prices).toContainEqual({
    specific_product_id: 'private',
    store_id: 'a',
    price_amount: '1.00',
  })
  const priceA = article.locator('.item-prices > div').filter({ hasText: 'Negozio A' })
  await expect(priceA.locator('small')).toHaveText(/2,67\s*€\/kg/)
  const accessibility = await new AxeBuilder({ page })
    .include('main.content')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([])
})

test('supermercato modifica: raggiunge e mette a fuoco i campi anche cliccando di nuovo lo stesso negozio', async ({
  page,
}) => {
  await login(page, false, {
    stores: Array.from({ length: 12 }, (_, index) => ({
      id: 'store-' + index,
      name: 'Negozio ' + index,
      chain: '',
      address: 'Via Test',
      city: 'Roma',
    })),
  })
  await page.goto('/negozi')
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Negozio 11', exact: true }) })
  await card.getByRole('button', { name: 'Modifica', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Nome del punto vendita', exact: true })
  await expect(input).toHaveValue('Negozio 11')
  await expect(input).toBeFocused()
  await expect(input).toBeInViewport()
  await card.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(input).toBeFocused()
  await expect(input).toBeInViewport()
})

test('lista prezzi: euro al litro, salvataggio offline bloccato e articolo libero senza prezzo inventato', async ({
  page,
  context,
}) => {
  const { priceRequests } = await login(page, true, {
    generic_products: [
      { id: 'milk-g', name: 'Latte test', canonical_unit: 'ml', category_id: null, is_catalog_group: true },
    ],
    specific_products: [
      {
        id: 'milk',
        generic_product_id: 'milk-g',
        name: 'Latte test',
        brand: 'Abit',
        package_quantity: '750',
        package_unit: 'ml',
        barcode: null,
        variant: '',
      },
    ],
    stores: [{ id: 'a', name: 'Negozio A' }],
    product_prices: [{ specific_product_id: 'milk', store_id: 'a', price_amount: '1.50' }],
  })
  await page.goto('/liste')
  const free = page.getByRole('article', { name: 'Latte', exact: true })
  await free.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  await expect(free).toContainText('Per registrare un prezzo aggiungi prima il prodotto')
  await expect(free.locator('.item-prices dd')).toHaveText('-')
  await chooseListProduct(page, 'Latte test', 'Latte test')
  await page.getByRole('textbox', { name: 'Quantità', exact: true }).fill('2')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  const article = page.getByRole('article', { name: 'Latte test', exact: true })
  await expect(article.locator('.item-prices dd')).toContainText(/3,00\s*€/)
  await expect(article.locator('.item-prices small')).toHaveText(/2,00\s*€\/l/)
  await article.getByRole('button', { name: 'Modifica prezzo', exact: true }).click()
  await article
    .getByRole('row', { name: 'Prezzo presso Negozio A', exact: true })
    .getByRole('button', { name: 'Modifica prezzo', exact: true })
    .click()
  const input = article.getByRole('textbox', { name: 'Prezzo per confezione (€)', exact: true })
  await input.fill('1,20')
  await context.setOffline(true)
  await expect(article.getByRole('button', { name: 'Salva prezzo', exact: true })).toBeDisabled()
  expect(priceRequests).toHaveLength(0)
  await context.setOffline(false)
  await expect(article.getByRole('button', { name: 'Salva prezzo', exact: true })).toBeEnabled()
  await article.getByRole('button', { name: 'Salva prezzo', exact: true }).click()
  await expect.poll(() => priceRequests.length).toBe(1)
  await expect(article.locator('.item-prices dd')).toContainText(/2,40\s*€/)
  await expect(article.locator('.item-prices small')).toHaveText(/1,60\s*€\/l/)
  await page.reload()
  await expect(article.locator('.item-prices small')).toHaveText(/1,60\s*€\/l/)
})

test('lista preferenze: nomi unici, marca e formato indipendenti, cambio prodotto pulisce le scelte', async ({
  page,
}) => {
  const { itemRequests } = await login(page, false, {
    generic_products: [
      { id: 'g', name: 'Latte', canonical_unit: 'ml', category_id: null, is_catalog_group: true },
    ],
    specific_products: [
      {
        id: 'a-small',
        name: 'Latte',
        generic_product_id: 'g',
        brand: 'Abit',
        package_quantity: '500',
        package_unit: 'ml',
        variant: '',
        barcode: null,
      },
      {
        id: 'a-large',
        name: 'Latte',
        generic_product_id: 'g',
        brand: 'Abit',
        package_quantity: '1000',
        package_unit: 'ml',
        variant: '',
        barcode: null,
      },
      {
        id: 'b-small',
        name: 'Latte',
        generic_product_id: 'g',
        brand: 'Altro',
        package_quantity: '500',
        package_unit: 'ml',
        variant: '',
        barcode: null,
      },
    ],
  })
  await page.goto('/liste')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await product.fill('latte')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText('Latte')
  if (test.info().project.use.hasTouch) await page.getByRole('listbox').getByRole('option').tap()
  else await page.getByRole('listbox').getByRole('option').click()
  await expect(page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true })).toHaveValue('')
  await expect(page.getByRole('combobox', { name: 'Formato (facoltativo)', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
  expect(itemRequests[0]).toMatchObject({
    p_generic: 'g',
    p_specific: null,
    p_brand: null,
    p_package_quantity: null,
    p_unit: 'conf',
  })
  await chooseListProduct(page, 'Latte')
  await page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true }).selectOption('Abit')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(2)
  expect(itemRequests[1]).toMatchObject({ p_brand: 'Abit', p_specific: null, p_package_quantity: null })
  await chooseListProduct(page, 'Latte')
  await page.getByRole('combobox', { name: 'Formato (facoltativo)', exact: true }).selectOption('a-small')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(3)
  expect(itemRequests[2]).toMatchObject({
    p_brand: null,
    p_specific: null,
    p_package_quantity: '500',
    p_package_unit: 'ml',
  })
  await chooseListProduct(page, 'Latte')
  await page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true }).selectOption('Abit')
  await product.fill('inesistente')
  await expect(page.getByRole('combobox', { name: 'Marca (facoltativa)', exact: true })).toHaveCount(0)
  await expect(page.locator('input[name="product"]')).toHaveValue('')
})

test('confronto attuale: prezzi di catalogo sempre validi, nessuna promozione o storico caricato', async ({
  page,
}) => {
  const legacyRequests: string[] = []
  await login(page, false, {
    ...productCatalog,
    stores: [
      { id: 'a', name: 'Supermercato A' },
      { id: 'b', name: 'Supermercato B' },
    ],
    shopping_list_items: [
      {
        id: 'flour',
        list_id: '20000000-0000-4000-8000-000000000001',
        name: 'Farina',
        generic_product_id: 'generic-flour',
        specific_product_id: null,
        unit: 'g',
      },
    ],
    list_item_contributions: [
      {
        id: 'contribution',
        item_id: 'flour',
        requested_quantity: '1000',
        origin_type: 'manual',
        origin_id: 'flour',
      },
    ],
    product_prices: [
      { specific_product_id: 'specific-flour', store_id: 'a', price_amount: '2.50' },
      { specific_product_id: 'specific-flour', store_id: 'b', price_amount: '1.20' },
    ],
    price_observations: [
      {
        id: 'promo',
        specific_product_id: 'specific-flour',
        store_id: 'a',
        price_amount: '0.01',
        kind: 'promotion',
        observed_at: '2099-01-01T00:00:00Z',
        voided_at: null,
      },
    ],
    store_discount_rules: [{ id: 'rule', store_id: 'a', percentage: '99', active: true, confirmed: true }],
  })
  page.on('request', (request) => {
    if (/\/(price_observations|store_discount_rules|price_estimate_snapshots)(\?|$)/.test(request.url()))
      legacyRequests.push(request.url())
  })
  await page.goto('/liste')
  await page.getByRole('link', { name: 'Confronta supermercati →', exact: true }).click()
  const table = page.getByRole('table', { name: 'Confronto supermercati', exact: true })
  await expect(table.getByRole('row').nth(1)).toContainText('Supermercato B')
  await expect(table.getByRole('row').filter({ hasText: 'Supermercato B' })).toContainText(/2,40\s*€/)
  await expect(table.getByRole('row').filter({ hasText: 'Supermercato A' })).toContainText(/5,00\s*€/)
  const accessibility = await new AxeBuilder({ page })
    .include('.current-comparison')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations.map((v) => v.id)).toEqual([])
  await expect(page.getByLabel('Data prevista della spesa')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Salva previsione|Salva regola/ })).toHaveCount(0)
  expect(legacyRequests).toHaveLength(0)
})

async function chooseListProduct(page: Page, name: string | RegExp, query = '') {
  const input = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await input.fill(query)
  await input.click()
  const option = page.getByRole('listbox').getByRole('option', { name, exact: typeof name === 'string' })
  if (test.info().project.use.hasTouch) await option.tap()
  else await option.click()
}

const autocompleteCatalog = {
  generic_products: [
    { id: 'zucchini', name: 'Zucchine', canonical_unit: 'g', category_id: null },
    { id: 'oil', name: 'Olio extra vergine di oliva', canonical_unit: 'ml', category_id: null },
    { id: 'coffee', name: 'Caffè', canonical_unit: 'g', category_id: null },
    { id: 'apricot', name: 'Albicocche', canonical_unit: 'g', category_id: null },
    {
      id: 'archived-food',
      name: 'Aglio archiviato',
      canonical_unit: 'g',
      category_id: null,
      archived_at: '2026-11-14T12:00:00Z',
    },
  ],
}

test('autocomplete: ingredienti alfabetici, accenti, tastiera e righe indipendenti', async ({ page }) => {
  await login(page, false, autocompleteCatalog)
  await page.goto('/ricette')
  const first = page.getByRole('combobox', { name: 'Ingrediente 1', exact: true })
  await first.click()
  await expect(page.getByRole('listbox').locator('li > span')).toHaveText([
    'Albicocche',
    'Caffè',
    'Olio extra vergine di oliva',
    'Zucchine',
  ])
  await first.fill('CAFFE')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)
  await first.press('ArrowDown')
  await first.press('Enter')
  await expect(first).toHaveValue('Caffè')
  await page.getByRole('button', { name: 'Altro ingrediente', exact: true }).click()
  const second = page.getByRole('combobox', { name: 'Ingrediente 2', exact: true })
  await second.fill('olio oliva')
  const option = page.getByRole('option', { name: 'Olio extra vergine di oliva', exact: true })
  if (test.info().project.use.hasTouch) await option.tap()
  else await option.click()
  await expect(second).toHaveValue('Olio extra vergine di oliva')
  await expect(first).toHaveValue('Caffè')
  expect(await page.locator('input[name="product0"]').inputValue()).toBe('coffee')
  expect(await page.locator('input[name="product1"]').inputValue()).toBe('oil')
  await first.fill('inesistente')
  await expect(page.getByText('Nessun risultato. Prova un altro nome.', { exact: true })).toBeVisible()
  expect(await page.locator('input[name="product0"]').inputValue()).toBe('')
  await first.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(second).toHaveValue('Olio extra vergine di oliva')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('autocomplete: ricetta conserva scelta dopo errore e pulisce il selettore dopo salvataggio', async ({
  page,
}) => {
  const { recipeSaveRequests } = await login(page, false, autocompleteCatalog)
  let fail = true
  await page.route('**/rest/v1/rpc/save_recipe', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  await page.goto('/ricette')
  await page.getByLabel('Titolo', { exact: true }).fill('Albicocche semplici')
  await page.getByLabel('Procedimento', { exact: true }).fill('Lavare e servire.')
  const ingredient = page.getByRole('combobox', { name: 'Ingrediente 1', exact: true })
  await ingredient.fill('albi')
  await page.getByRole('option', { name: 'Albicocche', exact: true }).click()
  await page.getByLabel('Quantità', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Salva ricetta', exact: true }).click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(ingredient).toHaveValue('Albicocche')
  await page.getByRole('button', { name: 'Salva ricetta', exact: true }).click()
  await expect.poll(() => recipeSaveRequests.length).toBe(1)
  expect(recipeSaveRequests[0]).toMatchObject({
    p_title: 'Albicocche semplici',
    p_ingredients: [{ product_id: 'apricot', quantity: '2', unit: 'g' }],
  })
  await expect(ingredient).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Albicocche semplici', exact: true })).toBeVisible()
})

test('autocomplete: testo non selezionato non invia ingredienti vecchi o arbitrari', async ({ page }) => {
  const { recipeSaveRequests } = await login(page, false, autocompleteCatalog)
  await page.goto('/ricette')
  await page.getByLabel('Titolo', { exact: true }).fill('Ricetta valida')
  await page.getByLabel('Procedimento', { exact: true }).fill('Procedimento valido')
  const ingredient = page.getByRole('combobox', { name: 'Ingrediente 1', exact: true })
  await ingredient.fill('albi')
  await page.getByRole('option', { name: 'Albicocche', exact: true }).click()
  await ingredient.fill('prodotto mai salvato')
  await page.getByRole('button', { name: 'Salva ricetta', exact: true }).click()
  expect(await ingredient.evaluate((element) => element.matches(':invalid'))).toBe(true)
  expect(await page.locator('input[name="product0"]').inputValue()).toBe('')
  expect(recipeSaveRequests).toHaveLength(0)
  await ingredient.fill('   ')
  await page.getByRole('button', { name: 'Salva ricetta', exact: true }).click()
  expect(await ingredient.evaluate((element) => element.matches(':invalid'))).toBe(true)
  expect(recipeSaveRequests).toHaveLength(0)
})

test('autocomplete: calendario alfabetico misto, omonimi e selezione corretta ricetta/alimento', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') })
  const { mealRequests } = await login(page, false, {
    ...autocompleteCatalog,
    recipes: [
      { id: 'recipe-z', title: 'Zuppa', base_servings: 2 },
      { id: 'recipe-c', title: 'Caffè', base_servings: 2 },
      {
        id: 'recipe-a',
        title: 'Aglio archiviato ricetta',
        base_servings: 2,
        archived_at: '2026-11-14T12:00:00Z',
      },
    ],
    meal_plans: [{ id: 'plan', week_start: '2026-11-16', linked_list_id: null, version: 1 }],
  })
  await page.goto('/pasti')
  const component = page.getByRole('combobox', { name: 'Ricetta o alimento', exact: true })
  await component.click()
  await expect(page.getByRole('listbox').locator('li > span')).toHaveText([
    'Albicocche',
    'Caffè',
    'Caffè',
    'Olio extra vergine di oliva',
    'Zucchine',
    'Zuppa',
  ])
  await component.fill('caffe')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2)
  const recipe = page.getByRole('option', { name: /Caffè.*Ricetta/ })
  if (test.info().project.use.hasTouch) await recipe.tap()
  else await recipe.click()
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  await expect.poll(() => mealRequests.length).toBe(1)
  expect(mealRequests[0]).toMatchObject({
    recipe_id: 'recipe-c',
    generic_product_id: null,
    quantity: null,
    unit: null,
  })
  await expect(component).toHaveValue('')
  await component.fill('olio oliva')
  await component.press('ArrowDown')
  await component.press('Enter')
  await page.getByRole('combobox', { name: 'Unità', exact: true }).selectOption('ml')
  await page.getByRole('button', { name: 'Aggiungi pasto', exact: true }).click()
  await expect.poll(() => mealRequests.length).toBe(2)
  expect(mealRequests[1]).toMatchObject({
    recipe_id: null,
    generic_product_id: 'oil',
    quantity: '1',
    unit: 'ml',
  })
  await expect(component).toHaveValue('')
})

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

test('categorie negozi: ordine indipendente, scelta nella lista e persistenza', async ({ page }) => {
  const { categoryOrderRequests } = await login(page, false, {
    ...categoryCatalog,
    stores: [
      { id: 'a', name: 'Supermercato A' },
      { id: 'b', name: 'Supermercato B' },
    ],
    store_category_order: ['a', 'b'].flatMap((store_id) => [
      { store_id, category_id: 'dairy-category', sort_order: 0 },
      { store_id, category_id: 'fruit-category', sort_order: 1 },
      { store_id, category_id: 'other-category', sort_order: 2 },
    ]),
  })
  await page.goto('/negozi')
  const store = page.getByRole('combobox', { name: 'Supermercato per ordine categorie' })
  await store.selectOption('a')
  await page.getByRole('button', { name: 'Sposta Frutta su', exact: true }).click()
  await expect.poll(() => categoryOrderRequests.length).toBe(1)
  expect(categoryOrderRequests[0].p_store).toBe('a')
  await expect(page.locator('.category-order-name').first()).toContainText('Frutta')
  await store.selectOption('b')
  await expect(page.locator('.category-order-name').first()).toContainText('Latticini')
  await page.goto('/liste')
  await page.getByRole('combobox', { name: 'Supermercato per la spesa', exact: true }).selectOption('a')
  await expect(page.locator('.category-group h3')).toHaveText(['Frutta', 'Latticini'])
  await page.reload()
  await expect(page.locator('.category-group h3')).toHaveText(['Frutta', 'Latticini'])
  await page.getByRole('combobox', { name: 'Supermercato per la spesa', exact: true }).selectOption('b')
  await expect(page.locator('.category-group h3')).toHaveText(['Latticini', 'Frutta'])
  await page.goto('/catalogo')
  await expect(page.getByLabel('Nuova categoria', { exact: true })).toHaveCount(0)
})

test('categorie: trascinamento mouse, persistenza e ordine dei gruppi nella spesa', async ({ page }) => {
  const { categoryOrderRequests } = await login(page, false, categoryCatalog)
  await page.goto('/liste')
  await expect(page.locator('.category-group h3')).toHaveText(['Latticini', 'Frutta'])
  await page.goto('/negozi')
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
  await page.goto('/negozi')
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
  await page.goto('/negozi')
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

for (const example of [
  {
    source: 'beauty',
    origin: 'https://world.openbeautyfacts.org',
    sourceName: 'Open Beauty Facts',
    barcode: '8001090662231',
    name: 'Shampoo',
    brand: 'Marca shampoo',
    size: '400',
    unit: 'ml',
    category: 'Igiene personale',
    categories: ['en:personal-care', 'en:shampoo'],
  },
  {
    source: 'product',
    origin: 'https://world.openproductsfacts.org',
    sourceName: 'Open Products Facts',
    barcode: '3760044183738',
    name: 'Detersivo bucato',
    brand: 'Marca casa',
    size: '1',
    unit: 'L',
    category: 'Detersivi',
    categories: ['en:laundry-detergents'],
  },
]) {
  test(`barcode non alimentare: ${example.source} compila campi e arriva alla lista`, async ({ page }) => {
    const expectedSize = example.unit === 'L' ? '1000' : example.size
    const { itemRequests, catalogSaveRequests } = await login(page, false, {
      categories: [{ id: 'non-food-category', name: example.category, sort_order: 0 }],
    })
    await page.route('**/api/products/*', (route) =>
      route.fulfill({
        json: { product: { ...example, sourceUrl: `${example.origin}/product/${example.barcode}` } },
      }),
    )
    await page.goto('/liste')
    await page.getByText('Inserisci il barcode manualmente', { exact: true }).click()
    await page.getByLabel('Barcode per la lista', { exact: true }).fill(example.barcode)
    await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
    await page.getByRole('link', { name: 'Completa prodotto e torna alla lista' }).click()
    await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue(example.name)
    await expect(page.getByLabel('Marca (facoltativa)', { exact: true })).toHaveValue(example.brand)
    await expect(page.getByRole('combobox', { name: 'Categoria', exact: true })).toHaveValue(
      'non-food-category',
    )
    await expect(page.getByLabel('Quantità per confezione', { exact: true })).toHaveValue(expectedSize)
    await expect(page.getByRole('combobox', { name: 'Unità del formato', exact: true })).toHaveValue('ml')
    await expect(
      page.getByRole('link', { name: `Fonte ${example.sourceName}`, exact: true }),
    ).toHaveAttribute('href', `${example.origin}/product/${example.barcode}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(catalogSaveRequests).toHaveLength(0)
    expect(itemRequests).toHaveLength(0)
    await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
    await expect(page.locator('input[name="product"]')).toHaveValue('new-product-0')
    await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue(expectedSize)
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
    await expect(page.locator('.shopping-item')).toContainText(example.name)
    expect(itemRequests[0]).toMatchObject({
      p_specific: 'new-product-0',
      p_quantity: expectedSize,
      p_unit: 'ml',
    })
  })
}

test('barcode nella lista: seleziona dal catalogo e aggiunge solo dopo conferma', async ({ page }) => {
  const { itemRequests, catalogSaveRequests } = await login(page, false, productCatalog)
  let lookups = 0
  await page.route('**/api/products/*', (route) => {
    lookups++
    return route.fulfill({ json: { product: null } })
  })
  await page.goto('/liste')
  await page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true }).fill('latte')
  await page.getByText('Inserisci il barcode manualmente', { exact: true }).click()
  await page.getByLabel('Barcode per la lista', { exact: true }).fill('8000500037560')
  await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
  await expect(page.locator('input[name="product"]')).toHaveValue('specific-flour')
  await expect(page.getByRole('combobox', { name: /Prodotto dal catalogo/ })).toHaveValue(/Farina fine/)
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('500')
  await expect(page.getByRole('combobox', { name: 'Unità', exact: true })).toHaveValue('g')
  expect(lookups).toBe(0)
  expect(catalogSaveRequests).toHaveLength(0)
  expect(itemRequests).toHaveLength(0)
  await page.getByLabel('Quantità', { exact: true }).fill('1000')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText('Farina fine')
  expect(itemRequests[0]).toMatchObject({ p_specific: 'specific-flour', p_quantity: '1000', p_unit: 'g' })
})

test('barcode nella lista: nuovo prodotto, compilazione e ritorno con selezione', async ({ page }) => {
  const { itemRequests, catalogSaveRequests } = await login(page)
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: scannedProduct } }))
  await page.goto('/liste')
  await page.getByText('Inserisci il barcode manualmente', { exact: true }).click()
  await page.getByLabel('Barcode per la lista', { exact: true }).fill(scannedProduct.barcode)
  await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
  await page.getByRole('link', { name: 'Completa prodotto e torna alla lista' }).click()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue(scannedProduct.name)
  expect(catalogSaveRequests).toHaveLength(0)
  expect(itemRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  await expect(page.locator('input[name="product"]')).toHaveValue('new-product-0')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1000')
  await expect(page.getByRole('combobox', { name: 'Unità', exact: true })).toHaveValue('ml')
  expect(catalogSaveRequests).toHaveLength(1)
  expect(itemRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText(scannedProduct.name)
  expect(itemRequests[0]).toMatchObject({ p_specific: 'new-product-0', p_quantity: '1000', p_unit: 'ml' })
})

test('barcode nella lista: codice assente o errato non cancella l’articolo libero', async ({ page }) => {
  const { itemRequests } = await login(page)
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: null } }))
  await page.goto('/liste')
  await page.getByLabel('Nome per articolo libero', { exact: true }).fill('Pane fresco')
  await page.getByText('Inserisci il barcode manualmente', { exact: true }).click()
  await page.getByLabel('Barcode per la lista', { exact: true }).fill('12345678')
  await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
  await expect(page.getByText('Il checksum EAN non è valido.', { exact: false })).toBeVisible()
  await page.getByLabel('Barcode per la lista', { exact: true }).fill('96385074')
  await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Completa prodotto e torna alla lista' })).toBeVisible()
  await expect(page.getByLabel('Nome per articolo libero', { exact: true })).toHaveValue('Pane fresco')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText('Pane fresco')
  expect(itemRequests[0]).toMatchObject({ p_name: 'Pane fresco', p_generic: null, p_specific: null })
})

test('barcode nella lista: prodotto archiviato richiede ripristino e offline blocca lettura', async ({
  page,
  context,
}) => {
  const { itemRequests } = await login(page, false, {
    ...productCatalog,
    specific_products: productCatalog.specific_products.map((p) => ({
      ...p,
      archived_at: '2026-11-14T12:00:00Z',
    })),
  })
  await page.goto('/liste')
  await page.getByText('Inserisci il barcode manualmente', { exact: true }).click()
  await page.getByLabel('Barcode per la lista', { exact: true }).fill('8000500037560')
  await page.getByRole('button', { name: 'Cerca barcode', exact: true }).click()
  await expect(page.getByText('Il prodotto è archiviato.', { exact: false })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Prodotto dal catalogo/ })).toHaveValue('')
  expect(itemRequests).toHaveLength(0)
  await context.setOffline(true)
  await expect(page.getByRole('button', { name: 'Scansiona barcode', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cerca barcode', exact: true })).toBeDisabled()
})

test('barcode nella lista: fotocamera seleziona il prodotto senza salvataggi impliciti', async ({ page }) => {
  const { itemRequests } = await login(page, false, productCatalog)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: class {
        detect() {
          return Promise.resolve([{ rawValue: '8000500037560' }])
        }
      },
    })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 500
        canvas.height = 220
        const context = canvas.getContext('2d')!
        const paint = () => {
          context.fillStyle = 'white'
          context.fillRect(0, 0, 500, 220)
        }
        paint()
        const stream = canvas.captureStream(10)
        const interval = setInterval(paint, 100)
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track)
          track.stop = () => {
            clearInterval(interval)
            stop()
          }
        }
        return stream
      },
    })
  })
  await page.goto('/liste')
  await page.getByRole('button', { name: 'Scansiona barcode', exact: true }).click()
  await expect(page.locator('input[name="product"]')).toHaveValue('specific-flour')
  await expect(page.getByRole('button', { name: 'Ferma fotocamera' })).toHaveCount(0)
  expect(itemRequests).toHaveLength(0)
})

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
  await expect(page.getByLabel('Quantità per confezione', { exact: true })).toHaveValue('1000')
  expect(catalogSaveRequests).toHaveLength(0)
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte corretto')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect.poll(() => catalogSaveRequests.length).toBe(1)
  expect(catalogSaveRequests[0]).toMatchObject({
    p_name: 'Latte corretto',
    p_brand: 'Abit',
    p_unit: 'ml',
    p_quantity: '1000',
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
  await page
    .getByRole('row', { name: /^Latte parzialmente scremato/ })
    .getByRole('button', { name: 'Prezzi', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Prezzi di Latte parzialmente scremato', exact: true }),
  ).toBeVisible()
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
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Nome prodotto', { exact: true })).toBeInViewport()
  await expect(page.getByRole('group', { name: 'Formato della confezione', exact: true })).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Unità del formato', exact: true }).locator('option'),
  ).toHaveText(['Non indicata', 'g', 'ml', 'pz'])
  await page.getByLabel('Quantità per confezione', { exact: true }).fill('1000')
  await page.getByRole('combobox', { name: 'Unità del formato', exact: true }).selectOption('ml')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('1000 ml')
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

for (const legacy of [
  { unit: 'kg', size: '1.25', expectedUnit: 'g', expectedSize: '1250' },
  { unit: 'L', size: '0.75', expectedUnit: 'ml', expectedSize: '750' },
]) {
  test(`catalogo: modifica un formato precedente in ${legacy.unit}, scorre ai campi e salva la quantità equivalente`, async ({
    page,
  }) => {
    if (legacy.unit === 'kg') await page.emulateMedia({ reducedMotion: 'reduce' })
    const { catalogSaveRequests } = await login(page, false, {
      generic_products: [
        {
          id: 'group',
          name: 'Prodotto precedente',
          canonical_unit: legacy.unit,
          category_id: null,
          is_catalog_group: true,
        },
      ],
      specific_products: [
        {
          id: 'legacy-card',
          name: 'Prodotto precedente',
          generic_product_id: 'group',
          brand: 'Marca test',
          variant: '',
          barcode: null,
          package_quantity: legacy.size,
          package_unit: legacy.unit,
        },
      ],
    })
    await page.goto('/catalogo')
    const edit = page
      .getByRole('row', { name: /^Prodotto precedente/ })
      .getByRole('button', { name: 'Modifica', exact: true })
    await edit.click()
    const name = page.getByLabel('Nome prodotto', { exact: true })
    await expect(name).toBeFocused()
    await expect(name).toBeInViewport()
    await expect(page.getByLabel('Quantità per confezione', { exact: true })).toHaveValue(legacy.expectedSize)
    await expect(page.getByRole('combobox', { name: 'Unità del formato', exact: true })).toHaveValue(
      legacy.expectedUnit,
    )
    await edit.click()
    await expect(name).toBeFocused()
    await expect(name).toBeInViewport()
    await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
    await expect.poll(() => catalogSaveRequests.length).toBe(1)
    expect(catalogSaveRequests[0]).toMatchObject({
      p_id: 'legacy-card',
      p_specific: true,
      p_quantity: legacy.expectedSize,
      p_unit: legacy.expectedUnit,
    })
    await expect(page.getByRole('row', { name: /^Prodotto precedente/ })).toContainText(
      `${legacy.expectedSize} ${legacy.expectedUnit}`,
    )
  })
}

test('catalogo unico: EAN errato e formato incompleto non inviano salvataggi', async ({ page }) => {
  const { catalogSaveRequests } = await login(page)
  await page.goto('/catalogo')
  await page.getByLabel('Nome prodotto', { exact: true }).fill('Latte')
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('12345678')
  await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'checksum' })).toBeVisible()
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('')
  await expect(page.getByLabel('Quantità per confezione', { exact: true })).toBeVisible()
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
  const select = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await select.click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)
  await chooseListProduct(page, /^Latte/)
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  expect(itemRequests[0]).toMatchObject({
    p_generic: 'group',
    p_specific: null,
    p_quantity: '1',
    p_unit: 'conf',
  })
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
  await chooseListProduct(page, /^Latte/)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item').filter({ hasText: 'Latte' })).toHaveCount(2)
  expect(itemRequests[0]).toMatchObject({
    p_generic: 'group',
    p_specific: null,
    p_quantity: '1',
    p_unit: 'conf',
  })
})

test('catalogo: totali prodotti e categorie, tabella richiudibile e ricerca che la riapre', async ({
  page,
}) => {
  await login(page, false, {
    ...categoryCatalog,
    categories: [
      ...categoryCatalog.categories,
      { id: 'empty-category', name: 'Categoria vuota', sort_order: 30 },
    ],
    generic_products: categoryCatalog.generic_products.map((p) => ({
      ...p,
      is_catalog_group: p.id === 'fruit',
    })),
    specific_products: ['A', 'B', 'C'].map((brand) => ({
      id: 'fruit-' + brand,
      name: 'Mele',
      brand,
      generic_product_id: 'fruit',
      variant: '',
      barcode: null,
      package_quantity: null,
      package_unit: null,
      archived_at: brand === 'C' ? '2026-11-15' : null,
    })),
  })
  await page.goto('/catalogo')
  const counts = page.locator('dl[aria-label="Totali del catalogo"]')
  await expect(counts.locator('dt')).toHaveText(['Prodotti attivi', 'Categorie'])
  await expect(counts.locator('dd')).toHaveText(['3', '4'])
  expect(
    await counts.evaluate(
      (element) =>
        !!(
          element.compareDocumentPosition(document.querySelector('form')!) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  ).toBe(true)
  const toggle = page.locator('.catalog-products > summary')
  if (test.info().project.name === 'mobile') await toggle.tap()
  else await toggle.click()
  await expect(page.locator('.catalog-products table')).not.toBeVisible()
  await expect(toggle).toContainText('Espandi tabella')
  const categories = page.getByRole('link', { name: /Gestisci categorie/ })
  await categories.scrollIntoViewIfNeeded()
  await expect(categories).toBeInViewport()
  await toggle.focus()
  await toggle.press('Enter')
  await expect(page.locator('.catalog-products table')).toBeVisible()
  await toggle.press('Enter')
  await page.getByLabel('Cerca prodotto, marca o barcode').fill('Latte')
  await expect(page.locator('.catalog-products table')).toBeVisible()
  await expect(page.locator('.catalog-products tbody tr')).toHaveCount(1)
  await expect(counts.locator('dd')).toHaveText(['3', '4'])
  // Closing and immediately typing must win over any queued native toggle event.
  for (const query of ['Mele', 'Latte']) {
    await toggle.press('Enter')
    await page.getByLabel('Cerca prodotto, marca o barcode').fill(query)
    await expect(page.locator('.catalog-products table')).toBeVisible()
    await expect(toggle).toContainText('Riduci tabella')
  }
  await page.getByLabel('Cerca prodotto, marca o barcode').fill('')
  await page.getByLabel('Mostra archiviati', { exact: true }).check()
  await expect(page.locator('.catalog-products tbody tr')).toHaveCount(1)
  await expect(counts.locator('dd')).toHaveText(['3', '4'])
  const accessibility = await new AxeBuilder({ page })
    .include('#main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/catalog-dashboard-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('lista: articoli prima del modulo, rimozione diretta e ripristino senza prezzi', async ({ page }) => {
  const { itemRequests, purchaseRequests } = await login(page, true)
  await page.goto('/liste')
  const article = page.locator('.shopping-item')
  await expect(article).toContainText('Latte')
  expect((await article.boundingBox())!.y).toBeLessThan(
    (await page.getByRole('heading', { name: 'Aggiungi alla lista', exact: true }).boundingBox())!.y,
  )
  await page.getByRole('button', { name: 'Rimuovi dalla lista Latte', exact: true }).click()
  await expect(article).toHaveCount(0)
  await page.getByLabel('Mostra articoli rimossi', { exact: true }).check()
  await page.getByRole('button', { name: 'Rimetti nella lista', exact: true }).click()
  await expect(article).toContainText('Latte')
  expect(purchaseRequests).toHaveLength(0)
  await page.getByLabel('Nome per articolo libero').fill('Pane nuovo')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
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
  await generic.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true }).click()
  await expect(generic).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto' })).toBeVisible()
  const specific = page.getByRole('row', { name: /^Farina fine/ })
  await specific.getByRole('button', { name: 'Modifica', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Modifica prodotto' })).toBeVisible()
  await specific.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true }).click()
  await expect(specific).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nuovo prodotto' })).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'Prodotto e dati collegati eliminati definitivamente.' }),
  ).toBeVisible()
  expect(catalogDeleteRequests).toEqual([
    { table: 'generic_products', id: 'generic-milk' },
    { table: 'specific_products', id: 'specific-flour' },
  ])
})
test('catalogo: annullare la conferma definitiva conserva il prodotto senza chiamare la RPC', async ({
  page,
}) => {
  const { catalogDeleteRequests } = await login(page, false, productCatalog)
  await page.goto('/catalogo')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Latte intero')
    expect(dialog.message()).toContain('prezzi')
    expect(dialog.message()).toContain('ricette')
    expect(dialog.message()).toContain('Non è possibile annullare')
    await dialog.dismiss()
  })
  const row = page.getByRole('row', { name: /^Latte intero/ })
  await row.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true }).click()
  await expect(row).toBeVisible()
  expect(catalogDeleteRequests).toHaveLength(0)
})
for (const { table, rowName } of [
  { table: 'generic_products', rowName: /^Farina 00/ },
  { table: 'specific_products', rowName: /^Farina fine/ },
]) {
  test(`catalogo: ${table} errore di cancellazione conserva prodotto e bozza per riprovare`, async ({
    page,
  }) => {
    const { catalogDeleteRequests } = await login(page, false, productCatalog)
    let fail = true
    await page.route('**/rest/v1/rpc/delete_catalog_product', async (route) => {
      if (fail) {
        fail = false
        await route.fulfill({ status: 503, json: { message: 'fixture_private_detail' } })
      } else await route.fallback()
    })
    await page.goto('/catalogo')
    page.on('dialog', (dialog) => dialog.accept())
    const row = page.getByRole('row', { name: rowName })
    await row.getByRole('button', { name: 'Modifica', exact: true }).click()
    await page.getByLabel('Nome prodotto', { exact: true }).fill('Bozza da conservare')
    await row.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Operazione non riuscita' })).toBeVisible()
    await expect(row).toBeVisible()
    await expect(page.getByLabel('Nome prodotto', { exact: true })).toHaveValue('Bozza da conservare')
    await expect(page.getByText('fixture_private_detail', { exact: false })).toHaveCount(0)
    expect(catalogDeleteRequests).toHaveLength(0)
    await row.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect(catalogDeleteRequests).toHaveLength(1)
  })
}

test('catalogo: cancellazione definitiva aggiorna lista, ingredienti, pasti e storico prezzi', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') })
  const listId = '20000000-0000-4000-8000-000000000001'
  const { catalogDeleteRequests, collections } = await login(page, false, {
    ...productCatalog,
    generic_products: productCatalog.generic_products.map((p) => ({
      ...p,
      is_catalog_group: p.id === 'generic-milk',
    })),
    specific_products: [
      ...productCatalog.specific_products,
      {
        id: 'specific-milk',
        name: 'Latte intero',
        generic_product_id: 'generic-milk',
        brand: 'Abit',
        variant: '',
        package_quantity: '1',
        package_unit: 'L',
      },
    ],
    shopping_list_items: [
      {
        id: 'milk-item',
        list_id: listId,
        name: 'Latte nella lista',
        generic_product_id: null,
        specific_product_id: 'specific-milk',
        unit: 'L',
        note: '',
        created_at: '2026-11-14T12:00:00Z',
      },
    ],
    list_item_contributions: [
      {
        id: 'milk-quantity',
        item_id: 'milk-item',
        origin_type: 'manual',
        origin_id: 'milk-item',
        requested_quantity: '2',
      },
    ],
    purchases: [
      {
        id: 'milk-purchase',
        list_item_id: 'milk-item',
        specific_product_id: 'specific-milk',
        quantity: '1',
        total_paid: '2',
        unit: 'L',
        purchased_at: '2026-11-18T10:00:00Z',
        voided_at: null,
      },
    ],
    recipes: [{ id: 'breakfast', title: 'Colazione semplice', base_servings: 2, instructions: 'Mescolare.' }],
    recipe_ingredients: [
      {
        id: 'milk-ingredient',
        recipe_id: 'breakfast',
        generic_product_id: 'generic-milk',
        quantity: '1',
        unit: 'L',
      },
      {
        id: 'flour-ingredient',
        recipe_id: 'breakfast',
        generic_product_id: 'generic-flour',
        quantity: '100',
        unit: 'g',
      },
    ],
    meal_plans: [{ id: 'plan', week_start: '2026-11-16', linked_list_id: listId, version: 1 }],
    meal_entries: [
      {
        id: 'milk-meal',
        meal_plan_id: 'plan',
        meal_date: '2026-11-18',
        meal_slot: 'pranzo',
        generic_product_id: 'generic-milk',
        quantity: '1',
        unit: 'L',
        recipe_id: null,
      },
      {
        id: 'recipe-meal',
        meal_plan_id: 'plan',
        meal_date: '2026-11-18',
        meal_slot: 'cena',
        recipe_id: 'breakfast',
        generic_product_id: null,
      },
    ],
    price_observations: [
      {
        id: 'milk-price',
        specific_product_id: 'specific-milk',
        store_id: 'shop',
        price_amount: '2',
        kind: 'regular',
        observed_at: '2026-11-18T10:00:00Z',
      },
    ],
  })
  const writes: { method: string; path: string; body: unknown }[] = []
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/') && request.method() !== 'GET')
      writes.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        body: request.postDataJSON(),
      })
  })
  await page.goto('/liste')
  await expect(
    page.getByRole('button', { name: 'Rimuovi dalla lista Latte nella lista', exact: true }),
  ).toBeVisible()
  await page.goto('/catalogo')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Latte intero')
    expect(dialog.message()).toContain('Abit')
    expect(dialog.message()).toContain('acquisti')
    await dialog.accept()
  })
  await page
    .getByRole('row', { name: /^Latte intero/ })
    .getByRole('button', { name: 'Rimuovi dal catalogo', exact: true })
    .click()
  await expect(page.getByRole('row', { name: /^Latte intero/ })).toHaveCount(0)
  expect(catalogDeleteRequests).toEqual([{ table: 'specific_products', id: 'specific-milk' }])
  expect(writes).toEqual([
    {
      method: 'POST',
      path: '/rest/v1/rpc/delete_catalog_product',
      body: { p_id: 'specific-milk', p_specific: true },
    },
  ])
  await page.goto('/liste')
  await expect(page.getByRole('form', { name: 'Aggiungi un articolo alla lista' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Rimuovi dalla lista Latte nella lista', exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('form', { name: 'Aggiungi un articolo alla lista' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Rimuovi dalla lista Latte nella lista', exact: true }),
  ).toHaveCount(0)
  await page.goto('/ricette')
  await page.getByRole('button', { name: 'Colazione semplice', exact: true }).click()
  await expect(page.locator('.ingredients')).toContainText('Farina 00')
  await expect(page.locator('.ingredients')).not.toContainText('Latte')
  await page.goto('/pasti')
  await expect(page.locator('.meal-chip')).toHaveCount(1)
  await expect(page.locator('.meal-chip')).toContainText('Colazione semplice')
  await page.goto('/prezzi')
  expect(collections.price_observations).toHaveLength(0)
})

test('catalogo: offline blocca la cancellazione definitiva senza richieste', async ({ page }) => {
  const { catalogDeleteRequests } = await login(page, false, productCatalog)
  await page.goto('/catalogo')
  const row = page.getByRole('row', { name: /^Latte intero/ })
  await expect(row).toBeVisible()
  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(row.getByRole('button', { name: 'Rimuovi dal catalogo', exact: true })).toBeDisabled()
  expect(catalogDeleteRequests).toHaveLength(0)
  await expect(row).toBeVisible()
})

test('catalogo vuoto esplicito e articolo libero obbligatorio', async ({ page }) => {
  const { itemRequests } = await login(page, true)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  await expect(page.getByText('Il catalogo è vuoto.', { exact: false })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })).toBeDisabled()
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
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await chooseListProduct(page, /^Farina fine/)
  await page
    .getByRole('combobox', { name: 'Formato (facoltativo)', exact: true })
    .selectOption('specific-flour')
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
    p_specific: null,
    p_generic: 'generic-flour',
    p_package_quantity: '500',
    p_package_unit: 'g',
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
  await chooseListProduct(page, 'Latte intero')
  const unit = page.getByLabel('Unità', { exact: true })
  await expect(unit).toHaveValue('conf')
  await unit.selectOption('L')

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
test('touch selettore: perdita del focus prima del tocco non perde il prodotto e salva una sola volta', async ({
  page,
}) => {
  const { itemRequests } = await login(page, false, productCatalog)
  await page.goto('/liste')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await product.fill('farina')
  const option = page.getByRole('option', { name: /Farina fine/ })
  await expect(option).toBeVisible()
  // A software keyboard can blur the input before the option's click arrives.
  await product.evaluate((input) => input.blur())
  await expect(option).toBeVisible()
  if (test.info().project.use.hasTouch) await option.tap()
  else await option.click()
  await expect(page.locator('input[name="product"]')).toHaveValue('specific-flour')
  await expect(product).toHaveValue(/Farina fine/)
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByLabel('Nome per articolo libero')).toHaveCount(0)
  expect(itemRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect.poll(() => itemRequests.length).toBe(1)
  expect(itemRequests[0]).toMatchObject({
    p_generic: 'generic-flour',
    p_specific: null,
    p_name: 'Farina fine',
    p_quantity: '1',
    p_unit: 'conf',
  })
  await expect(page.locator('.shopping-item')).toContainText('Farina fine')
})

test('touch selettore: trascinare i suggerimenti non seleziona, focus esterno e Tab chiudono', async ({
  page,
}) => {
  const { itemRequests } = await login(page, false, autocompleteCatalog)
  await page.goto('/liste')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await product.fill('')
  await product.click()
  const option = page.getByRole('option', { name: 'Albicocche', exact: true })
  await option.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 100 })
  await product.evaluate((input) => input.blur())
  await option.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
  await option.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch' })
  await expect(page.locator('input[name="product"]')).toHaveValue('')
  expect(itemRequests).toHaveLength(0)
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.getByLabel('Quantità', { exact: true }).focus()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await product.click()
  await product.press('Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await product.click()
  await page.getByRole('heading', { name: 'La lista della spesa.' }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('lista autocomplete: ordine alfabetico, accenti, tastiera, tocco e articolo libero', async ({
  page,
}) => {
  const { itemRequests } = await login(page, false, autocompleteCatalog)
  await page.goto('/liste')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await product.click()
  await expect(page.getByRole('listbox').locator('li > span')).toHaveText([
    'Albicocche',
    'Caffè',
    'Olio extra vergine di oliva',
    'Zucchine',
  ])
  await product.fill('CAFFE')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)
  await product.press('ArrowDown')
  await product.press('Enter')
  await expect(page.locator('input[name="product"]')).toHaveValue('coffee')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('conf')
  expect(itemRequests).toHaveLength(0)
  await chooseListProduct(page, 'Olio extra vergine di oliva', 'olio oliva')
  await expect(page.locator('input[name="product"]')).toHaveValue('oil')
  await expect(page.getByLabel('Unità', { exact: true })).toHaveValue('conf')
  await page.getByRole('button', { name: 'Scrivi un articolo libero', exact: true }).click()
  await expect(product).toHaveValue('')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('1')
  await product.fill('nessun prodotto')
  await expect(page.getByText('Nessun prodotto trovato.', { exact: false })).toBeVisible()
  await product.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.getByLabel('Nome per articolo libero').fill('Pane fresco')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText('Pane fresco')
  expect(itemRequests[0]).toMatchObject({
    p_name: 'Pane fresco',
    p_generic: null,
    p_specific: null,
    p_quantity: '1',
    p_unit: 'pz',
  })
  await expect(product).toHaveValue('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('ricerca per nome o marca, nessuna selezione nascosta quando il filtro cambia', async ({ page }) => {
  await login(page, true, productCatalog)
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await chooseListProduct(page, 'Latte intero')
  await product.fill('Molino')
  await expect(page.locator('input[name="product"]')).toHaveValue('')
  await expect(
    page.getByRole('listbox').getByRole('option', { name: 'Farina fine · Molino Test', exact: true }),
  ).toHaveCount(1)
  await chooseListProduct(page, /^Farina fine/, 'Farina')
  await product.fill('senza corrispondenze')
  await expect(page.locator('input[name="product"]')).toHaveValue('')
  await expect(page.getByText('Nessun prodotto trovato.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nome per articolo libero')).toHaveAttribute('required', '')
})
test('errore di salvataggio conserva prodotto, quantità e ricerca per riprovare', async ({ page }) => {
  await login(page, true, productCatalog)
  let fail = true
  await page.route('**/rest/v1/rpc/add_shopping_product', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({
        status: 503,
        json: { message: 'Errore temporaneo di test', code: 'fixture_error' },
      })
    } else await route.fallback()
  })
  await page.goto('/liste/20000000-0000-4000-8000-000000000001')
  const product = page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true })
  await chooseListProduct(page, /^Farina fine/, 'Farina')
  await page.getByLabel('Quantità', { exact: true }).fill('750')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Operazione non riuscita' })).toBeVisible()
  await expect(page.locator('input[name="product"]')).toHaveValue('specific-flour')
  await expect(page.getByLabel('Quantità', { exact: true })).toHaveValue('750')
  await expect(product).toHaveValue(/Farina fine/)
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Farina fine', { exact: true })).toBeVisible()
  await expect(product).toHaveValue('')
})
test('accesso senza sessione e layout responsive', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bentornato a casa.' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('schermata iniziale lista della spesa e ordine dei cinque collegamenti principali', async ({ page }) => {
  await login(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/liste$/)
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'La lista è vuota.' })).toBeVisible()
  const labels = ['Lista della spesa', 'Catalogo', 'Ricette', 'Pasti', 'Supermercati']
  await expect(page.locator('.sidebar nav[aria-label="Navigazione principale"] a')).toHaveText(labels)
  await expect(page.locator('.bottom-nav a')).toHaveText(labels)
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0)
  const nav = page.getByRole('navigation', {
    name: test.info().project.name === 'mobile' ? 'Navigazione mobile' : 'Navigazione principale',
    exact: true,
  })
  await expect(nav.getByRole('link', { name: 'Lista della spesa', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/initial-list-${test.info().project.name}.png`, fullPage: true })
  await expect(page.getByLabel('Titolo della lista')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Crea lista', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Duplica', exact: true })).toHaveCount(0)
  for (const [label, heading] of [
    ['Catalogo', 'Il vostro catalogo.'],
    ['Ricette', 'Il vostro ricettario.'],
    ['Lista della spesa', 'La lista della spesa.'],
    ['Pasti', 'La settimana a tavola.'],
    ['Supermercati', 'I vostri supermercati.'],
  ]) {
    await nav.getByRole('link', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
  }
  await nav.getByRole('link', { name: 'Catalogo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Il vostro catalogo.' })).toBeVisible()
  await page.locator(test.info().project.name === 'mobile' ? '.mobile-brand' : '.brand').click()
  await expect(page).toHaveURL(/\/liste$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/catalogo$/)
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
  await page
    .locator('nav')
    .getByRole('link', { name: 'Catalogo', exact: true })
    .filter({ visible: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Il vostro catalogo.' })).toBeVisible()
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
  await page.goto('/')
  await expect(page).toHaveURL(/\/liste$/)
  await expect(page.getByRole('button', { name: 'Rimuovi dalla lista Latte' })).toBeVisible()
  await page.goto('/liste/vecchia-lista')
  await expect(page.getByRole('button', { name: 'Rimuovi dalla lista Latte' })).toBeVisible()
  await expect(page.locator('nav a[aria-current="page"]').filter({ visible: true })).toHaveText([
    'Lista della spesa',
  ])
  await expect(page.getByRole('button', { name: 'Segna lista completata' })).toHaveCount(0)
  await page.goto('/prezzi')
  await expect(page.getByRole('combobox', { name: 'Lista', exact: true })).toHaveCount(0)
  await expect(page.getByText('Confronta il costo della lista', { exact: true })).toBeVisible()
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

test('aggiunta articolo libero senza registrare acquisti', async ({ page }) => {
  const { itemRequests, purchaseRequests } = await login(page, true)
  await page.goto('/liste')
  await page.getByLabel('Nome per articolo libero').fill('Pane')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByText('Pane', { exact: true })).toBeVisible()
  expect(itemRequests[0]).toMatchObject({ p_name: 'Pane', p_unit: 'pz' })
  expect(purchaseRequests).toHaveLength(0)
})
test('scanner rimosso dal menu: vecchio collegamento apre il catalogo, barcode manuale e checksum conservati', async ({
  page,
}) => {
  const { catalogSaveRequests } = await login(page)
  await page.route('**/api/products/*', (route) => route.fulfill({ json: { product: null } }))
  await page.goto('/scanner')
  await expect(page).toHaveURL(/\/catalogo$/)
  await expect(page.getByRole('link', { name: 'Scanner', exact: true })).toHaveCount(0)
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('12345678')
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(page.getByText('Il checksum EAN non è valido.', { exact: false })).toBeVisible()
  await page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true }).fill('8000500037560')
  await page.getByRole('button', { name: 'Cerca dati dal barcode' }).click()
  await expect(
    page.getByText('Prodotto non trovato nelle banche dati consultate.', { exact: false }),
  ).toBeVisible()
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
test('accessibilità essenziale della schermata iniziale lista', async ({ page }) => {
  await login(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'La lista della spesa.' })).toBeVisible()
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
  await page.goto('/negozi')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Elimina categoria Dispensa', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Elimina categoria Dispensa', exact: true })).toHaveCount(0)
  await page.goto('/catalogo')
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
  await page.getByRole('combobox', { name: 'Prodotto dal catalogo', exact: true }).fill('Latte')
  await expect(
    page.getByRole('listbox').getByRole('option', { name: 'Latte intero', exact: true }),
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

test('rimuovi dalla lista: storico precedente e catalogo conservati, ripristino', async ({ page }) => {
  const deletions: string[] = []
  await login(page, true, {
    ...productCatalog,
    purchases: [
      {
        id: 'old-purchase',
        list_item_id: 'item',
        quantity: '0.5',
        unit: 'L',
        total_paid: '2.50',
        purchased_at: '2026-11-20T12:00:00Z',
        voided_at: null,
      },
    ],
  })
  page.on('request', (r) => {
    if (r.method() === 'DELETE') deletions.push(r.url())
  })
  await page.goto('/liste')
  await expect(page.locator('.shopping-item')).toContainText('1.5 l da acquistare')
  await page.getByRole('button', { name: 'Rimuovi dalla lista Latte', exact: true }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.shopping-item')).toHaveCount(0)
  await page.getByLabel('Mostra articoli rimossi', { exact: true }).check()
  await page.getByRole('button', { name: 'Rimetti nella lista', exact: true }).click()
  await expect(page.locator('.shopping-item')).toContainText('1.5 l da acquistare')
  await page.goto('/catalogo')
  await expect(page.getByRole('row', { name: /^Latte intero/ })).toBeVisible()
  expect(deletions).toHaveLength(0)
})

test('rimuovi dalla lista: offline e errore conservano articolo', async ({ page, context }) => {
  await login(page, true)
  await page.goto('/liste')
  const remove = page.getByRole('button', { name: 'Rimuovi dalla lista Latte', exact: true })
  await page.route('**/rest/v1/rpc/set_record_archived', (route) =>
    route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } }),
  )
  await remove.click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(page.locator('.shopping-item')).toContainText('Latte')
  await context.setOffline(true)
  await expect(remove).toBeDisabled()
})

test('statistiche rimosse: vecchi collegamenti aprono la lista', async ({ page }) => {
  await login(page)
  await page.goto('/statistiche')
  await expect(page).toHaveURL(/\/liste$/)
  await expect(page.getByRole('heading', { name: 'La lista della spesa.', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Statistiche', exact: true })).toHaveCount(0)
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

for (const archived of [false, true]) {
  test(`pasti: elimina piano ${archived ? 'archiviato' : 'attivo'}, conserva altra settimana e permette di ricrearlo`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') })
    const { catalogDeleteRequests } = await login(page, true, {
      ...productCatalog,
      meal_plans: [
        {
          id: 'plan',
          week_start: '2026-11-16',
          linked_list_id: '20000000-0000-4000-8000-000000000001',
          version: 1,
          archived_at: archived ? '2026-11-15' : null,
        },
        { id: 'other-plan', week_start: '2026-11-23', version: 1, archived_at: null },
      ],
      recipes: [{ id: 'recipe', title: 'Ricetta conservata', base_servings: 2, instructions: '' }],
      meal_entries: [
        {
          id: 'entry',
          meal_plan_id: 'plan',
          generic_product_id: 'generic-milk',
          quantity: '1',
          unit: 'L',
          meal_date: '2026-11-18',
          meal_slot: 'pranzo',
        },
        {
          id: 'other-entry',
          meal_plan_id: 'other-plan',
          recipe_id: 'recipe',
          meal_date: '2026-11-23',
          meal_slot: 'pranzo',
        },
      ],
      meal_templates: [{ id: 'template', name: 'Modello conservato', entries_json: [] }],
      purchases: [
        {
          id: 'purchase',
          list_item_id: 'item',
          quantity: '0.5',
          unit: 'L',
          total_paid: '2',
          voided_at: null,
          purchased_at: '2026-11-18T12:00:00Z',
        },
      ],
    })
    await page.goto('/pasti')
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('16/11/2026')
      expect(dialog.message()).toContain('22/11/2026')
      expect(dialog.message()).toContain('quantità già trasferite')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Elimina piano settimanale', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Crea piano settimanale', exact: true })).toBeVisible()
    await expect(page.locator('.week-grid')).toHaveCount(0)
    expect(catalogDeleteRequests).toEqual([{ table: 'meal_plans', id: 'plan' }])
    await page.reload()
    await page.getByRole('button', { name: 'Crea piano settimanale', exact: true }).click()
    await expect(page.locator('.week-grid')).toBeVisible()
    await expect(page.locator('.meal-chip')).toHaveCount(0)
    await expect(page.getByText('Modello conservato', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Settimana successiva', exact: true }).click()
    await expect(page.locator('.meal-chip')).toContainText('Ricetta conservata')
    await page.goto('/liste')
    await expect(page.locator('.shopping-item')).toContainText('Latte')
    await expect(page.locator('.shopping-item')).toContainText('1.5 l da acquistare')
  })
}

test('pasti: annullamento, errore e offline preservano il piano e la sua anteprima', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') })
  const { catalogDeleteRequests } = await login(page, false, {
    ...productCatalog,
    meal_plans: [{ id: 'plan', week_start: '2026-11-16', version: 1, archived_at: null }],
    meal_entries: [
      {
        id: 'entry',
        meal_plan_id: 'plan',
        generic_product_id: 'generic-milk',
        quantity: '1',
        unit: 'L',
        meal_date: '2026-11-18',
        meal_slot: 'pranzo',
      },
    ],
  })
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Calcola anteprima delle differenze', exact: true }).click()
  await expect(page.locator('.diff')).toBeVisible()
  const button = page.getByRole('button', { name: 'Elimina piano settimanale', exact: true })
  page.once('dialog', (dialog) => dialog.dismiss())
  await button.click()
  expect(catalogDeleteRequests).toHaveLength(0)
  await expect(page.locator('.diff')).toBeVisible()
  let fail = true
  await page.route('**/rest/v1/meal_plans?*', async (route) => {
    if (route.request().method() === 'DELETE' && fail) {
      fail = false
      await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    } else await route.fallback()
  })
  page.on('dialog', (dialog) => dialog.accept())
  await button.click()
  await expect(page.locator('.notice')).toContainText('Operazione non riuscita')
  await expect(page.locator('.diff')).toBeVisible()
  expect(catalogDeleteRequests).toHaveLength(0)
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(button).toBeDisabled()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByRole('button', { name: 'Crea piano settimanale', exact: true })).toBeVisible()
  await expect(page.locator('.diff')).toHaveCount(0)
  expect(catalogDeleteRequests).toHaveLength(1)
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

test('confronto attuale: prezzo mancante resta trattino e totale parziale', async ({ page }) => {
  await login(page, true, { stores: [{ id: 's', name: 'Negozio senza prezzi' }] })
  await page.goto('/prezzi')
  await expect(page).toHaveURL(/\/negozi\?confronto=1$/)
  const table = page.getByRole('table', { name: 'Confronto supermercati', exact: true })
  await expect(table).toContainText('Parziale')
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(1)).toContainText('-')
  await expect(page.getByLabel('Valido dal')).toHaveCount(0)
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
  await expect(page.getByLabel('EAN-8 / EAN-13 (facoltativo)', { exact: true })).toBeVisible()
})
