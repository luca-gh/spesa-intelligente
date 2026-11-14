import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium, expect } from 'playwright/test'
const root = resolve('dist')
let version = 1
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end()
      return
    }
    if (url.pathname === '/' || !extname(path)) path = resolve(root, 'index.html')
    await stat(path)
    let body = await readFile(path)
    if (url.pathname === '/sw.js')
      body = Buffer.concat([body, Buffer.from(`\n// PWA update test version ${version}\n`)])
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(base)
  await page.waitForFunction(async () => {
    const registered = await navigator.serviceWorker.ready
    return registered.active?.state === 'activated'
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await expect(page.locator('main.access')).toBeVisible()
  version = 2
  // The actual application foreground handler must find the changed worker.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  const button = page.getByRole('button', { name: 'Aggiorna app', exact: true })
  await expect(button).toBeVisible({ timeout: 20000 })
  await button.click()
  await expect(button).toHaveCount(0, { timeout: 20000 })
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated')
  await expect(page.locator('main.access')).toBeVisible()
  console.log(
    JSON.stringify({
      serviceWorker: true,
      foregroundUpdate: true,
      prompt: true,
      activation: true,
      result: 'PASS',
    }),
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
