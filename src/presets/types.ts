import type { PresetParams } from '../state/params';

export type PresetCategory = 'pro' | 'fun' | 'env' | 'custom';

export interface LocalizedText {
  it: string;
  en: string;
}

export interface VoicePreset {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  category: PresetCategory;
  icon: string;
  params: PresetParams;
  version: number;
  builtin?: boolean;
}

export const CATEGORY_COLORS: Record<PresetCategory, string> = {
  pro: 'var(--cat-pro)',
  fun: 'var(--cat-fun)',
  env: 'var(--cat-env)',
  custom: 'var(--cat-custom)',
};
