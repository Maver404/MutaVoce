/// <reference path="./worklet-env.d.ts" />
import { Bitcrusher, NoiseGate } from '../dsp/dynamics';
import { GranularShifter } from '../dsp/granularShifter';
import { PitchEngine } from '../dsp/pitchEngine';
import { Vocoder } from '../dsp/vocoder';
import type { BitcrusherMsg, CaptureMsg, GateMsg, HarmonizerMsg, PitchMsg, ProcessorEvent, VocoderMsg } from './messages';

type Inputs = Float32Array[][];

const EMPTY = new Float32Array(128);

function mono(inputs: Inputs): Float32Array {
  return inputs[0]?.[0] ?? EMPTY;
}

class GateProcessor extends AudioWorkletProcessor {
  private gate = new NoiseGate(sampleRate);
  private wasOpen = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<GateMsg>) => {
      const m = e.data;
      this.gate.enabled = m.enabled;
      this.gate.thresholdDb = m.thresholdDb;
      this.gate.attackMs = m.attackMs;
      this.gate.releaseMs = m.releaseMs;
    };
  }

  process(inputs: Inputs, outputs: Inputs): boolean {
    this.gate.process(mono(inputs), outputs[0][0]);
    if (this.gate.open !== this.wasOpen) {
      this.wasOpen = this.gate.open;
      this.port.postMessage({ type: 'gate', open: this.wasOpen } satisfies ProcessorEvent);
    }
    return true;
  }
}

class PitchProcessor extends AudioWorkletProcessor {
  private engine = new PitchEngine(sampleRate);
  private enabled = false;
  private sincePost = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<PitchMsg>) => {
      this.enabled = e.data.enabled;
      this.engine.set(e.data.settings);
    };
  }

  process(inputs: Inputs, outputs: Inputs): boolean {
    const input = mono(inputs);
    const out = outputs[0][0];
    if (this.enabled) this.engine.process(input, out);
    else {
      this.engine.analyze(input);
      out.set(input);
    }
    this.sincePost += input.length;
    if (this.sincePost >= 2048) {
      this.sincePost = 0;
      const d = this.engine.detected;
      this.port.postMessage({
        type: 'pitch',
        freq: d.freq,
        clarity: d.clarity,
        correction: this.enabled && this.engine.settings.autotune ? this.engine.correction : 0,
      } satisfies ProcessorEvent);
    }
    return true;
  }
}

class HarmonizerProcessor extends AudioWorkletProcessor {
  private a = new GranularShifter(sampleRate, 40);
  private b = new GranularShifter(sampleRate, 30);
  private bufA = new Float32Array(128);
  private bufB = new Float32Array(128);
  private s: HarmonizerMsg = { enabled: false, voice1: -12, level1: 0.5, voice2: 7, level2: 0 };

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<HarmonizerMsg>) => {
      this.s = e.data;
      this.a.setRatio(Math.pow(2, this.s.voice1 / 12));
      this.b.setRatio(Math.pow(2, this.s.voice2 / 12));
    };
  }

  process(inputs: Inputs, outputs: Inputs): boolean {
    const out = outputs[0][0];
    if (!this.s.enabled) {
      out.fill(0);
      return true;
    }
    const input = mono(inputs);
    if (this.bufA.length < input.length) {
      this.bufA = new Float32Array(input.length);
      this.bufB = new Float32Array(input.length);
    }
    this.a.process(input, this.bufA);
    this.b.process(input, this.bufB);
    const { level1, level2 } = this.s;
    for (let i = 0; i < out.length; i++) out[i] = this.bufA[i] * level1 + this.bufB[i] * level2;
    return true;
  }
}

class VocoderProcessor extends AudioWorkletProcessor {
  private vocoder = new Vocoder(sampleRate);
  private enabled = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<VocoderMsg>) => {
      this.enabled = e.data.enabled;
      this.vocoder.carrier = e.data.carrier;
      this.vocoder.setNote(e.data.note);
    };
  }

  process(inputs: Inputs, outputs: Inputs): boolean {
    if (this.enabled) this.vocoder.process(mono(inputs), outputs[0][0]);
    else outputs[0][0].fill(0);
    return true;
  }
}

class BitcrusherProcessor extends AudioWorkletProcessor {
  private crusher = new Bitcrusher();
  private enabled = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<BitcrusherMsg>) => {
      this.enabled = e.data.enabled;
      this.crusher.bits = e.data.bits;
      this.crusher.downsample = e.data.downsample;
    };
  }

  process(inputs: Inputs, outputs: Inputs): boolean {
    if (this.enabled) this.crusher.process(mono(inputs), outputs[0][0]);
    else outputs[0][0].fill(0);
    return true;
  }
}

/** Collects stereo PCM while recording and ships it to the main thread in chunks. */
class CaptureProcessor extends AudioWorkletProcessor {
  private recording = false;
  private chunk: Float32Array[] = [];
  private filled = 0;
  private readonly size = 8192;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<CaptureMsg>) => {
      if (!e.data.recording && this.recording) this.flush();
      this.recording = e.data.recording;
    };
  }

  private flush(): void {
    if (this.filled === 0) return;
    const channels = this.chunk.map((c) => c.slice(0, this.filled));
    this.port.postMessage({ type: 'chunk', channels } satisfies ProcessorEvent, channels.map((c) => c.buffer));
    this.filled = 0;
  }

  process(inputs: Inputs): boolean {
    if (!this.recording) return true;
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    if (this.chunk.length !== 2) this.chunk = [new Float32Array(this.size), new Float32Array(this.size)];
    const frames = input[0].length;
    if (this.filled + frames > this.size) this.flush();
    this.chunk[0].set(input[0], this.filled);
    this.chunk[1].set(input[1] ?? input[0], this.filled);
    this.filled += frames;
    return true;
  }
}

registerProcessor('mv-gate', GateProcessor);
registerProcessor('mv-pitch', PitchProcessor);
registerProcessor('mv-harmonizer', HarmonizerProcessor);
registerProcessor('mv-vocoder', VocoderProcessor);
registerProcessor('mv-bitcrusher', BitcrusherProcessor);
registerProcessor('mv-capture', CaptureProcessor);
