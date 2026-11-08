import type { Rating, Report, Restroom } from '../domain/types';
import { PersistenceError, type RestroomDataProvider } from './types';

interface ErrorBody {
  error?: string;
}

async function readBody(response: Response): Promise<ErrorBody & Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as ErrorBody & Record<string, unknown>;
}

export function createApiProvider(apiBase: string): RestroomDataProvider {
  async function send(path: string, init: RequestInit | undefined, fallback: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new PersistenceError(fallback);
    }
    const payload = await readBody(response);
    if (!response.ok) {
      throw new PersistenceError(typeof payload.error === 'string' ? payload.error : fallback);
    }
    return payload;
  }

  return {
    mode: 'server',
    label: 'Server sandbox',
    async listRestrooms() {
      const payload = await send('/api/restrooms', undefined, 'Could not load restrooms from the server.');
      return (payload.restrooms as Restroom[]) ?? [];
    },
    async listReports() {
      const payload = await send('/api/reports', undefined, 'Could not load reports from the server.');
      return (payload.reports as Report[]) ?? [];
    },
    async listRatings() {
      const payload = await send('/api/ratings', undefined, 'Could not load ratings from the server.');
      return (payload.ratings as Rating[]) ?? [];
    },
    async submitReport(body, options) {
      if (!options.online) throw new PersistenceError('You are offline. This was not submitted.');
      const payload = await send(
        '/api/reports',
        { method: 'POST', body: JSON.stringify(body) },
        'The server could not be reached. This was not submitted.',
      );
      return {
        record: payload.report as Report,
        message:
          typeof payload.message === 'string'
            ? payload.message
            : 'Submitted for review. It will not change verified information unless an admin approves it.',
      };
    },
    async submitRating(body, options) {
      if (!options.online) throw new PersistenceError('You are offline. This was not submitted.');
      const payload = await send(
        '/api/ratings',
        { method: 'POST', body: JSON.stringify(body) },
        'The server could not be reached. This was not submitted.',
      );
      return {
        record: payload.rating as Rating,
        message: typeof payload.message === 'string' ? payload.message : 'Saved on the server sandbox.',
      };
    },
    async moderate(id, status) {
      const payload = await send(
        `/api/admin/reports/${encodeURIComponent(id)}/moderate`,
        { method: 'POST', body: JSON.stringify({ status }) },
        'Moderation was not saved.',
      );
      return payload.report as Report;
    },
    async saveRestroom(body) {
      const payload = await send(
        '/api/admin/restrooms',
        { method: 'POST', body: JSON.stringify(body) },
        'The restroom was not saved.',
      );
      return payload.restroom as Restroom;
    },
    async reset() {
      await send('/api/admin/reset', { method: 'POST' }, 'The server sandbox was not reset.');
    },
  };
}
