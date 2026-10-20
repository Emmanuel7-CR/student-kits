import { validateFeedback } from '../lib/feedback';
import { canSubmit } from '../lib/library';
import { $, loadJSON, saveJSON } from './dom';
import { api } from './supabase';

const KEY = 'fsk:fb:sent';
const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const val = (id: string) => ($(`#${id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
const msg = $('#fb-msg');
const send = $('#fb-send') as HTMLButtonElement;

function say(text: string, kind: 'info' | 'ok' | 'error') {
  msg.textContent = text;
  msg.hidden = !text;
  msg.style.background = kind === 'ok' ? 'var(--ok-bg)' : kind === 'error' ? 'var(--warn-bg)' : 'var(--tint)';
  msg.style.color = kind === 'ok' ? 'var(--ok-fg)' : kind === 'error' ? 'var(--warn-fg)' : 'inherit';
}

// "Report a problem" links from other pages can say which page they came from: /feedback/?from=/tools/cgpa/
const from = new URLSearchParams(location.search).get('from') ?? '';

$('#fb-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const id of ['fb-kind-err', 'fb-message-err', 'fb-contact-err']) $(`#${id}`).textContent = '';
  const r = validateFeedback({ kind: val('fb-kind'), message: val('fb-message'), contact: val('fb-contact'), page: from });
  if (!r.ok) {
    for (const [k, t] of Object.entries(r.errors)) $(`#fb-${k}-err`).textContent = t;
    say('Please fix the points marked above.', 'error');
    return;
  }
  // A bot fills the hidden field. Pretend it worked.
  if (val('fb-website')) {
    say('Thank you. Your message was sent.', 'ok');
    return;
  }
  const history = loadJSON<number[]>(KEY, [], isNums);
  const gate = canSubmit(history, Date.now());
  if (!gate.ok) {
    say(gate.reason === 'minute' ? `Please wait ${gate.waitSeconds} seconds before sending another message.` : 'You have sent a few messages today. Please try again tomorrow.', 'error');
    return;
  }
  send.disabled = true;
  say('Sending…', 'info');
  try {
    const res = await api('/rest/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(r.row),
    });
    if (res.ok) {
      saveJSON(KEY, [...history, Date.now()].slice(-20));
      ($('#fb-message') as HTMLTextAreaElement).value = '';
      say('Thank you. Your message was sent.', 'ok');
    } else if (res.status === 401 || res.status === 403) {
      say('We are not accepting messages right now. Please try again later.', 'error');
    } else if (res.status === 429) {
      say('Too many requests. Please wait a little and try again.', 'error');
    } else {
      say('Could not send your message. Please try again.', 'error');
    }
  } catch {
    say('Could not reach the server. Check your data and try again. Your message is still in the box.', 'error');
  }
  send.disabled = false;
});
