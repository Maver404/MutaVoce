import { useEffect } from 'react';
import { playPad, selectFavoriteSlot, stepPreset, toggleAudio, toggleRecording } from '../../state/actions';
import { getState } from '../../state/store';

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable;
};

/** Global keyboard handling: shortcuts, push-to-talk and key binding capture. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = getState();

      if (s.capturing) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') return s.set({ capturing: null });
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (s.capturing === 'ptt') {
          s.set({ ptt: { ...s.ptt, key: e.code }, capturing: null });
        } else {
          const clear = e.key === 'Delete' || e.key === 'Backspace';
          const code = clear ? null : `${e.shiftKey ? 'Shift+' : ''}${e.code}`;
          // A key can only belong to one pad.
          const pads = s.pads.map((p) => (p.id === s.capturing ? { ...p, key: code } : p.key === code ? { ...p, key: null } : p));
          s.set({ pads, capturing: null });
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (s.modal) return;

      // Push-to-talk first: it must win over everything else.
      if (s.ptt.mode !== 'off' && e.code === s.ptt.key) {
        e.preventDefault();
        if (e.repeat) return;
        if (s.ptt.mode === 'hold') s.set({ pttHeld: true });
        else s.set({ pttHeld: !s.pttHeld });
        return;
      }

      const combo = `${e.shiftKey ? 'Shift+' : ''}${e.code}`;
      const pad = s.pads.find((p) => p.key === combo);
      if (pad) {
        e.preventDefault();
        if (!e.repeat) playPad(pad.id);
        return;
      }

      if (e.repeat) return;
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        toggleAudio();
        return;
      }
      if (e.key === '?') {
        s.openModal('shortcuts');
        return;
      }
      if (e.shiftKey) return;
      switch (e.code) {
        case 'KeyB':
          s.set({ bypass: !s.bypass });
          break;
        case 'KeyM':
          s.set({ muted: !s.muted });
          break;
        case 'KeyR':
          toggleRecording();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepPreset(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepPreset(1);
          break;
        default:
          if (/^Digit[1-9]$/.test(e.code)) selectFavoriteSlot(Number(e.code.slice(5)));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = getState();
      if (s.ptt.mode === 'hold' && e.code === s.ptt.key && s.pttHeld) s.set({ pttHeld: false });
    };

    // Never leave push-to-talk stuck open when the window loses focus.
    const onBlur = () => {
      const s = getState();
      if (s.ptt.mode === 'hold' && s.pttHeld) s.set({ pttHeld: false });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
