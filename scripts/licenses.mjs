import { readFileSync, writeFileSync } from 'node:fs'
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const rows = Object.entries(lock.packages)
  .filter(([key]) => key)
  .map(
    ([key, value]) =>
      `| ${key.replace('node_modules/', '')} | ${value.version} | ${value.license || 'Verificare il pacchetto'} |`,
  )
writeFileSync(
  'DEPENDENCIES.md',
  '# Dipendenze e licenze\n\nGenerato dal lockfile con `npm run licenses`. Le licenze complete sono nei pacchetti distribuiti.\n\n| Pacchetto | Versione | Licenza |\n| --- | --- | --- |\n' +
    rows.join('\n') +
    '\n',
)
