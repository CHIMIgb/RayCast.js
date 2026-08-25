/* ============================================================
   apps/museum.js — Launcher del museo 3D (raycasting)
   ============================================================ */

export const meta = {
  id: 'museum',
  title: 'Museo SVR.EXE',
  icons: { 16: 'assets/icons/globe-16x16.png', 32: 'assets/icons/globe-32x32.png' },
};

export function launch() {
  return import('../windowManager.js').then(({ wm }) => {
    if (wm.get(meta.id)) return wm.get(meta.id).focus();

    const box = document.createElement('div');
    box.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 20px;
      text-align: center;
    `;

    box.innerHTML = `
      <img src="assets/icons/globe-32x32.png" alt="" width="48" height="48">
      <div style="font-size:15px;">
        <b>Museo Interactivo 3D</b><br>
        <span style="font-size:12px;color:#444;">
          Recorre un mundo estilo Wolfenstein con tus proyectos.<br>
          Controles: <b>WASD / flechas</b> para moverte, <b>E</b> o toque para interactuar.
        </span>
      </div>
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:10px;';

    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn95';
    go.textContent = 'Entrar al Museo';
    go.addEventListener('click', () => {
      win.close();
      location.hash = '#/game';
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn95';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => win.close());

    row.append(go, cancel);
    box.append(row);

    const win = wm.create({
      id: meta.id,
      title: 'Museo SVR.EXE',
      icon: meta.icons[16],
      width: 380,
      height: 300,
      content: box,
    });
  });
}
