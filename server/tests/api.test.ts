import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type { DB } from '../db/client';
import { createDb } from '../db/client';
import { ensureSchema } from '../db/ensure';
import { buildApp } from '../src/routes';

describe('API F0.5 (auth, proyectos, plantillas, galería)', () => {
  let db: DB;
  let app: ReturnType<typeof buildApp>;
  let token = '';
  let token2 = '';
  let userId = '';
  let projectId = '';

  beforeAll(async () => {
    db = await createDb('pglite:');
    await ensureSchema(db);
    app = buildApp(db);
  });

  afterAll(async () => {
    const client = (db as unknown as { $client?: { close: () => Promise<void> } }).$client;
    await client?.close();
  });

  const request = (
    method: string,
    path: string,
    opts: { body?: unknown; token?: string } = {},
  ) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    return app.request(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  const json = async (res: Response) => {
    let body: unknown = null;
    try {
      body = (await res.json()) as unknown;
    } catch {
      // cuerpos vacíos (204)
    }
    return { status: res.status, body };
  };

  it('registra un usuario y devuelve token', async () => {
    const res = await json(
      await request('POST', '/api/auth/register', {
        body: { email: 'chimi@test.local', username: 'chimi', password: 'secreto123' },
      }),
    );
    expect(res.status).toBe(201);
    const b = res.body as { token: string; user: { id: string } };
    expect(b.token).toBeTruthy();
    expect(b.user.id).toBeTruthy();
  });

  it('impide registrar el mismo email dos veces', async () => {
    const res = await json(
      await request('POST', '/api/auth/register', {
        body: { email: 'chimi@test.local', username: 'otro', password: 'secreto123' },
      }),
    );
    expect(res.status).toBe(409);
  });

  it('inicia sesión y lista sus proyectos (vacía)', async () => {
    const login = await json(
      await request('POST', '/api/auth/login', {
        body: { email: 'chimi@test.local', password: 'secreto123' },
      }),
    );
    expect(login.status).toBe(200);
    token = (login.body as { token: string }).token;
    const me = await json(await request('GET', '/api/auth/me', { token }));
    expect(me.status).toBe(200);
    userId = (me.body as { user: { id: string } }).user.id;
    const list = await json(await request('GET', '/api/projects', { token }));
    expect((list.body as { projects: unknown[] }).projects).toEqual([]);
  });

  it('rechaza login con contraseña incorrecta', async () => {
    const res = await json(
      await request('POST', '/api/auth/login', {
        body: { email: 'chimi@test.local', password: 'mal-password' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rechaza rutas protegidas sin token', async () => {
    const res = await json(await request('GET', '/api/projects'));
    expect(res.status).toBe(401);
  });

  it('expone las plantillas públicas (seed con el demo)', async () => {
    const res = await json(await request('GET', '/api/templates'));
    expect(res.status).toBe(200);
    const tpls = (res.body as { templates: { id: string }[] }).templates;
    expect(tpls.some((t) => t.id === 'tpl-demo')).toBe(true);
  });

  it('crea un proyecto desde la plantilla demo (migrada a v2)', async () => {
    const res = await json(
      await request('POST', '/api/projects', {
        token,
        body: { name: 'Mi Aventura', templateId: 'tpl-demo' },
      }),
    );
    expect(res.status).toBe(201);
    const b = res.body as { project: { id: string; data: { meta: { schemaVersion: number } } } };
    projectId = b.project.id;
    expect(b.project.data.meta.schemaVersion).toBe(2);
    // textura de piso/techo presente tras el v2
    expect(
      (b.project.data as unknown as { settings: { floorTexture: string } }).settings.floorTexture,
    ).toBe('greystone');
  });

  it('rechaza la creación desde una plantilla inexistente', async () => {
    const res = await json(
      await request('POST', '/api/projects', { token, body: { name: 'X', templateId: 'nope' } }),
    );
    expect(res.status).toBe(404);
  });

  it('importa un project.json validado y rechaza uno inválido', async () => {
    const validData = {
      meta: { name: 'Importado', schemaVersion: 2, renderMode: 'retro' },
      settings: {
        resolution: { width: 320, height: 240 },
        playerStart: { x: 1.5, y: 1.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 },
      },
      textures: [{ id: 'w', src: '/textures/redbrick.png', isSprite: false }],
      map: { size: { w: 2, h: 2 }, grid: [[1, 1], [1, 0]] },
    };
    const ok = await json(
      await request('POST', '/api/projects', { token, body: { name: 'Importado', data: validData } }),
    );
    expect(ok.status).toBe(201);
    const bad = await json(
      await request('POST', '/api/projects', {
        token,
        body: { name: 'Malo', data: { meta: { schemaVersion: 2 } } },
      }),
    );
    expect(bad.status).toBe(400);
  });

  it('obtiene, actualiza y duplica un proyecto', async () => {
    const got = await json(await request('GET', `/api/projects/${projectId}`, { token }));
    expect(got.status).toBe(200);
    const data = (got.body as { project: { data: Record<string, unknown> } }).project.data;
    const renamed = structuredClone(data);
    (renamed.meta as { name: string }).name = 'Renombrada';

    const upd = await json(
      await request('PUT', `/api/projects/${projectId}`, { token, body: { data: renamed } }),
    );
    expect(upd.status).toBe(200);
    expect(((upd.body as { project: { data: { meta: { name: string } } } }).project.data.meta.name)).toBe('Renombrada');

    const dupe = await json(await request('POST', `/api/projects/${projectId}/duplicate`, { token }));
    expect(dupe.status).toBe(201);
    expect((dupe.body as { project: { name: string } }).project.name).toContain('Renombrada (copia)');
  });

  it('rechaza editar o borrar un proyecto ajeno', async () => {
    const register2 = await json(
      await request('POST', '/api/auth/register', {
        body: { email: 'otro@test.local', username: 'otro', password: 'secreto123' },
      }),
    );
    token2 = (register2.body as { token: string }).token;
    const upd = await json(
      await request('PUT', `/api/projects/${projectId}`, { token: token2, body: { name: 'Hack' } }),
    );
    expect(upd.status).toBe(404);
    const del = await json(await request('DELETE', `/api/projects/${projectId}`, { token: token2 }));
    expect(del.status).toBe(404);
  });

  it('publica en la galería, la lista y la sirve en /play con visitas', async () => {
    const pub = await json(
      await request('POST', `/api/projects/${projectId}/publish`, { token, body: { slug: 'mi-aventura' } }),
    );
    expect(pub.status).toBe(201);
    expect((pub.body as { published: { url: string } }).published.url).toBe('/play/mi-aventura');

    const dup = await json(
      await request('POST', `/api/projects/${projectId}/publish`, { token, body: { slug: 'mi-aventura' } }),
    );
    expect(dup.status).toBe(409);

    const list = await json(await request('GET', '/api/gallery'));
    expect(list.status).toBe(200);
    const items = (list.body as { gallery: { slug: string; visits: number; author: string }[] }).gallery;
    expect(items.some((g) => g.slug === 'mi-aventura' && g.author === 'chimi')).toBe(true);

    const play1 = await json(await request('GET', '/play/mi-aventura'));
    expect(play1.status).toBe(200);
    expect((play1.body as { title: string }).title).toBe('Renombrada');

    await request('GET', '/play/mi-aventura');
    const listAfter = (await json(await request('GET', '/api/gallery'))).body as {
      gallery: { slug: string; visits: number }[];
    };
    const entry = listAfter.gallery.find((g) => g.slug === 'mi-aventura');
    expect(entry?.visits).toBeGreaterThanOrEqual(2);
  });

  it('borra un proyecto propio', async () => {
    const del = await json(await request('DELETE', `/api/projects/${projectId}`, { token }));
    expect(del.status).toBe(204);
    const got = await json(await request('GET', `/api/projects/${projectId}`, { token }));
    expect(got.status).toBe(404);
    void userId;
  });
});