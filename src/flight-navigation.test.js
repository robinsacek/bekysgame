const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { planFlightPath, corridorClear } = require('./flight-navigation.js');

test('flight paths route around a low overhead obstacle and adjacent ground clutter', () => {
  const obstacles = [{ min: { x: 560, y: 380 }, max: { x: 660, y: 422 } }, { min: { x: 594, y: 425 }, max: { x: 652, y: 475 } }];
  const start = { x: 545, y: 440 };
  const goal = { x: 746, y: 318 };
  const path = planFlightPath(start, goal, obstacles, point => point.y < 475);
  assert.ok(path.length > 1, 'A blocked direct route must produce actual detour waypoints');
  let previous = start;
  for (const point of path) {
    assert.equal(corridorClear(previous, point, obstacles, position => position.y < 475), true, 'Every segment must have collision clearance');
    previous = point;
  }
  assert.deepEqual(path.at(-1), goal);
});

test('an open flight path remains direct and blocked corridors are rejected', () => {
  const start = { x: 100, y: 200 }, goal = { x: 400, y: 200 };
  assert.deepEqual(planFlightPath(start, goal, []), [goal]);
  assert.equal(corridorClear(start, goal, [{ min: { x: 220, y: 190 }, max: { x: 240, y: 210 } }], () => true), false);
});

test('an overlapping start leaves the nearest open face before routing onward', () => {
  const bounds = { min: { x: 430, y: 388 }, max: { x: 540, y: 485 } };
  const start = { x: 477, y: 410 }, goal = { x: 746, y: 318 };
  const path = planFlightPath(start, goal, [bounds], point => point.y < 470);
  assert.deepEqual(path[0], { x: 477, y: 382 }, 'An overlapping bird must rise clear instead of routing through the body');
  assert.equal(corridorClear(start, goal, [bounds], () => true), false, 'Starting inside is not a clear corridor');
  let previous = path[0];
  for (const point of path.slice(1)) {
    assert.equal(corridorClear(previous, point, [bounds], () => true), true);
    previous = point;
  }
  assert.deepEqual(path.at(-1), goal);
});

test('a bird overlapping Blobby departs continuously and reaches the picnic', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const center = island.blobPosition();
  for (const particle of island.blob.particles) {
    Body.translate(particle, { x: 483 - center.x, y: 430 - center.y });
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  const bird = island.wildlife.residents.find(resident => resident.species === 'bird');
  const food = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(food.body, { x: 717, y: island.layout.ground - food.radius - 1 });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  Body.setPosition(bird.body, { x: 477, y: 410 }); Body.setVelocity(bird.body, { x: 0, y: 0 });
  let previous = { ...bird.body.position };
  let visited = false;
  let slipped = false;
  for (let frame = 0; frame < 1200; frame += 1) {
    island.step();
    slipped ||= Boolean(bird.slipping);
    assert.ok(Math.hypot(bird.body.position.x - previous.x, bird.body.position.y - previous.y) < 30, 'The overlap must be resolved by movement, not teleportation');
    previous = { ...bird.body.position };
    if (bird.state === 'visiting') { visited = true; break; }
  }
  assert.equal(visited, true, 'A low overlap must not strand the picnic visitor');
  assert.equal(slipped, true, 'A deeply enclosed resident must be able to slip out of the soft skin');
  assert.equal(bird.body.collisionFilter.group, island.wildlife.group, 'Normal collisions must be restored after leaving the soft mesh');
  assert.ok(island.snapshot().blob.area > 1000, 'Freeing a resident must preserve Blobby');
  island.dispose();
});

test('a bird pressed under a solid seat exits sideways instead of through its top', () => {
  const seat = { min: { x: 540, y: 376 }, max: { x: 676, y: 424 } };
  const floorClutter = { min: { x: 595, y: 418 }, max: { x: 665, y: 480 } };
  const start = { x: 565, y: 421 };
  const path = planFlightPath(start, { x: 746, y: 318 }, [seat, floorClutter], point => point.y < 456);
  assert.ok(path.length > 1);
  assert.equal(path[0].x < seat.min.x || path[0].y > seat.max.y, true, 'The first step must move away from the solid seat, never through it');
});