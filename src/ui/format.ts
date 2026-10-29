import type { NumberMeta } from '../state/params';

export function formatValue(v: number, meta: NumberMeta): string {
  switch (meta.unit) {
    case 'dB':
      return `${v > 0 ? '+' : ''}${Math.abs(v) >= 10 || meta.step >= 1 ? v.toFixed(0) : v.toFixed(1)} dB`;
    case 'Hz':
      return formatHz(v);
    case 'ms':
      return v < 10 ? `${v.toFixed(1)} ms` : `${Math.round(v)} ms`;
    case 's':
      return `${v.toFixed(1)} s`;
    case 'st':
      return `${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(1)} st`;
    case '%':
      return `${Math.round(v * 100)}%`;
    case 'x':
      return `÷${v}`;
    case 'bit':
      return `${v} bit`;
    case ':1':
      return `${v.toFixed(v >= 10 ? 0 : 1)}:1`;
    default:
      return meta.step < 1 ? v.toFixed(2) : String(Math.round(v));
  }
}

export function formatHz(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)} kHz`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} kHz`;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} Hz`;
}

/** Parse what a user typed into a knob ("2k", "-3", "50%") into the parameter's unit. */
export function parseValue(text: string, meta: NumberMeta): number | null {
  const s = text.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^([+-]?\d*\.?\d+)\s*(k)?/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2]) v *= 1000;
  if (meta.unit === '%' && (s.includes('%') || v > 1)) v /= 100;
  return Number.isFinite(v) ? v : null;
}

export function toNorm(v: number, meta: NumberMeta): number {
  if (meta.log && meta.min > 0) return Math.log(v / meta.min) / Math.log(meta.max / meta.min);
  return (v - meta.min) / (meta.max - meta.min);
}

export function fromNorm(n: number, meta: NumberMeta): number {
  const c = Math.min(1, Math.max(0, n));
  const raw = meta.log && meta.min > 0 ? meta.min * Math.pow(meta.max / meta.min, c) : meta.min + c * (meta.max - meta.min);
  return quantize(raw, meta);
}

export function quantize(v: number, meta: NumberMeta): number {
  const stepped = Math.round(v / meta.step) * meta.step;
  const clamped = Math.min(meta.max, Math.max(meta.min, stepped));
  return Number(clamped.toFixed(4));
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Human label for a KeyboardEvent.code (optionally "Shift+…"). */
export function keyLabel(code: string | null): string {
  if (!code) return '—';
  return code
    .replace('Shift+', '⇧')
    .replace(/^Key/, '')
    .replace(/Digit/, '')
    .replace('Space', '␣ Space')
    .replace('Numpad', 'Num ')
    .replace('Arrow', '')
    .replace('Backquote', '`');
}
