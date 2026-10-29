import { useRef, useState } from 'react';
import { BUILTIN_SOUNDS } from '../../audio/soundboard/synthSounds';
import { useT } from '../../i18n';
import { addCustomPads, deletePad, playPad, soundboard } from '../../state/actions';
import { type PadConfig, useApp } from '../../state/store';
import { Icon } from '../components/Icon';
import { Slider } from '../components/controls';
import { keyLabel } from '../format';

export function padName(pad: PadConfig, lang: 'it' | 'en'): string {
  if (pad.kind === 'custom') return pad.name ?? '';
  const s = BUILTIN_SOUNDS.find((b) => b.id === pad.sound);
  return s ? s[lang] : '';
}

export function SoundboardPanel() {
  const t = useT();
  const pads = useApp((s) => s.pads);
  const lang = useApp((s) => s.lang);
  const running = useApp((s) => s.status === 'running');
  const capturing = useApp((s) => s.capturing);
  const set = useApp((s) => s.set);
  const updatePad = useApp((s) => s.updatePad);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [hit, setHit] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sel = pads.find((p) => p.id === selected);

  const press = (pad: PadConfig) => {
    if (editing) {
      setSelected(pad.id);
      return;
    }
    playPad(pad.id);
    setHit(pad.id);
    setTimeout(() => setHit((h) => (h === pad.id ? null : h)), 150);
  };

  return (
    <section
      className="section"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) addCustomPads(e.dataTransfer.files);
      }}
    >
      <div className="section-head">
        <Icon name="grid" size={16} />
        <h3>{t('soundboard.title')}</h3>
        <button className="btn sm ghost" onClick={() => soundboard.stopAll()} title={t('soundboard.stopAll')}>
          <Icon name="stop" size={13} />
        </button>
        <button
          className={`btn sm${editing ? ' primary' : ''}`}
          onClick={() => {
            setEditing((e) => !e);
            setSelected(null);
            set({ capturing: null });
          }}
        >
          {editing ? t('soundboard.done') : t('soundboard.edit')}
        </button>
      </div>
      {!running && <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>{t('soundboard.needsEngine')}</p>}
      <div className="pads">
        {pads.map((pad) => (
          <button
            key={pad.id}
            className={`pad${hit === pad.id ? ' hit' : ''}${editing ? ' editing' : ''}`}
            onClick={() => press(pad)}
            aria-pressed={editing ? selected === pad.id : undefined}
            style={editing && selected === pad.id ? { borderColor: 'var(--accent)' } : undefined}
            title={padName(pad, lang)}
          >
            {pad.key && <span className="kbd">{keyLabel(pad.key)}</span>}
            <span className="emoji" aria-hidden="true">
              {pad.icon}
            </span>
            <span className="pad-name">{padName(pad, lang)}</span>
          </button>
        ))}
        <button className="pad" onClick={() => fileRef.current?.click()} title={t('soundboard.add')}>
          <span className="emoji">
            <Icon name="plus" size={22} />
          </span>
          <span className="pad-name">{t('soundboard.add')}</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addCustomPads(e.target.files);
          e.target.value = '';
        }}
      />
      <div className={`dropzone${over ? ' over' : ''}`}>{t('soundboard.dropHint')}</div>

      {editing && sel && (
        <div className="pad-editor">
          <div className="row">
            <span style={{ fontSize: 20 }}>{sel.icon}</span>
            {sel.kind === 'custom' ? (
              <input className="input" value={sel.name ?? ''} maxLength={24} onChange={(e) => updatePad(sel.id, { name: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
            ) : (
              <strong style={{ flex: 1 }}>{padName(sel, lang)}</strong>
            )}
          </div>
          <div className="row">
            <span className="field-label">{t('soundboard.volume')}</span>
            <Slider
              value={sel.volume}
              min={0}
              max={1.5}
              step={0.01}
              label={t('soundboard.volume')}
              onChange={(v) => updatePad(sel.id, { volume: v })}
              display={`${Math.round(sel.volume * 100)}%`}
            />
          </div>
          <div className="row">
            <span className="field-label">{t('soundboard.key')}</span>
            <button className={`kbd${capturing === sel.id ? ' capturing' : ''}`} onClick={() => set({ capturing: capturing === sel.id ? null : sel.id })}>
              {capturing === sel.id ? t('soundboard.pressKey') : sel.key ? keyLabel(sel.key) : t('soundboard.noKey')}
            </button>
            <span className="spacer" />
            {sel.kind === 'custom' && (
              <button
                className="btn sm danger"
                onClick={() => {
                  deletePad(sel.id);
                  setSelected(null);
                }}
              >
                <Icon name="trash" size={13} />
                {t('soundboard.delete')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
