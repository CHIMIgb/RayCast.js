/* ============================================================
   apps/projects.js — Explorador de proyectos (master-detail)
   opts.selectId: preselecciona un proyecto al abrir/reutilizar.
   ============================================================ */

import { projects } from '../../data/portfolio.js';

export const meta = {
  id: 'projects',
  title: 'Proyectos',
  icons: { 16: 'assets/icons/folder_open-16x16.png', 32: 'assets/icons/folder_open-32x32.png' },
};

/* ---------- Panel de detalle ---------- */
function renderDetail(container, project) {
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = project.title;

  const year = document.createElement('p');
  year.className = 'detail-year';
  year.textContent = `${project.year} · ${project.tech.join(' · ')}`;

  container.append(title, year);

  // Captura (o placeholder)
  const shot = document.createElement('div');
  shot.className = 'detail-shot';
  if (project.screenshot) {
    const img = document.createElement('img');
    img.src = project.screenshot;
    img.alt = `Captura de ${project.title}`;
    shot.append(img);
  } else {
    shot.innerHTML = '<span class="no-shot">[ Sin captura disponible ]</span>';
  }
  container.append(shot);

  // Descripción
  const desc = document.createElement('div');
  desc.className = 'detail-desc';
  for (const p of project.description) {
    const el = document.createElement('p');
    el.textContent = p;
    desc.append(el);
  }
  container.append(desc);

  // Tags
  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  for (const t of project.tech) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = t;
    tags.append(tag);
  }
  container.append(tags);

  // Acciones
  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  if (project.liveUrl) {
    const demo = document.createElement('a');
    demo.className = 'btn95 btn-link';
    demo.href = project.liveUrl;
    demo.target = '_blank';
    demo.rel = 'noopener noreferrer';
    demo.textContent = 'Ver demo ▸';
    actions.append(demo);
  }
  if (project.repoUrl) {
    const repo = document.createElement('a');
    repo.className = 'btn95 btn-link';
    repo.href = project.repoUrl;
    repo.target = '_blank';
    repo.rel = 'noopener noreferrer';
    repo.textContent = 'Código ⌂';
    actions.append(repo);
  }
  container.append(actions);
}

/* ---------- Lanzador ---------- */
export function launch(opts = {}) {
  return import('../windowManager.js').then(({ wm }) => {
    /* Sin proyectos: aviso simple */
    if (!projects.length) {
      wm.create({
        id: 'projects-empty',
        title: meta.title,
        icon: meta.icons[16],
        width: 380,
        height: 160,
        content: '<div class="app-pad">Todavía no hay proyectos.<br>Edita <b>js/data/portfolio.js</b> y añádelos.</div>',
      });
      return;
    }

    /* Ventana ya abierta → enfocar y seleccionar */
    const existing = wm.get(meta.id);
    if (existing) {
      existing.focus();
      if (opts.selectId) existing._selectProject?.(opts.selectId);
      return;
    }

    /* Construcción master-detail */
    let selectedId = opts.selectId ?? projects[0].id;

    const root = document.createElement('div');
    root.className = 'explorer';

    const list = document.createElement('div');
    list.className = 'explorer-list';
    list.setAttribute('role', 'listbox');

    const detail = document.createElement('div');
    detail.className = 'explorer-detail';

    const rows = new Map();

    function select(projectId) {
      const p = projects.find((x) => x.id === projectId) ?? projects[0];
      selectedId = p.id;
      for (const [id, row] of rows) row.classList.toggle('selected', id === selectedId);
      renderDetail(detail, p);
    }

    for (const p of projects) {
      const row = document.createElement('div');
      row.className = 'explorer-row';
      row.dataset.id = p.id;
      row.setAttribute('role', 'option');
      row.innerHTML = `<img src="${meta.icons[32]}" alt="">`;

      const label = document.createElement('span');
      label.textContent = p.title;
      row.append(label);

      const yr = document.createElement('span');
      yr.className = 'row-year';
      yr.textContent = p.year;
      row.append(yr);

      rows.set(p.id, row);
      row.addEventListener('click', () => select(p.id));
      list.append(row);
    }

    root.append(list, detail);

    const win = wm.create({
      id: meta.id,
      title: `${meta.title} - Explorador`,
      icon: meta.icons[16],
      width: 640,
      height: 440,
      content: root,
    });

    // Puente para reutilización externa (terminal: "open <n>")
    win._selectProject = select;
    select(selectedId);
  });
}
