/* ============================================================
   windowManager.js — Gestor de ventanas Windows 95 (vanilla)
   ------------------------------------------------------------
   • Crear / enfocar / minimizar / maximizar / cerrar
   • Drag por titlebar (Pointer Events: mouse + táctil)
   • Resize desde la esquina inferior derecha
   • Z-index con foco, cascada automática
   • Eventos para taskbar y apps: open/close/focus/minimize/...
   Exporta `wm` (singleton) — también en window.wm para consola.
   ============================================================ */

/* ---------- Mini emisor de eventos ---------- */
const listeners = new Map();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

function emit(event, payload) {
  listeners.get(event)?.forEach((cb) => cb(payload));
}

/* ---------- Glifos SVG pixel-perfect de los botones ---------- */
const GLYPHS = {
  minimize:
    '<svg width="6" height="6" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="5" width="6" height="1" fill="#000"/></svg>',
  maximize:
    '<svg width="8" height="8" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 0h8v8H0zM1 2h6v5H1z" fill-rule="evenodd" fill="#000"/></svg>',
  restore:
    '<svg width="8" height="8" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 3h4v4H1zM0 0h6v1H0zM5 1h1v4H5z" fill="#000"/><path d="M2 4h2v2H2z" fill="#c0c0c0"/></svg>',
  close:
    '<svg width="7" height="7" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><path fill="#000" d="M0 0h1v1H0z M1 1h1v1H1z M4 4h1v1H4z M5 5h1v1H5z M0 5h1v1H0z M1 4h1v1H1z M4 1h1v1H4z M5 0h1v1H5z M2 2h2v2H2z"/></svg>',
};

const isSmallViewport = () =>
  window.matchMedia('(max-width: 767px)').matches;

/* ============================================================
   Ventana individual
   ============================================================ */
export class Win95Window {
  constructor(options = {}) {
    this.id = options.id ?? `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.title = options.title ?? 'Ventana';
    this.icon = options.icon ?? null;
    this.minimizable = options.minimizable ?? true;
    this.maximizable = options.maximizable ?? true;
    this.resizable = options.resizable ?? true;
    this.onClose = options.onClose ?? null;

    this.minimized = false;
    this.maximized = false;
    this._prevRect = null;           // geometría previa al maximizar
    this._app = null;                // elemento de app montado (fases 2+)

    this._buildDom();
    if (options.content) this.setContent(options.content);
    this._applyInitialGeometry(options);
    this._bindInteractions();
  }

  /* ---------- Construcción DOM ---------- */
  _buildDom() {
    const el = document.createElement('section');
    el.className = 'win-window';
    el.id = this.id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', this.title);

    const iconHtml = this.icon
      ? `<img class="win-icon" src="${this.icon}" alt="">`
      : '';

    const controls = [
      this.minimizable && `<button type="button" class="win-btn" data-action="minimize" aria-label="Minimizar">${GLYPHS.minimize}</button>`,
      this.maximizable && `<button type="button" class="win-btn" data-action="maximize" aria-label="Maximizar">${GLYPHS.maximize}</button>`,
      `<button type="button" class="win-btn win-btn-close" data-action="close" aria-label="Cerrar">${GLYPHS.close}</button>`,
    ].filter(Boolean).join('');

    el.innerHTML = `
      <header class="win-titlebar">
        ${iconHtml}
        <span class="win-title"></span>
        <div class="win-controls">${controls}</div>
      </header>
      <div class="win-body"></div>
      ${this.resizable ? '<div class="win-resize-grip"></div>' : ''}
    `;

    this.el = el;
    this._titleEl = el.querySelector('.win-title');
    this._titleEl.textContent = this.title;
    this._bodyEl = el.querySelector('.win-body');
    this._gripEl = el.querySelector('.win-resize-grip');
  }

  setContent(content) {
    this._bodyEl.innerHTML = '';
    if (typeof content === 'string') this._bodyEl.innerHTML = content;
    else if (content instanceof HTMLElement) this._bodyEl.append(content);
    return this;
  }

  setTitle(text) {
    this.title = text;
    this._titleEl.textContent = text;
    emit('title', { id: this.id, title: text });
    return this;
  }

  /* ---------- Geometría ---------- */
  _applyInitialGeometry({ x, y, width = 480, height = 320 }) {
    if (isSmallViewport()) {
      // En pantallas pequeñas las ventanas abren maximizadas (tipo "app")
      this._prevRect = { left: '48px', top: '36px', width: '480px', height: '320px' };
      this.el.style.left = '0';
      this.el.style.top = '0';
      this.el.style.width = '100%';
      this.el.style.height = `calc(100% - var(--taskbar-h))`;
      this.maximized = true;
      this.el.classList.add('maximized');
      return;
    }

    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;

    if (x == null || y == null) ({ x, y } = cascadeFor(width, height));
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  _clampPos(x, y) {
    const w = this.el.offsetWidth;
    const vw = window.innerWidth;
    const maxY = window.innerHeight - varTaskbar() - this._titlebarHeight();

    return [
      Math.min(Math.max(x, -(w - 60)), vw - 40),
      Math.min(Math.max(y, 0), Math.max(maxY, 0)),
    ];
  }

  _titlebarHeight() {
    return this.el.querySelector('.win-titlebar')?.offsetHeight || 28;
  }

  toggleMaximize() {
    if (!this.maximizable || this.minimized) return;

    if (!this.maximized) {
      this._prevRect = {
        left: this.el.style.left,
        top: this.el.style.top,
        width: this.el.style.width,
        height: this.el.style.height,
      };
      Object.assign(this.el.style, {
        left: '0', top: '0',
        width: '100%',
        height: `calc(100% - var(--taskbar-h))`,
      });
      this.maximized = true;
      this.el.classList.add('maximized');
    } else {
      Object.assign(this.el.style, this._prevRect ?? {});
      this.maximized = false;
      this.el.classList.remove('maximized');
    }

    // Actualizar glifo del botón (maximize ↔ restore)
    const maxBtn = this.el.querySelector('[data-action="maximize"]');
    if (maxBtn) maxBtn.innerHTML = this.maximized ? GLYPHS.restore : GLYPHS.maximize;

    emit('maximize', { id: this.id, maximized: this.maximized });
  }

  minimize() {
    if (this.minimized) return;
    this.minimized = true;
    this.el.style.display = 'none';
    emit('minimize', { id: this.id });

    // Dar foco a la siguiente ventana visible
    const next = wm.visibleWindows().find((w) => w !== this);
    if (next) next.focus();
    else emit('all-minimized');
  }

  restore() {
    if (!this.minimized) return;
    this.minimized = false;
    this.el.style.display = '';
    emit('restore', { id: this.id });
    this.focus();
  }

  focus() {
    wm.focus(this);
  }

  /* ---------- Interacciones (drag / resize / botones) ---------- */
  _bindInteractions() {
    const titlebar = this.el.querySelector('.win-titlebar');

    // Cualquier click dentro enfoca la ventana
    this.el.addEventListener('pointerdown', () => wm.focus(this));

    // --- DRAG ---
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.win-btn')) return;     // no arrastrar desde botones
      if (this.maximized) return;                    // maximizada no se arrastra

      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const origX = this.el.offsetLeft, origY = this.el.offsetTop;
      titlebar.setPointerCapture(e.pointerId);

      const move = (ev) => {
        const [nx, ny] = this._clampPos(origX + ev.clientX - startX, origY + ev.clientY - startY);
        this.el.style.left = `${nx}px`;
        this.el.style.top = `${ny}px`;
      };
      const up = () => {
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', up);
        titlebar.removeEventListener('pointercancel', up);
      };
      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', up);
      titlebar.addEventListener('pointercancel', up);
    });

    // Doble click en titlebar → maximizar/restaurar
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.win-btn')) return;
      this.toggleMaximize();
    });

    // Botones de la titlebar
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('.win-btn');
      if (!btn) return;
      switch (btn.dataset.action) {
        case 'minimize': this.minimize(); break;
        case 'maximize': this.toggleMaximize(); break;
        case 'close': this.close(); break;
      }
    });

    // --- RESIZE ---
    if (this._gripEl) {
      this._gripEl.addEventListener('pointerdown', (e) => {
        if (this.maximized) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX, startY = e.clientY;
        const startW = this.el.offsetWidth, startH = this.el.offsetHeight;
        this._gripEl.setPointerCapture(e.pointerId);

        const MIN_W = 220, MIN_H = 140;
        const move = (ev) => {
          const w = Math.max(startW + ev.clientX - startX, MIN_W);
          const h = Math.max(startH + ev.clientY - startY, MIN_H);
          this.el.style.width = `${w}px`;
          this.el.style.height = `${h}px`;
        };
        const up = () => {
          this._gripEl.removeEventListener('pointermove', move);
          this._gripEl.removeEventListener('pointerup', up);
          this._gripEl.removeEventListener('pointercancel', up);
        };
        this._gripEl.addEventListener('pointermove', move);
        this._gripEl.addEventListener('pointerup', up);
        this._gripEl.addEventListener('pointercancel', up);
      });
    }
  }

  /* ---------- Ciclo de vida ---------- */
  close() {
    this.onClose?.();
    emit('close', { id: this.id });
    this.el.remove();
    wm.windows.delete(this.id);

    // Enfocar la que quedó encima
    const next = wm.visibleWindows()[0];
    if (next) next.focus();
    else emit('all-closed');
  }
}

/* ============================================================
   Gestor (singleton)
   ============================================================ */
let zTop = 100;
let cascadeStep = 0;
let cachedTaskbarH = 0;

function cascadeFor(width, height) {
  const step = cascadeStep++ % 8 * 26;
  const x = Math.min(48 + step, Math.max(window.innerWidth - width - 16, 16));
  const y = Math.min(36 + step, Math.max(window.innerHeight - height - varTaskbar() - 16, 16));
  return { x, y };
}

function varTaskbar() {
  if (!cachedTaskbarH) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h');
    cachedTaskbarH = parseInt(v, 10) || 40;
  }
  return cachedTaskbarH;
}

class WindowManager {
  constructor() {
    this.windows = new Map();       // id → Win95Window
    this.root = document.body;
  }

  create(options = {}) {
    const win = new Win95Window(options);
    this.windows.set(win.id, win);
    this.root.append(win.el);
    win.focus();
    emit('open', { id: win.id, win });
    return win;
  }

  get(id) {
    return this.windows.get(id);
  }

  visibleWindows() {
    // Ordenadas de arriba hacia abajo por z-index
    return [...this.windows.values()]
      .filter((w) => !w.minimized)
      .sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex || 0);
  }

  focus(winOrId) {
    const win = typeof winOrId === 'string' ? this.windows.get(winOrId) : winOrId;
    if (!win) return;
    if (win.minimized) win.restore();

    zTop += 1;
    win.el.style.zIndex = zTop;

    for (const w of this.windows.values()) {
      w.el.classList.toggle('inactive', w !== win);
    }
    emit('focus', { id: win.id });
  }

  active() {
    return this.visibleWindows()[0] ?? null;
  }

  /** Limpia todas las ventanas (al cambiar de vista) */
  clear() {
    for (const win of this.windows.values()) win.el.remove();
    this.windows.clear();
  }
}

export const wm = new WindowManager();

// Acceso desde consola para pruebas: wm.create({...})
if (typeof window !== 'undefined') window.wm = wm;
