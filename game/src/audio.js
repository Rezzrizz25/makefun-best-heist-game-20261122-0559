// Every sound the game makes, synthesized with WebAudio — no audio files,
// no network. Created lazily on the first user gesture (browsers block audio
// before one); silent when that is unavailable, such as a screenshot run.

export function createAudio() {
  let context = null;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
    } catch {
      return null;
    }
    return context;
  }

  /** Unlock audio from a user gesture; safe to call on every key/click. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, seconds, type = 'sine', volume = 0.08, when = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  return {
    unlock,
    pickup() {
      tone(880, 0.12, 'sine', 0.07);
      tone(1318, 0.16, 'sine', 0.06, 0.07);
    },
    crackTick() {
      tone(1400, 0.05, 'square', 0.03);
    },
    vaultOpen() {
      tone(523, 0.14, 'triangle', 0.08);
      tone(659, 0.14, 'triangle', 0.08, 0.1);
      tone(784, 0.28, 'triangle', 0.09, 0.2);
    },
    spotted() {
      tone(196, 0.22, 'sawtooth', 0.07);
      tone(147, 0.3, 'sawtooth', 0.07, 0.12);
    },
    smoke() {
      tone(320, 0.25, 'sine', 0.05);
      tone(210, 0.3, 'sine', 0.04, 0.08);
    },
    emp() {
      tone(1200, 0.1, 'square', 0.04);
      tone(300, 0.35, 'square', 0.04, 0.09);
    },
    busted() {
      tone(220, 0.25, 'sawtooth', 0.09);
      tone(165, 0.25, 'sawtooth', 0.09, 0.2);
      tone(110, 0.5, 'sawtooth', 0.09, 0.4);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.11));
    },
    click() {
      tone(700, 0.05, 'square', 0.03);
    },
    /** A low alarm wail while the alarm meter is high; off otherwise. */
    setAlarmLevel(level) {
      const ctx = ensure();
      if (!ctx) return;
      if (level < 0.55) {
        if (alarmOsc) {
          try { alarmOsc.stop(); } catch { /* already stopped */ }
          alarmOsc = null;
          alarmGain = null;
        }
        return;
      }
      if (!alarmOsc) {
        alarmOsc = ctx.createOscillator();
        alarmGain = ctx.createGain();
        alarmOsc.type = 'sine';
        alarmOsc.frequency.setValueAtTime(440, ctx.currentTime);
        alarmGain.gain.setValueAtTime(0.0, ctx.currentTime);
        alarmOsc.connect(alarmGain).connect(ctx.destination);
        alarmOsc.start();
      }
      const wail = 440 + Math.sin(ctx.currentTime * 2.4) * 90;
      alarmOsc.frequency.setTargetAtTime(wail, ctx.currentTime, 0.1);
      alarmGain.gain.setTargetAtTime(0.02 + level * 0.03, ctx.currentTime, 0.2);
    },
  };
}
