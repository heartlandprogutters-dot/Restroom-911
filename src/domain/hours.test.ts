import { describe, expect, it } from 'vitest';
import { formatHoursList, getOpenStatus, getZonedParts } from './hours';

const WEEKDAYS = [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '17:00' }];
const OVERNIGHT = [{ days: [0, 1, 2, 3, 4, 5, 6], open: '22:00', close: '06:00' }];
const ALL_DAY = [{ days: [0, 1, 2, 3, 4, 5, 6], open: '00:00', close: '24:00' }];

describe('time zones', () => {
  it('reads Central Standard Time in January', () => {
    const parts = getZonedParts(new Date('2026-01-15T15:00:00.000Z'), 'America/Chicago');
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe(4);
  });

  it('reads Central Daylight Time in July', () => {
    const parts = getZonedParts(new Date('2026-07-15T15:00:00.000Z'), 'America/Chicago');
    expect(parts.hour).toBe(10);
    expect(parts.weekday).toBe(3);
  });

  it('treats a weekday window as open at 8:00 Chicago and closed at 7:59', () => {
    const winterOpen = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-01-15T14:00:00.000Z'));
    const winterClosed = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-01-15T13:59:00.000Z'));
    const summerOpen = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-07-15T13:00:00.000Z'));
    const summerClosed = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-07-15T12:59:00.000Z'));
    expect(winterOpen.state).toBe('open');
    expect(winterClosed.state).toBe('closed');
    expect(summerOpen.state).toBe('open');
    expect(summerClosed.state).toBe('closed');
  });
});

describe('open and closed hours', () => {
  it('keeps unknown hours unknown', () => {
    const status = getOpenStatus(null, 'America/Chicago', new Date('2026-11-08T18:00:00.000Z'));
    expect(status.state).toBe('unknown');
    expect(status.label).toBe('Hours: unknown');
  });

  it('treats an empty schedule as closed', () => {
    const status = getOpenStatus([], 'America/Chicago', new Date('2026-11-08T18:00:00.000Z'));
    expect(status.state).toBe('closed');
    expect(status.detail).toMatch(/no open hours/i);
  });

  it('handles a 24-hour window', () => {
    const status = getOpenStatus(ALL_DAY, 'America/Chicago', new Date('2026-11-08T09:30:00.000Z'));
    expect(status.state).toBe('open');
    expect(status.detail).toBe('24 hours');
  });

  it('opens overnight after midnight and closes in the afternoon', () => {
    const afterMidnight = getOpenStatus(OVERNIGHT, 'America/Chicago', new Date('2026-01-15T09:30:00.000Z'));
    const afternoon = getOpenStatus(OVERNIGHT, 'America/Chicago', new Date('2026-01-15T18:00:00.000Z'));
    const evening = getOpenStatus(OVERNIGHT, 'America/Chicago', new Date('2026-01-16T04:30:00.000Z'));
    expect(afterMidnight.state).toBe('open');
    expect(afterMidnight.detail).toBe('until 6:00 AM');
    expect(afternoon.state).toBe('closed');
    expect(afternoon.detail).toBe('Opens Today 10:00 PM');
    expect(evening.state).toBe('open');
  });

  it('names the next weekday opening in Chicago', () => {
    const sunday = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-11-08T18:00:00.000Z'));
    const saturday = getOpenStatus(WEEKDAYS, 'America/Chicago', new Date('2026-11-07T18:00:00.000Z'));
    expect(sunday.state).toBe('closed');
    expect(sunday.detail).toBe('Opens Tomorrow 8:00 AM');
    expect(saturday.detail).toBe('Opens Mon 8:00 AM');
  });

  it('formats grouped hours without inventing a missing day', () => {
    expect(formatHoursList(WEEKDAYS)).toEqual(['Mon–Fri, 8:00 AM–5:00 PM']);
    expect(formatHoursList(null)).toEqual(['Unknown']);
    expect(formatHoursList([])).toEqual(['No open hours listed']);
    expect(formatHoursList(ALL_DAY)).toEqual(['Every day, 24 hours']);
  });
});
