/* ============================================================
   taskbar.js — Barra de tareas Windows 95
   ------------------------------------------------------------
   • Botón Inicio + menú desplegable (apps, museo, apagar)
   • Botones de ventanas abiertas (toggle clásico), incluye
     ventanas creadas antes de montar la barra
   • Bandeja con reloj real
   Devuelve una función cleanup para el cambio de vista.
   ============================================================ */

import { on, wm } from './windowManager.js';
import { APPS, launchApp } from './apps/registry.js';
import { sfx } from '../engine/audio.js';

const ICON = 'assets/icons/windows-16x16.png';

/* ---------- Reloj de la bandeja ---------- */
function startClock(clockEl) {
  const fmt = new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const tick = () => { clockEl.textContent = fmt.format(new Date()); };
  tick();
  const timer = setInterval(tick, 15000);
  return () => clearInterval(timer);
}

/* ---------- Pantalla de apagado ---------- */
function showShutdown() {
  const screen = document.createElement('div');
  screen.className = 'shutdown-screen';
  screen.innerHTML = `
    <div>Es ahora seguro apagar su equipo.</div>
    <small>Haz clic en cualquier parte para reiniciar</small>
  `;
  screen.addEventListener('click', () => {
    screen.remove();
    location.hash = '#/boot';
    location.reload();               // reinicio completo → secuencia de arranque
  });
  document.body.append(screen);
}

/* ---------- Menú Inicio ---------- */
function buildStartMenu() {
  const menu = document.createElement('div');
  menu.className = 'start-menu';
  menu.hidden = true;

  const side = document.createElement('div');
  side.className = 'start-menu-side';
  side.textContent = 'Portafolio 95';

  const items = document.createElement('div');
  items.className = 'menu-items';

  const addItem = ({ label, icon, action }) => {
    if (!label) {
      const sep = document.createElement('div');
      sep.className = 'menu-sep';
      items.append(sep);
      return;
    }
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.tabIndex = 0;
    el.setAttribute('role', 'menuitem');
    if (icon) el.innerHTML = `<img src="${icon}" alt="">`;
    el.append(label);
    // La acción se ejecuta vía delegación (abajo); guardamos el comando
    if (action) el.dataset.action = action;
    items.append(el);
  };

  for (const id of ['about', 'projects', 'cv', 'contact', 'terminal', 'settings']) {
    addItem({ label: APPS[id].meta.title, icon: APPS[id].meta.icons[16], action: id });
  }

  addItem({ label: null });                                    // separador
  addItem({ label: 'Entrar al Museo…', icon: APPS.museum.meta.icons[16], action: 'museum' });
  addItem({ label: null });
  addItem({ label: 'Apagar…', icon: 'assets/icons/settings-16x16.png', action: 'shutdown' });

  menu.append(side, items);
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Menú Inicio');

  // Delegación: click o Enter/Espacio sobre un item
  function activate(e) {
    const item = e.target.closest('.menu-item');
    if (!item || !item.dataset.action) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const cmd = item.dataset.action;

    menu.hidden = true;
    menu.dispatchEvent(new CustomEvent('menuclosed'));

    if (cmd === 'shutdown') showShutdown();
    else launchApp(cmd);
  }

  menu.addEventListener('click', activate);
  menu.addEventListener('keydown', activate);

  return menu;
}

/* ---------- Botones de tarea ---------- */
function bindTaskButtons(container) {
  const buttons = new Map();

  function makeBtn(id) {
    if (buttons.has(id)) return buttons.get(id);
    const win = wm.get(id);
    if (!win) return null;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'task-btn';
    if (win.icon) btn.innerHTML = `<img src="${win.icon}" alt="" width="16" height="16">`;
    const span = document.createElement('span');
    span.textContent = win.title;
    btn.append(span);

    btn.addEventListener('click', () => {
      const w = wm.get(id);
      if (!w) return;
      if (w.minimized) return w.restore();
      if (wm.active() === w) return w.minimize();
      w.focus();
    });

    container.append(btn);
    buttons.set(id, btn);
    return btn;
  }

  // Ventanas ya abiertas antes de montar la barra
  for (const id of wm.windows.keys()) {
    const btn = makeBtn(id);
    btn?.classList.toggle('active', wm.active()?.id === id);
  }

  const offs = [
    on('open', ({ id }) => makeBtn(id)),
    on('close', ({ id }) => { buttons.get(id)?.remove(); buttons.delete(id); }),
    on('focus', ({ id }) =>
      [...buttons].forEach(([bid, b]) => b.classList.toggle('active', bid === id))),
    on('minimize', ({ id }) => buttons.get(id)?.classList.remove('active')),
    on('restore', ({ id }) => buttons.get(id)?.classList.add('active')),
    on('title', ({ id, title }) => {
      const b = buttons.get(id);
      if (b) b.querySelector('span').textContent = title;
    }),
  ];

  return () => offs.forEach((off) => off());
}

/* ============================================================
   Montaje principal — devuelve función cleanup
   ============================================================ */
export function mountTaskbar(workspace) {
  const bar = document.createElement('div');
  bar.className = 'taskbar';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'start-btn';
  startBtn.innerHTML = `<img src="${ICON}" alt="">`;
  startBtn.append('Inicio');

  const tasks = document.createElement('div');
  tasks.className = 'task-buttons';

  const tray = document.createElement('div');
  tray.className = 'tray';
  const clock = document.createElement('span');
  clock.className = 'tray-clock';
  tray.append(clock);

  bar.append(startBtn, tasks, tray);
  workspace.append(bar);

  /* --- Menú Inicio --- */
  const menu = buildStartMenu();
  workspace.append(menu);

  function setOpen(open) {
    menu.hidden = !open;
    startBtn.classList.toggle('active', open);
  }
  const isOpen = () => !menu.hidden;

  startBtn.addEventListener('click', () => { sfx.click(); setOpen(!isOpen()); });
  menu.addEventListener('menuclosed', () => setOpen(false));

  // Cerrar al hacer click fuera / Escape
  const outside = (e) => {
    if (!isOpen()) return;
    if (!e.target.closest('.start-menu') && !e.target.closest('.start-btn')) setOpen(false);
  };
  const onKey = (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', onKey);

  const stopClock = startClock(clock);
  const unbindTasks = bindTaskButtons(tasks);

  return () => {
    stopClock();
    unbindTasks();
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', onKey);
    bar.remove();
    menu.remove();
  };
}
