// Microphone pitch tracking for the humming and singing steps.
import { audio } from './audio.js';
import { freqToMidi } from './chords.js';

export class PitchTracker {
  constructor() { this.stream = null; this.running = false; this.gen = 0; this.pending = null; }

  async start(onPitch) {
    if (this.pending && this.pendingGen === this.gen) return this.pending; // a permission prompt is already open
    this.stop();
    const gen = ++this.gen;
    this.pendingGen = gen;
    this.pending = (async () => {
      const ctx = await audio.unlock();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true }
      });
      if (gen !== this.gen) { stream.getTracks().forEach(t => t.stop()); return false; } // user left before saying yes
      this.stream = stream;
      return this.begin(ctx, onPitch);
    })().finally(() => { this.pending = null; });
    return this.pending;
  }

  begin(ctx, onPitch) {
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(this.buf);
      const f = detect(this.buf, ctx.sampleRate);
      onPitch(f > 0 ? { freq: f, midi: freqToMidi(f) } : null);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }

  stop() {
    this.gen++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop());
    this.src?.disconnect();
    this.stream = null;
  }
}

/** Autocorrelation pitch detection tuned for voice (70–1000 Hz). */
export function detect(buf, sr) {
  let size = buf.length, rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.012) return -1;

  let r1 = 0, r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }
  const b = buf.slice(r1, r2);
  size = b.length;
  const minLag = Math.floor(sr / 1000), maxLag = Math.min(size - 1, Math.floor(sr / 70));
  const c = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) sum += b[i] * b[i + lag];
    c[lag] = sum;
  }
  let d = minLag;
  while (d < maxLag && c[d] > c[d + 1]) d++;
  let maxv = -1, maxpos = -1;
  for (let i = d; i <= maxLag; i++) if (c[i] > maxv) { maxv = c[i]; maxpos = i; }
  if (maxpos <= 0 || maxv < c[0] * 0.3) return -1;
  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return sr / T0;
}
