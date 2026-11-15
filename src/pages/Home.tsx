import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  Plus,
  ScanLine,
  ShoppingBasket,
  ListChecks,
  ReceiptEuro,
  Utensils,
} from 'lucide-react'
import { useApp } from '../data/context'
import { dateInZone, euro } from '../domain/math'
import { statistics } from '../domain/planning'
import { Empty, SectionTitle } from '../components/ui'
export function Home() {
  const { data, household, itemQuantity } = useApp()
  const today = dateInZone(new Date(), household?.timezone)
  const list = data.shopping_lists[0]
  const items = data.shopping_list_items.filter((i) => i.list_id === list?.id && !i.archived_at)
  const pending = items.filter((i) => Number(itemQuantity(i).remaining) > 0)
  const spend = statistics(data.purchases, today.slice(0, 7) + '-01', today, household?.timezone)
  const meals = data.meal_entries.filter(
    (m) => m.meal_date === today && !data.meal_plans.find((p) => p.id === m.meal_plan_id)?.archived_at,
  )
  return (
    <>
      <SectionTitle
        eyebrow={new Intl.DateTimeFormat('it-IT', {
          dateStyle: 'full',
          timeZone: household?.timezone,
        }).format(new Date())}
        title="Le cose buone iniziano da qui."
      >
        <Link className="button" to="/liste">
          <ShoppingBasket size={18} /> Apri la lista
        </Link>
      </SectionTitle>
      <section className="welcome">
        <div>
          <span className="pill">LA TUA QUOTIDIANITÀ, PIÙ SEMPLICE</span>
          <h2>
            Una spesa pensata.
            <br />
            Più tempo per voi.
          </h2>
          <p>
            Tutto quello che serve alla vostra tavola,
            <br className="desktop-only" /> in un unico posto condiviso.
          </p>
          <Link to="/liste" className="button light">
            Organizza la spesa <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="basket-art" aria-hidden="true">
          <div className="art-orbit" />
          <span className="art-leaf">❧</span>
          <ShoppingBasket strokeWidth={1.1} />
          <span className="art-label">insieme è più semplice</span>
        </div>
      </section>
      <div className="metrics">
        <div className="metric">
          <span>
            <ListChecks size={20} /> Articoli acquistati
          </span>
          <strong>{items.length - pending.length}</strong>
          <small>Nella lista della spesa</small>
        </div>
        <div className="metric">
          <span>
            <ShoppingBasket size={20} /> Articoli da acquistare
          </span>
          <strong>{pending.length}</strong>
          <small>Nella lista della spesa</small>
        </div>
        <div className="metric">
          <span>
            <ReceiptEuro size={20} /> Spesa del mese
          </span>
          <strong>{euro(spend.total)}</strong>
          <small>
            {spend.unpriced
              ? `${spend.unpriced} acquisti senza prezzo · totale parziale`
              : 'Solo importi realmente registrati'}
          </small>
        </div>
        <div className="metric">
          <span>
            <Utensils size={20} /> Pasti di oggi
          </span>
          <strong>{meals.length}</strong>
          <small>Il tuo menu quotidiano</small>
        </div>
      </div>
      <div className="home-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>La tua lista della spesa</h2>
            <Link to="/liste">
              Apri lista <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link className="list-preview" to="/liste">
            <span className="list-icon">
              <ShoppingBasket size={24} />
            </span>
            <div>
              <strong>Lista della spesa</strong>
              <small>
                {items.length - pending.length} di {items.length} articoli acquistati
              </small>
              <progress
                max={items.length || 1}
                value={items.length - pending.length}
                aria-label="Avanzamento lista della spesa"
              />
            </div>
            <ArrowUpRight size={20} />
          </Link>
          {!items.length && (
            <Empty title="La lista è vuota">
              Aggiungi quello che serve e ritrovalo qui, insieme alla famiglia.
            </Empty>
          )}
        </section>
        <section className="panel today-panel">
          <div className="panel-heading">
            <h2>Oggi a tavola</h2>
            <CalendarDays size={19} />
          </div>
          {meals.length ? (
            meals.map((m) => (
              <div className="meal-preview" key={m.id}>
                <span className="eyebrow">{m.meal_slot}</span>
                <h3>
                  {data.recipes.find((r) => r.id === m.recipe_id)?.title ??
                    data.generic_products.find((p) => p.id === m.generic_product_id)?.name}
                </h3>
              </div>
            ))
          ) : (
            <Empty title="Cosa si mangia oggi?">Pianifica i pasti e ritrova qui il menu del giorno.</Empty>
          )}
          <Link className="text-link" to="/pasti">
            Apri il calendario <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
      <section className="quick-actions">
        <h2>Da dove cominciamo?</h2>
        <div>
          <Link to="/catalogo">
            <span className="quick-icon">
              <Plus />
            </span>
            <strong>Aggiungi un prodotto</strong>
            <small>Il catalogo della famiglia</small>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/pasti">
            <span className="quick-icon">
              <CalendarDays />
            </span>
            <strong>Organizza la settimana</strong>
            <small>Un’idea per ogni giorno</small>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/scanner">
            <span className="quick-icon">
              <ScanLine />
            </span>
            <strong>Scansiona un barcode</strong>
            <small>Ritrova il prodotto al volo</small>
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}
