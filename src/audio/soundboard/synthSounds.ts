/** Procedurally generated soundboard effects (no samples shipped, no licensing issues). */

export type BuiltinSoundId =
  | 'airhorn'
  | 'applause'
  | 'drumroll'
  | 'rimshot'
  | 'sadTrombone'
  | 'ding'
  | 'buzzer'
  | 'laser'
  | 'boing'
  | 'crickets'
  | 'siren'
  | 'coin';

export const BUILTIN_SOUNDS: { id: BuiltinSoundId; icon: string; it: string; en: string }[] = [
  { id: 'airhorn', icon: '📯', it: 'Trombetta', en: 'Air horn' },
  { id: 'applause', icon: '👏', it: 'Applausi', en: 'Applause' },
  { id: 'drumroll', icon: '🥁', it: 'Rullo', en: 'Drum roll' },
  { id: 'rimshot', icon: '😆', it: 'Ba-dum-tss', en: 'Ba-dum-tss' },
  { id: 'sadTrombone', icon: '😢', it: 'Trombone triste', en: 'Sad trombone' },
  { id: 'ding', icon: '✅', it: 'Giusto!', en: 'Correct!' },
  { id: 'buzzer', icon: '❌', it: 'Sbagliato!', en: 'Wrong!' },
  { id: 'laser', icon: '🔫', it: 'Laser', en: 'Laser' },
  { id: 'boing', icon: '🌀', it: 'Boing', en: 'Boing' },
  { id: 'crickets', icon: '🦗', it: 'Grilli', en: 'Crickets' },
  { id: 'siren', icon: '🚨', it: 'Sirena', en: 'Siren' },
  { id: 'coin', icon: '🪙', it: 'Moneta', en: 'Coin' },
];

type Builder = (ctx: OfflineAudioContext, out: AudioNode) => void;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(seed);
  for (let i = 0; i < d.length; i++) d[i] = r();
  return b;
}

function env(g: AudioParam, t: number, attack: number, hold: number, release: number, peak = 1) {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.setValueAtTime(peak, t + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function tone(ctx: OfflineAudioContext, out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, peak = 0.3) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  env(g.gain, t, 0.005, dur * 0.6, dur * 0.4, peak);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseHit(ctx: OfflineAudioContext, out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, seed: number) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, dur + 0.05, seed);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  env(g.gain, t, 0.002, 0, dur, peak);
  s.connect(f).connect(g).connect(out);
  s.start(t);
}

const BUILDERS: Record<BuiltinSoundId, [number, Builder]> = {
  airhorn: [
    1.4,
    (ctx, out) => {
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 3);
      shaper.curve = curve;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 0.6;
      shaper.connect(bp).connect(out);
      const blasts: [number, number][] = [[0, 0.14], [0.2, 0.14], [0.4, 0.9]];
      for (const [t, d] of blasts) {
        for (const f of [466, 470, 233]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f, t);
          o.frequency.linearRampToValueAtTime(f * 0.97, t + d);
          const g = ctx.createGain();
          env(g.gain, t, 0.01, d * 0.8, d * 0.2 + 0.03, 0.22);
          o.connect(g).connect(shaper);
          o.start(t);
          o.stop(t + d + 0.1);
        }
      }
    },
  ],
  applause: [
    3.2,
    (ctx, out) => {
      const b = ctx.createBuffer(2, Math.ceil(3.2 * ctx.sampleRate), ctx.sampleRate);
      const r = rng(7);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let c = 0; c < 900; c++) {
          const t = Math.pow((r() + 1) / 2, 0.8) * 2.9;
          const start = Math.floor(t * ctx.sampleRate);
          const len = Math.floor((0.004 + ((r() + 1) / 2) * 0.012) * ctx.sampleRate);
          const amp = (0.2 + ((r() + 1) / 2) * 0.3) * Math.min(1, t / 0.3) * Math.min(1, (3.0 - t) / 0.8);
          let lp = 0;
          for (let i = 0; i < len && start + i < d.length; i++) {
            lp = lp * 0.4 + r() * 0.6;
            d[start + i] += (r() - lp * 0.5) * amp * Math.exp(-i / (len * 0.3));
          }
        }
      }
      const s = ctx.createBufferSource();
      s.buffer = b;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.5;
      s.connect(f).connect(out);
      s.start();
    },
  ],
  drumroll: [
    3.2,
    (ctx, out) => {
      for (let i = 0, t = 0; t < 1.8; i++, t += 0.032) {
        noiseHit(ctx, out, t, 0.06, 'bandpass', 2200, 0.08 + (t / 1.8) * 0.35, i + 1);
      }
      noiseHit(ctx, out, 1.85, 0.18, 'lowpass', 400, 0.8, 99);
      noiseHit(ctx, out, 1.85, 1.3, 'highpass', 5000, 0.6, 123);
    },
  ],
  rimshot: [
    1.6,
    (ctx, out) => {
      const tom = (t: number, f0: number, f1: number) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + 0.18);
        const g = ctx.createGain();
        env(g.gain, t, 0.002, 0.02, 0.2, 0.7);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.3);
        noiseHit(ctx, out, t, 0.05, 'bandpass', 1500, 0.15, Math.round(t * 100) + 3);
      };
      tom(0, 220, 140);
      tom(0.18, 160, 100);
      noiseHit(ctx, out, 0.45, 1.0, 'highpass', 7000, 0.5, 77);
      noiseHit(ctx, out, 0.45, 0.08, 'bandpass', 3000, 0.3, 78);
    },
  ],
  sadTrombone: [
    3.0,
    (ctx, out) => {
      const notes: [number, number, number][] = [
        [196.0, 0, 0.42],
        [185.0, 0.45, 0.42],
        [174.6, 0.9, 0.42],
        [164.8, 1.35, 1.4],
      ];
      for (const [f, t, d] of notes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t);
        if (d > 1) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 5.5;
          const lg = ctx.createGain();
          lg.gain.setValueAtTime(0, t);
          lg.gain.linearRampToValueAtTime(6, t + 0.5);
          lfo.connect(lg).connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + d + 0.1);
        }
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 4;
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.linearRampToValueAtTime(1400, t + 0.15);
        lp.frequency.linearRampToValueAtTime(600, t + d);
        const g = ctx.createGain();
        env(g.gain, t, 0.04, d * 0.7, d * 0.3, 0.35);
        o.connect(lp).connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.1);
      }
    },
  ],
  ding: [
    1.6,
    (ctx, out) => {
      for (const [f, t] of [[1046.5, 0], [1318.5, 0.14]] as const) {
        for (const [mult, amp] of [[1, 0.35], [2.76, 0.08], [5.4, 0.03]] as const) {
          const o = ctx.createOscillator();
          o.frequency.value = f * mult;
          const g = ctx.createGain();
          env(g.gain, t, 0.002, 0, 1.2 / mult, amp);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 1.4);
        }
      }
    },
  ],
  buzzer: [
    1.0,
    (ctx, out) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      lp.connect(out);
      tone(ctx, lp, 'square', 110, 0, 0.85, 0.18);
      tone(ctx, lp, 'sawtooth', 116.5, 0, 0.85, 0.15);
    },
  ],
  laser: [
    0.7,
    (ctx, out) => {
      for (const t of [0, 0.28]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(2200, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.24);
        const g = ctx.createGain();
        env(g.gain, t, 0.003, 0.1, 0.14, 0.18);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.3);
      }
    },
  ],
  boing: [
    1.0,
    (ctx, out) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(140, 0);
      o.frequency.exponentialRampToValueAtTime(420, 0.08);
      o.frequency.exponentialRampToValueAtTime(260, 0.9);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 14;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(90, 0);
      lg.gain.exponentialRampToValueAtTime(2, 0.9);
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      env(g.gain, 0, 0.005, 0.1, 0.8, 0.5);
      o.connect(g).connect(out);
      o.start();
      lfo.start();
      o.stop(1);
      lfo.stop(1);
    },
  ],
  crickets: [
    3.0,
    (ctx, out) => {
      const cricket = (freq: number, offset: number, pan: number) => {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        p.connect(out);
        for (let c = 0; c < 4; c++) {
          const t0 = offset + c * 0.7;
          for (let k = 0; k < 4; k++) tone(ctx, p, 'sine', freq, t0 + k * 0.035, 0.022, 0.12);
        }
      };
      cricket(4400, 0.05, -0.5);
      cricket(4750, 0.4, 0.5);
    },
  ],
  siren: [
    2.6,
    (ctx, out) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(650, 0);
      for (let i = 0; i < 2; i++) {
        o.frequency.linearRampToValueAtTime(1300, i * 1.2 + 0.6);
        o.frequency.linearRampToValueAtTime(650, i * 1.2 + 1.2);
      }
      const g = ctx.createGain();
      env(g.gain, 0, 0.05, 2.2, 0.3, 0.3);
      o.connect(g).connect(out);
      o.start();
      o.stop(2.6);
    },
  ],
  coin: [
    0.6,
    (ctx, out) => {
      tone(ctx, out, 'square', 987.8, 0, 0.08, 0.15);
      tone(ctx, out, 'square', 1318.5, 0.08, 0.4, 0.15);
    },
  ],
};

export async function renderBuiltinSound(id: BuiltinSoundId, sampleRate: number): Promise<AudioBuffer> {
  const [seconds, build] = BUILDERS[id];
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  build(ctx, master);
  return ctx.startRendering();
}
