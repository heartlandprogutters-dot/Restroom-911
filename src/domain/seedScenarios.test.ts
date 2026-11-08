import { describe, expect, it } from 'vitest';
import { cityById } from '../data/cities';
import { getSampleReports, SEED_RESTROOMS } from '../data/seed';
import { PREFERENCES_OFF } from './types';
import { rankRestrooms } from './ranking';

function cityRank(cityId: string, mode: 'fastest' | 'highest-rated' = 'fastest', prefs = PREFERENCES_OFF) {
  const city = cityById(cityId)!;
  return rankRestrooms({
    restrooms: SEED_RESTROOMS.filter((restroom) => restroom.cityId === cityId),
    origin: city.center,
    now: new Date(),
    preferences: prefs,
    mode,
    reports: getSampleReports(),
  });
}

describe('packaged demo scenarios', () => {
  it('keeps every pilot city stocked with a suitable 24-hour option', () => {
    for (const cityId of ['mayfield', 'paducah', 'benton', 'murray', 'grand-rivers']) {
      expect(cityRank(cityId).best, cityId).toBeTruthy();
    }
  });

  it('does not let the pending kiosk report or the approved depot lock change the Mayfield best pick', () => {
    const result = cityRank('mayfield');
    expect(result.best?.restroom.id).toBe('mayfield-welcome-kiosk');
    expect(result.excluded.some((item) => item.restroom.id === 'mayfield-demo-depot')).toBe(true);
  });

  it('ranks Paducah fastest and highest rated differently', () => {
    expect(cityRank('paducah', 'fastest').best?.restroom.id).toBe('paducah-transit');
    expect(cityRank('paducah', 'highest-rated').best?.restroom.id).toBe('paducah-gallery');
  });

  it('does not substitute an unknown-access Benton place when wheelchair access is required', () => {
    const result = cityRank('benton', 'fastest', { ...PREFERENCES_OFF, wheelchair: 'required' });
    expect(result.suitable.some((item) => item.restroom.id === 'benton-trail')).toBe(false);
    expect(result.best?.restroom.wheelchair).toBe('yes');
  });

  it('finds no Benton match when a gender-neutral restroom is required', () => {
    const result = cityRank('benton', 'fastest', { ...PREFERENCES_OFF, genderNeutral: 'required' });
    expect(result.suitable).toHaveLength(0);
    expect(result.emptyReason).toMatch(/gender-neutral/i);
  });
});
