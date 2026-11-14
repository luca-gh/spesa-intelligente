# Avanzamento

Aggiornamento: 14 novembre 2026. Implementazione progressiva: **consegna completa non verificata**. I gate online non vengono considerati superati in base alle fixture locali.

| Fase                            | Stato del gate | Lavoro presente e blocchi                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Fondazioni                  | PASS           | Repository pubblico, tooling, CI verde, migrazioni, RLS, test PostgreSQL, manifest/service worker e documentazione. Build, lint, typecheck, test e controllo segreti verificati localmente e in CI.                                                                                  |
| 1 — Account, famiglia, liste    | IN PROGRESS    | Schema e RLS/RPC verificati; primo account reale, email confermata, login, famiglia e lista verificati manualmente con riscontro DB. Persistenza articolo dopo refresh confermata. Secondo account rinviato; restano account esterno e sincronizzazione/riconnessione su due client. |
| 2 — Catalogo, prezzi, confronto | BLOCKED        | Moduli indipendenti implementati e testati: formati, promozioni, ranking, sconti personali per negozio, date e copertura. Gate complessivo dipende dalla fase 1 online. Condizioni sconto per intero scontrino ed esclusioni di categoria da completare.                             |
| 3 — Ricette e calendario        | BLOCKED        | Moduli indipendenti: creazione atomica, scaling, preferiti/ricerca, settimane/modelli, preview e conferma transazionale con versioni. Editing completo ingredienti, import e collaudo del percorso completo ancora da completare.                                                    |
| 4 — Spesa e statistiche         | BLOCKED        | Acquisti e annullamenti, pagato opzionale, snapshot, statistiche e export implementati; test locali su residui e contabilità. Rilevazioni da acquisto con scelta esplicita e dettaglio analitico differenze previsto/effettivo ancora da completare.                                 |
| 5 — Barcode e importazioni      | TODO           | Solo scanner/fallback manuale, checksum e gestione permesso camera negato implementati indipendentemente. OCR, URL ricette, foto, ricevute revisionabili e deduplica transazionale NON implementati.                                                                                 |
| 6 — Consegna e deploy           | IN PROGRESS    | PWA pubblicata su Cloudflare Pages con HTTPS, deploy continuo da main e redirect Supabase aggiornati. Test PWA e CI PASS; restano gate funzionali precedenti, installazione e fotocamera su Android/iOS fisici.                                                                      |

## Stato corrente: migrazioni reali applicate

14 novembre 2026: bootstrap 001–007 applicato tramite SQL Editor ufficiale dopo il login interattivo dell’utente; controllo preliminare con zero tabelle pubbliche. Plugin installato, strumenti SQL non esposti nella sessione: usato un browser dedicato. Nessuna chiave amministrativa acquisita.

Il controllo del servizio ha rilevato grant automatici del proprietario non presenti nel PostgreSQL locale iniziale. Creata, testata e applicata la migrazione 008 explicit_privileges. I test locali ora emulano questi default Supabase.

**Verifica finale: 20 tabelle con RLS, zero grant anon sulle tabelle e sulle RPC, 24 RPC abilitate per authenticated, quattro tabelle nella pubblicazione Realtime.** Nove versioni registrate nella struttura standard supabase_migrations.schema_migrations con SQL originale; checksum di tutte le versioni corrispondenti ai file locali.

**Test SQL sul servizio reale: PASS.** supabase/tests/online_rls.sql verifica due membri, invito, seconda famiglia, blocco letture/scritture/RPC cross-family, acquisto parziale senza prezzo e idempotente, uscita e anon. Fixture create in una transazione annullata: nessuna email e nessun dato di test conservato. Dopo rollback: zero famiglie, liste, acquisti e identità Auth di test residue.

Il test SQL usa auth.uid() e i ruoli del servizio, ma non certifica login Auth/JWT tramite API o WebSocket Realtime. Il gate completo della fase 1 resta da superare. I blocchi descritti sotto sono lo storico precedente all’applicazione delle migrazioni.

Ultima suite locale: 44 test PASS in 5 file. Check backend PASS: Auth HTTP 200, tutte le 20 tabelle riconosciute come PROTETTA tramite rifiuto anon 401/42501 riferito alla tabella richiesta. Build/lint/typecheck/browser e CI finali verificati separatamente prima della consegna.

## Comandi e risultati effettivi

- Installato Node.js 22 LTS ufficiale in `.tools`, verificando SHA-256 prima di estrarre. Dipendenze npm installate con lockfile.
- `npm run check`: PASS (lint, typecheck, test e build PWA); confermato anche dalla CI GitHub.
- `npm test`: ultima esecuzione 44 test PASS (dominio, configurazione segreti e PostgreSQL/RLS).
- `npm run test:e2e`: PASS, 32 casi desktop/mobile inclusi accessibilità dashboard e camera negata. Corretti e rieseguiti i test dei contrasti.
- `npm audit --omit=dev`: 0 vulnerabilità alla verifica online del 14 novembre 2026.
- `npm audit`: 4 avvisi low nella catena di tooling PWA/deepmerge, nessun moderate/high/critical dopo override compatibili e build verificata. Non vengono trattati come eliminati.
- Account `luca-gh` verificato con GitHub CLI, senza stampare token o cambiare l'account globale. Repository pubblico creato e codice pubblicato: https://github.com/luca-gh/spesa-intelligente.

- CI GitHub: PASS sul commit 566e874, esecuzione https://github.com/luca-gh/spesa-intelligente/actions/runs/43617987975, completata alle 17:53 Europe/Rome. Include npm ci, check, controllo segreti, audit runtime e 14 test browser su Linux.
- Verificata anche l’effettiva interruzione di una build Vite con una chiave privilegiata fittizia, prima della compilazione.

## Storico del blocco prima delle migrazioni

URL e chiave pubblica forniti dall'utente sono ora salvati in `.env`, escluso da Git. Verifica reale del 14 novembre 2026: Auth risponde HTTP 200, accesso email/password abilitato, conferma email richiesta; tutte le 20 tabelle dell'app rispondono HTTP 404/PGRST205, quindi lo schema non risulta disponibile nella Data API. Nessun account creato e nessun dato remoto modificato.

Rimane da applicare lo schema con un accesso amministrativo autorizzato. La sola publishable key non permette SQL o migrazioni. Nessuna sessione amministrativa locale disponibile; Supabase risulta ora installato e l'utente conferma il collegamento, ma gli strumenti amministrativi non sono ancora esposti in questa sessione. In alternativa è pronto `.tools/supabase-bootstrap.sql`, generato dalle sette migrazioni e testato su PostgreSQL locale, da eseguire in SQL Editor sul progetto vuoto. Dopo l'applicazione verificare Auth/Realtime con due utenti e un account esterno. Docker e PostgreSQL di sistema non sono installati; i test SQL locali usano PGlite.

## Verifiche dopo la configurazione ricevuta

- `npm run check`: PASS con la configurazione reale locale (lint, typecheck, 38 test iniziali e build).
- `npm test`: PASS, ora 42 test in 5 file, inclusi bootstrap delle sette migrazioni con DDL publication e rifiuto della seconda esecuzione.
- `npm run check:backend`: Auth PASS; schema BLOCKED, 20 tabelle non disponibili nella Data API. Verifica in sola lettura, senza chiavi privilegiate.
- Build con backend configurato: riuscita, avviso non bloccante per il bundle iniziale oltre 500 kB; nessuna credenziale amministrativa inclusa.

## Prossime verifiche autorizzate

Primo account reale: **PASS manuale con riscontro sul database** per registrazione, conferma email e accesso riferiti dall'utente; verificati un account confermato, una sessione Auth, una famiglia, un membro attivo e una lista. L'accesso è avvenuto nel browser dell'utente; la finestra automatizzata separata conserva la schermata login, quindi non viene dichiarato un E2E automatico della sessione. Password e token non letti. App locale su `http://127.0.0.1:5173`; Site URL e quattro redirect locali espliciti salvati e verificati sul servizio.

Primo articolo reale: **PASS manuale con riscontro DB** per salvataggio e visualizzazione dopo ricaricamento, confermata dall'utente. Il test del secondo account è rinviato su richiesta dell'utente. Il gate completo resta subordinato al secondo account, al controllo esterno e a Realtime/riconnessione su due client.

## Correzione del menu prodotto dal catalogo

Il menu seleziona prodotti già presenti nel catalogo della famiglia. La verifica reale ha confermato catalogo vuoto e un articolo libero: aggiungere un nome in lista non crea automaticamente un prodotto di catalogo. Corretto lo stato vuoto con spiegazione, menu disabilitato e collegamento al Catalogo prodotti.

Selezione, ricerca, nome libero, quantità e unità sono ora controllati. Un commerciale propone il contenuto netto di una confezione; un generico usa l'unità canonica. Solo unità compatibili, con conversione al cambio unità. Ricerca per nome, marca, variante, barcode e generico associato; un nuovo filtro annulla la selezione precedente. Pulizia del modulo solo dopo successo, valori conservati dopo errore.

Verifiche locali PASS: lint/typecheck/build, 42 test di dominio/SQL, 24 test browser desktop/mobile e controllo segreti. Cinque scenari nuovi coprono stato vuoto/validazione, commerciale, generico/conversioni, ricerca e selezione, errore/nuovo tentativo. Accessibilità del nuovo modulo verificata con axe; screenshot mobile e assenza di overflow verificati. Nessun prodotto di test inserito nel database reale. CI del commit verificata dopo pubblicazione.

1. Configurare il backend e collaudare Auth, invito, due sessioni contemporanee, account esterno, riconnessione e acquisti concorrenti tramite PostgREST.
2. Completare i requisiti residui di ogni fase prima di considerare il rispettivo gate PASS; non saltare il gate per la sola presenza del codice.
3. Completare importazioni revisionabili e sicurezza upload/URL, cancellazione account self-service, test transazionali ricevute.
4. Collaudare PWA installata e fotocamera su Android Chrome e iOS Safari reali; il deploy HTTPS è eseguito, come descritto sotto.

## Eliminazione dal catalogo

Comando Elimina aggiunto alle righe dei prodotti generici e commerciali, con conferma nominativa e feedback. Il servizio riutilizza i vincoli FK e le RLS già presenti: prodotti inutilizzati eliminabili dai membri della propria famiglia; prodotti collegati conservati con messaggio comprensibile, senza dettagli interni. Annullare la conferma non invia DELETE. Chiusa l'eventuale modifica del prodotto eliminato; i pulsanti di conferma hanno type=button e non inviano il form che li contiene.

Verifiche locali PASS: lint/typecheck/build, 44 test dominio/SQL, 32 test browser desktop/mobile e controllo segreti. Casi aggiunti per generico/commerciale, annullamento, errore FK, isolamento familiare e protezione di lista/storico prezzi. Nessun prodotto reale cancellato durante lo sviluppo; nessuna migrazione necessaria. CI del commit verificata dopo pubblicazione.

## Storico della ripresa dopo il collegamento Supabase

Installazione verificata nella directory delle integrazioni; gli strumenti SQL/progetti/migrazioni non compaiono tra le capacità disponibili della sessione corrente. Nuova verifica in sola lettura: Auth HTTP 200, tutte le 20 tabelle ancora non esposte (404/PGRST205). Nessuna migrazione remota eseguita. Richiesta attivazione esplicita di Supabase dal compositore della chat; non è richiesta una nuova installazione né l'invio di credenziali.

## Rimozioni coerenti

Categorie eliminabili anche se usate, con riclassificazione in Altri prodotti. Eliminazione punti vendita e regole sconto; archiviazione/ripristino di prodotti, negozi, ricette, articoli, piani e previsioni. Rimozione ingredienti salvati e ultimo ingrediente non salvato. Prezzi e acquisti annullabili, inviti revocabili. Cronologia finanziaria conservata; piani archiviati non modificano automaticamente le liste. Migrazione 009 applicata, 49 test locali e 48 prove browser PASS. Il test del secondo account resta rinviato.

## Pubblicazione HTTPS e aggiornamenti

Su richiesta esplicita dell'utente, PWA pubblicata il 14 novembre 2026 su https://spesa-intelligente-luca-gh.pages.dev tramite Cloudflare Pages gratuito. Collegamento GitHub limitato al repository luca-gh/spesa-intelligente, branch main, prima versione 574a09a. Nessun piano a pagamento attivato. Site URL e redirect Supabase configurati sul dominio pubblico; gli indirizzi locali di sviluppo rimangono disponibili.

Build Pages con lint, typecheck, 49 test, build e controllo segreti. CI GitHub 43642331112 PASS con audit, prova reale aggiornamento service worker e 48 test browser. Controlli sul sito pubblicato PASS: HTTPS, SPA /catalogo, manifest, icone, cache worker, CSP, layout mobile, registrazione e controllo service worker, shell offline e zero errori browser. API fotocamera disponibile nel contesto HTTPS, ma nessuna acquisizione reale da telefono testata. Resta il collaudo fisico Android/iOS e quello multi-account rinviato.

Gli aggiornamenti vengono cercati al ritorno nell'app, alla riconnessione e ogni ora. L'attivazione richiede il pulsante Aggiorna app. I deploy modificano gli asset; dati e migrazioni Supabase sono gestiti separatamente.

## Correzione notifica persistente

Il messaggio Salvato ora scompare dopo 4 secondi. I messaggi più lunghi restano visibili fino a 12 secondi; un nuovo salvataggio riavvia il timer. Test locali: 49 PASS e 52 prove browser PASS, inclusi i nuovi casi desktop/mobile per scadenza, cambio sezione e salvataggi consecutivi. Prova aggiornamenti PWA PASS. Nessuna modifica dello schema o dei dati reali.

## Ordinamento prodotti

Catalogo ordinato per nome prodotto A–Z, con generici e commerciali intercalati alfabeticamente e selettore per Z–A. Ricerca e archiviati mantengono la direzione scelta. Confronto locale italiano, senza distinzione di maiuscole, con ordine numerico naturale e criterio stabile per gli omonimi. Test: 49 locali e 56 browser desktop/mobile PASS. Nessuna modifica del database.
