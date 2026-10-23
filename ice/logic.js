/* Emergency info card: text layout helpers. Pure functions (window.ICELogic / require).
   Drawing happens on a canvas in the page; these functions decide what goes where. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ICELogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BLOOD = ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

  /* Greedy word wrap with a measuring function (canvas measureText in the page). Long words are broken by character. */
  function wrap(text, maxWidth, measure) {
    const out = [];
    for (const para of String(text || '').split(/\r?\n/)) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (let w of words) {
        while (measure(w) > maxWidth && w.length > 1) {
          // break an over-long word
          let cut = w.length - 1;
          while (cut > 1 && measure(w.slice(0, cut)) > maxWidth) cut--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        const trial = line ? line + ' ' + w : w;
        if (measure(trial) <= maxWidth) line = trial;
        else { out.push(line); line = w; }
      }
      if (line) out.push(line);
    }
    return out;
  }

  /* Wrap and keep at most maxLines; the last kept line ends with an ellipsis when text was cut. */
  function fit(text, maxWidth, maxLines, measure) {
    const lines = wrap(text, maxWidth, measure);
    if (lines.length <= maxLines) return { lines, truncated: false };
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length && measure(last + '…') > maxWidth) last = last.slice(0, -1).trimEnd();
    kept[maxLines - 1] = last + '…';
    return { lines: kept, truncated: true };
  }

  /* Whole years between two {y, m, d} dates. */
  function age(dob, on) {
    let a = on.y - dob.y;
    if (on.m < dob.m || (on.m === dob.m && on.d < dob.d)) a--;
    return a;
  }

  /* Phone numbers keep digits, +, spaces, dashes, dots and brackets. */
  function cleanPhone(s) { return String(s || '').replace(/[^\d+\-().\s]/g, '').replace(/\s+/g, ' ').trim(); }

  /* The sections that have content, in the order a first responder needs them. */
  function sections(d) {
    const s = [];
    if (d.allergies) s.push({ id: 'allergies', label: 'Allergies', value: d.allergies, alert: true });
    if (d.conditions) s.push({ id: 'conditions', label: 'Medical conditions', value: d.conditions });
    if (d.medications) s.push({ id: 'medications', label: 'Medications', value: d.medications });
    if (d.notes) s.push({ id: 'notes', label: 'Other information', value: d.notes });
    return s;
  }
  function contacts(d) {
    return (d.contacts || []).filter((c) => c && (c.name || c.phone)).map((c) => ({ name: (c.name || '').trim(), relation: (c.relation || '').trim(), phone: cleanPhone(c.phone) }));
  }

  return { BLOOD, wrap, fit, age, cleanPhone, sections, contacts };
});
