// Sound, all synthesized: no audio files. A low sawtooth hum follows the
// car's speed, a two-tone siren wails while the heat is on, gunshots and
// punches are shaped noise, and the jingles are little oscillator phrases.
// The context is created on the first user gesture, so it never complains
// about autoplay.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  return {
    /** Call from a user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    /** Engine hum: speed01 is 0..1, inCar gates the volume. */
    engine(speed01, inCar) {
      if (!ensure()) return;
      const target = inCar ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 150, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, ctx.currentTime, 0.1);
    },
    /** Two-tone wail while the heat is on; call with false to stop it. */
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 820;
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.85;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc._lfo.stop();
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
      }
    },
    shot(distant = false) {
      noise(distant ? 0.09 : 0.16, distant ? 0.1 : 0.4, distant ? 900 : 2400);
      if (!distant) tone(160, 0.08, 'square', 0.18);
    },
    punch() {
      tone(95, 0.12, 'sine', 0.4);
      noise(0.06, 0.2, 500);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.22);
      tone(880, 0.14, 'sine', 0.22, 0.09);
    },
    jingle() {
      tone(523, 0.12, 'triangle', 0.25);
      tone(659, 0.12, 'triangle', 0.25, 0.11);
      tone(784, 0.2, 'triangle', 0.28, 0.22);
      tone(1047, 0.28, 'triangle', 0.25, 0.33);
    },
    busted() {
      tone(392, 0.22, 'triangle', 0.25);
      tone(311, 0.3, 'triangle', 0.25, 0.2);
      tone(233, 0.5, 'triangle', 0.25, 0.42);
    },
    wasted() {
      tone(330, 0.25, 'sawtooth', 0.2);
      tone(262, 0.3, 'sawtooth', 0.2, 0.22);
      tone(196, 0.6, 'sawtooth', 0.2, 0.46);
    },
    click() {
      tone(1200, 0.05, 'square', 0.12);
    },
  };
}
