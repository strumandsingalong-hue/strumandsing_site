// "RaiN, show me": a finger-by-finger walkthrough of any chord shape, drawn on a
// fretboard as you see it looking down at your own guitar (low E nearest you, nut on the left).

const STRING = ['low E', 'A', 'D', 'G', 'B', 'high e'];
const FINGER = { 1: 'index finger', 2: 'middle finger', 3: 'ring finger', 4: 'little finger' };
export const FINGER_COLOUR = { 1: '#245f73', 2: '#cc5b2b', 3: '#c9962f', 4: '#6b3a7a', 0: '#5d5a55' };
const nth = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');

/** Break a chord into spoken steps: one per finger (or barre), then skip/open strings, then listen. */
export function fingerSteps(chord, capo = 0) {
  const fr = chord.frets, fg = chord.fingers || [];
  const steps = [];
  if (capo) steps.push({ text: `With your capo on fret ${capo}, count every fret from the capo — it's your new "nut".`, place: [] });

  // barre: index finger on several strings at the same fret
  const barreFret = (() => {
    const at = {};
    fr.forEach((f, i) => { if (f > 0 && fg[i] === 1) (at[f] ||= []).push(i); });
    const e = Object.entries(at).find(([, l]) => l.length > 1);
    return e ? Number(e[0]) : null;
  })();

  const placed = [];
  if (barreFret) {
    const strings = fr.map((f, i) => i).filter(i => fr[i] >= barreFret && fr[i] !== -1);
    const from = Math.min(...fr.map((f, i) => (f === barreFret && fg[i] === 1 ? i : 9)));
    const to = 5;
    placed.push({ barre: true, fret: barreFret, from, to, finger: 1 });
    steps.push({
      text: `First, lay your index finger flat across the strings from the ${STRING[from]} to the high e, just behind the ${nth(barreFret)} fret. That's a barre — roll the finger slightly onto its bony side.`,
      place: [...placed], focus: { barre: true, fret: barreFret, from, to }
    });
    void strings;
  }
  const order = fr.map((f, i) => ({ i, f, finger: fg[i] || 0 }))
    .filter(x => x.f > 0 && !(barreFret && x.finger === 1 && x.f === barreFret))
    .sort((a, b) => (a.finger || 9) - (b.finger || 9) || a.i - b.i);
  for (const x of order) {
    placed.push({ string: x.i, fret: x.f, finger: x.finger });
    const who = x.finger ? `${FINGER[x.finger][0].toUpperCase()}${FINGER[x.finger].slice(1)}` : 'A finger';
    steps.push({
      text: `${who} on the ${STRING[x.i]} string, just behind the ${nth(x.f)} fret.`,
      place: [...placed], focus: { string: x.i, fret: x.f }
    });
  }

  const muted = fr.map((f, i) => (f < 0 ? i : null)).filter(x => x != null);
  const open = fr.map((f, i) => (f === 0 ? i : null)).filter(x => x != null);
  const list = a => a.map(i => STRING[i]).join(a.length > 2 ? ', ' : ' and ').replace(/, ([^,]+)$/, ' and $1');
  if (muted.length) steps.push({ text: `Don't play the ${list(muted)} string${muted.length > 1 ? 's' : ''} — start your strum just below ${muted.length > 1 ? 'them' : 'it'}.`, place: [...placed], focus: { muted } });
  if (open.length) steps.push({ text: `Leave the ${list(open)} string${open.length > 1 ? 's' : ''} open — keep your fingers arched so they don't touch ${open.length > 1 ? 'them' : 'it'}.`, place: [...placed], focus: { open } });
  const first = fr.findIndex(f => f >= 0);
  steps.push({ text: `That's ${chord.name}! Strum from the ${STRING[first]} string down. Then I'll pluck each string, so you can check every note rings clearly.`, place: [...placed], focus: { listen: true }, listen: true });
  return steps;
}

/** Fretboard from the player's view. `place` = fingers placed so far, `focus` = what to highlight. */
export function fretboardSVG(chord, { place = [], focus = {}, capo = 0, ringing = null } = {}) {
  const fr = chord.frets || [];
  const played = fr.filter(f => f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const base = maxF > 5 ? Math.min(...played) : 1;
  const frets = 5, nutX = 46, w = 300, sp = (w - nutX) / frets, y0 = 26, gap = 21;
  const sy = i => y0 + i * gap;               // string 0 (low E) at the top: closest to your face
  const fx = f => nutX + (f - base + 0.5) * sp;
  let s = `<svg class="fretboard" viewBox="0 0 320 168" role="img" aria-label="${chord.name} on the fretboard">`;
  s += `<rect x="${nutX}" y="${y0 - 10}" width="${w - nutX + 14}" height="${gap * 5 + 20}" rx="6" fill="#4a2f20"/>`;
  for (const m of [3, 5, 7, 9]) if (m >= base && m < base + frets) s += `<circle cx="${fx(m)}" cy="${y0 + gap * 2.5}" r="5" fill="#f2e6cf" opacity=".55"/>`;
  for (let k = 1; k <= frets; k++) s += `<rect x="${nutX + k * sp - 1.5}" y="${y0 - 10}" width="3" height="${gap * 5 + 20}" fill="#cfc7b8"/>`;
  s += base === 1
    ? `<rect x="${nutX - 6}" y="${y0 - 12}" width="8" height="${gap * 5 + 24}" rx="2" fill="${capo ? '#cc5b2b' : '#f2e6cf'}"/>`
    : `<text x="${nutX - 4}" y="${y0 + gap * 5 + 26}" font-size="11" font-weight="800" fill="currentColor" text-anchor="middle">${base}fr</text>`;
  if (capo && base === 1) s += `<text x="${nutX - 2}" y="${y0 - 15}" font-size="9" font-weight="900" fill="#cc5b2b" text-anchor="middle">CAPO</text>`;
  for (let k = 0; k < frets; k++) s += `<text x="${fx(base + k)}" y="${y0 + gap * 5 + 26}" font-size="11" font-weight="800" fill="currentColor" opacity=".55" text-anchor="middle">${base + k}</text>`;
  for (let i = 0; i < 6; i++) {
    const on = focus.string === i || focus.muted?.includes(i) || focus.open?.includes(i) || ringing === i;
    s += `<line x1="${nutX - 4}" x2="${w + 14}" y1="${sy(i)}" y2="${sy(i)}" stroke="${ringing === i ? '#e8bc72' : on ? '#fff' : '#e9dfcc'}" stroke-width="${(2.6 - i * 0.32) + (on ? 0.8 : 0)}" ${ringing === i ? 'class="ring"' : ''}/>`;
    s += `<text x="10" y="${sy(i) + 4}" font-size="11" font-weight="900" fill="currentColor" opacity="${on ? 1 : 0.6}">${['E', 'A', 'D', 'G', 'B', 'e'][i]}</text>`;
    const f = fr[i];
    const mx = nutX - 18;
    if (f < 0) s += `<text x="${mx}" y="${sy(i) + 4}" font-size="12" font-weight="900" fill="${focus.muted?.includes(i) ? '#cc5b2b' : 'currentColor'}" text-anchor="middle" opacity=".85">✕</text>`;
    else if (f === 0) s += `<circle cx="${mx}" cy="${sy(i)}" r="5" fill="none" stroke="${focus.open?.includes(i) ? '#2f7a4f' : 'currentColor'}" stroke-width="2"/>`;
  }
  for (const p of place) {
    if (p.barre) {
      const isNew = focus.barre;
      s += `<rect class="${isNew ? 'tip new' : 'tip'}" x="${fx(p.fret) - 9}" y="${sy(p.from) - 10}" width="18" height="${sy(p.to) - sy(p.from) + 20}" rx="9" fill="${FINGER_COLOUR[1]}"/>`;
      s += `<text x="${fx(p.fret)}" y="${sy(p.from) + (sy(p.to) - sy(p.from)) / 2 + 4}" font-size="11" font-weight="900" fill="#fff" text-anchor="middle">1</text>`;
    } else {
      const isNew = focus.string === p.string && focus.fret === p.fret;
      s += `<g class="${isNew ? 'tip new' : 'tip'}" style="transform-origin:${fx(p.fret)}px ${sy(p.string)}px">`;
      if (isNew) s += `<circle cx="${fx(p.fret)}" cy="${sy(p.string)}" r="15" fill="none" stroke="${FINGER_COLOUR[p.finger]}" stroke-width="2" class="pulse"/>`;
      s += `<circle cx="${fx(p.fret)}" cy="${sy(p.string)}" r="10" fill="${FINGER_COLOUR[p.finger]}" stroke="#fff" stroke-width="1.5"/>`;
      s += `<text x="${fx(p.fret)}" y="${sy(p.string) + 4}" font-size="11" font-weight="900" fill="#fff" text-anchor="middle">${p.finger || ''}</text></g>`;
    }
  }
  return s + '</svg>';
}

/** A little fretting hand, so "ring finger" always maps to a colour and number. */
export function handKey() {
  const f = (x, h, n) => `<rect x="${x}" y="${46 - h}" width="13" height="${h + 8}" rx="6.5" fill="${FINGER_COLOUR[n]}"/><text x="${x + 6.5}" y="${46 - h + 13}" font-size="10" font-weight="900" fill="#fff" text-anchor="middle">${n}</text>`;
  return `<svg class="hand-key" viewBox="0 0 92 84" role="img" aria-label="Finger numbers: 1 index, 2 middle, 3 ring, 4 little">
    <path d="M14 54c0-6 4-10 10-10h44c6 0 10 4 10 10v10c0 12-10 18-20 18H34c-12 0-20-8-20-18Z" fill="#f4d3b8"/>
    <path d="M14 60c-6-2-12-10-12-16 0-4 4-6 8-4l8 8" fill="#f4d3b8"/>
    ${f(16, 30, 1)}${f(32, 36, 2)}${f(48, 33, 3)}${f(64, 24, 4)}
    <text x="6" y="58" font-size="8" font-weight="800" fill="currentColor" opacity=".55">T</text>
  </svg>`;
}
