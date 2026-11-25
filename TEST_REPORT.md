# Rapporto test

## Unità e prezzi sfusi — 25 novembre 2026

- Lint, TypeScript, 117 test in 18 file e build di produzione superati.
- Suite browser completa: 224 casi verificati (95 desktop, 95 mobile Chromium, 34 iPad WebKit). Prima esecuzione 218 PASS; sei aspettative legacy aggiornate da L a l e tutti e sei i casi ripetuti PASS. Controlli segreti, backend pubblico e aggiornamento PWA PASS. Entrambe le nuove RPC raggiungibili tramite PostgREST e negate ad anon con 401/42501.
- Nuovi casi browser: prezzo iniziale con virgola, blocco del punto, €/pz calcolato e aggiornato, €/kg senza formato duplicato in Catalogo, 150 g a 20 €/kg = 3 €, modifica e persistenza €/l, etichetta l con valore interno L, errore con bozza conservata. Nove casi superati su desktop, mobile Chromium e iPad WebKit simulato.
- Probe PostgreSQL locale e remoto PASS: salvataggio atomico prodotto/prezzo, rollback completo con negozio o formato non valido, incompatibilità delle modifiche di formato, rifiuto NaN, wrapper precedente che ripristina prezzo del prodotto, assenza di storico, isolamento famiglia e RPC anonime negate. Tutte le fixture annullate.
- Migrazione 20261125190943_catalog_price_basis.sql, 20 totali allineate. Nessuna nuova tabella; 23 RLS e nove pubblicate invariati. Advisor: 19 definer pubblici preesistenti e protezione password disattivata, nessun nuovo avviso attribuibile alla modifica.
- I test browser usano fixture; non sostituiscono il collaudo fisico iPad o multiaccount Auth/Realtime già rinviati.

Per gli alimenti semplici viene proposta l’unità del Catalogo; quantità non positive o unità incompatibili vengono respinte prima dell’inserimento. Gli errori di conversione nell’anteprima sono mostrati senza eccezioni non gestite.

## Selezione alimenti del pasto e prezzi di tutte le marche — 23 novembre 2026

112 test locali in 17 file. Test puri per i tre pasti, testo libero senza generare prodotti, selezioni vuote/legacy, scaling, alternative rimosse, alimento semplice e dettaglio marche/negozi con PAM e prezzi mancanti. Probe SQL PostgreSQL locale e Supabase reale con rollback: esclusività testo/ricetta/alimento, scelte limitate agli ingredienti e alle alternative valide, invalidazione versione piano, copia di testi e scelte in settimane e modelli, esclusione Spuntino, isolamento tra famiglie e assenza di nuovi definer pubblici.

215 prove browser: 92 desktop, 92 mobile Chromium, 31 WebKit iPad. Cinque nuovi flussi per profilo: categorie alfabetiche senza mutare sort_order; tutte le marche per negozio senza sommare alternative nel totale; Colazione/Pranzo/Cena, testo libero persistente ed eliminabile senza prodotti inventati; pasto ricetta con checkbox, alternativa, solo prodotti selezionati nella lista e ripetizione senza doppioni; alimento semplice con errori recuperabili e blocco offline. Aggiornata la prova pasti precedente alle scelte per singola occorrenza. Axe e immagini verificate per prezzi e selettore alimenti; etichette select rese esplicite. Nessun nuovo test su hardware fisico o a due account.

19 migrazioni allineate; RLS/grant invariati sulle tabelle, trigger invoker di validazione JSON, due precedenti funzioni pubbliche passate a invoker. Advisor di sicurezza senza nuovi rilievi; 19 definer pubblici preesistenti. Backend, lint, tipi, build, segreti, PWA e pubblicazione verificati separatamente.

Verifica finale permessi alternative: revocati anche i grant authenticated ereditati dai default Supabase, prima di concedere soltanto SELECT/INSERT/UPDATE/DELETE. TRUNCATE, REFERENCES e TRIGGER esplicitamente assenti; probe SQL locale e remoto aggiornato e superato. Nessun privilegio diretto sulle scritture delle liste ampliato. Migrazione correttiva 20261123160134, senza modificare file già applicati.

## Ordinamento per negozio, PAM, alternative e rimozione Scanner — 23 novembre 2026

107 test locali in 16 file. Nuovi test puri per riconoscimento PAM senza falsi positivi, disattivazione, zero e centesimi, prezzo originario immutato, quantità prima dell’arrotondamento e fallback quando un’alternativa viene rimossa. Probe SQL su PostgreSQL locale e Supabase reale con rollback completo: salvataggio atomico, duplicazione, singola alternativa trasferita e scalata, idempotenza, rifiuto scelte estranee/uguali al principale, vincolo PAM, invalidazione piani, FK/RLS e ruoli anon.

200 prove browser: 87 desktop, 87 mobile Chromium, 26 WebKit iPad. Nuovi flussi per ordinamento decrescente e cambio negozio, dati mancanti in fondo e ritorno categorie; PAM attivabile/disattivabile, persistenza e netto coerente fra catalogo/lista/confronto; creazione e gestione alternative salvate con ricerca, scelta e trasferimento di un solo prodotto; anteprima pasti invalidata al cambio scelta. Vecchio percorso Scanner reindirizzato al Catalogo e scansione manuale/checksum/fotocamera integrati conservati. Accessibilità delle alternative verificata con Axe; regressioni precedenti mantenute.

Backend: 18 migrazioni allineate, 23 tabelle protette, nove pubblicate. Nessun nuovo avviso di sicurezza; due definer pubblici in meno, soli INFO normali per indici appena creati. Lint, tipi, build, segreti, PWA, CI e pubblicazione verificati. Nessun nuovo collaudo hardware o a due account.

## Tabella catalogo, inserimento diretto e prezzi modificabili dalla lista — 23 novembre 2026

103 test locali in 15 file. Suite browser 187 casi: 83 desktop, 83 mobile Chromium, 21 WebKit iPad. Quattro nuove prove su ciascun profilo: ordine delle sette colonne, prezzi negozi impilati e trattini, aggiunta esatta di una confezione dal Catalogo; modifica prezzo dalla lista con supermercato selezionato, focus, punto respinto, quantità due confezioni e corretta unità €/kg; scelta esplicita formato senza confondere altre marche, retry dopo errore e contrasto; €/l, blocco offline, articolo libero senza prezzi inventati e persistenza al refresh. Prova dedicata al focus e allo scorrimento di Modifica supermercato, anche ripetendo il clic.

Editor ProductPrices riutilizzato: nessuna modifica a RPC, RLS o schema. Endpoint preesistenti set_product_price e add_shopping_product verificati nei flussi browser con fixture isolate; nessuna scrittura nei dati familiari reali. Lint, tipi, build, segreti, PWA, CI e disponibilità pubblica verificati per la release. Nessun nuovo test su iPad fisico o a due account.

## Marca nella ricerca e prezzi sempre disponibili nella lista — 23 novembre 2026

103 casi locali in 15 file. Quattro nuovi test puri: ricerca generica distinta da marca esatta, formati multipli senza risultati duplicati, termini misti nome/marca, accenti/maiuscole e omonimi senza collisioni tra ID; marche archiviate escluse; aggregazione prezzi condivisa che rispetta la marca ed esclude rimossi, quantità completate e supermercati archiviati. Totali e costi articolo provengono dallo stesso calcolo.

175 prove browser: 79 desktop, 79 mobile Chromium, 17 WebKit iPad. Tre nuove prove su tutti i profili: cercare NUTEL/crema nut e scegliere Crema spalmabile · Nutella, marca salvata senza forzare formato, nessun invio implicito, ricaricamento; cambio prodotto che annulla la vecchia marca, errore/retry che conserva scelta e quantità; prezzi e totali aggiornati dopo modifica quantità, articolo libero senza prezzo, filtro per marca senza modificare totali, rimozione e ripristino. Prezzi di altre marche più economiche non sostituiscono Nutella; negozi archiviati esclusi e dati sconosciuti a trattino. Verificati contrasto, nomi accessibili e nessun overflow della pagina. La tabella compatta è focusabile per consentire lo scorrimento con tastiera su schermi stretti.

Suite precedente conservata e aggiornata per la ricerca delle marche. Nessuna migrazione, scrittura o lettura di record familiari reali. Controlli locali, CI e pubblicazione verificati separatamente; nessun nuovo collaudo hardware iPad o a due account.

## Prezzi attuali senza promozioni, statistiche o storico — 23 novembre 2026

99 casi locali in 14 file. Test di migrazione dedicato: ultimo importo attivo copiato una volta, comprese rilevazioni prima classificate promozionali e ormai scadute; annullate escluse. Probe SQL locale e Supabase reale, interamente annullato: update conserva una sola riga per prodotto/negozio e non inserisce osservazioni storiche, zero valido, importi negativi respinti senza alterare il precedente, cancellazione senza riemersione di valori vecchi, RLS e FK tra famiglie, cascata alla cancellazione prodotto, niente accesso anon o definer pubblico. Confronto nuovo indipendente da date e sconti, con quantità, marca/formato e copertura parziale.

Suite browser 166 casi: 76 desktop Chromium, 76 mobile Chromium e 14 WebKit iPad. Prezzo precompilato con virgola, salvataggio in sostituzione, recupero dopo errore, rimozione, nessun campo data/tipo/promozione o storico; calcolo kg/l e accessibilità conservati. Confronto con importi attuali, dati promozionali precedenti ignorati, nessuna richiesta alle tre collezioni dismesse dal frontend, valori mancanti e totali parziali. Navigazione e collegamenti precedenti verificati; test degli sconti/previsioni sostituiti dalle prove della loro rimozione e del confronto corrente.

Migrazione remota 20261123142201 allineata al file locale. Advisor: nessuna nuova segnalazione di sicurezza; indice store/household nuovo ancora inutilizzato come INFO, oltre ai rilievi preesistenti. Lint, tipi, build, segreti, PWA, API e CI verificati separatamente alla pubblicazione. Nessun nuovo test su hardware iPad o Auth/Realtime a due account.

## Catalogo prezzi, preferenze indipendenti e ordine per negozio — 23 novembre 2026

96 casi locali in 13 file. Nuovo probe SQL eseguito sia con tutte le migrazioni in PGlite sia sul database Supabase reale: replica categorie per negozi già presenti e creati dopo, riordino indipendente, rifiuto ordini incompleti/obsoleti, preferenze marca/formato indipendenti, rollback di inserimenti invalidi, correzione prezzo atomica con originale annullato, rifiuto correzioni negative/obsolete, RLS e FK tra famiglie, divieti anon, cancellazioni categorie/negozi senza orfani. Fixture e utenti sintetici interamente annullati. Nessuna modifica a prezzi, prodotti o acquisti familiari.

Test di dominio per €/kg e €/l in g/kg/ml/L, zero, formato assente e pz; scelta dell’ultima rilevazione per negozio anche con più registrazioni nella stessa giornata; nomi raggruppati; confronto con sola marca, solo formato, entrambe le preferenze e confezioni senza formato. Bootstrap aggiornato a 21 tabelle con RLS e sette pubblicate. RPC nuove pubbliche invoker con controlli membership nelle implementazioni private, nessun nuovo definer esposto.

Suite browser: 164 casi (76 desktop Chromium, 76 mobile Chromium, 12 WebKit con profilo iPad). Aggiornate le prove delle funzioni sostituite: prezzi nel Catalogo, trattini, virgola/errore sul punto, calcolo live e accessibilità; correzione con errore recuperabile; nome univoco con marca/formato opzionali; ordini dei negozi e persistenza della scelta; rimozione immediata/ripristino senza acquisti inventati, storico precedente conservato, offline/errori. Conservate prove barcode, ricette, pasti, cancellazione catalogo, PWA e autocompletamento touch. CI, segreti, build, audit e disponibilità HTTPS verificati separatamente sul commit finale.

Migrazioni remote allineate ai nomi/versioni locali 20261123113031 e 20261123113134. Advisor di sicurezza: medesime segnalazioni preesistenti (23 definer pubblici precedenti e protezione password compromesse disabilitata); nessuna nuova. Advisor prestazioni: risolti indice FK mancante e doppia policy SELECT della nuova tabella; resta la normale INFO di indice nuovo non ancora utilizzato, oltre ai rilievi preesistenti. Nessun nuovo test su iPad fisico o collaudo Auth/Realtime a due account.

## Autocompletamento touch e profilo iPad WebKit — 23 novembre 2026

Regressione riprodotta prima della correzione: dopo blur simulato della tastiera, l’opzione scompariva e non poteva ricevere il click. Rimosso lo smontaggio sul blur, con chiusura basata su interazioni/focus esterni e comandi espliciti. Il focus dopo la selezione precede la chiusura, così non riapre il popup.

Due nuove prove eseguite sui tre profili: perdita focus prima della selezione, invio unico del prodotto con ID/formato corretti; sequenza sintetica di trascinamento/pointercancel senza selezione, chiusura su focus esterno, Tab e tocco esterno. Test preesistenti di lista, ingredienti e calendario aggiunti al progetto WebKit touch iPad. 21 prove mirate PASS e 92 test locali PASS, oltre a lint/tipi/build. Suite completa in CI: 155 casi (74 desktop, 74 mobile Chromium, 7 WebKit iPad). Aggiornamento PWA, segreti e pubblicazione verificati separatamente sul commit finale.

Il blur della tastiera è simulato e WebKit usa un profilo iPad; nessuna prova su iPad fisico o tastiera iPadOS reale durante questa sessione. Il problema segnalato dall’utente richiede conferma finale sul suo dispositivo dopo aggiornamento.

## Prezzi con virgola e rifiuto dei punti — 23 novembre 2026

Tre nuovi test locali per parsing italiano, rifiuto di punti/separatori delle migliaia e altri formati ambigui, resa dei valori preesistenti con virgola e conservazione dei prezzi sconosciuti. Quattro nuove prove browser su desktop e mobile: osservazione prezzo e riutilizzo del modulo dopo un salvataggio, totale/lordo acquisto, completamento successivo del prezzo, modifica soglia/massimale sconto. Verificati errore immediato, conservazione del testo errato, nessuna richiesta di scrittura con punti, correzione con virgola e importi canonici nella richiesta. Importi zero e acquisti senza prezzo conservati.

Suite corrente: 92 casi locali in 12 file e 144 prove browser desktop/mobile. Lint, tipi, build, controllo segreti e aggiornamento PWA verificati; CI e disponibilità HTTPS controllate sul commit pubblicato. Nessuna nuova verifica hardware iPad o collaudo reale a due account.

La verifica completa ha inoltre rilevato un’interruzione dello scorrimento animato alla seconda selezione rapida di Modifica nel Catalogo. Il posizionamento al campo Nome è ora immediato, evitando la sovrapposizione con lo scroll del click successivo e rispettando anche il movimento ridotto.

## Unità base e scorrimento alla modifica — 16 novembre 2026

Nuovo test locale per conversioni decimali kg→g e L→ml, formato vuoto e conservazione di bozze non numeriche nelle altre unità. Quattro nuove prove browser desktop/mobile su formati precedenti kg/L: conversione proposta, quantità equivalente nella richiesta di salvataggio, focus e campo in viewport anche dopo una seconda selezione dello stesso prodotto, movimento ridotto. Aggiornate le prove di formato sempre visibile e opzionale, elenco unità senza kg/L, formato incompleto, barcode alimentari/non alimentari e ritorno alla lista con formato normalizzato. Nessuna migrazione o modifica di prodotti reali durante le prove.

Suite locale completa PASS: 89 test in 12 file e 136 prove browser desktop/mobile, inclusa accessibilità del Catalogo. Lint, tipi e build PASS; PWA, segreti, CI e disponibilità HTTPS verificati alla pubblicazione.

La CI ha rilevato una corsa tra chiusura della tabella e ricerca immediata: il toggle nativo poteva sovrascrivere lo stato aperto richiesto dalla ricerca. Ora lo stato è aggiornato dal click/attivazione tastiera del summary, senza una seconda sincronizzazione dal toggle nativo. Aggiunta regressione su chiusura/ricerca consecutive e ripetuta la prova mobile con due worker.

## Due totali nel Catalogo — 15 novembre 2026

Aggiornati i test dei conteggi e lo scenario browser desktop/mobile: soltanto Prodotti attivi e Categorie, conteggi indipendenti dai filtri, categorie vuote incluse, nessuna categoria virtuale contata e catalogo vuoto con due zeri. Mantenute le prove di riduzione/espansione, ricerca, accessibilità e assenza di overflow. Nessuna nuova migrazione o scrittura sui dati reali.

88 test locali in 12 file e due prove browser mirate PASS; lint, tipi, build e segreti verificati. Suite completa di 132 casi eseguita dalla CI sul commit pubblicato.

## Dashboard categorie, ordine lista e cancellazione piani — 15 novembre 2026

Nuovi test locali: conteggio delle schede attive senza gruppi interni/archiviati, diverse marche, categorie vuote, ordine familiare, fallback senza categoria e catalogo vuoto. Script `supabase/tests/meal_plan_deletion.sql` verificato in PGlite e sul progetto reale dentro una transazione annullata: DELETE del proprio piano con pasti a cascata, rifiuto cross-family/anon, lista/contributi/acquisti invariati, ricette/ingredienti/modelli/altre settimane conservati, settimana ricreata vuota e piano archiviato eliminabile. Permessi e FK remoti verificati; impronte delle 20 tabelle applicative e Auth identiche prima/dopo. Nessuna migrazione, privilegio aggiuntivo o dato reale eliminato.

Dieci nuove prove browser mirate desktop/mobile PASS: dashboard prima dell’inserimento, conteggi indipendenti da ricerca/archiviati, riduzione/espansione mouse/tocco/tastiera, ricerca che riapre la tabella, accessibilità axe del Catalogo e assenza overflow; articoli da acquistare/acquistati sopra il modulo e aggiunta funzionante; eliminazione piano attivo/archiviato, conferma con date, refresh e ricreazione, altra settimana/lista/modelli conservati, annullamento ed errore che conservano l’anteprima, blocco offline e nuovo tentativo. Simulazioni browser isolate, non collaudo hardware iPad né due account reali.

Suite completa locale PASS: 88 test in 12 file e 132 prove browser desktop/mobile. Lint, tipi, build, aggiornamento PWA e controllo segreti PASS. Corretto il contrasto delle intestazioni della tabella prodotti rilevato da axe. CI e verifica HTTPS eseguite alla pubblicazione.

## Schermata iniziale lista e ordine menu — 15 novembre 2026

Aggiornati gli scenari browser desktop/mobile della precedente dashboard: `/` apre la lista effettiva a `/liste`, niente Home, menu primario e barra inferiore ordinati Catalogo/Ricette/Lista della spesa/Pasti/Statistiche. Verificate tutte e cinque le destinazioni e la voce corrente, lista vuota senza comandi di creazione, dati esistenti conservati, vecchi URL con evidenziazione della lista, logo e Indietro senza ciclo di reindirizzamenti. Accessibilità axe della nuova schermata iniziale PASS; accesso senza sessione e gestione avvisi ancora funzionanti. Dieci prove mirate PASS. Fixture isolate; nessuna lettura/scrittura di dati reali e nessuna nuova migrazione.

Suite completa locale PASS: 85 test in 11 file e 122 prove browser desktop/mobile. Lint, tipi, build, aggiornamento service worker e controllo segreti PASS. Screenshot iniziale desktop/mobile e assenza di overflow verificati. CI e pubblicazione HTTPS controllate sul commit finale; nessuna prova hardware iPad aggiuntiva.

## Autocompletamento prodotti nella lista — 15 novembre 2026

Nuovo test locale: ricerca per barcode e più parole nome/marca; ordine per nome separato dai dettagli della confezione. Nuovo scenario browser desktop/mobile: lista alfabetica, prodotti archiviati esclusi, CAFFE trova Caffè, selezione da tastiera e tocco simulato, ricerca olio oliva, quantità/unità coerenti, ritorno esplicito all’articolo libero, nessun risultato ed Escape, salvataggio libero anche con testo di ricerca non selezionato. Aggiornati i test precedenti alla selezione tramite suggerimenti: marca/EAN, nessun identificativo obsoleto, conversioni, accessibilità axe e assenza overflow, errore e nuovo tentativo, reset, barcode camera/manuale e ritorno dal Catalogo. Fixture browser isolate, nessuna scrittura su dati reali. I test touch simulati non equivalgono a collaudo iPad fisico.

Suite completa locale PASS: 85 test in 11 file e 122 prove browser desktop/mobile, incluse le regressioni su ricette e pasti. Lint, tipi, build, prova aggiornamento PWA e controllo segreti PASS. CI del commit e sito HTTPS verificati alla pubblicazione.

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

Suite locale corrente: 89 casi in 12 file, inclusi bootstrap completo, privilegi predefiniti, script SQL online con rollback, ricerca barcode su tre fonti, lista unica, conteggi/ordine categorie, autocompletamento, formati in unità base, cancellazione completa prodotti ed eliminazione piani. Suite browser corrente: 136 casi desktop/mobile. CI e pubblicazione del nuovo commit vengono verificate separatamente dai test locali.

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
