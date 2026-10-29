import { t } from '../i18n';
import { isTalkOpen, refreshDevices } from '../state/actions';
import { pickPersisted, savePersisted } from '../state/persistence';
import { type AppState, getState, useApp } from '../state/store';
import { engine } from './AudioEngine';

/** Wires the store to the audio engine and to persistence. Call once at startup. */
export function connectEngine(): void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let warnedStorage = false;

  useApp.subscribe((s: AppState, prev: AppState) => {
    if (s.params !== prev.params) engine.applyParams(s.params);
    if (s.bypass !== prev.bypass) engine.setBypass(s.bypass);
    if (s.muted !== prev.muted) engine.setMuted(s.muted);
    if (s.ptt !== prev.ptt || s.pttHeld !== prev.pttHeld) engine.setTalkOpen(isTalkOpen());

    if (s.status === 'running') {
      if (s.output !== prev.output) engine.setOutputs(s.output);
      if (s.input !== prev.input) {
        const a = s.input;
        const b = prev.input;
        const restart = a.source !== b.source || a.deviceId !== b.deviceId || a.mic !== b.mic;
        if (restart) {
          engine.setInput({ ...a }).catch((err) => {
            const code = err?.code ?? 'generic';
            getState().toast(t(`errors.${code}` as 'errors.generic'), 'error');
          });
        } else if (a.gainDb !== b.gainDb) engine.setInputGain(a.gainDb);
      }
    }

    if (s.theme !== prev.theme) document.documentElement.dataset.theme = s.theme;
    if (s.lang !== prev.lang) document.documentElement.lang = s.lang;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!savePersisted(pickPersisted(getState())) && !warnedStorage) {
        warnedStorage = true;
        getState().toast(t('toast.storageFull'), 'error');
      }
    }, 300);
  });

  engine.on('voice', (open) => getState().set({ voiceActive: open }));
  engine.on('error', (err) => {
    getState().toast(t(`errors.${err.code}`), 'error');
    if (err.code === 'nodevice') refreshDevices();
  });

  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    refreshDevices();
  });

  const s = getState();
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.lang = s.lang;
  refreshDevices();
}
