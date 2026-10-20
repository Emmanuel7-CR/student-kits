/** Revision timetable: spreads study hours over the days before each exam. Pure logic. */

export interface Exam {
  subject: string;
  date: string; // YYYY-MM-DD
  difficulty: 1 | 2 | 3; // 1 easy, 3 hard
}
export interface Options {
  today: string; // YYYY-MM-DD
  hoursPerDay: number; // 0.5 steps
  restWeekday: number; // 0 (Sunday) .. 6, or -1 for none
}
export interface Day {
  date: string;
  weekday: number;
  rest: boolean;
  exams: string[];
  slots: { subject: string; hours: number }[];
}
export interface Plan {
  days: Day[];
  totals: { subject: string; hours: number }[];
  warnings: string[];
}

export const MAX_EXAMS = 20;
export const MAX_DAYS = 120;
export const STEP = 0.5;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayOf(s: string): number | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86_400_000);
}
export function dateOf(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
export const weekdayOf = (day: number) => new Date(day * 86_400_000).getUTCDay();

export function daysUntil(date: string, today: string): number | null {
  const a = dayOf(date);
  const b = dayOf(today);
  return a === null || b === null ? null : a - b;
}

/** Share `total` half-hours between weights, largest remainder first, so nothing is lost to rounding. */
export function share(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

export function makePlan(exams: Exam[], opts: Options): Plan {
  const warnings: string[] = [];
  const start = dayOf(opts.today);
  if (start === null) return { days: [], totals: [], warnings: ['Today\'s date is not valid.'] };
  const hours = Math.min(12, Math.max(STEP, Math.round(opts.hoursPerDay / STEP) * STEP));

  const upcoming = exams
    .map((e) => ({ ...e, day: dayOf(e.date) }))
    .filter((e): e is Exam & { day: number } => {
      if (e.day === null) return false;
      if (e.day < start) {
        warnings.push(`${e.subject} is in the past, so it was left out.`);
        return false;
      }
      return true;
    })
    .slice(0, MAX_EXAMS);
  if (!upcoming.length) return { days: [], totals: [], warnings: warnings.length ? warnings : ['Add at least one exam.'] };

  let last = Math.max(...upcoming.map((e) => e.day));
  if (last - start + 1 > MAX_DAYS) {
    warnings.push(`Only the first ${MAX_DAYS} days are planned.`);
    last = start + MAX_DAYS - 1;
  }

  const totals = new Map<string, number>();
  const days: Day[] = [];
  for (let d = start; d <= last; d++) {
    const wd = weekdayOf(d);
    const examsToday = upcoming.filter((e) => e.day === d).map((e) => e.subject);
    // A rest day is kept free unless an exam falls on it or the day before.
    const nextDayExam = upcoming.some((e) => e.day === d + 1);
    const rest = wd === opts.restWeekday && !examsToday.length && !nextDayExam;
    const day: Day = { date: dateOf(d), weekday: wd, rest, exams: examsToday, slots: [] };
    if (!rest) {
      const open = upcoming.filter((e) => e.day > d);
      if (open.length) {
        // Harder and sooner exams get a bigger share.
        const weights = open.map((e) => e.difficulty / Math.max(1, e.day - d) + e.difficulty * 0.15);
        const halves = share(Math.round(hours / STEP), weights);
        open.forEach((e, i) => {
          if (halves[i] > 0) {
            day.slots.push({ subject: e.subject, hours: halves[i] * STEP });
            totals.set(e.subject, (totals.get(e.subject) ?? 0) + halves[i] * STEP);
          }
        });
        day.slots.sort((a, b) => b.hours - a.hours || a.subject.localeCompare(b.subject));
      }
    }
    days.push(day);
  }
  const subjectTotals = [...totals].map(([subject, h]) => ({ subject, hours: h })).sort((a, b) => b.hours - a.hours);
  return { days, totals: subjectTotals, warnings };
}

export function planAsText(plan: Plan): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hrs = (h: number) => `${h}h`;
  return plan.days
    .map((d) => {
      const head = `${names[d.weekday]} ${d.date}`;
      const exam = d.exams.length ? ` EXAM: ${d.exams.join(', ')}` : '';
      const body = d.rest ? ' Rest day' : d.slots.length ? ` ${d.slots.map((s) => `${s.subject} ${hrs(s.hours)}`).join(', ')}` : '';
      return `${head}${exam}${body}`.trim();
    })
    .join('\n');
}
