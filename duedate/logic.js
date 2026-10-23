/* Pregnancy dating. Pure functions (window.DueLogic / require). Dates are calendar days {y, m, d} handled in UTC.
   Rules from ACOG Committee Opinion 700, "Methods for Estimating the Due Date":
   - last menstrual period (LMP): due date = LMP + 280 days (adjusted by cycle length − 28 days here, optional);
   - conception: + 266 days;
   - IVF: day-5 embryo transfer + 261 days, day-3 transfer + 263 days;
   - ultrasound: due date = scan date + (280 − gestational age at the scan in days). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DueLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const num = (dt) => Date.UTC(dt.y, dt.m - 1, dt.d) / DAY;
  const fromNum = (n) => { const x = new Date(n * DAY); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
  const add = (dt, n) => fromNum(num(dt) + n);

  function dueDate(method, o) {
    switch (method) {
      case 'lmp': return add(o.lmp, 280 + ((o.cycle || 28) - 28));
      case 'conception': return add(o.conception, 266);
      case 'ivf': return add(o.transfer, o.embryoDay === 3 ? 263 : 261);
      case 'ultrasound': return add(o.scan, 280 - (o.weeks * 7 + (o.days || 0)));
      default: throw new Error('Unknown method');
    }
  }

  /* Gestational age in days on `on`, counted from the LMP-equivalent start (due date − 280 days). */
  function gaDays(due, on) { return num(on) - (num(due) - 280); }
  function weeksDays(days) { return { weeks: Math.floor(days / 7), days: ((days % 7) + 7) % 7 }; }

  /* Trimesters: first through 13 weeks 6 days, second 14w0d to 27w6d, third from 28w0d. */
  function trimester(days) {
    if (days < 0) return 0;
    if (days < 14 * 7) return 1;
    if (days < 28 * 7) return 2;
    return 3;
  }

  /* ACOG term definitions (Committee Opinion 579). */
  function termLabel(days) {
    if (days < 37 * 7) return 'Preterm';
    if (days < 39 * 7) return 'Early term';
    if (days < 41 * 7) return 'Full term';
    if (days < 42 * 7) return 'Late term';
    return 'Post-term';
  }

  /* Date at which the pregnancy reaches `weeks` weeks + `days` days. */
  function dateAt(due, weeks, days = 0) { return add(due, weeks * 7 + days - 280); }

  /* Common US prenatal timing (ACOG and CDC): ranges in completed weeks. */
  const MILESTONES = [
    { id: 'anatomy', label: 'Anatomy ultrasound', from: [18, 0], to: [22, 6] },
    { id: 'glucose', label: 'Gestational diabetes screening', from: [24, 0], to: [28, 6] },
    { id: 'tdap', label: 'Tdap (whooping cough) vaccine', from: [27, 0], to: [36, 6] },
    { id: 'gbs', label: 'Group B strep test', from: [36, 0], to: [37, 6] },
  ];

  return { num, fromNum, add, dueDate, gaDays, weeksDays, trimester, termLabel, dateAt, MILESTONES };
});
