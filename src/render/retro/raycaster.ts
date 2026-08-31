import type { Project, SpriteDef } from '../../data/schema';
import { KeyboardState } from '../../core/input';
import { sortSpritesByDistance, spriteTransform, isSpriteBehind, spriteScreenX, lineHeightForDistance, rotateVector } from './math';
import { loadTextures, LoadedTexture } from './textures';

export interface RetroGameOptions {
  /** Elemento donde se escribe "FPS: n" (opcional). */
  fpsElement?: HTMLElement | null;
  /** Velocidad de movimiento (celdas/s). */
  moveSpeed?: number;
  /** Velocidad de rotación (rad/s). */
  rotSpeed?: number;
}

/**
 * Motor retro: raycaster Wolf3D clásico migrado a TypeScript (Fase 0).
 * Consume un `Project` validado y dibuja muros, piso/techo, sprites y minimapa
 * en un Canvas 2D. El algoritmo es idéntico al de `raycasting.js` original.
 */
export class RetroGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly project: Project;
  private readonly fpsElement: HTMLElement | null;
  private readonly moveSpeed: number;
  private readonly rotSpeed: number;
  private readonly keyboard = new KeyboardState();

  private readonly screenWidth: number;
  private readonly screenHeight: number;
  private readonly mapWidth: number;
  private readonly mapHeight: number;

  private textures: LoadedTexture[] = [];
  private textureIndexById = new Map<string, number>();
  private floorTexIdx = 0;
  private floorTexAltIdx = 0;
  private ceilingTexIdx = 0;
  private readonly floorImgData: ImageData;
  private readonly buf: Uint8ClampedArray;
  private readonly zBuffer: Float64Array;

  private posX: number;
  private posY: number;
  private dirX: number;
  private dirY: number;
  private planeX: number;
  private planeY: number;

  private running = false;
  private rafId = 0;
  private time = 0;
  private oldTime = 0;

  constructor(canvas: HTMLCanvasElement, project: Project, options: RetroGameOptions = {}) {
    this.canvas = canvas;
    this.project = project;
    this.fpsElement = options.fpsElement ?? null;
    this.moveSpeed = options.moveSpeed ?? 5.0;
    this.rotSpeed = options.rotSpeed ?? 3.0;

    const { resolution, playerStart } = project.settings;
    this.screenWidth = resolution.width;
    this.screenHeight = resolution.height;
    this.mapWidth = project.map.size.w;
    this.mapHeight = project.map.size.h;

    canvas.width = this.screenWidth;
    canvas.height = this.screenHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;

    this.posX = playerStart.x;
    this.posY = playerStart.y;
    this.dirX = playerStart.dirX;
    this.dirY = playerStart.dirY;
    this.planeX = playerStart.planeX;
    this.planeY = playerStart.planeY;

    this.floorImgData = ctx.createImageData(this.screenWidth, this.screenHeight);
    this.buf = this.floorImgData.data;
    this.zBuffer = new Float64Array(this.screenWidth);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.textures = await loadTextures(this.project.textures);
    this.textureIndexById = new Map(this.project.textures.map((t, i) => [t.id, i]));
    // v2: piso/techo por id de textura (declarado en project.json), no índices fijos.
    const { floorTexture, floorTextureAlt, ceilingTexture } = this.project.settings;
    this.floorTexIdx = this.textureIndexById.get(floorTexture) ?? 0;
    this.floorTexAltIdx = this.textureIndexById.get(floorTextureAlt) ?? 0;
    this.ceilingTexIdx = this.textureIndexById.get(ceilingTexture) ?? 0;
    this.running = true;
    this.keyboard.attach();
    this.rafId = requestAnimationFrame((timestamp) => {
      this.oldTime = timestamp;
      this.rafId = requestAnimationFrame(this.frame);
    });
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.keyboard.detach();
  }

  dispose(): void {
    this.stop();
  }

  private get grid(): number[][] {
    return this.project.map.grid;
  }

  private isWalkable(x: number, y: number): boolean {
    const row = this.grid[Math.floor(x)];
    return row !== undefined && row[Math.floor(y)] === 0;
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running) return;
    const frameTime = (timestamp - this.oldTime) / 1000.0;
    this.time = timestamp;

    if (frameTime > 0 && this.fpsElement) {
      this.fpsElement.textContent = `FPS: ${Math.round(1.0 / frameTime)}`;
    }
    this.oldTime = timestamp;

    this.renderFrame();
    this.updateMovement(frameTime);
    this.drawMinimap();

    this.rafId = requestAnimationFrame(this.frame);
  };

  private renderFrame(): void {
    const ctx = this.ctx;
    const w = this.screenWidth;
    const h = this.screenHeight;

    // Fondos por defecto (evitan huecos por redondeos)
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, h / 2, w, h / 2);

    // Limpiar buffer de píxeles para el piso/techo
    this.buf.fill(0);

    const wallsToDraw: Array<{
      img: HTMLCanvasElement;
      texX: number;
      texHeight: number;
      drawStartOrig: number;
      lineHeight: number;
      x: number;
      side: number;
      drawStart: number;
      drawEnd: number;
    }> = [];

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayDirX = this.dirX + this.planeX * cameraX;
      const rayDirY = this.dirY + this.planeY * cameraX;

      let mapX = Math.floor(this.posX);
      let mapY = Math.floor(this.posY);

      let sideDistX: number;
      let sideDistY: number;
      const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

      let stepX: number;
      let stepY: number;
      let hit = 0;
      let side = 0;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (this.posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - this.posX) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (this.posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - this.posY) * deltaDistY;
      }

      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (this.grid[mapX] && this.grid[mapX][mapY] > 0) hit = 1;
      }

      const perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;

      const lineHeight = lineHeightForDistance(h, perpWallDist);

      const drawStartOrig = Math.floor(-lineHeight / 2 + h / 2);
      const drawStart = Math.max(0, drawStartOrig);
      const drawEnd = Math.min(lineHeight / 2 + h / 2, h - 1);

      const texNum = this.grid[mapX][mapY] - 1;
      const texObj = this.textures[texNum];
      if (!texObj) continue;

      let wallX = side === 0 ? this.posY + perpWallDist * rayDirY : this.posX + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texObj.width);
      if (side === 0 && rayDirX > 0) texX = texObj.width - texX - 1;
      if (side === 1 && rayDirY < 0) texX = texObj.width - texX - 1;
      texX = Math.max(0, Math.min(texX, texObj.width - 1));

      wallsToDraw.push({
        img: texObj.img,
        texX,
        texHeight: texObj.height,
        drawStartOrig,
        lineHeight,
        x,
        side,
        drawStart,
        drawEnd,
      });

      this.zBuffer[x] = perpWallDist;

      // ── Floor/ceiling casting (versión vertical) ──
      let floorXWall: number;
      let floorYWall: number;
      if (side === 0 && rayDirX > 0) {
        floorXWall = mapX;
        floorYWall = mapY + wallX;
      } else if (side === 0 && rayDirX < 0) {
        floorXWall = mapX + 1.0;
        floorYWall = mapY + wallX;
      } else if (side === 1 && rayDirY > 0) {
        floorXWall = mapX + wallX;
        floorYWall = mapY;
      } else {
        floorXWall = mapX + wallX;
        floorYWall = mapY + 1.0;
      }

      const distWall = perpWallDist;
      const distPlayer = 0.0;
      let yStart = Math.min(drawEnd + 1, h - 1);
      if (drawEnd < 0) yStart = h;

      for (let y = yStart; y < h; y++) {
        const currentDist = h / (2.0 * y - h);
        const weight = (currentDist - distPlayer) / (distWall - distPlayer);

        const currentFloorX = weight * floorXWall + (1.0 - weight) * this.posX;
        const currentFloorY = weight * floorYWall + (1.0 - weight) * this.posY;

        const floorTexX = Math.floor((currentFloorX * texObj.width) / 4) & (texObj.width - 1);
        const floorTexY = Math.floor((currentFloorY * texObj.height) / 4) & (texObj.height - 1);

        const checkerBoardPattern = (Math.floor(currentFloorX) + Math.floor(currentFloorY)) & 1;
        const floorTexIdx = checkerBoardPattern === 0 ? this.floorTexIdx : this.floorTexAltIdx;
        const ceilingTexIdx = this.ceilingTexIdx;

        const fData = this.textures[floorTexIdx].data;
        const cData = this.textures[ceilingTexIdx].data;

        const texPos = (floorTexY * texObj.width + floorTexX) * 4;

        const floorBufPos = (y * w + x) * 4;
        this.buf[floorBufPos] = fData[texPos] >> 1;
        this.buf[floorBufPos + 1] = fData[texPos + 1] >> 1;
        this.buf[floorBufPos + 2] = fData[texPos + 2] >> 1;
        this.buf[floorBufPos + 3] = 255;

        const ceilY = h - y - 1;
        if (ceilY >= 0) {
          const ceilBufPos = (ceilY * w + x) * 4;
          this.buf[ceilBufPos] = cData[texPos] >> 1;
          this.buf[ceilBufPos + 1] = cData[texPos + 1] >> 1;
          this.buf[ceilBufPos + 2] = cData[texPos + 2] >> 1;
          this.buf[ceilBufPos + 3] = 255;
        }
      }
    }

    ctx.putImageData(this.floorImgData, 0, 0);

    for (let i = 0; i < wallsToDraw.length; i++) {
      const wd = wallsToDraw[i];
      if (wd.lineHeight > 0) {
        ctx.drawImage(wd.img, wd.texX, 0, 1, wd.texHeight, wd.x, wd.drawStartOrig, 1, wd.lineHeight);
      }
      if (wd.side === 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(wd.x, wd.drawStart, 1, wd.drawEnd - wd.drawStart + 1);
      }
    }

    this.drawSprites();
  }

  private drawSprites(): void {
    const ctx = this.ctx;
    const w = this.screenWidth;
    const h = this.screenHeight;

    const sorted = sortSpritesByDistance<SpriteDef>(this.project.sprites, {
      x: this.posX,
      y: this.posY,
    });

    for (let i = 0; i < sorted.length; i++) {
      const sprite = sorted[i];
      const transform = spriteTransform(
        { x: this.planeX, y: this.planeY },
        { x: this.dirX, y: this.dirY },
        { x: this.posX, y: this.posY },
        sprite,
      );

      if (isSpriteBehind(transform.transformY)) continue;

      const spriteScreenXPos = spriteScreenX(w, transform.transformX, transform.transformY);

      const vMoveScreen = Math.floor(sprite.vMove / transform.transformY);

      const spriteHeight = Math.floor(Math.abs(h / transform.transformY) / sprite.vDiv);
      if (spriteHeight <= 0) continue;
      const drawStartY = Math.floor(-spriteHeight / 2 + h / 2) + vMoveScreen;

      const spriteWidth = Math.floor(Math.abs(h / transform.transformY) / sprite.uDiv);
      if (spriteWidth <= 0) continue;
      const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenXPos);
      const drawEndX = Math.floor(spriteWidth / 2 + spriteScreenXPos);

      let clipStartX = drawStartX;
      let clipEndX = drawEndX - 1;
      if (clipStartX < 0) clipStartX = 0;
      if (clipEndX >= w) clipEndX = w - 1;

      const texObj = this.textures[sprite.texture];
      if (!texObj) continue;

      const isTranslucent = sprite.flags.translucent; // v2: luz = translúcida
      if (isTranslucent) ctx.globalAlpha = 0.5;

      for (let stripe = clipStartX; stripe <= clipEndX; stripe++) {
        if (transform.transformY < this.zBuffer[stripe]) {
          const texX =
            Math.floor(
              (256 * (stripe - (-spriteWidth / 2 + spriteScreenXPos)) * texObj.width) /
                spriteWidth,
            ) / 256;
          const safeTexX = Math.floor(texX);
          if (safeTexX >= 0 && safeTexX < texObj.width) {
            ctx.drawImage(
              texObj.img,
              safeTexX,
              0,
              1,
              texObj.height,
              stripe,
              drawStartY,
              1,
              spriteHeight,
            );
          }
        }
      }

      if (isTranslucent) ctx.globalAlpha = 1.0;
    }
  }

  private updateMovement(frameTime: number): void {
    const moveSpeed = frameTime * this.moveSpeed;
    const rotSpeed = frameTime * this.rotSpeed;

    if (this.keyboard.isDown('ArrowUp') || this.keyboard.isDown('w')) {
      if (this.isWalkable(this.posX + this.dirX * moveSpeed, this.posY))
        this.posX += this.dirX * moveSpeed;
      if (this.isWalkable(this.posX, this.posY + this.dirY * moveSpeed))
        this.posY += this.dirY * moveSpeed;
    }
    if (this.keyboard.isDown('ArrowDown') || this.keyboard.isDown('s')) {
      if (this.isWalkable(this.posX - this.dirX * moveSpeed, this.posY))
        this.posX -= this.dirX * moveSpeed;
      if (this.isWalkable(this.posX, this.posY - this.dirY * moveSpeed))
        this.posY -= this.dirY * moveSpeed;
    }
    if (this.keyboard.isDown('ArrowRight') || this.keyboard.isDown('d')) {
      const rotatedDir = rotateVector(this.dirX, this.dirY, -rotSpeed);
      this.dirX = rotatedDir.x;
      this.dirY = rotatedDir.y;
      const rotatedPlane = rotateVector(this.planeX, this.planeY, -rotSpeed);
      this.planeX = rotatedPlane.x;
      this.planeY = rotatedPlane.y;
    }
    if (this.keyboard.isDown('ArrowLeft') || this.keyboard.isDown('a')) {
      const rotatedDir = rotateVector(this.dirX, this.dirY, rotSpeed);
      this.dirX = rotatedDir.x;
      this.dirY = rotatedDir.y;
      const rotatedPlane = rotateVector(this.planeX, this.planeY, rotSpeed);
      this.planeX = rotatedPlane.x;
      this.planeY = rotatedPlane.y;
    }
  }

  private drawMinimap(): void {
    const minimap = this.project.settings.minimap;
    if (!minimap.enabled) return;

    const ctx = this.ctx;
    const cellSize = minimap.cellSize;
    const colors = minimap.colors;
    const mapWidthPx = this.mapWidth * cellSize;
    const mapHeightPx = this.mapHeight * cellSize;
    const offsetX = this.screenWidth - mapWidthPx - 10;
    const offsetY = 10;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX, offsetY, mapWidthPx, mapHeightPx);
    ctx.globalAlpha = 1.0;

    for (let x = 0; x < this.mapWidth; x++) {
      for (let y = 0; y < this.mapHeight; y++) {
        if (this.grid[x] && this.grid[x][y] > 0) {
          ctx.fillStyle = colors.wall;
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    for (let i = 0; i < this.project.sprites.length; i++) {
      const sprite = this.project.sprites[i];
      // v2: color por kind (declarado en project.json), con fallback genérico
      let dotColor = colors.sprite;
      if (sprite.flags.kind) {
        const byKind = colors.byKind.find((k) => k.kind === sprite.flags.kind);
        if (byKind) dotColor = byKind.color;
      }
      ctx.fillStyle = dotColor;
      ctx.fillRect(
        offsetX + sprite.x * cellSize - 1,
        offsetY + sprite.y * cellSize - 1,
        2,
        2,
      );
    }

    ctx.fillStyle = colors.player;
    const playerPxX = offsetX + this.posX * cellSize;
    const playerPxY = offsetY + this.posY * cellSize;
    ctx.beginPath();
    ctx.arc(playerPxX, playerPxY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.direction;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playerPxX, playerPxY);
    ctx.lineTo(playerPxX + this.dirX * 10, playerPxY + this.dirY * 10);
    ctx.stroke();
  }
}