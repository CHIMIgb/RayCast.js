const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
const screenWidth = canvas.width;
const screenHeight = canvas.height;
const fpsElement = document.getElementById('fps');

const mapWidth = 24;
const mapHeight = 24;

// Mapa texturizado del tutorial de LodeV
const worldMap = [
  [8,8,8,8,8,8,8,8,8,8,8,4,4,6,4,4,6,4,6,4,4,4,6,4],
  [8,0,0,0,0,0,0,0,0,0,8,4,0,0,0,0,0,0,0,0,0,0,0,4],
  [8,0,3,3,0,0,0,0,0,8,8,4,0,0,0,0,0,0,0,0,0,0,0,6],
  [8,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6],
  [8,0,3,3,0,0,0,0,0,8,8,4,0,0,0,0,0,0,0,0,0,0,0,4],
  [8,0,0,0,0,0,0,0,0,0,8,4,0,0,0,0,0,6,6,6,0,6,4,6],
  [8,8,8,8,0,8,8,8,8,8,8,4,4,4,4,4,4,6,0,0,0,0,0,6],
  [7,7,7,7,0,7,7,7,7,0,8,0,8,0,8,0,8,4,0,4,0,6,0,6],
  [7,7,0,0,0,0,0,0,7,8,0,8,0,8,0,8,8,6,0,0,0,0,0,6],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,6,0,0,0,0,0,4],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,6,0,6,0,6,0,6],
  [7,7,0,0,0,0,0,0,7,8,0,8,0,8,0,8,8,6,4,6,0,6,6,6],
  [7,7,7,7,0,7,7,7,7,8,8,4,0,6,8,4,8,3,3,3,0,3,3,3],
  [2,2,2,2,0,2,2,2,2,4,6,4,0,0,6,0,6,3,0,0,0,0,0,3],
  [2,2,0,0,0,0,0,2,2,4,0,0,0,0,0,0,4,3,0,0,0,0,0,3],
  [2,0,0,0,0,0,0,0,2,4,0,0,0,0,0,0,4,3,0,0,0,0,0,3],
  [1,0,0,0,0,0,0,0,1,4,4,4,4,4,6,0,6,3,3,0,0,0,3,3],
  [2,0,0,0,0,0,0,0,2,2,2,1,2,2,2,6,6,0,0,5,0,5,0,5],
  [2,2,0,0,0,0,0,2,2,2,0,0,0,2,2,0,5,0,5,0,0,0,5,5],
  [2,0,0,0,0,0,0,0,2,0,0,0,0,0,2,5,0,5,0,5,0,5,0,5],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
  [2,0,0,0,0,0,0,0,2,0,0,0,0,0,2,5,0,5,0,5,0,5,0,5],
  [2,2,0,0,0,0,0,2,2,2,0,0,0,2,2,0,5,0,5,0,0,0,5,5],
  [2,2,2,2,1,2,2,2,2,2,2,1,2,2,2,5,5,5,5,5,5,5,5,5]
];

let posX = 22.0, posY = 11.5;  // Posición inicial X e Y
let dirX = -1.0, dirY = 0.0;   // Vector de dirección inicial
let planeX = 0.0, planeY = 0.66; // La versión de plano de cámara del raycaster 2D

let time = 0; // Tiempo del fotograma actual
let oldTime = 0; // Tiempo del fotograma anterior

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false
};

document.addEventListener('keydown', (e) => {
    if(keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    if(keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Precargar texturas
const texturePaths = [
    'textures/eagle.png',      // índice 0, mapa = 1
    'textures/redbrick.png',   // índice 1, mapa = 2
    'textures/purplestone.png',// índice 2, mapa = 3
    'textures/greystone.png',  // índice 3, mapa = 4
    'textures/bluestone.png',  // índice 4, mapa = 5
    'textures/mossy.png',      // índice 5, mapa = 6
    'textures/wood.png',       // índice 6, mapa = 7
    'textures/colorstone.png'  // índice 7, mapa = 8
];

const textures = [];
let loadedCount = 0;

texturePaths.forEach((path, i) => {
    const img = new Image();
    img.src = path;
    img.onerror = () => { console.error("Error al cargar la textura:", path); };
    img.onload = () => {
        // Extraer los datos de los píxeles (ImageData)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 64; 
        tempCanvas.height = 64;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        const imgData = tempCtx.getImageData(0, 0, 64, 64).data;
        
        textures[i] = {
            img: img,         
            data: imgData,    
            width: 64,
            height: 64
        };

        loadedCount++;
        if (loadedCount === texturePaths.length) {
            // Todas las texturas cargadas, iniciar el bucle principal
            requestAnimationFrame((timestamp) => {
                oldTime = timestamp;
                requestAnimationFrame(gameLoop);
            });
        }
    };
});

// Buffer de píxeles reutilizable para dibujar piso y techo velozmente
const floorImgData = ctx.createImageData(screenWidth, screenHeight);
const buf = floorImgData.data;

function gameLoop(timestamp) {
    time = timestamp;
    const frameTime = (time - oldTime) / 1000.0;
    
    if (frameTime > 0) {
        fpsElement.textContent = `FPS: ${Math.round(1.0 / frameTime)}`;
    }
    oldTime = time;

    // Dibujar fondos por defecto para evitar espacios vacíos por redondeos
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, screenWidth, screenHeight / 2);
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, screenHeight / 2, screenWidth, screenHeight / 2);

    // Limpiar el buffer de píxeles a transparente para que el ctx.drawImage de los muros 
    // se pueda pintar sobre él sin problemas.
    buf.fill(0); 

    const wallsToDraw = [];

    // --- CÁLCULO DE MUROS Y PISO/TECHO (VERTICAL VERSION) ---
    // En la versión vertical, el suelo y el techo se calculan inmediatamente 
    // después de calcular la línea de la pared, en el mismo bucle x.
    for (let x = 0; x < screenWidth; x++) {
        // Calcular posición y dirección del rayo
        const cameraX = 2 * x / screenWidth - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        let mapX = Math.floor(posX);
        let mapY = Math.floor(posY);

        let sideDistX;
        let sideDistY;

        const deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX);
        const deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY);
        let perpWallDist;

        let stepX;
        let stepY;

        let hit = 0;
        let side;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (posX - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - posX) * deltaDistX;
        }
        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (posY - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - posY) * deltaDistY;
        }

        while (hit === 0) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            if (worldMap[mapX][mapY] > 0) hit = 1;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else          perpWallDist = (sideDistY - deltaDistY);

        let lineHeight = Math.floor(screenHeight / perpWallDist);

        let drawStartOrig = Math.floor(-lineHeight / 2 + screenHeight / 2);
        let drawStart = drawStartOrig;
        if (drawStart < 0) drawStart = 0;
        let drawEnd = Math.floor(lineHeight / 2 + screenHeight / 2);
        if (drawEnd >= screenHeight) drawEnd = screenHeight - 1;

        let texNum = worldMap[mapX][mapY] - 1;
        const texObj = textures[texNum];

        let wallX;
        if (side === 0) wallX = posY + perpWallDist * rayDirY;
        else          wallX = posX + perpWallDist * rayDirX;
        wallX -= Math.floor(wallX);

        let texX = Math.floor(wallX * texObj.width);
        if (side === 0 && rayDirX > 0) texX = texObj.width - texX - 1;
        if (side === 1 && rayDirY < 0) texX = texObj.width - texX - 1;
        texX = Math.max(0, Math.min(texX, texObj.width - 1));

        // Guardar los datos del muro para dibujarlos con el hardware más tarde
        wallsToDraw.push({
            img: texObj.img,
            texX: texX,
            texHeight: texObj.height,
            drawStartOrig: drawStartOrig,
            lineHeight: lineHeight,
            x: x,
            side: side,
            drawStart: drawStart,
            drawEnd: drawEnd
        });

        // --- FLOOR CASTING (VERSIÓN VERTICAL) ---
        // Justo después de procesar la pared, calculamos todos los píxeles hacia abajo.
        let floorXWall, floorYWall;

        if (side === 0 && rayDirX > 0) {
            floorXWall = mapX;
            floorYWall = mapY + wallX;
        } else if (side === 0 && rayDirX < 0) {
            floorXWall = mapX + 1.0;
            floorYWall = mapY + wallX;
        } else if (side === 1 && rayDirY > 0) {
            floorXWall = mapX + wallX;
            floorYWall = mapY;
        } else {
            floorXWall = mapX + wallX;
            floorYWall = mapY + 1.0;
        }

        let distWall = perpWallDist;
        let distPlayer = 0.0;

        if (drawEnd < 0) drawEnd = screenHeight; 

        // Dibujar el piso desde la base de la pared hasta abajo
        for (let y = drawEnd + 1; y < screenHeight; y++) {
            let currentDist = screenHeight / (2.0 * y - screenHeight);
            
            let weight = (currentDist - distPlayer) / (distWall - distPlayer);

            let currentFloorX = weight * floorXWall + (1.0 - weight) * posX;
            let currentFloorY = weight * floorYWall + (1.0 - weight) * posY;

            // TRUCO ESPECIAL (SPECIAL TRICKS): 
            // Para hacer que las texturas sean 4 veces más grandes, dividimos entre 4
            let floorTexX = Math.floor(currentFloorX * texObj.width / 4) & (texObj.width - 1);
            let floorTexY = Math.floor(currentFloorY * texObj.height / 4) & (texObj.height - 1);

            // Patrón de ajedrez usando las coordenadas reales
            let checkerBoardPattern = (Math.floor(currentFloorX) + Math.floor(currentFloorY)) & 1;
            let floorTexIdx = (checkerBoardPattern === 0) ? 3 : 4; // 3=greystone, 4=bluestone
            let ceilingTexIdx = 6; // 6=madera

            const fData = textures[floorTexIdx].data;
            const cData = textures[ceilingTexIdx].data;

            const texPos = (floorTexY * texObj.width + floorTexX) * 4;

            // -- PÍXEL DEL PISO --
            const floorBufPos = ((y * screenWidth) + x) * 4;
            buf[floorBufPos]     = fData[texPos] >> 1;     // Oscurecido
            buf[floorBufPos + 1] = fData[texPos + 1] >> 1;
            buf[floorBufPos + 2] = fData[texPos + 2] >> 1;
            buf[floorBufPos + 3] = 255;                    // Opaco

            // -- PÍXEL DEL TECHO (Simétrico) --
            const ceilY = screenHeight - y - 1;
            if (ceilY >= 0) {
                const ceilBufPos = ((ceilY * screenWidth) + x) * 4;
                buf[ceilBufPos]     = cData[texPos] >> 1;     // Oscurecido
                buf[ceilBufPos + 1] = cData[texPos + 1] >> 1;
                buf[ceilBufPos + 2] = cData[texPos + 2] >> 1;
                buf[ceilBufPos + 3] = 255;                    // Opaco
            }
        }
    }

    // Volcar todos los píxeles calculados a mano en el Canvas principal
    ctx.putImageData(floorImgData, 0, 0);

    // Dibujar las paredes (optimizadas con drawImage) por encima del fondo transparente/piso
    for (let i = 0; i < wallsToDraw.length; i++) {
        const w = wallsToDraw[i];
        if (w.lineHeight > 0) {
            ctx.drawImage(w.img, w.texX, 0, 1, w.texHeight, w.x, w.drawStartOrig, 1, w.lineHeight);
        }
        if (w.side === 1) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(w.x, w.drawStart, 1, w.drawEnd - w.drawStart + 1);
        }
    }

    // Modificadores de velocidad basados en fotogramas
    const moveSpeed = frameTime * 5.0; 
    const rotSpeed = frameTime * 3.0; 

    // Movimiento
    if (keys.ArrowUp || keys.w) {
        if (worldMap[Math.floor(posX + dirX * moveSpeed)][Math.floor(posY)] === 0) posX += dirX * moveSpeed;
        if (worldMap[Math.floor(posX)][Math.floor(posY + dirY * moveSpeed)] === 0) posY += dirY * moveSpeed;
    }
    if (keys.ArrowDown || keys.s) {
        if (worldMap[Math.floor(posX - dirX * moveSpeed)][Math.floor(posY)] === 0) posX -= dirX * moveSpeed;
        if (worldMap[Math.floor(posX)][Math.floor(posY - dirY * moveSpeed)] === 0) posY -= dirY * moveSpeed;
    }
    if (keys.ArrowRight || keys.d) {
        const oldDirX = dirX;
        dirX = dirX * Math.cos(-rotSpeed) - dirY * Math.sin(-rotSpeed);
        dirY = oldDirX * Math.sin(-rotSpeed) + dirY * Math.cos(-rotSpeed);
        const oldPlaneX = planeX;
        planeX = planeX * Math.cos(-rotSpeed) - planeY * Math.sin(-rotSpeed);
        planeY = oldPlaneX * Math.sin(-rotSpeed) + planeY * Math.cos(-rotSpeed);
    }
    if (keys.ArrowLeft || keys.a) {
        const oldDirX = dirX;
        dirX = dirX * Math.cos(rotSpeed) - dirY * Math.sin(rotSpeed);
        dirY = oldDirX * Math.sin(rotSpeed) + dirY * Math.cos(rotSpeed);
        const oldPlaneX = planeX;
        planeX = planeX * Math.cos(rotSpeed) - planeY * Math.sin(rotSpeed);
        planeY = oldPlaneX * Math.sin(rotSpeed) + planeY * Math.cos(rotSpeed);
    }

    requestAnimationFrame(gameLoop);
}
