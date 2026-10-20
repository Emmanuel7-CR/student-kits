/** Validation for the feedback and takedown form. Mirrors the database checks. */

export const FEEDBACK_KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'wrong_info', label: 'Wrong or old information' },
  { value: 'takedown', label: 'Copyright: please remove something' },
  { value: 'idea', label: 'An idea or request' },
  { value: 'other', label: 'Something else' },
] as const;

export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 1000;
export const MAX_CONTACT = 120;

export interface FeedbackInput {
  kind: string;
  message: string;
  contact: string;
  page: string;
}
export interface FeedbackRow {
  kind: string;
  message: string;
  contact: string | null;
  page: string | null;
}

export function validateFeedback(i: FeedbackInput): { ok: true; row: FeedbackRow } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const message = i.message.replace(/\r/g, '').trim();
  const contact = i.contact.trim();
  if (!FEEDBACK_KINDS.some((k) => k.value === i.kind)) errors.kind = 'Choose what this is about.';
  if (message.length < MIN_MESSAGE) errors.message = `Please write at least ${MIN_MESSAGE} characters.`;
  else if (message.length > MAX_MESSAGE) errors.message = `Please keep it under ${MAX_MESSAGE} characters.`;
  if (contact.length > MAX_CONTACT) errors.contact = `Keep this under ${MAX_CONTACT} characters.`;
  if (i.kind === 'takedown' && !contact) errors.contact = 'Add an email or phone number so we can reply about a takedown.';
  if (Object.keys(errors).length) return { ok: false, errors };
  // Only keep a plain path, never a full address with a query string.
  const page = /^\/[\w\-/.]{0,150}$/.test(i.page) ? i.page : null;
  return { ok: true, row: { kind: i.kind, message, contact: contact || null, page } };
}
