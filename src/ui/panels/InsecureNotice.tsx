import { useT } from '../../i18n';
import { Icon } from '../components/Icon';
import { secureAlternative } from '../secureUrl';

/** Explains why the microphone is blocked when the page is served over HTTP from a LAN address. */
export function InsecureNotice() {
  const t = useT();
  if (typeof window === 'undefined' || window.isSecureContext) return null;
  const https = secureAlternative(window.location.href);
  return (
    <div className="insecure-notice" role="alert">
      <Icon name="info" size={18} />
      <div>
        <strong>{t('insecure.title', { host: window.location.host })}</strong>
        <span>{t('insecure.body')}</span>
        {https && (
          <span>
            <a href={https}>{t('insecure.open', { url: https })}</a> {t('insecure.certWarning')}
          </span>
        )}
      </div>
    </div>
  );
}
