import './style.css';
import { parseProject, ProjectValidationError } from './data/project';
import { ProjectSchema } from './data/schema';
import { RetroGame } from './render/retro/raycaster';
import { api, ApiError, clearSession, getToken, getUsername, setSession, type ProjectRecord } from './api/client';
import { btn, clear, h } from './ui/dom';

const app = document.querySelector<HTMLElement>('#view');
if (!app) throw new Error('Falta #view');
const view: HTMLElement = app;

let currentGame: RetroGame | null = null;

function headerBar(): HTMLElement {
  const user = getUsername();
  const logout = btn('Salir', () => {
    clearSession();
    renderAuth();
  }, 'btn ghost');
  const tabs = h('nav', { class: 'tabs' },
    btn('Mis proyectos', () => renderLibrary(), 'btn tab'),
    btn('Galería', () => renderGallery(), 'btn tab'),
  );
  return h('div', { class: 'bar' },
    tabs,
    h('span', { class: 'who' }, user ? `@${user}` : ''),
    logout,
  );
}

function notice(message: string, isError = false): void {
  const el = h('p', { class: isError ? 'notice error' : 'notice' }, message);
  clear(view);
  view.append(headerBar(), el);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
function renderAuth(): void {
  const loginTab = btn('Entrar', () => renderAuth(), 'btn tab active');
  const registerTab = btn('Registrarse', () => renderRegister(), 'btn tab');

  const form = h('form', { class: 'panel form', autocomplete: 'off' },
    h('label', {}, 'Email', h('input', { name: 'email', type: 'email', required: 'required', placeholder: 'tu@correo.com' })),
    h('label', {}, 'Contraseña', h('input', { name: 'password', type: 'password', required: 'required' })),
    btn('Entrar', () => undefined, 'btn primary', ''),
  );

  const submit = form.querySelector('button');
  submit?.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');
    try {
      const { token, user } = await api.login(email, password);
      setSession(token, user.username);
      await renderLibrary();
    } catch (err) {
      errorText(form, err);
    }
  });

  clear(view);
  view.append(
    h('div', { class: 'auth' },
      h('div', { class: 'tabs' }, loginTab, registerTab),
      form,
      h('p', { class: 'hint' }, '¿Sin cuenta? Créala en "Registrarse". Guardarás tus proyectos en el servidor.'),
    ),
  );
}

function renderRegister(): void {
  const loginTab = btn('Entrar', () => renderAuth(), 'btn tab');
  const registerTab = btn('Registrarse', () => renderRegister(), 'btn tab active');

  const form = h('form', { class: 'panel form', autocomplete: 'off' },
    h('label', {}, 'Email', h('input', { name: 'email', type: 'email', required: 'required', placeholder: 'tu@correo.com' })),
    h('label', {}, 'Usuario', h('input', { name: 'username', required: 'required', minlength: '3', maxlength: '30' })),
    h('label', {}, 'Contraseña (mín. 6)', h('input', { name: 'password', type: 'password', required: 'required', minlength: '6' })),
    btn('Crear cuenta', () => undefined, 'btn primary', ''),
  );

  form.querySelector('button')?.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    try {
      const { token, user } = await api.register(
        String(fd.get('email')),
        String(fd.get('username')),
        String(fd.get('password')),
      );
      setSession(token, user.username);
      await renderLibrary();
    } catch (err) {
      errorText(form, err);
    }
  });

  clear(view);
  view.append(
    h('div', { class: 'auth' },
      h('div', { class: 'tabs' }, loginTab, registerTab),
      form,
    ),
  );
}

function errorText(form: HTMLElement, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  form.querySelectorAll('p.error').forEach((n) => n.remove());
  form.append(h('p', { class: 'error', role: 'alert' }, `Error: ${msg}`));
}

// ── Game Library (6.20) ──────────────────────────────────────────────────────
async function renderLibrary(): Promise<void> {
  clear(view);
  view.append(headerBar());
  const listEl = h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Cargando proyectos…'));
  view.append(listEl);

  const refresh = async (): Promise<void> => {
    clear(listEl);
    const [projs, tpls] = await Promise.all([api.listProjects(), api.listTemplates()]);
    listEl.replaceChildren(
      h('div', { class: 'toolbar' },
        btn('+ Nuevo proyecto', () => newProjectModal(tpls.templates, refresh), 'btn primary'),
        btn('Importar .ragproj', () => importProject(refresh), 'btn'),
        btn('Nuevo del demo', async () => {
          try {
            await api.createProject({ name: 'Nueva aventura', templateId: 'tpl-demo' });
            await refresh();
          } catch (err) {
            echoErr(listEl, err);
          }
        }, 'btn'),
      ),
      ...(projs.projects.length === 0
        ? [h('p', { class: 'muted' }, 'Aún no tienes proyectos. Crea uno desde una plantilla o impórtalo.')]
        : projs.projects.map((p) => projectCard(p.id, p.name, refresh))),
    );
  };
  await refresh();
}

function projectCard(id: string, name: string, refresh: () => Promise<void>): HTMLElement {
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, name),
    h('div', { class: 'card-actions' },
      btn('Jugar', () => void openProject(id), 'btn primary small'),
      btn('Duplicar', async () => {
        try {
          await api.duplicateProject(id);
          await refresh();
        } catch (err) {
          echoErr(refreshEl(), err);
        }
      }, 'btn small'),
      btn('Exportar', async () => {
        try {
          const { project } = await api.getProject(id);
          downloadJson(project);
        } catch (err) {
          echoErr(refreshEl(), err);
        }
      }, 'btn small'),
      btn('Publicar', async () => {
        const slug = window.prompt('Slug para la galería (a-z, 0-9, guiones):');
        if (slug === null) return;
        try {
          const { published } = await api.publish(id, slug || undefined);
          window.alert(`Publicado en: /play/${published.slug}`);
        } catch (err) {
          echoErr(refreshEl(), err);
        }
      }, 'btn small'),
      btn('Renombrar', async () => {
        const nuevo = window.prompt('Nuevo nombre:', name);
        if (!nuevo || nuevo === name) return;
        try {
          const { project } = await api.getProject(id);
          const data = structuredClone(project.data as Record<string, unknown>);
          (data.meta as { name?: string }).name = nuevo;
          await api.updateProject(id, { name: nuevo, data });
          await refresh();
        } catch (err) {
          echoErr(refreshEl(), err);
        }
      }, 'btn small'),
      btn('Borrar', async () => {
        if (!window.confirm(`¿Borrar "${name}"?`)) return;
        try {
          await api.deleteProject(id);
          await refresh();
        } catch (err) {
          echoErr(refreshEl(), err);
        }
      }, 'btn danger small'),
    ),
  );
}

function refreshEl(): HTMLElement {
  return view.querySelector('.panel') ?? view;
}

function echoErr(host: HTMLElement, err: unknown): void {
  host.append(h('p', { class: 'error' }, `Error: ${err instanceof Error ? err.message : String(err)}`));
}

function newProjectModal(tpls: { id: string; name: string; description: string }[], refresh: () => Promise<void>): void {
  const nameInput = h('input', { name: 'name', required: 'required', placeholder: 'Nombre del proyecto', value: 'Mi aventura' });
  const select = h('select', { name: 'template' },
    ...tpls.map((t) => h('option', { value: t.id }, `${t.name}${t.description ? ' — ' + t.description : ''}`)),
  );
  const form = h('form', { class: 'panel form modal' },
    h('h2', {}, 'Nuevo proyecto'),
    h('label', {}, 'Nombre', nameInput),
    h('label', {}, 'Plantilla', select),
    h('div', { class: 'row' },
      btn('Crear', () => undefined, 'btn primary'),
      btn('Cancelar', () => overlay.remove(), 'btn ghost'),
    ),
  );
  const overlay = h('div', { class: 'overlay' }, form);
  view.append(overlay);

  const create = form.querySelector('button');
  create?.addEventListener('click', async (ev) => {
    ev.preventDefault();
    try {
      const name = String(new FormData(form).get('name')).trim();
      const templateId = String(new FormData(form).get('template'));
      await api.createProject({ name, templateId });
      overlay.remove();
      await refresh();
    } catch (err) {
      errorText(form, err);
    }
  });
}

function importProject(refresh: () => Promise<void>): void {
  const input = h('input', { type: 'file', accept: '.ragproj,application/json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      ProjectSchema.parse(raw); // valida v1 o v2; canonicaliza a v2
      const name = (raw as { meta?: { name?: string } }).meta?.name ?? file.name.replace(/\.ragproj$/i, '');
      await api.createProject({ name, data: raw });
      await renderLibrary();
    } catch (err) {
      if (err instanceof ProjectValidationError) {
        notice(`Importación rechazada: ${err.message}`, true);
      } else {
        notice(`No se pudo importar: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    }
  });
  input.click();
}

function downloadJson(project: ProjectRecord): void {
  const name = (project.data as { meta?: { name?: string } }).meta?.name ?? project.name;
  const blob = new Blob([JSON.stringify(project.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `${name.replace(/[^\w-]+/g, '_')}.ragproj` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Galería (6.21) ───────────────────────────────────────────────────────────
async function renderGallery(): Promise<void> {
  clear(view);
  view.append(headerBar());
  const listEl = h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Cargando galería…'));
  view.append(listEl);
  try {
    const { gallery } = await api.listGallery();
    clear(listEl);
    listEl.replaceChildren(
      ...(gallery.length === 0
        ? [h('p', { class: 'muted' }, 'Todavía no hay juegos publicados. Publica el tuyo desde "Mis proyectos".')]
        : gallery.map((g) =>
            h('div', { class: 'card' },
              h('div', { class: 'card-title' }, g.title),
              h('p', { class: 'muted' }, `por @${g.author} · ${g.visits} visitas`),
              h('div', { class: 'card-actions' },
                btn('Jugar', () => void openPlay(`/play/${g.slug}`), 'btn primary small'),
              ),
            ),
          )),
    );
  } catch (err) {
    echoErr(listEl, err);
  }
}

// ── Reproductor ──────────────────────────────────────────────────────────────
async function openPlay(url: string): Promise<void> {
  try {
    const { title, project } = await api.play(url);
    const parsed = parseProject(project);
    mountPlayer(parsed, title);
  } catch (err) {
    notice(`No se pudo jugar: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function openProject(id: string): Promise<void> {
  try {
    const { project } = await api.getProject(id);
    mountPlayer(parseProject(project.data), project.name);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearSession();
      renderAuth();
      return;
    }
    notice(`No se pudo abrir: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function mountPlayer(project: Awaited<ReturnType<typeof parseProject>>, title: string): Promise<void> {
  currentGame?.stop();
  clear(view);

  const canvas = h('canvas', { id: 'screen', width: project.settings.resolution.width, height: project.settings.resolution.height });
  const fps = h('div', { id: 'fps' }, 'FPS: –');
  const status = h('p', { id: 'status' });

  view.append(
    h('div', { class: 'viewport' }, canvas, fps),
    status,
    h('p', { class: 'muted' },
      `renderMode: ${project.meta.renderMode} · schema v${project.meta.schemaVersion} · ${project.map.size.w}×${project.map.size.h}`,
    ),
  );

  if (project.meta.renderMode === '3d') {
    status.textContent = `El renderMode "3d" llega en F2. Este proyecto usa ${project.meta.renderMode}.`;
    status.classList.add('error');
    return;
  }

  const back = btn('← Volver', () => leave(), 'btn ghost');
  view.prepend(back);

  status.textContent = `Proyecto: ${title}`;
  const game = new RetroGame(canvas, project, { fpsElement: fps });
  currentGame = game;

  const leave = (): void => {
    game.stop();
    window.removeEventListener('keydown', onEsc);
    void (getToken() ? renderLibrary() : renderAuth());
  };
  const onEsc = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') leave();
  };
  window.addEventListener('keydown', onEsc);

  try {
    await game.start();
  } catch (err) {
    window.removeEventListener('keydown', onEsc);
    status.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    status.classList.add('error');
  }
}

// ── Arranque ────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => currentGame?.stop());
void (getToken() ? renderLibrary() : renderAuth());