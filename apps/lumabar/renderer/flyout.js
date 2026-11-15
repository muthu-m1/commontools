'use strict';
(async () => {
  const id = new URLSearchParams(location.search).get('id');
  const widget = byId(id);
  const ctx = { state: await api.getState(), set: (patch) => api.setState(patch) };
  document.body.dataset.style = ctx.state.settings.style;
  if (/Windows/.test(navigator.userAgent)) document.body.classList.add('win');
  if (!widget || !widget.flyout) return api.closeFlyout();

  const handle = (await widget.flyout.mount(document.getElementById('root'), ctx)) || {};
  api.onState((s) => {
    ctx.state = s;
    document.body.dataset.style = s.settings.style;
    if (handle.onState) handle.onState();
  });
  if (handle.tick) setInterval(handle.tick, handle.every || 1000);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.closeFlyout(); });
})();
