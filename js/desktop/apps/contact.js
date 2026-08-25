/* ============================================================
   apps/contact.js — Contacto estilo cliente de correo
   ============================================================ */

import { profile, socials } from '../../data/portfolio.js';

export const meta = {
  id: 'contact',
  title: 'Contacto',
  icons: { 16: 'assets/icons/mail-16x16.png', 32: 'assets/icons/mail-32x32.png' },
};

export function launch() {
  return import('../windowManager.js').then(({ wm }) => {
    const existing = wm.get(meta.id);
    if (existing) return existing.focus();

    const form = document.createElement('div');
    form.className = 'contact-form';

    // Campos Para / Asunto
    form.innerHTML = `
      <div class="contact-row">
        <label>Para:</label>
        <input class="field95" type="text" value="${profile.email}" readonly>
      </div>
      <div class="contact-row">
        <label>Asunto:</label>
        <input class="field95 contact-subject" type="text"
               value="¡Hola ${profile.name}!" maxlength="120">
      </div>
    `;

    // Mensaje
    const row = document.createElement('div');
    row.className = 'contact-row';
    const lbl = document.createElement('label');
    lbl.textContent = 'Mensaje:';
    const msg = document.createElement('textarea');
    msg.className = 'field95 contact-msg';
    msg.placeholder = 'Escribe tu mensaje aquí…';
    row.append(lbl, msg);
    form.append(row);

    // Pie: botones + links sociales
    const foot = document.createElement('div');
    foot.className = 'contact-foot';

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'btn95';
    send.textContent = 'Enviar ✉';

    send.addEventListener('click', () => {
      const subject = encodeURIComponent(form.querySelector('.contact-subject').value);
      const body = encodeURIComponent(msg.value + '\n\n— Enviado desde tu portafolio Win95');
      location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
    });
    foot.append(send);

    for (const s of socials) {
      const a = document.createElement('a');
      a.className = 'btn95 btn-link';
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = s.label;
      foot.append(a);
    }

    form.append(foot);

    wm.create({
      id: meta.id,
      title: `Nuevo mensaje`,
      icon: meta.icons[16],
      width: 480,
      height: 380,
      content: form,
    });
  });
}
