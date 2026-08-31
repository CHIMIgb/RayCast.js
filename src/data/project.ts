import { Project, ProjectSchema, ProjectValidationError } from './schema';

export { ProjectValidationError } from './schema';

/**
 * Carga un proyecto desde una URL (JSON) y lo valida contra el schema.
 * - F0: consume `public/projects/demo/project.json`.
 * - Más adelante: cargará desde la API (`/api/projects`, F0.5) o de un archivo importado.
 *
 * @param url  URL absoluta o relativa del project.json.
 */
export async function loadProject(url: string): Promise<Project> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo cargar el proyecto (${res.status}) en ${url}`);
  }
  const json: unknown = await res.json();
  return parseProject(json);
}

/**
 * Valida un objeto JSON contra el schema del proyecto.
 * También re-lanza como error tipado para mensajes claros al usuario.
 */
export function parseProject(json: unknown): Project {
  const result = ProjectSchema.safeParse(json);
  if (!result.success) {
    throw new ProjectValidationError(result.error.issues);
  }
  return result.data;
}

/** Convierte la URL de un proyecto en su base (para resolver rutas relativas). */
export function projectBaseUrl(projectUrl: string): string {
  const url = new URL(projectUrl, window.location.href);
  return url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
}