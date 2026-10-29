export type ScaleName = 'chromatic' | 'major' | 'minor' | 'pentatonic' | 'blues';

export const SCALES: Record<ScaleName, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const freqToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);
export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export function noteName(midi: number): string {
  const n = Math.round(midi);
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

/** Nearest MIDI note (integer) that belongs to `scale` in `key` (0 = C). */
export function snapToScale(midi: number, key: number, scale: ScaleName): number {
  const steps = SCALES[scale];
  const base = Math.round(midi);
  let best = base;
  let bestDist = Infinity;
  for (let n = base - 6; n <= base + 6; n++) {
    const degree = (((n - key) % 12) + 12) % 12;
    if (!steps.includes(degree)) continue;
    const dist = Math.abs(n - midi);
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  return best;
}
