import { useState } from 'react';
import { detectOS, findVirtualOutput, type OS } from '../../audio/devices';
import { useLocalized, useT } from '../../i18n';
import { findPreset, refreshDevices, saveCurrentAsPreset, selectVirtualCable, startAudio } from '../../state/actions';
import { useApp } from '../../state/store';
import { BrandMark, Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Segmented } from '../components/controls';
import { keyLabel } from '../format';

export function Modals() {
  const modal = useApp((s) => s.modal);
  switch (modal) {
    case 'start':
      return <StartModal />;
    case 'guide':
      return <GuideModal />;
    case 'shortcuts':
      return <ShortcutsModal />;
    case 'savePreset':
    case 'renamePreset':
      return <PresetNameModal />;
    default:
      return null;
  }
}

function StartModal() {
  const t = useT();
  const close = useApp((s) => s.closeModal);
  const go = (source: 'mic' | 'test') => {
    close();
    startAudio(source);
  };
  return (
    <Modal onClose={close} bare>
      <div className="welcome-hero">
        <span className="brand-mark">
          <BrandMark size={28} />
        </span>
        <h2>{t('start.title')}</h2>
        <p>{t('start.lead')}</p>
      </div>
      <div className="modal-body">
        <ol className="steps">
          <li>{t('start.step1')}</li>
          <li>{t('start.step2')}</li>
          <li>{t('start.step3')}</li>
        </ol>
        <div className="callout warn">
          <Icon name="headphones" size={18} />
          <span>{t('start.headphones')}</span>
        </div>
        <div className="callout">
          <Icon name="check" size={18} />
          <span>{t('start.privacy')}</span>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={close}>
          {t('start.later')}
        </button>
        <button className="btn" onClick={() => go('test')}>
          {t('start.useTest')}
        </button>
        <button className="btn primary" onClick={() => go('mic')}>
          <Icon name="mic" size={15} />
          {t('start.useMic')}
        </button>
      </div>
    </Modal>
  );
}

const LINUX_CMD = `pactl load-module module-null-sink sink_name=MutaVoce sink_properties=device.description=MutaVoce`;

function GuideModal() {
  const t = useT();
  const close = useApp((s) => s.closeModal);
  const outputs = useApp((s) => s.devices.outputs);
  const running = useApp((s) => s.status === 'running');
  const sendId = useApp((s) => s.output.sendDeviceId);
  const sendOn = useApp((s) => s.output.sendEnabled);
  const detected = detectOS();
  const [os, setOs] = useState<Exclude<OS, 'other'> | 'phone'>(detected === 'other' ? 'mac' : detected);
  const virtual = findVirtualOutput(outputs);
  const [copied, setCopied] = useState(false);

  return (
    <Modal title={t('guide.title')} onClose={close} wide footer={<button className="btn primary" onClick={close}>OK</button>}>
      <p style={{ marginTop: 0, color: 'var(--text-2)' }}>{t('guide.why')}</p>
      <Segmented
        value={os}
        onChange={setOs}
        options={[
          { value: 'mac', label: 'macOS' },
          { value: 'windows', label: 'Windows' },
          { value: 'linux', label: 'Linux' },
          { value: 'phone', label: t('guide.tabPhone') },
        ]}
      />
      {os === 'mac' && (
        <ol className="steps">
          <li>
            <span>
              {t('guide.mac.1')}{' '}
              <a href="https://existential.audio/blackhole/" target="_blank" rel="noreferrer noopener">
                {t('guide.download')} BlackHole ↗
              </a>
            </span>
          </li>
          <li>{t('guide.mac.2')}</li>
          <li>{t('guide.mac.3')}</li>
          <li>{t('guide.mac.4')}</li>
        </ol>
      )}
      {os === 'windows' && (
        <ol className="steps">
          <li>
            <span>
              {t('guide.win.1')}{' '}
              <a href="https://vb-audio.com/Cable/" target="_blank" rel="noreferrer noopener">
                {t('guide.download')} VB-CABLE ↗
              </a>
            </span>
          </li>
          <li>{t('guide.win.2')}</li>
          <li>{t('guide.win.3')}</li>
          <li>{t('guide.win.4')}</li>
        </ol>
      )}
      {os === 'linux' && (
        <ol className="steps">
          <li>
            <div style={{ minWidth: 0, flex: 1 }}>
              {t('guide.linux.1')}
              <code className="code">{LINUX_CMD}</code>
              <button
                className="btn sm"
                onClick={() => {
                  navigator.clipboard?.writeText(LINUX_CMD).then(() => setCopied(true));
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={13} />
                {copied ? 'OK' : 'Copy'}
              </button>
            </div>
          </li>
          <li>{t('guide.linux.2')}</li>
          <li>{t('guide.linux.3')}</li>
        </ol>
      )}
      {os === 'phone' && (
        <>
          <div className="callout warn" style={{ marginTop: 16 }}>
            <Icon name="info" size={18} />
            <span>{t('guide.phone.why')}</span>
          </div>
          <h4 className="guide-sub">{t('guide.phone.mac.title')}</h4>
          <ol className="steps">
            <li>
              <span>
                {t('guide.phone.mac.1')}{' '}
                <a href="https://existential.audio/blackhole/" target="_blank" rel="noreferrer noopener">
                  {t('guide.download')} BlackHole ↗
                </a>
              </span>
            </li>
            <li>{t('guide.phone.mac.2')}</li>
            <li>{t('guide.phone.mac.3')}</li>
            <li>{t('guide.phone.mac.4')}</li>
          </ol>
          <h4 className="guide-sub">{t('guide.phone.win.title')}</h4>
          <ol className="steps">
            <li>
              <span>
                {t('guide.phone.win.1')}{' '}
                <a href="https://vb-audio.com/Cable/" target="_blank" rel="noreferrer noopener">
                  {t('guide.download')} VB-CABLE ↗
                </a>
              </span>
            </li>
            <li>{t('guide.phone.win.2')}</li>
            <li>{t('guide.phone.win.3')}</li>
            <li>{t('guide.phone.win.4')}</li>
          </ol>
          <h4 className="guide-sub">{t('guide.phone.cable.title')}</h4>
          <ol className="steps">
            <li>{t('guide.phone.cable.1')}</li>
            <li>{t('guide.phone.cable.2')}</li>
            <li>{t('guide.phone.cable.3')}</li>
          </ol>
          <div className="callout" style={{ marginBottom: 8 }}>
            <Icon name="headphones" size={18} />
            <span>{t('guide.phone.echo')}</span>
          </div>
        </>
      )}
      <div className={`callout${virtual ? ' ok' : ''}`}>
        <Icon name={virtual ? 'check' : 'info'} size={18} />
        <div style={{ flex: 1 }}>
          <strong>{t('guide.status')}: </strong>
          {!running && outputs.length === 0 ? t('guide.startFirst') : virtual ? `${t('guide.detected')} — ${virtual.label}` : t('guide.notDetected')}
          <div className="row" style={{ marginTop: 8 }}>
            {virtual && !(sendOn && sendId === virtual.deviceId) && (
              <button className="btn sm primary" onClick={() => selectVirtualCable()}>
                {t('guide.useIt')}
              </button>
            )}
            {virtual && sendOn && sendId === virtual.deviceId && <span className="hint ok" style={{ margin: 0 }}>✓ {t('toast.sendingTo', { name: virtual.label })}</span>}
            <button className="btn sm ghost" onClick={() => refreshDevices()}>
              <Icon name="refresh" size={13} />
              {t('io.refresh')}
            </button>
          </div>
        </div>
      </div>
      <div className="callout">
        <Icon name="headphones" size={18} />
        <span>{t('guide.monitor')}</span>
      </div>
      <div className="callout">
        <Icon name="info" size={18} />
        <span>{t('guide.browser')}</span>
      </div>
    </Modal>
  );
}

function ShortcutsModal() {
  const t = useT();
  const close = useApp((s) => s.closeModal);
  const ptt = useApp((s) => s.ptt);
  const rows: [string, string][] = [
    [t('shortcuts.start'), '⇧ Enter'],
    [t('shortcuts.bypass'), 'B'],
    [t('shortcuts.mute'), 'M'],
    [t('shortcuts.presetSlots'), '1 … 9'],
    [t('shortcuts.prevNext'), '← / →'],
    [t('shortcuts.record'), 'R'],
    [t('shortcuts.pads'), '⇧1 … ⇧9'],
    [t('shortcuts.ptt'), keyLabel(ptt.key)],
    [t('shortcuts.help'), '?'],
  ];
  return (
    <Modal title={t('shortcuts.title')} onClose={close}>
      <table className="shortcut-table">
        <tbody>
          {rows.map(([label, key]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>
                <span className="kbd">{key}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{t('shortcuts.note')}</p>
    </Modal>
  );
}

function PresetNameModal() {
  const t = useT();
  const loc = useLocalized();
  const modal = useApp((s) => s.modal);
  const target = useApp((s) => s.modalTarget);
  const close = useApp((s) => s.closeModal);
  const updateCustomPreset = useApp((s) => s.updateCustomPreset);
  const activeId = useApp((s) => s.activePresetId);
  const renaming = modal === 'renamePreset' ? findPreset(target) : undefined;
  const base = findPreset(activeId);
  const [name, setName] = useState(() => (renaming ? loc(renaming.name) : base && base.category !== 'custom' ? `${loc(base.name)} +` : ''));
  const [icon, setIcon] = useState(renaming?.icon ?? base?.icon ?? '⭐');

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    if (renaming) updateCustomPreset(renaming.id, { name: { it: clean, en: clean }, icon });
    else {
      const p = saveCurrentAsPreset(clean);
      updateCustomPreset(p.id, { icon });
    }
    close();
  };

  const icons = ['⭐', '🎙️', '🤖', '👽', '👹', '🐿️', '🎈', '🎤', '📻', '👻', '🦄', '🐉', '🔥', '💎', '🎮', '🧙'];

  return (
    <Modal
      title={renaming ? t('presets.renameTitle') : t('presets.saveTitle')}
      onClose={close}
      footer={
        <>
          <button className="btn ghost" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="field-label" htmlFor="preset-name">
        {t('presets.namePrompt')}
      </label>
      <input
        id="preset-name"
        className="input"
        autoFocus
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') close();
        }}
        style={{ marginTop: 6 }}
      />
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 4 }}>
        {icons.map((i) => (
          <button
            key={i}
            className="icon-btn"
            style={i === icon ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
            onClick={() => setIcon(i)}
            aria-pressed={i === icon}
          >
            {i}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'error' ? ' error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
