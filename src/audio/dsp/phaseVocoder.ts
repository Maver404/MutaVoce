import { FFT, hann } from './fft';

/**
 * High-quality pitch shifter (phase vocoder, 75% overlap) with independent formant control.
 *
 * The spectral envelope is estimated by cepstral liftering; the spectrum is whitened,
 * pitch-shifted by bin remapping, then re-coloured with the envelope read at j / envRatio.
 * - envRatio === ratio  → formants follow the pitch (classic, envelope step skipped)
 * - envRatio === 1      → formants preserved (natural-sounding shift)
 * - anything else       → formants shifted independently
 */
export class PhaseVocoder {
  readonly N: number;
  readonly hop: number;
  readonly latency: number;
  ratio = 1;
  envRatio = 1;

  private readonly sr: number;
  private readonly fft: FFT;
  private readonly win: Float32Array;
  private readonly inFifo: Float32Array;
  private readonly outFifo: Float32Array;
  private readonly accum: Float32Array;
  private readonly lastPhase: Float32Array;
  private readonly sumPhase: Float32Array;
  private readonly anaMag: Float32Array;
  private readonly anaFreq: Float32Array;
  private readonly synMag: Float32Array;
  private readonly synFreq: Float32Array;
  private readonly synMax: Float32Array;
  private readonly env: Float32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  private readonly cre: Float32Array;
  private readonly cim: Float32Array;
  private readonly lifter: number;
  private readonly outGain: number;
  private rover: number;

  constructor(sampleRate: number, N = 2048, osamp = 4) {
    this.sr = sampleRate;
    this.N = N;
    this.hop = N / osamp;
    this.latency = N - this.hop;
    this.fft = new FFT(N);
    this.win = hann(N);
    this.inFifo = new Float32Array(N);
    this.outFifo = new Float32Array(N);
    this.accum = new Float32Array(N * 2);
    const bins = N / 2 + 1;
    this.lastPhase = new Float32Array(bins);
    this.sumPhase = new Float32Array(bins);
    this.anaMag = new Float32Array(bins);
    this.anaFreq = new Float32Array(bins);
    this.synMag = new Float32Array(bins);
    this.synFreq = new Float32Array(bins);
    this.synMax = new Float32Array(bins);
    this.env = new Float32Array(bins);
    this.re = new Float32Array(N);
    this.im = new Float32Array(N);
    this.cre = new Float32Array(N);
    this.cim = new Float32Array(N);
    this.lifter = Math.min(N / 2 - 1, Math.round(sampleRate * 0.0015));
    let w2 = 0;
    for (let i = 0; i < N; i++) w2 += this.win[i] * this.win[i];
    this.outGain = this.hop / w2;
    this.rover = this.latency;
  }

  reset(): void {
    this.inFifo.fill(0);
    this.outFifo.fill(0);
    this.accum.fill(0);
    this.lastPhase.fill(0);
    this.sumPhase.fill(0);
    this.rover = this.latency;
  }

  process(input: Float32Array, output: Float32Array): void {
    const lat = this.latency;
    for (let i = 0; i < input.length; i++) {
      this.inFifo[this.rover] = input[i];
      output[i] = this.outFifo[this.rover - lat];
      this.rover++;
      if (this.rover >= this.N) {
        this.rover = lat;
        this.processFrame();
      }
    }
  }

  private processFrame(): void {
    const { N, hop, re, im, win } = this;
    const half = N / 2;
    const osamp = N / hop;
    const expct = (2 * Math.PI * hop) / N;
    const freqPerBin = this.sr / N;
    const TWO_PI = 2 * Math.PI;

    for (let k = 0; k < N; k++) {
      re[k] = this.inFifo[k] * win[k];
      im[k] = 0;
    }
    this.fft.forward(re, im);

    for (let k = 0; k <= half; k++) {
      const r = re[k];
      const m = im[k];
      const ph = Math.atan2(m, r);
      let d = ph - this.lastPhase[k];
      this.lastPhase[k] = ph;
      d -= k * expct;
      d -= TWO_PI * Math.round(d / TWO_PI);
      this.anaMag[k] = Math.sqrt(r * r + m * m);
      this.anaFreq[k] = (k + (osamp * d) / TWO_PI) * freqPerBin;
    }

    const ratio = this.ratio;
    const envRatio = this.envRatio;
    const useEnv = Math.abs(envRatio - ratio) > 1e-3;
    if (useEnv) this.estimateEnvelope();

    const synMag = this.synMag;
    const synFreq = this.synFreq;
    const synMax = this.synMax;
    synMag.fill(0);
    synFreq.fill(0);
    synMax.fill(0);
    for (let k = 0; k <= half; k++) {
      const j = Math.round(k * ratio);
      if (j > half) break;
      const m = useEnv ? this.anaMag[k] / this.env[k] : this.anaMag[k];
      synMag[j] += m;
      if (m >= synMax[j]) {
        synMax[j] = m;
        synFreq[j] = this.anaFreq[k] * ratio;
      }
    }
    if (useEnv) {
      const env = this.env;
      for (let j = 0; j <= half; j++) {
        const pos = j / envRatio;
        let e: number;
        if (pos >= half) e = env[half] * 0.1;
        else {
          const i0 = Math.floor(pos);
          const f = pos - i0;
          e = env[i0] + (env[i0 + 1] - env[i0]) * f;
        }
        synMag[j] *= e;
      }
    }

    for (let k = 0; k <= half; k++) {
      let d = synFreq[k] / freqPerBin - k;
      d = (TWO_PI * d) / osamp + k * expct;
      let ph = this.sumPhase[k] + d;
      ph -= TWO_PI * Math.floor(ph / TWO_PI);
      this.sumPhase[k] = ph;
      re[k] = synMag[k] * Math.cos(ph);
      im[k] = synMag[k] * Math.sin(ph);
    }
    im[0] = 0;
    im[half] = 0;
    for (let k = half + 1; k < N; k++) {
      re[k] = re[N - k];
      im[k] = -im[N - k];
    }
    this.fft.inverse(re, im);

    const accum = this.accum;
    const g = this.outGain;
    for (let k = 0; k < N; k++) accum[k] += re[k] * win[k] * g;
    for (let k = 0; k < hop; k++) this.outFifo[k] = accum[k];
    accum.copyWithin(0, hop, hop + N);
    accum.fill(0, N, N + hop);
    this.inFifo.copyWithin(0, hop, N);
  }

  /** Cepstral envelope of anaMag into env (bins 0..N/2). */
  private estimateEnvelope(): void {
    const { N, cre, cim, env } = this;
    const half = N / 2;
    for (let k = 0; k <= half; k++) {
      cre[k] = Math.log(this.anaMag[k] + 1e-9);
      cim[k] = 0;
    }
    for (let k = half + 1; k < N; k++) {
      cre[k] = cre[N - k];
      cim[k] = 0;
    }
    this.fft.inverse(cre, cim);
    const L = this.lifter;
    for (let n = L + 1; n < N - L; n++) {
      cre[n] = 0;
      cim[n] = 0;
    }
    cre[L] *= 0.5;
    cre[N - L] *= 0.5;
    this.fft.forward(cre, cim);
    for (let k = 0; k <= half; k++) env[k] = Math.exp(cre[k]);
  }
}
