/* Appliance energy use and cost. Pure functions (window.EnergyLogic / require).
   Method: US Department of Energy, "Estimating Appliance and Home Electronic Energy Use":
   (wattage × hours used per day × days used per year) ÷ 1000 = kWh per year; × price per kWh = cost per year. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnergyLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOURS_PER_YEAR = 8760; // 365 days × 24 h
  const DAYS_PER_YEAR = 365;

  /* Watts from a nameplate rating in amps. Exact for resistive loads (heaters, kettles); for motors and electronics the
     nameplate is a maximum, so this over-estimates. Optional power factor for when it is known. */
  function wattsFromAmps(amps, volts, powerFactor = 1) { return amps * volts * powerFactor; }

  /* One appliance. watts: power while on; hours: hours on per day it is used; days: days used per year;
     standby: watts drawn while plugged in but off (all remaining hours of the year); qty: how many.
     Returns kWh per year split into active and standby use. */
  function usage({ watts, hours, days = DAYS_PER_YEAR, standby = 0, qty = 1 }) {
    const onHours = hours * days;
    const active = (watts * onHours) / 1000;
    const idle = (standby * Math.max(0, HOURS_PER_YEAR - onHours)) / 1000;
    return { activeKwh: active * qty, standbyKwh: idle * qty, kwhPerYear: (active + idle) * qty, onHours };
  }

  /* Cost of a list of appliances at a flat price per kWh. Per-item results keep the input order. */
  function household(items, price) {
    const rows = items.map((it) => {
      const u = usage(it);
      return { ...it, ...u, costPerYear: u.kwhPerYear * price, standbyCost: u.standbyKwh * price };
    });
    const kwh = rows.reduce((s, r) => s + r.kwhPerYear, 0);
    const standbyKwh = rows.reduce((s, r) => s + r.standbyKwh, 0);
    return {
      rows,
      kwhPerYear: kwh,
      kwhPerMonth: kwh / 12,
      kwhPerDay: kwh / DAYS_PER_YEAR,
      costPerYear: kwh * price,
      costPerMonth: (kwh * price) / 12,
      costPerDay: (kwh * price) / DAYS_PER_YEAR,
      standbyKwh,
      standbyCost: standbyKwh * price,
    };
  }

  /* Swap one appliance for a more efficient one: yearly saving and simple payback (no discounting, flat price). */
  function compare({ oldWatts, newWatts, hours, days = DAYS_PER_YEAR, qty = 1, price, upfront = 0 }) {
    const a = usage({ watts: oldWatts, hours, days, qty }).kwhPerYear;
    const b = usage({ watts: newWatts, hours, days, qty }).kwhPerYear;
    const kwhSaved = a - b;
    const saving = kwhSaved * price;
    const paybackYears = saving > 0 ? upfront / saving : Infinity;
    return { oldKwh: a, newKwh: b, kwhSaved, saving, paybackYears, oldCost: a * price, newCost: b * price };
  }

  /* Typical power while running, in watts. Starting points only: the label or a plug-in meter is better.
     Refrigerators and freezers cycle, so they use hours of compressor running per day, not 24. */
  const PRESETS = [
    { id: 'led', name: 'LED bulb', watts: 9, hours: 5 },
    { id: 'incandescent', name: 'Incandescent bulb', watts: 60, hours: 5 },
    { id: 'fridge', name: 'Refrigerator', watts: 150, hours: 8 },
    { id: 'tv', name: 'TV', watts: 100, hours: 4, standby: 1 },
    { id: 'laptop', name: 'Laptop', watts: 50, hours: 6, standby: 1 },
    { id: 'desktop', name: 'Desktop computer', watts: 200, hours: 4, standby: 2 },
    { id: 'console', name: 'Games console', watts: 150, hours: 2, standby: 1 },
    { id: 'router', name: 'Wi-Fi router', watts: 10, hours: 24 },
    { id: 'kettle', name: 'Electric kettle', watts: 2000, hours: 0.2 },
    { id: 'microwave', name: 'Microwave', watts: 1100, hours: 0.25, standby: 2 },
    { id: 'washer', name: 'Washing machine', watts: 500, hours: 1, days: 156 },
    { id: 'dryer', name: 'Clothes dryer', watts: 3000, hours: 1, days: 156 },
    { id: 'dishwasher', name: 'Dishwasher', watts: 1200, hours: 1.5, days: 260 },
    { id: 'heater', name: 'Space heater', watts: 1500, hours: 4, days: 120 },
    { id: 'ac', name: 'Window air conditioner', watts: 900, hours: 6, days: 90 },
    { id: 'fan', name: 'Ceiling fan', watts: 60, hours: 8, days: 150 },
  ];

  return { HOURS_PER_YEAR, DAYS_PER_YEAR, wattsFromAmps, usage, household, compare, PRESETS };
});
