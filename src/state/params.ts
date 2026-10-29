import type { BiquadType } from '../audio/dsp/biquad';
import type { PitchMode } from '../audio/dsp/pitchEngine';
import type { ScaleName } from '../audio/dsp/scales';
import type { CarrierType } from '../audio/dsp/vocoder';

export const PARAMS_VERSION = 1;

export type DistortionType = 'soft' | 'hard' | 'fuzz' | 'tube';
export type ModulationType = 'chorus' | 'flanger' | 'vibrato' | 'tremolo';
export type ReverbType = 'room' | 'bathroom' | 'hall' | 'cathedral' | 'cave' | 'plate' | 'stadium';
export type NoiseType = 'static' | 'vinyl' | 'hum' | 'rumble';

export interface EqBand {
  type: BiquadType;
  freq: number;
  gain: number;
  q: number;
}

export interface VoiceParams {
  gate: { enabled: boolean; threshold: number; attack: number; release: number };
  pitch: { enabled: boolean; mode: PitchMode; semitones: number; formant: number; preserveFormants: boolean };
  autotune: { enabled: boolean; key: number; scale: ScaleName; speed: number };
  harmonizer: { enabled: boolean; voice1: number; level1: number; voice2: number; level2: number };
  ringmod: { enabled: boolean; frequency: number; lfoRate: number; lfoDepth: number; mix: number };
  vocoder: { enabled: boolean; carrier: CarrierType; note: number; mix: number };
  distortion: { enabled: boolean; type: DistortionType; drive: number; tone: number; mix: number };
  bitcrusher: { enabled: boolean; bits: number; downsample: number; mix: number };
  filter: { enabled: boolean; highpass: number; lowpass: number; resonance: number; lfoRate: number; lfoDepth: number };
  eq: { enabled: boolean; bands: EqBand[] };
  compressor: { enabled: boolean; threshold: number; ratio: number; attack: number; release: number; makeup: number };
  modulation: { enabled: boolean; type: ModulationType; rate: number; depth: number; feedback: number; mix: number };
  delay: { enabled: boolean; time: number; feedback: number; tone: number; mix: number };
  reverb: { enabled: boolean; type: ReverbType; decay: number; preDelay: number; mix: number };
  noise: { enabled: boolean; type: NoiseType; level: number; onlyWhileTalking: boolean; squelch: boolean };
  master: { gain: number };
}

export type ModuleId = Exclude<keyof VoiceParams, 'master'>;

/** Rack order = signal-chain order. */
export const MODULE_ORDER: ModuleId[] = [
  'gate',
  'pitch',
  'autotune',
  'harmonizer',
  'ringmod',
  'vocoder',
  'distortion',
  'bitcrusher',
  'filter',
  'eq',
  'compressor',
  'modulation',
  'delay',
  'reverb',
  'noise',
];

export type PresetParams = { [K in keyof VoiceParams]?: Partial<VoiceParams[K]> };

export const DEFAULT_EQ_BANDS: EqBand[] = [
  { type: 'highpass', freq: 30, gain: 0, q: 0.71 },
  { type: 'lowshelf', freq: 120, gain: 0, q: 0.71 },
  { type: 'peaking', freq: 300, gain: 0, q: 1 },
  { type: 'peaking', freq: 700, gain: 0, q: 1 },
  { type: 'peaking', freq: 1600, gain: 0, q: 1 },
  { type: 'peaking', freq: 3500, gain: 0, q: 1 },
  { type: 'highshelf', freq: 8000, gain: 0, q: 0.71 },
  { type: 'lowpass', freq: 19000, gain: 0, q: 0.71 },
];

export const DEFAULT_PARAMS: VoiceParams = {
  gate: { enabled: false, threshold: -50, attack: 3, release: 150 },
  pitch: { enabled: false, mode: 'hq', semitones: 0, formant: 0, preserveFormants: true },
  autotune: { enabled: false, key: 0, scale: 'chromatic', speed: 0.2 },
  harmonizer: { enabled: false, voice1: -12, level1: 0.5, voice2: 7, level2: 0 },
  ringmod: { enabled: false, frequency: 60, lfoRate: 0, lfoDepth: 0, mix: 1 },
  vocoder: { enabled: false, carrier: 'saw', note: 45, mix: 1 },
  distortion: { enabled: false, type: 'soft', drive: 0.4, tone: 5000, mix: 1 },
  bitcrusher: { enabled: false, bits: 8, downsample: 4, mix: 1 },
  filter: { enabled: false, highpass: 20, lowpass: 20000, resonance: 0.71, lfoRate: 0, lfoDepth: 0 },
  eq: { enabled: false, bands: DEFAULT_EQ_BANDS },
  compressor: { enabled: false, threshold: -24, ratio: 4, attack: 5, release: 120, makeup: 4 },
  modulation: { enabled: false, type: 'chorus', rate: 0.8, depth: 0.5, feedback: 0, mix: 0.5 },
  delay: { enabled: false, time: 300, feedback: 0.35, tone: 6000, mix: 0.3 },
  reverb: { enabled: false, type: 'hall', decay: 2.2, preDelay: 15, mix: 0.3 },
  noise: { enabled: false, type: 'static', level: 0.15, onlyWhileTalking: false, squelch: false },
  master: { gain: 0 },
};

export interface NumberMeta {
  min: number;
  max: number;
  step: number;
  unit?: 'dB' | 'Hz' | 'ms' | 's' | 'st' | '%' | 'x' | 'bit' | ':1';
  log?: boolean;
}

/** Ranges for every numeric parameter, keyed "module.param". Shared by the UI and sanitiser. */
export const PARAM_META: Record<string, NumberMeta> = {
  'gate.threshold': { min: -80, max: -10, step: 1, unit: 'dB' },
  'gate.attack': { min: 0.5, max: 50, step: 0.5, unit: 'ms' },
  'gate.release': { min: 20, max: 1000, step: 5, unit: 'ms', log: true },
  'pitch.semitones': { min: -24, max: 24, step: 0.5, unit: 'st' },
  'pitch.formant': { min: -12, max: 12, step: 0.5, unit: 'st' },
  'autotune.key': { min: 0, max: 11, step: 1 },
  'autotune.speed': { min: 0, max: 1, step: 0.01, unit: '%' },
  'harmonizer.voice1': { min: -24, max: 24, step: 1, unit: 'st' },
  'harmonizer.level1': { min: 0, max: 1, step: 0.01, unit: '%' },
  'harmonizer.voice2': { min: -24, max: 24, step: 1, unit: 'st' },
  'harmonizer.level2': { min: 0, max: 1, step: 0.01, unit: '%' },
  'ringmod.frequency': { min: 1, max: 2000, step: 1, unit: 'Hz', log: true },
  'ringmod.lfoRate': { min: 0, max: 20, step: 0.1, unit: 'Hz' },
  'ringmod.lfoDepth': { min: 0, max: 500, step: 1, unit: 'Hz' },
  'ringmod.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'vocoder.note': { min: 24, max: 72, step: 1 },
  'vocoder.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'distortion.drive': { min: 0, max: 1, step: 0.01, unit: '%' },
  'distortion.tone': { min: 500, max: 16000, step: 10, unit: 'Hz', log: true },
  'distortion.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'bitcrusher.bits': { min: 1, max: 16, step: 1, unit: 'bit' },
  'bitcrusher.downsample': { min: 1, max: 40, step: 1, unit: 'x' },
  'bitcrusher.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'filter.highpass': { min: 20, max: 3000, step: 1, unit: 'Hz', log: true },
  'filter.lowpass': { min: 300, max: 20000, step: 10, unit: 'Hz', log: true },
  'filter.resonance': { min: 0.5, max: 15, step: 0.01, log: true },
  'filter.lfoRate': { min: 0, max: 10, step: 0.05, unit: 'Hz' },
  'filter.lfoDepth': { min: 0, max: 1, step: 0.01, unit: '%' },
  'eq.freq': { min: 20, max: 20000, step: 1, unit: 'Hz', log: true },
  'eq.gain': { min: -24, max: 24, step: 0.1, unit: 'dB' },
  'eq.q': { min: 0.1, max: 18, step: 0.01, log: true },
  'compressor.threshold': { min: -60, max: 0, step: 1, unit: 'dB' },
  'compressor.ratio': { min: 1, max: 20, step: 0.1, unit: ':1', log: true },
  'compressor.attack': { min: 0.5, max: 100, step: 0.5, unit: 'ms', log: true },
  'compressor.release': { min: 20, max: 1000, step: 5, unit: 'ms', log: true },
  'compressor.makeup': { min: 0, max: 24, step: 0.5, unit: 'dB' },
  'modulation.rate': { min: 0.05, max: 12, step: 0.05, unit: 'Hz', log: true },
  'modulation.depth': { min: 0, max: 1, step: 0.01, unit: '%' },
  'modulation.feedback': { min: 0, max: 0.95, step: 0.01, unit: '%' },
  'modulation.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'delay.time': { min: 10, max: 1500, step: 1, unit: 'ms', log: true },
  'delay.feedback': { min: 0, max: 0.95, step: 0.01, unit: '%' },
  'delay.tone': { min: 500, max: 16000, step: 10, unit: 'Hz', log: true },
  'delay.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'reverb.decay': { min: 0.2, max: 10, step: 0.1, unit: 's', log: true },
  'reverb.preDelay': { min: 0, max: 200, step: 1, unit: 'ms' },
  'reverb.mix': { min: 0, max: 1, step: 0.01, unit: '%' },
  'noise.level': { min: 0, max: 1, step: 0.01, unit: '%' },
  'master.gain': { min: -24, max: 12, step: 0.5, unit: 'dB' },
};

export const ENUMS: Record<string, readonly string[]> = {
  'pitch.mode': ['fast', 'hq'],
  'autotune.scale': ['chromatic', 'major', 'minor', 'pentatonic', 'blues'],
  'vocoder.carrier': ['saw', 'square', 'chord', 'noise'],
  'distortion.type': ['soft', 'hard', 'fuzz', 'tube'],
  'modulation.type': ['chorus', 'flanger', 'vibrato', 'tremolo'],
  'reverb.type': ['room', 'bathroom', 'hall', 'cathedral', 'cave', 'plate', 'stadium'],
  'noise.type': ['static', 'vinyl', 'hum', 'rumble'],
  'eq.type': ['highpass', 'lowshelf', 'peaking', 'notch', 'bandpass', 'highshelf', 'lowpass'],
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function sanitizeBand(raw: unknown, fallback: EqBand): EqBand {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (key: 'freq' | 'gain' | 'q') => {
    const meta = PARAM_META[`eq.${key}`];
    const v = b[key];
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, meta.min, meta.max) : fallback[key];
  };
  const type = typeof b.type === 'string' && ENUMS['eq.type'].includes(b.type) ? (b.type as BiquadType) : fallback.type;
  return { type, freq: num('freq'), gain: num('gain'), q: num('q') };
}

/**
 * Merge anything (a preset, an imported file, stored state) over the defaults, keeping only
 * known keys with the right type and clamping numbers to their ranges.
 */
export function sanitizeParams(raw: unknown, base: VoiceParams = DEFAULT_PARAMS): VoiceParams {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const out = structuredClone(base) as unknown as Record<string, Record<string, unknown>>;
  for (const mod of Object.keys(base) as (keyof VoiceParams)[]) {
    const incoming = src[mod];
    if (!incoming || typeof incoming !== 'object') continue;
    const target = out[mod];
    for (const key of Object.keys(target)) {
      const value = incoming[key];
      if (value === undefined) continue;
      const path = `${mod}.${key}`;
      const current = target[key];
      if (mod === 'eq' && key === 'bands') {
        if (Array.isArray(value)) {
          const fallback = base.eq.bands;
          target.bands = fallback.map((fb, i) => sanitizeBand(value[i], fb));
        }
      } else if (typeof current === 'boolean') {
        if (typeof value === 'boolean') target[key] = value;
      } else if (typeof current === 'number') {
        const meta = PARAM_META[path];
        if (typeof value === 'number' && Number.isFinite(value)) target[key] = meta ? clamp(value, meta.min, meta.max) : value;
      } else if (typeof current === 'string') {
        if (typeof value === 'string' && (!ENUMS[path] || ENUMS[path].includes(value))) target[key] = value;
      }
    }
  }
  return out as unknown as VoiceParams;
}

/** Default params with a preset applied on top. */
export function paramsFromPreset(p: PresetParams): VoiceParams {
  return sanitizeParams(p, DEFAULT_PARAMS);
}

export function isModuleActive(params: VoiceParams, id: ModuleId): boolean {
  return params[id].enabled;
}
