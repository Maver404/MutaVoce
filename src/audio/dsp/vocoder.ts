import { Biquad, biquadCoefs } from './biquad';
import { midiToFreq } from './scales';

export type CarrierType = 'saw' | 'square' | 'chord' | 'noise';

/**
 * Channel vocoder: the voice (modulator) is split into log-spaced bands whose envelopes
 * shape the same bands of an internal carrier. Noise carrier = whisper, saw/chord = robot.
 */
export class Vocoder {
  carrier: CarrierType = 'saw';
  private readonly sr: number;
  private readonly modBands: Biquad[] = [];
  private readonly carBands: Biquad[] = [];
  private readonly env: Float32Array;
  private readonly sibilance: Biquad;
  private readonly atk: number;
  private readonly rel: number;
  private phases = [0, 0, 0, 0];
  private freq = 110;
  private noiseSeed = 22222;

  constructor(sampleRate: number, bandCount = 20, lowHz = 110, highHz = 7500) {
    this.sr = sampleRate;
    const ratio = Math.pow(highHz / lowHz, 1 / (bandCount - 1));
    for (let i = 0; i < bandCount; i++) {
      const fc = lowHz * Math.pow(ratio, i);
      const c = biquadCoefs('bandpass', fc, 6, 0, sampleRate);
      this.modBands.push(new Biquad(c));
      this.carBands.push(new Biquad({ ...c }));
    }
    this.env = new Float32Array(bandCount);
    this.sibilance = new Biquad(biquadCoefs('highpass', 6500, 0.7, 0, sampleRate));
    this.atk = Math.exp(-1 / (0.004 * sampleRate));
    this.rel = Math.exp(-1 / (0.03 * sampleRate));
  }

  setNote(midi: number): void {
    this.freq = midiToFreq(midi);
  }

  process(input: Float32Array, output: Float32Array): void {
    const bands = this.modBands.length;
    const env = this.env;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const car = this.carrierSample();
      let y = 0;
      for (let b = 0; b < bands; b++) {
        const m = Math.abs(this.modBands[b].process(x));
        const e = env[b];
        env[b] = m > e ? this.atk * e + (1 - this.atk) * m : this.rel * e + (1 - this.rel) * m;
        y += this.carBands[b].process(car) * env[b];
      }
      output[i] = y * 9 + this.sibilance.process(x) * 0.35;
    }
  }

  private carrierSample(): number {
    switch (this.carrier) {
      case 'noise':
        return this.noise() * 0.9;
      case 'square':
        return this.osc(0, this.freq) > 0 ? 0.6 : -0.6;
      case 'chord':
        return (
          (this.osc(0, this.freq) + this.osc(1, this.freq * 1.2599) + this.osc(2, this.freq * 1.4983) + this.osc(3, this.freq * 2)) *
          0.32
        );
      default:
        return this.osc(0, this.freq) + this.noise() * 0.04;
    }
  }

  /** Naive saw in [-1, 1]; aliasing is masked by the band filters. */
  private osc(i: number, hz: number): number {
    let p = this.phases[i] + hz / this.sr;
    if (p >= 1) p -= 1;
    this.phases[i] = p;
    return 2 * p - 1;
  }

  private noise(): number {
    this.noiseSeed = (this.noiseSeed * 1664525 + 1013904223) >>> 0;
    return this.noiseSeed / 2147483648 - 1;
  }
}
