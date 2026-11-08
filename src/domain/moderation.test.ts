import { describe, expect, it } from 'vitest';
import { place, report } from './fixtures';
import { factOverlay, overlayWarnings } from './moderation';

const NOW = new Date('2026-11-08T18:00:00.000Z');

describe('moderation overlay', () => {
  it('does not apply a single unreviewed report to verified fields', () => {
    const restroom = place({ id: 'a', wheelchair: 'yes', access: 'public', hours: [{ days: [1], open: '09:00', close: '17:00' }] });
    const before = structuredClone(restroom);
    const overlay = factOverlay(
      restroom,
      [
        report({ id: '1', kind: 'wrong-accessibility', status: 'pending' }),
        report({ id: '2', kind: 'closure', status: 'pending' }),
        report({ id: '3', kind: 'purchase-required', status: 'pending' }),
      ],
      NOW,
    );
    expect(overlay.unusable).toBe(false);
    expect(overlay.accessibilityDisputed).toBe(false);
    expect(overlay.purchaseDisputed).toBe(false);
    expect(restroom).toEqual(before);
    expect(overlayWarnings(overlay)).toEqual([]);
  });

  it('flags an approved closure without rewriting hours or access', () => {
    const restroom = place({ id: 'a', access: 'public' });
    const before = structuredClone(restroom);
    const overlay = factOverlay(
      restroom,
      [report({ id: '1', kind: 'closure', status: 'approved', createdAt: '2026-11-07T15:00:00.000Z' })],
      NOW,
    );
    expect(overlay.unusable).toBe(true);
    expect(overlay.unusableReason).toBe('closure');
    expect(restroom).toEqual(before);
    expect(overlayWarnings(overlay).join(' ')).toMatch(/not overwritten/i);
  });

  it('ignores rejected and older-than-verification reports', () => {
    const restroom = place({ id: 'a', verifiedAt: '2026-11-06T15:00:00.000Z' });
    const overlay = factOverlay(
      restroom,
      [
        report({ id: 'old', kind: 'locked-door', status: 'approved', createdAt: '2026-11-01T15:00:00.000Z' }),
        report({ id: 'no', kind: 'wrong-hours', status: 'rejected', createdAt: '2026-11-07T15:00:00.000Z' }),
      ],
      NOW,
    );
    expect(overlay.unusable).toBe(false);
    expect(overlay.hoursDisputed).toBe(false);
  });

  it('keeps an approved accessibility dispute separate from the verified value', () => {
    const restroom = place({ id: 'a', wheelchair: 'yes' });
    const overlay = factOverlay(
      restroom,
      [report({ id: '1', kind: 'wrong-accessibility', status: 'approved', createdAt: '2026-11-07T15:00:00.000Z' })],
      NOW,
    );
    expect(restroom.wheelchair).toBe('yes');
    expect(overlay.accessibilityDisputed).toBe(true);
  });
});
