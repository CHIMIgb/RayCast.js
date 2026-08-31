import type { TextureDef } from '../../data/schema';

/** Textura ya procesada y lista para dibujar en el raycaster. */
export interface LoadedTexture {
  /** Canvas fuente; los sprites ya tienen el fondo negro convertido a transparente. */
  img: HTMLCanvasElement;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function loadTextureImage(def: TextureDef): Promise<LoadedTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = def.width;
        canvas.height = def.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error(`Sin contexto 2D para ${def.id}`));
          return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, def.width, def.height);

        const imgData = ctx.getImageData(0, 0, def.width, def.height);
        const data = imgData.data;

        // Sprites: negro (o casi negro, por perfiles de color del navegador)
        // pasa a transparente. El umbral 15 evita "ruido de puntos negros".
        if (def.isSprite) {
          for (let j = 0; j < data.length; j += 4) {
            if (data[j] < 15 && data[j + 1] < 15 && data[j + 2] < 15) {
              data[j + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve({ img: canvas, data, width: def.width, height: def.height });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    image.onerror = () => reject(new Error(`No se pudo cargar la textura: ${def.src}`));
    image.src = def.src;
  });
}

export async function loadTextures(defs: readonly TextureDef[]): Promise<LoadedTexture[]> {
  const out: LoadedTexture[] = [];
  for (const def of defs) {
    out.push(await loadTextureImage(def));
  }
  return out;
}