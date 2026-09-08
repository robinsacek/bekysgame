const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

function advance(island, frames) {
  for (let frame = 0; frame < frames; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true, 'Every simulated body must have finite coordinates');
}

test('jelly falls, collides with sand, and retains its volume', () => {
  const island = new IslandPhysics();
  const initial = island.snapshot();
  advance(island, 240);
  const settled = island.snapshot();
  assert.ok(settled.blob.y > initial.blob.y + 30, 'Gravity must move the blob down');
  assert.ok(settled.blob.y < island.layout.ground, 'The blob must remain above the solid beach');
  assert.ok(settled.blob.area > initial.blob.area * 0.55, 'The soft mesh must not collapse on the ground');
  assert.ok(Math.abs(settled.blob.velocity.y) < 1, 'The blob should settle after a fall');
  island.dispose();
});

test('touch spring lifts the jelly, releases momentum, and survives repeated pulls', () => {
  const island = new IslandPhysics();
  advance(island, 120);
  const origin = island.blobPosition();
  assert.equal(island.grab(1, origin, 15).kind, 'blob');
  for (let frame = 0; frame < 120; frame += 1) {
    island.move(1, { x: origin.x + frame * 2, y: origin.y - 190 });
    island.step();
  }
  assert.ok(island.blobPosition().y < origin.y - 100, 'A touch must lift the whole jelly');
  const beforeRelease = island.blobPosition();
  island.release(1);
  advance(island, 12);
  assert.ok(island.blobPosition().x > beforeRelease.x + 5, 'Release must preserve horizontal momentum');
  for (let trial = 0; trial < 16; trial += 1) {
    island.grab(2, island.blobPosition(), 12);
    island.move(2, { x: trial % 2 ? 120 : 1260, y: 170 });
    advance(island, 90);
    island.release(2);
    advance(island, 120);
  }
  assert.equal(island.drags.size, 0);
  assert.ok(island.snapshot().blob.area > 1000, 'Repeated hard pulls must not invert or destroy the jelly');
  island.dispose();
});

test('multiple fingers can hold and release the blob independently', () => {
  const island = new IslandPhysics();
  const center = island.blobPosition();
  assert.ok(island.grab(11, { x: center.x - 28, y: center.y }, 8));
  assert.ok(island.grab(12, { x: center.x + 28, y: center.y }, 8));
  island.move(11, { x: center.x - 85, y: center.y - 70 });
  island.move(12, { x: center.x + 85, y: center.y - 70 });
  advance(island, 90);
  assert.equal(island.drags.size, 2);
  island.release(11);
  assert.equal(island.drags.size, 1);
  island.releaseAll();
  assert.equal(island.drags.size, 0);
  advance(island, 240);
  assert.ok(island.snapshot().blob.area > 1000, 'A two-finger stretch must recover');
  island.dispose();
});

test('floating toys settle at the water surface instead of sinking or launching', () => {
  const island = new IslandPhysics();
  advance(island, 1200);
  for (const kind of ['ball', 'raft', 'coconut']) {
    const prop = island.props.find(item => item.kind === kind);
    assert.ok(Math.abs(prop.body.position.y - island.layout.water) < 48, `${kind} must float at the surface`);
    assert.ok(Math.abs(prop.body.velocity.y) < 0.8, `${kind} must reach a calm buoyant equilibrium`);
  }
  const offset = { x: island.width * 0.72 - island.blobPosition().x, y: island.layout.water - 90 - island.blobPosition().y };
  for (const particle of island.blob.particles) {
    Body.translate(particle, offset);
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  advance(island, 900);
  assert.ok(Math.abs(island.blobPosition().y - island.layout.water) < 58, 'The jelly must float near the surface');
  assert.ok(island.snapshot().blob.area > 1000, 'Buoyancy must preserve the soft body');
  island.dispose();
});

test('portrait and tablet worlds remain contained during extended simulation', () => {
  for (const width of [416, 675, 1200, 1800]) {
    const island = new IslandPhysics(width, 900);
    advance(island, 1200);
    const state = island.snapshot();
    for (const body of [state.blob, ...state.props]) {
      assert.ok(body.x >= -5 && body.x <= width + 5, `A body must remain inside a ${width}-unit viewport`);
      assert.ok(body.y < 900, 'The floor must contain all bodies');
    }
    island.dispose();
  }
});