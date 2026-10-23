/* Loan & Mortgage math. Pure functions; works in the browser (window.LoanLogic) and in Node (require).
   Money is carried in integer minor units (cents) so every column of the schedule sums exactly. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoanLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Level payment for a fully amortizing loan: P·r / (1 − (1 + r)^−n), r = monthly rate. Unrounded. */
  function payment(principal, annualRatePct, months) {
    if (!(principal > 0) || !(months > 0)) return NaN;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / months;
    return (principal * r) / (1 - Math.pow(1 + r, -months));
  }

  /* Number of level payments needed to repay `principal` with payment `pmt` (closed form, may be fractional). */
  function paymentsNeeded(principal, annualRatePct, pmt) {
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / pmt;
    if (pmt <= principal * r) return Infinity;
    return -Math.log(1 - (r * principal) / pmt) / Math.log(1 + r);
  }

  /* Month-by-month schedule. Interest each month = balance × r, rounded to the minor unit (as lenders do).
     The scheduled payment is rounded to the minor unit; the last payment absorbs the rounding remainder.
     extra: added to every payment from month `extraFrom`; lump: one extra payment in month `lumpAt`. */
  function amortize(opts) {
    const digits = opts.digits == null ? 2 : opts.digits;
    const unit = Math.pow(10, digits);
    const months = Math.round(opts.months);
    const r = opts.rate / 100 / 12;
    const principalC = Math.round(opts.principal * unit);
    const pmtC = Math.round(payment(opts.principal, opts.rate, months) * unit);
    const extraC = Math.max(0, Math.round((opts.extra || 0) * unit));
    const extraFrom = Math.max(1, Math.round(opts.extraFrom || 1));
    const lumpC = Math.max(0, Math.round((opts.lump || 0) * unit));
    const lumpAt = Math.round(opts.lumpAt || 0);

    const rows = [];
    let bal = principalC;
    let totInt = 0, totPrin = 0, totExtra = 0;
    for (let n = 1; bal > 0 && n <= months; n++) {
      const intC = Math.round(bal * r);
      let schedPrinC = pmtC - intC;
      if (n === months || schedPrinC >= bal) schedPrinC = bal; // final payment clears the balance
      let extra = 0;
      const after = bal - schedPrinC;
      if (after > 0) {
        if (n >= extraFrom) extra += extraC;
        if (n === lumpAt) extra += lumpC;
        extra = Math.min(extra, after);
      }
      const prinC = schedPrinC + extra;
      bal -= prinC;
      totInt += intC; totPrin += prinC; totExtra += extra;
      rows.push({ n, interest: intC / unit, principal: prinC / unit, extra: extra / unit, paid: (intC + prinC) / unit, balance: bal / unit });
    }
    return {
      payment: pmtC / unit,
      rows,
      months: rows.length,
      totalInterest: totInt / unit,
      totalPrincipal: totPrin / unit,
      totalExtra: totExtra / unit,
      totalPaid: (totInt + totPrin) / unit,
    };
  }

  /* Group a schedule into years of 12 payments. */
  function byYear(rows) {
    const years = [];
    rows.forEach((row) => {
      const y = Math.ceil(row.n / 12);
      let Y = years[y - 1];
      if (!Y) { Y = years[y - 1] = { year: y, interest: 0, principal: 0, extra: 0, paid: 0, balance: 0, payments: 0 }; }
      Y.interest += row.interest; Y.principal += row.principal; Y.extra += row.extra; Y.paid += row.paid;
      Y.balance = row.balance; Y.payments++;
    });
    // tidy floating sums back to cents
    years.forEach((Y) => { ['interest', 'principal', 'extra', 'paid'].forEach((k) => { Y[k] = Math.round(Y[k] * 100) / 100; }); });
    return years;
  }

  /* First payment number at which principal paid exceeds interest paid (the "crossover"), or null. */
  function crossover(rows) {
    for (const row of rows) if (row.principal - row.extra > row.interest) return row.n;
    return null;
  }

  /* A home loan with escrow items. PMI applies when the down payment is under 20% of the price; it is estimated
     as annualRate × original loan ÷ 12 and stops after the payment at which the ORIGINAL schedule's balance first
     reaches 78% of the price (automatic termination under the US Homeowners Protection Act of 1998). */
  function mortgage(o) {
    const digits = o.digits == null ? 2 : o.digits;
    const unit = Math.pow(10, digits);
    const round = (v) => Math.round(v * unit) / unit;
    const loan = round(o.price - o.down);
    const base = amortize({ principal: loan, rate: o.rate, months: o.months, digits });
    const actual = amortize({ principal: loan, rate: o.rate, months: o.months, extra: o.extra, extraFrom: o.extraFrom, lump: o.lump, lumpAt: o.lumpAt, digits });
    const needsPmi = o.down < 0.2 * o.price && (o.pmiRate || 0) > 0;
    const pmi = needsPmi ? round(((o.pmiRate / 100) * loan) / 12) : 0;
    let pmiMonths = 0;
    if (needsPmi) {
      const limit = 0.78 * o.price;
      const hit = base.rows.find((row) => row.balance <= limit);
      pmiMonths = Math.min(hit ? hit.n : base.months, actual.months);
    }
    const tax = round((o.taxYear || 0) / 12);
    const ins = round((o.insYear || 0) / 12);
    const hoa = round(o.hoa || 0);
    const firstMonth = round(base.payment + tax + ins + pmi + hoa);
    return { loan, ltv: loan / o.price, base, actual, pmi, pmiMonths, pmiTotal: round(pmi * pmiMonths), tax, ins, hoa, firstMonth };
  }

  /* Add `k` months to a {year, month(1-12)} pair. */
  function addMonths(ym, k) {
    const idx = ym.year * 12 + (ym.month - 1) + k;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  }

  return { payment, paymentsNeeded, amortize, byYear, crossover, mortgage, addMonths };
});
