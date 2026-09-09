const { Bounds } = require('matter-js');

const DIETS = {
  fish: { food: 'plankton', routine: 'nibbling' }, jellyfish: { food: 'plankton', routine: 'filter-feeding' },
  crab: { food: 'shore-scraps', routine: 'sifting' }, tortoise: { food: 'grass', routine: 'grazing' },
  rabbit: { food: 'grass', routine: 'grazing' }, bird: { food: 'insects', routine: 'pecking' },
  lizard: { food: 'insects', routine: 'insect-hunting' }, starfish: { food: 'algae', routine: 'reef-grazing' },
  octopus: { food: 'shell-bed', routine: 'probing' }, shark: { food: null, routine: 'patrolling-prey' },
};
const LAND = new Set(['crab', 'tortoise', 'rabbit', 'lizard']);
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

class Foraging {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.island = wildlife.island;
    this.patches = [];
    const { layout, width, map } = this.island;
    const patch = (food, positionX, positionY, depth = 0) => this.patches.push({ id: `food-${this.patches.length}`, food, x: positionX, y: positionY, depth, readyAt: 0, visits: 0 });
    for (let index = 0; index < 15; index += 1) {
      const positionX = index < 12 ? 115 + index / 11 * (layout.shore - 210) : layout.farShore + 45 + (index - 12) / 2 * (width - layout.farShore - 100);
      const floor = this.island.floorAt(positionX);
      const depth = 42 + (index * 71 % Math.max(60, map.ecology.depth - 60));
      patch('grass', positionX, floor, depth);
      if (index % 3 === 0) patch('insects', positionX + 16, floor - 45, depth);
      if (index % 4 === 0) patch('shore-scraps', positionX + 28, floor, 35);
    }
    for (let index = 0; index < 8; index += 1) {
      const positionX = wildlife.water.minX + 60 + index / 7 * (wildlife.water.maxX - wildlife.water.minX - 120);
      patch('plankton', positionX, layout.water + 72 + index % 3 * 65);
      patch('algae', positionX - 16, this.island.floorAt(positionX - 16));
      patch('shell-bed', positionX + 20, this.island.floorAt(positionX + 20));
    }
    for (const resident of wildlife.residents) Object.assign(resident, {
      diet: DIETS[resident.species], foodAt: 18000 + wildlife.random() * 14000, foodId: null, feedingSince: null, forageUntil: 0, meals: 0,
    });
  }

  targetFor(resident, patch) {
    const floor = this.island.floorAt(patch.x);
    const positionY = LAND.has(resident.species) ? floor - resident.height * 0.41 : resident.species === 'bird' ? floor - 62
      : patch.food === 'plankton' ? patch.y : floor - resident.height * 0.5 - 8;
    return { x: patch.x, y: positionY, depth: LAND.has(resident.species) ? patch.depth : 0 };
  }

  clearTarget(resident, patch) {
    if (resident.species !== 'bird') return true;
    const target = this.targetFor(resident, patch);
    const bounds = { min: { x: target.x - resident.width * 0.5, y: target.y - resident.height * 0.5 },
      max: { x: target.x + resident.width * 0.5, y: target.y + resident.height * 0.5 } };
    const blockers = [...this.island.props.filter(prop => (prop.depth || 0) < 25).map(prop => prop.body), ...(this.island.blob.depth < 25 ? this.island.blob.particles : [])];
    return !blockers.some(body => Bounds.overlaps(bounds, body.bounds));
  }

  act(resident) {
    const { time, blob } = this.island;
    if (!resident.diet.food || this.wildlife.held(resident.body) || resident.recovery || !this.wildlife.inHabitat(resident)) return false;
    if (['bird', 'tortoise'].includes(resident.species) && this.wildlife.picnicFood()) { resident.foodId = null; resident.feedingSince = null; return false; }
    if (resident.species === 'bird' && resident.state === 'perching' && resident.until > time) return false;
    const blobby = this.island.blobPosition();
    if (this.island.blobHandled && distance(this.wildlife.position(resident), { x: blobby.x, y: blobby.y + blob.depth }) < 185) { resident.foodId = null; resident.feedingSince = null; return false; }
    if (['startled', 'fleeing', 'toy-play', 'inspecting', 'foraging', 'snacking'].includes(resident.state) && resident.until > time) return false;
    if (time < resident.foodAt) return false;
    let patch = this.patches.find(item => item.id === resident.foodId && item.readyAt <= time && this.clearTarget(resident, item));
    if (!patch) {
      const candidates = this.patches.filter(item => item.food === resident.diet.food && item.readyAt <= time && this.clearTarget(resident, item))
        .map(item => ({ patch: item, target: this.targetFor(resident, item) }))
        .filter(item => !LAND.has(resident.species) || Math.abs(this.island.floorAt(item.patch.x) - this.wildlife.groundHabitat(resident).maxY) < 20)
        .sort((first, second) => distance(this.wildlife.position(resident), { x: first.target.x, y: first.target.y + first.target.depth })
          - distance(this.wildlife.position(resident), { x: second.target.x, y: second.target.y + second.target.depth }));
      patch = candidates[0]?.patch;
      if (!patch) { resident.foodAt = time + 4000; return false; }
      resident.foodId = patch.id; resident.feedingSince = null; resident.forageUntil = time + 18000;
    }
    if (time > resident.forageUntil) { resident.foodId = null; resident.feedingSince = null; resident.foodAt = time + 6000; return false; }
    const target = this.targetFor(resident, patch);
    const close = distance(this.wildlife.position(resident), { x: target.x, y: target.y + target.depth }) < 24;
    this.wildlife.change(resident, close ? 'feeding' : 'seeking-food', target, 500, patch.food === 'insects' ? 'insect' : patch.food === 'grass' ? 'grass' : 'food');
    resident.depthTarget = target.depth;
    if (!close) { resident.feedingSince = null; return true; }
    resident.feedingSince ??= time;
    if (time - resident.feedingSince >= 1500) {
      resident.meals += 1; patch.visits += 1; patch.readyAt = time + 16000 + this.wildlife.random() * 16000;
      resident.foodAt = time + (16000 + this.wildlife.random() * 20000) * (1.05 - (resident.traits?.greedy || 0) * 0.15); resident.foodId = null; resident.feedingSince = null;
      this.wildlife.meet('food-found', resident, { id: patch.id }); this.wildlife.say(resident);
      if (resident.species === 'bird') {
        const crown = this.island.tree.crown();
        const perch = { x: crown.x + 20, y: crown.y - 24 };
        this.wildlife.change(resident, 'perching', perch, distance(resident.body.position, perch) / resident.speed * 24 + 2400, 'rest');
      } else this.wildlife.change(resident, 'resting', resident.body.position, 1200, 'heart');
      resident.depthTarget = resident.depth;
    }
    return true;
  }

  touch(point) {
    const patch = this.patches.find(item => distance(point, { x: item.x, y: item.y + item.depth - (item.food === 'grass' ? 10 : 0) }) < 32);
    if (!patch || patch.touchedUntil > this.island.time + 600) return null;
    patch.touchedUntil = this.island.time + 1000; patch.touches = (patch.touches || 0) + 1;
    this.island.queueSound(patch.depth > 0 ? 'rustle' : 'splash', 1, patch.x);
    return patch;
  }

  snapshot() { return this.patches.map(patch => ({ ...patch, available: patch.readyAt <= this.island.time })); }
}

module.exports = { Foraging, DIETS };