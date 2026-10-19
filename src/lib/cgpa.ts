/**
 * CGPA maths for 5-point and 4-point grading systems.
 * Pure functions only: no DOM, no storage, so they can be unit tested.
 */

export type ScaleId = '5' | '4';

export interface Grade {
  letter: string;
  points: number;
}

export interface ClassBand {
  /** Lowest CGPA (inclusive, after rounding to 2 decimals) that earns this class. */
  min: number;
  label: string;
}

export interface Scale {
  id: ScaleId;
  label: string;
  max: number;
  grades: Grade[];
  /** Highest band first. */
  classes: ClassBand[];
  note: string;
}

export const SCALES: Record<ScaleId, Scale> = {
  '5': {
    id: '5',
    label: '5-point scale',
    max: 5,
    grades: [
      { letter: 'A', points: 5 },
      { letter: 'B', points: 4 },
      { letter: 'C', points: 3 },
      { letter: 'D', points: 2 },
      { letter: 'E', points: 1 },
      { letter: 'F', points: 0 },
    ],
    classes: [
      { min: 4.5, label: 'First Class' },
      { min: 3.5, label: 'Second Class Upper (2:1)' },
      { min: 2.4, label: 'Second Class Lower (2:2)' },
      { min: 1.5, label: 'Third Class' },
      { min: 1.0, label: 'Pass' },
      { min: 0, label: 'Below pass' },
    ],
    note: 'Class boundaries follow the commonly used Nigerian 5-point bands. Some schools differ, so confirm yours.',
  },
  '4': {
    id: '4',
    label: '4-point scale',
    max: 4,
    grades: [
      { letter: 'A', points: 4 },
      { letter: 'B', points: 3 },
      { letter: 'C', points: 2 },
      { letter: 'D', points: 1 },
      { letter: 'F', points: 0 },
    ],
    classes: [
      { min: 3.5, label: 'First Class' },
      { min: 3.0, label: 'Second Class Upper (2:1)' },
      { min: 2.0, label: 'Second Class Lower (2:2)' },
      { min: 1.0, label: 'Third Class' },
      { min: 0, label: 'Below pass' },
    ],
    note: 'Class boundaries on the 4-point scale vary between schools. These are typical values, so confirm yours.',
  },
};

export interface Course {
  id: string;
  name: string;
  /** Credit units; may be NaN/empty while the user is typing. */
  units: number;
  /** Letter grade, or '' when not chosen. */
  grade: string;
}

export interface Semester {
  id: string;
  name: string;
  courses: Course[];
}

export interface Prior {
  /** Total credit units already earned before the semesters entered here. */
  units: number;
  /** CGPA earned over those units. */
  cgpa: number;
}

export interface Stats {
  units: number;
  points: number;
  /** Unrounded average; 0 when there are no counted units. */
  gpa: number;
  counted: number;
}

/** Round to 2 decimals the way results are normally printed. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function gradePoints(letter: string, scale: ScaleId): number | null {
  const g = SCALES[scale].grades.find((x) => x.letter === letter);
  return g ? g.points : null;
}

/** True when the course has usable units and a grade that exists on the scale. */
export function isCounted(c: Course, scale: ScaleId): boolean {
  return Number.isFinite(c.units) && c.units > 0 && gradePoints(c.grade, scale) !== null;
}

export function semesterStats(courses: Course[], scale: ScaleId): Stats {
  let units = 0;
  let points = 0;
  let counted = 0;
  for (const c of courses) {
    if (!isCounted(c, scale)) continue;
    units += c.units;
    points += c.units * (gradePoints(c.grade, scale) as number);
    counted += 1;
  }
  return { units, points, gpa: units > 0 ? points / units : 0, counted };
}

export function cumulativeStats(semesters: Semester[], scale: ScaleId, prior?: Prior | null): Stats {
  let units = 0;
  let points = 0;
  let counted = 0;
  if (prior && Number.isFinite(prior.units) && prior.units > 0 && Number.isFinite(prior.cgpa) && prior.cgpa >= 0) {
    units += prior.units;
    points += prior.units * prior.cgpa;
  }
  for (const s of semesters) {
    const st = semesterStats(s.courses, scale);
    units += st.units;
    points += st.points;
    counted += st.counted;
  }
  return { units, points, gpa: units > 0 ? points / units : 0, counted };
}

export function classify(cgpa: number, scale: ScaleId): string {
  const r = round2(cgpa);
  const band = SCALES[scale].classes.find((b) => r >= b.min);
  return band ? band.label : 'Below pass';
}

export interface PlanInput {
  currentCgpa: number;
  currentUnits: number;
  nextUnits: number;
  target: number;
  scale: ScaleId;
}

export type PlanResult =
  | { kind: 'invalid'; reason: string }
  | { kind: 'secured'; required: number }
  | { kind: 'possible'; required: number }
  | { kind: 'impossible'; required: number; best: number };

/**
 * What GPA is needed over the next `nextUnits` units to finish on `target` CGPA?
 */
export function plan(input: PlanInput): PlanResult {
  const { currentCgpa, currentUnits, nextUnits, target, scale } = input;
  const max = SCALES[scale].max;
  const vals = [currentCgpa, currentUnits, nextUnits, target];
  if (vals.some((v) => !Number.isFinite(v))) return { kind: 'invalid', reason: 'Fill in every field.' };
  if (currentCgpa < 0 || currentCgpa > max) return { kind: 'invalid', reason: `Current CGPA must be between 0 and ${max}.` };
  if (target < 0 || target > max) return { kind: 'invalid', reason: `Target must be between 0 and ${max}.` };
  if (currentUnits < 0) return { kind: 'invalid', reason: 'Current units cannot be negative.' };
  if (nextUnits <= 0) return { kind: 'invalid', reason: 'Next-semester units must be more than 0.' };

  const required = (target * (currentUnits + nextUnits) - currentCgpa * currentUnits) / nextUnits;
  const best = (currentCgpa * currentUnits + max * nextUnits) / (currentUnits + nextUnits);
  if (required <= 0) return { kind: 'secured', required: 0 };
  if (required > max + 1e-9) return { kind: 'impossible', required: round2(required), best: round2(best) };
  return { kind: 'possible', required: Math.ceil(required * 100 - 1e-9) / 100 };
}

/** Keep letter grades that exist on the new scale, clear the rest. Returns how many were cleared. */
export function remapGrades<C extends { grade: string }>(semesters: { courses: C[] }[], to: ScaleId): number {
  let cleared = 0;
  for (const s of semesters) {
    for (const c of s.courses) {
      if (c.grade && gradePoints(c.grade, to) === null) {
        c.grade = '';
        cleared += 1;
      }
    }
  }
  return cleared;
}
