/* ============================================================
   apps/about.js — "Mi PC" / Sobre mí
   ============================================================ */

import { profile, skills, socials } from '../../data/portfolio.js';

export const meta = {
  id: 'about',
  title: 'Sobre mí',
  icons: { 16: 'assets/icons/computer-16x16.png', 32: 'assets/icons/computer-32x32.png' },
};

function sidePanel() {
  const side = document.createElement('aside');
  side.className = 'about-side';

  const avatar = document.createElement('div');
  avatar.className = 'about-avatar';
  if (profile.avatar) {
    const img = document.createElement('img');
    img.src = profile.avatar;
    img.alt = profile.name;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    avatar.append(img);
  } else {
    avatar.innerHTML = '<img src="assets/icons/user-32x32.png" alt="">';
  }

  const name = document.createElement('div');
  name.className = 'about-name';
  name.textContent = profile.name;

  const role = document.createElement('div');
  role.className = 'about-role';
  role.textContent = profile.role;

  const loc = document.createElement('div');
  loc.className = 'about-role';
  loc.textContent = profile.location;

  side.append(avatar, name, role, loc);
  return side;
}

function mainPanel() {
  const main = document.createElement('div');
  main.className = 'about-main';

  // Bio
  const bioTitle = document.createElement('h3');
  bioTitle.textContent = 'Perfil';
  main.append(bioTitle);

  const bio = document.createElement('div');
  bio.className = 'about-bio';
  for (const p of profile.bio) {
    const el = document.createElement('p');
    el.textContent = p;
    bio.append(el);
  }
  main.append(bio);

  // Skills
  const skTitle = document.createElement('h3');
  skTitle.textContent = 'Habilidades';
  main.append(skTitle);

  for (const group of skills) {
    const line = document.createElement('div');
    line.className = 'skill-line';
    const cat = document.createElement('span');
    cat.className = 'skill-cat';
    cat.textContent = `${group.category}: `;
    line.append(cat, group.items.join(', '));
    main.append(line);
  }

  // Socials
  const soTitle = document.createElement('h3');
  soTitle.textContent = 'Encuéntrame en';
  main.append(soTitle);

  const row = document.createElement('div');
  row.className = 'socials-row';
  for (const s of socials) {
    const a = document.createElement('a');
    a.className = 'social-chip';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `<img src="assets/icons/globe-16x16.png" alt="">`;
    a.append(s.label);
    row.append(a);
  }
  main.append(row);

  return main;
}

export function launch() {
  // importación diferida para evitar ciclo registry↔apps
  return import('../windowManager.js').then(({ wm }) => {
    const existing = wm.get(meta.id);
    if (existing) return existing.focus();

    const content = document.createElement('div');
    content.className = 'about-grid';
    content.append(sidePanel(), mainPanel());

    wm.create({
      id: meta.id,
      title: `${meta.title} - Mi PC`,
      icon: meta.icons[16],
      width: 560,
      height: 400,
      content,
    });
  });
}
