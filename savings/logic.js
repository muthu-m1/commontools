/* Savings growth with monthly deposits. Pure functions (window.SavingsLogic / require).
   Model: deposits happen monthly. Interest builds up every month at the periodic rate and is CREDITED (starts earning
   interest itself) at the compounding frequency, the way savings accounts and CDs work:
   - daily compounding: each month grows by (1 + r/365)^(365/12), i.e. daily compounding over an average month;
   - monthly: each month grows by r/12;
   - quarterly / annually: each month accrues balance × r/12 as uncredited interest, credited every 3 / 12 months. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SavingsLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FREQ = { daily: 365, monthly: 12, quarterly: 4, annually: 1 };

  function project(o) {
    const months = Math.round(o.years * 12);
    const r = (o.rate || 0) / 100;
    const n = FREQ[o.compounding] || 12;
    const timing = o.timing === 'start' ? 'start' : 'end';
    const growth = (o.increase || 0) / 100; // yearly increase of the monthly deposit
    const credEvery = n >= 12 ? 1 : 12 / n;   // months between credits
    const monthlyFactor = n === 365 ? Math.pow(1 + r / 365, 365 / 12) : 1 + r / 12;
    let bal = o.initial || 0, accrued = 0, deposits = o.initial || 0, interest = 0;
    const rows = [];
    let yearDep = 0, yearInt = 0;
    for (let k = 1; k <= months; k++) {
      const year = Math.ceil(k / 12);
      const dep = (o.monthly || 0) * Math.pow(1 + growth, year - 1);
      if (timing === 'start') { bal += dep; deposits += dep; yearDep += dep; }
      let earned;
      if (n >= 12) { earned = bal * (monthlyFactor - 1); bal += earned; }
      else {
        earned = bal * (r / 12);
        accrued += earned;
        if (k % credEvery === 0) { bal += accrued; accrued = 0; }
      }
      interest += earned; yearInt += earned;
      if (timing === 'end') { bal += dep; deposits += dep; yearDep += dep; }
      if (k % 12 === 0 || k === months) {
        rows.push({ year, month: k, deposits: yearDep, interest: yearInt, balance: bal + accrued, totalDeposits: deposits, totalInterest: interest });
        yearDep = 0; yearInt = 0;
      }
    }
    // uncredited interest at the end (quarterly/annual compounding mid-period) is shown as part of the balance
    return { months, balance: bal + accrued, credited: bal, accrued, deposits, interest, rows };
  }

  /* Monthly deposit needed to reach `goal`: the future value is linear in the deposit, so
     needed = (goal − FV with no deposits) ÷ FV of a deposit of 1. */
  function depositForGoal(o, goal) {
    const base = project({ ...o, monthly: 0 }).balance;
    if (goal <= base) return 0;
    const unit = project({ ...o, initial: 0, monthly: 1 }).balance;
    if (!(unit > 0)) return Infinity;
    return (goal - base) / unit;
  }

  /* First month in which the balance (including accrued interest) reaches the goal; null if not within maxYears. */
  function monthsToGoal(o, goal, maxYears = 100) {
    if ((o.initial || 0) >= goal) return 0;
    const months = maxYears * 12;
    const r = (o.rate || 0) / 100, n = FREQ[o.compounding] || 12, growth = (o.increase || 0) / 100;
    const credEvery = n >= 12 ? 1 : 12 / n;
    const monthlyFactor = n === 365 ? Math.pow(1 + r / 365, 365 / 12) : 1 + r / 12;
    let bal = o.initial || 0, accrued = 0;
    for (let k = 1; k <= months; k++) {
      const dep = (o.monthly || 0) * Math.pow(1 + growth, Math.ceil(k / 12) - 1);
      if (o.timing === 'start') bal += dep;
      if (n >= 12) bal *= monthlyFactor;
      else { accrued += bal * (r / 12); if (k % credEvery === 0) { bal += accrued; accrued = 0; } }
      if (o.timing !== 'start') bal += dep;
      if (bal + accrued >= goal) return k;
    }
    return null;
  }

  /* Effective annual yield (APY) for a nominal rate compounded n times a year. */
  function apy(ratePct, compounding) {
    const n = FREQ[compounding] || 12, r = ratePct / 100;
    return Math.pow(1 + r / n, n) - 1;
  }

  /* Value in today's money after `years` of inflation at `inflPct` a year. */
  function real(amount, inflPct, years) { return amount / Math.pow(1 + inflPct / 100, years); }

  return { FREQ, project, depositForGoal, monthsToGoal, apy, real };
});
