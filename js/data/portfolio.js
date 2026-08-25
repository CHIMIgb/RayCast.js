/* ============================================================
   portfolio.js — ⭐ FUENTE ÚNICA DE DATOS DEL PORTAFOLIO
   ------------------------------------------------------------
   TODO tu contenido vive aquí. El escritorio Y el museo 3D
   se generan automáticamente desde este archivo.
   Reemplaza los placeholders con tu información real.
   ============================================================ */

export const profile = {
  name: 'Tu Nombre',                    // ← CAMBIA ESTO
  role: 'Desarrollador Full-Stack',
  tagline: 'Construyendo cosas geniales desde 20XX',
  location: 'Ciudad de México, MX',
  email: 'tu-correo@ejemplo.com',
  avatar: null,                         // ruta a tu foto (assets/screenshots/)
  bio: [
    '¡Hola! Soy [TU NOMBRE], desarrollador apasionado por crear experiencias web memorables.',
    'Este portafolio es una ventana a lo que hago: navega el escritorio como en los viejos tiempos, o entra al museo 3D y camina entre mis proyectos.',
    'Cuando no estoy programando, me encontrarás explorando nuevas tecnologías, jugando videojuegos retro o contribuyendo a open source.',
  ],
  cvUrl: null,                          // ej: 'assets/cv.pdf'
};

export const socials = [
  { id: 'github',   label: 'GitHub',   url: 'https://github.com/tu-usuario' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/tu-usuario' },
  { id: 'twitter',  label: 'X/Twitter', url: 'https://x.com/tu-usuario' },
];

export const skills = [
  { category: 'Frontend', items: ['HTML/CSS', 'JavaScript', 'React'] },
  { category: 'Backend',  items: ['Node.js', 'PostgreSQL', 'APIs REST'] },
  { category: 'Herramientas', items: ['Git', 'Figma', 'Docker'] },
];

/**
 * PROYECTOS — cada entrada aparece:
 *   • En el escritorio (app "Proyectos", galería con captura)
 *   • En el museo 3D (cuadro interactivo auto-generado)
 */
export const projects = [
  {
    id: 'proyecto-ejemplo',
    title: 'Proyecto de Ejemplo',
    year: '2025',
    short: 'Descripción corta que se ve en la galería y el cartel del museo.',
    description: [
      'Descripción larga del proyecto. Puedes usar varios párrafos.',
      'Explica el problema, la solución y tu rol.',
    ],
    tech: ['JavaScript', 'Canvas'],
    screenshot: null,                   // ej: 'assets/screenshots/mi-proyecto.png'
    liveUrl: 'https://ejemplo.com',
    repoUrl: 'https://github.com/tu-usuario/proyecto',
    featured: true,
  },
  // ← Añade más proyectos aquí; aparecen solos en ambas vistas
];

/** Configuración de vistas */
export const settings = {
  bootEnabled: true,          // secuencia BIOS/DOS al cargar
  crtEffectDefault: false,    // scanlines CRT activadas por defecto
  soundDefault: true,         // SFX sintetizados activados por defecto
};
