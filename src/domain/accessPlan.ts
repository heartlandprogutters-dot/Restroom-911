import type { TesterPlan } from './types';

/** Location search is the simulated paid plan. QR guidance stays free. */
export function canUseLocationSearch(plan: TesterPlan): boolean {
  return plan === 'paid-simulated';
}

export function canUseQrGuidance(_plan: TesterPlan): boolean {
  return true;
}
