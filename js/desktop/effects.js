/* ============================================================
   effects.js — Efecto CRT global (scanlines + viñeta + parpadeo)
   Estado persistido ('svr_crt'). El overlay cubre TODAS las
   vistas (escritorio y juego). Respeta prefers-reduced-motion.
   ============================================================ */

import { settings } from '../data/portfolio.js';

const KEY = 'svr_crt';
let overlay = null;
let enabled = false;

function stored() {
  const v = localStorage.getItem(KEY);
  return v === null ? !!settings.crtEffectDefault : v === '1';
}

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'crt-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
}

export function isCrt() {
  return enabled;
}

export function setCrt(v) {
  enabled = !!v;
  localStorage.setItem(KEY, v ? '1' : '0');
  if (v) ensureOverlay();
  overlay?.toggleAttribute('hidden', !v);
}

/* Aplica el estado guardado al arrancar la app */
export function initEffects() {
  setCrt(stored());
}

/* ============================================================
   Transición CRT power-off/power-on entre vistas
   ------------------------------------------------------------
   Colapso vertical a línea brillante → se ejecuta swapFn bajo la
   pantalla negra → reexpansión. Respeta prefers-reduced-motion
   (intercambio directo).
   ============================================================ */
export function crtSwap(swapFn) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swapFn();
    return;
  }

  const d = document.createElement('div');
  d.className = 'crt-transition';
  document.body.append(d);

  setTimeout(() => {
    d.classList.add('mid');          // destello de línea
    try { swapFn(); } finally { /* la vista cambia bajo cobertura */ }
  }, 215);

  setTimeout(() => d.classList.add('out'), 265);
  setTimeout(() => d.remove(), 620);
}

/** ¿Usuario prefiere movimiento reducido? */
export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
