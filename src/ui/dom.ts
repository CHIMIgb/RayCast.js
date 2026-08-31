// Tiny DOM helper: construye nodos sin librerías (estilo hyperscript).

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | null | undefined> | null,
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = String(value);
      else if (key === 'html') node.innerHTML = String(value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2), value as EventListener);
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

export const clear = (node: HTMLElement): void => {
  node.replaceChildren();
};

export const btn = (
  label: string,
  onClick: EventListener,
  classes = 'btn',
  title?: string,
): HTMLButtonElement => {
  const b = h('button', { class: classes, type: 'button', title }, label);
  b.addEventListener('click', onClick);
  return b;
};