/**
 * APA 7, MLA 9 and Harvard (Cite Them Right style) references for books, journal articles and websites.
 * Output is a list of text segments so the UI can italicise titles without using innerHTML.
 */

export type Style = 'apa' | 'mla' | 'harvard';
export type SourceType = 'book' | 'journal' | 'website';

export interface CiteInput {
  style: Style;
  type: SourceType;
  /** One author per line, "Last, First Middle" or "First Last". */
  authors: string;
  year: string;
  title: string;
  /** Book publisher, or website name. */
  publisher: string;
  edition: string;
  /** Harvard book place of publication. */
  place: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  /** ISO date YYYY-MM-DD the website was visited. */
  accessed: string;
}

export interface Segment {
  text: string;
  italic?: boolean;
}

export interface CiteResult {
  ok: boolean;
  missing: string[];
  segments: Segment[];
  plain: string;
}

interface Name {
  last: string;
  given: string[];
}

export function parseName(raw: string): Name | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.includes(',')) {
    const [last, rest = ''] = s.split(',', 2);
    return { last: last.trim(), given: rest.trim().split(/[\s.]+/).filter(Boolean) };
  }
  const parts = s.split(' ');
  if (parts.length === 1) return { last: parts[0], given: [] };
  return { last: parts[parts.length - 1], given: parts.slice(0, -1).flatMap((p) => p.split('.').filter(Boolean)) };
}

function initials(given: string[]): string[] {
  return given.map((g) =>
    g
      .split('-')
      .map((p) => p.charAt(0).toUpperCase())
      .join('-'),
  );
}

function names(authors: string): Name[] {
  return authors
    .split('\n')
    .map(parseName)
    .filter((n): n is Name => n !== null);
}

const apaName = (n: Name) => (n.given.length ? `${n.last}, ${initials(n.given).map((i) => `${i}.`).join(' ')}` : n.last);
const harvardName = (n: Name) => (n.given.length ? `${n.last}, ${initials(n.given).map((i) => `${i}.`).join('')}` : n.last);
const fullGiven = (n: Name) => n.given.join(' ');
const mlaFirst = (n: Name) => (n.given.length ? `${n.last}, ${fullGiven(n)}` : n.last);
const mlaNext = (n: Name) => (n.given.length ? `${fullGiven(n)} ${n.last}` : n.last);

function apaAuthors(list: Name[]): string {
  const f = list.map(apaName);
  if (f.length === 1) return f[0];
  if (f.length === 2) return `${f[0]}, & ${f[1]}`;
  if (f.length <= 20) return `${f.slice(0, -1).join(', ')}, & ${f[f.length - 1]}`;
  return `${f.slice(0, 19).join(', ')}, . . . ${f[f.length - 1]}`;
}

function mlaAuthors(list: Name[]): string {
  if (list.length === 1) return mlaFirst(list[0]);
  if (list.length === 2) return `${mlaFirst(list[0])}, and ${mlaNext(list[1])}`;
  return `${mlaFirst(list[0])}, et al.`;
}

function harvardAuthors(list: Name[]): string {
  const f = list.map(harvardName);
  if (f.length === 1) return f[0];
  if (f.length <= 3) return `${f.slice(0, -1).join(', ')} and ${f[f.length - 1]}`;
  return `${f[0]} et al.`;
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
const dash = (pages: string) => clean(pages).replace(/\s*[-‐-‒]\s*/g, '–');

/** End a piece of text with a full stop unless it already ends in . ? or ! */
function stop(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

function link(i: CiteInput): string {
  const doi = clean(i.doi).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '');
  if (doi) return `https://doi.org/${doi}`;
  return clean(i.url);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function accessed(iso: string, mla: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return '';
  return `${Number(m[3])} ${(mla ? MLA_MONTHS : MONTHS)[month]} ${m[1]}`;
}

function missingFields(i: CiteInput): string[] {
  const miss: string[] = [];
  const hasAuthors = names(i.authors).length > 0;
  if (i.type !== 'website' && !hasAuthors) miss.push('at least one author');
  if (!clean(i.title)) miss.push('title');
  if (i.type === 'book' && !clean(i.publisher)) miss.push('publisher');
  if (i.type === 'journal' && !clean(i.journal)) miss.push('journal name');
  if (i.type === 'website') {
    if (!clean(i.publisher)) miss.push('website name');
    if (!clean(i.url)) miss.push('web address (URL)');
  }
  return miss;
}

const t = (text: string): Segment => ({ text });
const it = (text: string): Segment => ({ text, italic: true });

function build(i: CiteInput): Segment[] {
  const list = names(i.authors);
  const year = clean(i.year) || 'n.d.';
  const title = clean(i.title);
  const pub = clean(i.publisher);
  const edition = clean(i.edition);
  const journal = clean(i.journal);
  const vol = clean(i.volume);
  const issue = clean(i.issue);
  const pages = dash(i.pages);
  const l = link(i);

  if (i.style === 'apa') {
    const who = list.length ? apaAuthors(list) : '';
    if (i.type === 'book') {
      return [
        t(`${who} (${year}). `),
        it(stop(title).replace(/\.$/, '')),
        t(`${edition ? ` (${edition} ed.)` : ''}. ${stop(pub)}${l ? ` ${l}` : ''}`),
      ];
    }
    if (i.type === 'journal') {
      const volIssue = vol ? [it(vol), t(issue ? `(${issue})` : '')] : [];
      return [
        t(`${who} (${year}). ${stop(title)} `),
        it(journal),
        ...(vol ? [t(', '), ...volIssue] : []),
        t(`${pages ? `, ${pages}` : ''}.${l ? ` ${l}` : ''}`),
      ];
    }
    // website
    if (who) return [t(`${who} (${year}). `), it(stop(title).replace(/\.$/, '')), t(`. ${stop(pub)} ${l}`)];
    return [it(stop(title).replace(/\.$/, '')), t(`. (${year}). ${stop(pub)} ${l}`)];
  }

  if (i.style === 'mla') {
    const who = list.length ? stop(mlaAuthors(list)) : '';
    const lead = who ? `${who} ` : '';
    if (i.type === 'book') {
      return [t(lead), it(stop(title).replace(/\.$/, '')), t(`. ${edition ? `${edition} ed., ` : ''}${pub}, ${i.year.trim() ? year : 'n.d.'}.`)];
    }
    if (i.type === 'journal') {
      const bits = [vol && `vol. ${vol}`, issue && `no. ${issue}`, i.year.trim() && year, pages && `pp. ${pages}`, l].filter(Boolean);
      return [t(`${lead}“${stop(title)}” `), it(journal), t(`${bits.length ? `, ${bits.join(', ')}` : ''}.`)];
    }
    const acc = accessed(i.accessed, true);
    const bits = [i.year.trim() && year, l].filter(Boolean);
    return [t(`${lead}“${stop(title)}” `), it(pub), t(`, ${bits.join(', ')}.${acc ? ` Accessed ${acc}.` : ''}`)];
  }

  // Harvard
  const who = list.length ? harvardAuthors(list) : i.type === 'website' ? pub : '';
  if (i.type === 'book') {
    const place = clean(i.place);
    return [
      t(`${who} (${year}) `),
      it(stop(title).replace(/\.$/, '')),
      t(`. ${edition ? `${edition} edn. ` : ''}${place ? `${place}: ` : ''}${stop(pub)}`),
    ];
  }
  if (i.type === 'journal') {
    const volIssue = vol ? `, ${vol}${issue ? `(${issue})` : ''}` : '';
    return [
      t(`${who} (${year}) ‘${title}’, `),
      it(journal),
      t(`${volIssue}${pages ? `, pp. ${pages}` : ''}.${l ? ` ${l}` : ''}`),
    ];
  }
  const acc = accessed(i.accessed, false);
  return [
    t(`${who} (${year}) `),
    it(stop(title).replace(/\.$/, '')),
    t(`. Available at: ${l}${acc ? ` (Accessed: ${acc})` : ''}.`),
  ];
}

export function cite(input: CiteInput): CiteResult {
  const missing = missingFields(input);
  if (missing.length) return { ok: false, missing, segments: [], plain: '' };
  const segments = build(input).filter((s) => s.text !== '');
  // tidy doubled spaces and a stray space before punctuation produced by empty parts
  const tidy = segments.map((s, idx) => {
    const text = s.text.replace(/ {2,}/g, ' ').replace(/ ([.,])/g, '$1');
    return { ...s, text: idx === 0 ? text.replace(/^\s+/, '') : text };
  });
  return { ok: true, missing: [], segments: tidy, plain: tidy.map((s) => s.text).join('').trim() };
}
