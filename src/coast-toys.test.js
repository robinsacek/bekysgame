const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Vector, Query, Composite } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

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