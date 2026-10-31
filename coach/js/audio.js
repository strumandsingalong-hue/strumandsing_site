// Guitar synth (Karplus–Strong), metronome and a bar-by-bar play-along scheduler.
import { OPEN_STRINGS, midiToFreq } from './chords.js';

class Audio {
  constructor() { this.ctx = null; this.cache = new Map(); this.lastVoice = new Array(6).fill(null); }

  /** Must be called from a user gesture the first time (iOS/Safari). */
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const body = this.ctx.createBiquadFilter(); // a touch of wooden body
      body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 4; body.Q.value = 1.2;
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 5200;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(body).connect(tone).connect(comp).connect(this.ctx.destination);
      this.clickBus = this.ctx.createGain();
      this.clickBus.gain.value = 0.5;
      this.clickBus.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  pluckBuffer(midi) {
    const key = Math.round(midi * 4) / 4;
    if (this.cache.has(key)) return this.cache.get(key);
    const sr = this.ctx.sampleRate;
    const dur = 2.6;
    const n = Math.floor(sr * dur);
    const out = new Float32Array(n);
    const period = sr / midiToFreq(midi);
    const N = Math.floor(period);
    const frac = period - N;
    // filtered noise burst excitation, softer for a nylon-ish/steel blend
    let prev = 0;
    for (let i = 0; i < N + 2; i++) { const w = Math.random() * 2 - 1; prev = prev * 0.45 + w * 0.55; out[i] = prev * 0.8; }
    const decay = 0.996 - Math.max(0, (midi - 52)) * 0.00012;
    for (let i = N + 2; i < n; i++) {
      const a = out[i - N] * (1 - frac) + out[i - N - 1] * frac;
      const b = out[i - N - 1] * (1 - frac) + out[i - N - 2] * frac;
      out[i] = decay * 0.5 * (a + b);
    }
    const buf = this.ctx.createBuffer(1, n, sr);
    buf.copyToChannel(out, 0);
    this.cache.set(key, buf);
    return buf;
  }

  /** Warm up the buffers for a set of chords so the first strum is instant. */
  prepare(chords, capo = 0) {
    if (!this.ctx) return;
    for (const c of chords) if (c?.frets) c.frets.forEach((f, i) => { if (f >= 0) this.pluckBuffer(OPEN_STRINGS[i] + capo + f); });
  }

  note(midi, when, { gain = 0.5, string = null, out = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out || this.master);
    src.start(when);
    if (string != null) {
      const prev = this.lastVoice[string];
      if (prev && prev.start < when) {
        prev.gain.gain.setTargetAtTime(0, when, 0.015);
        prev.src.stop(when + 0.2);
      }
      this.lastVoice[string] = { src, gain: g, start: when };
    } else src.stop(when + 2.6);
  }

  /** Strum a chord shape. dir: 'D' (low→high) or 'U' (high→low). */
  strum(chord, when = this.now + 0.02, dir = 'D', { capo = 0, accent = false, out = null } = {}) {
    if (!this.ctx || !chord?.frets) return;
    const strings = chord.frets.map((f, i) => ({ f, i })).filter(s => s.f >= 0);
    let order = dir === 'U' ? strings.reverse().slice(0, 4) : strings;
    const gap = dir === 'U' ? 0.009 : 0.014;
    const base = dir === 'U' ? 0.28 : (accent ? 0.5 : 0.4);
    order.forEach((s, k) => this.note(OPEN_STRINGS[s.i] + capo + s.f, when + k * gap, { gain: base * (1 - k * 0.03), string: s.i, out }));
  }

  click(when, accent = false, out = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.4, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g).connect(out || this.clickBus);
    o.start(when); o.stop(when + 0.06);
  }

  /** RaiN's humming voice: a soft, nasal "mmm" with gentle vibrato and glides between notes. */
  ensureHumBus() {
    const ctx = this.ctx;
    if (!ctx || this.humBus) return this.humBus;
    {
      this.humBus = ctx.createGain();
      this.humBus.gain.value = 0.85;
      const nasal = ctx.createBiquadFilter(); nasal.type = 'peaking'; nasal.frequency.value = 300; nasal.Q.value = 1.1; nasal.gain.value = 8;
      const closed = ctx.createBiquadFilter(); closed.type = 'lowpass'; closed.frequency.value = 1000; closed.Q.value = 0.6; // lips closed
      const air = ctx.createBiquadFilter(); air.type = 'peaking'; air.frequency.value = 2600; air.Q.value = 2; air.gain.value = -10;
      this.humBus.connect(nasal).connect(closed).connect(air).connect(ctx.destination);
    }
    return this.humBus;
  }

  humNote(midi, when, dur, fromMidi = null, out = null) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ensureHumBus();
    const f = midiToFreq(midi);
    const from = fromMidi != null ? midiToFreq(fromMidi) : f * 0.985;
    const saw = ctx.createOscillator(); saw.type = 'sawtooth';
    const sine = ctx.createOscillator(); sine.type = 'sine';
    for (const o of [saw, sine]) { o.frequency.setValueAtTime(from, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.07); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(f * 0.007, when + Math.min(0.45, dur * 0.6)); // vibrato blooms on long notes
    lfo.connect(depth); depth.connect(saw.frequency); depth.connect(sine.frequency);
    const env = ctx.createGain();
    const peak = 0.075, end = when + Math.max(0.12, dur);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + 0.08);
    env.gain.setValueAtTime(peak, end - 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.03);
    const body = ctx.createGain(); body.gain.value = 1.8;
    saw.connect(env); sine.connect(body).connect(env); env.connect(out || this.humBus);
    for (const o of [saw, sine, lfo]) { o.start(when); o.stop(end + 0.06); }
  }

  /** A soft reference tone, e.g. the first note to hum. */
  tone(midi, when = this.now + 0.02, dur = 1.4) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = midiToFreq(midi); o2.frequency.value = midiToFreq(midi) * 2;
    const g2 = this.ctx.createGain(); g2.gain.value = 0.15;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.35, when + 0.06);
    g.gain.setValueAtTime(0.35, when + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); o2.connect(g2).connect(g); g.connect(this.ctx.destination);
    o.start(when); o2.start(when); o.stop(when + dur); o2.stop(when + dur);
  }
}

export const audio = new Audio();

/**
 * Plays bars of chords with a strum pattern.
 * bars: [{ chords: ['G'] | ['G','C'], label?: 'Verse' }]
 */
export class Player {
  constructor() { this.timer = null; this.playing = false; this.visual = []; this.gen = 0; this.bus = null; }

  /** Fresh gain nodes for this playback session — stopping fades and disconnects them,
   *  which silences every sound already scheduled (strums, clicks, hum notes). */
  makeBus() {
    const ctx = audio.ctx;
    const mk = dest => { const g = ctx.createGain(); g.gain.value = 1; g.connect(dest); return g; };
    return { guitar: mk(audio.master), click: mk(audio.clickBus), hum: mk(audio.ensureHumBus()) };
  }

  async start(opts) {
    this.stop();
    const gen = ++this.gen;                 // any stop() while we await below invalidates this start
    await audio.unlock();
    if (gen !== this.gen) return false;
    const o = this.o = {
      bpm: 80, timeSignature: '4/4', pattern: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], chords: {}, capo: 0,
      guitar: true, click: true, hum: false, loop: false, countIn: true, onStep: () => {}, onEnd: () => {}, onCount: () => {}, ...opts
    };
    audio.prepare(Object.values(o.chords), o.capo);
    this.bus = this.makeBus();
    if (!o.hum) this.bus.hum.gain.value = 0;
    const beats = o.timeSignature === '3/4' ? 3 : o.timeSignature === '6/8' ? 2 : 4;
    const steps = o.pattern.length;
    this.stepsPerBeat = steps / beats;
    this.stepDur = 60 / o.bpm / this.stepsPerBeat;
    this.beats = beats; this.steps = steps;
    this.bar = 0; this.step = 0; this.prevHum = null;
    this.countSteps = o.countIn ? beats * this.stepsPerBeat : 0;
    this.nextTime = audio.now + 0.12;
    this.playing = true;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    return true;
  }

  setBpm(bpm) {
    if (!this.o) return;
    this.o.bpm = bpm;
    this.stepDur = 60 / bpm / this.stepsPerBeat;
  }

  /** Toggle RaiN's humming live: future notes follow the flag, the current one fades. */
  setHum(on) {
    if (!this.o) return;
    this.o.hum = on;
    if (this.bus) this.bus.hum.gain.setTargetAtTime(on ? 1 : 0, audio.now, 0.03);
  }

  tick() {
    const ahead = audio.now + 0.12;
    while (this.playing && this.nextTime < ahead) {
      this.schedule(this.nextTime);
      this.nextTime += this.stepDur;
    }
  }

  schedule(t) {
    const o = this.o, bus = this.bus;
    if (this.countSteps > 0) {
      const done = this.beats * this.stepsPerBeat - this.countSteps;
      if (done % this.stepsPerBeat === 0) {
        const beat = done / this.stepsPerBeat;
        audio.click(t, beat === 0, bus.click);
        this.at(t, () => o.onCount(this.beats - beat));
      }
      this.countSteps--;
      return;
    }
    if (this.bar >= o.bars.length) {
      if (o.loop) this.bar = 0;
      else { this.playing = false; clearInterval(this.timer); this.at(t, () => o.onEnd()); return; }
    }
    const bar = o.bars[this.bar];
    const half = bar.chords.length > 1 && this.step >= this.steps / 2 ? 1 : 0;
    const chordName = bar.chords[half];
    const stroke = o.pattern[this.step];
    if (this.step % this.stepsPerBeat === 0 && o.click) audio.click(t, this.step === 0, bus.click);
    if (o.guitar && stroke !== '-' && chordName && chordName !== 'N.C.') {
      audio.strum(o.chords[chordName], t, stroke, { capo: o.capo, accent: this.step === 0, out: bus.guitar });
    }
    // humming rides the same step-by-step clock as the strums, so tempo changes stay in sync
    if (bar.melody) {
      let off = 0;
      for (const [m, len] of bar.melody) {
        if (off === this.step) {
          if (m != null && o.hum) { audio.humNote(m, t, len * this.stepDur * 0.96, this.prevHum, bus.hum); this.prevHum = m; }
          else this.prevHum = m != null ? m : null;
        }
        off += len;
      }
    }
    const b = this.bar, s = this.step;
    this.at(t, () => o.onStep({ bar: b, step: s, chord: chordName, stroke, label: bar.label }));
    this.step++;
    if (this.step >= this.steps) { this.step = 0; this.bar++; }
  }

  at(t, fn) {
    const id = setTimeout(fn, Math.max(0, (t - audio.now) * 1000));
    this.visual.push(id);
    if (this.visual.length > 200) this.visual.splice(0, 100);
  }

  stop() {
    this.gen++;                              // cancels a start() that is still awaiting
    this.playing = false;
    clearInterval(this.timer);
    this.visual.forEach(clearTimeout);
    this.visual = [];
    const bus = this.bus;
    this.bus = null;
    if (bus && audio.ctx) {
      const now = audio.now;
      for (const g of Object.values(bus)) { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.015); }
      setTimeout(() => Object.values(bus).forEach(g => { try { g.disconnect(); } catch {} }), 120);
    }
  }
}
