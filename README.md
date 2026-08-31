# RayCast.js — RayCast Studio

Creador web de RPG **2.5D / 3D retro** (v0.1.0 · Fase 0.5: inicia sesión, gestiona tus juegos y públicalos).

## Comandos

```bash
npm install       # instala dependencias
npm run dev       # dev completo: API (http://localhost:3000) + SPA (http://localhost:8080)
npm run web:dev   # solo SPA (vite, puerto 8080)
npm run api:dev   # solo API (tsx watch, puerto 3000)
npm test          # tests Vitest (front + API, una pasada)
npm run test:watch
npm run typecheck # typecheck de front y server
npm run build     # typecheck + build de producción en dist/
npm run preview   # sirve el build
```

## Qué incluye hoy (F0.5)

- **Backend API** (Node + Hono + Drizzle) con Postgres: en dev usa **PGlite** embebido (Postgres en WASM, sin base de datos instalada) con `server/db/data/` persistente; en producción apunta a Postgres real vía `DATABASE_URL`.
- **Auth JWT casera** + bcrypt: registrarse, entrar y sesión (sin OAuth).
- **Game Library (6.20)**: lista tus juegos, los crea desde plantillas (seed con el demo), importa/exporta `*.ragproj`, duplica, renombra, borra y los publica en la galería.
- **Cloud Gallery (6.21)**: los juegos publicados son jugables online en `/play/:slug` con contador de visitas.
- **Schema v2 (aditivo) + de-hardcoding del motor**: piso/techo y minimapa configurados en el `project.json` (ya no hay índices fijos ni colores mágicos en el motor); la migración v1→v2 es automática al parsar.

## Páginas

- **App:** http://localhost:8080/ — auth → Game Library → jugar/publicar.
- **Galería pública:** http://localhost:8080/play/:slug — juegos publicados por los creadores.
- **Sprite Slicer heredado:** http://localhost:8080/tools/.

## Controles del juego

- **Mover**: Flechas o W/A/S/D · **Rotar**: Flechas izquierda/derecha o A/D · **Volver**: Esc.

## Arquitectura

```
raycastjs/
├── index.html                      ← SPA (auth, Game Library, galería, reproductor)
├── vite.config.ts                  ← base './', puerto 8080, proxy /api y /play → :3000
├── src/
│   ├── main.ts                     ← vistas SPA (auth / biblioteca / galería / jugar)
│   ├── style.css                   ← tema retro
│   ├── api/client.ts               ← cliente tipado de la API (fetch + token JWT)
│   ├── ui/dom.ts                   ← mini-helper DOM (hyperscript)
│   ├── core/input.ts               ← KeyboardState (WASD + flechas)
│   ├── data/
│   │   ├── schema.ts               ← Schemas Zod del project.json v2 (fuente de verdad)
│   │   └── project.ts              ← loadProject() / parseProject() / migración v1→v2
│   └── render/retro/
│       ├── math.ts                 ← matemática pura del raycaster (testeable)
│       ├── textures.ts             ← carga y post-proceso de texturas/sprites
│       └── raycaster.ts            ← clase RetroGame (DDA, piso/techo, sprites, minimapa)
├── public/
│   ├── projects/demo/project.json  ← proyecto demo (v2: piso/techo por id, flags, minimapa)
│   └── textures/                   ← 11 texturas 64×64
├── server/
│   ├── src/
│   │   ├── index.ts                ← arranque: DB + ensureSchema/seed + Hono en :3000
│   │   ├── routes.ts               ← /api/auth, /api/projects, /api/assets, /api/templates, /api/gallery, /play/:slug
│   │   ├── auth.ts                 ← bcrypt + JWT (casero)
│   │   └── env.ts                  ← PORT · JWT_SECRET · DATABASE_URL (carga .env)
│   ├── db/
│   │   ├── schema.ts               ← tablas Drizzle (users, projects JSONB, assets, templates, gallery)
│   │   ├── client.ts               ← createDb(): PGlite (dev) o postgres.js (prod)
│   │   └── ensure.ts               ← DDL idempotente + seed de plantillas (demo)
│   └── tests/api.test.ts           ← integración de toda la API contra PGlite en memoria
├── tests/                          ← schemas, demo real y matemática del motor
├── tools/                          ← Sprite Slicer (adaptar en F3)
├── assets/                         ← sprites de Daggerfall (NO versionado)
└── ROADMAP.md                      ← Plan maestro: fases F0–F12 y catálogo de herramientas
```

## Modelo de datos (v2)

`meta.schemaVersion` es ahora `2` (aditivo sobre v1). Lo nuevo respecto a v1:

```jsonc
"settings": {
  "floorTexture": "greystone",       // ids de textura (antes índices fijos 3/4)
  "floorTextureAlt": "bluestone",    // efecto checkerboard
  "ceilingTexture": "wood",          // antes índice 6
  "minimap": { "enabled": true, "cellSize": 6,
               "colors": { "wall":..., "player":..., "direction":..., "sprite":...,
                           "byKind": [ { "kind": "light", "color": "#00FF00" } ] } }
},
"sprites": [ { "x", "y", "texture", "flags": { "translucent": true, "kind": "light" } } ]
```

Los defaults de estos campos viven en los schemas Zod: un `project.json` v1 se parsea y queda automáticamente en v2.

## Notas

- **Nunca versionar**: `assets/` (sprites de Daggerfall con copyright, 178 MB) ni `.env`.
- El motor `3d` (WebGL) y el **Level Editor** son la Fase 1 (ver `ROADMAP.md`).
- `raycasting.js` (raíz) es la implementación vanilla original: referencia, no se modifica.