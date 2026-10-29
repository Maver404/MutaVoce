import { EngineError, engine } from '../audio/AudioEngine';
import { findVirtualOutput, listDevices, pickAudioOutput } from '../audio/devices';
import { extensionFor, Recorder } from '../audio/Recorder';
import { Soundboard } from '../audio/soundboard/Soundboard';
import { t } from '../i18n';
import { BUILTIN_PRESETS } from '../presets/builtin';
import { exportPresets, importPresets, makeCustomPreset } from '../presets/presetIO';
import type { VoicePreset } from '../presets/types';
import { deletePadAudio, savePadAudio } from './persistence';
import { getState, type PadConfig } from './store';

export const recorder = new Recorder(engine);
export const soundboard = new Soundboard(engine);

const st = getState;

// ---- Engine lifecycle ----------------------------------------------------

export async function startAudio(source?: 'mic' | 'test'): Promise<void> {
  const s = st();
  if (s.status !== 'idle') return;
  if (source) s.setInput({ source });
  s.set({ status: 'starting', error: null });
  try {
    const { params, input, output } = st();
    await engine.start(params, { ...input }, output);
    engine.setBypass(st().bypass);
    engine.setMuted(st().muted);
    engine.setTalkOpen(isTalkOpen());
    st().set({ status: 'running' });
    await refreshDevices();
    soundboard.warm(st().pads).catch(() => {});
  } catch (err) {
    const code = err instanceof EngineError ? err.code : 'generic';
    st().set({ status: 'idle', error: code });
    st().toast(t(`errors.${code}`), 'error');
  }
}

export async function stopAudio(): Promise<void> {
  if (recorder.recording) await toggleRecording();
  soundboard.stopAll();
  await engine.stop();
  st().set({ status: 'idle', voiceActive: false });
}

export async function toggleAudio(): Promise<void> {
  const status = st().status;
  if (status === 'running') await stopAudio();
  else if (status === 'idle') await startAudio();
}

export function isTalkOpen(): boolean {
  const { ptt, pttHeld } = st();
  return ptt.mode === 'off' || pttHeld;
}

// ---- Devices --------------------------------------------------------------

export async function refreshDevices(): Promise<void> {
  try {
    const devices = await listDevices();
    const s = st();
    const output = { ...s.output };
    // Forget devices that disappeared.
    if (output.sendDeviceId && !devices.outputs.some((d) => d.deviceId === output.sendDeviceId)) {
      if (devices.outputs.length) output.sendDeviceId = null;
    }
    if (output.monitorDeviceId && !devices.outputs.some((d) => d.deviceId === output.monitorDeviceId)) {
      if (devices.outputs.length) output.monitorDeviceId = null;
    }
    s.set({ devices, output });
  } catch {
    /* enumerateDevices unavailable */
  }
}

export async function chooseOutputWithPicker(target: 'monitor' | 'send'): Promise<void> {
  const d = await pickAudioOutput();
  if (!d) return;
  const s = st();
  if (!s.devices.outputs.some((o) => o.deviceId === d.deviceId)) {
    s.set({ devices: { ...s.devices, outputs: [...s.devices.outputs, d] } });
  }
  if (target === 'monitor') s.setOutput({ monitorDeviceId: d.deviceId });
  else s.setOutput({ sendDeviceId: d.deviceId, sendEnabled: true });
}

/** Select the detected virtual cable as the send target and switch sending on. */
export function selectVirtualCable(): boolean {
  const s = st();
  const v = findVirtualOutput(s.devices.outputs);
  if (!v) return false;
  s.setOutput({ sendDeviceId: v.deviceId, sendEnabled: true });
  s.toast(t('toast.sendingTo', { name: v.label }));
  return true;
}

export async function loadInputFile(file: File): Promise<void> {
  try {
    await engine.loadFile(file);
    st().set({ fileName: file.name });
    st().setInput({ source: 'file' });
  } catch {
    st().toast(t('soundboard.decodeError'), 'error');
  }
}

// ---- Presets --------------------------------------------------------------

export function allPresets(): VoicePreset[] {
  return [...BUILTIN_PRESETS, ...st().customPresets];
}

export function findPreset(id: string | null): VoicePreset | undefined {
  return id ? allPresets().find((p) => p.id === id) : undefined;
}

export function selectPreset(id: string): void {
  const p = findPreset(id);
  if (p) st().applyPreset(p);
}

export function stepPreset(dir: 1 | -1): void {
  const list = allPresets();
  const idx = list.findIndex((p) => p.id === st().activePresetId);
  const next = list[(idx + dir + list.length) % list.length];
  st().applyPreset(next);
}

export function selectFavoriteSlot(n: number): void {
  const id = st().favorites.filter((f) => findPreset(f))[n - 1];
  if (id) selectPreset(id);
}

export function saveCurrentAsPreset(name: string): VoicePreset {
  const s = st();
  const base = findPreset(s.activePresetId);
  const preset = makeCustomPreset(name.trim() || t('presets.none'), s.params, base?.icon ?? '⭐');
  s.addCustomPresets([preset]);
  s.set({ activePresetId: preset.id, modified: false });
  s.toast(t('toast.presetSaved'));
  return preset;
}

export function duplicatePreset(id: string): void {
  const p = findPreset(id);
  if (!p) return;
  const copy = makeCustomPreset(`${p.name[st().lang]} (${t('presets.copy')})`, st().params, p.icon);
  copy.params = structuredClone(p.params);
  st().addCustomPresets([copy]);
}

export function downloadText(name: string, text: string, type = 'application/json'): void {
  downloadBlob(name, new Blob([text], { type }));
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'preset';

export function exportPresetFile(ids?: string[]): void {
  const s = st();
  const list = ids ? allPresets().filter((p) => ids.includes(p.id)) : s.customPresets;
  if (!list.length) return;
  const name = list.length === 1 ? `${slug(list[0].name[s.lang])}.mutavoce.json` : 'mutavoce-presets.json';
  downloadText(name, exportPresets(list));
}

export async function importPresetFile(file: File): Promise<void> {
  try {
    const presets = importPresets(await file.text());
    st().addCustomPresets(presets);
    st().toast(t('presets.imported', { n: presets.length }));
  } catch {
    st().toast(t('presets.importError'), 'error');
  }
}

// ---- Recorder -------------------------------------------------------------

export async function toggleRecording(): Promise<void> {
  const s = st();
  if (recorder.recording) {
    const take = await recorder.stop(t('recorder.take', { n: s.takes.length + 1 }));
    st().set({ recording: false });
    if (take) {
      st().set({ takes: [take, ...st().takes] });
      st().toast(t('toast.recorded'));
    }
    return;
  }
  if (s.status !== 'running') {
    s.toast(t('recorder.needsEngine'));
    return;
  }
  recorder.start(s.recordFormat);
  s.set({ recording: true });
}

export function downloadTake(id: string): void {
  const take = st().takes.find((tk) => tk.id === id);
  if (!take) return;
  const stamp = new Date(take.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(`mutavoce-${stamp}.${extensionFor(take.blob, take.format)}`, take.blob);
}

export function deleteTake(id: string): void {
  const take = st().takes.find((tk) => tk.id === id);
  if (take) URL.revokeObjectURL(take.url);
  st().set({ takes: st().takes.filter((tk) => tk.id !== id) });
}

// ---- Soundboard -----------------------------------------------------------

export async function playPad(id: string): Promise<void> {
  const s = st();
  const pad = s.pads.find((p) => p.id === id);
  if (!pad) return;
  if (s.status !== 'running') {
    s.toast(t('soundboard.needsEngine'));
    return;
  }
  await soundboard.play(pad);
}

const MAX_PAD_BYTES = 10 * 1024 * 1024;

export async function addCustomPads(files: FileList | File[]): Promise<void> {
  for (const file of Array.from(files)) {
    if (file.size > MAX_PAD_BYTES) {
      st().toast(t('soundboard.tooLarge'), 'error');
      continue;
    }
    const data = await file.arrayBuffer();
    try {
      // Validate it decodes before keeping it.
      const ctx = engine.ctx ?? new OfflineAudioContext(1, 1, 48000);
      await ctx.decodeAudioData(data.slice(0));
    } catch {
      st().toast(t('soundboard.decodeError'), 'error');
      continue;
    }
    const pad: PadConfig = {
      id: `custom-${crypto.randomUUID()}`,
      kind: 'custom',
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 24),
      icon: '🔊',
      volume: 0.8,
      key: null,
    };
    try {
      await savePadAudio(pad.id, data);
    } catch {
      st().toast(t('toast.storageFull'), 'error');
      continue;
    }
    st().set({ pads: [...st().pads, pad] });
  }
}

export async function deletePad(id: string): Promise<void> {
  const pad = st().pads.find((p) => p.id === id);
  if (!pad) return;
  if (pad.kind === 'custom') await deletePadAudio(id);
  soundboard.forget(id);
  st().set({ pads: st().pads.filter((p) => p.id !== id) });
}
