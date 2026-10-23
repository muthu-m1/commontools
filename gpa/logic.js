/* Grades: GPA, cumulative GPA, the score needed on a final, and weighted course grades.
   Pure functions (window.GPALogic / require). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GPALogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* The common US 4.0 scale. Schools differ (some give A+ 4.3, some drop the minus grades): the page lets you pick. */
  const SCALES = {
    standard: { label: 'A+ counts 4.0', points: { 'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0 } },
    aplus: { label: 'A+ counts 4.3', points: { 'A+': 4.3, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0 } },
    plain: { label: 'Whole letters only', points: { A: 4, B: 3, C: 2, D: 1, F: 0 } },
  };
  const BOOST = { none: 0, honors: 0.5, ap: 1.0 };

  /* GPA = Σ(points × credits) ÷ Σ credits. Pass/fail and withdrawn courses (grade 'P', 'NP', 'W') carry no points
     and are left out. Weighting adds a boost to grades above F when `weighted` is true. */
  function gpa(courses, { scale = 'standard', weighted = false } = {}) {
    const pts = SCALES[scale].points;
    let q = 0, cr = 0, skipped = 0;
    for (const c of courses) {
      if (!(c.credits > 0) || !(c.grade in pts)) { if (c.credits > 0) skipped++; continue; }
      let p = pts[c.grade];
      if (weighted && p > 0) p += BOOST[c.level || 'none'] || 0;
      q += p * c.credits; cr += c.credits;
    }
    return { gpa: cr ? q / cr : null, credits: cr, qualityPoints: q, skipped };
  }

  function cumulative(prevGpa, prevCredits, term) {
    const q = (prevGpa || 0) * (prevCredits || 0) + term.qualityPoints;
    const cr = (prevCredits || 0) + term.credits;
    return cr ? q / cr : null;
  }

  /* Score needed on the final: target = current × (1 − w) + final × w  →  final = (target − current × (1 − w)) ÷ w. */
  function finalNeeded(current, weightPct, target) {
    const w = weightPct / 100;
    if (!(w > 0 && w <= 1)) return null;
    return (target - current * (1 - w)) / w;
  }
  /* Course grade for a given final score. */
  function withFinal(current, weightPct, final) { const w = weightPct / 100; return current * (1 - w) + final * w; }

  /* Weighted average of categories [{ weight, score }]. If the weights do not add up to 100 they are scaled to. */
  function weighted(items) {
    const valid = items.filter((i) => i.weight > 0 && Number.isFinite(i.score));
    const W = valid.reduce((a, i) => a + i.weight, 0);
    if (!W) return { grade: null, totalWeight: 0 };
    return { grade: valid.reduce((a, i) => a + i.weight * i.score, 0) / W, totalWeight: W };
  }

  /* Common US percentage-to-letter cut-offs (93/90/87/83/80/77/73/70/67/63/60). Schools vary. */
  function letter(pct) {
    const cuts = [[93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-']];
    for (const [c, l] of cuts) if (pct >= c) return l;
    return 'F';
  }

  return { SCALES, BOOST, gpa, cumulative, finalNeeded, withFinal, weighted, letter };
});
