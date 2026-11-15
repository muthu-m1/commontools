'use strict';
/* Widget library shared by the dock (index.html) and flyouts (flyout.html).
 *
 * A widget is: { id, name, icon, every, update(ctx) -> data, bar(data, ctx) -> {v, l, pct?, tone?}, flyout? }
 *   - update():   fetch/compute data for the bar; runs every `every` ms in the dock window
 *   - bar():      what the dock shows
 *   - flyout:     { mount(root, ctx) } builds the popup panel for that widget
 */

const api = typeof window !== 'undefined' ? window.lumabar : null;

// ---------- tiny DOM helper ----------
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;          // only ever called with static SVG strings below
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  date: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M8 17h2"/>',
  weather: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 0 9.5z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  ram: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M11 8v8M15 8v8M6 19v-3M18 19v-3"/>',
  battery: '<rect x="3" y="8" width="16" height="9" rx="2.5"/><path d="M21 11v3"/>',
  storage: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  pomodoro: '<circle cx="12" cy="13.5" r="7"/><path d="M12 6.5V4M9 4h6M12 10v3.5l2 1.5"/>',
  timer: '<path d="M9 3h6M12 3v3"/><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5L15.5 10"/>',
  todos: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  notes: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  worldclocks: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  crypto: '<circle cx="12" cy="12" r="9"/><path d="M10 7.5h3.2a2 2 0 0 1 0 4H10m0 0h3.7a2 2 0 0 1 0 4H10m0-8v8M11.5 6v1.5m0 8V17"/>',
  github: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>',
  prev: '<path d="M14 6l-6 6 6 6"/>', next: '<path d="M10 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (k, size = 18) => h('span', { class: 'ico', style: `width:${size}px;height:${size}px`, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ''}</svg>` });

// ---------- formatting & time helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const fmtBytes = (b) => (b >= 1e12 ? (b / 1e12).toFixed(1) + ' TB' : b >= 1e9 ? (b / 1e9).toFixed(b >= 1e11 ? 0 : 1) + ' GB' : (b / 1e6).toFixed(0) + ' MB');
const fmtMoney = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 1 : 2) + 'k' : '$' + n.toFixed(n >= 100 ? 0 : 2));
function fmtDuration(ms, withHundredths) {
  ms = Math.max(0, ms);
  const t = Math.floor(ms / 1000), hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  const base = (hh ? hh + ':' + pad(mm) : pad(mm)) + ':' + pad(ss);
  return withHundredths ? base + '.' + pad(Math.floor((ms % 1000) / 10)) : base;
}
/** Elapsed milliseconds of a start/pause clock {running, startedAt, elapsed}. */
const clockElapsed = (c, now = Date.now()) => c.elapsed + (c.running ? now - c.startedAt : 0);
const timeIn = (tz, opts) => new Intl.DateTimeFormat([], { timeZone: tz, ...opts }).format(new Date());
const uid = () => Math.random().toString(36).slice(2, 10);

const WMO = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'], 51: ['Drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Drizzle', '🌦️'],
  61: ['Rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 71: ['Snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌦️'], 82: ['Heavy showers', '⛈️'], 95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm', '⛈️'], 99: ['Thunderstorm', '⛈️'],
};
const wmo = (c) => WMO[c] || ['—', '🌡️'];
const TICKERS = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', dogecoin: 'DOGE', ripple: 'XRP', cardano: 'ADA', litecoin: 'LTC', tether: 'USDT', binancecoin: 'BNB', 'usd-coin': 'USDC' };

// ---------- data sources ----------
const geoCache = new Map();
async function geocode(city) {
  if (geoCache.has(city)) return geoCache.get(city);
  const r = await api.fetchJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`);
  const hit = r.results && r.results[0];
  if (!hit) throw new Error('City not found');
  geoCache.set(city, hit);
  return hit;
}
async function loadWeather(city) {
  if (!city) return { needsCity: true };
  const g = await geocode(city);
  const r = await api.fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
  return { place: g.name, temp: r.current.temperature_2m, code: r.current.weather_code, unit: r.current_units.temperature_2m, daily: r.daily };
}

// ---------- shared flyout bits ----------
const btn = (label, onclick, cls = '') => h('button', { class: 'btn ' + cls, onclick }, label);
const iconBtn = (k, title, onclick, cls = '') => h('button', { class: 'btn icon ' + cls, title, 'aria-label': title, onclick }, icon(k, 16));
const panel = (title, ...kids) => h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, title), ...kids);

// Start/pause/reset helpers that write a start/pause clock into shared state.
function clockPatch(c, action) {
  const now = Date.now();
  if (action === 'start') return { ...c, running: true, startedAt: now };
  if (action === 'pause') return { ...c, running: false, elapsed: clockElapsed(c, now), startedAt: 0 };
  return { ...c, running: false, startedAt: 0, elapsed: 0 };
}

// ---------- widgets ----------
const WIDGETS = [
  { id: 'clock', name: 'Clock', icon: 'clock', every: 1000,
    update: () => Date.now(),
    bar: () => ({ v: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), l: new Date().toLocaleDateString([], { timeZoneName: 'short' }).split(', ').pop() }) },

  { id: 'date', name: 'Date', icon: 'date', every: 30000,
    update: () => Date.now(),
    bar: () => ({ v: new Date().toLocaleDateString([], { weekday: 'short' }), l: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) }) },

  { id: 'calendar', name: 'Calendar', icon: 'calendar', every: 60000,
    update: () => Date.now(),
    bar: () => ({ v: String(new Date().getDate()), l: new Date().toLocaleDateString([], { month: 'short' }) }),
    flyout: { mount(root) {
      let view = new Date(); view.setDate(1);
      const title = h('div', { class: 'cal-title' });
      const grid = h('div', { class: 'cal-grid' });
      const draw = () => {
        title.textContent = view.toLocaleDateString([], { month: 'long', year: 'numeric' });
        grid.replaceChildren(...[...Array(7)].map((_, i) => h('div', { class: 'cal-dow' }, new Date(2024, 0, 7 + i).toLocaleDateString([], { weekday: 'narrow' }))));
        const first = view.getDay(), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate(), today = new Date();
        for (let i = 0; i < first; i++) grid.append(h('div'));
        for (let d = 1; d <= days; d++) {
          const isToday = d === today.getDate() && view.getMonth() === today.getMonth() && view.getFullYear() === today.getFullYear();
          grid.append(h('div', { class: 'cal-day' + (isToday ? ' today' : '') }, d));
        }
      };
      const move = (n) => { view = new Date(view.getFullYear(), view.getMonth() + n, 1); draw(); };
      root.append(panel('Calendar',
        h('div', { class: 'row between' }, iconBtn('prev', 'Previous month', () => move(-1)), title, iconBtn('next', 'Next month', () => move(1))),
        grid, btn('Today', () => { view = new Date(); view.setDate(1); draw(); }, 'ghost')));
      draw();
    } } },

  { id: 'weather', name: 'Weather', icon: 'weather', every: 15 * 60000,
    update: (ctx) => loadWeather(ctx.state.settings.city),
    bar: (d) => {
      if (!d) return { v: '…', l: 'Weather' };
      if (d.needsCity) return { v: '—', l: 'Set city' };
      if (d.error) return { v: '—', l: 'Offline' };
      return { v: Math.round(d.temp) + '°', l: wmo(d.code)[1] + ' ' + wmo(d.code)[0] };
    },
    flyout: { async mount(root, ctx) {
      const body = h('div', { class: 'stack' }, h('div', { class: 'muted' }, 'Loading…'));
      root.append(panel('Weather', body));
      try {
        const d = await loadWeather(ctx.state.settings.city);
        if (d.needsCity) { body.replaceChildren(h('div', { class: 'muted' }, 'Add your city in Settings to see the forecast.')); return; }
        body.replaceChildren(
          h('div', { class: 'wx-now' }, h('span', { class: 'wx-emoji' }, wmo(d.code)[1]), h('div', {}, h('div', { class: 'wx-temp' }, Math.round(d.temp) + d.unit), h('div', { class: 'muted' }, d.place + ' · ' + wmo(d.code)[0]))),
          ...d.daily.time.map((t, i) => h('div', { class: 'row between wx-day' },
            h('span', {}, i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' })),
            h('span', {}, wmo(d.daily.weather_code[i])[1]),
            h('span', { class: 'muted' }, `${Math.round(d.daily.temperature_2m_min[i])}° / ${Math.round(d.daily.temperature_2m_max[i])}°`))));
      } catch (e) { body.replaceChildren(h('div', { class: 'muted' }, 'Could not load weather: ' + e.message)); }
    } } },

  { id: 'cpu', name: 'CPU', icon: 'cpu', every: 2000,
    update: async () => (await api.stats()).cpu,
    bar: (d) => ({ v: d == null ? '—' : Math.round(d) + '%', l: 'CPU', pct: d, tone: d > 85 ? 'bad' : d > 60 ? 'warn' : '' }) },

  { id: 'ram', name: 'Memory', icon: 'ram', every: 4000,
    update: async () => (await api.stats()).mem,
    bar: (d) => d ? { v: Math.round((d.used / d.total) * 100) + '%', l: 'RAM · ' + fmtBytes(d.used), pct: (d.used / d.total) * 100, tone: d.used / d.total > 0.9 ? 'bad' : d.used / d.total > 0.75 ? 'warn' : '' } : { v: '—', l: 'RAM' } },

  { id: 'storage', name: 'Storage', icon: 'storage', every: 60000,
    update: async () => (await api.stats()).disk,
    bar: (d) => d ? { v: fmtBytes(d.free), l: 'free of ' + fmtBytes(d.total), pct: ((d.total - d.free) / d.total) * 100, tone: d.free / d.total < 0.1 ? 'bad' : '' } : { v: '—', l: 'Disk' } },

  { id: 'battery', name: 'Battery', icon: 'battery', every: 30000,
    update: async () => { if (!navigator.getBattery) return null; const b = await navigator.getBattery(); return { level: b.level, charging: b.charging }; },
    bar: (d) => d ? { v: Math.round(d.level * 100) + '%', l: d.charging ? '⚡ Charging' : 'Battery', pct: d.level * 100, tone: !d.charging && d.level < 0.2 ? 'bad' : '' } : { v: '—', l: 'No battery' } },

  { id: 'pomodoro', name: 'Pomodoro', icon: 'pomodoro', every: 500,
    update: (ctx) => ctx.state.data.pomodoro,
    bar: (p) => {
      if (!p) return { v: '—', l: 'Focus' };
      const total = (p.phase === 'focus' ? p.focusMin : p.breakMin) * 60000;
      const left = total - clockElapsed(p);
      return { v: fmtDuration(left), l: (p.phase === 'focus' ? 'Focus' : 'Break') + (p.running ? '' : ' · paused'), pct: 100 - (left / total) * 100, tone: p.phase === 'break' ? 'good' : '' };
    },
    flyout: { mount(root, ctx) {
      const big = h('div', { class: 'big-time' }), phase = h('div', { class: 'muted center' }), cycles = h('div', { class: 'muted center' });
      const toggle = btn('', () => { const p = ctx.state.data.pomodoro; ctx.set({ data: { pomodoro: clockPatch(p, p.running ? 'pause' : 'start') } }); }, 'primary');
      const draw = () => {
        const p = ctx.state.data.pomodoro, total = (p.phase === 'focus' ? p.focusMin : p.breakMin) * 60000;
        big.textContent = fmtDuration(total - clockElapsed(p));
        phase.textContent = p.phase === 'focus' ? 'Focus session' : 'Break';
        cycles.textContent = `${p.cycles} focus session${p.cycles === 1 ? '' : 's'} completed`;
        toggle.replaceChildren(icon(p.running ? 'pause' : 'play', 16), p.running ? ' Pause' : ' Start');
      };
      const num = (label, key) => h('label', { class: 'field' }, label,
        h('input', { type: 'number', min: 1, max: 180, value: ctx.state.data.pomodoro[key], onchange: (e) => { const v = Math.min(180, Math.max(1, +e.target.value || 1)); ctx.set({ data: { pomodoro: { [key]: v } } }); } }));
      root.append(panel('Pomodoro', phase, big, h('div', { class: 'row center gap' }, toggle,
        btn('Reset', () => ctx.set({ data: { pomodoro: clockPatch({ ...ctx.state.data.pomodoro }, 'reset') } }), 'ghost'),
        btn('Skip', () => { const p = ctx.state.data.pomodoro; ctx.set({ data: { pomodoro: { ...clockPatch(p, 'reset'), phase: p.phase === 'focus' ? 'break' : 'focus' } } }); }, 'ghost')),
        cycles, h('div', { class: 'row gap' }, num('Focus (min)', 'focusMin'), num('Break (min)', 'breakMin'))));
      draw();
      return { tick: draw, onState: draw, every: 250 };
    } } },

  { id: 'timer', name: 'Timer', icon: 'timer', every: 250,
    update: (ctx) => ctx.state.data.timer,
    bar: (t) => {
      if (!t) return { v: '—', l: 'Timer' };
      const e = clockElapsed(t);
      if (t.kind === 'stopwatch') return { v: fmtDuration(e), l: t.running ? 'Stopwatch' : e ? 'Stopwatch · paused' : 'Stopwatch' };
      const left = t.durationMin * 60000 - e;
      return { v: fmtDuration(left), l: t.running ? 'Timer' : 'Timer · paused', pct: 100 - (left / (t.durationMin * 60000)) * 100 };
    },
    flyout: { mount(root, ctx) {
      const big = h('div', { class: 'big-time' }), toggle = btn('', () => { const t = ctx.state.data.timer; ctx.set({ data: { timer: clockPatch(t, t.running ? 'pause' : 'start') } }); }, 'primary');
      const tabs = h('div', { class: 'tabs' });
      const presets = h('div', { class: 'row gap wrap center' });
      const setKind = (kind) => ctx.set({ data: { timer: { ...clockPatch(ctx.state.data.timer, 'reset'), kind } } });
      const draw = () => {
        const t = ctx.state.data.timer, e = clockElapsed(t);
        big.textContent = t.kind === 'stopwatch' ? fmtDuration(e, true) : fmtDuration(t.durationMin * 60000 - e);
        toggle.replaceChildren(icon(t.running ? 'pause' : 'play', 16), t.running ? ' Pause' : ' Start');
        tabs.replaceChildren(...['stopwatch', 'countdown'].map((k) => h('button', { class: 'tab' + (t.kind === k ? ' on' : ''), onclick: () => setKind(k) }, k === 'stopwatch' ? 'Stopwatch' : 'Countdown')));
        presets.replaceChildren(...(t.kind === 'countdown' ? [1, 5, 10, 15, 30, 60].map((m) => h('button', { class: 'chip' + (t.durationMin === m ? ' on' : ''), onclick: () => ctx.set({ data: { timer: { ...clockPatch(ctx.state.data.timer, 'reset'), durationMin: m } } }) }, m + 'm')) : []));
      };
      root.append(panel('Timer', tabs, big, presets, h('div', { class: 'row center gap' }, toggle, btn('Reset', () => ctx.set({ data: { timer: clockPatch(ctx.state.data.timer, 'reset') } }), 'ghost'))));
      draw();
      return { tick: draw, onState: draw, every: 100 };
    } } },

  { id: 'todos', name: 'To-dos', icon: 'todos', every: 2000,
    update: (ctx) => ctx.state.data.todos,
    bar: (todos) => { const open = (todos || []).filter((t) => !t.done); return { v: String(open.length), l: open.length ? (open[0].text.length > 14 ? open[0].text.slice(0, 13) + '…' : open[0].text) : 'All done' }; },
    flyout: { mount(root, ctx) {
      const list = h('div', { class: 'list' });
      const input = h('input', { type: 'text', placeholder: 'Add a task…', maxlength: 120, autofocus: true });
      const add = () => { const text = input.value.trim(); if (!text) return; input.value = ''; ctx.set({ data: { todos: [{ id: uid(), text, done: false }, ...ctx.state.data.todos] } }); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      const draw = () => {
        const todos = ctx.state.data.todos;
        list.replaceChildren(...(todos.length ? todos.map((t) => h('div', { class: 'todo' + (t.done ? ' done' : '') },
          h('input', { type: 'checkbox', checked: t.done, 'aria-label': 'Done: ' + t.text, onchange: (e) => ctx.set({ data: { todos: todos.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)) } }) }),
          h('span', {}, t.text),
          iconBtn('trash', 'Delete', () => ctx.set({ data: { todos: todos.filter((x) => x.id !== t.id) } }), 'subtle'))) : [h('div', { class: 'muted center pad' }, 'Nothing to do. Nice.')]));
      };
      root.append(panel('To-dos', h('div', { class: 'row gap' }, input, iconBtn('plus', 'Add task', add, 'primary')), list,
        btn('Clear completed', () => ctx.set({ data: { todos: ctx.state.data.todos.filter((t) => !t.done) } }), 'ghost')));
      draw();
      return { onState: draw };
    } } },

  { id: 'notes', name: 'Notes', icon: 'notes', every: 5000,
    update: (ctx) => ctx.state.data.notes,
    bar: (n) => { const first = (n || '').split('\n').find((l) => l.trim()) || ''; return { v: first ? (first.length > 16 ? first.slice(0, 15) + '…' : first) : 'Notes', l: first ? 'Quick note' : 'Empty' }; },
    flyout: { mount(root, ctx) {
      let timer;
      const ta = h('textarea', { placeholder: 'Jot something down…', maxlength: 20000, autofocus: true }, ctx.state.data.notes);
      ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => ctx.set({ data: { notes: ta.value } }), 300); });
      window.addEventListener('beforeunload', () => ctx.set({ data: { notes: ta.value } }));
      root.append(panel('Notes', ta));
      return {}; // never overwrite the textarea while typing
    } } },

  { id: 'worldclocks', name: 'World clocks', icon: 'worldclocks', every: 1000,
    update: (ctx) => ctx.state.settings.clocks,
    bar: (clocks) => { const c = (clocks || [])[0]; return c ? { v: timeIn(c.tz, { hour: 'numeric', minute: '2-digit' }), l: c.label } : { v: '—', l: 'Add a clock' }; },
    flyout: { mount(root, ctx) {
      const list = h('div', { class: 'stack' });
      const draw = () => {
        const clocks = ctx.state.settings.clocks;
        list.replaceChildren(...(clocks.length ? clocks.map((c) => h('div', { class: 'row between wc' },
          h('div', {}, h('div', { class: 'wc-label' }, c.label), h('div', { class: 'muted' }, timeIn(c.tz, { weekday: 'short', month: 'short', day: 'numeric' }))),
          h('div', { class: 'wc-time' }, timeIn(c.tz, { hour: 'numeric', minute: '2-digit' })))) : [h('div', { class: 'muted pad center' }, 'Add clocks in Settings.')]));
      };
      root.append(panel('World clocks', list));
      draw();
      return { tick: draw, onState: draw, every: 1000 };
    } } },

  { id: 'crypto', name: 'Crypto', icon: 'crypto', every: 90000,
    update: async (ctx) => { const ids = ctx.state.settings.cryptoIds; if (!ids.length) return {}; return api.fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`); },
    bar: (d, ctx) => {
      const id = ctx.state.settings.cryptoIds[0], p = d && id && d[id];
      if (!p) return { v: '—', l: id ? id.slice(0, 4).toUpperCase() : 'Crypto' };
      const ch = p.usd_24h_change || 0;
      return { v: fmtMoney(p.usd), l: `${TICKERS[id] || id.slice(0, 4).toUpperCase()} ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%`, tone: ch >= 0 ? 'good' : 'bad' };
    } },

  { id: 'github', name: 'GitHub', icon: 'github', every: 10 * 60000,
    update: async (ctx) => {
      const u = ctx.state.settings.githubUser; if (!u) return { needsUser: true };
      const [user, events] = await Promise.all([api.fetchJson(`https://api.github.com/users/${u}`), api.fetchJson(`https://api.github.com/users/${u}/events/public?per_page=100`)]);
      const today = new Date().toDateString();
      const commits = events.filter((e) => e.type === 'PushEvent' && new Date(e.created_at).toDateString() === today).reduce((n, e) => n + ((e.payload && e.payload.size) || 0), 0);
      return { user: user.login, followers: user.followers, commits };
    },
    bar: (d) => !d ? { v: '…', l: 'GitHub' } : d.needsUser ? { v: '—', l: 'Set user' } : d.error ? { v: '—', l: 'Offline' } : { v: String(d.commits), l: `commits today · ${d.followers} ★` } },

  { id: 'apps', name: 'Pinned apps', icon: 'apps', every: 0,
    update: (ctx) => ctx.state.settings.apps,
    bar: () => ({ v: '', l: '' }),
    // Custom bar: one icon button per pinned app.
    render(el, apps, ctx) {
      el.classList.add('apps');
      el.replaceChildren(...(apps && apps.length ? apps : []).map((p) => {
        const img = h('img', { alt: '', width: 28, height: 28, draggable: 'false' });
        api.fileIcon(p).then((u) => { if (u) img.src = u; else img.replaceWith(icon('apps', 22)); });
        const name = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
        return h('span', { class: 'app-btn', role: 'button', tabindex: 0, title: name, 'aria-label': 'Open ' + name, onclick: () => api.launch(p), onkeydown: (e) => { if (e.key === 'Enter') api.launch(p); } }, img);
      }));
      if (!apps || !apps.length) el.replaceChildren(h('span', { class: 'l' }, 'Pin apps in Settings'));
    } },
];

// Settings is not a toggleable widget: it is always the last item on the dock.
const SETTINGS_WIDGET = { id: 'settings', name: 'Settings', icon: 'settings',
  flyout: { mount(root, ctx) {
    const S = () => ctx.state.settings;
    const set = (settings) => ctx.set({ settings });
    const select = (label, key, opts) => h('label', { class: 'field' }, label,
      h('select', { onchange: (e) => set({ [key]: e.target.value }) }, opts.map(([v, l]) => h('option', { value: v, selected: S()[key] === v }, l))));
    const text = (label, key, ph) => h('label', { class: 'field' }, label,
      h('input', { type: 'text', value: S()[key], placeholder: ph, maxlength: 80, onchange: (e) => set({ [key]: e.target.value.trim() }) }));
    const check = (label, key) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S()[key], onchange: (e) => set({ [key]: e.target.checked }) }), label);

    const widgetList = h('div', { class: 'list' });
    const appList = h('div', { class: 'list' });
    const draw = () => {
      const on = S().widgets, off = WIDGETS.filter((w) => !on.includes(w.id));
      const move = (i, d) => { const a = [...on]; [a[i], a[i + d]] = [a[i + d], a[i]]; set({ widgets: a }); };
      widgetList.replaceChildren(
        ...on.map((id, i) => { const w = WIDGETS.find((x) => x.id === id); return h('div', { class: 'wrow' }, icon(w.icon, 16), h('span', {}, w.name),
          iconBtn('up', 'Move up', () => move(i, -1), 'subtle' + (i === 0 ? ' dis' : '')), iconBtn('down', 'Move down', () => move(i, 1), 'subtle' + (i === on.length - 1 ? ' dis' : '')),
          iconBtn('trash', 'Remove ' + w.name, () => set({ widgets: on.filter((x) => x !== id) }), 'subtle')); }),
        ...off.map((w) => h('div', { class: 'wrow off' }, icon(w.icon, 16), h('span', {}, w.name), iconBtn('plus', 'Add ' + w.name, () => set({ widgets: [...on, w.id] }), 'subtle'))));
      appList.replaceChildren(...S().apps.map((p) => h('div', { class: 'wrow' }, h('span', { class: 'grow' }, p.split(/[\\/]/).pop()), iconBtn('trash', 'Unpin', () => set({ apps: S().apps.filter((x) => x !== p) }), 'subtle'))));
    };
    const clocksText = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'London=Europe/London' }, S().clocks.map((c) => `${c.label}=${c.tz}`).join('\n'));
    clocksText.addEventListener('change', () => set({ clocks: clocksText.value.split('\n').map((l) => l.split('=')).filter((p) => p.length === 2).map(([label, tz]) => ({ label: label.trim(), tz: tz.trim() })) }));

    root.append(h('div', { class: 'panel scroll' },
      h('div', { class: 'panel-head' }, 'Settings'),
      h('div', { class: 'grid2' }, select('Position', 'position', [['bottom', 'Bottom'], ['top', 'Top']]), select('Layout', 'width', [['pill', 'Pill'], ['full', 'Full width']])),
      select('Style', 'style', [['glass', 'Glass'], ['white', 'White'], ['midnight', 'Midnight'], ['black', 'Black']]),
      check('Reserve screen space (maximised windows stop above the dock)', 'reserveSpace'),
      check('Launch at login', 'launchAtLogin'),
      h('div', { class: 'section' }, 'Widgets'), widgetList,
      h('div', { class: 'section' }, 'Pinned apps'), appList,
      btn('Pin an app…', async () => { const p = await api.pickApp(); if (p && !S().apps.includes(p)) set({ apps: [...S().apps, p] }); }, 'ghost'),
      h('div', { class: 'section' }, 'Data'),
      text('Weather city', 'city', 'e.g. Chennai'),
      text('GitHub username', 'githubUser', 'e.g. torvalds'),
      h('label', { class: 'field' }, 'Crypto (CoinGecko ids)', h('input', { type: 'text', value: S().cryptoIds.join(', '), placeholder: 'bitcoin, ethereum', onchange: (e) => set({ cryptoIds: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) }) })),
      h('label', { class: 'field' }, 'World clocks (Label=Time/Zone, one per line)', clocksText),
      h('div', { class: 'row between' }, btn('Quit lumabar', () => api.quit(), 'danger'), h('span', { class: 'muted' }, 'v0.1.0'))));
    draw();
    return { onState: draw };
  } } };

const byId = (id) => (id === 'settings' ? SETTINGS_WIDGET : WIDGETS.find((w) => w.id === id));

// Exposed for tests (Node) as well as the browser.
if (typeof module !== 'undefined') module.exports = { fmtDuration, clockElapsed, clockPatch, fmtBytes, fmtMoney };
