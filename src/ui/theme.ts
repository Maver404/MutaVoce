import type { ModuleId } from '../state/params';

export const MODULE_COLORS: Record<ModuleId, string> = {
  gate: '#34d399',
  pitch: '#8b6cff',
  autotune: '#f472b6',
  harmonizer: '#a78bfa',
  ringmod: '#22d3ee',
  vocoder: '#38bdf8',
  distortion: '#fb7185',
  bitcrusher: '#fbbf24',
  filter: '#2dd4bf',
  eq: '#60a5fa',
  compressor: '#f59e0b',
  modulation: '#c084fc',
  delay: '#4ade80',
  reverb: '#818cf8',
  noise: '#94a3b8',
};

export const BAND_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
