const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');

test('Blobby and loose toys can cross the full foreground beach and be picked at their visible position', () => {
  for (const kind of ['blob', 'shell']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    for (let frame = 0; frame < 90; frame += 1) island.step();
    const item = kind === 'blob' ? island.blob : island.props.find(prop => prop.kind === 'shell');
    const start = kind === 'blob' ? island.blobPosition() : item.body.position;
    const drag = island.grab(73, start, 0);
    assert.equal(drag.kind, kind);
    const target = { x: 440, y: island.layout.ground + 145 };
    island.move(73, target);
    for (let frame = 0; frame < 140; frame += 1) island.step();
    const position = drag.body.position;
    assert.ok(item.depth > 140, 'The body must genuinely move into the foreground, not stay on its old interaction line');
    assert.ok(Math.hypot(position.x - target.x, position.y + item.depth - target.y) < 24, 'The held material point must stay under the pointer');
    island.release(73);
    for (let frame = 0; frame < 90; frame += 1) island.step();
    const settled = kind === 'blob' ? island.blobPosition() : item.body.position;
    const picked = island.grab(74, { x: settled.x, y: settled.y + item.depth }, 0);
    assert.equal(picked.kind, kind, 'Regrabbing must use the foreground drawing position');
    island.move(74, { x: 420, y: island.layout.ground - 125 });
    for (let frame = 0; frame < 150; frame += 1) island.step();
    assert.equal(item.depth, 0, 'Lifting back into the air must return smoothly to the main contact plane');
    assert.equal(island.snapshot().finite, true);
    island.release(74); island.dispose();
  }
});

test('land residents complete long habitat journeys with both horizontal and depth variation', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const residents = island.wildlife.residents.filter(resident => ['crab', 'tortoise', 'lizard'].includes(resident.species));
  const ranges = new Map(residents.map(resident => [resident.id, { minX: Infinity, maxX: -Infinity, minDepth: Infinity, maxDepth: -Infinity }]));
  for (let frame = 0; frame < 7200; frame += 1) {
    island.step();
    for (const resident of residents) {
      const range = ranges.get(resident.id);
      range.minX = Math.min(range.minX, resident.body.position.x); range.maxX = Math.max(range.maxX, resident.body.position.x);
      range.minDepth = Math.min(range.minDepth, resident.depth); range.maxDepth = Math.max(range.maxDepth, resident.depth);
    }
  }
  for (const [id, range] of ranges) {
    assert.ok(range.maxX - range.minX > 280, `${id} must travel across the usable beach rather than circle a single neighbor`);
    assert.ok(range.maxDepth - range.minDepth > 75, `${id} must use a substantial foreground depth range`);
  }
  island.dispose();
});