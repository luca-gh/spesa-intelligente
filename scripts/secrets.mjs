import { readdirSync, readFileSync, statSync } from 'node:fs'
const ignored = new Set(['node_modules', '.tools', '.git', 'test-results', 'playwright-report', 'coverage'])
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{25,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
]
let count = 0
function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (
      ignored.has(name) ||
      name.startsWith('.env') ||
      name.endsWith('.pdf') ||
      name === 'SPECIFICHE_SPESA_INTELLIGENTE_CODEX.md'
    )
      continue
    const file = `${directory}/${name}`
    if (statSync(file).isDirectory()) {
      walk(file)
      continue
    }
    if (!/\.(?:ts|tsx|js|mjs|json|html|css|md|yml|sql)$/.test(name)) continue
    const body = readFileSync(file, 'utf8')
    count++
    if (patterns.some((p) => p.test(body)))
      throw new Error(`Possibile segreto in ${file}. Verificare prima della pubblicazione.`)
    for (const token of body.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      try {
        if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role === 'service_role')
          throw new Error('privileged')
      } catch (error) {
        if (error.message === 'privileged') throw new Error(`JWT privilegiato in ${file}`, { cause: error })
      }
    }
  }
}
walk('.')
console.log(
  `Controllo segreti: ${count} file esaminati, nessun pattern rilevato. Non sostituisce una revisione manuale.`,
)
