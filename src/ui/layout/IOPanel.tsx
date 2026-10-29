import { useRef } from 'react';
import { findVirtualOutput, isMobile, supports } from '../../audio/devices';
import { useT } from '../../i18n';
import { chooseOutputWithPicker, loadInputFile, refreshDevices, selectVirtualCable } from '../../state/actions';
import { useApp } from '../../state/store';
import { Icon } from '../components/Icon';
import { Meter } from '../components/Meter';
import { Segmented, Select, Slider, Switch, ToggleRow } from '../components/controls';

export function IOPanel() {
  return (
    <>
      <InputSection />
      <MonitorSection />
      <SendSection />
    </>
  );
}

function InputSection() {
  const t = useT();
  const input = useApp((s) => s.input);
  const inputs = useApp((s) => s.devices.inputs);
  const fileName = useApp((s) => s.fileName);
  const setInput = useApp((s) => s.setInput);
  const setMic = useApp((s) => s.setMic);
  const fileRef = useRef<HTMLInputElement>(null);
  const labeled = inputs.some((d) => d.label && !/^Mic \d+$/.test(d.label));

  return (
    <section className="section">
      <div className="section-head">
        <Icon name="mic" size={16} />
        <h3>{t('io.input')}</h3>
      </div>
      <Segmented
        full
        value={input.source}
        label={t('io.input')}
        onChange={(source) => {
          if (source === 'file' && !fileName) fileRef.current?.click();
          else setInput({ source });
        }}
        options={[
          { value: 'mic', label: t('io.mic') },
          { value: 'test', label: t('io.test') },
          { value: 'file', label: t('io.file') },
        ]}
      />
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadInputFile(f);
          e.target.value = '';
        }}
      />
      {input.source === 'mic' && (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="field-label">{t('io.device')}</span>
            <Select
              value={input.deviceId ?? ''}
              label={t('io.device')}
              onChange={(v) => setInput({ deviceId: v || null })}
              options={[
                { value: '', label: t('io.default') },
                ...inputs.filter((d) => d.deviceId !== 'default').map((d) => ({ value: d.deviceId, label: d.label })),
              ]}
            />
          </div>
          {!labeled && <p className="hint">{t('io.devicesHint')}</p>}
          <details style={{ marginTop: 10 }}>
            <summary className="hint" style={{ cursor: 'pointer', margin: 0 }}>
              {t('io.micOptions')}
            </summary>
            <div style={{ marginTop: 8 }}>
              <ToggleRow checked={input.mic.noiseSuppression} onChange={(v) => setMic({ noiseSuppression: v })} label={t('io.noiseSuppression')} />
              <ToggleRow checked={input.mic.echoCancellation} onChange={(v) => setMic({ echoCancellation: v })} label={t('io.echoCancellation')} />
              <ToggleRow checked={input.mic.autoGainControl} onChange={(v) => setMic({ autoGainControl: v })} label={t('io.autoGainControl')} />
              <p className="hint">{t('io.micOptionsHint')}</p>
            </div>
          </details>
        </>
      )}
      {input.source === 'file' && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={14} />
            {t('io.chooseFile')}
          </button>
          <span className="hint" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName || t('io.noFile')}
          </span>
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <span className="field-label">{t('io.gain')}</span>
        <Slider
          value={input.gainDb}
          min={-24}
          max={24}
          step={0.5}
          label={t('io.gain')}
          onChange={(v) => setInput({ gainDb: v })}
          display={`${input.gainDb > 0 ? '+' : ''}${input.gainDb.toFixed(1)} dB`}
        />
      </div>
      <div className="row">
        <span className="field-label">{t('visual.input')}</span>
        <Meter which="in" label={t('visual.input')} />
      </div>
    </section>
  );
}

function OutputSelect({ value, onChange, target }: { value: string | null; onChange: (v: string | null) => void; target: 'monitor' | 'send' }) {
  const t = useT();
  const outputs = useApp((s) => s.devices.outputs);
  const canPick = supports.selectAudioOutput && outputs.length === 0;
  if (canPick) {
    return (
      <button className="btn sm block" onClick={() => chooseOutputWithPicker(target)}>
        {outputs.find((o) => o.deviceId === value)?.label ?? t('io.pickOutput')}
      </button>
    );
  }
  const options = outputs.filter((d) => d.deviceId !== 'default');
  return (
    <Select
      value={value ?? ''}
      label={t('io.device')}
      onChange={(v) => onChange(v || null)}
      options={[
        { value: '', label: target === 'monitor' ? t('io.default') : t('io.selectDevice') },
        ...options.map((d) => ({ value: d.deviceId, label: d.virtual ? `🔌 ${d.label}` : d.label })),
      ]}
    />
  );
}

function MonitorSection() {
  const t = useT();
  const output = useApp((s) => s.output);
  const setOutput = useApp((s) => s.setOutput);
  const canChoose = supports.contextSinkId || supports.elementSinkId;
  return (
    <section className="section">
      <div className="section-head">
        <Icon name="headphones" size={16} />
        <h3>{t('io.monitor')}</h3>
        <Switch checked={output.monitorEnabled} onChange={(v) => setOutput({ monitorEnabled: v })} label={t('io.monitor')} />
      </div>
      {canChoose && (
        <div className="row">
          <span className="field-label">{t('io.device')}</span>
          <OutputSelect target="monitor" value={output.monitorDeviceId} onChange={(v) => setOutput({ monitorDeviceId: v })} />
        </div>
      )}
      <div className="row">
        <span className="field-label">{t('io.volume')}</span>
        <Slider
          value={output.monitorVolume}
          min={0}
          max={1}
          step={0.01}
          label={t('io.volume')}
          onChange={(v) => setOutput({ monitorVolume: v })}
          display={`${Math.round(output.monitorVolume * 100)}%`}
        />
      </div>
      <p className="hint">{t('io.monitorHint')}</p>
    </section>
  );
}

function SendSection() {
  const t = useT();
  const output = useApp((s) => s.output);
  const outputs = useApp((s) => s.devices.outputs);
  const setOutput = useApp((s) => s.setOutput);
  const openModal = useApp((s) => s.openModal);
  const virtual = findVirtualOutput(outputs);
  const mobile = isMobile();
  const same =
    output.sendEnabled && output.monitorEnabled && !!output.sendDeviceId && output.sendDeviceId === (output.monitorDeviceId ?? 'default');

  return (
    <section className="section">
      <div className="section-head">
        <Icon name="plug" size={16} />
        <h3>{t('io.send')}</h3>
        <Switch
          checked={output.sendEnabled}
          disabled={!supports.elementSinkId}
          onChange={(v) => {
            if (v && !output.sendDeviceId && !selectVirtualCable()) {
              openModal('guide');
              return;
            }
            setOutput({ sendEnabled: v });
          }}
          label={t('io.send')}
        />
      </div>
      {!supports.elementSinkId ? (
        <p className="hint warn">{mobile ? t('io.mobileNote') : t('io.noSinkSupport')}</p>
      ) : (
        <>
          <div className="row">
            <span className="field-label">{t('io.device')}</span>
            <OutputSelect
              target="send"
              value={output.sendDeviceId}
              onChange={(v) => setOutput({ sendDeviceId: v, sendEnabled: v ? true : output.sendEnabled })}
            />
          </div>
          {virtual ? (
            <p className="hint ok">✓ {t('io.virtualFound', { name: virtual.label })}</p>
          ) : (
            <p className="hint">{t('io.virtualMissing')}</p>
          )}
          {same && <p className="hint warn">{t('io.sameDevice')}</p>}
          <p className="hint">{t('io.sendHint')}</p>
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => openModal('guide')}>
              <Icon name="info" size={14} />
              {t('io.setupGuide')}
            </button>
            <button className="btn sm ghost" onClick={() => refreshDevices()}>
              <Icon name="refresh" size={14} />
              {t('io.refresh')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
