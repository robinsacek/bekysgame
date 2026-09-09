const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');
const { Body } = require('matter-js');
const { propSound, residentSound } = require('./sound-context.js');
const { buildSync } = require('esbuild');
const vm = require('node:vm');

class AudioParameter {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.events.push({ value, time }); this.value = value; }
  exponentialRampToValueAtTime(value, time) { this.events.push({ value, time }); this.value = value; }
  setTargetAtTime(value, time) { this.setValueAtTime(value, time); }
}

class AudioNodeFixture {
  constructor(kind, context) {
    this.kind = kind; this.context = context; this.connections = new Set();
    for (const property of ['gain', 'frequency', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[property] = new AudioParameter();
  }
  connect(destination) { this.connections.add(destination); }
  disconnect() { this.connections.clear(); }
  start(time = 0) { this.startedAt = time; }
  stop(time = this.context.currentTime) { this.stopAt = time; }
  finish() { this.onended?.(); }
}

class AudioContextFixture {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 44100; this.nodes = []; this.destination = this.node('destination'); }
  node(kind) { const node = new AudioNodeFixture(kind, this); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createStereoPanner() { return this.node('panner'); }
  createBiquadFilter() { return this.node('filter'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createConvolver() { return this.node('convolver'); }
  createMediaElementSource() { return this.node('music'); }
  createBufferSource() { return this.node('noise'); }
  createOscillator() { return this.node('oscillator'); }
  createBuffer(channels, length) { const samples = new Float32Array(length); return { getChannelData: () => samples }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}

class MusicFixture {
  constructor() { this.paused = true; }
  canPlayType() { return 'probably'; }
  async play() { this.paused = false; }
  pause() { this.paused = true; }
}

const audioModule = { exports: {} };
const audioCode = buildSync({ entryPoints: [require.resolve('./audio.js')], bundle: true, write: false, format: 'cjs', platform: 'node', loader: { '.mp3': 'empty' }, logLevel: 'silent' }).outputFiles[0].text;
vm.runInNewContext(audioCode, { module: audioModule, exports: audioModule.exports, window: { AudioContext: AudioContextFixture }, Audio: MusicFixture, Math });
const { IslandAudio, soundProfile } = audioModule.exports;

test('sound context survives the production queue without changing legacy calls or cooldowns', () => {
  const island = new IslandPhysics();
  try {
    island.queueSound('grab', 2, 400);
    assert.deepEqual(island.sounds[0], { kind: 'grab', strength: 2, x: 400, pan: 400 / island.width * 2 - 1, time: 0 });
    const context = { material: 'glass', mass: 0.3, speed: 6, behavior: 'impact' };
    island.queueSound('glass', 4, 500, context);
    context.mass = 99;
    assert.equal(island.sounds[1].mass, 0.3);
    assert.equal(island.sounds[1].speed, 6);
    assert.equal(island.sounds[1].behavior, 'impact');
    island.queueSound('glass', 7, 600, { material: 'wood' });
    assert.equal(island.sounds.length, 2, 'Context must not bypass the material cooldown');
    island.time = 180;
    island.queueSound('voice-fish', 1.5, 700, { characterId: 'fin', size: 30, behavior: 'curious' });
    assert.equal(island.sounds[2].characterId, 'fin');
    assert.equal(island.sounds[2].size, 30);
    for (let index = 0; index < 30; index += 1) island.queueSound(`probe-${index}`);
    assert.equal(island.sounds.length, 20, 'Optional context must not grow the bounded event queue');
  } finally { island.dispose(); }
});

test('real impacts retain material, body mass, and uncapped impact speed', () => {
  const island = new IslandPhysics();
  try {
    const crate = island.props.find(prop => prop.kind === 'crate');
    Body.setPosition(crate.body, { x: 200, y: island.layout.ground - 90 });
    Body.setVelocity(crate.body, { x: 0, y: 9 });
    for (let frame = 0; frame < 35; frame += 1) island.step();
    const impact = island.sounds.find(sound => sound.sourceKind === 'crate' && sound.behavior === 'impact');
    assert.ok(impact, 'A simulated crate landing must reach the production sound queue');
    assert.equal(impact.material, 'wood');
    assert.equal(impact.mass, crate.body.mass);
    assert.ok(impact.speed > impact.strength, 'Clamped loudness must not erase impact-speed context');
    assert.equal(propSound('bottle', { mass: 0.3 }).material, 'glass');
    assert.equal(propSound('shell', { mass: 1.1 }).material, 'shell');
  } finally { island.dispose(); }
});

test('resident encounters and gags carry stable identity without drawing gameplay randomness', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const resident = island.wildlife.residents.find(item => item.id === 'fin');
    const delta = { x: resident.body.position.x - island.blobPosition().x, y: 0 };
    for (const particle of island.blob.particles) Body.translate(particle, delta);
    const seed = island.wildlife.seed;
    resident.state = 'curious';
    island.wildlife.say(resident);
    assert.equal(island.sounds.at(-1).characterId, 'fin');
    assert.equal(island.sounds.at(-1).behavior, 'curious');
    assert.equal(island.sounds.at(-1).size, Math.sqrt(30 * 18));
    island.time += 180;
    island.wildlife.comedy.perform(resident);
    assert.equal(island.sounds.at(-1).behavior, 'curious', 'The gag must anticipate before its sound');
    island.time += 350;
    island.wildlife.comedy.tick();
    assert.equal(island.sounds.at(-1).behavior, 'bubble-ring');
    assert.deepEqual(residentSound(resident, 'held'), { characterId: 'fin', species: 'fish', size: Math.sqrt(30 * 18), behavior: 'held' });
    assert.equal(island.wildlife.seed, seed);
  } finally { island.dispose(); }
});

test('production material synthesis varies resonances with mass and excitation with speed', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  const render = (kind, mass, speed) => {
    audio.clearEffects();
    assert.equal(audio.play(kind, 3, 0, { material: kind, mass, speed, behavior: 'impact' }), true);
    const voice = [...audio.voices][0];
    assert.equal(voice.sources.size, 4);
    return { voice, tones: [...voice.sources].filter(source => source.kind === 'oscillator') };
  };
  const light = render('wood', 0.5, 3);
  const heavy = render('wood', 4, 3);
  assert.ok(heavy.tones[0].frequency.events[0].value < light.tones[0].frequency.events[0].value * 0.6);
  const glass = render('glass', 0.5, 3);
  assert.ok(glass.tones[0].frequency.events[0].value > light.tones[0].frequency.events[0].value * 3);
  const soft = render('shell', 1, 2);
  const hard = render('shell', 1, 9);
  assert.equal(soft.voice.output.gain.value, hard.voice.output.gain.value, 'Speed must change timbre independently of event gain');
  const softNoise = soft.voice.nodes.find(node => node.kind === 'filter' && node.type === 'lowpass' && node !== soft.voice.nodes[1]);
  const hardNoise = hard.voice.nodes.find(node => node.kind === 'filter' && node.type === 'lowpass' && node !== hard.voice.nodes[1]);
  assert.ok(hardNoise.frequency.value > softNoise.frequency.value * 1.5);
  audio.clearEffects();
  for (const node of hard.voice.nodes) assert.equal(node.connections.size, 0);
});

test('individual voices and behavior contours are stable, distinct, and independently cooled down', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  const fin = { characterId: 'fin', size: Math.sqrt(30 * 18), behavior: 'curious' };
  const pip = { characterId: 'pip', size: Math.sqrt(24 * 15), behavior: 'curious' };
  assert.deepEqual(soundProfile('voice-fish', 2, fin), soundProfile('voice-fish', 2, fin));
  assert.notEqual(soundProfile('voice-fish', 2, fin).pitch, soundProfile('voice-fish', 2, pip).pitch);
  assert.notEqual(soundProfile('voice-fish', 2, fin).contour, soundProfile('voice-fish', 2, { ...fin, behavior: 'held' }).contour);
  assert.equal(audio.play('voice-fish', 2, 0, fin), true);
  assert.equal(audio.play('voice-fish', 2, 0, pip), true);
  assert.equal(audio.play('voice-fish', 2, 0, fin), false);
  audio.clearEffects();
  audio.play('voice-fish', 2, 0, { ...fin, behavior: 'bubble-ring' });
  const voice = [...audio.voices][0];
  assert.equal(voice.sources.size, 2);
  const sources = [...voice.sources];
  sources[0].finish();
  assert.equal(audio.activeVoices, 1, 'The second scheduled syllable retains ownership');
  sources[1].finish();
  assert.equal(audio.activeVoices, 0);
  for (const node of voice.nodes) assert.equal(node.connections.size, 0);
  voice.done();
  assert.equal(audio.activeVoices, 0);
});

test('distance mix preserves neutral legacy gain and attenuates and filters admitted events', () => {
  const near = soundProfile('glass', 5);
  const middle = soundProfile('glass', 5, { distance: 500 });
  const far = soundProfile('glass', 5, { distance: 1500 });
  assert.equal(near.gain, 1);
  assert.ok(near.gain > middle.gain && middle.gain > far.gain);
  assert.ok(near.cutoff > middle.cutoff && middle.cutoff > far.cutoff);
});

test('bounded mixing reserves achievements and steals only lower-priority non-voice events', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  for (const kind of ['grab', 'release', 'stretch', 'bounce', 'wood', 'shell', 'glass']) assert.equal(audio.play(kind, 5), true);
  assert.equal(audio.play('rustle', 5), false);
  assert.equal(audio.activeVoices, 7);
  assert.equal(audio.play('achievement', 5), true);
  assert.equal(audio.activeVoices, 8);
  assert.equal(audio.play('voice-fish', 2, 0, { characterId: 'fin' }), true);
  assert.equal(audio.activeVoices, 8);
  assert.equal(audio.stolenVoices, 1);
  audio.clearEffects();
  for (let index = 0; index < 7; index += 1) audio.play('voice-fish', 2, 0, { characterId: `resident-${index}` });
  audio.play('achievement', 5);
  assert.equal(audio.play('voice-bird', 2, 0, { characterId: 'extra' }), false);
  assert.equal(audio.activeVoices, 8);
  assert.equal(audio.stolenVoices, 1, 'Protected-only saturation must not steal a resident or achievement');
  const owned = [...audio.voices];
  audio.pause(true);
  assert.equal(audio.activeVoices, 0);
  for (const voice of owned) for (const node of voice.nodes) assert.equal(node.connections.size, 0);
  audio.clearEffects();
  audio.pause(false);
  assert.equal(audio.play('grab'), true, 'Interrupted cooldowns must not suppress a fresh scene');
  await audio.toggleMusic();
  await audio.toggle();
  assert.equal(audio.activeVoices, 0);
  assert.equal(audio.music.paused, false);
  assert.equal(audio.context.state, 'running');
  assert.ok(audio.effects.connections.has(audio.mediumFilter));
  assert.ok(audio.mediumFilter.connections.has(audio.compressor));
  assert.ok(audio.musicGain.connections.has(audio.context.destination), 'Music bypasses the effects compressor and mute gain');
});

test('environmental audio has immersion hysteresis, bounded wave response, and an independent music path', async () => {
  const audio = new IslandAudio();
  audio.environment({ mapId: 'lagoon', immersion: 0.8 });
  assert.equal(audio.context, null, 'Environmental updates must not unlock audio');
  await audio.toggle();
  audio.environment({ mapId: 'lagoon', immersion: 0.8, waveEnergy: 0.6 });
  assert.equal(audio.environmentState.underwater, true);
  assert.equal(audio.mediumFilter.frequency.value, 700);
  const stirred = audio.surfVolume.gain.value;
  audio.environment({ mapId: 'lagoon', immersion: 0.5, waveEnergy: 0 });
  assert.equal(audio.environmentState.underwater, true, 'Small surface crossings must not chatter');
  assert.ok(audio.surfVolume.gain.value < stirred);
  audio.environment({ mapId: 'lagoon', immersion: 0.2, waveEnergy: 100, wind: -100 });
  assert.equal(audio.mediumFilter.frequency.value, 18000);
  assert.equal(audio.environmentState.waveEnergy, 1);
  assert.ok(audio.surfVolume.gain.value <= 0.011);
  audio.environment({ mapId: 'pools', immersion: 0.5 });
  assert.equal(audio.environmentState.underwater, false, 'A map change must not retain the old submerged state');
  assert.ok(audio.musicGain.connections.has(audio.context.destination));
  audio.pause(true);
  const before = audio.mediumFilter.frequency.events.length;
  audio.environment({ mapId: 'pools', immersion: 1 });
  assert.equal(audio.mediumFilter.frequency.events.length, before, 'Suspended audio must not build parameter automation');
});

test('contact sounds require handled moving props on actual static contacts', () => {
  const island = new IslandPhysics();
  try {
    const crate = island.props.find(prop => prop.kind === 'crate');
    Body.setPosition(crate.body, { x: 200, y: island.layout.ground - crate.height / 2 });
    for (let frame = 0; frame < 30; frame += 1) island.step();
    Body.setVelocity(crate.body, { x: 2, y: 0 });
    assert.equal(island.contactSounds().length, 0, 'Autonomous or untouched contacts stay silent');
    crate.playerHandled = true;
    const contact = island.contactSounds()[0];
    assert.ok(contact, 'A handled moving body must have a real contact');
    assert.equal(contact.kind, 'scraping');
    assert.equal(contact.contactId, crate.body.id);
    Body.setVelocity(crate.body, { x: 0, y: 0 });
    assert.equal(island.contactSounds().length, 0, 'Rest must end the continuous contact');
  } finally { island.dispose(); }
});

test('continuous contacts reuse bounded voices and fully stop on rest, mute, or pause', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  const contacts = [1, 2, 3].map(contactId => ({ contactId, kind: 'rolling', speed: 2, pan: 0 }));
  audio.syncContacts(contacts);
  assert.equal(audio.contacts.size, 2);
  const owned = [...audio.contacts.values()];
  for (let frame = 0; frame < 20; frame += 1) audio.syncContacts(contacts);
  assert.equal(audio.activeVoices, 2);
  assert.equal(audio.contacts.get(1), owned[0]);
  audio.syncContacts([]);
  assert.equal(audio.activeVoices, 0);
  for (const voice of owned) for (const node of voice.nodes) assert.equal(node.connections.size, 0);
  audio.context.currentTime += 1;
  audio.syncContacts(contacts);
  audio.pause(true);
  assert.equal(audio.contacts.size, 0);
  audio.syncContacts(contacts);
  assert.equal(audio.activeVoices, 0);
  audio.pause(false);
  await audio.toggle();
  audio.syncContacts(contacts);
  assert.equal(audio.activeVoices, 0);
});

test('a splash renders a bounded bubble cloud and cleans up every source', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  audio.play('splash', 5);
  const voice = [...audio.voices][0];
  assert.equal(voice.sources.size, 4);
  assert.equal([...voice.sources].filter(source => source.kind === 'oscillator').length, 3);
  for (const source of [...voice.sources]) source.finish();
  assert.equal(audio.activeVoices, 0);
});

test('map reverbs use distinct bounded impulses and retire every interrupted tail', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  const lagoon = audio.room;
  audio.environment({ mapId: 'pools' });
  assert.equal(lagoon.connections.size, 0);
  assert.equal(audio.environmentState.reverbSeconds, 0.46);
  const pools = audio.room;
  audio.environment({ mapId: 'sunset' });
  assert.equal(pools.connections.size, 0);
  assert.equal(audio.environmentState.reverbSeconds, 0.18);
  const sunset = audio.room;
  audio.clearEffects();
  assert.equal(sunset.connections.size, 0);
  assert.equal(audio.impulses.size, 3);
  audio.play('achievement');
  assert.equal([...audio.voices][0].panner.connections.has(audio.roomInput), false, 'UI feedback stays dry');
});

test('implemented gait and feeding sounds render quietly and remain within the source budget', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  for (const kind of ['step', 'click', 'wing', 'swish', 'nibble', 'jaw']) {
    audio.clearEffects();
    assert.equal(audio.play(kind, 1), true);
    const voice = [...audio.voices][0];
    assert.ok(voice.sources.size >= 1 && voice.sources.size <= 2);
    for (const source of [...voice.sources]) source.finish();
    assert.equal(audio.activeVoices, 0);
  }
});

test('an autonomous call cannot suppress fresh held feedback and repeated grips still have a cooldown', async () => {
  const audio = new IslandAudio();
  await audio.toggle();
  const resident = { characterId: 'mango', size: 39, behavior: 'curious' };
  assert.equal(audio.play('voice-lizard', 1.5, 0, resident), true);
  assert.equal(audio.play('voice-lizard', 2, 0, { ...resident, behavior: 'held' }), true);
  assert.equal(audio.play('voice-lizard', 2, 0, { ...resident, behavior: 'held' }), false);
  assert.equal(audio.play('voice-lizard', 1.5, 0, resident), false);
  audio.clearEffects();
});