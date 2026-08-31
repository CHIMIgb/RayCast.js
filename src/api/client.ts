// ─────────────────────────────────────────────────────────────────────────────
// Cliente de la API (F0.5). Consume la API con el mismo origen: en dev el
// proxy de Vite reenvía /api y /play a la API; en prod el front se sirve
// desde el mismo dominio que la API. Token JWT guardado en localStorage.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'rc_token';
export const TOKEN_USERNAME_KEY = 'rc_username';

export interface ApiUser {
  id: string;
  email: string;
  username: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  schemaVersion: number;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface GalleryItem {
  slug: string;
  title: string;
  author: string;
  visits: number;
  publishedAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, username: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_USERNAME_KEY, username);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_USERNAME_KEY);
}

export function getUsername(): string | null {
  return localStorage.getItem(TOKEN_USERNAME_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  tokenHeader?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (tokenHeader) headers.Authorization = `Bearer ${tokenHeader}`;

  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let payload: { error?: string; issues?: unknown } | null = null;
    try {
      payload = (await res.json()) as { error?: string; issues?: unknown };
    } catch {
      payload = null;
    }
    throw new ApiError(payload?.error ?? `HTTP ${res.status}`, res.status, payload?.issues);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const auth = (t = getToken()) => t;

export const api = {
  // ── Auth ──
  register: (email: string, username: string, password: string) =>
    request<{ token: string; user: ApiUser }>('POST', '/api/auth/register', { email, username, password }),
  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser }>('POST', '/api/auth/login', { email, password }),
  me: () => request<{ user: ApiUser }>('GET', '/api/auth/me', undefined, auth()),

  // ── Proyectos ──
  listProjects: () => request<{ projects: ProjectListItem[] }>('GET', '/api/projects', undefined, auth()),
  createProject: (body: { name: string; templateId?: string; data?: unknown }) =>
    request<{ project: ProjectRecord }>('POST', '/api/projects', body, auth()),
  getProject: (id: string) => request<{ project: ProjectRecord }>('GET', `/api/projects/${id}`, undefined, auth()),
  updateProject: (id: string, body: { name?: string; data?: unknown }) =>
    request<{ project: ProjectRecord }>('PUT', `/api/projects/${id}`, body, auth()),
  deleteProject: (id: string) => request<void>('DELETE', `/api/projects/${id}`, undefined, auth()),
  duplicateProject: (id: string) =>
    request<{ project: ProjectRecord }>('POST', `/api/projects/${id}/duplicate`, undefined, auth()),

  // ── Plantillas (pública) ──
  listTemplates: () => request<{ templates: TemplateListItem[] }>('GET', '/api/templates'),

  // ── Galería (pública) ──
  listGallery: () => request<{ gallery: GalleryItem[] }>('GET', '/api/gallery'),
  publish: (projectId: string, slug?: string) =>
    request<{ published: { slug: string; url: string } }>('POST', `/api/projects/${projectId}/publish`, { slug }, auth()),
  play: (slug: string) => request<{ title: string; project: unknown }>('GET', `/play/${slug}`),
};