const { Bounds, Body, Composite, Query } = require('matter-js');
const { setBodyDepth } = require('./depth-space.js');

const DIETS = {
  fish: { food: 'plankton', foods: ['plankton', 'algae'], routine: 'nibbling' }, jellyfish: { food: 'plankton', foods: ['plankton'], routine: 'filter-feeding' },
  crab: { food: 'shore-scraps', foods: ['shore-scraps', 'algae'], routine: 'sifting' }, tortoise: { food: 'grass', foods: ['grass'], routine: 'grazing' },
  rabbit: { food: 'grass', foods: ['grass', 'carrot'], routine: 'grazing' }, bird: { food: 'insects', foods: ['insects', 'shore-scraps', 'bait-fish'], routine: 'pecking' },
  lizard: { food: 'insects', foods: ['insects'], routine: 'insect-hunting' }, starfish: { food: 'algae', foods: ['algae', 'shell-bed'], routine: 'reef-grazing' },
  octopus: { food: 'shell-bed', foods: ['shell-bed'], routine: 'probing' }, shark: { food: 'bait-fish', foods: ['bait-fish'], routine: 'gulping' },
  monkey: { food: 'banana', foods: ['banana'], routine: 'banana-munching' },
};
const FOODS = {
  grass: { medium: 'land', radius: 12 }, carrot: { medium: 'land', radius: 12 }, banana: { medium: 'land', radius: 16 },
  insects: { medium: 'land', radius: 14 }, 'shore-scraps': { medium: 'land', radius: 11 },
  plankton: { medium: 'water', radius: 16 }, algae: { medium: 'water', radius: 14 },
  'shell-bed': { medium: 'water', radius: 12 }, 'bait-fish': { medium: 'water', radius: 15 },
};
const LAND = new Set(['crab', 'tortoise', 'rabbit', 'lizard', 'monkey']);
const PRIORITY = new Set(['startled', 'fleeing', 'returning', 'stalking', 'lunging', 'toy-play', 'inspecting', 'foraging', 'snacking', 'visiting', 'visiting-flight', 'curious', 'following', 'playing', 'companion']);
const MAX_PORTIONS = 24;
const MEAL_DWELL = 1500;
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

class Foraging {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.island = wildlife.island;
    this.patches = [];
    this.portions = new Map();
    const { layout, width, map } = this.island;
    const patch = (food, positionX, positionY, depth = 0) => this.patches.push({ id: `food-${this.patches.length}`, food, x: positionX, y: positionY, depth,
      readyAt: 0, depletedAt: null, visits: 0, generation: 0, portionId: null, reservedBy: null, reservedUntil: 0 });
    for (let index = 0; index < 15; index += 1) {
      const positionX = index < 12 ? 115 + index / 11 * (layout.shore - 210) : layout.farShore + 45 + (index - 12) / 2 * (width - layout.farShore - 100);
      const floor = this.island.floorAt(positionX);
      const depth = 42 + (index * 71 % Math.max(60, map.ecology.depth - 60));
      patch('grass', positionX, floor, depth);
      if (map.id === 'sunset' && index % 3 === 1) patch('carrot', positionX + 30, floor, depth);
      if (index % 3 === 0) patch('insects', positionX + 16, floor - 45, index % 2 === 0 ? 0 : depth);
      if (index % 4 === 0) patch('shore-scraps', positionX + 28, floor, 35);
    }
    for (let index = 0; index < 8; index += 1) {
      const positionX = wildlife.water.minX + 60 + index / 7 * (wildlife.water.maxX - wildlife.water.minX - 120);
      patch('plankton', positionX, layout.water + 72 + index % 3 * 65);
      patch('algae', positionX - 16, this.island.floorAt(positionX - 16));
      patch('shell-bed', positionX + 20, this.island.floorAt(positionX + 20));
      if (index % 2 === 0) patch('bait-fish', positionX + 42, layout.water + 12);
    }
    for (const fruit of this.island.tree.fruits) {
      patch('banana', fruit.body.position.x, fruit.body.position.y);
      this.patches.at(-1).treeSlot = fruit.palmSlot;
    }
    for (const resident of wildlife.residents) Object.assign(resident, {
      diet: DIETS[resident.species], foodAt: 18000 + wildlife.random() * 14000, foodId: null, foodPortionId: null,
      feedingSince: null, biteAt: null, forageUntil: 0, meals: 0, lastMealAt: null, mealHeartUntil: 0, satisfiedUntil: 0,
    });
  }

  targetFor(resident, patch) {
    const point = this.pointFor(patch);
    const floor = this.island.floorAt(point.x);
    const food = patch.foodType || patch.food;
    const direction = Math.sign(point.x - resident.body.position.x) || resident.direction;
    const positionY = LAND.has(resident.species) ? floor - resident.height * 0.41 : resident.species === 'bird' ? floor - 62
      : ['plankton', 'bait-fish'].includes(food) ? point.y + (resident.species === 'shark' ? resident.height * 0.4 : 0) : floor - resident.height * 0.5 - 8;
    return { x: point.x - direction * resident.width * (resident.species === 'bird' ? 0.5 : 0.32),
      y: resident.species === 'bird' ? Math.min(this.island.layout.water - 22, patch.body ? point.y - 12 : food === 'bait-fish' ? this.island.layout.water - 22 : positionY) : positionY,
      depth: LAND.has(resident.species) ? patch.depth || 0 : 0 };
  }

  accepts(resident, food) {
    if (resident.species === 'bird' && this.island.map.id === 'pools' && food === 'bait-fish') return false;
    return resident.diet.foods.includes(food);
  }

  clearTarget(resident, patch) {
    const point = this.pointFor(patch);
    if (LAND.has(resident.species)) {
      const ground = this.wildlife.groundHabitat(resident);
      return point.x >= ground.minX && point.x <= ground.maxX && Math.abs(this.island.floorAt(point.x) - ground.maxY) < 20;
    }
    if (resident.species !== 'bird') return (patch.depth || 0) < 18 && point.y >= this.island.surfaceAt(point.x) + 5
      && this.island.floorAt(point.x) > this.island.layout.water + 60;
    if ((patch.depth || 0) > 18 || point.y > this.island.surfaceAt(point.x) + 38) return false;
    const target = this.targetFor(resident, patch);
    const halfWidth = resident.width * 0.41 + 4;
    const halfHeight = resident.height * 0.41 + 4;
    const bounds = { min: { x: target.x - halfWidth, y: target.y - halfHeight },
      max: { x: target.x + halfWidth, y: target.y + halfHeight } };
    const blockers = [...this.island.tree.body.parts.slice(1),
      ...this.island.props.filter(prop => prop !== patch && prop.kind !== 'food' && (prop.depth || 0) < 25).map(prop => prop.body), ...(this.island.blob.depth < 25 ? this.island.blob.particles : [])];
    return !blockers.some(body => Bounds.overlaps(bounds, body.bounds));
  }

  pointFor(item) {
    if (item.body) return { ...item.body.position };
    if (Number.isInteger(item.treeSlot)) return { ...this.island.tree.fruits[item.treeSlot].body.position };
    const lift = ['grass', 'carrot', 'shore-scraps', 'shell-bed'].includes(item.food) ? 12 : item.food === 'algae' ? 18 : 0;
    return { x: item.x, y: item.y - lift };
  }

  available(source) { return source.readyAt <= this.island.time && !source.portionId; }

  live(portion) {
    return Boolean(portion && this.portions.get(portion.portionId) === portion && this.patches.find(source => source.id === portion.sourceId)?.portionId === portion.portionId);
  }

  sourceAt(point, padding = 0) {
    return this.patches.filter(source => this.available(source)).map(source => ({ source, point: this.pointFor(source) }))
      .filter(item => distance(point, { x: item.point.x, y: item.point.y + item.source.depth }) < 22 + Math.min(10, padding))
      .sort((first, second) => distance(point, { x: first.point.x, y: first.point.y + first.source.depth })
        - distance(point, { x: second.point.x, y: second.point.y + second.source.depth }))[0]?.source || null;
  }

  harvest(source, playerHandled = false, kick = 0) {
    if (!this.patches.includes(source) || !this.available(source) || this.portions.size >= MAX_PORTIONS) return null;
    if (playerHandled && source.reservedBy) this.cancel(this.wildlife.residents.find(resident => resident.id === source.reservedBy));
    const point = this.pointFor(source);
    const portionId = `${source.id}:${++source.generation}`;
    const settings = { radius: FOODS[source.food].radius, mass: 0.065,
      density: ['algae', 'shell-bed'].includes(source.food) ? 1.35 : ['plankton', 'bait-fish'].includes(source.food) ? 1 : 0.72,
      foodType: source.food, sourceId: source.id, portionId, bornAt: this.island.time, reservedBy: source.reservedBy,
      reservedUntil: source.reservedUntil, playerHandled, consumed: false, lostSince: null };
    const portion = Number.isInteger(source.treeSlot) ? this.island.tree.pluck(source.treeSlot, kick) : this.island.addProp('food', point.x, point.y, settings);
    Object.assign(portion, settings, { radius: portion.radius });
    portion.depth = source.depth; portion.depthTarget = source.depth;
    setBodyDepth(portion.body, portion.depth);
    portion.body.collisionFilter.group = this.wildlife.group;
    Body.setInertia(portion.body, Infinity);
    source.portionId = portionId; source.depletedAt = this.island.time;
    source.touchedUntil = this.island.time + 1000;
    if (playerHandled) source.touches = (source.touches || 0) + 1;
    this.portions.set(portionId, portion);
    if (playerHandled) this.island.queueSound(FOODS[source.food].medium === 'land' ? 'rustle' : 'splash', 0.7, source.x);
    return portion;
  }

  cancel(resident) {
    if (!resident) return;
    for (const item of [...this.patches, ...this.portions.values()]) if (item.reservedBy === resident.id) { item.reservedBy = null; item.reservedUntil = 0; }
    resident.foodId = null; resident.foodPortionId = null; resident.feedingSince = null; resident.biteAt = null; resident.feedingPoint = null;
  }

  cancelBite(portion) {
    const resident = this.wildlife.residents.find(item => item.id === portion.reservedBy);
    if (resident) { resident.feedingSince = null; resident.biteAt = null; resident.feedingPoint = null; }
  }

  retire(portion, reason = 'recycled') {
    if (!this.live(portion)) return false;
    const source = this.patches.find(item => item.id === portion.sourceId);
    for (const [pointerId, drag] of this.island.drags) if (drag.body === portion.body) this.island.release(pointerId);
    for (const resident of this.wildlife.residents) if (resident.foodId === source.id) this.cancel(resident);
    Composite.remove(this.island.engine.world, portion.body);
    this.island.props.splice(this.island.props.indexOf(portion), 1);
    this.portions.delete(portion.portionId);
    portion.consumed = reason === 'eaten'; portion.reservedBy = null; portion.reservedUntil = 0;
    source.portionId = null; source.reservedBy = null; source.reservedUntil = 0;
    source.depletedAt = this.island.time; source.readyAt = this.island.time + 16000 + this.wildlife.random() * 16000;
    return true;
  }

  eligible(resident) {
    const { time } = this.island;
    return !this.wildlife.held(resident.body) && !resident.recovery && !resident.frown && this.wildlife.inHabitat(resident)
      && !this.wildlife.interactions.owns(resident) && !(PRIORITY.has(resident.state) && resident.until > time)
      && !(resident.species === 'bird' && resident.state === 'perching' && resident.until > time)
      && !(['bird', 'tortoise'].includes(resident.species) && this.wildlife.picnicFood());
  }

  reserve(resident, item) {
    if (item.reservedBy && item.reservedBy !== resident.id && item.reservedUntil > this.island.time) return false;
    if (item.sourceId && item.playerHandled && (!item.reservedBy || item.reservedUntil <= this.island.time) && this.offeredTo(item)?.id !== resident.id) return false;
    if (item.reservedBy && item.reservedBy !== resident.id) this.cancel(this.wildlife.residents.find(other => other.id === item.reservedBy));
    item.reservedBy = resident.id; item.reservedUntil = this.island.time + 1000;
    if (item.sourceId) {
      const source = this.patches.find(patch => patch.id === item.sourceId);
      source.reservedBy = resident.id; source.reservedUntil = item.reservedUntil;
    }
    return true;
  }

  offeredTo(portion) {
    return this.wildlife.residents.filter(resident => this.eligible(resident) && this.accepts(resident, portion.foodType)
      && (resident.lastMealAt === null || this.island.time - resident.lastMealAt >= 6000)
      && Math.abs(portion.depth - resident.depth) < 18 && distance(portion.body.position, resident.body.position) < 180 && this.clearTarget(resident, portion))
      .sort((first, second) => distance(this.mouthFor(first), portion.body.position) - distance(this.mouthFor(second), portion.body.position) || first.id.localeCompare(second.id))[0];
  }

  nearbyOffer(resident) {
    if (resident.lastMealAt !== null && this.island.time - resident.lastMealAt < 6000) return null;
    return [...this.portions.values()].find(portion => portion.playerHandled && this.accepts(resident, portion.foodType)
      && (!portion.reservedBy || portion.reservedBy === resident.id || portion.reservedUntil <= this.island.time)
      && Math.abs((portion.depth || 0) - resident.depth) < 18 && distance(portion.body.position, resident.body.position) < 180 && this.clearTarget(resident, portion)
      && (portion.reservedBy === resident.id || this.offeredTo(portion)?.id === resident.id)) || null;
  }

  mouthFor(resident) {
    return { x: resident.body.position.x + resident.direction * resident.width * (resident.species === 'bird' ? 0.5 : 0.32),
      y: resident.body.position.y - resident.height * 0.08 };
  }

  canBite(resident, portion) {
    if (!this.live(portion) || !this.eligible(resident) || !this.accepts(resident, portion.foodType)
      || portion.reservedBy !== resident.id || portion.reservedUntil <= this.island.time || !this.clearTarget(resident, portion)) return false;
    const point = portion.body.position;
    if (Math.abs(portion.depth - resident.depth) > 16) return false;
    if (LAND.has(resident.species) && (point.y < this.island.floorAt(point.x) - 70 || point.y > this.island.floorAt(point.x) + 4)) return false;
    const mouth = this.mouthFor(resident);
    const reach = portion.radius + 20 + (resident.species === 'lizard' && portion.foodType === 'insects' ? 22 : resident.species === 'bird' ? 10 : resident.height * 0.16);
    if (distance(point, mouth) > reach) return false;
    if (Math.hypot(portion.body.velocity.x, portion.body.velocity.y) > 1.15
      || Math.hypot(portion.body.velocity.x - resident.body.velocity.x, portion.body.velocity.y - resident.body.velocity.y) > 1.35) return false;
    for (const drag of this.island.drags.values()) if (drag.body === portion.body
      && distance(drag.target, { x: point.x, y: point.y + portion.depth }) > 30) return false;
    const blockers = [...this.island.terrain, ...this.island.rocks, ...(portion.depth < 18 ? [this.island.tree.body] : []), this.island.dock,
      ...this.island.props.filter(prop => prop !== portion && prop.kind !== 'food' && Math.abs((prop.depth || 0) - portion.depth) < 18).map(prop => prop.body),
      ...(Math.abs(this.island.blob.depth - portion.depth) < 18 ? this.island.blob.particles : [])].filter(Boolean);
    return Query.ray(blockers, mouth, point, 2).length === 0;
  }

  consume(resident, portion) {
    if (!this.canBite(resident, portion) || resident.feedingSince === null || this.island.time - resident.feedingSince < MEAL_DWELL
      || this.island.time - resident.biteAt > 40) return false;
    const { time } = this.island;
    const source = this.patches.find(item => item.id === portion.sourceId);
    const meal = { portionId: portion.portionId, sourceId: source.id, food: portion.foodType, assisted: Boolean(portion.playerHandled), time };
    if (!this.retire(portion, 'eaten')) return false;
    resident.meals += 1; source.visits += 1; resident.lastMeal = meal; resident.lastMealAt = time;
    resident.mealHeartUntil = time + 2000; resident.satisfiedUntil = time + 5000;
    resident.foodAt = time + (16000 + this.wildlife.random() * 20000) * (1.05 - (resident.traits?.greedy || 0) * 0.15);
    this.wildlife.meet('food-found', resident, { id: source.id }); this.wildlife.say(resident);
    this.wildlife.change(resident, 'resting', resident.body.position, 1200, 'meal-heart');
    resident.thoughtUntil = resident.mealHeartUntil; resident.depthTarget = resident.depth;
    return true;
  }

  tick() {
    const { time } = this.island;
    for (const source of this.patches) if (Number.isInteger(source.treeSlot) && this.available(source) && !this.island.tree.fruits[source.treeSlot].attached) {
      this.island.tree.fruits[source.treeSlot] = this.island.tree.grow(source.treeSlot);
    }
    for (const resident of this.wildlife.residents) if (resident.foodId) {
      const source = this.patches.find(item => item.id === resident.foodId);
      if (!this.eligible(resident) || !source || source.reservedBy !== resident.id || source.reservedUntil <= time || resident.forageUntil < time) {
        this.cancel(resident);
        resident.foodAt = Math.max(resident.foodAt, time + 1200);
      }
    }
    for (const portion of this.portions.values()) {
      if (this.wildlife.held(portion.body)) { portion.lostSince = null; continue; }
      if (portion.foodType === 'insects') Body.applyForce(portion.body, portion.body.position, { x: 0, y: -portion.body.mass * this.island.engine.gravity.scale });
      const point = portion.body.position;
      const lost = point.x < 25 || point.x > this.island.width - 25 || point.y < 40 || point.y > this.island.height - 25
        || (FOODS[portion.foodType].medium === 'water' ? point.y < this.island.surfaceAt(point.x) - 25 || this.island.floorAt(point.x) < this.island.layout.water + 40
          : this.island.floorAt(point.x) >= this.island.layout.water - 8);
      portion.lostSince = lost ? portion.lostSince ?? time : null;
      if (time - portion.bornAt > 60000 || portion.lostSince !== null && time - portion.lostSince > 8000) this.retire(portion);
    }
  }

  act(resident) {
    const { time, blob } = this.island;
    if (!this.eligible(resident)) { this.cancel(resident); return false; }
    const blobby = this.island.blobPosition();
    if (this.island.blobHandled && distance(this.wildlife.position(resident), { x: blobby.x, y: blobby.y + blob.depth }) < 185) { this.cancel(resident); return false; }
    let patch = this.patches.find(item => item.id === resident.foodId);
    let portion = this.portions.get(patch?.portionId);
    const offered = this.nearbyOffer(resident);
    if (!patch && !offered && time < resident.foodAt) return false;
    if (!patch && offered) { portion = offered; patch = this.patches.find(item => item.id === offered.sourceId); }
    if (!patch) {
      const candidates = this.patches.filter(item => this.accepts(resident, item.food) && (this.available(item) || this.portions.has(item.portionId))
        && (!item.reservedBy || item.reservedBy === resident.id || item.reservedUntil <= time) && this.clearTarget(resident, this.portions.get(item.portionId) || item))
        .map(item => ({ patch: item, target: this.targetFor(resident, this.portions.get(item.portionId) || item) }))
        .sort((first, second) => distance(this.wildlife.position(resident), { x: first.target.x, y: first.target.y + first.target.depth })
          - distance(this.wildlife.position(resident), { x: second.target.x, y: second.target.y + second.target.depth }));
      patch = candidates[0]?.patch;
      if (!patch) { resident.foodAt = time + 4000; return false; }
      portion = this.portions.get(patch.portionId);
    }
    if (!this.clearTarget(resident, portion || patch) || !this.reserve(resident, portion || patch)) { this.cancel(resident); return false; }
    if (resident.foodId !== patch.id) { this.cancelBite(portion || patch); resident.foodId = patch.id; resident.feedingSince = null; resident.forageUntil = time + 18000; }
    if (time > resident.forageUntil) { this.cancel(resident); resident.foodAt = time + 6000; return false; }
    let target = this.targetFor(resident, portion || patch);
    const close = distance(this.wildlife.position(resident), { x: target.x, y: target.y + target.depth }) < 24;
    if (!portion && close) portion = this.harvest(patch);
    if (portion) {
      if (!this.reserve(resident, portion)) { this.cancel(resident); return false; }
      target = this.targetFor(resident, portion); resident.foodPortionId = portion.portionId;
    }
    const point = this.pointFor(portion || patch);
    resident.direction = Math.sign(point.x - resident.body.position.x) || resident.direction;
    const biting = portion && this.canBite(resident, portion);
    resident.feedingPoint = biting ? { ...point } : null;
    if (biting) resident.lookAt = { ...point };
    this.wildlife.change(resident, biting ? 'feeding' : 'seeking-food', target, 500, patch.food === 'insects' ? 'insect' : ['grass', 'carrot'].includes(patch.food) ? 'grass' : 'food');
    resident.depthTarget = target.depth;
    if (!biting) { resident.feedingSince = null; resident.biteAt = null; return true; }
    if (resident.biteAt !== null && time - resident.biteAt > 40) resident.feedingSince = null;
    resident.feedingSince ??= time;
    resident.biteAt = time;
    this.consume(resident, portion);
    return true;
  }

  touch(point) {
    const patch = this.patches.find(item => distance(point, { x: item.x, y: item.y + item.depth - (item.food === 'grass' ? 10 : 0) }) < 32);
    if (!patch || patch.touchedUntil > this.island.time + 600) return null;
    patch.touchedUntil = this.island.time + 1000; patch.touches = (patch.touches || 0) + 1;
    this.island.queueSound(patch.depth > 0 ? 'rustle' : 'splash', 1, patch.x);
    return patch;
  }

  snapshot() { return this.patches.map(patch => ({ ...patch, available: this.available(patch),
    regrowth: patch.portionId ? 0 : patch.depletedAt === null ? 1 : Math.max(0, Math.min(1, (this.island.time - patch.depletedAt) / (patch.readyAt - patch.depletedAt))),
    harvestPoint: { ...this.pointFor(patch), y: this.pointFor(patch).y + patch.depth } })); }
}

module.exports = { Foraging, DIETS, FOODS, MAX_PORTIONS, MEAL_DWELL };