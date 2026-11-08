import type { Rating, Report, ReportStatus, Restroom, SandboxState } from './types';

export function mergeRestrooms(seed: Restroom[], state: SandboxState): Restroom[] {
  const merged = seed.map((restroom) => {
    const override = state.overrides[restroom.id];
    if (!override) return structuredClone(restroom);
    return { ...structuredClone(override), id: restroom.id };
  });
  return [...merged, ...state.customRestrooms.map((restroom) => structuredClone(restroom))];
}

export function mergeReports(seedReports: Report[], state: SandboxState): Report[] {
  const seeded = seedReports.map((report) => {
    const override = state.statusOverrides[report.id];
    if (!override) return structuredClone(report);
    return { ...structuredClone(report), status: override.status, reviewedAt: override.reviewedAt };
  });
  return [...seeded, ...state.userReports.map((report) => structuredClone(report))];
}

export function mergeRatings(state: SandboxState): Rating[] {
  return state.ratings.map((rating) => structuredClone(rating));
}

export function upsertRestroom(state: SandboxState, restroom: Restroom, seedIds: Set<string>): SandboxState {
  const next = structuredClone(state);
  if (seedIds.has(restroom.id)) {
    next.overrides[restroom.id] = restroom;
    return next;
  }
  const index = next.customRestrooms.findIndex((item) => item.id === restroom.id);
  if (index >= 0) next.customRestrooms[index] = restroom;
  else next.customRestrooms.push(restroom);
  return next;
}

export function addReport(state: SandboxState, report: Report): SandboxState {
  const next = structuredClone(state);
  next.userReports.unshift(report);
  return next;
}

export function addRating(state: SandboxState, rating: Rating): SandboxState {
  const next = structuredClone(state);
  next.ratings.unshift(rating);
  return next;
}

export function setReportStatus(
  state: SandboxState,
  id: string,
  status: Extract<ReportStatus, 'approved' | 'rejected'>,
  seedReportIds: Set<string>,
  reviewedAt: string,
): SandboxState {
  const next = structuredClone(state);
  if (seedReportIds.has(id)) {
    next.statusOverrides[id] = { status, reviewedAt };
    return next;
  }
  const index = next.userReports.findIndex((report) => report.id === id);
  if (index < 0) return next;
  next.userReports[index] = { ...next.userReports[index], status, reviewedAt };
  return next;
}

export function collectSlugs(restrooms: Restroom[], exceptId?: string): Set<string> {
  const slugs = new Set<string>();
  for (const restroom of restrooms) {
    if (restroom.id === exceptId) continue;
    for (const entrance of restroom.entrances) slugs.add(entrance.slug);
  }
  return slugs;
}
