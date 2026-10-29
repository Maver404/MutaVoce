import { useT } from '../../i18n';
import { toggleRecording } from '../../state/actions';
import { DEFAULT_PARAMS, PARAM_META } from '../../state/params';
import { type PttMode, useApp } from '../../state/store';
import { Icon } from '../components/Icon';
import { Meter } from '../components/Meter';
import { Select, Slider } from '../components/controls';
import { formatValue, keyLabel } from '../format';
import { RecTimer } from '../panels/RecorderPanel';

export function MasterBar() {
  const t = useT();
  const running = useApp((s) => s.status === 'running');
  const voice = useApp((s) => s.voiceActive);
  const bypass = useApp((s) => s.bypass);
  const muted = useApp((s) => s.muted);
  const ptt = useApp((s) => s.ptt);
  const pttHeld = useApp((s) => s.pttHeld);
  const capturing = useApp((s) => s.capturing);
  const recording = useApp((s) => s.recording);
  const gain = useApp((s) => s.params.master.gain);
  const set = useApp((s) => s.set);
  const setParam = useApp((s) => s.setParam);

  const talkOpen = ptt.mode === 'off' || pttHeld;
  const onAir = running && talkOpen && !muted;
  const meta = PARAM_META['master.gain'];

  return (
    <footer className="masterbar">
      <span className={`onair${onAir ? ' live' : ''}`} title={t('master.speaking')}>
        <span className={`led${onAir && voice ? ' on' : ''}`} />
        {onAir ? t('master.onAir') : t('master.offAir')}
      </span>

      <div className="master-group">
        <span className="field-label hide-md">{t('master.ptt')}</span>
        <div style={{ width: 150 }}>
          <Select<PttMode>
            value={ptt.mode}
            label={t('master.ptt')}
            onChange={(mode) => set({ ptt: { ...ptt, mode }, pttHeld: false })}
            options={[
              { value: 'off', label: t('master.pttOff') },
              { value: 'hold', label: t('master.pttHold') },
              { value: 'toggle', label: t('master.pttToggle') },
            ]}
          />
        </div>
        {ptt.mode !== 'off' && (
          <button
            className={`kbd${capturing === 'ptt' ? ' capturing' : ''}`}
            onClick={() => set({ capturing: capturing === 'ptt' ? null : 'ptt' })}
            title={t('master.pttKey')}
          >
            {capturing === 'ptt' ? t('master.pttListening') : keyLabel(ptt.key)}
          </button>
        )}
      </div>

      <button className="toggle-btn" aria-pressed={bypass} onClick={() => set({ bypass: !bypass })} title={t('master.bypassTitle')}>
        <Icon name="ab" size={16} />
        {bypass ? t('master.bypassOn') : t('master.bypass')}
      </button>
      <button className="toggle-btn mute" aria-pressed={muted} onClick={() => set({ muted: !muted })} title={`${t('master.mute')} (M)`}>
        <Icon name={muted ? 'mute' : 'volume'} size={16} />
        <span className="hide-md">{t('master.mute')}</span>
      </button>
      <button className={`rec-btn${recording ? ' on' : ''}`} onClick={() => toggleRecording()} disabled={!running && !recording} title={`${t('recorder.record')} (R)`}>
        <span className="rec-dot" />
        {recording ? <RecTimer /> : <span className="hide-md">{t('recorder.record')}</span>}
      </button>

      <div className="master-out">
        <span className="field-label">{t('master.volume')}</span>
        <Meter which="out" label={t('visual.output')} />
        <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Slider
            value={gain}
            min={meta.min}
            max={meta.max}
            step={meta.step}
            label={t('param.master.gain')}
            onChange={(v) => setParam('master', 'gain', v)}
          />
        </div>
        <button className="slider-value" style={{ background: 'none', border: 'none' }} onDoubleClick={() => setParam('master', 'gain', DEFAULT_PARAMS.master.gain)}>
          {formatValue(gain, meta)}
        </button>
      </div>
    </footer>
  );
}
