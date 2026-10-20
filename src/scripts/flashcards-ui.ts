import {
  addCards,
  dayNumber,
  dueCards,
  isDecks,
  MAX_CARDS,
  MAX_DECK_NAME,
  parseCards,
  requeue,
  review,
  stats,
  type Card,
  type Deck,
} from '../lib/flashcards';
import { $, copyText, el, loadJSON, saveJSON, uid } from './dom';

const KEY = 'fsk:fc:v1';
const SEL = 'fsk:fc:sel';
const SESSION = 20;

const root = $('#fc-root');
let decks = loadJSON<Deck[]>(KEY, [], isDecks);
let selected = readSel();
let note = '';
let saveFailed = false;

function readSel(): string | null {
  try {
    return localStorage.getItem(SEL);
  } catch {
    return null;
  }
}
function persist() {
  saveFailed = !saveJSON(KEY, decks);
  try {
    if (selected) localStorage.setItem(SEL, selected);
  } catch {
    /* ignore */
  }
}
const today = () => dayNumber(new Date());

function ensureDeck(): Deck {
  let d = decks.find((x) => x.id === selected) ?? decks[0];
  if (!d) {
    d = { id: uid(), name: 'My cards', cards: [] };
    decks.push(d);
  }
  selected = d.id;
  return d;
}

function when(day: number | null): string {
  if (day === null) return '';
  const diff = day - today();
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

/* ---------- home ---------- */
function renderHome() {
  const deck = ensureDeck();
  const s = stats(deck, today());

  const deckSelect = el(
    'select',
    { class: 'select', id: 'fc-deck', 'aria-label': 'Choose a deck' },
    ...decks.map((d) => el('option', { value: d.id }, `${d.name} (${d.cards.length})`)),
  ) as HTMLSelectElement;
  deckSelect.value = deck.id;
  deckSelect.addEventListener('change', () => {
    selected = deckSelect.value;
    note = '';
    persist();
    renderHome();
  });

  const newName = el('input', { class: 'input', id: 'fc-newname', type: 'text', maxLength: MAX_DECK_NAME, placeholder: 'New deck, e.g. Anatomy', 'aria-label': 'Name for a new deck' }) as HTMLInputElement;
  const makeDeck = el('button', { type: 'button', class: 'btn' }, 'Create deck');
  makeDeck.addEventListener('click', () => {
    const name = newName.value.trim().slice(0, MAX_DECK_NAME);
    if (!name) {
      note = 'Type a name for the new deck.';
      renderHome();
      return;
    }
    const d: Deck = { id: uid(), name, cards: [] };
    decks.push(d);
    selected = d.id;
    note = '';
    persist();
    renderHome();
  });

  const startBtn = el('button', { type: 'button', class: 'btn btn-primary', id: 'fc-start' }, s.due ? `Study ${Math.min(SESSION, s.due)} card${Math.min(SESSION, s.due) === 1 ? '' : 's'}` : 'Nothing due') as HTMLButtonElement;
  startBtn.disabled = s.due === 0;
  startBtn.addEventListener('click', () => startSession(deck));

  const boxRow = el(
    'div',
    { class: 'mt-3 grid grid-cols-5 gap-2 text-center text-sm', role: 'group', 'aria-label': 'Cards in each box' },
    ...s.boxes.map((n, i) => el('div', { class: 'rounded-lg border border-border p-2' }, el('div', { class: 'text-xs text-muted' }, `Box ${i + 1}`), el('div', { class: 'text-lg font-bold' }, String(n)))),
  );

  const text = el('textarea', {
    id: 'fc-text',
    class: 'textarea',
    rows: 8,
    maxLength: 200000,
    'aria-label': 'Cards to add, one per line',
    placeholder: 'Osmosis :: Movement of water across a membrane\nMitosis :: Cell division that gives two identical cells',
  }) as HTMLTextAreaElement;
  const addBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Add cards');
  addBtn.addEventListener('click', () => {
    const parsed = parseCards(text.value);
    if (!parsed.cards.length) {
      note = parsed.problems.length ? parsed.problems.slice(0, 4).join(' ') : 'Type or paste some cards first.';
      renderHome();
      return;
    }
    const r = addCards(deck, parsed.cards, today(), uid);
    persist();
    const issues = parsed.problems.length + r.skipped;
    note = `Added ${r.added} card${r.added === 1 ? '' : 's'}.` + (issues ? ` ${issues} line${issues === 1 ? ' was' : 's were'} skipped. ${parsed.problems.slice(0, 3).join(' ')}` : '');
    renderHome();
  });

  const list = el('details', { class: 'card mt-4' }, el('summary', { class: 'cursor-pointer font-semibold' }, `All cards in this deck (${deck.cards.length})`));
  const shown = deck.cards.slice(0, 100);
  const ul = el('ul', { class: 'mt-3 grid gap-2' });
  for (const c of shown) {
    const del = el('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Delete card ${c.front}` }, 'Delete');
    del.addEventListener('click', () => {
      deck.cards = deck.cards.filter((x) => x.id !== c.id);
      persist();
      renderHome();
    });
    ul.append(el('li', { class: 'flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm' }, el('span', {}, el('strong', {}, c.front), ' — ', c.back), del));
  }
  if (deck.cards.length > shown.length) ul.append(el('li', { class: 'text-sm text-muted' }, `Showing the first ${shown.length}.`));
  if (!deck.cards.length) ul.append(el('li', { class: 'text-sm text-muted' }, 'No cards yet.'));
  list.append(ul);

  const copyBtn = el('button', { type: 'button', class: 'btn' }, 'Copy deck as text') as HTMLButtonElement;
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(deck.cards.map((c) => `${c.front} :: ${c.back}`).join('\n'));
    copyBtn.textContent = ok ? 'Copied' : 'Could not copy';
  });
  const resetBtn = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Restart schedule');
  resetBtn.addEventListener('click', () => {
    if (!confirm('Put every card back in Box 1, due today?')) return;
    for (const c of deck.cards) {
      c.box = 1;
      c.due = today();
    }
    persist();
    note = 'Schedule restarted.';
    renderHome();
  });
  const deleteBtn = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Delete this deck');
  deleteBtn.addEventListener('click', () => {
    if (!confirm(`Delete "${deck.name}" and its ${deck.cards.length} cards? This cannot be undone.`)) return;
    decks = decks.filter((d) => d.id !== deck.id);
    selected = decks[0]?.id ?? null;
    note = 'Deck deleted.';
    persist();
    renderHome();
  });

  root.replaceChildren(
    ...(note ? [el('p', { class: 'mb-3 rounded-lg p-3 text-sm', role: 'status', 'aria-live': 'polite', style: 'background:var(--tint)' }, note)] : []),
    el(
      'section',
      { class: 'card' },
      el('div', { class: 'grid gap-3 sm:grid-cols-[1fr_auto]' }, el('label', { class: 'field' }, el('span', { class: 'label' }, 'Deck'), deckSelect)),
      el('div', { class: 'mt-3 grid gap-2 sm:grid-cols-[1fr_auto]' }, newName, makeDeck),
      el(
        'p',
        { class: 'mt-4 text-lg' },
        el('strong', {}, `${s.due} due`),
        ` · ${s.total} total · ${s.learned} in the top box`,
        s.due === 0 && s.nextDue !== null ? el('span', { class: 'text-muted' }, ` · next ${when(s.nextDue)}`) : null,
      ),
      boxRow,
      el('div', { class: 'mt-4 flex flex-wrap gap-2' }, startBtn, copyBtn, resetBtn, deleteBtn),
    ),
    el(
      'section',
      { class: 'card mt-4' },
      el('h2', { class: 'text-lg font-bold' }, 'Add cards'),
      el('p', { class: 'mt-1 text-sm text-muted' }, 'One card per line. Put :: between the term and its meaning. Lines pasted from a spreadsheet (two columns) work too. Up to ' + MAX_CARDS + ' cards.'),
      el('div', { class: 'mt-3' }, text),
      el('div', { class: 'mt-3' }, addBtn),
    ),
    ...(saveFailed ? [el('p', { class: 'mt-3 rounded-lg p-3 text-sm', role: 'alert', style: 'background:var(--warn-bg);color:var(--warn-fg)' }, 'Your browser would not save these cards, so they will be lost when you close the page. Private browsing can cause this.')] : []),
    list,
  );
}

/* ---------- study ---------- */
function startSession(deck: Deck) {
  const queue = dueCards(deck, today())
    .slice(0, SESSION)
    .map((c) => c.id);
  const misses = new Map<string, number>();
  let knewFirst = 0;
  const firstTry = new Set<string>();
  const total = queue.length;
  let done = 0;
  let shownBack = false;

  const byId = (id: string): Card => deck.cards.find((c) => c.id === id)!;

  const keys = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (!shownBack) return;
    if (e.key === '1') answer(false);
    if (e.key === '2') answer(true);
  };
  document.addEventListener('keydown', keys);

  function leave() {
    document.removeEventListener('keydown', keys);
    renderHome();
  }

  function answer(knew: boolean) {
    const id = queue[0];
    const card = byId(id);
    const idx = deck.cards.indexOf(card);
    deck.cards[idx] = review(card, knew, today());
    if (!firstTry.has(id)) {
      firstTry.add(id);
      if (knew) knewFirst++;
    }
    if (knew) {
      queue.shift();
      done++;
    } else {
      const n = (misses.get(id) ?? 0) + 1;
      misses.set(id, n);
      if (n > 2) {
        queue.shift();
        done++;
      } else {
        queue.splice(0, queue.length, ...requeue(queue, id, n));
      }
    }
    persist();
    shownBack = false;
    next();
  }

  function next() {
    if (!queue.length) {
      document.removeEventListener('keydown', keys);
      const s = stats(deck, today());
      const back = el('button', { type: 'button', class: 'btn btn-primary' }, 'Back to my deck');
      back.addEventListener('click', renderHome);
      root.replaceChildren(
        el(
          'section',
          { class: 'card', 'aria-live': 'polite' },
          el('h2', { class: 'text-xl font-bold', id: 'fc-done', tabindex: -1 }, 'Session finished'),
          el('p', { class: 'mt-2' }, `You knew ${knewFirst} of ${total} on the first try.`),
          el('p', { class: 'mt-1 text-muted' }, s.due ? `${s.due} more card${s.due === 1 ? ' is' : 's are'} due today.` : s.nextDue !== null ? `Nothing else is due. Next cards come up ${when(s.nextDue)}.` : 'Nothing else is due.'),
          el('div', { class: 'mt-4' }, back),
        ),
      );
      $('#fc-done').focus();
      return;
    }
    const card = byId(queue[0]);
    const show = el('button', { type: 'button', class: 'btn btn-primary', id: 'fc-show' }, 'Show answer');
    const front = el('div', { class: 'fc-face fc-front' }, card.front);
    const area = el('div', { class: 'mt-4 flex flex-wrap gap-2' }, show);
    const answerBox = el('div', { class: 'mt-3', tabindex: -1, 'aria-live': 'polite' });
    show.addEventListener('click', () => {
      shownBack = true;
      answerBox.replaceChildren(el('div', { class: 'fc-face fc-back' }, card.back));
      const miss = el('button', { type: 'button', class: 'btn' }, 'Not yet (1)');
      const knew = el('button', { type: 'button', class: 'btn btn-primary' }, 'Got it (2)');
      miss.addEventListener('click', () => answer(false));
      knew.addEventListener('click', () => answer(true));
      area.replaceChildren(miss, knew);
      answerBox.focus();
    });
    const quit = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Stop for now');
    quit.addEventListener('click', leave);
    root.replaceChildren(
      el(
        'section',
        { class: 'card' },
        el('div', { class: 'flex items-center justify-between text-sm text-muted' }, el('span', {}, `${done} of ${total} done`), quit),
        el('p', { class: 'sr-only', role: 'status' }, `Card ${done + 1} of ${total}`),
        el('div', { class: 'mt-3' }, front),
        answerBox,
        area,
      ),
    );
    show.focus();
  }
  next();
}

renderHome();
