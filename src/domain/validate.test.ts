import { describe, expect, it } from 'vitest';
import { SEED_RESTROOMS } from '../data/seed';
import { validateRatingInput, validateReportInput, validateRestroom } from './validate';

describe('submission validation', () => {
  it('rejects health fields and out-of-range ratings', () => {
    const health = validateReportInput({
      restroomId: 'mayfield-welcome-kiosk',
      kind: 'locked-door',
      note: 'Door locked',
      diagnosis: 'private',
    });
    expect(health.ok).toBe(false);
    if (!health.ok) expect(health.errors.join(' ')).toMatch(/health/i);

    const rating = validateRatingInput({
      restroomId: 'mayfield-welcome-kiosk',
      cleanliness: 6,
      easeOfAccess: 3,
      overall: 3,
    });
    expect(rating.ok).toBe(false);
  });

  it('accepts a normal report and rejects a missing-restroom report without a place', () => {
    const ok = validateReportInput({
      restroomId: 'mayfield-welcome-kiosk',
      kind: 'locked-door',
      note: 'The sample door was locked.',
    });
    expect(ok.ok).toBe(true);
    const missing = validateReportInput({ restroomId: null, kind: 'missing-restroom', note: 'Add this' });
    expect(missing.ok).toBe(false);
  });

  it('rejects a fictional place that also allows external navigation', () => {
    const seed = structuredClone(SEED_RESTROOMS[0]);
    seed.allowExternalNavigation = true;
    const result = validateRestroom(seed);
    expect(result.ok).toBe(false);
  });
});
