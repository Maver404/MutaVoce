import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS } from '../src/presets/builtin';
import { exportPresets, importPresets, makeCustomPreset } from '../src/presets/presetIO';
import { DEFAULT_PARAMS, ENUMS, PARAM_META, paramsFromPreset, sanitizeParams } from '../src/state/params';
import { encodeWav } from '../src/audio/wav';
import { en } from '../src/i18n/en';
import { it as itDict } from '../src/i18n/it';

describe('builtin presets', () => {
  it('has around 40 presets with unique ids', () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(BUILTIN_PRESETS.map((p) => p.id)).size).toBe(BUILTIN_PRESETS.length);
  });

  it.each(BUILTIN_PRESETS.map((p) => [p.id, p] as const))('%s is valid and in range', (_id, preset) => {
    const params = paramsFromPreset(preset.params);
    // Sanitising must not change anything: every value already in range and of the right type.
    expect(sanitizeParams(params)).toEqual(params);
    for (const [mod, values] of Object.entries(preset.params)) {
      for (const [key, value] of Object.entries(values ?? {})) {
        const path = `${mod}.${key}`;
        if (typeof value === 'number') {
          const meta = PARAM_META[path];
          expect(meta, path).toBeDefined();
          expect(value, path).toBeGreaterThanOrEqual(meta.min);
          expect(value, path).toBeLessThanOrEqual(meta.max);
        }
        if (typeof value === 'string' && ENUMS[path]) expect(ENUMS[path]).toContain(value);
        expect(key in (DEFAULT_PARAMS as unknown as Record<string, object>)[mod], path).toBe(true);
      }
    }
    expect(preset.name.it.length).toBeGreaterThan(0);
    expect(preset.name.en.length).toBeGreaterThan(0);
  });

  it('every non-neutral preset changes something', () => {
    for (const p of BUILTIN_PRESETS.filter((x) => x.id !== 'neutral')) {
      const params = paramsFromPreset(p.params);
      const active = Object.values(params).some((m) => 'enabled' in m && m.enabled);
      expect(active, p.id).toBe(true);
    }
  });
});

describe('sanitizeParams', () => {
  it('clamps, drops unknown keys and rejects wrong types', () => {
    const out = sanitizeParams({
      pitch: { semitones: 99, mode: 'warp', enabled: 'yes', bogus: 1 },
      reverb: { type: 'cave', mix: -3 },
      eq: { bands: [{ type: 'peaking', freq: 1e9, gain: 3, q: 1 }] },
      unknownModule: { enabled: true },
    });
    expect(out.pitch.semitones).toBe(24);
    expect(out.pitch.mode).toBe(DEFAULT_PARAMS.pitch.mode);
    expect(out.pitch.enabled).toBe(false);
    expect('bogus' in out.pitch).toBe(false);
    expect(out.reverb.type).toBe('cave');
    expect(out.reverb.mix).toBe(0);
    expect(out.eq.bands[0]).toEqual({ type: 'peaking', freq: 20000, gain: 3, q: 1 });
    expect(out.eq.bands).toHaveLength(DEFAULT_PARAMS.eq.bands.length);
    expect('unknownModule' in out).toBe(false);
  });

  it('survives garbage input', () => {
    expect(sanitizeParams(null)).toEqual(DEFAULT_PARAMS);
    expect(sanitizeParams('nope')).toEqual(DEFAULT_PARAMS);
  });
});

describe('preset files', () => {
  it('round-trips export → import as custom presets', () => {
    const p = makeCustomPreset('Mia voce', paramsFromPreset({ pitch: { enabled: true, semitones: -3 } }));
    const imported = importPresets(exportPresets([p]));
    expect(imported).toHaveLength(1);
    expect(imported[0].id).not.toBe(p.id);
    expect(imported[0].category).toBe('custom');
    expect(imported[0].name.it).toBe('Mia voce');
    expect(sanitizeParams(imported[0].params).pitch.semitones).toBe(-3);
  });

  it('imports banks and rejects invalid files', () => {
    const bank = exportPresets(BUILTIN_PRESETS.slice(0, 5));
    expect(importPresets(bank)).toHaveLength(5);
    expect(() => importPresets('{not json')).toThrow('invalid-json');
    expect(() => importPresets('{"hello": 1}')).toThrow('invalid-file');
    expect(() => importPresets(JSON.stringify({ app: 'mutavoce', version: 99, presets: [] }))).toThrow('newer-version');
  });
});

describe('wav encoder', () => {
  it('writes a valid 16-bit stereo header', () => {
    const buf = encodeWav([new Float32Array([0, 0.5, -1]), new Float32Array([0, -0.5, 1])], 48000);
    const v = new DataView(buf);
    const str = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(str(0)).toBe('RIFF');
    expect(str(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint32(40, true)).toBe(3 * 2 * 2);
    expect(v.getInt16(44 + 4 * 2, true)).toBe(-32768);
    expect(buf.byteLength).toBe(44 + 12);
  });
});

describe('i18n', () => {
  it('english covers every italian key', () => {
    for (const key of Object.keys(itDict)) expect(en[key as keyof typeof en], key).toBeTruthy();
  });

  it('has a label for every parameter and option', () => {
    for (const [mod, values] of Object.entries(DEFAULT_PARAMS)) {
      if (mod === 'master' || mod === 'eq') continue;
      for (const key of Object.keys(values)) {
        if (key === 'enabled') continue;
        expect(itDict[`param.${mod}.${key}` as keyof typeof itDict], `${mod}.${key}`).toBeTruthy();
      }
    }
    for (const [path, options] of Object.entries(ENUMS)) {
      for (const o of options) expect(itDict[`opt.${path}.${o}` as keyof typeof itDict], `${path}.${o}`).toBeTruthy();
    }
  });
});
