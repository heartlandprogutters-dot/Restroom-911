import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { getSampleReports, SAMPLE_REPORT_IDS, SEED_IDS, SEED_PACKAGED_ON, SEED_RESTROOMS } from '../src/data/seed';
import {
  addRating,
  addReport,
  collectSlugs,
  mergeRatings,
  mergeReports,
  mergeRestrooms,
  setReportStatus,
  upsertRestroom,
} from '../src/domain/sandbox';
import { emptySandbox, type Rating, type SandboxState } from '../src/domain/types';
import {
  newId,
  reportFromInput,
  validateRatingInput,
  validateReportInput,
  validateRestroom,
} from '../src/domain/validate';

export interface SandboxStore {
  load(): Promise<SandboxState>;
  save(state: SandboxState): Promise<void>;
}

export interface AppOptions {
  password: string | null;
  store: SandboxStore;
  now?: () => Date;
  reportLimit?: number;
  reportWindowMs?: number;
}

class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 413 | 429 | 503,
    message: string,
  ) {
    super(message);
  }
}

function passwordsMatch(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

function clientKey(header: (name: string) => string | undefined): string {
  return header('x-test-ip') ?? header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export function createApp(options: AppOptions) {
  const now = options.now ?? (() => new Date());
  const reportLimit = options.reportLimit ?? 8;
  const reportWindowMs = options.reportWindowMs ?? 10 * 60 * 1000;
  const sessions = new Map<string, number>();
  const hits = new Map<string, number[]>();

  function limited(bucket: string, limit: number, windowMs: number): boolean {
    const current = now().getTime();
    const prev = (hits.get(bucket) ?? []).filter((stamp) => current - stamp < windowMs);
    if (prev.length >= limit) {
      hits.set(bucket, prev);
      return true;
    }
    prev.push(current);
    hits.set(bucket, prev);
    return false;
  }

  function sessionToken(c: Context): string | null {
    const token = getCookie(c, 'rr911_admin');
    if (!token) return null;
    const expiry = sessions.get(token);
    if (!expiry || expiry < now().getTime()) {
      sessions.delete(token);
      return null;
    }
    return token;
  }

  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: 'Server error.' }, 500);
  });

  async function readJson(c: Context): Promise<unknown> {
    const text = await c.req.text();
    if (text.length > 20_000) throw new HttpError(413, 'Submission is too large. It was not saved.');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HttpError(400, 'Submission was not valid JSON. It was not saved.');
    }
  }

  function requireAdmin(c: Context): void {
    if (!options.password) throw new HttpError(503, 'Admin password is not configured on the server.');
    if (!sessionToken(c)) throw new HttpError(401, 'Admin sign-in required. Nothing was changed.');
  }

  app.get('/api/health', (c) =>
    c.json({ ok: true, mode: 'server-sandbox', adminConfigured: Boolean(options.password) }),
  );

  app.get('/api/admin/me', (c) => c.json({ authenticated: Boolean(sessionToken(c)) }));

  app.post('/api/admin/login', async (c) => {
    if (!options.password) throw new HttpError(503, 'Admin password is not configured on the server.');
    const ip = clientKey((name) => c.req.header(name));
    if (limited(`login:${ip}`, 8, reportWindowMs)) {
      throw new HttpError(429, 'Too many sign-in attempts. Wait and try again.');
    }
    const body = await readJson(c);
    const password = body && typeof body === 'object' && 'password' in body ? (body as { password?: unknown }).password : null;
    if (typeof password !== 'string' || !passwordsMatch(password, options.password)) {
      throw new HttpError(401, 'Incorrect password.');
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now().getTime() + 8 * 60 * 60 * 1000);
    setCookie(c, 'rr911_admin', token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: false,
      maxAge: 60 * 60 * 8,
    });
    return c.json({ ok: true });
  });

  app.post('/api/admin/logout', (c) => {
    const token = getCookie(c, 'rr911_admin');
    if (token) sessions.delete(token);
    deleteCookie(c, 'rr911_admin', { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/restrooms', async (c) => {
    const state = await options.store.load();
    return c.json({
      restrooms: mergeRestrooms(SEED_RESTROOMS, state),
      packagedOn: SEED_PACKAGED_ON,
      mode: 'server-sandbox',
    });
  });

  app.get('/api/reports', async (c) => {
    const state = await options.store.load();
    return c.json({ reports: mergeReports(getSampleReports(), state) });
  });

  app.get('/api/ratings', async (c) => {
    const state = await options.store.load();
    return c.json({ ratings: mergeRatings(state) });
  });

  app.post('/api/reports', async (c) => {
    const ip = clientKey((name) => c.req.header(name));
    if (limited(`report:${ip}`, reportLimit, reportWindowMs)) {
      throw new HttpError(429, 'Too many reports were sent from this network. This one was not saved.');
    }
    const parsed = validateReportInput(await readJson(c));
    if (!parsed.ok) throw new HttpError(400, `${parsed.errors.join(' ')} It was not saved.`);
    const state = await options.store.load();
    if (parsed.value.restroomId) {
      const known = mergeRestrooms(SEED_RESTROOMS, state).some((item) => item.id === parsed.value.restroomId);
      if (!known) throw new HttpError(404, 'That restroom was not found. This report was not saved.');
    }
    const report = reportFromInput(parsed.value, 'server', false);
    await options.store.save(addReport(state, report));
    return c.json({
      report,
      message: 'Submitted for review. It will not change verified information unless an admin approves it.',
    });
  });

  app.post('/api/ratings', async (c) => {
    const ip = clientKey((name) => c.req.header(name));
    if (limited(`rating:${ip}`, reportLimit, reportWindowMs)) {
      throw new HttpError(429, 'Too many ratings were sent from this network. This one was not saved.');
    }
    const parsed = validateRatingInput(await readJson(c));
    if (!parsed.ok) throw new HttpError(400, `${parsed.errors.join(' ')} It was not saved.`);
    const state = await options.store.load();
    const known = mergeRestrooms(SEED_RESTROOMS, state).some((item) => item.id === parsed.value.restroomId);
    if (!known) throw new HttpError(404, 'That restroom was not found. This rating was not saved.');
    const rating: Rating = {
      id: newId('rating'),
      ...parsed.value,
      createdAt: now().toISOString(),
      source: 'server',
    };
    await options.store.save(addRating(state, rating));
    return c.json({ rating, message: 'Rating saved on the server sandbox, separate from sample ratings.' });
  });

  app.post('/api/admin/restrooms', async (c) => {
    requireAdmin(c);
    const parsed = validateRestroom(await readJson(c));
    if (!parsed.ok) throw new HttpError(400, parsed.errors.join(' '));
    const state = await options.store.load();
    const current = mergeRestrooms(SEED_RESTROOMS, state);
    const slugs = collectSlugs(current, parsed.value.id);
    for (const entrance of parsed.value.entrances) {
      if (slugs.has(entrance.slug)) throw new HttpError(400, `QR slug “${entrance.slug}” is already used.`);
    }
    const record = parsed.value.fictional ? { ...parsed.value, allowExternalNavigation: false } : parsed.value;
    if (!SEED_IDS.has(record.id) && record.dataset === 'fictional-demo') {
      record.dataset = 'server-sandbox';
    }
    await options.store.save(upsertRestroom(state, record, SEED_IDS));
    return c.json({ restroom: record });
  });

  app.post('/api/admin/reports/:id/moderate', async (c) => {
    requireAdmin(c);
    const body = await readJson(c);
    const status =
      body && typeof body === 'object' && 'status' in body ? (body as { status?: unknown }).status : null;
    if (status !== 'approved' && status !== 'rejected') {
      throw new HttpError(400, 'Status must be approved or rejected.');
    }
    const state = await options.store.load();
    const id = c.req.param('id');
    const existing = mergeReports(getSampleReports(), state).find((report) => report.id === id);
    if (!existing) throw new HttpError(404, 'Report was not found.');
    const reviewedAt = now().toISOString();
    await options.store.save(setReportStatus(state, id, status, SAMPLE_REPORT_IDS, reviewedAt));
    return c.json({ report: { ...existing, status, reviewedAt } });
  });

  app.post('/api/admin/reset', async (c) => {
    requireAdmin(c);
    await options.store.save(emptySandbox());
    return c.json({ ok: true });
  });

  return app;
}

export function createMemorySandbox(initial = emptySandbox()): SandboxStore {
  let state = structuredClone(initial);
  return {
    async load() {
      return structuredClone(state);
    },
    async save(next) {
      state = structuredClone(next);
    },
  };
}
