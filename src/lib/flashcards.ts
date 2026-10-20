/** Flashcards with a simple Leitner schedule. Pure logic: the page handles storage and display. */

export interface Card {
  id: string;
  front: string;
  back: string;
  box: number; // 1..5
  due: number; // day number (see dayNumber)
}
export interface Deck {
  id: string;
  name: string;
  cards: Card[];
}

export const MAX_CARDS = 1500;
export const MAX_SIDE = 400;
export const MAX_DECK_NAME = 60;
/** Days to wait after a correct answer, by the box the card moves into. Index 0 is unused. */
export const INTERVALS = [0, 0, 3, 7, 14, 30];
export const TOP_BOX = 5;

/** Whole days since 1970 in the user's own calendar, so "today" changes at local midnight. */
export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export interface ParsedCards {
  cards: { front: string; back: string }[];
  problems: string[];
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * One card per line: "term :: meaning", or "term<TAB>meaning" (pasted from a spreadsheet).
 * A line without a separator is reported, not guessed at.
 */
export function parseCards(text: string): ParsedCards {
  const cards: { front: string; back: string }[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/\r/g, '').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let at = line.indexOf('::');
    let width = 2;
    if (at < 0) {
      at = line.indexOf('\t');
      width = 1;
    }
    if (at < 0) {
      problems.push(`Line ${i + 1}: put :: between the two sides.`);
      return;
    }
    const front = tidy(line.slice(0, at));
    const back = tidy(line.slice(at + width));
    if (!front || !back) {
      problems.push(`Line ${i + 1}: one side is empty.`);
      return;
    }
    if (front.length > MAX_SIDE || back.length > MAX_SIDE) {
      problems.push(`Line ${i + 1}: a side is longer than ${MAX_SIDE} characters.`);
      return;
    }
    const key = front.toLowerCase();
    if (seen.has(key)) {
      problems.push(`Line ${i + 1}: "${front.slice(0, 30)}" is already above, skipped.`);
      return;
    }
    seen.add(key);
    cards.push({ front, back });
  });
  return { cards, problems };
}

export function newCard(id: string, front: string, back: string, today: number): Card {
  return { id, front, back, box: 1, due: today };
}

/** Add cards to a deck, skipping fronts the deck already has. Returns how many were added and skipped. */
export function addCards(deck: Deck, incoming: { front: string; back: string }[], today: number, makeId: () => string) {
  const have = new Set(deck.cards.map((c) => c.front.toLowerCase()));
  let added = 0;
  let skipped = 0;
  for (const c of incoming) {
    if (have.has(c.front.toLowerCase()) || deck.cards.length >= MAX_CARDS) {
      skipped++;
      continue;
    }
    have.add(c.front.toLowerCase());
    deck.cards.push(newCard(makeId(), c.front, c.back, today));
    added++;
  }
  return { added, skipped };
}

/** Knew it: move up a box and wait longer. Missed it: back to box 1, due again today. */
export function review(card: Card, knew: boolean, today: number): Card {
  if (!knew) return { ...card, box: 1, due: today };
  const box = Math.min(TOP_BOX, card.box + 1);
  return { ...card, box, due: today + INTERVALS[box] };
}

export function dueCards(deck: Deck, today: number): Card[] {
  return deck.cards.filter((c) => c.due <= today).sort((a, b) => a.box - b.box || a.due - b.due);
}

export interface DeckStats {
  total: number;
  due: number;
  learned: number; // top box
  boxes: number[]; // counts for boxes 1..5
  nextDue: number | null; // earliest future due day
}
export function stats(deck: Deck, today: number): DeckStats {
  const boxes = [0, 0, 0, 0, 0];
  let due = 0;
  let next: number | null = null;
  for (const c of deck.cards) {
    boxes[Math.min(TOP_BOX, Math.max(1, c.box)) - 1]++;
    if (c.due <= today) due++;
    else if (next === null || c.due < next) next = c.due;
  }
  return { total: deck.cards.length, due, learned: boxes[TOP_BOX - 1], boxes, nextDue: next };
}

/** The order cards come up in a session. A missed card returns once more near the end. */
export function requeue(queue: string[], id: string, missCount: number): string[] {
  if (missCount > 2) return queue;
  const rest = queue.filter((x) => x !== id);
  const spot = Math.min(rest.length, 3);
  return [...rest.slice(0, spot), id, ...rest.slice(spot)];
}

export const isDeck = (d: unknown): d is Deck =>
  !!d &&
  typeof (d as Deck).id === 'string' &&
  typeof (d as Deck).name === 'string' &&
  Array.isArray((d as Deck).cards) &&
  (d as Deck).cards.every(
    (c) =>
      c &&
      typeof c.id === 'string' &&
      typeof c.front === 'string' &&
      typeof c.back === 'string' &&
      Number.isInteger(c.box) &&
      c.box >= 1 &&
      c.box <= TOP_BOX &&
      Number.isFinite(c.due),
  );
export const isDecks = (v: unknown): v is Deck[] => Array.isArray(v) && v.every(isDeck);
