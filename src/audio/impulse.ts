import type { ReverbType } from '../state/params';

interface RoomCharacter {
  /** High-frequency damping: 0 = bright, 1 = very dark tail. */
  damping: number;
  /** Early reflection times (ms) and gains. */
  early: [number, number][];
  /** Density of the late tail onset (ms). */
  onset: number;
}

const ROOMS: Record<ReverbType, RoomCharacter> = {
  room: { damping: 0.55, early: [[7, 0.5], [11, 0.4], [17, 0.3], [23, 0.2]], onset: 10 },
  bathroom: { damping: 0.15, early: [[3, 0.7], [5, 0.6], [8, 0.5], [12, 0.4]], onset: 4 },
  hall: { damping: 0.5, early: [[15, 0.4], [24, 0.35], [37, 0.3], [52, 0.2]], onset: 25 },
  cathedral: { damping: 0.45, early: [[30, 0.35], [55, 0.3], [80, 0.25], [120, 0.2]], onset: 50 },
  cave: { damping: 0.7, early: [[40, 0.5], [90, 0.4], [160, 0.35], [240, 0.25]], onset: 60 },
  plate: { damping: 0.25, early: [], onset: 1 },
  stadium: { damping: 0.6, early: [[90, 0.45], [180, 0.35], [320, 0.3], [480, 0.2]], onset: 80 },
};

/** Procedural stereo impulse response: early reflections + exponentially decaying, darkening noise. */
export function generateImpulse(
  ctx: BaseAudioContext,
  type: ReverbType,
  decaySeconds: number,
  preDelayMs: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const room = ROOMS[type];
  const length = Math.ceil((decaySeconds + preDelayMs / 1000 + 0.1) * sr);
  const buffer = ctx.createBuffer(2, length, sr);
  const pre = Math.round((preDelayMs / 1000) * sr);
  let seed = 9871;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 2147483648 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    const onset = Math.max(1, Math.round((room.onset / 1000) * sr));
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / decaySeconds) * Math.min(1, (i - pre) / onset);
      // One-pole lowpass whose cutoff falls over time (air absorption).
      const coef = Math.min(0.97, room.damping * (0.3 + (0.7 * t) / decaySeconds));
      lp = lp * coef + rand() * (1 - coef);
      data[i] = lp * env;
    }
    for (const [ms, gain] of room.early) {
      const idx = pre + Math.round(((ms * (ch === 0 ? 1 : 1.07)) / 1000) * sr);
      if (idx < length) data[idx] += gain * (ch === 0 ? 1 : -1) * 0.8;
    }
  }
  return buffer;
}
