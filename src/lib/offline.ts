/** Helpers for saving the site for offline use. Pure functions so they can be tested. */

export const OFFLINE_CACHE = 'fsk-offline-v1';

function sameOrigin(raw: string, base: string): string | null {
  try {
    const b = new URL(base);
    const u = new URL(raw, b);
    if (u.origin !== b.origin) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

/** Same-site files a page needs: styles, scripts, icons, manifest. */
export function pageAssets(html: string, pageUrl: string): string[] {
  const found = new Set<string>();
  const tag = /<(link|script)\b[^>]*>/gi;
  for (const m of html.matchAll(tag)) {
    const t = m[0];
    const attr = /\b(?:href|src)\s*=\s*("([^"]*)"|'([^']*)')/i.exec(t);
    if (!attr) continue;
    const raw = attr[2] ?? attr[3] ?? '';
    if (m[1].toLowerCase() === 'link') {
      const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(t)?.[1].toLowerCase() ?? '';
      if (!/(stylesheet|modulepreload|preload|icon|manifest)/.test(rel)) continue;
    }
    const path = sameOrigin(raw, pageUrl);
    if (path) found.add(path);
  }
  return [...found];
}

/** Files a script loads later with import(...) or import ... from. Quoted .js paths are enough for built output. */
export function scriptImports(js: string, scriptUrl: string): string[] {
  const found = new Set<string>();
  for (const m of js.matchAll(/["'`]((?:\.{1,2}\/|\/)[\w./@-]+?\.js)["'`]/g)) {
    const path = sameOrigin(m[1], scriptUrl);
    if (path) found.add(path);
  }
  return [...found];
}

export interface OfflineRecord {
  at: number;
  files: number;
  bytes: number;
}
export const isRecord = (v: unknown): v is OfflineRecord =>
  !!v && typeof (v as OfflineRecord).at === 'number' && typeof (v as OfflineRecord).files === 'number' && typeof (v as OfflineRecord).bytes === 'number';

export function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
