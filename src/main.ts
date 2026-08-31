import './style.css';
import { loadProject } from './data/project';
import { RetroGame } from './render/retro/raycaster';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const fpsElement = document.querySelector<HTMLElement>('#fps');
const statusElement = document.querySelector<HTMLElement>('#status');

async function boot(): Promise<void> {
  if (!canvas) {
    throw new Error('Falta el canvas #screen');
  }
  try {
    const project = await loadProject('/projects/demo/project.json');
    const game = new RetroGame(canvas, project, { fpsElement });
    await game.start();
    if (statusElement) {
      statusElement.textContent = `Proyecto: ${project.meta.name} — renderMode: ${project.meta.renderMode}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (statusElement) {
      statusElement.textContent = `Error: ${message}`;
      statusElement.classList.add('error');
    }
    console.error('[RayCast Studio]', err);
  }
}

void boot();