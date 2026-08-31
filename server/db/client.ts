import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { env } from '../src/env';

// Dev: PGlite embebido (Postgres en WASM, sin infraestructura).
// Prod: Postgres real vía postgres.js. Ambos drivers devuelven las mismas
// filas y la misma API relacional; se tipa con el de PGlite (los resultados
// de nuestras consultas simples tienen la misma forma) y se castea.
export type DB = PgliteDatabase<typeof schema>;

export async function createDb(url = env.databaseUrl): Promise<DB> {
  if (url.startsWith('pglite')) {
    // "pglite:" (memoria) o "pglite:./ruta" (archivo persistente en disco)
    const loc = url.slice('pglite:'.length).trim();
    if (loc) {
      mkdirSync(dirname(resolve(loc)), { recursive: true });
    }
    const client = loc ? new PGlite(resolve(loc)) : new PGlite();
    return drizzlePglite(client, { schema });
  }

  const sql = postgres(url, { max: 1 });
  return drizzlePostgres(sql, { schema }) as unknown as DB;
}