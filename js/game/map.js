/* ============================================================
   map.js — NIVEL: "Galería del CV"
   ------------------------------------------------------------
   Pasillo central largo (oeste↔este) con 4 salas interconectadas
   por puertas. Toda la información del CV está representada en
   los muros como carteles legibles al acercarse ([E] / toque).

   Layout (33×25, tallado sobre macizo — sin fugas de rayos):

     ┌─────────┐                  ┌─────────┐
     │ PERFIL  │                  │ SKILLS  │
     │ (wood)  │                  │(colorst)│
     └──╥──────┘                  └────╥────┘
   ═══╦════════════ CORREDOR ══════════╦═══════
     ┌──╨──────┐                  ┌────╨────┐
     │PROYECTOS│                  │CONTACTO │
     │(redbrck)│                  │ (mossy) │
     └─────────┴──────────────────┴─────────┘

   Contenido por sala:
     • PERFIL    → letrero Sobre mí [E] + ubicación
     • SKILLS    → 3 tableros, uno por categoría con sus items
     • PROYECTOS → galería de cuadros (hasta 7, auto-generados)
     • CONTACTO  → letrero [E] + un tablero por red social
     • SALIDAS   → monitores en AMBOS extremos del corredor

   Códigos: 0 vacío · 1..8 paredes base · 11+ cuadros de proyecto
            30 Sobre mí · 31 Contacto · 32 Salida · 33 Ubicación
            40-42 skills · 43-45 redes sociales
   ============================================================ */

import { projects, skills, profile, socials } from '../data/portfolio.js';

const W = 33, H = 25;

/* ---------- Macizo base y tallado ---------- */
export const worldMap = Array.from({ length: W }, () => Array(H).fill(5)); // bluestone

const carve = (x0, y0, x1, y1, v = 0) => {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) worldMap[x][y] = v;
};

/* Corredor central */
carve(1, 11, 31, 13);

/* PERFIL (wood) */
carve(1, 1, 9, 1, 7);   carve(1, 9, 9, 9, 7);
carve(1, 1, 1, 9, 7);   carve(9, 1, 9, 9, 7);
carve(2, 2, 8, 8, 0);
carve(5, 9, 5, 10);                       // puerta sur

/* SKILLS (colorstone) */
carve(23, 1, 31, 1, 8); carve(23, 9, 31, 9, 8);
carve(23, 1, 23, 9, 8); carve(31, 1, 31, 9, 8);
carve(24, 2, 30, 8, 0);
carve(26, 9, 26, 10);                     // puerta sur

/* PROYECTOS (redbrick) */
carve(1, 15, 14, 15, 2); carve(1, 23, 14, 23, 2);
carve(1, 15, 1, 23, 2);  carve(14, 15, 14, 23, 2);
carve(2, 16, 13, 22, 0);
carve(7, 14, 7, 15);                      // puerta norte

/* CONTACTO (mossy) */
carve(18, 15, 31, 15, 6); carve(18, 23, 31, 23, 6);
carve(18, 15, 18, 23, 6); carve(31, 15, 31, 23, 6);
carve(19, 16, 30, 22, 0);
carve(26, 14, 26, 15);                    // puerta norte

/* ---------- Registro de exhibiciones ---------- */
export const EXHIBITS = {};

const put = (id, x, y, def) => {
  worldMap[x][y] = id;
  EXHIBITS[id] = def;
};

/* Galería de proyectos: muro sur de la sala (hasta 7 cuadros),
   todos con la cara norte abierta hacia el interior */
const POSTER_CELLS = [
  [4, 23], [5, 23], [6, 23], [7, 23], [8, 23], [9, 23], [10, 23],
];
projects.slice(0, POSTER_CELLS.length).forEach((p, i) => {
  const [x, y] = POSTER_CELLS[i];
  put(11 + i, x, y, { type: 'project', projectId: p.id, label: p.title });
});

/* Sala PERFIL */
put(30, 5, 1, { type: 'app', app: 'about', label: `Sobre mí — ${profile.name}` });
put(33, 7, 1, { type: 'deco', label: `${profile.role} · ${profile.location}` });

/* Sala SKILLS: un tablero por categoría, items visibles en el prompt */
skills.slice(0, 3).forEach((g, i) => {
  put(40 + i, 25 + i, 1, {
    type: 'deco',
    label: `${g.category}: ${g.items.join(', ')}`,
  });
});

/* Sala CONTACTO: letrero principal + un tablero por red social */
put(31, 24, 15, { type: 'app', app: 'contact', label: 'Contacto — escríbeme' });
const hostOf = (url) => { try { return new URL(url).host; } catch { return url; } };
socials.slice(0, 3).forEach((s, i) => {
  if (i > 2) return;
  const y = 18 + i;                        // cara oeste del muro este
  if (!worldMap[30][y]) return;
  put(43 + i, 31, y, { type: 'deco', label: `${s.label}: ${hostOf(s.url)}` });
});

/* SALIDAS: monitores en ambos extremos del corredor */
worldMap[0][12] = 32;
EXHIBITS[32] = { type: 'exit', label: 'Salir al escritorio' };
worldMap[32][12] = 32;

/* ---------- Sprites decorativos ---------- */
export const spriteDefs = [
  // Lámparas verdes a lo largo del corredor
  { x: 3.5,  y: 12.5, tex: 'greenlight', translucent: true },
  { x: 9.5,  y: 12.5, tex: 'greenlight', translucent: true },
  { x: 15.5, y: 12.5, tex: 'greenlight', translucent: true },
  { x: 21.5, y: 12.5, tex: 'greenlight', translucent: true },
  { x: 29.5, y: 12.5, tex: 'greenlight', translucent: true },
  // Ambiente por sala
  { x: 2.5,  y: 2.5,  tex: 'greenlight', translucent: true },
  { x: 29.5, y: 2.5,  tex: 'greenlight', translucent: true },
  { x: 12.5, y: 21.5, tex: 'barrel' },
  { x: 2.5,  y: 16.5, tex: 'barrel' },
  { x: 29.5, y: 21.5, tex: 'barrel' },
];

/** Aparición: centro del corredor mirando al este */
export const playerStart = {
  x: 16.5,
  y: 12.5,
  dirX: 1, dirY: 0,
};
