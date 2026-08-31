// ─────────────────────────────────────────────────────────────────────────────
// Matemática pura del motor retro (funciones sin estado, probables con Vitest).
// Todo mutación de sprites / cámara se concentra aquí para testear fácil.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface SpriteTransform {
  invDet: number;
  transformX: number;
  transformY: number;
}

export type DistanceMeasured<T> = T & { distance: number };

/** Rota un vector (x, y) por `angle` radianes (sentido antihorario). */
export function rotateVector(x: number, y: number, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** Altura en píxeles de una línea de muro a una distancia perpendicular dada. */
export function lineHeightForDistance(screenHeight: number, perpWallDist: number): number {
  return Math.floor(screenHeight / perpWallDist);
}

/**
 * Transforma la posición de un sprite al espacio de la cámara.
 * `transformY > 0` ⇒ el sprite está frente a la cámara.
 */
export function spriteTransform(
  plane: Vec2,
  dir: Vec2,
  pos: Vec2,
  sprite: Vec2,
): SpriteTransform {
  const relX = sprite.x - pos.x;
  const relY = sprite.y - pos.y;
  const invDet = 1.0 / (plane.x * dir.y - dir.x * plane.y);
  return {
    invDet,
    transformX: invDet * (dir.y * relX - dir.x * relY),
    transformY: invDet * (-plane.y * relX + plane.x * relY),
  };
}

/** ¿Está el sprite detrás de la cámara? (no dibujar). */
export function isSpriteBehind(transformY: number): boolean {
  return transformY <= 0;
}

/** Coordenada X centrada en pantalla de un sprite ya transformado. */
export function spriteScreenX(screenWidth: number, transformX: number, transformY: number): number {
  return Math.floor((screenWidth / 2) * (1 + transformX / transformY));
}

/** Devuelve una copia con `distance` = distancia² al jugador, sin mutar el original. */
export function measureDistances<T extends Vec2>(
  sprites: readonly T[],
  pos: Vec2,
): DistanceMeasured<T>[] {
  return sprites.map((s) => {
    const dx = pos.x - s.x;
    const dy = pos.y - s.y;
    return { ...s, distance: dx * dx + dy * dy };
  });
}

/** Ordena sprites de lejano a cercano (Painter's algorithm). */
export function sortSpritesByDistance<T extends Vec2>(
  sprites: readonly T[],
  pos: Vec2,
): DistanceMeasured<T>[] {
  return measureDistances(sprites, pos).sort((a, b) => b.distance - a.distance);
}