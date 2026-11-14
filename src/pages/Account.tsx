import { ArchiveButton, ArchiveFilter } from '../components/ArchiveButton'
import { useEffect, useRef, useState } from 'react'
import Decimal from 'decimal.js'
import { Camera, Download, KeyRound, ScanLine } from 'lucide-react'
import { useApp } from '../data/context'
import { client, requireClient, rpc, update } from '../data/client'
import { dateInZone, euro, validBarcode } from '../domain/math'
import { statistics } from '../domain/planning'
import { ConfirmButton, Empty, Field, Form, Panel, SectionTitle, Submit, text } from '../components/ui'

export function Stats() {
  const [archived, setArchived] = useState(false)
  const { data, household } = useApp()
  const today = dateInZone(new Date(), household!.timezone)
  const [from, setFrom] = useState(today.slice(0, 7) + '-01')
  const [to, setTo] = useState(today)
  const result = statistics(data.purchases, from, to, household!.timezone)
  const selected = data.purchases.filter(
    (p) =>
      !p.voided_at &&
      dateInZone(new Date(p.purchased_at), household!.timezone) >= from &&
      dateInZone(new Date(p.purchased_at), household!.timezone) <= to,
  )
  const days = [
    ...new Set(selected.map((p) => dateInZone(new Date(p.purchased_at), household!.timezone))),
  ].sort()
  const totals = days.map((day) => ({
    day,
    total: selected
      .filter((p) => dateInZone(new Date(p.purchased_at), household!.timezone) === day)
      .reduce((sum, p) => sum.plus(p.total_paid ?? 0), new Decimal(0))
      .toString(),
  }))
  const max = Math.max(...totals.map((t) => Number(t.total)), 1)
  const categories = new Map<string, Decimal>()
  for (const p of selected) {
    const item = data.shopping_list_items.find((i) => i.id === p.list_item_id)
    const specific = data.specific_products.find(
      (s) => s.id === (p.specific_product_id ?? item?.specific_product_id),
    )
    const product = data.generic_products.find(
      (g) => g.id === (item?.generic_product_id ?? specific?.generic_product_id),
    )
    const category = data.categories.find((c) => c.id === product?.category_id)?.name ?? 'Altri prodotti'
    categories.set(category, (categories.get(category) ?? new Decimal(0)).plus(p.total_paid ?? 0))
  }
  return (
    <>
      <SectionTitle eyebrow="SOLO LA SPESA CHE AVETE FATTO DAVVERO" title="Uno sguardo alle abitudini." />
      <Panel title="Periodo">
        <div className="grid-form">
          <label className="field">
            Dal
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            Al
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="inline">
          <button
            className="text-button"
            onClick={() => {
              const d = new Date(today + 'T12:00:00Z')
              d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
              setFrom(d.toISOString().slice(0, 10))
              setTo(today)
            }}
          >
            Settimana
          </button>
          <button
            className="text-button"
            onClick={() => {
              setFrom(today.slice(0, 7) + '-01')
              setTo(today)
            }}
          >
            Mese
          </button>
          <button
            className="text-button"
            onClick={() => {
              setFrom(today.slice(0, 4) + '-01-01')
              setTo(today)
            }}
          >
            Anno
          </button>
        </div>
      </Panel>
      <div className="metrics compact">
        <div className="metric">
          <span>Totale effettivo</span>
          <strong>{euro(result.total)}</strong>
          <small>{result.unpriced ? 'Copertura parziale' : 'Importi reali, annullamenti esclusi'}</small>
        </div>
        <div className="metric">
          <span>Acquisti registrati</span>
          <strong>{result.count}</strong>
          <small>Ogni acquisto contato una sola volta</small>
        </div>
        <div className="metric">
          <span>Prezzi da completare</span>
          <strong>{result.unpriced}</strong>
          <small>Esclusi dal totale economico</small>
        </div>
      </div>
      <Panel title="Andamento della spesa">
        {totals.length ? (
          <div
            className="bar-chart"
            role="img"
            aria-label="Spesa giornaliera. Valori riportati per ogni data."
          >
            {totals.map((t) => (
              <div className="bar-row" key={t.day}>
                <span>
                  {new Date(t.day + 'T12:00:00').toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <div className="bar-track">
                  <div style={{ width: `${(Number(t.total) / max) * 100}%` }} />
                </div>
                <strong>{euro(t.total)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Le vostre abitudini prendono forma, un acquisto alla volta">
            Registra il pagato durante la spesa per vedere i primi dati.
          </Empty>
        )}
      </Panel>
      <div className="two-columns">
        <Panel title="Per categoria">
          {[...categories].map(([name, total]) => (
            <div className="data-row" key={name}>
              <span>{name}</span>
              <strong>{euro(total.toString())}</strong>
            </div>
          ))}
        </Panel>
        <Panel title="Per punto vendita">
          {[...data.stores.map((s) => ({ id: s.id, name: s.name })), { id: '', name: 'Non specificato' }].map(
            (s) => {
              const purchases = selected.filter((p) => (p.store_id ?? '') === s.id)
              return purchases.length > 0 ? (
                <div className="data-row" key={s.id}>
                  <span>{s.name}</span>
                  <strong>
                    {euro(
                      purchases.reduce((sum, p) => sum.plus(p.total_paid ?? 0), new Decimal(0)).toString(),
                    )}
                  </strong>
                </div>
              ) : null
            },
          )}
        </Panel>
      </div>
      <Panel title="Per lista">
        {data.shopping_lists.map((l) => {
          const purchases = selected.filter(
            (p) => data.shopping_list_items.find((i) => i.id === p.list_item_id)?.list_id === l.id,
          )
          return purchases.length ? (
            <div className="data-row" key={l.id}>
              <span>{l.title}</span>
              <strong>
                {euro(purchases.reduce((s, p) => s.plus(p.total_paid ?? 0), new Decimal(0)).toString())}
              </strong>
            </div>
          ) : null
        })}
      </Panel>
      <Panel title="Previsioni salvate e spesa effettiva">
        <p className="muted">
          Le stime sono snapshot storici immutabili. La differenza aggregata include variazioni di quantità e
          acquisti registrati dopo la previsione; non è una misura pura della variazione prezzi.
        </p>
        <ArchiveFilter value={archived} onChange={setArchived} />
        {data.price_estimate_snapshots
          .filter((s) => !!s.archived_at === archived)
          .map((s) => {
            const purchases = data.purchases.filter(
              (p) =>
                !p.voided_at &&
                p.store_id === s.store_id &&
                p.purchased_at >= s.created_at &&
                data.shopping_list_items.find((i) => i.id === p.list_item_id)?.list_id === s.list_id,
            )
            const actual = purchases.reduce((sum, p) => sum.plus(p.total_paid ?? 0), new Decimal(0))
            return (
              <details key={s.id}>
                <summary>
                  {data.shopping_lists.find((l) => l.id === s.list_id)?.title} ·{' '}
                  {data.stores.find((st) => st.id === s.store_id)?.name} ·{' '}
                  {new Date(s.created_at).toLocaleString('it-IT', { timeZone: household!.timezone })}
                </summary>
                <p>
                  Previsto: {euro(s.estimated_total)} · copertura {Math.round(s.coverage * 100)}% · spesa
                  prevista il {s.shopping_date}
                </p>
                <p>
                  Pagato registrato dopo lo snapshot: {euro(actual.toString())} · differenza{' '}
                  {euro(actual.minus(s.estimated_total).toString())}
                  {purchases.some((p) => p.total_paid === null) && ' · pagato parziale'}
                </p>
                <pre>{JSON.stringify(s.detail_json, null, 2)}</pre>
                <ArchiveButton table="price_estimate_snapshots" record={s} />
              </details>
            )
          })}
        {!data.price_estimate_snapshots.length && (
          <p className="muted">Salva una previsione dal confronto prezzi prima di fare la spesa.</p>
        )}
      </Panel>
    </>
  )
}
function download(name: string, body: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
export function Account() {
  const { data, household, session, act } = useApp()
  const [token, setToken] = useState('')
  return (
    <>
      <SectionTitle eyebrow="LO SPAZIO CHE CONDIVIDETE" title="Famiglia e impostazioni." />
      <div className="two-columns">
        <Panel title="La vostra famiglia">
          <Form
            onSave={(f) =>
              update('households', household!.id, {
                name: text(f, 'name'),
                default_diners: Number(text(f, 'diners')),
                timezone: text(f, 'timezone'),
              })
            }
          >
            <Field label="Nome" name="name" value={household!.name} />
            <Field
              label="Numero predefinito di persone"
              name="diners"
              type="number"
              min={1}
              max={100}
              value={household!.default_diners}
            />
            <label className="field">
              Fuso orario
              <select name="timezone" defaultValue={household!.timezone}>
                <option>Europe/Rome</option>
                <option>Europe/London</option>
                <option>UTC</option>
              </select>
            </label>
            <Submit />
          </Form>
        </Panel>
        <Panel title="Invita una persona">
          <p>
            Genera un codice monouso, valido per 48 ore. Condividilo personalmente con chi vuoi invitare.
            Nessuna email di attività viene inviata.
          </p>
          <button
            className="button"
            onClick={() =>
              void act(async () => {
                setToken((await rpc('create_invite', { p_household: household!.id })) as string)
              }, 'Invito creato. Condividi il codice in modo privato.')
            }
          >
            Genera codice di invito
          </button>
          {token && (
            <label className="field">
              Codice privato da condividere
              <textarea readOnly value={token} rows={3} />
            </label>
          )}
          {data.household_invites
            .filter((i) => !i.accepted_at && !i.revoked_at && i.expires_at > new Date().toISOString())
            .map((i) => (
              <div className="data-row" key={i.id}>
                <span>
                  Scade {new Date(i.expires_at).toLocaleString('it-IT', { timeZone: household!.timezone })}
                </span>
                <ConfirmButton
                  message="Revocare questo invito?"
                  onConfirm={async () => {
                    await rpc('revoke_invite', { p_id: i.id })
                    setToken('')
                  }}
                >
                  Revoca
                </ConfirmButton>
              </div>
            ))}
        </Panel>
      </div>
      <Panel title="Account e password">
        <p>{session?.user.email}</p>
        <Form
          className="inline-form"
          onSave={async (f) => {
            const password = text(f, 'password')
            if (password.length < 12)
              throw new Error('Quantità non valida: usa almeno 12 caratteri per la password.')
            const { error } = await requireClient().auth.updateUser({ password })
            if (error) throw error
          }}
        >
          <Field label="Nuova password (almeno 12 caratteri)" name="password" type="password" />
          <Submit>
            <KeyRound size={17} /> Aggiorna password
          </Submit>
        </Form>
        <div className="inline">
          <button className="text-button" onClick={() => void act(() => requireClient().auth.signOut())}>
            Esci dall’account
          </button>
          <ConfirmButton
            message="Uscire dalla famiglia? Perderai immediatamente l’accesso ai suoi dati. I dati condivisi rimangono agli altri membri."
            onConfirm={() => rpc('leave_household', { p_household: household!.id })}
          >
            Lascia famiglia
          </ConfirmButton>
        </div>
      </Panel>
      <Panel title="Esporta e conserva una copia">
        <p>
          L’esportazione contiene i dati privati della famiglia. Conservala in un posto sicuro. Non include
          token di accesso o immagini. Il ripristino controllato è una fase successiva.
        </p>
        <div className="inline">
          <button
            className="button secondary"
            onClick={() =>
              download(
                `spesa-export-${dateInZone()}.json`,
                JSON.stringify(
                  {
                    schema_version: 1,
                    exported_at: new Date().toISOString(),
                    household,
                    ...Object.fromEntries(
                      Object.entries(data).filter(([key]) => key !== 'household_invites'),
                    ),
                  },
                  null,
                  2,
                ),
              )
            }
          >
            <Download size={18} /> Esporta JSON
          </button>
          <button
            className="button secondary"
            onClick={() => {
              const rows = [
                ['id', 'data', 'quantita', 'unita', 'pagato_eur', 'annullato'],
                ...data.purchases.map((p) => [
                  p.id,
                  p.purchased_at,
                  p.quantity,
                  p.unit,
                  p.total_paid ?? '',
                  p.voided_at ?? '',
                ]),
              ]
              const csv = rows
                .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
                .join('\r\n')
              download('acquisti.csv', '\ufeff' + csv, 'text/csv;charset=utf-8')
            }}
          >
            Esporta acquisti CSV
          </button>
        </div>
      </Panel>
      <Panel title="Eliminazione dati e account">
        <p>
          I dati appartengono alla famiglia e restano condivisi quando un membro esce. L’eliminazione
          definitiva della famiglia richiede che rimanga un solo membro, esportazione preventiva e conferma
          del nome.
        </p>
        <ConfirmButton
          message="Eliminare definitivamente tutti i dati della famiglia? Prosegui solo dopo aver esportato una copia."
          onConfirm={async () => {
            const confirmation = prompt('Scrivi esattamente il nome della famiglia per confermare')
            if (confirmation !== household!.name) return
            await rpc('delete_household', { p_household: household!.id, p_confirmation: confirmation })
          }}
        >
          Elimina definitivamente famiglia
        </ConfirmButton>
        <p className="muted">
          La cancellazione dell’identità Auth va richiesta al gestore del progetto Supabase dopo l’uscita o la
          cancellazione della famiglia. Non è ancora disponibile un endpoint self-service di cancellazione
          account.
        </p>
      </Panel>
    </>
  )
}
interface DetectorResult {
  rawValue: string
}
interface Detector {
  detect: (video: HTMLVideoElement) => Promise<DetectorResult[]>
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector
export function Scanner() {
  const { data } = useApp()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop())
    },
    [],
  )
  useEffect(() => {
    if (!scanning) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
    if (!DetectorClass) return
    const detector = new DetectorClass({ formats: ['ean_8', 'ean_13'] })
    const read = async () => {
      if (!active || !video.current) return
      try {
        const found = await detector.detect(video.current)
        if (found[0] && validBarcode(found[0].rawValue)) {
          setCode(found[0].rawValue)
          setConfirmed(false)
          setScanning(false)
          stream.current?.getTracks().forEach((t) => t.stop())
          return
        }
      } catch {
        /* Retry while camera initializes. */
      }
      if (active) timer = setTimeout(() => void read(), 300)
    }
    void read()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [scanning])
  const start = async () => {
    setMessage('')
    if (!('BarcodeDetector' in window)) {
      setMessage(
        'La scansione automatica non è disponibile in questo browser. Inserisci il barcode qui sotto.',
      )
      return
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (video.current) {
        video.current.srcObject = stream.current
        await video.current.play()
      }
      setScanning(true)
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop())
      setMessage('Fotocamera non disponibile o permesso negato. Puoi inserire il codice manualmente.')
    }
  }
  const product = data.specific_products.find((p) => p.barcode === code)
  return (
    <>
      <SectionTitle eyebrow="RITROVA IL PRODOTTO, AL VOLO" title="Scanner barcode." />
      <Panel title="Scansiona o inserisci il codice">
        <p>Supporta EAN-8 ed EAN-13. Nessun dato viene salvato senza conferma.</p>
        <video
          ref={video}
          playsInline
          muted
          className={scanning ? 'camera' : 'camera hidden'}
          aria-label="Anteprima fotocamera"
        />
        <div className="inline">
          <button className="button" onClick={() => void start()} disabled={scanning}>
            <Camera size={18} /> Apri fotocamera
          </button>
          {scanning && (
            <button
              className="button secondary"
              onClick={() => {
                stream.current?.getTracks().forEach((t) => t.stop())
                setScanning(false)
              }}
            >
              Ferma fotocamera
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="callout">
            {message}
          </p>
        )}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            setConfirmed(true)
          }}
        >
          <label className="field">
            Barcode manuale
            <input
              inputMode="numeric"
              pattern="[0-9]{8}|[0-9]{13}"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setConfirmed(false)
              }}
            />
          </label>
          <button className="button secondary" type="submit">
            <ScanLine size={18} /> Cerca e conferma codice
          </button>
        </form>
        {confirmed &&
          (validBarcode(code) ? (
            product ? (
              <div className="callout">
                <h3>{product.name}</h3>
                {product.archived_at && (
                  <p>
                    Prodotto archiviato: puoi ripristinarlo dalla vista Mostra archiviati del Catalogo
                    prodotti.
                  </p>
                )}
                <p>
                  {product.brand} · {product.package_quantity} {product.package_unit}
                </p>
                <a href="/prezzi">Registra un prezzo →</a>
              </div>
            ) : (
              <p className="callout">
                Barcode valido, prodotto assente nel catalogo. Crea e conferma il prodotto nel Catalogo
                prodotti.
              </p>
            )
          ) : (
            <p className="callout">Il checksum EAN non è valido. Ricontrolla le cifre.</p>
          ))}
      </Panel>
      <Panel title="Foto, ricette e scontrini">
        <p>
          Le importazioni OCR e da URL non sono ancora attive. Le immagini private non vengono caricate. Usa
          l’inserimento manuale per ricette e acquisti.
        </p>
      </Panel>
    </>
  )
}
// Session and family data are never written into service-worker caches.
export { client }
