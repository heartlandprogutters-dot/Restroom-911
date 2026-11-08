import { describe, expect, it } from 'vitest';
import { SEED_RESTROOMS } from '../src/data/seed';
import { createApp, createMemorySandbox } from './app';

function app() {
  return createApp({
    password: 'test-secret',
    store: createMemorySandbox(),
    reportLimit: 3,
    reportWindowMs: 60_000,
  });
}

async function login(target: ReturnType<typeof app>) {
  const response = await target.request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-ip': 'tester' },
    body: JSON.stringify({ password: 'test-secret' }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie') ?? '';
  return cookie.split(';')[0];
}

describe('admin authorization', () => {
  it('rejects admin writes without a session and accepts them after login', async () => {
    const target = app();
    const denied = await target.request('/api/admin/reset', { method: 'POST' });
    expect(denied.status).toBe(401);

    const wrong = await target.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'nope' }),
    });
    expect(wrong.status).toBe(401);

    const cookie = await login(target);
    const snapshot = structuredClone(SEED_RESTROOMS[0]);
    const edited = { ...snapshot, entranceSummary: 'Updated in the server sandbox.' };
    const saved = await target.request('/api/admin/restrooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(edited),
    });
    expect(saved.status).toBe(200);
    expect(SEED_RESTROOMS[0]).toEqual(snapshot);

    const listed = await target.request('/api/restrooms');
    const body = (await listed.json()) as { restrooms: { id: string; entranceSummary: string }[] };
    expect(body.restrooms.find((item) => item.id === snapshot.id)?.entranceSummary).toMatch(/server sandbox/i);
  });

  it('refuses admin routes when no password is configured', async () => {
    const open = createApp({ password: null, store: createMemorySandbox() });
    const response = await open.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'anything' }),
    });
    expect(response.status).toBe(503);
  });
});

describe('server submissions', () => {
  it('validates reports, rate limits them, and leaves them pending', async () => {
    const target = app();
    const health = await validateFirst(target);
    expect(health.status).toBe(400);

    const ok = await target.request('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-ip': 'reports' },
      body: JSON.stringify({
        restroomId: 'murray-commons',
        kind: 'wrong-hours',
        note: 'The posted hours looked wrong.',
      }),
    });
    expect(ok.status).toBe(200);
    const created = (await ok.json()) as { report: { status: string }; message: string };
    expect(created.report.status).toBe('pending');
    expect(created.message).toMatch(/unless an admin approves/i);

    for (let i = 0; i < 2; i += 1) {
      await target.request('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-ip': 'reports' },
        body: JSON.stringify({
          restroomId: 'murray-commons',
          kind: 'locked-door',
          note: `Extra report ${i}`,
        }),
      });
    }
    const limited = await target.request('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-ip': 'reports' },
      body: JSON.stringify({
        restroomId: 'murray-commons',
        kind: 'locked-door',
        note: 'This one should be blocked.',
      }),
    });
    expect(limited.status).toBe(429);
  });

  it('approves a report only for an admin and does not rewrite seed hours', async () => {
    const target = app();
    const cookie = await login(target);
    const before = structuredClone(SEED_RESTROOMS.find((item) => item.id === 'mayfield-welcome-kiosk'));
    const response = await target.request('/api/admin/reports/sample-kiosk-pending-closed/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(response.status).toBe(200);
    const hours = SEED_RESTROOMS.find((item) => item.id === 'mayfield-welcome-kiosk')?.hours;
    expect(hours).toEqual(before?.hours);
    const reports = (await (await target.request('/api/reports')).json()) as {
      reports: { id: string; status: string }[];
    };
    expect(reports.reports.find((item) => item.id === 'sample-kiosk-pending-closed')?.status).toBe('approved');
  });
});

function validateFirst(target: ReturnType<typeof app>) {
  return target.request('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      restroomId: 'murray-commons',
      kind: 'locked-door',
      note: 'Door',
      diagnosis: 'nope',
    }),
  });
}
