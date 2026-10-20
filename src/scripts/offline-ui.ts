import { isRecord, OFFLINE_CACHE, pageAssets, scriptImports, sizeLabel, type OfflineRecord } from '../lib/offline';
import { $, loadJSON, saveJSON } from './dom';

const KEY = 'fsk:offline:v1';
const status = $('#off-status');
const bar = $('#off-bar') as HTMLProgressElement;
const go = $('#off-go') as HTMLButtonElement;
const remove = $('#off-remove') as HTMLButtonElement;
const pages: string[] = JSON.parse($('#off-data').dataset.pages ?? '[]');

const supported = 'caches' in window && 'serviceWorker' in navigator;
let record = loadJSON<OfflineRecord | null>(KEY, null, (v): v is OfflineRecord | null => v === null || isRecord(v));

function describe() {
  if (!supported) {
    status.textContent = 'This browser cannot save pages for offline use. Try Chrome or Firefox on your phone.';
    go.disabled = true;
    remove.hidden = true;
    return;
  }
  go.disabled = false;
  if (record) {
    const when = new Date(record.at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    status.textContent = `Saved on ${when}: ${record.files} files, ${sizeLabel(record.bytes)}.`;
    go.textContent = 'Update saved copy';
    remove.hidden = false;
  } else {
    status.textContent = 'Not saved yet.';
    go.textContent = 'Save for offline use';
    remove.hidden = true;
  }
}

async function fetchInto(cache: Cache, path: string, seen: Set<string>): Promise<{ bytes: number; text: string | null; contentType: string }> {
  const res = await fetch(path, { cache: 'reload' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const copy = res.clone();
  await cache.put(path, copy);
  seen.add(path);
  const contentType = res.headers.get('content-type') ?? '';
  const isText = /html|javascript|css/.test(contentType);
  const text = isText ? await res.text() : (await res.arrayBuffer(), null);
  const len = Number(res.headers.get('content-length'));
  return { bytes: Number.isFinite(len) && len > 0 ? len : (text?.length ?? 0), text, contentType };
}

async function save() {
  go.disabled = true;
  remove.disabled = true;
  bar.hidden = false;
  bar.value = 0;
  status.textContent = 'Saving…';
  const seen = new Set<string>();
  const failed: string[] = [];
  let bytes = 0;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const queue: string[] = [...pages];
    const queued = new Set(queue);
    let done = 0;
    const origin = location.origin;

    const worker = async () => {
      for (;;) {
        const path = queue.shift();
        if (path === undefined) return;
        try {
          const r = await fetchInto(cache, path, seen);
          bytes += r.bytes;
          const base = origin + path;
          let more: string[] = [];
          if (/html/.test(r.contentType) && r.text) more = pageAssets(r.text, base);
          else if (/javascript/.test(r.contentType) && r.text) more = scriptImports(r.text, base);
          for (const m of more) {
            if (!queued.has(m)) {
              queued.add(m);
              queue.push(m);
            }
          }
        } catch {
          failed.push(path);
        }
        done++;
        bar.value = Math.min(100, Math.round((done / queued.size) * 100));
        status.textContent = `Saving… ${done} of ${queued.size} files`;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    const criticalFailed = failed.filter((f) => pages.includes(f));
    if (criticalFailed.length) {
      status.textContent = `Could not save ${criticalFailed.length} page${criticalFailed.length === 1 ? '' : 's'}. Check your connection and try again.`;
    } else {
      record = { at: Date.now(), files: seen.size, bytes };
      const stored = saveJSON(KEY, record);
      describe();
      status.textContent += failed.length ? ` ${failed.length} extra file${failed.length === 1 ? '' : 's'} could not be saved.` : '';
      if (!stored) status.textContent += ' Your browser would not remember this, but the files are saved.';
    }
  } catch {
    status.textContent = 'Your phone has no room to save, or the browser blocked it. Free some space and try again.';
  }
  bar.hidden = true;
  go.disabled = false;
  remove.disabled = false;
}

go.addEventListener('click', save);
remove.addEventListener('click', async () => {
  await caches.delete(OFFLINE_CACHE);
  record = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  describe();
});

describe();
// If the cache was cleared by the browser, do not claim it is saved.
if (supported && record) {
  caches.has(OFFLINE_CACHE).then((has) => {
    if (!has) {
      record = null;
      describe();
    }
  });
}
