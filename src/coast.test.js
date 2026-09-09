const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Query } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { WORLD_WIDTH, WORLD_HEIGHT } = require('./camera.js');

test('each expedition has a real far shore, local landmarks, and bounded props', () => {
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(WORLD_WIDTH, WORLD_HEIGHT, mapId, true);
    assert.equal(island.width, 3200);
    assert.equal(island.spawn.x, 520);
    assert.ok(island.wildlife.water.maxX - island.wildlife.water.minX > 900, 'Marine residents must have a broad swimming habitat');
    assert.ok(island.layout.bottom - island.layout.water > 330, 'The sea must have a substantially deeper playable water column');
    assert.ok(island.landmarks.far.x > 2800, 'The destination must be outside the first screen');
    assert.ok(island.floorAt(island.landmarks.far.x) < island.layout.bottom - 100, 'The far shore must rise above the sea floor');
    assert.equal(island.props.filter(prop => prop.expeditionId?.startsWith('shell-')).length, 2);
    const blob = island.blobPosition();
    for (const particle of island.blob.particles) {
      Body.translate(particle, { x: island.landmarks.far.x - blob.x, y: island.landmarks.far.y - 100 - blob.y });
      Body.setVelocity(particle, { x: 0, y: 0 });
    }
    for (let frame = 0; frame < 900; frame += 1) island.step();
    const result = island.snapshot();
    assert.equal(result.finite, true);
    assert.ok(result.blob.y < island.landmarks.far.y, 'The far beach must physically support the jelly');
    assert.ok(result.blob.area > 1000);
    for (const prop of island.props) assert.ok(prop.body.position.x > -10 && prop.body.position.x < island.width + 10, 'Toys must remain inside the bounded coast');
    island.dispose();
  }
});

test('player handling is attributed to the actual prop without changing its identity', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const shell = island.props.find(prop => prop.expeditionId === 'shell-one');
  const untouched = island.props.find(prop => prop.expeditionId === 'shell-two');
  const identity = shell.body.id;
  island.grab(51, shell.body.position, 0);
  assert.equal(shell.playerHandled, true);
  assert.equal(Boolean(untouched.playerHandled), false, 'Unrelated props cannot earn player attribution');
  island.release(51);
  assert.equal(shell.body.id, identity);
  island.dispose();
});

test('curved shoreline geometry agrees with the visible floor and water crossings', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  assert.equal(island.bankSegments.length, 48);
  assert.ok(Math.abs(island.floorAt(island.layout.waterStart) - island.layout.water) < 0.01);
  assert.ok(Math.abs(island.floorAt(island.layout.waterEnd) - island.layout.water) < 0.01);
  const quarterX = island.layout.shore + (island.layout.toe - island.layout.shore) / 4;
  const straightY = island.layout.ground + (island.layout.bottom - island.layout.ground) / 4;
  assert.ok(Math.abs(island.floorAt(quarterX) - straightY) > 15, 'The natural bank must not remain the original straight diagonal');
  for (const portion of [0.15, 0.35, 0.55, 0.75, 0.92]) {
    const positionX = island.layout.shore + (island.layout.toe - island.layout.shore) * portion;
    const floor = island.floorAt(positionX);
    assert.ok(Query.point(island.bankSegments, { x: positionX, y: floor + 4 }).length > 0, 'The physical bank must exist just below the rendered surface');
    assert.equal(Query.point(island.bankSegments, { x: positionX, y: floor - 4 }).length, 0, 'The physical bank must not protrude above the visible surface');
  }
  island.dispose();
});

test('a direct object hit wins over a neighbor\'s enlarged touch padding', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const shell = island.props.find(prop => prop.expeditionId === 'shell-one');
  const swing = island.props.find(prop => prop.kind === 'swing');
  Body.setPosition(shell.body, { x: 610, y: 420 });
  Body.setPosition(swing.body, { x: 610, y: 389 });
  assert.equal(island.grab(99, shell.body.position, 30).body.id, shell.body.id, 'Touch padding must not steal a clear hit on the visible shell');
  island.dispose();
});

test('uneven seabeds match collision geometry and support sinking toys on each map', () => {
  const profiles = new Set();
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const points = island.layout.seabed;
    const elevations = points.map(point => point.y);
    profiles.add(elevations.map(value => Math.round(value)).join(','));
    assert.ok(Math.max(...elevations) - Math.min(...elevations) > 20, 'The deep seabed must have real visible relief, not a flat strip');
    assert.equal(points[0].y, island.layout.bottom);
    assert.equal(points.at(-1).y, island.layout.bottom);
    for (let index = 2; index < points.length - 2; index += 3) {
      const positionX = (points[index].x + points[index + 1].x) / 2;
      const floor = island.floorAt(positionX);
      assert.ok(Query.point(island.seabedSegments, { x: positionX, y: floor + 2 }).length > 0, 'The raised sand must physically support objects');
      assert.equal(Query.point(island.seabedSegments, { x: positionX, y: floor - 2 }).length, 0, 'Physical ridges must not protrude beyond the drawn profile');
    }
    const stone = island.props.find(prop => prop.kind === 'stone');
    Body.setPosition(stone.body, { x: points[26].x, y: points[26].y - 70 });
    Body.setVelocity(stone.body, { x: 0, y: 0 });
    for (let frame = 0; frame < 600; frame += 1) island.step();
    assert.ok(Math.abs(stone.body.bounds.max.y - island.floorAt(stone.body.position.x)) < 6, 'A sinking stone must settle on the visible uneven seabed');
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
  assert.equal(profiles.size, 3, 'The three areas must have distinct seabed contours');
});