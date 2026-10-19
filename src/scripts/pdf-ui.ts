import { el } from './dom';
import { fileSize, parsePageRange } from '../lib/pagerange';

/** pdf-lib is large, so it is only fetched when someone actually makes a PDF. */
const loadPdfLib = () => import('pdf-lib');

const MAX_BYTES = 60 * 1024 * 1024;

interface Item {
  id: number;
  file: File;
}

let nextId = 1;
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function say(id: string, text: string, kind: 'info' | 'error' | 'ok' = 'info') {
  const box = byId(id);
  box.textContent = text;
  box.dataset.kind = kind;
  box.hidden = !text;
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function friendly(e: unknown, file?: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/encrypt/i.test(msg)) return `${file ?? 'A file'} is password protected. Remove the password first, then try again.`;
  if (/No PDF header|Failed to parse|Invalid|not a PDF/i.test(msg)) return `${file ?? 'A file'} could not be read as a PDF.`;
  return `Something went wrong${file ? ` with ${file}` : ''}. Try a smaller file or fewer files.`;
}

function tooBig(files: File[]): string | null {
  const big = files.find((f) => f.size > MAX_BYTES);
  return big ? `${big.name} is ${fileSize(big.size)}. Files over ${fileSize(MAX_BYTES)} may crash a phone browser, so split or compress it first.` : null;
}

/** An orderable file list: add, move up/down, remove. */
function orderedList(listId: string, onChange: () => void) {
  const items: Item[] = [];
  const root = byId(listId);

  function render() {
    root.replaceChildren(
      ...items.map((it, i) =>
        el(
          'li',
          { class: 'flex items-center gap-2 rounded-lg border border-border bg-surface p-2' },
          el('span', { class: 'min-w-0 flex-1 truncate text-sm' }, `${i + 1}. ${it.file.name}`),
          el('span', { class: 'shrink-0 text-xs text-muted' }, fileSize(it.file.size)),
          el('button', { type: 'button', class: 'btn btn-quiet btn-icon', 'aria-label': `Move ${it.file.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          el('button', { type: 'button', class: 'btn btn-quiet btn-icon', 'aria-label': `Move ${it.file.name} down`, disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓'),
          el('button', { type: 'button', class: 'btn btn-quiet btn-icon', 'aria-label': `Remove ${it.file.name}`, onclick: () => remove(i) }, '×'),
        ),
      ),
    );
    onChange();
  }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
    (root.children[j]?.querySelector(`button[aria-label^="Move"]:not([disabled])`) as HTMLElement | null)?.focus();
  }
  function remove(i: number) {
    items.splice(i, 1);
    render();
  }
  return {
    items,
    add(files: File[]) {
      for (const file of files) items.push({ id: nextId++, file });
      render();
    },
    clear() {
      items.length = 0;
      render();
    },
  };
}

/* ---------- Merge ---------- */
function setupMerge() {
  const list = orderedList('merge-list', () => {
    (byId('merge-go') as HTMLButtonElement).disabled = list.items.length < 2;
    byId('merge-empty').hidden = list.items.length > 0;
  });
  byId<HTMLInputElement>('merge-files').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const bad = files.find((f) => f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name));
    if (bad) return say('merge-msg', `${bad.name} is not a PDF.`, 'error');
    const big = tooBig(files);
    if (big) return say('merge-msg', big, 'error');
    say('merge-msg', '');
    list.add(files);
  });
  byId('merge-go').addEventListener('click', async () => {
    const btn = byId<HTMLButtonElement>('merge-go');
    btn.disabled = true;
    say('merge-msg', 'Merging…');
    let current = '';
    try {
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      for (const it of list.items) {
        current = it.file.name;
        const src = await PDFDocument.load(await it.file.arrayBuffer());
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      download(await out.save(), 'merged.pdf');
      say('merge-msg', `Done. ${out.getPageCount()} pages saved as merged.pdf.`, 'ok');
    } catch (e) {
      say('merge-msg', friendly(e, current), 'error');
    } finally {
      btn.disabled = list.items.length < 2;
    }
  });
}

/* ---------- Images to PDF ---------- */
const A4: [number, number] = [595.28, 841.89];

async function toJpegBytes(file: File): Promise<Uint8Array> {
  // Anything that is not JPG or PNG (WebP, some phone formats) is redrawn through a canvas.
  const bmp = await createImageBitmap(file);
  const canvas = el('canvas', { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Image could not be converted');
  return new Uint8Array(await blob.arrayBuffer());
}

function setupImages() {
  const list = orderedList('img-list', () => {
    (byId('img-go') as HTMLButtonElement).disabled = list.items.length < 1;
    byId('img-empty').hidden = list.items.length > 0;
  });
  byId<HTMLInputElement>('img-files').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const bad = files.find((f) => !f.type.startsWith('image/'));
    if (bad) return say('img-msg', `${bad.name} is not an image.`, 'error');
    const big = tooBig(files);
    if (big) return say('img-msg', big, 'error');
    say('img-msg', '');
    list.add(files);
  });
  byId('img-go').addEventListener('click', async () => {
    const btn = byId<HTMLButtonElement>('img-go');
    btn.disabled = true;
    say('img-msg', 'Building your PDF…');
    const mode = byId<HTMLSelectElement>('img-size').value; // 'a4' | 'fit'
    let current = '';
    try {
      const { PDFDocument } = await loadPdfLib();
      const pdf = await PDFDocument.create();
      for (const it of list.items) {
        current = it.file.name;
        const buf = new Uint8Array(await it.file.arrayBuffer());
        const img = it.file.type === 'image/png' ? await pdf.embedPng(buf) : it.file.type === 'image/jpeg' ? await pdf.embedJpg(buf) : await pdf.embedJpg(await toJpegBytes(it.file));
        if (mode === 'fit') {
          pdf.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const landscape = img.width > img.height;
          const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
          const margin = 24;
          const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          pdf.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }
      download(await pdf.save(), 'images.pdf');
      say('img-msg', `Done. ${pdf.getPageCount()} page${pdf.getPageCount() === 1 ? '' : 's'} saved as images.pdf.`, 'ok');
    } catch (e) {
      say('img-msg', friendly(e, current), 'error');
    } finally {
      btn.disabled = list.items.length < 1;
    }
  });
}

/* ---------- Keep or remove pages ---------- */
function setupPages() {
  let file: File | null = null;
  let total = 0;
  const go = byId<HTMLButtonElement>('pg-go');

  byId<HTMLInputElement>('pg-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = '';
    file = null;
    total = 0;
    go.disabled = true;
    byId('pg-info').textContent = '';
    if (!picked) return;
    if (picked.type !== 'application/pdf' && !/\.pdf$/i.test(picked.name)) return say('pg-msg', `${picked.name} is not a PDF.`, 'error');
    const big = tooBig([picked]);
    if (big) return say('pg-msg', big, 'error');
    say('pg-msg', 'Reading…');
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.load(await picked.arrayBuffer());
      file = picked;
      total = doc.getPageCount();
      byId('pg-info').textContent = `${picked.name}: ${total} page${total === 1 ? '' : 's'}, ${fileSize(picked.size)}`;
      say('pg-msg', '');
      go.disabled = false;
    } catch (err) {
      say('pg-msg', friendly(err, picked.name), 'error');
    }
  });

  go.addEventListener('click', async () => {
    if (!file) return;
    const parsed = parsePageRange(byId<HTMLInputElement>('pg-range').value, total);
    if (!parsed.ok) return say('pg-msg', parsed.error, 'error');
    const remove = byId<HTMLSelectElement>('pg-mode').value === 'remove';
    let indexes = parsed.pages;
    if (remove) {
      const drop = new Set(indexes);
      indexes = Array.from({ length: total }, (_, i) => i).filter((i) => !drop.has(i));
      if (!indexes.length) return say('pg-msg', 'That would remove every page. Leave at least one.', 'error');
    }
    go.disabled = true;
    say('pg-msg', 'Working…');
    try {
      const { PDFDocument } = await loadPdfLib();
      const src = await PDFDocument.load(await file.arrayBuffer());
      const out = await PDFDocument.create();
      (await out.copyPages(src, indexes)).forEach((p) => out.addPage(p));
      const base = file.name.replace(/\.pdf$/i, '');
      download(await out.save(), `${base}-edited.pdf`);
      say('pg-msg', `Done. ${out.getPageCount()} page${out.getPageCount() === 1 ? '' : 's'} saved as ${base}-edited.pdf.`, 'ok');
    } catch (err) {
      say('pg-msg', friendly(err, file.name), 'error');
    } finally {
      go.disabled = false;
    }
  });
}

/* ---------- Tabs ---------- */
function setupTabs() {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
  function show(name: string) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (history.replaceState) history.replaceState(null, '', `#${name}`);
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab!)));
  const wanted = location.hash.slice(1);
  show(tabs.some((t) => t.dataset.tab === wanted) ? wanted : 'merge');
}

setupTabs();
setupMerge();
setupImages();
setupPages();
