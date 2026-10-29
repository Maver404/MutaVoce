import { useRef } from 'react';
import { engine } from '../../audio/AudioEngine';
import { noteNames, type TKey, useT } from '../../i18n';
import { DEFAULT_PARAMS, ENUMS, type EqBand, MODULE_ORDER, type ModuleId, PARAM_META } from '../../state/params';
import { useApp } from '../../state/store';
import { Icon, ModuleIcon } from '../components/Icon';
import { Knob } from '../components/Knob';
import { ParamChoice, ParamKnob, ParamToggle } from '../components/ParamControls';
import { Select, Switch, ToggleRow } from '../components/controls';
import { useRaf } from '../hooks/useRaf';
import { BAND_COLORS, MODULE_COLORS } from '../theme';
import { formatHz } from '../format';

export function Rack() {
  const t = useT();
  const activeOnly = useApp((s) => s.activeOnly);
  const enabledKey = useApp((s) => MODULE_ORDER.filter((m) => s.params[m].enabled).join(','));
  const enabled = enabledKey ? enabledKey.split(',') : [];
  const visible = activeOnly ? MODULE_ORDER.filter((m) => enabled.includes(m)) : MODULE_ORDER;
  const set = useApp((s) => s.set);
  const setAllCollapsed = useApp((s) => s.setAllCollapsed);
  const resetAll = useApp((s) => s.resetAll);

  return (
    <>
      <div className="rack-head">
        <span className="panel-title">{t('rack.title')}</span>
        <span className="badge">
          {enabled.length}/{MODULE_ORDER.length}
        </span>
        <span className="spacer" />
        <ToggleRow checked={activeOnly} onChange={(v) => set({ activeOnly: v })} label={t('rack.activeOnly')} />
        <button className="btn sm ghost" onClick={() => setAllCollapsed(false)} title={t('rack.expandAll')}>
          {t('rack.expandAll')}
        </button>
        <button className="btn sm ghost" onClick={() => setAllCollapsed(true)} title={t('rack.collapseAll')}>
          {t('rack.collapseAll')}
        </button>
        <button className="btn sm ghost" onClick={resetAll}>
          <Icon name="reset" size={14} />
          {t('presets.reset')}
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="empty">{t('rack.noneActive')}</div>
      ) : (
        <div className="rack">
          {visible.map((id) => (
            <ModuleCard key={id} id={id} />
          ))}
        </div>
      )}
    </>
  );
}

function ModuleCard({ id }: { id: ModuleId }) {
  const t = useT();
  const enabled = useApp((s) => s.params[id].enabled);
  const collapsedPref = useApp((s) => s.collapsed[id]);
  const setModuleEnabled = useApp((s) => s.setModuleEnabled);
  const resetModule = useApp((s) => s.resetModule);
  // Untouched modules are open when active, closed when off.
  const open = collapsedPref === undefined ? enabled : !collapsedPref;
  const toggleOpen = () => {
    const s = useApp.getState();
    s.set({ collapsed: { ...s.collapsed, [id]: open } });
  };

  return (
    <section className={`module${enabled ? ' on' : ''}`} style={{ '--mod-color': MODULE_COLORS[id] } as React.CSSProperties}>
      <header className="module-head" onClick={toggleOpen}>
        <Icon name="chevron" size={14} className={`chev${open ? ' open' : ''}`} />
        <span className="module-icon">
          <ModuleIcon id={id} />
        </span>
        <div className="module-title">
          {t(`module.${id}` as TKey)}
          <small>{t(`moduleDesc.${id}` as TKey)}</small>
        </div>
        <button
          className="icon-btn sm ghost"
          title={t('rack.resetModule')}
          aria-label={t('rack.resetModule')}
          onClick={(e) => {
            e.stopPropagation();
            resetModule(id);
          }}
        >
          <Icon name="reset" size={14} />
        </button>
        <Switch checked={enabled} onChange={(v) => setModuleEnabled(id, v)} label={`${t('rack.toggle')}: ${t(`module.${id}` as TKey)}`} />
      </header>
      {open && (
        <div className="module-body">
          <ModuleBody id={id} />
        </div>
      )}
    </section>
  );
}

function ModuleBody({ id }: { id: ModuleId }) {
  const color = MODULE_COLORS[id];
  const k = (key: string, extra?: Partial<Parameters<typeof ParamKnob>[0]>) => <ParamKnob module={id} k={key} color={color} {...extra} />;
  switch (id) {
    case 'gate':
      return (
        <>
          <div className="knobs">
            {k('threshold')}
            {k('attack')}
            {k('release')}
          </div>
          <VoiceLed />
        </>
      );
    case 'pitch':
      return <PitchBody />;
    case 'autotune':
      return <AutotuneBody />;
    case 'harmonizer':
      return (
        <div className="knobs">
          {k('voice1')}
          {k('level1')}
          {k('voice2')}
          {k('level2')}
        </div>
      );
    case 'ringmod':
      return (
        <div className="knobs">
          {k('frequency')}
          {k('lfoRate')}
          {k('lfoDepth')}
          {k('mix')}
        </div>
      );
    case 'vocoder':
      return <VocoderBody />;
    case 'distortion':
      return (
        <>
          <ParamChoice module="distortion" k="type" />
          <div className="knobs">
            {k('drive')}
            {k('tone')}
            {k('mix')}
          </div>
        </>
      );
    case 'bitcrusher':
      return (
        <div className="knobs">
          {k('bits')}
          {k('downsample')}
          {k('mix')}
        </div>
      );
    case 'filter':
      return (
        <div className="knobs">
          {k('highpass')}
          {k('lowpass')}
          {k('resonance')}
          {k('lfoRate')}
          {k('lfoDepth')}
        </div>
      );
    case 'eq':
      return <EqBody />;
    case 'compressor':
      return <CompressorBody />;
    case 'modulation':
      return <ModulationBody />;
    case 'delay':
      return (
        <div className="knobs">
          {k('time')}
          {k('feedback')}
          {k('tone')}
          {k('mix')}
        </div>
      );
    case 'reverb':
      return (
        <>
          <ParamChoice module="reverb" k="type" variant="select" />
          <div className="knobs">
            {k('decay')}
            {k('preDelay')}
            {k('mix')}
          </div>
        </>
      );
    case 'noise':
      return (
        <>
          <ParamChoice module="noise" k="type" variant="select" />
          <div className="knobs">{k('level')}</div>
          <ParamToggle module="noise" k="onlyWhileTalking" />
          <ParamToggle module="noise" k="squelch" />
        </>
      );
  }
}

function VoiceLed() {
  const t = useT();
  const active = useApp((s) => s.voiceActive);
  return (
    <div className="row hint">
      <span className={`led${active ? ' on' : ''}`} />
      {t('master.speaking')}
    </div>
  );
}

function PitchBody() {
  const t = useT();
  const fast = useApp((s) => s.params.pitch.mode === 'fast');
  const color = MODULE_COLORS.pitch;
  return (
    <>
      <ParamChoice module="pitch" k="mode" />
      <div className="knobs">
        <ParamKnob module="pitch" k="semitones" color={color} />
        <ParamKnob module="pitch" k="formant" color={color} disabled={fast} title={fast ? t('rack.hqOnly') : undefined} />
      </div>
      <ParamToggle module="pitch" k="preserveFormants" disabled={fast} />
      {fast && <p className="hint">{t('rack.hqOnly')}: {t('param.pitch.formant')}, {t('param.pitch.preserveFormants')}.</p>}
    </>
  );
}

function AutotuneBody() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const key = useApp((s) => s.params.autotune.key);
  const setParam = useApp((s) => s.setParam);
  const notes = noteNames(lang);
  return (
    <>
      <div className="row">
        <span className="field-label">{t('param.autotune.key')}</span>
        <Select
          value={String(key)}
          options={notes.map((n, i) => ({ value: String(i), label: n }))}
          onChange={(v) => setParam('autotune', 'key', Number(v))}
          label={t('param.autotune.key')}
        />
      </div>
      <ParamChoice module="autotune" k="scale" variant="select" />
      <div className="knobs">
        <ParamKnob module="autotune" k="speed" color={MODULE_COLORS.autotune} />
      </div>
    </>
  );
}

function VocoderBody() {
  const lang = useApp((s) => s.lang);
  const notes = noteNames(lang);
  const color = MODULE_COLORS.vocoder;
  return (
    <>
      <ParamChoice module="vocoder" k="carrier" />
      <div className="knobs">
        <ParamKnob module="vocoder" k="note" color={color} format={(v) => `${notes[v % 12]}${Math.floor(v / 12) - 1}`} />
        <ParamKnob module="vocoder" k="mix" color={color} />
      </div>
    </>
  );
}

function ModulationBody() {
  const type = useApp((s) => s.params.modulation.type);
  const color = MODULE_COLORS.modulation;
  return (
    <>
      <ParamChoice module="modulation" k="type" />
      <div className="knobs">
        <ParamKnob module="modulation" k="rate" color={color} />
        <ParamKnob module="modulation" k="depth" color={color} />
        <ParamKnob module="modulation" k="feedback" color={color} disabled={type !== 'flanger'} />
        <ParamKnob module="modulation" k="mix" color={color} />
      </div>
    </>
  );
}

function CompressorBody() {
  const color = MODULE_COLORS.compressor;
  const running = useApp((s) => s.status === 'running' && s.params.compressor.enabled);
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useRaf(() => {
    const gr = engine.getCompressorReduction();
    if (bar.current) bar.current.style.width = `${Math.min(100, (-gr / 24) * 100)}%`;
    if (label.current) label.current.textContent = `GR ${gr.toFixed(1)} dB`;
  }, running);
  return (
    <>
      <div className="knobs">
        <ParamKnob module="compressor" k="threshold" color={color} />
        <ParamKnob module="compressor" k="ratio" color={color} />
        <ParamKnob module="compressor" k="attack" color={color} />
        <ParamKnob module="compressor" k="release" color={color} />
        <ParamKnob module="compressor" k="makeup" color={color} />
      </div>
      <div className="row">
        <span ref={label} className="hint" style={{ margin: 0, minWidth: 90, fontFamily: 'var(--mono)' }}>
          GR 0.0 dB
        </span>
        <div className="gr-meter" style={{ flex: 1 }}>
          <div ref={bar} />
        </div>
      </div>
    </>
  );
}

function EqBody() {
  const t = useT();
  const bands = useApp((s) => s.params.eq.bands);
  const selected = useApp((s) => s.eqSelected) ?? 4;
  const set = useApp((s) => s.set);
  const setEqBand = useApp((s) => s.setEqBand);
  const band = bands[selected];
  const color = BAND_COLORS[selected];
  const types = ENUMS['eq.type'].map((v) => ({ value: v, label: t(`opt.eq.type.${v}` as TKey) }));
  const hasGain = band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf';

  return (
    <>
      <p className="hint">{t('eq.hint')}</p>
      <div className="eq-bands">
        {bands.map((b, i) => (
          <button
            key={i}
            className="eq-chip"
            aria-pressed={i === selected}
            style={{ '--band-color': BAND_COLORS[i] } as React.CSSProperties}
            onClick={() => set({ eqSelected: i })}
          >
            <i />
            {formatHz(b.freq).replace(' ', '')}
          </button>
        ))}
      </div>
      <div className="row">
        <span className="field-label">
          {t('eq.band')} {selected + 1}
        </span>
        <Select value={band.type} options={types} onChange={(v) => setEqBand(selected, { type: v as EqBand['type'] })} label={t('eq.band')} />
      </div>
      <div className="knobs">
        <Knob
          label="Freq"
          value={band.freq}
          meta={PARAM_META['eq.freq']}
          defaultValue={DEFAULT_PARAMS.eq.bands[selected].freq}
          onChange={(v) => setEqBand(selected, { freq: v })}
          color={color}
        />
        <Knob
          label="Gain"
          value={band.gain}
          meta={PARAM_META['eq.gain']}
          defaultValue={0}
          onChange={(v) => setEqBand(selected, { gain: v })}
          color={color}
          disabled={!hasGain}
        />
        <Knob
          label="Q"
          value={band.q}
          meta={PARAM_META['eq.q']}
          defaultValue={DEFAULT_PARAMS.eq.bands[selected].q}
          onChange={(v) => setEqBand(selected, { q: v })}
          color={color}
          disabled={band.type === 'lowshelf' || band.type === 'highshelf'}
        />
      </div>
      <button
        className="btn sm"
        onClick={() => {
          const s = useApp.getState();
          s.set({ params: { ...s.params, eq: { ...s.params.eq, bands: DEFAULT_PARAMS.eq.bands } }, modified: true });
        }}
      >
        {t('eq.flat')}
      </button>
    </>
  );
}
