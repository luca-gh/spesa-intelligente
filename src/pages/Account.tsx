import { BarcodeCamera } from '../components/BarcodeCamera'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Download, KeyRound, ScanLine } from 'lucide-react'
import { useApp } from '../data/context'
import { requireClient, rpc, update } from '../data/client'
import { dateInZone, validBarcode } from '../domain/math'
import { ConfirmButton, Field, Form, Panel, SectionTitle, Submit, text } from '../components/ui'

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
                    schema_version: 2,
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
export function Scanner() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const open = (barcode: string) => {
    if (!validBarcode(barcode)) {
      setError('Il checksum EAN non è valido. Ricontrolla le cifre.')
      return
    }
    navigate('/catalogo?barcode=' + encodeURIComponent(barcode))
  }
  return (
    <>
      <SectionTitle eyebrow="RITROVA IL PRODOTTO, AL VOLO" title="Scanner barcode." />
      <Panel title="Scansiona o inserisci il codice">
        <p>
          Leggi un EAN-8 o EAN-13: apriremo il modulo prodotto con i dati disponibili. Il salvataggio richiede
          la tua conferma.
        </p>
        <BarcodeCamera onDetected={open} />
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            open(code.trim())
          }}
        >
          <label className="field">
            <span>Barcode manuale</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{8}|[0-9]{13}"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError('')
              }}
            />
          </label>
          <button className="button secondary" type="submit">
            <ScanLine size={18} />
            Cerca e compila prodotto
          </button>
        </form>
        {error && (
          <p className="callout" role="status">
            {error}
          </p>
        )}
      </Panel>
      <Panel title="Foto, ricette e scontrini">
        <p>
          La lettura dei barcode non carica foto. Le importazioni OCR di ricette e scontrini non sono ancora
          attive.
        </p>
      </Panel>
    </>
  )
}
