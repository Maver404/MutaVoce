/** Smoothly move an AudioParam to `value` (no zipper noise, safe to call on every knob tick). */
export function ramp(param: AudioParam, value: number, ctx: BaseAudioContext, timeConstant = 0.02): void {
  const t = ctx.currentTime;
  const p = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else param.cancelScheduledValues(t);
  param.setTargetAtTime(value, t, timeConstant);
}

export const dbToGain = (db: number) => Math.pow(10, db / 20);

/**
 * Chrome stops looping some buffers (depending on their exact length) when loopEnd is left
 * at its default; an explicit loopEnd one frame before the end loops reliably.
 */
export function loopSource(src: AudioBufferSourceNode, buffer: AudioBuffer): void {
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = (buffer.length - 1) / buffer.sampleRate;
}

/**
 * Insert effect with a click-free bypass: input feeds a dry path and the module's wet path,
 * both summed into output. "crossfade" mixes dry 1-mix / wet mix, "send" keeps dry at 1.
 */
export abstract class FxModule<P extends { enabled: boolean }> {
  readonly input: GainNode;
  readonly output: GainNode;
  protected readonly dry: GainNode;
  protected readonly wet: GainNode;
  protected enabled = false;
  protected mix = 1;
  protected mixMode: 'crossfade' | 'send' = 'crossfade';
  private last = '';

  constructor(protected readonly ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
  }

  update(p: P): void {
    const key = JSON.stringify(p);
    if (key === this.last) return;
    this.last = key;
    const was = this.enabled;
    this.enabled = p.enabled;
    this.apply(p);
    this.applyMix();
    if (was !== this.enabled) this.onToggle(this.enabled);
  }

  protected setMix(mix: number): void {
    this.mix = mix;
  }

  private applyMix(): void {
    const on = this.enabled;
    const dryTarget = !on ? 1 : this.mixMode === 'send' ? 1 : 1 - this.mix;
    ramp(this.dry.gain, dryTarget, this.ctx, 0.012);
    ramp(this.wet.gain, on ? this.mix : 0, this.ctx, 0.012);
  }

  protected abstract apply(p: P): void;

  protected onToggle(_enabled: boolean): void {}

  dispose(): void {
    this.input.disconnect();
    this.output.disconnect();
  }
}
