/* ============================================================
   apps/terminal.js — MS-DOS Prompt (easter egg funcional)
   Comandos: help, whoami, projects, open <n|id>, skills,
             contact, date, echo, ver, matrix, cls, exit
   ============================================================ */

import { profile, skills, projects, socials } from '../../data/portfolio.js';
import { sfx } from '../../engine/audio.js';

export const meta = {
  id: 'terminal',
  title: 'MS-DOS Prompt',
  icons: { 16: 'assets/icons/msdos-16x16.png', 32: 'assets/icons/msdos-32x32.png' },
};

const PROMPT = 'C:\\PORTAFOLIO>';

export function launch() {
  return import('../windowManager.js').then(({ wm }) => {
    if (wm.get(meta.id)) return wm.get(meta.id).focus();

    const term = document.createElement('div');
    term.className = 'terminal';

    const inputRow = document.createElement('div');
    inputRow.className = 'terminal-input-row';
    inputRow.innerHTML = `<span class="terminal-prompt">${PROMPT} </span>`;

    const input = document.createElement('input');
    input.className = 'terminal-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Línea de comandos');
    inputRow.append(input);

    let matrixTimer = null;

    function print(text = '', cls = '') {
      const line = document.createElement('div');
      line.className = `terminal-line${cls ? ' ' + cls : ''}`;
      line.textContent = text;                 // textContent: sin inyección
      term.insertBefore(line, inputRow);
    }

    function scrollBottom() { term.scrollTop = term.scrollHeight; }

    /* ---------- Comandos ---------- */
    const commands = {
      help() {
        print('Comandos disponibles:');
        print('  help       Esta ayuda');
        print('  whoami     ¿Quién soy?');
        print('  projects   Lista de proyectos');
        print('  open <n>   Abre el proyecto n en una ventana');
        print('  skills     Habilidades técnicas');
        print('  contact    Links de contacto');
        print('  ver        Versión del sistema');
        print('  cls        Limpiar pantalla');
        print('  exit       Cerrar terminal');
      },
      whoami() {
        print(`${profile.name} — ${profile.role}`);
        print(profile.bio[0] ?? '', 'green');
      },
      projects() {
        if (!projects.length) return print('No hay proyectos registrados.', 'amber');
        projects.forEach((p, i) => print(`  [${i + 1}] ${p.title} (${p.year})`));
        print('Usa "open <n>" para abrir uno.', 'green');
      },
      open(args) {
        const key = args[0];
        if (!key) return print('Uso: open <n>', 'amber');
        const idx = parseInt(key, 10);
        const project = Number.isInteger(idx)
          ? projects[idx - 1]
          : projects.find((p) => p.id.includes(key));

        if (!project) return print(`Proyecto "${key}" no encontrado.`, 'amber');

        import('./projects.js').then(({ launch }) => launch({ selectId: project.id }));
        print(`Abriendo ${project.title}...`, 'green');
      },
      skills() {
        for (const g of skills) print(`- ${g.category}: ${g.items.join(', ')}`);
      },
      contact() {
        print(`Email: ${profile.email}`);
        for (const s of socials) print(`${s.label}: ${s.url}`);
      },
      date() { print(new Date().toString()); },
      echo(args) { print(args.join(' ')); },
      ver() {
        print('SVR-DOS Versión 9.5 — Portafolio Edition', 'amber');
        print('(C) Copyright ' + profile.name + '. Todos los derechos reservados.');
      },
      cls() {
        term.querySelectorAll('.terminal-line').forEach((n) => n.remove());
      },
      matrix(_args, done) {
        print('Entrando a la matriz...', 'green');
        let ticks = 0;
        clearInterval(matrixTimer);
        matrixTimer = setInterval(() => {
          const chars = '01アイウエオカキク$#*+=';
          let row = '';
          for (let i = 0; i < 60; i++) row += Math.random() > .5 ? chars[(Math.random() * chars.length) | 0] : ' ';
          print(row, 'green');
          scrollBottom();
          if (++ticks >= 12) {
            clearInterval(matrixTimer);
            matrixTimer = null;
            print('Despierta...', 'amber');
            done();
          }
        }, 120);
      },
    };

    /* ---------- Ejecución de línea ---------- */
    function run(raw) {
      print(PROMPT + ' ' + raw);              // eco SIEMPRE como texto plano
      const parts = raw.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return Promise.resolve();
      const [name, ...args] = parts;
      const cmd = name.toLowerCase();

      if (cmd === 'exit') { win.close(); return Promise.resolve(); }
      if (cmd === 'cls') { commands.cls(); return Promise.resolve(); }
      if (!(cmd in commands)) {
        sfx.error();
        print(`Comando o nombre de archivo no válido: "${name}"`, 'amber');
        return Promise.resolve();
      }
      // Los comandos reciben (args, done); los síncronos ignoran done.
      return new Promise((resolve) => commands[cmd](args, resolve));
    }

    const history = [];
    let histPos = -1;

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const raw = input.value;
        input.value = '';
        histPos = -1;
        if (raw.trim()) history.unshift(raw);
        await run(raw);
        scrollBottom();
      } else if (e.key === 'ArrowUp' && history.length) {
        e.preventDefault();
        histPos = Math.min(histPos + 1, history.length - 1);
        input.value = history[histPos];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        histPos = Math.max(histPos - 1, -1);
        input.value = histPos === -1 ? '' : history[histPos];
      }
    });

    // Click dentro del terminal → foco al input
    term.addEventListener('click', () => input.focus());

    /* ---------- Montaje ---------- */
    const banner = [
      'SVR-DOS Versión 9.5 — Portafolio Edition',
      '(C) Copyright ' + profile.name + '. Escribe "help" para ayuda.',
      '',
    ];
    // El banner se inserta antes de inputRow al montar:
    term.append(inputRow);

    const win = wm.create({
      id: meta.id,
      title: 'MS-DOS Prompt',
      icon: meta.icons[16],
      width: 560,
      height: 380,
      content: term,
      onClose: () => clearInterval(matrixTimer),
    });

    for (const b of banner) print(b);
    setTimeout(() => input.focus(), 50);
  });
}
