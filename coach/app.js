import { STARTER_CHORDS, LIBRARY, chordDiagram, capoDiagram, normaliseLesson, normaliseChart, buildSteps, parseMelodyBar, guideMelody, chordMidi, scalePitchClasses, parseNote, noteName, cleanName } from './js/chords.js';
import { arrange, friendlyChords, toLesson } from './js/arranger.js';
import { audio, Player } from './js/audio.js';
import { PitchTracker } from './js/pitch.js';
import { fetchChart, reportChart, ownKeyAllowed, chat, detectMode, modeLabel, store } from './js/coach.js';
import { DEMO_TITLES } from './js/demo.js';
import * as rain from './js/rai.js';
import { PATTERNS, patternFor } from './js/prompts.js';
import { fingerSteps, fretboardSVG, handKey } from './js/teach.js';

// ───────────────────────── helpers ─────────────────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const list = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  ear: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2z"/></svg>'
};

const thread = $('#thread');
const input = $('#input');
const player = new Player();
const tracker = new PitchTracker();

const S = {
  phase: 'boot', song: '', known: store.get('ss.known', []), level: store.get('ss.level', null), goal: store.get('ss.goal', null),
  chart: null, lesson: null, steps: [], idx: -1, done: [], practiceBpm: null, history: [], key: null, pending: null
};
let live = null;          // { stepId, card, cleanup[] }
let activeUI = null;      // current play-along controls { stop, setBpm }

// ───────────────────────── RaiN on stage ─────────────────────────
$('#stageFace').innerHTML = rain.RAI_SVG;
$('#splashFace').innerHTML = rain.RAI_SVG;
const caption = $('#caption'), stageStatus = $('#stageStatus');
rain.onSpeakingChange(on => {
  document.body.classList.toggle('speaking', on);
  stageStatus.textContent = on ? 'speaking…' : 'Strum & Sing coach';
});
$('#stage').onclick = () => rain.stop();
const voiceBtn = $('#voiceBtn');
const syncVoiceBtn = () => { voiceBtn.setAttribute('aria-pressed', rain.voiceOn()); voiceBtn.setAttribute('aria-label', rain.voiceOn() ? "RaiN's voice on" : "RaiN's voice off"); };
voiceBtn.onclick = () => { rain.setVoiceOn(!rain.voiceOn()); syncVoiceBtn(); toast(rain.voiceOn() ? 'RaiN will talk' : 'RaiN is in quiet mode'); };
syncVoiceBtn();

// ───────────────────────── conversation ─────────────────────────
let queue = Promise.resolve();
const teachers = new Set();               // running "show me" walkthroughs
const stopTeaching = () => { teachers.forEach(t => t.stop()); teachers.clear(); };
function say(text, { fast = false } = {}) {
  queue = queue.then(async () => {
    if (rain.voiceOn() && activeUI) activeUI.stop(); // never talk over the music
    const t = typing();
    await wait(fast ? 150 : 350);
    t.remove();
    addMsg('coach', text);
    caption.textContent = text.replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '').trim();
    await rain.speak(text);
  });
  return queue;
}
function typing(label) {
  const el = h(`<div class="typing">${label ? `<small>${esc(label)}</small>` : ''}<div class="msg coach"><div class="avatar">R</div><div class="bubble"><i></i><i></i><i></i></div></div></div>`);
  thread.append(el); scrollDown();
  return el;
}
function addMsg(role, text) {
  const el = h(`<div class="msg ${role}">${role === 'coach' ? '<div class="avatar">R</div>' : ''}<div class="bubble"></div></div>`);
  el.querySelector('.bubble').textContent = text;
  thread.append(el); scrollDown();
  S.history.push({ role: role === 'coach' ? 'assistant' : 'user', text });
  S.history = S.history.slice(-30);
  return el;
}
function addCard(el) { thread.append(el); scrollDown(el); return el; }
function scrollDown(el) {
  requestAnimationFrame(() => {
    const target = el || thread.lastElementChild;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: el ? 'start' : 'end' });
  });
}
function toast(msg) {
  const t = h(`<div class="toast">${esc(msg)}</div>`);
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}

/**
 * RaiN asks a question with tappable answers. Resolves with the chosen value.
 * Typed or spoken answers are matched against each option's `match` regex.
 */
async function ask(question, options, { before = '' } = {}) {
  await say(question);
  return new Promise(resolve => {
    const card = h(`<div class="card choice-card">${before}<div class="choices">${options.map((o, i) =>
      `<button type="button" class="choice" data-i="${i}">${o.ico ? `<span class="ico">${o.ico}</span>` : ''}<b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div></div>`);
    const finish = (o, echo) => {
      S.pending = null;
      collapse(card, o.label, '');
      if (echo) addMsg('user', o.label);
      resolve(o.value);
    };
    $$('.choice', card).forEach(b => b.onclick = () => finish(options[Number(b.dataset.i)], true));
    S.pending = {
      answer: text => {
        const o = options.find(x => x.match && x.match.test(text));
        if (o) finish(o, false);
        else say(`Sorry, I didn't quite catch that. ${options.map(x => x.label).join(', or ')}?`, { fast: true });
      }
    };
    addCard(card);
    updateQuick();
    input.placeholder = 'Tap an answer, or type / say it…';
  });
}

// ───────────────────────── start ─────────────────────────
function startApp(voice) {
  rain.setVoiceOn(voice); syncVoiceBtn();
  if (voice) rain.unlockVoice();
  audio.unlock().catch(() => {});
  $('#splash').hidden = true;
  boot();
}
$('#startVoice').onclick = () => startApp(true);
$('#startQuiet').onclick = () => startApp(false);
if (!('speechSynthesis' in window)) { $('#startVoice').textContent = 'Start'; $('#startQuiet').hidden = true; }

async function boot() {
  modeCache = await detectMode();
  const songs = Object.values(store.get('ss.songs', {})).sort((a, b) => b.updated - a.updated);
  const returning = Boolean(S.level && S.goal);
  await say(returning ? 'Hey, welcome back! 🎸' : 'Hi! I\'m RaiN, your Strum & Sing coach 🎸');
  if (modeCache === 'demo') {
    await say(`Quick note: I'm offline right now, so I can teach the songs on our checked list (like Perfect, Riptide or Kesariya) plus ${list(DEMO_TITLES)}. Connect the AI coach in Settings for almost any song.`);
  }
  if (songs.length) {
    await say('Want to pick up where you left off?');
    addCard(recentCard(songs.slice(0, 3)));
  }
  if (!returning) await askAboutYou();
  await say('So — what song would you love to play?');
  setPhase('askSong');
}

async function askAboutYou() {
  S.level = await ask('First, where are you starting from?', [
    { label: 'Brand new', sub: 'I\'ve barely played', value: 'new', ico: '🌱', match: /new|beginner|never|start|barely|none|no chords/i },
    { label: 'A few chords', sub: 'Still building confidence', value: 'some', ico: '🎸', match: /few|some|bit|know|little|chords/i },
    { label: 'I play a fair bit', sub: 'Comfortable with songs', value: 'comfy', ico: '🔥', match: /fair|lot|comfortable|good|years|confident|play a/i }
  ]);
  if (S.level === 'new') S.known = [];
  store.set('ss.level', S.level);
  await say(pick(['Lovely.', 'Perfect.', 'Great — that helps.']));
  S.goal = await ask('And what\'s the goal — just strum along, or strum and sing?', [
    { label: 'Strum only', sub: 'Find my rhythm', value: 'strum', ico: '🤚', match: /strum only|just strum|only strum|no sing|not sing|strum$/i },
    { label: 'Sing & strum', sub: 'Put it all together', value: 'sing', ico: '🎤', match: /sing|both|together|and/i }
  ]);
  store.set('ss.goal', S.goal);
}

function setPhase(p) {
  S.phase = p;
  input.placeholder = { askSong: 'Tell RaiN a song…', pickChords: 'Or type the chords you know…', planning: 'RaiN is charting your song…', lesson: 'Ask RaiN anything…', done: 'Another song?' }[p] || 'Message RaiN…';
  updateQuick();
}

function updateQuick() {
  const q = $('#quick');
  let items = [];
  if (S.pending) items = [];
  else if (S.phase === 'askSong' || S.phase === 'done') items = ['Perfect – Ed Sheeran', 'Riptide – Vance Joy', 'Let It Be', 'Kesariya', 'Wonderwall', 'Pal – KK', ...(modeCache === 'demo' ? DEMO_TITLES : [])];
  else if (S.phase === 'pickChords') items = ['None of these yet', 'I know G, C, D and Em'];
  else if (S.phase === 'lesson') items = ['Slower please', 'This chord is hard', `Show me ${S.steps[S.idx]?.chord || S.steps[S.idx]?.pair?.[1] || S.lesson?.chords[0]?.name || 'G'}`, 'Skip ahead', 'Go back a step', 'Why the capo?'];
  q.innerHTML = '';
  for (const t of items) {
    const b = h(`<button type="button">${esc(t)}</button>`);
    b.onclick = () => handle(t);
    q.append(b);
  }
}
let modeCache = 'demo';

$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  handle(text);
});

async function handle(text) {
  audio.unlock().catch(() => {});
  rain.stop();
  addMsg('user', text);
  if (S.pending) return S.pending.answer(text);
  if (S.phase === 'planning') return say('One sec — still working out the chords!', { fast: true });
  if (S.phase === 'askSong' || S.phase === 'done') return findSong(text);
  if (S.phase === 'pickChords') return chordsFromText(text);
  if (S.phase === 'lesson') return lessonChat(text);
  if (S.phase === 'boot') return say('Just a moment!', { fast: true });
}

// ── talk back with the mic ──
const micBtn = $('#micBtn');
if (rain.canListen) {
  micBtn.hidden = false;
  let rec = null;
  micBtn.onclick = () => {
    if (rec) { rain.stopListening(); return; }
    rain.stop();
    micBtn.classList.add('on'); document.body.classList.add('listening');
    stageStatus.textContent = 'listening…';
    input.placeholder = 'Listening…';
    rec = rain.listen({
      onInterim: t => { input.value = t; },
      onFinal: t => { input.value = ''; handle(t); },
      onEnd: () => { rec = null; micBtn.classList.remove('on'); document.body.classList.remove('listening'); stageStatus.textContent = 'Strum & Sing coach'; setPhase(S.phase); }
    });
  };
}

// ───────────────────────── finding the song ─────────────────────────
async function findSong(song) {
  S.song = song;
  setPhase('planning');
  await say(pick([`Ooh, "${song}" — let me have a listen.`, `"${song}"! Give me a second to work out the chords.`, `Yes — "${song}". Let me pull up the chart.`]), { fast: true });
  await queue;
  const t = typing('RaiN is working out the chords…');
  let raw;
  try {
    raw = await fetchChart({ song });
  } catch (e) {
    t.remove();
    await say(`Hmm, I couldn't reach my chord books just now (${e.message}).`);
    const c = addCard(h(`<div class="card"><p>Want me to try again?</p><div class="actions"><button class="btn clay" data-r>Try again</button><button class="btn ghost" data-n>Pick another song</button></div></div>`));
    $('[data-r]', c).onclick = () => { c.remove(); findSong(song); };
    $('[data-n]', c).onclick = () => { c.remove(); say('Sure — which song?').then(() => setPhase('askSong')); };
    return;
  }
  t.remove();
  if (!raw?.found || !raw.sections?.length) {
    await say(raw?.reaction || 'I don\'t know that one well enough to chart it honestly. Could you check the spelling or add the artist?');
    return setPhase('askSong');
  }
  S.chart = { ...normaliseChart(raw), goal: S.goal || 'sing', reviewed: raw.reviewed === true };
  await say(raw.reaction);
  if (!raw.reviewed) await say('Quick heads-up: this one isn\'t on our checked list yet, so I\'ve worked out the chords myself. It\'s a close version, not gospel. If anything sounds off, tell me, and you can change the strum pattern too.');

  if (S.level === 'new' && !S.known.length) return negotiate();
  return askKnownChords();
}

// ── "here are the chords — which do you know?" ──
async function askKnownChords() {
  // show the song in the capo that best fits chords they've told me about before (or common beginner chords)
  // checked songs: show the chords exactly as our checked version plays them (its capo);
  // otherwise the capo that best fits chords they've told me about (or common beginner chords)
  const fa = Number.isInteger(S.chart.preferredCapo)
    ? arrange(S.chart, S.known, { capos: [S.chart.preferredCapo] })
    : arrange(S.chart, S.known.length ? S.known : ['G', 'C', 'D', 'Em', 'Am', 'E', 'A', 'Dm'], {});
  const shapes = fa.shapes, capo = fa.capo;
  const shapeOf = n => Object.values(fa.map).find(o => o.name === n)?.shape || LIBRARY[n] || { name: n, frets: null };
  const easyFor = n => { const o = Object.values(fa.map).find(x => x.name === n); return o && o.kind === 'swap' ? Object.keys(fa.map).find(k => fa.map[k] === o) : null; };
  S.tileCapo = capo;
  await say(`Here are the chords for it${capo ? `, with a capo on fret ${capo}` : ''}. Tap the ones you can already play — wobbly ones count!`);
  setPhase('pickChords');
  const sel = new Set(shapes.filter(c => S.known.includes(c)));
  const extra = STARTER_CHORDS.filter(c => !shapes.includes(c));
  const extraSel = new Set(S.known.filter(c => extra.includes(c)));
  const card = h(`<div class="card picker-card">
    <div class="eyebrow">This song's chords${capo ? ` · capo ${capo}` : ''}</div>
    <div class="tiles">${shapes.map(n => `<button type="button" class="tile-btn" data-c="${esc(n)}" aria-pressed="${sel.has(n)}"><span class="name">${esc(n)}</span>${easyFor(n) ? `<small class="easy">easy ${esc(easyFor(n))}</small>` : ''}${chordDiagram(shapeOf(n))}</button>`).join('')}</div>
    <button type="button" class="more-toggle" data-more>+ I know other chords too (helps me pick the capo)</button>
    <div class="picker" data-extra hidden>${extra.map(c => `<button type="button" class="chip" aria-pressed="${extraSel.has(c)}" data-x="${c}">${c}</button>`).join('')}</div>
    <p class="note-small">Knowing other chords helps — I might move the capo so the song fits your fingers better.</p>
    <div class="actions"><button class="btn clay big wide" data-go>These are the ones I know</button></div>
  </div>`);
  $$('[data-c]', card).forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); on ? sel.add(b.dataset.c) : sel.delete(b.dataset.c);
    if (on) { audio.unlock().then(() => audio.strum(shapeOf(b.dataset.c), audio.now + 0.02, 'D', { capo })); }
  });
  $$('[data-x]', card).forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); on ? extraSel.add(b.dataset.x) : extraSel.delete(b.dataset.x);
  });
  $('[data-more]', card).onclick = e => { $('[data-extra]', card).hidden = false; e.currentTarget.hidden = true; };
  if (extraSel.size) { $('[data-extra]', card).hidden = false; $('[data-more]', card).hidden = true; }
  $('[data-go]', card).onclick = () => submitKnown([...sel, ...extraSel], card);
  card._submit = names => submitKnown(names, card);
  addCard(card);
}

function submitKnown(names, card, echo = true) {
  // remember everything they know across songs, but trust this answer for this song's chords
  const shapes = $$('.tile-btn', card || document).map(b => b.dataset.c);
  S.known = [...new Set([...S.known.filter(k => !shapes.includes(k)), ...names])];
  store.set('ss.known', S.known);
  const summary = names.length ? `I know ${list(names)}` : 'None of these yet';
  if (card?.isConnected) collapse(card, summary, '');
  if (echo) addMsg('user', summary);
  negotiate();
}

function chordsFromText(text) {
  const card = $$('.picker-card').pop();
  if (/\b(none|no|nothing|zero|not yet|neither)\b/i.test(text)) return submitKnown([], card, false);
  const found = (text.match(/\b[A-G][#b]?(?:maj7|m7|m|7|sus2|sus4|add9|maj)?(?:\/[A-G])?(?![a-z])/g) || []).map(cleanName);
  const names = [...new Set(found)].filter(n => LIBRARY[n]);
  if (!names.length) return say('I didn\'t catch any chord names there — tap them on the card, or say something like "G, C and D".', { fast: true });
  submitKnown(names, card, false);
}

// ── "you'd need one or two more — fancy learning them?" ──
const isHard = n => ['F', 'Bm', 'B', 'F#m', 'Gm', 'Bb', 'C#m'].includes(n) || !LIBRARY[n];
async function negotiate() {
  setPhase('planning');
  const chart = S.chart;
  const known = S.known;
  const full = arrange(chart, known);
  const n = full.newChords.length;
  let chosen = full;

  if (n === 0) {
    if (full.perfect) await say(pick(['Brilliant news — you already know every chord in this song!', 'You already know all of these. This is going to be fun.']));
    else await say('Good news — with a little tweak, you can play this with chords you already know.');
  } else if (!known.length) {
    if (n <= 4) await say(`It uses ${n} chord${n > 1 ? 's' : ''}: ${list(full.newChords)}. ${full.newChords.some(isHard) ? 'One of them is a bit of a stretch, but we\'ll go slowly.' : 'All beginner-friendly — we\'ll learn them together.'}`);
    else {
      const k = await ask(`This one has ${n} different chords — quite a lot for a start. Shall we learn them all, or keep it to the four most important and I'll fill the gaps?`, [
        { label: `Learn all ${n}`, value: n, match: /all|every|yes|go for/i },
        { label: 'Just four for now', value: 4, match: /four|4|keep|simple|fewer|important/i }
      ]);
      if (k < n) {
        chosen = arrange(chart, [], { maxNew: k });
        if (chosen.limitMet) await say(`Okay — I'll keep it to ${chosen.newChords.length} and fill the gaps with chords that sound close.`);
        else await say(`I can't get this one below ${chosen.newChords.length} chords without it sounding wrong, so let's learn those — slowly.`);
      }
    }
  } else {
    const names = list(full.newChords.map(c => `${c}${isHard(c) ? ' (a bit trickier)' : ''}`));
    const preview = `<div class="mini-diagrams">${full.newChords.map(c => `<div class="dcell"><div class="name">${esc(c)}</div>${chordDiagram(full.map[Object.keys(full.map).find(k => full.map[k].name === c)]?.shape || LIBRARY[c] || { name: c })}</div>`).join('')}</div>`;
    const capoNote = full.capo ? `With a capo on fret ${full.capo}, ` : '';
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    const opts = n === 1
      ? [{ label: `Yes, teach me ${full.newChords[0]}`, value: 1, match: /yes|sure|ok|okay|yeah|yep|teach|go on|let'?s/i },
         { label: 'No, work around it', value: 0, match: /no|nope|rather not|work around|skip|don'?t/i }]
      : n === 2
        ? [{ label: 'Yes, both', value: 2, match: /yes|both|sure|ok|okay|yeah|two|2/i },
           { label: 'Just one', value: 1, match: /one|1|single/i },
           { label: 'Neither — work around it', value: 0, match: /no|neither|none|work around|don'?t/i }]
        : [{ label: `All ${n}`, value: n, match: /all|every|yes/i },
           { label: 'Just two', value: 2, match: /two|2/i },
           { label: 'Just one', value: 1, match: /one|1/i },
           { label: 'None — work around it', value: 0, match: /no|none|work around|don'?t/i }];
    const swapNote = full.simplified.filter(x => full.newChords.includes(x.use)).map(x => ` ${x.use} is the easy version of ${x.shape}.`).join('');
    const line = n === 1
      ? `You know nearly all of it! ${cap(`${capoNote}you'd just need one more chord: ${names}.`)}${swapNote} Fancy learning it?`
      : n === 2
        ? `You're close! ${cap(`${capoNote}there are just two more to learn: ${names}.`)}${swapNote} Up for learning them?`
        : `${cap(`${capoNote}this song needs ${n} chords you don't know yet: ${names}.`)} How many do you want to take on?`;
    const k = await ask(line, opts, { before: preview });
    if (k < n) {
      chosen = arrange(chart, known, { maxNew: k });
      if (!chosen.limitMet) await say(`I tried, but without ${chosen.newChords.length === 1 ? 'one new chord' : `${chosen.newChords.length} new chords`} this song wouldn't sound right — so let's learn ${chosen.newChords.length === 1 ? 'it' : 'them'} together, nice and slowly.`);
      else if (k === 0) await say(`No problem — I'll work around ${n === 1 ? 'it' : 'them'} with chords you know.`);
      else await say(`Okay, just ${k === 1 ? 'one' : k}. I'll pick the one${k > 1 ? 's' : ''} that make${k > 1 ? '' : 's'} the biggest difference.`);
    } else await say(pick(['Love that. Let\'s do it!', 'Brilliant — new chords unlocked soon.', 'That\'s the spirit!']));
  }
  await explainArrangement(chosen);
  buildLesson(chosen);
}

async function explainArrangement(a) {
  if (S.tileCapo != null && a.capo !== S.tileCapo) await say(`Since you know ${list(S.known.filter(k => a.shapes.includes(k)).slice(0, 3))}, I've moved things around to suit your fingers.`);
  if (a.capo) await say(`Pop your capo on fret ${a.capo}. ${a.capo === 1 ? 'It' : 'That way the shapes are easy, but it'} sounds just like the original.`);
  else await say('No capo needed for this one — play it just as it is.');
  for (const s of a.simplified.slice(0, 2)) await say(`Where the song has ${s.shape}, you'll play ${s.use} — it's friendlier and sounds lovely.`);
  if (a.simplified.length > 2) await say(`I've simplified a few fancier chords too, to keep things friendly.`);
  for (const s of a.standIns.slice(0, 2)) await say(`For ${s.shape}, play ${s.use} instead. It shares notes, so it'll sound close while you're learning.`);
}

function buildLesson(arr) {
  // saved charts carry a standard and a beginner strum; brand-new learners get the easy one
  const src = { ...S.chart };
  const easy = S.chart.strumEasy?.steps;
  if (S.level === 'new' && Array.isArray(easy) && easy.length === (S.chart.timeSignature === '4/4' ? 8 : 6)) src.strum = S.chart.strumEasy;
  const lesson = normaliseLesson(toLesson(src, arr, S.known), S.known);
  lesson.goal = S.chart.goal;
  lesson.concertKey = S.chart.key;
  lesson.arrangement = { capo: arr.capo, standIns: arr.standIns, simplified: arr.simplified };
  Object.assign(S, { lesson, steps: buildSteps(lesson), idx: -1, done: [], practiceBpm: null, key: slug(`${lesson.title}-${lesson.artist}`) });
  saveSong();
  setPhase('lesson');
  addCard(overviewCard());
  updateProgress();
}

// ───────────────────────── overview ─────────────────────────
function overviewCard() {
  const L = S.lesson;
  const chips = L.chords.map(c => `<span class="chip ${c.known ? 'known' : 'new'}">${esc(c.name)}${c.replaces ? ` <small>for ${esc(c.replaces)}</small>` : ''}${c.known ? ' ✓' : ' · new'}</span>`).join('');
  const card = h(`<div class="card dark">
    <div class="eyebrow">Your lesson plan</div>
    <h3>${esc(L.title)}</h3>
    <p>${esc(L.artist)}${L.feel ? ` · ${esc(L.feel)}` : ''}</p>
    <div class="meta">
      <span class="pill gold">${L.capo ? `Capo ${L.capo}` : 'No capo'}</span>
      <span class="pill">Shapes in ${esc(L.key)}</span>
      <span class="pill">${L.bpm} bpm</span><span class="pill">${esc(L.timeSignature)}</span>
      <span class="pill">${L.goal === 'strum' ? 'Strum only' : 'Sing & strum'}</span>
      ${L.reviewed ? '<span class="pill green">✓ Checked version</span>' : '<span class="pill gold">AI draft · may differ</span>'}
    </div>
    <div class="capo-banner"><b>${L.capo ? `Capo ${L.capo}` : 'No capo'}</b><span>${L.capo ? `Clamp it just behind fret ${L.capo}. Sounds in ${esc(L.concertKey || '')}, like the original.` : 'Play in open position.'}</span></div>
    ${capoDiagram(L.capo)}
    <div class="label">Chords</div>
    <div class="row">${chips}</div>
    ${L.confidenceNote ? `<p class="note-small">${esc(L.confidenceNote)}</p>` : ''}
    <button type="button" class="btn link" data-report style="padding-left:0">Chords sound wrong? Tell RaiN</button>
    <div data-report-form hidden><textarea class="lyrics-edit" style="min-height:70px" maxlength="500" placeholder="Which part sounds off? e.g. the chorus, bar 3"></textarea>
      <div class="actions" style="margin-top:8px"><button type="button" class="btn white" data-report-send>Send to RaiN</button></div></div>
    <div class="label">Your path</div>
    <ol class="steps-list">${S.steps.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol>
    <div class="actions"><button class="btn clay big wide" data-start>${ICON.play} Let's start</button></div>
  </div>`);
  $('[data-start]', card).onclick = e => { e.currentTarget.disabled = true; audio.unlock(); goStep(0); };
  $('[data-report]', card).onclick = e => { e.currentTarget.hidden = true; $('[data-report-form]', card).hidden = false; $('textarea', card).focus(); };
  $('[data-report-send]', card).onclick = async () => {
    const note = $('[data-report-form] textarea', card).value.trim();
    $('[data-report-form]', card).hidden = true;
    try { await reportChart({ songKey: L.songKey, note }); } catch {}
    say('Thank you — I\'ll get that chart checked. Meanwhile, if a chord sounds off, tell me and I can swap it.', { fast: true });
  };
  return card;
}

// ───────────────────────── steps ─────────────────────────
const TYPE_LINE = { chord: 'newChords', change: 'changes', strum: 'strum', section: 'sections', hum: 'hum', full: 'full', sing: 'sing' };
const PRAISE = ['Nice one!', 'Lovely work.', 'That\'s it!', 'Brilliant.', 'You\'re getting it.', 'Sounding good!'];

function stepLine(step, i) {
  const L = S.lesson;
  const firstOfType = S.steps.findIndex(s => s.type === step.type) === i;
  const base = firstOfType ? (L.coach?.[TYPE_LINE[step.type]] || '') : '';
  const sec = step.section && L.sections.find(s => s.id === step.section);
  switch (step.type) {
    case 'chord': {
      const n = S.steps.filter(s => s.type === 'chord').length;
      return firstOfType ? `${base} ${n > 1 ? `${n} new shapes — first up, ${step.chord}.` : `Just one new shape: ${step.chord}.`}` : pick([`Next shape: ${step.chord}.`, `Now ${step.chord}.`]);
    }
    case 'change': return firstOfType ? `${base} Let's start with ${step.pair[0]} to ${step.pair[1]}.` : `Now ${step.pair[0]} ⇄ ${step.pair[1]}.`;
    case 'section': return `${firstOfType ? base + ' ' : ''}${firstOfType ? `Starting with the ${sec.name}.` : `Now the ${sec.name}.`}${sec.tip ? ' ' + sec.tip : ''}`;
    case 'strum': return `${base || 'Let\'s lock in the rhythm.'} ${L.strum.tip || ''}`;
    case 'hum': return `${base} ${L.humming?.tip || ''} ${hasRealMelody() ? 'Press Play along and I\'ll hum it with you.' : 'I\'ll hum a simple guide on the chord notes to help you find your way.'}`;
    default: return base || '';
  }
}

async function goStep(i, { praise = false, intro = true } = {}) {
  cleanupLive(true);
  if (i >= S.steps.length) return finish();
  i = Math.max(0, i);
  S.idx = i;
  saveSong(); updateProgress();
  const step = S.steps[i];
  if (intro) {
    const line = stepLine(step, i).trim();
    await say(`${praise ? pick(PRAISE) + ' ' : ''}${line}`.trim() || step.title);
  } else await queue;
  const card = renderStep(step);
  live = { stepId: step.id, index: i, card, cleanup: card._cleanup || [] };
  addCard(card);
}

function completeStep() {
  const step = S.steps[S.idx];
  if (step && !S.done.includes(step.id)) S.done.push(step.id);
  goStep(S.idx + 1, { praise: true });
}

function cleanupLive(collapseIt) {
  activeUI?.stop();
  activeUI = null;
  tracker.stop();
  if (!live) return;
  live.cleanup.forEach(fn => { try { fn(); } catch {} });
  if (collapseIt && live.card.isConnected) {
    const idx = live.index;
    const step = S.steps[idx] || { title: 'Step' };
    collapse(live.card, step.title, 'Replay', () => goStep(idx, { intro: false }), S.done.includes(step.id));
  }
  live = null;
}

function collapse(card, title, action, onClick, done = true) {
  const c = h(`<div class="card collapsed"><div class="tick">${done ? '✓' : '•'}</div><b>${esc(title)}</b>${action ? `<span>${esc(action)} ↻</span>` : ''}</div>`);
  if (onClick) c.onclick = onClick; else c.style.cursor = 'default';
  card.replaceWith(c);
}

async function finish() {
  S.idx = S.steps.length; saveSong(); updateProgress();
  setPhase('done');
  await say(`You did it — you can strum and sing ${S.lesson.title} all the way through! 🎶`);
  await say('Tip: play the Whole song step once a day for a week. That\'s how it moves from your head into your hands.');
  const c = addCard(h(`<div class="card"><div class="eyebrow">Song learned</div><h3>${esc(S.lesson.title)}</h3>
    <div class="actions"><button class="btn clay" data-new>Learn another song</button><button class="btn ghost" data-again>Play it again</button></div></div>`));
  $('[data-new]', c).onclick = () => say('Love it. What\'s next?').then(() => setPhase('askSong'));
  $('[data-again]', c).onclick = () => { setPhase('lesson'); goStep(S.steps.findIndex(s => s.type === 'full'), { intro: false }); };
}

const chordOf = name => S.lesson.chords.find(c => c.name === name) || LIBRARY[name] || { name, frets: null };
const chordMap = () => Object.fromEntries(S.lesson.chords.map(c => [c.name, c]));
const beatsPerBar = ts => (ts === '3/4' ? 3 : ts === '6/8' ? 2 : 4);
const stepLabels = ts => (ts === '6/8' ? ['1', '2', '3', '4', '5', '6'] : ts === '3/4' ? ['1', '&', '2', '&', '3', '&'] : ['1', '&', '2', '&', '3', '&', '4', '&']);

function songBars() {
  const L = S.lesson, bars = [];
  for (const id of L.structure) {
    const s = L.sections.find(x => x.id === id);
    if (!s) continue;
    s.bars.forEach((b, k) => bars.push({ chords: b.split(' '), label: k === 0 ? s.name : null, section: s.id, k }));
  }
  const spb = L.timeSignature === '4/4' ? 8 : 6;
  if (L.melody) for (const b of bars) { const m = L.melody[b.section]?.[b.k]; if (m) b.melody = parseMelodyBar(m); }
  else {
    const guide = guideMelody(bars.map(b => b.chords), chordMap(), L.capo, spb);
    bars.forEach((b, i) => { b.melody = guide[i]; });
  }
  return bars;
}
const hasRealMelody = () => Boolean(S.lesson?.melody);
const LEVEL_PACE = { new: 0.85, some: 1, comfy: 1.12 };
const defaultBpm = factor => S.practiceBpm || Math.max(45, Math.min(S.lesson.bpm, Math.round(S.lesson.bpm * factor * (LEVEL_PACE[S.level] || 1))));

function renderStep(step) {
  const L = S.lesson;
  const card = h('<div class="card step-card"></div>');
  const doneBtn = label => { const b = h(`<button class="btn clay wide">${label || 'Got it — next'}</button>`); b.onclick = completeStep; return b; };

  if (step.type === 'chord') {
    const c = chordOf(step.chord);
    card.innerHTML = `<div class="eyebrow">New chord</div>
      <h3>${esc(c.name)} ${c.replaces ? `<span class="pill gold">easy swap for ${esc(c.replaces)}</span>` : ''}</h3>
      <div data-teach></div>
      <div class="diagrams" data-diagram hidden><div class="dcell">${chordDiagram(c, { size: 1.5 })}</div></div>
      <p>${esc(c.tip || '')}</p>
      <div class="actions"><button class="btn ghost" data-hear>${ICON.ear} Hear it</button><button class="btn ghost" data-pluck>Pluck each string</button><button class="btn ghost" data-view>Chord chart view</button></div>
      <div class="actions"></div>`;
    $('[data-hear]', card).onclick = async () => { await audio.unlock(); audio.strum(c, audio.now + 0.03, 'D', { capo: L.capo }); };
    $('[data-pluck]', card).onclick = async () => {
      await audio.unlock();
      const t0 = audio.now + 0.05;
      chordMidi(c, L.capo).forEach((m, k) => { if (m != null) audio.note(m, t0 + k * 0.4, { gain: 0.55 }); });
    };
    // optional real-hands clip: drop chord-videos/<Chord>.mp4 into the app and it appears here
    const vidName = c.name.replace(/#/g, 'sharp').replace(/\//g, '-');
    fetch(`chord-videos/${encodeURIComponent(vidName)}.mp4`, { method: 'HEAD' }).then(r => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('video')) return;
      const b = h('<button class="btn ghost">🎥 Watch real hands</button>');
      b.onclick = () => {
        let v = $('.hand-video', card);
        if (!v) { v = h(`<video class="hand-video" src="chord-videos/${encodeURIComponent(vidName)}.mp4" controls playsinline loop muted></video>`); $('[data-teach]', card).after(v); }
        v.hidden = false; v.play().catch(() => {});
      };
      $$('.actions', card)[0].append(b);
    }).catch(() => {});
    const teach = showMe(c, { auto: S.level === 'new' });
    $('[data-teach]', card).append(teach.el);
    card._cleanup = [teach.stop];
    $('[data-view]', card).onclick = e => {
      const d = $('[data-diagram]', card), t = $('[data-teach]', card);
      const toChart = d.hidden;
      d.hidden = !toChart; t.hidden = toChart;
      e.currentTarget.textContent = toChart ? 'RaiN, show me' : 'Chord chart view';
      if (toChart) teach.stop();
    };
    const row = $$('.actions', card)[1];
    row.append(doneBtn('Got it ✓'));
    const hard = h('<button class="btn ghost">This one\'s hard</button>');
    hard.onclick = () => handle(`I'm finding the ${c.name} chord hard.`);
    row.append(hard);
    return card;
  }

  if (step.type === 'change') {
    const [a, b] = step.pair;
    card.innerHTML = `<div class="eyebrow">Chord changes</div><h3>${esc(a)} ⇄ ${esc(b)}</h3>
      <p>Switch on every bar. Look for fingers that can stay put or slide — they're your anchors.</p>
      <div class="diagrams">${[a, b].map(n => `<div class="dcell" data-d="${esc(n)}"><div class="name">${esc(n)}</div>${chordDiagram(chordOf(n))}</div>`).join('')}</div>
      <div class="timer" style="margin-top:12px"><b data-t>1:00</b><span data-cnt>One-minute changes: switch every time RaiN does. Count your clean ones.</span></div>
      <div data-pa></div>`;
    const ts = L.timeSignature;
    const pattern = ts === '6/8' ? ['D', '-', '-', 'D', '-', '-'] : ts === '3/4' ? ['D', '-', 'D', '-', 'D', '-'] : ['D', '-', 'D', '-', 'D', '-', 'D', '-'];
    let changes = 0, last = null, timer = null, left = 60;
    const tEl = $('[data-t]', card), cEl = $('[data-cnt]', card);
    const stopTimer = () => { clearInterval(timer); timer = null; };
    const startTimer = () => {
      if (timer) return;
      timer = setInterval(() => {
        left--; tEl.textContent = `0:${String(Math.max(0, left)).padStart(2, '0')}`;
        if (left <= 0) { pa.stop(); }
      }, 1000);
    };
    const pa = playAlong({
      bars: [{ chords: [a] }, { chords: [b] }], pattern, bpm: Math.min(defaultBpm(0.6), 80), loop: true,
      onStart: () => {
        changes = 0; last = null; left = 60; tEl.textContent = '1:00'; cEl.textContent = 'Get ready…';
        stopTimer();
      },
      onStop: async () => {
        const finished = left <= 0;
        stopTimer();
        if (!finished || changes < 2) return;
        // RaiN only knows the changes she *called* — she can't hear your guitar, so she asks.
        const how = await ask(`That's a minute — I called ${changes} changes. How many felt clean for you?`, [
          { label: 'Most of them', value: 'most', match: /most|all|lots|good|clean/i },
          { label: 'About half', value: 'half', match: /half|some|ok/i },
          { label: 'Not many yet', value: 'few', match: /few|not|none|hard|bad/i }
        ]);
        say(how === 'most' ? 'Brilliant — try nudging the tempo up a little next round.'
          : how === 'half' ? 'That\'s real progress. Same tempo again — let your anchor fingers lead.'
          : 'Totally normal at first. Let\'s slow it down a touch and go again.', { fast: true });
      },
      onStep: ({ chord }) => {
        startTimer(); // the minute starts after the count-in
        $$('[data-d]', card).forEach(d => d.classList.toggle('on', d.dataset.d === chord));
        if (last && chord !== last) { changes++; cEl.textContent = `Changes called: ${changes}`; }
        last = chord;
      }
    });
    card._cleanup = [stopTimer];
    $('[data-pa]', card).append(pa.el);
    $('.actions', pa.el).append(doneBtn());
    return card;
  }

  if (step.type === 'strum') {
    const first = songBars()[0]?.chords[0] || L.chords[0]?.name;
    const options = Object.entries(PATTERNS).filter(([, p]) => p.timeSignature === L.timeSignature);
    card.innerHTML = `<div class="eyebrow">Strumming</div><h3>${esc(L.strum.name)}</h3>
      <p>↓ down · ↑ up · • miss the strings but keep your hand moving. Practising on ${esc(first)}.</p>
      ${L.strum.tip ? `<p class="note-small">${esc(L.strum.tip)}</p>` : ''}
      <div data-pa></div>
      <div class="label">Doesn't feel like the song? Try another pattern</div>
      <div class="picker">${options.map(([n]) => `<button type="button" class="chip" data-pat="${esc(n)}" aria-pressed="${n === L.strum.name}">${esc(n)}</button>`).join('')}</div>`;
    const pa = playAlong({ bars: [{ chords: [first] }], bpm: defaultBpm(0.75), loop: true, strumGrid: true, click: true });
    $('[data-pa]', card).append(pa.el);
    $('.actions', pa.el).append(doneBtn());
    $$('[data-pat]', card).forEach(b => b.onclick = () => {
      const p = patternFor(b.dataset.pat);
      if (!p) return;
      L.strum = p; saveSong();
      say(`Switched to ${p.name}. ${p.tip}`, { fast: true });
      goStep(S.idx, { intro: false });
    });
    return card;
  }

  if (step.type === 'section') {
    const sec = L.sections.find(s => s.id === step.section);
    card.innerHTML = `<div class="eyebrow">Section</div><h3>${esc(sec.name)}</h3><p>${sec.bars.length} bars · loop it until it feels easy, then nudge the tempo up.</p><div data-pa></div>`;
    const pa = playAlong({ bars: sec.bars.map(b => ({ chords: b.split(' ') })), bpm: defaultBpm(0.75), loop: true, chart: true, nowLine: true, strumGrid: true });
    $('[data-pa]', card).append(pa.el);
    $('.actions', pa.el).append(doneBtn());
    return card;
  }

  if (step.type === 'hum') return humCard(card, doneBtn);

  if (step.type === 'full') {
    card.innerHTML = `<div class="eyebrow">Whole song</div><h3>${esc(L.title)}</h3><p>Top to bottom, with a count-in. Don't stop for mistakes — keep the strum going and catch the next chord.</p><div data-pa></div>`;
    const pa = playAlong({ bars: songBars(), bpm: defaultBpm(0.9), loop: false, chart: true, nowLine: true, strumGrid: true, maxBpm: L.bpm + 20 });
    $('[data-pa]', card).append(pa.el);
    $('.actions', pa.el).append(doneBtn('I played it through ✓'));
    return card;
  }

  if (step.type === 'sing') return singCard(card, doneBtn);
  return card;
}

// ───────────────────────── "RaiN, show me" ─────────────────────────
function showMe(chord, { auto = false } = {}) {
  const capo = S.lesson?.capo || 0;
  const steps = chord.frets ? fingerSteps(chord, capo) : [];
  const el = h(`<div class="showme">
    <div class="showme-head"><span class="eyebrow">RaiN shows you · as you look down at your guitar</span><span class="showme-count" data-count></span></div>
    <div class="showme-board" data-board></div>
    <div class="showme-row">${handKey()}<p class="showme-text" data-text>Tap <b>Show me</b> and I'll place each finger with you.</p></div>
    <div class="showme-controls">
      <button class="btn clay" data-go>▶ RaiN, show me</button>
      <button class="btn ghost" data-prev aria-label="Previous step">‹</button>
      <button class="btn ghost" data-next aria-label="Next step">›</button>
    </div>
  </div>`);
  if (!steps.length) { el.innerHTML = '<p>I don\'t have a shape for this chord yet — ask me for an easier version.</p>'; return { el, stop() {} }; }
  let i = -1, token = 0, running = false;
  const board = $('[data-board]', el), text = $('[data-text]', el), count = $('[data-count]', el), go = $('[data-go]', el);
  const draw = (ringing = null) => {
    const st = steps[i] || { place: [], focus: {} };
    board.innerHTML = fretboardSVG(chord, { place: st.place, focus: st.focus, capo, ringing });
  };
  draw();
  const show = async (k, speakIt = true) => {
    i = Math.max(0, Math.min(steps.length - 1, k));
    const my = ++token;
    draw();
    text.textContent = steps[i].text;
    count.textContent = `${i + 1} / ${steps.length}`;
    if (speakIt) { caption.textContent = steps[i].text; await rain.speak(steps[i].text); }
    if (my !== token) return false;
    if (steps[i].listen) {
      await audio.unlock();
      audio.strum(chord, audio.now + 0.05, 'D', { capo });
      await wait(1300);
      const notes = chordMidi(chord, capo);
      for (let s = 0; s < 6; s++) {
        if (my !== token) return false;
        if (notes[s] == null) continue;
        audio.note(notes[s], audio.now + 0.02, { gain: 0.55 });
        draw(s); await wait(480);
      }
      if (my === token) draw();
    }
    return my === token;
  };
  const run = async () => {
    running = true; go.textContent = '⏸ Pause';
    await audio.unlock().catch(() => {});
    for (let k = i < 0 || i >= steps.length - 1 ? 0 : i; k < steps.length; k++) {
      const ok = await show(k);
      if (!ok || !running) return;
      await wait(500);
    }
    running = false; go.textContent = '↻ Show me again';
  };
  const pause = () => { running = false; token++; rain.stop(); go.textContent = '▶ Carry on'; };
  go.onclick = () => (running ? pause() : run());
  $('[data-next]', el).onclick = () => { pause(); show(i + 1); };
  $('[data-prev]', el).onclick = () => { pause(); show(i - 1); };
  if (auto) setTimeout(() => { if (el.isConnected) run(); }, 400);
  const ctl = { el, stop: () => { running = false; token++; go.textContent = '▶ Carry on'; } };
  teachers.add(ctl);
  return ctl;
}

// ───────────────────────── play-along component ─────────────────────────
function playAlong(o) {
  const L = S.lesson;
  const opts = { guitar: true, click: true, loop: false, chart: false, nowLine: false, strumGrid: false, pattern: L.strum.steps, ...o };
  const labels = stepLabels(L.timeSignature);
  const el = h(`<div class="pa">
    ${opts.nowLine ? '<div class="now-line"><span class="now-chord" data-now>–</span><span class="next-chord" data-next></span></div>' : ''}
    ${opts.chart ? '<div class="chart" data-chart style="position:relative"></div>' : ''}
    ${opts.strumGrid ? `<div class="strum" style="grid-template-columns:repeat(${opts.pattern.length},1fr)">${opts.pattern.map((s, k) => `<div class="cell ${s === '-' ? 'rest' : ''}">${s === 'D' ? '↓' : s === 'U' ? '↑' : '•'}<small>${labels[k] || ''}</small></div>`).join('')}</div>` : ''}
    <div class="controls">
      <div class="tempo"><span class="lbl">Tempo</span><input type="range" min="40" max="${opts.maxBpm || Math.max(L.bpm + 10, 100)}" value="${opts.bpm}" aria-label="Tempo"><output>${opts.bpm} bpm</output></div>
      <div class="toggles">
        <button type="button" class="toggle" data-k="guitar" aria-pressed="${opts.guitar}">RaiN plays guitar</button>
        <button type="button" class="toggle" data-k="click" aria-pressed="${opts.click}">Click</button>
        <button type="button" class="toggle" data-k="loop" aria-pressed="${opts.loop}">Loop</button>
        ${opts.hum != null ? `<button type="button" class="toggle" data-k="hum" aria-pressed="${opts.hum}">♪ RaiN hums</button>` : ''}
      </div>
      <div class="actions"><button class="btn white" data-play style="box-shadow:inset 0 0 0 2px var(--navy)">${ICON.play} Play along</button></div>
    </div>
  </div>`);

  const chartEl = $('[data-chart]', el);
  const barEls = [];
  if (chartEl) {
    let grid = null;
    opts.bars.forEach((b, k) => {
      if (b.label || !grid) {
        if (b.label) chartEl.append(h(`<div class="sec">${esc(b.label)}</div>`));
        grid = h('<div class="bars"></div>'); chartEl.append(grid);
      }
      const cell = h(`<div class="bar">${b.chords.length > 1 ? `<div class="two">${b.chords.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : esc(b.chords[0])}<div class="fill"></div></div>`);
      grid.append(cell); barEls[k] = cell;
    });
  }
  const cells = $$('.strum .cell', el);
  const slider = $('input[type=range]', el), out = $('output', el), playBtn = $('[data-play]', el);
  const nowEl = $('[data-now]', el), nextEl = $('[data-next]', el);
  let playing = false, lastBar = -1, wake = null;

  const toggles = {};
  $$('[data-k]', el).forEach(b => {
    toggles[b.dataset.k] = b.getAttribute('aria-pressed') === 'true';
    b.onclick = () => {
      toggles[b.dataset.k] = !toggles[b.dataset.k];
      b.setAttribute('aria-pressed', toggles[b.dataset.k]);
      if (b.dataset.k === 'hum') { if (playing) player.setHum(toggles.hum); rain.setHumming(playing && toggles.hum); }
      else if (player.o && playing) player.o[b.dataset.k] = toggles[b.dataset.k];
    };
  });
  slider.oninput = () => {
    const v = Number(slider.value);
    out.textContent = `${v} bpm`;
    S.practiceBpm = v;
    if (playing) player.setBpm(v);
  };

  const nextChordAfter = (bar, step) => {
    const b = opts.bars[bar];
    if (b.chords.length > 1 && step < opts.pattern.length / 2) return b.chords[1];
    const cur = b.chords[b.chords.length - 1];
    for (let k = bar + 1; k < opts.bars.length + (toggles.loop ? bar + 1 : 0); k++) {
      const nb = opts.bars[k % opts.bars.length];
      if (nb.chords[0] !== cur) return nb.chords[0];
    }
    return '';
  };

  function reset() {
    playing = false;
    playBtn.innerHTML = `${ICON.play} Play along`;
    cells.forEach(c => c.classList.remove('on'));
    barEls.forEach(b => { b.classList.remove('on'); $('.fill', b).style.width = 0; });
    if (nowEl) nowEl.textContent = '–';
    lastBar = -1;
    rain.setHumming(false);
    wake?.release?.().catch(() => {}); wake = null;
  }

  const api = {
    el,
    stop() { if (!playing) return; player.stop(); reset(); opts.onStop?.(); if (activeUI === api) activeUI = null; },
    setBpm(v) { slider.value = v; slider.oninput(); }
  };

  playBtn.onclick = async () => {
    if (playing) return api.stop();
    activeUI?.stop();
    rain.stop(); // music and RaiN's voice never talk over each other
    stopTeaching();
    activeUI = api;
    playing = true;
    playBtn.innerHTML = `${ICON.stop} Stop`;
    try { wake = await navigator.wakeLock?.request('screen'); } catch {}
    if (!playing || activeUI !== api) return;            // Stop was pressed while we were starting
    opts.onStart?.();
    const started = await player.start({
      bars: opts.bars, bpm: Number(slider.value), timeSignature: L.timeSignature, pattern: opts.pattern,
      chords: chordMap(), capo: L.capo, guitar: toggles.guitar, click: toggles.click, hum: Boolean(toggles.hum), loop: toggles.loop, countIn: true,
      onCount: n => { if (nowEl) nowEl.innerHTML = `<span class="count-in">${n}</span>`; else playBtn.innerHTML = `${ICON.stop} ${n}…`; },
      onStep: info => {
        if (!nowEl) playBtn.innerHTML = `${ICON.stop} Stop`;
        cells.forEach((c, k) => c.classList.toggle('on', k === info.step));
        if (info.bar !== lastBar && barEls.length) {
          barEls[lastBar]?.classList.remove('on');
          if (barEls[lastBar]) $('.fill', barEls[lastBar]).style.width = 0;
          const be = barEls[info.bar];
          be?.classList.add('on');
          if (be && chartEl) chartEl.scrollTop = Math.max(0, be.offsetTop - 60);
          lastBar = info.bar;
        }
        const be = barEls[info.bar];
        if (be) $('.fill', be).style.width = `${((info.step + 1) / opts.pattern.length) * 100}%`;
        if (nowEl) { nowEl.textContent = info.chord; nextEl.textContent = (n => (n ? `next: ${n}` : ''))(nextChordAfter(info.bar, info.step)); }
        opts.onStep?.(info);
      },
      onEnd: () => { reset(); opts.onStop?.(); opts.onEnd?.(); }
    });
    if (!started || !playing) { if (playing) reset(); return; }
    // pick up loop toggle changes live
    player.o.loop = toggles.loop;
    rain.setHumming(Boolean(toggles.hum));
  };
  // keep loop toggle live
  $('[data-k="loop"]', el).addEventListener('click', () => { if (player.o && playing) player.o.loop = toggles.loop; });
  return api;
}

// ───────────────────────── hum ─────────────────────────
function humCard(card, doneBtn) {
  const L = S.lesson;
  const first = parseNote(L.humming?.startNote);
  card.classList.add('dark');
  card.innerHTML = `<div class="eyebrow">Hum along</div><h3>Find the tune</h3>
    <p>${hasRealMelody()
      ? 'Press Play along and RaiN will hum the tune — hum with her. Switch on your mic to see your notes: gold lanes are the notes of the chord playing right now.'
      : 'Press Play along and RaiN hums a <b>guide line</b> on the chord notes. It isn\'t the song\'s real tune, but it shows you notes that fit. Hum the real melody over it, and switch on your mic to see your notes: gold lanes are the chord notes.'}</p>
    ${hasRealMelody() ? '' : `<p class="note-small">Need the tune in your ear first? <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${L.title} ${L.artist}`)}" target="_blank" rel="noopener" style="color:var(--gold);font-weight:800">Listen to the original ↗</a></p>`}
    <p class="note-small">🎧 Headphones help, so the mic hears you rather than the guitar.</p>
    <div class="actions">
      <button class="btn clay" data-mic>${ICON.mic} Start mic</button>
      ${first != null ? `<button class="btn ghost" data-first>${ICON.ear} First note (${esc(L.humming.startNote)}, approx.)</button>` : ''}
    </div>
    <canvas class="hum-canvas" width="680" height="260"></canvas>
    <div class="hum-stats">
      <div class="stat"><span>Your note</span><b data-note>–</b></div>
      <div class="stat"><span>In key</span><b data-key>–</b></div>
      <div class="stat"><span>On chord</span><b data-chordhit>–</b></div>
    </div>
    <div data-pa></div>`;
  const canvas = $('canvas', card), ctx = canvas.getContext('2d');
  const tonic = (scalePitchClasses(L.key, L.capo)[0] ?? 0);
  const scale = new Set(scalePitchClasses(L.key, L.capo));
  let chordPcs = new Set(), trail = [], voiced = 0, inKey = 0, onChord = 0, raf = null, micOn = false;

  const fit = () => { const r = canvas.getBoundingClientRect(); if (r.width) { canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio; } };
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function draw() {
    const W = canvas.width, H = canvas.height, dpr = devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);
    const lane = H / 12, left = 34 * dpr;
    for (let k = 0; k < 12; k++) {
      const pc = (tonic + k) % 12, y = H - (k + 1) * lane;
      if (chordPcs.has(pc)) { ctx.fillStyle = 'rgba(232,188,114,.32)'; ctx.fillRect(left, y + 1, W - left, lane - 2); }
      else if (scale.has(pc)) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(left, y + 1, W - left, lane - 2); }
      ctx.fillStyle = chordPcs.has(pc) ? '#e8bc72' : scale.has(pc) ? 'rgba(251,248,241,.7)' : 'rgba(251,248,241,.25)';
      ctx.font = `800 ${11 * dpr}px Nunito, system-ui`;
      ctx.fillText(NAMES[pc], 8 * dpr, y + lane / 2 + 4 * dpr);
    }
    const now = performance.now(), span = 7000;
    trail = trail.filter(p => now - p.t < span);
    for (const p of trail) {
      const x = W - ((now - p.t) / span) * (W - left);
      const rel = (((p.midi - tonic) % 12) + 12) % 12;
      const y = H - (rel + 0.5) * lane;
      ctx.fillStyle = p.chord ? '#e8bc72' : p.key ? '#d86531' : 'rgba(251,248,241,.45)';
      ctx.beginPath(); ctx.arc(x, y, 3.2 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }
  fit(); draw();

  const noteEl = $('[data-note]', card), keyEl = $('[data-key]', card), chEl = $('[data-chordhit]', card);
  const micBtn = $('[data-mic]', card);
  micBtn.onclick = async () => {
    if (micOn) { tracker.stop(); micOn = false; micBtn.innerHTML = `${ICON.mic} Start mic`; return; }
    try {
      const ok = await tracker.start(p => {
        if (!p) { noteEl.textContent = '–'; return; }
        const pc = ((Math.round(p.midi) % 12) + 12) % 12;
        const k = scale.has(pc), c = chordPcs.has(pc);
        trail.push({ t: performance.now(), midi: p.midi, key: k, chord: c });
        voiced++; if (k) inKey++; if (c) onChord++;
        noteEl.textContent = `${noteName(p.midi)}${Math.floor(Math.round(p.midi) / 12) - 1}`;
        keyEl.textContent = `${Math.round((inKey / voiced) * 100)}%`;
        chEl.textContent = `${Math.round((onChord / voiced) * 100)}%`;
      });
      if (!ok || !card.isConnected) return;
      micOn = true; micBtn.innerHTML = `${ICON.stop} Stop mic`;
      if (!activeUI) toast('Now press Play along and hum with RaiN');
    } catch (e) {
      say('I couldn\'t get to your microphone. Check the browser\'s mic permission for this site — or just hum along without the meter, that works too!', { fast: true });
    }
  };
  $('[data-first]', card)?.addEventListener('click', async () => { await audio.unlock(); audio.tone(first); });

  const pa = playAlong({
    bars: songBars(), bpm: defaultBpm(0.85), loop: true, chart: false, nowLine: true, strumGrid: true, click: false, hum: true,
    onStep: ({ chord }) => { chordPcs = new Set(chordMidi(chordOf(chord), L.capo).filter(m => m != null).map(m => m % 12)); }
  });
  $('[data-pa]', card).append(pa.el);
  $('.actions', pa.el).append(doneBtn('I can hum it ✓'));
  window.addEventListener('resize', fit);
  card._cleanup = [() => { cancelAnimationFrame(raf); tracker.stop(); window.removeEventListener('resize', fit); }];
  return card;
}

// ───────────────────────── sing ─────────────────────────
function singCard(card, doneBtn) {
  const L = S.lesson;
  const lkey = `ss.lyrics.${S.key}`;
  card.innerHTML = `<div class="eyebrow">Strum &amp; sing</div><h3>Sing it with me</h3>
    <p>Strum and sing along. Turn off "RaiN plays guitar" when you're ready to go solo.</p>
    <div data-pa></div>
    <div class="label">Your lyric sheet</div>
    <div data-lyrics></div>
    <p class="note-small">RaiN doesn't provide lyrics, out of respect for songwriters. Paste your own — they stay on this device.</p>`;
  const box = $('[data-lyrics]', card);
  let headings = [], chips = [];

  function renderView(text) {
    box.innerHTML = '';
    const view = h('<div class="lyrics-view"></div>');
    let sec = -1;
    text.split('\n').forEach(line => {
      const tokens = line.split(/(\[[^\]]{1,24}\])/);
      const lineEl = document.createElement('div');
      tokens.forEach(tok => {
        const m = /^\[([^\]]+)\]$/.exec(tok);
        if (m && /^[A-G][#b]?[a-z0-9#/]*$/.test(m[1].trim())) {
          const s = h(`<span class="ch">${esc(m[1].trim())}</span>`); s.dataset.sec = sec; s.dataset.c = cleanName(m[1].trim()); chips.push(s); lineEl.append(s);
        } else if (m) {
          sec++; const s = h(`<span class="hd">${esc(m[1])}</span>`); headings.push(s); lineEl.append(s);
        } else lineEl.append(document.createTextNode(tok));
      });
      if (!line.trim()) lineEl.innerHTML = '&nbsp;';
      view.append(lineEl);
    });
    const edit = h('<button class="btn ghost" style="margin-top:10px">Edit lyric sheet</button>');
    edit.onclick = () => renderEdit(text);
    box.append(view, edit);
    box._view = view;
  }
  function renderEdit(text = '') {
    headings = []; chips = [];
    box.innerHTML = '';
    const ta = h(`<textarea class="lyrics-edit" placeholder="Paste your own lyric sheet here.&#10;&#10;Tip: add section headings like [Verse] or [Chorus], and chords inline like [G] or [Em] — RaiN will light them up as you play."></textarea>`);
    ta.value = text;
    const save = h('<button class="btn clay" style="margin-top:10px">Save lyric sheet</button>');
    save.onclick = () => { store.set(lkey, ta.value); headings = []; chips = []; ta.value.trim() ? renderView(ta.value) : renderEdit(''); };
    box.append(ta, save);
  }
  const saved = store.get(lkey, '');
  saved ? renderView(saved) : renderEdit('');

  // which section instance are we in?
  const bars = songBars();
  const instanceOfBar = []; let inst = -1;
  bars.forEach((b, k) => { if (b.label) inst++; instanceOfBar[k] = inst; });
  const nameOfInstance = i => L.sections.find(s => s.id === L.structure[i])?.name.toLowerCase() || '';

  const pa = playAlong({
    bars, bpm: defaultBpm(0.95), loop: false, chart: true, nowLine: true, strumGrid: true, maxBpm: L.bpm + 20, hum: hasRealMelody(),
    onStep: ({ bar, chord }) => {
      if (!headings.length && !chips.length) return;
      const i = instanceOfBar[bar];
      let hIdx = headings.length === L.structure.length ? i : headings.findIndex(hd => nameOfInstance(i).startsWith(hd.textContent.toLowerCase().split(/\s/)[0]));
      headings.forEach((hd, k) => hd.classList.toggle('on', k === hIdx));
      chips.forEach(c => c.classList.toggle('on', c.dataset.c === chord && (hIdx < 0 || Number(c.dataset.sec) === hIdx)));
      const target = headings[hIdx];
      if (target && box._view && target._shown !== true) {
        headings.forEach(x => (x._shown = false)); target._shown = true;
        box._view.scrollTop = target.parentElement.offsetTop - box._view.offsetTop - 8;
      }
    }
  });
  $('[data-pa]', card).append(pa.el);
  $('.actions', pa.el).append(doneBtn('I sang it! 🎶'));
  return card;
}

// ───────────────────────── chat during lesson ─────────────────────────
function currentChordName() {
  const st = S.steps[S.idx];
  if (st?.chord) return st.chord;
  if (st?.pair) return st.pair.find(n => !chordOf(n).known) || st.pair[1];
  return S.lesson.chords.find(c => !c.known)?.name || S.lesson.chords[0]?.name;
}

async function lessonChat(text) {
  if (/^why the capo\??$/i.test(text) && S.lesson) {
    const L = S.lesson;
    return say(L.capo
      ? `The original sounds in ${L.concertKey}. A capo on fret ${L.capo} shifts everything up, so you can play easy ${L.key} shapes and still match the record — and your voice.`
      : `This one sits nicely in open position, so no capo needed. A capo just shifts the pitch up so easy shapes can match the original.`, { fast: true });
  }
  const showM = /(?:show me|how (?:do|to) (?:i )?play|teach me)\s+(?:the\s+|an?\s+)?([A-G][#b]?(?:maj7|m7|m|7|sus2|sus4|add9|dim|\/[A-G])*)\b/i.exec(text);
  if (showM && (S.lesson?.chords.some(c => c.name.toLowerCase() === showM[1].toLowerCase()) || LIBRARY[cleanName(showM[1])])) {
    const name = cleanName(showM[1]);
    const ch = S.lesson?.chords.find(c => c.name.toLowerCase() === showM[1].toLowerCase()) || LIBRARY[name];
    await say(`Sure — let's place ${ch.name} together, one finger at a time.`, { fast: true });
    const c = h(`<div class="card"><div class="eyebrow">Chord</div><h3>${esc(ch.name)}</h3></div>`);
    const t = showMe(ch, { auto: true });
    c.append(t.el); addCard(c);
    live?.cleanup.push(t.stop);
    return;
  }
  if (/^this chord is hard$/i.test(text)) text = `I'm finding the ${currentChordName()} chord hard.`;
  if (/^(skip( ahead)?|next( step)?)$/i.test(text)) { await say('Onwards! You can always come back.', { fast: true }); return goStep(S.idx + 1, { intro: true }); }
  if (/^(go )?back( a step)?$/i.test(text)) { await say('Sure, let\'s go back one.', { fast: true }); return goStep(S.idx - 1); }
  await queue;
  const t = typing();
  try {
    const res = await chat({
      lesson: S.lesson, knownChords: S.known, steps: S.steps, currentStep: S.steps[S.idx],
      practiceBpm: S.practiceBpm || S.lesson.bpm, history: S.history.slice(0, -1), message: text
    });
    t.remove();
    if (res.reply) await say(res.reply, { fast: true });
    for (const a of res.actions || []) applyAction(a);
  } catch (e) {
    t.remove();
    say(`Sorry, I lost my train of thought (${e.message}). Try again?`, { fast: true });
  }
}

function applyAction(a) {
  if (a.type === 'set_bpm' && a.bpm) {
    const v = Math.max(40, Math.min(220, Math.round(a.bpm)));
    S.practiceBpm = v;
    if (activeUI) activeUI.setBpm(v);
    else if (live) $$('input[type=range]', live.card).forEach(r => { r.value = v; r.oninput?.(); });
    toast(`Tempo set to ${v} bpm`);
  }
  if (a.type === 'goto_step' && a.step) {
    const i = S.steps.findIndex(s => s.id === a.step);
    if (i >= 0) goStep(i, { intro: false });
  }
  if (a.type === 'swap_chord' && a.from && a.to) swapChord(a);
}

function swapChord({ from, to, frets, fingers, tip }) {
  const L = S.lesson;
  from = cleanName(from); to = cleanName(to);
  const old = L.chords.find(c => c.name === from);
  if (!old) return;
  const lib = LIBRARY[to];
  const shape = lib || (Array.isArray(frets) && frets.length === 6 ? { frets, fingers: fingers?.length === 6 ? fingers : [0, 0, 0, 0, 0, 0] } : null);
  if (!shape) return;
  const curId = S.steps[S.idx]?.id;
  const replacement = { name: to, frets: shape.frets.slice(), fingers: shape.fingers.slice(), tip: tip || lib?.tip || '', replaces: old.replaces || from, known: S.known.includes(to) };
  if (L.chords.some(c => c.name === to)) L.chords = L.chords.filter(c => c.name !== from);
  else L.chords = L.chords.map(c => (c.name === from ? replacement : c));
  L.sections.forEach(s => { s.bars = s.bars.map(b => b.split(' ').map(n => (n === from ? to : n)).join(' ')); });
  S.steps = buildSteps(L);
  const mapped = curId?.replace(new RegExp(`\\b${from.replace(/[#/]/g, '\\$&')}\\b`, 'g'), to);
  let i = S.steps.findIndex(s => s.id === mapped);
  if (i < 0) i = Math.min(S.idx, S.steps.length - 1);
  saveSong();
  toast(`Swapped ${from} → ${to} everywhere`);
  goStep(i, { intro: false });
}

// ───────────────────────── progress, songs, settings ─────────────────────────
function updateProgress() {
  const bar = $('#progress');
  if (!S.lesson) { bar.hidden = true; return; }
  bar.hidden = false;
  $('#progressSong').textContent = S.lesson.title;
  $('#progressDots').innerHTML = S.steps.map((s, k) => `<i class="${S.done.includes(s.id) ? 'done' : ''} ${k === S.idx ? 'now' : ''}"></i>`).join('');
  $('#progressCount').textContent = S.idx >= S.steps.length ? 'Done 🎉' : S.idx < 0 ? 'Plan' : `${S.idx + 1}/${S.steps.length}`;
}

function saveSong() {
  if (!S.lesson || !S.key) return;
  const songs = store.get('ss.songs', {});
  songs[S.key] = { key: S.key, title: S.lesson.title, artist: S.lesson.artist, lesson: S.lesson, known: S.known, level: S.level, idx: S.idx, done: S.done, practiceBpm: S.practiceBpm, updated: Date.now() };
  store.set('ss.songs', songs);
}

function recentCard(list) {
  const card = h('<div class="card"><div class="eyebrow">Your songs</div></div>');
  list.forEach(s => card.append(songRow(s, () => resume(s))));
  return card;
}
function songRow(s, onOpen, onDelete) {
  const total = buildSteps(s.lesson).length;
  const row = h(`<div class="song-row" role="button" tabindex="0"><div class="tile">${esc(s.title[0] || '♪')}</div>
    <div class="info"><b>${esc(s.title)}</b><small>${esc(s.artist || '')} · ${s.idx >= total ? 'learned ✓' : `step ${Math.max(0, s.idx) + 1} of ${total}`}</small></div>
    ${onDelete ? '<button class="del" aria-label="Remove">×</button>' : '<span aria-hidden="true">›</span>'}</div>`);
  row.onclick = e => { if (e.target.closest('.del')) return; onOpen(); };
  row.onkeydown = e => { if (e.key === 'Enter') onOpen(); };
  if (onDelete) $('.del', row).onclick = onDelete;
  return row;
}

async function resume(s) {
  closeSheet();
  cleanupLive(true);
  Object.assign(S, { lesson: s.lesson, known: s.known || [], level: s.level || 'some', idx: s.idx, done: s.done || [], practiceBpm: s.practiceBpm || null, key: s.key, song: s.title });
  S.steps = buildSteps(S.lesson);
  setPhase('lesson');
  updateProgress();
  addMsg('user', `Let's carry on with ${s.title}`);
  if (S.idx < 0) { await say(`Welcome back! Here's your plan for ${s.title}.`); addCard(overviewCard()); return; }
  if (S.idx >= S.steps.length) { await say(`You've already learned ${s.title} — let's play it through.`); return goStep(S.steps.findIndex(x => x.type === 'full'), { intro: false }); }
  await say(`Welcome back! Picking up at "${S.steps[S.idx].title}".`);
  goStep(S.idx, { intro: false });
}

const sheet = $('#sheet'), backdrop = $('#backdrop');
function openSheet(content) {
  sheet.innerHTML = '<div class="grab"></div>';
  sheet.append(content);
  sheet.hidden = false; backdrop.hidden = false;
}
function closeSheet() { sheet.hidden = true; backdrop.hidden = true; }
backdrop.onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

$('#songsBtn').onclick = () => {
  const wrap = h('<div><h2>My songs</h2><p>Songs you\'ve started with RaiN. Progress is saved on this device.</p><div data-list></div><div class="actions" style="margin-top:12px"><button class="btn clay wide" data-new>Learn a new song</button></div></div>');
  const list = $('[data-list]', wrap);
  const draw = () => {
    list.innerHTML = '';
    const songs = Object.values(store.get('ss.songs', {})).sort((a, b) => b.updated - a.updated);
    if (!songs.length) list.innerHTML = '<p><b>No songs yet.</b> Tell RaiN a song to get started.</p>';
    songs.forEach(s => list.append(songRow(s, () => resume(s), () => {
      const all = store.get('ss.songs', {}); delete all[s.key]; store.set('ss.songs', all); draw();
    })));
  };
  draw();
  $('[data-new]', wrap).onclick = () => { closeSheet(); cleanupLive(true); say('Brilliant — what song next?').then(() => setPhase('askSong')); input.focus(); };
  openSheet(wrap);
};

$('#progressBtn').onclick = () => {
  if (!S.lesson) return;
  const wrap = h(`<div><h2>${esc(S.lesson.title)}</h2><p>Jump to any step.</p></div>`);
  S.steps.forEach((s, k) => {
    const b = h(`<button class="step-jump ${S.done.includes(s.id) ? 'done' : ''} ${k === S.idx ? 'now' : ''}"><span class="n">${S.done.includes(s.id) ? '✓' : k + 1}</span>${esc(s.title)}</button>`);
    b.onclick = () => { closeSheet(); setPhase('lesson'); goStep(k, { intro: k !== S.idx }); };
    wrap.append(b);
  });
  openSheet(wrap);
};

$('#settingsBtn').onclick = async () => {
  const mode = await detectMode(true);
  modeCache = mode;
  const wrap = h(`<div><h2>Settings</h2>
    <div class="status ${mode === 'demo' ? 'demo' : ''}"><i></i>${esc(modeLabel())}</div>
    <p>When this app runs from its own little server with an API key, RaiN is connected automatically. Otherwise you can paste your own Anthropic API key below — it's stored only in this browser.</p>
    <div ${ownKeyAllowed ? '' : 'hidden'}>
    <label class="field">Anthropic API key<input type="password" data-key placeholder="sk-ant-…" value="${esc(store.get('ss.apiKey', '') || '')}" autocomplete="off"></label>
    <label class="field">Model<input type="text" data-model placeholder="claude-sonnet-5-5" value="${esc(store.get('ss.model', '') || '')}"></label>
    </div>
    <div class="row" style="margin:6px 0 14px"><button class="toggle" data-demo aria-pressed="${store.get('ss.forceDemo', false)}">Offline demo only</button></div>
    <label class="field">RaiN's voice<select data-voice class="lyrics-edit" style="min-height:0;padding:12px"><option value="">Automatic (warmest available)</option>${rain.voices().map(v => `<option ${store.get('ss.voiceName') === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <div class="row" style="margin:6px 0 14px">
      <button class="toggle" data-shades aria-pressed="${rain.shadesOn()}">😎 RaiN's sunglasses</button>
      <button class="btn ghost" data-about>Change my level &amp; goal</button>
      <button class="btn ghost" data-install>Add to Home Screen</button>
    </div>
    <div class="actions"><button class="btn clay" data-save>Save</button><button class="btn ghost" data-clear>Clear all songs</button></div>
  </div>`);
  $('[data-demo]', wrap).onclick = e => e.currentTarget.setAttribute('aria-pressed', e.currentTarget.getAttribute('aria-pressed') !== 'true');
  $('[data-save]', wrap).onclick = async () => {
    const k = $('[data-key]', wrap).value.trim(), m = $('[data-model]', wrap).value.trim();
    k ? store.set('ss.apiKey', k) : store.del('ss.apiKey');
    m ? store.set('ss.model', m) : store.del('ss.model');
    store.set('ss.forceDemo', $('[data-demo]', wrap).getAttribute('aria-pressed') === 'true');
    const vn = $('[data-voice]', wrap).value; vn ? store.set('ss.voiceName', vn) : store.del('ss.voiceName');
    modeCache = await detectMode(true);
    closeSheet(); updateQuick();
    toast(modeLabel());
  };
  $('[data-voice]', wrap).onchange = e => { e.target.value ? store.set('ss.voiceName', e.target.value) : store.del('ss.voiceName'); rain.refreshVoice(); rain.unlockVoice(); rain.speak('Hi, I\'m RaiN. Take your time — we\'ll learn this together.'); };
  $('[data-shades]', wrap).onclick = e => { const v = !rain.shadesOn(); rain.setShades(v); e.currentTarget.setAttribute('aria-pressed', v); };
  $('[data-about]', wrap).onclick = async () => {
    closeSheet(); cleanupLive(true);
    await askAboutYou();
    await say(`Got it. ${S.lesson ? 'This applies to your next song.' : ''} What would you like to play?`);
    setPhase('askSong');
  };
  $('[data-install]', wrap).onclick = async () => {
    if (installPrompt) { await installPrompt.prompt(); installPrompt = null; }
    else toast('On iPhone: Share → Add to Home Screen. On Android/desktop: use the browser\'s Install option.');
  };
  $('[data-clear]', wrap).onclick = () => {
    const all = store.get('ss.songs', {});
    Object.keys(all).forEach(k => store.del(`ss.lyrics.${k}`));
    store.del('ss.songs'); toast('All songs cleared');
  };
  openSheet(wrap);
};

// ───────────────────────── go ─────────────────────────
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { activeUI?.stop(); rain.stop(); tracker.stop(); rain.stopListening(); stopTeaching(); } });
detectMode().then(m => { modeCache = m; });
if (S.level && S.goal) { $('#splash h1').innerHTML = 'Welcome back<br>to <em>RaiN</em>'; }

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
