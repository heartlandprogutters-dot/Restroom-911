import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createFileStore } from './fileStore';

const password = process.env.ADMIN_PASSWORD ?? '';
const usable = password.length > 0 && password !== 'change-me' ? password : null;
const port = Number(process.env.ADMIN_PORT ?? 43124);
const file = path.join(process.cwd(), 'data', 'server-sandbox.json');

if (!usable) {
  console.warn('ADMIN_PASSWORD is unset. Admin routes will refuse requests. Public report checks still run.');
}

const app = createApp({ password: usable, store: createFileStore(file) });

serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`Restroom 911 API listening on http://127.0.0.1:${info.port}`);
});
