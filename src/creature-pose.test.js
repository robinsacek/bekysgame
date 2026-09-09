const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { drawingSize, applyCreaturePose, feedingPose } = require('./creature-pose.js');

test('eating mouths cycle smoothly by species only during a live production bite', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    for (const resident of island.wildlife.residents) {
      Object.assign(resident, { state: 'feeding', feedingSince: 0, biteAt: 0, frown: false, recovery: '', held: false });
      const openings = [];
      for (let time = 0; time < 1500; time += 16) {
        resident.biteAt = time;
        const pose = feedingPose(resident, time);
        assert.equal(pose.eating, true);
        assert.ok(pose.open >= 0 && pose.open <= 1);
        openings.push(pose.open);
      }
      assert.ok(Math.max(...openings) > 0.9, `${resident.species} opens its mouth`);
      assert.ok(openings.slice(12).some(value => value < 0.08), `${resident.species} closes between bites`);
      assert.ok(openings.slice(1).every((value, index) => Math.abs(value - openings[index]) < 0.34), `${resident.species} moves smoothly`);
      for (const priority of [{ held: true }, { frown: true }, { recovery: 'returning' }, { state: 'fleeing' }]) {
        const pose = feedingPose({ ...resident, ...priority }, 1500);
        assert.equal(pose.eating, false);
        assert.equal(pose.open, 0);
      }
      assert.equal(feedingPose(resident, 1800).eating, false, 'A cancelled or stale bite must not keep chewing');
    }
    island.dispose();
  }
});

test('satisfaction and larger hearts expire in active time and yield immediately to distress and objective expressions', () => {
  const resident = { species: 'rabbit', state: 'resting', lastMealAt: 1000, mealHeartUntil: 3000, satisfiedUntil: 6000 };
  assert.deepEqual(feedingPose(resident, 1500), feedingPose(resident, 1500), 'A frozen clock freezes the expression');
  assert.equal(feedingPose(resident, 1500).heart, true);
  assert.equal(feedingPose(resident, 3200).heart, false);
  assert.ok(feedingPose(resident, 5500).smile > 0);
  assert.equal(feedingPose(resident, 6000).smile, 0);
  for (const priority of [{ held: true }, { frown: true }, { recovery: 'paddling' }, { state: 'fleeing' }, { state: 'snacking' }]) {
    assert.equal(feedingPose({ ...resident, ...priority }, 1500).heart, false);
    assert.equal(feedingPose({ ...resident, ...priority }, 1500).smile, 0);
  }
});

test('relative character sizes have matching art, physics and expression transforms', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const residents = island.wildlife.residents;
    const shark = residents.find(resident => resident.species === 'shark');
    const tortoise = residents.find(resident => resident.species === 'tortoise');
    assert.ok(shark.width > tortoise.width * 2, 'The shark must be clearly larger than the land cast');
    assert.ok(residents.filter(resident => resident.species === 'fish').every(fish => fish.width < tortoise.width / 2));
    for (const resident of residents) {
      const scales = [];
      applyCreaturePose({ translate() {}, rotate() {}, scale: (horizontal, vertical) => scales.push([horizontal, vertical]) }, resident, 0);
      const [width, height] = drawingSize(resident);
      assert.ok(Math.abs(scales[0][0] * width - resident.width) < 0.01, 'Drawing width must match the physical character size');
      assert.ok(Math.abs(scales[0][1] * height - resident.height) < 0.01, 'Drawing height must match the physical character size');
      assert.ok(Math.abs(resident.body.bounds.max.x - resident.body.bounds.min.x - resident.width * 0.82) < 1);
    }
    island.dispose();
  }
});

test('overlapping residents are picked in their visible drawing order', () => {
  const island = new IslandPhysics(3200, 900, 'sunset', true);
  const rabbit = island.wildlife.residents.find(resident => resident.species === 'rabbit');
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  const point = { x: 1050, y: 430 };
  Body.setPosition(rabbit.body, point); Body.setPosition(tortoise.body, point);
  assert.equal(island.grab(29, point, 0).creature.id, rabbit.id, 'The last drawn resident must win at equal depth');
  island.release(29);
  tortoise.depth = 60;
  Body.setPosition(tortoise.body, { x: point.x, y: point.y - tortoise.depth });
  assert.equal(island.grab(29, point, 0).creature.id, tortoise.id, 'Foreground depth must still take precedence');
  island.dispose();
});