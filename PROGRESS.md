# Avanzamento

Aggiornamento: 14 novembre 2026. Implementazione progressiva: **consegna completa non verificata**. I gate online non vengono considerati superati in base alle fixture locali.

| Fase                            | Stato del gate | Lavoro presente e blocchi                                                                                                                                                                                                                                           |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Fondazioni                  | IN PROGRESS    | Repository locale, tooling, CI, migrazioni, RLS, test PostgreSQL, manifest/service worker, documentazione. Lint/typecheck/build e test locali eseguiti. Pubblicazione e CI da verificare nel passaggio finale.                                                      |
| 1 — Account, famiglia, liste    | BLOCKED        | UI e RPC implementate, inviti, acquisti parziali, refresh Realtime, dashboard, responsive. Manca un progetto Supabase configurato per il gate con due utenti reali e riconnessione. Raggruppamento visivo per categoria e frequenti da acquisti reali implementati. |
| 2 — Catalogo, prezzi, confronto | BLOCKED        | Moduli indipendenti implementati e testati: formati, promozioni, ranking, sconti personali per negozio, date e copertura. Gate complessivo dipende dalla fase 1 online. Condizioni sconto per intero scontrino ed esclusioni di categoria da completare.            |
| 3 — Ricette e calendario        | BLOCKED        | Moduli indipendenti: creazione atomica, scaling, preferiti/ricerca, settimane/modelli, preview e conferma transazionale con versioni. Editing completo ingredienti, import e collaudo del percorso completo ancora da completare.                                   |
| 4 — Spesa e statistiche         | BLOCKED        | Acquisti e annullamenti, pagato opzionale, snapshot, statistiche e export implementati; test locali su residui e contabilità. Rilevazioni da acquisto con scelta esplicita e dettaglio analitico differenze previsto/effettivo ancora da completare.                |
| 5 — Barcode e importazioni      | TODO           | Solo scanner/fallback manuale, checksum e gestione permesso camera negato implementati indipendentemente. OCR, URL ricette, foto, ricevute revisionabili e deduplica transazionale NON implementati.                                                                |
| 6 — Consegna e deploy           | BLOCKED        | Documentazione e automazione predisposte; mancano backend reale, gate precedenti, collaudi Android/iOS fisici e destinazione di deploy. Nessun sito pubblicato.                                                                                                     |

## Comandi e risultati effettivi

- Installato Node.js 22 LTS ufficiale in `.tools`, verificando SHA-256 prima di estrarre. Dipendenze npm installate con lockfile.
- `npm run check`: PASS (lint, typecheck, test e build PWA); nuova verifica CI dopo pubblicazione.
- `npm test`: ultima esecuzione 38 test PASS (dominio, configurazione segreti e PostgreSQL/RLS).
- `npm run test:e2e`: PASS, 14 casi desktop/mobile inclusi accessibilità dashboard e camera negata. Corretti e rieseguiti i test dei contrasti. Un'esecuzione successiva non è partita per porta 4173 occupata dal precedente server, chiuso prima del nuovo tentativo.
- `npm audit --omit=dev`: 0 vulnerabilità alla verifica online del 14 novembre 2026.
- `npm audit`: 4 avvisi low nella catena di tooling PWA/deepmerge, nessun moderate/high/critical dopo override compatibili e build verificata. Non vengono trattati come eliminati.
- Account `luca-gh` verificato con GitHub CLI, senza stampare token o cambiare l'account globale. Repository remoto da creare dopo la revisione finale dei file.

## Blocco esterno preciso

Servono URL e chiave pubblica publishable/anon di un progetto Supabase Free, applicazione delle migrazioni e configurazione Auth/Realtime. Non servono chiavi service_role nel frontend. Il 14 novembre è stata richiesta questa configurazione all'utente continuando il lavoro indipendente. Docker e PostgreSQL di sistema non sono installati; i test SQL locali usano PGlite.

## Prossime verifiche autorizzate

1. Configurare il backend e collaudare Auth, invito, due sessioni contemporanee, account esterno, riconnessione e acquisti concorrenti tramite PostgREST.
2. Completare i requisiti residui di ogni fase prima di considerare il rispettivo gate PASS; non saltare il gate per la sola presenza del codice.
3. Completare importazioni revisionabili e sicurezza upload/URL, cancellazione account self-service, test transazionali ricevute.
4. Collaudare PWA installata e fotocamera su Android Chrome e iOS Safari reali; poi deploy HTTPS.
