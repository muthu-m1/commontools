/* CPR coach timing. Pure functions (window.CPRLogic / require).
   Adult guidance shared by the American Heart Association and the European Resuscitation Council:
   compressions at 100–120 per minute, 5–6 cm (2–2.4 in) deep, full recoil, minimal pauses,
   and a change of rescuer about every 2 minutes when someone else can take over. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CPRLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RATE_MIN = 100, RATE_MAX = 120, RATE = 110, SWAP_SECONDS = 120;

  /* Seconds between beats at a given rate; rates outside 100–120 are clamped into the recommended band. */
  function interval(bpm = RATE) { return 60 / Math.min(RATE_MAX, Math.max(RATE_MIN, bpm)); }

  /* Beat times (seconds from start) in [from, to), for an audio scheduler. */
  function beatsBetween(from, to, bpm = RATE) {
    const step = interval(bpm);
    const out = [];
    for (let k = Math.ceil(from / step - 1e-9); k * step < to - 1e-9; k++) out.push(k * step);
    return out;
  }

  /* How many compressions have been cued after `elapsed` seconds (the first beat is at 0). */
  function count(elapsed, bpm = RATE) { return elapsed < 0 ? 0 : Math.floor(elapsed / interval(bpm) + 1e-9) + 1; }

  /* Seconds until the next suggested swap of rescuers, and how many swaps are due so far. */
  function swap(elapsed) {
    const done = Math.floor(elapsed / SWAP_SECONDS);
    return { next: SWAP_SECONDS - (elapsed - done * SWAP_SECONDS), due: done };
  }

  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return { RATE, RATE_MIN, RATE_MAX, SWAP_SECONDS, interval, beatsBetween, count, swap, clock };
});
