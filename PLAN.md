# 📟 Portafolio Retro "Win95 Museum" — Plan de desarrollo

**Stack:** Vanilla JS (ES Modules, zero-build) · CSS hecho a mano · Cero dependencias runtime · 100% web en un solo despliegue (GitHub Pages).

> **Decisión de arquitectura:** no se usa Vite ni ningún bundler. Todo el código es ES Modules nativos servidos estáticamente. Esto maximiza el control "todo vanilla" y simplifica el deploy a GitHub Pages (push y listo). Para desarrollar basta `python3 -m http.server` o la extensión Live Server de VS Code.

## 1. Concepto

Una única Single Page App con dos vistas integradas y navegación bidireccional instantánea (sin reload):

```
BOOT BIOS/DOS (~3s, skippable, se acorta en visitas repetidas vía localStorage)
        │
        ├─► #/desktop : Escritorio Windows 95 (landing page principal)
        │       ├─ Iconos → ventanas draggables (Sobre mí, Proyectos,
        │       │   CV, Contacto, Terminal MS-DOS easter egg)
        │       └─ [Inicio ▶ Entrar al Museo] ──transición CRT──┐
        │                                                       ▼
        └─► #/game : Museo raycasting 3D (vista alterna)
                ├─ Salas: Sobre mí / Proyectos / Skills / Contacto
                ├─ Cuadros interactivos → ventana Win95 overlay (juego pausado)
                └─ Monitor "Salir al Escritorio" o ESC → menú pausa ──► #/desktop
```

Ambas vistas comparten los mismos componentes de ventana (`WindowManager`) y los mismos datos (`portfolio.js`). Añadir un proyecto = editar un objeto JSON y aparece automáticamente en escritorio y museo.

## 2. Estructura del proyecto

```
/                            # Raíz del repo = raíz del portafolio
├── index.html               # Shell único
├── PLAN.md                  # Este documento
├── legacy-demo/             # Demo original del raycaster (preservada)
├── css/
│   ├── base.css             # Reset + variables (--gray #c0c0c0, --teal #008080, --navy #000080)
│   ├── win95.css            # Bevels, botones :active hundidos, titlebar gradiente, scrollbars, taskbar
│   ├── dos.css              # Boot screen, terminal, scanlines CRT opcionales
│   ├── game.css             # HUD, minimapa, prompt "Presiona [E]"
│   └── mobile.css           # Joystick virtual + ventanas fullscreen <768px
├── js/
│   ├── main.js              # Router hash + orquestador de vistas
│   ├── data/portfolio.js    # ⭐ ÚNICO archivo que editarás con tu info real
│   ├── engine/
│   │   ├── raycaster.js     # Refactor modular del raycasting.js original (lógica intacta)
│   │   ├── textures.js      # Loader/atlas (incluye carteles generados por canvas)
│   │   └── audio.js         # SFX sintetizados con Web Audio API (beeps, clicks, ding)
│   ├── game/
│   │   ├── player.js        # WASD/flechas + joystick táctil + colisiones
│   │   ├── interact.js      # Raycast frontal corto → detectar exhibición → abrir ventana
│   │   └── hud.js           # Minimapa, FPS, prompts
│   └── desktop/
│       ├── windowManager.js # Clase Window: drag, resize, z-index focus, min/max/close
│       ├── taskbar.js       # Inicio + menú, ventanas abiertas, reloj real
│       ├── boot.js          # BIOS POST animado → C:\> WIN → splash → desktop
│       └── apps/
│           ├── about.js     # "Mi PC" → bio, foto avatar, skills
│           ├── projects.js  # Explorador/galería con capturas y links
│           ├── contact.js   # Estilo Outlook Express (links + mailto)
│           ├── cv.js        # Bloc de notas con el CV
│           ├── terminal.js  # MS-DOS Prompt (help, whoami, projects, matrix…)
│           └── museum.js    # Launcher "Entrar al Museo"
└── assets/
    ├── icons/               # PNG copiados de @react95/icons (MIT) — solo como fuente de descarga
    ├── fonts/               # W95FA (UI) + Perfect DOS VGA 437 (terminal/boot)
    ├── screenshots/         # Capturas de tus proyectos
    └── textures/            # Paredes oficina retro 64×64 pixel-art propias
```

## 3. Fases

| Fase | Entregable | Sesiones |
|---|---|---|
| **0. Setup** ✅ | Estructura + fuentes/iconos descargados + shell HTML/CSS/JS inicial | ½ |
| **1. Datos + design system** ✅ | `portfolio.js` (con placeholders), `win95.css` completo, clase `WindowManager` | 1 |
| **2. Escritorio + apps** ✅ | Taskbar, iconos, About/Projects/Contact/CV/Terminal funcionando desde datos | 2 |
| **3. Boot + CRT + audio** ✅ | Secuencia arranque skippable, scanlines opcionales (toggle), SFX sintetizados | 1 |
| **4. Museo jugable** ✅ | Motor modularizado, mapa 32×32 con lobby + 4 salas, exhibiciones interactivas `[E]`, carteles auto-generados desde `projects[]` | 2 |
| **5. Móvil** ✅ | Joystick + botón E táctil, rotación por arrastre, ventanas fullscreen, resolución interna 320×200 escalada (`image-rendering: pixelated`) | 1 |
| **6. Integración + pulido** ✅ | Transiciones CRT entre vistas sin reload, router, SEO/OG/favicon, accesibilidad (Tab, `prefers-reduced-motion`), Lighthouse >85 móvil, deploy GitHub Pages | 1 |

## 4. Decisiones clave

| Aspecto | Decisión |
|---|---|
| Navegación entre vistas | Hash routing + transición CRT power-off; estado del juego pausado/restaurado |
| Reutilización | Las mismas ventanas Win95 sirven como apps de escritorio Y overlay del juego |
| Contenido | Placeholders claros en `portfolio.js`; reemplazar con bio/proyectos/capturas reales cuando estén |
| Boot | Siempre arranca pero skippable; visitas repetidas lo acortan (localStorage) |
| Iconos | Copiar PNGs de @react95/icons (MIT) a assets; la librería NO se instala en runtime |
| Fuente UI | W95FA (recreación libre de MS Sans Serif) |
| Fuente terminal/boot | Perfect DOS VGA 437 (Zeh Fernando, uso libre) |
| Paleta | `#c0c0c0`, `#008080`, titlebar `#000080 → #1084d0` |
| Repo | Este mismo repo reestructurado; demo original preservada en `legacy-demo/` |

## 5. Verificación continua

- Por fase: checklist manual (drag/resize ventanas, doble-click vs tap, prompt `[E]`, FPS ≥55 desktop / ≥40 móvil, transición ida-y-vuelta sin perder estado).
- Final: Lighthouse móvil, prueba en Chrome/Firefox/Safari iOS, README con créditos de licencias.

## 6. Créditos de assets

- Iconos: [@react95/icons](https://github.com/React95/React95) — MIT.
- W95FA: recreación libre de MS Sans Serif.
- Perfect DOS VGA 437: Zeh Fernando / Adam Moore — uso libre.
- Texturas originales del raycaster (Lode Vandevenne, tutorial lodev.org) — se reemplazarán por arte propio.
