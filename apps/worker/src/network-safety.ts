import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateIpv4(value: string): boolean {
  const parts = value.split('.').map(Number);
  const [first, second] = parts;
  if (parts.length !== 4 || first === undefined || second === undefined)
    return true;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateAddress(value: string): boolean {
  if (isIP(value) === 4) return isPrivateIpv4(value);
  const normalized = value.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice(7));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  );
}

export async function assertSafeRemoteUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs can be imported');
  }
  if (url.username || url.password)
    throw new Error('URL credentials are not allowed');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some((item) => isPrivateAddress(item.address))
  ) {
    throw new Error('Private or unresolved network addresses are not allowed');
  }
  return url;
}

export async function fetchPublicHtml(value: string): Promise<string> {
  let current = value;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const url = await assertSafeRemoteUrl(current);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'FeedbackAgentKnowledgeImporter/0.1',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location)
        throw new Error('Redirect response did not provide a location');
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok)
      throw new Error(`URL import failed with HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
      throw new Error('URL did not return HTML content');
    }
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > 2 * 1024 * 1024)
      throw new Error('HTML page exceeds 2 MB');
    const body = await response.arrayBuffer();
    if (body.byteLength > 2 * 1024 * 1024)
      throw new Error('HTML page exceeds 2 MB');
    return new TextDecoder().decode(body);
  }
  throw new Error('URL exceeded the maximum redirect count');
}
