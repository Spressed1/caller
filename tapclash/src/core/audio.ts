/** Tiny WebAudio synth: every sound is generated, so there are no audio files. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gn).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  click(): void { this.tone(900, 0.05, 'triangle', 0.12, 1300); }
  tap(p: number): void { this.tone(440 + p * 110, 0.07, 'triangle', 0.13, 660 + p * 110); }
  beep(): void { this.tone(660, 0.12, 'square', 0.08); }
  go(): void { this.tone(880, 0.25, 'square', 0.09, 1320); this.tone(1320, 0.3, 'triangle', 0.08, 1760, 0.05); }
  ready(): void { this.tone(520, 0.08, 'sine', 0.15, 780); this.tone(780, 0.1, 'sine', 0.12, 1040, 0.06); }
  point(): void { this.tone(784, 0.1, 'triangle', 0.16); this.tone(1175, 0.18, 'triangle', 0.14, undefined, 0.07); }
  wrong(): void { this.tone(220, 0.22, 'sawtooth', 0.08, 110); }
  hit(): void { this.tone(300, 0.08, 'square', 0.08, 180); this.noise(0.08, 0.12, 2500); }
  bump(v = 1): void { this.tone(160 + 80 * v, 0.1, 'sine', 0.2 * Math.min(1, v), 70); }
  shoot(): void { this.noise(0.06, 0.06, 5000); this.tone(700, 0.05, 'square', 0.03, 350); }
  boom(): void { this.noise(0.5, 0.35, 1400); this.tone(120, 0.4, 'sine', 0.3, 40); }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, undefined, i * 0.1));
    this.tone(1047, 0.6, 'sine', 0.1, undefined, 0.4);
  }
}

export const sfx = new Sfx();
export type { Sfx };
