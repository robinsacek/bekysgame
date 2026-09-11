const { Bodies, Body, Composite, Vector, Bounds } = require('matter-js');
const { LivingInteractions } = require('./encounters.js');
const { ComicMoments } = require('./antics.js');
const { setBodyDepth } = require('./depth-space.js');
const { Foraging } = require('./foraging.js');
const { FlightNavigation } = require('./flight-navigation.js');
const { residentSound } = require('./sound-context.js');
const { IndividualLife } = require('./individuality.js');
const { feedingPose, frogJumpPose } = require('./creature-pose.js');
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const SWIMMERS = new Set(['fish', 'jellyfish', 'shark', 'octopus', 'starfish']);
const LAND_RESIDENTS = new Set(['crab', 'tortoise', 'lizard', 'rabbit', 'monkey', 'frog']);

class Wildlife {
  constructor(island) {
    this.island = island;
    this.profile = island.map.ecology;
    this.seed = 941 + [...island.map.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    this.encounters = [];
    this.serial = 0;
    this.encounterCounts = {};
    const { layout, landmarks } = island;
    this.water = { minX: layout.toe + 35, maxX: layout.farToe - 35, minY: layout.water + 30, maxY: layout.bottom - 26 };
    this.strand = { minX: 95, maxX: layout.shore - 40, minY: layout.ground - 55, maxY: layout.ground };
    this.perch = { x: island.width * 0.105 + island.tree.lean * island.tree.scale + 20, y: layout.ground - 8 - island.tree.height * island.tree.scale - 24 };
    this.group = Body.nextGroup(true);
    this.residents = [
      this.create('fin', 'Fin', 'fish', landmarks.reef.x - 70, layout.water + 77, 30, 18, 1.9),
      this.create('pip', 'Pip', 'fish', landmarks.reef.x + 30, layout.water + 101, 24, 15, 1.7),
      this.create('pebble', 'Pebble', 'crab', landmarks.nook.x - 110, layout.ground - 13, 28, 20, 1.0),
      this.create('moss', 'Moss', 'tortoise', landmarks.picnic.x + 115, layout.ground - 24, 64, 43, 0.62),
      this.create('skipper', 'Skipper', 'bird', this.perch.x - 5, this.perch.y - 5, 40, 30, 3.6),
      this.create('lumi', 'Lumi', 'jellyfish', landmarks.reef.x - 175, layout.water + 67, 40, 54, 0.65),
      this.create('drift', 'Drift', 'shark', landmarks.reef.x + 155, layout.water + 105, 148, 58, 1.85),
      this.create('ollie', 'Ollie', 'octopus', landmarks.reef.x + 68, island.floorAt(landmarks.reef.x + 68) - 33, 66, 56, 0.92),
    ];
    const special = island.map.resident;
    this.residents.push(this.create(special.id, special.name, special.species, island.width * special.x,
      SWIMMERS.has(special.species) ? island.floorAt(island.width * special.x) - 24 : layout.ground - special.height * 0.45, special.width, special.height, special.speed));
    for (const visitor of island.map.visitors) {
      const resident = this.create(visitor.id, visitor.name, visitor.species, island.width * visitor.x,
        SWIMMERS.has(visitor.species) ? island.floorAt(island.width * visitor.x) - visitor.height * 0.6 - 5 : layout.ground - visitor.height * 0.5, visitor.width, visitor.height, visitor.speed);
      resident.appearance = visitor.appearance;
      this.residents.push(resident);
    }
    this.residents.push(this.create('momo', 'Momo', 'monkey', island.tree.base.x + 120, layout.ground - 24, 52, 56, 1.25));
    this.residents.push(this.create('puddle', 'Puddle', 'frog', island.width * 0.12, layout.ground - 13, 34, 30, 1.25),
      this.create('sprig', 'Sprig', 'frog', island.width * 0.235, layout.ground - 11, 28, 25, 1.1));
    this.interactions = new LivingInteractions(this);
    this.comedy = new ComicMoments(this);
    this.foraging = new Foraging(this);
    this.flightNavigation = new FlightNavigation(island);
    this.individuals = new IndividualLife(this);
  }

  random() {
    this.seed = Math.imul(this.seed, 1664525) + 1013904223 | 0;
    return (this.seed >>> 0) / 4294967296;
  }

  create(id, name, species, positionX, positionY, width, height, speed) {
    const local = this.island.map.cast[id] || {};
    name = local.name || name; width = local.width || width; height = local.height || height; speed = local.speed || speed;
    if (SWIMMERS.has(species)) speed *= this.profile.marineSpeed;
    const body = Bodies.rectangle(positionX, positionY, width * 0.82, height * 0.82, {
      chamfer: { radius: Math.min(height * 0.38, 12) }, label: `creature:${species}`,
      friction: 0.015, frictionStatic: 0.03, frictionAir: 0.025, restitution: 0.12, collisionFilter: { group: this.group },
    });
    Body.setMass(body, species === 'tortoise' ? 1.15 : species === 'shark' ? 2.8 : species === 'octopus' ? 0.55 : species === 'fish' ? 0.15 : species === 'frog' ? 0.09 : 0.22);
    Body.setInertia(body, Infinity);
    Composite.add(this.island.engine.world, body);
    return { id, name, species, body, width, height, speed, appearance: local.appearance || species, home: { x: positionX, y: positionY }, target: { x: positionX, y: positionY },
      state: species === 'bird' ? 'perching' : 'wandering', until: species === 'bird' ? 2000 : 0, decideAt: 0,
      direction: 1, phase: this.random() * Math.PI * 2, transitions: 0, socialAt: -10000, threatAt: -10000, visits: 0,
      interactionAt: -10000, playAt: -10000, reactions: 0, bank: 0, flight: 'perched', flapPhase: 0, wingLift: 0, flightBlend: 0, landingBlend: 1, motionPhase: 0, facing: 1, pulse: 0,
      immersion: 0, wetness: 0, medium: 'air', grounded: false, hopAt: -2000, lastImmersion: 0, voiceAt: -10000,
      outsideSince: null, rescue: false, recovery: '', depth: 0, depthTarget: 0, depthVelocity: 0, detourUntil: 0,
      thought: '', thoughtUntil: 0, lastPosition: { x: positionX, y: positionY }, stuckAt: 0, held: false };
  }

  held(body) { return [...this.island.drags.values()].some(drag => drag.body === body); }

  change(resident, state, target, duration = 0, thought = '') {
    if (this.individuals && ['fleeing', 'startled'].includes(state) && !['fleeing', 'startled'].includes(resident.state)) this.individuals.fright(resident, resident.body.position);
    if (resident.state !== state) resident.transitions += 1;
    resident.state = state;
    resident.target = { ...(this.individuals?.target(resident, state, target) || target) };
    resident.until = this.island.time + duration;
    if (['returning', 'foraging', 'snacking', 'inspecting', 'toy-play', 'curious', 'following', 'playing', 'companion'].includes(state)) resident.depthTarget = 0;
    if (thought) { resident.thought = thought; resident.thoughtUntil = this.island.time + 1600; }
  }

  meet(kind, first, second) {
    this.encounters.push({ id: ++this.serial, kind, first: first.id, second: second.id, time: this.island.time });
    this.encounters = this.encounters.slice(-32);
    this.encounterCounts[kind] = (this.encounterCounts[kind] || 0) + 1;
    this.individuals?.notice(kind, first, second);
    this.comedy?.notice(kind, first, second);
    this.island.objectives?.observeEncounter(kind, first, second);
    if (second.id === 'blob' || kind === 'picnic-visit' || kind === 'shore-greeting') this.say(first);
  }

  say(resident) {
    if (this.island.time - resident.voiceAt < 4200 || distance(resident.body.position, this.island.blobPosition()) > 340) return;
    resident.voiceAt = this.island.time;
    this.island.queueSound(`voice-${resident.species}`, 1.5, resident.body.position.x, residentSound(resident));
  }

  position(resident) {
    return { x: resident.body.position.x, y: resident.body.position.y + resident.depth };
  }

  inHabitat(resident) {
    const point = resident.body.position;
    if (SWIMMERS.has(resident.species)) return point.x > this.island.layout.waterStart + resident.width * 0.3 && point.x < this.island.layout.waterEnd - resident.width * 0.3
      && point.y >= this.island.surfaceAt(point.x) + resident.height * 0.25 && point.y <= this.island.floorAt(point.x) - resident.height * 0.3 + 3;
    if (resident.species === 'bird') return point.x >= 55 && point.x <= this.island.width - 55 && point.y >= 110 && point.y < this.island.layout.water - 8
      && (!resident.exitDock || resident.body.bounds.max.y < this.island.dock.bounds.min.y - 8);
    const ground = this.groundHabitat(resident);
    return point.x >= ground.minX - 12 && point.x <= ground.maxX + 12 && point.y < ground.maxY + 35;
  }

  groundHabitat(resident) {
    if (resident.body.position.x > (this.island.layout.shore + this.island.layout.farShore) / 2) {
      return { minX: this.island.layout.farShore + 30, maxX: this.island.width - 65, minY: this.island.layout.farGround - 55, maxY: this.island.layout.farGround };
    }
    return this.strand;
  }

  recover(resident) {
    const aquatic = SWIMMERS.has(resident.species);
    const bounds = aquatic ? this.water : resident.species === 'bird' ? { minX: 80, maxX: this.island.width - 80, minY: 185, maxY: 340 } : this.groundHabitat(resident);
    let target = {
      x: clamp(resident.body.position.x, bounds.minX + 20, bounds.maxX - 20),
      y: aquatic ? clamp(resident.body.position.y, bounds.minY + 15, bounds.maxY - 15) : resident.species === 'bird' ? 240 : bounds.maxY - resident.height * 0.6,
    };
    if (aquatic) {
      let nearest = Infinity;
      const margin = resident.width * 0.45 + 12;
      for (let positionX = this.island.layout.waterStart + margin; positionX < this.island.layout.waterEnd - margin; positionX += 24) {
        const surface = this.island.surfaceAt(positionX);
        const floor = this.island.floorAt(positionX);
        if (floor - surface < resident.height + 30) continue;
        if (resident.body.position.y < surface + resident.height && this.island.props.some(prop =>
          prop.density < 1 && prop.body.bounds.max.y > surface - 30 && prop.body.bounds.min.y < surface + resident.height
          && positionX > prop.body.bounds.min.x - margin && positionX < prop.body.bounds.max.x + margin)) continue;
        const dock = this.island.dock;
        if (dock && resident.body.position.y < surface && positionX > dock.bounds.min.x - margin && positionX < dock.bounds.max.x + margin) continue;
        const point = { x: positionX, y: clamp(resident.body.position.y, surface + resident.height * 0.55 + 12, floor - resident.height * 0.5 - 8) };
        const length = distance(resident.body.position, point);
        if (length < nearest) { nearest = length; target = point; }
      }
      let support = this.island.props.find(prop => prop.body.id === resident.waterExit?.bodyId);
      if (!support && resident.grounded && resident.immersion < 0.1) {
        support = this.island.props.find(prop => ['raft', 'log', 'driftwood'].includes(prop.kind)
          && resident.body.bounds.max.x > prop.body.bounds.min.x && resident.body.bounds.min.x < prop.body.bounds.max.x
          && Math.abs(resident.body.bounds.max.y - prop.body.bounds.min.y) < 8);
        if (support) resident.waterExit = { bodyId: support.body.id, side: resident.body.position.x < support.body.position.x ? -1 : 1 };
      }
      if (support && resident.immersion < 0.3) {
        const edge = resident.waterExit.side < 0 ? support.body.bounds.min.x - margin : support.body.bounds.max.x + margin;
        target = { x: clamp(edge, this.island.layout.waterStart + margin, this.island.layout.waterEnd - margin),
          y: this.island.surfaceAt(edge) + resident.height * 0.55 + 12 };
      }
    } else if (this.island.dock) {
      const dock = this.island.dock.bounds;
      const point = resident.body.position;
      const edge = dock.max.x + resident.width * 0.5 + 24;
      if (point.x > dock.min.x - resident.width / 2 && point.x < edge && point.y > dock.max.y) resident.exitDock = true;
      if (resident.exitDock) {
        if (resident.body.bounds.max.y < dock.min.y - 10) resident.dockClimbed = true;
        if (resident.dockClimbed && resident.body.bounds.max.x < dock.max.x - 6) { resident.exitDock = false; resident.dockClimbed = false; }
        else target = resident.dockClimbed ? { x: dock.max.x - resident.width * 0.6 - 20, y: dock.min.y - resident.height * 0.6 - 18 }
          : { x: edge, y: point.x < edge - 12 ? this.island.layout.water + resident.height * 0.7 : dock.min.y - resident.height * 0.6 - 18 };
      }
    }
    this.change(resident, 'returning', target, 600, 'home');
  }

  updateMedium(resident) {
    const { body, height } = resident;
    const point = body.position;
    const surface = this.island.surfaceAt(point.x);
    const horizontal = point.x > this.island.layout.waterStart && point.x < (this.island.layout.waterEnd || this.island.width);
    const immersion = horizontal ? clamp((point.y + height * 0.41 - surface) / (height * 0.82), 0, 1) : 0;
    const supports = [this.island.dock, ...this.island.props.filter(prop => Math.abs((prop.depth || 0) - resident.depth) < 25).map(prop => prop.body)].filter(Boolean);
    resident.grounded = body.velocity.y > -1.5 && (body.bounds.max.y >= this.island.floorAt(point.x) - 3
      || supports.some(support => support.bounds.min.x < body.bounds.max.x && support.bounds.max.x > body.bounds.min.x
        && Math.abs(body.bounds.max.y - support.bounds.min.y) < 4));
    resident.medium = immersion > 0.7 ? 'water' : immersion > 0.04 ? 'wading' : resident.grounded ? 'land' : 'air';
    resident.immersion = immersion;
    resident.wetness += ((immersion > 0.1 ? 1 : 0) - resident.wetness) * (immersion > 0.1 ? 0.18 : 0.012);
    if (immersion > 0.25 && resident.lastImmersion < 0.08 && body.velocity.y > 2.2) this.island.splash(point.x, Math.min(3, body.velocity.y * body.mass));
    resident.lastImmersion = immersion;
  }

  picnicFood() {
    const { picnic } = this.island.landmarks;
    return this.island.props.find(prop => prop.kind === 'coconut' && prop.playerHandled && !this.held(prop.body)
      && (prop.depth || 0) < 24
      && Math.abs(prop.body.position.x - picnic.x) < picnic.radius && Math.abs(prop.body.position.y - picnic.y) < 42
      && Vector.magnitude(prop.body.velocity) < 1.5);
  }

  respondToBlob(resident) {
    const { time, blob } = this.island;
    const point = resident.body.position;
    const jelly = this.island.blobPosition();
    const aquatic = SWIMMERS.has(resident.species);
    if (aquatic && jelly.y < this.island.layout.water + 14) return false;
    if (!aquatic && resident.species !== 'bird' && Math.abs(this.island.floorAt(jelly.x) - this.groundHabitat(resident).maxY) > 45) return false;
    if (['curious', 'following', 'playing', 'circling', 'companion'].includes(resident.state) && resident.until > time) return true;
    if (distance(this.position(resident), { x: jelly.x, y: jelly.y + this.island.blob.depth }) > (resident.species === 'bird' ? 230 : 175) || time - resident.interactionAt < 6800) return false;
    resident.interactionAt = time;
    resident.reactions += 1;
    const fast = Vector.magnitude(blob.center.velocity) > 4.2;
    const timid = this.random() < this.profile.caution;
    const bounds = aquatic ? this.water : this.groundHabitat(resident);
    const side = point.x < jelly.x ? -1 : 1;
    if (fast || timid) {
      this.change(resident, 'startled', { x: clamp(point.x + side * 115, bounds.minX, bounds.maxX), y: aquatic ? clamp(point.y + 20, bounds.minY, bounds.maxY) : resident.species === 'bird' ? Math.max(215, point.y - 95) : point.y }, 1000, 'alert');
      this.meet('blob-retreat', resident, { id: 'blob' });
      return true;
    }
    const choice = this.random();
    const state = resident.species === 'bird' ? 'circling' : resident.species === 'jellyfish' ? 'companion' : choice < 0.4 ? 'curious' : choice < 0.78 ? 'following' : 'playing';
    this.change(resident, state, { x: clamp(jelly.x + side * (resident.width / 2 + this.individuals.approachDistance(resident)), bounds.minX, bounds.maxX), y: aquatic ? clamp(jelly.y + 18, bounds.minY, bounds.maxY) : resident.species === 'bird' ? Math.max(230, jelly.y - 85) : point.y }, 1700 + choice * 1800, 'heart');
    if (LAND_RESIDENTS.has(resident.species)) resident.depthTarget = this.island.blob.depth;
    this.meet('blob-curiosity', resident, { id: 'blob' });
    return true;
  }

  playWithProp(resident) {
    const { time } = this.island;
    if (resident.state === 'toy-play' && resident.until > time) return true;
    if (time - resident.playAt < 5500) return false;
    const aquatic = SWIMMERS.has(resident.species);
    const kinds = aquatic ? ['shell', 'stone', 'bottle', ...this.island.map.interests] : ['ball', 'ring', ...this.island.map.interests];
    const toy = this.island.props.find(prop => prop.playerHandled && kinds.includes(prop.kind) && !this.held(prop.body)
      && distance({ x: prop.body.position.x, y: prop.body.position.y + (prop.depth || 0) }, this.position(resident)) < 175 && (aquatic ? prop.body.position.y > this.island.layout.water + 30 : prop.body.position.y < this.strand.maxY + 30));
    if (!toy) return false;
    resident.playAt = time; resident.toyId = toy.body.id;
    this.change(resident, 'toy-play', toy.body.position, 2300, resident.species === 'octopus' ? 'shell' : 'heart');
    if (!aquatic) resident.depthTarget = toy.depth || 0;
    this.meet('toy-interest', resident, { id: `toy-${toy.body.id}` });
    return true;
  }

  decideFish(resident) {
    const { time, blob } = this.island;
    const point = resident.body.position;
    const bird = this.residents.find(other => other.species === 'bird');
    const shark = this.residents.find(other => other.species === 'shark');
    const fastBlob = Vector.magnitude(blob.center.velocity) > 3 && distance(blob.center.position, point) < 160;
    const birdNear = bird.state === 'watching' && bird.body.position.y > this.island.layout.water - 95 && Math.abs(bird.body.position.x - point.x) < 115;
    const sharkNear = distance(shark.body.position, point) < 105;
    if (fastBlob || birdNear || sharkNear) {
      const threat = birdNear ? bird.body.position : sharkNear ? shark.body.position : blob.center.position;
      const direction = point.x < threat.x ? -1 : 1;
      this.change(resident, 'startled', { x: clamp(point.x + direction * 150, this.water.minX, this.water.maxX), y: clamp(point.y + 36, this.water.minY, this.water.maxY) }, 1150, 'alert');
      if (birdNear && time - resident.threatAt > 5000) { this.meet('fish-startled-by-bird', resident, bird); resident.threatAt = time; }
      if (sharkNear && time - (resident.sharkAt || -10000) > 5000) { this.meet('fish-yield-to-shark', resident, shark); resident.sharkAt = time; }
      return;
    }
    if (resident.until > time && resident.state === 'startled') return;
    if (this.respondToBlob(resident)) return;
    const partner = this.residents.filter(other => other.species === 'fish' && other !== resident)
      .sort((first, second) => distance(first.body.position, point) - distance(second.body.position, point))[0];
    if (distance(point, partner.body.position) < 220 && this.random() > 0.28) {
      const offset = point.x < partner.body.position.x ? -64 : 64;
      this.change(resident, 'schooling', { x: clamp(partner.body.position.x + offset, this.water.minX, this.water.maxX), y: clamp(partner.body.position.y + Math.sin(time / 1700 + resident.phase) * 26, this.water.minY, this.water.maxY) }, 1000);
      if (time - resident.socialAt > 6000) { this.meet('schooling', resident, partner); resident.socialAt = time; }
      return;
    }
    if (distance(point, resident.target) > 24 && resident.until > time) return;
    this.change(resident, 'wandering', { x: this.water.minX + this.random() * (this.water.maxX - this.water.minX), y: this.water.minY + this.random() * (this.water.maxY - this.water.minY) }, 2800);
  }

  decideGround(resident) {
    const { time, landmarks, blob } = this.island;
    const point = resident.body.position;
    if (distance(point, blob.center.position) < 115 && Vector.magnitude(blob.center.velocity) > 4) {
      this.change(resident, 'startled', { x: clamp(point.x + (point.x < blob.center.position.x ? -100 : 100), this.strand.minX, this.strand.maxX), y: point.y }, 1400, 'alert');
      return;
    }
    if (resident.until > time && resident.state === 'startled') return;
    if (resident.species === 'tortoise') {
      const food = this.picnicFood();
      if (food) {
        const standOff = food.radius + resident.width * 0.41 + 7;
        const choices = [0, 12, 24, 36].flatMap(extra => [-1, 1].map(side => ({ x: food.body.position.x + side * (standOff + extra), y: landmarks.picnic.y - resident.height * 0.41 })));
        choices.sort((first, second) => Math.abs(first.x - point.x) - Math.abs(second.x - point.x));
        const blocked = target => {
          const bounds = { min: { x: target.x - resident.width * 0.41, y: target.y - resident.height * 0.41 }, max: { x: target.x + resident.width * 0.41, y: target.y + resident.height * 0.41 } };
          return this.island.props.some(prop => prop !== food && (prop.depth || 0) < 25 && Bounds.overlaps(bounds, prop.body.bounds));
        };
        const target = choices.find(choice => !blocked(choice)) || choices[0];
        resident.clearanceFood = blocked(target) ? food.body.id : null;
        const close = Math.abs(point.x - target.x) < 15 && Math.abs(point.y - target.y) < 22 && !blocked(target);
        if (close) resident.detourUntil = 0;
        this.change(resident, close ? 'snacking' : 'foraging', target, 1800, close ? 'heart' : 'coconut');
        if (close) resident.direction = Math.sign(food.body.position.x - point.x) || resident.direction;
        return;
      }
    } else if (resident.species === 'crab') {
      const shells = this.island.props.filter(prop => prop.kind === 'shell' && prop.playerHandled && !this.held(prop.body) && prop.body.position.x < this.strand.maxX && Math.abs(prop.body.position.y - this.strand.maxY) < 50);
      const shell = shells.sort((first, second) => distance(first.body.position, point) - distance(second.body.position, point))[0];
      if (shell && distance(point, shell.body.position) < 260) {
        const standOff = shell.radius + resident.width * 0.41 + 5;
        const side = point.x < shell.body.position.x ? -1 : 1;
        const close = distance(point, shell.body.position) < standOff + 12;
        this.change(resident, close ? 'inspecting' : 'foraging', { x: shell.body.position.x + side * standOff, y: point.y }, 1200, 'shell');
        resident.depthTarget = shell.depth || 0;
        if (close && time - resident.socialAt > 7000) {
          Body.applyForce(shell.body, shell.body.position, { x: 0.000035 * shell.body.mass, y: 0 });
          resident.socialAt = time;
        }
        return;
      }
    }
    if (resident.until > time && (resident.state === 'greeting' || resident.state === 'wandering' && Math.abs(resident.target.x - point.x) > 25)) return;
    const neighbor = this.residents.find(other => LAND_RESIDENTS.has(other.species) && other !== resident && !this.held(other.body)
      && !this.interactions.owns(other) && !['foraging', 'snacking', 'startled', 'returning', 'fleeing', 'wandering'].includes(other.state)
      && distance(this.position(resident), this.position(other)) < 78 + this.individuals.affinity(resident, other) * 12 && time - other.socialAt > 6500);
    if (neighbor && time - resident.socialAt > 6500) {
      this.change(resident, 'greeting', point, 1500, 'heart');
      this.change(neighbor, 'greeting', neighbor.body.position, 1500, 'heart');
      resident.socialAt = time; neighbor.socialAt = time; this.meet('shore-greeting', resident, neighbor);
      return;
    }
    if (this.respondToBlob(resident) || this.playWithProp(resident)) return;
    if (resident.until > time) return;
    const ground = this.groundHabitat(resident);
    if (resident.state === 'wandering' || this.random() < 0.25) {
      const rest = resident.species === 'lizard' ? 'basking' : resident.species === 'rabbit' ? 'grazing' : 'resting';
      this.change(resident, rest, point, (1600 + this.random() * 2500) * this.profile.rest * this.individuals.restFactor(resident), 'rest');
      resident.depthTarget = resident.depth;
    } else {
      const purposeful = this.random() < 0.40 + resident.needs.curiosity * 0.12;
      const places = [this.island.tree.body.position.x, landmarks.picnic.x, landmarks.nook.x, ground.minX + 55, ground.maxX - 40];
      const positionX = purposeful ? clamp(places[Math.floor(this.random() * places.length)] + (this.random() - 0.5) * 100, ground.minX, ground.maxX)
        : ground.minX + this.random() * (ground.maxX - ground.minX);
      this.change(resident, 'wandering', { x: positionX, y: ground.maxY - resident.height / 2 }, Math.max(3600, Math.abs(positionX - point.x) / resident.speed * 24 + 1800));
      resident.depthTarget = Math.max(22, this.random() * this.profile.depth);
    }
  }

  decideBird(resident) {
    const { time, landmarks } = this.island;
    const tortoise = this.residents.find(other => other.species === 'tortoise');
    if (this.picnicFood()) {
      const target = { x: landmarks.picnic.x + 42, y: landmarks.picnic.y - 28 };
      const close = distance(resident.body.position, target) < 40;
      this.change(resident, close ? 'visiting' : 'visiting-flight', target, 2000, close ? 'heart' : 'coconut');
      if (close && tortoise.state === 'snacking' && time - resident.socialAt > 5000) {
        this.meet('picnic-visit', resident, tortoise); resident.socialAt = time; resident.visits += 1;
      }
      return;
    }
    if (resident.until > time && ['watching', 'perching'].includes(resident.state)) return;
    if (this.respondToBlob(resident)) return;
    if (resident.until > time) return;
    if (resident.state === 'watching') {
      const target = { ...this.perch };
      this.change(resident, 'perching', target, Math.max(2600, distance(resident.body.position, target) / resident.speed * 20 + 1700), 'rest');
    } else {
      const fish = this.residents[this.random() > 0.5 ? 0 : 1];
      resident.watchedFish = fish.id;
      const target = { x: fish.body.position.x + 24, y: this.island.layout.water - this.island.map.birdWatchHeight };
      this.change(resident, 'watching', target, Math.max(5000, distance(resident.body.position, target) / resident.speed * 24 + 5000) * this.profile.glide, 'fish');
    }
  }

  decideMarine(resident) {
    const { time, layout } = this.island;
    if (resident.state === 'startled' && resident.until > time) return;
    if (resident.species === 'octopus' && this.playWithProp(resident)) return;
    if (this.respondToBlob(resident)) return;
    if (resident.until > time && distance(resident.body.position, resident.target) > 18) return;
    if (resident.species === 'jellyfish') {
      const target = { x: this.water.minX + 35 + this.random() * (this.water.maxX - this.water.minX - 70), y: this.water.minY + 25 + this.random() * (this.water.maxY - this.water.minY - 70) };
      this.change(resident, resident.state === 'pulsing' ? 'drifting' : 'pulsing', target, Math.max(3500, distance(resident.body.position, target) / resident.speed * 24));
    } else if (resident.species === 'shark') {
      const target = { x: resident.body.position.x > (this.water.minX + this.water.maxX) / 2 ? this.water.minX + 100 : this.water.maxX - 100, y: this.water.minY + 40 + this.random() * (this.water.maxY - this.water.minY - 120) };
      this.change(resident, resident.state === 'cruising' ? 'turning' : 'cruising', target, Math.max(4000, distance(resident.body.position, target) / resident.speed * 23));
    } else if (resident.species === 'starfish') {
      const grazing = resident.state === 'creeping';
      const positionX = grazing ? resident.body.position.x : this.water.minX + 30 + this.random() * (this.water.maxX - this.water.minX - 60);
      this.change(resident, grazing ? 'grazing' : 'creeping', { x: positionX, y: this.island.floorAt(positionX) - resident.height * 0.5 - 3 }, grazing ? 3000 : Math.max(4500, Math.abs(positionX - resident.body.position.x) / resident.speed * 23));
    } else {
      const resting = resident.state === 'exploring';
      const positionX = this.water.minX + 40 + this.random() * (this.water.maxX - this.water.minX - 80);
      const target = resting ? resident.home : { x: positionX, y: this.island.floorAt(positionX) - resident.height * 0.5 };
      this.change(resident, resting ? 'hiding' : 'exploring', target, Math.max(2600, distance(resident.body.position, target) / resident.speed * 23), resting ? 'rest' : 'shell');
    }
  }

  flock(resident) {
    const neighbors = this.residents.filter(other => other.species === 'fish' && other !== resident && !other.held
      && distance(other.body.position, resident.body.position) < 200);
    if (!neighbors.length || !['schooling', 'wandering'].includes(resident.state)) return { x: 0, y: 0 };
    const center = neighbors.reduce((total, other) => ({ x: total.x + other.body.position.x / neighbors.length, y: total.y + other.body.position.y / neighbors.length }), { x: 0, y: 0 });
    const velocity = neighbors.reduce((total, other) => ({ x: total.x + other.body.velocity.x / neighbors.length, y: total.y + other.body.velocity.y / neighbors.length }), { x: 0, y: 0 });
    return { x: clamp((center.x - resident.body.position.x) * 0.0007 + (velocity.x - resident.body.velocity.x) * 0.045, -0.16, 0.16),
      y: clamp((center.y - resident.body.position.y) * 0.0007 + (velocity.y - resident.body.velocity.y) * 0.045, -0.12, 0.12) };
  }

  step() {
    const { time } = this.island;
    this.individuals.tick();
    this.interactions.tick();
    this.comedy.tick();
    this.foraging.tick();
    for (const resident of this.residents) {
      const body = resident.body;
      this.updateMedium(resident);
      resident.held = this.held(body);
      if (resident.species === 'frog' && (resident.held || resident.grounded || resident.recovery || resident.state === 'feeding')) resident.flipAt = null;
      if (resident.species === 'bird') {
        const touchingSkin = this.island.engine.pairs.list.filter(pair => pair.isActive &&
          (pair.bodyA.parent === body && pair.bodyB.parent.label === 'jelly' || pair.bodyB.parent === body && pair.bodyA.parent.label === 'jelly')).length;
        if (!resident.held && touchingSkin >= 3) resident.slipping = true;
        if (resident.slipping && !this.island.blob.particles.some(particle => Bounds.overlaps(body.bounds, particle.bounds))) resident.slipping = false;
        body.collisionFilter.group = resident.slipping ? this.island.blob.center.collisionFilter.group : this.group;
      } else if (SWIMMERS.has(resident.species)) {
        let passage = this.island.props.find(prop => prop.body.id === resident.ringPassage);
        if (passage && distance(body.position, passage.body.position) > passage.radius + Math.max(resident.width, resident.height) / 2 + 8) passage = null;
        if (!passage && !resident.held && resident.immersion > 0.04) passage = this.island.props.find(prop => prop.kind === 'ring'
          && resident.width < prop.radius * 1.5 && distance(body.position, prop.body.position) < prop.radius * 0.5);
        resident.ringPassage = passage?.body.id;
        body.collisionFilter.group = passage ? passage.body.collisionFilter.group : this.group;
      }
      resident.motionPhase += resident.held ? 0.035 : 0.045 + Math.min(0.20, Vector.magnitude(body.velocity) * 0.06 + Math.abs(resident.depthVelocity) * 0.08);
      this.interactions.mood(resident);
      const onStrand = LAND_RESIDENTS.has(resident.species);
      if (onStrand && !resident.held) {
        if (resident.medium === 'water' || resident.medium === 'wading' || !this.inHabitat(resident)) resident.depthTarget = 0;
        const lowContact = resident.immersion < 0.1 && body.bounds.max.y > this.island.floorAt(body.position.x) - 65;
        const depthTarget = resident.detourUntil > time && lowContact ? Math.min(55, this.profile.depth) : resident.depthTarget;
        const desiredDepthVelocity = clamp((depthTarget - resident.depth) * 0.065, -resident.speed * 0.85, resident.speed * 0.85);
        resident.depthVelocity += (desiredDepthVelocity - resident.depthVelocity) * 0.18;
        resident.depth = clamp(resident.depth + resident.depthVelocity, 0, this.profile.depth);
      }
      setBodyDepth(body, onStrand ? resident.depth : 0);
      if (resident.held || this.inHabitat(resident)) {
        if (!resident.held && resident.recovery) this.meet('habitat-return', resident, { id: 'habitat' });
        resident.outsideSince = null; resident.rescue = false; resident.recovery = '';
        resident.waterExit = null;
        resident.exitDock = false; resident.dockClimbed = false; resident.recoverySample = null; resident.recoveryStalled = false;
      } else {
        if (resident.outsideSince === null) resident.outsideSince = time;
        const poses = { fish: 'flopping', jellyfish: 'washed-back', shark: 'wriggling', octopus: 'crawling-back', starfish: 'curling', tortoise: 'paddling', crab: 'paddling', bird: 'taking-off', lizard: 'paddling', rabbit: 'doggy-paddle', monkey: 'paddling', frog: 'paddling' };
        resident.recovery = poses[resident.species];
        if (!resident.recoverySample || time - resident.recoverySample.time > 1400) {
          resident.recoveryStalled = resident.recoverySample ? distance(body.position, resident.recoverySample.point) < 12 : false;
          resident.recoverySample = { time, point: { ...body.position } };
        }
        resident.rescue = resident.species !== 'bird' && time - resident.outsideSince > 6000 && resident.recoveryStalled && !resident.exitDock;
      }
      if (resident.held) {
        this.change(resident, 'held', body.position, 0, resident.frown ? 'home' : 'heart');
        if (resident.species === 'bird') {
          resident.flight = 'held'; resident.wingLift += (-0.3 - resident.wingLift) * 0.12;
          resident.flightBlend += (0.15 - resident.flightBlend) * 0.1; resident.landingBlend += (0.35 - resident.landingBlend) * 0.12;
        }
        resident.decideAt = 0;
        continue;
      }
      if (!this.foraging.eligible(resident)) this.foraging.cancel(resident);
      if (time >= resident.decideAt || resident.foodId || this.foraging.nearbyOffer(resident)) {
        resident.decideAt = time + 260 + this.random() * 180;
        if (!this.inHabitat(resident)) this.recover(resident);
        else if (this.interactions.owns(resident)) {}
        else if (this.foraging.act(resident)) {}
        else if (resident.species === 'fish') this.decideFish(resident);
        else if (resident.species === 'bird') this.decideBird(resident);
        else if (SWIMMERS.has(resident.species)) this.decideMarine(resident);
        else this.decideGround(resident);
      }
      const aquatic = SWIMMERS.has(resident.species);
      const bird = resident.species === 'bird';
      if (resident.state === 'foraging' && resident.clearanceFood && Math.abs(body.position.x - resident.target.x) < 90) {
        const food = this.island.props.find(prop => prop.body.id === resident.clearanceFood);
        if (food && !this.held(food.body)) for (const prop of this.island.props) {
          if (prop === food || prop.anchor || prop.ropes || this.held(prop.body) || (prop.depth || 0) > 24) continue;
          if (Math.abs(prop.body.position.x - resident.target.x) > resident.width * 0.5 + (prop.radius || prop.width / 2) || Math.abs(prop.body.position.y - resident.target.y) > 38) continue;
          const outward = Math.sign(prop.body.position.x - food.body.position.x) || 1;
          Body.applyForce(prop.body, prop.body.position, { x: outward * prop.body.mass * 0.0008, y: -prop.body.mass * 0.00015 });
        }
      }
      const swimming = aquatic && resident.immersion > 0.05;
      const paddling = !aquatic && !bird && resident.immersion > 0.08;
      const climbing = resident.exitDock && !aquatic && !bird && (resident.dockClimbed || Math.abs(resident.target.x - body.position.x) < 30)
        && body.position.y < this.island.layout.water + resident.height;
      if (climbing) resident.recovery = 'climbing-out';
      if (bird || swimming || paddling || climbing || resident.rescue) {
        const support = bird || climbing || resident.rescue ? 1 : swimming ? resident.immersion : resident.immersion * 1.18;
        Body.applyForce(body, body.position, { x: 0, y: -body.mass * this.island.engine.gravity.scale * support });
      }
      let target = { ...resident.target };
      if (resident.rescue && Math.abs(target.x - body.position.x) > 55) target.y = Math.min(this.island.layout.ground, this.island.layout.farGround) - 120;
      if (resident.state === 'play-chase') {
        const friend = this.residents.find(other => other.id === resident.playmate);
        if (friend && !this.held(friend.body)) {
          target.x = friend.body.position.x + (body.position.x < friend.body.position.x ? -48 : 48);
          if (bird) target.y = this.island.layout.water - 45;
          else resident.depthTarget = friend.depth;
        }
      }
      const jelly = this.island.blobPosition();
      if (['curious', 'following', 'playing', 'companion', 'circling'].includes(resident.state)) {
        const side = resident.body.position.x < jelly.x ? -1 : 1;
        if (resident.species === 'bird') target = { x: clamp(jelly.x + Math.cos((time - resident.interactionAt) / 1100) * 110, 80, this.island.width - 80), y: Math.max(220, jelly.y - 100 + Math.sin((time - resident.interactionAt) / 1100) * 35) };
        else {
          const aquatic = SWIMMERS.has(resident.species);
          const bounds = aquatic ? this.water : this.groundHabitat(resident);
          target = { x: clamp(jelly.x + side * (resident.width / 2 + (resident.state === 'playing' ? 28 : this.individuals.approachDistance(resident))), bounds.minX, bounds.maxX), y: aquatic ? clamp(jelly.y + 15, bounds.minY, bounds.maxY) : body.position.y };
          if (resident.state === 'playing' && distance(body.position, jelly) < resident.width / 2 + 60 && ![...this.island.drags.values()].some(drag => drag.kind === 'blob')) {
            for (const particle of this.island.blob.particles) Body.applyForce(particle, particle.position, { x: -side * particle.mass * 0.000025, y: -particle.mass * 0.000008 });
          }
        }
      }
      if (resident.state === 'toy-play') {
        const toy = this.island.props.find(prop => prop.body.id === resident.toyId);
        if (toy && !this.held(toy.body)) {
          const side = body.position.x < toy.body.position.x ? -1 : 1;
          target = { x: toy.body.position.x + side * 30, y: SWIMMERS.has(resident.species) ? toy.body.position.y - 12 : body.position.y };
          resident.reach = { ...toy.body.position };
          if (distance(body.position, toy.body.position) < 75) Body.applyForce(toy.body, toy.body.position, { x: -side * toy.body.mass * 0.000035, y: resident.species === 'octopus' ? -toy.body.mass * 0.000035 : 0 });
        }
      } else resident.reach = resident.state === 'feeding' ? resident.feedingPoint : null;
      if (resident.species === 'bird' && resident.state === 'watching') {
        const fish = this.residents.find(other => other.id === resident.watchedFish);
        if (fish) target = { x: fish.body.position.x + 24, y: this.island.layout.water - this.island.map.birdWatchHeight };
      }
      if (resident.state === 'perching' && distance(body.position, target) < 80) {
        target = { ...this.perch };
      }
      if (aquatic && resident.immersion > 0.1) {
        const ahead = body.position.x + Math.sign(target.x - body.position.x) * Math.max(28, resident.width * 1.3);
        target.y = Math.min(target.y, this.island.floorAt(target.x) - resident.height * 0.5 - 3, this.island.floorAt(ahead) - resident.height * 0.5 - 3);
      }
      const finalDistance = distance(body.position, target);
      if (bird) target = this.flightNavigation.target(resident, target);
      const moving = !['resting', 'basking', 'grazing', 'greeting', 'snacking', 'inspecting', 'feeding'].includes(resident.state);
      resident.pulse = (Math.sin(time / 510 + resident.phase) + 1) / 2;
      const returning = resident.state === 'returning';
      const recoverySpeed = resident.species === 'bird' ? 5.2 : resident.species === 'tortoise' ? 2.8 : ['jellyfish', 'starfish'].includes(resident.species) ? 2.2 : 3.8;
      const speed = resident.rescue ? 4.2 : returning ? recoverySpeed : resident.speed * this.individuals.speedFactor(resident) * (['play-chase', 'play-retreat'].includes(resident.state) ? 1.4 : resident.state === 'lunging' ? 2.2 : resident.state === 'fleeing' ? 2.3 : resident.state === 'stalking' ? 1.35 : resident.state === 'startled' ? 1.9 : resident.species === 'jellyfish' ? 0.45 + resident.pulse * 1.15 : 1);
      const offset = Vector.sub(target, body.position);
      const desired = moving ? Vector.mult(Vector.normalise(offset), Math.min(speed, Vector.magnitude(offset) / 38)) : { x: 0, y: 0 };
      if (onStrand && moving && body.bounds.max.y > this.island.floorAt(body.position.x) - 65 && resident.immersion < 0.1
        && resident.depth < 18 && Math.abs(offset.x) > 25 && resident.detourUntil <= time) {
        const frontX = body.position.x + Math.sign(offset.x) * resident.width * 0.43;
        const approach = { min: { x: frontX - 9, y: body.position.y - resident.height * 0.34 }, max: { x: frontX + 9, y: body.position.y + resident.height * 0.34 } };
        const toyBlocks = this.island.props.some(prop => prop.kind !== 'food' && Math.abs((prop.depth || 0) - resident.depth) < 25 && Bounds.overlaps(approach, prop.body.bounds));
        const blobbyBlocks = Math.abs(this.island.blob.depth - resident.depth) < 25 && this.island.blob.particles.some(particle => Bounds.overlaps(approach, particle.bounds));
        if (toyBlocks || blobbyBlocks) resident.detourUntil = time + 3200;
      }
      if (aquatic && resident.immersion > 0.1) desired.x += this.island.environment.currentAt(body.position.x, body.position.y);
      if (bird && !returning && resident.state === 'watching' && !resident.flightClearing) desired.x += this.island.environment.wind * 0.12;
      if (resident.species === 'fish') {
        for (const other of this.residents.filter(item => item.species === 'fish' && item !== resident)) {
          const away = Vector.sub(body.position, other.body.position);
          if (Vector.magnitude(away) < 44) { desired.x += away.x * 0.035; desired.y += away.y * 0.035; }
        }
        const flock = this.flock(resident); desired.x += flock.x; desired.y += flock.y;
      }
      if (aquatic && swimming && !resident.rescue && !returning) {
        desired.x = clamp(desired.x, (this.water.minX + 10 - body.position.x) * 0.07, (this.water.maxX - 10 - body.position.x) * 0.07);
        desired.y = clamp(desired.y, (this.water.minY + 8 - body.position.y) * 0.07, (this.water.maxY - 8 - body.position.y) * 0.07);
      }
      const airborne = bird || swimming || paddling || climbing || resident.rescue;
      const smoothFlight = resident.species === 'bird' || resident.species === 'shark';
      const flightContact = bird && this.island.engine.pairs.list.some(pair => pair.isActive && (pair.bodyA.parent === body || pair.bodyB.parent === body));
      if (flightContact && resident.flightClearing) Body.applyForce(body, body.position, { x: desired.x * body.mass * 0.0015, y: Math.min(0, desired.y) * body.mass * 0.001 });
      const acceleration = bird ? flightContact ? 0.32 : 0.085 : resident.species === 'shark' ? 0.045 : Infinity;
      const steering = bird || resident.rescue ? 0.10 : aquatic ? resident.immersion * 0.10 + (resident.grounded ? 0.08 : 0.008) : resident.grounded ? 0.65 : paddling ? 0.12 : 0.025;
      const nextVelocity = {
        x: body.velocity.x + clamp((desired.x - body.velocity.x) * steering, -acceleration, acceleration),
        y: bird || climbing || resident.rescue ? clamp(body.velocity.y + clamp((desired.y - body.velocity.y) * 0.10, -acceleration, acceleration), -speed * 1.4, speed * 1.4)
          : swimming ? body.velocity.y + (desired.y - body.velocity.y) * (resident.immersion * 0.10)
          : paddling ? body.velocity.y + ((returning ? Math.min(-1.1, desired.y) : -0.65) - body.velocity.y) * (returning ? 0.12 : 0.035) : body.velocity.y,
      };
      if (aquatic && resident.immersion < 0.1 && resident.grounded && returning && time - resident.hopAt > 580) {
        nextVelocity.x = Math.sign(target.x - body.position.x) * recoverySpeed;
        nextVelocity.y = ['fish', 'shark'].includes(resident.species) ? -3.0 : -0.65;
        resident.hopAt = time;
      }
      Body.setVelocity(body, nextVelocity);
      if (['rabbit', 'frog'].includes(resident.species) && moving && resident.grounded && !resident.held
        && (resident.species !== 'frog' || !resident.recovery && !(resident.anticUntil > time))
        && time - resident.hopAt > (resident.species === 'frog' ? 1100 : 850) && Math.abs(offset.x) > 30) {
        resident.hopPrepareUntil ??= time + 150;
        if (time >= resident.hopPrepareUntil || resident.recovery) {
          Body.setVelocity(body, { x: body.velocity.x, y: resident.species === 'frog' ? -3.8 : -2.35 }); resident.hopAt = time; resident.hopPrepareUntil = null;
        }
      } else resident.hopPrepareUntil = null;
      if (resident.immersion > 0.1 && !resident.recovery) {
        this.island.wake(body, resident.immersion, this.island.environment.currentAt(body.position.x, body.position.y));
      }
      if (Math.abs(body.velocity.x) > (smoothFlight ? 0.30 : 0.05)) resident.direction = Math.sign(body.velocity.x);
      resident.facing += (resident.direction - resident.facing) * (smoothFlight ? 0.055 : 0.18);
      resident.bank += (clamp(-body.velocity.y * 0.11 + (desired.x - body.velocity.x) * 0.12, -0.42, 0.42) - resident.bank) * 0.07;
      if (resident.species === 'bird') {
        const landing = ['perching', 'visiting', 'visiting-flight'].includes(resident.state) && finalDistance < 90;
        resident.flight = finalDistance < 16 && Vector.magnitude(body.velocity) < 0.55 && ['perching', 'visiting'].includes(resident.state) ? 'perched'
          : landing ? 'landing' : body.velocity.y < -0.4 || Vector.magnitude(body.velocity) < 1.6 ? 'flapping' : 'gliding';
        resident.flapPhase += resident.flight === 'flapping' ? 0.25 : resident.flight === 'landing' ? 0.16 : 0.025;
        const wingTarget = resident.flight === 'gliding' ? 0.15 + Math.sin(time * 0.001) * 0.06 : resident.flight === 'perched' ? -0.7 : Math.sin(resident.flapPhase);
        resident.wingLift += (wingTarget - resident.wingLift) * 0.24;
        resident.flightBlend += ((resident.flight === 'perched' ? 0 : 1) - resident.flightBlend) * 0.1;
        resident.landingBlend += ((['landing', 'perched'].includes(resident.flight) ? 1 : 0) - resident.landingBlend) * 0.12;
      }
      if (!airborne && !aquatic && moving && time - resident.stuckAt > 1800) {
        if (Math.abs(body.position.x - resident.lastPosition.x) < 6 && Math.abs(offset.x) > 40 && Math.abs(body.velocity.y) < 0.8) {
          resident.detourUntil = time + 3200;
          resident.thought = 'home'; resident.thoughtUntil = time + 1200;
        }
        resident.lastPosition = { ...body.position }; resident.stuckAt = time;
      }
    }
  }

  afterStep() {
    for (const resident of this.residents) {
      if (resident.body.isSensor && !resident.held && resident.immersion < 0.08 && this.inHabitat(resident)) {
        const floor = this.island.floorAt(resident.body.position.x);
        if (resident.body.bounds.max.y > floor) {
          Body.translate(resident.body, { x: 0, y: floor - resident.body.bounds.max.y });
          Body.setVelocity(resident.body, { x: resident.body.velocity.x, y: Math.min(0, resident.body.velocity.y) });
        }
      }
      const point = resident.body.position;
      if (point.x < 18 || point.x > this.island.width - 18 || point.y < 100 || point.y > this.island.height - 30) {
        Body.setPosition(resident.body, { x: clamp(point.x, 18, this.island.width - 18), y: clamp(point.y, 100, this.island.height - 30) });
      }
    }
  }

  pick(point, padding) {
    return [...this.residents].reverse().sort((first, second) => second.depth - first.depth).find(resident => {
      const position = this.position(resident);
      const scale = 1 + resident.depth * 0.0018;
      return Math.abs(point.x - position.x) <= resident.width * scale / 2 + padding && Math.abs(point.y - position.y) <= resident.height * scale / 2 + padding;
    });
  }

  snapshot() {
    return this.residents.map(resident => ({ id: resident.id, name: resident.name, species: resident.species, appearance: resident.appearance, ...this.position(resident), physicalY: resident.body.position.y, depth: resident.depth,
      width: resident.width, height: resident.height, state: resident.state, direction: resident.direction, held: resident.held, transitions: resident.transitions, visits: resident.visits,
      thought: this.island.time < resident.thoughtUntil ? resident.thought : '', target: { ...resident.target }, reactions: resident.reactions,
      food: resident.diet.food, foodRoutine: resident.diet.routine, meals: resident.meals, foodTarget: resident.foodId, foodPortion: resident.foodPortionId,
      feedingSince: resident.feedingSince, feedingPoint: resident.feedingPoint ? { ...resident.feedingPoint } : null, feedingPose: feedingPose(resident, this.island.time),
      ...(resident.species === 'frog' ? { jumpPose: frogJumpPose(resident, this.island.time) } : {}),
      lastMeal: resident.lastMeal ? { ...resident.lastMeal } : null, mealHeartUntil: resident.mealHeartUntil, satisfiedUntil: resident.satisfiedUntil,
      traits: { ...resident.traits }, needs: { ...resident.needs }, avoidSpot: resident.avoidSpot ? { ...resident.avoidSpot } : null,
      gaze: resident.lookAt ? { ...resident.lookAt } : null, fidget: resident.fidgetUntil > this.island.time ? resident.fidget : null,
      velocity: { ...resident.body.velocity }, bank: resident.bank, flight: resident.flight, pulse: resident.pulse,
      medium: resident.medium, immersion: resident.immersion, wetness: resident.wetness, grounded: resident.grounded, recovery: resident.recovery, rescue: resident.rescue,
      agenda: resident.agenda, frown: resident.frown, attention: resident.attentionUntil > this.island.time ? resident.attention : null, snapping: resident.snapUntil > this.island.time,
      antic: resident.anticUntil > this.island.time ? resident.antic : null, ewww: resident.ewwUntil > this.island.time }));
  }
}

module.exports = { Wildlife };