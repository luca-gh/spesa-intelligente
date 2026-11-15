import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/context'
import { validBarcode } from '../domain/math'
import { BarcodeCamera } from './BarcodeCamera'

export function ListBarcodePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, busy, online } = useApp()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [missing, setMissing] = useState('')
  const [archived, setArchived] = useState(false)
  const [cameraRevision, setCameraRevision] = useState(0)
  function find(raw: string) {
    if (busy || !online) return
    setCameraRevision((value) => value + 1)
    const barcode = raw.trim()
    setCode(barcode)
    setMissing('')
    setArchived(false)
    if (!validBarcode(barcode)) {
      setMessage('Il checksum EAN non è valido. Ricontrolla le cifre.')
      return
    }
    const product = data.specific_products.find((p) => p.barcode === barcode)
    if (product && !product.archived_at) {
      onSelect(product.id)
      setMessage(`${product.name} selezionato. Controlla quantità e unità, poi premi Aggiungi.`)
    } else {
      setMissing(barcode)
      setArchived(!!product)
      setMessage(
        product
          ? 'Il prodotto è archiviato. Ripristinalo dal Catalogo prima di aggiungerlo alla lista.'
          : 'Questo codice non è ancora nel Catalogo. Puoi completare la scheda e tornare alla lista, oppure continuare con un articolo libero.',
      )
    }
  }
  return (
    <section className="list-barcode-picker" aria-label="Aggiungi alla lista da barcode">
      <BarcodeCamera key={cameraRevision} disabled={busy || !online} onDetected={find} />
      <details>
        <summary>Inserisci il barcode manualmente</summary>
        <form
          className="inline-form"
          aria-label="Cerca barcode per la lista"
          onSubmit={(event) => {
            event.preventDefault()
            find(code)
          }}
        >
          <label className="field">
            <span>Barcode per la lista</span>
            <input
              value={code}
              inputMode="numeric"
              pattern="[0-9]{8}|[0-9]{13}"
              required
              disabled={busy || !online}
              onChange={(event) => {
                setCode(event.target.value)
                setMissing('')
                setMessage('')
              }}
            />
          </label>
          <button type="submit" className="button secondary" disabled={busy || !online}>
            Cerca barcode
          </button>
        </form>
      </details>
      {message && (
        <p className="callout" role="status">
          {message}
        </p>
      )}
      {missing && (
        <Link
          className="text-link"
          to={`/catalogo?barcode=${encodeURIComponent(missing)}${archived ? '' : '&origine=lista'}`}
        >
          {archived ? 'Apri prodotto nel Catalogo' : 'Completa prodotto e torna alla lista'}
        </Link>
      )}
    </section>
  )
}
