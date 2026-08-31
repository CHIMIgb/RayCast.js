# RayCast.js — RayCast Studio

Creador web de RPG **2.5D / 3D retro** (v0.1.0 · Fase 0: toolchain + motor retro en TypeScript).

## Comandos

```bash
npm install       # instala dependencias
npm run dev       # servidor dev (http://localhost:8080)
npm test          # ejecuta tests de Vitest (una vez)
npm run test:watch
npm run build     # typecheck + build de producción en dist/
npm run preview   # sirve el build
```

## Páginas

- **Juego:** http://localhost:8080/ — carga `public/projects/demo/project.json` en el motor retro.
- **Sprite Slicer:** http://localhost:8080/tools/ — herramienta heredada (se integrará al estudio en F3).

## Controles del juego

- **Mover**: Flechas o W/A/S/D
- **Rotar**: Flechas izquierda/derecha o A/D

## Fase 0 — Arquitectura

El motor `raycasting.js` vanilla (533 líneas) se migró a TypeScript modular. Los datos del mundo ya no viven en código: se declaran en `project.json` (validado con Zod). Esto habilita la Fase 1 (editor de niveles) porque los editores solo escriben JSON validado.

```
raycastjs/
├── index.html                     ← launcher + canvas #screen
├── src/
│   ├── main.ts                    ← boot: carga proyecto y arranca el motor
│   ├── style.css                  ← tema retro del launcher
│   ├── core/
│   │   └── input.ts               ← KeyboardState (WASD + flechas)
│   ├── data/
│   │   ├── schema.ts              ← Schemas Zod del project.json (fuente de verdad)
│   │   └── project.ts             ← loadProject() / parseProject()
│   └── render/retro/
│       ├── math.ts                ← matemática pura del raycaster (testeable)
│       ├── textures.ts            ← carga y post-proceso de texturas/sprites
│       └── raycaster.ts           ← clase RetroGame (DDA, piso/techo, sprites, minimapa)
├── public/
│   ├── projects/demo/project.json ← proyecto demo (grid 24×24, 11 texturas, 19 sprites)
│   └── textures/                  ← 11 texturas 64×64 (movidas desde textures/)
├── tests/
│   ├── project.schema.test.ts     ← validación de schemas
│   ├── demo-project.test.ts       ← el project.json real pasa el schema
│   └── retro.math.test.ts         ← matemática del motor
├── textures/ → public/textures/   (movido por git mv)
├── tools/                         ← Sprite Slicer (adaptar en F3)
├── assets/                        ← sprites de Daggerfall (referencia)
└── ROADMAP.md                     ← Plan maestro: fases F0–F12 y catálogo de herramientas
```

## Modelo de datos (v1)

```jsonc
{
  "meta":    { "name": "Demo LodeV", "schemaVersion": 1, "renderMode": "retro" },
  "settings":{ "resolution": { "width": 640, "height": 480 },
               "playerStart": { "x": 22.0, "y": 11.5, "dirX": -1, "dirY": 0, "planeX": 0, "planeY": 0.66 } },
  "textures":[ { "id": "eagle", "src": "/textures/eagle.png", "isSprite": false }, ... ],
  "sprites": [ { "x": 20.5, "y": 11.5, "texture": 10, "uDiv": 1, "vDiv": 1, "vMove": 0 }, ... ],
  "map":     { "size": { "w": 24, "h": 24 }, "grid": [ ... ] }
}
```

Toda escritura/lectura de proyectos pasa por los schemas Zod de `src/data/schema.ts`; la versión del formato está en `meta.schemaVersion` (hoy `1`).

## Notas

- **Tipografía DOS / pantallas de carga / blueprints**: llegan en F3–F4 (ver `ROADMAP.md`).
- El motor `3d` (WebGL) y el **Level Editor** son la Fase 1.
- El `Sprite Slicer` (`tools/`) se conserva intacto; su integración está planificada en F3.
- El archivo original `raycasting.js` se conserva como referencia de la migración.