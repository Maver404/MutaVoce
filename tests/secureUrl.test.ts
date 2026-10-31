import { describe, expect, it } from 'vitest';
import { secureAlternative } from '../src/ui/secureUrl';

describe('secureAlternative', () => {
  it('maps the Docker HTTP port to the HTTPS port', () => {
    expect(secureAlternative('http://192.168.1.50:8080/')).toBe('https://192.168.1.50:8443/');
    expect(secureAlternative('http://nas.local:8080/mutavoce/?x=1')).toBe('https://nas.local:8443/mutavoce/?x=1');
    expect(secureAlternative('http://[fd00::5]:8080/')).toBe('https://[fd00::5]:8443/');
  });

  it('assumes standard ports behind a proxy', () => {
    expect(secureAlternative('http://voce.example.com/')).toBe('https://voce.example.com/');
  });

  it('does not guess for other ports or for HTTPS pages', () => {
    expect(secureAlternative('http://10.0.0.9:3000/')).toBeNull();
    expect(secureAlternative('https://10.0.0.9:8443/')).toBeNull();
  });
});
