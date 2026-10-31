// Shared by the browser (direct / demo modes) and server.js.
// Everything the AI coach knows how to say lives here, so the iOS app can
// reuse the exact same prompts and schemas later.

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
// Strumming patterns — the same named set as the iOS app (PracticeEngine.defaultPatterns),
// plus a 6/8 roll. The AI only ever CHOOSES one of these; it never invents a grid.
export const PATTERNS = {
  'Four-On-The-Floor': { timeSignature: '4/4', steps: ['D', '-', 'D', '-', 'D', '-', 'D', '-'], description: 'Straight downstrokes for locking in steady rhythm.' },
  'Driving Eighths':   { timeSignature: '4/4', steps: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], description: 'A continuous down-up motion for smooth groove control.' },
  'Island Strum':      { timeSignature: '4/4', steps: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], description: 'The familiar D - D U - U D U groove heard across acoustic pop.' },
  'Folk Strum':        { timeSignature: '4/4', steps: ['D', 'D', 'U', '-', 'U', 'D', 'U', '-'], description: 'Double-down start: the acoustic folk and pop bounce.' },
  'Two-Beat Pop':      { timeSignature: '4/4', steps: ['D', '-', 'D', 'U', 'D', '-', 'D', 'U'], description: 'A compact down, down-up bounce, twice per bar.' },
  'Reggae Skank':      { timeSignature: '4/4', steps: ['-', 'U', '-', 'U', '-', 'U', '-', 'U'], description: 'Upstroke on every offbeat: the classic Caribbean chop.' },
  'Waltz Ballad':      { timeSignature: '3/4', steps: ['D', '-', 'D', 'U', 'D', 'U'], description: 'A three-beat sweep for ballads in one-two-three time.' },
  'Waltz Easy':        { timeSignature: '3/4', steps: ['D', '-', 'D', '-', 'D', '-'], description: 'One downstroke per beat in three-four.' },
  'Rolling 6/8':       { timeSignature: '6/8', steps: ['D', '-', 'U', 'D', '-', 'U'], description: 'A rocking ONE-two-three FOUR-five-six roll.' },
  'Six-Eight Easy':    { timeSignature: '6/8', steps: ['D', '-', '-', 'D', '-', '-'], description: 'Two big downstrokes per bar.' }
};
export const EASY_PATTERN = { '4/4': 'Four-On-The-Floor', '3/4': 'Waltz Easy', '6/8': 'Six-Eight Easy' };
const pat = (name, extra = {}) => ({ name, steps: PATTERNS[name].steps.slice(), tip: PATTERNS[name].description, ...extra });
export const patternFor = name => (PATTERNS[name] ? pat(name) : null);

// Bump when the chart prompt changes meaningfully; saved charts remember which version made them.
export const PROMPT_VERSION = 4;
export const API_VERSION = '2023-06-01';

const COACH_PERSONA = `You are RaiN, the friendly guitar coach inside the Strum & Sing app.
You teach people to strum guitar and sing along to songs they love. You speak out loud, so write the way a person talks.

How you sound:
- Warm, encouraging and human. Short sentences. Like a patient friend sitting next to them with a guitar, not a textbook.
- One idea at a time. Never more than 3 short sentences per message unless asked.
- Celebrate small wins. Normalise struggle ("everyone's fingers hate the F chord at first").
- British-friendly and inclusive. No emojis except an occasional 🎸 or 🎶.

Hard rules:
- NEVER write song lyrics, not even a line or a hook phrase. Refer to sections only by name (Intro, Verse, Pre-chorus, Chorus, Bridge, Outro). If the learner wants lyrics, tell them to use their own lyric sheet in the Sing step.
- Be honest about uncertainty. If you are not sure of the exact chords, say the chart is "a close version".
- Guitar shapes use standard tuning. Fret arrays go from low E (6th string) to high e (1st). -1 = muted, 0 = open (or the capo), 1+ = fret counted from the capo.`;

// ───────────────────────── Song chart ─────────────────────────
// The AI only supplies the song's chart at CONCERT pitch (as it sounds on the record).
// The app's arranger (js/arranger.js) then picks the capo and shapes for each learner.

export const LESSON_TOOL = {
  name: 'build_chart',
  description: 'Return the chord chart of a song at concert pitch, plus coaching lines for a strum-and-sing lesson.',
  input_schema: {
    type: 'object',
    required: ['found', 'title', 'artist', 'reaction', 'key', 'bpm', 'timeSignature', 'difficulty', 'strumPattern', 'strumTip', 'sections', 'structure', 'humTip', 'coach'],
    properties: {
      found: { type: 'boolean', description: 'false if you do not recognise the song well enough to chart it.' },
      title: { type: 'string' },
      artist: { type: 'string' },
      reaction: { type: 'string', description: "RaiN's 1–2 sentence spoken reaction to the song choice. Do NOT mention capo or which chords they know (the app handles that). If found=false, kindly ask them to check the title or artist." },
      key: { type: 'string', description: 'Key at CONCERT pitch, as heard on the original recording, e.g. "Ab" or "F#m".' },
      bpm: { type: 'integer', minimum: 40, maximum: 220, description: 'Original tempo. For 6/8 this is dotted-quarter beats per minute.' },
      timeSignature: { type: 'string', enum: ['4/4', '3/4', '6/8'] },
      feel: { type: 'string', description: 'A few words about the groove, e.g. "gentle folk ballad".' },
      difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
      confidenceNote: { type: 'string', description: 'One honest sentence about how exact this chart is.' },
      // Flat fields on purpose: some models jumble small nested objects. shapeChart() rebuilds them.
      strumPattern: { type: 'string', enum: ['Four-On-The-Floor', 'Driving Eighths', 'Island Strum', 'Folk Strum', 'Two-Beat Pop', 'Reggae Skank', 'Waltz Ballad', 'Rolling 6/8'], description: 'Pick the named pattern that best suits the song\'s feel. Must match the time signature: Waltz Ballad for 3/4, Rolling 6/8 for 6/8, any of the others for 4/4.' },
      strumTip: { type: 'string', description: 'One friendly tip for playing that pattern in this song (accents, feel). Don\'t invent a new pattern.' },
      sections: {
        type: 'array',
        description: 'Each distinct section once. Chord names at CONCERT pitch exactly as the recording sounds (e.g. "Ab", "Fm", "Db", "Eb"). No lyrics anywhere.',
        items: {
          type: 'object',
          required: ['id', 'name', 'bars'],
          properties: {
            id: { type: 'string', description: 'short slug, e.g. "verse"' },
            name: { type: 'string', description: 'e.g. "Verse", "Chorus"' },
            bars: { type: 'array', items: { type: 'string' }, description: 'One string per bar: one chord ("Ab") or two split evenly ("Ab Db").' },
            tip: { type: 'string', description: 'Short coaching tip for this section (no lyrics, no chord shape names since the capo may change them).' }
          }
        }
      },
      structure: { type: 'array', items: { type: 'string' }, description: 'Section ids in song order, e.g. ["intro","verse","chorus","verse","chorus","outro"].' },
      humStartNote: { type: 'string', description: 'Approximate first sung note at concert pitch, e.g. "D4". Leave empty if unsure.' },
      humTip: { type: 'string', description: 'How to hum the melody over the chords (describe its shape, never the words).' },
      coach: {
        type: 'object',
        description: "RaiN's spoken lines introducing each practice stage. 1–2 sentences each, warm and specific to this song's feel. Don't name chord shapes.",
        required: ['newChords', 'changes', 'strum', 'sections', 'hum', 'full', 'sing'],
        properties: {
          newChords: { type: 'string' }, changes: { type: 'string' }, strum: { type: 'string' }, sections: { type: 'string' },
          hum: { type: 'string' }, full: { type: 'string' }, sing: { type: 'string' }
        }
      }
    }
  }
};

/**
 * The chart is saved and shared by every learner, so it must not depend on who asked:
 * no level, no goal, no known chords. The app adapts it per learner (capo, shapes, easy strum).
 */
export function buildLessonRequest({ song, model = DEFAULT_MODEL }) {
  return {
    model,
    max_tokens: 3500,
    system: COACH_PERSONA,
    tools: [LESSON_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{
      role: 'user',
      content: `The learner wants to play: "${song}".

Chart the song at CONCERT pitch (the key of the original recording), with the chords most guitarists use for it.
Do not choose a capo or simplify chords — the app does that for each learner.
Choose the strumming pattern from the list that best suits the song (strumPattern). Real recordings vary; pick the closest friendly match.
If you are not confident you know this exact song's chords, set found=false rather than guessing.
Write RaiN's lines so they suit anyone, from first-timers to confident players.
Remember: no lyrics anywhere.
Reply ONLY by calling the build_chart tool — no other text.`
    }]
  };
}

// ───────────────────────── Chat during the lesson ─────────────────────────

export const CHAT_TOOL = {
  name: 'coach_reply',
  description: 'Reply to the learner as RaiN and optionally change the lesson.',
  input_schema: {
    type: 'object',
    required: ['reply'],
    properties: {
      reply: { type: 'string', description: 'What RaiN says back (spoken aloud). 1–3 short sentences, warm and practical. No lyrics.' },
      actions: {
        type: 'array',
        description: 'Optional changes to apply to the lesson. Leave empty when just talking.',
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: ['set_bpm', 'goto_step', 'swap_chord'] },
            bpm: { type: 'integer', description: 'set_bpm: new practice tempo.' },
            step: { type: 'string', description: 'goto_step: one of the step ids provided.' },
            from: { type: 'string', description: 'swap_chord: chord name currently in the chart.' },
            to: { type: 'string', description: 'swap_chord: easier chord name to use instead.' },
            frets: { type: 'array', items: { type: 'integer' }, description: 'swap_chord: 6 frets for the new shape (low E → high e).' },
            fingers: { type: 'array', items: { type: 'integer' } },
            tip: { type: 'string' }
          }
        }
      }
    }
  }
};

export function summariseLesson(lesson) {
  if (!lesson) return 'No lesson yet.';
  const sec = lesson.sections.map(s => `${s.name} [${s.id}]: ${s.bars.join(' | ')}`).join('\n');
  return `Song: ${lesson.title} — ${lesson.artist}
Shapes key ${lesson.key} (sounds in ${lesson.concertKey || lesson.key}), capo ${lesson.capo}, ${lesson.bpm} bpm, ${lesson.timeSignature}
Chords: ${lesson.chords.map(c => c.name + (c.replaces ? ` (instead of ${c.replaces})` : '')).join(', ')}
Strum: ${lesson.strum.name} ${lesson.strum.steps.join(' ')}
${sec}
Structure: ${lesson.structure.join(' → ')}`;
}

export function buildChatRequest({ lesson, knownChords = [], steps = [], currentStep, practiceBpm, history = [], message, model = DEFAULT_MODEL }) {
  const context = `LESSON CONTEXT
${summariseLesson(lesson)}
Learner already knew: ${knownChords.join(', ') || 'no chords'}. Goal: ${lesson?.goal === 'strum' ? 'strum only' : 'strum and sing'}.
Current practice tempo: ${practiceBpm || lesson?.bpm || '?'} bpm
Step ids: ${steps.map(s => `${s.id} (${s.title})`).join(', ')}
They are on step: ${currentStep ? `${currentStep.id} — ${currentStep.title}` : 'intro'}

If they struggle with a chord, offer an easier swap with swap_chord. If they say it's too fast or slow, use set_bpm. If they want to skip ahead or go back, use goto_step.`;

  const trimmed = history.slice(-12).map(m => ({ role: m.role, content: m.text }));
  // the API needs alternating roles starting with user
  const msgs = [];
  for (const m of trimmed) {
    if (!msgs.length && m.role !== 'user') continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content;
    else msgs.push({ ...m });
  }
  const latest = `${context}\n\nLearner says: ${message}\n\n(Reply ONLY by calling the coach_reply tool.)`;
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += '\n' + latest;
  else msgs.push({ role: 'user', content: latest });

  return {
    model,
    max_tokens: 700,
    system: COACH_PERSONA,
    tools: [CHAT_TOOL],
    tool_choice: { type: 'auto' },
    messages: msgs
  };
}

/**
 * Turn whatever the model returned into the chart shape the app uses.
 * Accepts the flat fields above, the older nested shape, and repairs jumbled answers
 * where parts came back as strings like '\n<parameter name="name">Bouncy strum'.
 */
export function shapeChart(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const c = { ...raw };
  const clean = v => (typeof v === 'string' ? v.replace(/<\/?parameter[^>]*>/g, '').replace(/<\/?invoke[^>]*>/g, '').trim() : v);
  const isSteps = a => Array.isArray(a) && a.length >= 6 && a.every(x => ['D', 'U', '-'].includes(x));
  const asObj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const strum = asObj(c.strum), easy = asObj(c.strumEasy), hum = asObj(c.humming);
  const ts = ['4/4', '3/4', '6/8'].includes(c.timeSignature) ? c.timeSignature : '4/4';
  const named = clean(c.strumPattern) || clean(strum.name);
  const fitsTs = n => PATTERNS[n] && PATTERNS[n].timeSignature === ts;
  if (fitsTs(named)) c.strum = pat(named, { tip: clean(c.strumTip) || clean(strum.tip) || PATTERNS[named].description });
  else {
    const steps = [strum.steps, c.strumSteps, c.steps].find(isSteps);
    c.strum = steps && steps.length === (ts === '4/4' ? 8 : 6)
      ? { name: clean(strum.name) || named || 'Strum', steps, tip: clean(c.strumTip) || clean(strum.tip) || '' }
      : pat(ts === '4/4' ? 'Island Strum' : ts === '3/4' ? 'Waltz Ballad' : 'Rolling 6/8');
  }
  c.strumEasy = isSteps(easy.steps) && easy.steps.length === c.strum.steps.length ? { name: clean(easy.name) || 'Steady downs', steps: easy.steps, tip: clean(easy.tip) || '' } : pat(EASY_PATTERN[ts]);
  c.humming = {
    startNote: clean(c.humStartNote) || clean(hum.startNote) || (typeof c.humming === 'string' ? clean(c.humming) : '') || undefined,
    tip: clean(c.humTip) || clean(hum.tip) || (typeof c.tip === 'string' ? clean(c.tip) : '') || 'Hum softly and follow the rise and fall of the tune.'
  };
  if (c.humming.startNote && !/^[A-G][#b]?-?\d$/.test(c.humming.startNote)) delete c.humming.startNote;
  for (const k of ['strumPattern', 'strumName', 'strumSteps', 'strumTip', 'easyStrumName', 'easyStrumSteps', 'easyStrumTip', 'humStartNote', 'humTip', 'steps', 'tip']) delete c[k];
  c.reviewed = c.reviewed === true; // only hand-checked charts (imported from the iOS app or marked in Supabase) are "reviewed"
  if (typeof c.found === 'string') c.found = c.found.trim().toLowerCase() === 'true';
  for (const k of ['title', 'artist', 'reaction', 'key', 'feel', 'confidenceNote']) if (typeof c[k] === 'string') c[k] = clean(c[k]);
  return c;
}

/** Pull the forced tool call's input out of a Messages API response. */
export function extractToolInput(response) {
  const content = response?.content || [];
  const block = content.find(b => b.type === 'tool_use');
  if (block) return block.input;
  // Some models answer in text even when asked to use the tool: recover the JSON if we can.
  const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  if (text) return { reply: text, actions: [] }; // a plain chat answer still works for RaiN's chat
  throw new Error('The coach did not return a structured answer.');
}
