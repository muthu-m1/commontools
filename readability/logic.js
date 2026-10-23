/* Readability statistics for English text. Pure functions (window.ReadLogic / require).
   Formulas are exact; syllables are counted with a rule-based estimate (about 90% agreement with dictionaries on
   ordinary prose), so scores are estimates, as with every automatic readability tool. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReadLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WORD = /[A-Za-zÀ-ɏ]+(?:['’-][A-Za-zÀ-ɏ]+)*/g;
  const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|a\.m|p\.m|U\.S|U\.K|No|Fig|approx|Inc|Ltd|Co)\.$/i;

  /* Rule-based English syllable count: count vowel groups after dropping a silent final -e, a silent -es and a
     silent -ed. A consonant + "le" ending (ta-ble) keeps its syllable; -es after s, x, z, ch, sh, ce or ge (box-es,
     pla-ces) and -ed after t or d (want-ed) are pronounced. A short list covers common words the rules miss. */
  const EXCEPTIONS = {
    area: 3, idea: 3, being: 2, going: 2, doing: 2, create: 2, created: 3, creates: 2, creating: 3, poem: 2, poems: 2, poet: 2, quiet: 2,
    science: 2, society: 4, piano: 3, video: 3, videos: 3, radio: 3, really: 3, usually: 4, naive: 2, cafe: 2, recipe: 3, coyote: 3,
    every: 2, everybody: 4, everyone: 3, everything: 3, everyday: 3, different: 3, business: 2, wednesday: 2, colonel: 2, choir: 1, aisle: 1, island: 2, media: 3, period: 3, serious: 3,
    experience: 4, experiences: 5, ideas: 3, areas: 3, medium: 3, museum: 3, theory: 3, lion: 2, diet: 2, react: 2, reality: 4,
  };
  function syllables(word) {
    let w = String(word).toLowerCase().replace(/[’']/g, '').replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (EXCEPTIONS[w]) return EXCEPTIONS[w];
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouyszxhcg]es|[^laeiouytd]ed|[^laeiouy]e)$/, (m) => m[0]);
    w = w.replace(/^y/, '').replace(/eau/g, 'o'); // beau-ty, bu-reau
    const groups = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  function words(text) { return (String(text).match(WORD) || []); }
  function wordSyllables(w) { return w.split(/[-]/).reduce((a, part) => a + syllables(part), 0); }

  /* Split into sentences: ., ! or ? (with closing quotes/brackets) followed by space and a capital, digit or quote,
     or the end of the text. Common abbreviations and decimal numbers do not end a sentence. Line breaks between
     paragraphs always end one. */
  function sentences(text) {
    const out = [];
    for (const para of String(text).split(/\n\s*\n|\r\n\s*\r\n/)) {
      const t = para.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      let start = 0;
      const re = /[.!?]+["'”’)\]]*(?=\s+["'“‘(\[]?[A-Z0-9]|\s*$)/g;
      let m;
      while ((m = re.exec(t))) {
        const end = m.index + m[0].length;
        const before = t.slice(start, end);
        if (m[0][0] === '.' && ABBR.test(before.replace(/["'”’)\]]+$/, ''))) continue;
        if (/\d\.$/.test(t.slice(0, m.index + 1)) && /^\d/.test(t.slice(end).trimStart()) ) continue;
        const s = before.trim();
        if (words(s).length) out.push(s);
        start = end;
      }
      const rest = t.slice(start).trim();
      if (words(rest).length) out.push(rest);
    }
    return out;
  }

  function fleschEase(W, S, Y) { return 206.835 - 1.015 * (W / S) - 84.6 * (Y / W); }
  function fleschKincaid(W, S, Y) { return 0.39 * (W / S) + 11.8 * (Y / W) - 15.59; }

  /* Flesch's own interpretation table (1948). */
  function easeBand(score) {
    if (score >= 90) return { label: 'Very easy', school: '5th grade' };
    if (score >= 80) return { label: 'Easy', school: '6th grade' };
    if (score >= 70) return { label: 'Fairly easy', school: '7th grade' };
    if (score >= 60) return { label: 'Plain English', school: '8th to 9th grade' };
    if (score >= 50) return { label: 'Fairly difficult', school: '10th to 12th grade' };
    if (score >= 30) return { label: 'Difficult', school: 'College' };
    return { label: 'Very difficult', school: 'College graduate' };
  }

  function analyze(text, { long = 25 } = {}) {
    const sents = sentences(text);
    const allWords = words(text);
    const W = allWords.length;
    const Y = allWords.reduce((a, w) => a + wordSyllables(w), 0);
    const S = Math.max(sents.length, W ? 1 : 0);
    const complex = allWords.filter((w) => wordSyllables(w) >= 3 && !/-/.test(w)).length;
    const perSentence = sents.map((s) => { const ws = words(s); return { text: s, words: ws.length, syllables: ws.reduce((a, w) => a + wordSyllables(w), 0) }; });
    const chars = String(text).length, charsNoSpace = String(text).replace(/\s/g, '').length;
    const paragraphs = String(text).split(/\n\s*\n/).filter((p) => p.trim()).length;
    return {
      words: W, sentences: S, syllables: Y, chars, charsNoSpace, paragraphs,
      ease: W ? fleschEase(W, S, Y) : null,
      grade: W ? fleschKincaid(W, S, Y) : null,
      avgSentence: S ? W / S : 0,
      avgSyllables: W ? Y / W : 0,
      complexShare: W ? complex / W : 0,
      longSentences: perSentence.filter((s) => s.words > long).length,
      perSentence,
      readingMinutes: W / 238,
    };
  }

  return { words, syllables, wordSyllables, sentences, fleschEase, fleschKincaid, easeBand, analyze };
});
