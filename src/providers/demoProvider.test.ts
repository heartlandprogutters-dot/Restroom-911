import { describe, expect, it } from 'vitest';
import { SEED_RESTROOMS } from '../data/seed';
import { createMemoryStore } from '../storage/memoryStore';
import { createDemoProvider } from './demoProvider';

function provider(admin = true) {
  return createDemoProvider(createMemoryStore(), { isAdmin: () => admin });
}

describe('demo provider', () => {
  it('keeps user reports pending and separate from the packaged seed', async () => {
    const demo = provider();
    const before = structuredClone(SEED_RESTROOMS);
    const saved = await demo.submitReport(
      { restroomId: 'mayfield-welcome-kiosk', kind: 'locked-door', note: 'Locked in the demo.' },
      { online: true },
    );
    expect(saved.message).toMatch(/not sent to a server/i);
    expect(saved.record.status).toBe('pending');
    expect(saved.record.sample).toBe(false);
    const reports = await demo.listReports();
    const pending = reports.find((report) => report.id === saved.record.id);
    const kiosk = (await demo.listRestrooms()).find((restroom) => restroom.id === 'mayfield-welcome-kiosk');
    expect(pending?.status).toBe('pending');
    expect(kiosk?.hours).toEqual(before.find((restroom) => restroom.id === 'mayfield-welcome-kiosk')?.hours);
    expect(SEED_RESTROOMS).toEqual(before);
  });

  it('applies a report to ranking only after approval, and reset clears it', async () => {
    const demo = provider();
    const saved = await demo.submitReport(
      { restroomId: 'paducah-transit', kind: 'closure', note: 'Sample closure from this device.' },
      { online: false },
    );
    expect(saved.message).toMatch(/offline/i);
    const pendingReports = await demo.listReports();
    expect(pendingReports.find((report) => report.id === saved.record.id)?.status).toBe('pending');
    await demo.moderate(saved.record.id, 'approved');
    const approved = (await demo.listReports()).find((report) => report.id === saved.record.id);
    expect(approved?.status).toBe('approved');
    await demo.reset();
    const after = await demo.listReports();
    expect(after.some((report) => report.id === saved.record.id)).toBe(false);
    expect(after.some((report) => report.id === 'sample-depot-locked')).toBe(true);
  });

  it('blocks moderation until demo admin is unlocked and isolates two devices', async () => {
    const locked = provider(false);
    await expect(locked.moderate('sample-depot-locked', 'rejected')).rejects.toThrow(/not server authentication/i);
    const a = provider(true);
    const b = provider(true);
    await a.submitRating(
      { restroomId: 'murray-commons', cleanliness: 4, easeOfAccess: 5, overall: 4 },
      { online: true },
    );
    expect(await b.listRatings()).toEqual([]);
  });
});
