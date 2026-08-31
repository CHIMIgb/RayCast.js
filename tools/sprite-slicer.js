/**
 * SpriteSlicer — Motor de detección, corte y procesamiento de sprite sheets
 * Vanilla JS, sin dependencias externas
 * 
 * Uso:
 *   const slicer = new SpriteSlicer();
 *   const result = await slicer.autoSlice('path/to/spritesheet.png');
 *   result.frames.forEach(f => console.log(f.canvas));
 */

class SpriteSlicer {
  constructor() {
    this._hiddenCanvas = document.createElement('canvas');
    this._hiddenCtx = this._hiddenCanvas.getContext('2d', { willReadFrequently: true });
    this._cachedSource = null; // data URL de la imagen original para re-slice
  }

  // ─────────────────────────────────────────────
  //  CARGA DE IMAGEN
  // ─────────────────────────────────────────────

  /**
   * Carga una imagen desde una URL y devuelve ImageData + dimensiones
   */
  async loadImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(`Error al cargar imagen: ${url}`));
      img.src = url;
    });

    this._hiddenCanvas.width = img.width;
    this._hiddenCanvas.height = img.height;
    this._hiddenCtx.drawImage(img, 0, 0);

    // Cachear source para re-slice sin recargar
    this._cachedSource = this._hiddenCanvas.toDataURL();

    const imageData = this._hiddenCtx.getImageData(0, 0, img.width, img.height);

    return {
      imageData,
      width: img.width,
      height: img.height,
      img
    };
  }

  /**
   * Carga desde un File (input de tipo file)
   */
  async loadFile(file) {
    const url = URL.createObjectURL(file);
    try {
      return await this.loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ─────────────────────────────────────────────
  //  UTILIDADES DE PÍXEL
  // ─────────────────────────────────────────────

  /**
   * Lee el color RGB de un píxel en ImageData
   */
  _getPixel(imageData, x, y) {
    const i = (y * imageData.width + x) * 4;
    return {
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
      a: imageData.data[i + 3]
    };
  }

  /**
   * Compara dos colores con tolerancia
   */
  _colorMatch(c1, c2, tolerance) {
    return (
      Math.abs(c1.r - c2.r) <= tolerance &&
      Math.abs(c1.g - c2.g) <= tolerance &&
      Math.abs(c1.b - c2.b) <= tolerance &&
      Math.abs(c1.a - c2.a) <= tolerance
    );
  }

  /**
   * Color es "vacío" (transparente o coincide con color de fondo)
   */
  _isEmptyPixel(pixel, bgColor, tolerance) {
    if (pixel.a === 0) return true;
    return this._colorMatch(pixel, bgColor, tolerance);
  }

  // ─────────────────────────────────────────────
  //  DETECCIÓN DE COLOR DE FONDO
  // ─────────────────────────────────────────────

  /**
   * Detecta el color de fondo muestreando las 4 esquinas
   * y tomando el color más frecuente entre ellas
   */
  _detectBgColor(imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const corners = [
      this._getPixel(imageData, 0, 0),
      this._getPixel(imageData, w - 1, 0),
      this._getPixel(imageData, 0, h - 1),
      this._getPixel(imageData, w - 1, h - 1)
    ];

    // Contar frecuencias (agrupar colores cercanos)
    const groups = [];
    for (const c of corners) {
      let found = false;
      for (const g of groups) {
        if (this._colorMatch(c, g.color, 10)) {
          g.count++;
          found = true;
          break;
        }
      }
      if (!found) groups.push({ color: { ...c }, count: 1 });
    }

    groups.sort((a, b) => b.count - a.count);
    return groups[0].color;
  }

  // ─────────────────────────────────────────────
  //  ESCANEO DE FILAS Y COLUMNAS VACÍAS
  // ─────────────────────────────────────────────

  /**
   * Escanea cada fila horizontal y marca si está completamente vacía
   * Retorna array de booleanos: true = fila vacía
   */
  _scanRows(imageData, bgColor, tolerance) {
    const rows = new Array(imageData.height);
    for (let y = 0; y < imageData.height; y++) {
      let empty = true;
      for (let x = 0; x < imageData.width; x++) {
        const pixel = this._getPixel(imageData, x, y);
        if (!this._isEmptyPixel(pixel, bgColor, tolerance)) {
          empty = false;
          break;
        }
      }
      rows[y] = empty;
    }
    return rows;
  }

  /**
   * Escanea cada columna vertical y marca si está completamente vacía
   */
  _scanCols(imageData, bgColor, tolerance) {
    const cols = new Array(imageData.width);
    for (let x = 0; x < imageData.width; x++) {
      let empty = true;
      for (let y = 0; y < imageData.height; y++) {
        const pixel = this._getPixel(imageData, x, y);
        if (!this._isEmptyPixel(pixel, bgColor, tolerance)) {
          empty = false;
          break;
        }
      }
      cols[x] = empty;
    }
    return cols;
  }

  /**
   * Convierte array de booleanos en rangos de segmentos contiguos
   * Ej: [false,false,true,true,false] → [{start:0, end:1}, {start:4, end:4}]
   * where false = contenido, true = vacío
   * 
   * Retorna los BLOQUES de contenido (no-vacío)
   */
  _findContentBlocks(isEmpty) {
    const blocks = [];
    let inBlock = false;
    let start = 0;

    for (let i = 0; i < isEmpty.length; i++) {
      if (!isEmpty[i] && !inBlock) {
        start = i;
        inBlock = true;
      } else if (isEmpty[i] && inBlock) {
        blocks.push({ start, end: i - 1 });
        inBlock = false;
      }
    }
    if (inBlock) blocks.push({ start, end: isEmpty.length - 1 });

    return blocks;
  }

  // ─────────────────────────────────────────────
  //  DETECCIÓN DE GRILLA
  // ─────────────────────────────────────────────

  /**
   * Detecta la grilla de frames en el sprite sheet
   * Retorna: { rows: [{start, end}], cols: [{start, end}], cells: [{x, y, w, h}] }
   */
  detectGrid(imageData, options = {}) {
    const {
      tolerance = 1,
      bgColor = null
    } = options;

    const bg = bgColor || this._detectBgColor(imageData);

    const emptyRows = this._scanRows(imageData, bg, tolerance);
    const emptyCols = this._scanCols(imageData, bg, tolerance);

    const rowBlocks = this._findContentBlocks(emptyRows);
    const colBlocks = this._findContentBlocks(emptyCols);

    // Generar celdas de intersección
    const cells = [];
    for (const row of rowBlocks) {
      for (const col of colBlocks) {
        cells.push({
          x: col.start,
          y: row.start,
          w: col.end - col.start + 1,
          h: row.end - row.start + 1
        });
      }
    }

    return {
      rowBlocks,
      colBlocks,
      cells,
      bgColor: bg,
      emptyRows,
      emptyCols
    };
  }

  // ─────────────────────────────────────────────
  //  RECORTE APRETADO (BOUNDING BOX)
  // ─────────────────────────────────────────────

  /**
   * Dada una celda (rectángulo en la imagen), encuentra el bounding box
   * apretado del contenido no-vacío dentro de ella
   */
  _tightBounds(imageData, cell, bgColor, tolerance) {
    let top = cell.y + cell.h;
    let bottom = cell.y;
    let left = cell.x + cell.w;
    let right = cell.x;

    for (let y = cell.y; y < cell.y + cell.h; y++) {
      for (let x = cell.x; x < cell.x + cell.w; x++) {
        const pixel = this._getPixel(imageData, x, y);
        if (!this._isEmptyPixel(pixel, bgColor, tolerance)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    if (top > bottom) return null; // celda vacía

    return {
      x: left,
      y: top,
      w: right - left + 1,
      h: bottom - top + 1
    };
  }

  // ─────────────────────────────────────────────
  //  EXTRACCIÓN DE FRAME
  // ─────────────────────────────────────────────

  /**
   * Extrae un frame individual de la imagen como Canvas
   */
  extractFrame(imageData, rect) {
    const canvas = document.createElement('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');

    // Crear临时 ImageData para el recorte
    const croppedData = ctx.createImageData(rect.w, rect.h);
    const src = imageData.data;
    const dst = croppedData.data;

    for (let y = 0; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        const srcIdx = ((rect.y + y) * imageData.width + (rect.x + x)) * 4;
        const dstIdx = (y * rect.w + x) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }

    ctx.putImageData(croppedData, 0, 0);
    return canvas;
  }

  // ─────────────────────────────────────────────
  //  BACKGROUND REMOVAL — FLOOD FILL
  // ─────────────────────────────────────────────

  /**
   * Elimina el fondo de un Canvas usando flood fill desde las esquinas
   * Retorna un nuevo Canvas con transparencia
   */
  /**
   * Detecta si una imagen ya tiene transparencia significativa (>20% de pixels con alpha < 128)
   */
  _hasSignificantTransparency(imageData) {
    const data = imageData.data;
    const totalPixels = data.length / 4;
    let transparentCount = 0;
    // Muestrear cada 16px para velocidad
    for (let i = 3; i < data.length; i += 64) {
      if (data[i] < 128) transparentCount++;
    }
    return (transparentCount / (totalPixels / 16)) > 0.2;
  }

  /**
   * Elimina el fondo de un Canvas usando flood fill desde las esquinas
   * Retorna un nuevo Canvas con transparencia
   * Si la imagen ya tiene transparencia significativa, la retorna sin modificar
   */
  removeBackground(canvas, options = {}) {
    const {
      tolerance = 10,
      cleanEdges = false
    } = options;

    const w = canvas.width;
    const h = canvas.height;

    // Trabajar con copy del canvas
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(canvas, 0, 0);
    const imageData = outCtx.getImageData(0, 0, w, h);

    // Si la imagen ya tiene transparencia, no hacer nada
    if (this._hasSignificantTransparency(imageData)) {
      return out;
    }

    const data = imageData.data;

    // Detectar color de fondo del pixel esquina superior izquierda
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    // Flood fill desde las 4 esquinas
    const visited = new Uint8Array(w * h);

    // Solo hacer match con pixels OPACOS que coincidan con el fondo
    const matchesBg = (idx) => {
      if (data[idx + 3] < 128) return false; // ignorar transparentes/semis
      return (
        Math.abs(data[idx] - bgR) <= tolerance &&
        Math.abs(data[idx + 1] - bgG) <= tolerance &&
        Math.abs(data[idx + 2] - bgB) <= tolerance
      );
    };

    const floodFill = (startX, startY) => {
      const stack = [[startX, startY]];
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        const vIdx = y * w + x;
        if (visited[vIdx]) continue;

        const pIdx = vIdx * 4;
        if (!matchesBg(pIdx)) continue;

        visited[vIdx] = 1;
        data[pIdx + 3] = 0; // hacer transparente

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    };

    // Flood fill desde las 4 esquinas
    floodFill(0, 0);
    floodFill(w - 1, 0);
    floodFill(0, h - 1);
    floodFill(w - 1, h - 1);

    // Post-procesamiento: erosionar bordes (solo si se pide explícitamente)
    if (cleanEdges) {
      this._erodeEdges(imageData, visited, w, h);
    }

    outCtx.putImageData(imageData, 0, 0);
    return out;
  }

  /**
   * Erosiona 1px alrededor de bordes transparentes para limpiar halos
   */
  _erodeEdges(imageData, visited, w, h) {
    const data = imageData.data;
    const toClear = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (visited[idx]) continue; // ya es fondo

        // Verificar si tiene un vecino que es fondo
        const pIdx = idx * 4;
        if (data[pIdx + 3] === 0) continue; // ya transparente

        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (visited[nIdx]) {
            toClear.push(pIdx);
            break;
          }
        }
      }
    }

    for (const pIdx of toClear) {
      data[pIdx + 3] = 0;
    }
  }

  // ─────────────────────────────────────────────
  //  MODO RÁPIDO — POR COLOR KEY (sin flood fill)
  // ─────────────────────────────────────────────

  /**
   * Elimina fondo por color key simple (más rápido que flood fill)
   * Útil para sprites con fondo de color sólido uniforme
   */
  removeBackgroundByKey(canvas, options = {}) {
    const {
      bgColor = null,
      tolerance = 10,
      cleanEdges = false
    } = options;

    const w = canvas.width;
    const h = canvas.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(canvas, 0, 0);
    const imageData = outCtx.getImageData(0, 0, w, h);

    // Si ya tiene transparencia, no hacer nada
    if (this._hasSignificantTransparency(imageData)) {
      return out;
    }

    const data = imageData.data;

    // Auto-detectar color de fondo si no se proporciona
    let bgR, bgG, bgB;
    if (bgColor) {
      bgR = bgColor.r; bgG = bgColor.g; bgB = bgColor.b;
    } else {
      bgR = data[0]; bgG = data[1]; bgB = data[2];
    }

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // ignorar ya transparentes
      const match = (
        Math.abs(data[i] - bgR) <= tolerance &&
        Math.abs(data[i + 1] - bgG) <= tolerance &&
        Math.abs(data[i + 2] - bgB) <= tolerance
      );
      if (match) {
        data[i + 3] = 0;
      }
    }

    outCtx.putImageData(imageData, 0, 0);
    return out;
  }

  // ─────────────────────────────────────────────
  //  AUTO SLICE — FUNCIÓN PRINCIPAL
  // ─────────────────────────────────────────────

  /**
   * Función principal: carga un sprite sheet, detecta frames, los recorta
   * y opcionalmente elimina el fondo
   * 
   * @param {string|File} source - URL o File del sprite sheet
   * @param {object} options - Opciones de procesamiento
   * @returns {object} { frames: [{canvas, bounds, index}], grid, metadata }
   */
  async autoSlice(source, options = {}) {
    const {
      tolerance = 1,
      bgTolerance = 10,
      bgColor = null,
      trim = true,
      removeBg = true,
      bgMethod = 'floodfill', // 'floodfill' | 'colorkey' | 'none'
      minFrameSize = 8,
      padding = 0,
      manualGrid = null // { cols: N, rows: N } para override manual
    } = options;

    // 1. Cargar imagen (usar caché si está disponible y source no es File)
    let loaded;
    if (source instanceof File) {
      loaded = await this.loadFile(source);
    } else if (this._cachedSource && !source) {
      // Re-slice desde caché
      loaded = await this.loadImage(this._cachedSource);
    } else {
      loaded = await this.loadImage(source);
    }

    const { imageData, width, height } = loaded;

    // 2. Detectar grilla
    let grid;
    if (manualGrid) {
      grid = this._manualGrid(imageData, manualGrid);
    } else {
      grid = this.detectGrid(imageData, { tolerance, bgColor });
    }

    // 3. Extraer cada celda
    const rawFrames = [];
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];

      // Filtrar celdas demasiado pequeñas (ruido)
      if (cell.w < minFrameSize || cell.h < minFrameSize) continue;

      // Recorte apretado
      let bounds;
      if (trim) {
        bounds = this._tightBounds(imageData, cell, grid.bgColor, tolerance);
        if (!bounds) continue; // celda vacía
      } else {
        bounds = { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
      }

      // Extraer frame
      let frameCanvas = this.extractFrame(imageData, bounds);

      // Eliminar fondo
      if (removeBg && bgMethod !== 'none') {
        if (bgMethod === 'floodfill') {
          frameCanvas = this.removeBackground(frameCanvas, { tolerance: bgTolerance });
        } else if (bgMethod === 'colorkey') {
          frameCanvas = this.removeBackgroundByKey(frameCanvas, {
            tolerance: bgTolerance
          });
        }
      }

      rawFrames.push({
        canvas: frameCanvas,
        bounds,
        cell,
        index: rawFrames.length
      });
    }

    // 4. Agregar padding si se solicita
    if (padding > 0) {
      for (const frame of rawFrames) {
        const padded = document.createElement('canvas');
        padded.width = frame.canvas.width + padding * 2;
        padded.height = frame.canvas.height + padding * 2;
        const pCtx = padded.getContext('2d');
        pCtx.drawImage(frame.canvas, padding, padding);
        frame.canvas = padded;
        frame.bounds.x -= padding;
        frame.bounds.y -= padding;
        frame.bounds.w += padding * 2;
        frame.bounds.h += padding * 2;
      }
    }

    return {
      frames: rawFrames,
      grid: {
        rows: grid.rowBlocks.length,
        cols: grid.colBlocks.length,
        totalCells: grid.cells.length,
        extractedFrames: rawFrames.length,
        rowBlocks: grid.rowBlocks,
        colBlocks: grid.colBlocks
      },
      metadata: {
        sourceWidth: width,
        sourceHeight: height,
        bgColor: grid.bgColor,
        options: { tolerance, bgTolerance, trim, removeBg, bgMethod, minFrameSize, padding }
      }
    };
  }

  /**
   * Grilla manual (override del detector automático)
   */
  _manualGrid(imageData, { cols, rows }) {
    const cellW = Math.floor(imageData.width / cols);
    const cellH = Math.floor(imageData.height / rows);
    const cells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({
          x: c * cellW,
          y: r * cellH,
          w: cellW,
          h: cellH
        });
      }
    }

    return {
      rowBlocks: Array.from({ length: rows }, (_, i) => ({
        start: i * cellH, end: (i + 1) * cellH - 1
      })),
      colBlocks: Array.from({ length: cols }, (_, i) => ({
        start: i * cellW, end: (i + 1) * cellW - 1
      })),
      cells,
      bgColor: this._detectBgColor(imageData)
    };
  }

  // ─────────────────────────────────────────────
  //  EXPORTACIÓN
  // ─────────────────────────────────────────────

  /**
   * Genera un spritesheet compuesto a partir de frames individuales
   * Retorna { canvas, json }
   */
  composeSpritesheet(frames, options = {}) {
    const {
      maxWidth = 2048,
      padding = 1,
      background = [0, 0, 0, 0]
    } = options;

    if (frames.length === 0) return null;

    // Calcular tamaño máximo de frame
    let maxFrameW = 0;
    let maxFrameH = 0;
    for (const f of frames) {
      if (f.canvas.width > maxFrameW) maxFrameW = f.canvas.width;
      if (f.canvas.height > maxFrameH) maxFrameH = f.canvas.height;
    }

    const frameW = maxFrameW + padding;
    const frameH = maxFrameH + padding;
    const cols = Math.min(frames.length, Math.floor(maxWidth / frameW));
    const rows = Math.ceil(frames.length / cols);

    const out = document.createElement('canvas');
    out.width = cols * frameW;
    out.height = rows * frameH;
    const ctx = out.getContext('2d');

    // Limpiar con fondo transparente
    ctx.clearRect(0, 0, out.width, out.height);

    const json = {
      frameWidth: maxFrameW,
      frameHeight: maxFrameH,
      columns: cols,
      rows: rows,
      totalFrames: frames.length,
      frames: []
    };

    for (let i = 0; i < frames.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * frameW;
      const y = row * frameH;

      ctx.drawImage(frames[i].canvas, x, y);

      json.frames.push({
        index: i,
        x,
        y,
        w: frames[i].canvas.width,
        h: frames[i].canvas.height,
        trimmedBounds: frames[i].bounds
      });
    }

    return { canvas: out, json };
  }

  /**
   * Exporta frames individuales como data URLs
   */
  exportFrames(frames, format = 'image/png') {
    return frames.map((f, i) => ({
      index: i,
      dataUrl: f.canvas.toDataURL(format),
      width: f.canvas.width,
      height: f.canvas.height
    }));
  }

  /**
   * Descarga un frame como archivo
   */
  downloadFrame(frame, filename = 'frame.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = frame.canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * Descarga todos los frames como archivos
   */
  downloadAllFrames(frames, prefix = 'frame') {
    frames.forEach((f, i) => {
      const pad = String(i).padStart(3, '0');
      this.downloadFrame(f, `${prefix}_${pad}.png`);
    });
  }

  /**
   * Genera un JSON con la metadata de los frames listo para usar en el motor
   */
  generateJSON(frames, spriteName = 'sprite', options = {}) {
    const { animations = {} } = options;

    const json = {
      name: spriteName,
      frameSize: frames.length > 0
        ? { w: frames[0].canvas.width, h: frames[0].canvas.height }
        : { w: 0, h: 0 },
      totalFrames: frames.length,
      animations,
      frames: frames.map((f, i) => ({
        index: i,
        x: f.bounds.x,
        y: f.bounds.y,
        w: f.canvas.width,
        h: f.canvas.height
      }))
    };

    return json;
  }
}

// Exportar para uso como módulo o global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpriteSlicer;
} else {
  window.SpriteSlicer = SpriteSlicer;
}
