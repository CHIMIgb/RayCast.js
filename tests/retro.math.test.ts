import { describe, expect, it } from 'vitest';
import {
  isSpriteBehind,
  lineHeightForDistance,
  measureDistances,
  rotateVector,
  sortSpritesByDistance,
  spriteScreenX,
  spriteTransform,
} from '../src/render/retro/math';

describe('rotateVector', () => {
  it('rota (1, 0) 90° a (0, 1)', () => {
    const r = rotateVector(1, 0, Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(1, 6);
  });

  it('rota (0, 1) -90° a (1, 0)', () => {
    const r = rotateVector(0, 1, -Math.PI / 2);
    expect(r.x).toBeCloseTo(1, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });
});

describe('lineHeightForDistance', () => {
  it('calcula la altura del muro usando el alto de pantalla', () => {
    expect(lineHeightForDistance(480, 2)).toBe(240);
    expect(lineHeightForDistance(480, 4)).toBe(120);
  });
});

describe('spriteTransform / isSpriteBehind', () => {
  const plane = { x: 0, y: 0.66 };
  const dir = { x: -1, y: 0 };
  const pos = { x: 1.5, y: 1.5 };

  it('un sprite al frente tiene transformY > 0', () => {
    const t = spriteTransform(plane, dir, pos, { x: 0.5, y: 1.5 });
    expect(t.transformY).toBeGreaterThan(0);
    expect(isSpriteBehind(t.transformY)).toBe(false);
  });

  it('un sprite detrás de la cámara tiene transformY <= 0', () => {
    const t = spriteTransform(plane, dir, pos, { x: 2.5, y: 1.5 });
    expect(t.transformY).toBeLessThanOrEqual(0);
    expect(isSpriteBehind(t.transformY)).toBe(true);
  });
});

describe('spriteScreenX', () => {
  it('centra en pantalla un sprite frente al centro de la cámara', () => {
    expect(spriteScreenX(640, 0, 5)).toBe(320);
  });

  it('desplaza sprites a la derecha según su transformX', () => {
    expect(spriteScreenX(640, 5, 5)).toBeGreaterThan(320);
  });
});

describe('measureDistances / sortSpritesByDistance', () => {
  it('no muta el arreglo original', () => {
    const input = [
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ];
    const before = JSON.stringify(input);
    measureDistances(input, { x: 0, y: 0 });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('ordena de lejano a cercano', () => {
    const sorted = sortSpritesByDistance(
      [
        { x: 1, y: 1 },
        { x: 3, y: 3 },
        { x: 0.5, y: 0.5 },
      ],
      { x: 0, y: 0 },
    );
    expect(sorted[0].x).toBe(3);
    expect(sorted[2].x).toBe(0.5);
    expect(sorted.every((s, i) => i === 0 || sorted[i - 1].distance >= s.distance)).toBe(true);
  });
});