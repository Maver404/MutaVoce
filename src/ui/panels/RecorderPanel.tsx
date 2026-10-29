import { useRef } from 'react';
import { useT } from '../../i18n';
import { deleteTake, downloadTake, recorder, toggleRecording } from '../../state/actions';
import { useApp } from '../../state/store';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/controls';
import { formatTime } from '../format';
import { useRaf } from '../hooks/useRaf';

export function RecTimer({ className }: { className?: string }) {
  const recording = useApp((s) => s.recording);
  const ref = useRef<HTMLSpanElement>(null);
  useRaf(() => {
    if (ref.current) ref.current.textContent = formatTime(recorder.elapsed);
  }, recording);
  return (
    <span ref={ref} className={className}>
      0:00
    </span>
  );
}

export function RecorderPanel() {
  const t = useT();
  const recording = useApp((s) => s.recording);
  const running = useApp((s) => s.status === 'running');
  const format = useApp((s) => s.recordFormat);
  const takes = useApp((s) => s.takes);
  const set = useApp((s) => s.set);

  return (
    <section className="section">
      <div className="section-head">
        <Icon name="record" size={16} />
        <h3>{t('recorder.title')}</h3>
      </div>
      <div className="rec-big">
        <button className={`rec-btn${recording ? ' on' : ''}`} onClick={() => toggleRecording()} disabled={!running && !recording}>
          <span className="rec-dot" />
          {recording ? t('recorder.stop') : t('recorder.record')}
          <span className="kbd">R</span>
        </button>
        <RecTimer className="rec-timer" />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="field-label">{t('recorder.format')}</span>
        <Segmented
          value={format}
          onChange={(v) => !recording && set({ recordFormat: v })}
          options={[
            { value: 'webm', label: t('recorder.webm') },
            { value: 'wav', label: t('recorder.wav') },
          ]}
        />
      </div>
      {!running && <p className="hint">{t('recorder.needsEngine')}</p>}
      <div className="takes">
        {takes.length === 0 ? (
          <div className="empty">{t('recorder.empty')}</div>
        ) : (
          takes.map((take) => (
            <div key={take.id} className="take">
              <div className="take-head">
                <span style={{ flex: 1 }}>
                  {take.name} <small>{formatTime(take.durationSec)} · {take.format.toUpperCase()}</small>
                </span>
                <button className="icon-btn sm ghost" title={t('recorder.download')} aria-label={t('recorder.download')} onClick={() => downloadTake(take.id)}>
                  <Icon name="download" size={15} />
                </button>
                <button className="icon-btn sm ghost" title={t('recorder.delete')} aria-label={t('recorder.delete')} onClick={() => deleteTake(take.id)}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
              <audio src={take.url} controls preload="metadata" />
            </div>
          ))
        )}
      </div>
      <p className="hint">{t('recorder.note')}</p>
    </section>
  );
}
