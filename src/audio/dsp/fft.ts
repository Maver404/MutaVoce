/**
 * Radix-2 complex FFT, in place, with precomputed twiddles and bit-reversal table.
 * Forward uses e^{-i}, inverse uses e^{+i} and is scaled by 1/N, so forward→inverse is identity.
 */
export class FFT {
  readonly size: number;
  private readonly rev: Uint32Array;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error(`FFT size must be a power of 2, got ${size}`);
    this.size = size;
    const bits = Math.log2(size);
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let k = 0; k < size / 2; k++) {
      this.cos[k] = Math.cos((2 * Math.PI * k) / size);
      this.sin[k] = Math.sin((2 * Math.PI * k) / size);
    }
  }

  forward(re: Float32Array, im: Float32Array): void {
    this.transform(re, im, false);
  }

  inverse(re: Float32Array, im: Float32Array): void {
    this.transform(re, im, true);
    const s = 1 / this.size;
    for (let i = 0; i < this.size; i++) {
      re[i] *= s;
      im[i] *= s;
    }
  }

  private transform(re: Float32Array, im: Float32Array, inverse: boolean): void {
    const n = this.size;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = this.cos[k];
          const wi = sign * this.sin[k];
          const a = i + j;
          const b = a + half;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}

/** Periodic Hann window (sums to a constant under 50%/75% overlap). */
export function hann(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  return w;
}
