const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Vector, Query, Composite } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

test('every map has an openable chest with one bounded pile of coins, gold and gems', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const chest = island.treasure;
    assert.equal(island.props.filter(prop => prop.kind === 'chest').length, 1);
    assert.equal(chest.opened, false);
    assert.equal(island.grab(91, { x: chest.prop.body.position.x, y: chest.prop.body.position.y + chest.prop.depth })?.kind, 'chest');
    island.release(91);
    assert.equal(chest.opened, true);
    assert.equal(chest.loot.length, 6);
    assert.deepEqual(new Set(chest.loot.map(item => item.kind)), new Set(['coin', 'gold', 'gem']));
    assert.equal(chest.open(), false);
    assert.equal(chest.loot.length, 6);
    for (let frame = 0; frame < 100; frame += 1) island.step();
    assert.ok(chest.prop.lid > 0.99);
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
});

test('Blobby collects real treasure once, gets rich and leaves unrelated grips alone', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const chest = island.treasure;
  chest.open();
  const center = island.blobPosition();
  const other = island.props.find(prop => prop.kind === 'ball');
  assert.equal(island.grab(92, other.body.position)?.prop, other);
  const otherConstraint = island.drags.get(92).constraint;
  const first = chest.loot[0];
  Body.setPosition(first.body, center);
  assert.equal(chest.collect(first), false, 'Treasure in another depth lane must not be collected');
  Body.setPosition(first.body, { x: center.x + 100, y: center.y });
  first.depth = 0; first.depthTarget = 0;
  assert.equal(island.grab(93, first.body.position)?.prop, first);
  Body.setPosition(first.body, center);
  assert.equal(chest.collect(first), true);
  assert.equal(island.drags.has(93), false);
  assert.equal(island.drags.get(92).constraint, otherConstraint);
  assert.equal(Composite.allBodies(island.engine.world).includes(first.body), false);
  assert.equal(chest.collect(first), false);
  for (const item of chest.loot.slice(1)) {
    item.depth = island.blob.depth;
    Body.setPosition(item.body, center);
    chest.step();
  }
  assert.deepEqual(island.blob.wealth, { coins: 3, gold: 1, gems: 2, total: 28 });
  assert.equal(chest.snapshot().remaining, 0);
  assert.equal(chest.snapshot().happy, true);
  assert.equal(chest.open(), false);
  island.time = island.blob.richUntil + 1;
  assert.equal(chest.snapshot().happy, false);
  assert.equal(chest.snapshot().wealth.total, 28);
  island.dispose();
});

test('bringing Blobby to the chest opens it while new maps start with their own treasure', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const center = island.blobPosition();
  const target = island.treasure.prop.body.position;
  for (const particle of island.blob.particles) Body.translate(particle, { x: target.x - center.x + 58, y: target.y - center.y });
  island.blob.depth = island.treasure.prop.depth;
  island.blobHandled = true;
  island.treasure.step();
  assert.equal(island.treasure.opened, true);
  const fresh = new IslandPhysics(3200, 900, 'sunset', true);
  assert.equal(fresh.treasure.opened, false);
  assert.equal(fresh.blob.wealth.total, 0);
  fresh.dispose(); island.dispose();
});

test('the suspended leaf swing moves under a drag but stays on both ropes', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const swing = island.props.find(prop => prop.kind === 'swing');
  const origin = { ...swing.body.position };
  assert.equal(island.grab(85, swing.body.position, 0).kind, 'swing');
  island.move(85, { x: origin.x + 120, y: origin.y - 65 });
  for (let frame = 0; frame < 120; frame += 1) island.step();
  assert.ok(swing.body.position.x > origin.x + 35, 'Dragging must swing the actual seat');
  island.release(85);
  for (let frame = 0; frame < 600; frame += 1) island.step();
  for (const rope of swing.ropes) {
    const point = Vector.add(swing.body.position, rope.pointB);
    assert.ok(Math.abs(Vector.magnitude(Vector.sub(point, rope.pointA)) - rope.length) < 6, 'Both swing ropes must remain anchored');
  }
  assert.equal(island.snapshot().finite, true);
  assert.equal(Query.point([island.dock], island.dock.position).length, 1, 'The dock must be a physical landing surface');
  island.dispose();
});

test('fast shallow throws skip stones while slow drops sink without endless sound', () => {
  for (const fast of [false, true]) {
    const island = new IslandPhysics(3200, 900, 'lagoon');
    for (const prop of island.props) Composite.remove(island.engine.world, prop.body);
    island.props.length = 0;
    const stone = island.addProp('stone', 2100, island.layout.water - 36, { radius: 12, mass: 0.5, density: 2.2 });
    Body.setVelocity(stone.body, { x: fast ? 11 : 0, y: 1 });
    stone.playerHandled = true;
    for (let frame = 0; frame < 160; frame += 1) island.step();
    assert.equal((stone.skips || 0) > 0, fast, 'Skipping requires lateral speed, not any contact with the water');
    for (let frame = 0; frame < 1000; frame += 1) island.step();
    assert.ok(stone.body.position.y > island.layout.water + 55, 'Every stone must eventually lose energy and sink');
    const skips = stone.skips || 0;
    for (let frame = 0; frame < 600; frame += 1) island.step();
    assert.equal(stone.skips || 0, skips, 'A settled stone must not keep generating skip impulses');
    island.dispose();
  }
});