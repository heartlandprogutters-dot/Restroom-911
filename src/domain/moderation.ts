import type { Report, Restroom } from './types';

export interface FactOverlay {
  unusable: boolean;
  unusableReason: 'locked-door' | 'closure' | null;
  hoursDisputed: boolean;
  purchaseDisputed: boolean;
  accessibilityDisputed: boolean;
  correctionSuggested: boolean;
}

const LOCK_KINDS = new Set<Report['kind']>(['locked-door', 'closure']);

function isApprovedAndCurrent(report: Report, now: Date): boolean {
  if (report.status !== 'approved') return false;
  const created = Date.parse(report.createdAt);
  return Number.isFinite(created) && created <= now.getTime();
}

/** Approved reports never rewrite restroom fields. They only describe a separate overlay. */
export function factOverlay(restroom: Restroom, reports: Report[], now: Date): FactOverlay {
  const verifiedMs = restroom.verifiedAt ? Date.parse(restroom.verifiedAt) : Number.NaN;
  const active = reports.filter((report) => {
    if (report.restroomId !== restroom.id) return false;
    if (!isApprovedAndCurrent(report, now)) return false;
    const created = Date.parse(report.createdAt);
    if (Number.isFinite(verifiedMs) && created <= verifiedMs) return false;
    return true;
  });
  const unusable = active.find((report) => LOCK_KINDS.has(report.kind));
  return {
    unusable: Boolean(unusable),
    unusableReason: unusable?.kind === 'closure' ? 'closure' : unusable ? 'locked-door' : null,
    hoursDisputed: active.some((report) => report.kind === 'wrong-hours'),
    purchaseDisputed: active.some((report) => report.kind === 'purchase-required'),
    accessibilityDisputed: active.some((report) => report.kind === 'wrong-accessibility'),
    correctionSuggested: active.some((report) => report.kind === 'correction'),
  };
}

export function overlayWarnings(overlay: FactOverlay): string[] {
  const warnings: string[] = [];
  if (overlay.unusable) {
    warnings.push(
      'An approved report says this restroom was locked or closed. The listed hours were not overwritten.',
    );
  }
  if (overlay.hoursDisputed) {
    warnings.push('An approved report says the hours may be wrong. The listed hours were not overwritten.');
  }
  if (overlay.purchaseDisputed) {
    warnings.push(
      'An approved report says a purchase may be required. The listed access was not overwritten.',
    );
  }
  if (overlay.accessibilityDisputed) {
    warnings.push(
      'An approved report says accessibility details may be wrong. The listed accessibility was not overwritten.',
    );
  }
  if (overlay.correctionSuggested) {
    warnings.push(
      'An approved correction is waiting for an admin to edit the record. Listed facts were not overwritten.',
    );
  }
  return warnings;
}
