// The arranger: takes a song's chart at concert pitch and the chords a learner knows,
// tries every capo position, and finds the friendliest way to play it.
// Pure, deterministic code — no AI needed — so it's fast, free and testable.
import { LIBRARY, OPEN_STRINGS } from './chords.js';

const SPELL = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };

// interval recipes for chord qualities
const QUALITY = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2], 9: [0, 4, 7, 10, 2],
  m9: [0, 3, 7, 10, 2], maj9: [0, 4, 7, 11, 2], dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], 5: [0, 7]
};
const ALIASES = { min: 'm', mi: 'm', '-': 'm', maj: '', M: '', M7: 'maj7', Maj7: 'maj7', min7: 'm7', 'ø': 'm7b5', '°': 'dim', sus: 'sus4', '+': 'aug' };
// what to fall back to when a fancy chord isn't something we have a shape for
const SIMPLER = { 7: '', m7: 'm', maj7: '', 6: '', m6: 'm', sus2: '', sus4: '', '7sus4': 'sus4', add9: '', madd9: 'm', 9: '7', m9: 'm7', maj9: 'maj7', dim: 'm', dim7: 'dim', m7b5: 'm', aug: '', 5: '' };
// friendlier shapes that sound close to a hard chord
const EASY_SWAP = { F: 'Fmaj7', Bm: 'Bm7', B: 'B7' };
const HARD_OPEN = new Set(['F', 'Bm', 'B', 'F#m', 'Gm', 'Bb', 'C#m']); // barre shapes inside the library

export function parseChord(name) {
  const m = /^\s*([A-G])([#b]?)([^/\s]*)(?:\/([A-G][#b]?))?\s*$/.exec(String(name || ''));
  if (!m) return null;
  const root = PC[m[1] + m[2]];
  let q = m[3];
  q = ALIASES[q] ?? q.replace(/^min/, 'm').replace(/^maj(?=7|9)/, 'maj').replace(/^M(?=7|9)/, 'maj');
  if (!(q in QUALITY)) {
    // unknown extension: keep minor-ness, drop the rest
    q = /^m(?!aj)/.test(q) ? 'm' : '';
  }
  return { root, quality: q, bass: m[4] ? PC[m[4]] : null };
}

export const spell = (root, quality = '') => SPELL[((root % 12) + 12) % 12] + quality;
export const chordTones = c => new Set((QUALITY[c.quality] || QUALITY['']).map(i => (c.root + i) % 12));
const shapeTones = (frets, capo) => new Set(frets.map((f, i) => (f < 0 ? null : (OPEN_STRINGS[i] + capo + f) % 12)).filter(x => x != null));

function libraryShape(name) {
  if (LIBRARY[name]) return LIBRARY[name];
  const alt = name.replace(/^([A-G])#/, (_, l) => SPELL[(PC[l] + 1) % 12]).replace(/^([A-G])b/, (_, l) => SPELL[(PC[l] + 11) % 12]);
  return LIBRARY[alt] || null;
}

// Movable barre shapes so every chord has *something* playable.
const E_FORM = { '': [[0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]], m: [[0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]], 7: [[0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]], m7: [[0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1]] };
const A_FORM = { '': [[-1, 0, 2, 2, 2, 0], [0, 1, 2, 3, 4, 1]], m: [[-1, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1]], 7: [[-1, 0, 2, 0, 2, 0], [0, 1, 3, 1, 4, 1]], m7: [[-1, 0, 2, 0, 1, 0], [0, 1, 3, 1, 2, 1]], maj7: [[-1, 0, 2, 1, 2, 0], [0, 1, 3, 2, 4, 1]], sus4: [[-1, 0, 2, 2, 3, 0], [0, 1, 2, 3, 4, 1]], sus2: [[-1, 0, 2, 2, 0, 0], [0, 1, 3, 4, 1, 1]] };
function barreShape(root, quality) {
  const opts = [];
  const e = (root - 4 + 12) % 12, a = (root - 9 + 12) % 12;
  if (E_FORM[quality] && e > 0) opts.push({ fret: e, t: E_FORM[quality] });
  if (A_FORM[quality] && a > 0) opts.push({ fret: a, t: A_FORM[quality] });
  if (!opts.length) return null;
  opts.sort((x, y) => x.fret - y.fret);
  const { fret, t } = opts[0];
  return {
    frets: t[0].map(v => (v < 0 ? -1 : v + fret)), fingers: t[1].slice(),
    tip: `A barre chord — your index lies flat across fret ${fret}. Take your time with this one.`
  };
}

/**
 * Every way we could play one concert-pitch chord with a given capo, with a "cost".
 * Lower cost = friendlier for this learner.
 */
function options(concert, capo, known) {
  const c = parseChord(concert);
  if (!c) return [];
  const root = (c.root - capo + 12) % 12;
  const out = [];
  const add = (name, kind, base, extra = {}) => {
    const lib = libraryShape(name);
    const libName = lib ? lib.name : name;
    if (known.has(libName)) out.push({ name: libName, kind, cost: base, base, known: true, shape: lib || extra.shape });
    else if (lib) out.push({ name: libName, kind, cost: base + (HARD_OPEN.has(libName) ? 6 : 3), base, known: false, shape: lib });
    else if (extra.shape) out.push({ name, kind, cost: base + 8, base, known: false, shape: extra.shape });
  };

  // 1. the real chord (keeping a slash-chord bass like G/B), then simpler versions of it
  if (c.bass != null) add(`${spell(root, c.quality)}/${SPELL[(c.bass - capo + 12) % 12]}`, 'exact', 0);
  let q = c.quality, step = 0;
  while (q != null && step < 4) {
    const name = spell(root, q);
    const exact = step === 0 && c.bass == null;
    add(name, exact ? 'exact' : 'simpler', exact ? 0 : step === 0 ? 0.5 : 1, { shape: barreShape(root, q) });
    q = q === '' ? null : SIMPLER[q];
    step++;
  }
  // 2. a friendlier sound-alike shape
  const triad = spell(root, c.quality === 'm' || c.quality === 'm7' ? 'm' : '');
  if (EASY_SWAP[triad]) add(EASY_SWAP[triad], 'swap', 1);

  // 3. a chord they already know that shares notes (a "stand-in")
  const tones = chordTones(c);
  for (const k of known) {
    const lib = LIBRARY[k];
    if (!lib || out.some(o => o.name === k)) continue;
    const t = shapeTones(lib.frets, capo);
    const shared = [...tones].filter(x => t.has(x)).length;
    const hasRoot = t.has(c.root);
    if (shared >= 2) out.push({ name: k, kind: 'standin', cost: hasRoot ? 4.5 : 5.5, known: true, shape: lib });
    else if (shared === 1) out.push({ name: k, kind: 'standin', cost: 9, known: true, shape: lib });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

const barCounts = chart => {
  const m = new Map();
  const secs = new Map(chart.sections.map(s => [s.id, s]));
  const order = chart.structure?.length ? chart.structure : chart.sections.map(s => s.id);
  for (const id of order) for (const b of secs.get(id)?.bars || []) for (const c of String(b).trim().split(/\s+/)) m.set(c, (m.get(c) || 0) + 1);
  return m;
};
const unique = chart => [...new Set(chart.sections.flatMap(s => s.bars.flatMap(b => String(b).trim().split(/\s+/))))].filter(Boolean);

/**
 * Find the best capo + shapes.
 * maxNew = how many new chords the learner is willing to learn (Infinity = whatever it takes).
 */
export function arrange(chart, knownList = [], { maxNew = Infinity, capos = [0, 1, 2, 3, 4, 5, 6, 7] } = {}) {
  const known = new Set(knownList);
  const concert = unique(chart);
  const barUse = barCounts(chart);
  let best = null;
  for (const capo of capos) {
    const per = concert.map(cn => ({ concert: cn, opts: options(cn, capo, known) }));
    if (per.some(p => !p.opts.length)) continue;
    // cheapest choice using only known chords vs. cheapest overall
    const choice = new Map();
    const candidates = [];
    for (const p of per) {
      const bestKnown = p.opts.find(o => o.known);
      const bestAny = p.opts[0];
      choice.set(p.concert, bestKnown || bestAny);
      if (!bestAny.known) candidates.push({ concert: p.concert, gain: (bestKnown ? bestKnown.cost : 99) - bestAny.cost, opt: bestAny });
    }
    // learn the chords that help most, up to maxNew distinct new shapes
    candidates.sort((a, b) => b.gain - a.gain);
    const learning = new Set([...choice.values()].filter(o => !o.known).map(o => o.name));
    for (const cnd of candidates) {
      if (cnd.gain <= 0) continue;
      const already = learning.has(cnd.opt.name);
      if (!already && learning.size >= maxNew) continue;
      learning.add(cnd.opt.name);
      choice.set(cnd.concert, cnd.opt);
    }
    // reuse: if a shape is already being played elsewhere in the song, a simpler/sound-alike
    // use of it costs nothing extra to learn (e.g. play A for A7 when you're learning A anyway)
    for (let pass = 0; pass < 2; pass++) {
      for (const p of per) {
        const cur = choice.get(p.concert);
        const others = new Set([...choice.entries()].filter(([k]) => k !== p.concert).map(([, o]) => o.name));
        const eff = o => (o.known || others.has(o.name) ? o.base ?? o.cost : o.cost);
        let bestOpt = cur;
        for (const o of p.opts) if (o.kind !== 'standin' && (o.known || others.has(o.name)) && eff(o) < eff(bestOpt) - 0.01) bestOpt = o;
        if (bestOpt !== cur) choice.set(p.concert, bestOpt);
      }
    }
    // HARD limit on new shapes: when chords with no known option force too many new shapes,
    // drop the least-used new shape and cover its chords with an allowed shape that shares notes.
    let limitMet = true;
    for (let guard = 0; guard < 12; guard++) {
      const newCount = new Map(); // weighted by how many bars use it, so the song's main chords are kept
      for (const [cn, o] of choice.entries()) if (!o.known) newCount.set(o.name, (newCount.get(o.name) || 0) + (barUse.get(cn) || 1));
      if (newCount.size <= maxNew) break;
      // try dropping each new shape; keep the drop whose stand-ins sound closest (most shared notes),
      // preferring shapes the song uses least
      let bestDrop = null;
      for (const [drop, uses] of newCount) {
        const allowed = new Map();
        for (const k of known) if (LIBRARY[k]) allowed.set(k, { shape: LIBRARY[k], known: true });
        for (const o of choice.values()) if (!o.known && o.name !== drop && o.shape) allowed.set(o.name, { shape: o.shape, known: false });
        const repl = new Map(); let quality = 0, ok = true;
        for (const p of per) {
          if (choice.get(p.concert).name !== drop) continue;
          const direct = p.opts.find(o => allowed.has(o.name) && o.kind !== 'standin');
          if (direct) { repl.set(p.concert, { ...direct, known: allowed.get(direct.name).known }); quality += 3; continue; }
          const pc = parseChord(p.concert);
          const tones = pc ? chordTones(pc) : new Set();
          let sub = null, shared = 0;
          for (const [name, v] of allowed) {
            const t = shapeTones(v.shape.frets, capo);
            const sc = [...tones].filter(x => t.has(x)).length + (pc && t.has(pc.root) ? 0.5 : 0);
            if (sc > shared) { shared = sc; sub = { name, kind: 'standin', cost: 6, base: 5, known: v.known, shape: v.shape }; }
          }
          if (sub && shared >= 2) { repl.set(p.concert, sub); quality += shared; } else ok = false;
        }
        if (!ok) continue;
        const score = quality - uses * 0.75;
        if (!bestDrop || score > bestDrop.score) bestDrop = { score, repl };
      }
      if (!bestDrop) { limitMet = false; break; }
      for (const [cn, o] of bestDrop.repl) choice.set(cn, o);
    }
    // any chord still forced to be new (nothing known fits) counts too
    const chosen = [...choice.values()];
    const newNames = [...new Set(chosen.filter(o => !o.known).map(o => o.name))];
    const names = new Set();
    let cost = capo * 0.35 - (chart.preferredCapo === capo ? 0.6 : 0); // checked songs: lean towards their known capo
    for (const o of chosen) { cost += names.has(o.name) || o.known ? (o.base ?? o.cost) : o.cost; names.add(o.name); }
    if (newNames.length > maxNew) cost += 100 * (newNames.length - maxNew);
    if (!best || cost < best.cost) best = { capo, cost, choice, newNames, limitMet: newNames.length <= maxNew && limitMet };
  }
  if (!best) return null;
  const map = Object.fromEntries([...best.choice.entries()].map(([cn, o]) => [cn, o]));
  const exact = Object.entries(map).filter(([cn, o]) => o.kind === 'exact');
  return {
    capo: best.capo,
    map,
    newChords: best.newNames,
    limitMet: best.limitMet,
    standIns: Object.entries(map).filter(([, o]) => o.kind === 'standin').map(([cn, o]) => ({ concert: cn, shape: spellShape(cn, best.capo), use: o.name })),
    simplified: Object.entries(map).filter(([, o]) => o.kind === 'simpler' || o.kind === 'swap').map(([cn, o]) => ({ shape: spellShape(cn, best.capo), use: o.name })),
    shapes: [...new Set(Object.values(map).map(o => o.name))],
    perfect: exact.length === Object.keys(map).length && best.newNames.length === 0
  };
}

const spellShape = (concert, capo) => {
  const c = parseChord(concert);
  if (!c) return concert;
  const name = spell((c.root - capo + 12) % 12, c.quality);
  return c.bass != null ? `${name}/${SPELL[(c.bass - capo + 12) % 12]}` : name;
};

/** The chords to show a learner first: the song in its most beginner-friendly capo. */
export function friendlyChords(chart) {
  const a = arrange(chart, [], { maxNew: Infinity });
  return a ? a.shapes : unique(chart);
}

/** Turn a chart + arrangement into the lesson format the rest of the app uses. */
export function toLesson(chart, arr, knownList = []) {
  const known = new Set(knownList);
  const keyC = parseChord(chart.key);
  const chords = arr.shapes.map(name => {
    const o = Object.values(arr.map).find(x => x.name === name);
    const sh = o.shape || libraryShape(name) || {};
    const forWhat = Object.entries(arr.map).filter(([, x]) => x.name === name && x.kind !== 'exact').map(([cn]) => spellShape(cn, arr.capo));
    return { name, frets: sh.frets?.slice() || null, fingers: sh.fingers?.slice() || [0, 0, 0, 0, 0, 0], tip: sh.tip || '', known: known.has(name), replaces: forWhat.length && !forWhat.includes(name) ? forWhat.join(', ') : undefined };
  });
  return {
    ...chart,
    concertKey: chart.key,
    key: keyC ? spell((keyC.root - arr.capo + 12) % 12, keyC.quality === 'm' ? 'm' : '') : chart.key,
    capo: arr.capo,
    chords,
    sections: chart.sections.map(s => ({ ...s, bars: s.bars.map(b => String(b).trim().split(/\s+/).slice(0, 2).map(cn => arr.map[cn]?.name || cn).join(' ')) })),
    arrangement: { standIns: arr.standIns, simplified: arr.simplified }
  };
}
