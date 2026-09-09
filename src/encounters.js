const { Vector } = require('matter-js');
const AQUATIC = new Set(['fish', 'jellyfish', 'shark', 'octopus', 'starfish']);
const LAND = new Set(['crab', 'tortoise', 'lizard', 'rabbit']);
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const AGENDAS = {
  fish: 'school and explore', jellyfish: 'pulse and drift', shark: 'patrol and occasionally hunt', octopus: 'explore a den and investigate objects',
  starfish: 'graze on reef rocks', crab: 'find and inspect shells', tortoise: 'browse, rest, and visit food',
  bird: 'perch, cruise, watch fish, and forage', lizard: 'bask and investigate insects', rabbit: 'graze, hop, and play',
};

function encounterResponse(first, second) {
  if (first === 'fish' && second === 'fish') return 'school';
  if (second === 'shark' && first !== 'shark') return 'give-space';
  if (first === 'shark') return ['jellyfish', 'starfish'].includes(second) ? 'avoid' : 'inspect';
  if (first === 'bird' && AQUATIC.has(second)) return 'watch';
  if (second === 'bird' && AQUATIC.has(first)) return first === 'octopus' ? 'hide' : 'give-space';
  if (first === 'jellyfish') return 'drift-around';
  if (second === 'jellyfish') return 'avoid';
  if (first === 'octopus') return 'inspect';
  if (first === 'starfish') return 'curl';
  if (LAND.has(first) && LAND.has(second)) return first === 'rabbit' && second === 'lizard' ? 'play' : 'greet';
  if (first === 'bird' || second === 'bird') return 'greet';
  return AQUATIC.has(first) !== AQUATIC.has(second) ? 'watch' : 'inspect';
}

class LivingInteractions {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.island = wildlife.island;
    this.nextNotice = 0;
    this.playAt = 12000;
    this.effects = [];
    this.effectSerial = 0;
    this.pairTimes = new Map();
    this.huntAt = 16000 + wildlife.random() * 16000;
    this.huntUntil = 0;
    this.prey = null;
    for (const resident of wildlife.residents) Object.assign(resident, { agenda: AGENDAS[resident.species], frown: false, attention: null, attentionUntil: 0, behaviorUntil: 0, snapUntil: 0, ewwUntil: 0, tingleUntil: 0 });
  }

  mood(resident) {
    const point = resident.body.position;
    const unsuitable = AQUATIC.has(resident.species) ? resident.immersion < 0.20 : resident.species === 'bird' ? resident.immersion > 0.12
      : resident.immersion > 0.18 || resident.held && point.y < this.island.floorAt(point.x) - 120;
    resident.frown = unsuitable || resident.ewwUntil > this.island.time || resident.tingleUntil > this.island.time;
  }

  owns(resident) { return resident.behaviorUntil > this.island.time && !resident.held; }

  runBehavior(resident, state, target, duration, thought) {
    this.wildlife.change(resident, state, target, duration, thought);
    resident.behaviorUntil = this.island.time + duration;
  }

  flee(resident, threat, duration = 1400) {
    if (resident.held || this.wildlife.held(resident.body)) return;
    const point = resident.body.position;
    const bounds = AQUATIC.has(resident.species) ? this.wildlife.water : this.wildlife.groundHabitat(resident);
    const direction = point.x < threat.x ? -1 : 1;
    const target = { x: clamp(point.x + direction * 175, bounds.minX + 10, bounds.maxX - 10),
      y: AQUATIC.has(resident.species) ? clamp(point.y - 95, bounds.minY + 12, bounds.maxY - 12) : resident.species === 'bird' ? Math.max(200, point.y - 110) : point.y };
    this.runBehavior(resident, 'fleeing', target, duration, 'alert');
  }

  busy(resident) {
    return resident.held || this.wildlife.held(resident.body) || resident.recovery || this.owns(resident)
      || ['foraging', 'snacking', 'visiting', 'visiting-flight', 'feeding', 'returning'].includes(resident.state);
  }

  tingle(jellyfish, other) {
    if (this.island.time < this.playAt || this.busy(jellyfish)) return false;
    const blobby = other.id === 'blob';
    if (blobby ? [...this.island.drags.values()].some(drag => drag.kind === 'blob') : this.busy(other)) return false;
    if (other.body.position.y < this.island.layout.water + 18 || distance(jellyfish.body.position, other.body.position) > jellyfish.width * 0.55 + (blobby ? 35 : other.width * 0.5)) return false;
    const { time } = this.island;
    if (blobby) {
      this.island.blob.tingleUntil = time + 1100;
      this.island.nudge(other.body.position.x < jellyfish.body.position.x ? -0.45 : 0.45, -0.12, false);
    } else {
      other.tingleUntil = time + 1100;
      this.flee(other, jellyfish.body.position, 1100);
      other.thought = 'tingle'; other.thoughtUntil = time + 1100;
    }
    this.effects.push({ id: ++this.effectSerial, kind: 'tingle', ...other.body.position, time });
    this.wildlife.meet('gentle-tingle', jellyfish, other);
    this.wildlife.say(jellyfish);
    this.playAt = time + 11000;
    return true;
  }

  play(first, second) {
    const { time } = this.island;
    if (time < this.playAt || this.busy(first) || this.busy(second)) return false;
    if (first.species === 'jellyfish') return this.tingle(first, second);
    if (distance(this.wildlife.position(first), this.wildlife.position(second)) > 115 || this.wildlife.random() > 0.38) return false;
    const landTag = LAND.has(first.species) && LAND.has(second.species);
    const birdChase = first.species === 'bird' && second.species === 'fish';
    const peekaboo = first.species === 'octopus' && ['fish', 'starfish', 'crab'].includes(second.species);
    if (!landTag && !birdChase && !peekaboo) return false;
    const bounds = AQUATIC.has(second.species) ? this.wildlife.water : this.wildlife.groundHabitat(second);
    const direction = second.body.position.x < first.body.position.x ? -1 : 1;
    this.runBehavior(second, 'play-retreat', { x: clamp(second.body.position.x + direction * 105, bounds.minX + 12, bounds.maxX - 12), y: second.body.position.y }, 1900, 'heart');
    this.runBehavior(first, peekaboo ? 'peekaboo' : 'play-chase', {
      x: peekaboo ? clamp(first.home.x, this.wildlife.water.minX, this.wildlife.water.maxX) : second.body.position.x,
      y: birdChase ? this.island.layout.water - 45 : first.body.position.y,
    }, 2100, 'heart');
    first.playmate = second.id;
    if (landTag) first.depthTarget = second.depth;
    if (peekaboo) this.effects.push({ id: ++this.effectSerial, kind: 'ink-puff', ...first.body.position, time });
    this.wildlife.meet(peekaboo ? 'peekaboo' : birdChase ? 'bird-fish-play' : 'playful-chase', first, second);
    this.wildlife.say(first); this.wildlife.say(second);
    this.playAt = time + 6000 + this.wildlife.random() * 6000;
    return true;
  }

  tick() {
    const { time } = this.island;
    const { residents } = this.wildlife;
    this.effects = this.effects.filter(effect => time - effect.time < 4500).slice(-12);
    const shark = residents.find(resident => resident.species === 'shark');
    if (shark.held || shark.immersion < 0.7) {
      this.prey = null;
      this.huntAt = Math.max(this.huntAt, time + 3500);
    } else if (this.prey) {
      const prey = this.prey === 'blob' ? { id: 'blob', body: this.island.blob.center } : residents.find(resident => resident.id === this.prey);
      if (!prey || this.wildlife.held(prey.body) || prey.body.position.y < this.island.layout.water + 20 || time >= this.huntUntil) {
        this.endHunt(shark);
      } else {
        const nearby = distance(prey.body.position, shark.body.position);
        this.runBehavior(shark, nearby < 190 ? 'lunging' : 'stalking', { x: clamp(prey.body.position.x + prey.body.velocity.x * 9, this.wildlife.water.minX + 45, this.wildlife.water.maxX - 45), y: clamp(prey.body.position.y, this.wildlife.water.minY + 15, this.wildlife.water.maxY - 15) }, 550, 'fish');
        for (const resident of residents) {
          if (resident === shark || !AQUATIC.has(resident.species) || resident.immersion < 0.5 || distance(resident.body.position, shark.body.position) > 260) continue;
          if (resident.state !== 'fleeing') this.wildlife.meet('fleeing-shark', resident, shark);
          this.flee(resident, shark.body.position);
        }
        if (nearby < 83 || time > this.huntUntil - 180) {
          shark.snapUntil = time + 600;
          this.wildlife.meet('shark-snap', shark, prey);
          this.endHunt(shark);
        }
      }
    } else if (time >= this.huntAt) {
      const candidates = residents.filter(resident => ['fish', 'octopus'].includes(resident.species) && resident.immersion > 0.8 && !resident.held);
      if (this.island.blob.center.position.y > this.island.layout.water + 45 && ![...this.island.drags.values()].some(drag => drag.kind === 'blob')) candidates.push({ id: 'blob', body: this.island.blob.center });
      candidates.sort((first, second) => distance(first.body.position, shark.body.position) - distance(second.body.position, shark.body.position));
      if (candidates.length) {
        this.prey = candidates[Math.floor(this.wildlife.random() * Math.min(2, candidates.length))].id;
        this.huntUntil = time + 6500;
        this.wildlife.meet('shark-hunt', shark, { id: this.prey });
      } else this.huntAt = time + 6000;
    }
    if (time < this.nextNotice) return;
    this.nextNotice = time + 450;
    const jellyfish = residents.find(resident => resident.species === 'jellyfish');
    this.tingle(jellyfish, { id: 'blob', body: this.island.blob.center });
    for (const first of residents) {
      if (first.held || first.recovery || this.owns(first)) continue;
      for (const second of residents) {
        if (first === second || second.held || distance(this.wildlife.position(first), this.wildlife.position(second)) > 135) continue;
        const key = `${first.id}:${second.id}`;
        if (time - (this.pairTimes.get(key) ?? -Infinity) < 15000) continue;
        this.pairTimes.set(key, time);
        const response = encounterResponse(first.species, second.species);
        first.attention = { id: second.id, response }; first.attentionUntil = time + 1500;
        this.wildlife.meet(`neighbor-${response}`, first, second);
        if (this.play(first, second)) break;
        if (['wandering', 'resting', 'drifting', 'cruising', 'exploring'].includes(first.state)) {
          const point = first.body.position;
          const other = second.body.position;
          const direction = point.x < other.x ? -1 : 1;
          if (['avoid', 'give-space', 'drift-around'].includes(response)) {
            const bounds = AQUATIC.has(first.species) ? this.wildlife.water : this.wildlife.groundHabitat(first);
            this.runBehavior(first, 'yielding', { x: clamp(point.x + direction * 65, bounds.minX, bounds.maxX), y: point.y }, 850, 'home');
          } else if (LAND.has(first.species) && LAND.has(second.species)) {
            first.depthTarget = clamp(second.depth + direction * 20, 0, this.wildlife.profile.depth);
            first.thought = 'heart'; first.thoughtUntil = time + 900;
          }
        }
        break;
      }
    }
  }

  endHunt(shark) {
    this.prey = null;
    this.huntAt = this.island.time + 26000 + this.wildlife.random() * 27000;
    this.runBehavior(shark, 'turning', { x: clamp(shark.body.position.x - shark.direction * 170, this.wildlife.water.minX + 45, this.wildlife.water.maxX - 45), y: shark.body.position.y + 25 }, 2100);
  }
}

module.exports = { LivingInteractions, encounterResponse, AGENDAS };