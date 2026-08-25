/* ============================================================
   touchControls.js — Controles táctiles del museo
   ------------------------------------------------------------
   • Joystick virtual (izquierda): eje Y = avanzar/retroceder,
     con zona muerta y knob visual limitado al radio
   • Mirar: arrastre sobre el canvas (multitouch real: se puede
     mover y rotar a la vez — pointers independientes)
   • Botón [E]: interactuar
   Solo se monta si (pointer: coarse). Devuelve cleanup.
   ============================================================ */

const JOY_RADIUS = 46;
const DEADZONE = 0.28;          // fracción del radio
const LOOK_SENS = 0.006;        // radianes por píxel

export function mountTouchControls({ shell, onVector, onLookDelta, onInteract }) {
  if (!window.matchMedia('(pointer: coarse)').matches) return () => {};

  const ac = new AbortController();
  const sig = { signal: ac.signal };

  /* ---------- Capa de controles ---------- */
  const layer = document.createElement('div');
  layer.className = 'touch-controls';
  layer.innerHTML = `
    <div class="joy-base">
      <div class="joy-knob"></div>
    </div>
    <button type="button" class="btn-e-touch" aria-label="Interactuar">E</button>
  `;
  shell.append(layer);

  const joyBase = layer.querySelector('.joy-base');
  const knob = layer.querySelector('.joy-knob');

  /* ---------- Joystick ---------- */
  let joyId = null;

  function handleJoy(e) {
    const r = joyBase.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let dx = (e.clientX - cx) / JOY_RADIUS;
    let dy = (e.clientY - cy) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }

    knob.style.transform = `translate(${(dx * JOY_RADIUS).toFixed(1)}px, ${(dy * JOY_RADIUS).toFixed(1)}px)`;

    // Zona muerta: fuera de ella reportamos dirección plena
    const active = Math.abs(dy) > DEADZONE ? dy : 0;
    onVector({ x: Math.abs(dx) > DEADZONE ? dx : 0, y: active });
  }

  function releaseJoy() {
    joyId = null;
    knob.style.transform = 'translate(0px, 0px)';
    onVector({ x: 0, y: 0 });
  }

  joyBase.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joyBase.setPointerCapture(joyId);
    handleJoy(e);
  }, sig);
  joyBase.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) handleJoy(e);
  }, sig);
  joyBase.addEventListener('pointerup', releaseJoy, sig);
  joyBase.addEventListener('pointercancel', releaseJoy, sig);

  /* ---------- Mirar (arrastre sobre el canvas) ---------- */
  const lookPointers = new Map();          // pointerId → lastX

  shell.addEventListener('pointerdown', (e) => {
    if (e.target !== shell.querySelector('#museum-canvas')) return;
    lookPointers.set(e.pointerId, e.clientX);
    shell.setPointerCapture?.(e.pointerId);
  }, sig);

  shell.addEventListener('pointermove', (e) => {
    if (!lookPointers.has(e.pointerId)) return;
    const lastX = lookPointers.get(e.pointerId);
    lookPointers.set(e.pointerId, e.clientX);
    onLookDelta((e.clientX - lastX) * LOOK_SENS);
  }, sig);

  const endLook = (e) => lookPointers.delete(e.pointerId);
  shell.addEventListener('pointerup', endLook, sig);
  shell.addEventListener('pointercancel', endLook, sig);

  /* ---------- Botón E ---------- */
  layer.querySelector('.btn-e-touch').addEventListener('click', onInteract, sig);

  /* ---------- Cleanup ---------- */
  return () => {
    ac.abort();
    layer.remove();
  };
}
