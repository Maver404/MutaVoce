/**
 * Low-latency pitch shifter: a delay line read by two taps half a window apart,
 * each faded with a sin² window so their gains always sum to 1.
 * Formants move with the pitch (the classic "chipmunk / giant" sound).
 */
export class GranularShifter {
  private readonly buf: Float32Array;
  private readonly mask: number;
  private readonly win: number;
  private write = 0;
  private phase = 0;
  private ratio = 1;
  private target = 1;

  constructor(sampleRate: number, windowMs = 35) {
    this.win = Math.max(64, Math.round((sampleRate * windowMs) / 1000));
    let size = 1;
    while (size < this.win * 2 + 16) size <<= 1;
    this.buf = new Float32Array(size);
    this.mask = size - 1;
  }

  /** Average delay introduced, in samples. */
  get latency(): number {
    return this.win / 2;
  }

  setRatio(ratio: number): void {
    this.target = Math.min(4, Math.max(0.25, ratio));
  }

  /** Jump to the target ratio immediately (no glide). */
  snap(): void {
    this.ratio = this.target;
  }

  reset(): void {
    this.buf.fill(0);
    this.phase = 0;
  }

  process(input: Float32Array, output: Float32Array): void {
    const buf = this.buf;
    const mask = this.mask;
    const size = mask + 1;
    const win = this.win;
    for (let i = 0; i < input.length; i++) {
      this.ratio += (this.target - this.ratio) * 0.003;
      buf[this.write] = input[i];

      let p = this.phase + (1 - this.ratio) / win;
      p -= Math.floor(p);
      this.phase = p;
      let p2 = p + 0.5;
      if (p2 >= 1) p2 -= 1;

      const s1 = this.read(this.write - (p * win + 2), size, mask);
      const s2 = this.read(this.write - (p2 * win + 2), size, mask);
      const g1 = Math.sin(Math.PI * p);
      const g2 = Math.sin(Math.PI * p2);
      output[i] = s1 * g1 * g1 + s2 * g2 * g2;

      this.write = (this.write + 1) & mask;
    }
  }

  private read(pos: number, size: number, mask: number): number {
    if (pos < 0) pos += size;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = this.buf[i0 & mask];
    const b = this.buf[(i0 + 1) & mask];
    return a + (b - a) * frac;
  }
}
