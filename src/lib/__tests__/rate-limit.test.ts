import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    // Reset internal store effectively by using unique keys
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    const key = 'test-key-1';
    const config = { windowMs: 1000, max: 2 };

    expect(rateLimit(key, config)).toBe(true);
    expect(rateLimit(key, config)).toBe(true);
  });

  it('should block requests over limit', () => {
    const key = 'test-key-2';
    const config = { windowMs: 1000, max: 2 };

    rateLimit(key, config);
    rateLimit(key, config);
    expect(rateLimit(key, config)).toBe(false);
  });

  it('should reset after window', () => {
    const key = 'test-key-3';
    const config = { windowMs: 1000, max: 1 };

    rateLimit(key, config);
    expect(rateLimit(key, config)).toBe(false);

    // Fast forward time
    jest.advanceTimersByTime(1001);

    expect(rateLimit(key, config)).toBe(true);
  });
});
