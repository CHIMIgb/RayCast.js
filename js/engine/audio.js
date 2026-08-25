/* ============================================================
   audio.js — SFX sintetizados con Web Audio API (sin archivos)
   ------------------------------------------------------------
   • beep / click / ding / chord / error
   • Estado persistido ('svr_sound'), desbloqueo automático del
     contexto en el primer gesto del usuario (política autoplay).
   ============================================================ */

import { settings } from '../data/portfolio.js';

let ctx = null;
let unlocked = false;

const KEY = 'svr_sound';

function stored() {
  const v = localStorage.getItem(KEY);
  return v === null ? !!settings.soundDefault : v === '1';
}

export const sound = {
  enabled: stored(),

  setEnabled(v) {
    this.enabled = !!v;
    localStorage.setItem(KEY, v ? '1' : '0');
    if (v) this.click();
  },
};

/* ---------- Contexto ---------- */
function ac() {
  if (!sound.enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Primer gesto → desbloquea el contexto (iOS/Safari)
if (typeof document !== 'undefined') {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    ac();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

/* ---------- Primitiva: tono con envolvente ---------- */
function tone({ freq = 440, dur = 0.1, type = 'square', vol = 0.05, delay = 0, slide = 0 }) {
  const c = ac();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(slide, 1), t0 + dur);

  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ---------- Efectos ---------- */
export const sfx = {
  /** Click corto de interfaz */
  click() {
    tone({ freq: 1800, dur: 0.03, type: 'square', vol: 0.025 });
  },

  /** Ding suave (notificaciones) */
  ding() {
    tone({ freq: 880, dur: 0.18, type: 'sine', vol: 0.05 });
    tone({ freq: 1318, dur: 0.22, type: 'sine', vol: 0.04, delay: 0.09 });
  },

  /** Error: doble beep grave */
  error() {
    tone({ freq: 220, dur: 0.12, type: 'square', vol: 0.06 });
    tone({ freq: 180, dur: 0.16, type: 'square', vol: 0.06, delay: 0.15 });
  },

  /** Acorde de arranque (estilo chime de la época) */
  chord() {
    // Do mayor: C5-E5-G5
    tone({ freq: 523.25, dur: 0.7, type: 'triangle', vol: 0.05 });
    tone({ freq: 659.25, dur: 0.7, type: 'triangle', vol: 0.04, delay: 0.06 });
    tone({ freq: 783.99, dur: 0.8, type: 'triangle', vol: 0.045, delay: 0.12 });
  },

  /** Beep genérico configurable */
  beep(freq = 800, dur = 0.08, type = 'square') {
    tone({ freq, dur, type, vol: 0.05 });
  },
};
