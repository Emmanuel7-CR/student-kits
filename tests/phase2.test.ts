import { describe, expect, it } from 'vitest';
import { fileSize, parsePageRange } from '../src/lib/pagerange';
import { logbookWeeks, shortDate, weekdayName } from '../src/lib/siwes';
import { cleanIsbn, fromCrossref, fromOpenLibrary, normaliseDoi } from '../src/lib/lookup';
import { cite } from '../src/lib/citation';

describe('parsePageRange', () => {
  const ok = (s: string, n: number) => {
    const r = parsePageRange(s, n);
    return r.ok ? r.pages : r.error;
  };
  it('single pages and ranges become zero-based indexes', () => expect(ok('1-3, 5', 10)).toEqual([0, 1, 2, 4]));
  it('open ended ranges', () => {
    expect(ok('8-', 10)).toEqual([7, 8, 9]);
    expect(ok('-3', 10)).toEqual([0, 1, 2]);
  });
  it('keeps the order and repeats the user typed', () => expect(ok('3,1,3', 5)).toEqual([2, 0, 2]));
  it('rejects pages beyond the document', () => expect(ok('4', 3)).toMatch(/3 pages/));
  it('rejects page 0', () => expect(ok('0', 3)).toMatch(/start at 1/));
  it('rejects backwards ranges', () => expect(ok('5-2', 9)).toMatch(/backwards/));
  it('rejects junk and empty input', () => {
    expect(ok('abc', 5)).toMatch(/not a page/);
    expect(ok('', 5)).toMatch(/Type the pages/);
    expect(ok('1-2', 0)).toMatch(/Choose a PDF/);
  });
  it('formats sizes', () => {
    expect(fileSize(500)).toBe('500 B');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('logbookWeeks', () => {
  it('starts on the start date and counts weekdays only', () => {
    const w = logbookWeeks('2026-10-21', 2)!; // Wednesday
    expect(w).toHaveLength(2);
    expect(w[0].days).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
    expect(w[1].from).toBe('2026-10-26');
    expect(w[1].to).toBe('2026-10-30');
  });
  it('supports six-day weeks', () => expect(logbookWeeks('2026-10-19', 1, 6)![0].days).toHaveLength(6));
  it('a Saturday start rolls into the next real working week', () => {
    const w = logbookWeeks('2026-10-24', 1)!; // Saturday, no weekday left that week
    expect(w[0].from).toBe('2026-10-26');
  });
  it('rejects bad dates and counts', () => {
    expect(logbookWeeks('2026-02-30', 4)).toBeNull();
    expect(logbookWeeks('nonsense', 4)).toBeNull();
    expect(logbookWeeks('2026-10-19', 0)).toBeNull();
    expect(logbookWeeks('2026-10-19', 53)).toBeNull();
  });
  it('labels dates', () => {
    expect(shortDate('2026-10-21')).toBe('21 Oct 2026');
    expect(weekdayName('2026-10-21')).toBe('Wed');
  });
});

describe('DOI and ISBN input', () => {
  it('normalises DOIs', () => {
    expect(normaliseDoi('https://doi.org/10.1000/xyz123')).toBe('10.1000/xyz123');
    expect(normaliseDoi('doi: 10.1000/xyz123')).toBe('10.1000/xyz123');
    expect(normaliseDoi('not a doi')).toBeNull();
  });
  it('validates ISBN check digits', () => {
    expect(cleanIsbn('978-0-306-40615-7')).toBe('9780306406157');
    expect(cleanIsbn('0-306-40615-2')).toBe('0306406152');
    expect(cleanIsbn('080442957X')).toBe('080442957X');
    expect(cleanIsbn('9780306406158')).toBeNull();
    expect(cleanIsbn('12345')).toBeNull();
  });
});

describe('lookup responses', () => {
  const crossref = {
    message: {
      type: 'journal-article',
      title: ['Learning <i>curves</i> in Nigerian schools'],
      author: [
        { given: 'Chinedu', family: 'Okafor' },
        { given: 'Aisha', family: 'Bello' },
      ],
      'container-title': ['Journal of Education'],
      volume: '12',
      issue: '3',
      page: '45–60',
      DOI: '10.1000/xyz123',
      issued: { 'date-parts': [[2021, 5]] },
    },
  };
  it('maps a Crossref journal article', () => {
    expect(fromCrossref(crossref)).toEqual({
      type: 'journal',
      authors: 'Okafor, Chinedu\nBello, Aisha',
      year: '2021',
      title: 'Learning curves in Nigerian schools',
      doi: '10.1000/xyz123',
      journal: 'Journal of Education',
      volume: '12',
      issue: '3',
      pages: '45-60',
    });
  });
  it('the mapped fields produce a complete reference', () => {
    const f = fromCrossref(crossref)!;
    const r = cite({ style: 'apa', type: 'journal', authors: '', year: '', title: '', publisher: '', edition: '', place: '', journal: '', volume: '', issue: '', pages: '', doi: '', url: '', accessed: '', ...f } as never);
    expect(r.ok).toBe(true);
    expect(r.plain).toContain('https://doi.org/10.1000/xyz123');
  });
  it('maps a Crossref book and ignores journal fields', () => {
    const f = fromCrossref({ message: { type: 'book', title: ['A Book'], publisher: 'Pub House', issued: { 'date-parts': [[2019]] }, DOI: '10.1/b' } })!;
    expect(f.type).toBe('book');
    expect(f.publisher).toBe('Pub House');
    expect(f.journal).toBeUndefined();
  });
  it('returns null for unusable Crossref data', () => {
    expect(fromCrossref(null)).toBeNull();
    expect(fromCrossref({ message: {} })).toBeNull();
    expect(fromCrossref('x')).toBeNull();
  });
  it('maps an Open Library record', () => {
    const json = {
      'ISBN:9780306406157': {
        title: 'Intro to Things',
        subtitle: 'A guide',
        authors: [{ name: 'Ngozi Adichie Eze' }],
        publishers: [{ name: 'Campus Press' }],
        publish_places: [{ name: 'Lagos' }],
        publish_date: 'March 3, 2018',
      },
    };
    expect(fromOpenLibrary(json, '9780306406157')).toEqual({
      type: 'book',
      authors: 'Eze, Ngozi Adichie',
      year: '2018',
      title: 'Intro to Things: A guide',
      publisher: 'Campus Press',
      place: 'Lagos',
    });
  });
  it('returns null when Open Library has no record', () => {
    expect(fromOpenLibrary({}, '9780306406157')).toBeNull();
  });
});
