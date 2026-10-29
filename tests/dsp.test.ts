import { describe, expect, it } from 'vitest';
import { FFT } from '../src/audio/dsp/fft';
import { GranularShifter } from '../src/audio/dsp/granularShifter';
import { PhaseVocoder } from '../src/audio/dsp/phaseVocoder';
import { Yin } from '../src/audio/dsp/yin';
import { snapToScale, noteName } from '../src/audio/dsp/scales';
import { biquadCoefs, biquadMagnitudeDb } from '../src/audio/dsp/biquad';
import { PitchEngine } from '../src/audio/dsp/pitchEngine';
import { NoiseGate, Bitcrusher } from '../src/audio/dsp/dynamics';
import { Vocoder } from '../src/audio/dsp/vocoder';
import { synthTestVoice } from '../src/audio/testVoice';

const SR = 48000;

function sine(hz: number, seconds: number, amp = 0.5): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

/** Harmonic-rich tone (saw-like) so formant/envelope processing has something to work with. */
function harmonic(hz: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let k = 1; k * hz < 8000; k++) {
    for (let i = 0; i < out.length; i++) out[i] += (0.3 / k) * Math.sin((2 * Math.PI * k * hz * i) / SR);
  }
  return out;
}

function runBlocks(input: Float32Array, fn: (inp: Float32Array, out: Float32Array) => void): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 128) {
    const end = Math.min(input.length, i + 128);
    fn(input.subarray(i, end), out.subarray(i, end));
  }
  return out;
}

function detect(buf: Float32Array): number {
  const tail = buf.subarray(buf.length - 4096);
  return new Yin(2048).detect(tail, SR, 50, 2000).freq;
}

function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

describe('FFT', () => {
  it('round-trips forward → inverse', () => {
    const fft = new FFT(256);
    const re = new Float32Array(256).map((_, i) => Math.sin(i * 0.3) + 0.2 * Math.cos(i * 1.7));
    const orig = re.slice();
    const im = new Float32Array(256);
    fft.forward(re, im);
    fft.inverse(re, im);
    for (let i = 0; i < 256; i++) expect(re[i]).toBeCloseTo(orig[i], 4);
  });

  it('puts a bin-centred sine in the right bin', () => {
    const fft = new FFT(1024);
    const re = new Float32Array(1024).map((_, i) => Math.sin((2 * Math.PI * 10 * i) / 1024));
    const im = new Float32Array(1024);
    fft.forward(re, im);
    const mags = Array.from({ length: 512 }, (_, k) => Math.hypot(re[k], im[k]));
    expect(mags.indexOf(Math.max(...mags))).toBe(10);
  });
});

describe('YIN', () => {
  it.each([82, 110, 220, 440, 880])('detects %d Hz', (hz) => {
    expect(detect(sine(hz, 0.2))).toBeCloseTo(hz, -0.5);
  });

  it('reports silence as unvoiced', () => {
    expect(new Yin().detect(new Float32Array(2048), SR).freq).toBe(0);
  });
});

describe('GranularShifter', () => {
  it('shifts 220 Hz up an octave', () => {
    const g = new GranularShifter(SR);
    g.setRatio(2);
    g.snap();
    const f = detect(runBlocks(sine(220, 1), (i, o) => g.process(i, o)));
    expect(f).toBeGreaterThan(430);
    expect(f).toBeLessThan(450);
  });

  it('shifts 440 Hz down a fifth', () => {
    const g = new GranularShifter(SR);
    g.setRatio(Math.pow(2, -7 / 12));
    g.snap();
    const f = detect(runBlocks(sine(440, 1), (i, o) => g.process(i, o)));
    // Grain crossfades bias a short YIN window slightly; allow ±3% (≈ half a semitone).
    expect(Math.abs(f / (440 * Math.pow(2, -7 / 12)) - 1)).toBeLessThan(0.03);
  });
});

describe('PhaseVocoder', () => {
  it('is close to identity at ratio 1 (unity gain)', () => {
    const pv = new PhaseVocoder(SR);
    const out = runBlocks(sine(300, 1), (i, o) => pv.process(i, o));
    const tail = out.subarray(out.length - 8192);
    expect(rms(tail)).toBeCloseTo(0.5 / Math.SQRT2, 1);
    expect(detect(out)).toBeCloseTo(300, -0.5);
  });

  it('shifts 220 Hz up an octave', () => {
    const pv = new PhaseVocoder(SR);
    pv.ratio = 2;
    pv.envRatio = 2;
    expect(detect(runBlocks(sine(220, 1), (i, o) => pv.process(i, o)))).toBeCloseTo(440, -0.5);
  });

  it('keeps the pitch shift when preserving formants', () => {
    const pv = new PhaseVocoder(SR);
    pv.ratio = 1.5;
    pv.envRatio = 1;
    const out = runBlocks(harmonic(150, 1), (i, o) => pv.process(i, o));
    expect(detect(out)).toBeCloseTo(225, -1);
    expect(rms(out.subarray(out.length - 8192))).toBeGreaterThan(0.05);
  });

  it('moves the spectral centroid with the formant ratio', () => {
    const centroid = (buf: Float32Array) => {
      const fft = new FFT(4096);
      const re = buf.slice(buf.length - 4096);
      const im = new Float32Array(4096);
      fft.forward(re, im);
      let num = 0;
      let den = 0;
      for (let k = 1; k < 2048; k++) {
        const m = Math.hypot(re[k], im[k]);
        num += k * m;
        den += m;
      }
      return num / den;
    };
    const src = harmonic(140, 1);
    const up = new PhaseVocoder(SR);
    up.ratio = 1;
    up.envRatio = 1.5;
    const down = new PhaseVocoder(SR);
    down.ratio = 1;
    down.envRatio = 0.7;
    const cu = centroid(runBlocks(src, (i, o) => up.process(i, o)));
    const cd = centroid(runBlocks(src, (i, o) => down.process(i, o)));
    expect(cu).toBeGreaterThan(cd * 1.3);
  });
});

describe('PitchEngine', () => {
  it('passes audio through untouched when no shift is requested', () => {
    const pe = new PitchEngine(SR);
    const input = sine(200, 0.2);
    const out = runBlocks(input, (i, o) => pe.process(i, o));
    for (let i = 0; i < input.length; i += 97) expect(out[i]).toBeCloseTo(input[i], 6);
    expect(pe.latencySamples).toBe(0);
  });

  it('detects the input pitch', () => {
    const pe = new PitchEngine(SR);
    runBlocks(sine(196, 0.5), (i, o) => pe.process(i, o));
    expect(pe.detected.freq).toBeCloseTo(196, -0.5);
  });

  it('autotune pulls a sharp note onto the scale', () => {
    const pe = new PitchEngine(SR);
    pe.set({ autotune: true, speed: 0, scale: 'chromatic', mode: 'fast' });
    // 450 Hz is ~ +39 cents above A4 → correction should be ≈ -0.39 semitones.
    runBlocks(sine(450, 1), (i, o) => pe.process(i, o));
    expect(pe.correction).toBeCloseTo(-0.39, 1);
  });
});

describe('scales', () => {
  it('snaps to the nearest scale degree', () => {
    expect(snapToScale(60.4, 0, 'major')).toBe(60);
    expect(snapToScale(61.2, 0, 'major')).toBe(62); // C#+ is closer to D than C
    expect(snapToScale(61.6, 0, 'major')).toBe(62);
    expect(snapToScale(66, 9, 'pentatonic')).toBe(66); // F# is in A pentatonic
    expect(noteName(69)).toBe('A4');
  });
});

describe('biquad response', () => {
  it('peaking filter hits its gain at the centre frequency', () => {
    const c = biquadCoefs('peaking', 1000, 1, 6, SR);
    expect(biquadMagnitudeDb(c, 1000, SR)).toBeCloseTo(6, 1);
    expect(biquadMagnitudeDb(c, 50, SR)).toBeCloseTo(0, 0);
  });

  it('highpass is -3 dB at cutoff with Butterworth Q', () => {
    const c = biquadCoefs('highpass', 200, Math.SQRT1_2, 0, SR);
    expect(biquadMagnitudeDb(c, 200, SR)).toBeCloseTo(-3, 0);
    expect(biquadMagnitudeDb(c, 20, SR)).toBeLessThan(-30);
  });

  it('shelves reach their gain far from the corner', () => {
    expect(biquadMagnitudeDb(biquadCoefs('lowshelf', 200, 1, 9, SR), 20, SR)).toBeCloseTo(9, 0);
    expect(biquadMagnitudeDb(biquadCoefs('highshelf', 5000, 1, -6, SR), 18000, SR)).toBeCloseTo(-6, 0);
  });
});

describe('dynamics', () => {
  it('gate closes on quiet input and opens on loud input', () => {
    const g = new NoiseGate(SR);
    g.thresholdDb = -40;
    const quiet = runBlocks(sine(200, 0.5, 0.001), (i, o) => g.process(i, o));
    expect(g.open).toBe(false);
    expect(rms(quiet.subarray(quiet.length - 4800))).toBeLessThan(1e-4);
    runBlocks(sine(200, 0.2, 0.3), (i, o) => g.process(i, o));
    expect(g.open).toBe(true);
  });

  it('bitcrusher quantises to the requested depth', () => {
    const b = new Bitcrusher();
    b.bits = 2;
    const out = runBlocks(sine(100, 0.05), (i, o) => b.process(i, o));
    const values = new Set(Array.from(out, (v) => v.toFixed(3)));
    expect(values.size).toBeLessThanOrEqual(5);
  });
});

describe('vocoder', () => {
  it('outputs signal only while the modulator is active', () => {
    const v = new Vocoder(SR);
    v.setNote(48);
    const loud = runBlocks(harmonic(150, 0.5), (i, o) => v.process(i, o));
    const silent = runBlocks(new Float32Array(SR / 2), (i, o) => v.process(i, o));
    expect(rms(loud)).toBeGreaterThan(0.02);
    expect(rms(silent.subarray(silent.length - 4800))).toBeLessThan(0.002);
  });
});

describe('test voice', () => {
  it('is voiced, normalised and in a male speaking range', () => {
    const voice = synthTestVoice(SR);
    expect(voice.length).toBeGreaterThan(SR * 3);
    let peak = 0;
    for (const s of voice) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeCloseTo(0.5, 2);
    const start = Math.round(0.24 * SR);
    const f = new Yin(2048).detect(voice.subarray(start, start + 2048), SR, 60, 400).freq;
    expect(f).toBeGreaterThan(90);
    expect(f).toBeLessThan(180);
  });
});
