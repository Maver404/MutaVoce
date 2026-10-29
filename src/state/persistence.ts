import { del, get, set } from 'idb-keyval';
import type { AppState } from './store';

const KEY = 'mutavoce:v1';

export type Persisted = Partial<
  Pick<
    AppState,
    | 'params'
    | 'activePresetId'
    | 'modified'
    | 'input'
    | 'output'
    | 'customPresets'
    | 'favorites'
    | 'lang'
    | 'theme'
    | 'visualMode'
    | 'collapsed'
    | 'activeOnly'
    | 'ptt'
    | 'recordFormat'
    | 'pads'
    | 'seenWelcome'
  >
>;

export function loadPersisted(): Persisted {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

export function pickPersisted(s: AppState): Persisted {
  return {
    params: s.params,
    activePresetId: s.activePresetId,
    modified: s.modified,
    input: s.input,
    output: s.output,
    customPresets: s.customPresets,
    favorites: s.favorites,
    lang: s.lang,
    theme: s.theme,
    visualMode: s.visualMode,
    collapsed: s.collapsed,
    activeOnly: s.activeOnly,
    ptt: s.ptt,
    recordFormat: s.recordFormat,
    pads: s.pads,
    seenWelcome: s.seenWelcome,
  };
}

/** Returns false when storage is unavailable or full. */
export function savePersisted(data: Persisted): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Custom soundboard samples live in IndexedDB (they can be megabytes).
const padKey = (id: string) => `mutavoce:pad:${id}`;

export async function savePadAudio(id: string, data: ArrayBuffer): Promise<void> {
  await set(padKey(id), data);
}

export async function loadPadAudio(id: string): Promise<ArrayBuffer | undefined> {
  try {
    return await get<ArrayBuffer>(padKey(id));
  } catch {
    return undefined;
  }
}

export async function deletePadAudio(id: string): Promise<void> {
  try {
    await del(padKey(id));
  } catch {
    /* ignore */
  }
}
