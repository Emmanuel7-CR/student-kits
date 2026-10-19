/** Parse page selections like "1-3, 5, 8-" into zero-based page indexes. */

export type RangeResult = { ok: true; pages: number[] } | { ok: false; error: string };

export function parsePageRange(input: string, total: number): RangeResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Type the pages you want, for example 1-3, 5.' };
  if (!Number.isInteger(total) || total < 1) return { ok: false, error: 'Choose a PDF first.' };

  const pages: number[] = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `“${part}” is not a page or range.` };
    let from: number;
    let to: number;
    if (!m[2]) {
      from = to = Number(m[1]);
    } else {
      from = m[1] ? Number(m[1]) : 1;
      to = m[3] ? Number(m[3]) : total;
    }
    if (from < 1 || to < 1) return { ok: false, error: 'Pages start at 1.' };
    if (from > total || to > total) return { ok: false, error: `This PDF has ${total} page${total === 1 ? '' : 's'}.` };
    if (from > to) return { ok: false, error: `“${part}” goes backwards. Write it as ${to}-${from} if you meant that.` };
    for (let p = from; p <= to; p++) pages.push(p - 1);
  }
  if (!pages.length) return { ok: false, error: 'Type the pages you want, for example 1-3, 5.' };
  return { ok: true, pages };
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
