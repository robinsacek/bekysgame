const { Bodies, Body, Composite } = require('matter-js');

const MOMENTS = {
  bird: 'dropping', fish: 'bubble-ring', crab: 'claw-dance', tortoise: 'sneeze', jellyfish: 'hiccup',
  shark: 'yawn', octopus: 'ink-puff', lizard: 'tongue-flick', rabbit: 'binky', starfish: 'cartwheel', blob: 'blobby-hiccup',
};
const CONTEXTS = new Set(['schooling', 'shore-greeting', 'picnic-visit', 'toy-interest', 'blob-curiosity', 'blob-retreat', 'fish-startled-by-bird', 'fish-yield-to-shark', 'shark-snap', 'habitat-return', 'food-found', 'playful-chase', 'bird-fish-play', 'peekaboo', 'gentle-tingle']);

class ComicMoments {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.island = wildlife.island;
    this.events = [];
    this.droppings = [];
    this.nextAt = new Map();
    this.activity = new Map();
    this.lastAt = -10000;
    this.serial = 0;
    this.counts = {};
    for (const resident of [...wildlife.residents, { id: 'blob' }]) this.schedule(resident.id);
  }

  schedule(id) {
    const time = this.island.time;
    const baselineAt = time + 60000 + this.wildlife.random() * 360000;
    this.nextAt.set(id, baselineAt);
    this.activity.set(id, { baselineAt, eligibleAt: time + 60000, score: 0, updatedAt: time, lastNotice: time - 8000, notices: 0, chance: 0, trigger: null });
  }

  notice(kind, first, second) {
    if (!CONTEXTS.has(kind) && !kind.startsWith('neighbor-')) return;
    const { time } = this.island;
    for (const [id, partner] of new Map([[first.id, second.id], [second.id, first.id]])) {
      const activity = this.activity.get(id);
      const resident = this.wildlife.residents.find(item => item.id === id);
      const held = id === 'blob' ? [...this.island.drags.values()].some(drag => drag.kind === 'blob') : resident && this.wildlife.held(resident.body);
      if (!activity || held || time - activity.lastNotice < 8000) continue;
      const weight = kind.startsWith('neighbor-') ? 0.09 : 0.23;
      activity.score = Math.min(1, activity.score * Math.exp(-(time - activity.updatedAt) / 60000) + weight);
      activity.updatedAt = time; activity.lastNotice = time; activity.notices += 1;
      activity.chance = 0.06 + activity.score * 0.36;
      if (time < activity.eligibleAt || this.nextAt.get(id) <= time + 1200) continue;
      let next = Math.max(time, this.nextAt.get(id) - 6000 - activity.score * 14000);
      if (this.wildlife.random() < activity.chance) next = Math.min(next, time + 250 + this.wildlife.random() * 750);
      this.nextAt.set(id, next);
      activity.trigger = { kind, partner, time, chance: activity.chance };
    }
  }

  tick() {
    const { time } = this.island;
    this.events = this.events.filter(event => time - event.time < 4500);
    for (const drop of [...this.droppings]) {
      const position = drop.body.position;
      const water = position.x > this.island.layout.waterStart && position.x < this.island.layout.waterEnd;
      const surface = water ? this.island.surfaceAt(position.x) : this.island.floorAt(position.x);
      if (position.y >= surface - 2 || time - drop.time > 4000) {
        Composite.remove(this.island.engine.world, drop.body);
        this.droppings.splice(this.droppings.indexOf(drop), 1);
        this.events.push({ id: ++this.serial, kind: 'splat', x: position.x, y: surface, time });
        this.grossOut({ x: position.x, y: surface });
      }
    }
    if (time - this.lastAt < 1800) return;
    for (const [id, next] of this.nextAt) {
      if (time < next) continue;
      const resident = this.wildlife.residents.find(item => item.id === id);
      const held = id === 'blob' ? [...this.island.drags.values()].some(drag => drag.kind === 'blob') : this.wildlife.held(resident.body);
      if (held || resident && (resident.recovery || resident.behaviorUntil > time || ['snacking', 'visiting', 'foraging', 'feeding'].includes(resident.state))) {
        this.nextAt.set(id, time + 4000);
        continue;
      }
      this.perform(resident || { id: 'blob', species: 'blob', body: this.island.blob.center });
      this.schedule(id);
      this.lastAt = time;
      break;
    }
  }

  perform(resident) {
    const { time } = this.island;
    const position = resident.id === 'blob' ? this.island.blobPosition() : this.wildlife.position(resident);
    if (resident.id === 'blob') position.y += this.island.blob.depth;
    const kind = MOMENTS[resident.species];
    this.counts[kind] = (this.counts[kind] || 0) + 1;
    const trigger = this.activity.get(resident.id)?.trigger;
    const event = { id: ++this.serial, kind, character: resident.id, x: position.x, y: position.y, time, baselineAt: this.activity.get(resident.id)?.baselineAt, source: trigger ? 'interaction' : 'baseline', trigger: trigger ? { ...trigger } : null };
    this.events.push(event);
    this.events = this.events.slice(-16);
    resident.antic = kind;
    resident.anticUntil = time + 2500;
    if (resident.species === 'bird' && this.droppings.length < 2) {
      const body = Bodies.circle(position.x - resident.direction * 9, position.y + 17, 3.5, { label: 'bird-dropping', isSensor: true, frictionAir: 0.007 });
      Body.setVelocity(body, { x: resident.body.velocity.x * 0.5, y: 0.7 });
      this.droppings.push({ body, time });
      Composite.add(this.island.engine.world, body);
    } else if (resident.species === 'rabbit' && resident.grounded) Body.setVelocity(resident.body, { x: resident.direction * 1.4, y: -4.6 });
    else if (resident.id === 'blob') {
      this.island.blob.hiccupUntil = time + 1300;
      for (const particle of this.island.blob.particles) Body.applyForce(particle, particle.position, { x: 0, y: -particle.mass * 0.0012 });
    }
    this.island.queueSound(resident.id === 'blob' ? 'grab' : `voice-${resident.species}`, 1.6, position.x);
  }

  grossOut(position) {
    const { time } = this.island;
    for (const resident of this.wildlife.residents) {
      if (resident.species === 'bird' || Math.hypot(this.wildlife.position(resident).x - position.x, this.wildlife.position(resident).y - position.y) > 125) continue;
      resident.ewwUntil = time + 2300;
      this.wildlife.interactions.flee(resident, position, 1800);
      resident.thought = 'ewww'; resident.thoughtUntil = time + 2300;
      this.wildlife.meet('ewww', resident, { id: 'bird-dropping' });
      this.wildlife.say(resident);
    }
    const blobby = this.island.blobPosition();
    blobby.y += this.island.blob.depth;
    if (Math.hypot(blobby.x - position.x, blobby.y - position.y) < 130) {
      this.island.blob.ewwUntil = time + 2300;
      if (![...this.island.drags.values()].some(drag => drag.kind === 'blob')) this.island.nudge(blobby.x < position.x ? -0.9 : 0.9, -0.35, false);
    }
  }

  snapshot() {
    return { scheduled: Object.fromEntries(this.nextAt), counts: { ...this.counts }, events: this.events.map(event => ({ ...event })),
      activity: Object.fromEntries([...this.activity].map(([id, activity]) => [id, { ...activity, trigger: activity.trigger ? { ...activity.trigger } : null }])),
      droppings: this.droppings.map(drop => ({ x: drop.body.position.x, y: drop.body.position.y })) };
  }
}

module.exports = { ComicMoments, MOMENTS };