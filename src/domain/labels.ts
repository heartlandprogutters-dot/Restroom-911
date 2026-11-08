import type { AccessType, ReportKind, StallType, Tri } from './types';

export const ACCESS_LABEL: Record<AccessType, string> = {
  public: 'Public access',
  'customer-only': 'Customer-only',
  'purchase-required': 'Purchase required',
  unknown: 'Unknown',
};

export const TRI_LABEL: Record<Tri, string> = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Unknown',
};

export const STALL_LABEL: Record<StallType, string> = {
  'single-user': 'Single-user',
  'multi-stall': 'Multi-stall',
  unknown: 'Unknown',
};

export const REPORT_LABEL: Record<ReportKind, string> = {
  'locked-door': 'Locked door',
  closure: 'Closed or unavailable',
  'wrong-hours': 'Hours look wrong',
  'purchase-required': 'Purchase required',
  'wrong-accessibility': 'Accessibility info is wrong',
  correction: 'Suggest a correction',
  'missing-restroom': 'Missing restroom',
};

export function datasetLabel(dataset: string, fictional: boolean): string {
  if (fictional) return 'Fictional demo';
  if (dataset === 'server-sandbox') return 'Server sandbox entry';
  if (dataset === 'device-sandbox') return 'Saved on this device';
  return 'Sandbox entry';
}
