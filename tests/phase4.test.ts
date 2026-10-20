import { describe, expect, it } from 'vitest';
import { addCards, dayNumber, dueCards, INTERVALS, isDecks, newCard, parseCards, requeue, review, stats, type Deck } from '../src/lib/flashcards';
import { dateOf, dayOf, daysUntil, makePlan, planAsText, share } from '../src/lib/study';
import { pageAssets, scriptImports, sizeLabel } from '../src/lib/offline';

describe('parseCards', () => {
  it('reads :: and tab separated lines', () => {
    const r = parseCards('Osmosis :: movement of water\nMitosis\tcell division\n\n');
    expect(r.problems).toEqual([]);
    expect(r.cards).toEqual([
      { front: 'Osmosis', back: 'movement of water' },
      { front: 'Mitosis', back: 'cell division' },
    ]);
  });
  it('keeps colons and dashes inside the text', () => {
    const r = parseCards('Ratio: a-b :: 3:1 - maybe');
    expect(r.cards[0]).toEqual({ front: 'Ratio: a-b', back: '3:1 - maybe' });
  });
  it('reports bad lines with their number and skips duplicates', () => {
    const r = parseCards('no separator\nA ::\nB :: ok\nb :: again');
    expect(r.cards).toEqual([{ front: 'B', back: 'ok' }]);
    expect(r.problems).toHaveLength(3);
    expect(r.problems[0]).toMatch(/Line 1/);
    expect(r.problems[1]).toMatch(/Line 2/);
    expect(r.problems[2]).toMatch(/Line 4/);
  });
  it('rejects very long sides', () => {
    expect(parseCards(`a :: ${'x'.repeat(401)}`).cards).toEqual([]);
  });
});

describe('leitner schedule', () => {
  const today = 20_000;
  const c = newCard('1', 'q', 'a', today);
  it('moves up and waits longer when known', () => {
    const a = review(c, true, today);
    expect(a.box).toBe(2);
    expect(a.due).toBe(today + INTERVALS[2]);
    let x = a;
    for (let i = 0; i < 10; i++) x = review(x, true, today);
    expect(x.box).toBe(5);
    expect(x.due).toBe(today + 30);
  });
  it('goes back to box 1 and stays due when missed', () => {
    const up = review(review(c, true, today), true, today);
    const down = review(up, false, today + 3);
    expect(down.box).toBe(1);
    expect(down.due).toBe(today + 3);
  });
  it('lists due cards, lowest box first, and counts them', () => {
    const deck: Deck = {
      id: 'd',
      name: 'x',
      cards: [
        { id: 'a', front: 'a', back: 'a', box: 3, due: today },
        { id: 'b', front: 'b', back: 'b', box: 1, due: today },
        { id: 'c', front: 'c', back: 'c', box: 5, due: today + 9 },
        { id: 'd', front: 'd', back: 'd', box: 2, due: today + 4 },
      ],
    };
    expect(dueCards(deck, today).map((x) => x.id)).toEqual(['b', 'a']);
    const s = stats(deck, today);
    expect(s).toMatchObject({ total: 4, due: 2, learned: 1, nextDue: today + 4 });
    expect(s.boxes).toEqual([1, 1, 1, 0, 1]);
  });
  it('adds only new fronts', () => {
    const deck: Deck = { id: 'd', name: 'x', cards: [newCard('0', 'Osmosis', 'x', 1)] };
    let n = 0;
    const r = addCards(deck, [{ front: 'osmosis', back: 'y' }, { front: 'New', back: 'z' }], 1, () => `id${++n}`);
    expect(r).toEqual({ added: 1, skipped: 1 });
    expect(deck.cards).toHaveLength(2);
  });
  it('requeues a missed card a few places later, at most twice', () => {
    expect(requeue(['a', 'b', 'c', 'd', 'e'], 'a', 0)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(requeue(['a'], 'a', 1)).toEqual(['a']);
    expect(requeue(['a', 'b'], 'a', 3)).toEqual(['a', 'b']);
  });
  it('turns the local date into a day number', () => {
    expect(dayNumber(new Date(2026, 9, 20, 23, 59))).toBe(dayNumber(new Date(2026, 9, 20, 0, 1)));
    expect(dayNumber(new Date(2026, 9, 21))).toBe(dayNumber(new Date(2026, 9, 20)) + 1);
  });
  it('validates stored decks', () => {
    expect(isDecks([{ id: 'd', name: 'n', cards: [{ id: '1', front: 'a', back: 'b', box: 2, due: 5 }] }])).toBe(true);
    expect(isDecks([{ id: 'd', name: 'n', cards: [{ id: '1', front: 'a', back: 'b', box: 9, due: 5 }] }])).toBe(false);
    expect(isDecks('nope')).toBe(false);
  });
});

describe('study timetable', () => {
  const opts = { today: '2026-10-20', hoursPerDay: 4, restWeekday: -1 };
  it('reads and writes dates safely', () => {
    expect(dayOf('2026-02-30')).toBeNull();
    expect(dayOf('20-10-2026')).toBeNull();
    expect(dateOf(dayOf('2026-10-20')!)).toBe('2026-10-20');
    expect(daysUntil('2026-10-25', '2026-10-20')).toBe(5);
  });
  it('shares half hours without losing any', () => {
    expect(share(8, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(8);
    expect(share(0, [1, 2])).toEqual([0, 0]);
    expect(share(5, [])).toEqual([]);
  });
  it('fills each day with the chosen hours until the last exam', () => {
    const plan = makePlan(
      [
        { subject: 'Anatomy', date: '2026-10-27', difficulty: 3 },
        { subject: 'Biochem', date: '2026-10-30', difficulty: 2 },
      ],
      opts,
    );
    expect(plan.days[0].date).toBe('2026-10-20');
    expect(plan.days[plan.days.length - 1].date).toBe('2026-10-30');
    for (const d of plan.days.slice(0, -1)) expect(d.slots.reduce((a, s) => a + s.hours, 0)).toBe(4);
    const lastDay = plan.days[plan.days.length - 1];
    expect(lastDay.exams).toEqual(['Biochem']);
    expect(lastDay.slots).toEqual([]);
  });
  it('stops studying a subject once its exam has passed', () => {
    const plan = makePlan(
      [
        { subject: 'A', date: '2026-10-22', difficulty: 2 },
        { subject: 'B', date: '2026-10-28', difficulty: 2 },
      ],
      opts,
    );
    const after = plan.days.filter((d) => d.date > '2026-10-22');
    for (const d of after) expect(d.slots.every((s) => s.subject === 'B')).toBe(true);
    const exam = plan.days.find((d) => d.date === '2026-10-22')!;
    expect(exam.slots.every((s) => s.subject === 'B')).toBe(true);
  });
  it('gives the harder subject and the sooner exam more time', () => {
    const hard = makePlan([{ subject: 'H', date: '2026-10-30', difficulty: 3 }, { subject: 'E', date: '2026-10-30', difficulty: 1 }], opts);
    const h = hard.totals.find((t) => t.subject === 'H')!.hours;
    const e = hard.totals.find((t) => t.subject === 'E')!.hours;
    expect(h).toBeGreaterThan(e);
    const soon = makePlan([{ subject: 'S', date: '2026-10-23', difficulty: 2 }, { subject: 'L', date: '2026-11-10', difficulty: 2 }], opts);
    expect(soon.days[0].slots[0].subject).toBe('S');
  });
  it('keeps the rest day free unless an exam is on or just after it', () => {
    // 2026-10-25 is a Sunday
    const plan = makePlan([{ subject: 'A', date: '2026-10-30', difficulty: 2 }], { ...opts, restWeekday: 0 });
    const sun = plan.days.find((d) => d.date === '2026-10-25')!;
    expect(sun.rest).toBe(true);
    expect(sun.slots).toEqual([]);
    const busy = makePlan([{ subject: 'A', date: '2026-10-26', difficulty: 2 }], { ...opts, restWeekday: 0 });
    expect(busy.days.find((d) => d.date === '2026-10-25')!.rest).toBe(false);
  });
  it('leaves out past exams with a warning and handles empty input', () => {
    const p = makePlan([{ subject: 'Old', date: '2026-10-01', difficulty: 2 }], opts);
    expect(p.days).toEqual([]);
    expect(p.warnings[0]).toMatch(/past/);
    expect(makePlan([], opts).warnings[0]).toMatch(/at least one/);
  });
  it('caps very long plans and writes text', () => {
    const p = makePlan([{ subject: 'A', date: '2030-01-01', difficulty: 1 }], opts);
    expect(p.days.length).toBe(120);
    expect(p.warnings.join(' ')).toMatch(/120/);
    const t = planAsText(makePlan([{ subject: 'A', date: '2026-10-22', difficulty: 1 }], opts));
    expect(t.split('\n')[0]).toMatch(/^Tue 2026-10-20 A 4h$/);
    expect(t).toMatch(/EXAM: A/);
  });
});

describe('offline helpers', () => {
  const html = `<link rel="stylesheet" href="/_astro/a.css"><link rel="icon" href="/icons/icon.svg">
    <link rel="canonical" href="https://freestudentkits.netlify.app/tools/cbt/"><link rel="manifest" href="/manifest.webmanifest">
    <script type="module" src="/_astro/x.js"></script><script src="https://evil.example/x.js"></script><script>inline()</script>
    <link rel="modulepreload" href="/_astro/y.js">`;
  it('finds same-site files a page needs', () => {
    const a = pageAssets(html, 'https://freestudentkits.netlify.app/tools/cbt/');
    expect(a.sort()).toEqual(['/_astro/a.css', '/_astro/x.js', '/_astro/y.js', '/icons/icon.svg', '/manifest.webmanifest']);
  });
  it('finds scripts that a script loads', () => {
    const js = `import{a}from"./chunk.AbC.js";const l=()=>import("/_astro/pdf-lib.min.js");x("./not-js.css");y("https://cdn.example/z.js")`;
    expect(scriptImports(js, 'https://freestudentkits.netlify.app/_astro/pdf.js').sort()).toEqual(['/_astro/chunk.AbC.js', '/_astro/pdf-lib.min.js']);
  });
  it('labels sizes', () => {
    expect(sizeLabel(100)).toBe('1 KB');
    expect(sizeLabel(2048)).toBe('2 KB');
    expect(sizeLabel(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});

import { validateFeedback } from '../src/lib/feedback';
describe('feedback form', () => {
  const ok = { kind: 'bug', message: 'The CGPA page shows the wrong class', contact: '', page: '/tools/cgpa/' };
  it('accepts a good message and keeps only a plain page path', () => {
    const r = validateFeedback(ok);
    expect(r.ok && r.row).toEqual({ kind: 'bug', message: 'The CGPA page shows the wrong class', contact: null, page: '/tools/cgpa/' });
    const r2 = validateFeedback({ ...ok, page: 'https://evil.example/?x=1' });
    expect(r2.ok && r2.row.page).toBeNull();
  });
  it('checks kind and message length', () => {
    const r = validateFeedback({ ...ok, kind: 'spam', message: 'short' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['kind', 'message']);
    expect(validateFeedback({ ...ok, message: 'x'.repeat(1001) }).ok).toBe(false);
  });
  it('needs contact details for a takedown', () => {
    const bad = validateFeedback({ ...ok, kind: 'takedown' });
    expect(bad.ok).toBe(false);
    expect(validateFeedback({ ...ok, kind: 'takedown', contact: 'me@example.com' }).ok).toBe(true);
  });
});
