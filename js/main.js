/* ============================================================
   main.js — Punto de entrada: router hash + orquestador
   ------------------------------------------------------------
   Rutas:
     #/boot      → secuencia BIOS/DOS (solo primera carga)
     #/desktop   → escritorio Windows 95 (landing)
     #/game      → museo raycasting 3D
   FASE 2: desktop completo (iconos + taskbar + apps).
   FASE 3 conecta boot real; FASE 4 el museo.
   ============================================================ */

import { wm } from './desktop/windowManager.js';
import { mountDesktop } from './desktop/desktopView.js';
import { runBoot } from './desktop/boot.js';
import { initEffects, crtSwap, reducedMotion } from './desktop/effects.js';
import { mountMuseum } from './game/museum.js';

const app = document.getElementById('app');

let cleanupCurrent = null;
let firstRoute = true;

/* ---------- Router ---------- */
function applyRoute() {
  cleanupCurrent?.();
  cleanupCurrent = null;
  wm.clear();

  const route = location.hash.replace('#/', '') || 'desktop';

  if (route === 'desktop') {
    app.innerHTML = `<div class="workspace" id="workspace"></div>`;
    wm.root = document.getElementById('workspace');
    cleanupCurrent = mountDesktop(wm.root);
  } else if (route === 'game') {
    // Presentación idéntica a legacy-demo: canvas 640×480 centrado,
    // fondo #222, controles y FPS debajo del canvas.
    app.innerHTML = `
      <div class="game-shell" id="game-shell">
        <h1 class="game-title">Raycaster</h1>
        <div class="canvas-wrap">
          <canvas id="museum-canvas" width="640" height="480"></canvas>
          <div class="hud-prompt" id="hud-prompt"></div>
        </div>
        <div class="controls">
          <p><strong>Controles:</strong> Usa las flechas del teclado o W, A, S, D para moverte y rotar.</p>
          <p>E para interactuar con las exhibiciones · ESC para el menú</p>
          <p id="fps">FPS: 0</p>
        </div>
        <div class="overlay-layer" id="overlay-layer"></div>
      </div>`;

    wm.root = document.getElementById('overlay-layer');
    cleanupCurrent = mountMuseum({
      canvas: document.getElementById('museum-canvas'),
      promptEl: document.getElementById('hud-prompt'),
      fpsEl: document.getElementById('fps'),
      shellEl: document.getElementById('game-shell'),
    });
  } else {
    // #/boot → secuencia BIOS/DOS; al terminar salta al escritorio
    app.innerHTML = '';
    cleanupCurrent = runBoot(app, {
      onFinish: () => { location.hash = '#/desktop'; },
    });
  }
}

function onHashChange() {
  // Primera renderización y reduced-motion: intercambio directo.
  // El resto: transición CRT power-off/power-on.
  if (firstRoute || reducedMotion()) {
    firstRoute = false;
    applyRoute();
  } else {
    crtSwap(applyRoute);
  }
}

window.addEventListener('hashchange', onHashChange);

initEffects();   // CRT según preferencia guardada (global a todas las vistas)

// Primera visita → boot; siguientes → desktop directamente
if (!location.hash && !localStorage.getItem('svr_visited')) {
  localStorage.setItem('svr_visited', '1');
  location.hash = '#/boot';
}
onHashChange();
