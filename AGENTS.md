# AGENTS.md — RayCast Studio

Creador web de RPG 2.5D/3D retro (estilo Wolf3D→Doom→Daggerfall). SPA TypeScript + Vite + Vitest + Zod.
**Plan maestro y estado de fases: `ROADMAP.md`** (leer antes de proponer features).

## Comandos

```bash
npm test          # Vitest (una pasada); cubre front (tests/) y API (server/tests/)
npm test -- tests/project.schema.test.ts   # test focalizado
npm run typecheck # tsc --noEmit (front) + tsc -p server/tsconfig.json (server)
npm run build     # typecheck (ambos) + build Vite en dist/
npm run dev       # dev completo: API (:3000, tsx watch) + SPA (:8080) vía concurrently
npm run web:dev   # solo SPA (vite, puerto 8080, NO 5173)
npm run api:dev   # solo API (tsx watch server/src/index.ts, puerto 3000)
npm run preview   # sirve el build
```

- **No hay lint ni formatter configurados.** No inventar ni correr Eslint/Prettier.

## Entorno (WSL con Node de Windows)

- `node` no existe en PATH como tal: solo `node.exe` en `/mnt/c/Program Files/nodejs/`. Si `node` deja de resolver, restaurar el symlink:
  `ln -sf "/mnt/c/Program Files/nodejs/node.exe" ~/.opencode/bin/node`
- npm funciona (su script resuelve `node.exe`), pero los binarios de scripts usan `node`.
- **Los procesos lanzados desde el tool corren como procesos Windows (node.exe): no se ven en `ss`/`pkill`/`curl` de Linux.** Para verificar un servidor usar `curl.exe` (en vez de `curl`). Para limpiar huérfanos de puertos:
  `for pid in $(netstat.exe -ano | grep -i listen | grep -E ':3000|:8080' | awk '{print $NF}' | sort -u); do taskkill.exe '/F' '/PID' $pid; done`
  Vite huérfano lanzado desde WSL tampoco responde a `pkill -f vite` (auto-match): el patrón `node_modules/.bin/[v]ite` sí lo mataba cuando corría como proceso Linux; ahora con proceso Windows lo robusto es `taskkill.exe` por puerto.

## Arquitectura

- **`src/data/schema.ts` es la fuente de verdad**: todo `project.json` entra/sale por estos schemas Zod (`parseProject` en `src/data/project.ts`). `meta.schemaVersion` es **2 (aditivo)**: el schema acepta 1|2 y canonicaliza a 2 (migración v1→v2 automática); los defaults v2 viven en Zod, no en el motor.
- **`src/render/retro/raycaster.ts` es el motor vivo** (ya de-hardcodeado: piso/techo por id, `sprites[].flags.translucent`, minimapa configurable). `raycasting.js` (raíz) es la implementación vanilla ORIGINAL congelada: **referencia, NO modificar**.
- **API (F0.5)**: `server/src/routes.ts` construye el app Hono (rutas `/api/auth`, `/api/projects`, `/api/assets`, `/api/templates`, `/api/gallery`, `/play/:slug`); `server/db/client.ts` elige driver según `DATABASE_URL` (`pglite:...` embebido en dev, `postgres://...` en prod); `server/db/ensure.ts` crea tablas y siembra `tpl-demo`. La SPA consulta **siempre el mismo origen** (proxy de Vite en dev).
- Boot: `index.html` → `src/main.ts` → vista de auth; con sesión, Game Library (6.20) con CRUD por API y reproductor RetroGame montado en la SPA.
- `vite.config.ts`: `base: './'` es **deliberado** (build standalone abrible desde `file://`, Publisher F12), `server.port = 8080` y proxy `/api` + `/play` → `:3000`. Mantener todos.
- `tools/` (sprite-slicer vanilla) se adapta a TS en F3; no tocar en F0/F0.5.
- Tests Vitest corren en entorno `node`, incluyen `tests/**/*.test.ts` y `server/tests/**/*.test.ts`; el test de integración importa el `project.json` real del demo (seed).

## Convenciones

- **Comentarios y mensajes de commit en español.** Estilo de commits en el historial: `feat: ...` (rama `main`).
- Identidad git ya configurada a nivel global: `CHIMIgb` / `adriangallardobuenrostro@gmail.com`.
- **`assets/` NO se versiona** (`.gitignore`): 178MB de sprites de Daggerfall con copyright. Nunca commitear; importar localmente bajo demanda.
- `.env` está gitignored (guardará `DATABASE_URL`/`JWT_SECRET` en F0.5). No commitear.

## Reglas

- **Cada vez que se complete una fase del ROADMAP, marcarla como terminada** en la tabla de "Estado del plan" (`ROADMAP.md` §12), indicando el commit si existe (p.ej. `✅ Completada (commit 221ffff)`). No quedarse en código: el plan debe reflejar el avance.
- **No hardcodear valores.** Toda constante que sea dato del juego (texturas de piso/techo, flags de sprite, colores de minimapa, resolución, config) debe declararse en el `project.json` validado con Zod — no embutirse en el código del motor ni en la UI. Los únicos datos permitidos en código son configuración de infraestructura (puertos, `base: './'`) y constantes sin representación en el modelo.

## Estado y siguiente trabajo

- F0 (toolchain + motor retro migrado) ✅ completada (commit `221ffff`).
- F0.5 (backend + Game Library + schema v2): ver §12 del ROADMAP.
- **Lo que viene: F1** — Level Editor 3D (depende de F0.5). Antes de F1, en F3 se adaptan los `tools/`.
- Publisher = HTML autónomo + galería pública (F12).
- `opencode.json` declara el plugin `@dietrichgebert/ponytail` y MCP `context7`: reutilizar librerías antes que reinventar (regla del plan).