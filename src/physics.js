const Matter = require('matter-js');
const { PalmTree } = require('./palm.js');
const { MAPS } = require('./maps.js');

const { Engine, Bodies, Body, Composite, Constraint, Vector, Vertices, Events } = Matter;
const STEP = 1000 / 60;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

class IslandPhysics {
  constructor(width = 1440, height = 900, mapId = 'lagoon') {
    this.width = width;
    this.height = height;
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
      ground: height * this.map.ground,
      water: height * this.map.water,
      bottom: height * this.map.bottom,
      shore: width * this.map.shore,
      toe: width * this.map.toe,
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
    this.makeBlob(width * 0.30, ground - 92);
    this.props = [];
    const objectScale = clamp(width / 1000, 0.73, 1);
    for (const toy of this.map.toys) {
      const margin = (toy.radius || toy.width / 2) * objectScale + 5;
      this.addProp(toy.kind, clamp(width * toy.x, margin, width - margin), (toy.onLand ? ground : water) - toy.elevation,
        { ...toy, radius: toy.radius ? toy.radius * objectScale : undefined, width: toy.width ? toy.width * objectScale : undefined, height: toy.height ? toy.height * objectScale : undefined });
    }
    this.rocks = this.map.rocks.map(rock => Bodies.trapezoid(width * rock.x, water - rock.elevation, rock.width * objectScale, rock.height, 0.35, { ...terrainOptions, label: 'rock' }));
    Composite.add(this.engine.world, this.rocks);
    const waveCount = clamp(Math.round((width - this.layout.waterStart) / 12), 28, 96);
    this.waves = Array.from({ length: waveCount }, () => ({ offset: 0, velocity: 0 }));
    this.tree = new PalmTree(this);
    Events.on(this.engine, 'collisionStart', event => {
      for (const pair of event.pairs) {
        const first = pair.bodyA.parent;
        const second = pair.bodyB.parent;
        if (first.label === 'palm' || second.label === 'palm') continue;
        if (this.tree.fruits.some(fruit => fruit.attached && (fruit.body === first || fruit.body === second))) continue;
        const relative = Vector.sub(first.velocity, second.velocity);
        const speed = Math.abs(Vector.dot(relative, pair.collision.normal));
        if (speed < 3 || Math.max(first.plugin.lastImmersion || 0, second.plugin.lastImmersion || 0) > 0.5) continue;
        const labels = [first.label, second.label];
        const kind = labels.includes('jelly') || labels.includes('ball') ? 'bounce' : labels.includes('bottle') ? 'glass' : labels.includes('shell') ? 'shell' : 'wood';
        this.queueSound(kind, Math.min(7, speed), (first.position.x + second.position.x) / 2);
      }
    });
  }

  makeBlob(positionX, positionY) {
    const radius = 34;
    const particleRadius = 6.2;
    const group = Body.nextGroup(true);
    const options = { friction: 0.62, frictionAir: 0.016, restitution: 0.46, slop: 0.04, collisionFilter: { group }, label: 'jelly' };
    const ring = Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2;
      const lobe = 1 + Math.sin(angle * 3 + 0.4) * 0.10 + Math.cos(angle * 5) * 0.045;
      const particle = Bodies.circle(positionX + Math.cos(angle) * radius * 1.18 * lobe, positionY + Math.sin(angle) * radius * 0.88 * lobe, particleRadius, options);
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
    this.blob = { ring, center, radius: radius * 1.18 + particleRadius, particleRadius, particles: [...ring, center], links,
      softness: 0, restArea: Vertices.area(ring.map(particle => particle.position)) };
    Composite.add(this.engine.world, [...this.blob.particles, ...links]);
  }

  pressurizeBlob() {
    const { ring, restArea } = this.blob;
    const stretching = [...this.drags.values()].filter(drag => drag.kind === 'blob').length > 1;
    this.blob.softness += ((stretching ? 1 : 0) - this.blob.softness) * 0.16;
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
      body = Body.create({ ...options, parts });
    }
    Body.setMass(body, settings.mass);
    if (kind === 'ring') Body.setInertia(body, settings.mass * settings.radius * settings.radius * 2);
    const prop = { kind, body, ...settings, submerged: 0 };
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
    const waveIndex = clamp((positionX - this.layout.waterStart) / (this.width - this.layout.waterStart) * (this.waves.length - 1), 0, this.waves.length - 1);
    const lower = Math.floor(waveIndex);
    const upper = Math.min(lower + 1, this.waves.length - 1);
    return this.layout.water + this.waves[lower].offset * (1 - waveIndex + lower) + this.waves[upper].offset * (waveIndex - lower);
  }

  circleImmersion(position, radius) {
    if (position.x + radius < this.layout.waterStart) return 0;
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
      Body.applyForce(body, body.position, {
        x: -body.velocity.x * body.mass * 0.00022 * submerged,
        y: -body.velocity.y * body.mass * 0.00026 * submerged,
      });
      Body.setAngularVelocity(body, body.angularVelocity * (1 - 0.04 * submerged));
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

  splash(positionX, strength) {
    if (positionX < this.layout.waterStart || positionX > this.width) return;
    const index = Math.round((positionX - this.layout.waterStart) / (this.width - this.layout.waterStart) * (this.waves.length - 1));
    for (let offset = -2; offset <= 2; offset += 1) {
      const wave = this.waves[index + offset];
      if (wave) wave.velocity += strength * (1 - Math.abs(offset) / 3) * 0.40;
    }
    if (this.splashes.length < 24) this.splashes.push({ x: positionX, y: this.surfaceAt(positionX), strength, time: this.time });
    if (strength > 0.9) this.queueSound('splash', strength, positionX);
  }

  queueSound(kind, strength = 1, positionX = this.width / 2) {
    const cooldown = kind === 'rustle' ? 550 : kind === 'splash' ? 220 : 180;
    if (this.time - (this.soundTimes.get(kind) ?? -Infinity) < cooldown) return;
    this.soundTimes.set(kind, this.time);
    if (this.sounds.length < 20) this.sounds.push({ kind, strength, pan: clamp(positionX / this.width * 2 - 1, -0.8, 0.8), time: this.time });
  }

  pick(point, padding = 0) {
    const occupied = new Set([...this.drags.values()].filter(drag => drag.kind === 'blob').map(drag => drag.body));
    let nearestParticle;
    let nearestDistance = Infinity;
    let skinDistance = Infinity;
    let inside = false;
    for (let index = 0; index < this.blob.ring.length; index += 1) {
      const particle = this.blob.ring[index];
      const next = this.blob.ring[(index + 1) % this.blob.ring.length].position;
      const current = particle.position;
      if ((current.y > point.y) !== (next.y > point.y) && point.x < (next.x - current.x) * (point.y - current.y) / (next.y - current.y) + current.x) inside = !inside;
      const distance = Vector.magnitude(Vector.sub(point, particle.position));
      skinDistance = Math.min(skinDistance, distance);
      if (!occupied.has(particle) && distance < nearestDistance) {
        nearestDistance = distance;
        nearestParticle = particle;
      }
    }
    if (nearestParticle && (inside || skinDistance <= this.blob.particleRadius + padding)) return { body: nearestParticle, kind: 'blob' };
    for (const prop of [...this.props].reverse()) {
      const local = Vector.rotate(Vector.sub(point, prop.body.position), -prop.body.angle);
      const hit = prop.radius
        ? Vector.magnitude(local) <= prop.radius + padding
        : Math.abs(local.x) <= prop.width / 2 + padding && Math.abs(local.y) <= prop.height / 2 + padding;
      if (hit) return { body: prop.body, kind: prop.kind };
    }
    if (this.tree.pick(point, padding)) return { body: this.tree.body, kind: 'tree' };
    return null;
  }

  grab(pointerId, point, padding = 0) {
    if (this.drags.has(pointerId)) this.release(pointerId);
    const picked = this.pick(point, padding);
    if (!picked) return null;
    const localPoint = picked.kind === 'blob' ? { x: 0, y: 0 } : Vector.rotate(Vector.sub(point, picked.body.position), -picked.body.angle);
    const constraint = Constraint.create({ pointA: { ...point }, bodyB: picked.body, pointB: Vector.rotate(localPoint, picked.body.angle), length: 0, stiffness: picked.kind === 'blob' ? 0.24 : 0.065, damping: 0.12 });
    const drag = { ...picked, constraint, target: { ...point }, start: { ...point } };
    this.drags.set(pointerId, drag);
    Composite.add(this.engine.world, constraint);
    return drag;
  }

  move(pointerId, point) {
    const drag = this.drags.get(pointerId);
    if (drag) drag.target = { x: clamp(point.x, 8, this.width - 8), y: clamp(point.y, 35, this.height - 40) };
  }

  release(pointerId) {
    const drag = this.drags.get(pointerId);
    if (!drag) return;
    Composite.remove(this.engine.world, drag.constraint);
    this.drags.delete(pointerId);
  }

  releaseAll() {
    for (const pointerId of [...this.drags.keys()]) this.release(pointerId);
  }

  nudge(horizontal, vertical) {
    for (const particle of this.blob.particles) Body.applyForce(particle, particle.position, { x: horizontal * particle.mass * 0.0013, y: vertical * particle.mass * 0.0025 });
  }

  step() {
    this.time += STEP;
    for (const drag of this.drags.values()) {
      const delta = Vector.sub(drag.target, drag.constraint.pointA);
      const length = Vector.magnitude(delta);
      const amount = Math.min(1, 24 / Math.max(length, 0.001));
      drag.constraint.pointA.x += delta.x * amount;
      drag.constraint.pointA.y += delta.y * amount;
    }
    this.pressurizeBlob();
    this.tree.step();
    for (const particle of this.blob.particles) this.floatBody(particle, 0.87, particle.circleRadius);
    for (const prop of this.props) prop.submerged = this.floatBody(prop.body, prop.density, prop.radius, prop.width, prop.height);
    Engine.update(this.engine, STEP);
    for (const body of [...this.blob.particles, ...this.props.map(prop => prop.body)]) {
      const speed = Vector.magnitude(body.velocity);
      if (speed > 28) Body.setVelocity(body, Vector.mult(body.velocity, 28 / speed));
      if (Math.abs(body.angularVelocity) > 0.30) Body.setAngularVelocity(body, clamp(body.angularVelocity, -0.30, 0.30));
    }
    for (let index = 0; index < this.waves.length; index += 1) {
      const wave = this.waves[index];
      const left = this.waves[Math.max(0, index - 1)].offset;
      const right = this.waves[Math.min(this.waves.length - 1, index + 1)].offset;
      wave.velocity += -wave.offset * 0.024 + (left + right - 2 * wave.offset) * 0.14;
      wave.velocity *= 0.957;
    }
    for (const wave of this.waves) wave.offset = clamp(wave.offset + wave.velocity, -18, 18);
  }

  snapshot() {
    const center = this.blobPosition();
    return {
      width: this.width, height: this.height, time: this.time, water: this.layout.water, ground: this.layout.ground,
      map: this.map.id, initialProps: this.map.toys.length,
      blob: { ...center, radius: this.blob.radius, area: Vertices.area(this.blob.ring.map(body => body.position)), velocity: { ...this.blob.center.velocity }, particles: this.blob.ring.map(body => ({ ...body.position })) },
      props: this.props.map(prop => ({ kind: prop.kind, x: prop.body.position.x, y: prop.body.position.y, angle: prop.body.angle, radius: prop.radius, width: prop.width, height: prop.height, submerged: prop.submerged, palmSlot: prop.palmSlot })),
      tree: this.tree.snapshot(),
      drags: this.drags.size,
      finite: [...this.blob.particles, ...this.props.map(prop => prop.body), this.tree.body, ...this.tree.fruits.map(fruit => fruit.body)].every(body => Number.isFinite(body.position.x) && Number.isFinite(body.position.y)),
    };
  }

  dispose() {
    this.releaseAll();
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}

module.exports = { IslandPhysics, STEP, clamp };