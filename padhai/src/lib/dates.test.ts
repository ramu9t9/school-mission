import { describe, it, expect } from 'vitest';
import { timelineBucket, todayISO } from './dates';

describe('todayISO', () => {
  it('formats the date part as YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-06-20T09:30:00Z'))).toBe('2026-06-20');
  });
});

describe('timelineBucket', () => {
  const today = '2026-06-20';
  it('buckets by relative day', () => {
    expect(timelineBucket(null, today)).toBe('none');
    expect(timelineBucket('2026-06-19', today)).toBe('overdue');
    expect(timelineBucket('2026-06-20', today)).toBe('today');
    expect(timelineBucket('2026-06-21', today)).toBe('tomorrow');
    expect(timelineBucket('2026-06-25', today)).toBe('week');   // within 7 days
    expect(timelineBucket('2026-08-01', today)).toBe('later');
  });
});
