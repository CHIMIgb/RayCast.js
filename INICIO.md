# INICIO.md — Plan para arrancar el proyecto desde cero

> Guía paso a paso para reconstruir `src/`, `server/` y `public/` desde el estado
> actual (working directory vacío de código). La documentación (`ROADMAP.md`,
> `DESIGN.md`, `DATABASE.md`, `AGENTS.md`) es la fuente de verdad; este plan solo ordena la ejecución.

---

## 0. Estado actual (diagnóstico)

- Commit `44a3975 "reinicio"` **borró** `src/`, `server/`, `public/`, `package.json`, `package-lock.json`.
- Ese código **sigue en el historial git** (commit `111782f` = F0.5) y puede recuperarse con `git show`/`git restore`.
- En disco quedan: `ROADMAP.md`, `DESIGN.md`, `DATABASE.md`, `AGENTS.md`, `README.md`, `tools/`, `raycasting.js` (referencia), `.env.example`, `.gitignore`.
- **Decisión tomada:** arrancar de cero **aplicando ya** el esquema de `DATABASE.md` (persona/usuario/rol, estado, JSONB completo) y la arquitectura de errores (`ROADMAP.md` §5b) desde el inicio.

---

## 1. Toolchain base (raíz)

1. `package.json` raíz con:
   - deps **dev**: `typescript`, `vite`, `vitest`, `tsx`, `concurrently`, `@types/node`.
   - scripts: `dev` (API+Spa vía concurrently), `web:dev` (vite :8080), `api:dev` (tsx watch :3000), `test`, `typecheck`, `build` (typecheck + vite), `preview`.
2. `tsconfig.json` (front) + `tsconfig.node.json`. **No** añadir eslint/prettier (regla AGENTS: no hay lint configurado).
3. `vite.config.ts` — mantener obligatorio:
   - `base: './'` (build standalone abrible desde `file://`, Publisher F12)
   - `server.port = 8080`
   - proxy `/api` y `/play` → `:3000`
4. `src/index.html` → `src/main.ts`.
5. `npm install`.

---

## 2. Esquema de datos y backend (Postgres + Prisma + Hono)

1. `server/package.json`: deps `hono`, `@hono/node-server`, `@prisma/client`, `bcryptjs`, `zod`; dev `prisma`, `tsx`, `@types/node`, `typescript`.
2. `server/prisma/schema.prisma` — **generar desde `DATABASE.md` §6** (modelos Rol/Persona/Usuario/Proyecto/Asset/Galeria/Plantilla + enums).
3. `server/db/ensure.ts` — `prisma migrate` + seed: `rol` (admin/creador), `plantilla` con el demo, y opcional un usuario demo.
4. Infra de errores (`ROADMAP.md` §5b):
   - `server/src/errors/codes.ts` — diccionario centralizado de códigos.
   - `server/src/errors/AppError.ts` — clase `AppError{code,message,status,details}`.
   - `server/src/errors/handler.ts` — interceptor global (`app.onError`) que unifica `{ success, data, error }`.
5. `server/src/env.ts` — carga `DATABASE_URL`, `JWT_SECRET`, puerto (desde `.env`).
6. `server/src/auth.ts` — JWT casero + bcrypt (registro/login).
7. `server/src/routes.ts` — endpoints con el nuevo esquema:
   - `/api/auth/*` (registro, login)
   - `/api/projects` (CRUD: crear desde plantilla, obtener, guardar `data`, cambiar `estado`, publicar/despublicar → galería)
   - `/api/assets` (subir/registrar, metadatos en DB, bytes en filesystem de blobs, ruta en `asset.ruta`)
   - `/api/gallery` y `/play/:slug`
8. `server/src/index.ts` — bootstrap del server Hono.

---

## 3. Front (SPA Vite + TS)

1. `src/main.ts` — boot: autenticación → Game Library → Reproductor RetroGame.
2. `src/api/client.ts` — `apiFetch<T>()` que desenvuelve `{success,data,error}` y lanza `ApiError` (regla §5b).
3. `src/data/schema.ts` — schemas Zod (`ProjectSchema` v2, aditivo, canonicaliza) = fuente de verdad del `project.json`; `src/data/project.ts` con `parseProject`.
4. `src/render/retro/raycaster.ts` — motor retro (piso/techo por id, sprites translúcidos, minimapa configurable); **datos de `project.json`**, nunca hardcodeados.
5. `src/studio/ui/` — componentes del Design System según `DESIGN.md` (framework-agnostic, vanilla TS). Leer `DESIGN.md` antes de crearlos.
6. `src/style.css` — tokens de `DESIGN.md`.

---

## 4. Orden sugerido de construcción (por dependencia)

1. Toolchain (raíz) + `npm install` + typecheck en verde.
2. `server/` esquema Prisma + migrate + seed.
3. Contrato de errores (§5b) en el server.
4. Auth + proyectos + assets + galería (endpoints).
5. `apiFetch` en el front.
6. Schemas Zod + motor retro.
7. UI (Game Library).

---

## 5. Criterios de "listo para el primer commit"

- `npm run typecheck` pasa en front y server.
- `npm run test` pasa (al menos el test de esquema del `project.json` demo).
- El backend arranca en `:3000` y sirve `/api/health`.
- La SPA arranca en `:8080`, muestra login y lista de juegos (seed).
- El demo se carga jugable desde la DB (no desde disco/localStorage).

---

## 6. Recordatorios

- **No hardcodear** datos de juego en el motor/UI; todo declarado en `project.json` (Zod).
- **Todo a la DB**: mapa/estado/assets siempre en Postgres; bytes de assets en blobs (`asset.ruta`), nunca el dato del juego en localStorage.
- `assets/` y `.env` están gitignored; no commitear.
- Añadir un error nuevo = editarlo en `codes.ts` (único lugar).
- Comentarios y commits en español; estilo `feat: ...`.
- Marcar fases completadas en `ROADMAP.md` §12 al terminar.
