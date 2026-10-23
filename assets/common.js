/* Common Tools — shared helpers (window.CT). No dependencies; nothing here sends data anywhere. */
(function () {
  'use strict';

  /* short: the poster name used on the hub and in footers; line: what it gives, in a phrase */
  const TOOLS = [
    { id: 'loan', cat: 'Money', name: 'Loan & Mortgage', short: 'Loans', line: 'Monthly payment and total interest', blurb: 'Monthly payment, total interest and a full amortization schedule.' },
    { id: 'debt', cat: 'Money', name: 'Debt Payoff Planner', short: 'Debt', line: 'Avalanche or snowball, to debt-free', blurb: 'Avalanche against snowball, month by month, to debt-free.' },
    { id: 'savings', cat: 'Money', name: 'Savings Growth', short: 'Savings', line: 'Compound growth toward a goal', blurb: 'Compound interest with monthly deposits, and what it takes to reach a goal.' },
    { id: 'split', cat: 'Money', name: 'Bill Splitter', short: 'Bills', line: 'Tax, tip and shared dishes, to the cent', blurb: 'Tax, tip and shared dishes split fairly, to the cent.' },
    { id: 'energy', cat: 'Money', name: 'Appliance Energy Cost', short: 'Energy', line: 'What each appliance costs to run', blurb: 'What each appliance costs to run, standby power included, and replacement payback.' },
    { id: 'cpr', cat: 'Health & safety', name: 'CPR Coach', short: 'CPR', line: 'A 110-a-minute beat and the steps', blurb: 'A 110 per minute compression beat with hands-only CPR steps.' },
    { id: 'ice', cat: 'Health & safety', name: 'Emergency Info Card', short: 'Emergency', line: 'Medical details for your lock screen', blurb: 'A lock-screen image and wallet card with your medical details.' },
    { id: 'bmi', cat: 'Health & safety', name: 'BMI Calculator', short: 'BMI', line: 'WHO category and a healthy range', blurb: 'Body mass index, the WHO category and a healthy weight range.' },
    { id: 'duedate', cat: 'Health & safety', name: 'Due Date Calculator', short: 'Due date', line: 'Due date, week and trimester', blurb: 'Estimated due date, weeks pregnant and the trimester timeline.' },
    { id: 'units', cat: 'Everyday', name: 'Unit Converter', short: 'Units', line: 'Length, weight, temperature and more', blurb: 'Length, weight, volume, temperature, speed, data and more.' },
    { id: 'dates', cat: 'Everyday', name: 'Date Calculator', short: 'Dates', line: 'Days between, business days, exact age', blurb: 'Days between dates, business days, adding months, and exact age.' },
    { id: 'timezones', cat: 'Everyday', name: 'Meeting Planner', short: 'Time zones', line: 'Meeting hours that suit every city', blurb: 'Find the hours that work across time zones, daylight saving included.' },
    { id: 'qr', cat: 'Everyday', name: 'QR Code Maker', short: 'QR codes', line: 'Links, Wi-Fi and contacts as PNG or SVG', blurb: 'QR codes for links, Wi-Fi, contacts and text, saved as PNG or SVG.' },
    { id: 'password', cat: 'Privacy & security', name: 'Password Generator', short: 'Passwords', line: 'Passwords and passphrases, exact strength', blurb: 'Random passwords and passphrases with their exact strength.' },
    { id: 'photoclean', cat: 'Privacy & security', name: 'Photo Privacy Cleaner', short: 'Photos', line: 'Strip GPS location before you share', blurb: 'See and remove GPS location and camera data before you share a photo.' },
    { id: 'contrast', cat: 'Work & study', name: 'Contrast Checker', short: 'Contrast', line: 'WCAG ratio and fixes that pass', blurb: 'WCAG contrast ratio for text and interface colours, with passing fixes.' },
    { id: 'readability', cat: 'Work & study', name: 'Readability Checker', short: 'Readability', line: 'Grade level and the hardest sentences', blurb: 'Reading ease, grade level and the sentences that are hardest to read.' },
    { id: 'gpa', cat: 'Work & study', name: 'Grade Calculator', short: 'Grades', line: 'GPA and the score you need on the final', blurb: 'GPA, weighted course grades, and the score you need on the final.' },
  ];
  /* the five chapters, in order; key picks the chapter colour in app.css ([data-cat]) and names the hub's anchor */
  const CHAPTERS = [
    { key: 'money', cat: 'Money' },
    { key: 'health', cat: 'Health & safety' },
    { key: 'everyday', cat: 'Everyday' },
    { key: 'privacy', cat: 'Privacy & security' },
    { key: 'work', cat: 'Work & study' },
  ];
  const chapterKey = (cat) => (CHAPTERS.find((c) => c.cat === cat) || {}).key || '';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- numbers ---------- */
  const locale = () => document.documentElement.lang || 'en-US';
  function num(elOrValue) {
    const raw = typeof elOrValue === 'object' && elOrValue !== null ? elOrValue.value : elOrValue;
    if (raw === '' || raw === null || raw === undefined) return NaN;
    const v = Number(String(raw).replace(/,/g, '').trim());
    return Number.isFinite(v) ? v : NaN;
  }
  const digitsCache = {};
  function currencyDigits(code) {
    if (!(code in digitsCache)) {
      try { digitsCache[code] = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; }
      catch (e) { digitsCache[code] = 2; }
    }
    return digitsCache[code];
  }
  const MINUS = '−';
  const fmt = {
    money(v, cur, digits) {
      if (!Number.isFinite(v)) return '—';
      const d = digits == null ? currencyDigits(cur || 'USD') : digits;
      const s = new Intl.NumberFormat(locale(), { style: 'currency', currency: cur || 'USD', minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
      return (v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -d) ? MINUS : '') + s;
    },
    num(v, d) {
      if (!Number.isFinite(v)) return '—';
      const s = new Intl.NumberFormat(locale(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(Math.abs(v));
      return (v < 0 && s.replace(/[^1-9]/g, '') !== '' ? MINUS : '') + s;
    },
    /* up to `d` decimals, trailing zeros dropped */
    smart(v, d) {
      if (!Number.isFinite(v)) return '—';
      const s = new Intl.NumberFormat(locale(), { maximumFractionDigits: d == null ? 6 : d }).format(Math.abs(v));
      return (v < 0 && s.replace(/[^1-9]/g, '') !== '' ? MINUS : '') + s;
    },
    pct(v, d) { return Number.isFinite(v) ? fmt.num(v * 100, d == null ? 1 : d) + '%' : '—'; },
    months(n) {
      if (!Number.isFinite(n)) return '—';
      const y = Math.floor(n / 12), m = n % 12;
      const parts = [];
      if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
      if (m || !y) parts.push(m + (m === 1 ? ' month' : ' months'));
      return parts.join(' ');
    },
    date(d, opts) { return d ? new Intl.DateTimeFormat(locale(), opts || { year: 'numeric', month: 'short', day: 'numeric' }).format(d) : '—'; },
    monthYear(d) { return d ? new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short' }).format(d) : '—'; },
  };

  /* ---------- storage (never required; wrapped so private windows still work) ---------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('ct:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('ct:' + key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    remove(key) { try { localStorage.removeItem('ct:' + key); } catch (e) { /* ignore */ } },
  };

  /* Remember a form's field values between visits (opt-in per tool). */
  function persist(form, key) {
    const fields = $$('input, select, textarea', form).filter((el) => el.id && el.type !== 'file' && !el.hasAttribute('data-no-persist'));
    const saved = store.get('form:' + key, null);
    if (saved) {
      fields.forEach((el) => {
        if (!(el.id in saved)) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved[el.id];
        else el.value = saved[el.id];
      });
    }
    const save = () => {
      const out = {};
      fields.forEach((el) => { out[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value; });
      store.set('form:' + key, out);
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    return { clear() { store.remove('form:' + key); } };
  }

  /* ---------- feedback ---------- */
  let toastTimer = null;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      toast(ok ? 'Copied' : 'Select the text and copy it manually');
      return ok;
    }
  }

  /* Save a generated file. Inside a Claude artifact viewer this uses its downloads capability;
     everywhere else (a normal browser, a static host, a file opened from disk) it uses a download link. */
  async function save(filename, data, mime) {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const dl = await window.claude.use('downloads');
        if (dl) {
          await dl.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' }) });
          toast('Saved ' + filename);
          return true;
        }
      }
    } catch (e) {
      if (e && e.code === 'declined') return false;
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  function csv(rows) {
    return rows.map((r) => r.map((c) => {
      const s = c == null ? '' : String(c);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n') + '\r\n';
  }

  function debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* Mark a field invalid with a message under it; pass '' to clear. */
  function invalid(el, msg) {
    const field = el.closest('.field');
    let err = field && field.querySelector('.err');
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      if (field && !err) { err = document.createElement('div'); err.className = 'err'; err.id = el.id + '-err'; field.appendChild(err); }
      if (err) { err.textContent = msg; el.setAttribute('aria-describedby', err.id); }
    } else {
      el.removeAttribute('aria-invalid');
      if (err) err.remove();
    }
    return !msg;
  }

  /* ---------- icons (1.5px outline, 16px) ---------- */
  const P = {
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>',
    download: '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2V11M8 5v.01"/>',
    alert: '<path d="M8 2.5 14 13H2L8 2.5z"/><path d="M8 6.5v3M8 11.2v.01"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/>',
    grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    check: '<path d="M3 8.5l3 3 7-7"/>',
    swap: '<path d="M4 5.5h9M10.5 3l2.5 2.5L10.5 8M12 10.5H3M5.5 8 3 10.5 5.5 13"/>',
    play: '<path d="M5 3.5v9l7-4.5-7-4.5z"/>',
    stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
    upload: '<path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }

  /* ---------- tool illustrations: line art in a 220 x 160 box, drawn in currentColor ----------
     Classes (styled in app.css): f = soft fill, s = solid fill, o = faint, d = draws itself in,
     grow = bar rises, tw = twinkles, beat = pulses, ecg = travelling trace, spin = turning meridian. */
  const dots40 = () => { let s = ''; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2 - Math.PI / 2; s += `<circle class="s${i < 16 ? '' : ' o'}" cx="${(110 + 58 * Math.cos(a)).toFixed(1)}" cy="${(80 + 58 * Math.sin(a)).toFixed(1)}" r="2.6"/>`; } return s; };
  const calGrid = () => { let s = ''; for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) { const k = r * 7 + c, on = k >= 9 && k <= 19, wk = c >= 5; s += `<rect class="${on && !wk ? 's' : on ? 'f' : 'o'}" x="${52 + c * 17.5}" y="${60 + r * 19}" width="12" height="12" rx="3"/>`; } return s; };
  const qrMods = () => {
    let s = '';
    const n = 21, u = 5.4, x0 = 53, y0 = 23;
    const finder = (cx, cy) => `<rect x="${x0 + cx * u}" y="${y0 + cy * u}" width="${7 * u}" height="${7 * u}" rx="3"/><rect class="s" x="${x0 + (cx + 2) * u}" y="${y0 + (cy + 2) * u}" width="${3 * u}" height="${3 * u}" rx="1.5"/>`;
    s += finder(0, 0) + finder(14, 0) + finder(0, 14);
    let seed = 7;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      seed = (seed * 9301 + 49297) % 233280;
      if (seed / 233280 > 0.52) s += `<rect class="s${(r + c) % 5 === 0 ? ' tw' : ''}" style="--i:${(r * 7 + c) % 6}" x="${(x0 + c * u + 0.6).toFixed(1)}" y="${(y0 + r * u + 0.6).toFixed(1)}" width="${(u - 1.2).toFixed(1)}" height="${(u - 1.2).toFixed(1)}" rx="1"/>`;
    }
    return s;
  };
  const ART = {
    loan: '<path class="o" d="M14 140H206"/><rect class="f grow" style="--i:0" x="22" y="118" width="12" height="22" rx="2"/><rect class="f grow" style="--i:1" x="40" y="106" width="12" height="34" rx="2"/><rect class="f grow" style="--i:2" x="58" y="94" width="12" height="46" rx="2"/><rect class="f grow" style="--i:3" x="76" y="80" width="12" height="60" rx="2"/><rect class="s grow" style="--i:4" x="94" y="62" width="12" height="78" rx="2"/><path class="d" pathLength="1" d="M122 82L164 48L206 82"/><path class="d" pathLength="1" d="M130 76V140H198V76"/><rect class="f" x="155" y="106" width="18" height="34" rx="2"/><rect x="138" y="90" width="12" height="11" rx="2"/><rect x="179" y="90" width="12" height="11" rx="2"/><path class="o" d="M184 58V42h8v22"/>',
    debt: '<path class="o" d="M14 140H206"/><rect class="f grow" style="--i:0" x="22" y="40" width="22" height="100" rx="3"/><rect class="f grow" style="--i:1" x="52" y="60" width="22" height="80" rx="3"/><rect class="f grow" style="--i:2" x="82" y="80" width="22" height="60" rx="3"/><rect class="f grow" style="--i:3" x="112" y="100" width="22" height="40" rx="3"/><rect class="f grow" style="--i:4" x="142" y="120" width="22" height="20" rx="3"/><path class="d" pathLength="1" d="M33 28L63 48L93 68L123 88L153 108L176 124"/><path d="M188 140V62"/><path class="s" d="M188 62L212 72L188 82Z"/>',
    savings: '<path class="o" d="M14 140H206"/><ellipse class="f" cx="46" cy="132" rx="24" ry="7"/><ellipse class="f" cx="46" cy="120" rx="24" ry="7"/><ellipse class="f" cx="46" cy="108" rx="24" ry="7"/><path d="M22 108v24M70 108v24"/><path class="d" pathLength="1" d="M84 128C132 124 162 98 194 36"/><path d="M182 40L195 33L200 47"/><circle class="s tw" style="--i:0" cx="120" cy="121" r="3.5"/><circle class="s tw" style="--i:1" cx="150" cy="106" r="3.5"/><circle class="s tw" style="--i:2" cx="174" cy="80" r="3.5"/>',
    split: '<path class="f d" pathLength="1" d="M30 20H118V134L107 126L96 134L85 126L74 134L63 126L52 134L41 126L30 134Z"/><path class="o" d="M44 42H104M44 58H92M44 74H98"/><path d="M44 102H104"/><path class="d" pathLength="1" d="M124 78C146 78 150 42 170 42M124 78H170M124 78C146 78 150 114 170 114"/><circle class="f" cx="188" cy="42" r="15"/><circle class="f" cx="188" cy="78" r="15"/><circle class="f" cx="188" cy="114" r="15"/>',
    energy: '<path class="o" d="M30 126A80 80 0 0 1 190 126"/><path class="o" d="M44 92l10 6M70 62l7 9M110 48v11M150 62l-7 9M176 92l-10 6"/><path class="f d" pathLength="1" d="M124 40L86 104H110L96 146L140 78H115L128 40Z"/>',
    cpr: '<path class="f beat" d="M110 92C110 92 76 70 76 48C76 35 85 27 95 27C102 27 107 31 110 36C113 31 118 27 125 27C135 27 144 35 144 48C144 70 110 92 110 92Z"/><path class="o" d="M10 124H64L74 106L86 142L98 94L110 134L118 124H210"/><path class="ecg" pathLength="1" d="M10 124H64L74 106L86 142L98 94L110 134L118 124H210"/>',
    ice: '<rect class="d" pathLength="1" x="72" y="10" width="76" height="140" rx="14"/><path class="o" d="M100 20H120"/><path class="f beat" d="M100 44H120V60H136V80H120V96H100V80H84V60H100Z"/><path class="o" d="M88 114H132M94 126H126"/><path class="o" d="M26 62h20M36 52v20M174 98h20M184 88v20"/>',
    bmi: '<path class="o" d="M36 128A74 74 0 0 1 51.7 82.4"/><path class="thick" d="M55 78.5A74 74 0 0 1 97.2 55.1"/><path class="o" d="M102.3 54.4A74 74 0 0 1 149.2 65.2"/><path class="o" d="M153.5 68.1A74 74 0 0 1 184 128"/><path class="d needle" pathLength="1" d="M110 128L86 78"/><circle class="s" cx="110" cy="128" r="7"/><path class="o" d="M20 144H200"/>',
    duedate: () => dots40() + '<path class="d" pathLength="1" d="M110 22A58 58 0 0 1 164 101"/><path class="f beat" d="M110 98C110 98 92 86 92 74C92 67 97 62 103 62C106 62 109 64 110 67C111 64 114 62 117 62C123 62 128 67 128 74C128 86 110 98 110 98Z"/>',
    units: '<g transform="rotate(-16 80 112)"><rect class="f" x="18" y="98" width="124" height="28" rx="4"/><path class="o" d="M30 98v12M42 98v7M54 98v12M66 98v7M78 98v12M90 98v7M102 98v12M114 98v7M126 98v12"/></g><path class="f" d="M146 106H198L204 124C206 132 202 138 194 138H150C142 138 138 132 140 124Z"/><path class="d" pathLength="1" d="M152 28H194M160 28V70L140 124C138 132 142 138 150 138H194C202 138 206 132 204 124L184 70V28"/><circle class="s tw" style="--i:0" cx="164" cy="120" r="3"/><circle class="s tw" style="--i:2" cx="180" cy="114" r="2.5"/><circle class="s tw" style="--i:1" cx="172" cy="96" r="2"/>',
    dates: () => '<rect class="d" pathLength="1" x="40" y="24" width="140" height="122" rx="12"/><path d="M40 50H180"/><path class="thick" d="M72 14V32M148 14V32"/>' + calGrid(),
    timezones: '<circle class="d" pathLength="1" cx="94" cy="78" r="58"/><ellipse class="o spin" cx="94" cy="78" rx="26" ry="58"/><path class="o" d="M36 78H152M44 50H144M44 106H144M94 20V136"/><circle class="f" cx="172" cy="118" r="28"/><path class="clock" d="M172 102V118L184 125"/>',
    qr: () => qrMods(),
    password: '<path class="d" pathLength="1" d="M82 74V56C82 40 94 28 110 28C126 28 138 40 138 56V74"/><rect class="f" x="70" y="74" width="80" height="66" rx="12"/><circle class="s" cx="110" cy="100" r="7"/><path d="M110 106V122"/><circle class="s tw" style="--i:0" cx="24" cy="108" r="5"/><circle class="s tw" style="--i:1" cx="44" cy="108" r="5"/><circle class="s tw" style="--i:2" cx="176" cy="108" r="5"/><circle class="s tw" style="--i:3" cx="196" cy="108" r="5"/>',
    photoclean: '<rect class="d" pathLength="1" x="22" y="30" width="122" height="98" rx="10"/><path class="f" d="M22 112L62 74L88 98L106 82L144 116V118C144 124 140 128 134 128H32C26 128 22 124 22 118Z"/><circle cx="112" cy="56" r="9"/><path class="f" d="M174 38C188 38 198 48 198 62C198 80 174 102 174 102C174 102 150 80 150 62C150 48 160 38 174 38Z"/><circle cx="174" cy="61" r="7"/><path class="thick d" pathLength="1" d="M148 30L204 108"/>',
    contrast: '<circle class="s" cx="84" cy="80" r="52"/><circle class="d" pathLength="1" cx="136" cy="80" r="52"/><text class="cut" x="60" y="95" font-size="42" font-weight="700">Aa</text><text class="txt" x="116" y="95" font-size="42" font-weight="700">Aa</text>',
    readability: '<rect class="f" x="24" y="20" width="124" height="120" rx="10"/><path class="o" d="M40 42H130M40 56H122M40 104H126M40 118H102"/><rect class="s o" x="36" y="68" width="100" height="22" rx="5"/><circle class="d" pathLength="1" cx="166" cy="96" r="24"/><path class="thick" d="M183 113L202 132"/>',
    gpa: '<path class="f d" pathLength="1" d="M110 30L192 62L110 94L28 62Z"/><path d="M64 78V106C64 116 86 124 110 124C134 124 156 116 156 106V78"/><path d="M182 66V104"/><circle class="s beat" cx="182" cy="108" r="5"/>',
  };
  function art(id, extraClass) {
    const a = ART[id];
    if (!a) return '';
    return `<svg class="art ${extraClass || ''}" viewBox="0 0 220 160" aria-hidden="true" focusable="false">${typeof a === 'function' ? a() : a}</svg>`;
  }

  /* Colour band: the tool's illustration goes beside its title; the crumb leads back to its chapter on the hub;
     the footer becomes the chapter's closing field with the chapter's other tools. */
  function decorate() {
    const id = document.body.getAttribute('data-tool');
    const tool = TOOLS.find((t) => t.id === id);
    if (!tool) return;
    const key = chapterKey(tool.cat);
    const root = document.body.getAttribute('data-root') || '../';
    const crumb = $('.crumb');
    if (crumb && crumb.tagName !== 'A') {
      const a = document.createElement('a');
      a.className = 'crumb';
      a.href = root + 'index.html#' + key;
      a.textContent = crumb.textContent;
      crumb.replaceWith(a);
    }
    const foot = $('.foot-in');
    if (foot && !$('.foot-more', foot)) {
      const others = TOOLS.filter((t) => t.cat === tool.cat && t.id !== id);
      const more = document.createElement('nav');
      more.className = 'foot-more';
      more.setAttribute('aria-labelledby', 'foot-more-h');
      more.innerHTML = '<h2 id="foot-more-h">More in ' + esc(tool.cat) + '</h2><ul>' +
        others.map((t) => '<li><a href="' + root + t.id + '/index.html">' + esc(t.short) + '</a></li>').join('') +
        '</ul><a class="all" href="' + root + 'index.html">All ' + TOOLS.length + ' tools</a>';
      foot.prepend(more);
    }
    const row = $('.title-row');
    if (!row || !ART[id] || row.querySelector('.band-art')) return;
    const box = document.createElement('div');
    box.className = 'band-art';
    box.innerHTML = art(id);
    row.appendChild(box);
    document.body.classList.add('has-band');
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('play')));
    // timers still fire when frames are throttled, so the entrance always ends in its final state
    setTimeout(() => box.classList.add('done'), 2600);
  }

  /* ---------- shell: sticky bar rule + tools menu ---------- */
  function shell() {
    const bar = $('.topbar');
    if (bar) {
      const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 4);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    const btn = $('[data-menu]');
    if (!btn) return;
    const here = document.body.getAttribute('data-tool');
    const root = document.body.getAttribute('data-root') || '../';
    const sheet = document.createElement('nav');
    sheet.className = 'menu-sheet';
    sheet.id = 'tools-menu';
    sheet.hidden = true;
    sheet.setAttribute('aria-label', 'All tools');
    const cats = [];
    TOOLS.forEach((t) => { if (!cats.includes(t.cat)) cats.push(t.cat); });
    sheet.innerHTML = cats.map((c) => '<div class="menu-group" data-cat="' + chapterKey(c) + '"><h2>' + esc(c) + '</h2><div class="menu-grid">' +
      TOOLS.filter((t) => t.cat === c).map((t) => '<a href="' + root + t.id + '/index.html"' + (t.id === here ? ' aria-current="page"' : '') + '><b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span></a>').join('') +
      '</div></div>').join('');
    document.body.appendChild(sheet);
    btn.setAttribute('aria-controls', 'tools-menu');
    const close = () => { sheet.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = sheet.hidden;
      sheet.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) { const first = $('a', sheet); if (first) first.focus(); }
    });
    document.addEventListener('click', (e) => { if (!sheet.hidden && !sheet.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { close(); btn.focus(); } });
  }

  /* ---------- offline: sw.js saves every tool once the site is opened over https (or on localhost) ---------- */
  function offline() {
    if (!('serviceWorker' in navigator)) return;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (location.protocol !== 'https:' && !local) return;
    const root = document.body.getAttribute('data-root') || '../';
    const register = () => navigator.serviceWorker.register(root + 'sw.js').catch(() => {});
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
  }

  window.CT = { TOOLS, CHAPTERS, chapterKey, $, $$, num, fmt, currencyDigits, store, persist, toast, copy, save, csv, debounce, esc, invalid, icon, shell, art, ART };
  const boot = () => { decorate(); shell(); offline(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
