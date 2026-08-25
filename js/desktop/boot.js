/* ============================================================
   boot.js — Secuencia de arranque de época
   ------------------------------------------------------------
   Etapas (todas skippables con cualquier tecla/click):
     1. BIOS POST con contador de memoria animado
     2. Prompt DOS tecleando "WIN"
     3. Splash PORTAFOLIO 95 + acorde de arranque
   Devuelve función cleanup. onFinish() dispara la transición
   al escritorio.
   ============================================================ */

import { profile } from '../data/portfolio.js';
import { sfx } from '../engine/audio.js';

const BIOS_LINES = [
  ['Award Modular BIOS v4.51PG, An Energy Star Ally', ''],
  [`Copyright (C) 1984-95, ${profile.name}, Inc.`, ''],
  ['', ''],
  [`${profile.name.toUpperCase()} PORTFOLIO BIOS (08241995)`, 'head'],
  ['Intel Pentium(R) CPU 133MHz', ''],
  ['Memory Test : ', 'memline'],          // el contador se anima aquí
  ['', ''],
  ['Detecting IDE Primary Master  ... PORTFOLIO HDD 1.9GB', 'ok'],
  ['Detecting Mouse ............... PS/2 OK', 'ok'],
  ['Loading SVR-DOS kernel ........ OK', 'ok'],
];

const TYPE_SPEED = 110;      // ms por carácter en "WIN"
const LINE_DELAY = 260;      // ms entre líneas BIOS

export function runBoot(host, { onFinish }) {
  host.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'boot-screen';
  host.append(screen);

  let finished = false;
  const timers = [];

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const interval = (fn, ms) => {
    const id = setInterval(fn, ms);
    timers.push(id);
    return id;
  };

  /* ---------- Finalización / skip ---------- */
  function finish() {
    if (finished) return;
    finished = true;
    cleanup();
    onFinish?.();
  }

  const onSkip = () => finish();
  document.addEventListener('keydown', onSkip);
  document.addEventListener('pointerdown', onSkip);

  function cleanup() {
    // clearTimeout y clearInterval comparten pool de IDs; limpiamos ambos
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    document.removeEventListener('keydown', onSkip);
    document.removeEventListener('pointerdown', onSkip);
  }

  /* Movimiento reducido: POST estático y salida rápida */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const [text, cls] of BIOS_LINES) {
      const el = document.createElement('div');
      el.className = `bios-line${cls && cls !== 'memline' ? ' ' + cls : ''}`;
      el.textContent = cls === 'memline' ? 'Memory Test : 65536K OK' : text;
      screen.append(el);
    }
    later(finish, 500);
    return cleanup;
  }

  const line = (text, cls = '') => {
    const el = document.createElement('div');
    el.className = `bios-line${cls ? ' ' + cls : ''}`;
    el.textContent = text;
    screen.append(el);
    return el;
  };

  /* ---------- Etapa 1: BIOS POST ---------- */
  let delay = 150;

  for (const [text, cls] of BIOS_LINES) {
    later(() => {
      if (cls === 'memline') animateMemory();
      else line(text, cls);
    }, delay);
    delay += cls === 'memline' ? 900 : LINE_DELAY;
  }

  function animateMemory() {
    const el = line('', 'memline');
    const total = 65536;
    let kb = 0;
    const id = interval(() => {
      kb = Math.min(kb + 8192, total);
      el.textContent = `Memory Test : ${kb}K${kb === total ? ' OK' : ''}`;
      if (kb === total) clearInterval(id);
    }, 40);
  }

  // Pausa final del POST y salto al prompt DOS
  later(clearToDos, delay + 500);

  function clearToDos() {
    screen.innerHTML = '';
    const promptLine = document.createElement('div');
    promptLine.className = 'bios-line cursor-blink';
    promptLine.innerHTML = '<span class="typed">C:\\&gt;</span>';
    screen.append(promptLine);

    const typed = promptLine.querySelector('.typed');
    const word = ' WIN';
    let i = 0;

    const typeTimer = setInterval(() => {
      typed.textContent += word[i++];
      if (i >= word.length) {
        clearInterval(typeTimer);
        later(showSplash, 650);
      }
    }, TYPE_SPEED);
    timers.push(typeTimer);
  }

  /* ---------- Etapa 3: Splash ---------- */
  function showSplash() {
    screen.innerHTML = `
      <div class="splash">
        <div class="splash-box">
          <img src="assets/icons/windows-32x32.png" alt="" width="96" height="96">
          <div class="splash-title">Portafolio <span class="ninefive">95</span></div>
          <div class="splash-sub">${profile.role} · Edición Retro</div>
        </div>
        <div class="splash-foot-left">(C) ${new Date().getFullYear()} ${profile.name}</div>
        <div class="splash-foot-right">SVR-DOS v9.5</div>
      </div>
    `;
    sfx.chord();
    later(finish, 1600);
  }

  return cleanup;
}
