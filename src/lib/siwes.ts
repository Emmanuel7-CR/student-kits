/** Weekly date ranges for a SIWES / industrial training logbook. All dates are plain ISO yyyy-mm-dd, no time zones. */

export interface LogWeek {
  week: number;
  /** ISO date of the first working day of the week. */
  from: string;
  /** ISO date of the last working day of the week. */
  to: string;
  /** One ISO date per working day. */
  days: string[];
}

function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the weeks of a logbook. Week 1 starts on the given date; each week lists `workDays` consecutive
 * working days (Mon to Fri, or Mon to Sat) counted from the Monday of the start week, skipping any day
 * before the start date. Returns null when the date or counts are invalid.
 */
export function logbookWeeks(startISO: string, weeks: number, workDays: 5 | 6 = 5): LogWeek[] | null {
  const start = parseISO(startISO);
  if (!start || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) return null;

  const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(start);
  monday.setUTCDate(monday.getUTCDate() - dow);

  const out: LogWeek[] = [];
  for (let w = 0; out.length < weeks && w < weeks + 2; w++) {
    const days: string[] = [];
    for (let i = 0; i < workDays; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + w * 7 + i);
      if (d >= start) days.push(toISO(d));
    }
    if (days.length) out.push({ week: out.length + 1, from: days[0], to: days[days.length - 1], days });
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso;
}

export function weekdayName(iso: string): string {
  const d = parseISO(iso);
  return d ? WEEKDAYS[d.getUTCDay()] : '';
}
