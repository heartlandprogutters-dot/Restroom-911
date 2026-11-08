import { getSampleReports, SAMPLE_REPORT_IDS, SEED_IDS, SEED_RESTROOMS } from '../data/seed';
import { addRating, addReport, collectSlugs, mergeRatings, mergeReports, mergeRestrooms, setReportStatus, upsertRestroom } from '../domain/sandbox';
import { emptySandbox, type Rating, type SandboxState } from '../domain/types';
import { newId, reportFromInput, validateRatingInput, validateReportInput, validateRestroom } from '../domain/validate';
import type { KeyValueStore } from '../storage/types';
import { PersistenceError, type RestroomDataProvider, type SubmitResult } from './types';

const SANDBOX_KEY = 'sandbox';

function deviceMessage(online: boolean): string {
  return online
    ? 'Saved on this device. Not sent to a server.'
    : 'Saved on this device while offline. Not sent to a server.';
}

export function createDemoProvider(store: KeyValueStore, options?: { isAdmin?: () => boolean }): RestroomDataProvider {
  const isAdmin = options?.isAdmin ?? (() => false);
  const recent: number[] = [];

  async function load(): Promise<SandboxState> {
    const raw = await store.get(SANDBOX_KEY);
    if (!raw || typeof raw !== 'object') return emptySandbox();
    const state = raw as SandboxState;
    if (state.version !== 1 || !Array.isArray(state.userReports) || !Array.isArray(state.ratings)) {
      return emptySandbox();
    }
    return state;
  }

  async function save(state: SandboxState): Promise<void> {
    try {
      await store.set(SANDBOX_KEY, state);
    } catch {
      throw new PersistenceError('This was not saved on this device.');
    }
  }

  function assertAdmin(): void {
    if (!isAdmin()) {
      throw new PersistenceError(
        'Demo admin is locked on this device. This browser sandbox is not server authentication.',
      );
    }
  }

  function limited(): boolean {
    const now = Date.now();
    const recentHits = recent.filter((stamp) => now - stamp < 60_000);
    recent.splice(0, recent.length, ...recentHits);
    if (recent.length >= 8) return true;
    recent.push(now);
    return false;
  }

  return {
    mode: 'demo',
    label: 'Demo data on this device',
    async listRestrooms() {
      return mergeRestrooms(SEED_RESTROOMS, await load());
    },
    async listReports() {
      return mergeReports(getSampleReports(), await load());
    },
    async listRatings() {
      return mergeRatings(await load());
    },
    async submitReport(body, options) {
      const parsed = validateReportInput(body);
      if (!parsed.ok) throw new PersistenceError(parsed.errors.join(' '));
      if (limited()) {
        throw new PersistenceError('Please wait before sending another report. This one was not saved.');
      }
      const state = await load();
      if (parsed.value.restroomId) {
        const known = mergeRestrooms(SEED_RESTROOMS, state).some((item) => item.id === parsed.value.restroomId);
        if (!known) throw new PersistenceError('That restroom was not found. This report was not saved.');
      }
      const report = reportFromInput(parsed.value, 'device', false);
      await save(addReport(state, report));
      return { record: report, message: deviceMessage(options.online) };
    },
    async submitRating(body, options) {
      const parsed = validateRatingInput(body);
      if (!parsed.ok) throw new PersistenceError(parsed.errors.join(' '));
      if (limited()) {
        throw new PersistenceError('Please wait before sending another rating. This one was not saved.');
      }
      const state = await load();
      const known = mergeRestrooms(SEED_RESTROOMS, state).some((item) => item.id === parsed.value.restroomId);
      if (!known) throw new PersistenceError('That restroom was not found. This rating was not saved.');
      const rating: Rating = {
        id: newId('rating'),
        ...parsed.value,
        createdAt: new Date().toISOString(),
        source: 'device',
      };
      await save(addRating(state, rating));
      return { record: rating, message: deviceMessage(options.online) } satisfies SubmitResult<Rating>;
    },
    async moderate(id, status) {
      assertAdmin();
      const state = await load();
      const reports = mergeReports(getSampleReports(), state);
      if (!reports.some((report) => report.id === id)) {
        throw new PersistenceError('Report was not found.');
      }
      const next = setReportStatus(state, id, status, SAMPLE_REPORT_IDS, new Date().toISOString());
      await save(next);
      const updated = mergeReports(getSampleReports(), next).find((report) => report.id === id);
      if (!updated) throw new PersistenceError('Report was not found.');
      return updated;
    },
    async saveRestroom(body) {
      assertAdmin();
      const parsed = validateRestroom(body);
      if (!parsed.ok) throw new PersistenceError(parsed.errors.join(' '));
      const state = await load();
      const current = mergeRestrooms(SEED_RESTROOMS, state);
      const slugs = collectSlugs(current, parsed.value.id);
      for (const entrance of parsed.value.entrances) {
        if (slugs.has(entrance.slug)) {
          throw new PersistenceError(`QR slug “${entrance.slug}” is already used. Nothing was saved.`);
        }
      }
      const record = parsed.value.fictional ? { ...parsed.value, allowExternalNavigation: false } : parsed.value;
      await save(upsertRestroom(state, record, SEED_IDS));
      return record;
    },
    async reset() {
      assertAdmin();
      await store.delete(SANDBOX_KEY);
    },
  };
}
