import { PARAMS_VERSION, sanitizeParams, type VoiceParams } from '../state/params';
import type { VoicePreset } from './types';

export const FILE_MAGIC = 'mutavoce';

export interface PresetFile {
  app: typeof FILE_MAGIC;
  type: 'preset' | 'bank';
  version: number;
  presets: VoicePreset[];
}

export function makeCustomPreset(name: string, params: VoiceParams, icon = '⭐'): VoicePreset {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: { it: name, en: name },
    category: 'custom',
    icon,
    params: structuredClone(params),
    version: PARAMS_VERSION,
  };
}

export function exportPresets(presets: VoicePreset[]): string {
  const file: PresetFile = {
    app: FILE_MAGIC,
    type: presets.length === 1 ? 'preset' : 'bank',
    version: PARAMS_VERSION,
    presets: presets.map((p) => ({ ...p, builtin: undefined })),
  };
  return JSON.stringify(file, null, 2);
}

/** Upgrade older preset shapes to the current one. v1 is the first format. */
function migrate(raw: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let p = raw;
  if (fromVersion < 1) {
    // Pre-release files stored params at the top level.
    p = { ...p, params: p.params ?? {} };
  }
  return p;
}

function text(v: unknown, fallback: string): { it: string; en: string } {
  if (typeof v === 'string') return { it: v.slice(0, 60), en: v.slice(0, 60) };
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const it = typeof o.it === 'string' ? o.it : typeof o.en === 'string' ? o.en : fallback;
    const en = typeof o.en === 'string' ? o.en : it;
    return { it: it.slice(0, 60), en: en.slice(0, 60) };
  }
  return { it: fallback, en: fallback };
}

/**
 * Parse a preset file (single or bank). Every preset is re-identified as a custom preset and
 * its params are sanitised, so a hand-edited or malicious file can't break the engine.
 */
export function importPresets(json: string): VoicePreset[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('invalid-json');
  }
  if (!data || typeof data !== 'object') throw new Error('invalid-file');
  const file = data as Partial<PresetFile> & { presets?: unknown };
  const version = typeof file.version === 'number' ? file.version : 0;
  if (version > PARAMS_VERSION) throw new Error('newer-version');
  const list = Array.isArray(file.presets) ? file.presets : file.app === undefined && 'params' in file ? [file] : null;
  if (!list) throw new Error('invalid-file');
  return list.slice(0, 200).map((entry, i) => {
    const raw = migrate((entry ?? {}) as Record<string, unknown>, version);
    return {
      id: `custom-${crypto.randomUUID()}`,
      name: text(raw.name, `Preset ${i + 1}`),
      category: 'custom' as const,
      icon: typeof raw.icon === 'string' && raw.icon.length <= 8 ? raw.icon : '⭐',
      params: sanitizeParams(raw.params),
      version: PARAMS_VERSION,
    };
  });
}
