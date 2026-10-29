import type { AudioEngine } from '../AudioEngine';
import { loadPadAudio } from '../../state/persistence';
import type { PadConfig } from '../../state/store';
import { renderBuiltinSound } from './synthSounds';

/** Decodes/synthesises pad sounds lazily (per sample rate) and plays them into the engine. */
export class Soundboard {
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private playing = new Map<string, () => void>();
  private rate = 0;

  constructor(private readonly engine: AudioEngine) {}

  private async load(pad: PadConfig): Promise<AudioBuffer | null> {
    const ctx = this.engine.ctx;
    if (!ctx) return null;
    if (ctx.sampleRate !== this.rate) {
      this.buffers.clear();
      this.pending.clear();
      this.rate = ctx.sampleRate;
    }
    const cached = this.buffers.get(pad.id);
    if (cached) return cached;
    let p = this.pending.get(pad.id);
    if (!p) {
      p = (async () => {
        try {
          let buf: AudioBuffer | null = null;
          if (pad.kind === 'builtin' && pad.sound) buf = await renderBuiltinSound(pad.sound, ctx.sampleRate);
          else {
            const data = await loadPadAudio(pad.id);
            if (data) buf = await ctx.decodeAudioData(data.slice(0));
          }
          if (buf) this.buffers.set(pad.id, buf);
          return buf;
        } finally {
          this.pending.delete(pad.id);
        }
      })();
      this.pending.set(pad.id, p);
    }
    return p;
  }

  /** Pre-render the built-ins so the first press is instant. */
  async warm(pads: PadConfig[]): Promise<void> {
    await Promise.all(pads.filter((p) => p.kind === 'builtin').map((p) => this.load(p)));
  }

  /** Plays the pad; pressing a pad that is still playing restarts it. */
  async play(pad: PadConfig): Promise<boolean> {
    const buf = await this.load(pad);
    if (!buf) return false;
    this.playing.get(pad.id)?.();
    const stop = this.engine.playSample(buf, pad.volume);
    this.playing.set(pad.id, stop);
    setTimeout(() => {
      if (this.playing.get(pad.id) === stop) this.playing.delete(pad.id);
    }, buf.duration * 1000 + 50);
    return true;
  }

  stopAll(): void {
    this.playing.forEach((stop) => stop());
    this.playing.clear();
  }

  forget(id: string): void {
    this.buffers.delete(id);
  }
}
