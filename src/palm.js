const { Bodies, Body, Composite, Constraint, Events, Query, Vector } = require('matter-js');

class PalmTree {
  constructor(island) {
    this.island = island;
    this.scale = Math.max(0.69, Math.min(1, island.width / 1300));
    this.base = { x: island.expedition ? Math.max(100, island.width * 0.027) : island.width * 0.105, y: island.layout.ground - 8 };
    this.height = island.expedition ? Math.min(245, island.map.palmHeight) : island.map.palmHeight;
    this.lean = island.map.palmLean;
    this.lastDrop = -1000;
    this.impacts = 0;
    this.rustles = [];
    const group = Body.nextGroup(true);
    this.group = group;
    const parts = [];
    for (let index = 0; index < 8; index += 1) {
      const lower = index / 8;
      const upper = (index + 1) / 8;
      const start = { x: this.base.x + this.lean * Math.pow(lower, 1.3) * this.scale, y: this.base.y - this.height * lower * this.scale };
      const end = { x: this.base.x + this.lean * Math.pow(upper, 1.3) * this.scale, y: this.base.y - this.height * upper * this.scale };
      const delta = Vector.sub(end, start);
      parts.push(Bodies.rectangle((start.x + end.x) / 2, (start.y + end.y) / 2, (32 - upper * 18) * this.scale, Vector.magnitude(delta) + 3,
        { angle: Math.atan2(delta.y, delta.x) + Math.PI / 2 }));
    }
    this.body = Body.create({ parts, label: 'palm', friction: 0.65, restitution: 0.3, frictionAir: 0.055, collisionFilter: { group } });
    Body.setMass(this.body, 5.8);
    Body.setInertia(this.body, this.body.mass * (this.height * this.height + this.lean * this.lean) * this.scale * this.scale / 3);
    this.rootOffset = Vector.sub(this.base, this.body.position);
    const crown = { x: this.base.x + this.lean * this.scale, y: this.base.y - this.height * this.scale };
    this.crownOffset = Vector.sub(crown, this.body.position);
    this.root = Constraint.create({ pointA: { ...this.base }, bodyB: this.body, pointB: { ...this.rootOffset }, length: 0, stiffness: 0.98, damping: 0.20 });
    this.spring = Constraint.create({ pointA: { ...crown }, bodyB: this.body, pointB: { ...this.crownOffset }, length: 0, stiffness: 0.006, damping: 0.08 });
    Composite.add(island.engine.world, [this.body, this.root, this.spring]);
    this.fruits = [0, 1, 2].map(slot => this.grow(slot));
    Events.on(island.engine, 'collisionStart', event => {
      for (const pair of event.pairs) {
        const parentA = pair.bodyA.parent;
        const parentB = pair.bodyB.parent;
        const other = parentA === this.body ? parentB : parentB === this.body ? parentA : null;
        if (!other || other.isStatic || this.fruits.some(fruit => fruit.body === other)) continue;
        const relative = Vector.sub(other.velocity, this.body.velocity);
        const speed = Math.abs(Vector.dot(relative, pair.collision.normal));
        if (speed < 2.0) continue;
        this.impacts += 1;
        Body.setAngularVelocity(this.body, this.body.angularVelocity + Math.max(-0.025, Math.min(0.025, relative.x * 0.0025)));
        this.dropFromImpact(speed);
      }
    });
  }

  point(localPoint) {
    return Vector.add(this.body.position, Vector.rotate(Vector.add(this.rootOffset, Vector.mult(localPoint, this.scale)), this.body.angle));
  }

  crown() {
    return this.point({ x: this.lean, y: -this.height });
  }

  grow(slot) {
    const radius = 16 * this.scale;
    const anchor = this.point({ x: this.lean + 22 + slot * 29, y: -this.height + 12 });
    const body = Bodies.circle(anchor.x, anchor.y + radius + (slot === 1 ? 27 : 10) * this.scale, radius,
      { label: 'food', friction: 0.60, frictionAir: 0.01, restitution: 0.18, collisionFilter: { group: this.group } });
    const mass = 0.065;
    Body.setMass(body, mass);
    const stem = Constraint.create({ bodyA: this.body, pointA: Vector.rotate(Vector.sub(anchor, this.body.position), -this.body.angle), bodyB: body,
      pointB: { x: 0, y: -radius * 0.65 }, stiffness: 0.55, damping: 0.1 });
    Composite.add(this.island.engine.world, [body, stem]);
    return { kind: 'food', foodType: 'banana', body, stem, radius, mass, density: 0.72, submerged: 0, depth: 0, depthTarget: 0, palmSlot: slot, attached: true };
  }

  pick(point, padding = 0) {
    const crown = this.crown();
    if (Vector.magnitude(Vector.sub(point, crown)) < 100 * this.scale) return true;
    if (Query.point([this.body], point).length) return true;
    return this.body.parts.slice(1).some(part => point.x >= part.bounds.min.x - padding && point.x <= part.bounds.max.x + padding && point.y >= part.bounds.min.y - padding && point.y <= part.bounds.max.y + padding);
  }

  detach(slot, kick = 0, playerHandled = false) {
    const fruit = this.fruits[slot];
    if (!fruit?.attached) return fruit;
    const foraging = this.island.wildlife?.foraging;
    const source = foraging?.patches.find(patch => patch.treeSlot === slot);
    return source ? foraging.harvest(source, playerHandled, kick) : this.pluck(slot, kick);
  }

  pluck(slot, kick = 0) {
    const fruit = this.fruits[slot];
    if (!fruit?.attached) return fruit;
    fruit.attached = false;
    fruit.body.collisionFilter.group = 0;
    Composite.remove(this.island.engine.world, fruit.stem);
    Body.setVelocity(fruit.body, { x: fruit.body.velocity.x + kick, y: Math.max(1, fruit.body.velocity.y) });
    Body.setAngularVelocity(fruit.body, kick * 0.045);
    this.island.props.push(fruit);
    return fruit;
  }

  dropFromImpact(strength) {
    if (this.island.time - this.lastDrop < 650) return;
    const fruit = this.fruits.find(item => item.attached);
    if (!fruit) return;
    const direction = this.body.angularVelocity < 0 ? -1 : 1;
    if (!this.detach(fruit.palmSlot, direction * Math.min(2.8, strength * 0.35))) return;
    this.lastDrop = this.island.time;
    this.rustles.push({ ...this.crown(), time: this.island.time, strength });
    this.rustles = this.rustles.slice(-8);
    this.island.queueSound('rustle', strength, this.crown().x);
  }

  step() {
    Body.applyForce(this.body, this.body.position, { x: 0, y: -this.body.mass * this.island.engine.gravity.scale });
    if (Math.abs(this.body.angularVelocity) > 0.014 && [...this.island.drags.values()].some(drag => drag.kind === 'tree')) this.dropFromImpact(3.5);
  }

  snapshot() {
    return { kind: 'banana', base: this.point({ x: 0, y: 0 }), crown: this.crown(), hitTarget: this.point({ x: this.lean * Math.pow(0.55, 1.3), y: -this.height * 0.55 }),
      angle: this.body.angle, attached: this.fruits.filter(fruit => fruit.attached).length, dropped: this.fruits.filter(fruit => !fruit.attached).length, impacts: this.impacts,
      fruits: this.fruits.map(fruit => ({ slot: fruit.palmSlot, attached: fruit.attached, x: fruit.body.position.x, y: fruit.body.position.y })) };
  }
}

module.exports = { PalmTree };