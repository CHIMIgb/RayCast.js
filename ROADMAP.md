# ROADMAP — RayCast Studio

> Creador web de RPG 2.5D/3D retro (estilo Wolfenstein 3D → Doom → Daggerfall).
> Plan maestro del proyecto. Sustituye a `SPRITE_TOOLS_PLAN.md` (ver §9 Herencia).

---

## 1. Visión

Convertir **RayCast.js** en una plataforma web tipo *RPG Maker* para construir videojuegos de rol en primera persona con estética retro-3D. El producto tiene **tres caras**:

- **Studio** — conjunto de herramientas web (editor de niveles 3D, pipeline de sprites, IA, misiones, diálogos, combate, magia, comercio, progresión, visual scripting).
- **Runtime** — doble motor de render que ejecuta los juegos: modo **retro** (raycaster Canvas clásico) y modo **3d** (WebGL con verticalidad/eje Z, estilo XnGine/Daggerfall).
- **Player/Publisher** — exporta un juego terminado a un **HTML autónomo** jugable en cualquier navegador, sin servidor ni instalación.

**Un juego creado = una carpeta de proyecto** (`project.json` + `assets/`). Todo es datos: las herramientas escriben datos, los motores leen datos. Desde F0.5 esa carpeta vive **también** en el servidor (`/api/projects` + `/api/assets`): el Studio trabaja contra la API y exporta/importa `*.ragproj` para llevar el juego a otro lugar o respaldarlo.

**Principio de UX rector:** todo en el Studio es **arrastrar y unir** — assets sobre el viewport, bloques predefinidos sobre entidades, y bloques entre sí con cables en los blueprints. El scripting por código queda excluido del alcance (decisión del usuario): la creación debe ser fácil, sin escribir una línea.

---

## 2. Decisiones y justificación técnica

| Decisión | Justificación |
|---|---|
| **Web, no escritorio** | El XnGine original es propietario de Bethesda y su código nunca llegó a publicarse; `kevinmkchin/XNGINE` es un renderer C++ sin relación con él. No hay motor C++ que incrustar → se escribe uno propio. WebGL da GPU desde el navegador y la app entera corre sin instalación. Si algún día se quiere desktop, Electron/Tauri envuelve el mismo TypeScript sin reescribir nada. |
| **Motor dual (retro + 3d)** | Decide el autor por proyecto. `retro` conserva el look Wolf3D puro (el raycaster actual); `3d` aporta verticalidad real (alturas de piso/techo, rampas, pisos superpuestos, terreno ondulado). Ambos comparten el mismo `project.json`. |
| **TypeScript + Vite + Vitest** | El proyecto pasará de ~500 líneas a decenas de miles. Tipado para el modelo de datos (un cambio en `project.json` se propaga a todas las herramientas), build modular, dev-server `npm run dev` y tests integrados. |
| **Three.js para 3D (no WebGL a mano)** | Reutilizar una librería madura en lugar de escribir un renderer propio: escena, cámara, mallas, texturas, raycasting del editor. El trabajo propio es el *sector system* (verticalidad) encima, no el pipeline gráfico. |
| **Formato de datos propio, único** | Desacopla herramientas ↔ motores. Un editor escribe JSON; otro motor puede leer el mismo JSON sin tocar las herramientas. Schema versionado. |
| **Física cinemática ligera de género (no Rigidbody completo)** | Mover-y-colisionar contra sectores + gravedad (saltos, caídas), escaleras, elevadores y triggers. Un Rigidbody físico-realista (masa, fricción, joints) es sobredimensionado para un FPS 2.5D retro: complica y no aporta nada visible. `cannon-es` queda como opción futura solo para props dinámicos/proyectiles. |
| **Visual Scripting (blueprints), nunca C#/C++** | La lógica del juego se diseña con grafos de nodos conectados por cables (estilo Unreal Blueprints). Un mismo runtime ejecuta IA, misiones, diálogos, eventos de mapa y cutscenes. |
| **Sistemas RPG inspirados en Daggerfall Unity** | Proyecto open-source MIT con 10 años resolviendo exactamente estos sistemas (quests `QRC/QBN`, diálogos, facciones, clases). Es el blueprint de arquitectura, no código copiable. |
| **Fidelidad de época** | Tipografías MS-DOS/rpg 90s y pantallas de carga son parte del producto, no decoración: definen la identidad visual retro. |
| **Backend desde el inicio (API REST + Postgres)** | La biblioteca de juegos del creador y sus preferencias viven en servidor: multidispositivo, backup centralizado y galería pública. No contradice al Publisher: el HTML autónomo sigue siendo la exportación sin cuenta; la galería es una vía adicional de publicar/jugar. |
| **Stack API: Node + Hono + Prisma + Postgres** | Hono (liviano, TypeScript end-to-end, validación Zod nativa). **Prisma** como ORM sobre PostgreSQL con `projects` como **JSONB** (documento v2 completo), migraciones versionadas (`prisma migrate`) y Prisma Studio para inspección. Auth **JWT propios + bcrypt**, sesión stateless, sin proveedor OAuth por ahora. Blobs en filesystem del servidor (S3/R2 opcional en el futuro). |

---

## 3. Análisis de los componentes del motor

| Componente | ¿Se crea? | Forma concreta | Justificación |
|---|---|---|---|
| **Sistema de renderizado** | ✅ Sí | Motor **dual**: `retro` (raycaster TS sobre Canvas 2D) y `3d` (Three.js/WebGL) con cámara **perspectiva** (juego) y **ortográfica** (vista top-down del editor). | Ya decidido; Three.js evita reinventar WebGL. |
| **Motor de físicas** | ✅ Sí (ligero) | Módulo `src/core/physics` **cinemático para el género**: mover-y-colisionar contra sectores (muros, alturas piso/techo), gravedad para saltos, escaleras/elevadores, zonas trigger. | Ver §2: física *de género* cubre el 100% de las mecánicas pedidas (saltos, rampas, pisos) sin el costo de un Rigidbody completo. |
| **Gestor de audio** | ✅ Sí | Módulo `src/core/audio` sobre **Web Audio API** (stdio del navegador, sin librería): `PannerNode` para **sonido espacial 3D**, música de fondo en loop, SFX one-shot, mixers por categoría. | Nunca se había contemplado; necesario en cualquier RPG. |
| **Sistema de scripting** | ❌ NO como código | **Visual Scripting Engine + Blueprint Editor**: grafos de nodos (Eventos/Condiciones/Acciones/Variables/Flujo) unidos con cables. **Nunca C#/C++.** | Requisito del usuario: arrastrar bloques y unirlos, no escribir código. |

---

## 4. Arquitectura general

```
┌─────────────────────────────── STUDIO (SPA Vite, herramientas) ───────────────────────────┐
│ Game Library │ Launcher │ Asset Manager │ Level Editor │ Blueprint │ AI │ Quest │ …        │
│ Dialogue │ Font Manager │ Loading Editor │ Publisher (HTML · galería)                      │
└──────────────────────────────────────┬────────────────────────────────────────────────────┘
                                       │  fetch → /api/* (REST; en dev el proxy del dev-server)
┌──────────────────────────────────────▼──────────────────── API (Node + Hono) ─────────────┐
│ /auth (JWT) │ /projects CRUD │ /assets (blobs) │ /templates (seed) │ /gallery (/play/:slug) │
└──────────────────────────────────────┬──────────────────────────────┬──────────────────────┘
                                       ▼                              ▼
        ┌──────────────── Postgres ──────────────┐    ┌── almacén de blobs ──┐
        │ users · projects (JSONB) · assets ·    │    │ filesystem del       │
        │ gallery · templates (plantillas seed)  │    │ servidor (S3/R2 fut.)│
        └────────────────────────────────────────┘    └──────────────────────┘

RUNTIME (motores) — leen el mismo project.json v2 (local en el Studio o servido por /gallery)
Core: ECS, game loop, eventos, input, física cinemática, audio, save/load
Render:  Retro (raycaster Canvas)   │   3D (Three.js + sector system + terrain)
Systems: player, ai, combat, magic, inventory/trade, quests, dialogue, progression,
         visualscript (blueprints)
```

**Principio rector:** nada duplicado entre motores salvo el render; todo lo demás vive una vez en Core/Systems y sirve a ambos.

---

## 5. Modelo de datos (`project.json`)

```jsonc
{
  "meta":       { "name", "schemaVersion", "renderMode": "retro" | "3d", "author" },
  "settings":   { "resolution", "fov", "playerStart", "dayNight" },       // por mapa
  "textures":   [ { "id", "src", "repeat", "isTransparent" } ],
  "sprites":    [ { "id", "sheet", "frames", "animations", "scale" } ],   // salida del sprite pipeline
  "fonts":      [ { "id", "atlas", "glyphsSz", "baseline" } ],            // tipografías DOS (bitmap)
  "textStyles": [ { "id", "fontId", "sizePx", "color", "shadow" } ],
  "audio":      [ { "id", "src", "loop", "volume", "spatial": true } ],
  "loading":    [ { "id", "bg", "progressBar", "tips": [ ... ] } ],       // pantallas de carga
  "map":        {
    "size", "grid": [],                          // solo retro: ids de tiles
    "sectors": [ { "id", "floorH", "ceilH",      // retro-vertical + 3d
                   "floorTex", "ceilTex",
                   "walls": [ { "a", "b", "tex", "portalsTo" } ] } ],
    "terrain":  [ { "x", "y", "h" } ],           // 3d exterior (xnGine-outdoor)
    "zones":    [ { "id", "trigger", "blockId" | "blueprintId" } ]
  },
  "entities":   [ { "id", "type", "sprite", "pos": {x,y,z},
                    "behavior" | "blockId" | "blueprintId", "stats" } ],
  "blocks":     [ { "id", "category": "doors|ai|combat|motion|ambient",
                    "graph": "<blueprintId>", "params": [...] } ],        // bloques predefinidos
  "blueprints": [ { "id", "nodes": [ ... ], "wires": [ ... ] } ],          // visual scripting
  "behaviors":  [ { "id", "fsm": { estados y transiciones } } ],
  "items":      [ { "id", "name", "type", "effects", "price", "icon", "stackable" } ],
  "spells":     [ { "id", "name", "school", "manaCost", "effects", "fx" } ],
  "npc":        [ { "id", "sprite", "dialogueId", "faction", "shopId" } ],
  "dialogue":   [ { "id", "nodes": [ { "text", "options", "conditions", "actions" } ] } ],
  "quests":     [ { "id", "title", "stages": [ { "step", "condition", "action" } ], "rewards" } ],
  "economy":    [ { "id", "currency", "shops": [ { "items", "prices", "restock" } ] } ],
  "progression":[ { "id", "class", "attributes", "skills", "xpCurve", "perLevel" } ],
  "localization": { "es": { ... }, "en": { ... } }
}
```

Regla: **schema versionado + validadores (Zod)**. Una herramienta o motor que reciba un proyecto de versión distinta avisa y migra.

### Schema v2 (aditivo, retrocompatible con v1)

El de-hardcoding del motor pasa estas constantes a *datos del juego* (elimina índices y magia dura del código):

- `settings.floorTexture` / `settings.ceilingTexture` → ids de textura (reemplazan los índices fijos 3/4/6 del raycaster).
- `sprites[].flags { translucent?, kind? }` → reemplaza el `texture === 10` (luz) y la coloración por índice en el minimapa.
- `settings.minimap { enabled?, colors { wall, player, sprite } }` → reemplaza los colores fijos del HUD.

Migración automatizada v1→v2 (migrator Zod): un proyecto v1 se carga y se normaliza a v2 sin intervención.

### Entidades del servidor (Postgres)

> **Esquema completo en `DATABASE.md`** (fuente de verdad del esquema; de ahí se genera `server/db/schema.prisma`).

| Tabla | Campos clave | Uso |
|---|---|---|
| `persona` | id, nombre, apellido, email_publico, bio, avatar_path | Datos reales del individuo (públicos) |
| `usuario` | id, persona_id (1:1), rol_id (N:1), login (único), password_hash | Credenciales de acceso y sesión JWT |
| `rol` | id, nombre (único: admin/creador), descripcion | Tipos de usuario |
| `proyecto` | id, propietario_id (→usuario), nombre, slug, **estado** (`EN_DESARROLLO`/`PUBLICADO`), schema_version, render_mode, data (**JSONB** con el documento v2 completo), thumbnail_path, published_at | Biblioteca de juegos del creador; **todo el juego vive en `data`** |
| `asset` | id, propietario_id, proyecto_id, nombre, tipo (texture/sprite/audio/font/modelo), mime, tamano_bytes, ruta (único), hash | Blobs: metadatos en DB, **bytes en filesystem**, ruta en `asset.ruta` |
| `galeria` | id, proyecto_id (1:1), slug (único), titulo, descripcion, visitas | Publicación pública `/play/:slug` (proyecto con `estado=PUBLICADO`) |
| `plantilla` | id, nombre, descripcion, data (JSONB v2) | Plantillas semilla (incluye el demo) |

**Regla transversal:** **toda la data del juego se persiste en la DB** (Postgres vía Prisma): el `project.json` completo en `proyecto.data` (JSONB) y las rutas de assets en `asset.ruta`. Nada hardcodeado ni almacenado solo local/flags. El único disco es el filesystem de blobs para los bytes de los assets.

---

## 5b. Contrato de comunicación Front ⇄ Backend

Todo `fetch` de la SPA hacia `/api/*` devuelve la **misma estructura JSON**. Es el único contrato de respuesta entre front y backend: los componentes de UI solo leen `success`, `data` y `error`, nunca la forma interna del endpoint.

### Envoltorio estándar de respuesta

```jsonc
{
  "success": true,                // boolean
  "data":     { ... },            // object | null — payload en caso de éxito (null en POST sin cuerpo)
  "error":    null                // null en caso de éxito
}
```

```jsonc
{
  "success": false,
  "data":     null,
  "error": {
    "code":    "PROJECT_NOT_FOUND",   // código estable (string), clave del diccionario
    "message": "El proyecto no existe", // mensaje legible para el usuario final
    "details": { "id": "abc123" }       // any — opcional, contexto técnico para depurar
  }
}
```

**Reglas del contrato:**
- `success: true` ⇒ `data` = payload (nunca `null` salvo en acciones sin retorno) y `error = null`.
- `success: false` ⇒ `data = null` y `error` siempre presente con `code` + `message`.
- El cliente NUNCA parsea el body según el endpoint; **siempre** lee el envoltorio.
- HTTP status: 200/201/204 en éxito; 400/401/403/404/409/422/500 en error (el status HTTP complementa, pero el flujo real lo decide `success`/`code`).

### Códigos de error (diccionario centralizado)

Todos los códigos viven en un **único archivo** del servidor (`server/src/errors/codes.ts`) y del cliente (`src/api/errors.ts`), tipo-enlazados. Tabla no exhaustiva:

| Código | HTTP | Mensaje | Cuándo |
|--------|------|---------|--------|
| `VALIDATION_ERROR` | 422 | Datos inválidos | Zod falla (schema de entrada) |
| `UNAUTHORIZED` | 401 | No autenticado | Falta/expira el JWT |
| `FORBIDDEN` | 403 | Sin permiso | Autenticado pero sin acceso al recurso |
| `NOT_FOUND` | 404 | No encontrado | Recurso genérico inexistente |
| `PROJECT_NOT_FOUND` | 404 | Proyecto no existe | `id` de proyecto inválido |
| `ASSET_NOT_FOUND` | 404 | Asset no existe | `id` de asset inválido |
| `EMAIL_IN_USE` | 409 | Email ya registrado | Register con email duplicado |
| `INVALID_CREDENTIALS` | 401 | Credenciales incorrectas | Login fallido |
| `SLUG_TAKEN` | 409 | Slug de galería ocupado | Publish con slug duplicado |
| `STORAGE_WRITE_ERROR` | 500 | No se pudo escribir el archivo | Fallo en blobs del filesystem |
| `INTERNAL_ERROR` | 500 | Error interno | Cualquier fallo no categorizado |

### Arquitectura del manejo de errores (3 piezas)

```
server/src/
├── errors/
│   ├── codes.ts              ← diccionario de códigos + mensajes (fuente única)
│   ├── AppError.ts           ← clase AppError{ code, message, status, details }
│   └── handler.ts            ← interceptor global (Hono app.onError)
└── routes/                   ← cada endpoint lanza AppError o usa handler; NUNCA responde JSON suelto
```

1. **`codes.ts`** — diccionario: `export const ERRORS = { VALIDATION_ERROR: { status: 422, message: '...' }, ... }`. Un cambio aquí añade/edita un código y su mensaje en un solo lugar (también sirve como documentación viva de la API).

2. **`AppError`** — clase con `{ code, message, status, details }`. Los endpoints `throw new AppError('PROJECT_NOT_FOUND', { id })`. También hay helpers: `throwBadRequest(msg)` … o `AppError.fromZod(zodError)` que mapea el error de Zod a `VALIDATION_ERROR` con `details.issues`.

3. **`handler.ts`** — **interceptor global** registrado en Hono (`app.onError((err, c) => ...)`). Atrapa:
   - `AppError` → responde su `{ success:false, data:null, error:{ code, message, details } }` con su `status`.
   - `AppError.fromZod` / errores de validación → `VALIDATION_ERROR` (422).
   - cualquier otro `Error` → `log error` y responde `INTERNAL_ERROR` (500), **sin filtrar stack trace ni datos internos** al front.
   - not-found de ruta no existente → `NOT_FOUND` (404).

**Flujo de un endpoint:**
```ts
// routes/projects.ts
app.get('/api/projects/:id', async (c) => {
  const project = await db.project.findUnique({ where: { id: c.req.param('id') } });
  if (!project) throw new AppError('PROJECT_NOT_FOUND', { id: c.req.param('id') });
  return c.json(ok(project));
});
```
El endpoint solo se preocupa de: validar, llamar a la DB y `throw` cuando algo no cuadra. **Toda la respuesta de error la unifica el interceptor** → cero JSON suelto `{ error: '...' }` repartido por el código.

### Cliente tipado (front)

`src/api/client.ts` expone un `apiFetch<T>(...)` que desenvuelve el contrato y lanza excepciones tipadas del lado cliente:

```ts
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!body.success) throw new ApiError(body.error);   // ApiError{ code, message, details }
  return body.data as T;
}
```

Así la UI hace `const project = await apiFetch('/api/projects/1')` y el **toast/interceptor global del front** captura `ApiError` para mostrar el mensaje al usuario (ver `DESIGN.md` §5.6). El front puede traducir `code` → mensaje localizado sin depender del `message` inglés del server si lo desea.

---

## 6. Catálogo de herramientas

Para cada una: **objetivo · justificación · flujo de uso · entradas/salidas · estado**.

| # | Herramienta | Estado | Fase |
|---|---|---|---|
| 6.1 | Sprite Slicer + Background Remover | ✅ hecho → **adaptar** a TS/AssetManager | F3 |
| 6.2 | Sprite Animator | ⏳ pendiente (heredado) | F3 |
| 6.3 | Entity Builder | ⏳ pendiente (heredado) | F3 |
| 6.4 | Asset Manager (texturas, sprites, audio, fuentes, modelos) | 🆕 | F3 |
| 6.5 | Level Editor (mapa + sectores + altura Z + rampas) | 🆕 **primer hito** | F1 |
| 6.6 | 3D Viewport / Playtest (perspectiva + orto) | 🆕 | F1–F2 |
| 6.7 | Behavior / AI Editor (sobre blueprint runtime) | 🆕 | F4 |
| 6.8 | 5.Quest Editor (genera blueprints) | 🆕 | F8 |
| 6.9 | Dialogue Editor (genera blueprints) | 🆕 | F7 |
| 6.10 | Combat Editor (armas, proyectiles, anims de combate) | 🆕 | F5 |
| 6.11 | Magic / Skills Editor | 🆕 | F6 |
| 6.12 | Items / Economy Editor | 🆕 | F5/F9 |
| 6.13 | Progression / Class Editor | 🆕 | F10 |
| 6.14 | **Visual Scripting / Blueprint Editor** | 🆕 **central** | F4 |
| 6.15 | Tipografías DOS / Font Manager | 🆕 | F3 |
| 6.16 | Pantallas de carga / Loading Editor | 🆕 | F3 |
| 6.17 | Bloques predefinidos reutilizables (catálogo) | 🆕 | F4 (catálogo base) · F11 (editor de bloques) |
| 6.18 | Project Manager / Launcher | ✅ hecho (commit `111782f`) | F0.5 |
| 6.19 | Publisher (Player + pantalla de carga) | 🆕 | F12 |
| 6.20 | **Game Library / DB Manager** 🆕 | ✅ hecho (commit `111782f`) | F0.5 |
| 6.21 | **Cloud Gallery (publicar online)** 🆕 | 🆕 API y reproductor listos; publicación desde F12 | F12 |
| 6.22 | **Design System / Componentes reutilizables** 🆕 | 🆕 | F0.7 |

### 6.1 Sprite Slicer + Background Remover — ✅ YA HECHO (adaptar)
- **Objetivo:** cortar hojas de sprites (p.ej. Daedroth 718×1509px) en frames y eliminar fondo.
- **Justificación:** puerta de entrada del asset 2D; sin sprites no hay entidades (todo en este género es billboard).
- **Flujo:** arrastrar PNG → detectar grilla/frames → ajustar tolerancia, flood-fill/color key, trim → exportar frames + `sprites.json`.
- **I/O:** PNG → frames PNG + JSON.
- **Adaptación:** el trabajo de `tools/sprite-slicer.js` (detector, background removal, UI) está funcional. Migrar a TS bajo `src/studio/sprite-tools/`, conectarlo al Asset Manager y aceptar las hojas grandes de `assets/daggerfall/`.

### 6.2 Sprite Animator — ⏳ pendiente
- **Objetivo:** definir animaciones (idle/walk/attack/death) sobre frames, con fps y loop, y previsualizarlas.
- **Justificación:** el datum de animación es la base de la IA y del combate.
- **Flujo:** seleccionar frames → nombrar anim → marcar fps/loop → previsualizar ▶ → guardar en `sprites[].animations`.

### 6.3 Entity Builder — ⏳ pendiente
- **Objetivo:** convertir sprite animado + configuración en una entidad colocable (enemy/npc/prop).
- **Justificación:** puente sprites→mundo; define stats y comportamiento sin tocar código.
- **Flujo:** elegir sprite → tipo → stats (hp/damage/speed/sight) → comportamiento → posición → guardar en `entities[]`.

### 6.4 Asset Manager — 🆕 (ampliado)
- **Objetivo:** biblioteca central (texturas 64×64, sprites, audio, fuentes, modelos). Importar, organizar, previsualizar, optimizar.
- **Justificación:** un solo lugar que resuelve `id → archivo` y asegura que las exportaciones solo incluyan lo usado.
- **Flujo:** importar → organizar → id autogenerado → disponible en dropdowns de todos los editores → informe de assets sin usar.

### 6.5 Level Editor (mapa + verticalidad) — 🆕 PRIMER HITO
- **Objetivo:** editar el mundo: grid de tiles (retro), sectores con altura de piso/techo, rampas, zonas de trigger y colocación de entidades.
- **Justificación:** corazón del creador; todo lo demás pende de tener un mundo recorrible en 3D.
- **Flujo:**
  1. Abrir vista 2D (top-down, pintar por tiles) o 3D (viewport Three.js, cámara orbit).
  2. Panel de materiales (Asset Manager) → pintar suelo/paredes.
  3. Seleccionar sector → arrastrar elevación de piso/techo → rampas y pisos superiores (portales).
  4. Colocar entidades desde el Entity Builder, ajustar rotación/z (drag & drop al viewport).
  5. Zonas de trigger (entrar/colisionar/activar) → enlazar blueprint o bloque.
  6. Playtest dentro del editor (F5).
- **I/O:** `map` + `entities`.

### 6.6 3D Viewport / Playtest — 🆕
- **Objetivo:** vista de juego en vivo dentro del Studio + vista orbit para editar.
- **Justificación:** sin playtest en vivo no se valida verticalidad, colisión ni dificultad.
- **Flujo:** F5 → runtime con el proyecto en memoria → WASD + ratón → F6 vuelve al editor manteniendo la posición (edición en vivo).

### 6.7 Behavior / AI Editor — 🆕
- **Objetivo:** diseñar el cerebro de enemigos y NPC: máquina de estados con condiciones y acciones, ejecutándose sobre el runtime de blueprints.
- **Justificación:** la IA varía de juego a juego; editor visual ≫ código por entidad.
- **Flujo:** estado → transición (condición) → acción → asignar a entidad, o arrastrar un **bloque de IA predefinido** (patrulla, emboscada).
- **I/O:** `behaviors[]` + `entities[].behavior`.

### 6.8 Quest Editor — 🆕
- **Objetivo:** misiones en etapas (trigger → condición → acción → recompensa), patrón Daggerfall `QRC/QBN` simplificado. Se genera un blueprint por detrás.
- **Justificación:** columna vertebral del RPG.
- **Flujo:** crear quest → título/descripción → lista de etapas (condición + acción) → recompensas → probar con consola de depuración (`startquest`).
- **I/O:** `quests[]` + `blueprints[]`.

### 6.9 Dialogue Editor — 🆕
- **Objetivo:** árboles de diálogo por nodos: texto, opciones, retratos, condiciones y acciones.
- **Justificación:** NPCs sin diálogo no son NPCs.
- **Flujo:** nodo raíz → ramas/opciones → condiciones en aristas → acciones al llegar → previsualizar.
- **I/O:** `npc[]` + `dialogue[]` + `blueprints[]`.

### 6.10 Combat Editor — 🆕
- **Objetivo:** armas cuerpo a cuerpo y a distancia, proyectiles, anims de combate, daño, alcance, cadencia.
- **Justificación:** el combate es mecánica central; definirlo por datos permite balancear sin código.
- **Flujo:** crear arma → stats → sprite/anim → sonido → proyectil (si aplica) → asignar.
- **I/O:** `items[]` (type: weapon) + `entities[].stats`.

### 6.11 Magic / Skills Editor — 🆕
- **Objetivo:** hechizos y habilidades: escuela, coste de mana, efectos, FX.
- **Justificación:** un editor de efectos reutilizables ahorra reimplementar cada spell.
- **Flujo:** crear spell → escuela/stat → coste → efecto(s) → FX → balancear.
- **I/O:** `spells[]`.

### 6.12 Items / Economy Editor — 🆕
- **Objetivo:** items, moneda y tiendas con restock.
- **Justificación:** comercio y loot dan el loop de progresión.
- **Flujo:** crear item → tipo/stats/icono/precio → tienda → inventario → NPC vendedor enlaza tienda.
- **I/O:** `items[]` + `economy[]`.

### 6.13 Progression / Class Editor — 🆕
- **Objetivo:** clases, atributos, skills, curva XP y ganancias por nivel.
- **Justificación:** el sistema de niveles es el contrato de combate/skills/magia.
- **Flujo:** clase → atributos base → skills entrenables → curva XP → beneficios por nivel → XP que otorgan los enemigos.
- **I/O:** `progression[]`.

### 6.14 Visual Scripting / Blueprint Editor — 🆕 CENTRAL
- **Objetivo:** programar la lógica del juego **sin escribir una línea**: grafo de nodos conectados por cables (estilo **Unreal Blueprints**).
- **Justificación:** requisito central del usuario; **unifica** IA, misiones, diálogos, eventos de mapa y cutscenes en un solo runtime.
- **Flujo:**
  1. Panel de nodos: *Eventos* (onEnterZona, onInteract, onKill, onTimer), *Condiciones* (distancia, hp, switch/var, questStage), *Acciones* (mover, atacar, dar item, sonido, diálogo, flag), *Variables/Flujo* (branch, wait, for, math).
  2. Crear nodos con clic/drag → arrastrar pin → soltar en pin para conectar.
  3. Guardar como **bloque reutilizable** → aparece en la librería predefinida (6.17).
- **Dos niveles de dificultad:**
  - **Modo fácil:** formulario tipo RPG Maker ("en esta zona → al entrar → mostrar diálogo") que **genera el grafo** por detrás.
  - **Modo avanzado:** editor de grafos completo.
- **I/O:** `blueprints[]`; referenciado desde quests, diálogos, AI, zones y cutscenes.
- **Runtime compartido:** `src/game/visualscript/` ejecutado por ambos motores.

### 6.15 Tipografías DOS / Font Manager — 🆕
- **Objetivo:** caja de fuentes pixeladas y gestor de tipografía para HUD, diálogos, banners y menús.
- **Justificación:** el 90% de la identidad visual retro es la letra (VGA 8×16, menús DOS). Sin tipos de época el juego no "se siente" de los 90.
- **Contenido incluido:** bundle de fuentes de dominio público/OFL — `Px437` (DOS VGA), `VT323`, `Press Start 2P` — empotradas en el motor.
- **Flujo:** elegir fuente → crear "estilos de texto" (tamaño, color, sombra) → aplicar a HUD/diálogo/banners → **convertidor TTF→bitmap** (rasteriza a atlas pixelado con `imageSmoothing=false`).
- **I/O:** `fonts[]` + `textStyles[]` + atlas → Asset Manager. El runtime dibuja texto con canvas sobre atlas bitmap (sin CSS en los juegos).

### 6.16 Pantallas de carga / Loading Editor — 🆕
- **Objetivo:** editor de pantallas de carga: splash + barra de progreso + consejos.
- **Justificación:** todo RPG de la época tiene pantalla de carga; además el Player muestra algo mientras precarga texturas/audio.
- **Flujo:** imagen o color → barra de progreso / ruleta / "tips aleatorios" → tiempo mínimo de display → previsualizar.
- **I/O:** `loading[]`. El runtime precarga mostrándola; el Publisher la usa como pantalla del HTML autónomo.

### 6.17 Bloques predefinidos reutilizables — 🆕
- **Objetivo:** bloques listos que combinan **animación + comportamiento**: abrir/cerrar puertas, movimientos de enemigos (patrulla, zigzag, emboscada), movimientos de combate (carga, retroceso, crítico), saltos, elevador, antorcha parpadeante, teletransporte, cofre al abrir.
- **Justificación:** "fácil = arrastrar y unir". El creador no monta puertas/IA de cero.
- **Flujo:** Entity Builder o Level Editor → "Añadir bloque predefinido" → buscar por categoría → arrastrar sobre entidad → configurar pocos parámetros.
- **Implementación:** sub-grafos de blueprint o animation clips empaquetados en `src/data/blocks/` (biblioteca incorporada + extensible). El editor los muestra como fichas de puzzle.
- **I/O:** `blocks[]` / `prefabs[]`, referenciados desde `entities[]` y `map.zones[]`.

### 6.18 Project Manager / Launcher — 🆕
- **Objetivo:** crear, abrir, duplicar, importar/exportar y configurar proyectos (renderMode, resolución, autor).
- **Justificación:** organización de la unidad de trabajo; desde F0.5 la unidad vive en el servidor y es multidispositivo.
- **Flujo:** landing → nuevo proyecto (plantilla del servidor) → elegir modo (`retro`/`3d`) → proyecto de arranque con assets de ejemplo → guardar en la API.
- **Persistencia:** CRUD vía `/api/projects` + `/api/assets`; export/import a `*.ragproj` (zip) para backup, compartir y commitear.

### 6.19 Publisher — 🆕
- **Objetivo:** exportar el juego a un HTML autónomo (bundle JS + assets usados + audio + fuentes + pantalla de carga) **y**, con cuenta, publicarlo en la galería.
- **Justificación:** el "cierre" del creador; el HTML sigue funcionando sin cuenta ni servidor.
- **Flujo:** seleccionar proyecto → build optimizado (tree-shake del motor dual según `renderMode`) → descarga `mi-juego.html` → jugar/compartir; o **Publicar en galería** → el juego queda jugable en `/play/:slug`.

### 6.20 Game Library / DB Manager — 🆕
- **Objetivo:** biblioteca personal de juegos del creador, servida por la API: listar, buscar, duplicar, respaldar y borrar proyectos de cualquier dispositivo con la misma cuenta.
- **Justificación:** el multidispositivo es la razón del backend; sin una biblioteca gestionable, los proyectos quedarían dispersos.
- **Flujo:** grid de proyectos (thumbnail, nombre, `renderMode`, fecha, tamaño) → filtro/búsqueda → crear/duplicar/renombrar → abrir en editor → **backup/restore `.ragproj`** → borrar con confirmación.
- **I/O:** `/api/projects` (CRUD), `/api/assets` (blobs), thumbnail autogenerado por el runtime.

### 6.21 Cloud Gallery — 🆕
- **Objetivo:** publicar juegos en una galería pública con URL jugable (`/play/:slug`), portada y estadísticas.
- **Justificación:** el backend habilita que los juegos se *jueguen online* sin que el autor tenga servidor propio; convive con el HTML autónomo.
- **Flujo:** Publish → "Publicar en galería" (slug, descripción, portada) → vista pública jugable (mismo runtime que el editor) → contador de visitas → despublícar cuando se quiera.
- **I/O:** `gallery` (slug, description, visits) + el `project.json` v2 de la fila de `projects`. Reutiliza el build optimizado de 6.19.

### 6.22 Design System / Componentes reutilizables — 🆕
- **Objetivo:** paleta de colores (tokens CSS), tipografía, espaciado, y catálogo completo de componentes UI reutilizables para todo el Studio.
- **Justificación:** sin un design system, cada herramienta inventa su UI → inconsistencia visual, duplicación de código, y más trabajo para mantener. Un sistema de componentes unificado permite construir herramientas rápidamente con look profesional.
- **Componentes:**
  - **Botones:** Primary, Secondary, Danger, Ghost, Icon (5 variantes × 3 tamaños × 4 estados)
  - **Inputs:** TextInput, NumberInput, Select, Checkbox, Slider, ColorInput, FileInput
  - **Tabs:** headers con contenido, scrollable si exceden
  - **Tablas:** sortable, selectables, empty state
  - **Modales:** overlay + dialog con focus trap, animaciones
  - **Toasts:** success, warning, error, info con auto-dismiss
  - **Loading:** Spinner circular, Skeleton shimmer, Progress bar
  - **Estados:** Vacío (icono + acción), Error (detalle + reintentar), Carga (spinner + texto)
  - **Iconos:** lucide SVG inline (16×16, 20×20), hereda color del padre
  - **Layout:** Panel (header colapsable), SplitView (redimensionable), Stack, ScrollArea, Divider
- **Flujo:** ver `DESIGN.md` para paleta, tipografía, espaciado y patrones de comportamiento.
- **I/O:** `src/studio/ui/` — componentes vanilla JS, migrables a Lit/Svelte.
- **Entregable:** demo page (`/components`) que muestra todos los componentes en todos sus estados.

---

## 7. Flujo end-to-end del creador

```
1. Game Library: login → nuevo proyecto desde plantilla (elijo "3d")
2. Asset Manager: arrastro texturas + sprites Daggerfall
3. Sprite pipeline: slicer → animator → entity builder
4. Level Editor: pinto muros, doy altura al piso, hago una rampa, coloco la cámara
5. Playtest (F5): camino por la rampa y subo de planta  ✔ verticalidad
6. Blueprint: arrastro nodos → enemigo idle→chase→attack (o uso un bloque predefinido)
7. Dialogue/Quest/Items: NPC con tienda y una misión de entrega
8. Font Manager: tipografía DOS para el HUD
9. Loading Editor: pantalla de carga con el logo
10. Publisher → HTML jugable con su pantalla de carga, o Publicar en galería (/play/:slug)
```

---

## 8. Fases de implementación

| Fase | Entregable | Depende de | Criterio de aceptación |
|------|-----------|-----------|------------------------|
| **F0** | Toolchain Vite+TS+Vitest; migrar raycaster a `src/render/retro/`; mapa a `project.json`; tests base; Launcher mínimo | — | `npm run dev` corre el mismo mundo retro en TS; `vitest` verde |
| **F0.5** | **Backend + base de datos**: API Hono+**Prisma**+Postgres (auth JWT, CRUD de `/api/projects` y `/api/assets`, `/api/templates` seed, `/api/gallery`); **Game Library 6.20**; migración a **schema v2** + de-hardcoding del motor (piso/techo, flags de sprite, minimapa) | F0 | `npm run dev` levanta SPA+API; la biblioteca lista/crea/guarda proyectos por API; el mundo retro lee `project.json` v2; migración v1→v2 automática |
| **F0.7** | **Design System + componentes reutilizables**: paleta de colores (tokens CSS), tipografía, espaciado, y componentes UI: botones (5 variantes), inputs (text, number, select, checkbox, slider, color, file), tabs, tablas, modales, toasts, spinners, skeletons, progress bars, estados (vacío, error, carga), iconos (lucide SVG), layout helpers (Panel, SplitView, Stack, ScrollArea, Divider). Ver `DESIGN.md`. | F0.5 | Todos los componentes renderizados en una **demo page** (`/components`); paleta dark consistente; cada componente con 3+ estados (default, hover, disabled); atajos de teclado documentados |
| **F1** | **Level Editor + viewport 3D + playtest** | F0.7 | Pinto un mapa con rampas/pisos, lo camino en 3D y guardo/cargo (por API) |
| **F2** | Motor 3D jugable: sector system, colisión por altura, gravedad/saltos (física cinemática), sprites billboard, minimapa 3D, **módulo de audio** (Web Audio espacial) | F1 | Rampa, escaleras y piso superior en vivo; sprites bien ocluidos; sonido espacial |
| **F3** | Adaptar sprite pipeline heredado; Asset Manager (texturas/sprites/audio/fuentes); **Font Manager DOS** + convertidor TTF→bitmap; **pantallas de carga** | F0 | Daedroth animado en el editor; HUD con tipo DOS; pantalla de carga configurable |
| **F4** | **Blueprint Editor completo + runtime**; pathfinding A*; IA construida sobre blueprints; **catálogo base de bloques** (puertas, patrulla, carga de combate, salto, antorcha, teletransporte); puertas/llaves/elevadores via bloques | F2, F3 | Enemigo con IA de blueprints persigue/ataca; puerta con llave; bloque predefinido arrastrado a una entidad |
| **F5** | Combate + inventario/equipo (sobre blueprints) | F4 | Matar enemigo → loot al inventario |
| **F6** | Magia y habilidades (spells, mana, efectos, FX) | F5 | Hechizo de fuego hace daño y cuesta mana |
| **F7** | Diálogos (nodos + condiciones/acciones → blueprints) | F4 | NPC con árbol de diálogo y condición |
| **F8** | Misiones (etapas/condiciones/recompensas → blueprints) | F5, F7 | Quest completa de inicio a fin con consola de depuración |
| **F9** | Comercio (tiendas, moneda, restock, NPC vendedor) | F5 | Compra/venta en tienda con moneda y restock |
| **F10** | Progresión (clases, atributos, XP, skills, subida de nivel) | F6, F8 | Subir de nivel, puntos de skill, curva XP |
| **F11** | Editor de **catálogo de bloques propios** (publicar bloques reutilizables); cutscenes/eventos avanzados | F4 | Creador agrupa nodos como bloque y lo reutiliza en otro mapa |
| **F12** | **Publisher**: HTML autónomo con pantalla de carga y solo lo usado (tipos, audio, fuentes, blueprints) + **publicación en la galería** (`/play/:slug`) | todas | HTML exportado juega igual que el dev; y un proyecto publicado en la galería es jugable online |

Verificación continua: `vitest run` + demo jugable; cada fase cierra con una demo en `localhost:8080`.

---

## 9. Herencia de `SPRITE_TOOLS_PLAN.md` (adaptar, no conservar tal cual)

El plan anterior era *solo* herramientas de sprites para un motor estático. Su intención y lo ya construido se conservan, marcado como **adaptación**:

| Antes (SPRITE_TOOLS_PLAN) | Estado | Ahora (ROADMAP) |
|---|---|---|
| Fase 1 — Sprite Slicer + background removal | ✅ **COMPLETADO** (`tools/sprite-slicer.js` + UI en `tools/index.html`) | **6.1** → **ADAPTAR**: migrar a TS, integrar al Asset Manager y a `assets/daggerfall/` |
| Fase 2 — Sprite Animator | ⏳ pendiente | **6.2** |
| Fase 3 — Entity Builder | ⏳ pendiente | **6.3** |
| Fase 4 — SpriteSystem del motor | ⏳ pendiente | Pasa a **Core/Systems de ambos motores** (sprites billboard con Z-buffer) en F2/F3 |
| Fase 5 — UI de herramientas | ⏳ pendiente | Su layout se reutiliza como *chrome* base del Studio (paneles / viewport) |
| Fase 6 — Mapa de ejemplo | ⏳ pendiente | Se convierte en la **plantilla de arranque** de proyectos nuevos |

La diferencia estructural: el pipeline de sprites pasa de ser el fin a ser **una fase temprana de un sistema completo de creación de RPG**, con el modelo de datos unificado como columna vertebral.

---

## 10. Estructura de directorios objetivo

```
raycastjs/
├── index.html                → launcher (Studio / Jugar)
├── vite.config.ts · tsconfig.json · package.json
├── public/
│   ├── textures/
│   └── projects-demo/        → ejemplos exportados
├── assets/
│   ├── images/daggerfall/    → referencia de prueba
│   └── fonts/                → fuentes DOS empotradas (Px437, VT323, Press Start 2P)
├── src/
│   ├── core/                 → ECS, loop, eventos, input, física cinemática, audio, save/load
│   ├── data/                 → schemas (Zod), loaders, migraciones, db-client (API), blocks/
│   ├── render/
│   │   ├── retro/            → raycaster TS (heredado, migrado)
│   │   └── render3d/         → Three.js + sector system + terrain
│   ├── game/
│   │   ├── player/  ai/  combat/  magic/  inventory-trade/
│   │   ├── quests/  dialogue/  progression/  events/
│   │   └── visualscript/     → runtime de blueprints
│   ├── studio/
│   │   ├── ui/                 → 6.22 Design System: componentes reutilizables (botones, inputs, tabs, tablas, modales, toasts, spinners, iconos, layout)
│   │   ├── launcher/
│   │   ├── game-library/     → 6.20 biblioteca de juegos (CRUD vía API)
│   │   ├── asset-manager/
│   │   ├── sprite-tools/     → slicer (adaptado) + animator + entity builder
│   │   ├── level-editor/     → vista 2D + viewport 3D + playtest
│   │   ├── blueprints/       → editor de grafos (Unreal-style)
│   │   ├── ai-editor/  quest-editor/  dialogue-editor/
│   │   ├── combat-editor/  magic-editor/  economy-editor/
│   │   ├── progression-editor/  events/  blocks-catalog/
│   │   ├── font-manager/     → tipografías DOS + convertidor TTF→bitmap
│   │   ├── loading-editor/
│   │   └── publisher/        → 6.19 HTML autónomo + 6.21 publicación en galería
│   └── player/               → runtime standalone exportable
├── server/
│   ├── src/
│   │   ├── index.ts          → app Hono (rutas /api/*)
│   │   ├── auth/             → register/login JWT + bcrypt (casero)
│   │   ├── routes/           → projects, assets, templates, gallery
│   │   └── middleware/       → requireAuth, rate-limit, cors
│   ├── db/                   → Prisma schema + migraciones (Postgres) + Prisma Client
│   ├── storage/uploads/      → blobs (texturas/audio/fuentes)
│   └── tests/                → tests de API (Vitest + app Hono)
├── docker-compose.yml        → postgres + api + web (dev/prod)
├── .env.example              → DATABASE_URL · JWT_SECRET · PORT · PUBLIC_URL
├── tools/                    → paso intermedio: se migra a src/studio/sprite-tools/
├── tests/                    → unit + integración (Vitest, front)
└── ROADMAP.md
```

---

## 11. Principios de calidad

- **Energía por mantenimiento:** una prueba que falla = feature no cerrada.
- **Cero duplicación retro/3d:** todo, salvo render, vive una vez.
- **Assets bajo demanda:** el Publisher solo empaqueta lo usado.
- **Reutilizar antes que crear:** Three.js, Vitest, Zod, Web Audio API, Hono, Prisma, PostgreSQL… (regla ponytail: no reinventar stdlib).
- **Servidor desacoplado por API REST:** el Studio habla solo con `/api/*`; cambiar de host/base de datos no toca el front (la SPA es estática y sirve desde cualquier lugar).
- **Drag & drop como estándar de UX:** assets al viewport, bloques a entidades, nodos conectados con cables.
- **Fidelidad retro en cada detalle:** tipografías DOS, pantallas de carga, ruido del píxel.

---

## 12. Estado del plan

| Fase | Estado |
|---|---|
| F0 Toolchain + migración retro | ✅ **Completada** (commit `221ffff`) |
| F0.5 Backend + DB (Hono/Postgres) + Game Library + schema v2 | ✅ **Completada** (commit `111782f`) |
| F0.7 Design System + componentes reutilizables | ⏳ Pendiente |
| F1 Level Editor 3D + viewport + playtest | ⏳ Pendiente |
| F2 Motor 3D + audio + física cinemática | ⏳ Pendiente |
| F3 Pipeline sprites + Asset Manager + Fonts + Loading | ⏳ Pendiente |
| F4 Blueprints + IA + bloques predefinidos | ⏳ Pendiente |
| F5–F12 Sistemas RPG y Publisher | ⏳ Pendiente |