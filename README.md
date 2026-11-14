# Spesa Intelligente

[![Verifiche](https://github.com/luca-gh/spesa-intelligente/actions/workflows/ci.yml/badge.svg)](https://github.com/luca-gh/spesa-intelligente/actions/workflows/ci.yml)

PWA in italiano per organizzare la spesa di una famiglia: liste condivise, acquisti parziali, catalogo, prezzi per punto vendita, confronto con sconti personali, ricette e calendario.

**Stato: dieci migrazioni applicate e controlli SQL RLS/RPC superati sul database Supabase reale; collaudo Auth/JWT e Realtime completo ancora da eseguire.** Consultare [PROGRESS.md](PROGRESS.md) e [TEST_REPORT.md](TEST_REPORT.md). OCR, importazioni e alcune funzioni avanzate restano da completare. Nessun dato dimostrativo viene conservato in produzione.

## Avvio locale

Requisiti: Node.js 22.12+ e npm. Il lockfile contiene le versioni effettivamente verificate.

```sh
npm ci
cp .env.example .env
npm run dev
```

Su PowerShell usare `Copy-Item .env.example .env`. In questa workstation è disponibile anche `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1`: usa il Node portatile in `.tools` se Node non è nel PATH. `.tools` non viene pubblicata.

Senza variabili Supabase l'app mostra le istruzioni di configurazione, senza creare dati locali o simulare una sessione.

```dotenv
VITE_SUPABASE_URL=https://IL-PROGETTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=LA-CHIAVE-PUBBLICA
```

È ammessa anche la vecchia chiave pubblica `anon`. Non inserire chiavi `service_role`, `sb_secret_`, password del database o credenziali GitHub in variabili `VITE_`. Un controllo nella configurazione Vite rifiuta le chiavi privilegiate riconosciute prima della compilazione. Non sostituisce la revisione delle variabili configurate.

## Configurare Supabase

1. Creare un progetto **Free**, senza attivare piani a pagamento. Verificare condizioni e quote nella [pagina prezzi ufficiale](https://supabase.com/pricing): controllata il 14 novembre 2026, con piano Free disponibile. Quote e sospensione per inattività possono cambiare; nessun limite numerico è un requisito del codice.
2. Applicare **in ordine di nome** tutti i file in `supabase/migrations/`, preferibilmente tramite integrazione Supabase collegata o CLI: `supabase login`, `supabase link --project-ref REF`, `supabase db push`. Il login CLI è locale e non deve essere salvato nel repository. La chiave pubblica dell'app non autorizza le migrazioni.
3. Le migrazioni sono versionate e si applicano una sola volta. Per verificare un reset usare un database di sviluppo vuoto. Non rieseguire manualmente tutto lo schema su un progetto già popolato.
4. In Auth abilitare email/password, conferma email e password di almeno 12 caratteri. Impostare Site URL e redirect consentiti per origine locale e dominio definitivo, compreso `/impostazioni` per il recupero password. Non usare redirect wildcard in produzione.
5. Verificare che la pubblicazione `supabase_realtime` contenga le quattro tabelle delle liste indicate nella migrazione `003`. Il servizio Realtime completo non è emulato dai test PostgreSQL locali.
6. Copiare URL e chiave pubblica in `.env`, riavviare Vite. Registrare il primo account, creare una famiglia, generare il codice da Impostazioni. Registrare il secondo account e accettare il codice. Il codice è monouso, scade in 48 ore ed è revocabile; non viene spedito automaticamente.

Non vengono creati bucket di immagini. Non c'è un percorso di upload attivo, quindi nessuna foto privata viene pubblicata. Non creare bucket pubblici per aggirare questa limitazione.

Se il progetto è nuovo e non hai accesso alla CLI o all'integrazione, `node scripts/prepare-bootstrap.mjs` prepara `.tools/supabase-bootstrap.sql`: contiene le dieci migrazioni in un'unica transazione, senza credenziali o dati dimostrativi. Aprilo in SQL Editor ed eseguilo **una sola volta sul progetto vuoto**. Il controllo iniziale interrompe l'esecuzione se rileva lo schema dell'app. Lo script è testato su PostgreSQL locale, compresa la pubblicazione delle quattro tabelle delle liste; il servizio Realtime ospitato richiede ancora collaudo.

Il percorso SQL Editor non aggiorna la cronologia migrazioni della CLI. Prima di passare a `db push`, confrontare lo schema e riconciliare le dieci versioni applicate con `supabase migration repair --status applied VERSIONI`; non marcare applicate migrazioni non eseguite. Vedere la [documentazione ufficiale sulle migrazioni](https://supabase.com/docs/guides/deployment/database-migrations).

Dopo la configurazione, `npm run check:backend` controlla Auth e la disponibilità delle 20 tabelle tramite richieste di sola lettura con `limit=0`. Il comando non registra account, non legge record familiari e non certifica RLS o sincronizzazione. Exit code: 0 se Auth risponde e tutte le tabelle risultano presenti o protette, 2 per schema incompleto/non verificato, 1 per configurazione o connessione fallita. Il file `.env` resta escluso da Git.

Sul progetto corrente le dieci migrazioni sono già applicate, registrate nella cronologia standard Supabase e confrontate con i file locali: **non rieseguire il bootstrap**. La migrazione 008 rimuove esplicitamente i grant anon e le operazioni dirette non necessarie assegnate dai default del servizio. Un rifiuto anon 401/42501 che nomina la tabella richiesta viene classificato PROTETTA dal check backend ed è atteso.

Per i controlli amministrativi è disponibile `supabase/tests/online_rls.sql`: tre identità sintetiche, due famiglie, inviti, acquisti e accesso anon, dentro una transazione annullata. Non invia email né conserva fixture. È stato eseguito con successo sul progetto reale il 14 novembre 2026; non sostituisce il collaudo Auth/JWT e Realtime tramite app.

## Rimozione dei dati

- **Categorie:** Catalogo prodotti → Categorie della famiglia → Elimina categoria. Anche quelle già usate possono essere eliminate: i prodotti restano sotto Altri prodotti.
- **Prodotti, punti vendita e ricette:** Elimina per i record senza vincoli; Archivia per nasconderli conservando collegamenti e storico. Mostra archiviati permette il Ripristina. I prodotti archiviati non compaiono nelle nuove selezioni; le liste esistenti conservano i riferimenti.
- **Articoli delle liste:** Archivia è disponibile anche con acquisti registrati. Mostra articoli archiviati permette il ripristino. Le quantità archiviate non rientrano nei residui mostrati e nel confronto prezzi; acquisti e statistiche conservano lo storico. Una nuova conferma del piano o aggiunta da ricetta può ripristinare l'articolo corrispondente, come indicato nel modulo/anteprima. La duplicazione della lista esclude gli articoli archiviati.
- **Piani settimanali:** Archivia nasconde il calendario, mantenendo le quantità già trasferite alle liste. Nella stessa settimana è disponibile Ripristina. Pasti e modelli hanno il comando di eliminazione.
- **Ingredienti e sconti:** gli ingredienti già salvati e le regole sconto possono essere eliminati; nel modulo ricetta si può rimuovere l'ultimo ingrediente aggiunto. Le liste e le previsioni già salvate restano invariate.
- **Previsioni:** Archivia/Ripristina nelle Statistiche; importi e dettagli rimangono immutabili. **Prezzi e acquisti:** Annulla conserva la traccia ed esclude il record dai calcoli. Le rilevazioni annullate sono consultabili con Mostra annullate. **Inviti:** Revoca invalida il codice.

## Flussi disponibili

- **Liste:** creazione, rinomina, duplicazione, archiviazione, ripristino, stato completato; articoli liberi o collegati al catalogo, ricerca, quantità manuali e note, raggruppamento per categoria e suggerimenti dagli acquisti reali. Gli acquisti restano separati dai contributi e possono essere annullati conservando la traccia.
  Il menu **Prodotto dal catalogo (facoltativo)** contiene i prodotti già salvati in Catalogo prodotti: un nome scritto liberamente nella lista non popola automaticamente il catalogo. Se è vuoto, il modulo lo spiega e permette di scrivere il nome. Scegliere un commerciale propone il contenuto di una confezione, con unità coerente; quantità e unità restano modificabili tramite conversioni compatibili. Ricerca anche per marca e barcode; un nuovo filtro annulla la selezione precedente.
- **Acquisti:** quantità parziali e surplus; prezzo totale effettivo facoltativo, completabile dopo; negozio, prodotto commerciale e stato promozionale. Il semplice acquisto senza prezzo non genera osservazioni di prezzo. Una correzione si effettua annullando e registrando un nuovo evento.
- **Catalogo e negozi:** un solo modulo **Nuovo prodotto**. È obbligatorio soltanto il nome; categoria, marca, EAN, variante e formato sono facoltativi e modificabili in seguito. La gestione delle categorie rimane nella stessa sezione. I prodotti sono sempre ordinati per nome A–Z, senza selettore di direzione; anche ricerca e archiviati seguono l'ordine alfabetico.
  Il formato può restare vuoto; se viene indicato, quantità e unità devono essere entrambe presenti. I prodotti senza formato sono selezionabili nelle liste e per registrare prezzi, ma non producono stime sulle confezioni finché il formato non è noto. Un prodotto scelto senza marca o altri identificatori permette il confronto tra le marche associate; marca, EAN o variante specificati vincolano la scelta.
  Nella tabella **Prodotti**, **Elimina** rimuove la scheda dopo conferma se non ha vincoli. I collegamenti e lo storico sono protetti; in caso di vincoli si può usare **Archivia**. La migrazione conserva gli identificativi preesistenti usati da liste, ricette e acquisti e nasconde le righe interne di raggruppamento, evitando la doppia scheda. I negozi restano indipendenti con indirizzo e archiviazione.
- **Prezzi:** ordinari storici, promozioni datate, rilevazioni non classificate, annullamenti tracciati. Il prezzo è **per confezione**, non per kg/litro salvo che il formato sia esattamente kg/litro. Non si trasformano automaticamente acquisti in prezzi ordinari.
- **Confronto:** una lista, residui e confezioni intere; alternativa generica compatibile più conveniente. I negozi incompleti sono distinti e non classificati in base al totale parziale. Nessuna ottimizzazione su più supermercati.
- **Sconti personali:** configurabili per negozio e giorno, periodo, percentuale, priorità, prodotti esclusi, soglia e massimale **per riga**. Una sola regola per riga, senza cumulo tra regole personali; eventuale cumulo con promozioni richiede conferma esplicita. Regole non confermate e prezzi incerti non danno sconti presunti. Condizioni riferite all'intero scontrino e categorie escluse non sono ancora supportate.
- **Ricette e pasti:** creazione atomica con ingredienti di catalogo, ricerca anche per ingrediente, preferite, duplicazione, scaling, aggiunta diretta a lista; calendario lunedì–domenica con più componenti per pasto, duplicazione settimana e modelli. Le modifiche alle quantità della lista richiedono anteprima e conferma; un conflitto di versione della lista o del piano invalida la proposta. L'editing completo degli ingredienti di ricette esistenti resta da completare.
- **Statistiche:** pagato reale non annullato, copertura parziale, periodi, trend, categorie, negozi e liste; snapshot immutabili della previsione. Il dettaglio analitico delle differenze di prodotti/quantità rispetto alla previsione è ancora parziale.
- **Scanner:** EAN-8/13 con checksum, API BarcodeDetector dove disponibile, fallback manuale e gestione camera negata. OCR e importazione URL/scontrini non sono implementati.

## Verifiche

```sh
npm run check
npx playwright install chromium
npm run test:e2e
node scripts/secrets.mjs
npm audit --omit=dev
npm run licenses
```

`npm test` esegue calcoli di dominio e SQL su PostgreSQL tramite PGlite, con ruoli e RLS effettivi. Il namespace Auth è una fixture locale: non equivale al collaudo Supabase Auth/PostgREST/Realtime. Playwright usa **soltanto nei test** risposte HTTP controllate e dati fittizi, su desktop e viewport mobile Chromium. Non dimostra l'installazione su iPhone o Android fisici.

La CI GitHub esegue lint, typecheck, test, build e browser test. [TEST_REPORT.md](TEST_REPORT.md) distingue esecuzioni locali, CI e test non eseguiti. Gli avvisi residui dell'audit di sviluppo sono registrati lì; non applicare `audit fix --force` senza revisione.

## Deploy statico con HTTPS

L'app è pubblicata su **[spesa-intelligente-luca-gh.pages.dev](https://spesa-intelligente-luca-gh.pages.dev)**, progetto gratuito Cloudflare Pages collegato al solo repository `luca-gh/spesa-intelligente`. Non occorre tenere acceso il PC o acquistare un dominio.

Configurazione: branch di produzione `main`, build `npm ci && npm run check && npm run check:secrets`, output `dist`, Node 22.23.5 tramite `.node-version`. Le variabili di build sono esclusivamente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Il file `public/_redirects` supporta il router client-side. `public/_headers` imposta CSP, permessi camera e rivalidazione di service worker e manifest; se usi un dominio Supabase personalizzato, aggiorna connect-src con gli endpoint HTTPS/WSS esplicitamente consentiti.

**Installazione:** Android/Chrome → menu → Installa app; iPhone/Safari → Condividi → Aggiungi alla schermata Home. Accedere con l'account esistente: il database Supabase è lo stesso della versione locale. Le modifiche richiedono Internet.

**Aggiornamenti:** sviluppare e verificare le modifiche con `npm run check`, `npm run check:secrets`, `npm run check:pwa` (dopo build e installazione Chromium) e `npm run test:e2e`, poi pubblicare su `main`. Cloudflare costruisce e distribuisce automaticamente una nuova versione allo stesso indirizzo, fermando la pubblicazione se i controlli della build falliscono. La CI GitHub esegue anche audit, prova degli aggiornamenti PWA e test browser. Le modifiche al database richiedono migrazioni separate, compatibili con i client già installati; il deploy del frontend non cancella né reinizializza i dati.

L'app controlla nuove versioni al ritorno in primo piano, alla riconnessione e ogni ora mentre è aperta. Quando compare **Aggiorna app**, completare prima gli inserimenti in corso e premere il pulsante: non serve reinstallare. Un controllo di aggiornamento fallito lascia disponibile la versione corrente. Per tornare a una versione precedente usare un deployment riuscito nel pannello Cloudflare; il rollback del frontend non ripristina automaticamente lo schema o i dati Supabase.

Non pubblicare `.env`, report con dati reali, dump del database o immagini private. I documenti originari del progetto sono mantenuti solo localmente e sono esclusi da Git perché possono includere informazioni personali. Pubblicare il codice non rende pubblici i dati Supabase: la protezione dipende dall'applicazione corretta delle RLS.

Supabase Site URL è l'origine HTTPS pubblica, con redirect esatti all'origine e a `/impostazioni`. Gli indirizzi localhost/127.0.0.1 di sviluppo sono conservati; non sono stati aggiunti wildcard. HTTPS, manifest, routing, icone, service worker, layout mobile e shell offline sono verificati sul sito reale. Restano da collaudare installazione e fotocamera su Android/iOS fisici e il percorso completo con due account reali, rinviato dall'utente. Il service worker conserva solo asset statici; non memorizza risposte API. Le modifiche offline sono disabilitate.

## Export e backup

Impostazioni permette JSON dei dati caricati e CSV degli acquisti, con importi e annullamenti. L'esportazione JSON ha `schema_version: 1`, include i dati familiari e gli snapshot, esclude gli inviti. È privata: non committarla. Non è un backup automatico del provider né uno snapshot transazionale del database sotto modifiche concorrenti. Per una copia coerente sospendere temporaneamente le modifiche degli altri membri e aggiornare prima la pagina; per backup completi usare strumenti PostgreSQL in un contesto amministrativo protetto.

Il ripristino JSON/CSV non è implementato: richiederà validazione, mappatura UUID, verifica appartenenza e una transazione, prima su ambiente di sviluppo. Non importare eseguendo SQL da file non verificati.

## Ownership e cancellazioni

I membri attivi hanno permessi equivalenti. Uscire revoca l'accesso senza eliminare lo storico condiviso. L'ultimo membro deve conservare la famiglia oppure cancellarla esplicitamente dopo esportazione, confermando il nome. L'eliminazione definitiva della famiglia è intenzionalmente l'unica cancellazione che elimina anche lo storico. Le cancellazioni ordinarie di dati collegati agli acquisti vengono bloccate dalle FK.

La cancellazione dell'identità Auth non è self-service: il gestore deve rimuovere le appartenenze non più attive e l'identità da Supabase dopo aver verificato l'ownership dello storico. Non rimuovere utenti referenziati dagli acquisti senza una procedura di anonimizzazione. Un endpoint dedicato rimane da progettare e testare.

## Limiti operativi e risoluzione problemi

- **Configurazione necessaria:** controllare `.env`, nomi variabili, chiave pubblica e riavviare Vite.
- **Accesso non riuscito:** confermare email, controllare URL di redirect e Auth del progetto; gli errori interni non vengono mostrati.
- **RLS/errore caricamento:** applicare tutte le migrazioni; non disabilitare RLS per risolvere problemi di accesso.
- **Lista modificata:** aggiornare e ricalcolare l'anteprima; nessuna sovrascrittura automatica della proposta altrui.
- **Realtime:** le quattro tabelle delle liste devono essere pubblicate; vengono ricaricate tutte le collezioni dopo un evento o al ritorno online/focus. Altre sezioni non hanno eventi propri e si aggiornano al focus o dopo un salvataggio.
- **Dati numerosi:** caricamento iniziale limitato a 10.000 record per tabella; se il limite viene raggiunto il caricamento fallisce esplicitamente. Prima di avvicinarsi a questa dimensione, implementare paginazione e aggregazioni server-side.
- **Camera:** richiede HTTPS/localhost, permessi e browser compatibile; su Safari usare il barcode manuale se l'API non è presente.
- **PWA vecchia:** confermare l'aggiornamento proposto; durante sviluppo il service worker non è attivo.

Dipendenze e relative licenze sono elencate in [DEPENDENCIES.md](DEPENDENCIES.md). Non è stata assegnata una licenza al codice originale del progetto: la decisione spetta al titolare.
