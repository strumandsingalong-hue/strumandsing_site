// Chord library, music helpers and chord-diagram rendering.
// Frets: low E (6th) → high e (1st). -1 muted, 0 open. Same convention as ChordLibrary.swift.

const C = (name, frets, fingers, hint) => ({ name, frets, fingers, tip: hint });

export const LIBRARY = Object.fromEntries([
  C('Em', [0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0], 'Middle and ring on the A and D strings at fret 2. Strum all six.'),
  C('Em7', [0, 2, 2, 0, 3, 0], [0, 1, 2, 0, 3, 0], 'An Em with your ring finger added on the B string, fret 3.'),
  C('E', [0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0], 'Like Em, plus your index on the G string at fret 1.'),
  C('E7', [0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0], 'Just two fingers — leave the D string open.'),
  C('Esus4', [0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0], 'Three fingers in a row at fret 2.'),
  C('G', [3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 0, 4], 'Middle on A (fret 2), ring and pinky on the outer strings at fret 3.'),
  C('G7', [3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1], 'A G shape with your index on the high e at fret 1.'),
  C('G/B', [-1, 2, 0, 0, 0, 3], [0, 1, 0, 0, 0, 3], 'Skip the low E. A lovely walking-bass chord.'),
  C('C', [-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0], 'Mute the low E — strum from the A string down.'),
  C('Cadd9', [-1, 3, 2, 0, 3, 0], [0, 2, 1, 0, 3, 0], 'Feels like a stretched G — swaps beautifully with G.'),
  C('Cmaj7', [-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0], 'A C chord with your index lifted off. Dreamy.'),
  C('C7', [-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0], 'A C shape plus your pinky on the G string, fret 3.'),
  C('D', [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2], 'A little triangle on the top three strings. Strum four strings only.'),
  C('Dm', [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1], 'Index on the high e at fret 1. Strum only the top four strings.'),
  C('D7', [-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3], 'A flipped little triangle. Top four strings only.'),
  C('Dsus2', [-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0], 'A D chord with the high e left open.'),
  C('Dsus4', [-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 2, 3], 'Add your pinky to D on the high e, fret 3.'),
  C('Dm7', [-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1], 'Index flattens across the top two strings at fret 1.'),
  C('A', [-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0], 'Three fingers squeeze in at fret 2. Skip the low E.'),
  C('Am', [-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0], 'Same shape as E, moved over one string. Skip the low E.'),
  C('A7', [-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0], 'Two fingers at fret 2 with the G string open.'),
  C('Am7', [-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0], 'An Am with your ring finger lifted.'),
  C('Asus2', [-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0], 'Two fingers at fret 2, B string open.'),
  C('Asus4', [-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0], 'An A with the B string pushed up to fret 3.'),
  C('B7', [-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4], 'Four fingers, B string ringing open. Skip low E.'),
  C('Bm', [-1, 2, 4, 4, 3, 2], [0, 1, 3, 4, 2, 1], 'Index barres the top five strings at fret 2.'),
  C('Bm7', [-1, 2, 0, 2, 0, 2], [0, 1, 0, 2, 0, 3], 'A friendly no-barre swap for Bm.'),
  C('B', [-1, 2, 4, 4, 4, 2], [0, 1, 2, 3, 4, 1], 'Index barre at fret 2, three fingers lined up at fret 4.'),
  C('F', [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], 'Full barre at fret 1. Roll your index slightly onto its bony side.'),
  C('Fmaj7', [-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0], 'The easy F — no barre, high e open.'),
  C('F#m', [2, 4, 4, 2, 2, 2], [1, 3, 4, 1, 1, 1], 'An Em shape barred at fret 2.'),
  C('Gm', [3, 5, 5, 3, 3, 3], [1, 3, 4, 1, 1, 1], 'An Em shape barred at fret 3.'),
  C('Bb', [-1, 1, 3, 3, 3, 1], [0, 1, 2, 3, 4, 1], 'An A shape barred at fret 1.'),
  C('C#m', [-1, 4, 6, 6, 5, 4], [0, 1, 3, 4, 2, 1], 'An Am shape barred at fret 4.')
].map(c => [c.name, c]));

/** The chips shown when Rai asks "which chords do you know?" */
export const STARTER_CHORDS = ['Em', 'G', 'C', 'D', 'Am', 'A', 'E', 'Dm', 'Em7', 'Cadd9', 'Dsus2', 'Asus2', 'Fmaj7', 'A7', 'D7', 'E7', 'G7', 'B7', 'Bm', 'F'];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export const noteName = midi => NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);

export function pitchClassOf(name) {
  const m = /^([A-G])([#b]?)/.exec(name || '');
  if (!m) return null;
  let n = m[1] + m[2];
  if (FLATS[n]) n = FLATS[n];
  return NOTE_NAMES.indexOf(n);
}

export function parseNote(s) { // "D4" → midi
  const m = /^([A-G][#b]?)(-?\d)$/.exec((s || '').trim());
  if (!m) return null;
  const pc = pitchClassOf(m[1]);
  return pc == null ? null : pc + (Number(m[2]) + 1) * 12;
}

export function transposeName(name, semis) {
  const pc = pitchClassOf(name);
  if (pc == null) return name;
  const rest = name.replace(/^[A-G][#b]?/, '');
  return NOTE_NAMES[(pc + semis + 120) % 12] + rest;
}

/** Concert-pitch MIDI notes a shape actually sounds, with a capo. */
export function chordMidi(chord, capo = 0) {
  if (!chord?.frets) return [];
  return chord.frets.map((f, i) => (f < 0 ? null : OPEN_STRINGS[i] + capo + f));
}

export function scalePitchClasses(key, capo = 0) {
  const tonic = pitchClassOf(key);
  if (tonic == null) return [];
  const minor = /m(?!aj)/.test(key.replace(/^[A-G][#b]?/, ''));
  const steps = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return steps.map(s => (tonic + capo + s) % 12);
}

/** Normalise names the AI might send ("Gmaj" → "G", "Amin" → "Am"). */
export function cleanName(n) {
  return String(n || '').trim()
    .replace(/maj(?!7|9)/i, '')
    .replace(/min(?!or)/i, 'm')
    .replace(/^([a-g])/, c => c.toUpperCase());
}

const validFrets = a => Array.isArray(a) && a.length === 6 && a.every(n => Number.isInteger(n) && n >= -1 && n <= 15) && a.some(n => n >= 0);
const validFingers = a => Array.isArray(a) && a.length === 6 && a.every(n => Number.isInteger(n) && n >= 0 && n <= 4);

/** Make an AI (or demo) lesson safe to render: fix names, fill shapes, check bars. */
export function normaliseLesson(raw, knownChords = []) {
  const L = structuredClone(raw);
  L.capo = Math.max(0, Math.min(9, Number(L.capo) || 0));
  L.bpm = Math.max(40, Math.min(220, Number(L.bpm) || 90));
  if (!['4/4', '3/4', '6/8'].includes(L.timeSignature)) L.timeSignature = '4/4';
  const stepsNeeded = L.timeSignature === '4/4' ? 8 : 6;

  let steps = (L.strum?.steps || []).map(s => (s === 'D' || s === 'U' ? s : '-'));
  if (steps.length !== stepsNeeded) steps = stepsNeeded === 8 ? ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'] : ['D', '-', 'D', 'U', 'D', 'U'];
  L.strum = { name: L.strum?.name || 'Folk strum', tip: L.strum?.tip || 'Keep your hand moving down and up like a pendulum.', steps };

  const known = new Set(knownChords.map(cleanName));
  const byName = new Map();
  for (const c of L.chords || []) {
    const name = cleanName(c.name);
    const lib = LIBRARY[name];
    // trust the curated library shapes over generated ones
    const shape = lib || (validFrets(c.frets) ? c : null);
    byName.set(name, {
      name,
      frets: shape ? shape.frets.slice() : null,
      fingers: shape && validFingers(shape.fingers) ? shape.fingers.slice() : [0, 0, 0, 0, 0, 0],
      tip: c.tip || lib?.tip || '',
      replaces: c.replaces ? cleanName(c.replaces) : undefined
    });
  }

  L.sections = (L.sections || []).filter(s => s && Array.isArray(s.bars) && s.bars.length).map((s, i) => ({
    id: String(s.id || `s${i}`).toLowerCase().replace(/[^a-z0-9-]/g, '') || `s${i}`,
    name: s.name || `Section ${i + 1}`,
    tip: s.tip || '',
    bars: s.bars.map(b => String(b).trim().split(/\s+/).slice(0, 2).map(cleanName).join(' '))
  }));

  // make sure every chord used in a bar has a shape
  for (const s of L.sections) for (const b of s.bars) for (const n of b.split(' ')) {
    if (!byName.has(n)) {
      const lib = LIBRARY[n];
      byName.set(n, lib ? { ...structuredClone(lib) } : { name: n, frets: null, fingers: [0, 0, 0, 0, 0, 0], tip: 'Ask Rai for an easier version of this one.' });
    }
  }
  L.chords = [...byName.values()].map(c => ({ ...c, known: known.has(c.name) }));

  const ids = new Set(L.sections.map(s => s.id));
  L.structure = (L.structure || []).map(x => String(x).toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(x => ids.has(x));
  if (!L.structure.length) L.structure = L.sections.map(s => s.id);

  L.humming = L.humming || { tip: 'Hum softly, follow the rise and fall of the tune, and let the chords guide you.' };
  L.coach = L.coach || {};
  return L;
}

/** Clean up a concert-pitch chart from the AI before arranging it. */
export function normaliseChart(raw) {
  const C = structuredClone(raw);
  C.bpm = Math.max(40, Math.min(220, Number(C.bpm) || 90));
  if (!['4/4', '3/4', '6/8'].includes(C.timeSignature)) C.timeSignature = '4/4';
  C.sections = (C.sections || []).filter(s => s && Array.isArray(s.bars) && s.bars.length).map((s, i) => ({
    id: String(s.id || `s${i}`).toLowerCase().replace(/[^a-z0-9-]/g, '') || `s${i}`,
    name: s.name || `Section ${i + 1}`,
    tip: s.tip || '',
    bars: s.bars.map(b => String(b).trim().split(/\s+/).slice(0, 2).map(cleanName).filter(n => /^[A-G]/.test(n)).join(' ')).filter(Boolean)
  })).filter(s => s.bars.length);
  const ids = new Set(C.sections.map(s => s.id));
  C.structure = (C.structure || []).map(x => String(x).toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(x => ids.has(x));
  if (!C.structure.length) C.structure = C.sections.map(s => s.id);
  if (!C.key) C.key = C.sections[0]?.bars[0]?.split(' ')[0] || 'C';
  return C;
}

/** "A4:4 C#5:1 -:2" → [[69,4],[73,1],[null,2]]  (durations in eighth-note steps) */
export function parseMelodyBar(str) {
  return String(str || '').trim().split(/\s+/).filter(Boolean).map(tok => {
    const [n, len] = tok.split(':');
    return [n === '-' ? null : parseNote(n), Number(len) || 1];
  });
}

/**
 * For songs without a written-out melody, RaiN hums an original guide line built from
 * the chord notes — it's not the song's tune, it just helps the ear find notes that fit.
 */
export function guideMelody(bars, chordsByName, capo, stepsPerBar) {
  let prev = 64; // E4, comfortable for a female hum
  const split = stepsPerBar === 8 ? [4, 4] : stepsPerBar === 6 ? [3, 3] : [stepsPerBar];
  return bars.map(bar => {
    const names = bar.length > 1 ? bar : [bar[0], bar[0]];
    return split.map((len, i) => {
      const pcs = new Set(chordMidi(chordsByName[names[Math.min(i, names.length - 1)]], capo).filter(m => m != null).map(m => m % 12));
      if (!pcs.size) return [null, len];
      const cands = [];
      for (let m = 57; m <= 72; m++) if (pcs.has(m % 12)) cands.push(m);
      cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
      const pickNote = i === 0 ? cands[0] : (cands.find(m => m !== prev) ?? cands[0]); // a little movement on the second half
      prev = pickNote;
      return [pickNote, len];
    });
  });
}

/** Chord transitions in the song, most frequent first. */
export function transitions(lesson) {
  const seq = [];
  for (const id of lesson.structure) {
    const s = lesson.sections.find(x => x.id === id);
    if (s) for (const b of s.bars) seq.push(...b.split(' '));
  }
  const counts = new Map();
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) continue;
    const key = [seq[i - 1], seq[i]].sort().join('|');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k.split('|'));
}

/** Turn a lesson into Rai's step-by-step path. */
export function buildSteps(lesson) {
  const steps = [];
  const newChords = lesson.chords.filter(c => !c.known);
  for (const c of newChords) steps.push({ id: `chord-${c.name}`, type: 'chord', title: `Learn ${c.name}`, chord: c.name });

  const trans = transitions(lesson);
  const tricky = trans.filter(([a, b]) => newChords.some(c => c.name === a || c.name === b));
  const picks = [...tricky, ...trans.filter(t => !tricky.includes(t))].slice(0, newChords.length ? 3 : 2);
  for (const [a, b] of picks) steps.push({ id: `change-${a}-${b}`, type: 'change', title: `${a} ⇄ ${b}`, pair: [a, b] });

  steps.push({ id: 'strum', type: 'strum', title: 'Strum pattern' });
  for (const s of lesson.sections) steps.push({ id: `section-${s.id}`, type: 'section', title: s.name, section: s.id });
  if (lesson.goal === 'strum') {
    steps.push({ id: 'full', type: 'full', title: 'Whole song' });
  } else {
    steps.push({ id: 'hum', type: 'hum', title: 'Hum along' });
    steps.push({ id: 'full', type: 'full', title: 'Whole song' });
    steps.push({ id: 'sing', type: 'sing', title: 'Strum & sing' });
  }
  return steps;
}

// ───────────────────────── Diagram ─────────────────────────

/** A guitar neck seen from above, with the capo clamped behind the right fret. */
export function capoDiagram(capo) {
  const frets = 8, x0 = 24, w = 300, fw = (w - x0) / frets;
  let s = `<svg class="capo" viewBox="0 0 320 96" role="img" aria-label="${capo ? `Capo on fret ${capo}` : 'No capo'}">`;
  s += `<rect x="${x0}" y="18" width="${w - x0}" height="60" rx="4" fill="#5b3a26"/>`;
  s += `<rect x="${x0 - 6}" y="16" width="7" height="64" rx="2" fill="#f2e6cf"/>`;
  for (let f = 1; f <= frets; f++) {
    const x = x0 + f * fw;
    s += `<rect x="${x - 1.5}" y="18" width="3" height="60" fill="#d8d2c6"/>`;
    s += `<text x="${x - fw / 2}" y="94" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor" opacity="${f === capo ? 1 : 0.45}">${f}</text>`;
    if ([3, 5, 7].includes(f)) s += `<circle cx="${x - fw / 2}" cy="48" r="4.5" fill="#f2e6cf" opacity=".8"/>`;
  }
  for (let i = 0; i < 6; i++) s += `<line x1="${x0 - 6}" x2="${w}" y1="${24 + i * 9.6}" y2="${24 + i * 9.6}" stroke="#e9dfcc" stroke-width="${2.2 - i * 0.3}" opacity=".9"/>`;
  if (capo) {
    const x = x0 + capo * fw - fw * 0.32;
    s += `<rect x="${x - 7}" y="6" width="14" height="84" rx="7" fill="#cc5b2b" stroke="#9e3f20" stroke-width="2"/>`;
    s += `<rect x="${x - 3}" y="10" width="6" height="76" rx="3" fill="#141417" opacity=".35"/>`;
  }
  s += `<text x="${x0 - 2}" y="11" font-size="10" font-weight="800" fill="currentColor" opacity=".6">nut</text>`;
  return s + '</svg>';
}

export function chordDiagram(chord, { size = 1 } = {}) {
  const W = 120 * size, H = 150 * size;
  if (!chord?.frets) {
    return `<svg class="diagram" viewBox="0 0 120 150" width="${W}" height="${H}" role="img" aria-label="${chord?.name || ''} shape unknown">
      <rect x="18" y="30" width="84" height="100" rx="8" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="4 4"/>
      <text x="60" y="88" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor" opacity=".4">?</text></svg>`;
  }
  const fr = chord.frets;
  const played = fr.filter(f => f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const base = maxF > 5 ? Math.min(...played) : 1;
  const x0 = 22, y0 = 30, gx = 15.2, gy = 20, rows = 5;
  let s = `<svg class="diagram" viewBox="0 0 120 150" width="${W}" height="${H}" role="img" aria-label="${chord.name} chord diagram">`;
  if (base === 1) s += `<rect x="${x0 - 1}" y="${y0 - 5}" width="${gx * 5 + 2}" height="5" rx="2" fill="currentColor"/>`;
  else s += `<text x="${x0 - 8}" y="${y0 + gy * 0.68}" text-anchor="end" font-size="11" font-weight="700" fill="currentColor">${base}fr</text>`;
  for (let r = 0; r <= rows; r++) s += `<line x1="${x0}" x2="${x0 + gx * 5}" y1="${y0 + r * gy}" y2="${y0 + r * gy}" stroke="currentColor" stroke-opacity=".35"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${x0 + i * gx}" x2="${x0 + i * gx}" y1="${y0}" y2="${y0 + rows * gy}" stroke="currentColor" stroke-opacity="${0.35 + i * 0.04}" stroke-width="${1.6 - i * 0.15}"/>`;
  // barre detection: same finger on several strings at the same fret
  const fg = chord.fingers || [];
  const barres = {};
  fr.forEach((f, i) => { if (f > 0 && fg[i] === 1) (barres[f] ||= []).push(i); });
  for (const [f, list] of Object.entries(barres)) {
    if (list.length > 1) {
      const y = y0 + (Number(f) - base + 0.5) * gy;
      s += `<rect x="${x0 + list[0] * gx - 6}" y="${y - 6}" width="${(list[list.length - 1] - list[0]) * gx + 12}" height="12" rx="6" class="dot"/>`;
    }
  }
  fr.forEach((f, i) => {
    const x = x0 + i * gx;
    if (f < 0) s += `<text x="${x}" y="${y0 - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" opacity=".6">✕</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${y0 - 14}" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
    else {
      const y = y0 + (f - base + 0.5) * gy;
      s += `<circle cx="${x}" cy="${y}" r="7" class="dot"/>`;
      if (fg[i]) s += `<text x="${x}" y="${y + 3.8}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${fg[i]}</text>`;
    }
  });
  return s + '</svg>';
}
