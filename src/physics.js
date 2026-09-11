const Matter = require('matter-js');
const { PalmTree } = require('./palm.js');
const { MAPS } = require('./maps.js');
const { buildCoast, floorAt } = require('./coast.js');
const { Wildlife } = require('./wildlife.js');
const { CoastObjectives } = require('./objectives.js');
const { blobbyOutline } = require('./blobby-shape.js');
const { setBodyDepth, advanceDepth } = require('./depth-space.js');
const { propSound } = require('./sound-context.js');
const { IslandEnvironment } = require('./environment.js');
const { TreasureChest } = require('./treasure.js');

const { Engine, Bodies, Body, Composite, Constraint, Vector, Vertices, Events } = Matter;
const STEP = 1000 / 60;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

class IslandPhysics {
  constructor(width = 1440, height = 900, mapId = 'lagoon', expedition = false) {
    this.width = width;
    this.height = height;
    this.expedition = expedition;
    this.map = MAPS.find(map => map.id === mapId) || MAPS[0];
    this.time = 0;
    this.drags = new Map();
    this.splashes = [];
    this.sounds = [];
    this.soundTimes = new Map();
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 6 });
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.001;
    this.layout = {
      ground: height * (this.map.ground - (expedition ? 0.18 : 0)),
      water: height * (this.map.water - (expedition ? 0.18 : 0)),
      bottom: height * (expedition ? 0.96 : this.map.bottom),
      shore: width * (expedition ? this.map.coast.shore : this.map.shore),
      toe: width * (expedition ? this.map.coast.toe : this.map.toe),
    };
    const { ground, water, bottom, shore, toe } = this.layout;
    this.layout.waterStart = shore + (toe - shore) * (water - ground) / (bottom - ground);
    const terrainOptions = { isStatic: true, friction: 0.72, restitution: 0.08, label: 'sand' };
    const rampVertices = [{ x: shore - 1, y: ground }, { x: toe, y: bottom }, { x: shore - 1, y: bottom }];
    const rampCenter = Vertices.centre(rampVertices);
    this.terrain = [
      Bodies.rectangle((shore - 200) / 2, (ground + height + 200) / 2, shore + 200, height + 200 - ground, terrainOptions),
      Bodies.fromVertices(rampCenter.x, rampCenter.y, [rampVertices], terrainOptions),
      Bodies.rectangle(width / 2, bottom + 180, width + 400, 360, terrainOptions),
      Bodies.rectangle(-35, height / 2, 70, height + 500, { ...terrainOptions, label: 'boundary' }),
      Bodies.rectangle(width + 35, height / 2, 70, height + 500, { ...terrainOptions, label: 'boundary' }),
      Bodies.rectangle(width / 2, -90, width + 200, 100, { ...terrainOptions, label: 'boundary' }),
    ];
    Composite.add(this.engine.world, this.terrain);
    this.spawn = { x: expedition ? Math.min(520, width * 0.30) : width * 0.30, y: ground - 92 };
    this.makeBlob(this.spawn.x, this.spawn.y);
    this.props = [];
    const objectScale = clamp(width / 1000, 0.73, 1);
    for (const toy of this.map.toys) {
      const margin = (toy.radius || toy.width / 2) * objectScale + 5;
      const positionX = expedition && !toy.onLand ? this.layout.waterStart + 85 + clamp((toy.x - 0.45) / 0.55, 0, 1) * (width * 0.82 - this.layout.waterStart - 170)
        : expedition && toy.onLand && toy.kind === 'crate' ? width * 0.145 : width * toy.x;
      this.addProp(toy.kind, clamp(positionX, margin, width - margin), (toy.onLand ? ground : water) - toy.elevation,
        { ...toy, radius: toy.radius ? toy.radius * objectScale : undefined, width: toy.width ? toy.width * objectScale : undefined, height: toy.height ? toy.height * objectScale : undefined });
    }
    this.rocks = this.map.rocks.map(rock => Bodies.trapezoid(width * rock.x, water - rock.elevation, rock.width * objectScale, rock.height, 0.35, { ...terrainOptions, label: 'rock' }));
    Composite.add(this.engine.world, this.rocks);
    const waveCount = clamp(Math.round((width - this.layout.waterStart) / 12), 28, 96);
    this.waves = Array.from({ length: waveCount }, () => ({ offset: 0, velocity: 0 }));
    this.tree = new PalmTree(this);
    if (expedition) {
      setBodyDepth(this.tree.body, 0);
      for (const fruit of this.tree.fruits) setBodyDepth(fruit.body, 0);
      buildCoast(this); this.wildlife = new Wildlife(this); this.objectives = new CoastObjectives(this);
    }
    this.treasure = new TreasureChest(this);
    this.environment = new IslandEnvironment(this);
    this.initialPropCount = this.props.length;
    Events.on(this.engine, 'collisionStart', event => {
      for (const pair of event.pairs) {
        const first = pair.bodyA.parent;
        const second = pair.bodyB.parent;
        if (first.label.startsWith('creature:') || second.label.startsWith('creature:')) continue;
        if (first.isSensor || second.isSensor) continue;
        if (first.label === 'palm' || second.label === 'palm') continue;
        if (this.tree.fruits.some(fruit => fruit.attached && (fruit.body === first || fruit.body === second))) continue;
        const relative = Vector.sub(first.velocity, second.velocity);
        const speed = Math.abs(Vector.dot(relative, pair.collision.normal));
        if (speed < 3 || Math.max(first.plugin.lastImmersion || 0, second.plugin.lastImmersion || 0) > 0.5) continue;
        const bodies = [first, second];
        const source = bodies.find(body => ['jelly', 'ball'].includes(body.label))
          || bodies.find(body => body.label === 'bottle')
          || bodies.find(body => ['shell', 'conch', 'stone', 'pumice'].includes(body.label))
          || (first.isStatic ? second : first);
        const sound = propSound(source.label, source, 'impact', speed);
        if (source.label !== 'jelly') pair.restitution /= 1 + speed * 0.035;
        this.queueSound(sound.kind, Math.min(7, speed), source.position.x, sound);
        const depth = source.label === 'jelly' ? this.blob.depth : this.props.find(prop => prop.body === source)?.depth || 0;
        this.environment.impact(source.position.x, source.bounds.max.y + depth, speed);
      }
    });
  }

  makeBlob(positionX, positionY) {
    const radius = 34;
    const particleRadius = 6.2;
    const group = Body.nextGroup(true);
    const options = { friction: 0.62, frictionAir: 0.016, restitution: 0.46, slop: 0.04, collisionFilter: { group }, label: 'jelly' };
    const ring = blobbyOutline(positionX, positionY).map(point => {
      const particle = Bodies.circle(point.x, point.y, particleRadius, options);
      Body.setMass(particle, 0.05);
      return particle;
    });
    const center = Bodies.circle(positionX, positionY, 13, options);
    Body.setMass(center, 0.15);
    const links = [];
    for (let index = 0; index < ring.length; index += 1) {
      links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[(index + 1) % ring.length], stiffness: 0.055, damping: 0.075, relaxedStiffness: 0.25, stretchedStiffness: 0.055 }));
      links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[(index + 2) % ring.length], stiffness: 0.012, damping: 0.045, relaxedStiffness: 0.060, stretchedStiffness: 0.012 }));
      links.push(Constraint.create({ bodyA: center, bodyB: ring[index], stiffness: 0.004, damping: 0.035, relaxedStiffness: 0.042, stretchedStiffness: 0.004 }));
      if (index < ring.length / 2) {
        links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[index + ring.length / 2], stiffness: 0.0015, damping: 0.035, relaxedStiffness: 0.014, stretchedStiffness: 0.0015 }));
      }
    }
    this.blob = { ring, center, radius: radius * 1.18 + particleRadius, particleRadius, particles: [...ring, center], links, depth: 0, depthTarget: 0,
      softness: 0, restArea: Vertices.area(ring.map(particle => particle.position)) };
    if (this.expedition) for (const body of this.blob.particles) setBodyDepth(body, 0);
    Composite.add(this.engine.world, [...this.blob.particles, ...links]);
  }

  pressurizeBlob() {
    const { ring, restArea } = this.blob;
    const grips = [...this.drags.values()].filter(drag => drag.kind === 'blob');
    const softness = grips.length > 1 ? 1 : grips.length === 1 && Vector.magnitude(Vector.sub(grips[0].target, this.blobPosition())) > 65 ? 0.28 : 0;
    this.blob.softness += (softness - this.blob.softness) * 0.16;
    for (const link of this.blob.links) link.stiffness = link.relaxedStiffness + (link.stretchedStiffness - link.relaxedStiffness) * this.blob.softness;
    const area = Vertices.area(ring.map(particle => particle.position), true);
    const pressure = clamp((restArea - area) / restArea, -0.70, 1.2) * 0.0012;
    ring.forEach((particle, index) => {
      const previous = ring[(index + ring.length - 1) % ring.length].position;
      const next = ring[(index + 1) % ring.length].position;
      const normal = Vector.normalise({ x: next.y - previous.y, y: previous.x - next.x });
      Body.applyForce(particle, particle.position, Vector.mult(normal, pressure * particle.mass));
    });
  }

  addProp(kind, positionX, positionY, settings) {
    const options = { friction: 0.48, frictionAir: 0.007, restitution: kind === 'ball' ? 0.58 : 0.16, label: kind };
    let body = settings.radius
      ? Bodies.circle(positionX, positionY, settings.radius, options)
      : Bodies.rectangle(positionX, positionY, settings.width, settings.height, { ...options, chamfer: { radius: Math.min(4, settings.width / 4) } });
    if (kind === 'ring') {
      const parts = Array.from({ length: 16 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2;
        return Bodies.circle(positionX + Math.cos(angle) * settings.radius * 0.77, positionY + Math.sin(angle) * settings.radius * 0.77, settings.radius * 0.235);
      });
      body = Body.create({ ...options, parts, collisionFilter: { group: Body.nextGroup(true) } });
    }
    Body.setMass(body, settings.mass);
    if (kind === 'ring') Body.setInertia(body, settings.mass * settings.radius * settings.radius * 2);
    const prop = { kind, body, ...settings, submerged: 0, depth: 0, depthTarget: 0 };
    if (this.expedition) setBodyDepth(body, 0);
    this.props.push(prop);
    Composite.add(this.engine.world, body);
    if (settings.hinged) {
      prop.anchor = { x: positionX, y: positionY };
      Composite.add(this.engine.world, Constraint.create({ pointA: { ...prop.anchor }, bodyB: body, length: 0, stiffness: 0.9, damping: 0.08 }));
    }
    return prop;
  }

  blobPosition() {
    const center = this.blob.ring.reduce((total, body) => ({ x: total.x + body.position.x, y: total.y + body.position.y }), { x: 0, y: 0 });
    return { x: center.x / this.blob.ring.length, y: center.y / this.blob.ring.length };
  }

  floorAt(positionX) {
    return floorAt(this, positionX);
  }

  restoreFrom(previous) {
    this.time = previous.time;
    const oldCenter = previous.blobPosition();
    const left = oldCenter.x - Math.min(...previous.blob.particles.map(particle => particle.position.x)) + 8;
    const right = Math.max(...previous.blob.particles.map(particle => particle.position.x)) - oldCenter.x + 8;
    const fit = Math.min(1, (this.width - 16) / (left + right));
    const newCenterX = clamp(oldCenter.x / previous.width * this.width, left * fit, this.width - right * fit);
    previous.blob.particles.forEach((particle, index) => {
      const target = this.blob.particles[index];
      Body.setPosition(target, { x: newCenterX + (particle.position.x - oldCenter.x) * fit, y: particle.position.y });
      Body.setVelocity(target, particle.velocity);
      Body.setAngle(target, particle.angle);
    });
    this.blob.softness = previous.blob.softness;
    Body.setAngle(this.tree.body, previous.tree.body.angle);
    Body.setPosition(this.tree.body, Vector.sub(this.tree.base, Vector.rotate(this.tree.rootOffset, this.tree.body.angle)));
    Body.setAngularVelocity(this.tree.body, previous.tree.body.angularVelocity);
    for (const fruit of previous.tree.fruits) {
      if (!fruit.attached) continue;
      const local = Vector.mult(Vector.rotate(Vector.sub(fruit.body.position, previous.tree.point({ x: 0, y: 0 })), -previous.tree.body.angle), 1 / previous.tree.scale);
      const target = this.tree.fruits[fruit.palmSlot];
      Body.setPosition(target.body, this.tree.point(local));
      Body.setVelocity(target.body, fruit.body.velocity);
      Body.setAngle(target.body, fruit.body.angle);
    }
    previous.props.forEach((prop, index) => {
      const target = Number.isInteger(prop.palmSlot) ? this.tree.detach(prop.palmSlot) : this.props[index];
      const margin = target.radius || target.width / 2;
      Body.setPosition(target.body, { x: clamp(prop.body.position.x / previous.width * this.width, margin + 2, this.width - margin - 2), y: prop.body.position.y });
      Body.setVelocity(target.body, prop.body.velocity);
      Body.setAngle(target.body, prop.body.angle);
      Body.setAngularVelocity(target.body, prop.body.angularVelocity);
    });
    this.tree.lastDrop = previous.tree.lastDrop;
    this.tree.impacts = previous.tree.impacts;
  }

  surfaceAt(positionX) {
    if (!this.waves) return this.layout.water;
    const waveIndex = clamp((positionX - this.layout.waterStart) / ((this.layout.waterEnd || this.width) - this.layout.waterStart) * (this.waves.length - 1), 0, this.waves.length - 1);
    const lower = Math.floor(waveIndex);
    const upper = Math.min(lower + 1, this.waves.length - 1);
    return this.layout.water + this.waves[lower].offset * (1 - waveIndex + lower) + this.waves[upper].offset * (waveIndex - lower);
  }

  circleImmersion(position, radius) {
    if (position.x + radius < this.layout.waterStart || position.x - radius > (this.layout.waterEnd || this.width)) return 0;
    const heightRatio = clamp((this.surfaceAt(position.x) - position.y) / radius, -1, 1);
    const horizontalFraction = clamp((position.x + radius - this.layout.waterStart) / (radius * 2), 0, 1);
    return (Math.acos(heightRatio) - heightRatio * Math.sqrt(1 - heightRatio * heightRatio)) / Math.PI * horizontalFraction;
  }

  floatBody(body, density, radius, width, height) {
    let submerged = 0;
    const samples = radius ? 1 : 5;
    for (let index = 0; index < samples; index += 1) {
      const localPoint = radius ? { x: 0, y: 0 } : { x: (index / (samples - 1) - 0.5) * width * 0.82, y: 0 };
      const point = Vector.add(body.position, Vector.rotate(localPoint, body.angle));
      const fraction = radius
        ? this.circleImmersion(point, radius)
        : point.x < this.layout.waterStart ? 0 : clamp((point.y + height / 2 - this.surfaceAt(point.x)) / height, 0, 1);
      submerged += fraction / samples;
      if (fraction > 0) Body.applyForce(body, point, { x: 0, y: -body.mass * this.engine.gravity.scale / density * fraction / samples });
    }
    if (submerged > 0) {
      const held = [...this.drags.values()].some(drag => drag.body === body || body.label === 'jelly' && drag.kind === 'blob');
      const current = held ? 0 : this.environment?.currentAt(body.position.x, body.position.y) || 0;
      Body.applyForce(body, body.position, {
        x: (current - body.velocity.x) * body.mass * 0.00022 * submerged,
        y: -body.velocity.y * body.mass * 0.00026 * submerged,
      });
      Body.setAngularVelocity(body, body.angularVelocity * (1 - 0.04 * submerged));
      if (!held) this.wake(body, submerged, current);
    }
    const previous = body.plugin.lastImmersion || 0;
    if (body.bounds.max.y < this.surfaceAt(body.position.x) - 12) body.plugin.splashReady = true;
    if (body.plugin.splashReady === undefined) body.plugin.splashReady = true;
    if ((previous < 0.10 && submerged >= 0.10) || (previous > 0.45 && submerged < 0.45 && body.velocity.y < -1.4)) {
      const strength = Math.min(7, Math.abs(body.velocity.y) * body.mass * 2.4);
      if (body.plugin.splashReady && strength > 0.25 && Math.abs(body.velocity.y) > 1.8) {
        this.splash(body.position.x, strength);
        body.plugin.splashReady = false;
      }
    }
    body.plugin.lastImmersion = submerged;
    return submerged;
  }

  wake(body, immersion, current = 0) {
    const relativeSpeed = body.velocity.x - current;
    const end = this.layout.waterEnd || this.width;
    if (immersion < 0.05 || Math.abs(relativeSpeed) < 0.1 || body.position.x <= this.layout.waterStart || body.position.x >= end) return;
    const index = clamp(Math.round((body.position.x - this.layout.waterStart) / (end - this.layout.waterStart) * (this.waves.length - 1)), 1, this.waves.length - 2);
    const strength = clamp(relativeSpeed * immersion * Math.min(1, body.mass) * 0.006, -0.045, 0.045);
    this.waves[index - 1].velocity += strength;
    this.waves[index + 1].velocity -= strength;
  }

  splash(positionX, strength) {
    const waterEnd = this.layout.waterEnd || this.width;
    if (positionX < this.layout.waterStart || positionX > waterEnd) return;
    const index = Math.round((positionX - this.layout.waterStart) / (waterEnd - this.layout.waterStart) * (this.waves.length - 1));
    for (let offset = -2; offset <= 2; offset += 1) {
      const wave = this.waves[index + offset];
      if (wave) wave.velocity += strength * (1 - Math.abs(offset) / 3) * 0.40;
    }
    if (this.splashes.length < 24) this.splashes.push({ x: positionX, y: this.surfaceAt(positionX), strength, time: this.time });
    if (strength > 0.9) this.queueSound('splash', strength, positionX);
  }

  queueSound(kind, strength = 1, positionX = this.width / 2, context = {}) {
    const cooldown = kind === 'rustle' ? 550 : kind === 'splash' ? 220 : 180;
    if (this.time - (this.soundTimes.get(kind) ?? -Infinity) < cooldown) return;
    this.soundTimes.set(kind, this.time);
    if (this.sounds.length < 20) this.sounds.push({ ...context, kind, strength, x: positionX, pan: clamp(positionX / this.width * 2 - 1, -0.8, 0.8), time: this.time });
  }

  skipStone(prop) {
    if (prop.kind !== 'stone') return;
    const body = prop.body;
    const surface = this.surfaceAt(body.position.x);
    if (body.position.y + prop.radius < surface - 14) prop.skipReady = true;
    if (!prop.playerHandled || !prop.skipReady || body.position.x < this.layout.waterStart || body.position.x > (this.layout.waterEnd || this.width)) return;
    if (body.position.y + prop.radius < surface || body.position.y > surface + prop.radius) return;
    if (Math.abs(body.velocity.x) < 4.5 || body.velocity.y < 0.2 || body.velocity.y > Math.abs(body.velocity.x) * 0.8) return;
    prop.skipReady = false;
    prop.skips = (prop.skips || 0) + 1;
    Body.setVelocity(body, { x: body.velocity.x * 0.80, y: -Math.min(5.5, 1.5 + Math.abs(body.velocity.x) * 0.30) });
    this.splash(body.position.x, 2.5);
  }

  pick(point, padding = 0) {
    const foreground = this.wildlife?.pick(point, 0);
    const blobPoint = { x: point.x, y: point.y - this.blob.depth };
    const occupied = new Set([...this.drags.values()].filter(drag => drag.kind === 'blob').map(drag => drag.body));
    let nearestParticle;
    let nearestDistance = Infinity;
    let skinDistance = Infinity;
    let inside = false;
    for (let index = 0; index < this.blob.ring.length; index += 1) {
      const particle = this.blob.ring[index];
      const next = this.blob.ring[(index + 1) % this.blob.ring.length].position;
      const current = particle.position;
      if ((current.y > blobPoint.y) !== (next.y > blobPoint.y) && blobPoint.x < (next.x - current.x) * (blobPoint.y - current.y) / (next.y - current.y) + current.x) inside = !inside;
      const distance = Vector.magnitude(Vector.sub(blobPoint, particle.position));
      skinDistance = Math.min(skinDistance, distance);
      if (!occupied.has(particle) && distance < nearestDistance) {
        nearestDistance = distance;
        nearestParticle = particle;
      }
    }
    const pickProps = margin => {
      for (const prop of [...this.props].reverse().sort((first, second) => (second.depth || 0) - (first.depth || 0))) {
        const local = Vector.rotate(Vector.sub({ x: point.x, y: point.y - (prop.depth || 0) }, prop.body.position), -prop.body.angle);
        const hit = prop.radius ? Vector.magnitude(local) <= prop.radius + margin
          : Math.abs(local.x) <= prop.width / 2 + margin && Math.abs(local.y) <= prop.height / 2 + margin;
        if (hit) return { body: prop.body, kind: prop.kind, prop };
      }
      return null;
    };
    const exactBlob = nearestParticle && (inside || skinDistance <= this.blob.particleRadius) ? { body: nearestParticle, kind: 'blob' } : null;
    const exactProp = pickProps(0);
    const exactCreature = foreground ? { body: foreground.body, kind: 'creature', creature: foreground } : null;
    const front = [exactCreature, exactBlob, exactProp].filter(Boolean).filter(picked => this.dragDepth(picked) > 18).sort((first, second) => this.dragDepth(second) - this.dragDepth(first))[0];
    if (front) return front;
    if (exactBlob) return exactBlob;
    if (foreground) return { body: foreground.body, kind: 'creature', creature: foreground };
    if (exactProp) return exactProp;
    const fruit = this.tree.fruits.find(item => item.attached && Vector.magnitude(Vector.sub(point, item.body.position)) <= item.radius + padding);
    if (fruit) return { body: fruit.body, kind: 'food', prop: fruit };
    if (this.tree.pick(point, 0)) return { body: this.tree.body, kind: 'tree' };
    if (nearestParticle && skinDistance <= this.blob.particleRadius + padding) return { body: nearestParticle, kind: 'blob' };
    const paddedProp = pickProps(padding);
    if (paddedProp) return paddedProp;
    const paddedCreature = this.wildlife?.pick(point, padding);
    if (paddedCreature) return { body: paddedCreature.body, kind: 'creature', creature: paddedCreature };
    if (this.tree.pick(point, padding)) return { body: this.tree.body, kind: 'tree' };
    return null;
  }

  grab(pointerId, point, padding = 0) {
    if (this.drags.has(pointerId)) this.release(pointerId);
    let picked = this.pick(point, 0);
    if (!picked && this.wildlife) {
      const source = this.wildlife.foraging.sourceAt(point, padding);
      const prop = source && this.wildlife.foraging.harvest(source, true);
      if (prop) picked = { body: prop.body, kind: 'food', prop };
    }
    picked ||= this.pick(point, padding);
    if (!picked) return null;
    if (picked.kind === 'chest') this.treasure.open();
    if (picked.prop?.attached && !this.tree.detach(picked.prop.palmSlot, 0, true)) return null;
    if (picked.creature) { picked.creature.held = true; this.wildlife.foraging.cancel(picked.creature); }
    if (picked.kind === 'blob') this.blobHandled = true;
    const prop = this.props.find(item => item.body === picked.body);
    if (prop) prop.playerHandled = true;
    const anchorPoint = { x: point.x, y: point.y - this.dragDepth(picked) };
    const localPoint = picked.kind === 'blob' ? { x: 0, y: 0 } : Vector.rotate(Vector.sub(anchorPoint, picked.body.position), -picked.body.angle);
    const constraint = Constraint.create({ pointA: anchorPoint, bodyB: picked.body, pointB: Vector.rotate(localPoint, picked.body.angle), length: 0, stiffness: picked.kind === 'blob' ? 0.24 : 0.065, damping: 0.12 });
    const drag = { ...picked, constraint, target: { ...point }, start: { ...point } };
    this.drags.set(pointerId, drag);
    Composite.add(this.engine.world, constraint);
    return drag;
  }

  move(pointerId, point) {
    const drag = this.drags.get(pointerId);
    const landResident = drag?.creature && ['crab', 'tortoise', 'lizard', 'rabbit', 'monkey', 'frog'].includes(drag.creature.species);
    const looseProp = drag?.prop && !drag.prop.anchor && !drag.prop.ropes;
    const blob = drag?.kind === 'blob' && [...this.drags.values()].filter(item => item.kind === 'blob').length === 1;
    if (this.expedition && (landResident || looseProp || blob)) {
      const item = landResident ? drag.creature : looseProp ? drag.prop : this.blob;
      const halfHeight = landResident ? item.height * 0.41 : looseProp ? item.radius || item.height / 2 : 38;
      const floor = this.floorAt(point.x);
      item.depthTarget = floor < this.layout.water - 8 ? clamp(point.y - floor + halfHeight, 0, this.map.ecology.depth) : 0;
    }
    if (drag) drag.target = { x: clamp(point.x, 8, this.width - 8), y: clamp(point.y, 35, this.height - 40) };
  }

  release(pointerId, cancelled = false) {
    const drag = this.drags.get(pointerId);
    if (!drag) return;
    Composite.remove(this.engine.world, drag.constraint);
    this.drags.delete(pointerId);
    if (drag.creature) drag.creature.held = [...this.drags.values()].some(item => item.body === drag.body);
    if (drag.prop?.kind === 'food') {
      this.wildlife?.foraging.cancelBite(drag.prop);
      if (cancelled) this.wildlife?.foraging.retire(drag.prop);
    }
  }

  releaseAll() {
    for (const pointerId of [...this.drags.keys()]) this.release(pointerId);
  }

  dragDepth(drag) { return drag.kind === 'blob' ? this.blob.depth : drag.creature?.depth || drag.prop?.depth || 0; }

  updateDepth() {
    if (!this.expedition) return;
    for (const item of [this.blob, ...this.props]) {
      const position = item.body?.position || this.blobPosition();
      if (this.floorAt(position.x) >= this.layout.water - 8) item.depthTarget = 0;
      advanceDepth(item, this.map.ecology.depth);
      for (const body of item.particles || [item.body]) setBodyDepth(body, item.depth);
    }
    for (const drag of this.drags.values()) if (drag.creature) advanceDepth(drag.creature, this.map.ecology.depth);
  }

  nudge(horizontal, vertical, playerAction = true) {
    if (playerAction && (horizontal || vertical)) this.blobHandled = true;
    for (const particle of this.blob.particles) Body.applyForce(particle, particle.position, { x: horizontal * particle.mass * 0.0013, y: vertical * particle.mass * 0.0025 });
  }

  step() {
    this.time += STEP;
    this.environment.step(STEP);
    this.updateDepth();
    for (const drag of this.drags.values()) {
      const target = { x: drag.target.x, y: drag.target.y - this.dragDepth(drag) };
      const delta = Vector.sub(target, drag.constraint.pointA);
      const length = Vector.magnitude(delta);
      const amount = Math.min(1, 24 / Math.max(length, 0.001));
      drag.constraint.pointA.x += delta.x * amount;
      drag.constraint.pointA.y += delta.y * amount;
    }
    this.pressurizeBlob();
    this.tree.step();
    this.wildlife?.step();
    for (const particle of this.blob.particles) this.floatBody(particle, 0.87, particle.circleRadius);
    const wet = this.blob.particles.some(particle => particle.plugin.lastImmersion > 0.2);
    this.blob.wetness = (this.blob.wetness || 0) + ((wet ? 1 : 0) - (this.blob.wetness || 0)) * (wet ? 0.12 : 0.008);
    for (const prop of this.props) {
      this.skipStone(prop);
      prop.submerged = this.floatBody(prop.body, prop.density, prop.radius, prop.width, prop.height);
      if (prop.ropes && ![...this.drags.values()].some(drag => drag.body === prop.body)) {
        Body.applyForce(prop.body, prop.body.position, { x: prop.body.mass * this.environment.wind * 0.000018, y: 0 });
      }
      if (prop.kind === 'bell' && prop.playerHandled && Vector.magnitude(prop.body.velocity) > 1.1 && this.time - (prop.chimedAt || -10000) > 1100) {
        this.queueSound('chime', 1.5, prop.body.position.x); prop.chimedAt = this.time;
      }
      if (this.landmarks && prop.playerHandled && Math.abs(prop.body.velocity.y) < 0.9 && ![...this.drags.values()].some(drag => drag.body === prop.body)) {
        const softGround = [this.landmarks.picnic, this.landmarks.nook].some(place => Math.abs(prop.body.position.x - place.x) < place.radius && Math.abs(prop.body.bounds.max.y - place.y) < 6);
        if (softGround) {
          Body.setVelocity(prop.body, { x: prop.body.velocity.x * 0.88, y: prop.body.velocity.y });
          Body.setAngularVelocity(prop.body, prop.body.angularVelocity * 0.85);
        }
      }
    }
    Engine.update(this.engine, STEP);
    this.dampContacts();
    this.wildlife?.afterStep();
    this.treasure.step();
    this.objectives?.step();
    for (const body of [...this.blob.particles, ...this.props.map(prop => prop.body)]) {
      const speed = Vector.magnitude(body.velocity);
      if (speed > 28) Body.setVelocity(body, Vector.mult(body.velocity, 28 / speed));
      if (Math.abs(body.angularVelocity) > 0.30) Body.setAngularVelocity(body, clamp(body.angularVelocity, -0.30, 0.30));
    }
    for (let index = 0; index < this.waves.length; index += 1) {
      const wave = this.waves[index];
      const left = this.waves[Math.max(0, index - 1)].offset;
      const right = this.waves[Math.min(this.waves.length - 1, index + 1)].offset;
      wave.velocity += (this.environment.swellAt(index) - wave.offset) * 0.024 + (left + right - 2 * wave.offset) * 0.14;
      wave.velocity *= this.environment.profile.retention;
    }
    for (const wave of this.waves) wave.offset = clamp(wave.offset + wave.velocity, -18, 18);
    this.environment.updateShoreline(STEP);
    for (const contact of this.contactSounds()) {
      const prop = this.props.find(item => item.body.id === contact.contactId);
      this.environment.mark(contact.x, prop.depth || 0);
    }
  }

  dampContacts() {
    const processed = new Set();
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive || pair.isSensor) continue;
      const bodies = [pair.bodyA.parent, pair.bodyB.parent];
      if (!bodies.some(body => body.isStatic)) continue;
      const prop = this.props.find(item => bodies.includes(item.body));
      if (!prop || prop.submerged > 0.25 || processed.has(prop.body.id)) continue;
      processed.add(prop.body.id);
      const index = clamp(Math.round(prop.body.position.x / 12), 0, this.environment.shoreline.length - 1);
      prop.body.plugin.dryFriction ??= prop.body.friction;
      prop.body.friction = prop.body.plugin.dryFriction + this.environment.shoreline[index].wetness * 0.06;
      if (prop.radius) Body.setAngularVelocity(prop.body, prop.body.angularVelocity * 0.985);
    }
  }

  contactSounds() {
    const contacts = new Map();
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive || pair.isSensor) continue;
      const bodies = [pair.bodyA.parent, pair.bodyB.parent];
      if (!bodies.some(body => body.isStatic)) continue;
      const prop = this.props.find(item => item.playerHandled && bodies.includes(item.body));
      if (!prop || prop.submerged > 0.25) continue;
      const normal = pair.collision.normal;
      const speed = Math.abs(-normal.y * prop.body.velocity.x + normal.x * prop.body.velocity.y);
      if (speed < 0.22) continue;
      const kind = prop.radius && Math.abs(prop.body.angularVelocity) * prop.radius > 0.1 ? 'rolling' : 'scraping';
      contacts.set(prop.body.id, { ...propSound(prop.kind, prop.body, kind, speed), kind, contactId: prop.body.id, x: prop.body.position.x, speed });
    }
    return [...contacts.values()].sort((first, second) => second.speed - first.speed).slice(0, 2);
  }

  snapshot() {
    const center = this.blobPosition();
    return {
      width: this.width, height: this.height, time: this.time, water: this.layout.water, ground: this.layout.ground,
      environment: this.environment.snapshot(),
      map: this.map.id, initialProps: this.initialPropCount, spawn: this.spawn, landmarks: this.landmarks,
      coast: { shore: this.layout.shore, toe: this.layout.toe, farToe: this.layout.farToe, farShore: this.layout.farShore, waterStart: this.layout.waterStart, waterEnd: this.layout.waterEnd, bank: this.map.coast.bank },
      blob: { ...center, y: center.y + this.blob.depth, physicalY: center.y, depth: this.blob.depth, name: 'Blobby', radius: this.blob.radius, area: Vertices.area(this.blob.ring.map(body => body.position)), velocity: { ...this.blob.center.velocity }, particles: this.blob.ring.map(body => ({ x: body.position.x, y: body.position.y + this.blob.depth })) },
      props: this.props.map(prop => ({ id: prop.body.id, kind: prop.kind, x: prop.body.position.x, y: prop.body.position.y + (prop.depth || 0), physicalY: prop.body.position.y, depth: prop.depth || 0, angle: prop.body.angle, radius: prop.radius, width: prop.width, height: prop.height, submerged: prop.submerged, palmSlot: prop.palmSlot, expeditionId: prop.expeditionId, playerHandled: Boolean(prop.playerHandled),
        ...(prop.kind === 'food' ? { foodType: prop.foodType, sourceId: prop.sourceId, portionId: prop.portionId, reservedBy: prop.reservedBy, reservedUntil: prop.reservedUntil } : {}) })),
      tree: this.tree.snapshot(),
      treasure: this.treasure.snapshot(),
      creatures: this.wildlife?.snapshot(), encounters: this.wildlife?.encounters, encounterCounts: this.wildlife?.encounterCounts,
      objectives: this.objectives?.snapshot(),
      comedy: this.wildlife?.comedy.snapshot(),
      foodPatches: this.wildlife?.foraging.snapshot(),
      playEffects: this.wildlife?.interactions.effects.map(effect => ({ ...effect })),
      drags: this.drags.size,
      grips: [...this.drags.entries()].map(([pointerId, drag]) => ({ pointerId, kind: drag.kind, bodyId: drag.body.id, target: { ...drag.target } })),
      finite: [...this.blob.particles, ...this.props.map(prop => prop.body), this.tree.body, ...this.tree.fruits.map(fruit => fruit.body), ...(this.wildlife?.residents.map(resident => resident.body) || [])].every(body => Number.isFinite(body.position.x) && Number.isFinite(body.position.y)),
    };
  }

  dispose() {
    this.releaseAll();
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}

module.exports = { IslandPhysics, STEP, clamp };