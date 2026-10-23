/* Unit conversion. Pure data and functions (window.UnitsLogic / require).
   Every factor is the EXACT definition where one exists (NIST SP 811, the 1959 international yard and pound
   agreement, US customary volume from 231 cubic inches per gallon, the imperial gallon of 4.54609 litres,
   IEC binary prefixes). `exact: false` marks the few conventional values that are defined only to a stated precision. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnitsLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const IN = 0.0254, FT = 0.3048, LB = 0.45359237, GAL = 3.785411784;
  const CATEGORIES = [
    { id: 'length', name: 'Length', base: 'metre', units: [
      { id: 'mm', name: 'Millimetres', f: 0.001 },
      { id: 'cm', name: 'Centimetres', f: 0.01 },
      { id: 'm', name: 'Metres', f: 1 },
      { id: 'km', name: 'Kilometres', f: 1000 },
      { id: 'in', name: 'Inches', f: IN },
      { id: 'ft', name: 'Feet', f: FT },
      { id: 'yd', name: 'Yards', f: 0.9144 },
      { id: 'mi', name: 'Miles', f: 1609.344 },
      { id: 'nmi', name: 'Nautical miles', f: 1852 },
    ] },
    { id: 'mass', name: 'Weight', base: 'kilogram', units: [
      { id: 'mg', name: 'Milligrams', f: 1e-6 },
      { id: 'g', name: 'Grams', f: 0.001 },
      { id: 'kg', name: 'Kilograms', f: 1 },
      { id: 't', name: 'Tonnes (metric)', f: 1000 },
      { id: 'oz', name: 'Ounces', f: LB / 16 },
      { id: 'lb', name: 'Pounds', f: LB },
      { id: 'st', name: 'Stone', f: LB * 14 },
      { id: 'ston', name: 'US tons (short)', f: LB * 2000 },
      { id: 'lton', name: 'UK tons (long)', f: LB * 2240 },
      { id: 'ozt', name: 'Troy ounces', f: 0.0311034768 },
      { id: 'ct', name: 'Carats', f: 0.0002 },
    ] },
    { id: 'volume', name: 'Volume', base: 'litre', units: [
      { id: 'ml', name: 'Millilitres', f: 0.001 },
      { id: 'l', name: 'Litres', f: 1 },
      { id: 'm3', name: 'Cubic metres', f: 1000 },
      { id: 'tsp', name: 'Teaspoons (US)', f: GAL / 768 },
      { id: 'tbsp', name: 'Tablespoons (US)', f: GAL / 256 },
      { id: 'floz', name: 'Fluid ounces (US)', f: GAL / 128 },
      { id: 'cup', name: 'Cups (US)', f: GAL / 16 },
      { id: 'pt', name: 'Pints (US)', f: GAL / 8 },
      { id: 'qt', name: 'Quarts (US)', f: GAL / 4 },
      { id: 'gal', name: 'Gallons (US)', f: GAL },
      { id: 'mcup', name: 'Cups (metric, 250 ml)', f: 0.25 },
      { id: 'ukfloz', name: 'Fluid ounces (UK)', f: 4.54609 / 160 },
      { id: 'ukpt', name: 'Pints (UK)', f: 4.54609 / 8 },
      { id: 'ukgal', name: 'Gallons (UK)', f: 4.54609 },
      { id: 'in3', name: 'Cubic inches', f: IN * IN * IN * 1000 },
      { id: 'ft3', name: 'Cubic feet', f: FT * FT * FT * 1000 },
    ] },
    { id: 'temperature', name: 'Temperature', base: 'degree Celsius', units: [
      { id: 'c', name: 'Celsius', toBase: (v) => v, fromBase: (v) => v, formula: '°C' },
      { id: 'f', name: 'Fahrenheit', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32, formula: '°F = °C × 9/5 + 32' },
      { id: 'k', name: 'Kelvin', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15, formula: 'K = °C + 273.15' },
    ] },
    { id: 'area', name: 'Area', base: 'square metre', units: [
      { id: 'cm2', name: 'Square centimetres', f: 1e-4 },
      { id: 'm2', name: 'Square metres', f: 1 },
      { id: 'ha', name: 'Hectares', f: 1e4 },
      { id: 'km2', name: 'Square kilometres', f: 1e6 },
      { id: 'in2', name: 'Square inches', f: IN * IN },
      { id: 'ft2', name: 'Square feet', f: FT * FT },
      { id: 'yd2', name: 'Square yards', f: 0.9144 * 0.9144 },
      { id: 'ac', name: 'Acres', f: 43560 * FT * FT },
      { id: 'mi2', name: 'Square miles', f: 1609.344 * 1609.344 },
    ] },
    { id: 'speed', name: 'Speed', base: 'metre per second', units: [
      { id: 'mps', name: 'Metres per second', f: 1 },
      { id: 'kmh', name: 'Kilometres per hour', f: 1000 / 3600 },
      { id: 'mph', name: 'Miles per hour', f: 1609.344 / 3600 },
      { id: 'kn', name: 'Knots', f: 1852 / 3600 },
      { id: 'fps', name: 'Feet per second', f: FT },
    ] },
    { id: 'data', name: 'Data', base: 'byte', units: [
      { id: 'bit', name: 'Bits', f: 1 / 8 },
      { id: 'B', name: 'Bytes', f: 1 },
      { id: 'kB', name: 'Kilobytes (1,000)', f: 1e3 },
      { id: 'MB', name: 'Megabytes (1,000²)', f: 1e6 },
      { id: 'GB', name: 'Gigabytes (1,000³)', f: 1e9 },
      { id: 'TB', name: 'Terabytes (1,000⁴)', f: 1e12 },
      { id: 'KiB', name: 'Kibibytes (1,024)', f: 1024 },
      { id: 'MiB', name: 'Mebibytes (1,024²)', f: 1048576 },
      { id: 'GiB', name: 'Gibibytes (1,024³)', f: 1073741824 },
      { id: 'TiB', name: 'Tebibytes (1,024⁴)', f: 1099511627776 },
      { id: 'Mbit', name: 'Megabits', f: 1e6 / 8 },
      { id: 'Gbit', name: 'Gigabits', f: 1e9 / 8 },
    ] },
    { id: 'pressure', name: 'Pressure', base: 'pascal', units: [
      { id: 'pa', name: 'Pascals', f: 1 },
      { id: 'kpa', name: 'Kilopascals', f: 1000 },
      { id: 'bar', name: 'Bar', f: 1e5 },
      { id: 'atm', name: 'Atmospheres', f: 101325 },
      { id: 'psi', name: 'Pounds per square inch', f: (LB * 9.80665) / (IN * IN) },
      { id: 'mmhg', name: 'Millimetres of mercury', f: 133.322387415, exact: false },
      { id: 'inhg', name: 'Inches of mercury', f: 3386.389, exact: false },
    ] },
    { id: 'energy', name: 'Energy', base: 'joule', units: [
      { id: 'j', name: 'Joules', f: 1 },
      { id: 'kj', name: 'Kilojoules', f: 1000 },
      { id: 'cal', name: 'Calories (small)', f: 4.184 },
      { id: 'kcal', name: 'Kilocalories (food Calories)', f: 4184 },
      { id: 'wh', name: 'Watt-hours', f: 3600 },
      { id: 'kwh', name: 'Kilowatt-hours', f: 3.6e6 },
      { id: 'btu', name: 'BTU (international)', f: 1055.05585262 },
    ] },
    { id: 'time', name: 'Time', base: 'second', units: [
      { id: 's', name: 'Seconds', f: 1 },
      { id: 'min', name: 'Minutes', f: 60 },
      { id: 'h', name: 'Hours', f: 3600 },
      { id: 'd', name: 'Days', f: 86400 },
      { id: 'wk', name: 'Weeks', f: 604800 },
      { id: 'yr', name: 'Years (365.25 days)', f: 31557600 },
    ] },
    { id: 'fuel', name: 'Fuel economy', base: 'kilometre per litre', units: [
      { id: 'kml', name: 'Kilometres per litre', toBase: (v) => v, fromBase: (v) => v, formula: 'km/L' },
      { id: 'l100', name: 'Litres per 100 km', toBase: (v) => 100 / v, fromBase: (v) => 100 / v, formula: 'L/100 km = 100 ÷ km/L' },
      { id: 'mpg', name: 'Miles per gallon (US)', toBase: (v) => (v * 1.609344) / GAL, fromBase: (v) => (v * GAL) / 1.609344, formula: 'km/L = mpg × 1.609344 ÷ 3.785411784' },
      { id: 'mpgu', name: 'Miles per gallon (UK)', toBase: (v) => (v * 1.609344) / 4.54609, fromBase: (v) => (v * 4.54609) / 1.609344, formula: 'km/L = mpg × 1.609344 ÷ 4.54609' },
    ] },
  ];

  const cat = (id) => CATEGORIES.find((c) => c.id === id);
  const unit = (c, id) => (typeof c === 'string' ? cat(c) : c).units.find((u) => u.id === id);

  function toBase(u, v) { return u.toBase ? u.toBase(v) : v * u.f; }
  function fromBase(u, v) { return u.fromBase ? u.fromBase(v) : v / u.f; }

  function convert(catId, fromId, toId, value) {
    const c = cat(catId);
    if (!c) throw new Error('Unknown category ' + catId);
    const a = unit(c, fromId), b = unit(c, toId);
    if (!a || !b) throw new Error('Unknown unit');
    if (a === b) return value;
    return fromBase(b, toBase(a, value));
  }

  /* Validity: temperatures below absolute zero, and fuel economy at or below zero, are impossible. */
  function check(catId, fromId, value) {
    if (!Number.isFinite(value)) return 'Enter a number.';
    if (catId === 'temperature' && toBase(unit(catId, fromId), value) < -273.15 - 1e-9) return 'That is colder than absolute zero (−273.15 °C).';
    if (catId === 'fuel' && value <= 0) return 'Fuel economy must be above zero.';
    return '';
  }

  /* Format with up to `sig` significant digits, trailing zeros removed; scientific notation only for extremes. */
  function format(v, sig = 10, locale) {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e15 || abs < 1e-9) return v.toExponential(Math.min(sig, 8) - 1).replace(/\.?0+e/, 'e').replace('e+', ' × 10^').replace('e-', ' × 10^−');
    const rounded = Number(v.toPrecision(sig));
    const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(rounded))));
    return new Intl.NumberFormat(locale || 'en-US', { maximumFractionDigits: Math.min(20, decimals) }).format(rounded);
  }

  return { CATEGORIES, cat, unit, convert, check, format, toBase, fromBase };
});
