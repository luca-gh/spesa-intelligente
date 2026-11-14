import { ArchiveButton, ArchiveFilter } from '../components/ArchiveButton'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Tag, Store as StoreIcon } from 'lucide-react'
import { useApp } from '../data/context'
import { insert, remove, removeCatalogProduct, rpc, update } from '../data/client'
import { convert, dateInZone, euro, quantity, validBarcode } from '../domain/math'
import { estimate, rank } from '../domain/prices'
import {
  ConfirmButton,
  Empty,
  Field,
  Form,
  Panel,
  SectionTitle,
  Select,
  Submit,
  text,
  UnitSelect,
} from '../components/ui'

export function Catalog() {
  const { data, household, act } = useApp()
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [generic, setGeneric] = useState('')
  const [specific, setSpecific] = useState('')
  const editing = data.generic_products.find((g) => g.id === generic)
  const editingSpecific = data.specific_products.find((s) => s.id === specific)
  return (
    <>
      <SectionTitle eyebrow="SAPERE COSA SCEGLIERE" title="Il vostro catalogo." />
      <label className="field search-field">
        Cerca prodotto, marca o barcode
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Es. latte intero…" />
      </label>
      <div className="two-columns">
        <Panel title={editing ? 'Modifica prodotto generico' : 'Nuovo prodotto generico'}>
          <Form
            key={generic}
            onSave={async (f) => {
              const values = {
                name: text(f, 'name'),
                canonical_unit: text(f, 'unit'),
                category_id: text(f, 'category') || null,
              }
              if (editing) await update('generic_products', editing.id, values)
              else await insert('generic_products', household!.id, values)
              setGeneric('')
            }}
          >
            <Field
              label="Nome (definisce l’equivalenza)"
              name="name"
              value={editing?.name}
              placeholder="Latte intero senza lattosio"
            />
            <UnitSelect value={editing?.canonical_unit} />
            <Select label="Categoria" name="category" value={editing?.category_id ?? ''} required={false}>
              <option value="">Altri prodotti</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Submit />
            {editing && (
              <button className="text-button" type="button" onClick={() => setGeneric('')}>
                Annulla modifica
              </button>
            )}
          </Form>
          <p className="muted">
            L’associazione tra commerciale e generico è esplicita. Collega solo prodotti con caratteristiche
            compatibili.
          </p>
        </Panel>
        <Panel title={editingSpecific ? 'Modifica prodotto commerciale' : 'Nuovo prodotto commerciale'}>
          <Form
            key={specific}
            onSave={async (f) => {
              const barcode = text(f, 'barcode')
              if (barcode && !validBarcode(barcode))
                throw new Error('Quantità non valida: controlla il checksum del barcode EAN.')
              const values = {
                name: text(f, 'name'),
                brand: text(f, 'brand'),
                variant: text(f, 'variant'),
                generic_product_id: text(f, 'generic') || null,
                package_quantity: quantity(text(f, 'size')).toString(),
                package_unit: text(f, 'unit'),
                barcode: barcode || null,
              }
              if (editingSpecific) await update('specific_products', editingSpecific.id, values)
              else await insert('specific_products', household!.id, values)
              setSpecific('')
            }}
          >
            <Field label="Nome commerciale" name="name" value={editingSpecific?.name} />
            <Field label="Marca" name="brand" required={false} value={editingSpecific?.brand} />
            <Field
              label="Variante / caratteristiche"
              name="variant"
              required={false}
              value={editingSpecific?.variant}
            />
            <Select
              label="Equivalenza generica confermata"
              name="generic"
              required={false}
              value={editingSpecific?.generic_product_id ?? ''}
            >
              <option value="">Non ancora classificato</option>
              {data.generic_products
                .filter((g) => !g.archived_at || g.id === editingSpecific?.generic_product_id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
            <Field
              label="Contenuto netto per confezione"
              name="size"
              value={editingSpecific?.package_quantity ?? '1'}
            />
            <UnitSelect value={editingSpecific?.package_unit} />
            <Field
              label="EAN-8 / EAN-13"
              name="barcode"
              required={false}
              value={editingSpecific?.barcode ?? ''}
            />
            <Submit />
            {editingSpecific && (
              <button className="text-button" type="button" onClick={() => setSpecific('')}>
                Annulla modifica
              </button>
            )}
          </Form>
        </Panel>
      </div>
      <Panel title="Prodotti">
        <p className="muted">
          Puoi eliminare un prodotto che non è utilizzato. I prodotti collegati ad altri dati restano nel
          storico. Puoi archiviarli per rimuoverli dalle viste attive e ripristinarli in seguito.
        </p>
        <ArchiveFilter value={archived} onChange={setArchived} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Tipo / formato</th>
                <th>Equivalenza</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {data.generic_products
                .filter((g) => !!g.archived_at === archived)
                .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
                .map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>Generico · {g.canonical_unit}</td>
                    <td>{data.categories.find((c) => c.id === g.category_id)?.name ?? 'Altri prodotti'}</td>
                    <td>
                      <button className="text-button" onClick={() => setGeneric(g.id)}>
                        Modifica
                      </button>
                      <ArchiveButton
                        table="generic_products"
                        record={g}
                        onDone={() => {
                          if (generic === g.id) setGeneric('')
                        }}
                      />
                      <ConfirmButton
                        message={`Eliminare il prodotto generico «${g.name}» dal catalogo? L’operazione viene bloccata se è collegato ad altri dati.`}
                        success="Prodotto eliminato dal catalogo."
                        onConfirm={async () => {
                          await removeCatalogProduct('generic_products', g.id)
                          if (generic === g.id) setGeneric('')
                        }}
                      >
                        Elimina
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              {data.specific_products
                .filter((s) => !!s.archived_at === archived)
                .filter((s) =>
                  [s.name, s.brand, s.barcode].join(' ').toLowerCase().includes(search.toLowerCase()),
                )
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>
                        {s.brand} {s.variant} · {s.barcode}
                      </small>
                    </td>
                    <td>
                      {s.package_quantity} {s.package_unit}
                    </td>
                    <td>
                      {data.generic_products.find((g) => g.id === s.generic_product_id)?.name ??
                        'Non classificato'}
                    </td>
                    <td>
                      <button className="text-button" onClick={() => setSpecific(s.id)}>
                        Modifica
                      </button>
                      <ArchiveButton
                        table="specific_products"
                        record={s}
                        onDone={() => {
                          if (specific === s.id) setSpecific('')
                        }}
                      />
                      <ConfirmButton
                        message={`Eliminare il prodotto commerciale «${s.name}» dal catalogo? L’operazione viene bloccata se è collegato ad altri dati.`}
                        success="Prodotto eliminato dal catalogo."
                        onConfirm={async () => {
                          await removeCatalogProduct('specific_products', s.id)
                          if (specific === s.id) setSpecific('')
                        }}
                      >
                        Elimina
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data.generic_products.length && !data.specific_products.length && (
          <Empty title="Un catalogo tutto vostro">
            Aggiungi i prodotti che usate, senza dati precompilati.
          </Empty>
        )}
      </Panel>
      <Panel title="Categorie della famiglia">
        <Form
          className="inline-form"
          onSave={(f) =>
            insert('categories', household!.id, { name: text(f, 'name'), sort_order: data.categories.length })
          }
        >
          <Field label="Nuova categoria" name="name" />
          <Submit>
            <Plus size={16} /> Aggiungi
          </Submit>
        </Form>
        <div className="inline wrap">
          {data.categories.map((c) => (
            <span className="inline" key={c.id}>
              <button
                className="pill"
                key={c.id}
                onClick={() => {
                  const name = prompt('Rinomina categoria', c.name)
                  if (name?.trim()) void act(() => update('categories', c.id, { name: name.trim() }))
                }}
              >
                {c.name}
              </button>
              <ConfirmButton
                message={`Eliminare la categoria «${c.name}»? I prodotti resteranno nel catalogo, sotto Altri prodotti.`}
                success="Categoria eliminata. I prodotti sono conservati in Altri prodotti."
                onConfirm={() => rpc('delete_category', { p_id: c.id })}
              >
                Elimina categoria {c.name}
              </ConfirmButton>
            </span>
          ))}
        </div>
      </Panel>
    </>
  )
}
export function Stores() {
  const { data, household } = useApp()
  const [editing, setEditing] = useState('')
  const [archived, setArchived] = useState(false)
  const store = data.stores.find((s) => s.id === editing)
  return (
    <>
      <SectionTitle eyebrow="OGNI NEGOZIO HA LA SUA STORIA" title="I vostri supermercati." />
      <Panel title={store ? 'Modifica punto vendita' : 'Aggiungi un punto vendita'}>
        <Form
          key={editing}
          className="grid-form"
          onSave={async (f) => {
            const values = {
              name: text(f, 'name'),
              chain: text(f, 'chain'),
              address: text(f, 'address'),
              city: text(f, 'city'),
            }
            if (store) await update('stores', store.id, values)
            else await insert('stores', household!.id, values)
            setEditing('')
          }}
        >
          <Field label="Nome del punto vendita" name="name" value={store?.name} />
          <Field label="Catena" name="chain" required={false} value={store?.chain} />
          <Field label="Indirizzo" name="address" value={store?.address} />
          <Field label="Città" name="city" value={store?.city} />
          <Submit />
        </Form>
        <p className="muted">
          I prezzi e gli sconti sono specifici del singolo negozio. Non vengono trasferiti tra punti vendita
          della stessa catena.
        </p>
      </Panel>
      <div className="cards">
        {data.stores
          .filter((s) => !!s.archived_at === archived)
          .map((s) => (
            <article className="panel" key={s.id}>
              <StoreIcon className="green" />
              <h2>{s.name}</h2>
              <p>
                {s.chain}
                <br />
                {s.address}, {s.city}
              </p>
              {s.archived_at && <span className="pill">Archiviato</span>}
              <div className="inline">
                <button className="text-button" onClick={() => setEditing(s.id)}>
                  Modifica
                </button>
                <ArchiveButton
                  table="stores"
                  record={s}
                  onDone={() => {
                    if (editing === s.id) setEditing('')
                  }}
                />
                <ConfirmButton
                  message={`Eliminare il punto vendita «${s.name}»? Se ha dati collegati, usa Archivia per conservare lo storico.`}
                  success="Punto vendita eliminato."
                  onConfirm={async () => {
                    await remove('stores', s.id)
                    if (editing === s.id) setEditing('')
                  }}
                >
                  Elimina
                </ConfirmButton>
              </div>
            </article>
          ))}
      </div>
      <ArchiveFilter value={archived} onChange={setArchived} />
      {!data.stores.length && (
        <Empty title="Dove fate la spesa?">Aggiungi il primo punto vendita per registrare i prezzi.</Empty>
      )}
    </>
  )
}
export function Prices() {
  const { data, household, itemQuantity, act } = useApp()
  const [params] = useSearchParams()
  const [list, setList] = useState(params.get('lista') ?? '')
  const [date, setDate] = useState(dateInZone(new Date(), household!.timezone))
  const [ruleId, setRuleId] = useState('')
  const [showVoided, setShowVoided] = useState(false)
  const rule = data.store_discount_rules.find((r) => r.id === ruleId)
  const requested = data.shopping_list_items
    .filter((i) => i.list_id === list && !i.archived_at)
    .map((i) => ({ ...i, quantity: itemQuantity(i).remaining }))
  const estimates = rank(
    data.stores
      .filter((s) => !s.archived_at)
      .map((s) =>
        estimate(
          s.id,
          requested,
          data.specific_products.filter(
            (p) => !p.archived_at || requested.some((i) => i.specific_product_id === p.id),
          ),
          data.price_observations,
          data.store_discount_rules,
          date,
          household!.timezone,
        ),
      ),
  )
  return (
    <>
      <SectionTitle eyebrow="PREZZI CHIARI, SCELTE CONSAPEVOLI" title="Quanto costa la vostra spesa?" />
      <Panel title="Confronta una lista">
        <div className="grid-form">
          <label className="field">
            Lista
            <select value={list} onChange={(e) => setList(e.target.value)}>
              <option value="">Seleziona lista</option>
              {data.shopping_lists
                .filter((l) => l.status !== 'archived')
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Data prevista della spesa
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value)
              }}
            />
          </label>
        </div>
        <p className="muted">
          Stima per un solo supermercato alla volta, sulle quantità residue e sulle confezioni intere. Un
          prezzo storico non garantisce disponibilità né prezzo attuale. Sconti arrotondati per riga al
          centesimo.
        </p>
      </Panel>
      {list && (
        <div className="estimates">
          {estimates.map((e) => (
            <section className="panel" key={e.storeId}>
              <div className="panel-heading">
                <h2>{data.stores.find((s) => s.id === e.storeId)?.name}</h2>
                <span className={`pill ${e.complete ? '' : 'warning'}`}>
                  {e.complete ? 'Copertura completa' : `Parziale · ${e.known}/${e.totalItems}`}
                </span>
              </div>
              <div className="estimate-total">
                {euro(e.total)} <small>{e.complete ? 'totale stimato' : 'solo articoli con prezzo'}</small>
              </div>
              <p>
                Risparmio personale: {euro(e.savings)} · Rilevazione più vecchia:{' '}
                {e.oldest
                  ? new Date(e.oldest).toLocaleDateString('it-IT', { timeZone: household!.timezone })
                  : 'non disponibile'}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Articolo</th>
                      <th>Confezioni</th>
                      <th>Base</th>
                      <th>Sconto</th>
                      <th>Finale</th>
                      <th>Rilevazione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.itemId}>
                        <td>
                          {l.productName ?? requested.find((i) => i.id === l.itemId)?.name}
                          {l.promotional && <small>In promozione</small>}
                          {l.ruleName && <small>{l.ruleName}</small>}
                          {l.uncertain && <small>Altre rilevazioni incerte: verifica in negozio</small>}
                        </td>
                        <td>{l.packs || '—'}</td>
                        <td>{l.gross !== null ? euro(l.gross) : 'Prezzo sconosciuto'}</td>
                        <td>{euro(l.discount)}</td>
                        <td>{l.net !== null ? euro(l.net) : '—'}</td>
                        <td>
                          {l.observedAt
                            ? new Date(l.observedAt).toLocaleDateString('it-IT', {
                                timeZone: household!.timezone,
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button secondary"
                disabled={!e.totalItems}
                onClick={() =>
                  void act(() =>
                    rpc('save_estimate', {
                      p_list: list,
                      p_store: e.storeId,
                      p_total: e.total,
                      p_coverage: e.totalItems ? e.known / e.totalItems : 0,
                      p_date: date,
                      p_detail: e,
                    }),
                  )
                }
              >
                Salva previsione datata
              </button>
            </section>
          ))}
        </div>
      )}
      <div className="two-columns">
        <Panel title="Registra un prezzo osservato">
          <Form
            onSave={(f) =>
              rpc('add_price', {
                p_product: text(f, 'product'),
                p_store: text(f, 'store'),
                p_amount: quantity(text(f, 'amount')).toFixed(2),
                p_kind: text(f, 'kind'),
                p_observed: new Date(text(f, 'date') + 'T12:00:00').toISOString(),
                p_start: text(f, 'start') || null,
                p_end: text(f, 'end') || null,
              })
            }
          >
            <Select label="Prodotto commerciale" name="product">
              <option value="">Seleziona prodotto</option>
              {data.specific_products
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.package_quantity} {s.package_unit}
                  </option>
                ))}
            </Select>
            <Select label="Punto vendita" name="store">
              <option value="">Seleziona negozio</option>
              {data.stores
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Field label="Prezzo per confezione (€)" name="amount" />
            <Select label="Tipo di prezzo accertato" name="kind">
              <option value="regular">Ordinario</option>
              <option value="promotion">Promozione</option>
              <option value="unknown">Non determinato (escluso dalla stima)</option>
            </Select>
            <Field label="Data rilevazione" name="date" type="date" value={date} />
            <Field label="Inizio promo" name="start" type="date" required={false} />
            <Field label="Fine promo" name="end" type="date" required={false} />
            <Submit>Registra prezzo</Submit>
          </Form>
          <p className="muted">
            Per prezzi al kg/litro, inserisci il costo della confezione corrispondente. Una promozione senza
            periodo certo non viene usata nella stima.
          </p>
        </Panel>
        <Panel title={rule ? 'Modifica sconto personale' : 'Sconto personale ricorrente'}>
          <Form
            key={ruleId}
            onSave={async (f) => {
              const values = {
                store_id: text(f, 'store'),
                name: text(f, 'name'),
                percentage: quantity(text(f, 'percent')).toString(),
                weekdays: f.getAll('days').map(Number),
                valid_from: text(f, 'start'),
                valid_to: text(f, 'end') || null,
                exclude_promotional_items: !f.has('stack'),
                confirmed: f.has('confirmed'),
                minimum_total: quantity(text(f, 'minimum') || '0').toFixed(2),
                maximum_discount: text(f, 'maximum') ? quantity(text(f, 'maximum')).toFixed(2) : null,
                conditions_note: text(f, 'notes'),
                excluded_product_ids: f.getAll('excluded').map(String),
                priority: Number(text(f, 'priority')),
              }
              if (rule) await update('store_discount_rules', rule.id, values)
              else await insert('store_discount_rules', household!.id, values)
              setRuleId('')
            }}
          >
            <Field
              label="Nome della regola"
              name="name"
              value={rule?.name}
              placeholder="Sconto tessera del mercoledì"
            />
            <Select label="Solo in questo punto vendita" name="store" value={rule?.store_id}>
              <option value="">Seleziona negozio</option>
              {data.stores
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Field label="Percentuale (%)" name="percent" value={rule?.percentage ?? '10'} />
            <fieldset>
              <legend>Giorni della settimana</legend>
              <div className="inline wrap">
                {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day, i) => (
                  <label className="checkbox" key={day}>
                    <input
                      type="checkbox"
                      name="days"
                      value={i}
                      defaultChecked={rule?.weekdays.includes(i) ?? false}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Valido dal" name="start" type="date" value={rule?.valid_from ?? date} />
            <Field
              label="Valido fino al (facoltativo)"
              name="end"
              type="date"
              required={false}
              value={rule?.valid_to ?? ''}
            />
            <Field label="Soglia minima per riga (€)" name="minimum" value={rule?.minimum_total ?? '0'} />
            <Field
              label="Sconto massimo per riga (€), facoltativo"
              name="maximum"
              required={false}
              value={rule?.maximum_discount ?? ''}
            />
            <Field
              label="Priorità (si applica una sola regola per riga)"
              name="priority"
              type="number"
              value={rule?.priority ?? 0}
            />
            <label className="field">
              Prodotti esclusi
              <select multiple name="excluded" defaultValue={rule?.excluded_product_ids ?? []}>
                {data.specific_products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Condizioni, tessera ed esclusioni" name="notes" required={false} />
            <label className="checkbox">
              <input
                type="checkbox"
                name="stack"
                defaultChecked={rule ? !rule.exclude_promotional_items : false}
              />{' '}
              Condizioni verificate: cumulabile con prodotti in promozione
            </label>
            <label className="checkbox">
              <input type="checkbox" name="confirmed" defaultChecked={rule?.confirmed ?? false} /> Ho
              verificato le condizioni effettive del negozio
            </label>
            <Submit>Salva regola</Submit>
          </Form>
          <p className="muted">
            Le regole non confermate restano inattive nei calcoli. Ogni regola va configurata e confermata
            manualmente. Le soglie e i massimali attuali si riferiscono alla singola riga, non allo scontrino.
          </p>
        </Panel>
      </div>
      <Panel title="Regole configurate">
        {data.store_discount_rules.map((r) => (
          <div className="data-row" key={r.id}>
            <Tag size={18} />
            <div>
              <strong>
                {r.name} · {r.percentage}%
              </strong>
              <small>
                {data.stores.find((s) => s.id === r.store_id)?.name} · {r.active ? 'Attiva' : 'Disattivata'} ·{' '}
                {r.confirmed ? 'Confermata' : 'Da verificare'}
              </small>
            </div>
            <button className="text-button" onClick={() => setRuleId(r.id)}>
              Modifica
            </button>
            <button
              className="text-button"
              onClick={() => void act(() => update('store_discount_rules', r.id, { active: !r.active }))}
            >
              {r.active ? 'Disattiva' : 'Attiva'}
            </button>
            <ConfirmButton
              message={`Eliminare la regola «${r.name}»? Le previsioni già salvate non cambieranno.`}
              onConfirm={async () => {
                await remove('store_discount_rules', r.id)
                if (ruleId === r.id) setRuleId('')
              }}
            >
              Elimina
            </ConfirmButton>
          </div>
        ))}
        {!data.store_discount_rules.length && (
          <p className="muted">Nessuna regola. Nessuno sconto personale viene presunto.</p>
        )}
      </Panel>
      <Panel title="Storico prezzi">
        <label className="checkbox">
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
          Mostra annullate
        </label>
        {[...data.price_observations]
          .filter((p) => showVoided || !p.voided_at)
          .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
          .map((p) => (
            <div className="data-row" key={p.id}>
              <div>
                <strong>
                  {data.specific_products.find((s) => s.id === p.specific_product_id)?.name} ·{' '}
                  {euro(p.price_amount)}
                </strong>
                <small>
                  {data.stores.find((s) => s.id === p.store_id)?.name} ·{' '}
                  {new Date(p.observed_at).toLocaleDateString('it-IT', { timeZone: household!.timezone })} ·{' '}
                  {p.kind === 'regular'
                    ? 'Ordinario'
                    : p.kind === 'promotion'
                      ? 'Promozione'
                      : 'Non determinato'}
                  {p.voided_at ? ' · ANNULLATO' : ''}
                </small>
              </div>
              {!p.voided_at && (
                <ConfirmButton
                  message="Annullare la rilevazione? Il record verrà conservato."
                  onConfirm={() => rpc('void_price', { p_id: p.id })}
                >
                  Annulla
                </ConfirmButton>
              )}
            </div>
          ))}
        {!data.price_observations.length && (
          <Empty title="Ogni prezzo ha una data">
            Registra le prime osservazioni per confrontare la spesa.
          </Empty>
        )}
      </Panel>
    </>
  )
}

// Explicitly reusable when importing ingredient quantities with compatible units.
export { convert }
