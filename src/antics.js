const { Bodies, Body, Composite } = require('matter-js');
const { residentSound } = require('./sound-context.js');

const MOMENTS = {
  bird: 'dropping', fish: 'bubble-ring', crab: 'claw-dance', tortoise: 'sneeze', jellyfish: 'hiccup',
  shark: 'yawn', octopus: 'ink-puff', lizard: 'tongue-flick', rabbit: 'binky', starfish: 'cartwheel', blob: 'blobby-hiccup',
  monkey: 'tail-curl',
  frog: 'somersault',
};
const REPERTOIRE = {
  bird: ['dropping', 'wing-settle', 'beak-polish', 'landing-flare'],
  fish: ['bubble-ring', 'fin-fan', 'tail-wiggle', 'bubble-kiss'],
  crab: ['claw-dance', 'shell-polish', 'sand-sift', 'eyestalk-spin'],
  tortoise: ['sneeze', 'shell-shimmy', 'long-stretch', 'sleepy-nod'],
  jellyfish: ['hiccup', 'bell-flare', 'tentacle-twist', 'pearl-bubbles'],
  shark: ['yawn', 'tail-swish', 'toothy-grin', 'nose-bubble'],
  octopus: ['ink-puff', 'arm-knot', 'shell-juggle', 'peekaboo-wave'],
  lizard: ['tongue-flick', 'throat-fan', 'tail-chase', 'sun-stretch'],
  rabbit: ['binky', 'ear-flick', 'nose-twitch', 'sand-dig'],
  starfish: ['cartwheel', 'arm-wave', 'sand-star', 'slow-spin'],
  monkey: ['tail-curl', 'long-stretch', 'tail-wiggle', 'binky'],
  frog: ['somersault', 'throat-puff', 'long-stretch', 'happy-hop'],
  blob: ['blobby-hiccup', 'wobble-settle', 'colour-shimmer', 'sneeze-jiggle', 'delighted-squish', 'bubble-blow'],
};
const SIGNATURES = { mango: 'sun-salute', fern: 'tail-surprise', clover: 'warning-thump', thistle: 'sideways-binky',
  aster: 'slow-cartwheel', pearl: 'upside-down', fin: 'perfect-ring', pip: 'broken-ring' };
const FIDGETS = { bird: 'wing-settle', fish: 'fin-fan', crab: 'shell-polish', tortoise: 'sleepy-nod', jellyfish: 'bell-flare',
  shark: 'tail-swish', octopus: 'arm-wave', lizard: 'tail-wiggle', rabbit: 'nose-twitch', starfish: 'arm-wave', monkey: 'tail-wiggle', frog: 'throat-puff' };
const SPINS = new Set(['cartwheel', 'slow-cartwheel', 'slow-spin', 'upside-down', 'tail-chase', 'arm-knot']);

function comicPose(kind, progress, intensity = 1) {
  const anticipation = progress < 0.14 ? Math.sin(progress / 0.14 * Math.PI) : 0;
  const active = Math.max(0, Math.min(1, (progress - 0.14) / 0.64));
  const pulse = Math.sin(active * Math.PI);
  const bounce = /binky|thump|surprise|hiccup/.test(kind);
  const stretch = /stretch|salute|flare|fan/.test(kind);
  return { scaleX: 1 + anticipation * 0.09 + (stretch ? pulse * 0.12 : Math.sin(active * Math.PI * 4) * pulse * 0.025),
    scaleY: 1 - anticipation * 0.10 + (stretch || kind === 'delighted-squish' ? -pulse * 0.08 : 0),
    rotation: SPINS.has(kind) ? active * Math.PI * 2 : /wiggle|swish|shimmy|settle|binky|jiggle/.test(kind) ? Math.sin(active * Math.PI * 4) * pulse * 0.14 * intensity : 0,
    lift: bounce ? -pulse * 4 * intensity : 0, pulse, anticipation, active };
}
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
    this.history = new Map();
    this.pending = [];
    this.fidgetCounts = {};
    this.blobbyFidgetAt = 20000;
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
    this.fidgets();
    for (const pending of [...this.pending]) {
      if (time < pending.at) continue;
      this.pending.splice(this.pending.indexOf(pending), 1);
      const resident = pending.resident;
      const blocked = resident.id === 'blob' ? [...this.island.drags.values()].some(drag => drag.kind === 'blob')
        : this.wildlife.held(resident.body) || resident.recovery || resident.behaviorUntil > time
          || resident.species === 'frog' && (!resident.grounded || resident.immersion > 0.05)
          || ['snacking', 'visiting', 'visiting-flight', 'foraging', 'feeding', 'returning', 'startled', 'fleeing'].includes(resident.state);
      if (blocked) {
        resident.anticUntil = time;
        if (resident.id === 'blob') this.island.blob.anticUntil = time;
        continue;
      }
      this.action(resident, pending.kind);
    }
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
      if (held || resident && (resident.recovery || resident.behaviorUntil > time
        || resident.species === 'frog' && (!resident.grounded || resident.immersion > 0.05)
        || ['snacking', 'visiting', 'visiting-flight', 'foraging', 'feeding', 'returning', 'startled', 'fleeing'].includes(resident.state))) {
        this.nextAt.set(id, time + 4000);
        continue;
      }
      const position = resident ? this.wildlife.position(resident) : { ...this.island.blobPosition(), y: this.island.blobPosition().y + this.island.blob.depth };
      if (this.events.some(event => event.character && time - event.time < 2500 && Math.abs(event.x - position.x) < 150 && Math.abs(event.y - position.y) < 105)) {
        this.nextAt.set(id, time + 750); continue;
      }
      this.perform(resident || { id: 'blob', species: 'blob', body: this.island.blob.center });
      this.schedule(id);
      this.lastAt = time;
      break;
    }
  }

  choose(resident) {
    const history = this.history.get(resident.id) || [];
    if (!history.length) return MOMENTS[resident.species];
    const recent = new Set(history.slice(-3).map(entry => entry.kind));
    const repertoire = [...REPERTOIRE[resident.species], ...(SIGNATURES[resident.id] ? [SIGNATURES[resident.id]] : [])];
    const available = repertoire.filter(kind => !recent.has(kind) && (kind !== 'bubble-blow' || this.island.blobPosition().y > this.island.layout.water));
    const traits = resident.traits || { clumsy: 0.5, vain: 0.5, curious: 0.5 };
    const context = this.activity.get(resident.id)?.trigger?.kind || '';
    const weighted = available.map(kind => ({ kind, weight: kind === SIGNATURES[resident.id] ? 2.8
      : /polish|fan|salute|grin/.test(kind) ? 0.6 + traits.vain * 2
        : /binky|spin|surprise|twist/.test(kind) ? 0.6 + traits.clumsy * 2 + (/play/.test(context) ? 0.7 : 0) : 0.8 + traits.curious }));
    let choice = this.wildlife.random() * weighted.reduce((total, entry) => total + entry.weight, 0);
    return (weighted.find(entry => { choice -= entry.weight; return choice <= 0; }) || weighted.at(-1)).kind;
  }

  fidgets() {
    const { time } = this.island;
    let active = this.wildlife.residents.filter(resident => resident.fidgetUntil > time).length;
    for (const resident of this.wildlife.residents) {
      if (active >= 3 || this.wildlife.held(resident.body) || resident.recovery || resident.anticUntil > time || resident.fidgetUntil > time || time < (resident.fidgetAt || 12000)) continue;
      if (['foraging', 'snacking', 'visiting', 'visiting-flight', 'returning', 'feeding', 'startled', 'fleeing'].includes(resident.state)) continue;
      const crowded = this.wildlife.residents.some(other => other !== resident && Math.hypot(other.body.position.x - resident.body.position.x, other.body.position.y + other.depth - resident.body.position.y - resident.depth) < 55);
      const conflict = resident.needs && (resident.needs.hunger > 0.55 && !resident.foodId && Math.abs(resident.body.velocity.x) < 0.4
        || resident.needs.energy < 0.7 && crowded || resident.needs.social > 0.5 && resident.avoidSpot);
      if (!conflict) continue;
      resident.fidget = FIDGETS[resident.species]; resident.fidgetStart = time;
      resident.fidgetUntil = time + 450 + this.wildlife.random() * 400;
      resident.fidgetAt = time + 12000;
      this.fidgetCounts[resident.fidget] = (this.fidgetCounts[resident.fidget] || 0) + 1;
      active += 1;
    }
    const blob = this.island.blob;
    const position = this.island.blobPosition();
    if (time >= this.blobbyFidgetAt && ![...this.island.drags.values()].some(drag => drag.kind === 'blob')
      && Math.hypot(blob.center.velocity.x, blob.center.velocity.y) < 0.8
      && this.wildlife.residents.some(resident => Math.hypot(resident.body.position.x - position.x, resident.body.position.y - position.y) < 105)) {
      blob.fidget = position.y > this.island.layout.water ? 'bubble-blow' : 'wobble-settle';
      blob.fidgetStart = time; blob.fidgetUntil = time + 800; this.blobbyFidgetAt = time + 18000;
      this.fidgetCounts[blob.fidget] = (this.fidgetCounts[blob.fidget] || 0) + 1;
    }
  }

  perform(resident) {
    const { time } = this.island;
    const position = resident.id === 'blob' ? this.island.blobPosition() : this.wildlife.position(resident);
    if (resident.id === 'blob') position.y += this.island.blob.depth;
    const kind = this.choose(resident);
    const history = this.history.get(resident.id) || [];
    const repetition = history.filter(entry => entry.kind === kind && time - entry.time < 720000).length + 1;
    history.push({ kind, time }); this.history.set(resident.id, history.slice(-12));
    this.counts[kind] = (this.counts[kind] || 0) + 1;
    const trigger = this.activity.get(resident.id)?.trigger;
    const event = { id: ++this.serial, kind, character: resident.id, x: position.x, y: position.y, time, escalation: repetition % 3 === 0 ? 1.4 : 1, generation: 0, baselineAt: this.activity.get(resident.id)?.baselineAt, source: trigger ? 'interaction' : 'baseline', trigger: trigger ? { ...trigger } : null };
    this.events.push(event);
    this.events = this.events.slice(-16);
    resident.antic = kind;
    resident.anticStart = time;
    resident.anticUntil = time + 2500;
    resident.anticIntensity = event.escalation;
    if (resident.id === 'blob') Object.assign(this.island.blob, { antic: kind, anticStart: time, anticUntil: time + 2500 });
    this.pending.push({ resident, kind, at: time + 350 });
    for (const witness of this.wildlife.residents) {
      if (witness === resident || witness.anticUntil > time || this.wildlife.held(witness.body) || witness.recovery || Math.hypot(witness.body.position.x - position.x, witness.body.position.y + witness.depth - position.y) > 135) continue;
      witness.comicReaction = witness.traits.curious > 0.7 ? 'copy' : witness.traits.bold < 0.3 ? 'startle' : 'amused';
      witness.comicReactionUntil = time + 1700; witness.comicSource = event.id; witness.comicGeneration = 1;
    }
  }

  action(resident, kind) {
    const { time } = this.island;
    const position = resident.id === 'blob' ? this.island.blobPosition() : this.wildlife.position(resident);
    if (kind === 'dropping' && this.droppings.length < 2) {
      const body = Bodies.circle(position.x - resident.direction * 9, position.y + 17, 3.5, { label: 'bird-dropping', isSensor: true, frictionAir: 0.007 });
      Body.setVelocity(body, { x: resident.body.velocity.x * 0.5, y: 0.7 });
      this.droppings.push({ body, time });
      Composite.add(this.island.engine.world, body);
    } else if (resident.species === 'frog' && ['somersault', 'happy-hop'].includes(kind) && resident.grounded) {
      Body.setVelocity(resident.body, { x: resident.direction * 2.2, y: kind === 'somersault' ? -6.4 : -4.4 });
      resident.hopAt = time; resident.hopPrepareUntil = null;
      resident.flipAt = kind === 'somersault' ? time : null;
    } else if (['binky', 'sideways-binky'].includes(kind) && resident.grounded) Body.setVelocity(resident.body, { x: resident.direction * 1.4, y: -4.6 });
    else if (resident.id === 'blob' && kind === 'blobby-hiccup') {
      this.island.blob.hiccupUntil = time + 1300;
      for (const particle of this.island.blob.particles) Body.applyForce(particle, particle.position, { x: 0, y: -particle.mass * 0.0012 });
    }
    this.island.queueSound(resident.id === 'blob' ? 'grab' : `voice-${resident.species}`, 1.6, position.x, residentSound(resident, kind));
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
    return { scheduled: Object.fromEntries(this.nextAt), counts: { ...this.counts }, fidgets: { ...this.fidgetCounts }, history: Object.fromEntries([...this.history].map(([id, entries]) => [id, entries.map(entry => ({ ...entry }))])), events: this.events.map(event => ({ ...event })),
      activity: Object.fromEntries([...this.activity].map(([id, activity]) => [id, { ...activity, trigger: activity.trigger ? { ...activity.trigger } : null }])),
      droppings: this.droppings.map(drop => ({ x: drop.body.position.x, y: drop.body.position.y })) };
  }
}

module.exports = { ComicMoments, MOMENTS, REPERTOIRE, SIGNATURES, comicPose };