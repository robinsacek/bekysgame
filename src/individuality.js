const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const ORDINARY = new Set(['wandering', 'schooling', 'creeping', 'exploring', 'drifting', 'pulsing', 'cruising', 'turning', 'basking', 'grazing', 'resting', 'hiding']);
const REST = new Set(['resting', 'basking', 'grazing', 'perching', 'hiding', 'feeding', 'snacking']);
const { residentSound } = require('./sound-context.js');

function traitsFor(id) {
  let seed = [...id].reduce((total, character) => Math.imul(total, 31) + character.charCodeAt(0) | 0, 757);
  return Object.fromEntries(['bold', 'curious', 'tidy', 'greedy', 'clumsy', 'chatty', 'vain'].map(trait => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    return [trait, (seed >>> 0) / 4294967296];
  }));
}

class IndividualLife {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.island = wildlife.island;
    this.lastTime = this.island.time;
    this.pairs = new Map();
    for (const resident of wildlife.residents) Object.assign(resident, { traits: traitsFor(resident.id),
      needs: { hunger: 0.15, energy: 1, social: 0.25, curiosity: 0.4 }, avoidSpot: null, lookAt: null, lookAtTime: 0 });
  }

  tick() {
    const { time } = this.island;
    const delta = Math.max(0, Math.min(100, time - this.lastTime)); this.lastTime = time;
    for (const resident of this.wildlife.residents) {
      if (resident.avoidSpot?.until <= time) resident.avoidSpot = null;
      if (this.wildlife.held(resident.body)) continue;
      const needs = resident.needs;
      const resting = REST.has(resident.state);
      const exertion = ['fleeing', 'startled', 'play-chase', 'play-retreat', 'lunging'].includes(resident.state);
      needs.energy = clamp(needs.energy + delta * (resting ? 1 / 14000 : exertion ? -1 / 20000 : -1 / 300000), 0.2, 1);
      needs.hunger = clamp(needs.hunger + delta / (100000 - resident.traits.greedy * 18000));
      needs.social = clamp(needs.social + delta / 130000);
      needs.curiosity = clamp(needs.curiosity + delta / 100000);
      if (time >= resident.lookAtTime) {
        resident.lookAtTime = time + 350;
        const candidates = [this.island.blob.center, ...this.wildlife.residents.filter(other => other !== resident).map(other => other.body), ...this.island.props.map(prop => prop.body)]
          .filter(body => Math.hypot(body.velocity.x, body.velocity.y) > 0.15)
          .map(body => ({ body, distance: Math.hypot(body.position.x - resident.body.position.x, body.position.y - resident.body.position.y) }))
          .filter(other => other.distance < 200).sort((first, second) => first.distance - second.distance);
        resident.lookAt = candidates.length ? { ...candidates[0].body.position } : null;
      }
      this.motionSound(resident);
    }
    for (const [key, pair] of this.pairs) {
      pair.value *= Math.exp(-delta / 180000);
      if (time - pair.time > 180000) this.pairs.delete(key);
    }
  }

  notice(kind, first, second) {
    if (first.needs && kind === 'food-found') {
      first.needs.hunger = 0;
      this.island.queueSound('nibble', 1, first.body.position.x, residentSound(first, 'feeding'));
    }
    if (first.needs && kind === 'shark-snap') this.island.queueSound('jaw', 1.5, first.body.position.x, residentSound(first, 'snapping'));
    if (first.needs && ['toy-interest', 'blob-curiosity', 'habitat-return'].includes(kind)) first.needs.curiosity = Math.max(0, first.needs.curiosity - 0.4);
    const known = id => id === 'blob' || this.wildlife.residents.some(resident => resident.id === id);
    if (!known(first.id) || !known(second.id) || first.id === second.id) return;
    const positive = ['schooling', 'shore-greeting', 'picnic-visit', 'playful-chase', 'bird-fish-play', 'peekaboo', 'blob-curiosity'].includes(kind);
    const negative = ['blob-retreat', 'fleeing-shark', 'fish-startled-by-bird', 'fish-yield-to-shark'].includes(kind);
    if (!positive && !negative) return;
    const key = [first.id, second.id].sort().join(':');
    const pair = this.pairs.get(key) || { value: 0, time: -Infinity };
    if (this.island.time - pair.time < 1000) return;
    pair.value = clamp(pair.value + (positive ? 0.12 : -0.20), -1, 1); pair.time = this.island.time;
    this.pairs.set(key, pair);
    if (positive) for (const resident of [first, second]) if (resident.needs) resident.needs.social = Math.max(0, resident.needs.social - 0.25);
  }

  affinity(first, second) { return this.pairs.get([first.id, second.id].sort().join(':'))?.value || 0; }

  motionSound(resident) {
    const { time } = this.island;
    if (resident.recovery || resident.held || this.wildlife.held(resident.body) || time - (resident.motionSoundAt || 0) < 1500) return;
    const position = this.island.blobPosition();
    if (Math.hypot(resident.body.position.x - position.x, resident.body.position.y - position.y) > 280) return;
    const phase = Math.floor(resident.motionPhase / Math.PI);
    if (phase === resident.soundPhase) return;
    resident.soundPhase = phase;
    const speed = Math.hypot(resident.body.velocity.x, resident.body.velocity.y);
    const kind = resident.state === 'feeding' ? 'nibble' : resident.species === 'bird' && resident.flight === 'flapping' ? 'wing'
      : speed > 0.7 && resident.grounded ? resident.species === 'crab' ? 'click' : 'step'
        : speed > 1.4 && resident.immersion > 0.5 ? 'swish' : null;
    if (!kind) return;
    resident.motionSoundAt = time;
    this.island.queueSound(kind, 0.7, resident.body.position.x, residentSound(resident, resident.state));
  }

  fright(resident, position) {
    if (this.wildlife.held(resident.body)) return;
    resident.avoidSpot = { x: position.x, y: position.y, until: this.island.time + 30000 };
  }

  target(resident, state, target) {
    const spot = resident.avoidSpot;
    if (!spot || spot.until <= this.island.time || !ORDINARY.has(state) || resident.recovery || Math.hypot(target.x - spot.x, target.y - spot.y) > 90) return target;
    const aquatic = ['fish', 'shark', 'jellyfish', 'octopus', 'starfish'].includes(resident.species);
    if (resident.species === 'bird') return target;
    const bounds = aquatic ? this.wildlife.water : this.wildlife.groundHabitat(resident);
    const direction = Math.sign(resident.body.position.x - spot.x) || (resident.traits.bold > 0.5 ? 1 : -1);
    return { ...target, x: clamp(spot.x + direction * 125, bounds.minX, bounds.maxX) };
  }

  speedFactor(resident) { return ORDINARY.has(resident.state) && !resident.recovery ? 0.84 + resident.needs.energy * 0.16 : 1; }
  restFactor(resident) { return 1 + (1 - resident.needs.energy) * 0.85 + (1 - resident.traits.bold) * 0.12; }
  approachDistance(resident) { return 49 + (1 - resident.traits.bold) * 14 - resident.traits.curious * 9; }
}

module.exports = { IndividualLife, traitsFor };