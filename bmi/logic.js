/* Adult BMI and waist-to-height ratio. Pure functions (window.BMILogic / require).
   Categories: WHO / CDC adult cut-offs, and the lower cut-offs NICE recommends for people of South Asian, Chinese,
   other Asian, Middle Eastern, Black African or African-Caribbean family background. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BMILogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LB = 0.45359237, IN = 0.0254;

  function bmi(kg, m) { return kg / (m * m); }
  const kgFromLb = (lb) => lb * LB;
  const mFromFtIn = (ft, inch) => (ft * 12 + inch) * IN;
  const lbFromKg = (kg) => kg / LB;

  const STANDARD = [
    { id: 'under', label: 'Underweight', max: 18.5 },
    { id: 'healthy', label: 'Healthy weight', max: 25 },
    { id: 'over', label: 'Overweight', max: 30 },
    { id: 'ob1', label: 'Obesity, class 1', max: 35 },
    { id: 'ob2', label: 'Obesity, class 2', max: 40 },
    { id: 'ob3', label: 'Obesity, class 3', max: Infinity },
  ];
  const LOWER = [
    { id: 'under', label: 'Underweight', max: 18.5 },
    { id: 'healthy', label: 'Healthy weight', max: 23 },
    { id: 'over', label: 'Overweight', max: 27.5 },
    { id: 'ob', label: 'Obesity', max: Infinity },
  ];

  /* Category for a BMI value; each band runs from the previous band's max (inclusive) to its own max (exclusive). */
  function category(value, lower = false) {
    const bands = lower ? LOWER : STANDARD;
    let min = 0;
    for (const b of bands) { if (value < b.max) return { ...b, min }; min = b.max; }
    return null;
  }

  /* Weight range (kg) whose BMI falls in the healthy band for this height: from 18.5 up to just under 25 (or 23). */
  function healthyRange(m, lower = false) {
    const top = lower ? 23 : 25;
    return { min: 18.5 * m * m, max: top * m * m };
  }

  /* NICE (2022): waist-to-height ratio 0.4–0.49 healthy, 0.5–0.59 increased risk, 0.6+ high risk.
     Intended for adults with a BMI under 35. */
  function waistRatio(waist, height) {
    const r = waist / height;
    const level = r < 0.4 ? { id: 'low', label: 'Below 0.4' } : r < 0.5 ? { id: 'healthy', label: 'Healthy' } : r < 0.6 ? { id: 'increased', label: 'Increased health risk' } : { id: 'high', label: 'High health risk' };
    return { ratio: r, ...level };
  }

  return { bmi, kgFromLb, mFromFtIn, lbFromKg, category, healthyRange, waistRatio, STANDARD, LOWER };
});
