import { FILE_BUCKET, SUPABASE_URL } from '../data/config';
import { departmentName } from '../data/departments';
import { browseQuery, kindLabel, publicFileUrl } from '../lib/library';
import { $, el } from './dom';
import { api } from './supabase';

interface Resource {
  id: string;
  title: string;
  department: string;
  level: number;
  semester: number | null;
  course_code: string | null;
  kind: string;
  description: string | null;
  session: string | null;
  link_url: string | null;
  file_path: string | null;
  contributor: string | null;
}

const PAGE = 20;
const dept = $('#lib-dept') as HTMLSelectElement;
const level = $('#lib-level') as HTMLSelectElement;
const kind = $('#lib-kind') as HTMLSelectElement;
const q = $('#lib-q') as HTMLInputElement;
const list = $('#lib-list');
const status = $('#lib-status');
const more = $('#lib-more') as HTMLButtonElement;
const empty = $('#lib-empty');

let offset = 0;
let shown = 0;
let total = 0;
let ticket = 0;

function fromUrl() {
  const p = new URLSearchParams(location.search);
  dept.value = p.get('dept') ?? '';
  level.value = p.get('level') ?? '';
  kind.value = p.get('type') ?? '';
  q.value = p.get('q') ?? '';
}
function toUrl() {
  const p = new URLSearchParams();
  if (dept.value) p.set('dept', dept.value);
  if (level.value) p.set('level', level.value);
  if (kind.value) p.set('type', kind.value);
  if (q.value.trim()) p.set('q', q.value.trim());
  const s = p.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}

function openUrl(r: Resource): string | null {
  if (r.link_url && r.link_url.startsWith('https://')) return r.link_url;
  if (r.file_path) return publicFileUrl(SUPABASE_URL, FILE_BUCKET, r.file_path);
  return null;
}

function reportForm(r: Resource): HTMLElement {
  const reason = el(
    'select',
    { class: 'select', 'aria-label': 'Why are you reporting this?' },
    el('option', { value: 'Copyright or not allowed to share' }, 'Copyright or not allowed to share'),
    el('option', { value: 'Wrong or misleading content' }, 'Wrong or misleading content'),
    el('option', { value: 'Spam or unsafe' }, 'Spam or unsafe'),
    el('option', { value: 'Other' }, 'Other'),
  ) as HTMLSelectElement;
  const note = el('input', { class: 'input', type: 'text', maxLength: 150, placeholder: 'Details (optional)', 'aria-label': 'Details' }) as HTMLInputElement;
  const msg = el('p', { class: 'text-sm', role: 'status', 'aria-live': 'polite' });
  const send = el('button', { type: 'button', class: 'btn' }, 'Send report') as HTMLButtonElement;
  send.addEventListener('click', async () => {
    send.disabled = true;
    msg.textContent = 'Sending…';
    const text = `${reason.value}${note.value.trim() ? `: ${note.value.trim()}` : ''}`.slice(0, 300);
    try {
      const res = await api('/rest/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ resource_id: r.id, reason: text }),
      });
      msg.textContent = res.ok ? 'Thank you. We will look at it.' : 'Could not send the report right now. Please try again later.';
      if (res.ok) send.hidden = true;
      else send.disabled = false;
    } catch {
      msg.textContent = 'Could not reach the library. Check your data and try again.';
      send.disabled = false;
    }
  });
  return el('div', { class: 'mt-3 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]' }, reason, note, send, el('div', { class: 'sm:col-span-3' }, msg));
}

function card(r: Resource): HTMLElement {
  const meta = [departmentName(r.department), `${r.level} level`, r.semester ? `${r.semester === 1 ? '1st' : '2nd'} semester` : '', r.course_code ?? '', r.session ?? '']
    .filter(Boolean)
    .join(' · ');
  const href = openUrl(r);
  const external = !!r.link_url;
  const reportBox = el('div', { hidden: true });
  const reportBtn = el('button', { type: 'button', class: 'btn btn-quiet', 'aria-expanded': 'false' }, 'Report a problem') as HTMLButtonElement;
  reportBtn.addEventListener('click', () => {
    if (!reportBox.firstChild) reportBox.append(reportForm(r));
    const open = reportBox.hidden;
    reportBox.hidden = !open;
    reportBtn.setAttribute('aria-expanded', String(open));
  });
  return el(
    'li',
    { class: 'card' },
    el('div', { class: 'flex flex-wrap items-center gap-2' }, el('span', { class: 'badge badge-muted' }, kindLabel(r.kind)), el('span', { class: 'text-sm text-muted' }, meta)),
    el('h3', { class: 'mt-2 text-lg font-bold' }, r.title),
    r.description ? el('p', { class: 'mt-1 text-muted' }, r.description) : null,
    r.contributor ? el('p', { class: 'mt-1 text-sm text-muted' }, `Shared by ${r.contributor}`) : null,
    el(
      'div',
      { class: 'mt-3 flex flex-wrap items-center gap-2' },
      href ? el('a', { class: 'btn btn-primary', href, target: '_blank', rel: 'noopener noreferrer' }, external ? 'Open link' : 'Open file') : null,
      href && external ? el('span', { class: 'text-xs text-muted' }, 'Opens a site we do not control') : null,
      reportBtn,
    ),
    reportBox,
  );
}

function summary() {
  const filtered = dept.value || level.value || kind.value || q.value.trim();
  status.textContent = total
    ? `Showing ${shown} of ${total} item${total === 1 ? '' : 's'}.`
    : filtered
      ? 'Nothing matches those filters yet. Try fewer filters, or share something for this course.'
      : '';
  more.hidden = shown >= total;
  empty.hidden = !(total === 0 && !filtered);
}

async function load(reset: boolean) {
  const mine = ++ticket;
  if (reset) {
    offset = 0;
    shown = 0;
    list.replaceChildren();
    status.textContent = 'Loading…';
    more.hidden = true;
    empty.hidden = true;
  }
  more.disabled = true;
  try {
    const query = browseQuery({ department: dept.value, level: level.value, kind: kind.value, text: q.value, offset, limit: PAGE });
    const res = await api(`/rest/v1/resources?${query}`, { headers: { Accept: 'application/json', Prefer: 'count=exact' } });
    if (mine !== ticket) return;
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as Resource[];
    const range = res.headers.get('content-range'); // "0-19/57" or "*/0"
    const parsed = range ? Number(range.split('/')[1]) : NaN;
    total = Number.isFinite(parsed) ? parsed : shown + rows.length;
    list.append(...rows.map(card));
    shown += rows.length;
    offset += rows.length;
    summary();
  } catch {
    if (mine !== ticket) return;
    status.textContent = 'Could not load the library right now. Check your data connection and try again.';
    more.hidden = false;
    more.textContent = 'Try again';
    more.disabled = false;
    return;
  }
  more.textContent = 'Show more';
  more.disabled = false;
}

let timer: number | undefined;
function changed() {
  toUrl();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => load(true), 300);
}
for (const f of [dept, level, kind, q]) f.addEventListener('input', changed);
$('#lib-form').addEventListener('submit', (e) => e.preventDefault());
more.addEventListener('click', () => load(shown === 0));

fromUrl();
load(true);
