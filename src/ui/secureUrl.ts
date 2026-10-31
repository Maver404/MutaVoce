/**
 * Where the HTTPS version of this page probably lives, when it was opened over plain HTTP
 * from an address other than localhost. The Docker image serves HTTP on 8080 and HTTPS on
 * 8443; without a port we assume a proxy on the standard ports. Unknown ports: no guess.
 */
export function secureAlternative(href: string): string | null {
  const url = new URL(href);
  if (url.protocol !== 'http:') return null;
  if (url.port === '8080') url.port = '8443';
  else if (url.port !== '') return null;
  url.protocol = 'https:';
  return url.toString();
}
