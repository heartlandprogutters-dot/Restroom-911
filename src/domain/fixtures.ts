import type { HoursWindow, Report, Restroom } from './types';

const ALL_DAY: HoursWindow[] = [{ days: [0, 1, 2, 3, 4, 5, 6], open: '00:00', close: '24:00' }];

export function place(over: Partial<Restroom> & Pick<Restroom, 'id'>): Restroom {
  return {
    cityId: 'mayfield',
    name: over.id,
    address: '1 Demo Street, Mayfield, KY',
    location: { lat: 36.74, lng: -88.64 },
    access: 'public',
    hours: ALL_DAY,
    timeZone: 'America/Chicago',
    wheelchair: 'yes',
    stallType: 'single-user',
    changingTable: 'unknown',
    familyRestroom: 'unknown',
    genderNeutral: 'unknown',
    parkingDelayMin: null,
    entranceDelayMin: null,
    indoorWalkMin: null,
    entranceSummary: null,
    indoorSummary: null,
    entrances: [],
    sampleRating: null,
    verifiedAt: '2026-10-01T15:00:00.000Z',
    verificationSource: 'Unit test',
    verificationHistory: [],
    dataset: 'fictional-demo',
    fictional: true,
    allowExternalNavigation: false,
    updatedAt: '2026-10-01T15:00:00.000Z',
    ...over,
  };
}

export function report(over: Partial<Report> & Pick<Report, 'id' | 'kind'>): Report {
  return {
    restroomId: 'a',
    note: 'Test report note',
    status: 'pending',
    createdAt: '2026-11-01T15:00:00.000Z',
    source: 'device',
    sample: false,
    ...over,
  };
}
