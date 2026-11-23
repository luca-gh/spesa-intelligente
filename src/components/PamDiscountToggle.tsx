import { useApp } from '../data/context'
import { update } from '../data/client'
import type { Store } from '../data/types'
import { isPam } from '../domain/storePrices'
import { useState } from 'react'

export function PamDiscountToggle({ store }: { store: Store }) {
  const { act, busy, online } = useApp()
  const [pending, setPending] = useState<boolean | null>(null)
  if (!isPam(store)) return null
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={pending ?? store.pam_discount_enabled ?? false}
        disabled={busy || !online || !!store.archived_at}
        onChange={(event) => {
          const checked = event.target.checked
          setPending(checked)
          void act(() => update('stores', store.id, { pam_discount_enabled: checked })).finally(() =>
            setPending(null),
          )
        }}
      />
      Calcola sconto PAM del 10% · {store.name}
    </label>
  )
}
