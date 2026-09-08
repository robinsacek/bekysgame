import musicUrl from '../assets/carefree.mp3';

export class IslandAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.paused = false;
    this.supported = Boolean(window.AudioContext || window.webkitAudioContext);
    this.music = new Audio();
    this.music.preload = 'none';
    this.music.loop = true;
    this.music.volume = 0.20;
    this.musicEnabled = false;
    this.musicSupported = this.supported && Boolean(this.music.canPlayType('audio/mpeg'));
    this.lastEffect = new Map();
    this.effectCounts = {};
    this.activeVoices = 0;
    this.voices = new Set();
    this.lastStretch = 1;
  }

  initialize() {
    if (this.context || !this.supported) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    this.context = context;
    this.effects = context.createGain();
    this.effects.gain.value = this.enabled ? 0.55 : 0;
    this.effects.connect(context.destination);
    this.musicGain = context.createGain();
    this.musicGain.gain.value = 0.20;
    this.musicSource = context.createMediaElementSource(this.music);
    this.musicSource.connect(this.musicGain);
    this.musicGain.connect(context.destination);
    this.music.volume = 1;
    this.noise = context.createBuffer(1, context.sampleRate * 10, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const edge = Math.min(1, index / (context.sampleRate * 0.15), (samples.length - index - 1) / (context.sampleRate * 0.15));
      samples[index] = (Math.random() * 2 - 1) * edge;
    }
    const surf = context.createBufferSource(); surf.buffer = this.noise; surf.loop = true;
    const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 2100;
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 450;
    const volume = context.createGain(); volume.gain.value = 0.035;
    surf.connect(highpass); highpass.connect(lowpass); lowpass.connect(volume); volume.connect(this.effects); surf.start();
  }

  async toggle() {
    if (!this.supported) return false;
    this.enabled = !this.enabled;
    if (!this.enabled) this.clearEffects();
    try {
      this.initialize();
      this.effects.gain.setTargetAtTime(this.enabled ? 0.55 : 0, this.context.currentTime, 0.03);
      if (!this.paused && (this.enabled || this.musicEnabled)) await this.context.resume();
      else await this.context.suspend();
    } catch { this.enabled = false; }
    return this.enabled;
  }

  async toggleMusic() {
    if (!this.musicSupported) return false;
    this.musicEnabled = !this.musicEnabled;
    try {
      this.initialize();
      if (!this.music.src) this.music.src = musicUrl;
      if (this.musicEnabled && !this.paused) {
        const resumed = this.context?.resume();
        const playing = this.music.play();
        await Promise.all([resumed, playing]);
      } else {
        this.music.pause();
        if (!this.enabled) await this.context?.suspend();
      }
    } catch {
      this.musicEnabled = false; this.music.pause();
      if (!this.enabled) this.context?.suspend().catch(() => {});
    }
    return this.musicEnabled;
  }

  pause(paused) {
    this.paused = paused;
    if (paused) this.clearEffects();
    if (paused || !this.musicEnabled) this.music.pause();
    else this.music.play().catch(() => { this.musicEnabled = false; this.onMusicChange?.(); });
    if (this.context) {
      const action = paused || (!this.enabled && !this.musicEnabled) ? this.context.suspend() : this.context.resume();
      action.catch(() => {});
    }
  }

  clearEffects() {
    for (const voice of [...this.voices]) {
      voice.stop?.();
      voice.done();
    }
  }

  voice(kind, strength, pan) {
    if (!this.enabled || this.paused || this.context?.state !== 'running' || this.activeVoices >= 8) return null;
    const context = this.context;
    const cooldown = kind === 'stretch' ? 0.28 : kind === 'rustle' ? 0.40 : 0.12;
    if (context.currentTime - (this.lastEffect.get(kind) ?? -Infinity) < cooldown) return null;
    this.lastEffect.set(kind, context.currentTime);
    this.effectCounts[kind] = (this.effectCounts[kind] || 0) + 1;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan)); panner.connect(this.effects);
    const voice = { context, panner, amount: Math.max(0.25, Math.min(1, strength / 5)) };
    this.voices.add(voice);
    this.activeVoices = this.voices.size;
    voice.done = () => {
      if (!this.voices.delete(voice)) return;
      panner.disconnect(); this.activeVoices = this.voices.size;
    };
    return voice;
  }

  play(kind, strength = 1, pan = 0) {
    const voice = this.voice(kind, strength, pan);
    if (!voice) return;
    const { context, panner, amount, done } = voice;
    const now = context.currentTime;
    const gain = context.createGain(); gain.connect(panner);
    if (kind === 'splash' || kind === 'rustle') {
      const source = context.createBufferSource(); source.buffer = this.noise;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = kind === 'rustle' ? 3200 : 1350; filter.Q.value = kind === 'rustle' ? 0.5 : 0.75;
      const duration = kind === 'rustle' ? 0.42 : 0.16 + amount * 0.12;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime((kind === 'rustle' ? 0.10 : 0.20) * amount, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter); filter.connect(gain); source.start(now, 1 + Math.random() * 7, duration + 0.02);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); done(); };
      voice.stop = () => { source.stop(); source.disconnect(); filter.disconnect(); gain.disconnect(); };
      return;
    }
    const palette = {
      grab: [680, 850, 0.10, 'sine'], release: [740, 390, 0.15, 'sine'],
      stretch: [510, 790 + strength * 70, 0.19, 'triangle'],
      bounce: [560, 270, 0.12, 'sine'], wood: [390, 220, 0.075, 'triangle'],
      shell: [1180, 880, 0.13, 'sine'], glass: [1630, 1320, 0.23, 'sine'],
    };
    const [start, end, duration, type] = palette[kind] || palette.grab;
    const variation = 0.96 + Math.random() * 0.08;
    const oscillator = context.createOscillator(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(start * variation, now);
    oscillator.frequency.exponentialRampToValueAtTime(end * variation, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06 * amount, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); oscillator.start(now); oscillator.stop(now + duration + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); done(); };
    voice.stop = () => { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); };
  }

  stretch(amount, active) {
    if (!active) { this.lastStretch = 1; return; }
    if (Math.abs(amount - this.lastStretch) > 0.23 && amount > 1.35) {
      this.play('stretch', amount);
      this.lastStretch = amount;
    }
  }
}