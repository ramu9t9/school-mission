import { describe, it, expect } from 'vitest';
import { buildHealth } from './health';

describe('buildHealth', () => {
  it('reports ok status for the padhai service', () => {
    const result = buildHealth(new Date('2026-06-19T03:30:00.000Z'));
    expect(result.status).toBe('ok');
    expect(result.service).toBe('padhai');
    expect(result.timestamp).toBe('2026-06-19T03:30:00.000Z');
  });

  it('uses the current time when no date is given', () => {
    const before = Date.now();
    const result = buildHealth();
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
  });
});
