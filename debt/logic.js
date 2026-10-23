/* Debt payoff simulation: avalanche, snowball and minimum-payments-only. Pure functions (window.DebtLogic / require).
   Money is carried in integer cents. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DebtLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_MONTHS = 1200; // 100 years: anything longer is reported as never paid off

  /* Order in which extra money is aimed at debts.
     avalanche: highest APR first (ties: smaller balance first).
     snowball: smallest balance first (ties: higher APR first). Order is fixed from the starting balances. */
  function order(debts, strategy) {
    const idx = debts.map((d, i) => i);
    if (strategy === 'avalanche') idx.sort((a, b) => debts[b].apr - debts[a].apr || debts[a].balance - debts[b].balance || a - b);
    else if (strategy === 'snowball') idx.sort((a, b) => debts[a].balance - debts[b].balance || debts[b].apr - debts[a].apr || a - b);
    return idx;
  }

  /* Simulate month by month.
     Each month: (1) interest = balance × APR ÷ 12, rounded to the cent, is added to every open debt;
     (2) every open debt gets its minimum payment (or its remaining balance if smaller);
     (3) for avalanche/snowball, whatever is left of the monthly budget goes to the first open debt in the order,
         spilling to the next when that one is cleared. A paid-off debt's minimum stays in the budget ("rolls over").
     strategy 'minimum' pays each debt only its own minimum and never redirects freed-up money. */
  function simulate(debts, { extra = 0, strategy = 'avalanche', maxMonths = MAX_MONTHS } = {}) {
    const toC = (v) => Math.round(v * 100);
    const D = debts.map((d, i) => ({ i, bal: toC(d.balance), r: d.apr / 100 / 12, min: toC(d.min), interest: 0, paid: 0, payoff: null, focus: [] }));
    const budget = D.reduce((a, d) => a + d.min, 0) + toC(extra);
    const ord = strategy === 'minimum' ? null : order(debts, strategy);
    const totals = []; // total balance after each month
    const balances = []; // per-debt balance after each month
    let month = 0, totalInterest = 0, totalPaid = 0;
    const open = () => D.some((d) => d.bal > 0);
    while (open() && month < maxMonths) {
      month++;
      for (const d of D) if (d.bal > 0) { const int = Math.round(d.bal * d.r); d.bal += int; d.interest += int; totalInterest += int; }
      let avail = budget;
      for (const d of D) {
        if (d.bal <= 0) continue;
        const pay = Math.min(d.min, d.bal);
        d.bal -= pay; d.paid += pay; avail -= pay; totalPaid += pay;
      }
      if (ord) {
        for (const k of ord) {
          if (avail <= 0) break;
          const d = D[k];
          if (d.bal <= 0) continue;
          const pay = Math.min(avail, d.bal);
          d.bal -= pay; d.paid += pay; avail -= pay; totalPaid += pay;
          d.focus.push(month);
        }
      }
      for (const d of D) if (d.bal === 0 && d.payoff === null) d.payoff = month;
      balances.push(D.map((d) => d.bal / 100));
      totals.push(D.reduce((a, d) => a + d.bal, 0) / 100);
    }
    const done = !open();
    return {
      strategy,
      done,
      months: done ? month : Infinity,
      budget: budget / 100,
      totalInterest: totalInterest / 100,
      totalPaid: totalPaid / 100,
      order: ord,
      debts: D.map((d) => ({ index: d.i, payoff: d.payoff, interest: d.interest / 100, paid: d.paid / 100, focus: d.focus, remaining: d.bal / 100 })),
      totals,
      balances,
    };
  }

  /* Minimum payment that at least covers the first month's interest (otherwise the debt grows). */
  function coversInterest(debt) {
    return Math.round(debt.min * 100) > Math.round(debt.balance * 100 * (debt.apr / 100 / 12));
  }

  /* Months to repay one debt with a fixed payment (closed form), for checks. */
  function monthsFor(balance, apr, pmt) {
    const r = apr / 100 / 12;
    if (r === 0) return balance / pmt;
    if (pmt <= balance * r) return Infinity;
    return -Math.log(1 - (r * balance) / pmt) / Math.log(1 + r);
  }

  return { order, simulate, coversInterest, monthsFor, MAX_MONTHS };
});
