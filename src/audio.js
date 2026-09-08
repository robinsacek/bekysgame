export class IslandAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.supported = Boolean(window.AudioContext || window.webkitAudioContext);
    this.lastSplash = 0;
  }

  async toggle() {
    if (!this.supported) return false;
    this.enabled = !this.enabled;
    try {
      if (this.enabled && !this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Audio is unavailable.');
        this.context = new AudioContextClass();
        const context = this.context;
        this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
        const surf = context.createBufferSource();
        surf.buffer = this.noise; surf.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
        const volume = context.createGain(); volume.gain.value = 0.10;
        const tide = context.createOscillator(); tide.frequency.value = 0.09;
        const modulation = context.createGain(); modulation.gain.value = 0.038;
        tide.connect(modulation); modulation.connect(volume.gain);
        surf.connect(filter); filter.connect(volume); volume.connect(context.destination);
        surf.start(); tide.start();
      }
      if (this.context) await (this.enabled ? this.context.resume() : this.context.suspend());
    } catch {
      this.enabled = false;
    }
    return this.enabled;
  }

  pause(paused) {
    if (!this.context) return;
    const action = paused || !this.enabled ? this.context.suspend() : this.context.resume();
    action.catch(() => {});
  }

  plop(strength = 1) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const context = this.context;
    if (context.currentTime - this.lastSplash < 0.10) return;
    this.lastSplash = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(240 + Math.min(5, strength) * 25, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(85, context.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.23);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}