import { describe, expect, it } from 'vitest';
import { canUseLocationSearch, canUseQrGuidance } from './accessPlan';

describe('tester plan', () => {
  it('keeps QR guidance free and location search on the simulated paid plan', () => {
    expect(canUseQrGuidance('free')).toBe(true);
    expect(canUseQrGuidance('paid-simulated')).toBe(true);
    expect(canUseLocationSearch('free')).toBe(false);
    expect(canUseLocationSearch('paid-simulated')).toBe(true);
  });
});
