import { useEffect, useRef, useState } from 'react';
import type { NumberMeta } from '../../state/params';
import { formatValue, fromNorm, parseValue, quantize, toNorm } from '../format';

interface KnobProps {
  label: string;
  value: number;
  meta: NumberMeta;
  defaultValue: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  color?: string;
  size?: number;
  title?: string;
}

const START = -135;
const SWEEP = 270;

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

/**
 * Rotary control: drag vertically (Shift = fine), arrow keys / PageUp/Down, wheel while focused,
 * double-click to reset, click the value to type an exact number.
 */
export function Knob({ label, value, meta, defaultValue, onChange, format, disabled, color = 'var(--accent)', size = 46, title }: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; norm: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const norm = Math.min(1, Math.max(0, toNorm(value, meta)));
  const fmt = format ?? ((v: number) => formatValue(v, meta));
  const latest = useRef({ value, norm, onChange, meta });
  latest.current = { value, norm, onChange, meta };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      const { norm: n, onChange: cb, meta: m } = latest.current;
      const delta = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.002 : 0.015);
      cb(fromNorm(n + delta, m));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).focus();
    drag.current = { y: e.clientY, norm };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    const n = d.norm + dy / (e.shiftKey ? 900 : 180);
    const next = fromNorm(n, meta);
    if (next !== value) onChange(next);
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    const step = meta.step * (e.shiftKey ? 1 : meta.log ? 1 : Math.max(1, Math.round((meta.max - meta.min) / meta.step / 100)));
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = meta.log ? fromNorm(norm + 0.01, meta) : quantize(value + step, meta);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = meta.log ? fromNorm(norm - 0.01, meta) : quantize(value - step, meta);
        break;
      case 'PageUp':
        next = fromNorm(norm + 0.1, meta);
        break;
      case 'PageDown':
        next = fromNorm(norm - 0.1, meta);
        break;
      case 'Home':
        next = meta.min;
        break;
      case 'End':
        next = meta.max;
        break;
      case 'Enter':
      case 'Backspace':
      case 'Delete':
        if (e.key !== 'Enter') next = defaultValue;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (next !== null && next !== value) onChange(next);
  };

  const commit = () => {
    const v = parseValue(text, meta);
    if (v !== null) onChange(quantize(v, meta));
    setEditing(false);
  };

  const r = size / 2 - 5;
  const c = size / 2;
  const bipolar = meta.min < 0 && meta.max > 0;
  const zeroNorm = bipolar ? toNorm(0, meta) : 0;
  const a0 = START + SWEEP * (bipolar ? zeroNorm : 0);
  const a1 = START + SWEEP * norm;
  const angle = START + SWEEP * norm;
  const rad = ((angle - 90) * Math.PI) / 180;

  return (
    <div className={`knob${disabled ? ' disabled' : ''}`} title={title}>
      <span className="knob-label">{label}</span>
      <div
        ref={ref}
        className="knob-dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={meta.min}
        aria-valuemax={meta.max}
        aria-valuenow={value}
        aria-valuetext={fmt(value)}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={onKeyDown}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path d={arc(c, c, r, START, START + SWEEP)} stroke="var(--knob-track)" strokeWidth={4} fill="none" strokeLinecap="round" />
          {Math.abs(a1 - a0) > 0.5 && (
            <path d={arc(c, c, r, Math.min(a0, a1), Math.max(a0, a1))} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" />
          )}
          <circle cx={c} cy={c} r={r - 6} fill="var(--panel-3)" stroke="var(--line-2)" />
          <line
            x1={c + (r - 14) * Math.cos(rad) * 0.2}
            y1={c + (r - 14) * Math.sin(rad) * 0.2}
            x2={c + (r - 7) * Math.cos(rad)}
            y2={c + (r - 7) * Math.sin(rad)}
            stroke="var(--text)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      </div>
      {editing ? (
        <input
          className="knob-input"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="knob-value"
          tabIndex={-1}
          onClick={() => {
            if (disabled) return;
            setText(String(meta.unit === '%' ? Math.round(value * 100) : value));
            setEditing(true);
          }}
        >
          {fmt(value)}
        </button>
      )}
    </div>
  );
}
