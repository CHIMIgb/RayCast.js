/* ============================================================
   museum.js — Orquestador de la vista #/game
   ------------------------------------------------------------
   • Carga texturas (base + carteles generados)
   • Loop rAF con pausa automática cuando hay ventanas abiertas
   • Interacción: rayo central → prompt [E] → abre app Win95
   • ESC → menú de pausa (ventana Win95 sobre el canvas)
   Devuelve función cleanup.
   ============================================================ */

import { Raycaster } from '../engine/raycaster.js';
import { loadWorldTextures, makePoster, makeBoard, fontsReady } from '../engine/textures.js';
import { worldMap, EXHIBITS, spriteDefs, playerStart } from './map.js';
import { mountTouchControls } from './touchControls.js';
import { wm, on as onWmEvent } from '../desktop/windowManager.js';
import { launchApp } from '../desktop/apps/registry.js';
import { projects, profile, skills, socials } from '../data/portfolio.js';

export function mountMuseum({ canvas, promptEl, fpsEl, shellEl }) {
  let cancelled = false;
  let rc = null;
  let rafId = 0;
  let paused = false;
  let lastT = 0;
  let currentExhibit = null;
  let GREEN_TEX = null;             // para clasificar sprites en el minimapa
  let BARREL_TEX = null;

  /* ---------- Input táctil (multitouch: mover + mirar a la vez) ---------- */
  const touchVec = { x: 0, y: 0 };
  let pendingRot = 0;

  const cleanupTouch = mountTouchControls({
    shell: shellEl,
    onVector: (v) => { touchVec.x = v.x; touchVec.y = v.y; },
    onLookDelta: (rad) => { pendingRot += rad; },
    onInteract: () => tryInteract(),
  });

  /* ---------- Input teclado ---------- */
  const keys = { fwd: 0, back: 0, left: 0, right: 0 };
  const KEYMAP = {
    KeyW: 'fwd', ArrowUp: 'fwd',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  const onKeyDown = (e) => {
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = 1; e.preventDefault(); }
    else if (e.code === 'KeyE') tryInteract();
    else if (e.code === 'Escape') togglePause();
  };
  const onKeyUp = (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  /* ---------- Pausa según ventanas visibles ---------- */
  function refreshPause() {
    paused = wm.visibleWindows().length > 0;
    if (!paused) lastT = performance.now();     // evita salto de dt
    else promptEl?.classList.remove('visible');
  }

  const offs = ['open', 'close', 'minimize', 'restore', 'focus']
    .map((ev) => onWmEvent(ev, refreshPause));

  /* ---------- Menú de pausa ---------- */
  function togglePause() {
    const existing = wm.get('pause-menu');
    if (existing) return existing.close();

    if (paused) return;                          // otra ventana ya está abierta

    const box = document.createElement('div');
    box.style.cssText = 'padding:14px; display:flex; flex-direction:column; gap:8px;';
    box.innerHTML = `<p style="margin:0 0 6px; font-size:13px;">Museo en pausa</p>`;

    const mkBtn = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn95';
      b.textContent = label;
      b.addEventListener('click', fn);
      box.append(b);
      return b;
    };

    mkBtn('Continuar', () => wm.get('pause-menu')?.close());
    mkBtn('Propiedades…', () => launchApp('settings'));
    mkBtn('Salir al escritorio', () => { location.hash = '#/desktop'; });

    wm.create({
      id: 'pause-menu',
      title: 'Menú - Museo SVR.EXE',
      icon: 'assets/icons/globe-16x16.png',
      width: 280,
      height: 210,
      content: box,
    });
  }

  /* ---------- Interacción ---------- */
  function tryInteract() {
    if (!currentExhibit || paused) return;
    const ex = currentExhibit;

    if (ex.type === 'project') launchApp('projects', { selectId: ex.projectId });
    else if (ex.type === 'app') launchApp(ex.app);
    else if (ex.type === 'exit') location.hash = '#/desktop';
    // 'deco' no interactúa
  }

  function updatePrompt(hit) {
    // Los tableros decorativos TAMBIÉN muestran su info (skills,
    // ubicación, redes) — solo no responden al [E].
    const ex = hit ? EXHIBITS[hit.value] : null;

    if (ex !== currentExhibit) {
      currentExhibit = ex;
      if (ex) {
        promptEl.innerHTML = ex.type === 'deco'
          ? `<b>ℹ</b> ${ex.label}`
          : `<b>[E]</b> ${ex.label}`;
        promptEl.classList.add('visible');
      } else {
        promptEl.classList.remove('visible');
      }
    } else if (ex && !promptEl.classList.contains('visible')) {
      promptEl.classList.add('visible');
    }
  }

  /* ============================================================
     Minimapa — puerto 1:1 del demo original
     (cellSize 6 · esquina sup. derecha · mismos colores)
     ============================================================ */
  function drawMinimap() {
    const ctx = rc.ctx;
    const cellSize = 6;
    const mapWidthPx = rc.mapW * cellSize;
    const mapHeightPx = rc.mapH * cellSize;
    const offsetX = rc.W - mapWidthPx - 10;
    const offsetY = 10;

    // Fondo semitransparente
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX, offsetY, mapWidthPx, mapHeightPx);
    ctx.globalAlpha = 1.0;

    // Muros
    for (let x = 0; x < rc.mapW; x++) {
      for (let y = 0; y < rc.mapH; y++) {
        if (rc.map[x][y] > 0) {
          ctx.fillStyle = '#888888';
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Sprites (verde=lámpara, marrón=barril, azul=otros)
    for (const s of rc.sprites) {
      if (s.tex === GREEN_TEX) ctx.fillStyle = '#00FF00';
      else if (s.tex === BARREL_TEX) ctx.fillStyle = '#8B4513';
      else ctx.fillStyle = '#0000FF';

      ctx.fillRect(offsetX + s.x * cellSize - 1, offsetY + s.y * cellSize - 1, 2, 2);
    }

    // Jugador: punto rojo + línea amarilla de dirección
    ctx.fillStyle = '#FF0000';
    const px = offsetX + rc.posX * cellSize;
    const py = offsetY + rc.posY * cellSize;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + rc.dirX * 10, py + rc.dirY * 10);
    ctx.stroke();
  }

  /* ---------- Arranque (async textures) ---------- */
  Promise.all([loadWorldTextures(), fontsReady()])
    .then(([textures]) => {
      if (cancelled || !canvas.isConnected) return;

      // Carteles y letreros generados
      const exhibitTextures = {};
      projects.slice(0, 7).forEach((p, i) => {
        exhibitTextures[11 + i] = makePoster(i, p);
      });
      Object.assign(exhibitTextures, {
        30: makeBoard({ title: 'Sobre mí', sub: profile.name, color: '#004a8f', glyph: 'user' }),
        31: makeBoard({ title: 'Contacto', sub: 'Escríbeme', color: '#7a1f2b', glyph: 'mail' }),
        32: makeBoard({ title: 'SALIDA', sub: 'Escritorio', color: '#1c5c34', glyph: 'exit' }),
        33: makeBoard({ title: 'Ubicación', sub: profile.location, color: '#7a5230', glyph: 'user' }),
      });
      skills.slice(0, 3).forEach((g, i) => {
        exhibitTextures[40 + i] = makeBoard({
          title: g.category, sub: '', color: '#3a3a52', glyph: 'code',
        });
      });
      const hostOf = (url) => { try { return new URL(url).host; } catch { return url; } };
      socials.slice(0, 3).forEach((s, i) => {
        exhibitTextures[43 + i] = makeBoard({
          title: s.label, sub: hostOf(s.url), color: '#20567c', glyph: 'globe',
        });
      });

      rc = new Raycaster(canvas, {
        map: worldMap,
        sprites: spriteDefs.map((s) => ({ ...s, tex: textures[s.tex] })),
        textures,
        ...playerStart,
      });
      rc.exhibitTextures = exhibitTextures;
      GREEN_TEX = textures.greenlight;
      BARREL_TEX = textures.barrel;

      lastT = performance.now();
      const loop = (t) => {
        rafId = requestAnimationFrame(loop);
        const frameTime = (t - lastT) / 1000;
        lastT = t;

        if (!paused && frameTime > 0) {
          // Fusión teclado + joystick (booleanos; el eje Y del stick
          // supera la zona muerta definida en touchControls)
          rc.setIntent({
            fwd: keys.fwd || touchVec.y < 0 ? 1 : 0,
            back: keys.back || touchVec.y > 0 ? 1 : 0,
            left: keys.left,
            right: keys.right,
          });

          // Rotación acumulada por arrastre
          if (pendingRot) {
            rc.rotate(pendingRot);
            pendingRot = 0;
          }

          rc.frame(frameTime);
          updatePrompt(rc.castCenter(2.2));
          drawMinimap();

          // FPS por frame, formato idéntico al demo
          if (fpsEl) fpsEl.textContent = `FPS: ${Math.round(1.0 / frameTime)}`;
        }
      };
      rafId = requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error('[museum]', err);
      promptEl.textContent = `Error cargando el museo: ${err.message}`;
      promptEl.classList.add('visible');
    });

  /* ---------- Cleanup ---------- */
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    cleanupTouch();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    offs.forEach((off) => off());
    wm.clear();
    promptEl?.classList?.remove('visible');
  };
}
