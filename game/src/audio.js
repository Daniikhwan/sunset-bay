// Every sound in Sunset Bay is synthesised with WebAudio: no audio files, no
// network. The engine is a low sawtooth whose pitch follows speed, the siren
// is two alternating tones, and the one-shots are short envelopes of noise or
// sine. Nothing plays until the player first interacts with the page, which
// is also when the AudioContext is allowed to start.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || !master) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // A failed blip is silence, never a crash.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || !master) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Silence on failure, as above.
    }
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    /** speed01 is 0..1; 0 silences the engine (on foot). */
    engine(speed01) {
      if (!ctx || !engineOsc || !engineGain) return;
      const target = speed01 <= 0.01 ? 0 : 0.05 + speed01 * 0.1;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx || !sirenOsc || !sirenGain) return;
      if (on && sirenTimer === null) {
        let high = false;
        sirenTimer = window.setInterval(() => {
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 960 : 720, ctx.currentTime, 0.05);
        }, 420);
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      } else if (!on && sirenTimer !== null) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    shot() {
      noise(0.16, 0.5, 2600);
    },
    punch() {
      noise(0.09, 0.4, 500);
      blip(120, 0.1, 'sine', 0.35, 60);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.3);
      window.setTimeout(() => blip(880, 0.14, 'sine', 0.3), 90);
      window.setTimeout(() => blip(1320, 0.2, 'sine', 0.3), 180);
    },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => window.setTimeout(() => blip(freq, 0.22, 'triangle', 0.3), i * 130));
    },
    busted() {
      blip(320, 0.5, 'sawtooth', 0.3, 90);
    },
    click() {
      blip(900, 0.05, 'square', 0.15);
    },
  };
}
