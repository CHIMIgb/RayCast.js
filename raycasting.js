const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
const screenWidth = canvas.width;
const screenHeight = canvas.height;
const fpsElement = document.getElementById('fps');

const mapWidth = 24;
const mapHeight = 24;

// Mapa texturizado del tutorial de LodeV
const worldMap = [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,7,7,7,7,7,7,7,7],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,7],
  [4,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [4,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [4,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,7],
  [4,0,4,0,0,0,0,5,5,5,5,5,5,5,5,5,7,7,0,7,7,7,7,7],
  [4,0,5,0,0,0,0,5,0,5,0,5,0,5,0,5,7,0,0,0,7,7,7,1],
  [4,0,6,0,0,0,0,5,0,0,0,0,0,0,0,5,7,0,0,0,0,0,0,8],
  [4,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,7,7,1],
  [4,0,8,0,0,0,0,5,0,0,0,0,0,0,0,5,7,0,0,0,0,0,0,8],
  [4,0,0,0,0,0,0,5,0,0,0,0,0,0,0,5,7,0,0,0,7,7,7,1],
  [4,0,0,0,0,0,0,5,5,5,5,0,5,5,5,5,7,7,7,7,7,7,7,1],
  [6,6,6,6,6,6,6,6,6,6,6,0,6,6,6,6,6,6,6,6,6,6,6,6],
  [8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [6,6,6,6,6,6,0,6,6,6,6,0,6,6,6,6,6,6,6,6,6,6,6,6],
  [4,4,4,4,4,4,0,4,4,4,6,0,6,2,2,2,2,2,2,2,3,3,3,3],
  [4,0,0,0,0,0,0,0,0,4,6,0,6,2,0,0,0,0,0,2,0,0,0,2],
  [4,0,0,0,0,0,0,0,0,0,0,0,6,2,0,0,5,0,0,2,0,0,0,2],
  [4,0,0,0,0,0,0,0,0,4,6,0,6,2,0,0,0,0,0,2,2,0,2,2],
  [4,0,6,0,6,0,0,0,0,4,6,0,0,0,0,0,5,0,0,0,0,0,0,2],
  [4,0,0,5,0,0,0,0,0,4,6,0,6,2,0,0,0,0,0,2,2,0,2,2],
  [4,0,6,0,6,0,0,0,0,4,6,0,6,2,0,0,5,0,0,2,0,0,0,2],
  [4,0,0,0,0,0,0,0,0,4,6,0,6,2,0,0,0,0,0,2,0,0,0,2],
  [4,4,4,4,4,4,4,4,4,4,1,1,1,2,2,2,2,2,2,3,3,3,3,3]
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
    'textures/madera.png',     // índice 6, mapa = 7
    'textures/colorstone.png'  // índice 7, mapa = 8
];

const textures = [];
let loadedCount = 0;

texturePaths.forEach((path, i) => {
    const img = new Image();
    img.src = path;
    img.onload = () => {
        loadedCount++;
        if (loadedCount === texturePaths.length) {
            // Todas las texturas cargadas, iniciar el bucle principal
            requestAnimationFrame((timestamp) => {
                oldTime = timestamp;
                requestAnimationFrame(gameLoop);
            });
        }
    };
    textures[i] = img;
});

function gameLoop(timestamp) {
    // Calcular el tiempo del fotograma (timing)
    time = timestamp;
    const frameTime = (time - oldTime) / 1000.0; // frameTime es el tiempo que tomó este fotograma, en segundos
    
    // Solo actualizar FPS si frameTime es mayor que cero para evitar divisiones por cero
    if (frameTime > 0) {
        fpsElement.textContent = `FPS: ${Math.round(1.0 / frameTime)}`;
    }
    oldTime = time;

    // Dibujar Techo
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, screenWidth, screenHeight / 2);
    // Dibujar Suelo
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, screenHeight / 2, screenWidth, screenHeight / 2);

    for (let x = 0; x < screenWidth; x++) {
        // Calcular posición y dirección del rayo
        const cameraX = 2 * x / screenWidth - 1; // Coordenada X en el espacio de la cámara
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        // En qué cuadro del mapa nos encontramos
        let mapX = Math.floor(posX);
        let mapY = Math.floor(posY);

        // Longitud del rayo desde la posición actual hasta el siguiente lado X o Y
        let sideDistX;
        let sideDistY;

        // Longitud del rayo de un lado X/Y al siguiente lado X/Y
        const deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX);
        const deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY);
        let perpWallDist;

        // Dirección en la que avanzar en X o Y (ya sea +1 o -1)
        let stepX;
        let stepY;

        let hit = 0; // ¿Hubo colisión con un muro?
        let side; // ¿Fue un muro Norte/Sur o Este/Oeste?

        // Calcular el paso (step) y el sideDist inicial
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

        // Ejecutar el DDA
        while (hit === 0) {
            // Saltar al siguiente cuadrado del mapa, ya sea en dirección X o en dirección Y
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            // Comprobar si el rayo ha golpeado un muro
            if (worldMap[mapX][mapY] > 0) hit = 1;
        }

        // Calcular la distancia proyectada en la dirección de la cámara (¡la Euclidiana daría efecto ojo de pez!)
        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else          perpWallDist = (sideDistY - deltaDistY);

        // Calcular la altura de la línea a dibujar en la pantalla
        let lineHeight = Math.floor(screenHeight / perpWallDist);

        // Calcular el píxel más bajo y más alto para rellenar en la franja actual
        // Usamos drawStartOrig sin limitar para que drawImage escale correctamente la textura completa
        let drawStartOrig = Math.floor(-lineHeight / 2 + screenHeight / 2);

        // --- CÁLCULOS DE TEXTURA ---
        let texNum = worldMap[mapX][mapY] - 1; // -1 porque las texturas en el mapa son de 1 a 8
        const texImg = textures[texNum];
        const texWidth = texImg.width;
        const texHeight = texImg.height;

        // Calcular el valor de wallX (donde exactamente choca el rayo en la pared)
        let wallX;
        if (side === 0) wallX = posY + perpWallDist * rayDirY;
        else          wallX = posX + perpWallDist * rayDirX;
        wallX -= Math.floor(wallX);

        // Coordenada X dentro de la textura
        let texX = Math.floor(wallX * texWidth);
        if (side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
        if (side === 1 && rayDirY < 0) texX = texWidth - texX - 1;
        
        // Evitar desbordamientos
        texX = Math.max(0, Math.min(texX, texWidth - 1));

        // Dibujamos usando la función nativa drawImage de Canvas, la cual es extremadamente rápida
        // y nos evita tener que hacer el costoso "putImageData" píxel por píxel como en C++.
        // Copia una porción vertical de 1 píxel de ancho (texX) y la estira a todo "lineHeight"
        if (lineHeight > 0) {
            ctx.drawImage(texImg, texX, 0, 1, texHeight, x, drawStartOrig, 1, lineHeight);
        }

        // Dar un brillo (oscuridad) diferente a los lados X e Y de la pared
        if (side === 1) {
            // Limitamos drawStart y drawEnd para pintar la sombra solo en el área visible de la pantalla
            let drawStart = drawStartOrig;
            if (drawStart < 0) drawStart = 0;
            let drawEnd = Math.floor(lineHeight / 2 + screenHeight / 2);
            if (drawEnd >= screenHeight) drawEnd = screenHeight - 1;

            ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Sombra negra al 50%
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart + 1);
        }
    }

    // Modificadores de velocidad basados en fotogramas
    const moveSpeed = frameTime * 5.0; // el valor constante equivale a cuadrados/segundo
    const rotSpeed = frameTime * 3.0; // el valor constante equivale a radianes/segundo

    // Moverse hacia adelante si no hay pared enfrente
    if (keys.ArrowUp || keys.w) {
        if (worldMap[Math.floor(posX + dirX * moveSpeed)][Math.floor(posY)] === 0) posX += dirX * moveSpeed;
        if (worldMap[Math.floor(posX)][Math.floor(posY + dirY * moveSpeed)] === 0) posY += dirY * moveSpeed;
    }
    // Moverse hacia atrás si no hay pared detrás
    if (keys.ArrowDown || keys.s) {
        if (worldMap[Math.floor(posX - dirX * moveSpeed)][Math.floor(posY)] === 0) posX -= dirX * moveSpeed;
        if (worldMap[Math.floor(posX)][Math.floor(posY - dirY * moveSpeed)] === 0) posY -= dirY * moveSpeed;
    }
    // Rotar a la derecha
    if (keys.ArrowRight || keys.d) {
        // tanto la dirección de la cámara como el plano de cámara deben ser rotados
        const oldDirX = dirX;
        dirX = dirX * Math.cos(-rotSpeed) - dirY * Math.sin(-rotSpeed);
        dirY = oldDirX * Math.sin(-rotSpeed) + dirY * Math.cos(-rotSpeed);
        const oldPlaneX = planeX;
        planeX = planeX * Math.cos(-rotSpeed) - planeY * Math.sin(-rotSpeed);
        planeY = oldPlaneX * Math.sin(-rotSpeed) + planeY * Math.cos(-rotSpeed);
    }
    // Rotar a la izquierda
    if (keys.ArrowLeft || keys.a) {
        // tanto la dirección de la cámara como el plano de cámara deben ser rotados
        const oldDirX = dirX;
        dirX = dirX * Math.cos(rotSpeed) - dirY * Math.sin(rotSpeed);
        dirY = oldDirX * Math.sin(rotSpeed) + dirY * Math.cos(rotSpeed);
        const oldPlaneX = planeX;
        planeX = planeX * Math.cos(rotSpeed) - planeY * Math.sin(rotSpeed);
        planeY = oldPlaneX * Math.sin(rotSpeed) + planeY * Math.cos(rotSpeed);
    }

    requestAnimationFrame(gameLoop);
}
