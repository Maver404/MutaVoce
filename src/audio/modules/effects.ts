import { qToNodeQ } from '../dsp/biquad';
import { generateImpulse } from '../impulse';
import { generateNoise, generateSquelch } from '../noiseBuffers';
import type { DistortionType, NoiseType, VoiceParams } from '../../state/params';
import { FxModule, dbToGain, loopSource, ramp } from './base';

export class RingModModule extends FxModule<VoiceParams['ringmod']> {
  private readonly carrier: OscillatorNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoGain: GainNode;

  constructor(ctx: AudioContext) {
    super(ctx);
    const vca = ctx.createGain();
    vca.gain.value = 0;
    this.carrier = ctx.createOscillator();
    this.carrier.connect(vca.gain);
    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain).connect(this.carrier.frequency);
    this.input.connect(vca).connect(this.wet);
    this.carrier.start();
    this.lfo.start();
  }

  protected apply(p: VoiceParams['ringmod']): void {
    ramp(this.carrier.frequency, p.frequency, this.ctx);
    ramp(this.lfo.frequency, Math.max(0.01, p.lfoRate), this.ctx);
    ramp(this.lfoGain.gain, p.lfoRate > 0 ? p.lfoDepth : 0, this.ctx);
    this.setMix(p.mix);
  }
}

function distortionCurve(type: DistortionType, drive: number): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = 1 + drive * 60;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    switch (type) {
      case 'hard':
        curve[i] = Math.max(-1, Math.min(1, x * k * 0.5)) * 0.9;
        break;
      case 'fuzz': {
        const y = Math.sign(x) * (1 - Math.exp(-Math.abs(x * k)));
        curve[i] = x < 0 ? y * 0.75 : y;
        break;
      }
      case 'tube':
        curve[i] = x >= 0 ? Math.tanh(x * k) : Math.tanh(x * k * 0.55) * 0.85;
        break;
      default:
        curve[i] = Math.tanh(x * k) / Math.tanh(k);
    }
  }
  return curve;
}

export class DistortionModule extends FxModule<VoiceParams['distortion']> {
  private readonly shaper: WaveShaperNode;
  private readonly tone: BiquadFilterNode;
  private readonly post: GainNode;
  private curveKey = '';

  constructor(ctx: AudioContext) {
    super(ctx);
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.post = ctx.createGain();
    this.input.connect(this.shaper).connect(this.tone).connect(this.post).connect(this.wet);
  }

  protected apply(p: VoiceParams['distortion']): void {
    const key = `${p.type}:${p.drive.toFixed(2)}`;
    if (key !== this.curveKey) {
      this.curveKey = key;
      this.shaper.curve = distortionCurve(p.type, p.drive);
    }
    ramp(this.tone.frequency, p.tone, this.ctx);
    ramp(this.post.gain, 0.35 + 0.5 / (1 + p.drive * 6), this.ctx);
    this.setMix(p.mix);
  }
}

export class FilterModule extends FxModule<VoiceParams['filter']> {
  private readonly hp: BiquadFilterNode;
  private readonly lp: BiquadFilterNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoGain: GainNode;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain).connect(this.lp.frequency);
    this.lfo.start();
    this.input.connect(this.hp).connect(this.lp).connect(this.wet);
  }

  protected apply(p: VoiceParams['filter']): void {
    ramp(this.hp.frequency, p.highpass, this.ctx);
    ramp(this.lp.frequency, p.lowpass, this.ctx);
    const q = qToNodeQ('lowpass', p.resonance);
    ramp(this.hp.Q, q, this.ctx);
    ramp(this.lp.Q, q, this.ctx);
    ramp(this.lfo.frequency, Math.max(0.01, p.lfoRate), this.ctx);
    ramp(this.lfoGain.gain, p.lfoRate > 0 ? p.lowpass * p.lfoDepth * 0.6 : 0, this.ctx);
    this.setMix(1);
  }
}

export class EqModule extends FxModule<VoiceParams['eq']> {
  readonly filters: BiquadFilterNode[] = [];

  constructor(ctx: AudioContext, bands: number) {
    super(ctx);
    let node: AudioNode = this.input;
    for (let i = 0; i < bands; i++) {
      const f = ctx.createBiquadFilter();
      this.filters.push(f);
      node.connect(f);
      node = f;
    }
    node.connect(this.wet);
  }

  protected apply(p: VoiceParams['eq']): void {
    p.bands.forEach((b, i) => {
      const f = this.filters[i];
      if (!f) return;
      if (f.type !== b.type) f.type = b.type;
      ramp(f.frequency, b.freq, this.ctx);
      ramp(f.gain, b.gain, this.ctx);
      ramp(f.Q, qToNodeQ(b.type, b.q), this.ctx);
    });
    this.setMix(1);
  }
}

export class CompressorModule extends FxModule<VoiceParams['compressor']> {
  readonly comp: DynamicsCompressorNode;
  private readonly makeup: GainNode;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.comp = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
    this.input.connect(this.comp).connect(this.makeup).connect(this.wet);
  }

  protected apply(p: VoiceParams['compressor']): void {
    ramp(this.comp.threshold, p.threshold, this.ctx);
    ramp(this.comp.ratio, p.ratio, this.ctx);
    ramp(this.comp.attack, p.attack / 1000, this.ctx);
    ramp(this.comp.release, p.release / 1000, this.ctx);
    this.comp.knee.value = 6;
    ramp(this.makeup.gain, dbToGain(p.makeup), this.ctx);
    this.setMix(1);
  }
}

/** Chorus / flanger / vibrato / tremolo from two modulated delay lines and an LFO-driven VCA. */
export class ModulationModule extends FxModule<VoiceParams['modulation']> {
  private readonly d1: DelayNode;
  private readonly d2: DelayNode;
  private readonly d2Gain: GainNode;
  private readonly fb: GainNode;
  private readonly lfo1: OscillatorNode;
  private readonly lfo2: OscillatorNode;
  private readonly lfo1Gain: GainNode;
  private readonly lfo2Gain: GainNode;
  private readonly pan1: StereoPannerNode;
  private readonly pan2: StereoPannerNode;
  private readonly trem: GainNode;
  private readonly tremLfo: OscillatorNode;
  private readonly tremDepth: GainNode;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.d1 = ctx.createDelay(0.1);
    this.d2 = ctx.createDelay(0.1);
    this.d2Gain = ctx.createGain();
    this.fb = ctx.createGain();
    this.fb.gain.value = 0;
    this.pan1 = ctx.createStereoPanner();
    this.pan2 = ctx.createStereoPanner();
    this.trem = ctx.createGain();
    this.lfo1 = ctx.createOscillator();
    this.lfo2 = ctx.createOscillator();
    this.lfo1Gain = ctx.createGain();
    this.lfo2Gain = ctx.createGain();
    this.tremLfo = ctx.createOscillator();
    this.tremDepth = ctx.createGain();
    this.tremDepth.gain.value = 0;

    this.input.connect(this.d1).connect(this.pan1).connect(this.trem);
    this.d1.connect(this.fb).connect(this.d1);
    this.input.connect(this.d2).connect(this.d2Gain).connect(this.pan2).connect(this.trem);
    this.trem.connect(this.wet);
    this.lfo1.connect(this.lfo1Gain).connect(this.d1.delayTime);
    this.lfo2.connect(this.lfo2Gain).connect(this.d2.delayTime);
    this.tremLfo.connect(this.tremDepth).connect(this.trem.gain);
    this.lfo1.start();
    this.lfo2.start();
    this.tremLfo.start();
  }

  protected apply(p: VoiceParams['modulation']): void {
    const c = this.ctx;
    const rate = Math.max(0.05, p.rate);
    ramp(this.lfo1.frequency, rate, c);
    ramp(this.lfo2.frequency, rate * 1.13, c);
    ramp(this.tremLfo.frequency, rate, c);
    let base1 = 0, depth1 = 0, base2 = 0, depth2 = 0, voice2 = 0, fb = 0, pan = 0, trem = 0;
    switch (p.type) {
      case 'chorus':
        base1 = 0.018; depth1 = 0.006 * p.depth; base2 = 0.024; depth2 = 0.007 * p.depth; voice2 = 1; pan = 0.6;
        break;
      case 'flanger':
        base1 = 0.003; depth1 = 0.0028 * p.depth; fb = p.feedback;
        break;
      case 'vibrato':
        base1 = 0.006; depth1 = 0.0045 * p.depth;
        break;
      case 'tremolo':
        trem = p.depth * 0.5;
        break;
    }
    ramp(this.d1.delayTime, base1, c);
    ramp(this.lfo1Gain.gain, depth1, c);
    ramp(this.d2.delayTime, base2, c);
    ramp(this.lfo2Gain.gain, depth2, c);
    ramp(this.d2Gain.gain, voice2, c);
    ramp(this.fb.gain, fb, c);
    ramp(this.pan1.pan, -pan, c);
    ramp(this.pan2.pan, pan, c);
    ramp(this.trem.gain, 1 - trem, c);
    ramp(this.tremDepth.gain, trem, c);
    this.setMix(p.mix);
  }
}

export class DelayModule extends FxModule<VoiceParams['delay']> {
  private readonly delay: DelayNode;
  private readonly fb: GainNode;
  private readonly tone: BiquadFilterNode;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.mixMode = 'send';
    this.delay = ctx.createDelay(2);
    this.fb = ctx.createGain();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.input.connect(this.delay).connect(this.tone).connect(this.wet);
    this.tone.connect(this.fb).connect(this.delay);
  }

  protected apply(p: VoiceParams['delay']): void {
    ramp(this.delay.delayTime, p.time / 1000, this.ctx, 0.05);
    ramp(this.fb.gain, p.feedback, this.ctx);
    ramp(this.tone.frequency, p.tone, this.ctx);
    this.setMix(p.mix);
  }
}

export class ReverbModule extends FxModule<VoiceParams['reverb']> {
  private readonly convolver: ConvolverNode;
  private irKey = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private connected = false;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.mixMode = 'send';
    this.convolver = ctx.createConvolver();
    this.convolver.connect(this.wet);
  }

  protected apply(p: VoiceParams['reverb']): void {
    const key = `${p.type}:${p.decay}:${p.preDelay}`;
    if (key !== this.irKey) {
      const first = this.irKey === '';
      this.irKey = key;
      clearTimeout(this.timer);
      const build = () => {
        this.convolver.buffer = generateImpulse(this.ctx, p.type, p.decay, p.preDelay);
      };
      if (first) build();
      else this.timer = setTimeout(build, 120);
    }
    this.setMix(p.mix);
  }

  protected onToggle(enabled: boolean): void {
    // Keep the (costly) convolver out of the graph while bypassed.
    if (enabled && !this.connected) {
      this.input.connect(this.convolver);
      this.connected = true;
    } else if (!enabled && this.connected) {
      setTimeout(() => {
        if (!this.enabled && this.connected) {
          this.input.disconnect(this.convolver);
          this.connected = false;
        }
      }, 200);
    }
  }
}

/** Background bed (radio static, vinyl…) plus walkie-talkie squelch, driven by voice activity. */
export class NoiseModule {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly bed: GainNode;
  private readonly talk: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private type: NoiseType | null = null;
  private readonly squelch: { open: AudioBuffer; close: AudioBuffer };
  private p: VoiceParams['noise'] | null = null;
  private talking = false;

  constructor(private readonly ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    this.talk = ctx.createGain();
    this.input.connect(this.output);
    this.bed.connect(this.talk).connect(this.output);
    this.squelch = generateSquelch(ctx);
  }

  update(p: VoiceParams['noise']): void {
    this.p = p;
    if (p.enabled && p.type !== this.type) {
      this.type = p.type;
      this.source?.stop();
      this.source = this.ctx.createBufferSource();
      loopSource(this.source, generateNoise(this.ctx, p.type));
      this.source.connect(this.bed);
      this.source.start();
    }
    ramp(this.bed.gain, p.enabled ? p.level * 0.5 : 0, this.ctx, 0.03);
    this.applyTalk();
  }

  setVoiceActive(active: boolean): void {
    if (active === this.talking) return;
    this.talking = active;
    this.applyTalk();
    const p = this.p;
    if (p?.enabled && p.squelch) {
      const s = this.ctx.createBufferSource();
      s.buffer = active ? this.squelch.open : this.squelch.close;
      const g = this.ctx.createGain();
      g.gain.value = 0.25 + p.level * 0.6;
      s.connect(g).connect(this.output);
      s.start();
    }
  }

  private applyTalk(): void {
    const gate = this.p?.onlyWhileTalking ? (this.talking ? 1 : 0) : 1;
    ramp(this.talk.gain, gate, this.ctx, this.talking ? 0.005 : 0.06);
  }

  dispose(): void {
    this.source?.stop();
    this.input.disconnect();
    this.output.disconnect();
  }
}
