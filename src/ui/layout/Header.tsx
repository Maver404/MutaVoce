import { useRef } from 'react';
import { engine } from '../../audio/AudioEngine';
import { useLocalized, useT } from '../../i18n';
import { findPreset, toggleAudio } from '../../state/actions';
import { useApp } from '../../state/store';
import { BrandMark, Icon } from '../components/Icon';
import { useRaf } from '../hooks/useRaf';

function LatencyChip() {
  const t = useT();
  const running = useApp((s) => s.status === 'running');
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useRaf(() => {
    const now = performance.now();
    if (now - last.current < 500 || !ref.current) return;
    last.current = now;
    ref.current.textContent = `${Math.round(engine.getLatencyMs())} ms`;
  }, running);
  if (!running) return null;
  return (
    <span className="chip hide-sm" title={t('header.latency')}>
      {t('header.latency')} <span ref={ref}>—</span>
    </span>
  );
}

export function Header() {
  const t = useT();
  const loc = useLocalized();
  const status = useApp((s) => s.status);
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const activeId = useApp((s) => s.activePresetId);
  const modified = useApp((s) => s.modified);
  useApp((s) => s.customPresets); // re-render when the active custom preset is renamed
  const set = useApp((s) => s.set);
  const openModal = useApp((s) => s.openModal);
  const preset = findPreset(activeId);

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span>
          MutaVoce
          <small>{t('app.tagline')}</small>
        </span>
      </div>

      <div className="header-preset hide-sm" title={t('presets.current')}>
        <span aria-hidden="true">{preset?.icon ?? '🎛️'}</span>
        <span className="name">{preset ? loc(preset.name) : t('presets.none')}</span>
        {modified && <span className="dot-modified">● {t('presets.modified')}</span>}
      </div>

      <span className="spacer" />

      <LatencyChip />

      <button className={`start-btn${status === 'running' ? ' running' : ''}`} onClick={() => toggleAudio()} disabled={status === 'starting'}>
        {status === 'running' ? (
          <>
            <span className="live-dot" />
            {t('header.stop')}
          </>
        ) : (
          <>
            <Icon name="power" size={16} />
            {status === 'starting' ? t('header.starting') : t('header.start')}
          </>
        )}
      </button>

      <button className="btn hide-md" onClick={() => openModal('guide')}>
        <Icon name="plug" size={15} />
        {t('header.guide')}
      </button>
      <button className="icon-btn hide-sm" onClick={() => openModal('shortcuts')} title={t('header.shortcuts')} aria-label={t('header.shortcuts')}>
        <Icon name="keyboard" />
      </button>
      <div className="lang-switch" role="group" aria-label={t('header.language')}>
        <button aria-pressed={lang === 'it'} onClick={() => set({ lang: 'it' })}>
          IT
        </button>
        <button aria-pressed={lang === 'en'} onClick={() => set({ lang: 'en' })}>
          EN
        </button>
      </div>
      <button
        className="icon-btn"
        onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}
        title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
        aria-label={t('header.theme')}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
    </header>
  );
}
