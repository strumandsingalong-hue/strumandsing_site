// Talks to the AI coach. Three modes, picked automatically:
//  server – RaiN's backend holds the API key: Supabase Edge Function or local `node server.js` (see config.js)
//  direct – the learner pasted their own key in Settings (fine for a personal PWA)
//  demo   – offline, traditional songs only
import { buildLessonRequest, buildChatRequest, extractToolInput, shapeChart, DEFAULT_MODEL, API_VERSION } from './prompts.js';
import { demoLesson, demoChat } from './demo.js';
import { REVIEWED_SONGS } from './reviewed-songs.js';
import { RAIN_API, ALLOW_OWN_KEY } from '../config.js';

const API = (RAIN_API || '/api').replace(/\/$/, '');
export const ownKeyAllowed = ALLOW_OWN_KEY;

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
export { store };

let mode = null;
let serverModel = null;

export async function detectMode(force = false) {
  if (mode && !force) return mode;
  const forced = store.get('ss.forceDemo', false);
  if (forced) return (mode = 'demo');
  try {
    const r = await fetch(`${API}/health`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (j.ai) { serverModel = j.model; return (mode = 'server'); }
    }
  } catch {}
  if (ALLOW_OWN_KEY && store.get('ss.apiKey')) return (mode = 'direct');
  return (mode = 'demo');
}

export const modeLabel = () => ({
  server: `AI coach connected${serverModel ? ` · ${serverModel}` : ''}`,
  direct: 'AI coach using your key',
  demo: `Offline · ${REVIEWED_SONGS.length} checked songs + 3 demos`
}[mode] || '…');

async function direct(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': store.get('ss.apiKey'),
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `AI request failed (${res.status})`);
  return extractToolInput(data);
}

async function server(route, payload) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Coach server error (${res.status})`);
  return data;
}

// ── checked songs bundled in the app: instant, free and offline ──
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\b(by|song|chords|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
export function findReviewed(query) {
  const q = norm(query);
  if (!q) return null;
  const words = new Set(q.split(' '));
  let best = null, bestScore = 0;
  for (const c of REVIEWED_SONGS) {
    const t = norm(c.title), a = norm(c.artist);
    let score = 0;
    if (q === t || q === `${t} ${a}` || q === `${a} ${t}`) score = 3;
    else if (` ${q} `.includes(` ${t} `) && a.split(' ').some(w => w.length > 2 && words.has(w))) score = 2;
    else if (` ${q} `.includes(` ${t} `) && t.split(' ').length >= 2) score = 1; // multi-word title on its own
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best ? structuredClone(best) : null;
}
export const REVIEWED_TITLES = REVIEWED_SONGS.map(c => c.title);

/** Fetch a song's chart at concert pitch. The arranger picks capo + shapes afterwards. */
export async function fetchChart({ song }) {
  const checked = findReviewed(song);
  if (checked) return { ...checked, songKey: null, cached: true };
  await detectMode();
  if (mode === 'server') {
    const r = await server('chart', { song });
    return r.lesson && { ...shapeChart(r.lesson), songKey: r.songKey, cached: r.cached };
  }
  if (mode === 'direct') return shapeChart(await direct(buildLessonRequest({ song, model: store.get('ss.model') || DEFAULT_MODEL })));
  await new Promise(r => setTimeout(r, 900));
  return demoLesson(song);
}

/** "These chords sound wrong" → saved for you to review (server mode only). */
export async function reportChart({ songKey, note }) {
  await detectMode();
  if (mode !== 'server' || !songKey) return { ok: true };
  return server('report', { songKey, note });
}

export async function chat(ctx) {
  await detectMode();
  const payload = {
    lesson: ctx.lesson, knownChords: ctx.knownChords, practiceBpm: ctx.practiceBpm,
    steps: ctx.steps.map(s => ({ id: s.id, title: s.title })),
    currentStep: ctx.currentStep && { id: ctx.currentStep.id, title: ctx.currentStep.title },
    history: ctx.history, message: ctx.message
  };
  if (mode === 'server') return server('chat', payload);
  if (mode === 'direct') return direct(buildChatRequest({ ...payload, model: store.get('ss.model') || DEFAULT_MODEL }));
  await new Promise(r => setTimeout(r, 500));
  return demoChat(ctx.message, ctx);
}
