import processorsUrl from './worklets/processors.worklet.ts?worker&url';
import { DEFAULT_PARAMS, type VoiceParams } from '../state/params';
import { supports } from './devices';
import { dbToGain, loopSource, ramp } from './modules/base';
import {
  CompressorModule,
  DelayModule,
  DistortionModule,
  EqModule,
  FilterModule,
  ModulationModule,
  NoiseModule,
  ReverbModule,
  RingModModule,
} from './modules/effects';
import {
  BitcrusherModule,
  GateModule,
  HarmonizerModule,
  PitchModule,
  type PitchReport,
  VocoderModule,
} from './modules/workletModules';
import { synthTestVoice } from './testVoice';

export type InputSource = 'mic' | 'test' | 'file';

export interface MicOptions {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface InputConfig {
  source: InputSource;
  deviceId: string | null;
  mic: MicOptions;
  gainDb: number;
}

export interface OutputConfig {
  monitorEnabled: boolean;
  monitorDeviceId: string | null;
  monitorVolume: number;
  sendEnabled: boolean;
  sendDeviceId: string | null;
}

export type EngineErrorCode = 'insecure' | 'unsupported' | 'permission' | 'nodevice' | 'busy' | 'sink' | 'nofile' | 'generic';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export interface Levels {
  inPeak: number;
  inRms: number;
  outPeak: number;
  outRms: number;
}

export interface PitchInfo {
  inHz: number;
  outHz: number;
}

type Events = {
  voice: boolean;
  error: EngineError;
};

interface Graph {
  inputGain: GainNode;
  inputAnalyser: AnalyserNode;
  gate: GateModule;
  pitch: PitchModule;
  harmonizer: HarmonizerModule;
  ringmod: RingModModule;
  vocoder: VocoderModule;
  distortion: DistortionModule;
  bitcrusher: BitcrusherModule;
  filter: FilterModule;
  eq: EqModule;
  compressor: CompressorModule;
  modulation: ModulationModule;
  delay: DelayModule;
  reverb: ReverbModule;
  noise: NoiseModule;
  procGain: GainNode;
  rawGain: GainNode;
  talkGain: GainNode;
  masterGain: GainNode;
  soundboardBus: GainNode;
  limiter: DynamicsCompressorNode;
  muteGain: GainNode;
  outputAnalyser: AnalyserNode;
  monitorGain: GainNode;
  monitorDest: MediaStreamAudioDestinationNode;
  sendDest: MediaStreamAudioDestinationNode;
  recordDest: MediaStreamAudioDestinationNode;
}

const dbOf = (v: number) => (v > 1e-6 ? 20 * Math.log10(v) : -120);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private source: AudioNode | null = null;
  private stream: MediaStream | null = null;
  private testBuffer: AudioBuffer | null = null;
  private fileBuffer: AudioBuffer | null = null;
  private fileName = '';
  private params: VoiceParams = DEFAULT_PARAMS;
  private pitchReport: PitchReport = { freq: 0, clarity: 0, correction: 0 };
  private readonly monitorEl = new Audio();
  private readonly sendEl = new Audio();
  private monitorViaElement = false;
  private listeners = new Map<keyof Events, Set<(v: never) => void>>();
  private timeBuf = new Float32Array(2048);
  private inputConfig: InputConfig | null = null;
  private voiceActive = false;
  private bypass = false;
  private muted = false;
  private talkOpen = true;

  get running(): boolean {
    return !!this.ctx && this.ctx.state !== 'closed';
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get loadedFileName(): string {
    return this.fileName;
  }

  on<K extends keyof Events>(event: K, cb: (v: Events[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(cb as (v: never) => void);
    return () => set.delete(cb as (v: never) => void);
  }

  private emit<K extends keyof Events>(event: K, value: Events[K]): void {
    this.listeners.get(event)?.forEach((cb) => (cb as (v: Events[K]) => void)(value));
  }

  async start(params: VoiceParams, input: InputConfig, output: OutputConfig): Promise<void> {
    if (this.running) return;
    if (!supports.secure) throw new EngineError('insecure');
    if (!supports.audioWorklet) throw new EngineError('unsupported');
    if (input.source === 'mic' && !supports.mediaDevices) throw new EngineError('unsupported');

    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    try {
      await ctx.audioWorklet.addModule(processorsUrl);
      this.g = this.build(ctx);
      this.applyParams(params, true);
      this.applyGates();
      await this.setInput(input);
      await this.setOutputs(output);
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (err) {
      await this.stop();
      throw err instanceof EngineError ? err : new EngineError('generic', String(err));
    }
  }

  async stop(): Promise<void> {
    this.stopSource();
    this.monitorEl.pause();
    this.sendEl.pause();
    this.monitorEl.srcObject = null;
    this.sendEl.srcObject = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.g = null;
    this.testBuffer = null;
    this.voiceActive = false;
    if (ctx && ctx.state !== 'closed') await ctx.close();
  }

  private build(ctx: AudioContext): Graph {
    const inputGain = ctx.createGain();
    const inputAnalyser = ctx.createAnalyser();
    inputAnalyser.fftSize = 4096;
    inputAnalyser.smoothingTimeConstant = 0.8;

    const gate = new GateModule(ctx, (open) => this.onVoice(open));
    const pitch = new PitchModule(ctx, (r) => (this.pitchReport = r));
    const harmonizer = new HarmonizerModule(ctx);
    const ringmod = new RingModModule(ctx);
    const vocoder = new VocoderModule(ctx);
    const distortion = new DistortionModule(ctx);
    const bitcrusher = new BitcrusherModule(ctx);
    const filter = new FilterModule(ctx);
    const eq = new EqModule(ctx, DEFAULT_PARAMS.eq.bands.length);
    const compressor = new CompressorModule(ctx);
    const modulation = new ModulationModule(ctx);
    const delay = new DelayModule(ctx);
    const reverb = new ReverbModule(ctx);
    const noise = new NoiseModule(ctx);

    const voiceSum = ctx.createGain();
    const procGain = ctx.createGain();
    const rawGain = ctx.createGain();
    rawGain.gain.value = 0;
    const talkGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const soundboardBus = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const muteGain = ctx.createGain();
    const outputAnalyser = ctx.createAnalyser();
    outputAnalyser.fftSize = 4096;
    outputAnalyser.smoothingTimeConstant = 0.8;
    const monitorGain = ctx.createGain();
    const monitorDest = ctx.createMediaStreamDestination();
    const sendDest = ctx.createMediaStreamDestination();
    const recordDest = ctx.createMediaStreamDestination();

    inputGain.connect(inputAnalyser);
    inputGain.connect(gate.input);
    gate.output.connect(pitch.input);
    gate.output.connect(harmonizer.input);
    pitch.output.connect(voiceSum);
    harmonizer.output.connect(voiceSum);

    const chain = [ringmod, vocoder, distortion, bitcrusher, filter, eq, compressor, modulation, delay, reverb, noise];
    let node: AudioNode = voiceSum;
    for (const m of chain) {
      node.connect(m.input);
      node = m.output;
    }
    node.connect(procGain);
    inputGain.connect(rawGain);
    procGain.connect(talkGain);
    rawGain.connect(talkGain);
    talkGain.connect(masterGain);
    masterGain.connect(limiter);
    soundboardBus.connect(limiter);
    limiter.connect(muteGain);
    muteGain.connect(outputAnalyser);
    muteGain.connect(monitorGain);
    monitorGain.connect(ctx.destination);
    muteGain.connect(sendDest);
    muteGain.connect(recordDest);

    return {
      inputGain, inputAnalyser, gate, pitch, harmonizer, ringmod, vocoder, distortion, bitcrusher, filter, eq,
      compressor, modulation, delay, reverb, noise, procGain, rawGain, talkGain, masterGain, soundboardBus,
      limiter, muteGain, outputAnalyser, monitorGain, monitorDest, sendDest, recordDest,
    };
  }

  applyParams(params: VoiceParams, force = false): void {
    if (!force && params === this.params) return;
    this.params = params;
    const g = this.g;
    if (!g || !this.ctx) return;
    g.gate.update(params.gate);
    g.pitch.update(params.pitch, params.autotune);
    g.harmonizer.update(params.harmonizer);
    g.ringmod.update(params.ringmod);
    g.vocoder.update(params.vocoder);
    g.distortion.update(params.distortion);
    g.bitcrusher.update(params.bitcrusher);
    g.filter.update(params.filter);
    g.eq.update(params.eq);
    g.compressor.update(params.compressor);
    g.modulation.update(params.modulation);
    g.delay.update(params.delay);
    g.reverb.update(params.reverb);
    g.noise.update(params.noise);
    ramp(g.masterGain.gain, dbToGain(params.master.gain), this.ctx);
  }

  // ---- Input ------------------------------------------------------------

  async loadFile(file: File): Promise<void> {
    const ctx = this.ctx ?? new OfflineAudioContext(1, 1, 48000);
    const data = await file.arrayBuffer();
    this.fileBuffer = await ctx.decodeAudioData(data);
    this.fileName = file.name;
  }

  async setInput(cfg: InputConfig): Promise<void> {
    this.inputConfig = cfg;
    const ctx = this.ctx;
    const g = this.g;
    if (!ctx || !g) return;
    ramp(g.inputGain.gain, dbToGain(cfg.gainDb), ctx);
    this.stopSource();

    if (cfg.source === 'mic') {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: cfg.deviceId ? { exact: cfg.deviceId } : undefined,
            echoCancellation: cfg.mic.echoCancellation,
            noiseSuppression: cfg.mic.noiseSuppression,
            autoGainControl: cfg.mic.autoGainControl,
            channelCount: { ideal: 1 },
          },
        });
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') throw new EngineError('permission');
        if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new EngineError('nodevice');
        if (name === 'NotReadableError' || name === 'AbortError') throw new EngineError('busy');
        throw new EngineError('generic', String(err));
      }
      if (!this.ctx) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        return;
      }
      const track = this.stream.getAudioTracks()[0];
      track?.addEventListener('ended', () => this.emit('error', new EngineError('nodevice')));
      const src = ctx.createMediaStreamSource(this.stream);
      src.connect(g.inputGain);
      this.source = src;
      return;
    }

    let buffer: AudioBuffer | null;
    if (cfg.source === 'test') {
      if (!this.testBuffer) {
        const data = synthTestVoice(ctx.sampleRate);
        this.testBuffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
        this.testBuffer.copyToChannel(data, 0);
      }
      buffer = this.testBuffer;
    } else {
      buffer = this.fileBuffer;
      if (!buffer) throw new EngineError('nofile');
    }
    const src = ctx.createBufferSource();
    loopSource(src, buffer);
    src.connect(g.inputGain);
    src.start();
    this.source = src;
  }

  setInputGain(db: number): void {
    if (this.g && this.ctx) ramp(this.g.inputGain.gain, dbToGain(db), this.ctx);
  }

  /** Device list in the current input (labels are only exposed once permission is granted). */
  get inputLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? '';
  }

  private stopSource(): void {
    if (this.source instanceof AudioBufferSourceNode) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  // ---- Outputs ----------------------------------------------------------

  async setOutputs(cfg: OutputConfig): Promise<void> {
    const ctx = this.ctx;
    const g = this.g;
    if (!ctx || !g) return;
    ramp(g.monitorGain.gain, cfg.monitorEnabled ? cfg.monitorVolume : 0, ctx, 0.03);

    const monitorId = cfg.monitorDeviceId && cfg.monitorDeviceId !== 'default' ? cfg.monitorDeviceId : '';
    const viaElement = !!monitorId && !supports.contextSinkId && supports.elementSinkId;
    if (viaElement !== this.monitorViaElement) {
      g.monitorGain.disconnect();
      g.monitorGain.connect(viaElement ? g.monitorDest : ctx.destination);
      this.monitorViaElement = viaElement;
    }
    try {
      if (viaElement) {
        await this.routeElement(this.monitorEl, g.monitorDest.stream, monitorId);
      } else {
        this.monitorEl.pause();
        const c = ctx as AudioContext & { sinkId?: string; setSinkId?: (id: string) => Promise<void> };
        if (c.setSinkId && (c.sinkId ?? '') !== monitorId) await c.setSinkId(monitorId);
      }
    } catch (err) {
      this.emit('error', new EngineError('sink', String(err)));
    }

    try {
      if (cfg.sendEnabled && cfg.sendDeviceId && supports.elementSinkId) {
        await this.routeElement(this.sendEl, g.sendDest.stream, cfg.sendDeviceId);
      } else {
        this.sendEl.pause();
      }
    } catch (err) {
      this.sendEl.pause();
      this.emit('error', new EngineError('sink', String(err)));
    }
  }

  private async routeElement(el: HTMLAudioElement, stream: MediaStream, deviceId: string): Promise<void> {
    if (el.srcObject !== stream) el.srcObject = stream;
    const e = el as HTMLAudioElement & { sinkId?: string; setSinkId?: (id: string) => Promise<void> };
    if (e.setSinkId && e.sinkId !== deviceId) await e.setSinkId(deviceId);
    if (el.paused) await el.play();
  }

  // ---- Live controls ----------------------------------------------------

  setBypass(on: boolean): void {
    this.bypass = on;
    this.applyGates();
  }

  setMuted(on: boolean): void {
    this.muted = on;
    this.applyGates();
  }

  /** Push-to-talk: false silences the voice (soundboard still plays). */
  setTalkOpen(open: boolean): void {
    this.talkOpen = open;
    this.applyGates();
  }

  private applyGates(): void {
    const g = this.g;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    ramp(g.procGain.gain, this.bypass ? 0 : 1, ctx, 0.01);
    ramp(g.rawGain.gain, this.bypass ? 1 : 0, ctx, 0.01);
    ramp(g.talkGain.gain, this.talkOpen ? 1 : 0, ctx, 0.008);
    ramp(g.muteGain.gain, this.muted ? 0 : 1, ctx, 0.01);
  }

  private onVoice(open: boolean): void {
    this.voiceActive = open;
    this.g?.noise.setVoiceActive(open && this.talkOpen);
    this.emit('voice', open);
  }

  get isVoiceActive(): boolean {
    return this.voiceActive;
  }

  // ---- Soundboard / recording taps -------------------------------------

  playSample(buffer: AudioBuffer, volume: number): () => void {
    const ctx = this.ctx;
    const g = this.g;
    if (!ctx || !g) return () => {};
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(g.soundboardBus);
    src.start();
    src.onended = () => gain.disconnect();
    return () => {
      try {
        src.stop();
      } catch {
        /* ended */
      }
    };
  }

  /** Processed output as a MediaStream (for MediaRecorder). */
  get recordStream(): MediaStream | null {
    return this.g?.recordDest.stream ?? null;
  }

  /** Connect a node (e.g. the PCM capture worklet) to the final output. */
  tapOutput(node: AudioNode): () => void {
    const g = this.g;
    if (!g) return () => {};
    g.muteGain.connect(node);
    return () => {
      try {
        g.muteGain.disconnect(node);
      } catch {
        /* graph gone */
      }
    };
  }

  // ---- Metering ---------------------------------------------------------

  getLevels(): Levels {
    const g = this.g;
    if (!g) return { inPeak: -120, inRms: -120, outPeak: -120, outRms: -120 };
    const measure = (a: AnalyserNode) => {
      if (this.timeBuf.length !== a.fftSize) this.timeBuf = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(this.timeBuf);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < this.timeBuf.length; i++) {
        const v = this.timeBuf[i];
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
        sum += v * v;
      }
      return [dbOf(peak), dbOf(Math.sqrt(sum / this.timeBuf.length))];
    };
    const [inPeak, inRms] = measure(g.inputAnalyser);
    const [outPeak, outRms] = measure(g.outputAnalyser);
    return { inPeak, inRms, outPeak, outRms };
  }

  /** Current gain reduction of the voice compressor, in dB (≤ 0). */
  getCompressorReduction(): number {
    return this.g?.compressor.comp.reduction ?? 0;
  }

  getAnalyser(which: 'in' | 'out'): AnalyserNode | null {
    return this.g ? (which === 'in' ? this.g.inputAnalyser : this.g.outputAnalyser) : null;
  }

  getPitch(): PitchInfo {
    const r = this.pitchReport;
    if (r.freq <= 0) return { inHz: 0, outHz: 0 };
    const p = this.params;
    const semis = (p.pitch.enabled ? p.pitch.semitones : 0) + r.correction;
    const shifted = p.pitch.enabled || p.autotune.enabled;
    return { inHz: r.freq, outHz: shifted && !this.bypass ? r.freq * Math.pow(2, semis / 12) : r.freq };
  }

  /** Estimated mic-to-output latency in ms. */
  getLatencyMs(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const c = ctx as AudioContext & { outputLatency?: number };
    let ms = ((ctx.baseLatency ?? 0) + (c.outputLatency ?? 0)) * 1000;
    const track = this.stream?.getAudioTracks()[0];
    const inLat = (track?.getSettings() as MediaTrackSettings & { latency?: number })?.latency;
    if (typeof inLat === 'number') ms += inLat * 1000;
    const p = this.params;
    const shifting = (p.pitch.enabled && (p.pitch.semitones !== 0 || (p.pitch.mode === 'hq' && p.pitch.formant !== 0))) || p.autotune.enabled;
    if (shifting && !this.bypass) {
      const N = ctx.sampleRate > 60000 ? 4096 : 2048;
      ms += p.pitch.mode === 'hq' ? ((N * 3) / 4 / ctx.sampleRate) * 1000 : 17.5;
    }
    return ms;
  }

  /** Used when restarting the input after a device or option change. */
  get currentInput(): InputConfig | null {
    return this.inputConfig;
  }
}

export const engine = new AudioEngine();
