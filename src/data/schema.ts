import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas del modelo de datos (project.json) — schemaVersion 2 (aditivo)
// La capa de datos es la columna vertebral del estudio: todo editor escribe
// JSON validado con estos esquemas; todo motor lee JSON validado con ellos.
// v2 es aditivo sobre v1: los campos nuevos tienen defaults, de modo que un
// project.json v1 se parsea igual (migración automática v1→v2).
// ─────────────────────────────────────────────────────────────────────────────

export const RenderModeSchema = z.enum(['retro', '3d']);

// Acepta 1 (v1) o 2; la salida canónica es siempre 2 (se canonicaliza).
export const MetaSchema = z
  .object({
    name: z.string().min(1),
    schemaVersion: z.literal(1).or(z.literal(2)),
    renderMode: RenderModeSchema,
    author: z.string().optional(),
  })
  .transform((meta) => ({ ...meta, schemaVersion: 2 as const }));

export const MinimapColorsSchema = z.object({
  wall: z.string().default('#888888'),
  player: z.string().default('#FF0000'),
  direction: z.string().default('#FFFF00'),
  sprite: z.string().default('#0000FF'),
  byKind: z.array(z.object({ kind: z.string(), color: z.string() })).default([]),
});

export const MinimapSchema = z.object({
  enabled: z.boolean().default(true),
  cellSize: z.number().int().positive().default(6),
  colors: MinimapColorsSchema.default({
    wall: '#888888',
    player: '#FF0000',
    direction: '#FFFF00',
    sprite: '#0000FF',
    byKind: [],
  }),
});

export const SettingsSchema = z.object({
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  playerStart: z.object({
    x: z.number(),
    y: z.number(),
    dirX: z.number(),
    dirY: z.number(),
    planeX: z.number(),
    planeY: z.number(),
  }),
  // v2: de-hardcoding del motor — ids de textura (no índices) para piso/techo.
  // `floorTextureAlt` activa el efecto "checkerboard" alternando dos texturas.
  floorTexture: z.string().default('greystone'),
  floorTextureAlt: z.string().default('bluestone'),
  ceilingTexture: z.string().default('wood'),
  minimap: MinimapSchema.default({
    enabled: true,
    cellSize: 6,
    colors: { wall: '#888888', player: '#FF0000', direction: '#FFFF00', sprite: '#0000FF', byKind: [] },
  }),
});

export const TextureDefSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  width: z.number().int().positive().default(64),
  height: z.number().int().positive().default(64),
  isSprite: z.boolean().default(false),
  repeat: z.boolean().default(false),
});

export const SpriteFlagsSchema = z.object({
  // v2: reemplaza el `texture === 10` del motor (luz = translúcida)
  translucent: z.boolean().default(false),
  // v2: reemplaza la coloración por índice del minimapa (kind → color)
  kind: z.string().optional(),
});

export const SpriteDefSchema = z.object({
  x: z.number(),
  y: z.number(),
  texture: z.number().int().nonnegative(),
  uDiv: z.number().positive().default(1),
  vDiv: z.number().positive().default(1),
  vMove: z.number().default(0),
  flags: SpriteFlagsSchema.default({ translucent: false }),
});

export const MapSchema = z
  .object({
    size: z.object({
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    }),
    grid: z.array(z.array(z.number().int().nonnegative())),
  })
  .superRefine((map, ctx) => {
    const { w, h } = map.size;
    if (map.grid.length !== h) {
      ctx.addIssue({
        code: 'custom',
        path: ['grid'],
        message: `Se esperaban ${h} filas, pero hay ${map.grid.length}`,
      });
      return;
    }
    map.grid.forEach((row, i) => {
      if (row.length !== w) {
        ctx.addIssue({
          code: 'custom',
          path: ['grid', i],
          message: `La fila ${i} tiene ${row.length} celdas; se esperaban ${w}`,
        });
      }
    });
  });

export const ProjectSchema = z.object({
  meta: MetaSchema,
  settings: SettingsSchema,
  textures: z.array(TextureDefSchema).min(1),
  sprites: z.array(SpriteDefSchema).default([]),
  map: MapSchema,
});

// Tipos derivados
export type RenderMode = z.infer<typeof RenderModeSchema>;
export type ProjectMeta = z.infer<typeof MetaSchema>;
export type ProjectSettings = z.infer<typeof SettingsSchema>;
export type MinimapConfig = z.infer<typeof MinimapSchema>;
export type MinimapColors = z.infer<typeof MinimapColorsSchema>;
export type TextureDef = z.infer<typeof TextureDefSchema>;
export type SpriteDef = z.infer<typeof SpriteDefSchema>;
export type SpriteFlags = z.infer<typeof SpriteFlagsSchema>;
export type MapData = z.infer<typeof MapSchema>;
export type Project = z.infer<typeof ProjectSchema>;

/** Error tipado para errores de validación de proyecto. */
export class ProjectValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const first = issues[0];
    const path = first ? first.path.join('.') : '?';
    super(`Proyecto inválido en "${path}": ${first ? first.message : 'desconocido'}`);
    this.name = 'ProjectValidationError';
    this.issues = issues;
  }
}

/**
 * Migración v1→v2 explícita y visible (aunque ProjectSchema ya lo hace
 * automáticamente: los campos v2 tienen defaults y `schemaVersion` se
 * canonicaliza a 2). Normaliza campos conocidos y deja el resto pasar.
 */
export function migrateToV2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const project = raw as Record<string, unknown>;
  const meta = (project.meta ?? {}) as Record<string, unknown>;
  if (meta.schemaVersion === 1) {
    meta.schemaVersion = 2;
  }
  return { ...project, meta };
}