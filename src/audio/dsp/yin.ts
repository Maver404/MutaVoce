export interface PitchEstimate {
  /** Fundamental in Hz, 0 when unvoiced. */
  freq: number;
  /** 0..1, higher is more periodic. */
  clarity: number;
}

/** YIN fundamental-frequency estimator with preallocated scratch space. */
export class Yin {
  private readonly diff: Float32Array;

  constructor(maxTau = 2048) {
    this.diff = new Float32Array(maxTau + 1);
  }

  detect(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1000, threshold = 0.15): PitchEstimate {
    let energy = 0;
    for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
    if (Math.sqrt(energy / buf.length) < 0.004) return { freq: 0, clarity: 0 };

    const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
    const tauMax = Math.min(this.diff.length - 1, Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
    const w = buf.length - tauMax;
    const d = this.diff;
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < w; j++) {
        const delta = buf[j] - buf[j + tau];
        sum += delta * delta;
      }
      running += sum;
      d[tau] = running > 0 ? (sum * tau) / running : 1;
    }

    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < threshold) {
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return { freq: 0, clarity: 0 };

    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const s0 = d[tau - 1];
      const s1 = d[tau];
      const s2 = d[tau + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (denom !== 0) better = tau + (s2 - s0) / denom;
    }
    return { freq: sampleRate / better, clarity: Math.max(0, 1 - d[tau]) };
  }
}
