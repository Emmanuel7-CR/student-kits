export type Verification = 'verified' | 'reported' | 'conflicting';
export type State = 'open' | 'soon' | 'closed' | 'unknown';

export interface Source {
  label: string;
  url: string;
}

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  kind: 'scholarship' | 'loan';
  level: string;
  deadline: string | null;
  deadlineNote: string;
  verification: Verification;
  official: Source | null;
  who: string;
  award: string;
  howToApply: string;
  sources: Source[];
}

export const SOON_DAYS = 30;

/** Today's date in Nigeria as YYYY-MM-DD. */
export function todayInLagos(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now);
}

export function daysUntil(deadline: string, today: string): number {
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
}

export function stateFor(deadline: string | null, today: string): { state: State; days: number | null } {
  if (!deadline) return { state: 'unknown', days: null };
  const days = daysUntil(deadline, today);
  if (days < 0) return { state: 'closed', days };
  if (days <= SOON_DAYS) return { state: 'soon', days };
  return { state: 'open', days };
}

export type Group = 'open' | 'check' | 'past';

/** Which list a scholarship belongs in. Contradictory pages are never shown as plainly open. */
export function groupFor(s: Pick<Scholarship, 'deadline' | 'verification'>, today: string): Group {
  const { state } = stateFor(s.deadline, today);
  if (state === 'closed') return 'past';
  if (s.verification === 'conflicting' || state === 'unknown') return 'check';
  return 'open';
}

export function daysLabel(days: number | null): string {
  if (days === null) return 'No deadline given';
  if (days < 0) return days === -1 ? 'Closed yesterday' : `Closed ${-days} days ago`;
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `${days} days left`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
