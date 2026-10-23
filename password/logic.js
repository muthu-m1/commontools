/* Password and passphrase generation with exact strength figures. Pure functions (window.PasswordLogic / require).
   Randomness comes from the Web Crypto API (crypto.getRandomValues), the operating system's secure generator. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PasswordLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
  };
  const LOOKALIKE = new Set('Il1O0o|`\'"'.split(''));

  /* Uniform integer in [0, n) with no modulo bias: draws below the largest multiple of n are accepted. */
  function randomInt(n, rng) {
    if (!(n >= 1 && n <= 2 ** 32)) throw new RangeError('n out of range');
    const buf = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / n) * n;
    for (;;) {
      (rng || defaultRng)(buf);
      if (buf[0] < limit) return buf[0] % n;
    }
  }
  function defaultRng(buf) {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (!c || !c.getRandomValues) throw new Error('Secure random numbers are not available in this browser.');
    c.getRandomValues(buf);
  }

  function charsets({ lower = true, upper = true, digits = true, symbols = true, avoidLookalikes = false } = {}) {
    const picked = [];
    for (const [k, on] of [['lower', lower], ['upper', upper], ['digits', digits], ['symbols', symbols]]) {
      if (!on) continue;
      let s = SETS[k];
      if (avoidLookalikes) s = s.split('').filter((ch) => !LOOKALIKE.has(ch)).join('');
      picked.push({ id: k, chars: s });
    }
    return picked;
  }

  /* Random password. With requireEach, whole passwords are redrawn until every chosen type appears, which keeps the
     result uniform over all valid passwords (so the strength figure below stays exact). */
  function password(opts = {}, rng) {
    const sets = charsets(opts);
    const length = opts.length || 20;
    if (!sets.length) throw new Error('Choose at least one type of character.');
    if (opts.requireEach && sets.length > length) throw new Error('The password is too short to include every type.');
    const all = sets.map((s) => s.chars).join('');
    for (;;) {
      let out = '';
      for (let i = 0; i < length; i++) out += all[randomInt(all.length, rng)];
      if (!opts.requireEach || sets.every((s) => [...out].some((ch) => s.chars.includes(ch)))) return out;
    }
  }

  /* Exact number of equally likely passwords: N^L, or, when every type is required, inclusion–exclusion
     Σ over subsets S of the types (−1)^|S| (N − Σ_{i∈S} n_i)^L. Returned as a BigInt. */
  function passwordSpace(opts = {}) {
    const sets = charsets(opts);
    const L = BigInt(opts.length || 20);
    const sizes = sets.map((s) => BigInt(s.chars.length));
    const N = sizes.reduce((a, b) => a + b, 0n);
    if (!opts.requireEach) return N ** L;
    let total = 0n;
    const k = sizes.length;
    for (let mask = 0; mask < 1 << k; mask++) {
      let without = N, bits = 0;
      for (let i = 0; i < k; i++) if (mask & (1 << i)) { without -= sizes[i]; bits++; }
      const term = without ** L;
      total += bits % 2 ? -term : term;
    }
    return total;
  }

  /* log2 of a positive BigInt, accurate to about 1e-12 bits. */
  function log2Big(n) {
    if (n <= 0n) return -Infinity;
    const bitsLen = n.toString(2).length;
    if (bitsLen <= 52) return Math.log2(Number(n));
    const shift = BigInt(bitsLen - 52);
    return Math.log2(Number(n >> shift)) + Number(shift);
  }

  function passphrase({ words = 6, separator = '-', capitalize = false, number = false } = {}, list, rng) {
    if (!list || !list.length) throw new Error('No word list.');
    const picked = [];
    for (let i = 0; i < words; i++) picked.push(list[randomInt(list.length, rng)]);
    let parts = capitalize ? picked.map((w) => w[0].toUpperCase() + w.slice(1)) : picked.slice();
    if (number) { const at = randomInt(words, rng); parts[at] = parts[at] + String(randomInt(10, rng)); }
    return parts.join(separator);
  }

  /* Bits: words × log2(list size); adding a digit to one word chosen at random multiplies the space by 10 × words. */
  function passphraseBits({ words = 6, number = false } = {}, listSize) {
    return words * Math.log2(listSize) + (number ? Math.log2(10 * words) : 0);
  }

  /* Average time to guess: half the space at `rate` guesses a second. Returns seconds (may be Infinity-free huge). */
  function crackSeconds(bits, rate) { return Math.pow(2, bits - 1) / rate; }

  function describeSeconds(s) {
    if (!(s >= 1)) return 'under a second';
    const units = [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    if (s >= 31557600 * 1e6) {
      const years = s / 31557600;
      const exp = Math.floor(Math.log10(years));
      const mant = years / Math.pow(10, exp);
      return `${mant.toFixed(1)} × 10^${exp} years`;
    }
    for (const [name, size] of units) {
      if (s >= size) {
        const v = s / size;
        const shown = v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
        return `${shown} ${name}${shown === 1 ? '' : 's'}`;
      }
    }
    return 'under a second';
  }

  function tier(bits) {
    if (bits < 40) return { id: 'weak', label: 'Weak' };
    if (bits < 60) return { id: 'fair', label: 'Fair' };
    if (bits < 80) return { id: 'strong', label: 'Strong' };
    return { id: 'very', label: 'Very strong' };
  }

  return { SETS, LOOKALIKE, randomInt, charsets, password, passwordSpace, log2Big, passphrase, passphraseBits, crackSeconds, describeSeconds, tier };
});
