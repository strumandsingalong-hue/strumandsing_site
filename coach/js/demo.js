// Offline demo: traditional (public-domain) songs, charted at concert pitch like the AI does,
// so the capo / chord-negotiation flow works with no AI key.

const SONGS = [
  {
    match: /rising sun|house of/i,
    chart: {
      found: true, title: 'House of the Rising Sun', artist: 'Traditional',
      reaction: 'Ooh, a moody classic — great choice. It rolls along in a lovely slow six-eight.',
      key: 'Am', bpm: 76, timeSignature: '6/8', feel: 'slow, rolling 6/8 ballad', difficulty: 'Easy',
      confidenceNote: 'This is the well-known folk version — every recording varies a little.',
      strum: { name: 'Rolling 6/8', steps: ['D', '-', 'U', 'D', '-', 'U'], tip: 'Count "ONE two three FOUR five six" and lean on the ONE.' },
      sections: [
        { id: 'verse-a', name: 'Verse (first half)', bars: ['Am', 'C', 'D', 'F', 'Am', 'C', 'E', 'E'], tip: 'Let the last two bars hang — it\'s the tension before the turn.' },
        { id: 'verse-b', name: 'Verse (second half)', bars: ['Am', 'C', 'D', 'F', 'Am', 'E', 'Am', 'E'], tip: 'Same start, quicker ending, then loop back round.' }
      ],
      structure: ['verse-a', 'verse-b', 'verse-a', 'verse-b', 'verse-a', 'verse-b'],
      humming: { startNote: 'A3', tip: 'The tune climbs up through the first two bars, then sighs back down at the end of the line.' },
      coach: {
        newChords: 'Let\'s get the shapes under your fingers first — no rush, just place them and let them ring.',
        changes: 'Now the secret sauce: switching. Slow and clean beats fast and messy every time.',
        strum: 'This song sways in 6/8 — think of a slow boat rocking. Let\'s lock in the rhythm on one chord.',
        sections: 'Time to put chords and rhythm together, half a verse at a time.',
        hum: 'Before words, let\'s hum. It glues the melody to the chords in your head.',
        full: 'You\'ve got all the pieces. Let\'s play it top to bottom.',
        sing: 'The big moment — strum and sing. Pop your lyric sheet in and let\'s go.'
      }
    }
  },
  {
    match: /amazing grace/i,
    chart: {
      found: true, title: 'Amazing Grace', artist: 'Traditional (John Newton)',
      reaction: 'Beautiful — this one is perfect for strum-and-sing. Everyone half-knows the tune already.',
      key: 'A', bpm: 84, timeSignature: '3/4', feel: 'gentle waltz', difficulty: 'Easy',
      confidenceNote: 'The common hymnal harmony, in a comfortable singing key.',
      strum: { name: 'Waltz strum', steps: ['D', '-', 'D', 'U', 'D', 'U'], tip: 'Big bass-y downstroke on ONE, lighter on two and three.' },
      sections: [
        { id: 'verse-a', name: 'Verse (first half)', bars: ['A', 'A', 'A7', 'D', 'A', 'A', 'E', 'E'], tip: 'The seventh chord in bar three is a little signpost pointing to the next chord.' },
        { id: 'verse-b', name: 'Verse (second half)', bars: ['A', 'A', 'A7', 'D', 'A', 'E', 'A', 'A'], tip: 'Land softly on the last chord and let it ring.' }
      ],
      structure: ['verse-a', 'verse-b', 'verse-a', 'verse-b'],
      // traditional hymn tune (public domain), concert pitch, durations in eighth notes
      melody: {
        'verse-a': ['A4:4 C#5:1 A4:1', 'C#5:4 B4:2', 'A4:4 F#4:2', 'E4:4 E4:2', 'A4:4 C#5:1 A4:1', 'C#5:4 B4:2', 'E5:6', '-:4 C#5:2'],
        'verse-b': ['E5:4 C#5:1 A4:1', 'C#5:4 B4:2', 'A4:4 F#4:2', 'E4:4 E4:2', 'A4:4 C#5:1 A4:1', 'C#5:4 B4:2', 'A4:6', '-:4 E4:2']
      },
      humming: { startNote: 'E4', tip: 'It starts with a little pickup and rises in a slow arc, resting on long notes.' },
      coach: {
        newChords: 'Just a shape or two to get comfy with.',
        changes: 'Let\'s practise the switches that come up most.',
        strum: 'Waltz time: ONE two three, ONE two three. Feel the sway.',
        sections: 'Let\'s play it half a verse at a time.',
        hum: 'Hum the tune over the chords — let the long notes breathe.',
        full: 'All together now, start to finish.',
        sing: 'Let\'s strum and sing. Use your own lyric sheet alongside.'
      }
    }
  },
  {
    match: /saints|marching/i,
    chart: {
      found: true, title: 'When the Saints Go Marching In', artist: 'Traditional',
      reaction: 'Ha, a proper feel-good singalong! It\'s bright and bouncy — you\'ll be grinning by the end.',
      key: 'Bb', bpm: 104, timeSignature: '4/4', feel: 'bright, bouncy march', difficulty: 'Easy',
      confidenceNote: 'The classic three-chord version in B flat, the way brass bands often play it.',
      strum: { name: 'Bouncy folk strum', steps: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], tip: 'Down, down-up, up-down-up — keep your wrist loose and bouncy.' },
      sections: [
        { id: 'verse', name: 'Verse', bars: ['Bb', 'Bb', 'Bb', 'Bb', 'Bb', 'Bb', 'F', 'F', 'Bb', 'Bb', 'Bb7', 'Eb', 'Bb', 'F', 'Bb', 'Bb'], tip: 'Most of it sits on one chord — enjoy the groove before the changes arrive.' }
      ],
      structure: ['verse', 'verse', 'verse'],
      // traditional tune (public domain), concert pitch, durations in eighth notes
      melody: {
        verse: ['-:2 Bb3:2 D4:2 Eb4:2', 'F4:8', '-:2 Bb3:2 D4:2 Eb4:2', 'F4:8', '-:2 Bb3:2 D4:2 Eb4:2', 'F4:4 D4:4', 'Bb3:4 D4:4', 'C4:8',
                '-:2 D4:2 D4:2 C4:2', 'Bb3:6 Bb3:2', 'D4:4 F4:2 F4:2', 'Eb4:8', '-:2 D4:2 Eb4:2 F4:2', 'D4:2 Bb3:2 C4:4', 'Bb3:8', '-:8']
      },
      humming: { startNote: 'Bb3', tip: 'Four rising notes to start, then it bounces around the same few notes — very singable.' },
      coach: {
        newChords: 'Only a couple of shapes in this one. Let\'s make them feel easy.',
        changes: 'The changes come quickly near the end — let\'s practise those.',
        strum: 'This one wants a happy bounce. Let\'s nail the rhythm first.',
        sections: 'One verse is the whole song, just repeated — so let\'s get it smooth.',
        hum: 'Hum it like a brass band is marching past.',
        full: 'Three times round, getting a bit louder each time!',
        sing: 'Big voice, big smile — strum and sing it!'
      }
    }
  }
];

export const DEMO_TITLES = SONGS.map(s => s.chart.title);

export function demoLesson(song) {
  const hit = SONGS.find(s => s.match.test(song));
  if (hit) return structuredClone(hit.chart);
  return {
    found: false, title: song, artist: '',
    reaction: `I'm in offline demo mode right now, so I can only teach ${DEMO_TITLES.join(', ')}. Connect the AI coach in Settings and I can chart almost any song for you.`,
    key: 'C', bpm: 80, timeSignature: '4/4', difficulty: 'Easy', strum: { steps: [] }, sections: [], structure: [], humming: {}, coach: {}
  };
}

export function demoChat(message, ctx) {
  const m = message.toLowerCase();
  const out = { reply: '', actions: [] };
  const hard = ctx.lesson?.chords.find(c => new RegExp(`\\b${c.name.replace(/[#/]/g, '\\$&')}\\b`, 'i').test(message));
  const swapped = ctx.lesson?.chords.find(c => c.replaces && new RegExp(`\\b${c.replaces}\\b(?!maj|m|7)`, 'i').test(message));
  if (swapped && /hard|can'?t|difficult|struggl/.test(m)) {
    out.reply = `Good news — we're already using ${swapped.name}, the friendly version of ${swapped.replaces}. Take it slowly: place one finger at a time and pluck each string to check it rings.`;
    return out;
  }
  if (/slow|fast|too quick|speed/.test(m)) {
    const bpm = Math.max(45, Math.round((ctx.practiceBpm || 80) * (/slow(er)?\b|too fast|too quick/.test(m) ? 0.8 : 1.15)));
    out.reply = /slow(er)?\b|too fast|too quick/.test(m) ? `No problem — I've dropped us to ${bpm} bpm. Speed comes from clean, relaxed reps.` : `Ooh, feeling brave! Nudged it up to ${bpm} bpm.`;
    out.actions.push({ type: 'set_bpm', bpm });
  } else if (hard && /hard|can'?t|difficult|struggl|hurt|buzz/.test(m)) {
    const swaps = { F: 'Fmaj7', Bm: 'Bm7', C: 'Cadd9', G: 'G/B', B7: 'Bm7' };
    const to = swaps[hard.name];
    if (to) {
      out.reply = `${hard.name} is a tough one for everyone at first. Let's use ${to} instead — it sounds lovely in this song and is much kinder to your fingers.`;
      out.actions.push({ type: 'swap_chord', from: hard.name, to });
    } else out.reply = `Try pressing just behind the fret wire, thumb relaxed behind the neck. Place one finger at a time and pluck each string to find the buzzy one.`;
  } else if (/skip|next|move on/.test(m)) {
    out.reply = 'Sure — onwards! You can always come back.';
    const i = ctx.steps.findIndex(s => s.id === ctx.currentStep?.id);
    if (ctx.steps[i + 1]) out.actions.push({ type: 'goto_step', step: ctx.steps[i + 1].id });
  } else if (/capo/.test(m)) {
    out.reply = 'A capo clamps across the neck and raises the pitch, so easy open shapes can match the original key. I choose the fret that lets you use chords you already know.';
  } else if (/lyric|words/.test(m)) {
    out.reply = 'I don\'t share lyrics, out of respect for songwriters — but in the Strum & sing step you can paste your own lyric sheet and add [chords] to it.';
  } else {
    out.reply = 'Love the effort. (I\'m in offline demo mode, so I can only handle simple requests like "slower", "F is hard" or "skip". Add the AI coach in Settings for real conversations.)';
  }
  return out;
}
