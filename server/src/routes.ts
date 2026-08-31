import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ProjectSchema } from '../../src/data/schema';
import { users, projects, assets, templates, gallery } from '../db/schema';
import type { DB } from '../db/client';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth';

// ─────────────────────────────────────────────────────────────────────────────
// API Hono (F0.5). Rutas /api/* + /play/* (galería pública). El front pide
// siempre en el mismo origen (proxy de Vite en dev; mismo dominio en prod).
// ─────────────────────────────────────────────────────────────────────────────

export const newId = (): string => randomUUID();

interface AppVars {
  userId: string;
  username: string;
}

const requireAuth: MiddlewareHandler<{ Variables: AppVars }> = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return c.json({ error: 'No autorizado' }, 401);
  }
  c.set('userId', payload.sub);
  c.set('username', payload.username);
  await next();
};

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const CreateProjectSchema = z
  .object({
    name: z.string().min(1),
    // clonar de una plantilla ('tpl-demo' por defecto)
    templateId: z.string().optional(),
    // o importar un project.json ya validado (no puede ir junto a templateId)
    data: z.unknown().optional(),
  })
  .refine((v) => !(v.templateId && v.data), {
    message: 'Usa templateId O data, no ambos',
  });

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  data: z.unknown().optional(),
});

const PublishSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
};

export function buildApp(db: DB): Hono<{ Variables: AppVars }> {
  const app = new Hono<{ Variables: AppVars }>();

  // ── Auth ────────────────────────────────────────────────────────────────
  app.post('/api/auth/register', zValidator('json', RegisterSchema), async (c) => {
    const { email, username, password } = c.req.valid('json');
    const passwordHash = await hashPassword(password);
    const user = { id: newId(), email, username, passwordHash };
    try {
      const [row] = await db.insert(users).values(user).returning();
      return c.json({ token: signToken({ sub: row.id, username: row.username }), user: safeUser(row) }, 201);
    } catch {
      return c.json({ error: 'El email o el usuario ya existen' }, 409);
    }
  });

  app.post('/api/auth/login', zValidator('json', LoginSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }
    return c.json({ token: signToken({ sub: row.id, username: row.username }), user: safeUser(row) });
  });

  app.get('/api/auth/me', requireAuth, async (c) => {
    const [row] = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(eq(users.id, c.get('userId')))
      .limit(1);
    if (!row) return c.json({ error: 'No encontrado' }, 404);
    return c.json({ user: row });
  });

  // ── Proyectos ───────────────────────────────────────────────────────────
  app.get('/api/projects', requireAuth, async (c) => {
    const userId = c.get('userId');
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        schemaVersion: projects.schemaVersion,
        updatedAt: projects.updatedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt));
    return c.json({ projects: rows });
  });

  app.post('/api/projects', requireAuth, zValidator('json', CreateProjectSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    let data: unknown;
    if (body.data !== undefined) {
      const parsed = ProjectSchema.safeParse(body.data);
      if (!parsed.success) {
        return c.json({ error: 'project.json inválido', issues: parsed.error.issues }, 400);
      }
      data = parsed.data;
    } else {
      const templateId = body.templateId ?? 'tpl-demo';
      const [tpl] = await db.select().from(templates).where(eq(templates.id, templateId)).limit(1);
      if (!tpl) return c.json({ error: `Plantilla "${templateId}" no existe` }, 404);
      data = {
        ...(tpl.data as Record<string, unknown>),
        meta: { ...((tpl.data as { meta?: Record<string, unknown> }).meta ?? {}), name: body.name, schemaVersion: 2 },
      };
      const parsed = ProjectSchema.safeParse(data);
      if (!parsed.success) {
        return c.json({ error: 'La plantilla no es un proyecto válido', issues: parsed.error.issues }, 500);
      }
      data = parsed.data;
    }
    const name = body.name ?? ((data as { meta?: { name?: string } }).meta?.name ?? 'Proyecto');
    const project = {
      id: newId(),
      ownerId: userId,
      name,
      schemaVersion: 2,
      data,
    };
    const [row] = await db.insert(projects).values(project).returning();
    return c.json({ project: row }, 201);
  });

  app.get('/api/projects/:id', requireAuth, async (c) => {
    const [row] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, c.req.param('id')))
      .limit(1);
    if (!row || row.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);
    return c.json({ project: row });
  });

  app.put('/api/projects/:id', requireAuth, zValidator('json', UpdateProjectSchema), async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing || existing.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);

    const body = c.req.valid('json');
    let next: unknown = existing.data;
    if (body.data !== undefined) {
      const parsed = ProjectSchema.safeParse(body.data);
      if (!parsed.success) {
        return c.json({ error: 'project.json inválido', issues: parsed.error.issues }, 400);
      }
      next = parsed.data;
    }
    const [row] = await db
      .update(projects)
      .set({
        data: next,
        name: body.name ?? (next as { meta?: { name?: string } }).meta?.name ?? existing.name,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    return c.json({ project: row });
  });

  app.delete('/api/projects/:id', requireAuth, async (c) => {
    const [existing] = await db.select().from(projects).where(eq(projects.id, c.req.param('id'))).limit(1);
    if (!existing || existing.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);
    await db.delete(projects).where(eq(projects.id, existing.id));
    return c.body(null, 204);
  });

  app.post('/api/projects/:id/duplicate', requireAuth, async (c) => {
    const [existing] = await db.select().from(projects).where(eq(projects.id, c.req.param('id'))).limit(1);
    if (!existing || existing.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);
    const copy = {
      id: newId(),
      ownerId: c.get('userId'),
      name: `${existing.name} (copia)`,
      schemaVersion: existing.schemaVersion,
      data: existing.data,
    };
    const [row] = await db.insert(projects).values(copy).returning();
    return c.json({ project: row }, 201);
  });

  // ── Assets (subida a blobs en el filesystem del servidor) ───────────────
  app.get('/api/assets', requireAuth, async (c) => {
    const rows = await db
      .select()
      .from(assets)
      .where(eq(assets.ownerId, c.get('userId')))
      .orderBy(desc(assets.createdAt));
    return c.json({ assets: rows });
  });

  app.post('/api/assets', requireAuth, async (c) => {
    const userId = c.get('userId');
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return c.json({ error: 'Falta el archivo "file"' }, 400);
    const kind = (form.get('kind') as string | null) ?? 'texture';
    const name = (form.get('name') as string | null) ?? file.name;
    const ext = MIME_EXT[file.type] ?? '.bin';
    const id = newId();
    const dir = resolve(import.meta.dirname, '../data/assets', userId);
    mkdirSync(dir, { recursive: true });
    const path = `${userId}/${id}${ext}`;
    writeFileSync(resolve(dir, `${id}${ext}`), Buffer.from(await file.arrayBuffer()));
    const [row] = await db
      .insert(assets)
      .values({ id, ownerId: userId, name, kind, mime: file.type, size: file.size, path })
      .returning();
    return c.json({ asset: row }, 201);
  });

  app.delete('/api/assets/:id', requireAuth, async (c) => {
    const [existing] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, c.req.param('id')))
      .limit(1);
    if (!existing || existing.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);
    const full = resolve(import.meta.dirname, '../data/assets', existing.path);
    rmSync(full, { force: true });
    await db.delete(assets).where(eq(assets.id, existing.id));
    return c.body(null, 204);
  });

  // ── Plantillas (públicas) ───────────────────────────────────────────────
  app.get('/api/templates', async (c) => {
    const rows = await db
      .select({ id: templates.id, name: templates.name, description: templates.description, createdAt: templates.createdAt })
      .from(templates)
      .orderBy(templates.name);
    return c.json({ templates: rows });
  });

  app.get('/api/templates/:id', async (c) => {
    const [row] = await db.select().from(templates).where(eq(templates.id, c.req.param('id'))).limit(1);
    if (!row) return c.json({ error: 'No encontrado' }, 404);
    return c.json({ template: row });
  });

  // ── Galería (6.21) ──────────────────────────────────────────────────────
  app.post('/api/projects/:id/publish', requireAuth, zValidator('json', PublishSchema), async (c) => {
    const [existing] = await db.select().from(projects).where(eq(projects.id, c.req.param('id'))).limit(1);
    if (!existing || existing.ownerId !== c.get('userId')) return c.json({ error: 'No encontrado' }, 404);
    const body = c.req.valid('json');
    const base = body.slug ?? slugify((existing.data as { meta?: { name?: string } }).meta?.name ?? existing.name);
    const slug = base || randomUUID().slice(0, 8);
    const taken = await db.select().from(gallery).where(eq(gallery.slug, slug)).limit(1);
    if (taken.length > 0) return c.json({ error: `El slug "${slug}" ya está en uso` }, 409);
    const [row] = await db
      .insert(gallery)
      .values({
        id: newId(),
        slug,
        projectId: existing.id,
        ownerId: c.get('userId'),
        title: (existing.data as { meta?: { name?: string } }).meta?.name ?? existing.name,
      })
      .returning();
    return c.json({ published: { slug: row.slug, url: `/play/${row.slug}` } }, 201);
  });

  app.get('/api/gallery', async (c) => {
    const rows = await db
      .select({
        slug: gallery.slug,
        title: gallery.title,
        visits: gallery.visits,
        publishedAt: gallery.publishedAt,
        author: users.username,
      })
      .from(gallery)
      .innerJoin(users, eq(users.id, gallery.ownerId))
      .orderBy(desc(gallery.publishedAt));
    return c.json({ gallery: rows });
  });

  app.get('/play/:slug', async (c) => {
    const [row] = await db.select().from(gallery).where(eq(gallery.slug, c.req.param('slug'))).limit(1);
    if (!row) return c.json({ error: 'No encontrado' }, 404);
    await db.update(gallery).set({ visits: row.visits + 1 }).where(eq(gallery.id, row.id));
    const [project] = await db.select().from(projects).where(eq(projects.id, row.projectId)).limit(1);
    if (!project) return c.json({ error: 'El proyecto ya no existe' }, 404);
    return c.json({ title: row.title, project: project.data });
  });

  app.onError((err, c: Context<{ Variables: AppVars }>) => {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  });

  app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

  return app;
}

const safeUser = (u: { id: string; email: string; username: string; passwordHash?: string }) => ({
  id: u.id,
  email: u.email,
  username: u.username,
});