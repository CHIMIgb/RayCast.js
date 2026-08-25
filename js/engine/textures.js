/* ============================================================
   textures.js — Carga de texturas + generadores de carteles
   ------------------------------------------------------------
   • loadWorldTextures(): paredes LodeV + sprites con alpha-key
   • makePoster / makeBoard: texturas 128×128 dibujadas por canvas
     (cuadros de proyectos, letreros de salas, salida)
   Todas las texturas exponen { img, data, w, h }.
   ============================================================ */

const BASE = 'assets/textures/';

/* ---------- Utilidad: Image → {img,data,w,h} ---------- */
function fromImage(img, size, alphaKey = false) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  c2.drawImage(img, 0, 0);

  const dataObj = c2.getImageData(0, 0, size, size);
  const d = dataObj.data;

  if (alphaKey) {
    // Tolerancia <15 para ruido de perfiles de color (ver demo original)
    for (let j = 0; j < d.length; j += 4) {
      if (d[j] < 15 && d[j + 1] < 15 && d[j + 2] < 15) d[j + 3] = 0;
    }
    c2.putImageData(dataObj, 0, 0);
  }

  return { img: cv, data: d, w: size, h: size };
}

function loadFile(path, size, alphaKey) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(fromImage(img, size, alphaKey));
    img.onerror = () => reject(new Error(`Textura no encontrada: ${path}`));
    img.src = path;
  });
}

/* ---------- Carga del mundo ---------- */
const WALL_FILES = [
  ['eagle', 'eagle.png'],
  ['redbrick', 'redbrick.png'],
  ['purplestone', 'purplestone.png'],
  ['greystone', 'greystone.png'],
  ['bluestone', 'bluestone.png'],
  ['mossy', 'mossy.png'],
  ['wood', 'wood.png'],
  ['colorstone', 'colorstone.png'],
];

const SPRITE_FILES = [
  ['barrel', 'barrel.png'],
  ['pillar', 'pillar.png'],
  ['greenlight', 'greenlight.png'],
];

export async function loadWorldTextures() {
  const jobs = [];
  for (const [key, file] of WALL_FILES) {
    jobs.push(loadFile(BASE + file, 64).then((t) => [key, t]));
  }
  for (const [key, file] of SPRITE_FILES) {
    jobs.push(loadFile(BASE + file, 64, true).then((t) => [key, t]));
  }
  const pairs = await Promise.all(jobs);
  return Object.fromEntries(pairs);
}

/* Espera las @font-face para que los carteles salgan nítidos */
export function fontsReady(timeoutMs = 1500) {
  if (!document.fonts?.ready) return Promise.resolve();
  return Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
}

/* ============================================================
   Generadores de texturas (128×128)
   ============================================================ */
const TS = 128;

function newTex() {
  const cv = document.createElement('canvas');
  cv.width = TS;
  cv.height = TS;
  return [cv, cv.getContext('2d', { willReadFrequently: true })];
}

function toTexture(cv, c2) {
  const dataObj = c2.getImageData(0, 0, TS, TS);
  return { img: cv, data: dataObj.data, w: TS, h: TS };
}

/** Envuelve texto en líneas que caben en maxWidth */
function wrap(c2, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (c2.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/**
 * Cuadro de proyecto: marco dorado, número grande y título.
 */
export function makePoster(index, project) {
  const [cv, c2] = newTex();

  // Fondo + marco
  c2.fillStyle = '#14181c';
  c2.fillRect(0, 0, TS, TS);
  c2.strokeStyle = '#c9a227';
  c2.lineWidth = 6;
  c2.strokeRect(3, 3, TS - 6, TS - 6);
  c2.strokeRect(10, 10, TS - 20, TS - 20);

  // "Pantalla" interior
  c2.fillStyle = '#008080';
  c2.fillRect(14, 14, TS - 28, 66);
  c2.fillStyle = 'rgba(255,255,255,.25)';
  for (let y = 14; y < 80; y += 4) c2.fillRect(14, y, TS - 28, 1);

  // Número grande
  c2.fillStyle = '#eaf6ff';
  c2.font = 'bold 34px W95FA, monospace';
  c2.textAlign = 'center';
  c2.textBaseline = 'middle';
  c2.fillText(String(index + 1).padStart(2, '0'), TS / 2, 46);

  // Título
  c2.fillStyle = '#ffffff';
  c2.font = 'bold 13px W95FA, monospace';
  const lines = wrap(c2, project.title, TS - 26);
  lines.forEach((ln, i) => c2.fillText(ln, TS / 2, 92 + i * 14));

  // Año
  c2.fillStyle = '#c9a227';
  c2.font = '11px W95FA, monospace';
  c2.fillText(project.year ?? '', TS / 2, 120);

  return toTexture(cv, c2);
}

/**
 * Letrero de sala. glyph: 'user'|'mail'|'exit'|'code'|'globe'
 */
export function makeBoard({ title, sub = '', color = '#004a8f', glyph = '' }) {
  const [cv, c2] = newTex();

  c2.fillStyle = '#14181c';
  c2.fillRect(0, 0, TS, TS);
  c2.strokeStyle = '#9aa4ae';
  c2.lineWidth = 5;
  c2.strokeRect(3, 3, TS - 6, TS - 6);

  // Placa de color
  c2.fillStyle = color;
  c2.fillRect(12, 12, TS - 24, 74);

  // Glifo simple
  c2.fillStyle = 'rgba(255,255,255,.92)';
  const cx = TS / 2;
  if (glyph === 'user') {
    c2.beginPath();
    c2.arc(cx, 40, 13, 0, Math.PI * 2);          // cabeza
    c2.fill();
    c2.beginPath();                               // hombros
    c2.arc(cx, 76, 22, Math.PI, 0);
    c2.fill();
  } else if (glyph === 'mail') {
    c2.fillRect(cx - 24, 32, 48, 32);
    c2.fillStyle = color;
    c2.beginPath();
    c2.moveTo(cx - 24, 32);
    c2.lineTo(cx, 54);
    c2.lineTo(cx + 24, 32);
    c2.closePath();
    c2.fill();
    c2.fillStyle = 'rgba(255,255,255,.92)';
  } else if (glyph === 'code') {
    c2.font = 'bold 30px monospace';
    c2.textAlign = 'center';
    c2.fillText('</>', cx, 58);
  } else if (glyph === 'exit') {
    c2.font = 'bold 26px W95FA, monospace';
    c2.textAlign = 'center';
    c2.fillText('→]', cx, 58);
  } else if (glyph === 'globe') {
    c2.beginPath();
    c2.arc(cx, 49, 17, 0, Math.PI * 2);
    c2.fill();
    c2.fillStyle = color;                       // "océano" recortado
    c2.beginPath();
    c2.arc(cx, 49, 13.5, 0, Math.PI * 2);
    c2.fill();
    c2.strokeStyle = 'rgba(255,255,255,.92)';
    c2.lineWidth = 1;
    c2.beginPath();                             // meridiano
    c2.ellipse(cx, 49, 6, 13.5, 0, 0, Math.PI * 2);
    c2.stroke();
    c2.beginPath();                             // ecuador
    c2.moveTo(cx - 16, 49);
    c2.lineTo(cx + 16, 49);
    c2.stroke();
    c2.fillStyle = 'rgba(255,255,255,.92)';
  }

  // Texto
  c2.fillStyle = '#fff';
  c2.font = 'bold 15px W95FA, monospace';
  c2.textAlign = 'center';
  c2.fillText(title, cx, 104);
  if (sub) {
    c2.fillStyle = '#b8c4cc';
    c2.font = '10px W95FA, monospace';
    c2.fillText(sub.slice(0, 18), cx, 119);
  }

  return toTexture(cv, c2);
}
