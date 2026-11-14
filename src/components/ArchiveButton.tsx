import { rpc } from '../data/client'
import { ConfirmButton } from './ui'

type ArchiveTable =
  | 'generic_products'
  | 'specific_products'
  | 'recipes'
  | 'stores'
  | 'meal_plans'
  | 'shopping_list_items'
  | 'price_estimate_snapshots'

export function ArchiveButton({
  table,
  record,
  onDone,
}: {
  table: ArchiveTable
  record: { id: string; archived_at?: string | null; version?: number }
  onDone?: () => void
}) {
  const archived = !!record.archived_at
  return (
    <ConfirmButton
      message={
        archived
          ? 'Ripristinare questo elemento?'
          : 'Archiviare questo elemento? Scomparirà dalle viste attive. I dati collegati, gli acquisti e le quantità già trasferite alle liste saranno conservati.'
      }
      success={
        archived
          ? 'Elemento ripristinato.'
          : 'Elemento archiviato. Puoi ripristinarlo dalla vista degli archiviati.'
      }
      onConfirm={async () => {
        await rpc('set_record_archived', {
          p_type: table,
          p_id: record.id,
          p_archived: !archived,
          p_version: record.version ?? null,
        })
        onDone?.()
      }}
    >
      {archived ? 'Ripristina' : 'Archivia'}
    </ConfirmButton>
  )
}

export function ArchiveFilter({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Mostra archiviati
    </label>
  )
}
