/* WCAG 2.x contrast. Pure functions (window.ContrastLogic / require). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ContrastLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla() (comma or space syntax).
     Returns { r, g, b, a } with r,g,b in 0–255 and a in 0–1, or null. */
  function parse(input) {
    if (input == null) return null;
    const s = String(input).trim().toLowerCase();
    let m = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
      const n = (i) => parseInt(h.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
    }
    m = s.match(/^(rgba?|hsla?)\((.*)\)$/);
    if (!m) return null;
    const parts = m[2].replace(/\s*\/\s*/, ' / ').split(/[\s,]+/).filter((x) => x && x !== '/');
    if (parts.length < 3 || parts.length > 4) return null;
    const alpha = (t) => (t == null ? 1 : t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t));
    const a = clamp(alpha(parts[3]), 0, 1);
    if (m[1].startsWith('rgb')) {
      const ch = (t) => (t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t));
      const [r, g, b] = parts.slice(0, 3).map(ch);
      if ([r, g, b, a].some((v) => !Number.isFinite(v))) return null;
      return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a };
    }
    const h = parseFloat(parts[0].replace('deg', '')), sat = parseFloat(parts[1]), lig = parseFloat(parts[2]);
    if (![h, sat, lig, a].every(Number.isFinite)) return null;
    return { ...hslToRgb(h, sat, lig), a };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  /* Composite a (possibly translucent) colour over an opaque background. */
  function over(fg, bg) {
    const a = fg.a == null ? 1 : fg.a;
    return { r: Math.round(fg.r * a + bg.r * (1 - a)), g: Math.round(fg.g * a + bg.g * (1 - a)), b: Math.round(fg.b * a + bg.b * (1 - a)), a: 1 };
  }

  /* WCAG 2.x relative luminance of an sRGB colour. The 0.04045 threshold is the current WCAG 2.2 text; the older
     0.03928 gives identical results for 8-bit colours (no channel value falls between them). */
  function luminance({ r, g, b }) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function ratio(c1, c2) {
    const L1 = luminance(c1), L2 = luminance(c2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  /* Display value: truncated, never rounded up, so 4.499 shows as 4.49 and is never mistaken for a pass. */
  const show = (r) => (Math.floor(r * 100) / 100).toFixed(2);

  const LEVELS = [
    { id: 'aa', label: 'AA', what: 'Body text', min: 4.5, sc: '1.4.3' },
    { id: 'aa-large', label: 'AA', what: 'Large text', min: 3, sc: '1.4.3' },
    { id: 'aaa', label: 'AAA', what: 'Body text', min: 7, sc: '1.4.6' },
    { id: 'aaa-large', label: 'AAA', what: 'Large text', min: 4.5, sc: '1.4.6' },
    { id: 'ui', label: 'AA', what: 'Icons, borders and controls', min: 3, sc: '1.4.11' },
  ];
  function grade(r) { return LEVELS.map((L) => ({ ...L, pass: r >= L.min })); }

  /* Large text per WCAG: at least 18pt (24 CSS px), or 14pt (about 18.66 CSS px) when bold (700+). */
  function isLarge(px, weight) { return px >= 24 || (weight >= 700 && px >= 18.66); }

  /* Nearest colour to `fg` (same hue and saturation, lightness moved as little as possible) that reaches `target`
     against `bg`. Returns { color, hex, ratio, deltaL } or null when no lightness of that hue can reach it. */
  function fix(fg, bg, target) {
    if (ratio(fg, bg) >= target) return { color: fg, hex: hex(fg), ratio: ratio(fg, bg), deltaL: 0 };
    const { h, s, l } = rgbToHsl(fg);
    const tryDir = (dir) => {
      // walk in 0.1% lightness steps toward black or white; first passing step is the nearest in that direction
      for (let L = l; dir < 0 ? L >= 0 : L <= 100; L += dir * 0.1) {
        const c = hslToRgb(h, s, clamp(L, 0, 100));
        const r = ratio(c, bg);
        if (r >= target) return { color: c, hex: hex(c), ratio: r, deltaL: Math.abs(L - l) };
      }
      return null;
    };
    const a = tryDir(-1), b = tryDir(1);
    if (a && b) return a.deltaL <= b.deltaL ? a : b;
    return a || b;
  }

  return { parse, hex, over, luminance, ratio, show, grade, isLarge, fix, rgbToHsl, hslToRgb, LEVELS };
});
