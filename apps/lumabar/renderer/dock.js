'use strict';
(async () => {
  const ctx = { state: await api.getState(), set: (patch) => api.setState(patch) };
  const dockEl = document.getElementById('dock');
  if (/Windows/.test(navigator.userAgent)) document.body.classList.add('win');

  /** Settings that make a network widget refetch when they change. */
  const NETWORK_KEY = { weather: 'city', crypto: 'cryptoIds', github: 'githubUser' };
  let items = [];
  let layoutSig = '';
  let finishing = false;

  function applyTheme() {
    document.body.dataset.style = ctx.state.settings.style;
    document.body.dataset.width = ctx.state.settings.width;
  }

  async function refresh(item) {
    let data;
    try { data = await item.w.update(ctx); } catch (e) { data = item.w.id === 'weather' || item.w.id === 'github' ? { error: true } : null; }
    item.data = data;
    paint(item);
  }

  function paint(item) {
    const { w, el } = item;
    if (w.render) { w.render(el, item.data, ctx); return; }
    const b = w.bar(item.data, ctx);
    // Only touch the DOM when something changed, so unchanged widgets never repaint.
    if (item.v.textContent !== b.v) item.v.textContent = b.v;
    if (item.l.textContent !== b.l) item.l.textContent = b.l;
    const display = b.pct == null ? 'none' : '';
    if (item.meter.style.display !== display) item.meter.style.display = display;
    if (b.pct != null) {
      const width = Math.round(Math.max(0, Math.min(100, b.pct))) + '%';
      if (item.fill.style.width !== width) item.fill.style.width = width;
    }
    const tone = b.tone || '';
    if (el.dataset.tone !== tone) el.dataset.tone = tone;
  }

  function build() {
    items.forEach((i) => clearInterval(i.timer));
    dockEl.replaceChildren();
    const widgets = [...ctx.state.settings.widgets.map(byId), SETTINGS_WIDGET];
    items = widgets.map((w) => {
      const item = { w, data: null };
      const tag = w.flyout ? 'button' : 'div';
      item.el = h(tag, { class: 'w', 'data-id': w.id, title: w.name, ...(w.flyout ? { 'aria-label': w.name } : {}) });
      if (w.id === 'settings') {
        item.el.classList.add('settings');
        item.el.append(icon('settings', 18));
      } else if (!w.render) {
        item.v = h('span', { class: 'v' });
        item.l = h('span', { class: 'l' });
        item.fill = h('b');
        item.meter = h('i', { class: 'meter' }, item.fill);
        item.el.append(icon(w.icon, 18), h('span', { class: 'txt' }, item.v, item.l), item.meter);
      }
      if (w.flyout) item.el.addEventListener('click', () => {
        const r = item.el.getBoundingClientRect();
        api.openFlyout(w.id, r.left + r.width / 2);
      });
      dockEl.append(item.el);
      if (w.update) {
        refresh(item);
        if (w.every) item.timer = setInterval(() => refresh(item), w.every);
      }
      return item;
    });
  }

  /** Pomodoro / countdown completion. Runs in the dock only, so each alarm fires once. */
  function checkAlarms() {
    if (finishing) return;
    const { pomodoro: p, timer: t } = ctx.state.data;
    if (p.running) {
      const total = (p.phase === 'focus' ? p.focusMin : p.breakMin) * 60000;
      if (clockElapsed(p) >= total) {
        finishing = true;
        const focusDone = p.phase === 'focus';
        new Notification(focusDone ? 'Focus session complete' : 'Break is over', { body: focusDone ? 'Time for a break.' : 'Ready for the next session?', silent: false });
        ctx.set({ data: { pomodoro: { ...clockPatch(p, 'reset'), phase: focusDone ? 'break' : 'focus', cycles: p.cycles + (focusDone ? 1 : 0) } } }).finally(() => { finishing = false; });
        return;
      }
    }
    if (t.running && t.kind === 'countdown' && clockElapsed(t) >= t.durationMin * 60000) {
      finishing = true;
      new Notification('Timer finished', { body: `${t.durationMin} minute timer is up.` });
      ctx.set({ data: { timer: clockPatch(t, 'reset') } }).finally(() => { finishing = false; });
    }
  }

  function onState(next) {
    const prev = ctx.state.settings;
    ctx.state = next;
    applyTheme();
    const sig = JSON.stringify(next.settings.widgets);
    if (sig !== layoutSig) { layoutSig = sig; build(); return; }
    for (const item of items) {
      const key = NETWORK_KEY[item.w.id];
      if (key && JSON.stringify(prev[key]) !== JSON.stringify(next.settings[key])) refresh(item);
      else if (item.w.update && !key) { Promise.resolve(item.w.update(ctx)).then((d) => { item.data = d; paint(item); }).catch(() => {}); }
    }
  }

  applyTheme();
  layoutSig = JSON.stringify(ctx.state.settings.widgets);
  build();
  api.onState(onState);
  setInterval(checkAlarms, 500);
  new ResizeObserver(() => api.dockWidth(dockEl.offsetWidth)).observe(dockEl);
  // Clicking an empty part of the dock closes any open flyout.
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.w')) api.closeFlyout(); });
})();
