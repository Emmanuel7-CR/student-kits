/** Pure helpers for the library: validation that mirrors the database rules, query building and rate limiting. */

export const KINDS = [
  { value: 'past_question', label: 'Past question' },
  { value: 'lecture_notes', label: 'Lecture notes' },
  { value: 'project_material', label: 'Project material' },
  { value: 'other', label: 'Other' },
] as const;
export type Kind = (typeof KINDS)[number]['value'];

export const LEVELS = [100, 200, 300, 400, 500, 600] as const;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? 'Other';

export interface Submission {
  title: string;
  department: string;
  level: string;
  semester: string;
  courseCode: string;
  kind: string;
  session: string;
  description: string;
  contributor: string;
  mode: 'link' | 'file';
  url: string;
  file: { type: string; size: number } | null;
  agreed: boolean;
}

export interface Row {
  title: string;
  department: string;
  level: number;
  semester: number | null;
  course_code: string | null;
  kind: Kind;
  session: string | null;
  description: string | null;
  contributor: string | null;
  link_url: string | null;
}

export type Validation = { ok: true; row: Row; ext: string | null } | { ok: false; errors: Record<string, string> };

const COURSE = /^[A-Za-z]{2,5}[ -]?[0-9]{2,4}[A-Za-z]?$/;
const SESSION = /^[0-9]{4}\/[0-9]{4}$/;

export function validateSubmission(s: Submission, knownDepartments: Set<string>): Validation {
  const errors: Record<string, string> = {};
  const title = s.title.trim();
  if (title.length < 3 || title.length > 140) errors.title = 'Give it a title of 3 to 140 characters.';
  if (!knownDepartments.has(s.department)) errors.department = 'Choose a department.';
  const level = Number(s.level);
  if (!(LEVELS as readonly number[]).includes(level)) errors.level = 'Choose a level.';
  if (s.semester && s.semester !== '1' && s.semester !== '2') errors.semester = 'Choose 1st or 2nd semester, or leave it empty.';
  const code = s.courseCode.trim();
  if (code && !COURSE.test(code)) errors.courseCode = 'Write the course code like CSC 201 or NSC201.';
  if (!KINDS.some((k) => k.value === s.kind)) errors.kind = 'Choose what this is.';
  const session = s.session.trim();
  if (session && !SESSION.test(session)) errors.session = 'Write the session like 2023/2024.';
  if (session) {
    const [a, b] = session.split('/').map(Number);
    if (b !== a + 1) errors.session = 'A session runs over two years in a row, like 2023/2024.';
  }
  if (s.description.trim().length > 500) errors.description = 'Keep the description under 500 characters.';
  if (s.contributor.trim().length > 40) errors.contributor = 'Keep the name under 40 characters.';

  let ext: string | null = null;
  let link: string | null = null;
  if (s.mode === 'link') {
    const url = s.url.trim();
    if (!/^https:\/\/[^\s]+$/i.test(url) || url.length < 12 || url.length > 500) errors.url = 'Paste a full link that starts with https://';
    else link = url;
  } else if (!s.file) {
    errors.file = 'Choose a file.';
  } else if (!FILE_TYPES[s.file.type]) {
    errors.file = 'Only PDF, JPG, PNG or WebP files are accepted.';
  } else if (s.file.size > MAX_FILE_BYTES) {
    errors.file = 'That file is over 4 MB. Compress it or share a link instead.';
  } else if (s.file.size === 0) {
    errors.file = 'That file is empty.';
  } else {
    ext = FILE_TYPES[s.file.type];
  }
  if (!s.agreed) errors.agreed = 'Please confirm you have the right to share this.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    ext,
    row: {
      title,
      department: s.department,
      level,
      semester: s.semester ? Number(s.semester) : null,
      course_code: code ? code.toUpperCase() : null,
      kind: s.kind as Kind,
      session: session || null,
      description: s.description.trim() || null,
      contributor: s.contributor.trim() || null,
      link_url: link,
    },
  };
}

/** Random, unguessable storage path: incoming/<uuid>.<ext>. */
export function filePath(uuid: string, ext: string): string {
  return `incoming/${uuid}.${ext}`;
}

export function publicFileUrl(base: string, bucket: string, path: string): string {
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Remove characters that have meaning in a PostgREST filter value. */
export function cleanSearch(text: string): string {
  return text.replace(/[*%,()\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export interface Browse {
  department?: string;
  level?: string;
  kind?: string;
  text?: string;
  offset?: number;
  limit?: number;
}

export const COLUMNS = 'id,title,department,level,semester,course_code,kind,description,session,link_url,file_path,contributor,created_at';

export function browseQuery(b: Browse): string {
  const p = new URLSearchParams();
  p.set('select', COLUMNS);
  p.set('status', 'eq.approved');
  if (b.department && /^[a-z0-9-]{2,60}$/.test(b.department)) p.set('department', `eq.${b.department}`);
  if (b.level && /^[1-6]00$/.test(b.level)) p.set('level', `eq.${b.level}`);
  if (b.kind && KINDS.some((k) => k.value === b.kind)) p.set('kind', `eq.${b.kind}`);
  const text = cleanSearch(b.text ?? '');
  if (text) p.set('or', `(title.ilike.*${text}*,course_code.ilike.*${text}*)`);
  p.set('order', 'created_at.desc');
  p.set('limit', String(Math.min(Math.max(b.limit ?? 20, 1), 50)));
  p.set('offset', String(Math.max(b.offset ?? 0, 0)));
  return p.toString();
}

/** Courtesy limits on this device: one submission a minute, five a day. The database has its own caps too. */
export function canSubmit(history: number[], now: number): { ok: true } | { ok: false; waitSeconds: number; reason: 'minute' | 'day' } {
  const recent = history.filter((t) => now - t < 24 * 3600 * 1000);
  const last = Math.max(0, ...recent);
  if (last && now - last < 60_000) return { ok: false, waitSeconds: Math.ceil((60_000 - (now - last)) / 1000), reason: 'minute' };
  if (recent.length >= 5) {
    const oldest = Math.min(...recent);
    return { ok: false, waitSeconds: Math.ceil((24 * 3600 * 1000 - (now - oldest)) / 1000), reason: 'day' };
  }
  return { ok: true };
}
