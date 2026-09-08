const Matter = require('matter-js');

const { Engine, Bodies, Body, Composite, Constraint, Vector, Vertices } = Matter;
const STEP = 1000 / 60;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

class IslandPhysics {
  constructor(width = 1440, height = 900) {
    this.width = width;
    this.height = height;
    this.time = 0;
    this.drags = new Map();
    this.splashes = [];
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 6 });
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.001;
    this.layout = {
      ground: height * 0.70,
      water: height * 0.725,
      bottom: height * 0.935,
      shore: width * 0.40,
      toe: width * 0.62,
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
    this.addProp('ball', width * 0.60, water - 48, { radius: 26 * objectScale, mass: 0.48, density: 0.20 });
    this.addProp('raft', width * 0.79, water - 23, { width: 122 * objectScale, height: 20 * objectScale, mass: 2.6, density: 0.42 });
    this.addProp('coconut', width * 0.94, water - 58, { radius: 19 * objectScale, mass: 0.75, density: 0.73 });
    this.addProp('bottle', width * 0.51, water - 77, { width: 18 * objectScale, height: 43 * objectScale, mass: 0.30, density: 0.46 });
    const waveCount = clamp(Math.round((width - this.layout.waterStart) / 12), 28, 96);
    this.waves = Array.from({ length: waveCount }, () => ({ offset: 0, velocity: 0 }));
  }

  makeBlob(positionX, positionY) {
    const radius = 30;
    const particleRadius = 6.2;
    const group = Body.nextGroup(true);
    const options = { friction: 0.65, frictionAir: 0.012, restitution: 0.26, slop: 0.04, collisionFilter: { group }, label: 'jelly' };
    const ring = Array.from({ length: 18 }, (_, index) => {
      const angle = index / 18 * Math.PI * 2;
      const particle = Bodies.circle(positionX + Math.cos(angle) * radius, positionY + Math.sin(angle) * radius, particleRadius, options);
      Body.setMass(particle, 0.065);
      return particle;
    });
    const center = Bodies.circle(positionX, positionY, 13, options);
    Body.setMass(center, 0.15);
    const links = [];
    for (let index = 0; index < ring.length; index += 1) {
      links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[(index + 1) % ring.length], stiffness: 0.88, damping: 0.12 }));
      links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[(index + 2) % ring.length], stiffness: 0.28, damping: 0.10 }));
      links.push(Constraint.create({ bodyA: center, bodyB: ring[index], stiffness: 0.16, damping: 0.16 }));
      if (index < ring.length / 2) {
        links.push(Constraint.create({ bodyA: ring[index], bodyB: ring[index + ring.length / 2], stiffness: 0.055, damping: 0.12 }));
      }
    }
    this.blob = { ring, center, radius: radius + particleRadius, particleRadius, particles: [...ring, center], links };
    Composite.add(this.engine.world, [...this.blob.particles, ...links]);
  }

  addProp(kind, positionX, positionY, settings) {
    const options = { friction: 0.48, frictionAir: 0.007, restitution: kind === 'ball' ? 0.58 : 0.16, label: kind };
    const body = settings.radius
      ? Bodies.circle(positionX, positionY, settings.radius, options)
      : Bodies.rectangle(positionX, positionY, settings.width, settings.height, { ...options, chamfer: { radius: Math.min(4, settings.width / 4) } });
    Body.setMass(body, settings.mass);
    const prop = { kind, body, ...settings, submerged: 0 };
    this.props.push(prop);
    Composite.add(this.engine.world, body);
  }

  blobPosition() {
    const center = this.blob.ring.reduce((total, body) => ({ x: total.x + body.position.x, y: total.y + body.position.y }), { x: 0, y: 0 });
    return { x: center.x / this.blob.ring.length, y: center.y / this.blob.ring.length };
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
    if ((previous < 0.10 && submerged >= 0.10) || (previous > 0.45 && submerged < 0.45 && body.velocity.y < -1.4)) {
      const strength = Math.min(7, Math.abs(body.velocity.y) * body.mass * 2.4);
      if (strength > 0.25) this.splash(body.position.x, strength);
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
  }

  pick(point, padding = 0) {
    const center = this.blobPosition();
    let nearestParticle = this.blob.center;
    let nearestDistance = Infinity;
    for (const particle of this.blob.particles) {
      const distance = Vector.magnitude(Vector.sub(point, particle.position));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestParticle = particle;
      }
    }
    if (Vector.magnitude(Vector.sub(point, center)) <= this.blob.radius + padding || nearestDistance <= this.blob.particleRadius + padding) return { body: nearestParticle, kind: 'blob' };
    for (const prop of [...this.props].reverse()) {
      const local = Vector.rotate(Vector.sub(point, prop.body.position), -prop.body.angle);
      const hit = prop.radius
        ? Vector.magnitude(local) <= prop.radius + padding
        : Math.abs(local.x) <= prop.width / 2 + padding && Math.abs(local.y) <= prop.height / 2 + padding;
      if (hit) return { body: prop.body, kind: prop.kind };
    }
    return null;
  }

  grab(pointerId, point, padding = 0) {
    if (this.drags.has(pointerId)) this.release(pointerId);
    const picked = this.pick(point, padding);
    if (!picked) return null;
    const localPoint = picked.kind === 'blob' ? { x: 0, y: 0 } : Vector.rotate(Vector.sub(point, picked.body.position), -picked.body.angle);
    const constraint = Constraint.create({ pointA: { ...point }, bodyB: picked.body, pointB: Vector.rotate(localPoint, picked.body.angle), length: 0, stiffness: picked.kind === 'blob' ? 0.075 : 0.065, damping: 0.16 });
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
      blob: { ...center, radius: this.blob.radius, area: Vertices.area(this.blob.ring.map(body => body.position)), velocity: { ...this.blob.center.velocity }, particles: this.blob.ring.map(body => ({ ...body.position })) },
      props: this.props.map(prop => ({ kind: prop.kind, x: prop.body.position.x, y: prop.body.position.y, angle: prop.body.angle, submerged: prop.submerged })),
      drags: this.drags.size,
      finite: [...this.blob.particles, ...this.props.map(prop => prop.body)].every(body => Number.isFinite(body.position.x) && Number.isFinite(body.position.y)),
    };
  }

  dispose() {
    this.releaseAll();
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}

module.exports = { IslandPhysics, STEP, clamp };