import { describe, expect, it } from 'vitest';
import { browseQuery, canSubmit, cleanSearch, filePath, publicFileUrl, validateSubmission, type Submission } from '../src/lib/library';
import { bySlug, departments, grouped } from '../src/data/departments';

const known = new Set(['nursing', 'pharmacy']);
const base: Submission = {
  title: 'Nursing past questions 2023',
  department: 'nursing',
  level: '200',
  semester: '1',
  courseCode: 'nsc 201',
  kind: 'past_question',
  session: '2023/2024',
  description: '',
  contributor: '',
  mode: 'link',
  url: 'https://example.com/file',
  file: null,
  agreed: true,
};
const errs = (s: Partial<Submission>) => {
  const r = validateSubmission({ ...base, ...s }, known);
  return r.ok ? {} : r.errors;
};

describe('validateSubmission', () => {
  it('accepts a good link submission and tidies it', () => {
    const r = validateSubmission(base, known);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.course_code).toBe('NSC 201');
      expect(r.row.level).toBe(200);
      expect(r.row.semester).toBe(1);
      expect(r.row.description).toBeNull();
      expect(r.row.link_url).toBe('https://example.com/file');
      expect(r.ext).toBeNull();
    }
  });
  it('accepts a good file submission', () => {
    const r = validateSubmission({ ...base, mode: 'file', url: '', file: { type: 'application/pdf', size: 1000 } }, known);
    expect(r.ok && r.ext).toBe('pdf');
    if (r.ok) expect(r.row.link_url).toBeNull();
  });
  it('rejects non https links', () => {
    expect(errs({ url: 'http://example.com/file' }).url).toBeDefined();
    expect(errs({ url: 'javascript:alert(1)' }).url).toBeDefined();
    expect(errs({ url: 'https://has space.com/x' }).url).toBeDefined();
  });
  it('rejects wrong or oversized files', () => {
    expect(errs({ mode: 'file', file: { type: 'application/zip', size: 10 } }).file).toMatch(/PDF/);
    expect(errs({ mode: 'file', file: { type: 'application/pdf', size: 5 * 1024 * 1024 } }).file).toMatch(/4 MB/);
    expect(errs({ mode: 'file', file: null }).file).toBeDefined();
  });
  it('checks department, level, kind, course code and session', () => {
    expect(errs({ department: 'unknown' }).department).toBeDefined();
    expect(errs({ level: '150' }).level).toBeDefined();
    expect(errs({ kind: 'weapon' }).kind).toBeDefined();
    expect(errs({ courseCode: '12' }).courseCode).toBeDefined();
    expect(errs({ session: '2023-2024' }).session).toBeDefined();
    expect(errs({ session: '2023/2025' }).session).toMatch(/two years/);
    expect(errs({ courseCode: '', session: '' })).toEqual({});
  });
  it('needs consent and a sensible title', () => {
    expect(errs({ agreed: false }).agreed).toBeDefined();
    expect(errs({ title: 'ab' }).title).toBeDefined();
    expect(errs({ title: 'x'.repeat(141) }).title).toBeDefined();
  });
});

describe('queries and paths', () => {
  it('builds a filtered query', () => {
    const q = new URLSearchParams(browseQuery({ department: 'nursing', level: '200', kind: 'past_question', text: 'anatomy', offset: 20, limit: 20 }));
    expect(q.get('status')).toBe('eq.approved');
    expect(q.get('department')).toBe('eq.nursing');
    expect(q.get('level')).toBe('eq.200');
    expect(q.get('kind')).toBe('eq.past_question');
    expect(q.get('or')).toBe('(title.ilike.*anatomy*,course_code.ilike.*anatomy*)');
    expect(q.get('offset')).toBe('20');
  });
  it('ignores invalid filters and clamps paging', () => {
    const q = new URLSearchParams(browseQuery({ department: 'x;drop', level: '999', kind: 'zzz', limit: 5000, offset: -3 }));
    expect(q.get('department')).toBeNull();
    expect(q.get('level')).toBeNull();
    expect(q.get('kind')).toBeNull();
    expect(q.get('limit')).toBe('50');
    expect(q.get('offset')).toBe('0');
  });
  it('strips filter syntax from search text', () => {
    expect(cleanSearch('a,b)(c*d%e')).toBe('a b c d e');
    expect(new URLSearchParams(browseQuery({ text: '),status.eq.pending,(' })).get('or')).not.toMatch(/pending,\(/);
  });
  it('builds storage paths and urls', () => {
    const p = filePath('0b8f7c1e-3f55-4d5e-9d3a-2f1c6a9b7e10', 'pdf');
    expect(p).toBe('incoming/0b8f7c1e-3f55-4d5e-9d3a-2f1c6a9b7e10.pdf');
    expect(publicFileUrl('https://x.supabase.co', 'library-files', p)).toBe('https://x.supabase.co/storage/v1/object/public/library-files/incoming/0b8f7c1e-3f55-4d5e-9d3a-2f1c6a9b7e10.pdf');
  });
});

describe('canSubmit', () => {
  const now = 1_000_000_000_000;
  it('allows the first submission', () => expect(canSubmit([], now)).toEqual({ ok: true }));
  it('makes you wait a minute', () => {
    const r = canSubmit([now - 20_000], now);
    expect(r).toEqual({ ok: false, waitSeconds: 40, reason: 'minute' });
  });
  it('caps five a day', () => {
    const h = [1, 2, 3, 4, 5].map((i) => now - i * 3600_000);
    const r = canSubmit(h, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('day');
  });
  it('forgets old submissions', () => expect(canSubmit([now - 25 * 3600_000], now)).toEqual({ ok: true }));
});

describe('departments', () => {
  it('slugs are unique and valid for the database', () => {
    const slugs = departments.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]{2,60}$/);
  });
  it('includes the departments students asked for first', () => {
    for (const s of ['medicine-and-surgery', 'nursing', 'pharmacy', 'medical-laboratory-science', 'mass-communication', 'political-science']) {
      expect(bySlug.has(s), s).toBe(true);
    }
  });
  it('covers both arts and science', () => {
    expect(departments.some((d) => d.area === 'science')).toBe(true);
    expect(departments.some((d) => d.area === 'arts')).toBe(true);
    expect(grouped().flatMap((g) => g.items).length).toBe(departments.length);
  });
});

import topics from '../src/data/topics.json';
describe('project topics', () => {
  it('every topic set belongs to a known department and has no duplicates', () => {
    for (const d of topics) {
      expect(bySlug.has(d.id), d.id).toBe(true);
      expect(new Set(d.topics).size, d.id).toBe(d.topics.length);
      expect(d.topics.length, d.id).toBeGreaterThanOrEqual(8);
    }
    expect(new Set(topics.map((d) => d.id)).size).toBe(topics.length);
  });
  it('covers the health departments students asked for', () => {
    const ids = new Set(topics.map((d) => d.id));
    for (const s of ['medicine-and-surgery', 'nursing', 'pharmacy', 'medical-laboratory-science', 'mass-communication', 'political-science']) expect(ids.has(s), s).toBe(true);
  });
});
