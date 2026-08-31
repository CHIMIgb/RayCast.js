import { serve } from '@hono/node-server';
import { env } from './env';
import { createDb } from '../db/client';
import { ensureSchema } from '../db/ensure';
import { buildApp } from './routes';

async function main(): Promise<void> {
  const db = await createDb();
  await ensureSchema(db);
  const app = buildApp(db);
  serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`API RayCast Studio escuchando en http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  console.error('La API no pudo arrancar:', err);
  process.exit(1);
});