// Minimal GitHub REST "contents" client. No dependencies.
export type Repo = { owner: string; repo: string; branch: string };

const API = 'https://api.github.com';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function utf8Decode(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

export function toBase64(str: string): string {
  const b = utf8Encode(str);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(b64: string): string {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    bytes.push((n >> 16) & 255);
    if (clean[i + 2]) bytes.push((n >> 8) & 255);
    if (clean[i + 3]) bytes.push(n & 255);
  }
  return utf8Decode(bytes);
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

const url = (r: Repo, path: string) =>
  `${API}/repos/${r.owner}/${r.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

export async function getFile(
  token: string,
  r: Repo,
  path: string
): Promise<{ text: string; sha: string } | null> {
  const res = await fetch(`${url(r, path)}?ref=${encodeURIComponent(r.branch)}&t=${Date.now()}`, {
    headers: headers(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { text: fromBase64(j.content ?? ''), sha: j.sha };
}

export async function putFile(
  token: string,
  r: Repo,
  path: string,
  text: string,
  message: string,
  sha?: string
): Promise<string> {
  const body: Record<string, string> = { message, content: toBase64(text), branch: r.branch };
  if (sha) body.sha = sha;
  const res = await fetch(url(r, path), { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422) {
    throw new Error('Conflict: the file changed on GitHub (Leo may have just saved). Tap "Pull" first, then re-apply your edits.');
  }
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.content.sha as string;
}
