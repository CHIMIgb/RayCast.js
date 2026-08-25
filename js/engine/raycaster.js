/* ============================================================
   raycaster.js — Motor de raycasting (clase ES Module)
   ------------------------------------------------------------
   Port del demo original (legacy-demo/raycasting.js) preservando
   la matemática probada: DDA de muros, floor/ceiling vertical,
   sprites con ZBuffer y translucidez.
   Cambios: texturas de tamaño variable, resolución interna
   independiente (480×270 escalada por CSS), API de clase.
   ============================================================ */

export class Raycaster {
  /**
   * @param {HTMLCanvasElement} canvas  tamaño interno = resolución real
   * @param {object} opts { map, sprites, textures, x,y,dirX,dirY }
   *   map: number[][] (mapX][mapY], >0 sólido)
   *   sprites: [{x,y,tex:<textureObj>,translucent?,uDiv?,vDiv?,vMove?}]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.W = canvas.width;
    this.H = canvas.height;

    this.map = opts.map;
    this.mapW = this.map.length;
    this.mapH = this.map[0].length;
    this.sprites = (opts.sprites ?? []).map((s) => ({ ...s }));
    this.textures = opts.textures;                       // ⚠️ requerido por render
    this.exhibitTextures = opts.exhibitTextures ?? {};

    this.zbuf = new Float64Array(this.W);
    this.floorImg = this.ctx.createImageData(this.W, this.H);
    this.buf = this.floorImg.data;

    // Jugador
    this.posX = opts.x ?? 2.0;
    this.posY = opts.y ?? 2.0;
    this.dirX = opts.dirX ?? -1.0;
    this.dirY = opts.dirY ?? 0.0;
    this.planeX = 0.0;
    this.planeY = 0.66;
  }

  /* ---------- Entrada de intención (llamada por museum.js) ---------- */
  setIntent({ fwd = 0, back = 0, left = 0, right = 0 }) {
    this._fwd = fwd; this._back = back; this._left = left; this._right = right;
  }

  /** Rotación directa (arrastre táctil). Ángulo en radianes. */
  rotate(angle) {
    this._rotate(angle);
  }

  /* ---------- Rayo central para interacciones ---------- */
  castCenter(maxDist = 2.2) {
    const rayDirX = this.dirX, rayDirY = this.dirY;
    let mapX = Math.floor(this.posX), mapY = Math.floor(this.posY);

    const deltaX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
    let sideDistX, sideDistY, stepX, stepY, side = 0;

    if (rayDirX < 0) { stepX = -1; sideDistX = (this.posX - mapX) * deltaX; }
    else { stepX = 1; sideDistX = (mapX + 1 - this.posX) * deltaX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (this.posY - mapY) * deltaY; }
    else { stepY = 1; sideDistY = (mapY + 1 - this.posY) * deltaY; }

    for (let guard = 0; guard < 64; guard++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaX; mapX += stepX; side = 0;
      } else {
        sideDistY += deltaY; mapY += stepY; side = 1;
      }
      const cell = this.map[mapX]?.[mapY] ?? 1;
      if (cell > 0) {
        const dist = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
        return dist <= maxDist ? { value: cell, dist } : null;
      }
    }
    return null;
  }

  /* ---------- Frame completo: mover + renderizar ---------- */
  frame(dtSec) {
    const moveSpeed = dtSec * 5.0;
    const rotSpeed = dtSec * 3.0;
    const M = this.map;

    // Adelante / atrás con colisión eje a eje (como el original)
    if (this._fwd) {
      if (M[Math.floor(this.posX + this.dirX * moveSpeed)]?.[Math.floor(this.posY)] === 0)
        this.posX += this.dirX * moveSpeed;
      if (M[Math.floor(this.posX)]?.[Math.floor(this.posY + this.dirY * moveSpeed)] === 0)
        this.posY += this.dirY * moveSpeed;
    }
    if (this._back) {
      if (M[Math.floor(this.posX - this.dirX * moveSpeed)]?.[Math.floor(this.posY)] === 0)
        this.posX -= this.dirX * moveSpeed;
      if (M[Math.floor(this.posX)]?.[Math.floor(this.posY - this.dirY * moveSpeed)] === 0)
        this.posY -= this.dirY * moveSpeed;
    }

    if (this._right) this._rotate(-rotSpeed);
    if (this._left) this._rotate(rotSpeed);

    this._render();
  }

  _rotate(rotSpeed) {
    const cos = Math.cos(rotSpeed), sin = Math.sin(rotSpeed);
    let old = this.dirX;
    this.dirX = this.dirX * cos - this.dirY * sin;
    this.dirY = old * sin + this.dirY * cos;
    old = this.planeX;
    this.planeX = this.planeX * cos - this.planeY * sin;
    this.planeY = old * sin + this.planeY * cos;
  }

  /* ============================================================
     RENDER (matemática idéntica al demo original)
     ============================================================ */
  _render() {
    const { W, H, ctx } = this;
    const buf = this.buf;

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, W, H / 2);
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, H / 2, W, H / 2);
    buf.fill(0);

    const wallsToDraw = [];

    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rayDirX = this.dirX + this.planeX * cameraX;
      const rayDirY = this.dirY + this.planeY * cameraX;

      let mapX = Math.floor(this.posX), mapY = Math.floor(this.posY);
      let sideDistX, sideDistY;
      const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
      let perpWallDist, stepX, stepY, hit = 0, side;

      if (rayDirX < 0) { stepX = -1; sideDistX = (this.posX - mapX) * deltaDistX; }
      else { stepX = 1; sideDistX = (mapX + 1 - this.posX) * deltaDistX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (this.posY - mapY) * deltaDistY; }
      else { stepY = 1; sideDistY = (mapY + 1 - this.posY) * deltaDistY; }

      // Guarda anti-bucle: un mapa bien cerrado golpea en <64 pasos
      let guard = 0;
      while (!hit && guard++ < 256) {
        if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
        else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
        hit = this.map[mapX]?.[mapY] > 0 ? 1 : 0;
      }

      if (!hit) {
        // Rayo escapó (mapa abierto): columna lejana sin muro
        this.zbuf[x] = 1e30;
        continue;
      }

      perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;

      const lineHeight = Math.floor(H / perpWallDist);
      const drawStartOrig = Math.floor(-lineHeight / 2 + H / 2);
      const drawStart = Math.max(drawStartOrig, 0);
      let drawEnd = Math.floor(lineHeight / 2 + H / 2);
      if (drawEnd >= H) drawEnd = H - 1;

      const texObj = this._wallTexture(this.map[mapX][mapY]);

      let wallX = side === 0
        ? this.posY + perpWallDist * rayDirY
        : this.posX + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texObj.w);
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0))
        texX = texObj.w - texX - 1;
      texX = Math.max(0, Math.min(texX, texObj.w - 1));

      wallsToDraw.push({ img: texObj.img, texX, texH: texObj.h, drawStartOrig, lineHeight, x, side, drawStart, drawEnd });

      this.zbuf[x] = perpWallDist;

      /* ---- FLOOR / CEILING vertical (original) ---- */
      let floorXWall, floorYWall;
      if (side === 0 && rayDirX > 0) { floorXWall = mapX; floorYWall = mapY + wallX; }
      else if (side === 0 && rayDirX < 0) { floorXWall = mapX + 1; floorYWall = mapY + wallX; }
      else if (side === 1 && rayDirY > 0) { floorXWall = mapX + wallX; floorYWall = mapY; }
      else { floorXWall = mapX + wallX; floorYWall = mapY + 1; }

      const distWall = perpWallDist;
      const distPlayer = 0.0;
      if (drawEnd < 0) drawEnd = H;

      for (let y = drawEnd + 1; y < H; y++) {
        const currentDist = H / (2.0 * y - H);
        const weight = (currentDist - distPlayer) / (distWall - distPlayer);

        const cfX = weight * floorXWall + (1 - weight) * this.posX;
        const cfY = weight * floorYWall + (1 - weight) * this.posY;

        const fTex = this.textures.greystone;
        const cTex = this.textures.wood;

        let ftX = Math.floor(cfX * fTex.w / 4) & (fTex.w - 1);
        let ftY = Math.floor(cfY * fTex.h / 4) & (fTex.h - 1);

        const checker = (Math.floor(cfX) + Math.floor(cfY)) & 1;
        const useTex = checker === 0 ? fTex : this.textures.bluestone;
        ftX &= useTex.w - 1;
        ftY &= useTex.h - 1;

        const tp = (ftY * useTex.w + ftX) * 4;

        const fp = ((y * W) + x) * 4;
        buf[fp] = useTex.data[tp] >> 1;
        buf[fp + 1] = useTex.data[tp + 1] >> 1;
        buf[fp + 2] = useTex.data[tp + 2] >> 1;
        buf[fp + 3] = 255;

        const ceilY = H - y - 1;
        if (ceilY >= 0) {
          const cp = ((ceilY * W) + x) * 4;
          buf[cp] = cTex.data[tp] >> 1;
          buf[cp + 1] = cTex.data[tp + 1] >> 1;
          buf[cp + 2] = cTex.data[tp + 2] >> 1;
          buf[cp + 3] = 255;
        }
      }
    }

    ctx.putImageData(this.floorImg, 0, 0);

    // Muros por hardware
    for (const w of wallsToDraw) {
      if (w.lineHeight > 0)
        ctx.drawImage(w.img, w.texX, 0, 1, w.texH, w.x, w.drawStartOrig, 1, w.lineHeight);
      if (w.side === 1) {
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(w.x, w.drawStart, 1, w.drawEnd - w.drawStart + 1);
      }
    }

    this._renderSprites();
  }

  /* Celdas 1-8 → paredes del nivel legacy (eagle…colorstone);
     ≥11 → carteles generados en exhibitTextures */
  _wallTexture(value) {
    const KEYS = [null, 'eagle', 'redbrick', 'purplestone', 'greystone',
                  'bluestone', 'mossy', 'wood', 'colorstone'];
    const key = KEYS[value];
    if (key && this.textures[key]) return this.textures[key];
    return this.exhibitTextures?.[value] ?? this.textures.bluestone;
  }

  _renderSprites() {
    const { W, H, ctx } = this;

    for (const s of this.sprites) {
      const dx = this.posX - s.x, dy = this.posY - s.y;
      s._dist = dx * dx + dy * dy;
    }
    const order = [...this.sprites].sort((a, b) => b._dist - a._dist);

    const invDet = 1.0 / (this.planeX * this.dirY - this.dirX * this.planeY);

    for (const s of order) {
      const sx = s.x - this.posX, sy = s.y - this.posY;
      const tX = invDet * (this.dirY * sx - this.dirX * sy);
      const tY = invDet * (-this.planeY * sx + this.planeX * sy);
      if (tY <= 0) continue;

      const uDiv = s.uDiv ?? 1, vDiv = s.vDiv ?? 1;
      const screenX = Math.floor((W / 2) * (1 + tX / tY));
      const vMoveScreen = Math.floor((s.vMove ?? 0) / tY);

      const spriteH = Math.floor(Math.abs(H / tY) / vDiv);
      if (spriteH <= 0) continue;
      const drawStartY = Math.floor(-spriteH / 2 + H / 2) + vMoveScreen;

      const spriteW = Math.floor(Math.abs(H / tY) / uDiv);
      if (spriteW <= 0) continue;
      const drawStartX = Math.floor(-spriteW / 2 + screenX);
      const drawEndX = Math.floor(spriteW / 2 + screenX);

      const clipStartX = Math.max(drawStartX, 0);
      const clipEndX = Math.min(drawEndX - 1, W - 1);

      const tex = s.tex;

      if (s.translucent) ctx.globalAlpha = 0.5;

      for (let stripe = clipStartX; stripe <= clipEndX; stripe++) {
        if (tY < this.zbuf[stripe]) {
          const texXf = Math.floor(
            (256 * (stripe - (-spriteW / 2 + screenX)) * tex.w) / spriteW
          ) / 256;
          const safeX = Math.floor(texXf);
          if (safeX >= 0 && safeX < tex.w) {
            ctx.drawImage(tex.img, safeX, 0, 1, tex.h, stripe, drawStartY, 1, spriteH);
          }
        }
      }

      if (s.translucent) ctx.globalAlpha = 1.0;
    }
  }
}
