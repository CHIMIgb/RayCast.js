import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas del modelo de datos (project.json) — schemaVersion 1
// La capa de datos es la columna vertebral del estudio: todo editor escribe
// JSON validado con estos esquemas; todo motor lee JSON validado con ellos.
// ─────────────────────────────────────────────────────────────────────────────

export const RenderModeSchema = z.enum(['retro', '3d']);

export const MetaSchema = z.object({
  name: z.string().min(1),
  schemaVersion: z.literal(1),
  renderMode: RenderModeSchema,
  author: z.string().optional(),
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
});

export const TextureDefSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  width: z.number().int().positive().default(64),
  height: z.number().int().positive().default(64),
  isSprite: z.boolean().default(false),
  repeat: z.boolean().default(false),
});

export const SpriteDefSchema = z.object({
  x: z.number(),
  y: z.number(),
  texture: z.number().int().nonnegative(),
  uDiv: z.number().positive().default(1),
  vDiv: z.number().positive().default(1),
  vMove: z.number().default(0),
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
  sprites: z.array(SpriteDefSchema),
  map: MapSchema,
});

// Tipos derivados
export type RenderMode = z.infer<typeof RenderModeSchema>;
export type ProjectMeta = z.infer<typeof MetaSchema>;
export type ProjectSettings = z.infer<typeof SettingsSchema>;
export type TextureDef = z.infer<typeof TextureDefSchema>;
export type SpriteDef = z.infer<typeof SpriteDefSchema>;
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