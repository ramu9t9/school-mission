import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('has exactly the four destinations in order', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Home',
      'Board',
      'Review',
      'Settings',
    ]);
  });

  it('maps each label to the correct route', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/',
      '/board',
      '/review',
      '/settings',
    ]);
  });
});
