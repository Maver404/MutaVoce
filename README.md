# MutaVoce — voice changer web

Voice changer in tempo reale che gira interamente nel browser: prendi la voce dal microfono, la trasformi con preset o controlli manuali e la mandi in cuffia/casse oppure a un'altra applicazione (Discord, Zoom, Meet, OBS, giochi…). Pensato per il desktop, utilizzabile anche da smartphone. Interfaccia in italiano e inglese.

Nessun server: l'audio non lascia mai il computer.

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

La build finisce in `dist/` ed è un sito statico: pubblicala su qualsiasi hosting **HTTPS** (Netlify, Vercel, GitHub Pages, Cloudflare Pages…). Il microfono funziona solo su HTTPS o su `localhost`.

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
