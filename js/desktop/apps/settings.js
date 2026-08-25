/* ============================================================
   apps/settings.js — Propiedades de Pantalla
   Toggles: efecto CRT · sonidos del sistema. Persistencia local.
   ============================================================ */

import { isCrt, setCrt } from '../effects.js';
import { sound } from '../../engine/audio.js';

export const meta = {
  id: 'settings',
  title: 'Propiedades',
  icons: { 16: 'assets/icons/settings-16x16.png', 32: 'assets/icons/settings-32x32.png' },
};

function makeCheck(label, checked, onChange) {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:8px; cursor:default;';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = checked;

  box.addEventListener('change', () => onChange(box.checked));

  row.append(box, label);
  return { row, box };
}

export function launch() {
  return import('../windowManager.js').then(({ wm }) => {
    if (wm.get(meta.id)) return wm.get(meta.id).focus();

    const pad = document.createElement('div');
    pad.className = 'app-pad';
    pad.innerHTML = `
      <h3 style="margin:0 0 12px; font-size:14px;">Efectos del sistema</h3>
    `;

    let crtVal = isCrt();
    let sndVal = sound.enabled;

    const crt = makeCheck('Efecto CRT (scanlines y viñeta)', crtVal, (v) => { crtVal = v; setCrt(v); });
    const snd = makeCheck('Sonidos del sistema', sndVal, (v) => { sndVal = v; sound.setEnabled(v); });
    pad.append(crt.row, snd.row);

    // Nota de época
    const note = document.createElement('p');
    note.style.cssText = 'font-size:11px; color:#555; margin:10px 0 16px;';
    note.textContent = 'Los cambios se aplican al instante y quedan guardados en este equipo.';
    pad.append(note);

    // Botonera clásica
    const foot = document.createElement('div');
    foot.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn95';
    ok.textContent = 'Aceptar';
    ok.addEventListener('click', () => win.close());

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn95';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => {
      setCrt(crtVal = isCrt());          // sin cambios reales: solo cerrar
      win.close();
    });

    foot.append(ok, cancel);
    pad.append(foot);

    const win = wm.create({
      id: meta.id,
      title: 'Propiedades - Pantalla',
      icon: meta.icons[16],
      width: 380,
      height: 300,
      content: pad,
    });
  });
}
