# 📟 Portafolio Win95 Museum

Portafolio personal retro con **dos vistas integradas**: un escritorio
Windows 95 navegable (landing page) y un **museo 3D jugable** con motor
de raycasting estilo Wolfenstein. Todo en **vanilla JavaScript** — cero
frameworks, cero build step, desplegable como sitio estático.

```
BOOT BIOS/DOS ──► #/desktop  ◄──CRT power-off──►  #/game
                  Escritorio W95                Museo raycasting
                  ventanas draggables           camina entre tus
                  apps: About/Projects/CV       proyectos colgados
                  Contact/Terminal              de las paredes
```

## ✨ Características

- **Escritorio Win95 hecho a mano**: ventanas draggables/redimensionables,
  taskbar con reloj real, menú Inicio, iconos seleccionables, scrollbars dithered
- **Museo 3D**: mapa 32×32 con lobby + 4 salas; los cuadros se generan
  automáticamente desde tus datos; prompt `[E]`, pausa al abrir ventanas
- **Secuencia de arranque** BIOS→DOS→splash, skippable, respeta reduced-motion
- **Efecto CRT opcional** (scanlines + viñeta + parpadeo) que cubre ambas vistas
- **Sonidos sintetizados** con Web Audio API — sin archivos de audio
- **Soporte móvil completo**: joystick virtual, mirar por arrastre, botón E;
  ventanas fullscreen en pantallas pequeñas
- **Accesible**: navegación por teclado (Tab/Enter/Esc), foco visible,
  `prefers-reduced-motion` respetado en boot, transiciones y flicker

## 🎮 Controles (museo)

| Acción | Teclado | Táctil |
|---|---|---|
| Moverse | WASD / flechas | Joystick izquierdo |
| Rotar | ← → | Arrastre sobre el canvas |
| Interactuar | E | Botón E |
| Menú | ESC | ESC |

## 📝 Edita TU contenido

**Todo vive en [`js/data/portfolio.js`](js/data/portfolio.js)** — bio, skills,
proyectos (con capturas y links), redes y CV. Añadir un proyecto lo hace
aparecer solo en la galería del escritorio **y** como cuadro interactivo del museo.

Reemplaza también:
- `[TU NOMBRE]` en `index.html` (title, OG) y `js/data/portfolio.js`
- Capturas reales en `assets/screenshots/` (campo `screenshot` de cada proyecto)
- Tu foto en `profile.avatar` · CV PDF en `profile.cvUrl`
- OG placeholder: regenera o sustituye `assets/screenshots/og-image.png`

## 🚀 Desarrollo y deploy

```bash
# Servidor local (cualquiera):
python3 -m http.server 8000
npx serve .
```

Deploy automático a **GitHub Pages**: el workflow
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica la raíz
del repo en cada push a `main`. Activa Pages en *Settings → Pages → Source:
GitHub Actions*. Todas las rutas son relativas, así que funciona bajo subcarpeta
(`usuario.github.io/RayCast.js/`).

## 🗂️ Estructura

```
index.html            shell único (SPA con hash-routing)
css/                  base · win95 (design system) · apps · game · mobile · dos
js/main.js            router #/boot #/desktop #/game
js/data/portfolio.js  ⭐ tu contenido
js/engine/            raycaster (clase) · texturas+carteles · audio sintetizado
js/game/              museum (orquestador) · map 32×32 · touchControls
js/desktop/           windowManager · taskbar · desktopView · boot · effects
                      apps/: about projects contact cv terminal museum settings
assets/               icons (@react95) · fonts · textures · screenshots
legacy-demo/          demo original del raycaster (preservada)
PLAN.md               plan de desarrollo por fases
```

## 🧾 Créditos y licencias

| Recurso | Origen | Licencia |
|---|---|---|
| Iconos Win95 | [@react95/icons](https://github.com/React95/React95) | MIT |
| Fuente UI W95FA | Alina Sava ([fontsarena](https://fontsarena.com/w95fa-by-alina-sava/)) | SIL OFL |
| Fuente DOS IBM VGA 9×16 | [int10h.org Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) | CC BY-SA 4.0 |
| Texturas base del museo | Tutorial de raycasting de [Lode Vandevenne](https://lodev.org/cgtutor/raycasting.html) | — (a reemplazar por arte propio) |
| Motor raycasting | Evolución propia del demo `legacy-demo/` | — |

Las licencias completas están incluidas junto a cada asset (`assets/fonts/LICENSE-*`,
`assets/icons/LICENSE.txt`).

---
Hecho con nostalgia y Canvas 2D. Sin dependencias runtime.
