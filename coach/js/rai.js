// Rai — the talking character. SVG face with blinking eyes and a moving mouth,
// a voice via the browser's speech synthesis, and listening via speech recognition.
import { store } from './coach.js';

export const RAI_SVG = `
<svg class="rai" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <linearGradient id="raiBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b172e"/><stop offset="1" stop-color="#245f73"/></linearGradient>
    <linearGradient id="raiHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2419"/><stop offset="1" stop-color="#1f130d"/></linearGradient>
    <linearGradient id="raiShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a3a2a" stop-opacity=".9"/><stop offset="1" stop-color="#5a3a2a" stop-opacity="0"/></linearGradient>
    <linearGradient id="raiLens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#0c0c0e"/></linearGradient>
    <clipPath id="raiClip"><circle cx="100" cy="100" r="96"/></clipPath>
  </defs>
  <circle cx="100" cy="100" r="96" fill="url(#raiBg)"/>
  <g clip-path="url(#raiClip)">
    <g class="rai-body">
      <!-- long wavy dark brown hair (back) -->
      <path d="M36 116C26 62 60 24 104 24s78 40 66 94c-3 12 9 22 5 36-3 12-12 16-9 28 2 10-4 18-6 28H40c-2-10-8-18-6-28 3-12-6-16-9-28-4-14 8-24 5-36Z" fill="url(#raiHair)"/>
      <path d="M34 130c-6 10 4 20-2 32M166 130c6 10-4 20 2 32M40 96c-8 8-6 18-10 26M160 96c8 8 6 18 10 26" stroke="#4e3224" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>
      <!-- neck -->
      <path d="M86 138h28v28c-6 9-22 9-28 0Z" fill="#e2a47c"/>
      <!-- rust t-shirt covering the shoulders (drawn over the hair, so the hair sits behind) -->
      <path d="M22 214c3-34 26-50 58-54 6 12 34 12 40 0 32 4 55 20 58 54Z" fill="#c8642e"/>
      <path d="M80 160c6 12 34 12 40 0" stroke="#a84f22" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M44 186c4 8 6 18 6 28M156 186c-4 8-6 18-6 28" stroke="#a84f22" stroke-width="1.6" fill="none" opacity=".6"/>
      <!-- face -->
      <ellipse cx="100" cy="102" rx="40" ry="47" fill="#edb990"/>
      <!-- small gold drop earrings -->
      <circle cx="61" cy="118" r="2" fill="#e8bc72"/><path d="M61 120v5" stroke="#e8bc72" stroke-width="1.6"/><circle cx="61" cy="127" r="2.6" fill="#e8bc72"/>
      <circle cx="139" cy="118" r="2" fill="#e8bc72"/><path d="M139 120v5" stroke="#e8bc72" stroke-width="1.6"/><circle cx="139" cy="127" r="2.6" fill="#e8bc72"/>
      <!-- side-swept fringe, parting on her left -->
      <path d="M56 106C52 60 78 34 108 34c30 0 48 24 44 66-6-24-18-40-34-48-14 16-38 30-62 54Z" fill="url(#raiHair)"/>
      <path d="M118 52c-10 18-30 34-52 46" stroke="url(#raiShine)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M122 50c10 10 20 26 24 44" stroke="#5a3a2a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>
      <!-- brows -->
      <path class="rai-brow" d="M73 88q10-6 19-1" stroke="#2a1a12" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path class="rai-brow" d="M108 87q10-5 19 1" stroke="#2a1a12" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <!-- eyes -->
      <g class="rai-eyes">
        <ellipse cx="82" cy="102" rx="5.5" ry="6.5" fill="#1d1416"/><ellipse cx="118" cy="102" rx="5.5" ry="6.5" fill="#1d1416"/>
        <circle cx="84" cy="100" r="1.8" fill="#fff"/><circle cx="120" cy="100" r="1.8" fill="#fff"/>
      </g>
      <!-- sunglasses (optional) -->
      <g class="rai-glasses">
        <path d="M60 98l10 1M140 98l-10 1" stroke="#141416" stroke-width="3" stroke-linecap="round"/>
        <rect x="68" y="92" width="28" height="20" rx="9" fill="url(#raiLens)" stroke="#141416" stroke-width="2"/>
        <rect x="104" y="92" width="28" height="20" rx="9" fill="url(#raiLens)" stroke="#141416" stroke-width="2"/>
        <path d="M96 99q4-3 8 0" stroke="#141416" stroke-width="2.6" fill="none"/>
        <path d="M73 96l7 0M109 96l7 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".35"/>
      </g>
      <!-- cheeks -->
      <ellipse cx="73" cy="120" rx="8" ry="4.6" fill="#d9705a" opacity=".25"/><ellipse cx="127" cy="120" rx="8" ry="4.6" fill="#d9705a" opacity=".25"/>
      <!-- nose -->
      <path d="M100 107q-3 8 1.5 11" stroke="#c98a66" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <!-- mouths: one shown at a time -->
      <g class="rai-mouth">
        <path data-m="smile" d="M86 129q14 11 28 0" stroke="#a8483e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
        <path data-m="a" d="M87 128q13 -3 26 0q-2 14 -13 14t-13 -14Z" fill="#7d2a25"/>
        <path data-m="o" d="M93 127q7 -3 14 0q2 11 -7 12t-7 -12Z" fill="#7d2a25"/>
        <path data-m="e" d="M86 129q14 -2 28 0q-3 7 -14 7t-14 -7Z" fill="#7d2a25"/>
        <path data-m="hum" d="M90 130q10 5 20 0" stroke="#a8483e" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
    </g>
  </g>
</svg>`;

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const listeners = new Set();
let speaking = false;
let mouthTimer = null;

export const voiceOn = () => store.get('ss.voice', true);
export const setVoiceOn = v => { store.set('ss.voice', v); if (!v) stop(); };
export const onSpeakingChange = fn => listeners.add(fn);
const emit = v => { speaking = v; listeners.forEach(fn => fn(v)); };
export const isSpeaking = () => speaking;

function setMouth(shape) {
  document.querySelectorAll('.rai-mouth [data-m]').forEach(p => (p.style.display = p.dataset.m === shape ? '' : 'none'));
}
function animateMouth(on) {
  clearInterval(mouthTimer);
  if (!on) return setMouth(document.body.classList.contains('humming') ? 'hum' : 'smile');
  const seq = ['a', 'e', 'o', 'smile', 'a', 'o', 'e', 'a'];
  let i = 0;
  mouthTimer = setInterval(() => setMouth(seq[(i++) % seq.length]), 115);
}

let chosen = null;
// Warm, nurturing female voices first — natural/premium ones before the robotic defaults.
// RaiN is a young British woman, so UK voices come first.
const PREFERRED = [
  /Libby.*Natural|Sonia.*Natural|Maisie.*Natural|Hollie.*Natural|Bella.*Natural/i, // Edge natural UK voices
  /Serena/i, /Kate/i, /Martha/i, /Stephanie/i, /Flo\b.*UK|Flo \(English \(UK/i, // Apple UK
  /Google UK English Female/i,                           // Chrome UK
  /Fiona/i, /Moira/i,                                    // Scottish / Irish
  /Samantha/i, /Ava/i, /Allison/i, /Karen/i, /Tessa/i,   // other English
  /Female|Woman/i
];
const NOVELTY = /Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Shelley|Sandy|Rocko|Eddy|Reed/i;
const MALE = /Daniel|Arthur|Fred|Rishi|Aaron|Alex\b|Oliver|Tom\b|Gordon|Lee\b|Ralph|Albert|Bruce|Junior|Ryan|Guy|George|Thomas|Eddy|Reed|Rocko|Grandpa|Male|Ravi|Prabhat|Brian|Davis|Christopher|Eric|Roger|Steffan/i;

const isFemale = v => /^en(-|_|$)/i.test(v.lang) && !MALE.test(v.name);
const rank = v => { const i = PREFERRED.findIndex(re => re.test(v.name)); return i < 0 ? 99 : i; };
const bad = new Set(); // voices that failed this session — never fall back to them

export const voices = () => {
  if (!('speechSynthesis' in window)) return [];
  // On-device voices ALWAYS first: Chrome's online voices (e.g. "Google UK English Female")
  // sometimes drop out mid-session and Chrome then silently uses the system default — often male.
  return speechSynthesis.getVoices()
    .filter(v => isFemale(v) && !NOVELTY.test(v.name))
    .sort((a, b) => Number(a.localService === false) - Number(b.localService === false) || rank(a) - rank(b));
};
function pickVoice() {
  const saved = store.get('ss.voiceName');
  if (saved && !bad.has(saved)) { const v = speechSynthesis.getVoices().find(x => x.name === saved); if (v) return v; }
  return voices().find(v => !bad.has(v.name)) || null;
}
// Lock the voice for the session once chosen; only a Settings change re-picks it.
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (!chosen) chosen = pickVoice(); };

function voicesReady() {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise(r => {
    const t = setTimeout(r, 1500);
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); r(); }, { once: true });
  });
}

export function refreshVoice() { chosen = pickVoice(); }
export const currentVoice = () => chosen?.name || null;

/** Call from a tap so mobile browsers allow speech later. */
export function unlockVoice() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
  voicesReady().then(() => { if (!chosen) chosen = pickVoice(); });
}

/** Speak a line. Resolves when finished (or roughly when it would be, if voice is off). */
export async function speak(text, retry = true) {
  const clean = String(text).replace(EMOJI, '').replace(/\s+/g, ' ').replace(/⇄/g, ' to ').trim();
  if (!clean) return;
  const est = Math.min(10000, 600 + clean.length * 62);
  if (!voiceOn() || !('speechSynthesis' in window)) {
    // still animate the face briefly so RaiN feels alive
    emit(true); animateMouth(true);
    await new Promise(r => setTimeout(r, Math.min(1400, 300 + clean.length * 12)));
    animateMouth(false); emit(false);
    return;
  }
  await voicesReady();
  if (!chosen) chosen = pickVoice();
  // Chrome bug: speak() straight after cancel() can ignore the chosen voice. Give it a beat.
  if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); await new Promise(r => setTimeout(r, 80)); }
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(clean);
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; u.pitch = 1.04; }
    else { u.lang = 'en-GB'; u.pitch = 1.15; } // no female voice found: lift the default a little
    u.rate = 0.94; // a touch slower: calm, nurturing
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(guard); animateMouth(false); emit(false); resolve(); };
    const guard = setTimeout(finish, est + 2500); // some browsers never fire onend
    u.onstart = () => { emit(true); animateMouth(true); };
    u.onend = finish;
    u.onerror = e => {
      // a voice that fails (e.g. an online voice offline) is dropped for another female voice
      if (retry && chosen && !['interrupted', 'canceled'].includes(e.error)) {
        bad.add(chosen.name); chosen = pickVoice();
        done = true; clearTimeout(guard);
        speak(text, false).then(resolve);
      } else finish();
    };
    emit(true); animateMouth(true);
    speechSynthesis.speak(u);
  });
}

// ── humming face: lips closed, little notes float up ──
export function setHumming(on) {
  document.body.classList.toggle('humming', on);
  if (on && !speaking) { clearInterval(mouthTimer); setMouth('hum'); }
  else if (!on && !speaking) setMouth('smile');
}

export function stop() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  animateMouth(false); emit(false);
}

// ── listening ──
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(SR);
let rec = null;
export function listen({ onInterim, onFinal, onEnd }) {
  if (!SR) return null;
  stop();
  rec = new SR();
  rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-GB';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    onInterim?.(final + interim);
  };
  rec.onend = () => { rec = null; final.trim() ? onFinal?.(final.trim()) : onEnd?.(); onEnd?.(); };
  rec.onerror = () => {};
  rec.start();
  return rec;
}
export function stopListening() { rec?.stop(); }

export const shadesOn = () => store.get('ss.shades', false);
export function setShades(v) { store.set('ss.shades', v); document.body.classList.toggle('shades', v); }
document.body.classList.toggle('shades', shadesOn());
