import { FILE_BUCKET } from '../data/config';
import { departments } from '../data/departments';
import { canSubmit, filePath, validateSubmission, type Submission } from '../lib/library';
import { $, loadJSON, saveJSON } from './dom';
import { api } from './supabase';

const HISTORY_KEY = 'fsk:lib:sent';
const known = new Set(departments.map((d) => d.slug));
const val = (id: string) => ($(`#${id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

const linkWrap = $('#ct-link-wrap');
const fileWrap = $('#ct-file-wrap');
const msg = $('#ct-msg');
const send = $('#ct-send') as HTMLButtonElement;
const fileInput = $('#ct-file') as HTMLInputElement;

function mode(): 'link' | 'file' {
  return (document.querySelector<HTMLInputElement>('input[name="ct-mode"]:checked')?.value as 'link' | 'file') ?? 'link';
}
for (const r of document.querySelectorAll('input[name="ct-mode"]')) {
  r.addEventListener('change', () => {
    linkWrap.hidden = mode() !== 'link';
    fileWrap.hidden = mode() !== 'file';
  });
}

function say(text: string, kind: 'info' | 'ok' | 'error' = 'info') {
  msg.textContent = text;
  msg.hidden = !text;
  msg.style.background = kind === 'ok' ? 'var(--ok-bg)' : kind === 'error' ? 'var(--warn-bg)' : 'var(--tint)';
  msg.style.color = kind === 'ok' ? 'var(--ok-fg)' : kind === 'error' ? 'var(--warn-fg)' : 'inherit';
}

const FIELD_ERRORS: Record<string, string> = {
  title: 'ct-title-err',
  department: 'ct-dept-err',
  level: 'ct-level-err',
  courseCode: 'ct-code-err',
  session: 'ct-session-err',
  url: 'ct-url-err',
  file: 'ct-file-err',
  agreed: 'ct-agree-err',
};
function showErrors(errors: Record<string, string>) {
  for (const id of Object.values(FIELD_ERRORS)) $(`#${id}`).textContent = '';
  for (const [k, text] of Object.entries(errors)) {
    const target = FIELD_ERRORS[k];
    if (target) $(`#${target}`).textContent = text;
  }
}

function read(): Submission {
  const f = fileInput.files?.[0] ?? null;
  return {
    title: val('ct-title'),
    department: val('ct-dept'),
    level: val('ct-level'),
    semester: val('ct-sem'),
    courseCode: val('ct-code'),
    kind: val('ct-kind'),
    session: val('ct-session'),
    description: val('ct-desc'),
    contributor: val('ct-who'),
    mode: mode(),
    url: val('ct-url'),
    file: f ? { type: f.type, size: f.size } : null,
    agreed: ($('#ct-agree') as HTMLInputElement).checked,
  };
}

function fail(status: number): string {
  if (status === 401 || status === 403) return 'The library is not accepting new items right now (it may be full of items waiting to be checked). Please try again in a few days.';
  if (status === 413) return 'That file is too large.';
  if (status === 415) return 'That file type is not accepted.';
  if (status === 429) return 'Too many requests. Wait a minute and try again.';
  return 'Something went wrong while sending. Please try again.';
}

$('#ct-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  say('');
  // Honeypot: pretend it worked so bots learn nothing.
  if (val('ct-website')) return say('Thank you. It will appear once it has been checked.', 'ok');

  const result = validateSubmission(read(), known);
  if (!result.ok) {
    showErrors(result.errors);
    return say('Please fix the highlighted parts and try again.', 'error');
  }
  showErrors({});

  const history = loadJSON<number[]>(HISTORY_KEY, [], isNums);
  const gate = canSubmit(history, Date.now());
  if (!gate.ok) {
    return say(
      gate.reason === 'minute' ? `Please wait ${gate.waitSeconds} seconds before sending another.` : 'You have sent a few today already. Please come back tomorrow.',
      'error',
    );
  }

  send.disabled = true;
  say(mode() === 'file' ? 'Uploading…' : 'Sending…');
  try {
    let path: string | null = null;
    if (mode() === 'file') {
      const file = fileInput.files![0];
      path = filePath(crypto.randomUUID(), result.ext!);
      const up = await api(`/storage/v1/object/${FILE_BUCKET}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      }, 90000);
      if (!up.ok) return say(fail(up.status), 'error');
    }
    const body = { ...result.row, link_url: result.row.link_url, file_path: path };
    const res = await api('/rest/v1/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return say(fail(res.status), 'error');

    saveJSON(HISTORY_KEY, [...history.filter((t) => Date.now() - t < 24 * 3600 * 1000), Date.now()]);
    ($('#ct-form') as HTMLFormElement).reset();
    linkWrap.hidden = false;
    fileWrap.hidden = true;
    say('Thank you. It will appear in the library once it has been checked.', 'ok');
  } catch {
    say('Could not reach the library. Check your data connection and try again.', 'error');
  } finally {
    send.disabled = false;
  }
});
