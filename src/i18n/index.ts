import { useCallback } from 'react';
import type { LocalizedText } from '../presets/types';
import { getState, type Lang, useApp } from '../state/store';
import { en } from './en';
import { it, type TKey } from './it';

const DICTS: Record<Lang, Record<TKey, string>> = { it, en };

export type { TKey };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? it[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Translate outside React (actions, toasts). */
export const t = (key: TKey, vars?: Record<string, string | number>) => translate(getState().lang, key, vars);

export function useT() {
  const lang = useApp((s) => s.lang);
  return useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function useLocalized() {
  const lang = useApp((s) => s.lang);
  return useCallback((text: LocalizedText | undefined) => (text ? text[lang] || text.it : ''), [lang]);
}

export function noteNames(lang: Lang): string[] {
  return DICTS[lang].notes.split(',');
}
