import type { AudioEngine } from './AudioEngine';
import type { ProcessorEvent } from './worklets/messages';
import { encodeWav } from './wav';

export type RecordFormat = 'webm' | 'wav';

export interface Take {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  format: RecordFormat;
  durationSec: number;
  createdAt: number;
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export const extensionFor = (blob: Blob, format: RecordFormat) =>
  format === 'wav' ? 'wav' : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';

/** Records the processed output either compressed (MediaRecorder) or lossless (PCM → WAV). */
export class Recorder {
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private pcm: Float32Array[][] = [];
  private capture: AudioWorkletNode | null = null;
  private untap: (() => void) | null = null;
  private startedAt = 0;
  private format: RecordFormat = 'webm';

  constructor(private readonly engine: AudioEngine) {}

  get recording(): boolean {
    return this.startedAt > 0;
  }

  get elapsed(): number {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  start(format: RecordFormat): void {
    if (this.recording) return;
    const ctx = this.engine.ctx;
    if (!ctx) throw new Error('engine not running');
    this.format = format;
    if (format === 'wav') {
      this.pcm = [];
      this.capture = new AudioWorkletNode(ctx, 'mv-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 2,
        channelCountMode: 'explicit',
      });
      this.capture.port.onmessage = (e: MessageEvent<ProcessorEvent>) => {
        if (e.data.type === 'chunk') this.pcm.push(e.data.channels);
      };
      this.untap = this.engine.tapOutput(this.capture);
      this.capture.port.postMessage({ recording: true });
    } else {
      const stream = this.engine.recordStream;
      if (!stream) throw new Error('no stream');
      const mime = pickMime();
      this.chunks = [];
      this.media = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined);
      this.media.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.media.start(250);
    }
    this.startedAt = performance.now();
  }

  async stop(name: string): Promise<Take | null> {
    if (!this.recording) return null;
    const durationSec = this.elapsed;
    this.startedAt = 0;
    let blob: Blob;
    if (this.format === 'wav' && this.capture) {
      const capture = this.capture;
      const done = new Promise<void>((resolve) => setTimeout(resolve, 120));
      capture.port.postMessage({ recording: false });
      await done;
      this.untap?.();
      capture.port.onmessage = null;
      this.capture = null;
      const frames = this.pcm.reduce((n, c) => n + c[0].length, 0);
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      let off = 0;
      for (const [l, r] of this.pcm) {
        left.set(l, off);
        right.set(r, off);
        off += l.length;
      }
      this.pcm = [];
      blob = new Blob([encodeWav([left, right], this.engine.sampleRate)], { type: 'audio/wav' });
    } else if (this.media) {
      const media = this.media;
      const stopped = new Promise<void>((resolve) => (media.onstop = () => resolve()));
      media.stop();
      await stopped;
      blob = new Blob(this.chunks, { type: media.mimeType || 'audio/webm' });
      this.media = null;
      this.chunks = [];
    } else {
      return null;
    }
    return {
      id: crypto.randomUUID(),
      name,
      blob,
      url: URL.createObjectURL(blob),
      format: this.format,
      durationSec,
      createdAt: Date.now(),
    };
  }
}
