import { describe, expect, it } from 'vitest';
import { PREFERENCES_OFF } from './types';
import { place, report } from './fixtures';
import { rankRestrooms } from './ranking';

const NOW = new Date('2026-11-04T21:00:00.000Z');
const ORIGIN = { lat: 36.7417, lng: -88.6367 };

function rank(over: Partial<Parameters<typeof rankRestrooms>[0]> = {}) {
  return rankRestrooms({
    restrooms: [],
    origin: ORIGIN,
    now: NOW,
    preferences: PREFERENCES_OFF,
    mode: 'fastest',
    ...over,
  });
}

describe('required accessibility', () => {
  const yes = place({ id: 'yes', wheelchair: 'yes', location: { lat: 36.742, lng: -88.636 } });
  const no = place({ id: 'no', wheelchair: 'no', location: { lat: 36.743, lng: -88.636 } });
  const unknown = place({ id: 'unknown', wheelchair: 'unknown', location: { lat: 36.744, lng: -88.636 } });

  it('drops places that do not confirm a required feature and does not substitute them', () => {
    const result = rank({
      restrooms: [no, unknown, yes],
      preferences: { ...PREFERENCES_OFF, wheelchair: 'required' },
    });
    expect(result.suitable.map((item) => item.restroom.id)).toEqual(['yes']);
    expect(result.excluded.map((item) => item.restroom.id).sort()).toEqual(['no', 'unknown']);
    expect(result.best?.restroom.id).toBe('yes');
  });

  it('says so when nothing confirms the required feature', () => {
    const result = rank({
      restrooms: [no, unknown],
      preferences: { ...PREFERENCES_OFF, genderNeutral: 'required' },
    });
    expect(result.best).toBeNull();
    expect(result.emptyReason).toMatch(/gender-neutral/i);
    expect(result.emptyReason).toMatch(/unknown was not treated as a match/i);
    expect(result.emptyReason).toMatch(/substituted/i);
  });

  it('keeps an unknown feature when it is only preferred and ranks a confirmed one ahead', () => {
    const result = rank({
      restrooms: [unknown, yes],
      preferences: { ...PREFERENCES_OFF, wheelchair: 'preferred' },
      travel: {
        unknown: { distanceMeters: 500, travelTimeMinutes: null, method: 'straight-line' },
        yes: { distanceMeters: 500, travelTimeMinutes: null, method: 'straight-line' },
      },
    });
    expect(result.suitable.map((item) => item.restroom.id)).toEqual(['yes', 'unknown']);
    expect(result.excluded).toHaveLength(0);
  });
});

describe('hours, access, and explanations', () => {
  it('excludes a closed place and keeps unknown hours eligible', () => {
    const closed = place({
      id: 'closed',
      hours: [{ days: [1, 2, 3, 4, 5], open: '09:00', close: '17:00' }],
      location: { lat: 36.742, lng: -88.637 },
    });
    const unknownHours = place({
      id: 'unknown-hours',
      hours: null,
      location: { lat: 36.745, lng: -88.637 },
      verifiedAt: null,
    });
    const result = rank({ restrooms: [closed, unknownHours], now: new Date('2026-11-08T18:00:00.000Z') });
    expect(result.best?.restroom.id).toBe('unknown-hours');
    expect(result.best?.open.state).toBe('unknown');
    expect(result.best?.explanation).toMatch(/hours unknown/);
    expect(result.excluded.find((item) => item.restroom.id === 'closed')?.reasons).toContain('closed');
  });

  it('does not invent travel minutes for straight-line distance', () => {
    const near = place({ id: 'near', fictional: true, location: { lat: 36.7422, lng: -88.6369 } });
    const result = rank({
      restrooms: [near],
      travel: { near: { distanceMeters: 400, travelTimeMinutes: 3, method: 'straight-line' } },
    });
    expect(result.best?.travel.travelTimeMinutes).toBeNull();
    expect(result.best?.explanation).toMatch(/approximate distance/);
    expect(result.best?.explanation).not.toMatch(/minute/);
  });

  it('uses a supplied route time in the explanation', () => {
    const routed = place({
      id: 'routed',
      fictional: false,
      dataset: 'server-sandbox',
      access: 'public',
      verifiedAt: '2026-11-01T15:00:00.000Z',
      hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: '00:00', close: '24:00' }],
    });
    const result = rank({
      restrooms: [routed],
      travel: { routed: { distanceMeters: 800, travelTimeMinutes: 5, method: 'routed' } },
    });
    expect(result.best?.explanation).toBe('About 5 minutes away, public access, recently verified.');
  });

  it('prefers public access over purchase-required at the same distance', () => {
    const pub = place({ id: 'public', access: 'public' });
    const pay = place({ id: 'pay', access: 'purchase-required' });
    const travel = {
      public: { distanceMeters: 500, travelTimeMinutes: null, method: 'straight-line' as const },
      pay: { distanceMeters: 500, travelTimeMinutes: null, method: 'straight-line' as const },
    };
    const result = rank({ restrooms: [pay, pub], travel });
    expect(result.best?.restroom.id).toBe('public');
  });
});

describe('sort modes', () => {
  it('picks the closer place for fastest and the higher sample rating when asked', () => {
    const close = place({
      id: 'close',
      sampleRating: { cleanliness: 3, easeOfAccess: 3, overall: 3.2, count: 10 },
      location: { lat: 36.742, lng: -88.6365 },
    });
    const far = place({
      id: 'far',
      sampleRating: { cleanliness: 5, easeOfAccess: 5, overall: 4.9, count: 10 },
      location: { lat: 36.78, lng: -88.7 },
    });
    const fastest = rank({ restrooms: [far, close], mode: 'fastest' });
    const rated = rank({ restrooms: [far, close], mode: 'highest-rated' });
    expect(fastest.best?.restroom.id).toBe('close');
    expect(rated.best?.restroom.id).toBe('far');
    expect(rated.alternatives.map((item) => item.restroom.id)).toEqual(['close']);
  });
});

describe('reports and ranking', () => {
  const restroom = place({
    id: 'a',
    hours: [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '18:00' }],
    access: 'public',
    wheelchair: 'yes',
  });

  it('ignores a pending report', () => {
    const before = rank({ restrooms: [structuredClone(restroom)] });
    const after = rank({
      restrooms: [structuredClone(restroom)],
      reports: [report({ id: 'p', kind: 'locked-door', status: 'pending', createdAt: '2026-11-04T12:00:00.000Z' })],
    });
    expect(after.best?.restroom.id).toBe('a');
    expect(after.best?.score).toBeCloseTo(before.best!.score);
    expect(after.best?.restroom.hours).toEqual(restroom.hours);
  });

  it('excludes an approved lock that is newer than verification, without rewriting hours', () => {
    const snapshot = structuredClone(restroom);
    const result = rank({
      restrooms: [restroom],
      reports: [
        report({
          id: 'lock',
          kind: 'locked-door',
          status: 'approved',
          createdAt: '2026-11-03T15:00:00.000Z',
        }),
      ],
    });
    expect(result.best).toBeNull();
    expect(result.excluded[0]?.reasons).toContain('reported-unusable');
    expect(restroom).toEqual(snapshot);
    expect(result.emptyReason).toMatch(/approved lock or closure/i);
  });

  it('keeps a place when a later verification is newer than the lock report', () => {
    const reviewed = place({
      id: 'a',
      verifiedAt: '2026-11-04T18:00:00.000Z',
    });
    const result = rank({
      restrooms: [reviewed],
      reports: [
        report({
          id: 'old-lock',
          kind: 'closure',
          status: 'approved',
          createdAt: '2026-10-01T15:00:00.000Z',
        }),
      ],
    });
    expect(result.best?.restroom.id).toBe('a');
    expect(result.best?.overlay.unusable).toBe(false);
  });

  it('does not let an approved hours dispute overwrite open or closed', () => {
    const result = rank({
      restrooms: [restroom],
      reports: [
        report({
          id: 'hours',
          kind: 'wrong-hours',
          status: 'approved',
          createdAt: '2026-11-04T12:00:00.000Z',
        }),
      ],
    });
    expect(result.best?.open.state).toBe('open');
    expect(result.best?.restroom.hours).toEqual(restroom.hours);
    expect(result.best?.overlay.hoursDisputed).toBe(true);
  });

  it('does not treat a rejected report as a fact', () => {
    const result = rank({
      restrooms: [restroom],
      reports: [report({ id: 'nope', kind: 'locked-door', status: 'rejected', createdAt: '2026-11-04T12:00:00.000Z' })],
    });
    expect(result.best?.restroom.id).toBe('a');
    expect(result.best?.overlay.unusable).toBe(false);
  });
});

describe('distance limit', () => {
  it('explains when every place is outside the search radius', () => {
    const far = place({ id: 'far', location: { lat: 37.5, lng: -89.5 } });
    const result = rank({ restrooms: [far], maxDistanceMeters: 15 * 1609.344 });
    expect(result.best).toBeNull();
    expect(result.emptyReason).toMatch(/15 miles/);
  });
});
