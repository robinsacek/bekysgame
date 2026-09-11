const { Body, Composite } = require('matter-js');
const { setBodyDepth } = require('./depth-space.js');

const CONTENTS = ['coin', 'gem', 'coin', 'gold', 'gem', 'coin'];
const VALUES = { coin: 1, gold: 5, gem: 10 };

class TreasureChest {
  constructor(island) {
    this.island = island;
    this.opened = false;
    this.loot = [];
    this.collected = new Set();
    this.prop = island.addProp('chest', Math.min(island.layout.shore - 65, island.spawn.x + 150), island.layout.ground - 23,
      { width: 88, height: 46, mass: 6, density: 2.6, onLand: true, hinged: true, lid: 0 });
    Body.setInertia(this.prop.body, Infinity);
    this.prop.depth = island.expedition ? 96 : 0;
    this.prop.depthTarget = this.prop.depth;
    if (island.expedition) setBodyDepth(this.prop.body, this.prop.depth);
    island.blob.wealth = { coins: 0, gold: 0, gems: 0, total: 0 };
    island.blob.richUntil = 0;
  }

  open() {
    if (this.opened) return false;
    this.opened = true;
    this.openedAt = this.island.time;
    const point = this.prop.body.position;
    this.loot = CONTENTS.map((kind, index) => {
      const dimensions = kind === 'gold' ? { width: 25, height: 14 } : { radius: kind === 'gem' ? 12 : 10 };
      const item = this.island.addProp(kind, point.x + (index - 2.5) * 12, point.y - 30,
        { ...dimensions, mass: kind === 'gold' ? 0.24 : 0.09, density: 2.4, treasureId: index });
      item.depth = this.prop.depth; item.depthTarget = item.depth;
      if (this.island.expedition) setBodyDepth(item.body, item.depth);
      Body.setVelocity(item.body, { x: (index - 2.5) * 1.1, y: -3.2 - index % 3 * 0.4 });
      Body.setAngularVelocity(item.body, (index - 2.5) * 0.06);
      return item;
    });
    this.island.queueSound('chime', 1.4, point.x);
    return true;
  }

  collect(item) {
    if (!this.loot.includes(item) || this.collected.has(item.treasureId) || !this.island.props.includes(item)) return false;
    const center = this.island.blobPosition();
    if (Math.abs(item.depth - this.island.blob.depth) > 24
      || Math.hypot(item.body.position.x - center.x, item.body.position.y - center.y) > 39 + (item.radius || item.width / 2)) return false;
    for (const [pointerId, drag] of this.island.drags) if (drag.body === item.body) this.island.release(pointerId);
    Composite.remove(this.island.engine.world, item.body);
    this.island.props.splice(this.island.props.indexOf(item), 1);
    this.collected.add(item.treasureId);
    const wealth = this.island.blob.wealth;
    wealth[item.kind === 'coin' ? 'coins' : item.kind === 'gem' ? 'gems' : 'gold'] += 1;
    wealth.total += VALUES[item.kind];
    this.island.blob.richUntil = this.island.time + 4200;
    this.island.queueSound('chime', 1, center.x);
    return true;
  }

  step() {
    const center = this.island.blobPosition();
    if (!this.opened && this.island.blobHandled && Math.abs(this.prop.depth - this.island.blob.depth) < 28
      && Math.hypot(center.x - this.prop.body.position.x, center.y - this.prop.body.position.y) < 86) this.open();
    this.prop.lid += ((this.opened ? 1 : 0) - this.prop.lid) * 0.12;
    for (const item of this.loot) this.collect(item);
  }

  snapshot() {
    return { x: this.prop.body.position.x, y: this.prop.body.position.y + this.prop.depth, depth: this.prop.depth,
      opened: this.opened, lid: this.prop.lid, remaining: this.loot.length - this.collected.size,
      wealth: { ...this.island.blob.wealth }, happy: this.island.blob.richUntil > this.island.time };
  }
}

module.exports = { TreasureChest };