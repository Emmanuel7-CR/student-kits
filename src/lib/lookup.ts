/** Turn DOI and ISBN lookup responses into citation form fields. Pure, so it is testable without a network. */

import type { CiteInput } from './citation';

export type Filled = Partial<Pick<CiteInput, 'type' | 'authors' | 'year' | 'title' | 'publisher' | 'edition' | 'place' | 'journal' | 'volume' | 'issue' | 'pages' | 'doi' | 'url'>>;

/** Accepts "10.1234/abc", "doi:10.1234/abc" or a doi.org link. Returns null if it does not look like a DOI. */
export function normaliseDoi(input: string): string | null {
  const t = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
  return /^10\.\d{4,9}\/\S+$/i.test(t) ? t : null;
}

/** Strips hyphens and spaces, then checks the ISBN-10 or ISBN-13 check digit. Returns the clean ISBN or null. */
export function cleanIsbn(input: string): string | null {
  const s = input.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
    return sum % 11 === 0 ? s : null;
  }
  if (/^\d{13}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0 ? s : null;
  }
  return null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const first = (v: unknown): string => (Array.isArray(v) ? str(v[0]) : str(v));

/** Strip tags such as <i> that Crossref sometimes leaves in titles, and collapse whitespace. */
function plainText(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function fromCrossref(json: unknown): Filled | null {
  if (!isObj(json) || !isObj(json.message)) return null;
  const m = json.message;
  const title = plainText(first(m.title));
  if (!title) return null;

  const people = Array.isArray(m.author) ? m.author : [];
  const authors = people
    .filter(isObj)
    .map((a) => {
      const family = str(a.family);
      const given = str(a.given);
      if (family && given) return `${family}, ${given}`;
      return family || given || str(a.name);
    })
    .filter(Boolean)
    .join('\n');

  let year = '';
  for (const key of ['issued', 'published-print', 'published-online', 'published']) {
    const part = m[key];
    if (isObj(part) && Array.isArray(part['date-parts']) && Array.isArray(part['date-parts'][0])) {
      const y = part['date-parts'][0][0];
      if (typeof y === 'number') {
        year = String(y);
        break;
      }
    }
  }

  const type = str(m.type);
  const isJournal = type === 'journal-article';
  const isBook = type === 'book' || type === 'monograph' || type === 'edited-book' || type === 'reference-book' || type === 'textbook';

  const out: Filled = {
    type: isJournal ? 'journal' : isBook ? 'book' : 'journal',
    authors,
    year,
    title,
    doi: str(m.DOI),
  };
  if (isBook) out.publisher = str(m.publisher);
  else {
    out.journal = plainText(first(m['container-title']));
    out.volume = str(m.volume);
    out.issue = str(m.issue);
    out.pages = str(m.page).replace(/[–—]/g, '-');
  }
  return out;
}

/** Open Library "jscmd=data" response for one ISBN, keyed like {"ISBN:978...": {...}}. */
export function fromOpenLibrary(json: unknown, isbn: string): Filled | null {
  if (!isObj(json)) return null;
  const rec = json[`ISBN:${isbn}`];
  if (!isObj(rec)) return null;
  const title = [str(rec.title), str(rec.subtitle)].filter(Boolean).join(': ');
  if (!title) return null;

  const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isObj).map((x) => str(x.name)).filter(Boolean) : []);
  const authors = names(rec.authors)
    .map((n) => {
      const parts = n.split(/\s+/);
      return parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}` : n;
    })
    .join('\n');

  const yearMatch = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(str(rec.publish_date));
  return {
    type: 'book',
    authors,
    year: yearMatch ? yearMatch[1] : '',
    title,
    publisher: names(rec.publishers)[0] ?? '',
    place: names(rec.publish_places)[0] ?? '',
  };
}
