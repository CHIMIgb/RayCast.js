/* ============================================================
   apps/cv.js — Bloc de notas con el CV
   ============================================================ */

import { profile, skills, projects, socials } from '../../data/portfolio.js';

export const meta = {
  id: 'cv',
  title: 'CV.txt',
  icons: { 16: 'assets/icons/notepad-16x16.png', 32: 'assets/icons/notepad-32x32.png' },
};

function buildCvText() {
  const lines = [
    profile.name.toUpperCase(),
    `${profile.role} — ${profile.location}`,
    profile.email,
    '='.repeat(46),
    '',
    'RESUMEN',
  ];

  for (const p of profile.bio) {
    lines.push(p, '');
  }

  if (projects.length) {
    lines.push('PROYECTOS DESTACADOS');
    for (const p of projects) {
      lines.push(`• ${p.title} (${p.year}) — ${p.short}`);
      if (p.repoUrl) lines.push(`  ${p.repoUrl}`);
    }
    lines.push('');
  }

  lines.push('HABILIDADES');
  for (const g of skills) lines.push(`- ${g.category}: ${g.items.join(', ')}`);
  lines.push('');

  if (socials.length) {
    lines.push('LINKS');
    for (const s of socials) lines.push(`- ${s.label}: ${s.url}`);
  }

  return lines.join('\n');
}

export function launch() {
  return import('../windowManager.js').then(({ wm }) => {
    const existing = wm.get(meta.id);
    if (existing) return existing.focus();

    const wrap = document.createElement('div');
    wrap.className = 'cv-wrap';

    // Barra de menú decorativa (estética de época)
    const menubar = document.createElement('div');
    menubar.className = 'menubar';
    for (const m of ['Archivo', 'Editar', 'Buscar', 'Ayuda']) {
      const item = document.createElement('span');
      item.className = 'menubar-item';
      item.textContent = m;
      menubar.append(item);
    }
    wrap.append(menubar);

    // Botón de descarga si hay PDF
    if (profile.cvUrl) {
      const actions = document.createElement('div');
      actions.className = 'cv-actions';
      const dl = document.createElement('a');
      dl.className = 'btn95 btn-link';
      dl.href = profile.cvUrl;
      dl.download = 'CV.pdf';
      dl.textContent = '⇩ Descargar CV.pdf';
      actions.append(dl);
      wrap.append(actions);
    }

    const text = document.createElement('div');
    text.className = 'cv-text';
    text.textContent = buildCvText();
    wrap.append(text);

    wm.create({
      id: meta.id,
      title: `${meta.title} - Bloc de notas`,
      icon: meta.icons[16],
      width: 520,
      height: 440,
      content: wrap,
    });
  });
}
