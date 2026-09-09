import musicUrl from '../assets/carefree.mp3';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MATERIALS = {
  wood: { frequency: 260, cutoff: 1800, modes: [[1, 0.58, 0.13], [2.32, 0.27, 0.085], [4.1, 0.15, 0.05]] },
  glass: { frequency: 1120, cutoff: 6800, modes: [[1, 0.52, 0.42], [2.71, 0.30, 0.28], [4.08, 0.18, 0.19]] },
  shell: { frequency: 740, cutoff: 4200, modes: [[1, 0.56, 0.23], [1.93, 0.28, 0.15], [3.37, 0.16, 0.10]] },
  stone: { frequency: 450, cutoff: 3200, modes: [[1, 0.65, 0.065], [2.61, 0.25, 0.04], [4.6, 0.1, 0.025]] },
  pumice: { frequency: 280, cutoff: 850, modes: [] },
};

export function soundProfile(kind, strength = 1, detail = {}) {
  const distance = Number.isFinite(detail.distance) ? Math.abs(detail.distance) : 0;
  const amount = clamp(Number.isFinite(strength) ? strength / 5 : 0.25, 0.25, 1);
  let identity = 2166136261;
  for (const character of String(detail.characterId || '')) identity = Math.imul(identity ^ character.charCodeAt(0), 16777619) >>> 0;
  const size = clamp(Number.isFinite(detail.size) ? detail.size : 32, 12, 110);
  const startled = ['held', 'fleeing', 'startled', 'ewww'].includes(detail.behavior);
  const content = ['resting', 'snacking', 'feeding', 'yawn'].includes(detail.behavior);
  const playful = ['playing', 'toy-play', 'bubble-ring', 'binky', 'blobby-hiccup', 'hiccup', 'claw-dance'].includes(detail.behavior) || /ring|juggle|thump|wiggle|surprise/.test(detail.behavior || '');
  return {
    amount, gain: amount / (1 + distance / 700), cutoff: clamp(18000 / (1 + distance / 400), 700, 18000),
    priority: kind === 'achievement' ? 3 : kind.startsWith('voice-') ? 2 : detail.behavior === 'grab' || ['grab', 'release', 'stretch', 'chime'].includes(kind) ? 1 : 0,
    pitch: detail.characterId ? (32 / size) ** 0.4 * (0.97 + identity % 101 / 100 * 0.06) : 1,
    formant: detail.characterId ? 0.80 + (identity >>> 8) % 101 / 250 : 1,
    contour: startled ? 1.55 : content ? 0.72 : 1.3, duration: startled ? 0.72 : content ? 1.5 : 1,
    syllables: playful ? 2 : 1,
  };
}

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
    this.contacts = new Map();
    this.droppedVoices = 0;
    this.stolenVoices = 0;
    this.lastStretch = 1;
    this.environmentState = { mapId: '', underwater: false, waveEnergy: 0, wind: 0 };
    this.impulses = new Map();
  }

  initialize() {
    if (this.context || !this.supported) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    this.context = context;
    this.effects = context.createGain();
    this.effects.gain.value = this.enabled ? 0.55 : 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.14;
    this.mediumFilter = context.createBiquadFilter();
    this.mediumFilter.type = 'lowpass'; this.mediumFilter.Q.value = -6;
    this.mediumFilter.frequency.value = 18000;
    this.effects.connect(this.mediumFilter);
    this.mediumFilter.connect(this.compressor);
    this.compressor.connect(context.destination);
    this.roomInput = context.createGain(); this.roomInput.gain.value = 0.075;
    this.resetRoom();
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
    const volume = context.createGain(); volume.gain.value = 0.006;
    surf.connect(highpass); highpass.connect(lowpass); lowpass.connect(volume); volume.connect(this.effects); surf.start();
    this.surfVolume = volume;
    this.surfFilter = lowpass;
    const windSource = context.createBufferSource(); windSource.buffer = this.noise; windSource.loop = true;
    this.windFilter = context.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.Q.value = 0.5;
    this.windVolume = context.createGain(); this.windVolume.gain.value = 0;
    windSource.connect(this.windFilter); this.windFilter.connect(this.windVolume); this.windVolume.connect(this.effects); windSource.start();
  }

  environment({ mapId, immersion = 0, waveEnergy = 0, wind = 0 }) {
    const state = this.environmentState;
    const changed = state.mapId !== mapId;
    if (changed) state.underwater = false;
    state.mapId = mapId;
    if (changed) this.resetRoom();
    if (immersion > 0.68) state.underwater = true;
    else if (immersion < 0.38) state.underwater = false;
    state.waveEnergy = clamp(waveEnergy, 0, 1);
    state.wind = clamp(Math.abs(wind), 0, 1);
    if (!this.context || this.paused || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.mediumFilter.frequency.setTargetAtTime(state.underwater ? 700 : 18000, now, 0.10);
    this.surfVolume.gain.setTargetAtTime(0.006 + state.waveEnergy * 0.004 + state.wind * 0.001, now, 0.35);
    this.surfFilter.frequency.setTargetAtTime(1500 + state.waveEnergy * 1500 + state.wind * 500, now, 0.35);
    const atmosphere = mapId === 'pools' ? [420, 0.0025] : mapId === 'sunset' ? [1900, 0.0014] : [3000, 0.001];
    this.windFilter.frequency.setTargetAtTime(atmosphere[0] + state.wind * 180, now, 0.5);
    this.windVolume.gain.setTargetAtTime(state.wind * atmosphere[1], now, 0.5);
  }

  resetRoom() {
    if (!this.roomInput) return;
    this.roomInput.disconnect(); this.room?.disconnect();
    const mapId = this.environmentState.mapId || 'lagoon';
    const duration = mapId === 'pools' ? 0.46 : mapId === 'sunset' ? 0.18 : 0.28;
    let impulse = this.impulses.get(mapId);
    if (!impulse) {
      const length = Math.round(this.context.sampleRate * duration);
      impulse = this.context.createBuffer(2, length, this.context.sampleRate);
      let seed = [...mapId].reduce((total, character) => Math.imul(total, 31) + character.charCodeAt(0) | 0, 137);
      for (let channel = 0; channel < 2; channel += 1) {
        const samples = impulse.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
          seed = Math.imul(seed, 1664525) + 1013904223 | 0;
          samples[index] = ((seed >>> 0) / 2147483648 - 1) * 0.022 * Math.exp(-index / length * 9);
        }
        samples[Math.round(this.context.sampleRate * (mapId === 'pools' ? 0.035 : 0.019))] += mapId === 'pools' ? 0.28 : 0.12;
      }
      this.impulses.set(mapId, impulse);
    }
    this.room = this.context.createConvolver(); this.room.normalize = false; this.room.buffer = impulse;
    this.roomInput.connect(this.room); this.room.connect(this.effects);
    this.environmentState.reverbSeconds = duration;
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
    for (const voice of [...this.voices]) voice.done();
    this.lastEffect.clear();
    this.lastStretch = 1;
    this.resetRoom();
  }

  voice(kind, strength, pan, detail) {
    if (!this.enabled || this.paused || this.context?.state !== 'running') return null;
    const context = this.context;
    const heldVoice = kind.startsWith('voice-') && detail.behavior === 'held';
    const cooldown = heldVoice ? 0.20 : kind.startsWith('voice-') ? 1.4 : kind === 'stretch' ? 0.28 : kind === 'rustle' ? 0.40 : 0.12;
    const key = detail.contactId !== undefined ? `contact:${detail.contactId}` : kind.startsWith('voice-') && detail.characterId ? `${kind}:${detail.characterId}${heldVoice ? ':held' : ''}` : kind;
    if (context.currentTime - (this.lastEffect.get(key) ?? -Infinity) < cooldown) return null;
    const profile = soundProfile(kind, strength, detail);
    const ordinary = [...this.voices].filter(voice => voice.profile.priority < 3).length;
    if (this.voices.size >= 8 || (profile.priority < 3 && ordinary >= 7)) {
      const candidate = [...this.voices].filter(voice => voice.profile.priority < 2 && voice.profile.priority < profile.priority)
        .sort((first, second) => first.profile.gain - second.profile.gain || first.startedAt - second.startedAt)[0];
      if (!candidate) { this.droppedVoices += 1; return null; }
      candidate.done(); this.stolenVoices += 1;
    }
    this.lastEffect.set(key, context.currentTime);
    this.effectCounts[kind] = (this.effectCounts[kind] || 0) + 1;
    const panner = context.createStereoPanner();
    panner.pan.value = clamp(Number.isFinite(pan) ? pan : 0, -0.8, 0.8); panner.connect(this.effects);
    if (!['grab', 'release', 'stretch', 'achievement'].includes(kind)) panner.connect(this.roomInput);
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = -6;
    filter.frequency.value = Math.min(context.sampleRate * 0.45, profile.cutoff); filter.connect(panner);
    const output = context.createGain(); output.gain.value = profile.gain; output.connect(filter);
    const voice = { context, output, panner, profile, startedAt: context.currentTime, nodes: [output, filter, panner], sources: new Set() };
    this.voices.add(voice);
    this.activeVoices = this.voices.size;
    voice.done = () => {
      if (!this.voices.delete(voice)) return;
      if (this.contacts.get(detail.contactId) === voice) this.contacts.delete(detail.contactId);
      for (const source of voice.sources) { source.onended = null; source.stop(); }
      voice.sources.clear();
      for (const node of voice.nodes) node.disconnect();
      this.activeVoices = this.voices.size;
    };
    return voice;
  }

  syncContacts(contacts) {
    const wanted = new Map((this.enabled && !this.paused ? contacts : []).filter(contact => contact.speed >= 0.22).slice(0, 2).map(contact => [contact.contactId, contact]));
    for (const [id, voice] of this.contacts) if (!wanted.has(id)) voice.done();
    for (const [id, contact] of wanted) {
      let voice = this.contacts.get(id);
      if (!voice) {
        voice = this.voice(contact.kind, contact.speed, contact.pan || 0, contact);
        if (!voice) continue;
        const source = this.context.createBufferSource(); source.buffer = this.noise; source.loop = true;
        const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 0.5;
        const gain = this.context.createGain(); gain.gain.value = 0.02;
        source.connect(filter); filter.connect(gain); gain.connect(voice.output);
        voice.nodes.push(source, filter, gain); voice.sources.add(source); voice.contactFilter = filter;
        source.onended = voice.done; source.start();
        this.contacts.set(id, voice);
      }
      voice.profile = soundProfile(contact.kind, contact.speed, contact);
      voice.output.gain.setTargetAtTime(voice.profile.gain, this.context.currentTime, 0.045);
      voice.panner.pan.setTargetAtTime(clamp(contact.pan || 0, -0.8, 0.8), this.context.currentTime, 0.045);
      voice.contactFilter.frequency.setTargetAtTime((contact.kind === 'rolling' ? 240 : 1200) + Math.min(7, contact.speed) * 95, this.context.currentTime, 0.06);
    }
  }

  envelope(voice, peak, duration, delay = 0, attack = 0.008) {
    const now = voice.context.currentTime + delay;
    const gain = voice.context.createGain(); gain.connect(voice.output); voice.nodes.push(gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    return gain;
  }

  startSource(voice, source, duration, delay = 0) {
    const now = voice.context.currentTime + delay;
    voice.nodes.push(source);
    source.onended = () => {
      source.onended = null;
      voice.sources.delete(source);
      if (!voice.sources.size) voice.done();
    };
    if (source.buffer) source.start(now, 1 + Math.random() * 7);
    else source.start(now);
    voice.sources.add(source);
    source.stop(now + duration + 0.02);
  }

  tone(voice, { start, end = start, duration, peak = 0.06, type = 'sine', delay = 0 }) {
    const now = voice.context.currentTime + delay;
    const source = voice.context.createOscillator(); source.type = type;
    source.frequency.setValueAtTime(Math.min(start, voice.context.sampleRate * 0.45), now);
    source.frequency.exponentialRampToValueAtTime(Math.min(end, voice.context.sampleRate * 0.45), now + duration);
    source.connect(this.envelope(voice, peak, duration, delay));
    this.startSource(voice, source, duration, delay);
  }

  noisePart(voice, { frequency, duration, peak, delay = 0, type = 'bandpass', attack = 0.018 }) {
    const source = voice.context.createBufferSource(); source.buffer = this.noise;
    const filter = voice.context.createBiquadFilter(); filter.type = type; filter.Q.value = type === 'lowpass' ? -6 : 0.65;
    filter.frequency.value = Math.min(frequency, voice.context.sampleRate * 0.45);
    source.connect(filter); filter.connect(this.envelope(voice, peak, duration, delay, attack)); voice.nodes.push(filter);
    this.startSource(voice, source, duration, delay);
  }

  play(kind, strength = 1, pan = 0, detail = {}) {
    const voice = this.voice(kind, strength, pan, detail);
    if (!voice) return false;
    try {
      this.render(voice, kind, strength, detail);
      return true;
    } catch (error) { voice.done(); throw error; }
  }

  render(voice, kind, strength, detail) {
    const { profile } = voice;
    if (kind.startsWith('ambience-')) {
      if (kind === 'ambience-pools') this.noisePart(voice, { frequency: 2600, duration: 0.30, peak: 0.012 });
      else for (let chirp = 0; chirp < 2; chirp += 1) this.tone(voice, { start: kind === 'ambience-sunset' ? 3900 : 2100,
        end: kind === 'ambience-sunset' ? 4300 : 3100, duration: 0.06, delay: chirp * 0.14, peak: 0.012 });
      return;
    }
    const activity = { step: [480, 0.075, 0.022], click: [2400, 0.045, 0.018], wing: [700, 0.15, 0.023],
      swish: [1050, 0.12, 0.016], nibble: [1800, 0.10, 0.015], jaw: [650, 0.07, 0.035], spray: [3600, 0.35, 0.045] }[kind];
    if (activity) {
      this.noisePart(voice, { frequency: activity[0] * profile.pitch, duration: activity[1], peak: activity[2], attack: 0.004 });
      if (kind === 'jaw' || kind === 'click') this.tone(voice, { start: kind === 'jaw' ? 240 : 1350, end: kind === 'jaw' ? 130 : 890, duration: 0.055, peak: 0.012 });
      return;
    }
    if (kind === 'splash') {
      this.noisePart(voice, { frequency: 1100 + profile.amount * 1400, duration: 0.12 + profile.amount * 0.10, peak: 0.14 });
      for (let bubble = 0; bubble < 3; bubble += 1) this.tone(voice, { start: 360 + bubble * 210,
        end: 650 + bubble * 300, duration: 0.10 + bubble * 0.025, delay: bubble * 0.025, peak: 0.02 });
      return;
    }
    const material = MATERIALS[detail.material] || MATERIALS[kind];
    if (material) {
      const mass = clamp(Number.isFinite(detail.mass) ? detail.mass : 1, 0.1, 10);
      const speed = clamp(Number.isFinite(detail.speed) ? detail.speed : strength, 0.1, 12);
      const brightness = 0.2 + 0.8 * Math.min(1, speed / 9);
      material.modes.forEach(([ratio, weight, decay], index) => this.tone(voice, {
        start: material.frequency * ratio * mass ** (-1 / 3), duration: decay * (0.75 + brightness * 0.35),
        peak: 0.065 * weight * (index ? brightness : 1),
      }));
      this.noisePart(voice, { frequency: material.cutoff * (0.35 + brightness), duration: 0.045, peak: 0.025 * brightness, type: 'lowpass', attack: 0.003 });
      return;
    }
    if (kind.startsWith('voice-') && /polish|dig|sift|knot|thump/.test(detail.behavior || '')) {
      this.noisePart(voice, { frequency: /polish/.test(detail.behavior) ? 2600 : 650, duration: 0.18, peak: 0.04 });
      this.tone(voice, { start: 550 * profile.pitch, end: 700 * profile.pitch, duration: 0.12, delay: 0.07, peak: 0.03 });
      return;
    }
    if (['splash', 'rustle', 'voice-shark', 'voice-tortoise'].includes(kind)) {
      const frequency = (kind === 'rustle' ? 3200 : kind === 'voice-shark' ? 1750 : kind === 'voice-tortoise' ? 950 : 1350) * profile.formant * profile.pitch;
      if (detail.behavior === 'sneeze') {
        this.noisePart(voice, { frequency: frequency * 0.55, duration: 0.19, peak: 0.035, attack: 0.07 });
        this.noisePart(voice, { frequency: frequency * 1.7, duration: 0.16, peak: 0.13, delay: 0.20, attack: 0.004 });
      } else {
        const duration = (kind === 'rustle' ? 0.42 : kind === 'voice-shark' ? 0.32 : kind === 'voice-tortoise' ? 0.20 : 0.16 + profile.amount * 0.12) * profile.duration;
        this.noisePart(voice, { frequency, duration, peak: kind.startsWith('voice-') ? 0.12 : kind === 'rustle' ? 0.10 : 0.20 });
      }
      return;
    }
    const palette = {
      grab: [680, 850, 0.10, 'sine'], release: [740, 390, 0.15, 'sine'],
      stretch: [510, 790 + strength * 70, 0.19, 'triangle'],
      bounce: [560, 270, 0.12, 'sine'], wood: [390, 220, 0.075, 'triangle'],
      shell: [1180, 880, 0.13, 'sine'], glass: [1630, 1320, 0.23, 'sine'],
      achievement: [660, 1320, 0.44, 'sine'],
      chime: [1740, 1690, 0.65, 'sine'],
      'voice-bird': [2200, 3500, 0.17, 'sine'], 'voice-crab': [1350, 900, 0.06, 'triangle'],
      'voice-fish': [510, 940, 0.11, 'sine'], 'voice-jellyfish': [1240, 1580, 0.33, 'sine'],
      'voice-octopus': [390, 780, 0.14, 'sine'],
      'voice-lizard': [1800, 2600, 0.08, 'triangle'], 'voice-rabbit': [850, 1160, 0.12, 'sine'], 'voice-starfish': [1460, 1760, 0.24, 'sine'],
    };
    const [start, end, duration, type] = palette[kind] || palette.grab;
    const variation = detail.characterId ? profile.pitch : 0.96 + Math.random() * 0.08;
    const voiced = kind.startsWith('voice-') || detail.characterId === 'blob';
    const length = duration * (voiced ? profile.duration : 1);
    for (let syllable = 0; syllable < (voiced ? profile.syllables : 1); syllable += 1) {
      this.tone(voice, { start: start * variation * (syllable ? 1.15 : 1),
        end: (voiced && detail.behavior ? start * (syllable ? 0.78 : profile.contour) : end) * variation,
        duration: length, type, delay: syllable * (length + 0.035) });
    }
  }

  stretch(amount, active) {
    if (!active) { this.lastStretch = 1; return; }
    if (Math.abs(amount - this.lastStretch) > 0.23 && amount > 1.35) {
      this.play('stretch', amount);
      this.lastStretch = amount;
    }
  }
}