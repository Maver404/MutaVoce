import { type ReactNode, useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { Icon } from './Icon';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  bare,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // React's autoFocus has already run; otherwise focus the primary action.
    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>('.btn.primary') ?? el.querySelector<HTMLElement>('button'))?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')).filter((n) => !n.hasAttribute('disabled'));
        if (!items.length) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {!bare && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn ghost" onClick={onClose} aria-label={t('common.close')}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className={bare ? '' : 'modal-body'}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
