// Datatech site behaviour: mobile menu, solutions dropdown, header border,
// the "one circuit" animation and the contact / careers forms.

// Messages are delivered by Web3Forms (https://web3forms.com) to the address tied to this key.
const FORM_KEY = 'ba3fb096-b888-4c9d-9320-078ef235ae23';
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('[data-header]');
  const menu = document.querySelector('[data-menu]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const sub = document.querySelector('[data-sub]');
  const subToggle = document.querySelector('[data-sub-toggle]');

  // Header gets a hairline once the page scrolls.
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 4);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu.
  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.querySelector('.visually-hidden').textContent = open ? 'Cerrar menú' : 'Abrir menú';
    document.body.classList.toggle('menu-open', open);
  };
  menuToggle?.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));

  // Solutions submenu (click and keyboard; hover is handled in CSS on desktop).
  const setSub = (open) => {
    sub.classList.toggle('is-open', open);
    subToggle.setAttribute('aria-expanded', String(open));
  };
  subToggle?.addEventListener('click', (e) => { e.stopPropagation(); setSub(!sub.classList.contains('is-open')); });
  document.addEventListener('click', (e) => { if (sub && !sub.contains(e.target)) setSub(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sub?.classList.contains('is-open')) { setSub(false); subToggle.focus(); }
    else if (menu?.classList.contains('is-open')) { setMenu(false); menuToggle.focus(); }
  });
  window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // "Un solo circuito": steps connect one after another when the section scrolls into view.
  // Only sections that start below the fold animate; anything already visible stays as is.
  const flow = document.querySelector('[data-flow]');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (flow && !still && 'IntersectionObserver' in window && flow.getBoundingClientRect().top > window.innerHeight) {
    const parts = flow.querySelectorAll('.node, .link, .flow-steps li');
    flow.querySelectorAll('.node').forEach((n, i) => { n.style.transitionDelay = `${i * 0.22}s`; });
    flow.querySelectorAll('.link').forEach((l, i) => { l.style.transitionDelay = `${i * 0.22 + 0.1}s`; });
    flow.querySelectorAll('.flow-steps li').forEach((l, i) => { l.style.transitionDelay = `${i * 0.22}s`; });
    flow.classList.add('is-pending');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      flow.classList.remove('is-pending');
      io.disconnect();
      setTimeout(() => parts.forEach((p) => { p.style.transitionDelay = ''; }), 2400);
    }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(flow);
  }

  // Links to /contacto/#demo preselect the demo option in the contact form.
  const motivo = document.getElementById('c-motivo');
  const preselect = () => {
    if (!motivo || location.hash !== '#demo') return;
    const opt = [...motivo.options].find((o) => /demostraci/i.test(o.text));
    if (opt) motivo.value = opt.value || opt.text;
    document.getElementById('c-nombre')?.focus({ preventScroll: true });
  };
  preselect();
  window.addEventListener('hashchange', preselect);

  // Forms.
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const status = form.querySelector('[data-status]');
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      if (data.botcheck) return;
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Enviando…';
      status.textContent = '';
      status.removeAttribute('data-state');
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: FORM_KEY, from_name: 'datatech.com.ar', ...data }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.success === false) throw new Error(out.message || res.statusText);
        const done = document.createElement('div');
        done.className = 'form-done';
        done.setAttribute('role', 'status');
        done.innerHTML = `<h2>${form.dataset.doneTitle}</h2><p>${form.dataset.doneText}</p>`;
        form.replaceWith(done);
        done.setAttribute('tabindex', '-1');
        done.focus();
      } catch (err) {
        status.dataset.state = 'error';
        status.textContent = 'No pudimos enviar el mensaje. Intente de nuevo en unos minutos o llámenos al (54-11) 4374-1002.';
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
});

