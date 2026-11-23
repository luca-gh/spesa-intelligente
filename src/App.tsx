import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ListChecks,
  ShoppingBasket,
  Settings,
  Store,
  ScanLine,
  ArrowUpRight,
  Leaf,
  WifiOff,
  Package,
  LogOut,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { client, requireClient, rpc } from './data/client'
import { useApp } from './data/context'
import { Field, Form, Submit, text } from './components/ui'
const Lists = lazy(() => import('./pages/Lists').then((m) => ({ default: m.Lists })))
const Catalog = lazy(() => import('./pages/Catalog').then((m) => ({ default: m.Catalog })))
const Stores = lazy(() => import('./pages/Catalog').then((m) => ({ default: m.Stores })))
const Recipes = lazy(() => import('./pages/Meals').then((m) => ({ default: m.Recipes })))
const Meals = lazy(() => import('./pages/Meals').then((m) => ({ default: m.Meals })))
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })))
const Scanner = lazy(() => import('./pages/Account').then((m) => ({ default: m.Scanner })))

const primary = [
  { to: '/liste', label: 'Lista della spesa', icon: ListChecks },
  { to: '/catalogo', label: 'Catalogo', icon: Package },
  { to: '/ricette', label: 'Ricette', icon: BookOpen },
  { to: '/pasti', label: 'Pasti', icon: CalendarDays },
  { to: '/negozi', label: 'Supermercati', icon: Store },
]
const secondary = [
  { to: '/scanner', label: 'Scanner', icon: ScanLine },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings },
]
function Access() {
  const { session, act } = useApp()
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  return (
    <main className="access">
      <div className="access-brand">
        <ShoppingBasket size={36} />
        <span>
          spesa<span className="brand-light">intelligente</span>
        </span>
      </div>
      <div className="access-card">
        <p className="eyebrow">LA SPESA, INSIEME.</p>
        <h1>
          {!client
            ? 'Un posto per la vostra quotidianità.'
            : session
              ? 'La tua famiglia, il tuo spazio.'
              : mode === 'register'
                ? 'Inizia da qui.'
                : mode === 'reset'
                  ? 'Recupera l’accesso.'
                  : 'Bentornato a casa.'}
        </h1>
        {!client ? (
          <>
            <p>
              Liste condivise, ricette e prezzi chiari. Per iniziare, collega il tuo progetto Supabase
              gratuito.
            </p>
            <ol>
              <li>
                Copia <code>.env.example</code> in <code>.env</code>.
              </li>
              <li>Inserisci URL e chiave pubblica del progetto.</li>
              <li>Applica le migrazioni e riavvia l’app.</li>
            </ol>
            <div className="callout">
              Configurazione necessaria. Nessun dato di famiglia è ancora caricato.
            </div>
            <p className="muted">Le istruzioni complete sono nel README del progetto.</p>
          </>
        ) : !session ? (
          <>
            <Form
              key={mode}
              onSave={async (f) => {
                const auth = requireClient().auth
                if (mode === 'reset') {
                  const { error } = await auth.resetPasswordForEmail(text(f, 'email'), {
                    redirectTo: window.location.origin + '/impostazioni',
                  })
                  if (error) throw error
                  window.alert('Se l’indirizzo è registrato, riceverai le istruzioni di recupero.')
                  return
                }
                const credentials = { email: text(f, 'email'), password: text(f, 'password') }
                if (mode === 'register' && credentials.password.length < 12)
                  throw new Error('Quantità non valida: usa almeno 12 caratteri per la password.')
                const { error } =
                  mode === 'login'
                    ? await auth.signInWithPassword(credentials)
                    : await auth.signUp({
                        ...credentials,
                        options: { emailRedirectTo: window.location.origin },
                      })
                if (error) throw error
                if (mode === 'register')
                  window.alert('Controlla la posta per confermare l’account, se richiesto dal progetto.')
              }}
            >
              <Field label="Email" name="email" type="email" />
              {mode !== 'reset' && (
                <Field
                  label="Password (almeno 12 caratteri per registrarsi)"
                  name="password"
                  type="password"
                />
              )}
              <Submit>
                {mode === 'register' ? 'Crea account' : mode === 'reset' ? 'Invia istruzioni' : 'Accedi'}
              </Submit>
            </Form>
            <div className="inline">
              <button
                className="text-button"
                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              >
                {mode === 'register' ? 'Ho già un account' : 'Crea un account'}
              </button>
              <button className="text-button" onClick={() => setMode('reset')}>
                Password dimenticata
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Crea uno spazio condiviso oppure accetta il codice di invito ricevuto dall’altra persona.</p>
            <Form onSave={(f) => rpc('create_household', { p_name: text(f, 'name') })}>
              <Field label="Nome della famiglia" name="name" placeholder="La nostra casa" />
              <Submit>Crea famiglia</Submit>
            </Form>
            <div className="divider">oppure</div>
            <Form onSave={(f) => rpc('accept_invite', { p_token: text(f, 'token') })}>
              <Field label="Codice di invito" name="token" />
              <Submit>Accetta invito</Submit>
            </Form>
            <button className="text-button" onClick={() => void act(() => requireClient().auth.signOut())}>
              Esci dall’account
            </button>
          </>
        )}
      </div>
      <div className="access-foot">
        <Leaf size={18} /> Meno pensieri. Più cose buone.
      </div>
    </main>
  )
}
export function App() {
  const { household, session, loading, notice, online, sync, act } = useApp()
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registered) {
      registration.current = registered
    },
  })
  useEffect(() => {
    let lastCheck = 0
    const check = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible' || !registration.current) return
      if (Date.now() - lastCheck < 30_000) return
      lastCheck = Date.now()
      void registration.current.update().catch(() => {
        // A failed update check leaves the current version available; retry on next foreground event.
        lastCheck = 0
      })
    }
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 60 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [])
  const [menu, setMenu] = useState(false)
  if (loading)
    return (
      <main className="access" aria-busy="true">
        <ShoppingBasket size={42} />
        <h1>Un momento, prepariamo tutto…</h1>
        <p>Caricamento dei dati di famiglia.</p>
      </main>
    )
  return (
    <>
      <a className="skip" href="#main">
        Vai al contenuto
      </a>
      {!online && (
        <div className="offline" role="status">
          <WifiOff size={18} /> Sei offline. Le modifiche richiedono una connessione.
        </div>
      )}
      {needRefresh && (
        <div className="offline">
          È disponibile un aggiornamento.{' '}
          <button onClick={() => void updateServiceWorker(true)}>Aggiorna app</button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {!client || !session || !household ? (
        <Access />
      ) : (
        <div className="layout">
          <aside className="sidebar">
            <Link to="/" className="brand">
              <span className="brand-icon">
                <ShoppingBasket />
              </span>
              <span>
                spesa<strong>intelligente</strong>
              </span>
            </Link>
            <p className="nav-caption">IL TUO SPAZIO</p>
            <nav aria-label="Navigazione principale">
              {primary.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}>
                  <Icon size={20} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="nav-divider" />
            <nav aria-label="Altre sezioni">
              {secondary.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}>
                  <Icon size={19} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <span className="avatar">{household.name.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{household.name}</strong>
                <small>
                  {household.default_diners} persone · {sync}
                </small>
              </div>
              <button
                aria-label="Esci"
                className="icon-button"
                onClick={() => void act(() => requireClient().auth.signOut())}
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
          <div className="main-area">
            <header className="topbar">
              <span className="desktop-only">Organizza oggi, goditi domani.</span>
              <Link to="/" className="mobile-brand">
                <ShoppingBasket size={22} /> Spesa Intelligente
              </Link>
              <div className="inline">
                <span className="connection">
                  <span className={`dot ${sync === 'Sincronizzato' ? '' : 'pending'}`} />
                  {sync}
                </span>
                <button
                  className="icon-button mobile-only"
                  aria-label="Apri altre sezioni"
                  aria-expanded={menu}
                  onClick={() => setMenu(!menu)}
                >
                  <Settings size={22} />
                </button>
                <Link to="/impostazioni" className="avatar desktop-only" aria-label="Impostazioni famiglia">
                  {household.name.charAt(0)}
                </Link>
              </div>
            </header>
            {menu && (
              <nav className="mobile-menu" aria-label="Altre sezioni mobile">
                {secondary.map(({ to, label }) => (
                  <Link key={to} to={to} onClick={() => setMenu(false)}>
                    {label}
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </nav>
            )}
            <main id="main" className="content">
              <Suspense fallback={<p role="status">Caricamento della sezione…</p>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/liste" replace />} />
                  <Route path="/liste/*" element={<Lists />} />
                  <Route path="/catalogo" element={<Catalog />} />
                  <Route path="/negozi" element={<Stores />} />
                  <Route path="/prezzi" element={<Navigate to="/negozi?confronto=1" replace />} />
                  <Route path="/ricette" element={<Recipes />} />
                  <Route path="/pasti" element={<Meals />} />
                  <Route path="/statistiche" element={<Navigate to="/liste" replace />} />
                  <Route path="/impostazioni" element={<Account />} />
                  <Route path="/scanner" element={<Scanner />} />
                  <Route
                    path="*"
                    element={
                      <div>
                        <h1>Pagina non trovata</h1>
                        <Link to="/liste">Torna alla lista della spesa</Link>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </main>
            <footer className="footer">
              Un po’ di organizzazione, ogni giorno. <Leaf size={14} />
            </footer>
          </div>
          <nav className="bottom-nav" aria-label="Navigazione mobile">
            {primary.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'}>
                <Icon size={22} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
