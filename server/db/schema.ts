import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// Modelo de base de datos (F0.5). Como PGlite es Postgres, todo gira en el
// dialecto pg-core: el mismo esquema vale para dev (PGlite) y para prod
// (Postgres real vía postgres.js).
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  schemaVersion: integer('schema_version').notNull().default(2),
  // project.json validado con ProjectSchema (v2)
  data: jsonb('data').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // 'texture' | 'sprite' | 'audio'
  kind: text('kind').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  // ruta relativa dentro del filesystem de blobs del servidor
  path: text('path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  data: jsonb('data').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gallery = pgTable('gallery', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  visits: integer('visits').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});