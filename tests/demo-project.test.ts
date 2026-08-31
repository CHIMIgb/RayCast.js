import { describe, expect, it } from 'vitest';
import demoProject from '../public/projects/demo/project.json';
import { parseProject } from '../src/data/project';
import { ProjectSchema } from '../src/data/schema';

describe('proyecto demo (integración F0)', () => {
  it('el project.json del demo es un proyecto válido (grid 24x24)', () => {
    const project = parseProject(demoProject);
    expect(project.meta.name).toBe('Demo LodeV');
    expect(project.meta.renderMode).toBe('retro');
    expect(project.map.size).toEqual({ w: 24, h: 24 });
    expect(project.map.grid).toHaveLength(24);
    project.map.grid.forEach((row, i) => {
      expect(row, `fila ${i}`).toHaveLength(24);
    });
    expect(project.textures.length).toBe(11);
    expect(project.sprites.length).toBe(19);
    expect(project.settings.resolution).toEqual({ width: 640, height: 480 });
  });

  it('el demo vuelve a pasar por el schema tras parsear (round-trip)', () => {
    const project = parseProject(demoProject);
    const res = ProjectSchema.safeParse(project);
    expect(res.success).toBe(true);
  });
});