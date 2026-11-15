# Rapporto test

## Cancellazione completa prodotti — 15 novembre 2026

Due nuovi test PostgreSQL: script SQL riutilizzabile con fixture temporanee e rollback forzato tramite errore prima della cancellazione finale. Verificati prodotto archiviato/attivo, generico legacy, scheda senza gruppo, ultima marca e gruppo condiviso con marca archiviata; rimozione di articoli attivi/rimossi, contributi, acquisti, prezzi annullati/attivi, ingredienti, pasti, JSON dei modelli, esclusioni dagli sconti e previsioni annidate. Conservati altri prodotti, acquisti, prezzi, ricette, modelli, categorie e negozi; incremento versioni lista/piani, anteprima obsoleta respinta. Due membri sintetici, famiglia estranea, accesso privato diretto, anon e grant sulle tabelle contabili verificati.

Lo stesso script `supabase/tests/catalog_deletion.sql` eseguito sul progetto reale: PASS, transazione annullata. Impronte di tutte le 20 tabelle applicative e di auth.users identiche prima dell’installazione/test e dopo; nessuna fixture persistente o prodotto reale eliminato. Migrazione 20261115190432 registrata, checksum SQL corrispondente al file locale. Advisor security/performance senza errori: restano 23 RPC pubbliche definer, protezione password compromesse, indici FK/RLS e policy preesistenti. La nuova implementazione privilegiata è nello schema private, con wrapper pubblico invoker; nessun nuovo grant di scrittura diretta.

Prove browser desktop/mobile con fixture: conferma nominativa e irreversibilità, annullamento senza RPC, una sola RPC senza DELETE separati, errore con bozza conservata e nuovo tentativo, blocco offline, aggiornamento lista anche dopo refresh, ingrediente rimosso da ricetta conservata, pasto diretto rimosso e ricetta nel calendario conservata, storico prezzi pulito. Non sono prove Auth/JWT su due account reali o test hardware iPad.

Suite completa locale PASS: 84 test in 11 file e 120 prove browser desktop/mobile. Lint, tipi, build, aggiornamento PWA e controllo segreti PASS; CI del commit e disponibilità HTTPS verificate alla pubblicazione.

## Autocompletamento ricette e pasti — 15 novembre 2026

Tre nuovi test locali per ordine italiano, ricerca parziale su più parole senza accenti/maiuscole, identificativi conservati e omonimi ricetta/alimento. Otto nuove prove browser desktop/mobile PASS: lista alfabetica senza archiviati, selezione da tastiera e tocco simulato, righe ingrediente indipendenti, nessun risultato, testo modificato senza identificativo obsoleto, errore con scelta conservata, reset dopo salvataggio, calendario con ricetta e alimento omonimi e payload corretti. Fixture isolate: nessun dato reale letto o scritto; il tocco simulato non equivale a prova hardware iPad.

Suite completa locale: 82 test in 10 file e 116 prove browser PASS. Controlli lint, tipi, build, aggiornamento PWA e segreti PASS. Aggiunta finale della validazione del testo composto solo da spazi: ripetute le otto prove mirate; suite completa del commit verificata anche in CI alla pubblicazione.

## Tre fonti barcode, esclusi animali — 15 novembre 2026

Suite browser completa 108 PASS desktop/mobile. Nuovi casi: cosmetico e prodotto per la casa, fonte/link corretti, campi e categoria già esistente, formato, ritorno dal Catalogo e aggiunta alla lista solo dopo conferma, nessun overflow mobile. I test browser usano fixture e non interrogano i provider. Suite locale corrente 79 casi; 19 test proxy/parser PASS, compresi fallback tra tre host, alimentari senza chiamate aggiuntive, guasto di una fonte con risultato da un’altra, rifiuto redirect/animali e dati mancanti, corrispondenza barcode, attribuzione e conteggi espliciti. Client senza scope restano alimentari. Lint, tipi e build verificati; prova PWA e controllo segreti eseguiti prima della pubblicazione.

Verifica di connettività separata sui provider pubblici: shampoo 8001090662231 restituito da Open Beauty Facts e articolo per bucato 3178041366304 restituito da Open Products Facts, entrambi HTTP 200. Il secondo riporta quantità 52 senza unità: nessun formato dedotto. Gli host staging dedicati alle due fonti non risultavano risolvibili; prove automatizzate isolate con mock e probe pubblici limitati, senza autenticazione e senza scritture.

## Inserimento nella lista tramite barcode — 15 novembre 2026

72 test locali PASS. 10 nuove prove browser mirate desktop/mobile PASS: lettura camera con stream sintetico, selezione e quantità modificabile, nessuna ricerca esterna per prodotti presenti, nessuna scrittura prima di Aggiungi, nuovo codice con ricerca/creazione Catalogo e ritorno selezionato, codici errati o assenti conservano l’articolo libero, archiviati esclusi e blocco offline. Riuso della camera nativa/ZXing già collaudata; verifica hardware iPad ancora da eseguire. Suite completa corrente: 104 casi. Nessuna modifica schema o dato reale.

## Rimozione immediata dalla lista — 15 novembre 2026

12 test browser mirati desktop/mobile PASS: pulsante visibile senza Modifica, rimozione dopo acquisto parziale, persistenza dopo refresh, ripristino con quantità acquistata intatta, prodotto ancora nel catalogo, assenza di DELETE, nessuna rimozione dal catalogo nella lista e annullamento senza RPC. Aggiornati i test della rimozione dal catalogo al testo esplicito. Nessuna nuova migrazione o scrittura nel database reale. Suite browser corrente 94 casi; controlli completi eseguiti dalla CI alla pubblicazione.

## Ordinamento categorie — 15 novembre 2026

72 test locali in 9 file e 92 test browser desktop/mobile PASS; lint, tipi, build, aggiornamento PWA e controllo segreti PASS. Nuovi test PostgreSQL: ordine completo atomico, identità/nomi conservati, payload incompleti/duplicati/estranei/null e snapshot obsoleti respinti senza modifiche parziali, RLS/anon negato e SECURITY INVOKER. Cinque tabelle Realtime nel bootstrap, inclusa categories. Script SQL online esteso e verificato sul database reale in transazione annullata: salvataggio ordine e conflitto obsoleto PASS; zero utenti sintetici residui, categorie reali invariate prima/dopo la migrazione.

Browser: riordino mouse e touch tramite eventi Chrome reali, touchCancel senza salvataggio, tastiera/frecce, refresh con ordine persistente, Frutta prima dei Latticini nella spesa, errore con ritorno all’ordine precedente e blocco offline. Non equivale a prova hardware Safari/iPad né a collaudo WebSocket su due account reali, ancora rinviato.

## Lista unica — 15 novembre 2026

69 test in 8 file PASS. Nuovi test migrazione: conservazione articoli, contributi, acquisti e collegamenti al piano; riattivazione lista completata; unicità per famiglia, RPC idempotente SECURITY INVOKER, isolamento/anon, duplicazione revocata e arresto sicuro per liste legacy multiple. Script SQL verificato su database reale con rollback; impronte dei dati invariati prima/dopo. Nessuna fixture conservata. Advisor senza errori, avvisi precedenti per 23 RPC definer e protezione password compromesse.

86 casi browser desktop/mobile: 82 PASS nella prima suite, quattro aggiornati al nuovo titolo/navigazione poi ripetuti con successo. Coperti creazione automatica idempotente e refresh, vecchi URL, apertura diretta della lista, Catalogo nella barra inferiore, assenza di creazione/duplicazione e selettore lista nel confronto. Aggiornamento PWA PASS. Suite completa corrente rieseguita in CI alla pubblicazione.

## Compilazione da barcode — 15 novembre 2026

66 test locali e 82 browser desktop/mobile PASS; lint, tipi, build, aggiornamento PWA e controllo segreti PASS, zero vulnerabilità runtime rilevate da npm audit. Nuovi casi: normalizzazione nome/lingua, formato esplicito e assente, categorie ambigue, codice restituito errato, checksum/metodo/origine rifiutati, host fisso e assenza di inoltro credenziali, cache pubblica e indisponibilità provider. Browser: compilazione modificabile e salvataggio esplicito, conservazione bozza, scheda già esistente senza richiesta esterna, dati parziali, errore servizio, risposta tardiva dopo cambio EAN, permessi negati, lettura nativa e decodifica ZXing reale da canvas/video sintetico con arresto stream. Nessuna richiesta al provider reale durante questi test browser, nessuna scrittura nel catalogo reale. Probe separato al provider staging: HTTP 200, esempio pubblico 3274080005003 normalizzato come Acqua minerale, 1500 ml. Fotocamera hardware Android/iOS: NOT RUN.

Data: 14 novembre 2026, Europe/Rome. Ambiente locale Windows, Node.js 22 LTS portatile, npm, PGlite/PostgreSQL, Playwright Chromium. Versioni esatte nel lockfile. Verifiche locali concluse e confermate in CI su Linux/Node 22.

## Verifica sul servizio reale dopo le migrazioni

Migrazioni 001–009 e 20261114221151: PASS, applicate e registrate nella cronologia standard con SQL originale e checksum verificati. Il dashboard è stato usato dopo login interattivo, senza acquisire chiavi amministrative.

Security review reale: 20 RLS attive, 0 grant anon sulle tabelle e sulle RPC, 24 RPC per authenticated con search_path fissato, quattro tabelle nella pubblicazione Realtime. Migrazione 008 verificata anche con default grant Supabase emulati localmente.

supabase/tests/online_rls.sql: PASS sul progetto reale. Due membri, invito/accettazione, seconda famiglia, isolamento di letture/scritture/RPC, acquisto parziale senza prezzo idempotente, uscita e accesso anon negato. La transazione viene annullata: dopo rollback zero famiglie, liste, acquisti e identità sintetiche residue. Nessuna email inviata.

Check backend reale: PASS, Auth HTTP 200; 20 tabelle PROTETTA (401/42501 riferito alla tabella richiesta). Non equivale al collaudo autenticato Auth/JWT/PostgREST o Realtime su due client, tuttora NOT RUN completo.

Suite locale corrente: 84 casi in 11 file, inclusi bootstrap completo, privilegi predefiniti, script SQL online con rollback, ricerca barcode su tre fonti, lista unica, ordine categorie, autocompletamento e cancellazione completa prodotti. Suite browser corrente: 120 casi desktop/mobile. CI e pubblicazione del nuovo commit vengono verificate separatamente dai test locali.

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
