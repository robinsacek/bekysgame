const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Vector } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

test('each map has its own habitat, cast variants, local pair and physical discoveries', () => {
  const cast = new Set();
  const features = new Set();
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const residents = island.wildlife.residents;
    assert.equal(residents.length, 10);
    const local = island.map.resident;
    assert.equal(residents.filter(resident => resident.species === local.species).length, 2, 'Each area needs a local pair with mutual interactions');
    cast.add(residents.map(resident => `${resident.name}:${resident.appearance}:${resident.width}`).join(','));
    features.add(island.map.feature);
    for (const kind of island.map.interests) assert.ok(island.props.some(prop => prop.kind === kind), `${map} must contain its characteristic ${kind}`);
    if (map === 'pools') {
      assert.equal(island.rocks.length, 0, 'Tide Pools must not contain the removed concrete-like block colliders');
      assert.equal(island.map.coast.bank, 'terraced', 'The usable rocky shallows remain part of the shoreline');
    }
    island.dispose();
  }
  assert.equal(cast.size, 3); assert.equal(features.size, 3);
});

test('lagoon buoy remains tethered and sunset chimes swing as separate physical objects', () => {
  for (const map of ['lagoon', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const prop = island.props.find(item => item.kind === (map === 'lagoon' ? 'buoy' : 'bell'));
    const start = { ...prop.body.position };
    const rope = prop.ropes[0];
    prop.playerHandled = true;
    Body.setVelocity(prop.body, { x: 5, y: -1 });
    let travel = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      island.step(); travel = Math.max(travel, Vector.magnitude(Vector.sub(prop.body.position, start)));
      const end = Vector.add(prop.body.position, Vector.rotate(rope.pointB, prop.body.angle));
      assert.ok(Vector.magnitude(Vector.sub(end, rope.pointA)) < rope.length + 35, 'The physical attachment must remain connected');
    }
    assert.ok(travel > 18, 'The unique feature must move under physical input');
    if (map === 'sunset') assert.ok(island.sounds.some(sound => sound.kind === 'chime'), 'A handled moving chime must produce audible feedback');
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
});

test('maps have distinct physical land-sea distributions and tide-pool terraces', () => {
  const measures = {};
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const { shore, toe, farToe, farShore, waterStart, waterEnd } = island.layout;
    measures[map] = { shore, seaWidth: waterEnd - waterStart, dryWidth: island.width - waterEnd + waterStart, basinWidth: farToe - toe };
    assert.equal(shore, island.width * island.map.coast.shore);
    assert.equal(farShore, island.width * island.map.coast.farShore);
    assert.ok(Math.abs(island.floorAt(waterStart) - island.layout.water) < 0.01);
    assert.ok(Math.abs(island.floorAt(waterEnd) - island.layout.water) < 0.01);
    assert.ok(island.landmarks.nook.x - island.landmarks.picnic.x >= 150, 'Objective landmarks must retain distinct usable spaces');
    if (map === 'pools') {
      const first = island.floorAt(shore + (toe - shore) * 0.20);
      const last = island.floorAt(shore + (toe - shore) * 0.34);
      assert.ok(last - first < 4, 'The pool bank must contain an actual broad shallow terrace');
    }
    island.dispose();
  }
  assert.ok(measures.lagoon.seaWidth > measures.pools.seaWidth + 200, 'Lagoon must have substantially more open water');
  assert.ok(measures.pools.seaWidth > measures.sunset.seaWidth + 90, 'Sunset must have a smaller cove than Tide Pools');
  assert.ok(measures.sunset.shore > measures.lagoon.shore + 300, 'The dune beach must be visibly broader');
  assert.ok(measures.sunset.dryWidth > measures.lagoon.dryWidth + 350, 'The visible dry-land proportions must differ, not only the colors');
});