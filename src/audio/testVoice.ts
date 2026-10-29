/**
 * Procedural "test voice": a band-limited glottal source through three cascaded formant
 * resonators, with syllables, prosody and a few fricatives. Lets people try every preset
 * without a microphone (and lets us test the engine headlessly).
 */

type Vowel = [number, number, number];

const VOWELS: Record<string, Vowel> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [300, 2250, 3000],
  o: [570, 840, 2410],
  u: [320, 870, 2240],
};

interface Syllable {
  v: string;
  dur: number;
  accent: number;
  fricative?: boolean;
}

// Roughly "ciao, come stai? oggi è una bella giornata" in vowel skeleton.
const PHRASE: (Syllable | number)[] = [
  { v: 'i', dur: 0.12, accent: 0.1, fricative: true },
  { v: 'a', dur: 0.26, accent: 1 },
  { v: 'o', dur: 0.22, accent: 0.2 },
  0.32,
  { v: 'o', dur: 0.18, accent: 0.6 },
  { v: 'e', dur: 0.16, accent: 0.1 },
  { v: 'a', dur: 0.2, accent: 0.4, fricative: true },
  { v: 'i', dur: 0.3, accent: 0.9 },
  0.55,
  { v: 'o', dur: 0.2, accent: 0.8 },
  { v: 'i', dur: 0.14, accent: 0.2 },
  { v: 'e', dur: 0.18, accent: 0.5 },
  { v: 'u', dur: 0.15, accent: 0.2 },
  { v: 'a', dur: 0.14, accent: 0.1 },
  { v: 'e', dur: 0.2, accent: 0.7 },
  { v: 'a', dur: 0.16, accent: 0.2 },
  { v: 'o', dur: 0.16, accent: 0.3 },
  { v: 'a', dur: 0.26, accent: 1 },
  { v: 'a', dur: 0.3, accent: 0.1 },
  0.9,
];

export function synthTestVoice(sampleRate: number): Float32Array {
  let rng = 12345;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  const total = PHRASE.reduce<number>((t, s) => t + (typeof s === 'number' ? s : s.dur), 0);
  const out = new Float32Array(Math.ceil(total * sampleRate));

  // Single-cycle band-limited source (1/k^1.1 harmonic rolloff).
  const TABLE = 2048;
  const table = new Float32Array(TABLE);
  for (let k = 1; k <= 48; k++) {
    const amp = 1 / Math.pow(k, 1.1);
    for (let i = 0; i < TABLE; i++) table[i] += amp * Math.sin((2 * Math.PI * k * i) / TABLE);
  }

  const state = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  const bandwidths = [90, 110, 160];
  let phase = 0;
  let pos = 0;
  let t0 = 0;
  let prevVowel: Vowel = VOWELS.a;
  let hp = 0;

  for (const item of PHRASE) {
    if (typeof item === 'number') {
      pos += Math.round(item * sampleRate);
      t0 += item;
      continue;
    }
    const vowel = VOWELS[item.v];
    const n = Math.round(item.dur * sampleRate);
    for (let i = 0; i < n && pos < out.length; i++, pos++) {
      const u = i / n;
      const time = t0 + i / sampleRate;
      const glide = Math.min(1, u * 4);
      const f = vowel.map((fv, j) => prevVowel[j] + (fv - prevVowel[j]) * glide);
      const f0 = 118 - time * 3 + item.accent * 28 * Math.sin(Math.PI * u) + 2 * Math.sin(2 * Math.PI * 5.2 * time);

      phase += f0 / sampleRate;
      if (phase >= 1) phase -= 1;
      const ti = phase * TABLE;
      const i0 = Math.floor(ti);
      const src = table[i0] + (table[(i0 + 1) % TABLE] - table[i0]) * (ti - i0);
      let x = src * 0.25 + (rand() - 0.5) * 0.02;

      for (let r = 0; r < 3; r++) {
        const rr = Math.exp((-Math.PI * bandwidths[r]) / sampleRate);
        const theta = (2 * Math.PI * f[r]) / sampleRate;
        const a1 = 2 * rr * Math.cos(theta);
        const a2 = -rr * rr;
        const y = (1 - rr) * x + a1 * state[r][0] + a2 * state[r][1];
        state[r][1] = state[r][0];
        state[r][0] = y;
        x = y * (r === 0 ? 3 : 2.2);
      }

      const env = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.2);
      let s = x * env;
      if (item.fricative && u < 0.35) {
        const noise = rand() - 0.5;
        hp = 0.6 * hp + noise;
        s = s * (u / 0.35) + (noise - hp * 0.6) * 0.18 * (1 - u / 0.35);
      }
      out[pos] = s;
    }
    prevVowel = vowel;
    t0 += item.dur;
  }

  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.5 / peak;
  return out;
}
