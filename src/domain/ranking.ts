import { approximateDistancePhrase, haversineMeters } from './geo';
import { getOpenStatus, type OpenStatus } from './hours';
import { factOverlay, type FactOverlay } from './moderation';
import type {
  AccessibilityPreferences,
  AccessType,
  LatLng,
  RankMode,
  Rating,
  Report,
  Restroom,
} from './types';

/**
 * Fastest-suitable score. Lower is better.
 *
 * Travel minutes are added only when a routing provider supplied them.
 * Straight-line distance contributes `meters / 80` rank points and is never
 * shown as a travel time. Known parking, entrance, and indoor minutes are
 * rank points from authored estimates, not a measured route.
 */
export const RANKING_WEIGHTS = {
  straightLineMetersPerPoint: 80,
  customerOnlyPenalty: 20,
  purchaseRequiredPenalty: 35,
  accessUnknownPenalty: 16,
  hoursUnknownPenalty: 24,
  unverifiedPenalty: 18,
  staleVerificationPenalty: 10,
  freshVerificationBonus: 6,
  freshDays: 45,
  staleDays: 180,
  preferredFeatureBonus: 4,
  disputedFactPenalty: 14,
  searchRadiusMeters: 15 * 1609.344,
} as const;

export interface TravelFact {
  distanceMeters: number;
  /** Set only by a routing provider. Straight-line results keep this null. */
  travelTimeMinutes: number | null;
  method: 'straight-line' | 'routed';
}

export interface PeerRating {
  overall: number | null;
  sampleOverall: number | null;
  sampleCount: number;
  deviceCount: number;
}

export interface RankedRestroom {
  restroom: Restroom;
  travel: TravelFact;
  open: OpenStatus;
  score: number;
  explanation: string;
  delayNote: string | null;
  peer: PeerRating;
  overlay: FactOverlay;
}

export interface ExcludedRestroom {
  restroom: Restroom;
  reasons: string[];
  open: OpenStatus;
}

export interface RankResult {
  suitable: RankedRestroom[];
  excluded: ExcludedRestroom[];
  best: RankedRestroom | null;
  alternatives: RankedRestroom[];
  emptyReason: string | null;
}

export interface RankInput {
  restrooms: Restroom[];
  origin: LatLng;
  now: Date;
  preferences: AccessibilityPreferences;
  mode: RankMode;
  reports?: Report[];
  ratings?: Rating[];
  travel?: Record<string, TravelFact>;
  maxDistanceMeters?: number | null;
}

export function peerRating(restroom: Restroom, ratings: Rating[]): PeerRating {
  const mine = ratings.filter((rating) => rating.restroomId === restroom.id);
  const sample = restroom.sampleRating;
  const sampleCount = sample?.count ?? 0;
  const deviceCount = mine.length;
  let overall: number | null = null;
  if (sample && deviceCount > 0) {
    const deviceSum = mine.reduce((sum, rating) => sum + rating.overall, 0);
    overall = (sample.overall * sample.count + deviceSum) / (sample.count + deviceCount);
  } else if (sample) {
    overall = sample.overall;
  } else if (deviceCount > 0) {
    overall = mine.reduce((sum, rating) => sum + rating.overall, 0) / deviceCount;
  }
  return {
    overall,
    sampleOverall: sample?.overall ?? null,
    sampleCount,
    deviceCount,
  };
}

function normalizeTravel(origin: LatLng, restroom: Restroom, given: TravelFact | undefined): TravelFact {
  const fallback = haversineMeters(origin, restroom.location);
  const distanceMeters =
    given && Number.isFinite(given.distanceMeters) ? given.distanceMeters : fallback;
  const routed = given?.method === 'routed';
  const minutes =
    routed && given && typeof given.travelTimeMinutes === 'number' && Number.isFinite(given.travelTimeMinutes)
      ? Math.max(0, given.travelTimeMinutes)
      : null;
  return {
    distanceMeters,
    travelTimeMinutes: minutes,
    method: routed ? 'routed' : 'straight-line',
  };
}

function hasRequired(preferences: AccessibilityPreferences): boolean {
  return (
    preferences.wheelchair === 'required' ||
    preferences.singleUser === 'required' ||
    preferences.changingTable === 'required' ||
    preferences.genderNeutral === 'required'
  );
}

function requiredLabels(preferences: AccessibilityPreferences): string {
  const labels: string[] = [];
  if (preferences.wheelchair === 'required') labels.push('wheelchair accessible');
  if (preferences.singleUser === 'required') labels.push('single-user or family restroom');
  if (preferences.changingTable === 'required') labels.push('changing table');
  if (preferences.genderNeutral === 'required') labels.push('gender-neutral restroom');
  return labels.join(', ');
}

function requiredMisses(
  restroom: Restroom,
  preferences: AccessibilityPreferences,
  overlay: FactOverlay,
): string[] {
  const reasons: string[] = [];
  if (preferences.wheelchair === 'required' && restroom.wheelchair !== 'yes') reasons.push('required-wheelchair');
  if (
    preferences.singleUser === 'required' &&
    !(restroom.stallType === 'single-user' || restroom.familyRestroom === 'yes')
  ) {
    reasons.push('required-single-user');
  }
  if (preferences.changingTable === 'required' && restroom.changingTable !== 'yes') {
    reasons.push('required-changing-table');
  }
  if (preferences.genderNeutral === 'required' && restroom.genderNeutral !== 'yes') {
    reasons.push('required-gender-neutral');
  }
  if (overlay.accessibilityDisputed && hasRequired(preferences)) reasons.push('accessibility-disputed');
  return reasons;
}

function accessPenalty(access: AccessType): number {
  switch (access) {
    case 'public':
      return 0;
    case 'customer-only':
      return RANKING_WEIGHTS.customerOnlyPenalty;
    case 'purchase-required':
      return RANKING_WEIGHTS.purchaseRequiredPenalty;
    default:
      return RANKING_WEIGHTS.accessUnknownPenalty;
  }
}

function freshnessPoints(restroom: Restroom, now: Date): number {
  if (!restroom.verifiedAt) return RANKING_WEIGHTS.unverifiedPenalty;
  const verified = Date.parse(restroom.verifiedAt);
  if (!Number.isFinite(verified)) return RANKING_WEIGHTS.unverifiedPenalty;
  const ageDays = (now.getTime() - verified) / 86_400_000;
  if (ageDays < 0) return RANKING_WEIGHTS.unverifiedPenalty;
  if (ageDays <= RANKING_WEIGHTS.freshDays) return -RANKING_WEIGHTS.freshVerificationBonus;
  if (ageDays > RANKING_WEIGHTS.staleDays) return RANKING_WEIGHTS.staleVerificationPenalty;
  return 0;
}

function preferredHits(restroom: Restroom, preferences: AccessibilityPreferences): number {
  let hits = 0;
  if (preferences.wheelchair === 'preferred' && restroom.wheelchair === 'yes') hits += 1;
  if (
    preferences.singleUser === 'preferred' &&
    (restroom.stallType === 'single-user' || restroom.familyRestroom === 'yes')
  ) {
    hits += 1;
  }
  if (preferences.changingTable === 'preferred' && restroom.changingTable === 'yes') hits += 1;
  if (preferences.genderNeutral === 'preferred' && restroom.genderNeutral === 'yes') hits += 1;
  return hits;
}

function knownDelayMinutes(restroom: Restroom): number {
  return (restroom.parkingDelayMin ?? 0) + (restroom.entranceDelayMin ?? 0) + (restroom.indoorWalkMin ?? 0);
}

function delayNote(restroom: Restroom): string | null {
  const parts: string[] = [];
  if (restroom.parkingDelayMin != null) parts.push(`${restroom.parkingDelayMin} min parking`);
  if (restroom.entranceDelayMin != null) parts.push(`${restroom.entranceDelayMin} min at the entrance`);
  if (restroom.indoorWalkMin != null) parts.push(`${restroom.indoorWalkMin} min indoors`);
  if (parts.length === 0) return null;
  return `Sample estimate, not a measured route: ${parts.join(', ')}.`;
}

function accessPhrase(access: AccessType): string {
  switch (access) {
    case 'public':
      return 'public access';
    case 'customer-only':
      return 'customer-only access';
    case 'purchase-required':
      return 'purchase required';
    default:
      return 'access unknown';
  }
}

function reviewPhrase(restroom: Restroom, now: Date): string {
  const verified = restroom.verifiedAt ? Date.parse(restroom.verifiedAt) : Number.NaN;
  if (!Number.isFinite(verified)) return restroom.fictional ? 'not yet reviewed' : 'not yet verified';
  const ageDays = (now.getTime() - verified) / 86_400_000;
  if (ageDays < 0) return restroom.fictional ? 'not yet reviewed' : 'not yet verified';
  if (ageDays > RANKING_WEIGHTS.freshDays) {
    return restroom.fictional ? 'older sample review' : 'verification is older';
  }
  return restroom.fictional ? 'recently reviewed (sample)' : 'recently verified';
}

export function explainRecommendation(
  restroom: Restroom,
  travel: TravelFact,
  open: OpenStatus,
  now: Date,
): string {
  const bits: string[] = [];
  if (travel.method === 'routed' && travel.travelTimeMinutes != null) {
    const minutes = Math.max(1, Math.round(travel.travelTimeMinutes));
    bits.push(`About ${minutes} minute${minutes === 1 ? '' : 's'} away`);
  } else {
    bits.push(approximateDistancePhrase(travel.distanceMeters));
  }
  bits.push(accessPhrase(restroom.access));
  if (open.state === 'unknown') bits.push('hours unknown');
  bits.push(reviewPhrase(restroom, now));
  return `${bits.join(', ')}.`;
}

function emptyReason(excluded: ExcludedRestroom[], preferences: AccessibilityPreferences): string {
  if (excluded.length === 0) return 'No sample restrooms are loaded for this search.';
  if (excluded.every((item) => item.reasons.includes('too-far'))) {
    return 'No sample restrooms within 15 miles of this spot.';
  }
  const sentences = ['No suitable restroom matched.'];
  const requiredHit = excluded.some((item) =>
    item.reasons.some((reason) => reason.startsWith('required-') || reason === 'accessibility-disputed'),
  );
  if (requiredHit) {
    const labels = requiredLabels(preferences);
    sentences.push(
      `Required accessibility (${labels}) was not relaxed, and unknown was not treated as a match. Nothing that fails a required preference was substituted.`,
    );
  }
  if (excluded.some((item) => item.reasons.includes('closed'))) {
    sentences.push('Places listed as closed were left out.');
  }
  if (excluded.some((item) => item.reasons.includes('reported-unusable'))) {
    sentences.push('Places with an approved lock or closure report were left out.');
  }
  return sentences.join(' ');
}

function compareFastest(a: RankedRestroom, b: RankedRestroom): number {
  if (a.score !== b.score) return a.score - b.score;
  const ao = a.peer.overall;
  const bo = b.peer.overall;
  if (ao == null && bo != null) return 1;
  if (bo == null && ao != null) return -1;
  if (ao != null && bo != null && ao !== bo) return bo - ao;
  return a.restroom.id.localeCompare(b.restroom.id);
}

function compareRated(a: RankedRestroom, b: RankedRestroom): number {
  const ao = a.peer.overall;
  const bo = b.peer.overall;
  if (ao == null && bo != null) return 1;
  if (bo == null && ao != null) return -1;
  if (ao != null && bo != null && ao !== bo) return bo - ao;
  const aCount = a.peer.sampleCount + a.peer.deviceCount;
  const bCount = b.peer.sampleCount + b.peer.deviceCount;
  if (aCount !== bCount) return bCount - aCount;
  if (a.score !== b.score) return a.score - b.score;
  return a.restroom.id.localeCompare(b.restroom.id);
}

export function rankRestrooms(input: RankInput): RankResult {
  const reports = input.reports ?? [];
  const ratings = input.ratings ?? [];
  const suitable: RankedRestroom[] = [];
  const excluded: ExcludedRestroom[] = [];

  for (const restroom of input.restrooms) {
    const travel = normalizeTravel(input.origin, restroom, input.travel?.[restroom.id]);
    const open = getOpenStatus(restroom.hours, restroom.timeZone, input.now);
    const overlay = factOverlay(restroom, reports, input.now);
    if (input.maxDistanceMeters != null && travel.distanceMeters > input.maxDistanceMeters) {
      excluded.push({ restroom, reasons: ['too-far'], open });
      continue;
    }
    const reasons = requiredMisses(restroom, input.preferences, overlay);
    if (open.state === 'closed') reasons.push('closed');
    if (overlay.unusable) reasons.push('reported-unusable');
    if (reasons.length > 0) {
      excluded.push({ restroom, reasons, open });
      continue;
    }

    let score = 0;
    if (travel.method === 'routed' && travel.travelTimeMinutes != null) score += travel.travelTimeMinutes;
    else score += travel.distanceMeters / RANKING_WEIGHTS.straightLineMetersPerPoint;
    score += knownDelayMinutes(restroom);
    score += accessPenalty(restroom.access);
    if (open.state === 'unknown') score += RANKING_WEIGHTS.hoursUnknownPenalty;
    score += freshnessPoints(restroom, input.now);
    score -= preferredHits(restroom, input.preferences) * RANKING_WEIGHTS.preferredFeatureBonus;
    if (
      overlay.hoursDisputed ||
      overlay.purchaseDisputed ||
      (overlay.accessibilityDisputed && !hasRequired(input.preferences))
    ) {
      score += RANKING_WEIGHTS.disputedFactPenalty;
    }

    suitable.push({
      restroom,
      travel,
      open,
      score,
      explanation: explainRecommendation(restroom, travel, open, input.now),
      delayNote: delayNote(restroom),
      peer: peerRating(restroom, ratings),
      overlay,
    });
  }

  suitable.sort(input.mode === 'highest-rated' ? compareRated : compareFastest);
  const best = suitable[0] ?? null;
  return {
    suitable,
    excluded,
    best,
    alternatives: suitable.slice(1, 3),
    emptyReason: best ? null : emptyReason(excluded, input.preferences),
  };
}

export function exclusionLabel(code: string): string {
  switch (code) {
    case 'required-wheelchair':
      return 'Does not confirm wheelchair access, which is required.';
    case 'required-single-user':
      return 'Does not confirm a single-user or family restroom, which is required.';
    case 'required-changing-table':
      return 'Does not confirm a changing table, which is required.';
    case 'required-gender-neutral':
      return 'Does not confirm a gender-neutral restroom, which is required.';
    case 'accessibility-disputed':
      return 'An approved report disputes accessibility, so a required feature is not treated as confirmed.';
    case 'closed':
      return 'Listed hours say it is closed now.';
    case 'reported-unusable':
      return 'An approved report says it is locked or closed.';
    case 'too-far':
      return 'Farther than 15 miles.';
    default:
      return code;
  }
}
