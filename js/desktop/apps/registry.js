/* ============================================================
   apps/registry.js — Registro central de aplicaciones
   Cada módulo exporta { meta, launch }; aquí se ensamblan.
   ============================================================ */

import * as about from './about.js';
import * as projects from './projects.js';
import * as contact from './contact.js';
import * as cv from './cv.js';
import * as terminal from './terminal.js';
import * as museum from './museum.js';
import * as settingsApp from './settings.js';

export const APPS = {
  [about.meta.id]:      { meta: about.meta,      launch: about.launch },
  [projects.meta.id]:   { meta: projects.meta,   launch: projects.launch },
  [contact.meta.id]:    { meta: contact.meta,    launch: contact.launch },
  [cv.meta.id]:         { meta: cv.meta,         launch: cv.launch },
  [terminal.meta.id]:   { meta: terminal.meta,   launch: terminal.launch },
  [museum.meta.id]:     { meta: museum.meta,     launch: museum.launch },
  [settingsApp.meta.id]: { meta: settingsApp.meta, launch: settingsApp.launch },
};

/** Lanza una app por id (con guard de existencia) */
export function launchApp(id, opts = {}) {
  const app = APPS[id];
  if (!app) {
    console.warn(`[registry] App desconocida: ${id}`);
    return Promise.resolve();
  }
  import('../../engine/audio.js').then(({ sfx }) => sfx.click());
  return app.launch(opts);
}

/** Papelera: no es app registrada; ventana juguetona dedicada */
export function openRecycleBin() {
  return import('../windowManager.js').then(({ wm }) => {
    if (wm.get('recycle')) return wm.get('recycle').focus();

    const box = document.createElement('div');
    box.style.cssText = `
      height:100%; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:16px;
    `;
    box.innerHTML = `
      <img src="assets/icons/recycle-32x32.png" alt="" width="48" height="48">
      <p style="margin:0; font-size:13px;">La Papelera está vacía.</p>
    `;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn95';
    ok.textContent = 'Aceptar';
    ok.addEventListener('click', () => win.close());
    box.append(ok);

    const win = wm.create({
      id: 'recycle',
      title: 'Papelera de reciclaje',
      icon: 'assets/icons/recycle-16x16.png',
      width: 320,
      height: 240,
      content: box,
    });
  });
}
