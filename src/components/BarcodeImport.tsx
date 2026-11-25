import { unitLabel } from '../domain/math'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../data/context'
import { validBarcode } from '../domain/math'
import { barcodeCategory, barcodeSources, type BarcodeProduct } from '../domain/barcodeLookup'
import { BarcodeCamera } from './BarcodeCamera'

export function BarcodeImport({
  readDraft,
  onApply,
  onOpen,
  onCodeOnly,
  initialCode = '',
  onConsumed,
}: {
  readDraft: () => FormData
  onApply: (product: BarcodeProduct, category: string) => void
  onOpen: (id: string) => void
  onCodeOnly: (code: string, message: string) => void
  initialCode?: string
  onConsumed: () => void
}) {
  const { data, busy, online } = useApp()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [candidate, setCandidate] = useState<BarcodeProduct | null>(null)
  const [existing, setExisting] = useState('')
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
      controller.current?.abort()
    },
    [],
  )
  const initialLookup = useRef<(code: string) => Promise<void>>(async () => {})
  const consumed = useRef(onConsumed)
  useEffect(() => {
    initialLookup.current = lookup
    consumed.current = onConsumed
  })
  useEffect(() => {
    let active = true
    if (initialCode)
      void Promise.resolve().then(() => {
        if (active) {
          consumed.current()
          void initialLookup.current(initialCode)
        }
      })
    return () => {
      active = false
    }
  }, [initialCode])
  function cancel() {
    generation.current++
    controller.current?.abort()
    setPending(false)
    setMessage('Ricerca annullata. I campi non sono stati modificati.')
  }
  async function lookup(raw: string) {
    const code = raw.trim()
    setMessage('')
    setCandidate(null)
    setExisting('')
    if (!validBarcode(code)) {
      setMessage('Il checksum EAN non è valido. Ricontrolla le cifre.')
      return
    }
    const local = data.specific_products.find((product) => product.barcode === code)
    if (local) {
      setExisting(local.id)
      setMessage(
        local.archived_at
          ? 'Questo prodotto è già nel catalogo ed è archiviato.'
          : 'Questo prodotto è già nel catalogo. Puoi aprire la sua scheda.',
      )
      return
    }
    if (!online) {
      setMessage('Sei offline. Puoi compilare i campi manualmente.')
      return
    }
    controller.current?.abort()
    const request = ++generation.current
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), 12000)
    setPending(true)
    try {
      const response = await fetch(`/api/products/${code}?scope=supermarket`, {
        signal: abort.signal,
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw Error('Ricerca non disponibile')
      const body = (await response.json()) as { product: BarcodeProduct | null }
      if (request !== generation.current) return
      const currentCode = String(readDraft().get('barcode') ?? '').trim()
      if (currentCode && currentCode !== code) {
        setMessage('Il campo EAN è cambiato durante la ricerca. Ripeti la ricerca del codice corretto.')
        return
      }
      if (!body.product) {
        onCodeOnly(
          code,
          'Prodotto non trovato nelle banche dati consultate. Il codice è stato inserito: completa gli altri campi manualmente.',
        )
        return
      }
      const product = body.product
      if (product.barcode !== code || typeof product.name !== 'string' || !Array.isArray(product.categories))
        throw Error('Risposta non valida')
      const draft = readDraft()
      if (String(draft.get('barcode') ?? '').trim() && String(draft.get('barcode')).trim() !== code) {
        setMessage('Il campo EAN è cambiato durante la ricerca. Ripeti la ricerca del codice corretto.')
        return
      }
      const dirty = ['name', 'brand', 'variant', 'size', 'unit'].some((field) =>
        String(draft.get(field) ?? '').trim(),
      )
      if (dirty) {
        setCandidate(product)
        setMessage('Dati trovati. Hai già compilato dei campi: scegli se sostituirli con quelli trovati.')
        return
      }
      onApply(
        product,
        String(draft.get('category') ?? '') || barcodeCategory(data.categories, product.categories),
      )
    } catch {
      if (request === generation.current) {
        if (!String(readDraft().get('barcode') ?? '').trim())
          onCodeOnly(
            code,
            'Codice acquisito, ma la ricerca non è disponibile. Riprova oppure completa i dati manualmente.',
          )
        else setMessage('Ricerca non disponibile. Riprova oppure completa i dati manualmente.')
      }
    } finally {
      clearTimeout(timeout)
      if (request === generation.current) setPending(false)
    }
  }
  return (
    <section aria-label="Compilazione da barcode" className="form">
      <BarcodeCamera disabled={pending || busy} onDetected={(code) => void lookup(code)} />
      <p className="muted">
        Oppure scrivi il codice nel campo EAN e premi Cerca dati. Le immagini non vengono inviate alla banca
        dati.
      </p>
      <div className="inline">
        <button
          type="button"
          className="button secondary"
          disabled={pending || busy}
          onClick={() => void lookup(String(readDraft().get('barcode') ?? ''))}
        >
          {pending ? 'Ricerca in corso…' : 'Cerca dati dal barcode'}
        </button>
        {pending && (
          <button type="button" className="text-button" onClick={cancel}>
            Annulla ricerca
          </button>
        )}
      </div>
      {message && (
        <p className="callout" role="status">
          {message}
        </p>
      )}
      {existing && (
        <button type="button" className="text-button" onClick={() => onOpen(existing)}>
          Apri scheda esistente
        </button>
      )}
      {candidate && (
        <div className="callout">
          <p>
            <strong>{candidate.name || 'Nome non disponibile'}</strong> ·{' '}
            {candidate.brand || 'Marca non disponibile'}
          </p>
          <p>
            {candidate.size
              ? `${candidate.size} ${unitLabel(candidate.unit ?? '')}`
              : 'Formato non disponibile'}
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => onApply(candidate, barcodeCategory(data.categories, candidate.categories))}
          >
            Usa dati trovati
          </button>
        </div>
      )}
      <small>
        Dati da{' '}
        {Object.values(barcodeSources).map((source, index) => (
          <span key={source.origin}>
            {index > 0 && ', '}
            <a href={source.origin} target="_blank" rel="noreferrer">
              {source.name}
            </a>
          </span>
        ))}{' '}
        (
        <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
          ODbL
        </a>
        ). Verifica i campi prima di salvare.
      </small>
    </section>
  )
}
