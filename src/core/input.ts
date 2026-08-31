/**
 * Estado del teclado compartido por los motores.
 * Solo registra teclas concretas; `isDown(key)` consulta el estado actual.
 */
export class KeyboardState {
  private readonly pressed = new Map<string, boolean>();

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.set(e.key, true);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.set(e.key, false);
  };

  attach(target: EventTarget = window): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  detach(target: EventTarget = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
  }

  isDown(key: string): boolean {
    return this.pressed.get(key) ?? false;
  }
}