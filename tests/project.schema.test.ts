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
  return { name: 'Test', schemaVersion: 1, renderMode: 'retro', author: 'tester' };
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

  it('rechaza schemaVersion distinto de 1', () => {
    const res = MetaSchema.safeParse({ ...validMeta(), schemaVersion: 2 });
    expect(res.success).toBe(false);
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