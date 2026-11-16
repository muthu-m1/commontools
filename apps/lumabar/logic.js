'use strict';
// Pure helpers shared by the main process and the tests. No Electron imports here.

const ALL_WIDGETS = [
  'clock', 'date', 'calendar', 'weather', 'cpu', 'ram', 'battery', 'storage',
  'pomodoro', 'timer', 'todos', 'notes', 'worldclocks', 'crypto', 'github', 'apps',
];

const DEFAULTS = {
  settings: {
    position: 'bottom',            // 'top' | 'bottom'
    width: 'pill',                 // 'pill' | 'full'
    style: 'glass',                // 'glass' | 'white' | 'midnight' | 'black'
    reserveSpace: true,            // behave like the taskbar: maximised windows stop above the dock
    launchAtLogin: false,
    widgets: ['clock', 'date', 'weather', 'cpu', 'ram', 'battery', 'pomodoro', 'todos', 'calendar'],
    city: '',
    githubUser: '',
    cryptoIds: ['bitcoin', 'ethereum'],
    clocks: [
      { label: 'New York', tz: 'America/New_York' },
      { label: 'London', tz: 'Europe/London' },
      { label: 'Tokyo', tz: 'Asia/Tokyo' },
    ],
    apps: [],                      // absolute paths to pinned executables / shortcuts
  },
  data: {
    todos: [],                     // { id, text, done }
    notes: '',
    pomodoro: { phase: 'focus', running: false, startedAt: 0, elapsed: 0, focusMin: 25, breakMin: 5, cycles: 0 },
    timer: { kind: 'stopwatch', running: false, startedAt: 0, elapsed: 0, durationMin: 5 },
  },
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Merge `patch` into `base`, going one level deep into each top-level section and each plain-object key. */
function mergeState(base, patch) {
  const out = { settings: { ...base.settings }, data: { ...base.data } };
  for (const section of ['settings', 'data']) {
    const p = patch && patch[section];
    if (!isPlainObject(p)) continue;
    for (const [k, v] of Object.entries(p)) {
      if (!(k in DEFAULTS[section])) continue; // ignore unknown keys
      out[section][k] = isPlainObject(v) && isPlainObject(out[section][k]) ? { ...out[section][k], ...v } : v;
    }
  }
  return out;
}

/** Bring anything read from disk back into a valid shape. */
function sanitize(state) {
  const s = mergeState(structuredClone(DEFAULTS), state || {});
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  s.settings.position = oneOf(s.settings.position, ['top', 'bottom'], 'bottom');
  s.settings.width = oneOf(s.settings.width, ['pill', 'full'], 'pill');
  s.settings.style = oneOf(s.settings.style, ['glass', 'white', 'midnight', 'black'], 'glass');
  s.settings.widgets = (Array.isArray(s.settings.widgets) ? s.settings.widgets : [])
    .filter((id, i, a) => ALL_WIDGETS.includes(id) && a.indexOf(id) === i);
  s.settings.cryptoIds = (Array.isArray(s.settings.cryptoIds) ? s.settings.cryptoIds : [])
    .filter((x) => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 4);
  s.settings.clocks = (Array.isArray(s.settings.clocks) ? s.settings.clocks : [])
    .filter((c) => c && typeof c.label === 'string' && isValidTimeZone(c.tz)).slice(0, 6);
  s.settings.apps = (Array.isArray(s.settings.apps) ? s.settings.apps : []).filter((p) => typeof p === 'string').slice(0, 12);
  s.settings.city = String(s.settings.city || '').slice(0, 80);
  s.settings.githubUser = /^[A-Za-z0-9-]{1,39}$/.test(s.settings.githubUser || '') ? s.settings.githubUser : '';
  if (!Array.isArray(s.data.todos)) s.data.todos = [];
  if (typeof s.data.notes !== 'string') s.data.notes = '';
  return s;
}

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// Only these hosts can be reached through the fetch bridge.
const FETCH_ALLOWLIST = new Set([
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'api.coingecko.com',
  'api.github.com',
]);

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && FETCH_ALLOWLIST.has(u.hostname);
  } catch { return false; }
}

/** CPU % between two os.cpus() snapshots. */
function cpuPercent(prev, next) {
  const sum = (cpus) => cpus.reduce((a, c) => {
    const t = c.times; const total = t.user + t.nice + t.sys + t.idle + t.irq;
    return { idle: a.idle + t.idle, total: a.total + total };
  }, { idle: 0, total: 0 });
  const a = sum(prev), b = sum(next);
  const dt = b.total - a.total;
  if (dt <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - (b.idle - a.idle) / dt) * 100));
}

/** Only http(s) links and local file paths may be launched. */
function isLaunchable(target) {
  if (typeof target !== 'string' || !target || target.length > 1024) return false;
  if (/^https?:\/\//i.test(target)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^[a-z]:[\\/]/i.test(target)) return false; // other URL schemes
  return true;
}

module.exports = { ALL_WIDGETS, DEFAULTS, mergeState, sanitize, isAllowedUrl, isValidTimeZone, cpuPercent, isLaunchable };
