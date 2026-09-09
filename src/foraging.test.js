const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { DIETS } = require('./foraging.js');

test('each non-predator can approach its own food and complete a replenishing meal', () => {
  for (const species of Object.keys(DIETS).filter(species => species !== 'shark')) {
    const map = species === 'starfish' ? 'pools' : species === 'rabbit' ? 'sunset' : 'lagoon';
    const island = new IslandPhysics(3200, 900, map, true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const patch = island.wildlife.foraging.patches.find(item => item.food === resident.diet.food);
    const target = island.wildlife.foraging.targetFor(resident, patch);
    Body.setPosition(resident.body, { x: target.x, y: target.y }); Body.setVelocity(resident.body, { x: 0, y: 0 });
    resident.depth = target.depth; resident.depthTarget = target.depth; resident.foodAt = 0; resident.until = 0;
    for (let frame = 0; frame < 220; frame += 1) island.step();
    assert.ok(resident.meals >= 1, `${species} must actually feed using its production routine`);
    assert.ok(patch.visits >= 1 && patch.readyAt > island.time, 'An eaten patch must briefly replenish instead of yielding food every frame');
    assert.ok(island.wildlife.encounterCounts['food-found'] > 0);
    assert.equal(island.wildlife.residents.length, 10, 'Feeding must not consume named residents');
    island.dispose();
  }
});

test('holding and a delivered picnic take priority over ordinary foraging', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const fish = island.wildlife.residents[0]; fish.foodAt = 0;
  island.grab(41, fish.body.position, 0);
  assert.equal(island.wildlife.foraging.act(fish), false);
  island.release(41);
  const food = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(food.body, { x: island.landmarks.picnic.x, y: island.layout.ground - food.radius });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  for (const resident of island.wildlife.residents.filter(item => ['bird', 'tortoise'].includes(item.species))) {
    resident.foodAt = 0;
    assert.equal(island.wildlife.foraging.act(resident), false, 'The journal picnic must retain priority over background feeding');
  }
  const grass = island.wildlife.foraging.patches.filter(patch => patch.food === 'grass');
  assert.ok(grass.length >= 15 && new Set(grass.map(patch => patch.depth)).size > 4, 'Grass patches must cover the usable beach depth');
  const point = { x: grass[0].x, y: grass[0].y + grass[0].depth - 10 };
  assert.equal(island.wildlife.foraging.touch(point).id, grass[0].id, 'Grass must react at its actual visible depth');
  assert.ok(grass[0].touchedUntil > island.time);
  assert.ok(island.sounds.some(sound => sound.kind === 'rustle'));
  island.dispose();
});