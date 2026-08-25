/* ============================================================
   desktopView.js — Escritorio: iconos + taskbar
   ------------------------------------------------------------
   • Iconos con selección (1 click/tap) y apertura (2º click,
     doble-click en mouse) — patrón clásico Win95 adaptado a táctil
   • Click en el fondo deselecciona
   Devuelve función cleanup (desuscribe taskbar y listeners).
   ============================================================ */

import { mountTaskbar } from './taskbar.js';
import { APPS, launchApp, openRecycleBin } from './apps/registry.js';

const DESK_ORDER = ['about', 'projects', 'cv', 'contact', 'terminal'];

export function mountDesktop(workspace) {
  /* ---------- Iconos ---------- */
  const iconsLayer = document.createElement('div');
  iconsLayer.style.cssText = `
    position:absolute; inset:0 0 var(--taskbar-h) 0;
    display:flex; flex-direction:column; flex-wrap:wrap;
    align-content:flex-start; gap:6px; padding:10px;
  `;
  workspace.append(iconsLayer);

  const clearSelection = () =>
    iconsLayer.querySelectorAll('.desk-icon.selected')
      .forEach((el) => el.classList.remove('selected'));

  function makeDeskIcon({ label, icon16, onOpen }) {
    const el = document.createElement('div');
    el.className = 'desk-icon';
    el.tabIndex = 0;                              // navegable con Tab
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Abrir ${label}`);
    el.innerHTML = `<img src="${icon16}" alt="">`;
    const lab = document.createElement('span');
    lab.className = 'desk-label';
    lab.textContent = label;
    el.append(lab);

    const open = () => { clearSelection(); onOpen(); };

    el.addEventListener('click', () => {
      if (el.classList.contains('selected')) open();
      else { clearSelection(); el.classList.add('selected'); }
    });
    el.addEventListener('dblclick', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    iconsLayer.append(el);
    return el;
  }

  // Apps registradas
  for (const id of DESK_ORDER) {
    makeDeskIcon({
      label: APPS[id].meta.title,
      icon16: APPS[id].meta.icons[32],
      onOpen: () => launchApp(id),
    });
  }

  // Papelera
  makeDeskIcon({
    label: 'Papelera',
    icon16: 'assets/icons/recycle-32x32.png',
    onOpen: openRecycleBin,
  });

  // Museo (acceso directo visible)
  makeDeskIcon({
    label: 'Museo SVR.EXE',
    icon16: APPS.museum.meta.icons[32],
    onOpen: () => launchApp('museum'),
  });

  // Click en el fondo del escritorio deselecciona
  workspace.addEventListener('pointerdown', onBackground);
  function onBackground(e) {
    if (!e.target.closest('.desk-icon')) clearSelection();
  }

  /* ---------- Taskbar ---------- */
  const cleanupTaskbar = mountTaskbar(workspace);

  return () => {
    cleanupTaskbar();
    workspace.removeEventListener('pointerdown', onBackground);
  };
}
