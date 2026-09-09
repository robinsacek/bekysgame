const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');
const { projectShadow } = require('./shadows.js');

test('shadows follow the body, beach depth, height and the correct contact surface', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const body = { x: 620, y: island.layout.ground - 20, width: 50, height: 40 };
  const resting = projectShadow(island, body);
  const foreground = projectShadow(island, { ...body, x: 750, depth: 75 });
  assert.ok(Math.abs(foreground.x - resting.x - 130) < 1);
  assert.ok(Math.abs(foreground.y - resting.y - 75) < 1, 'A depth-moving character must not leave its shadow on the original horizon');
  const lifted = projectShadow(island, { ...body, y: body.y - 150 });
  assert.ok(lifted.x > resting.x && lifted.alpha < resting.alpha && lifted.radiusY > resting.radiusY, 'A raised body must cast a softer displaced shadow');
  const floating = projectShadow(island, { x: island.landmarks.reef.x, y: island.layout.water - 6, width: 90, height: 20, floating: true });
  assert.ok(Math.abs(floating.y - island.layout.water) < 5, 'Floating toys must contact the water, not cast a detached seabed stripe');
  island.dispose();
});