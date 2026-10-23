/* Time zone math on top of the IANA time zone database built into every modern browser (Intl).
   Pure functions (window.TZLogic / require). Instants are milliseconds since 1970 UTC. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TZLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const fmtCache = new Map();
  function formatter(tz) {
    if (!fmtCache.has(tz)) fmtCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }));
    return fmtCache.get(tz);
  }
  function isValidZone(tz) { try { formatter(tz); return true; } catch (e) { return false; } }

  /* Wall-clock parts of an instant in a zone. */
  function parts(tz, t) {
    const out = {};
    for (const p of formatter(tz).formatToParts(new Date(t))) if (p.type !== 'literal') out[p.type] = p.value;
    return { y: +out.year, m: +out.month, d: +out.day, h: +out.hour % 24, min: +out.minute, s: +out.second, weekday: out.weekday };
  }

  /* UTC offset in minutes (east positive) of `tz` at instant t. */
  function offset(tz, t) {
    const p = parts(tz, t);
    const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    return Math.round((asUTC - Math.floor(t / 1000) * 1000) / 60000);
  }

  /* The instant at which `tz` shows the wall time {y, m, d, h, min}.
     A time skipped by a spring-forward change resolves to the same clock reading after the jump (02:30 → 03:30),
     flagged gap: true. A repeated time in a fall-back change resolves to the earlier occurrence, flagged ambiguous. */
  function toInstant(tz, w) {
    const wall = Date.UTC(w.y, w.m - 1, w.d, w.h || 0, w.min || 0);
    const candidates = new Set();
    for (const probe of [wall - 36e5 * 14, wall, wall + 36e5 * 14]) {
      const off = offset(tz, probe);
      candidates.add(wall - off * 60000);
    }
    const hits = [...candidates].filter((t) => { const p = parts(tz, t); return p.y === w.y && p.m === w.m && p.d === w.d && p.h === (w.h || 0) && p.min === (w.min || 0); }).sort((a, b) => a - b);
    if (hits.length) return { t: hits[0], ambiguous: hits.length > 1, gap: false };
    // in a gap: use the offset from before the change, which lands just after the jump
    const before = offset(tz, wall - 36e5 * 14);
    return { t: wall - before * 60000, ambiguous: false, gap: true };
  }

  /* All the hourly slots of a local calendar day in `tz`, by real elapsed time: 24 slots normally, 23 on the day
     clocks spring forward and 25 on the day they fall back. */
  function daySlots(tz, y, m, d) {
    const start = toInstant(tz, { y, m, d, h: 0, min: 0 }).t;
    const slots = [];
    for (let t = start; ; t += 36e5) {
      const p = parts(tz, t);
      if (p.y !== y || p.m !== m || p.d !== d) break;
      slots.push(t);
      if (slots.length > 26) break;
    }
    return slots;
  }

  function label(off) {
    const sign = off < 0 ? '−' : '+', a = Math.abs(off);
    const h = Math.floor(a / 60), mm = a % 60;
    return 'UTC' + (off === 0 ? '' : sign + h + (mm ? ':' + String(mm).padStart(2, '0') : ''));
  }

  /* Status of a local time for a person: work (inside working hours), awake (two hours either side, up to 22:00),
     or night. Hours are compared at minute precision so 09:30 counts as working when work starts at 9. */
  function status(h, min, workStart = 9, workEnd = 17) {
    const x = h + min / 60;
    if (x >= workStart && x < workEnd) return 'work';
    if (x >= Math.max(7, workStart - 2) && x < Math.min(22, workEnd + 4)) return 'awake';
    return 'night';
  }

  /* Rank slots: everyone working first, then the most people working, then the fewest at night. */
  function rank(slots, zones, workStart, workEnd) {
    return slots.map((t, i) => {
      const st = zones.map((z) => { const p = parts(z, t); return status(p.h, p.min, workStart, workEnd); });
      const work = st.filter((s) => s === 'work').length, night = st.filter((s) => s === 'night').length;
      return { i, t, st, work, night, all: work === zones.length, score: work * 10 - night * 3 };
    });
  }

  return { isValidZone, parts, offset, toInstant, daySlots, label, status, rank };
});
