/** Noise gate with hysteresis and hold. Voice-activity detection runs even when gating is off. */
export class NoiseGate {
  enabled = true;
  thresholdDb = -50;
  attackMs = 3;
  releaseMs = 150;
  holdMs = 120;
  open = false;

  private readonly sr: number;
  private env = 0;
  private gain = 0;
  private holdLeft = 0;
  private readonly envAtk: number;
  private readonly envRel: number;

  constructor(sampleRate: number) {
    this.sr = sampleRate;
    this.envAtk = Math.exp(-1 / (0.001 * sampleRate));
    this.envRel = Math.exp(-1 / (0.04 * sampleRate));
  }

  process(input: Float32Array, output: Float32Array): void {
    const openLin = Math.pow(10, this.thresholdDb / 20);
    const closeLin = openLin * 0.6;
    const gAtk = 1 - Math.exp(-1 / ((Math.max(0.1, this.attackMs) / 1000) * this.sr));
    const gRel = 1 - Math.exp(-1 / ((Math.max(1, this.releaseMs) / 1000) * this.sr));
    const holdSamples = (this.holdMs / 1000) * this.sr;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const a = Math.abs(x);
      this.env = a > this.env ? this.envAtk * this.env + (1 - this.envAtk) * a : this.envRel * this.env + (1 - this.envRel) * a;
      if (this.env > openLin) {
        this.open = true;
        this.holdLeft = holdSamples;
      } else if (this.env < closeLin) {
        if (this.holdLeft > 0) this.holdLeft--;
        else this.open = false;
      }
      const target = this.enabled ? (this.open ? 1 : 0) : 1;
      this.gain += (target - this.gain) * (target > this.gain ? gAtk : gRel);
      output[i] = x * this.gain;
    }
  }
}

/** Bit-depth and sample-rate reduction. */
export class Bitcrusher {
  bits = 8;
  downsample = 1;
  private held = 0;
  private counter = 0;

  process(input: Float32Array, output: Float32Array): void {
    const levels = Math.pow(2, Math.max(1, Math.min(16, this.bits)) - 1);
    const factor = Math.max(1, this.downsample);
    for (let i = 0; i < input.length; i++) {
      this.counter += 1;
      if (this.counter >= factor) {
        this.counter -= factor;
        this.held = Math.round(input[i] * levels) / levels;
      }
      output[i] = this.held;
    }
  }
}
