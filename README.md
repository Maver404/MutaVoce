# MutaVoce — voice changer web

Voice changer in tempo reale che gira interamente nel browser: prendi la voce dal microfono, la trasformi con preset o controlli manuali e la mandi in cuffia/casse oppure a un'altra applicazione (Discord, Zoom, Meet, OBS, giochi…). Pensato per il desktop, utilizzabile anche da smartphone. Interfaccia in italiano e inglese.

Nessun server: l'audio non lascia mai il computer.

**Provala online:** https://maver404.github.io/MutaVoce/

## Funzionalità

- **42 preset** in tre categorie
  - *Professionali*: voce pulita, podcast, radio DJ, narratore, presentatore, voce anonima, intervista anonima TV, più giovane/matura, maschile↔femminile…
  - *Divertenti*: scoiattolo, elio, gigante, demone, robot, androide (vocoder), alieno, fantasma, bambino, papero, popstar (autotune), legione, sussurro…
  - *Ambienti e radio*: telefono, walkie-talkie (con squelch), radio d'epoca, megafono, aeroporto, pilota, bagno, caverna, cattedrale, stadio
- **Preset personali**: salva, rinomina, duplica, elimina, preferiti (tasti 1–9), esporta/importa in JSON
- **15 moduli** nella catena, ognuno con bypass senza click:
  noise gate · tono e formanti (bassa latenza o alta qualità con formanti indipendenti) · autotune (tonalità/scala/naturalezza) · voci aggiuntive · modulatore ad anello · vocoder · distorsione · bitcrusher · filtro con LFO · EQ parametrico a 8 bande · compressore con indicatore di riduzione · chorus/flanger/vibrato/tremolo · delay · riverbero (7 ambienti generati) · rumore di fondo
- **Analizzatore**: spettro ingresso/uscita con curva EQ trascinabile, spettrogramma, oscilloscopio, nota rilevata in ingresso e in uscita
- **Uscite indipendenti**: ascolto (cuffie/casse) + invio a un cavo audio virtuale per le altre app
- **Ingressi**: microfono (con scelta dispositivo e filtri del browser opzionali), voce di prova sintetica, file audio in loop
- **Registratore**: WebM/Opus o WAV senza perdita, ascolto e download delle registrazioni
- **Soundboard**: 12 effetti sintetizzati + suoni personali trascinati nella pagina (salvati in IndexedDB), volume e tasto per ogni pad
- **Scorciatoie e push-to-talk** (tieni premuto o premi per attivare, tasto configurabile)
- Installabile come app (PWA) e funzionante offline

## Avvio

Serve Node.js 18 o superiore.

```bash
npm install
```

```bash
npm run dev
```

Apri http://localhost:5173 in Chrome o Edge.

Altri comandi:

```bash
npm test
```

```bash
npm run build
```

La build finisce in `dist/` ed è un sito statico con percorsi relativi: funziona su qualsiasi hosting **HTTPS**, anche in una sottocartella. Il microfono funziona solo su HTTPS o su `localhost`.

Ogni push su `main` esegue i test, fa la build e pubblica il sito su GitHub Pages tramite `.github/workflows/deploy.yml` (in *Settings → Pages* la sorgente deve essere **GitHub Actions**).

## Docker

L'immagine pronta è pubblicata su GitHub Container Registry per `linux/amd64` e `linux/arm64`. È un nginx senza privilegi che serve la build statica in **HTTP sulla porta 8080** e in **HTTPS sulla porta 8443**.

```bash
docker run -d --name mutavoce -p 8080:8080 -p 8443:8443 -e TLS_HOSTNAMES=192.168.1.50 -v mutavoce-certs:/certs --restart unless-stopped ghcr.io/maver404/mutavoce:latest
```

In alternativa, con il `compose.yaml` del repository (imposta `TLS_HOSTNAMES` nel file):

```bash
docker compose up -d
```

Per costruire l'immagine in locale:

```bash
docker build -t mutavoce .
```

### Quale indirizzo aprire

I browser danno il microfono solo su **HTTPS** oppure su **localhost**. Aprendo `http://<indirizzo-del-server>:8080` la pagina si vede, ma il microfono resta bloccato (l'app lo segnala con un avviso e il link giusto).

| Da dove apri | Indirizzo |
| --- | --- |
| Lo stesso computer dove gira Docker | http://localhost:8080 |
| Un altro dispositivo in rete (NAS, server di casa…) | https://&lt;indirizzo-del-server&gt;:8443 |
| Un dominio con un tuo reverse proxy | https://tuodominio |

**Certificato.** Al primo avvio il container genera un certificato *autofirmato* valido per `localhost` e per i nomi/IP in `TLS_HOSTNAMES` (separati da virgola, es. `192.168.1.50,nas.local`). Il browser mostra un avviso "connessione non privata" la prima volta: scegli *Avanzate → Procedi*. Il certificato viene salvato nel volume `/certs`, così l'avviso non torna a ogni riavvio; se cambi `TLS_HOSTNAMES` viene rigenerato.

Per evitare del tutto l'avviso hai due strade:

- **Certificato tuo:** monta una cartella con `cert.pem` e `key.pem` su `/certs` (es. `-v /percorso/certificati:/certs:ro`): il container li usa così come sono.
- **Reverse proxy con dominio:** per esempio Caddy, che ottiene da solo un certificato valido:

```
mutavoce.tuodominio.it {
    reverse_proxy localhost:8080
}
```

L'nginx del container imposta già header di sicurezza (Content-Security-Policy, `Permissions-Policy: microphone=(self)`), cache lunga per i file con hash e nessuna cache per `index.html` e il service worker, così gli aggiornamenti arrivano subito.

Ogni push su `main` ricostruisce l'immagine, la prova (HTTP, HTTPS, certificato generato, certificato fornito, riavvio) e pubblica `latest`. Un tag `vX.Y.Z` pubblica anche `X.Y.Z` e `X.Y`.

## Usare la voce in un'altra applicazione

Un sito web non può creare un microfono virtuale, quindi serve un **cavo audio virtuale** gratuito. MutaVoce manda la voce all'ingresso del cavo, e l'altra app la riceve dall'uscita del cavo come se fosse un microfono. L'app contiene una guida passo passo (pulsante *Usa in altre app*) e riconosce il cavo da sola.

| Sistema | Cavo | In MutaVoce, "Invia ad altre app" | Nell'altra app, microfono |
| --- | --- | --- | --- |
| macOS | [BlackHole 2ch](https://existential.audio/blackhole/) | BlackHole 2ch | BlackHole 2ch |
| Windows | [VB-CABLE](https://vb-audio.com/Cable/) | CABLE Input | CABLE Output |
| Linux | null sink PipeWire/PulseAudio (comando sotto) | MutaVoce | Monitor of MutaVoce |

```bash
pactl load-module module-null-sink sink_name=MutaVoce sink_properties=device.description=MutaVoce
```

Lascia acceso *Ascolto* con le cuffie se vuoi sentirti mentre parli. La scheda può stare in secondo piano, ma non va chiusa.

## Telefonate da iPhone o Android

Con il solo telefono non si può: iOS e Android non permettono a nessuna app, né a una pagina web, di inserire audio in una chiamata telefonica. Lo stesso vale per le chiamate WhatsApp o Telegram fatte dal telefono. Si fa quindi passare la chiamata dal computer, dove MutaVoce manda la voce al cavo virtuale. Nell'app, la guida *Usa in altre app* ha una scheda **Telefonate** con gli stessi passi.

**iPhone + Mac**

1. Installa BlackHole 2ch e sceglilo in MutaVoce in *Invia ad altre app*.
2. Sull'iPhone vai in *Impostazioni → (App →) Telefono → Chiamate su altri dispositivi* e attiva il Mac. Servono lo stesso Apple ID e la stessa Wi-Fi.
3. Sul Mac vai in *FaceTime → Impostazioni* e attiva *Chiamate da iPhone*.
4. In FaceTime, dal menu *Video*, scegli **BlackHole 2ch** come microfono (in alternativa: *Impostazioni di Sistema → Suono → Ingresso*). Poi chiama o rispondi dal Mac.

**Android o iPhone + Windows**

1. Installa VB-CABLE e scegli **CABLE Input** in *Invia ad altre app*.
2. Apri *Collegamento al telefono* (Phone Link), associa il telefono e attiva le chiamate, che passano via Bluetooth.
3. Vai in *Impostazioni → Sistema → Audio → Input* e scegli **CABLE Output** come predefinito.
4. Chiama o rispondi da Collegamento al telefono.

**Qualsiasi telefono, con un cavo.** Serve quando il computer non può gestire la chiamata, per esempio Android + Mac.

- Collega l'uscita cuffie del computer (l'*Ascolto* di MutaVoce) all'ingresso microfono del telefono con uno sdoppiatore TRRS (microfono + cuffie).
- Se il telefono non ha il jack, aggiungi un adattatore USB-C o Lightning che supporti il microfono.
- Le tue cuffie vanno sul lato cuffie dello sdoppiatore.
- Tieni basso il volume o usa un cavo attenuato: l'uscita cuffie è molto più forte di un microfono.

In tutti i casi ascolta la chiamata in cuffia: con le casse la voce dell'altra persona rientra nel microfono e le torna indietro come eco.

## Compatibilità

| | Chrome / Edge desktop | Firefox desktop | Safari | Mobile |
| --- | --- | --- | --- | --- |
| Effetti e preset | ✓ | ✓ | ✓ | ✓ |
| Scelta uscita ascolto | ✓ | ✓ (selettore del browser) | — | — |
| Invio ad altre app | ✓ | ✓ (selettore del browser) | — | — |

Provato su Chrome desktop; Firefox e Safari seguono le API standard ma non sono ancora stati testati.

## Scorciatoie

| Azione | Tasto |
| --- | --- |
| Avvia / ferma audio | ⇧ Enter |
| Confronta originale / effetto | B |
| Muto | M |
| Preset preferiti | 1 … 9 |
| Preset precedente / successivo | ← / → |
| Registra | R |
| Pad della soundboard | ⇧1 … ⇧9 (riassegnabili) |
| Push-to-talk | Spazio (riassegnabile) |
| Elenco scorciatoie | ? |

Funzionano solo quando la finestra di MutaVoce è in primo piano: i browser non permettono tasti rapidi globali. Per il push-to-talk dentro un gioco o Discord usa quello dell'app stessa.

## Latenza

Circa 20 ms senza pitch shift e circa 35–55 ms con il pitch shift (bassa latenza / alta qualità), più la latenza della scheda audio. Il valore stimato è mostrato in alto a destra.

## Struttura

```
src/
  audio/
    AudioEngine.ts         grafo Web Audio, ingressi, uscite, metering
    bridge.ts              collega lo stato all'engine e salva le impostazioni
    dsp/                   DSP puro e testato (FFT, phase vocoder, granulare, YIN, vocoder, biquad…)
    worklets/              AudioWorklet che usano il DSP
    modules/               moduli effetto (nodi Web Audio + worklet)
    soundboard/            suoni sintetizzati e riproduzione
    Recorder.ts, wav.ts    registrazione WebM e WAV
  presets/                 preset di fabbrica e import/export
  state/                   parametri, store (zustand), azioni, persistenza
  i18n/                    testi IT / EN
  ui/                      componenti, layout, analizzatore, pannelli
tests/                     test Vitest di DSP, preset, WAV e traduzioni
```
