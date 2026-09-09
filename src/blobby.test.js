const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');
const { blobbyOutline } = require('./blobby-shape.js');

function advance(island, count) {
  for (let frame = 0; frame < count; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true, 'Blobby must remain numerically stable');
}

function extent(island, axis) {
  const values = island.blob.ring.map(particle => particle.position[axis]);
  return Math.max(...values) - Math.min(...values);
}

test('Blobby starts with the logo silhouette rather than a circular ball', () => {
  const island = new IslandPhysics();
  const center = island.blobPosition();
  const expected = blobbyOutline(center.x, center.y);
  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(Math.hypot(expected[index].x - island.blob.ring[index].position.x, expected[index].y - island.blob.ring[index].position.y) < 0.01);
  }
  const radii = expected.map(point => Math.hypot(point.x - center.x, point.y - center.y));
  assert.ok(Math.max(...radii) / Math.min(...radii) > 1.05, 'The matched logo silhouette must retain its mild asymmetry rather than become a circle');
  island.dispose();
});

test('Blobby supports vertical stretching, squeezing, and three independent grips', () => {
  const island = new IslandPhysics();
  const center = island.blobPosition();
  const initialWidth = extent(island, 'x');
  const initialHeight = extent(island, 'y');
  const top = island.blob.ring.reduce((best, particle) => particle.position.y < best.position.y ? particle : best);
  const bottom = island.blob.ring.reduce((best, particle) => particle.position.y > best.position.y ? particle : best);
  island.grab(1, top.position, 2); island.grab(2, bottom.position, 2);
  island.move(1, { x: center.x, y: center.y - 185 });
  island.move(2, { x: center.x, y: center.y + 45 });
  advance(island, 120);
  assert.ok(extent(island, 'y') > initialHeight * 2, 'Two vertical grips must make a tall elastic Blobby');
  island.releaseAll(); advance(island, 360);
  const settled = island.blobPosition();
  island.grab(3, { x: settled.x - 30, y: settled.y }, 15);
  island.grab(4, { x: settled.x + 30, y: settled.y }, 15);
  island.move(3, { x: settled.x - 14, y: settled.y - 150 });
  island.move(4, { x: settled.x + 14, y: settled.y - 150 });
  advance(island, 70);
  assert.ok(extent(island, 'x') < initialWidth * 1.3, 'Close fingers must squeeze, not inflate the blob');
  const thirdPoint = island.blob.ring.reduce((best, particle) => particle.position.y > best.position.y ? particle : best).position;
  island.grab(5, thirdPoint, 3);
  assert.equal(new Set([...island.drags.values()].map(drag => drag.body.id)).size, 3, 'Three fingers must retain independent material points');
  island.move(3, { x: settled.x - 110, y: settled.y - 200 });
  island.move(4, { x: settled.x + 110, y: settled.y - 170 });
  island.move(5, { x: settled.x + 12, y: settled.y - 20 });
  advance(island, 100);
  assert.ok(extent(island, 'x') > initialWidth * 2, 'Three-finger shaping must be visibly deformable');
  island.releaseAll(); advance(island, 540);
  assert.ok(island.snapshot().blob.area > 1000, 'Blobby must recover volume after varied gestures');
  assert.ok(extent(island, 'x') < initialWidth * 1.8, 'The shape must recover without permanently stretched edges');
  island.dispose();
});