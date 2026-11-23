import { useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useApp } from '../data/context'
import { rpc, update } from '../data/client'
import { storeCategories } from '../data/catalog'
import { ConfirmButton } from './ui'

interface Drag {
  pointer: number
  id: string
  ids: string[]
  original: string[]
  expected: Record<string, number>
}
const move = (ids: string[], from: string, to: string) => {
  const result = [...ids]
  const index = result.indexOf(from)
  const target = result.indexOf(to)
  if (index < 0 || target < 0) return ids
  result.splice(index, 1)
  result.splice(target, 0, from)
  return result
}

export function CategoryOrder({ storeId }: { storeId?: string }) {
  const { data, household, act, busy, online, refresh } = useApp()
  const categories = storeCategories(data, storeId ?? '')
  const drag = useRef<Drag | null>(null)
  const saving = useRef(false)
  const [preview, setPreview] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState('')
  const [message, setMessage] = useState('')
  const disabled = busy || !online
  const visible = preview
    ? preview.map((id) => categories.find((c) => c.id === id)).filter((c) => !!c)
    : categories
  const snapshot = () => Object.fromEntries(categories.map((c) => [c.id, c.sort_order]))
  async function save(ids: string[], expected: Record<string, number>, focus: string) {
    if (saving.current || disabled) {
      setPreview(null)
      return
    }
    saving.current = true
    setPreview(ids)
    const ok = await act(
      () =>
        rpc(storeId ? 'reorder_store_categories' : 'reorder_categories', {
          ...(storeId ? { p_store: storeId } : { p_household: household!.id }),
          p_ids: ids,
          p_expected: expected,
        }),
      'Ordine delle categorie salvato.',
    )
    if (!ok) await refresh().catch(() => {})
    setPreview(null)
    setMessage(
      ok
        ? 'Ordine salvato. La lista della spesa segue questo ordine.'
        : 'Ordine non salvato. Controlla il messaggio e riprova.',
    )
    saving.current = false
    requestAnimationFrame(() =>
      document.getElementById(`category-handle-${focus}`)?.focus({ preventScroll: true }),
    )
  }
  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (disabled || saving.current || event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.closest('ol')!.setPointerCapture(event.pointerId)
    const ids = categories.map((c) => c.id)
    drag.current = { pointer: event.pointerId, id, ids, original: ids, expected: snapshot() }
    setDragging(id)
    setMessage('Trascina la categoria nella posizione desiderata e rilasciala. Esc annulla.')
  }
  function pointerMove(event: PointerEvent<HTMLOListElement>) {
    const active = drag.current
    if (!active || active.pointer !== event.pointerId) return
    event.preventDefault()
    if (event.clientY < 60) window.scrollBy(0, -18)
    else if (event.clientY > window.innerHeight - 60) window.scrollBy(0, 18)
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-category-id]')?.dataset.categoryId
    if (!target || !active.ids.includes(target) || target === active.id) return
    active.ids = move(active.ids, active.id, target)
    setPreview(active.ids)
  }
  function finish(event: PointerEvent<HTMLOListElement>, cancelled: boolean) {
    const active = drag.current
    if (!active || event.pointerId !== active.pointer) return
    drag.current = null
    setDragging('')
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled || active.ids.join() === active.original.join()) {
      setPreview(null)
      setMessage(cancelled ? 'Spostamento annullato.' : '')
    } else void save(active.ids, active.expected, active.id)
  }
  function step(id: string, delta: number) {
    const ids = categories.map((c) => c.id)
    const target = ids[ids.indexOf(id) + delta]
    if (target && !drag.current) void save(move(ids, id, target), snapshot(), id)
  }
  return (
    <>
      <p id="category-order-help" className="muted">
        Trascina la maniglia per cambiare l’ordine delle categorie, anche nella lista della spesa. Puoi anche
        usare le frecce su e giù.
      </p>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      <ol
        className="category-order"
        aria-label="Ordine delle categorie"
        onPointerMove={pointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e, true)}
      >
        {visible.map((category, index) => (
          <li
            key={category.id}
            data-category-id={category.id}
            className={`category-order-row${dragging === category.id ? ' dragging' : ''}`}
          >
            <button
              type="button"
              id={`category-handle-${category.id}`}
              className="category-drag-handle"
              aria-label={`Sposta categoria ${category.name}`}
              aria-describedby="category-order-help"
              disabled={disabled}
              onPointerDown={(e) => start(e, category.id)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && drag.current) {
                  drag.current = null
                  setDragging('')
                  setPreview(null)
                  setMessage('Spostamento annullato.')
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  step(category.id, event.key === 'ArrowUp' ? -1 : 1)
                }
              }}
            >
              <GripVertical size={22} />
            </button>
            <strong className="category-order-name">
              <span className="muted">{index + 1}.</span> {category.name}
            </strong>
            <div className="category-order-actions">
              <button
                type="button"
                className="category-step"
                aria-label={`Sposta ${category.name} su`}
                disabled={disabled || !!dragging || index === 0}
                onClick={() => step(category.id, -1)}
              >
                <ArrowUp size={18} />
              </button>
              <button
                type="button"
                className="category-step"
                aria-label={`Sposta ${category.name} giù`}
                disabled={disabled || !!dragging || index === visible.length - 1}
                onClick={() => step(category.id, 1)}
              >
                <ArrowDown size={18} />
              </button>
              <button
                type="button"
                className="text-button"
                disabled={disabled || !!dragging}
                aria-label={`Rinomina categoria ${category.name}`}
                onClick={() => {
                  const name = prompt('Rinomina categoria', category.name)
                  if (name?.trim()) void act(() => update('categories', category.id, { name: name.trim() }))
                }}
              >
                Rinomina
              </button>
              <ConfirmButton
                message={`Eliminare la categoria «${category.name}»? I prodotti resteranno nel catalogo, sotto Altri prodotti.`}
                success="Categoria eliminata. I prodotti sono conservati in Altri prodotti."
                onConfirm={() => rpc('delete_category', { p_id: category.id })}
              >
                Elimina categoria {category.name}
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
