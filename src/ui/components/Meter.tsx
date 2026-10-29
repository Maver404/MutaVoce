import { useRef } from 'react';
import { engine } from '../../audio/AudioEngine';
import { useApp } from '../../state/store';
import { useRaf } from '../hooks/useRaf';

const FLOOR = -60;
const pct = (db: number) => Math.max(0, Math.min(100, ((db - FLOOR) / -FLOOR) * 100));

/** Level meter reading straight from the engine analysers (no React re-renders). */
export function Meter({ which, label }: { which: 'in' | 'out'; label: string }) {
  const running = useApp((s) => s.status === 'running');
  const rootRef = useRef<HTMLDivElement>(null);
  const rmsRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const hold = useRef({ peak: FLOOR, clipUntil: 0 });

  useRaf(() => {
    const root = rootRef.current;
    if (!root || !rmsRef.current || !peakRef.current) return;
    const lv = engine.getLevels();
    const peak = which === 'in' ? lv.inPeak : lv.outPeak;
    const rms = which === 'in' ? lv.inRms : lv.outRms;
    const h = hold.current;
    h.peak = Math.max(peak, h.peak - 0.6);
    const now = performance.now();
    if (peak > -0.5) h.clipUntil = now + 1200;
    rmsRef.current.style.width = `${pct(rms + 6)}%`;
    peakRef.current.style.left = `calc(${pct(h.peak)}% - 2px)`;
    root.classList.toggle('clip', now < h.clipUntil);
    root.style.setProperty('--meter-w', `${root.clientWidth}px`);
  }, running);

  return (
    <div ref={rootRef} className="meter" role="meter" aria-label={label} title={label}>
      <div ref={rmsRef} className="rms" />
      <div ref={peakRef} className="peak" />
    </div>
  );
}
