import { describe, expect, it } from 'vitest';
import data from '../src/data/scholarships.json';
import { daysLabel, daysUntil, formatDate, groupFor, stateFor, todayInLagos } from '../src/lib/scholarships';

describe('stateFor', () => {
  const today = '2026-10-18';
  it('is closed after the deadline', () => expect(stateFor('2026-10-17', today)).toEqual({ state: 'closed', days: -1 }));
  it('is still open on the deadline day', () => expect(stateFor('2026-10-18', today)).toEqual({ state: 'soon', days: 0 }));
  it('is closing soon within 30 days', () => expect(stateFor('2026-11-17', today).state).toBe('soon'));
  it('is open beyond 30 days', () => expect(stateFor('2026-11-18', today).state).toBe('open'));
  it('has an unknown state without a deadline', () => expect(stateFor(null, today)).toEqual({ state: 'unknown', days: null }));
});

describe('groupFor', () => {
  const today = '2026-10-18';
  it('never lists contradictory entries as plainly open', () =>
    expect(groupFor({ deadline: '2026-11-30', verification: 'conflicting' }, today)).toBe('check'));
  it('puts past deadlines in past rounds, even when conflicting', () =>
    expect(groupFor({ deadline: '2026-01-01', verification: 'conflicting' }, today)).toBe('past'));
  it('puts a normal future deadline in open', () => expect(groupFor({ deadline: '2026-12-31', verification: 'reported' }, today)).toBe('open'));
  it('sends entries with no deadline to check', () => expect(groupFor({ deadline: null, verification: 'reported' }, today)).toBe('check'));
});

describe('labels and dates', () => {
  it('daysLabel', () => {
    expect(daysLabel(2)).toBe('2 days left');
    expect(daysLabel(1)).toBe('Closes tomorrow');
    expect(daysLabel(0)).toBe('Closes today');
    expect(daysLabel(-1)).toBe('Closed yesterday');
    expect(daysLabel(-40)).toBe('Closed 40 days ago');
  });
  it('formatDate', () => expect(formatDate('2026-10-20')).toBe('20 October 2026'));
  it('daysUntil', () => expect(daysUntil('2026-10-20', '2026-10-18')).toBe(2));
  it('todayInLagos returns an ISO date', () => expect(todayInLagos(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19'));
});

describe('scholarship data', () => {
  it('every entry has a source and a checked date', () => {
    expect(data.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const e of data.entries) {
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const s of e.sources) expect(s.url, e.id).toMatch(/^https:\/\//);
      if (e.official) expect(e.official.url, e.id).toMatch(/^https:\/\//);
      if (e.deadline) expect(e.deadline, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('ids are unique', () => {
    const ids = data.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('a verified entry always has an official link', () => {
    for (const e of data.entries) if (e.verification === 'verified') expect(e.official, e.id).not.toBeNull();
  });
});
