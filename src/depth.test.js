const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

test('land inhabitants explore a bounded depth band, not only a horizontal line', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const ranges = new Map();
    for (let frame = 0; frame < 1600; frame += 1) {
      island.step();
      for (const resident of island.wildlife.residents.filter(item => ['crab', 'tortoise'].includes(item.species))) {
        const range = ranges.get(resident.id) || { min: Infinity, max: -Infinity };
        range.min = Math.min(range.min, resident.depth); range.max = Math.max(range.max, resident.depth); ranges.set(resident.id, range);
        assert.ok(resident.depth >= 0 && resident.depth <= island.map.ecology.depth + 0.1);
      }
    }
    for (const range of ranges.values()) assert.ok(range.max - range.min > 12, 'Each land resident must visibly move forward and back on the beach');
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
});

test('touch picking and dragging use the animal\'s projected position', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  tortoise.depth = 70; tortoise.depthTarget = 70;
  const projected = island.wildlife.position(tortoise);
  assert.equal(island.grab(19, projected, 0).creature.id, tortoise.id, 'A finger must pick the drawn animal rather than its invisible contact-plane location');
  const destination = { x: projected.x + 60, y: island.layout.ground + 65 };
  island.move(19, destination);
  for (let frame = 0; frame < 120; frame += 1) island.step();
  const moved = island.wildlife.position(tortoise);
  assert.ok(Math.abs(moved.x - destination.x) < 12);
  assert.ok(Math.abs(moved.y - destination.y) < 18, 'The dragged foreground animal must remain under the touch');
  island.release(19);
  for (let frame = 0; frame < 300; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true);
  island.dispose();
});

test('a neighbor greeting cannot interrupt the tortoise approaching delivered food', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const food = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(food.body, { x: 736, y: island.layout.ground - food.radius });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  const lizard = island.wildlife.residents.find(resident => resident.species === 'lizard');
  const crab = island.wildlife.residents.find(resident => resident.species === 'crab');
  Body.setPosition(crab.body, { x: 930, y: island.layout.ground - crab.height / 2 });
  Body.setPosition(tortoise.body, { x: 686, y: island.layout.ground - tortoise.height * 0.41 });
  Body.setPosition(lizard.body, { x: 682, y: island.layout.ground - lizard.height * 0.41 });
  tortoise.depth = 53; lizard.depth = 55;
  tortoise.socialAt = -10000; lizard.socialAt = -10000;
  island.wildlife.change(tortoise, 'foraging', { x: 786, y: tortoise.body.position.y }, 1800, 'coconut');
  island.wildlife.decideGround(lizard);
  assert.equal(tortoise.state, 'foraging', 'A social neighbor must not overwrite an active food approach');
  island.dispose();
});

test('maps have distinct movement, current, caution and land-depth profiles', () => {
  const { MAPS } = require('./maps.js');
  assert.ok(MAPS[1].ecology.current > MAPS[0].ecology.current);
  assert.ok(MAPS[1].ecology.caution > MAPS[0].ecology.caution);
  assert.ok(MAPS[2].ecology.rest > MAPS[0].ecology.rest);
  assert.ok(MAPS[2].ecology.depth > MAPS[1].ecology.depth);
  const speedByMap = MAPS.map(map => {
    const island = new IslandPhysics(3200, 900, map.id, true);
    const speed = island.wildlife.residents[0].speed;
    island.dispose(); return speed;
  });
  assert.equal(new Set(speedByMap).size, 3, 'Profiles must affect actual resident movement speeds');
});

test('the tortoise uses beach depth to detour around a toy and reach a picnic', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const food = island.props.find(prop => prop.kind === 'coconut');
  const crate = island.props.find(prop => prop.kind === 'crate');
  Body.setPosition(food.body, { x: 704, y: island.layout.ground - food.radius - 1 });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  Body.setPosition(crate.body, { x: 774, y: island.layout.ground - crate.height / 2 });
  const tortoise = island.wildlife.residents.find(item => item.species === 'tortoise');
  let detoured = false;
  for (let frame = 0; frame < 1700; frame += 1) {
    island.step();
    if (tortoise.detourUntil > island.time && tortoise.depth > 18) detoured = true;
  }
  assert.equal(detoured, true, 'A blocking prop should prompt a visible foreground detour');
  assert.equal(island.objectives.entries[2].complete, true, 'The detour must lead back to a real picnic interaction');
  assert.equal(island.snapshot().finite, true);
  island.dispose();
});

test('the tortoise can step around Blobby after low contact and reach delivered food', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const food = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(food.body, { x: 704, y: island.layout.ground - food.radius });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  const center = island.blobPosition();
  for (const particle of island.blob.particles) {
    Body.translate(particle, { x: 523 - center.x, y: 425 - center.y });
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  Body.setPosition(tortoise.body, { x: 523, y: 441 });
  Body.setVelocity(tortoise.body, { x: 0, y: 0 });
  let detoured = false;
  for (let frame = 0; frame < 1700; frame += 1) {
    island.step();
    detoured ||= tortoise.detourUntil > island.time && tortoise.depth > 18;
  }
  assert.equal(detoured, true, 'A low collision with Blobby must allow a foreground detour');
  assert.equal(island.objectives.entries[2].complete, true, 'The detour must finish in an actual picnic, not another stalled approach');
  island.dispose();
});