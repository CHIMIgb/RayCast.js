import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { templates } from './schema';
import type { DB } from './client';

// DDL idempotente: funciona igual sobre PGlite (dev) y Postgres real (prod).
const DDL = [
  sql`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    schema_version integer NOT NULL DEFAULT 2,
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)`,
  sql`CREATE TABLE IF NOT EXISTS assets (
    id text PRIMARY KEY,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id)`,
  sql`CREATE TABLE IF NOT EXISTS templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS gallery (
    id text PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    visits integer NOT NULL DEFAULT 0,
    published_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS idx_gallery_owner ON gallery(owner_id)`,
];

/** Crea las tablas si no existen (idempotente). */
export async function ensureSchema(db: DB): Promise<void> {
  for (const stmt of DDL) {
    await db.execute(stmt);
  }
  await seedTemplates(db);
}

/** Siembra las plantillas con el demo oficial en la primera arrancada. */
export async function seedTemplates(db: DB): Promise<void> {
  const existing = await db.select().from(templates).limit(1);
  if (existing.length > 0) return;
  // El demo vive en el front (public/); se lee en runtime como semilla inicial.
  const demoPath = resolve(import.meta.dirname, '../../public/projects/demo/project.json');
  const data = JSON.parse(readFileSync(demoPath, 'utf8')) as unknown;
  await db
    .insert(templates)
    .values({
      id: 'tpl-demo',
      name: 'Demo LodeV',
      description:
        'Mapa de referencia del tutorial clásico de LodeV (código fuente original) — plantilla inicial.',
      data,
    })
    .onConflictDoNothing({ target: templates.id });
}