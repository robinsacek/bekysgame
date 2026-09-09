const test = require('node:test');
const assert = require('node:assert/strict');
const { CoastCamera } = require('./camera.js');

test('camera scrolls beyond a screen but cannot leave either end of the world', () => {
  const camera = new CoastCamera(3200, 1000);
  for (let frame = 0; frame < 300; frame += 1) camera.step(2700, 1000 / 60);
  assert.ok(camera.x > 1700, 'Following the jelly must reveal previously off-screen world');
  camera.pan(10000);
  assert.equal(camera.x, 2200);
  camera.pan(-10000);
  assert.equal(camera.x, 0);
  camera.find(5000);
  assert.equal(camera.x, 2200);
  camera.resize(4000);
  assert.equal(camera.x, 0, 'A viewport wider than the world must have no negative scroll range');
});

test('camera coordinates round trip at arbitrary offsets and portrait sizes', () => {
  for (const bounds of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    const camera = new CoastCamera(3200, 900 * bounds.width / bounds.height);
    camera.seek(2000);
    const point = { x: bounds.width * 0.71, y: bounds.height * 0.64 };
    const world = camera.toWorld(point, bounds);
    const screen = camera.toScreen(world, bounds);
    assert.ok(Math.abs(screen.x - point.x) < 1e-9);
    assert.ok(Math.abs(screen.y - point.y) < 1e-9);
    assert.ok(world.x > camera.x, 'A touch must include the current camera offset');
  }
});

test('edge scrolling reprojects a stationary finger without fighting opposing grips', () => {
  const camera = new CoastCamera(3200, 900);
  const bounds = { width: 900, height: 900 };
  const finger = { x: 880, y: 420 };
  const before = camera.toWorld(finger, bounds);
  camera.step(600, 1000 / 60, [0.98]);
  const after = camera.toWorld(finger, bounds);
  assert.ok(after.x > before.x, 'An edge-held object target must advance into the next part of the world');
  assert.equal(after.y, before.y);
  const offset = camera.x;
  camera.step(600, 1000 / 60, [0.02, 0.98]);
  assert.equal(camera.x, offset, 'Opposite-edge fingers must not pull the camera back and forth');
  camera.pan(100);
  const manual = camera.x;
  camera.step(2800, 1000 / 60);
  assert.equal(camera.x, manual, 'Manual browsing must not immediately snap back');
  camera.find(1200);
  assert.equal(camera.follow, true);
});