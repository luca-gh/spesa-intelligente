# Spesa Intelligente

[![Verifiche](https://github.com/luca-gh/spesa-intelligente/actions/workflows/ci.yml/badge.svg)](https://github.com/luca-gh/spesa-intelligente/actions/workflows/ci.yml)

PWA in italiano per organizzare la spesa di una famiglia: una sola lista condivisa, acquisti parziali, catalogo, prezzi per punto vendita, confronto con sconti personali, ricette e calendario.

**Stato: tredici migrazioni applicate e controlli SQL RLS/RPC superati sul database Supabase reale; collaudo Auth/JWT e Realtime completo ancora da eseguire.** Consultare [PROGRESS.md](PROGRESS.md) e [TEST_REPORT.md](TEST_REPORT.md). OCR, importazioni e alcune funzioni avanzate restano da completare. Nessun dato dimostrativo viene conservato in produzione.

## Avvio locale

Una sola lista della spesa per famiglia, aperta direttamente all’avvio al posto della Home. Menu principale e barra inferiore nello stesso ordine: **Catalogo, Ricette, Lista della spesa, Pasti, Statistiche**. La lista occupa la posizione centrale; negozi, prezzi, scanner e impostazioni restano nel menu secondario. Il percorso iniziale `/` porta a `/liste`, mantenendo validi anche i vecchi collegamenti `/liste/...`. Ricette, pasti e confronto prezzi usano automaticamente la lista condivisa. Nessun comando per creare, duplicare, rinominare, completare o archiviare liste; gli articoli restano gestibili con i vincoli dello storico. Inizializzazione idempotente con RLS e vincolo UNIQUE per famiglia, anche per accessi concorrenti.

La migrazione `20261115115132_single_shopping_list.sql` conserva gli identificativi e i dati collegati. Nel progetto corrente nessun dato modificato; su altre installazioni con liste multiple la migrazione si interrompe prima delle modifiche, richiedendo una riconciliazione esplicita.

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
5. Verificare che la pubblicazione `supabase_realtime` contenga le quattro tabelle delle liste indicate nella migrazione `003` e `categories` aggiunta dalla migrazione `category_order`. Il servizio Realtime completo non è emulato dai test PostgreSQL locali.
6. Copiare URL e chiave pubblica in `.env`, riavviare Vite. Registrare il primo account, creare una famiglia, generare il codice da Impostazioni. Registrare il secondo account e accettare il codice. Il codice è monouso, scade in 48 ore ed è revocabile; non viene spedito automaticamente.

Non vengono creati bucket di immagini. Non c'è un percorso di upload attivo, quindi nessuna foto privata viene pubblicata. Non creare bucket pubblici per aggirare questa limitazione.

Se il progetto è nuovo e non hai accesso alla CLI o all'integrazione, `node scripts/prepare-bootstrap.mjs` prepara `.tools/supabase-bootstrap.sql`: contiene le dodici migrazioni in un'unica transazione, senza credenziali o dati dimostrativi. Aprilo in SQL Editor ed eseguilo **una sola volta sul progetto vuoto**. Il controllo iniziale interrompe l'esecuzione se rileva lo schema dell'app. Lo script è testato su PostgreSQL locale, compresa la pubblicazione delle cinque tabelle sincronizzate; il servizio Realtime ospitato richiede ancora collaudo.

Il percorso SQL Editor non aggiorna la cronologia migrazioni della CLI. Prima di passare a `db push`, confrontare lo schema e riconciliare le dodici versioni applicate con `supabase migration repair --status applied VERSIONI`; non marcare applicate migrazioni non eseguite. Vedere la [documentazione ufficiale sulle migrazioni](https://supabase.com/docs/guides/deployment/database-migrations).

Dopo la configurazione, `npm run check:backend` controlla Auth e la disponibilità delle 20 tabelle tramite richieste di sola lettura con `limit=0`. Il comando non registra account, non legge record familiari e non certifica RLS o sincronizzazione. Exit code: 0 se Auth risponde e tutte le tabelle risultano presenti o protette, 2 per schema incompleto/non verificato, 1 per configurazione o connessione fallita. Il file `.env` resta escluso da Git.

Sul progetto corrente le tredici migrazioni sono già applicate, registrate nella cronologia standard Supabase e confrontate con i file locali: **non rieseguire il bootstrap**. La migrazione 008 rimuove esplicitamente i grant anon e le operazioni dirette non necessarie assegnate dai default del servizio. Un rifiuto anon 401/42501 che nomina la tabella richiesta viene classificato PROTETTA dal check backend ed è atteso.

Per i controlli amministrativi è disponibile `supabase/tests/online_rls.sql`: tre identità sintetiche, due famiglie, inviti, acquisti e accesso anon, dentro una transazione annullata. Non invia email né conserva fixture. È stato eseguito con successo sul progetto reale il 14 novembre 2026; non sostituisce il collaudo Auth/JWT e Realtime tramite app.

## Rimozione dei dati

- **Categorie:** Catalogo prodotti → Categorie della famiglia → Elimina categoria. Anche quelle già usate possono essere eliminate: i prodotti restano sotto Altri prodotti.
- **Prodotti, punti vendita e ricette:** nel Catalogo, **Rimuovi dal catalogo** elimina definitivamente il prodotto e i dati collegati dopo conferma, anche se usato; vedere il dettaglio sotto. Punti vendita e ricette mantengono **Elimina** con i rispettivi vincoli. **Archivia** nasconde i record conservando collegamenti e storico. Mostra archiviati permette il Ripristina. I prodotti archiviati non compaiono nelle nuove selezioni; le liste esistenti conservano i riferimenti.
- **Articoli della spesa:** **Rimuovi dalla lista** è direttamente sotto ogni articolo, senza aprire Modifica. Funziona anche con acquisti registrati: rimuove dalla spesa attiva e dal confronto, conservando storico, statistiche e catalogo. **Mostra articoli rimossi → Rimetti nella lista** consente il recupero. Nessun pulsante di rimozione dal catalogo nella lista. Una nuova conferma del piano o aggiunta da ricetta può ripristinare l'articolo corrispondente, come indicato nel modulo/anteprima.
- **Piani settimanali:** **Elimina piano settimanale** è disponibile vicino alla settimana selezionata, anche per i piani archiviati. Dopo conferma delle date, cancella definitivamente il piano e i suoi pasti; lista della spesa, quantità già trasferite, acquisti, ricette, modelli e altre settimane restano invariati. La stessa settimana può essere ricreata vuota. **Archivia** nasconde invece il calendario e permette **Ripristina**. Pasti e modelli mantengono i propri comandi di eliminazione.
- **Ingredienti e sconti:** gli ingredienti già salvati e le regole sconto possono essere eliminati; nel modulo ricetta si può rimuovere l'ultimo ingrediente aggiunto. Le liste e le previsioni già salvate restano invariate.
- **Previsioni:** Archivia/Ripristina nelle Statistiche; importi e dettagli rimangono immutabili. **Prezzi e acquisti:** Annulla conserva la traccia ed esclude il record dai calcoli. Le rilevazioni annullate sono consultabili con Mostra annullate. **Inviti:** Revoca invalida il codice.

## Flussi disponibili

- **Lista della spesa unica:** in alto gli articoli da acquistare e acquistati, sotto il modulo **Aggiungi alla lista** e i suggerimenti **Acquistati spesso**. Articoli liberi o collegati al catalogo, ricerca, quantità manuali e note, raggruppamento per categoria. Gli acquisti restano separati dai contributi e possono essere annullati conservando la traccia.
  Il campo **Prodotto dal catalogo** usa lo stesso autocompletamento di ricette e pasti: scrivere nome, marca o barcode filtra i suggerimenti, sempre alfabetici per nome del prodotto, ignorando accenti e maiuscole e accettando più parole parziali. Marca, variante e formato distinguono i risultati. Selezionare con tocco, mouse o frecce e Invio; modificare il testo annulla la scelta precedente. Non ci sono più ricerca e menu separati. Un nome scritto liberamente nella lista non popola automaticamente il catalogo. Il campo **Nome per articolo libero** resta disponibile senza selezione; **Scrivi un articolo libero** permette di abbandonare una scelta già fatta. Se il catalogo è vuoto, il modulo lo spiega e permette comunque l’inserimento libero. Scegliere un prodotto con formato propone il contenuto di una confezione; quantità e unità restano modificabili tramite conversioni compatibili. Scansione barcode, ritorno dal Catalogo e conferma esplicita Aggiungi conservati.
- **Acquisti:** quantità parziali e surplus; prezzo totale effettivo facoltativo, completabile dopo; negozio, prodotto commerciale e stato promozionale. Il semplice acquisto senza prezzo non genera osservazioni di prezzo. Una correzione si effettua annullando e registrando un nuovo evento.
- **Catalogo e negozi:** dashboard iniziale **Riepilogo catalogo**, con due soli totali: prodotti attivi e categorie esistenti, incluse quelle vuote. Nessun dettaglio per categoria; i raggruppamenti tecnici non sono contati e le diverse schede marca/variante sono prodotti distinti. I conteggi sono indipendenti dalla ricerca e dalla vista archiviati. Segue un solo modulo **Nuovo prodotto**. È obbligatorio soltanto il nome; categoria, marca, EAN, variante e formato sono facoltativi e modificabili in seguito. La tabella **Prodotti** si può ridurre/espandere dal titolo per raggiungere più facilmente le categorie; scrivere nella ricerca la riapre. I prodotti sono sempre ordinati per nome A–Z, senza selettore di direzione; anche ricerca e archiviati seguono l'ordine alfabetico.
  I campi **Formato della confezione** sono sempre visibili, senza espandi/riduci e senza la scritta facoltativo. Il formato può comunque restare vuoto; se viene indicato, quantità e unità devono essere entrambe presenti. Nel Catalogo le unità selezionabili sono g, ml, pz e conf. Formati precedenti o letti dal barcode in kg/L vengono proposti nel modulo come g/ml con conversione esatta (1 kg → 1000 g, 1 L → 1000 ml); il nuovo valore viene salvato solo con conferma. Le unità storiche continuano a essere gestite nelle altre sezioni e nei calcoli. **Modifica** porta la pagina sul campo del nome e gli assegna il focus, anche selezionando di nuovo lo stesso prodotto; rispettata la preferenza di movimento ridotto. I prodotti senza formato sono selezionabili nelle liste e per registrare prezzi, ma non producono stime sulle confezioni finché il formato non è noto. Un prodotto scelto senza marca o altri identificatori permette il confronto tra le marche associate; marca, EAN o variante specificati vincolano la scelta.
  Nella tabella **Prodotti**, **Rimuovi dal catalogo** cancella la scheda e gli articoli della lista collegati (anche già rimossi), i relativi contributi, acquisti e storico prezzi, incluse osservazioni annullate. Cancella le previsioni salvate che citano i dati rimossi, senza mantenere totali incompleti, e pulisce le esclusioni dalle regole sconto. Se viene rimossa l’ultima marca/variante dello stesso alimento, elimina anche il raggruppamento interno, il relativo ingrediente dalle ricette e le voci dirette di pasti e modelli. Le ricette, i modelli e le altre loro voci restano. Se esistono altre marche/varianti, restano anche i collegamenti generici all’alimento condiviso. Nessuna corrispondenza dedotta dal solo testo di un articolo libero. Le statistiche si ricalcolano senza gli acquisti eliminati; l’operazione è irreversibile. **Archivia** resta disponibile per conservare lo storico. I negozi e le categorie restano indipendenti.
- **Prezzi:** ordinari storici, promozioni datate, rilevazioni non classificate, annullamenti tracciati. Il prezzo è **per confezione**, non per kg/litro salvo che il formato sia esattamente kg/litro. Non si trasformano automaticamente acquisti in prezzi ordinari. Nei campi monetari usare la virgola (es. `2,50`); qualsiasi punto, anche come separatore delle migliaia, mostra un errore e blocca il salvataggio. Ammessi interi e fino a due decimali; importi sconosciuti ancora lasciabili vuoti nei campi opzionali. Soglie e massimali degli sconti già salvati vengono proposti con la virgola.
- **Confronto:** una lista, residui e confezioni intere; alternativa generica compatibile più conveniente. I negozi incompleti sono distinti e non classificati in base al totale parziale. Nessuna ottimizzazione su più supermercati.
- **Sconti personali:** configurabili per negozio e giorno, periodo, percentuale, priorità, prodotti esclusi, soglia e massimale **per riga**. Una sola regola per riga, senza cumulo tra regole personali; eventuale cumulo con promozioni richiede conferma esplicita. Regole non confermate e prezzi incerti non danno sconti presunti. Condizioni riferite all'intero scontrino e categorie escluse non sono ancora supportate.
- **Ricette e pasti:** creazione atomica con ingredienti di catalogo, ricerca anche per ingrediente, preferite, duplicazione, scaling, aggiunta diretta a lista; calendario lunedì–domenica con più componenti per pasto, duplicazione settimana e modelli. I selettori degli ingredienti e di **Ricetta o alimento** sono sempre alfabetici: scrivere parte del nome per filtrare i suggerimenti, poi selezionare con tocco, mouse o frecce e Invio. La ricerca ignora maiuscole e accenti; nel calendario ricette e alimenti hanno un’indicazione del tipo per distinguere gli omonimi. Le modifiche alle quantità della lista richiedono anteprima e conferma; un conflitto di versione della lista o del piano invalida la proposta. L'editing completo degli ingredienti di ricette esistenti resta da completare.
- **Statistiche:** pagato reale non annullato, copertura parziale, periodi, trend, categorie, negozi e liste; snapshot immutabili della previsione. Il dettaglio analitico delle differenze di prodotti/quantità rispetto alla previsione è ancora parziale.
- **Scanner:** EAN-8/13 con checksum, API BarcodeDetector dove disponibile, fallback manuale e gestione camera negata. OCR e importazione URL/scontrini non sono implementati.

## Verifiche

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
node scripts/secrets.mjs
npm audit --omit=dev
npm run licenses
```

`npm test` esegue calcoli di dominio e SQL su PostgreSQL tramite PGlite, con ruoli e RLS effettivi. Il namespace Auth è una fixture locale: non equivale al collaudo Supabase Auth/PostgREST/Realtime. Playwright usa **soltanto nei test** risposte HTTP controllate e dati fittizi, su desktop e viewport mobile Chromium. Non dimostra l'installazione su iPhone o Android fisici.

La CI GitHub esegue lint, typecheck, test, build e browser test. Gli autocompletamenti sono verificati anche con WebKit e profilo touch iPad, oltre a Chromium desktop/mobile; l’emulazione non sostituisce il collaudo sul dispositivo fisico. [TEST_REPORT.md](TEST_REPORT.md) distingue esecuzioni locali, CI e test non eseguiti. Gli avvisi residui dell'audit di sviluppo sono registrati lì; non applicare `audit fix --force` senza revisione.

## Deploy statico con HTTPS

L'app è pubblicata su **[spesa-intelligente-luca-gh.pages.dev](https://spesa-intelligente-luca-gh.pages.dev)**, progetto gratuito Cloudflare Pages collegato al solo repository `luca-gh/spesa-intelligente`. Non occorre tenere acceso il PC o acquistare un dominio.

Configurazione: branch di produzione `main`, build `npm ci && npm run check && npm run check:secrets`, output `dist`, Node 22.23.5 tramite `.node-version`. Le variabili di build sono esclusivamente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Il file `public/_redirects` supporta il router client-side. `public/_headers` imposta CSP, permessi camera e rivalidazione di service worker e manifest; se usi un dominio Supabase personalizzato, aggiorna connect-src con gli endpoint HTTPS/WSS esplicitamente consentiti.

**Installazione:** Android/Chrome → menu → Installa app; iPhone/Safari → Condividi → Aggiungi alla schermata Home. Accedere con l'account esistente: il database Supabase è lo stesso della versione locale. Le modifiche richiedono Internet.

**Aggiornamenti:** sviluppare e verificare le modifiche con `npm run check`, `npm run check:secrets`, `npm run check:pwa` (dopo build e installazione Chromium) e `npm run test:e2e`, poi pubblicare su `main`. Cloudflare costruisce e distribuisce automaticamente una nuova versione allo stesso indirizzo, fermando la pubblicazione se i controlli della build falliscono. La CI GitHub esegue anche audit, prova degli aggiornamenti PWA e test browser. Le modifiche al database richiedono migrazioni separate, compatibili con i client già installati; il deploy del frontend non cancella né reinizializza i dati.

L'app controlla nuove versioni al ritorno in primo piano, alla riconnessione e ogni ora mentre è aperta. Quando compare **Aggiorna app**, completare prima gli inserimenti in corso e premere il pulsante: non serve reinstallare. Un controllo di aggiornamento fallito lascia disponibile la versione corrente. Per tornare a una versione precedente usare un deployment riuscito nel pannello Cloudflare; il rollback del frontend non ripristina automaticamente lo schema o i dati Supabase.

Non pubblicare `.env`, report con dati reali, dump del database o immagini private. I documenti originari del progetto sono mantenuti solo localmente e sono esclusi da Git perché possono includere informazioni personali. Pubblicare il codice non rende pubblici i dati Supabase: la protezione dipende dall'applicazione corretta delle RLS.

Supabase Site URL è l'origine HTTPS pubblica, con redirect esatti all'origine e a `/impostazioni`. Gli indirizzi localhost/127.0.0.1 di sviluppo sono conservati; non sono stati aggiunti wildcard. HTTPS, manifest, routing, icone, service worker, layout mobile e shell offline sono verificati sul sito reale. Restano da collaudare installazione e fotocamera su Android/iOS fisici e il percorso completo con due account reali, rinviato dall'utente. Il service worker conserva solo asset statici; non memorizza risposte API. Le modifiche offline sono disabilitate.

## Ordine delle categorie

In **Catalogo → Categorie della famiglia**, trascinare la maniglia di una categoria e rilasciarla nella posizione desiderata. Funziona con mouse e tocco; sono disponibili frecce su/giù e tasti freccia sulla maniglia. Il salvataggio automatico aggiorna l’intera sequenza in una transazione e la lista della spesa raggruppa i prodotti nello stesso ordine. Le nuove categorie vengono aggiunte in fondo. L’ordine è condiviso nella famiglia e le modifiche alle categorie attivano il ricaricamento Realtime dei client collegati. Offline i controlli sono disabilitati; annullamento, errori e conflitti non conservano un ordine parziale. Un conflitto ricarica le categorie correnti, permettendo di riprovare.

## Inserimento da codice a barre

Nella **lista della spesa → Aggiungi alla lista**, premi **Scansiona barcode**. Se il codice appartiene a un prodotto attivo del Catalogo, viene selezionato e viene proposta una confezione, con quantità e unità modificabili: premi **Aggiungi** per confermare. Per un codice nuovo, **Completa prodotto e torna alla lista** apre il Catalogo con la ricerca dati già avviata; dopo **Salva prodotto** torni alla lista con la scheda selezionata. Se i dati non sono disponibili, completa il nome manualmente. I prodotti archiviati richiedono ripristino dal Catalogo. È disponibile anche **Inserisci il barcode manualmente**. Restano disponibili ricerca, selettore del catalogo e articoli liberi. La lettura non registra un acquisto e non aggiunge articoli senza conferma.

In **Catalogo prodotti → Scansiona barcode**, autorizzare la fotocamera e inquadrare un EAN-8/EAN-13. In alternativa scrivere il codice EAN e premere **Cerca dati dal barcode**. La pagina Scanner apre lo stesso modulo del catalogo. Nome, marca e formato sono compilati quando disponibili; la categoria viene proposta solo se corrisponde senza ambiguità a una categoria già esistente. Non vengono create categorie automaticamente. Verificare i campi e premere **Salva prodotto**: la ricerca non salva nulla.

I prodotti già presenti sono riconosciuti prima di interrogare il servizio esterno. I campi già scritti richiedono conferma prima della sostituzione. Codici assenti, dati incompleti, errori o limiti del servizio permettono di continuare manualmente; nessun formato viene dedotto dal solo nome.

La lettura avviene sul dispositivo, con riconoscimento nativo oppure ZXing; le immagini non vengono caricate. Solo il codice viene inviato al proxy `/api/products/:barcode?scope=supermarket`: prima cerca in [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) e, in assenza di un risultato, in Open Beauty Facts (cosmetici/igiene personale) e Open Products Facts (altri prodotti, compresa la casa). [Documentazione delle fonti aggiuntive](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/scanning-cosmetics-pet-food-and-other-products/). Open Pet Food Facts non viene consultato; i record dichiarati `petfood` vengono ignorati. Nessuna chiave API o abbonamento aggiuntivo.

La fonte effettiva è indicata vicino ai campi compilati, con attribuzione [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Copertura e completezza non sono garantite: nome, marca, categoria o formato mancanti restano manuali. Un numero senza unità non viene interpretato come formato. Le categorie proposte devono già esistere e avere corrispondenza univoca. Il proxy accetta solo tre host fissi, non segue redirect, non inoltra credenziali della famiglia e usa un limite complessivo di 10 secondi. Cache pubblica: 24 ore per risultati, 5 minuti per assenti solo se tutte le fonti hanno risposto senza errori. Un guasto parziale non viene memorizzato come assenza del prodotto. Gli alimentari trovati richiedono una sola richiesta; le due fonti alternative partono soltanto dopo un mancato risultato. Richieste esplicite, senza ricerca a ogni tasto o retry automatici. Il percorso senza `scope` mantiene il comportamento alimentare per i client installati precedenti, evitando attribuzioni errate finché non vengono aggiornati.

Cloudflare Pages compila `functions/` dal repository; `public/_routes.json` limita le Functions a `/api/products/*`. Il deploy deve includere Functions: un hosting puramente statico non esegue il proxy. `npm run dev` fornisce lo stesso endpoint locale. Service worker escluso per `/api/`; cache browser/backend solo per dati pubblici, nessuna cache aggiuntiva dei dati familiari.

## Export e backup

Impostazioni permette JSON dei dati caricati e CSV degli acquisti, con importi e annullamenti. L'esportazione JSON ha `schema_version: 1`, include i dati familiari e gli snapshot, esclude gli inviti. È privata: non committarla. Non è un backup automatico del provider né uno snapshot transazionale del database sotto modifiche concorrenti. Per una copia coerente sospendere temporaneamente le modifiche degli altri membri e aggiornare prima la pagina; per backup completi usare strumenti PostgreSQL in un contesto amministrativo protetto.

Il ripristino JSON/CSV non è implementato: richiederà validazione, mappatura UUID, verifica appartenenza e una transazione, prima su ambiente di sviluppo. Non importare eseguendo SQL da file non verificati.

## Ownership e cancellazioni

I membri attivi hanno permessi equivalenti. Uscire revoca l'accesso senza eliminare lo storico condiviso. L'ultimo membro deve conservare la famiglia oppure cancellarla esplicitamente dopo esportazione, confermando il nome. Anche **Rimuovi dal catalogo**, dopo conferma esplicita, elimina lo storico del prodotto scelto: RPC atomica `delete_catalog_product`, accessibile soltanto ai membri attivi della stessa famiglia. Il wrapper pubblico è SECURITY INVOKER; l’implementazione privata SECURITY DEFINER verifica l’identità e limita ogni modifica alla famiglia corrente, mantenendo acquisti e prezzi non scrivibili direttamente. La migrazione `20261115190432_delete_catalog_product.sql` installa solo le funzioni: nessun prodotto esistente viene eliminato dall’aggiornamento.

La cancellazione dell'identità Auth non è self-service: il gestore deve rimuovere le appartenenze non più attive e l'identità da Supabase dopo aver verificato l'ownership dello storico. Non rimuovere utenti referenziati dagli acquisti senza una procedura di anonimizzazione. Un endpoint dedicato rimane da progettare e testare.

## Limiti operativi e risoluzione problemi

- **Configurazione necessaria:** controllare `.env`, nomi variabili, chiave pubblica e riavviare Vite.
- **Accesso non riuscito:** confermare email, controllare URL di redirect e Auth del progetto; gli errori interni non vengono mostrati.
- **RLS/errore caricamento:** applicare tutte le migrazioni; non disabilitare RLS per risolvere problemi di accesso.
- **Lista modificata:** aggiornare e ricalcolare l'anteprima; nessuna sovrascrittura automatica della proposta altrui.
- **Realtime:** le quattro tabelle delle liste devono essere pubblicate; vengono ricaricate tutte le collezioni dopo un evento o al ritorno online/focus. Altre sezioni non hanno eventi propri e si aggiornano al focus o dopo un salvataggio.
- **Dati numerosi:** caricamento iniziale limitato a 10.000 record per tabella; se il limite viene raggiunto il caricamento fallisce esplicitamente. Prima di avvicinarsi a questa dimensione, implementare paginazione e aggregazioni server-side.
- **Camera:** richiede HTTPS/localhost e permessi; senza riconoscimento nativo viene caricato ZXing. Resta sempre disponibile l'inserimento EAN manuale. Prove su fotocamere fisiche Android/iOS ancora da eseguire.
- **PWA vecchia:** confermare l'aggiornamento proposto; durante sviluppo il service worker non è attivo.

Dipendenze e relative licenze sono elencate in [DEPENDENCIES.md](DEPENDENCIES.md). Non è stata assegnata una licenza al codice originale del progetto: la decisione spetta al titolare.
