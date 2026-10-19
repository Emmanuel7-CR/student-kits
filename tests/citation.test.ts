import { describe, expect, it } from 'vitest';
import { cite, parseName, type CiteInput } from '../src/lib/citation';

const base: CiteInput = {
  style: 'apa',
  type: 'book',
  authors: 'Okafor, Chinedu Nnamdi',
  year: '2020',
  title: 'Principles of Accounting',
  publisher: 'University Press',
  edition: '2nd',
  place: 'Lagos',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  doi: '',
  url: '',
  accessed: '',
};
const journal: CiteInput = {
  ...base,
  type: 'journal',
  authors: 'Bello, Aisha',
  year: '2021',
  title: 'Mobile money and rural trade',
  publisher: '',
  edition: '',
  journal: 'African Journal of Business',
  volume: '12',
  issue: '3',
  pages: '45-60',
  doi: '10.1234/ajb.2021.45',
};
const web: CiteInput = {
  ...base,
  type: 'website',
  authors: '',
  year: '2026',
  title: 'Scholarship notice',
  publisher: 'Federal Ministry of Education',
  edition: '',
  url: 'https://education.gov.ng/notice',
  accessed: '2026-10-18',
};

const plain = (i: CiteInput) => cite(i).plain;

describe('parseName', () => {
  it('reads "Last, First Middle"', () => expect(parseName('Okafor, Chinedu Nnamdi')).toEqual({ last: 'Okafor', given: ['Chinedu', 'Nnamdi'] }));
  it('reads "First Last"', () => expect(parseName('Aisha Bello')).toEqual({ last: 'Bello', given: ['Aisha'] }));
  it('reads initials with dots', () => expect(parseName('Okafor, C.N.')).toEqual({ last: 'Okafor', given: ['C', 'N'] }));
  it('ignores blanks', () => expect(parseName('   ')).toBeNull());
});

describe('APA 7', () => {
  it('book with edition', () =>
    expect(plain(base)).toBe('Okafor, C. N. (2020). Principles of Accounting (2nd ed.). University Press.'));
  it('two authors use a comma and ampersand', () =>
    expect(plain({ ...base, authors: 'Okafor, Chinedu Nnamdi\nBello, Aisha', edition: '' })).toBe(
      'Okafor, C. N., & Bello, A. (2020). Principles of Accounting. University Press.',
    ));
  it('journal article with DOI', () =>
    expect(plain({ ...journal, style: 'apa' })).toBe(
      'Bello, A. (2021). Mobile money and rural trade. African Journal of Business, 12(3), 45–60. https://doi.org/10.1234/ajb.2021.45',
    ));
  it('website without an author puts the title first', () =>
    expect(plain({ ...web, style: 'apa' })).toBe(
      'Scholarship notice. (2026). Federal Ministry of Education. https://education.gov.ng/notice',
    ));
  it('uses n.d. when there is no year', () => expect(plain({ ...base, year: '' })).toContain('(n.d.)'));
});

describe('MLA 9', () => {
  const s = { style: 'mla' as const };
  it('book', () => expect(plain({ ...base, ...s })).toBe('Okafor, Chinedu Nnamdi. Principles of Accounting. 2nd ed., University Press, 2020.'));
  it('three authors collapse to et al.', () =>
    expect(plain({ ...base, ...s, edition: '', authors: 'Okafor, Chinedu\nBello, Aisha\nEze, Ngozi' })).toBe(
      'Okafor, Chinedu, et al. Principles of Accounting. University Press, 2020.',
    ));
  it('two authors', () =>
    expect(plain({ ...base, ...s, edition: '', authors: 'Okafor, Chinedu\nBello, Aisha' })).toBe(
      'Okafor, Chinedu, and Aisha Bello. Principles of Accounting. University Press, 2020.',
    ));
  it('journal article', () =>
    expect(plain({ ...journal, ...s })).toBe(
      'Bello, Aisha. “Mobile money and rural trade.” African Journal of Business, vol. 12, no. 3, 2021, pp. 45–60, https://doi.org/10.1234/ajb.2021.45.',
    ));
  it('website with access date', () =>
    expect(plain({ ...web, ...s })).toBe(
      '“Scholarship notice.” Federal Ministry of Education, 2026, https://education.gov.ng/notice. Accessed 18 Oct. 2026.',
    ));
});

describe('Harvard', () => {
  const s = { style: 'harvard' as const };
  it('book with place and edition', () =>
    expect(plain({ ...base, ...s })).toBe('Okafor, C.N. (2020) Principles of Accounting. 2nd edn. Lagos: University Press.'));
  it('three authors use and', () =>
    expect(plain({ ...base, ...s, edition: '', place: '', authors: 'Okafor, Chinedu\nBello, Aisha\nEze, Ngozi' })).toBe(
      'Okafor, C., Bello, A. and Eze, N. (2020) Principles of Accounting. University Press.',
    ));
  it('four authors collapse to et al.', () =>
    expect(plain({ ...base, ...s, edition: '', place: '', authors: 'A, B\nC, D\nE, F\nG, H' })).toContain('A, B. et al. (2020)'));
  it('journal article', () =>
    expect(plain({ ...journal, ...s })).toBe(
      'Bello, A. (2021) ‘Mobile money and rural trade’, African Journal of Business, 12(3), pp. 45–60. https://doi.org/10.1234/ajb.2021.45',
    ));
  it('website with access date', () =>
    expect(plain({ ...web, ...s })).toBe(
      'Federal Ministry of Education (2026) Scholarship notice. Available at: https://education.gov.ng/notice (Accessed: 18 October 2026).',
    ));
});

describe('validation', () => {
  it('lists missing required fields instead of inventing placeholders', () => {
    const r = cite({ ...base, authors: '', title: '', publisher: '' });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['at least one author', 'title', 'publisher']);
    expect(r.plain).toBe('');
  });
  it('a website needs a name and an address', () => {
    expect(cite({ ...web, publisher: '', url: '' }).missing).toEqual(['website name', 'web address (URL)']);
  });
  it('marks titles and journal names as italic segments', () => {
    const r = cite(base);
    expect(r.segments.some((x) => x.italic && x.text === 'Principles of Accounting')).toBe(true);
  });
});
