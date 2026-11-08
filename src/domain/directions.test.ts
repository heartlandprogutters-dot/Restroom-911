import { describe, expect, it } from 'vitest';
import { externalMapLinks } from './directions';
import { matchPilotCity } from '../data/cities';

describe('external directions', () => {
  it('builds geo, Google, and Apple links without inventing a route', () => {
    const links = externalMapLinks({ lat: 36.7428, lng: -88.6358 }, 'Mayfield Welcome Kiosk Restroom');
    expect(links.geo.startsWith('geo:36.742800,-88.635800?q=')).toBe(true);
    expect(links.google).toBe('https://www.google.com/maps/dir/?api=1&destination=36.742800%2C-88.635800');
    expect(links.apple).toContain('maps.apple.com');
    expect(links.google).not.toMatch(/fastest/i);
  });
});

describe('pilot city text', () => {
  it('matches one pilot city and refuses an unknown address', () => {
    expect(matchPilotCity('downtown Murray, KY')?.id).toBe('murray');
    expect(matchPilotCity('123 Main Street')).toBeNull();
    expect(matchPilotCity('Paducah and Mayfield')).toBeNull();
  });
});
