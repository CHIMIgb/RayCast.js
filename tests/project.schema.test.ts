import { describe, expect, it } from 'vitest';
import {
  MapSchema,
  MetaSchema,
  ProjectSchema,
  ProjectValidationError,
} from '../src/data/schema';
import { parseProject } from '../src/data/project';
import type { MapData, Project, ProjectMeta } from '../src/data/schema';

function validMeta(): ProjectMeta {
  return { name: 'Test', schemaVersion: 2, renderMode: 'retro', author: 'tester' };
}

function validMap(): MapData {
  return {
    size: { w: 2, h: 2 },
    grid: [
      [1, 1],
      [1, 0],
    ],
  };
}

function validProject(): Project {
  // parse aplica los defaults (width/height/uDiv/vDiv/vMove/repeat)
  return ProjectSchema.parse({
    meta: validMeta(),
    settings: {
      resolution: { width: 640, height: 480 },
      playerStart: { x: 1.5, y: 1.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 },
    },
    textures: [
      { id: 'wall', src: '/textures/redbrick.png', isSprite: false },
      { id: 'barrel', src: '/textures/barrel.png', isSprite: true },
    ],
    sprites: [{ x: 0.5, y: 0.5, texture: 1 }],
    map: validMap(),
  });
}

describe('schema: MetaSchema', () => {
  it('acepta un meta válido', () => {
    const res = MetaSchema.safeParse(validMeta());
    expect(res.success).toBe(true);
  });

  it('rechaza schemaVersion distinto de 1 o 2', () => {
    const res = MetaSchema.safeParse({ ...validMeta(), schemaVersion: 99 });
    expect(res.success).toBe(false);
  });

  it('acepta v1 y canonicaliza a v2 en la salida', () => {
    const res = MetaSchema.safeParse({ ...validMeta(), schemaVersion: 1 });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.schemaVersion).toBe(2);
  });

  it('rechaza renderMode inválido', () => {
    const res = MetaSchema.safeParse({ ...validMeta(), renderMode: 'voxel' });
    expect(res.success).toBe(false);
  });
});

describe('schema: MapSchema', () => {
  it('acepta un grid del tamaño declarado', () => {
    const res = MapSchema.safeParse(validMap());
    expect(res.success).toBe(true);
  });

  it('rechaza grid con número de filas distinto a size.h', () => {
    const res = MapSchema.safeParse({
      size: { w: 2, h: 2 },
      grid: [[1, 1]],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'grid' && /h/.test(i.message))).toBe(true);
    }
  });

  it('rechaza una fila con ancho distinto a size.w', () => {
    const res = MapSchema.safeParse({
      size: { w: 2, h: 2 },
      grid: [
        [1, 1],
        [1],
      ],
    });
    expect(res.success).toBe(false);
  });
});

describe('schema: ProjectSchema + parseProject', () => {
  it('acepta un proyecto completo válido', () => {
    const res = ProjectSchema.safeParse(validProject());
    expect(res.success).toBe(true);
  });

  it('parseProject devuelve el proyecto tipado', () => {
    const project = parseProject(validProject());
    expect(project.meta.renderMode).toBe('retro');
    expect(project.map.grid[1][1]).toBe(0);
  });

  it('parseProject lanza ProjectValidationError con issues visibles', () => {
    const broken = {
      ...validProject(),
      textures: [],
    };
    let thrown: unknown;
    try {
      parseProject(broken);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ProjectValidationError);
    expect((thrown as ProjectValidationError).issues.length).toBeGreaterThan(0);
  });

  it('un sprite con texture negativa se rechaza', () => {
    const broken = {
      ...validProject(),
      sprites: [{ x: 0.5, y: 0.5, texture: -1 }],
    };
    const res = ProjectSchema.safeParse(broken);
    expect(res.success).toBe(false);
  });
});

describe('schema v2: migración automática v1→v2 (de-hardcoding)', () => {
  it('un proyecto v1 se parsea y gana los campos v2 por defecto', () => {
    const v1 = {
      meta: { name: 'Viejo', schemaVersion: 1, renderMode: 'retro' },
      settings: {
        resolution: { width: 640, height: 480 },
        playerStart: { x: 1.5, y: 1.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 },
      },
      textures: [
        { id: 'wall', src: '/textures/redbrick.png', isSprite: false },
        { id: 'barrel', src: '/textures/barrel.png', isSprite: true },
      ],
      sprites: [{ x: 0.5, y: 0.5, texture: 1 }],
      map: validMap(),
    };
    const project = ProjectSchema.parse(v1);
    expect(project.meta.schemaVersion).toBe(2);
    // sin floorTexture/ceilingTexture: defaults greens/wood (antes índices 3/4/6 fijos)
    expect(project.settings.floorTexture).toBe('greystone');
    expect(project.settings.floorTextureAlt).toBe('bluestone');
    expect(project.settings.ceilingTexture).toBe('wood');
    // sin minimap: activo con colores por defecto
    expect(project.settings.minimap.enabled).toBe(true);
    expect(project.settings.minimap.colors.wall).toBe('#888888');
    // sin flags: sprite opaco, sin kind (antes `texture === 10` hardcodeado)
    expect(project.sprites[0].flags.translucent).toBe(false);
    expect(project.sprites[0].flags.kind).toBeUndefined();
  });

  it('respeta los campos v2 declarados en el project.json', () => {
    const v2 = {
      meta: { name: 'Nuevo', schemaVersion: 2, renderMode: 'retro' },
      settings: {
        resolution: { width: 640, height: 480 },
        playerStart: { x: 1.5, y: 1.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 },
        floorTexture: 'mossy',
        floorTextureAlt: 'colorstone',
        ceilingTexture: 'purplestone',
        minimap: {
          enabled: false,
          colors: {
            byKind: [{ kind: 'light', color: '#00FF00' }],
          },
        },
      },
      textures: [
        { id: 'wall', src: '/textures/redbrick.png', isSprite: false },
        { id: 'barrel', src: '/textures/barrel.png', isSprite: true },
      ],
      sprites: [
        { x: 0.5, y: 0.5, texture: 1, flags: { translucent: true, kind: 'light' } },
      ],
      map: validMap(),
    };
    const project = ProjectSchema.parse(v2);
    expect(project.settings.floorTexture).toBe('mossy');
    expect(project.settings.ceilingTexture).toBe('purplestone');
    expect(project.settings.minimap.enabled).toBe(false);
    expect(project.settings.minimap.colors.byKind).toEqual([{ kind: 'light', color: '#00FF00' }]);
    expect(project.sprites[0].flags.translucent).toBe(true);
    expect(project.sprites[0].flags.kind).toBe('light');
  });
});