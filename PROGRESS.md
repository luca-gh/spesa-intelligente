# Avanzamento

## Modifica unica e rimozione dell’archivio — 25 novembre 2026

Nel Catalogo Modifica apre lo stesso modulo di Nuovo prodotto, con selezione del supermercato e prezzi intero/scontato precompilati. Salva prodotto registra metadati e prezzi del negozio scelto nella stessa transazione; vuoti rimuovono i prezzi selezionati, nessun negozio scelto conserva i prezzi. Gli altri negozi restano invariati. Tolti comando Prezzi e pannello prezzi separato dal Catalogo; editor prezzi dalla lista conservato. Anteprime €/kg/l/pz basate anche sul formato non ancora salvato e tolleranti a input incompleti.

Eliminata archiviazione da prodotti, negozi, ricette e piani: nessun comando o filtro dell’archivio. Elementi già archiviati resi nuovamente disponibili, preservando prezzi e collegamenti; vincoli impediscono nuove archiviazioni. Le colonne legacy restano soltanto per compatibilità SQL. La rimozione reversibile degli articoli dalla lista resta distinta, con nuova RPC set_list_item_removed e wrapper precedente compatibile limitato alla lista. Nessun ampliamento dei grant di scrittura.

Migrazione 20261125202356 applicata (22 totali). Probe SQL locale/remoto PASS, 124 test in 20 file e verifica di aggiornamento con fixture archiviate. Advisor: definer pubblici preesistenti ridotti da 19 a 18, nessuna nuova segnalazione. 23 tabelle RLS e nove pubblicate invariati. Collaudo browser e pubblicazione verificati sul commit finale.

## Prezzo e prezzo scontato — 25 novembre 2026

Due importi manuali indipendenti per prodotto e supermercato, anche in fase di creazione. I prezzi esistenti restano interi; nessuno sconto ricavato o riempito automaticamente. Catalogo, editor dalla lista, dettaglio articolo/marca e confronto negozi mostrano entrambi. Totali e coperture separati: nessun ripiego del prezzo scontato sul prezzo intero. Rimozioni indipendenti e calcolo €/kg/l/pz per entrambi, stesso tipo di prezzo; PAM 10% applicato una volta a entrambi gli scenari. Nessuna data promozionale o storico. Ordinamento prezzo della lista riferito al prezzo intero.

Migrazione 20261125193424 applicata e allineata (21 totali). 23 tabelle RLS e nove pubblicate invariati. SQL locale e remoto PASS con rollback e advisor senza nuove segnalazioni. 122 test in 19 file; nove nuovi casi browser su desktop/mobile/iPad simulato, compresa accessibilità. Verifiche complete e pubblicazione sul commit finale.

## Unità compatte e prezzi sfusi — 25 novembre 2026

Formato Catalogo limitato a g, ml e pz; confezioni rimosso dalle scelte. Prezzo unitario anche €/pz. Nuovo prodotto con prezzo iniziale facoltativo di un supermercato; creazione prodotto e prezzo nella stessa transazione. Tipo di prezzo del prodotto, €/kg o €/l salvato per singolo negozio; il prezzo diretto viene ripetuto nel riepilogo Catalogo. Lista e confronto applicano la quantità esatta ai prezzi sfusi, mantenendo confezioni intere per i prezzi ordinari. Litro visualizzato come l in tutta l’app; valore interno L conservato per compatibilità.

Migrazione 20261125190943_catalog_price_basis.sql applicata: 20 totali, nessuna nuova tabella o concessione di scrittura sulle liste. Probe SQL locale e remoto PASS con rollback, compresi isolamento, formati incompatibili, NaN e atomicità. Advisor invariati: nessuna nuova segnalazione per le funzioni introdotte. 117 test in 18 file e nove nuovi casi browser su desktop/mobile/WebKit iPad; verifica completa e pubblicazione sul commit finale registrate in TEST_REPORT.md.

Per gli alimenti semplici viene proposta l’unità del Catalogo; quantità non positive o unità incompatibili vengono respinte prima dell’inserimento. Gli errori di conversione nell’anteprima sono mostrati senza eccezioni non gestite.

## Categorie alfabetiche, tutte le marche e alimenti per pasto — 23 novembre 2026

Menu categorie A–Z indipendente dall’ordine corsie. Per articoli generici senza marca, dettagli di tutte le marche e di ogni negozio: quantità, formato, €/kg/l, PAM e trattini rispettati. Totali e ordine prezzo non sommano le alternative.

Calendario con Colazione/Pranzo/Cena e testo libero. Pasto cliccabile, selezione persistente dei soli alimenti mancanti e alternativa distinta per singola occorrenza. Nuovi pasti inizialmente non selezionati, legacy compatibile; salvataggio apre una nuova anteprima della settimana prima della conferma, senza duplicare contributi. Duplica settimana e modelli preservano testo/scelte e scartano Spuntino; vecchi dati non cancellati. Nomi accessibili dei select condivisi corretti per escludere il testo delle opzioni.

Migrazione 20261123192433 applicata e allineata: 19 totali, 23 tabelle RLS e nove pubblicate. Probe SQL locale e remoto PASS con fixture annullate; nessun record familiare modificato. Validazione scelte per ricetta/alimento/famiglia, testo esclusivo, versioni piano e copie con link rimossi. duplicate_week e apply_template diventano invoker: 19 definer pubblici preesistenti, nessun nuovo avviso di sicurezza. 112 test locali in 17 file e suite browser di 215 casi (92 desktop, 92 mobile, 31 WebKit iPad). CI e pubblicazione controllate sul commit finale.

Verifica finale permessi alternative: revocati anche i grant authenticated ereditati dai default Supabase, prima di concedere soltanto SELECT/INSERT/UPDATE/DELETE. TRUNCATE, REFERENCES e TRIGGER esplicitamente assenti; probe SQL locale e remoto aggiornato e superato. Nessun privilegio diretto sulle scritture delle liste ampliato. Migrazione correttiva 20261123160134, senza modificare file già applicati.

## Ordinamento prezzi, PAM e alternative ricette — 23 novembre 2026

Lista ordinabile per categoria oppure costo decrescente nel supermercato selezionato, con dati mancanti in fondo. Opzione PAM 10% persistente per negozio, disattivata inizialmente, visibile solo se nome/catena contengono PAM: applicata a Catalogo, lista, €/kg/l e confronto senza alterare prezzi originali. Arrotondamento dopo la quantità della voce; nessuna promozione datata. Scheda Scanner rimossa e route precedente reindirizzata al Catalogo, scansioni integrate conservate.

Alternative strutturate per ingrediente, aggiungibili durante la creazione o nelle ricette salvate, rimovibili e incluse nella duplicazione e nella ricerca. Stessa quantità/unità, massimo 20, unità compatibili. Scelta singola al trasferimento da ricetta o anteprima pasti, mai aggiunta di tutte le alternative insieme. Modifiche alle alternative invalidano la versione dei piani; cambiare scelta annulla l’anteprima locale.

Migrazioni 20261123154538 e 20261123160134 applicate e allineate: diciotto totali, 23 tabelle con RLS e nove pubblicate. Probe SQL locale e remoto PASS con fixture annullate, nessun dato familiare modificato. Nuova tabella con FK composite, indici e policy di appartenenza; wrapper pubblico invoker e workflow privato validato per le scritture protette della lista. Due RPC precedenti convertite a invoker: advisor pubblici definer da 23 a 21, nessun nuovo avviso di sicurezza. Normali INFO degli indici nuovi non ancora utilizzati. 107 test locali in 16 file; suite browser 200 casi (87 desktop, 87 mobile, 26 WebKit iPad). CI e pubblicazione controllate sul commit finale.

## Prezzi nella tabella e modifica dalla lista — 23 novembre 2026

Catalogo con colonne Prodotto, Marca, Formato, Prezzi, Categoria, EAN, Azioni. Prezzi per negozio impilati nella tabella con €/kg/l sottostante, trattini per dati assenti e negozi archiviati esclusi. Nuova azione Aggiungi alla lista: una confezione della scheda esatta, senza cambiare pagina. Modifica supermercato raggiunge il campo nome e lo mette a fuoco anche al secondo clic.

Nella lista, Modifica prezzo accanto a Modifica quantità apre la stessa gestione del Catalogo. Con più prodotti compatibili si sceglie esplicitamente la scheda; nessuna modifica attribuita automaticamente alla marca o confezione più economica. Prezzo per confezione, salvataggio in sostituzione e rimozione condivisi; totali, costi articolo e €/kg/l si aggiornano. Il valore unitario usa il prezzo della singola confezione, non il costo moltiplicato per la quantità. Nessuna migrazione, nuova dipendenza o scrittura di record familiari reali durante i test.

Verifiche: 103 test locali, suite browser di 187 prove (83 desktop, 83 mobile Chromium, 21 WebKit iPad), incluse quattro nuove prove per profilo. Controlli di contrasto dell’editor riutilizzato nella lista, virgola, retry, offline, scelta formato, aggiornamento condiviso e focus/scorrimento. CI e pubblicazione controllate sul commit finale.

## Ricerca per marca e prezzi nella lista — 23 novembre 2026

Ricerca del prodotto per nome oppure marca, con risultati espliciti nome generico · marca. La scelta per marca salva preferred_brand già esistente e lascia libero il formato; scelta generica, barcode e articoli liberi conservati. Una sola voce per nome/marca anche con più formati; marche di prodotti archiviati escluse. Nome e marca visibili insieme nella lista e nei rimossi, filtro articoli esteso alla marca.

Riepilogo dei totali per ogni supermercato sempre espanso nella lista e costi per negozio sotto ogni articolo. Calcolo condiviso con il confronto nei Supermercati, su quantità residue e confezioni intere, con preferenze marca/formato. Trattini per dati mancanti e totali parziali; nessuna modifica prezzi nella lista, nessuno storico o statistica reintrodotto. Variazioni quantità, aggiunte, rimozioni e ripristini ricalcolano tutto; filtro testuale e scelta dell’ordine corsie non nascondono i costi degli altri negozi. Nessuna migrazione o nuova dipendenza.

103 test locali in 15 file e 175 prove browser (79 desktop, 79 mobile Chromium, 17 WebKit iPad). Verificati ricerca Nutella, persistenza della marca, prezzi senza sostituzione con marche più economiche, quantità e copertura, errori recuperabili, reset, tocco e accessibilità; tabella compatta scorribile anche da tastiera. Lint, tipi, build, segreti, PWA, CI e pubblicazione controllati sul commit finale. Nessun dato familiare modificato durante le prove.

## Prezzo unico attuale e cinque pagine — 23 novembre 2026

Menu principale e barra mobile: Lista della spesa, Catalogo, Ricette, Pasti, Supermercati. Statistiche rimosse; vecchio indirizzo reindirizzato alla lista. Confronto costi integrato nei Supermercati e raggiungibile dalla lista, senza una pagina aggiuntiva.

Nuovo product_prices con un solo importo per prodotto/negozio: aggiornamento in sostituzione, rimozione senza ripristino di importi vecchi, niente classificazione o date. Calcolo €/kg/l e virgola conservati. Confronto basato sempre sui valori attuali, senza promozioni, periodi di validità, sconti personali o previsioni salvate. Frontend non carica più le collezioni di rilevazioni, sconti e snapshot; nessun nuovo storico generato. Dati precedenti conservati nel backend per compatibilità, senza interfaccia di consultazione.

Migrazione 20261123142201 applicata: sedici complessive, 22 tabelle RLS e otto pubblicate. Copia dell’ultimo importo disponibile, senza applicare classificazioni promozionali. Probe SQL reale PASS con fixture annullate: sostituzione, zero, errori senza modifiche parziali, rimozione, isolamento e cascata. Nessuna nuova segnalazione di sicurezza; solo INFO dell’indice appena creato ancora inutilizzato. Suite corrente 99 casi locali in 14 file e 166 browser, inclusi 14 WebKit iPad. CI e pubblicazione HTTPS verificate sul commit finale.

## Catalogo prezzi, percorsi dei negozi e lista rapida — 23 novembre 2026

Scheda Prezzi per ogni prodotto del Catalogo: riepilogo dell’ultima rilevazione di ciascun supermercato attivo, trattini per dati mancanti, calcolo automatico €/kg o €/l anche durante l’inserimento, date e tipo del prezzo. Nuova rilevazione e correzione distinte; la correzione è atomica e conserva l’originale annullato. Input con virgola mantenuto. Prezzi e storico spostati dal confronto al Catalogo; il confronto e gli sconti personali restano disponibili.

Categorie comuni gestite nei Supermercati; ordine indipendente per negozio, trascinamento/tastiera conservati. Replica iniziale e automatica per nuovi negozi/categorie; scelta del negozio nella lista ricordata per famiglia sul dispositivo. Lista con aggiunta/rimozione reversibile immediata, senza registrazione acquisti o prezzi. Scelta per nome univoco, poi marca e formato indipendenti e facoltativi; barcode conserva la scheda esatta. Senza formato si parte da 1 confezione; confronto prezzi rispetta entrambe le preferenze e i formati equivalenti.

Migrazioni 20261123113031 e 20261123113134 applicate: quindici complessive, 21 tabelle con RLS e sette tabelle pubblicate. Probe SQL reale PASS con sole fixture annullate, nessun prodotto/prezzo familiare alterato; aggiunte soltanto copie dell’ordine categorie dei negozi. Advisor: nessuna nuova segnalazione di sicurezza; indice FK e policy duplicata corretti, normale INFO di indice appena creato ancora inutilizzato. Suite locale 96 casi in 13 file; suite browser 164 casi, inclusi 12 WebKit iPad. CI e pubblicazione verificate sul commit finale. Il precedente difetto touch era stato confermato risolto dall’utente sul suo iPad; per questa versione nuove prove automatiche, nessun nuovo collaudo hardware.

## Selezione touch su iPad — 23 novembre 2026

Corretto il menu di autocompletamento condiviso da lista, ricette e pasti. La chiusura sul blur poteva rimuovere i suggerimenti prima del click, perdendo la selezione. Ora il menu si chiude con selezione, interazione/focus esterni, Tab o Escape; il solo blur non lo smonta. Focus ripristinato prima della chiusura per evitare la riapertura del menu; touch e penna non bloccano i gesti di scorrimento.

Riprodotta con WebKit la sequenza blur prima del click e verificata la correzione. 92 test locali e 21 prove mirate desktop/mobile/WebKit iPad; suite browser completa portata a 155 casi, con sette prove specifiche WebKit in CI. Nessun accesso ai dati familiari e nessuna modifica al database. Conferma sul dispositivo iPad fisico ancora da ottenere dall’utente dopo aggiornamento.

## Virgola nei campi dei prezzi — 23 novembre 2026

Campo monetario condiviso per prezzi osservati, totale pagato, lordo, aggiunta successiva del prezzo e soglie/massimali sconto. Tastiera decimale mobile, indicazione della virgola, errore immediato accessibile per qualsiasi punto, senza autocorrezione; salvataggio bloccato finché l’importo non è valido. Interi e zero ammessi, massimo due decimali; campi opzionali vuoti mantengono il prezzo sconosciuto. Valori esistenti resi con virgola e senza separatori delle migliaia nei moduli. Conversione al formato numerico interno solo dopo validazione, nessuna migrazione o modifica dei dati preesistenti.

92 test locali in 12 file e 144 prove browser desktop/mobile; controlli di lint, tipi, build, aggiornamento PWA e segreti. CI e pubblicazione del commit finale controllate separatamente. Nessuna prova hardware o scrittura nei dati familiari.

## Modifica guidata e formato sempre visibile — 16 novembre 2026

Nel modulo Catalogo rimossi kg e L dalle scelte del formato; restano g, ml, pz e conf. Formati esistenti e da barcode convertiti nel modulo con aritmetica decimale, conservando il contenuto della confezione; persistenza solo dopo Salva prodotto. Unità storiche e conversioni nelle altre sezioni conservate, nessuna migrazione. Formato ancora opzionale ma sempre visibile in un fieldset, senza espandi/riduci né etichetta facoltativo. Modifica scorre al campo Nome prodotto dopo il montaggio del form e lo focalizza; funziona anche ripremendo Modifica sullo stesso prodotto e rispetta il movimento ridotto.

Suite completa PASS: 89 test locali in 12 file e 136 prove browser desktop/mobile; lint, tipi e build verificati. Aggiornamento PWA, segreti, CI e pubblicazione HTTPS controllati prima di concludere. Nessuna prova hardware iPad aggiuntiva.

## Riepilogo catalogo con due totali — 15 novembre 2026

Su richiesta successiva, la dashboard per categoria è sostituita da due soli numeri: prodotti attivi complessivi e categorie effettivamente presenti, incluse quelle vuote. Nessun dettaglio per singola categoria o categoria virtuale nel totale. Ricerca e vista archiviati non cambiano i totali; gruppi interni e prodotti archiviati esclusi dal conteggio prodotti come prima. Nessuna modifica ai dati.

88 test locali e due prove browser mirate desktop/mobile PASS, incluse espansione della tabella e accessibilità. Suite completa in CI e pubblicazione controllate sul commit finale.

## Catalogo compatto, lista prima del modulo e cancellazione piani — 15 novembre 2026

Dashboard in cima al Catalogo con prodotti attivi per categoria, zeri inclusi, ordine familiare e Altri prodotti per le schede senza categoria. Conteggi indipendenti dai filtri e dai raggruppamenti interni. Tabella Prodotti richiudibile con details/summary nativi, mouse/tocco/tastiera; la ricerca la riapre. Intestazioni della tabella rese più leggibili. Nella lista gli articoli, inclusi gli acquistati, precedono il modulo di aggiunta e i suggerimenti frequenti.

Pasti: Elimina piano settimanale disponibile per attivi e archiviati, con date e conferma irreversibile; cancella piano/pasti, azzera l’anteprima solo dopo successo e permette di ricreare la settimana vuota. Lista già confermata, acquisti, ricette, modelli e altre settimane conservati. Riutilizzati DELETE, RLS e FK ON DELETE CASCADE esistenti; nessuna migrazione o nuovo privilegio. Script SQL locale/remoto PASS con rollback e impronte dei dati reali invariate. Due test locali per i conteggi e uno per la cancellazione SQL; dieci prove browser mirate desktop/mobile PASS, inclusa accessibilità del Catalogo.

Suite completa PASS: 88 test locali in 12 file, 132 prove browser desktop/mobile, lint, tipi, build, aggiornamento PWA e segreti. Screenshot mobile della dashboard verificato; nessun collaudo hardware aggiuntivo. CI e disponibilità HTTPS controllate sul commit pubblicato.

## Lista come schermata iniziale e nuovo menu — 15 novembre 2026

Home sostituita dalla lista della spesa già presente: `/` reindirizza a `/liste` con replace, anche dal logo e dall’avvio PWA esistente. Rimossa la precedente pagina Home e il collegamento Home dalla lista. Menu principale desktop e barra mobile condividono l’ordine Catalogo, Ricette, Lista della spesa, Pasti, Statistiche; lista al centro, senza duplicazione nel menu secondario. Vecchi URL `/liste/...` conservati, voce attiva anche su quei percorsi. Nessuna migrazione o modifica ai dati. Dieci prove mirate desktop/mobile PASS: avvio, lista vuota e popolata, cinque destinazioni e ordine, voce attiva, logo/Indietro senza passaggio Home, URL precedenti, accessibilità axe e accesso senza sessione.

Suite completa PASS: 85 test locali in 11 file, 122 prove browser desktop/mobile, lint, tipi, build, aggiornamento PWA e controllo segreti. CI e disponibilità HTTPS verificate alla pubblicazione.

## Autocompletamento nella lista della spesa — 15 novembre 2026

Prodotto dal catalogo ora è un unico campo con suggerimenti, condiviso con ingredienti e calendario. Ricerca mentre si scrive per nome, marca, variante e barcode, senza accenti/maiuscole e per più parole parziali; risultati alfabetici per il nome, con marca e formato visibili. Selezione con tastiera, mouse o tocco, invalidazione dell’ID quando cambia il testo, ritorno esplicito all’articolo libero. Conservati formato iniziale, conversioni compatibili, errore con bozza conservata, reset solo dopo successo, barcode e ritorno dal Catalogo. Prodotti archiviati o rimossi non restano selezionabili dopo refresh. Nessuna migrazione, nuova dipendenza o modifica al database reale.

Verifiche locali PASS: 85 test in 11 file, 122 prove browser desktop/mobile, lint, tipi, build, aggiornamento PWA e segreti. Test di accessibilità axe sul modulo PASS. CI e disponibilità HTTPS controllate alla pubblicazione.

## Cancellazione completa dal Catalogo — 15 novembre 2026

Rimuovi dal catalogo ora cancella definitivamente anche prodotti con collegamenti, dopo conferma nominativa con elenco delle conseguenze. Un’unica transazione rimuove articoli e contributi, acquisti, prezzi anche annullati, previsioni che citano dati eliminati ed esclusioni dagli sconti. All’ultima scheda di un alimento, elimina anche il raggruppamento interno e i suoi riferimenti negli ingredienti delle ricette, nei pasti e nei modelli, conservando ricette/modelli e le altre voci. Altre marche, anche archiviate, restano con i collegamenti generici condivisi. Archivia continua a conservare lo storico; la rimozione dalla lista resta distinta.

Migrazione 20261115190432 applicata tramite Supabase; funzioni soltanto, nessuna cancellazione di prodotti reali durante l’installazione. Wrapper pubblico invoker e implementazione privata definer per le tabelle contabili RPC-only, autorizzazione esplicita per famiglia e privilegi anon revocati. Collaudo SQL remoto transazionale PASS con rollback; impronte di tutte le tabelle applicative e Auth invariate. Advisor senza errori; avvisi preesistenti documentati nel rapporto test. Due nuovi test locali coprono lo script SQL e il rollback forzato dopo rimozioni parziali.

Verifiche locali PASS: lint, tipi, build, 84 test in 11 file, 120 prove browser desktop/mobile, aggiornamento PWA e controllo segreti. Pubblicazione e CI del commit controllate separatamente.

## Ingredienti e calendario con autocompletamento — 15 novembre 2026

Selettore con ricerca per ogni ingrediente delle ricette e per Ricetta o alimento nel calendario. Risultati sempre in ordine alfabetico italiano, filtrati mentre si scrive, senza distinzione tra maiuscole e accenti e con supporto a più parole parziali. Nel calendario ricette e alimenti sono ordinati insieme, con tipo visibile per distinguere gli omonimi. Selezione con tocco, mouse, frecce e Invio; Escape chiude. Il testo libero senza selezione non viene salvato; ogni ingrediente mantiene la propria scelta. Valori conservati dopo un errore e svuotati solo dopo salvataggio riuscito. Nessuna migrazione o nuova dipendenza.

Verifiche locali PASS: lint, tipi, build, 82 test in 10 file, 116 prove browser desktop/mobile, aggiornamento PWA e controllo segreti. Nessuna scrittura di prova nel database reale; il collaudo iPad fisico resta distinto dalle prove touch simulate.

## Barcode non alimentari — 15 novembre 2026

Aggiunte Open Beauty Facts e Open Products Facts come fonti alternative a Open Food Facts, per cosmetici/igiene e altri prodotti del supermercato. Nessun collegamento a Open Pet Food Facts, nessun product_type=all e nessun redirect seguito; record dichiarati petfood ignorati. Fonte effettiva visibile e crediti aggiornati. Alimentari trovati al primo tentativo senza chiamate aggiuntive; deadline complessiva 10 secondi, niente cache negativa per guasti parziali e compatibilità dei client precedenti. Nessuna migrazione, chiave API o dipendenza. 108 test browser desktop/mobile PASS; suite locale corrente 79 casi, inclusi 19 test di normalizzazione/proxy PASS. Probe pubblici: Open Beauty Facts 8001090662231 (Herbal Essences, Coconut Milk, 400 ml) e Open Products Facts 3178041366304 (Henkel, Décolor Stop); quantità senza unità lasciata manuale. Nessun dato di famiglia consultato o scritto.

## Barcode direttamente nella lista — 15 novembre 2026

Scanner EAN-8/EAN-13 nel pannello Aggiungi alla lista, con inserimento codice manuale alternativo. Corrispondenza locale nel Catalogo senza richieste esterne; selezione e formato proposto modificabili, aggiunta solo con conferma. Codici nuovi: percorso esplicito al Catalogo, riuso ricerca dati e ritorno automatico con prodotto selezionato dopo salvataggio. Prodotti archiviati mai riattivati automaticamente; errori/codici mancanti lasciano disponibili gli articoli liberi. Conservati ricerca, selezione e inserimento precedenti. Nessuna migrazione, dipendenza o scrittura di prova nel database reale. 72 test locali e 10 nuove prove browser mirate desktop/mobile PASS; suite browser corrente 104 casi.

## Rimozione dalla lista distinta dal catalogo — 15 novembre 2026

Pulsante **Rimuovi dalla lista** direttamente su ogni articolo, senza passare da Modifica; sostituisce Archivia nella lista e rimuove la cancellazione definitiva dal modulo di modifica. Riutilizza l’archiviazione protetta esistente: acquisti, contributi e catalogo conservati anche con storico. Recupero tramite Mostra articoli rimossi e Rimetti nella lista. Nel Catalogo l’azione è esplicitamente Rimuovi dal catalogo. Nessuna nuova migrazione o modifica ai dati reali. Dodici test browser mirati desktop/mobile PASS, compresi acquisto parziale conservato dopo rimozione/refresh/ripristino, nessuna DELETE e annullamento conferma senza scritture. Suite completa corrente: 94 casi, verificata in CI alla pubblicazione.

## Ordine delle categorie — 15 novembre 2026

Trascinamento mouse/tocco, frecce e tastiera nelle Categorie della famiglia; ordine salvato automaticamente e condiviso con selettore categoria e gruppi della lista della spesa. Nuove categorie in fondo. RPC `reorder_categories` SECURITY INVOKER, RLS, salvataggio atomico e verifica della sequenza attesa per respingere bozze obsolete; lock coerenti per famiglia. `categories` aggiunta a Realtime: cinque tabelle pubblicate. Migrazione `20261115122000_category_order.sql` applicata tramite Supabase, categorie esistenti invariate. Collaudo SQL reale transazionale PASS con rollback; zero fixture residue. 72 test locali in 9 file e 92 test browser desktop/mobile PASS, inclusi tocco simulato, annullamento, persistenza, ordine nella spesa, errori e offline. Prova su iPad fisico ancora da eseguire.

## Lista unica e catalogo nella barra inferiore — 15 novembre 2026

Una sola lista per famiglia, aperta dalla Home; Catalogo nella navigazione primaria/mobile. Rimossi i comandi per gestire liste multiple e i selettori in ricette, pasti e confronto. Migrazione `20261115115132_single_shopping_list.sql` applicata tramite plugin Supabase: vincolo univoco, stato sempre attivo, inizializzazione SECURITY INVOKER con RLS e duplicazione revocata. Impronte dati prima/dopo identiche. Collaudo SQL reale transazionale PASS, fixture annullate. 69 test locali PASS; 86 casi browser correnti, verificati con suite completa e ripetizione dei quattro casi aggiornati. PWA PASS. Advisor: zero errori; avvisi preesistenti su 23 RPC definer autorizzate e protezione password compromesse. CI/deploy del commit verificati dopo pubblicazione. Secondo account reale ancora rinviato come richiesto.

## Inserimento barcode — 15 novembre 2026

Implementati lettura camera EAN-8/EAN-13 (nativa e ZXing), ricerca manuale, compilazione revisionabile del catalogo da Open Food Facts e riconoscimento prodotti già presenti. Campi incompleti restano manuali; categorie solo esistenti e univoche. Nessun salvataggio implicito o invio di immagini. Proxy Pages con cache di soli dati pubblici e attribuzione ODbL. Test locali: 66 PASS; browser desktop/mobile: 82 PASS, compresa decodifica ZXing reale su video sintetico. Richiesta al provider staging: PASS con prodotto pubblico. Fotocamera fisica Android/iOS ancora NOT RUN. Questa funzione completa la parte barcode della fase 5; OCR e altre importazioni rimangono TODO e il gate complessivo resta aperto.

Aggiornamento: 15 novembre 2026. Implementazione progressiva: **consegna completa non verificata**. I gate online non vengono considerati superati in base alle fixture locali.

| Fase                            | Stato del gate | Lavoro presente e blocchi                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Fondazioni                  | PASS           | Repository pubblico, tooling, CI verde, migrazioni, RLS, test PostgreSQL, manifest/service worker e documentazione. Build, lint, typecheck, test e controllo segreti verificati localmente e in CI.                                                                                  |
| 1 — Account, famiglia, liste    | IN PROGRESS    | Schema e RLS/RPC verificati; primo account reale, email confermata, login, famiglia e lista verificati manualmente con riscontro DB. Persistenza articolo dopo refresh confermata. Secondo account rinviato; restano account esterno e sincronizzazione/riconnessione su due client. |
| 2 — Catalogo, prezzi, confronto | BLOCKED        | Moduli indipendenti implementati e testati: formati, promozioni, ranking, sconti personali per negozio, date e copertura. Gate complessivo dipende dalla fase 1 online. Condizioni sconto per intero scontrino ed esclusioni di categoria da completare.                             |
| 3 — Ricette e calendario        | BLOCKED        | Moduli indipendenti: creazione atomica, scaling, preferiti/ricerca, settimane/modelli, preview e conferma transazionale con versioni. Editing completo ingredienti, import e collaudo del percorso completo ancora da completare.                                                    |
| 4 — Spesa e statistiche         | BLOCKED        | Acquisti e annullamenti, pagato opzionale, snapshot, statistiche e export implementati; test locali su residui e contabilità. Rilevazioni da acquisto con scelta esplicita e dettaglio analitico differenze previsto/effettivo ancora da completare.                                 |
| 5 — Barcode e importazioni      | IN PROGRESS    | Barcode EAN con camera nativa/ZXing, ricerca e compilazione revisionabile da Open Food Facts implementati. OCR, URL ricette, foto, ricevute revisionabili e deduplica transazionale NON implementati; collaudo camera fisica ancora da eseguire.                                     |
| 6 — Consegna e deploy           | IN PROGRESS    | PWA pubblicata su Cloudflare Pages con HTTPS, deploy continuo da main e redirect Supabase aggiornati. Test PWA e CI PASS; restano gate funzionali precedenti, installazione e fotocamera su Android/iOS fisici.                                                                      |

## Stato corrente: migrazioni reali applicate

14 novembre 2026: bootstrap 001–007 applicato tramite SQL Editor ufficiale dopo il login interattivo dell’utente; controllo preliminare con zero tabelle pubbliche. Plugin installato, strumenti SQL non esposti nella sessione: usato un browser dedicato. Nessuna chiave amministrativa acquisita.

Il controllo del servizio ha rilevato grant automatici del proprietario non presenti nel PostgreSQL locale iniziale. Creata, testata e applicata la migrazione 008 explicit_privileges. I test locali ora emulano questi default Supabase.

**Verifica finale: 20 tabelle con RLS, zero grant anon sulle tabelle e sulle RPC, 24 RPC abilitate per authenticated, quattro tabelle nella pubblicazione Realtime.** Dieci versioni registrate nella struttura standard supabase_migrations.schema_migrations con SQL originale; checksum di tutte le versioni corrispondenti ai file locali.

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

## Catalogo unico

Su richiesta dell'utente, modulo unico con solo nome obbligatorio e categoria/marca/EAN/variante/formato facoltativi. Tolta la distinzione di inserimento generico/commerciale e il selettore A–Z/Z–A: ordinamento A–Z fisso. Le strutture interne conservano i riferimenti di liste, ricette e prezzi. Formati sconosciuti non generano stime. Migrazione 20261114221151 applicata, registrata e verificata; 54 test locali e 68 browser PASS, collaudo SQL reale transazionale PASS, zero fixture residue. Security Advisor: zero errori, avvisi preesistenti documentati.
