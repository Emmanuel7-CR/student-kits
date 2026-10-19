import { describe, expect, it } from 'vitest';
import {
  classify,
  cumulativeStats,
  plan,
  remapGrades,
  round2,
  semesterStats,
  type Course,
  type Semester,
} from '../src/lib/cgpa';

const c = (units: number, grade: string, name = ''): Course => ({ id: Math.random().toString(36), name, units, grade });

describe('semesterStats', () => {
  const courses = [c(3, 'A'), c(3, 'B'), c(2, 'B'), c(2, 'C')];

  it('computes a 5-point GPA', () => {
    const s = semesterStats(courses, '5');
    expect(s.units).toBe(10);
    expect(s.points).toBe(41);
    expect(round2(s.gpa)).toBe(4.1);
  });

  it('computes a 4-point GPA from the same letters', () => {
    const s = semesterStats(courses, '4');
    expect(s.points).toBe(31);
    expect(round2(s.gpa)).toBe(3.1);
  });

  it('ignores rows with no grade, no units, or bad units', () => {
    const s = semesterStats([c(3, 'A'), c(0, 'B'), c(NaN, 'C'), c(2, ''), c(-1, 'A')], '5');
    expect(s.units).toBe(3);
    expect(s.counted).toBe(1);
    expect(s.gpa).toBe(5);
  });

  it('does not count an E on the 4-point scale (it does not exist there)', () => {
    const s = semesterStats([c(3, 'E')], '4');
    expect(s.counted).toBe(0);
    expect(s.gpa).toBe(0);
  });

  it('counts an F as zero points but keeps its units', () => {
    const s = semesterStats([c(3, 'A'), c(3, 'F')], '5');
    expect(s.units).toBe(6);
    expect(s.gpa).toBe(2.5);
  });

  it('returns zeros for no courses', () => {
    expect(semesterStats([], '5')).toEqual({ units: 0, points: 0, gpa: 0, counted: 0 });
  });
});

describe('cumulativeStats', () => {
  const sems: Semester[] = [
    { id: 's1', name: 'Year 1 first semester', courses: [c(3, 'A'), c(3, 'B')] }, // 27 pts / 6 u
    { id: 's2', name: 'Year 1 second semester', courses: [c(4, 'C'), c(2, 'A')] }, // 22 pts / 6 u
  ];

  it('weights by units across semesters', () => {
    const s = cumulativeStats(sems, '5');
    expect(s.units).toBe(12);
    expect(s.points).toBe(49);
    expect(round2(s.gpa)).toBe(4.08);
  });

  it('folds in a previous CGPA and unit count', () => {
    // prior: 3.0 over 20 units = 60 points; add 49 points over 12 units => 109 / 32
    const s = cumulativeStats(sems, '5', { units: 20, cgpa: 3.0 });
    expect(s.units).toBe(32);
    expect(round2(s.gpa)).toBe(3.41);
  });

  it('ignores an unusable prior', () => {
    const s = cumulativeStats(sems, '5', { units: NaN, cgpa: 3 });
    expect(s.units).toBe(12);
  });
});

describe('classify', () => {
  it('uses 5-point bands', () => {
    expect(classify(5, '5')).toBe('First Class');
    expect(classify(4.5, '5')).toBe('First Class');
    expect(classify(4.49, '5')).toBe('Second Class Upper (2:1)');
    expect(classify(3.5, '5')).toBe('Second Class Upper (2:1)');
    expect(classify(3.49, '5')).toBe('Second Class Lower (2:2)');
    expect(classify(2.4, '5')).toBe('Second Class Lower (2:2)');
    expect(classify(2.39, '5')).toBe('Third Class');
    expect(classify(1.5, '5')).toBe('Third Class');
    expect(classify(1.49, '5')).toBe('Pass');
    expect(classify(0.99, '5')).toBe('Below pass');
  });

  it('uses 4-point bands', () => {
    expect(classify(4, '4')).toBe('First Class');
    expect(classify(3.5, '4')).toBe('First Class');
    expect(classify(3.49, '4')).toBe('Second Class Upper (2:1)');
    expect(classify(3.0, '4')).toBe('Second Class Upper (2:1)');
    expect(classify(2.0, '4')).toBe('Second Class Lower (2:2)');
    expect(classify(1.0, '4')).toBe('Third Class');
    expect(classify(0.5, '4')).toBe('Below pass');
  });

  it('rounds to 2 decimals before comparing, as printed results do', () => {
    expect(classify(4.496, '5')).toBe('First Class');
    expect(classify(4.494, '5')).toBe('Second Class Upper (2:1)');
  });
});

describe('plan', () => {
  it('finds the GPA needed next semester', () => {
    // (4.0 * 80 - 3.8 * 60) / 20 = 4.6
    const r = plan({ currentCgpa: 3.8, currentUnits: 60, nextUnits: 20, target: 4.0, scale: '5' });
    expect(r).toEqual({ kind: 'possible', required: 4.6 });
  });

  it('works on the 4-point scale', () => {
    // (3.5 * 80 - 3.4 * 60) / 20 = 3.8
    const r = plan({ currentCgpa: 3.4, currentUnits: 60, nextUnits: 20, target: 3.5, scale: '4' });
    expect(r).toEqual({ kind: 'possible', required: 3.8 });
  });

  it('rounds the requirement up, never down', () => {
    // (3.0 * 33 - 2.9 * 30) / 3 = 4 -> exact; use a value that is not exact
    const r = plan({ currentCgpa: 3.33, currentUnits: 31, nextUnits: 17, target: 3.5, scale: '5' });
    expect(r.kind).toBe('possible');
    if (r.kind === 'possible') {
      const exact = (3.5 * 48 - 3.33 * 31) / 17;
      expect(r.required).toBeGreaterThanOrEqual(exact);
      expect(r.required - exact).toBeLessThan(0.01);
    }
  });

  it('says when the target is already secured', () => {
    // (4.4 * 110 - 4.9 * 100) / 10 = -0.6: even a 0.00 GPA next semester keeps 4.4 or better
    const r = plan({ currentCgpa: 4.9, currentUnits: 100, nextUnits: 10, target: 4.4, scale: '5' });
    expect(r.kind).toBe('secured');
  });

  it('says when the target cannot be reached and reports the best possible CGPA', () => {
    // (4.5 * 75 - 3.0 * 60) / 15 = 10.5 ; best = (180 + 5 * 15) / 75 = 3.4
    const r = plan({ currentCgpa: 3.0, currentUnits: 60, nextUnits: 15, target: 4.5, scale: '5' });
    expect(r).toEqual({ kind: 'impossible', required: 10.5, best: 3.4 });
  });

  it('rejects out-of-range input', () => {
    expect(plan({ currentCgpa: 5.5, currentUnits: 10, nextUnits: 10, target: 4, scale: '5' }).kind).toBe('invalid');
    expect(plan({ currentCgpa: 3, currentUnits: 10, nextUnits: 10, target: 4.5, scale: '4' }).kind).toBe('invalid');
    expect(plan({ currentCgpa: 3, currentUnits: 10, nextUnits: 0, target: 3, scale: '5' }).kind).toBe('invalid');
    expect(plan({ currentCgpa: NaN, currentUnits: 10, nextUnits: 10, target: 3, scale: '5' }).kind).toBe('invalid');
  });
});

describe('remapGrades', () => {
  it('keeps shared letters and clears letters missing from the new scale', () => {
    const sems: Semester[] = [{ id: 's', name: 'S', courses: [c(3, 'A'), c(3, 'E'), c(2, '')] }];
    const cleared = remapGrades(sems, '4');
    expect(cleared).toBe(1);
    expect(sems[0].courses.map((x) => x.grade)).toEqual(['A', '', '']);
  });
});
