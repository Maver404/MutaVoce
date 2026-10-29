import type { NoiseType } from '../state/params';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

/** 4-second loopable background beds. */
export function generateNoise(ctx: BaseAudioContext, type: NoiseType): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * 4;
  const buffer = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    const r = rng(1000 + ch * 77 + type.length);
    let a = 0;
    let b = 0;
    switch (type) {
      case 'static':
        for (let i = 0; i < len; i++) {
          const w = r();
          a = 0.7 * a + 0.3 * w; // gentle lowpass
          b = w - a; // and the highpass rest → hiss
          const crackle = r() > 0.9993 ? r() * 0.8 : 0;
          d[i] = (a * 0.35 + b * 0.25) * (0.8 + 0.2 * Math.sin(i / 900)) + crackle;
        }
        break;
      case 'vinyl':
        for (let i = 0; i < len; i++) {
          a = 0.96 * a + 0.04 * r();
          const pop = r() > 0.9996 ? r() * 0.9 : 0;
          const tick = r() > 0.995 ? r() * 0.12 : 0;
          d[i] = a * 0.6 + pop + tick;
        }
        break;
      case 'hum':
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          d[i] =
            0.4 * Math.sin(2 * Math.PI * 50 * t) +
            0.25 * Math.sin(2 * Math.PI * 100 * t) +
            0.12 * Math.sin(2 * Math.PI * 150 * t) +
            0.05 * r();
        }
        break;
      case 'rumble':
        for (let i = 0; i < len; i++) {
          a = 0.995 * a + 0.05 * r(); // brown-ish
          b = 0.9 * b + 0.1 * a;
          d[i] = b * 2.2 * (0.85 + 0.15 * Math.sin((2 * Math.PI * i) / (sr / 7)));
        }
        break;
    }
    // Crossfade the loop seam.
    const fade = Math.round(sr * 0.05);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      d[i] = d[i] * g + d[len - fade + i] * (1 - g);
    }
  }
  return buffer;
}

/** Walkie-talkie style "press" chirp and "release" squelch burst. */
export function generateSquelch(ctx: BaseAudioContext): { open: AudioBuffer; close: AudioBuffer } {
  const sr = ctx.sampleRate;
  const open = ctx.createBuffer(1, Math.round(sr * 0.07), sr);
  const od = open.getChannelData(0);
  for (let i = 0; i < od.length; i++) {
    const t = i / sr;
    od[i] = Math.sin(2 * Math.PI * 1800 * t) * 0.25 * Math.min(1, (od.length - i) / (sr * 0.01));
  }
  const close = ctx.createBuffer(1, Math.round(sr * 0.22), sr);
  const cd = close.getChannelData(0);
  const r = rng(42);
  let a = 0;
  for (let i = 0; i < cd.length; i++) {
    const w = r();
    a = 0.5 * a + 0.5 * w;
    const env = Math.min(1, i / (sr * 0.005)) * Math.exp(-i / (sr * 0.09));
    cd[i] = (w - a) * 0.9 * env;
  }
  return { open, close };
}
