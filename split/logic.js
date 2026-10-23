/* Bill splitting. Pure functions (window.SplitLogic / require). Works in integer cents; shares always add up
   to the bill exactly (largest-remainder rounding). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SplitLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Split `total` (integer cents) in proportion to `weights`, so the parts are whole cents and sum to total exactly.
     Largest remainder method; ties go to the earlier person. */
  function allocate(weights, total) {
    const W = weights.reduce((a, w) => a + w, 0);
    if (!(W > 0)) return weights.map(() => 0);
    const exact = weights.map((w) => (total * w) / W);
    const base = exact.map((x) => Math.floor(x + 1e-9));
    let left = total - base.reduce((a, b) => a + b, 0);
    const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; left > 0 && k < order.length; k++, left--) base[order[k].i]++;
    return base;
  }

  /* The bill: subtotal (before tax), tax (amount or rate), tip (rate on pre-tax or post-tax amount, or a fixed amount).
     All inputs in currency units; result in cents. */
  function bill({ subtotal, taxAmount = null, taxRate = 0, tipRate = 0, tipAmount = null, tipOn = 'pretax', unit = 100 }) {
    const subC = Math.round(subtotal * unit);
    const taxC = taxAmount != null ? Math.round(taxAmount * unit) : Math.round(subC * taxRate / 100);
    const base = tipOn === 'posttax' ? subC + taxC : subC;
    const tipC = tipAmount != null ? Math.round(tipAmount * unit) : Math.round(base * tipRate / 100);
    return { subC, taxC, tipC, totalC: subC + taxC + tipC };
  }

  /* Even split of a bill among n people. roundUp: each share goes up to the next whole `roundTo` (in cents);
     the extra is added to the tip. */
  function even(b, n, { roundUp = false, roundTo = 100 } = {}) {
    let shares = allocate(Array(n).fill(1), b.totalC);
    let extraTip = 0;
    if (roundUp) {
      const each = Math.ceil(b.totalC / n / roundTo) * roundTo;
      shares = Array(n).fill(each);
      extraTip = each * n - b.totalC;
    }
    return { shares, extraTip, totalC: b.totalC + extraTip };
  }

  /* Itemized split. items: [{ price, people: [indexes] }] in currency units. Each item is shared equally by the people
     ticked on it; tax and tip are shared in proportion to each person's food subtotal (so a bigger order pays more
     tax and tip). Returns per-person cents that add up to the bill exactly. Unassigned items are reported. */
  function itemized(items, nPeople, { taxAmount = null, taxRate = 0, tipRate = 0, tipAmount = null, tipOn = 'pretax', unit = 100 } = {}) {
    const subs = Array(nPeople).fill(0);
    let assignedC = 0, unassignedC = 0;
    for (const it of items) {
      const priceC = Math.round(it.price * unit);
      const who = (it.people || []).filter((p) => p >= 0 && p < nPeople);
      if (!who.length) { unassignedC += priceC; continue; }
      assignedC += priceC;
      who.forEach((p) => { subs[p] += priceC / who.length; });
    }
    const fullC = assignedC + unassignedC;
    // a tax or tip AMOUNT from the receipt covers every item; only the assigned items' share of it is split
    const part = fullC ? assignedC / fullC : 0;
    const taxC = taxAmount != null ? Math.round(taxAmount * unit * part) : Math.round(assignedC * taxRate / 100);
    const tipBase = tipOn === 'posttax' ? assignedC + taxC : assignedC;
    const tipC = tipAmount != null ? Math.round(tipAmount * unit * part) : Math.round(tipBase * tipRate / 100);
    // each part is shared by food subtotal and rounded on its own, so every person's breakdown adds up
    const food = allocate(subs, assignedC);
    const tax = allocate(subs, taxC);
    const tip = allocate(subs, tipC);
    const totals = food.map((f, i) => f + tax[i] + tip[i]);
    return { bill: { subC: assignedC, taxC, tipC, totalC: assignedC + taxC + tipC }, subs, totals, food, tax, tip, unassignedC };
  }

  return { allocate, bill, even, itemized };
});
