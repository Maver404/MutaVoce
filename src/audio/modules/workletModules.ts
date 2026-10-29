import type { VoiceParams } from '../../state/params';
import type { BitcrusherMsg, GateMsg, HarmonizerMsg, PitchMsg, ProcessorEvent, VocoderMsg } from '../worklets/messages';
import { FxModule, ramp } from './base';

function monoWorklet(ctx: AudioContext, name: string): AudioWorkletNode {
  return new AudioWorkletNode(ctx, name, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  });
}

/** Posts a message only when its content changed. */
class Messenger<T> {
  private last = '';
  constructor(private readonly node: AudioWorkletNode) {}
  send(msg: T): void {
    const key = JSON.stringify(msg);
    if (key === this.last) return;
    this.last = key;
    this.node.port.postMessage(msg);
  }
}

/** Gate sits inline (it bypasses internally) and reports voice activity. */
export class GateModule {
  readonly node: AudioWorkletNode;
  private readonly msg: Messenger<GateMsg>;

  constructor(ctx: AudioContext, onVoice: (open: boolean) => void) {
    this.node = monoWorklet(ctx, 'mv-gate');
    this.msg = new Messenger(this.node);
    this.node.port.onmessage = (e: MessageEvent<ProcessorEvent>) => {
      if (e.data.type === 'gate') onVoice(e.data.open);
    };
  }

  get input(): AudioNode {
    return this.node;
  }
  get output(): AudioNode {
    return this.node;
  }

  update(p: VoiceParams['gate']): void {
    this.msg.send({ enabled: p.enabled, thresholdDb: p.threshold, attackMs: p.attack, releaseMs: p.release });
  }
}

export interface PitchReport {
  freq: number;
  clarity: number;
  correction: number;
}

/** Pitch/formant/autotune, inline. Always reports the detected input pitch. */
export class PitchModule {
  readonly node: AudioWorkletNode;
  private readonly msg: Messenger<PitchMsg>;

  constructor(ctx: AudioContext, onPitch: (r: PitchReport) => void) {
    this.node = monoWorklet(ctx, 'mv-pitch');
    this.msg = new Messenger(this.node);
    this.node.port.onmessage = (e: MessageEvent<ProcessorEvent>) => {
      if (e.data.type === 'pitch') onPitch(e.data);
    };
  }

  get input(): AudioNode {
    return this.node;
  }
  get output(): AudioNode {
    return this.node;
  }

  update(pitch: VoiceParams['pitch'], autotune: VoiceParams['autotune']): void {
    this.msg.send({
      enabled: pitch.enabled || autotune.enabled,
      settings: {
        mode: pitch.mode,
        semitones: pitch.enabled ? pitch.semitones : 0,
        formant: pitch.enabled ? pitch.formant : 0,
        preserveFormants: pitch.preserveFormants,
        autotune: autotune.enabled,
        key: autotune.key,
        scale: autotune.scale,
        speed: autotune.speed,
      },
    });
  }
}

/** Parallel extra voices: output carries only the shifted copies. */
export class HarmonizerModule {
  readonly input: AudioWorkletNode;
  readonly output: GainNode;
  private readonly msg: Messenger<HarmonizerMsg>;

  constructor(private readonly ctx: AudioContext) {
    this.input = monoWorklet(ctx, 'mv-harmonizer');
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.input.connect(this.output);
    this.msg = new Messenger(this.input);
  }

  update(p: VoiceParams['harmonizer']): void {
    this.msg.send({ enabled: p.enabled, voice1: p.voice1, level1: p.level1, voice2: p.voice2, level2: p.level2 });
    ramp(this.output.gain, p.enabled ? 1 : 0, this.ctx, 0.015);
  }
}

export class VocoderModule extends FxModule<VoiceParams['vocoder']> {
  private readonly node: AudioWorkletNode;
  private readonly msg: Messenger<VocoderMsg>;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.node = monoWorklet(ctx, 'mv-vocoder');
    this.msg = new Messenger(this.node);
    this.input.connect(this.node).connect(this.wet);
  }

  protected apply(p: VoiceParams['vocoder']): void {
    this.msg.send({ enabled: p.enabled, carrier: p.carrier, note: p.note });
    this.setMix(p.mix);
  }
}

export class BitcrusherModule extends FxModule<VoiceParams['bitcrusher']> {
  private readonly node: AudioWorkletNode;
  private readonly msg: Messenger<BitcrusherMsg>;

  constructor(ctx: AudioContext) {
    super(ctx);
    this.node = monoWorklet(ctx, 'mv-bitcrusher');
    this.msg = new Messenger(this.node);
    this.input.connect(this.node).connect(this.wet);
  }

  protected apply(p: VoiceParams['bitcrusher']): void {
    this.msg.send({ enabled: p.enabled, bits: p.bits, downsample: p.downsample });
    this.setMix(p.mix);
  }
}
