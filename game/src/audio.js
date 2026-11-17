// Sunset Bay — all sound is synthesized with WebAudio. No audio files, no
// network: engine hum, sirens, gunshots, punches, pickups and mission
// jingles are oscillators and filtered noise built at runtime.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.started = false;
  }

  // Must be called from a user gesture (click / keypress) once.
  ensure() {
    if (this.started) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: a low sawtooth whose pitch follows the car's speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Siren: a triangle wave wobbling between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();

    this.started = true;
  }

  setEngine(speedNorm, driving) {
    if (!this.started) return;
    const target = driving ? 0.05 + speedNorm * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.started) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  sirenBurst() {
    if (!this.started) return;
    this.sirenGain.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.02, this.ctx.currentTime + 0.7, 0.3);
  }

  blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseBurst(dur, vol, freq = 1200) {
    if (!this.started) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  gunshot() {
    this.noiseBurst(0.16, 0.5, 900);
    this.blip(140, 0.1, 'square', 0.25);
  }

  punch() {
    this.noiseBurst(0.1, 0.4, 300);
    this.blip(90, 0.12, 'sine', 0.35);
  }

  pickup() {
    this.blip(660, 0.1, 'sine', 0.2, 0);
    this.blip(880, 0.12, 'sine', 0.2, 0.09);
    this.blip(1320, 0.18, 'sine', 0.22, 0.18);
  }

  missionJingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.blip(n, 0.22, 'triangle', 0.22, i * 0.13));
  }

  bustedSting() {
    this.blip(220, 0.5, 'sawtooth', 0.2, 0);
    this.blip(174, 0.7, 'sawtooth', 0.2, 0.4);
  }
}
