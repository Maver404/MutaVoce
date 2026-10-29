import { create } from 'zustand';
import type { EngineErrorCode, InputSource, MicOptions, OutputConfig } from '../audio/AudioEngine';
import type { DeviceLists } from '../audio/devices';
import type { RecordFormat, Take } from '../audio/Recorder';
import { BUILTIN_SOUNDS, type BuiltinSoundId } from '../audio/soundboard/synthSounds';
import { NEUTRAL_PRESET } from '../presets/builtin';
import type { VoicePreset } from '../presets/types';
import { DEFAULT_PARAMS, type EqBand, type ModuleId, paramsFromPreset, sanitizeParams, type VoiceParams } from './params';
import { loadPersisted } from './persistence';

export type Lang = 'it' | 'en';
export type Theme = 'dark' | 'light';
export type VisualMode = 'spectrum' | 'spectrogram' | 'scope';
export type PttMode = 'off' | 'hold' | 'toggle';
export type ModalId = 'start' | 'guide' | 'shortcuts' | 'savePreset' | 'renamePreset' | null;
export type EngineStatus = 'idle' | 'starting' | 'running';
export type MobileTab = 'presets' | 'effects' | 'io';
export type RightTab = 'audio' | 'sounds' | 'record';

export interface InputSettings {
  source: InputSource;
  deviceId: string | null;
  gainDb: number;
  mic: MicOptions;
}

export interface PadConfig {
  id: string;
  kind: 'builtin' | 'custom';
  sound?: BuiltinSoundId;
  name?: string;
  icon: string;
  volume: number;
  /** KeyboardEvent.code, optionally prefixed with "Shift+". */
  key: string | null;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

export const DEFAULT_PADS: PadConfig[] = BUILTIN_SOUNDS.map((s, i) => ({
  id: `builtin-${s.id}`,
  kind: 'builtin',
  sound: s.id,
  icon: s.icon,
  volume: 0.7,
  key: i < 9 ? `Shift+Digit${i + 1}` : null,
}));

export interface AppState {
  params: VoiceParams;
  activePresetId: string | null;
  modified: boolean;

  status: EngineStatus;
  error: EngineErrorCode | null;
  voiceActive: boolean;
  bypass: boolean;
  muted: boolean;
  pttHeld: boolean;

  input: InputSettings;
  output: OutputConfig;
  devices: DeviceLists;
  fileName: string;

  customPresets: VoicePreset[];
  favorites: string[];

  lang: Lang;
  theme: Theme;
  visualMode: VisualMode;
  collapsed: Partial<Record<ModuleId, boolean>>;
  activeOnly: boolean;
  ptt: { mode: PttMode; key: string };
  recordFormat: RecordFormat;
  takes: Take[];
  recording: boolean;
  pads: PadConfig[];
  modal: ModalId;
  modalTarget: string | null;
  mobileTab: MobileTab;
  rightTab: RightTab;
  /** 'ptt' or a pad id while waiting for a key press to bind. */
  capturing: string | null;
  eqSelected: number | null;
  toasts: Toast[];
  seenWelcome: boolean;
}

export interface AppActions {
  setParam<M extends keyof VoiceParams, K extends keyof VoiceParams[M]>(module: M, key: K, value: VoiceParams[M][K]): void;
  setModuleEnabled(module: ModuleId, enabled: boolean): void;
  resetModule(module: ModuleId): void;
  setEqBand(index: number, band: Partial<EqBand>): void;
  applyPreset(preset: VoicePreset): void;
  resetAll(): void;

  set(partial: Partial<AppState>): void;
  setInput(partial: Partial<InputSettings>): void;
  setMic(partial: Partial<MicOptions>): void;
  setOutput(partial: Partial<OutputConfig>): void;

  toggleFavorite(id: string): void;
  addCustomPresets(presets: VoicePreset[]): void;
  updateCustomPreset(id: string, patch: Partial<VoicePreset>): void;
  deleteCustomPreset(id: string): void;

  toggleCollapsed(id: ModuleId): void;
  setAllCollapsed(collapsed: boolean): void;
  updatePad(id: string, patch: Partial<PadConfig>): void;
  openModal(modal: ModalId, target?: string | null): void;
  closeModal(): void;
  toast(text: string, kind?: Toast['kind']): void;
}

const persisted = loadPersisted();

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'it';
  return navigator.language?.toLowerCase().startsWith('it') ? 'it' : navigator.language ? 'en' : 'it';
}

let toastId = 0;

export const useApp = create<AppState & AppActions>()((set, get) => ({
  params: persisted.params ? sanitizeParams(persisted.params) : paramsFromPreset(NEUTRAL_PRESET.params),
  activePresetId: persisted.activePresetId ?? NEUTRAL_PRESET.id,
  modified: persisted.modified ?? false,

  status: 'idle',
  error: null,
  voiceActive: false,
  bypass: false,
  muted: false,
  pttHeld: false,

  input: {
    source: 'mic',
    deviceId: null,
    gainDb: 0,
    mic: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    ...persisted.input,
    ...(persisted.input?.source === 'file' ? { source: 'mic' as const } : {}),
  },
  output: {
    monitorEnabled: true,
    monitorDeviceId: null,
    monitorVolume: 0.8,
    sendEnabled: false,
    sendDeviceId: null,
    ...persisted.output,
  },
  devices: { inputs: [], outputs: [] },
  fileName: '',

  customPresets: persisted.customPresets ?? [],
  favorites: persisted.favorites ?? ['clean', 'podcast', 'chipmunk', 'demon', 'robot', 'telephone'],

  lang: persisted.lang ?? detectLang(),
  theme: persisted.theme ?? 'dark',
  visualMode: persisted.visualMode ?? 'spectrum',
  collapsed: persisted.collapsed ?? {},
  activeOnly: persisted.activeOnly ?? false,
  ptt: persisted.ptt ?? { mode: 'off', key: 'Space' },
  recordFormat: persisted.recordFormat ?? 'webm',
  takes: [],
  recording: false,
  pads: persisted.pads?.length ? persisted.pads : DEFAULT_PADS,
  modal: persisted.seenWelcome ? null : 'start',
  modalTarget: null,
  mobileTab: 'effects',
  rightTab: 'audio',
  capturing: null,
  eqSelected: null,
  toasts: [],
  seenWelcome: persisted.seenWelcome ?? false,

  setParam(module, key, value) {
    const params = get().params;
    set({ params: { ...params, [module]: { ...params[module], [key]: value } }, modified: true });
  },
  setModuleEnabled(module, enabled) {
    const params = get().params;
    set({ params: { ...params, [module]: { ...params[module], enabled } }, modified: true });
  },
  resetModule(module) {
    const params = get().params;
    set({ params: { ...params, [module]: { ...DEFAULT_PARAMS[module], enabled: params[module].enabled } }, modified: true });
  },
  setEqBand(index, band) {
    const params = get().params;
    const bands = params.eq.bands.map((b, i) => (i === index ? { ...b, ...band } : b));
    set({ params: { ...params, eq: { ...params.eq, bands, enabled: true } }, modified: true });
  },
  applyPreset(preset) {
    set({ params: paramsFromPreset(preset.params), activePresetId: preset.id, modified: false });
  },
  resetAll() {
    set({ params: DEFAULT_PARAMS, activePresetId: NEUTRAL_PRESET.id, modified: false });
  },

  set(partial) {
    set(partial);
  },
  setInput(partial) {
    set({ input: { ...get().input, ...partial } });
  },
  setMic(partial) {
    const input = get().input;
    set({ input: { ...input, mic: { ...input.mic, ...partial } } });
  },
  setOutput(partial) {
    set({ output: { ...get().output, ...partial } });
  },

  toggleFavorite(id) {
    const fav = get().favorites;
    set({ favorites: fav.includes(id) ? fav.filter((f) => f !== id) : [...fav, id] });
  },
  addCustomPresets(presets) {
    set({ customPresets: [...get().customPresets, ...presets] });
  },
  updateCustomPreset(id, patch) {
    set({ customPresets: get().customPresets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  },
  deleteCustomPreset(id) {
    const s = get();
    set({
      customPresets: s.customPresets.filter((p) => p.id !== id),
      favorites: s.favorites.filter((f) => f !== id),
      activePresetId: s.activePresetId === id ? null : s.activePresetId,
      modified: s.activePresetId === id ? true : s.modified,
    });
  },

  toggleCollapsed(id) {
    const c = get().collapsed;
    set({ collapsed: { ...c, [id]: !c[id] } });
  },
  setAllCollapsed(collapsed) {
    const next: Partial<Record<ModuleId, boolean>> = {};
    for (const k of Object.keys(DEFAULT_PARAMS) as (keyof VoiceParams)[]) if (k !== 'master') next[k] = collapsed;
    set({ collapsed: next });
  },
  updatePad(id, patch) {
    set({ pads: get().pads.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  },
  openModal(modal, target = null) {
    set({ modal, modalTarget: target });
  },
  closeModal() {
    const s = get();
    set({ modal: null, modalTarget: null, seenWelcome: s.seenWelcome || s.modal === 'start' });
  },
  toast(text, kind = 'info') {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 6000 : 3500);
  },
}));

export const getState = () => useApp.getState();
