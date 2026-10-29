import { useEffect, useRef } from 'react';
import { engine } from '../../audio/AudioEngine';
import { biquadCoefs, biquadMagnitudeDb } from '../../audio/dsp/biquad';
import { freqToMidi } from '../../audio/dsp/scales';
import { noteNames, useT } from '../../i18n';
import { type EqBand, PARAM_META, type VoiceParams } from '../../state/params';
import { getState, useApp, type VisualMode } from '../../state/store';
import { Segmented } from '../components/controls';
import { formatHz, quantize } from '../format';
import { useRaf } from '../hooks/useRaf';
import { BAND_COLORS } from '../theme';

const F_MIN = 20;
const F_MAX = 20000;
const DB_MIN = -100;
const DB_MAX = -10;
const EQ_RANGE = 24;
const PAD = { top: 44, bottom: 38, left: 6, right: 34 };
const FREQ_LABELS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const hasGain = (b: EqBand) => b.type === 'peaking' || b.type === 'lowshelf' || b.type === 'highshelf';

/** Colour map for the spectrogram: black → violet → cyan → white. */
const LUT = (() => {
  const stops: [number, number, number, number][] = [
    [0, 7, 9, 13],
    [0.35, 70, 40, 160],
    [0.6, 124, 92, 255],
    [0.8, 34, 211, 238],
    [1, 240, 250, 255],
  ];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 0;
    while (j < stops.length - 2 && v > stops[j + 1][0]) j++;
    const [p0, r0, g0, b0] = stops[j];
    const [p1, r1, g1, b1] = stops[j + 1];
    const f = (v - p0) / (p1 - p0);
    lut[i * 3] = r0 + (r1 - r0) * f;
    lut[i * 3 + 1] = g0 + (g1 - g0) * f;
    lut[i * 3 + 2] = b0 + (b1 - b0) * f;
  }
  return lut;
})();

export function Analyzer() {
  const t = useT();
  const mode = useApp((s) => s.visualMode);
  const running = useApp((s) => s.status === 'running');
  const set = useApp((s) => s.set);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const st = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    drag: -1,
    hover: -1,
    dirty: true,
    eqKey: null as VoiceParams['eq'] | null,
    eqCurve: new Float32Array(0),
    freqIn: new Float32Array(2048),
    freqOut: new Float32Array(2048),
    time: new Float32Array(4096),
    timeIn: new Float32Array(4096),
    spec: null as HTMLCanvasElement | null,
    lastPitch: 0,
  });

  // Geometry helpers (CSS pixels).
  const geom = () => {
    const s = st.current;
    const pw = s.w - PAD.left - PAD.right;
    const ph = s.h - PAD.top - PAD.bottom;
    const lx = Math.log10(F_MAX / F_MIN);
    return {
      pw,
      ph,
      x: (f: number) => PAD.left + (Math.log10(f / F_MIN) / lx) * pw,
      f: (x: number) => F_MIN * Math.pow(10, ((x - PAD.left) / pw) * lx),
      yDb: (db: number) => PAD.top + (1 - (db - DB_MIN) / (DB_MAX - DB_MIN)) * ph,
      yEq: (g: number) => PAD.top + (0.5 - g / (2 * EQ_RANGE)) * ph,
      gEq: (y: number) => (0.5 - (y - PAD.top) / ph) * 2 * EQ_RANGE,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const s = st.current;
      const rect = canvas.getBoundingClientRect();
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = rect.width;
      s.h = rect.height;
      canvas.width = Math.round(rect.width * s.dpr);
      canvas.height = Math.round(rect.height * s.dpr);
      s.eqKey = null;
      s.spec = null;
      s.dirty = true;
    });
    ro.observe(canvas);
    const unsub = useApp.subscribe((a, b) => {
      if (a.params.eq !== b.params.eq || a.eqSelected !== b.eqSelected) st.current.dirty = true;
    });
    return () => {
      ro.disconnect();
      unsub();
    };
  }, []);

  useEffect(() => {
    st.current.dirty = true;
    st.current.spec = null;
  }, [mode, running]);

  // Wheel over a handle changes its Q (needs a non-passive listener).
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      const s = st.current;
      if (getState().visualMode !== 'spectrum' || s.hover < 0) return;
      e.preventDefault();
      const band = getState().params.eq.bands[s.hover];
      const q = quantize(band.q * Math.pow(1.12, e.deltaY < 0 ? 1 : -1), PARAM_META['eq.q']);
      getState().setEqBand(s.hover, { q });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const hitTest = (px: number, py: number): number => {
    const g = geom();
    const bands = getState().params.eq.bands;
    let best = -1;
    let bestD = 14;
    bands.forEach((b, i) => {
      const d = Math.hypot(g.x(b.freq) - px, (hasGain(b) ? g.yEq(b.gain) : g.yEq(0)) - py);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const local = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'spectrum') return;
    const [x, y] = local(e);
    const i = hitTest(x, y);
    if (i < 0) return;
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    st.current.drag = i;
    set({ eqSelected: i });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== 'spectrum') return;
    const s = st.current;
    const [x, y] = local(e);
    if (s.drag >= 0) {
      const g = geom();
      const band = getState().params.eq.bands[s.drag];
      const freq = quantize(g.f(x), PARAM_META['eq.freq']);
      const gain = hasGain(band) ? quantize(g.gEq(y), PARAM_META['eq.gain']) : band.gain;
      getState().setEqBand(s.drag, { freq, gain });
    } else {
      const h = hitTest(x, y);
      if (h !== s.hover) {
        s.hover = h;
        s.dirty = true;
        canvasRef.current!.style.cursor = h >= 0 ? 'grab' : 'default';
      }
    }
  };

  const onPointerUp = () => {
    st.current.drag = -1;
    st.current.dirty = true;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (mode !== 'spectrum') return;
    const [x, y] = local(e);
    const i = hitTest(x, y);
    if (i >= 0) getState().setEqBand(i, { gain: 0 });
  };

  useRaf(() => {
    const s = st.current;
    const canvas = canvasRef.current;
    if (!canvas || s.w === 0) return;
    if (!running && !s.dirty) return;
    s.dirty = false;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    if (mode === 'spectrum') drawSpectrum(ctx);
    else if (mode === 'spectrogram') drawSpectrogram(ctx);
    else drawScope(ctx);
    updatePitch();
  });

  function drawFreqGrid(ctx: CanvasRenderingContext2D) {
    const g = geom();
    ctx.font = '10px ui-monospace, SF Mono, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (const f of FREQ_LABELS) {
      const x = Math.round(g.x(f)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + g.ph);
      ctx.stroke();
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, PAD.top + g.ph + 13);
    }
  }

  function spectrumPath(ctx: CanvasRenderingContext2D, data: Float32Array, sr: number, fft: number) {
    const g = geom();
    const binHz = sr / fft;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + g.ph);
    for (let px = 0; px <= g.pw; px += 2) {
      const f0 = g.f(PAD.left + px);
      const f1 = g.f(PAD.left + px + 2);
      const b0 = f0 / binHz;
      const b1 = f1 / binHz;
      let v: number;
      if (b1 - b0 < 1) {
        const i = Math.floor(b0);
        const fr = b0 - i;
        v = (data[i] ?? DB_MIN) * (1 - fr) + (data[i + 1] ?? DB_MIN) * fr;
      } else {
        v = -Infinity;
        for (let i = Math.floor(b0); i <= Math.ceil(b1) && i < data.length; i++) v = Math.max(v, data[i]);
      }
      // Gentle tilt so speech reads evenly across the range.
      v += 3 * Math.log2(Math.max(f0, 20) / 1000);
      const y = Math.min(PAD.top + g.ph, Math.max(PAD.top, g.yDb(v)));
      ctx.lineTo(PAD.left + px, y);
    }
    ctx.lineTo(PAD.left + g.pw, PAD.top + g.ph);
    ctx.closePath();
  }

  function drawSpectrum(ctx: CanvasRenderingContext2D) {
    const g = geom();
    const state = getState();
    drawFreqGrid(ctx);

    // EQ dB grid on the right.
    ctx.textAlign = 'left';
    for (const db of [-18, -12, -6, 0, 6, 12, 18]) {
      const y = Math.round(g.yEq(db)) + 0.5;
      ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + g.pw, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, PAD.left + g.pw + 6, y + 3);
    }

    const inA = engine.getAnalyser('in');
    const outA = engine.getAnalyser('out');
    if (running && inA && outA) {
      const S = st.current;
      if (S.freqIn.length !== inA.frequencyBinCount) S.freqIn = new Float32Array(inA.frequencyBinCount);
      if (S.freqOut.length !== outA.frequencyBinCount) S.freqOut = new Float32Array(outA.frequencyBinCount);
      inA.getFloatFrequencyData(S.freqIn);
      outA.getFloatFrequencyData(S.freqOut);
      const sr = engine.sampleRate;

      spectrumPath(ctx, S.freqIn, sr, inA.fftSize);
      ctx.fillStyle = 'rgba(148,163,184,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      spectrumPath(ctx, S.freqOut, sr, outA.fftSize);
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + g.ph);
      grad.addColorStop(0, 'rgba(34,211,238,0.45)');
      grad.addColorStop(1, 'rgba(124,92,255,0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,211,238,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // EQ curve (cached per params + width).
    const eq = state.params.eq;
    const S = st.current;
    const cols = Math.max(1, Math.floor(g.pw));
    if (S.eqKey !== eq || S.eqCurve.length !== cols + 1) {
      S.eqKey = eq;
      S.eqCurve = new Float32Array(cols + 1);
      const sr = engine.sampleRate;
      const coefs = eq.bands.map((b) => biquadCoefs(b.type, b.freq, b.q, b.gain, sr));
      for (let px = 0; px <= cols; px++) {
        const f = g.f(PAD.left + px);
        let db = 0;
        for (const c of coefs) db += biquadMagnitudeDb(c, f, sr);
        S.eqCurve[px] = db;
      }
    }
    ctx.beginPath();
    for (let px = 0; px <= cols; px++) {
      const y = Math.min(PAD.top + g.ph, Math.max(PAD.top, g.yEq(S.eqCurve[px])));
      if (px === 0) ctx.moveTo(PAD.left, y);
      else ctx.lineTo(PAD.left + px, y);
    }
    ctx.setLineDash(eq.enabled ? [] : [4, 4]);
    ctx.strokeStyle = eq.enabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    if (eq.enabled) {
      ctx.lineTo(PAD.left + cols, g.yEq(0));
      ctx.lineTo(PAD.left, g.yEq(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(124,92,255,0.12)';
      ctx.fill();
    }

    // Handles.
    const selected = state.eqSelected;
    eq.bands.forEach((b, i) => {
      const x = g.x(b.freq);
      const y = hasGain(b) ? g.yEq(b.gain) : g.yEq(0);
      const active = i === S.hover || i === S.drag || i === selected;
      ctx.beginPath();
      ctx.arc(x, y, active ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = BAND_COLORS[i];
      ctx.globalAlpha = eq.enabled ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = active ? '#fff' : 'rgba(0,0,0,0.5)';
      ctx.stroke();
      ctx.fillStyle = '#0b0d12';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y + 3);
    });

    const label = S.drag >= 0 ? S.drag : S.hover;
    if (label >= 0) {
      const b = eq.bands[label];
      const x = g.x(b.freq);
      const y = hasGain(b) ? g.yEq(b.gain) : g.yEq(0);
      const text = `${label + 1} · ${formatHz(b.freq)}${hasGain(b) ? ` · ${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)} dB` : ''} · Q ${b.q.toFixed(2)}`;
      ctx.font = '11px ui-monospace, SF Mono, Menlo, monospace';
      const tw = ctx.measureText(text).width + 12;
      const tx = Math.min(Math.max(x - tw / 2, 4), S.w - tw - 4);
      const ty = y > PAD.top + 30 ? y - 30 : y + 14;
      ctx.fillStyle = 'rgba(15,18,26,0.92)';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(text, tx + 6, ty + 14);
    }
  }

  function drawSpectrogram(ctx: CanvasRenderingContext2D) {
    const S = st.current;
    const g = geom();
    const w = Math.max(1, Math.round(g.pw * S.dpr));
    const h = Math.max(1, Math.round(g.ph * S.dpr));
    if (!S.spec || S.spec.width !== w || S.spec.height !== h) {
      S.spec = document.createElement('canvas');
      S.spec.width = w;
      S.spec.height = h;
      const c = S.spec.getContext('2d')!;
      c.fillStyle = '#07090d';
      c.fillRect(0, 0, w, h);
    }
    const outA = engine.getAnalyser('out');
    if (running && outA) {
      if (S.freqOut.length !== outA.frequencyBinCount) S.freqOut = new Float32Array(outA.frequencyBinCount);
      outA.getFloatFrequencyData(S.freqOut);
      const sc = S.spec.getContext('2d')!;
      const shift = Math.max(1, Math.round(2 * S.dpr));
      sc.drawImage(S.spec, -shift, 0);
      const img = sc.createImageData(shift, h);
      const binHz = engine.sampleRate / outA.fftSize;
      const lx = Math.log10(F_MAX / F_MIN);
      for (let row = 0; row < h; row++) {
        const f = F_MIN * Math.pow(10, (1 - row / h) * lx);
        const bin = Math.min(S.freqOut.length - 1, Math.round(f / binHz));
        const db = S.freqOut[bin] + 3 * Math.log2(Math.max(f, 20) / 1000);
        const v = Math.max(0, Math.min(255, Math.round(((db - DB_MIN) / (DB_MAX - DB_MIN)) * 255)));
        for (let col = 0; col < shift; col++) {
          const o = (row * shift + col) * 4;
          img.data[o] = LUT[v * 3];
          img.data[o + 1] = LUT[v * 3 + 1];
          img.data[o + 2] = LUT[v * 3 + 2];
          img.data[o + 3] = 255;
        }
      }
      sc.putImageData(img, w - shift, 0);
    }
    ctx.drawImage(S.spec, PAD.left, PAD.top, g.pw, g.ph);
    // Frequency labels on the vertical axis.
    ctx.font = '10px ui-monospace, SF Mono, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left';
    const lx = Math.log10(F_MAX / F_MIN);
    for (const f of [100, 500, 1000, 2000, 5000, 10000]) {
      const y = PAD.top + (1 - Math.log10(f / F_MIN) / lx) * g.ph;
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), PAD.left + g.pw + 6, y + 3);
    }
  }

  function drawScope(ctx: CanvasRenderingContext2D) {
    const S = st.current;
    const g = geom();
    const mid = PAD.top + g.ph / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(PAD.left, mid);
    ctx.lineTo(PAD.left + g.pw, mid);
    ctx.stroke();
    const outA = engine.getAnalyser('out');
    const inA = engine.getAnalyser('in');
    if (!running || !outA || !inA) return;
    if (S.time.length !== outA.fftSize) S.time = new Float32Array(outA.fftSize);
    if (S.timeIn.length !== inA.fftSize) S.timeIn = new Float32Array(inA.fftSize);
    outA.getFloatTimeDomainData(S.time);
    inA.getFloatTimeDomainData(S.timeIn);
    const span = 1600;
    const draw = (data: Float32Array, color: string, width: number) => {
      let start = 0;
      for (let i = 1; i < data.length - span; i++) {
        if (data[i - 1] < 0 && data[i] >= 0) {
          start = i;
          break;
        }
      }
      ctx.beginPath();
      for (let i = 0; i < span; i++) {
        const x = PAD.left + (i / span) * g.pw;
        const y = mid - data[start + i] * (g.ph / 2) * 0.95;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    draw(S.timeIn, 'rgba(148,163,184,0.35)', 1);
    draw(S.time, 'rgba(34,211,238,0.95)', 1.6);
  }

  function updatePitch() {
    const S = st.current;
    const now = performance.now();
    if (now - S.lastPitch < 120 || !pitchRef.current) return;
    S.lastPitch = now;
    const { inHz, outHz } = engine.getPitch();
    const notes = noteNames(getState().lang);
    const fmt = (hz: number) => {
      if (hz <= 0) return '—';
      const m = Math.round(freqToMidi(hz));
      return `${notes[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1} · ${Math.round(hz)} Hz`;
    };
    const el = pitchRef.current;
    el.children[1].textContent = running ? fmt(inHz) : '—';
    el.children[3].textContent = running ? fmt(outHz) : '—';
  }

  const modes: { value: VisualMode; label: string }[] = [
    { value: 'spectrum', label: t('visual.spectrum') },
    { value: 'spectrogram', label: t('visual.spectrogram') },
    { value: 'scope', label: t('visual.scope') },
  ];

  return (
    <div className="viz">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (st.current.drag < 0 && st.current.hover >= 0) {
            st.current.hover = -1;
            st.current.dirty = true;
          }
        }}
        onDoubleClick={onDoubleClick}
        aria-label={t('visual.spectrum')}
      />
      <div className="viz-top">
        <Segmented value={mode} options={modes} onChange={(v) => set({ visualMode: v })} label={t('visual.spectrum')} />
        <span className="spacer" />
        <div ref={pitchRef} className="pitch-readout" aria-live="off">
          <span className="lbl">{t('visual.pitchIn')}</span>
          <span>—</span>
          <span className="lbl">→ {t('visual.pitchOut')}</span>
          <span>—</span>
        </div>
      </div>
      {!running && (
        <div className="viz-empty">
          <span>{t('visual.stopped')}</span>
        </div>
      )}
      {mode === 'spectrum' && <div className="viz-hint hide-md">{t('eq.hint')}</div>}
      {mode !== 'spectrogram' && running && (
        <div className="viz-legend">
          <span>
            <i style={{ background: 'rgba(148,163,184,0.6)' }} />
            {t('visual.input')}
          </span>
          <span>
            <i style={{ background: '#22d3ee' }} />
            {t('visual.output')}
          </span>
        </div>
      )}
    </div>
  );
}
