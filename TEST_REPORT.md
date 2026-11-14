# Rapporto test

Data: 14 novembre 2026, Europe/Rome. Ambiente locale Windows, Node.js 22 LTS portatile, npm, PGlite/PostgreSQL, Playwright Chromium. Versioni esatte nel lockfile. Verifiche locali concluse e confermate in CI su Linux/Node 22.

## Verifica sul servizio reale dopo le migrazioni

Migrazioni 001–009 e 20261114221151: PASS, applicate e registrate nella cronologia standard con SQL originale e checksum verificati. Il dashboard è stato usato dopo login interattivo, senza acquisire chiavi amministrative.

Security review reale: 20 RLS attive, 0 grant anon sulle tabelle e sulle RPC, 24 RPC per authenticated con search_path fissato, quattro tabelle nella pubblicazione Realtime. Migrazione 008 verificata anche con default grant Supabase emulati localmente.

supabase/tests/online_rls.sql: PASS sul progetto reale. Due membri, invito/accettazione, seconda famiglia, isolamento di letture/scritture/RPC, acquisto parziale senza prezzo idempotente, uscita e accesso anon negato. La transazione viene annullata: dopo rollback zero famiglie, liste, acquisti e identità sintetiche residue. Nessuna email inviata.

Check backend reale: PASS, Auth HTTP 200; 20 tabelle PROTETTA (401/42501 riferito alla tabella richiesta). Non equivale al collaudo autenticato Auth/JWT/PostgREST o Realtime su due client, tuttora NOT RUN completo.

Suite locale attuale: 54 PASS in 6 file, inclusi bootstrap completo, privilegi predefiniti e script SQL online con rollback. Controlli locali finali PASS: lint, typecheck, build, 54 test, 68 test browser e controllo segreti. CI del nuovo commit verificata separatamente dopo la pubblicazione.

| Area                            | Ambiente e verifica                                                                                                  | Stato                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dominio e RLS                   | `npm test`: 49 test, 5 file                                                                                          | PASS                                                                  |
| Arrotondamenti e unità          | HALF_UP, virgola, 750g/500g, conversioni incompatibili, residuo/surplus, porzioni e discreti                         | PASS                                                                  |
| Prezzi e promozioni             | Ordinario vecchio, promo scaduta/senza scadenza, generico/specifico, ignoti, copertura, pareggi e negozi separati    | PASS                                                                  |
| Sconti personali                | Martedì/mercoledì/giovedì, non cumulo, conferma, altro negozio, incertezza, ranking al cambio data, storico immutato | PASS                                                                  |
| Isolamento dati                 | Ruoli authenticated/anon reali su PostgreSQL con Auth fixture, due membri e due famiglie, FK composte, RPC protette  | PASS                                                                  |
| Inviti                          | Monouso, scaduto, revocato, uscita con perdita accesso                                                               | PASS                                                                  |
| Acquisti                        | Idempotenza, payload diverso respinto, senza prezzo, completamento prezzo, annullamento senza cancellazione          | PASS                                                                  |
| Piano-lista                     | Contributi manuali protetti, rollback sotto acquistato, versione lista/piano obsoleta                                | PASS                                                                  |
| Workflow SQL                    | Ricetta atomica, scaling discreto/addizione idempotente, duplicazioni, snapshot immutabile, cancellazione protetta   | PASS                                                                  |
| Segreti in configurazione       | Build rifiuta JWT service_role e nuove secret key; chiavi pubbliche ammesse                                          | PASS                                                                  |
| Browser base                    | 10 casi Chromium desktop/mobile, HTTP Supabase fixture                                                               | PASS, esecuzione iniziale                                             |
| Browser ampliato                | Accessibilità WCAG A/AA automatica e camera negata, 48 casi totali                                                   | PASS                                                                  |
| Lint/typecheck/build            | `npm run check` completo, verificato localmente e in CI                                                              | PASS                                                                  |
| Audit runtime                   | `npm audit --omit=dev`                                                                                               | PASS: 0 vulnerabilità segnalate                                       |
| Audit tooling                   | `npm audit`                                                                                                          | 4 LOW residui PWA/workbox/resolve/deepmerge, 0 moderate/high/critical |
| Auth/PostgREST/Realtime online  | Due account e un esterno, reconnessione, sessione, concorrenza distribuita                                           | NOT RUN completo: flussi Auth/JWT e WebSocket; SQL RLS reale PASS     |
| Migrazione publication Realtime | DDL Supabase della migrazione 003                                                                                    | PASS: DDL e pubblicazione sul servizio reale; WebSocket NOT RUN       |
| Storage privato                 | Nessun upload o bucket attivo                                                                                        | NOT RUN; funzionalità rinviata                                        |
| Importazioni                    | OCR ricette/scontrini, URL/SSRF, revisione e deduplica                                                               | NOT RUN: funzionalità non implementata                                |
| Android/iOS fisici              | Installazione PWA, camera e sessione su dispositivi                                                                  | NOT RUN: dispositivi non collegati                                    |
| CI GitHub                       | Workflow predisposto                                                                                                 | PASS: run 43617987975, commit 566e874                                 |
| Hosting HTTPS                   | Deployment e smoke test                                                                                              | NOT RUN: non pubblicato                                               |

I test browser non sostituiscono RLS né il servizio Realtime; l'emulazione mobile Chromium non è Safari iOS. Le migrazioni di dominio vengono applicate a un PostgreSQL vuoto ad ogni esecuzione dei test. Non è stato effettuato un ripristino su Supabase ospitato né un benchmark con grandi volumi. Gli strumenti di accessibilità automatici non equivalgono a una verifica con lettore schermo reale.

CI verificata: [esecuzione 43617987975](https://github.com/luca-gh/spesa-intelligente/actions/runs/43617987975), conclusa con successo il 14 novembre 2026 alle 17:53 Europe/Rome. Verificato anche il rifiuto effettivo di una build con chiave privilegiata fittizia. Nessun segreto reale utilizzato per questa prova.

## Primo account reale

**PASS manuale con riscontro DB**: l'utente conferma l'accesso riuscito; query di sola lettura su conteggi aggregati conferma un account con email verificata, una sessione Auth, una famiglia, un membro attivo e una lista. La sessione appartiene al browser dell'utente, mentre il browser automatizzato separato rimane sul login: nessuna dichiarazione di test E2E automatico per questo percorso. Nessuna email, password o token riportati nei log o nei documenti.

Redirect locali Auth salvati e verificati sul servizio dopo ricaricamento: Site URL `http://127.0.0.1:5173`; quattro redirect espliciti per le due origini locali, radice e `/impostazioni`. Salvataggio del primo articolo verificato sul DB; visualizzazione dopo refresh **PASS manuale**, confermata dall'utente. Secondo account rinviato su richiesta dell'utente; sincronizzazione su due client ancora da collaudare.

## Regressioni del menu prodotto

Prima della correzione riprodotti errori nei nuovi test. Verifica reale di sola lettura: catalogo vuoto e un articolo libero. Nessun prodotto dimostrativo aggiunto al progetto ospitato; cataloghi fittizi solo nei test browser.

**PASS: 24 test browser**, 12 scenari su desktop e mobile. I cinque aggiunti coprono catalogo vuoto/nome obbligatorio; commerciale e payload; generico/conversione L/ml; ricerca marca/EAN senza selezioni nascoste; dati conservati al fallimento e puliti dopo successo. Axe A/AA sul nuovo modulo senza violazioni; screenshot e controllo overflow verificati. Corretto un matcher di test non supportato prima della verifica finale.

`npm run check`, `npm run test:e2e` e `npm run check:secrets` PASS: 42 test dominio/SQL e 24 browser. Resta l'avviso noto di build per il bundle iniziale oltre 500 kB. CI del nuovo commit verificata dopo pubblicazione, separatamente dai risultati locali.

## Storico del collegamento prima delle migrazioni

URL e publishable key ricevuti e salvati esclusivamente in .env, ignorato da Git. Check in sola lettura: Auth HTTP 200, email/password attiva, conferma email richiesta; 20 tabelle non esposte nella Data API (HTTP 404/PGRST205). Migrazioni remote non eseguite e nessun utente creato. Il gate online rimane BLOCKED.

Nuovi test bootstrap: sette migrazioni applicate in un'unica transazione su PGlite vuoto, 20 tabelle con RLS, quattro tabelle nella pubblicazione; seconda esecuzione respinta senza alterare lo schema. Totale npm test: 40 PASS. Build con configurazione reale PASS, con avviso bundle iniziale oltre 500 kB.

## Eliminazione di prodotti dal catalogo

**PASS locale: 49 test dominio/SQL e 48 test browser.** Due nuovi test PostgreSQL verificano eliminazione dei prodotti inutilizzati con RLS, rifiuto cross-family e blocco FK senza perdita di lista o prezzi. Quattro scenari browser su desktop/mobile verificano rimozione di generico e commerciale, uscita dalla modifica, annullamento senza richiesta DELETE e messaggio sicuro per entrambi i tipi di prodotto in uso. Lint, typecheck, build e controllo segreti PASS. Nessuna cancellazione sul database reale e nessuna modifica dello schema. CI verificata separatamente dopo pubblicazione.

## Storico dopo installazione, prima della sessione web

Supabase risulta installato. La sessione corrente non espone metodi amministrativi del servizio: esecuzione SQL e migrazioni remote NOT RUN. Nuovo check backend in sola lettura conferma Auth HTTP 200 e 20 tabelle non esposte (404/PGRST205, exit code 2). Gli esiti locali e CI precedenti restano distinti dal gate online, tuttora BLOCKED.

## Rimozioni e archiviazione — migrazione 009

49 test locali e 48 prove browser PASS. Nuovi casi: categoria usata eliminata senza cancellare prodotti; RPC vietate a famiglie esterne e anon; prodotti con prezzi e snapshot archiviabili senza variazioni monetarie; articoli con acquisti archiviabili con controllo di versione; piani archiviati invalidano vecchie anteprime; copia lista senza articoli archiviati e ripristino tramite conferma piano. Browser desktop/mobile: categorie, prodotti esclusi dalle nuove scelte e ripristino, punti vendita, articoli, ingredienti e ricette, piani, sconti e previsioni. Corretto un messaggio di stato che intercettava i tocchi su mobile.

Migrazione 009 applicata sul progetto reale. Nessun dato esistente eliminato o archiviato durante lo sviluppo. Le verifiche browser usano fixture e non equivalgono al collaudo multi-account, rinviato su richiesta.

## Deploy e aggiornamenti PWA

Versione 574a09a pubblicata con successo su https://spesa-intelligente-luca-gh.pages.dev. Cloudflare ha costruito il commit corretto dopo il superamento dei controlli. CI [43642331112](https://github.com/luca-gh/spesa-intelligente/actions/runs/43642331112): PASS, inclusi 49 test locali, 48 browser, controllo segreti, audit runtime e nuovo `npm run check:pwa`.

Il test PWA usa la build di produzione su un server locale isolato: attende l'attivazione iniziale, propone un worker modificato, scatena il controllo al ritorno in primo piano, verifica il pulsante Aggiorna app e l'attivazione dopo conferma. Non modifica dati Supabase. La prova è parte della CI; non equivale a un test su telefono fisico.

Verifica in sola lettura del sito reale: HTTP 200 su home, route SPA /catalogo, manifest, sw.js e icone 192/512; manifest standalone corretto; CSP presente e cache worker/manifest rivalidabile. Chromium con viewport mobile: contesto sicuro, API fotocamera disponibile, nessun overflow, accesso visibile, service worker attivato e controllante, ricarica offline con messaggio di blocco modifiche e zero errori JS/console. Nessun login automatico, password, token di sessione o dato familiare letto. Installazione fisica e acquisizione foto Android/iOS: NOT RUN.

Supabase Auth verificato dopo salvataggio e ricarica delle impostazioni: Site URL sull'origine pubblica, redirect esatti all'origine e /impostazioni, indirizzi locali conservati, nessun wildcard aggiunto.

## Notifica Salvato persistente

Correzione della conferma che rimaneva in sovraimpressione anche cambiando pagina. Il Provider cancella il messaggio dopo 4 secondi; i testi lunghi hanno una durata proporzionata, fino a 12 secondi. Un nuovo messaggio annulla il timer precedente. Non sono richieste modifiche al database.

PASS: 49 test locali, 52 prove browser desktop/mobile, lint, typecheck, build, controllo segreti e prova aggiornamenti PWA. Due scenari nuovi, eseguiti su entrambi i formati, verificano scadenza, navigazione senza ricomparsa e secondo salvataggio con durata rinnovata.

## Ordinamento del catalogo per prodotto

Prodotti generici e commerciali ordinati insieme per nome italiano, A–Z come impostazione iniziale, Z–A selezionabile. Ordinamento applicato ai risultati della ricerca e agli archiviati, senza modificare l'ordine degli array condivisi o i dati salvati. Il selettore ha un'etichetta esplicita e la colonna comunica la direzione tramite aria-sort.

PASS: 49 test locali e 56 prove browser. Due nuovi scenari su desktop/mobile verificano l'ordine combinato dei tipi, cambio direzione, ricerca e archiviati. Nessuna migrazione o modifica di dati reali.

## Catalogo unificato e dettagli facoltativi

Migrazione 20261114221151 generata con CLI Supabase 3.1.0, testata e applicata al servizio reale. Dieci checksum verificati, venti tabelle RLS, nuova RPC save_catalog_product SECURITY INVOKER con search_path fissato, EXECUTE anon revocato e authenticated concesso. Salvataggio atomico soggetto alle RLS esistenti. Nessun identificativo precedente eliminato o sostituito nei riferimenti storici. Formato assente rappresentato da NULL, senza confezioni fittizie.

PASS: 54 test in sei file e 68 prove browser desktop/mobile, lint, tipi, build e prova aggiornamento PWA. Nuovo test migrazione su dati preesistenti con acquisti: stessi identificativi, importi, riferimenti e archiviazioni. Test SQL: nome solo, aggiunta/rimozione dettagli, rollback di formato/EAN/categoria non validi, unicità EAN, accesso cross-family e anon negato. Test prezzi: formato ignoto escluso dalle stime. Browser: modulo unico, nome obbligatorio, categoria/marca/EAN facoltativi, formato aggiunto in seguito e cancellato, nessuna doppia scheda, elenco unico nelle liste, confronto senza marca, ordine A–Z senza selettore.

Script online_rls.sql esteso ed eseguito sul progetto reale: PASS anche per catalogo con solo nome, modifica dettagli e accesso negato da altra famiglia/anon. Rollback integrale; zero identità sintetiche residue. Security Advisor rieseguito via dashboard autenticata: 0 errori, 25 avvisi preesistenti relativi alle RPC SECURITY DEFINER abilitate ai membri e alla protezione password compromesse disabilitata. La nuova RPC è invoker. CLI advisors non autenticata; non sono stati acquisiti token amministrativi né attivati piani a pagamento. Non si dichiara un audit senza avvisi.
