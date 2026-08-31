import { existsSync } from 'node:fs';

// Carga `.env` si existe (Node >=20). Sin dotenv: defaults claros para desarrollo.
try {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch {
  // sin .env: se usan los defaults de abajo
}

export interface Env {
  port: number;
  jwtSecret: string;
  databaseUrl: string;
}

export const env: Env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL ?? 'pglite:./server/db/data',
};