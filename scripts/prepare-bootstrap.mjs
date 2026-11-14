import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Convenience for a new, empty project when no migration connector/CLI is available.
// This generates a local SQL script only; it never connects or executes statements.
const directory = 'supabase/migrations'
const files = readdirSync(directory)
  .filter((name) => /^\d+_[a-z_]+\.sql$/.test(name))
  .sort()
const guard = `do $$ begin
  if to_regclass('public.households') is not null or to_regclass('public.shopping_lists') is not null then
    raise exception 'Bootstrap annullato: schema applicativo già presente. Usare le migrazioni versionate.';
  end if;
end $$;`
const body = [
  '-- Spesa Intelligente: bootstrap per un progetto vuoto, generato dalle migrazioni versionate.',
  '-- Non eseguire se lo schema applicativo esiste già. Il file non contiene credenziali o dati personali.',
  '-- Usando SQL Editor, la cronologia CLI non viene aggiornata: seguire README prima di passare a db push.',
  'begin;',
  guard,
  ...files.map(
    (file) => `\n-- BEGIN ${file}\n${readFileSync(join(directory, file), 'utf8')}\n-- END ${file}`,
  ),
  'commit;',
].join('\n\n')
mkdirSync('.tools', { recursive: true })
writeFileSync('.tools/supabase-bootstrap.sql', body, 'utf8')
console.log(
  `Preparato .tools/supabase-bootstrap.sql da ${files.length} migrazioni. Nessuna istruzione eseguita sul database.`,
)
