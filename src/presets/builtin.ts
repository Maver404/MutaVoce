import { DEFAULT_EQ_BANDS, type EqBand, PARAMS_VERSION, type PresetParams } from '../state/params';
import type { PresetCategory, VoicePreset } from './types';

/** Band indices: 0 HP · 1 low shelf · 2–5 peaks (300/700/1600/3500) · 6 high shelf · 7 LP. */
const eq = (changes: Record<number, Partial<EqBand>>): PresetParams['eq'] => ({
  enabled: true,
  bands: DEFAULT_EQ_BANDS.map((b, i) => ({ ...b, ...changes[i] })),
});

const comp = (threshold: number, ratio: number, makeup: number, attack = 5, release = 140): PresetParams['compressor'] => ({
  enabled: true,
  threshold,
  ratio,
  makeup,
  attack,
  release,
});

type Def = [id: string, icon: string, it: string, en: string, descIt: string, descEn: string, params: PresetParams];

const PRO: Def[] = [
  ['clean', '🎙️', 'Voce pulita', 'Clean voice', 'Gate, taglio dei bassi e compressione leggera.', 'Gate, low cut and gentle compression.', {
    gate: { enabled: true, threshold: -55 },
    eq: eq({ 0: { freq: 80 }, 5: { gain: 2 } }),
    compressor: comp(-22, 3, 3),
  }],
  ['podcast', '🎧', 'Podcast', 'Podcast', 'Voce vicina, calda e presente, livello costante.', 'Close, warm and present voice with steady level.', {
    gate: { enabled: true, threshold: -50 },
    eq: eq({ 0: { freq: 90 }, 1: { gain: 2 }, 2: { gain: -2.5 }, 5: { gain: 3 }, 6: { freq: 10000, gain: 2 } }),
    compressor: comp(-26, 4, 5),
  }],
  ['radio-dj', '📻', 'Radio DJ', 'Radio DJ', 'Voce da speaker: profonda, compressa, brillante.', 'Broadcast voice: deep, compressed, bright.', {
    gate: { enabled: true, threshold: -50 },
    pitch: { enabled: true, mode: 'hq', semitones: -1.5, preserveFormants: true },
    eq: eq({ 0: { freq: 70 }, 1: { freq: 110, gain: 5 }, 5: { freq: 2500, gain: 2 }, 6: { freq: 9000, gain: 3 } }),
    compressor: comp(-30, 6, 7, 3, 100),
  }],
  ['narrator', '📖', 'Narratore caldo', 'Warm narrator', 'Audiolibri e documentari: più profonda e morbida.', 'Audiobooks and documentaries: deeper and softer.', {
    gate: { enabled: true, threshold: -52 },
    pitch: { enabled: true, mode: 'hq', semitones: -2, preserveFormants: true },
    eq: eq({ 0: { freq: 60 }, 1: { freq: 150, gain: 4 }, 2: { freq: 400, gain: 1 }, 5: { freq: 3000, gain: -1 }, 6: { freq: 9000, gain: -2 } }),
    compressor: comp(-24, 3, 4),
    reverb: { enabled: true, type: 'room', decay: 0.6, preDelay: 5, mix: 0.08 },
  }],
  ['announcer', '🏟️', 'Presentatore stadio', 'Stadium announcer', 'Grande, compresso, con eco da arena.', 'Big, compressed, with an arena echo.', {
    pitch: { enabled: true, mode: 'hq', semitones: -1, preserveFormants: true },
    eq: eq({ 0: { freq: 90 }, 1: { gain: 4 }, 4: { freq: 2000, gain: 4 } }),
    compressor: comp(-28, 8, 8, 2, 120),
    delay: { enabled: true, time: 140, feedback: 0.25, tone: 4000, mix: 0.18 },
    reverb: { enabled: true, type: 'stadium', decay: 3.5, preDelay: 30, mix: 0.25 },
  }],
  ['anonymous', '🕶️', 'Voce anonima', 'Anonymous voice', 'Altezza e timbro alterati: irriconoscibile ma naturale.', 'Pitch and timbre altered: unrecognisable yet natural.', {
    pitch: { enabled: true, mode: 'hq', semitones: -3, formant: 2, preserveFormants: true },
    eq: eq({ 0: { freq: 100 }, 4: { gain: 2 } }),
    compressor: comp(-24, 3, 3),
  }],
  ['tv-anonymous', '📺', 'Intervista anonima', 'Anonymous interview', 'Il classico effetto "testimone protetto" della TV.', 'The classic TV "protected witness" effect.', {
    pitch: { enabled: true, mode: 'hq', semitones: -6, preserveFormants: false },
    eq: eq({ 0: { freq: 80 }, 6: { gain: -3 } }),
    compressor: comp(-26, 4, 5),
  }],
  ['younger', '🌱', 'Più giovane', 'Younger', 'Voce più leggera e fresca.', 'Lighter, fresher voice.', {
    pitch: { enabled: true, mode: 'hq', semitones: 2, formant: 2, preserveFormants: true },
    eq: eq({ 0: { freq: 110 }, 6: { gain: 2 } }),
  }],
  ['older', '🧓', 'Più maturo', 'Older', 'Voce più grave con un leggero tremolio.', 'Deeper voice with a slight waver.', {
    master: { gain: 6 },
    pitch: { enabled: true, mode: 'hq', semitones: -2, formant: -1.5, preserveFormants: true },
    modulation: { enabled: true, type: 'vibrato', rate: 5.5, depth: 0.15, mix: 1 },
    eq: eq({ 1: { gain: 2 }, 6: { gain: -2 } }),
  }],
  ['masc-to-fem', '♀️', 'Da maschile a femminile', 'Masculine → feminine', 'Alza tono e formanti per un timbro più femminile.', 'Raises pitch and formants for a more feminine timbre.', {
    master: { gain: 4 },
    gate: { enabled: true, threshold: -50 },
    pitch: { enabled: true, mode: 'hq', semitones: 5, formant: 2.5, preserveFormants: true },
    eq: eq({ 0: { freq: 120 }, 1: { gain: -2 }, 6: { gain: 2 } }),
  }],
  ['fem-to-masc', '♂️', 'Da femminile a maschile', 'Feminine → masculine', 'Abbassa tono e formanti per un timbro più maschile.', 'Lowers pitch and formants for a more masculine timbre.', {
    gate: { enabled: true, threshold: -50 },
    pitch: { enabled: true, mode: 'hq', semitones: -5, formant: -2.5, preserveFormants: true },
    eq: eq({ 1: { gain: 3 }, 6: { gain: -1 } }),
  }],
];

const FUN: Def[] = [
  ['chipmunk', '🐿️', 'Scoiattolo', 'Chipmunk', "Un'ottava sopra, velocissimo.", 'One octave up, super squeaky.', {
    master: { gain: 2 },
    pitch: { enabled: true, mode: 'fast', semitones: 12 },
  }],
  ['helium', '🎈', 'Elio', 'Helium', 'Come aver respirato un palloncino.', 'Like you just inhaled a balloon.', {
    pitch: { enabled: true, mode: 'hq', semitones: 4, formant: 8, preserveFormants: true },
  }],
  ['giant', '🗿', 'Gigante', 'Giant', 'Enorme, lento e rimbombante.', 'Huge, slow and booming.', {
    pitch: { enabled: true, mode: 'hq', semitones: -8, preserveFormants: false },
    eq: eq({ 1: { gain: 3 } }),
    reverb: { enabled: true, type: 'hall', decay: 2.5, preDelay: 20, mix: 0.2 },
  }],
  ['demon', '👹', 'Demone', 'Demon', 'Voci multiple dagli inferi, distorte e cavernose.', 'Layered hellish voices, distorted and cavernous.', {
    pitch: { enabled: true, mode: 'hq', semitones: -7, formant: -2, preserveFormants: false },
    harmonizer: { enabled: true, voice1: -12, level1: 0.6, voice2: -5, level2: 0.3 },
    distortion: { enabled: true, type: 'tube', drive: 0.35, tone: 3500, mix: 0.6 },
    eq: eq({ 1: { gain: 4 } }),
    reverb: { enabled: true, type: 'cave', decay: 3, preDelay: 10, mix: 0.3 },
  }],
  ['robot', '🤖', 'Robot', 'Robot', 'Metallico e meccanico.', 'Metallic and mechanical.', {
    master: { gain: 5 },
    ringmod: { enabled: true, frequency: 50, mix: 0.8 },
    modulation: { enabled: true, type: 'flanger', rate: 0.1, depth: 0.3, feedback: 0.6, mix: 0.5 },
    bitcrusher: { enabled: true, bits: 10, downsample: 2, mix: 0.5 },
  }],
  ['android', '🦾', 'Androide', 'Android', 'Vocoder su nota fissa: il robot da film di fantascienza.', 'Fixed-note vocoder: the sci-fi movie robot.', {
    gate: { enabled: true, threshold: -48 },
    vocoder: { enabled: true, carrier: 'saw', note: 45, mix: 1 },
    modulation: { enabled: true, type: 'chorus', rate: 0.6, depth: 0.4, mix: 0.3 },
    reverb: { enabled: true, type: 'plate', decay: 1.2, preDelay: 5, mix: 0.15 },
  }],
  ['cyborg', '⚙️', 'Cyborg', 'Cyborg', 'Mezzo uomo, mezzo macchina, voce gracchiante.', 'Half human, half machine, raspy voice.', {
    ringmod: { enabled: true, frequency: 30, mix: 1 },
    distortion: { enabled: true, type: 'hard', drive: 0.2, tone: 6000, mix: 0.6 },
    filter: { enabled: true, highpass: 200, lowpass: 6000, resonance: 1.5 },
  }],
  ['alien', '👽', 'Alieno', 'Alien', 'Ondeggiante e venuto da un altro pianeta.', 'Wobbly and from another planet.', {
    master: { gain: 5 },
    pitch: { enabled: true, mode: 'fast', semitones: 3 },
    ringmod: { enabled: true, frequency: 300, lfoRate: 3, lfoDepth: 120, mix: 0.5 },
    modulation: { enabled: true, type: 'flanger', rate: 0.4, depth: 0.8, feedback: 0.7, mix: 0.5 },
    delay: { enabled: true, time: 180, feedback: 0.3, tone: 5000, mix: 0.2 },
  }],
  ['ghost', '👻', 'Fantasma', 'Ghost', 'Sussurro spettrale in una cripta.', 'Spectral whisper inside a crypt.', {
    master: { gain: 3 },
    gate: { enabled: true, threshold: -50 },
    vocoder: { enabled: true, carrier: 'noise', note: 45, mix: 0.7 },
    modulation: { enabled: true, type: 'chorus', rate: 0.3, depth: 0.8, mix: 0.5 },
    eq: eq({ 0: { freq: 200 } }),
    delay: { enabled: true, time: 400, feedback: 0.4, tone: 3000, mix: 0.25 },
    reverb: { enabled: true, type: 'cathedral', decay: 5, preDelay: 30, mix: 0.5 },
  }],
  ['kid', '🧒', 'Bambino', 'Kid', 'Voce da bambino, naturale.', 'A natural-sounding kid voice.', {
    master: { gain: 4 },
    pitch: { enabled: true, mode: 'hq', semitones: 6, formant: 4, preserveFormants: true },
    eq: eq({ 0: { freq: 150 }, 1: { gain: -3 } }),
  }],
  ['old-man', '👴', 'Anziano', 'Old man', 'Tremolante e un po\' rauco.', 'Shaky and a little hoarse.', {
    pitch: { enabled: true, mode: 'hq', semitones: -1, formant: -1, preserveFormants: true },
    modulation: { enabled: true, type: 'vibrato', rate: 6, depth: 0.35, mix: 1 },
    distortion: { enabled: true, type: 'soft', drive: 0.1, tone: 5000, mix: 0.3 },
    eq: eq({ 0: { freq: 150 }, 4: { freq: 1500, gain: 3 }, 6: { gain: -4 } }),
  }],
  ['ogre', '🧌', 'Orco dei cartoni', 'Cartoon ogre', 'Grosso, buffo e un po\' rozzo.', 'Big, funny and a bit rough.', {
    pitch: { enabled: true, mode: 'hq', semitones: -5, formant: -3, preserveFormants: false },
    distortion: { enabled: true, type: 'soft', drive: 0.3, tone: 4000, mix: 0.4 },
    eq: eq({ 1: { gain: 5 }, 3: { freq: 800, gain: 3 } }),
  }],
  ['duck', '🦆', 'Papero', 'Duck', 'Nasale, stridulo e ronzante.', 'Nasal, squeaky and buzzy.', {
    pitch: { enabled: true, mode: 'fast', semitones: 7 },
    filter: { enabled: true, highpass: 900, lowpass: 3500, resonance: 4 },
    distortion: { enabled: true, type: 'hard', drive: 0.3, tone: 5000, mix: 0.4 },
  }],
  ['dark-lord', '🖤', 'Signore Oscuro', 'Dark lord', 'Profondo, metallico, dietro una maschera.', 'Deep and metallic, behind a mask.', {
    pitch: { enabled: true, mode: 'hq', semitones: -4, preserveFormants: false },
    distortion: { enabled: true, type: 'tube', drive: 0.25, tone: 4500, mix: 0.5 },
    modulation: { enabled: true, type: 'flanger', rate: 0.15, depth: 0.15, feedback: 0.5, mix: 0.3 },
    eq: eq({ 1: { gain: 5 }, 4: { freq: 1000, gain: 3, q: 2 } }),
    compressor: comp(-24, 4, 4),
    reverb: { enabled: true, type: 'room', decay: 0.8, preDelay: 5, mix: 0.12 },
  }],
  ['underwater', '🫧', "Sott'acqua", 'Underwater', 'Ovattato, ondeggiante e pieno di bolle.', 'Muffled, wobbling and bubbly.', {
    filter: { enabled: true, highpass: 20, lowpass: 700, resonance: 3, lfoRate: 1.5, lfoDepth: 0.5 },
    modulation: { enabled: true, type: 'vibrato', rate: 3, depth: 0.7, mix: 1 },
    delay: { enabled: true, time: 60, feedback: 0.5, tone: 1500, mix: 0.3 },
    noise: { enabled: true, type: 'rumble', level: 0.15 },
  }],
  ['eight-bit', '👾', '8-bit', '8-bit', 'Come un vecchio videogioco a 8 bit.', 'Like an old 8-bit video game.', {
    autotune: { enabled: true, scale: 'chromatic', speed: 0 },
    bitcrusher: { enabled: true, bits: 4, downsample: 8, mix: 1 },
    filter: { enabled: true, highpass: 200, lowpass: 12000, resonance: 0.71 },
  }],
  ['popstar', '🎤', 'Popstar (autotune)', 'Popstar (autotune)', 'Correzione intonazione istantanea, effetto hit radiofonica.', 'Instant pitch correction, radio-hit style.', {
    gate: { enabled: true, threshold: -50 },
    autotune: { enabled: true, key: 0, scale: 'major', speed: 0 },
    eq: eq({ 0: { freq: 100 }, 5: { gain: 3 }, 6: { gain: 2 } }),
    compressor: comp(-24, 4, 5),
    delay: { enabled: true, time: 250, feedback: 0.25, tone: 6000, mix: 0.15 },
    reverb: { enabled: true, type: 'plate', decay: 1.5, preDelay: 10, mix: 0.2 },
  }],
  ['legion', '🧑‍🤝‍🧑', 'Legione', 'Legion', 'Un coro di voci che parlano insieme.', 'A choir of voices speaking as one.', {
    pitch: { enabled: true, mode: 'hq', semitones: -2, preserveFormants: true },
    harmonizer: { enabled: true, voice1: -5, level1: 0.45, voice2: 7, level2: 0.35 },
    modulation: { enabled: true, type: 'chorus', rate: 0.8, depth: 1, mix: 0.6 },
    reverb: { enabled: true, type: 'hall', decay: 3, preDelay: 20, mix: 0.35 },
  }],
  ['whisper', '🤫', 'Sussurro', 'Whisper', 'Trasforma qualsiasi voce in un sussurro.', 'Turns any voice into a whisper.', {
    gate: { enabled: true, threshold: -50 },
    vocoder: { enabled: true, carrier: 'noise', note: 45, mix: 1 },
    eq: eq({ 0: { freq: 300 }, 6: { gain: 3 } }),
    reverb: { enabled: true, type: 'room', decay: 0.8, preDelay: 5, mix: 0.1 },
  }],
  ['canyon', '🏜️', 'Eco nel canyon', 'Canyon echo', 'Ogni parola torna indietro più volte.', 'Every word comes back again and again.', {
    delay: { enabled: true, time: 450, feedback: 0.55, tone: 3500, mix: 0.45 },
    reverb: { enabled: true, type: 'hall', decay: 2, preDelay: 20, mix: 0.15 },
  }],
];

const ENV: Def[] = [
  ['telephone', '☎️', 'Telefono', 'Telephone', 'Banda stretta e qualità da linea telefonica.', 'Narrow band, phone-line quality.', {
    filter: { enabled: true, highpass: 400, lowpass: 3400, resonance: 1.2 },
    bitcrusher: { enabled: true, bits: 12, downsample: 6, mix: 1 },
    distortion: { enabled: true, type: 'soft', drive: 0.15, tone: 3400, mix: 0.5 },
    compressor: comp(-24, 4, 4),
  }],
  ['walkie-talkie', '📟', 'Walkie-talkie', 'Walkie-talkie', 'Gracchiante, con fruscio e "kshh" a fine frase.', 'Crackly, with static and a "kshh" at the end.', {
    gate: { enabled: true, threshold: -45 },
    filter: { enabled: true, highpass: 600, lowpass: 3000, resonance: 2 },
    distortion: { enabled: true, type: 'hard', drive: 0.35, tone: 3000, mix: 0.7 },
    bitcrusher: { enabled: true, bits: 10, downsample: 3, mix: 0.5 },
    compressor: comp(-26, 6, 6),
    noise: { enabled: true, type: 'static', level: 0.12, onlyWhileTalking: true, squelch: true },
  }],
  ['vintage-radio', '🕰️', "Radio d'epoca", 'Vintage radio', 'Come una trasmissione degli anni \'40.', 'Like a 1940s broadcast.', {
    filter: { enabled: true, highpass: 300, lowpass: 4500, resonance: 1.5 },
    distortion: { enabled: true, type: 'tube', drive: 0.25, tone: 4500, mix: 0.5 },
    eq: eq({ 4: { freq: 1500, gain: 4 } }),
    noise: { enabled: true, type: 'vinyl', level: 0.25 },
    reverb: { enabled: true, type: 'room', decay: 0.4, preDelay: 2, mix: 0.08 },
  }],
  ['megaphone', '📢', 'Megafono', 'Megaphone', 'Forte, distorto e metallico.', 'Loud, distorted and tinny.', {
    filter: { enabled: true, highpass: 700, lowpass: 4000, resonance: 3 },
    distortion: { enabled: true, type: 'hard', drive: 0.55, tone: 4000, mix: 0.85 },
    compressor: comp(-30, 8, 6, 2, 100),
    delay: { enabled: true, time: 90, feedback: 0.15, tone: 3000, mix: 0.15 },
  }],
  ['airport', '✈️', 'Altoparlante aeroporto', 'Airport PA', 'Annuncio in un grande terminal.', 'Announcement in a large terminal.', {
    filter: { enabled: true, highpass: 350, lowpass: 6000, resonance: 1 },
    eq: eq({ 5: { freq: 2500, gain: 3 } }),
    compressor: comp(-26, 5, 5),
    delay: { enabled: true, time: 200, feedback: 0.2, tone: 4000, mix: 0.1 },
    reverb: { enabled: true, type: 'hall', decay: 2.8, preDelay: 40, mix: 0.35 },
  }],
  ['pilot', '👨‍✈️', "Pilota d'aereo", 'Airline pilot', 'Interfono di cabina con il rombo dei motori.', 'Cabin intercom with engine rumble.', {
    filter: { enabled: true, highpass: 500, lowpass: 3800, resonance: 1.5 },
    distortion: { enabled: true, type: 'soft', drive: 0.25, tone: 3800, mix: 0.5 },
    compressor: comp(-28, 8, 7),
    noise: { enabled: true, type: 'rumble', level: 0.25 },
  }],
  ['bathroom', '🚿', 'Bagno', 'Bathroom', 'Piastrelle ovunque: piccolo e brillante.', 'Tiles everywhere: small and bright.', {
    reverb: { enabled: true, type: 'bathroom', decay: 1, preDelay: 2, mix: 0.35 },
    eq: eq({ 4: { freq: 1000, gain: 2 } }),
  }],
  ['cave', '🦇', 'Caverna', 'Cave', 'Profonda e piena di echi.', 'Deep and full of echoes.', {
    reverb: { enabled: true, type: 'cave', decay: 4, preDelay: 25, mix: 0.45 },
    delay: { enabled: true, time: 320, feedback: 0.35, tone: 2500, mix: 0.2 },
    eq: eq({ 6: { gain: -3 } }),
  }],
  ['cathedral', '⛪', 'Cattedrale', 'Cathedral', 'Riverbero lunghissimo sotto le navate.', 'Very long reverb under the vaults.', {
    reverb: { enabled: true, type: 'cathedral', decay: 6, preDelay: 40, mix: 0.5 },
  }],
  ['stadium', '🏟️', 'Stadio', 'Stadium', 'In mezzo al campo, rimbalzi dalle tribune.', 'Mid-pitch, bouncing off the stands.', {
    reverb: { enabled: true, type: 'stadium', decay: 4, preDelay: 60, mix: 0.4 },
    delay: { enabled: true, time: 380, feedback: 0.3, tone: 3000, mix: 0.25 },
    noise: { enabled: true, type: 'rumble', level: 0.08 },
  }],
];

function build(category: PresetCategory, defs: Def[]): VoicePreset[] {
  return defs.map(([id, icon, it, en, descIt, descEn, params]) => ({
    id,
    icon,
    category,
    name: { it, en },
    description: { it: descIt, en: descEn },
    params,
    version: PARAMS_VERSION,
    builtin: true,
  }));
}

export const NEUTRAL_PRESET: VoicePreset = {
  id: 'neutral',
  icon: '⭕',
  category: 'pro',
  name: { it: 'Nessun effetto', en: 'No effect' },
  description: { it: 'La tua voce, senza modifiche.', en: 'Your voice, untouched.' },
  params: {},
  version: PARAMS_VERSION,
  builtin: true,
};

export const BUILTIN_PRESETS: VoicePreset[] = [
  NEUTRAL_PRESET,
  ...build('pro', PRO),
  ...build('fun', FUN),
  ...build('env', ENV),
];
