/* Calendar date arithmetic. Pure functions (window.DatesLogic / require).
   Dates are plain calendar days {y, m, d} (m = 1–12) handled in UTC, so time zones and daylight saving never
   shift a result. Gregorian calendar throughout. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DatesLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const num = (dt) => Date.UTC(dt.y, dt.m - 1, dt.d) / DAY;           // day number
  const fromNum = (n) => { const x = new Date(n * DAY); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const weekday = (dt) => new Date(num(dt) * DAY).getUTCDay(); // 0 = Sunday
  const iso = (dt) => `${String(dt.y).padStart(4, '0')}-${String(dt.m).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;
  const cmp = (a, b) => num(a) - num(b);

  function parse(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const dt = { y: +m[1], m: +m[2], d: +m[3] };
    if (dt.m < 1 || dt.m > 12 || dt.d < 1 || dt.d > daysInMonth(dt.y, dt.m)) return null;
    return dt;
  }

  function daysBetween(a, b) { return num(b) - num(a); }
  function addDays(dt, n) { return fromNum(num(dt) + n); }

  /* Add months; when the day does not exist in the target month (31 April), use that month's last day. */
  function addMonths(dt, n) {
    const idx = dt.y * 12 + (dt.m - 1) + n;
    const y = Math.floor(idx / 12), m = (idx % 12 + 12) % 12 + 1;
    return { y, m, d: Math.min(dt.d, daysInMonth(y, m)) };
  }
  function addYears(dt, n) { return addMonths(dt, 12 * n); }

  /* Calendar difference in years, months and days. A month is complete when the same day of the month is reached
     (or that month's last day, when the day does not exist in it). Returns a sign for b before a. */
  function diff(a, b) {
    let sign = 1;
    if (cmp(b, a) < 0) { [a, b] = [b, a]; sign = -1; }
    let k = (b.y - a.y) * 12 + (b.m - a.m) + 1;
    while (k > 0 && cmp(addMonths(a, k), b) > 0) k--;
    const anchor = addMonths(a, k);
    return { sign, years: Math.floor(k / 12), months: k % 12, days: daysBetween(anchor, b), totalMonths: k, totalDays: daysBetween(a, b) };
  }

  /* ISO 8601 week number and week-year. */
  function isoWeek(dt) {
    const n = num(dt);
    const wd = (weekday(dt) + 6) % 7; // Monday = 0
    const thursday = fromNum(n - wd + 3);
    const jan1 = { y: thursday.y, m: 1, d: 1 };
    return { year: thursday.y, week: Math.floor(daysBetween(jan1, thursday) / 7) + 1 };
  }

  /* ---------- US federal holidays (5 U.S.C. 6103), with the observed-day rule used for federal employees:
     a holiday on Saturday is observed the Friday before, on Sunday the Monday after. ---------- */
  function nthWeekday(y, m, wd, n) { // n-th (1-based) weekday wd (0=Sun) of month; n = -1 for the last
    if (n > 0) { const first = weekday({ y, m, d: 1 }); return { y, m, d: 1 + ((wd - first + 7) % 7) + 7 * (n - 1) }; }
    const lastD = daysInMonth(y, m), last = weekday({ y, m, d: lastD });
    return { y, m, d: lastD - ((last - wd + 7) % 7) };
  }
  function usHolidays(y) {
    const list = [];
    const fixed = (name, m, d) => {
      const actual = { y, m, d }, wd = weekday(actual);
      const observed = wd === 6 ? addDays(actual, -1) : wd === 0 ? addDays(actual, 1) : actual;
      list.push({ name, date: actual, observed });
    };
    const floating = (name, dt) => list.push({ name, date: dt, observed: dt });
    fixed("New Year's Day", 1, 1);
    if (y >= 1986) floating('Birthday of Martin Luther King, Jr.', nthWeekday(y, 1, 1, 3));
    floating("Washington's Birthday", nthWeekday(y, 2, 1, 3));
    floating('Memorial Day', nthWeekday(y, 5, 1, -1));
    if (y >= 2021) fixed('Juneteenth National Independence Day', 6, 19);
    fixed('Independence Day', 7, 4);
    floating('Labor Day', nthWeekday(y, 9, 1, 1));
    floating('Columbus Day', nthWeekday(y, 10, 1, 2));
    fixed('Veterans Day', 11, 11);
    floating('Thanksgiving Day', nthWeekday(y, 11, 4, 4));
    fixed('Christmas Day', 12, 25);
    return list;
  }
  /* Set of observed holiday day-numbers covering [a, b] (looks one year either side for Dec 31 observances). */
  function holidaySet(a, b) {
    const set = new Map();
    for (let y = a.y - 1; y <= b.y + 1; y++) for (const h of usHolidays(y)) { const n = num(h.observed); if (n >= num(a) && n <= num(b)) set.set(n, h); }
    return set;
  }

  /* Working days (Mon–Fri, minus observed US federal holidays when asked) from a to b, counting both ends. */
  function businessDays(a, b, { holidays = false } = {}) {
    let sign = 1;
    if (cmp(b, a) < 0) { [a, b] = [b, a]; sign = -1; }
    const hs = holidays ? holidaySet(a, b) : new Map();
    const total = daysBetween(a, b) + 1;
    // whole weeks have 5 weekdays each; count the remainder directly
    const weeks = Math.floor(total / 7);
    let count = weeks * 5;
    const startWd = weekday(a);
    for (let i = 0; i < total % 7; i++) { const wd = (startWd + weeks * 7 + i) % 7; if (wd !== 0 && wd !== 6) count++; }
    let off = 0;
    for (const [n] of hs) { const wd = new Date(n * DAY).getUTCDay(); if (wd !== 0 && wd !== 6) off++; }
    return { count: sign * (count - off), weekdays: sign * count, holidaysOff: off, holidays: [...hs.values()] };
  }

  /* The date `n` working days after (or before, n < 0) dt, like a spreadsheet WORKDAY function. */
  function addBusinessDays(dt, n, { holidays = false } = {}) {
    const step = n < 0 ? -1 : 1;
    let left = Math.abs(n), cur = dt;
    let hs = new Map(), hy = null;
    while (left > 0) {
      cur = addDays(cur, step);
      if (holidays && hy !== cur.y) { hs = holidaySet({ y: cur.y, m: 1, d: 1 }, { y: cur.y, m: 12, d: 31 }); hy = cur.y; }
      const wd = weekday(cur);
      if (wd === 0 || wd === 6 || hs.has(num(cur))) continue;
      left--;
    }
    return cur;
  }

  return { parse, iso, num, fromNum, isLeap, daysInMonth, weekday, daysBetween, addDays, addMonths, addYears, diff, isoWeek, usHolidays, holidaySet, businessDays, addBusinessDays, nthWeekday };
});
