export type Tri = 'yes' | 'no' | 'unknown';
export type AccessType = 'public' | 'customer-only' | 'purchase-required' | 'unknown';
export type StallType = 'single-user' | 'multi-stall' | 'unknown';
export type PreferenceLevel = 'off' | 'preferred' | 'required';
export type DatasetKind = 'fictional-demo' | 'device-sandbox' | 'server-sandbox';
export type RankMode = 'fastest' | 'highest-rated';

export type ReportKind =
  | 'locked-door'
  | 'closure'
  | 'wrong-hours'
  | 'purchase-required'
  | 'wrong-accessibility'
  | 'correction'
  | 'missing-restroom';

export type ReportStatus = 'pending' | 'approved' | 'rejected';
export type ReportSource = 'sample-seed' | 'device' | 'server';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Local wall-clock window. `close` may be `24:00`. A close earlier than open runs past midnight. */
export interface HoursWindow {
  /** 0 = Sunday … 6 = Saturday in the restroom's time zone. */
  days: number[];
  open: string;
  close: string;
}

export interface EntrancePoint {
  id: string;
  name: string;
  slug: string;
  directions: string;
}

export interface SampleRating {
  cleanliness: number;
  easeOfAccess: number;
  overall: number;
  count: number;
}

export interface VerificationEntry {
  at: string;
  source: string;
  note: string;
}

export interface Restroom {
  id: string;
  cityId: string;
  name: string;
  address: string;
  location: LatLng;
  access: AccessType;
  /** `null` = hours unknown. Empty array = known to have no open hours. */
  hours: HoursWindow[] | null;
  timeZone: string;
  wheelchair: Tri;
  stallType: StallType;
  changingTable: Tri;
  familyRestroom: Tri;
  genderNeutral: Tri;
  /** Author-entered minute estimates. `null` means unknown, never a guessed zero. */
  parkingDelayMin: number | null;
  entranceDelayMin: number | null;
  indoorWalkMin: number | null;
  entranceSummary: string | null;
  indoorSummary: string | null;
  entrances: EntrancePoint[];
  sampleRating: SampleRating | null;
  verifiedAt: string | null;
  verificationSource: string | null;
  verificationHistory: VerificationEntry[];
  dataset: DatasetKind;
  fictional: boolean;
  allowExternalNavigation: boolean;
  updatedAt: string;
}

export interface ReportSuggestion {
  cityId: string;
  name: string;
  address: string;
  details: string;
}

export interface Report {
  id: string;
  restroomId: string | null;
  kind: ReportKind;
  note: string;
  suggestion?: ReportSuggestion;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string;
  source: ReportSource;
  sample: boolean;
}

export interface Rating {
  id: string;
  restroomId: string;
  cleanliness: number;
  easeOfAccess: number;
  overall: number;
  createdAt: string;
  source: 'device' | 'server';
}

export interface AccessibilityPreferences {
  wheelchair: PreferenceLevel;
  singleUser: PreferenceLevel;
  changingTable: PreferenceLevel;
  genderNeutral: PreferenceLevel;
}

export const PREFERENCES_OFF: AccessibilityPreferences = {
  wheelchair: 'off',
  singleUser: 'off',
  changingTable: 'off',
  genderNeutral: 'off',
};

export interface ReportStatusOverride {
  status: ReportStatus;
  reviewedAt: string;
}

/** Device or server sandbox. Packaged seed data is never stored in here. */
export interface SandboxState {
  version: 1;
  customRestrooms: Restroom[];
  overrides: Record<string, Restroom>;
  userReports: Report[];
  statusOverrides: Record<string, ReportStatusOverride>;
  ratings: Rating[];
}

export function emptySandbox(): SandboxState {
  return {
    version: 1,
    customRestrooms: [],
    overrides: {},
    userReports: [],
    statusOverrides: {},
    ratings: [],
  };
}

export type TesterPlan = 'free' | 'paid-simulated';
