import { GranularShifter } from './granularShifter';
import { PhaseVocoder } from './phaseVocoder';
import { type ScaleName, freqToMidi, snapToScale } from './scales';
import { type PitchEstimate, Yin } from './yin';

export type PitchMode = 'fast' | 'hq';

export interface PitchSettings {
  mode: PitchMode;
  semitones: number;
  /** Formant shift in semitones (HQ mode only). */
  formant: number;
  /** Keep formants in place while the pitch moves (HQ mode only). */
  preserveFormants: boolean;
  autotune: boolean;
  key: number;
  scale: ScaleName;
  /** 0 = instant hard correction, 1 = slow and natural. */
  speed: number;
}

export const DEFAULT_PITCH_SETTINGS: PitchSettings = {
  mode: 'hq',
  semitones: 0,
  formant: 0,
  preserveFormants: true,
  autotune: false,
  key: 0,
  scale: 'chromatic',
  speed: 0.2,
};

const DETECT_SIZE = 2048;
const DETECT_HOP = 512;

/**
 * Pitch shift + formant control + pitch correction, plus continuous pitch detection of the
 * input (for the UI readout and for autotune). Crossfades to the dry signal when no shift is
 * requested, which avoids the comb filtering of the granular shifter at ratio 1.
 */
export class PitchEngine {
  settings: PitchSettings = { ...DEFAULT_PITCH_SETTINGS };
  detected: PitchEstimate = { freq: 0, clarity: 0 };
  correction = 0;

  private readonly sr: number;
  private readonly fast: GranularShifter;
  private readonly hq: PhaseVocoder;
  private readonly yin = new Yin(DETECT_SIZE / 4 + 1);
  private readonly history = new Float32Array(DETECT_SIZE);
  private readonly decimated = new Float32Array(DETECT_SIZE / 2);
  private historyPos = 0;
  private sinceDetect = 0;
  private wetGain = 0;
  private scratch = new Float32Array(128);

  constructor(sampleRate: number) {
    this.sr = sampleRate;
    this.fast = new GranularShifter(sampleRate);
    this.hq = new PhaseVocoder(sampleRate, sampleRate > 60000 ? 4096 : 2048);
  }

  get latencySamples(): number {
    if (this.isIdentity()) return 0;
    return this.settings.mode === 'hq' ? this.hq.latency : this.fast.latency;
  }

  set(next: Partial<PitchSettings>): void {
    const prevMode = this.settings.mode;
    this.settings = { ...this.settings, ...next };
    if (this.settings.mode !== prevMode) {
      if (this.settings.mode === 'hq') this.hq.reset();
      else this.fast.reset();
    }
  }

  isIdentity(): boolean {
    const s = this.settings;
    return s.semitones === 0 && !s.autotune && (s.mode === 'fast' || s.formant === 0);
  }

  process(input: Float32Array, output: Float32Array): void {
    this.track(input);
    const s = this.settings;
    const semis = s.semitones + (s.autotune ? this.correction : 0);
    const ratio = Math.pow(2, semis / 12);

    if (this.scratch.length < input.length) this.scratch = new Float32Array(input.length);
    const wet = this.scratch;
    if (s.mode === 'hq') {
      const formantFactor = Math.pow(2, s.formant / 12);
      this.hq.ratio = ratio;
      this.hq.envRatio = s.preserveFormants ? formantFactor : ratio * formantFactor;
      this.hq.process(input, wet);
    } else {
      this.fast.setRatio(ratio);
      this.fast.process(input, wet);
    }

    const target = this.isIdentity() ? 0 : 1;
    const step = 1 / (0.02 * this.sr);
    for (let i = 0; i < input.length; i++) {
      if (this.wetGain < target) this.wetGain = Math.min(target, this.wetGain + step);
      else if (this.wetGain > target) this.wetGain = Math.max(target, this.wetGain - step);
      output[i] = wet[i] * this.wetGain + input[i] * (1 - this.wetGain);
    }
  }

  /** Pitch detection only (used while the module is bypassed, for the UI readout). */
  analyze(input: Float32Array): void {
    this.track(input);
  }

  private track(input: Float32Array): void {
    const h = this.history;
    for (let i = 0; i < input.length; i++) {
      h[this.historyPos] = input[i];
      this.historyPos = (this.historyPos + 1) % DETECT_SIZE;
    }
    this.sinceDetect += input.length;
    if (this.sinceDetect < DETECT_HOP) return;
    this.sinceDetect = 0;

    const d = this.decimated;
    for (let i = 0; i < d.length; i++) {
      const a = h[(this.historyPos + 2 * i) % DETECT_SIZE];
      const b = h[(this.historyPos + 2 * i + 1) % DETECT_SIZE];
      d[i] = (a + b) * 0.5;
    }
    this.detected = this.yin.detect(d, this.sr / 2, 60, 1000, 0.2);

    const s = this.settings;
    if (!s.autotune || this.detected.freq <= 0) return;
    const sung = freqToMidi(this.detected.freq) + s.semitones;
    const target = snapToScale(sung, s.key, s.scale) - sung;
    const tau = 0.002 + s.speed * 0.3;
    const coef = 1 - Math.exp(-DETECT_HOP / this.sr / tau);
    this.correction += (target - this.correction) * coef;
  }
}
