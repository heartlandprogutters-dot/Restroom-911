import { PILOT_CITY_IDS } from '../data/cities';
import { parseClock } from './hours';
import type { AccessType, DatasetKind, HoursWindow, Report, ReportKind, Restroom, StallType, Tri } from './types';

export interface ReportInput {
  restroomId: string | null;
  kind: ReportKind;
  note: string;
  suggestion?: {
    cityId: string;
    name: string;
    address: string;
    details: string;
  };
}

export interface RatingInput {
  restroomId: string;
  cleanliness: number;
  easeOfAccess: number;
  overall: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const REPORT_KINDS: ReportKind[] = [
  'locked-door',
  'closure',
  'wrong-hours',
  'purchase-required',
  'wrong-accessibility',
  'correction',
  'missing-restroom',
];

const ACCESS: AccessType[] = ['public', 'customer-only', 'purchase-required', 'unknown'];
const TRI: Tri[] = ['yes', 'no', 'unknown'];
const STALLS: StallType[] = ['single-user', 'multi-stall', 'unknown'];
const DATASETS: DatasetKind[] = ['fictional-demo', 'device-sandbox', 'server-sandbox'];
const BANNED = new Set(['diagnosis', 'condition', 'medical', 'health', 'symptoms', 'disease', 'illness']);

const ID_RE = /^[a-z0-9-]{3,80}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasBannedKey(value: unknown, depth = 0): boolean {
  if (depth > 4 || !isPlainObject(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED.has(key.toLowerCase())) return true;
    if (hasBannedKey(child, depth + 1)) return true;
  }
  return false;
}

function unknownKeys(value: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  return trimmed;
}

function score(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

export function validateRatingInput(body: unknown): Result<RatingInput> {
  if (hasBannedKey(body)) return { ok: false, errors: ['This app does not collect health information.'] };
  if (!isPlainObject(body)) return { ok: false, errors: ['Rating must be an object.'] };
  const extra = unknownKeys(body, ['restroomId', 'cleanliness', 'easeOfAccess', 'overall']);
  if (extra.length > 0) return { ok: false, errors: [`Unexpected field: ${extra.join(', ')}.`] };
  const restroomId = asTrimmed(body.restroomId, 80);
  const cleanliness = score(body.cleanliness);
  const easeOfAccess = score(body.easeOfAccess);
  const overall = score(body.overall);
  const errors: string[] = [];
  if (!restroomId || !ID_RE.test(restroomId)) errors.push('Choose a restroom.');
  if (cleanliness == null) errors.push('Cleanliness must be a whole number from 1 to 5.');
  if (easeOfAccess == null) errors.push('Ease of access must be a whole number from 1 to 5.');
  if (overall == null) errors.push('Overall must be a whole number from 1 to 5.');
  if (errors.length || cleanliness == null || easeOfAccess == null || overall == null || !restroomId) {
    return { ok: false, errors };
  }
  return { ok: true, value: { restroomId, cleanliness, easeOfAccess, overall } };
}

type Suggestion = NonNullable<ReportInput['suggestion']>;

function validateSuggestion(value: unknown): Result<Suggestion> {
  if (!isPlainObject(value)) return { ok: false, errors: ['Suggestion must be an object.'] };
  const extra = unknownKeys(value, ['cityId', 'name', 'address', 'details']);
  if (extra.length > 0) return { ok: false, errors: [`Unexpected suggestion field: ${extra.join(', ')}.`] };
  const cityId = asTrimmed(value.cityId, 40);
  const name = asTrimmed(value.name, 120);
  const address = asTrimmed(value.address, 200);
  const details = asTrimmed(value.details, 500);
  const errors: string[] = [];
  if (!cityId || !PILOT_CITY_IDS.includes(cityId as (typeof PILOT_CITY_IDS)[number])) {
    errors.push('Choose a pilot city for the suggestion.');
  }
  if (!name || name.length < 2) errors.push('Suggestion needs a place name.');
  if (!address || address.length < 4) errors.push('Suggestion needs an address.');
  if (details == null) errors.push('Suggestion details are too long.');
  if (errors.length || !cityId || !name || !address || details == null) return { ok: false, errors };
  return { ok: true, value: { cityId, name, address, details: details ?? '' } };
}

export function validateReportInput(body: unknown): Result<ReportInput> {
  if (hasBannedKey(body)) return { ok: false, errors: ['This app does not collect health information.'] };
  if (!isPlainObject(body)) return { ok: false, errors: ['Report must be an object.'] };
  const extra = unknownKeys(body, ['restroomId', 'kind', 'note', 'suggestion']);
  if (extra.length > 0) return { ok: false, errors: [`Unexpected field: ${extra.join(', ')}.`] };
  if (typeof body.kind !== 'string' || !REPORT_KINDS.includes(body.kind as ReportKind)) {
    return { ok: false, errors: ['Choose a report type.'] };
  }
  const kind = body.kind as ReportKind;
  const note = asTrimmed(body.note, 500);
  if (note == null) return { ok: false, errors: ['Note must be 500 characters or less.'] };
  if (note.length < 3) return { ok: false, errors: ['Add a short note (at least 3 characters).'] };

  if (kind === 'missing-restroom') {
    const suggestion = validateSuggestion(body.suggestion);
    if (!suggestion.ok) return { ok: false, errors: suggestion.errors };
    if (body.restroomId != null) return { ok: false, errors: ['A missing-restroom report has no restroom id.'] };
    return { ok: true, value: { restroomId: null, kind, note, suggestion: suggestion.value } };
  }

  const restroomId = asTrimmed(body.restroomId, 80);
  if (!restroomId || !ID_RE.test(restroomId)) return { ok: false, errors: ['Choose a restroom.'] };
  let suggestion: ReportInput['suggestion'];
  if (body.suggestion != null) {
    const parsed = validateSuggestion(body.suggestion);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    suggestion = parsed.value;
  }
  return { ok: true, value: { restroomId, kind, note, suggestion } };
}

function validateHours(value: unknown): Result<HoursWindow[] | null> {
  if (value == null) return { ok: true, value: null };
  if (!Array.isArray(value)) return { ok: false, errors: ['Hours must be a list, empty, or unknown.'] };
  if (value.length > 14) return { ok: false, errors: ['Too many hour windows.'] };
  const windows: HoursWindow[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return { ok: false, errors: ['Each hours window must be an object.'] };
    if (!Array.isArray(item.days) || item.days.length === 0) {
      return { ok: false, errors: ['Each hours window needs at least one day.'] };
    }
    const days: number[] = [];
    for (const day of item.days) {
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6 || days.includes(day)) {
        return { ok: false, errors: ['Hours days must be unique numbers from 0 (Sunday) to 6 (Saturday).'] };
      }
      days.push(day);
    }
    const open = asTrimmed(item.open, 5);
    const close = asTrimmed(item.close, 5);
    if (!open || !close || parseClock(open) == null || parseClock(close) == null) {
      return { ok: false, errors: ['Hours must use HH:mm, or 24:00 for the end of the day.'] };
    }
    const start = parseClock(open)!;
    const end = parseClock(close)!;
    if (start === 1440 || start === end) return { ok: false, errors: ['Hours open and close are not a real window.'] };
    windows.push({ days, open, close });
  }
  return { ok: true, value: windows };
}

function tri(value: unknown, label: string, errors: string[]): Tri | null {
  if (typeof value === 'string' && TRI.includes(value as Tri)) return value as Tri;
  errors.push(`${label} must be yes, no, or unknown.`);
  return null;
}

function delay(value: unknown, label: string, errors: string[]): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 180) {
    errors.push(`${label} must be empty or a number of minutes from 0 to 180.`);
    return null;
  }
  return value;
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function validateRestroom(body: unknown): Result<Restroom> {
  if (hasBannedKey(body)) return { ok: false, errors: ['This app does not collect health information.'] };
  if (!isPlainObject(body)) return { ok: false, errors: ['Restroom must be an object.'] };
  const errors: string[] = [];
  const id = asTrimmed(body.id, 80);
  const cityId = asTrimmed(body.cityId, 40);
  const name = asTrimmed(body.name, 120);
  const address = asTrimmed(body.address, 200);
  if (!id || !ID_RE.test(id)) errors.push('Id must be 3–80 lowercase letters, numbers, or hyphens.');
  if (!cityId || !PILOT_CITY_IDS.includes(cityId as (typeof PILOT_CITY_IDS)[number])) {
    errors.push('Choose a pilot city.');
  }
  if (!name || name.length < 2) errors.push('Name is required.');
  if (!address || address.length < 4) errors.push('Address is required.');

  let location: Restroom['location'] | null = null;
  if (!isPlainObject(body.location)) errors.push('Location is required.');
  else {
    const lat = body.location.lat;
    const lng = body.location.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push('Latitude and longitude are out of range.');
    } else location = { lat, lng };
  }

  const access = typeof body.access === 'string' && ACCESS.includes(body.access as AccessType) ? (body.access as AccessType) : null;
  if (!access) errors.push('Access must be public, customer-only, purchase-required, or unknown.');
  const hours = validateHours(body.hours);
  if (!hours.ok) errors.push(...hours.errors);
  const timeZone = asTrimmed(body.timeZone, 80);
  if (!timeZone || !validTimeZone(timeZone)) errors.push('Time zone must be a real IANA zone, such as America/Chicago.');

  const wheelchair = tri(body.wheelchair, 'Wheelchair access', errors);
  const stallType =
    typeof body.stallType === 'string' && STALLS.includes(body.stallType as StallType)
      ? (body.stallType as StallType)
      : null;
  if (!stallType) errors.push('Stall type must be single-user, multi-stall, or unknown.');
  const changingTable = tri(body.changingTable, 'Changing table', errors);
  const familyRestroom = tri(body.familyRestroom, 'Family restroom', errors);
  const genderNeutral = tri(body.genderNeutral, 'Gender-neutral', errors);
  const parkingDelayMin = delay(body.parkingDelayMin, 'Parking delay', errors);
  const entranceDelayMin = delay(body.entranceDelayMin, 'Entrance delay', errors);
  const indoorWalkMin = delay(body.indoorWalkMin, 'Indoor walk', errors);

  const entranceSummary = body.entranceSummary == null ? null : asTrimmed(body.entranceSummary, 1000);
  const indoorSummary = body.indoorSummary == null ? null : asTrimmed(body.indoorSummary, 1000);
  if (body.entranceSummary != null && entranceSummary == null) errors.push('Entrance summary is too long.');
  if (body.indoorSummary != null && indoorSummary == null) errors.push('Indoor summary is too long.');

  const entrances: Restroom['entrances'] = [];
  if (!Array.isArray(body.entrances) || body.entrances.length > 8) errors.push('Add up to 8 entrances.');
  else {
    const slugs = new Set<string>();
    for (const item of body.entrances) {
      if (!isPlainObject(item)) {
        errors.push('Each entrance must be an object.');
        continue;
      }
      const entranceId = asTrimmed(item.id, 80);
      const entranceName = asTrimmed(item.name, 80);
      const slug = asTrimmed(item.slug, 80);
      const directions = asTrimmed(item.directions, 1000);
      if (!entranceId || !ID_RE.test(entranceId)) errors.push('Each entrance needs a valid id.');
      if (!entranceName) errors.push('Each entrance needs a name.');
      if (!slug || !ID_RE.test(slug)) errors.push('Each entrance slug must be lowercase letters, numbers, or hyphens.');
      if (!directions || directions.length < 3) errors.push('Each entrance needs written directions.');
      if (slug && slugs.has(slug)) errors.push(`Duplicate entrance slug ${slug}.`);
      if (slug) slugs.add(slug);
      if (entranceId && entranceName && slug && directions) {
        entrances.push({ id: entranceId, name: entranceName, slug, directions });
      }
    }
  }

  let sampleRating: Restroom['sampleRating'] = null;
  if (body.sampleRating != null) {
    if (!isPlainObject(body.sampleRating)) errors.push('Sample rating must be an object or empty.');
    else {
      const cleanliness = body.sampleRating.cleanliness;
      const ease = body.sampleRating.easeOfAccess;
      const overall = body.sampleRating.overall;
      const count = body.sampleRating.count;
      const numeric = (n: unknown) => typeof n === 'number' && n >= 1 && n <= 5;
      if (!numeric(cleanliness) || !numeric(ease) || !numeric(overall)) {
        errors.push('Sample rating figures must be from 1 to 5.');
      } else if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100_000) {
        errors.push('Sample rating count must be a whole number.');
      } else {
        sampleRating = {
          cleanliness: cleanliness as number,
          easeOfAccess: ease as number,
          overall: overall as number,
          count,
        };
      }
    }
  }

  const verifiedAt = body.verifiedAt == null ? null : asTrimmed(body.verifiedAt, 40);
  if (body.verifiedAt != null && (!verifiedAt || Number.isNaN(Date.parse(verifiedAt)))) {
    errors.push('Verification date must be a real date.');
  }
  const verificationSource = body.verificationSource == null ? null : asTrimmed(body.verificationSource, 200);
  if (body.verificationSource != null && verificationSource == null) errors.push('Verification source is too long.');

  const history: Restroom['verificationHistory'] = [];
  if (!Array.isArray(body.verificationHistory) || body.verificationHistory.length > 20) {
    errors.push('Verification history must be a short list.');
  } else {
    for (const item of body.verificationHistory) {
      if (!isPlainObject(item)) {
        errors.push('Each verification entry must be an object.');
        continue;
      }
      const at = asTrimmed(item.at, 40);
      const source = asTrimmed(item.source, 200);
      const note = asTrimmed(item.note, 500);
      if (!at || Number.isNaN(Date.parse(at)) || !source || note == null) {
        errors.push('Each verification entry needs a date, source, and note.');
      } else history.push({ at, source, note });
    }
  }

  if (typeof body.fictional !== 'boolean') errors.push('Fictional must be true or false.');
  if (typeof body.allowExternalNavigation !== 'boolean') errors.push('External navigation must be true or false.');
  const dataset =
    typeof body.dataset === 'string' && DATASETS.includes(body.dataset as DatasetKind)
      ? (body.dataset as DatasetKind)
      : null;
  if (!dataset) errors.push('Dataset is invalid.');
  const updatedAt = asTrimmed(body.updatedAt, 40);
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) errors.push('Updated time is invalid.');

  if (body.fictional === true && body.allowExternalNavigation === true) {
    errors.push('Turn off the fictional flag before allowing external navigation.');
  }

  if (
    errors.length ||
    !id ||
    !cityId ||
    !name ||
    !address ||
    !location ||
    !access ||
    !hours.ok ||
    !timeZone ||
    !wheelchair ||
    !stallType ||
    !changingTable ||
    !familyRestroom ||
    !genderNeutral ||
    !dataset ||
    !updatedAt ||
    typeof body.fictional !== 'boolean' ||
    typeof body.allowExternalNavigation !== 'boolean'
  ) {
    return { ok: false, errors };
  }

  const value: Restroom = {
    id,
    cityId,
    name,
    address,
    location,
    access,
    hours: hours.value,
    timeZone,
    wheelchair,
    stallType,
    changingTable,
    familyRestroom,
    genderNeutral,
    parkingDelayMin,
    entranceDelayMin,
    indoorWalkMin,
    entranceSummary,
    indoorSummary,
    entrances,
    sampleRating,
    verifiedAt,
    verificationSource,
    verificationHistory: history,
    dataset,
    fictional: body.fictional,
    allowExternalNavigation: body.allowExternalNavigation,
    updatedAt,
  };
  return { ok: true, value };
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Used by the UI to build a report before validation. */
export function reportFromInput(
  input: ReportInput,
  source: Report['source'],
  sample: boolean,
): Report {
  return {
    id: newId('report'),
    restroomId: input.restroomId,
    kind: input.kind,
    note: input.note,
    suggestion: input.suggestion,
    status: 'pending',
    createdAt: new Date().toISOString(),
    source,
    sample,
  };
}
