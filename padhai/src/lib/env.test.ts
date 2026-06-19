import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts a valid environment and applies defaults', () => {
    const env = parseEnv({ NODE_ENV: 'production', APP_URL: 'https://padhai.app' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.APP_URL).toBe('https://padhai.app');
  });

  it('defaults NODE_ENV to development and APP_URL to localhost when unset', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_URL).toBe('http://localhost:3000');
  });

  it('throws listing the offending key when NODE_ENV is invalid', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('throws when APP_URL is not a valid URL', () => {
    expect(() => parseEnv({ APP_URL: 'not-a-url' })).toThrowError(/APP_URL/);
  });
});
