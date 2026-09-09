const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Query, Collision } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

test('marine residents fall through air before smoothly gaining swimming control', () => {
  for (const species of ['fish', 'jellyfish', 'shark', 'octopus']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const obstacles = island.props.map(prop => prop.body);
    const clearWater = Array.from({ length: 32 }, (_, index) => island.wildlife.water.minX + 90 + index / 31 * (island.wildlife.water.maxX - island.wildlife.water.minX - 180)).find(positionX =>
      Query.region(obstacles, { min: { x: positionX - resident.width, y: island.layout.water - 180 }, max: { x: positionX + resident.width, y: island.layout.water + resident.height } }).length === 0);
    assert.ok(Number.isFinite(clearWater), 'The air-to-water fixture must not land on a floating toy');
    Body.setPosition(resident.body, { x: clearWater, y: island.layout.water - 110 });
    Body.setVelocity(resident.body, { x: 1, y: 0 });
    let sawAir = false;
    let sawWading = false;
    let sawSwimming = false;
    for (let frame = 0; frame < 240; frame += 1) {
      island.step();
      if (resident.medium === 'air') { sawAir = true; if (frame > 3) assert.ok(resident.body.velocity.y > 0, 'Airborne marine residents must fall, not levitate toward the habitat'); }
      if (resident.medium === 'wading') sawWading = true;
      if (resident.medium === 'water') sawSwimming = true;
    }
    assert.equal(sawAir && sawWading && sawSwimming, true, `${species} must pass through air, partial immersion, and water states`);
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
});

test('bird changes between flapping, gliding and landing with bounded steering', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const bird = island.wildlife.residents.find(item => item.species === 'bird');
  const phases = new Set();
  let previous = { ...bird.body.velocity };
  let previousWing = bird.wingLift;
  let previousLanding = bird.landingBlend;
  let previousContact = false;
  for (let frame = 0; frame < 3600; frame += 1) {
    island.step(); phases.add(bird.flight);
    const contact = island.engine.pairs.list.some(pair => pair.isActive && (pair.bodyA.parent === bird.body || pair.bodyB.parent === bird.body));
    if (bird.medium === 'air' && bird.body.position.y < island.layout.water - 80 && !contact && !previousContact) {
      assert.ok(Math.abs(bird.body.velocity.x - previous.x) < 0.24, 'Clear-air flight cannot instantaneously reverse horizontal velocity');
      assert.ok(Math.abs(bird.bank) <= 0.43, 'Visible banking must remain bounded');
    }
    previous = { ...bird.body.velocity };
    previousContact = contact;
    assert.ok(Math.abs(bird.wingLift - previousWing) <= 0.49, 'Wing poses must blend through state changes');
    assert.ok(Math.abs(bird.landingBlend - previousLanding) <= 0.13, 'Feet must blend between tucked flight and landing');
    previousWing = bird.wingLift; previousLanding = bird.landingBlend;
  }
  for (const phase of ['flapping', 'gliding', 'landing', 'perched']) assert.ok(phases.has(phase), `The bird must demonstrate ${phase}`);
  island.dispose();
});

test('a bird below the swing clears the solid seat before approaching the picnic', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const food = island.props.find(prop => prop.kind === 'coconut');
  const swing = island.props.find(prop => prop.kind === 'swing');
  Body.setPosition(food.body, { x: 736, y: island.layout.ground - food.radius });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  const bird = island.wildlife.residents.find(resident => resident.species === 'bird');
  Body.setPosition(bird.body, { x: 559, y: 445 });
  Body.setVelocity(bird.body, { x: 0, y: 0 });
  let visited = false;
  let clearedSwing = false;
  for (let frame = 0; frame < 1600; frame += 1) {
    island.step();
    const collision = Collision.collides(bird.body, swing.body);
    assert.ok(!collision || collision.depth < 4, 'The bird must not pass through the solid seat');
    if (bird.body.bounds.min.x > swing.body.bounds.max.x + 4 || bird.body.bounds.max.y < swing.body.bounds.min.y - 4) clearedSwing = true;
    if (bird.state === 'visiting') { visited = true; break; }
  }
  assert.equal(clearedSwing, true, 'The flight path must clear the actual seat geometry before visiting');
  assert.equal(visited, true, 'The bird must actually reach the delivered picnic');
  island.dispose();
});

test('misplaced residents visibly recover to a natural habitat without teleporting', () => {
  for (const species of ['fish', 'jellyfish', 'shark', 'octopus', 'crab', 'tortoise', 'bird']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const marine = ['fish', 'jellyfish', 'shark', 'octopus'].includes(species);
    Body.setPosition(resident.body, marine ? { x: island.layout.shore - 65, y: island.layout.ground - 45 } : { x: island.landmarks.reef.x, y: island.layout.water + 130 });
    Body.setVelocity(resident.body, { x: 0, y: 0 });
    let sawRecovery = false;
    let returned = false;
    let previous = { ...resident.body.position };
    for (let frame = 0; frame < 2600; frame += 1) {
      island.step();
      sawRecovery ||= Boolean(resident.recovery);
      assert.ok(Math.hypot(resident.body.position.x - previous.x, resident.body.position.y - previous.y) < 35, 'Recovery must move continuously rather than teleporting');
      previous = { ...resident.body.position };
      if (sawRecovery && island.wildlife.inHabitat(resident)) { returned = true; break; }
    }
    assert.equal(sawRecovery, true, `${species} must visibly react to the wrong environment`);
    assert.equal(returned, true, `${species} must find a natural habitat again`);
    assert.equal(island.wildlife.residents.length, 10, 'No character may disappear during recovery');
    island.dispose();
  }
});

test('nearby habitat recovery starts promptly and does not wait for a rescue bubble', () => {
  for (const species of ['fish', 'jellyfish', 'shark', 'octopus', 'crab', 'tortoise', 'bird']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const marine = ['fish', 'jellyfish', 'shark', 'octopus'].includes(species);
    const point = marine ? { x: island.layout.waterEnd - 130, y: island.layout.water - 90 }
      : { x: island.layout.waterStart + 145, y: island.layout.water + 55 };
    Body.setPosition(resident.body, point); Body.setVelocity(resident.body, { x: 0, y: 0 });
    let returnedAt = null;
    let usedRescue = false;
    for (let frame = 0; frame < 720; frame += 1) {
      island.step(); usedRescue ||= resident.rescue;
      if (frame === 1) assert.ok(resident.recovery || island.wildlife.inHabitat(resident), `${species} must react immediately`);
      if (island.wildlife.inHabitat(resident) && !resident.recovery) { returnedAt = island.time; break; }
    }
    assert.ok(returnedAt !== null && returnedAt < 12000, `${species} must return to nearby usable habitat within twelve active seconds`);
    assert.equal(usedRescue, false, `${species} should recover naturally when a nearby route is open`);
    island.dispose();
  }
});

test('a jellyfish caught by a floating ring chooses open water instead of steering into the rim', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  for (let frame = 0; frame < 180; frame += 1) island.step();
  const ring = island.props.find(prop => prop.kind === 'ring');
  const jellyfish = island.wildlife.residents.find(resident => resident.species === 'jellyfish');
  Body.setPosition(jellyfish.body, { ...ring.body.position }); Body.setVelocity(jellyfish.body, { x: 0, y: 0 });
  jellyfish.decideAt = 0;
  let previous = { ...jellyfish.body.position };
  let returned = false;
  let passedThrough = false;
  for (let frame = 0; frame < 720; frame += 1) {
    island.step();
    passedThrough ||= jellyfish.ringPassage === ring.body.id;
    assert.ok(Math.hypot(jellyfish.body.position.x - previous.x, jellyfish.body.position.y - previous.y) < 30, 'Recovery must move continuously around the float');
    previous = { ...jellyfish.body.position };
    if (island.wildlife.inHabitat(jellyfish) && !jellyfish.recovery && !jellyfish.ringPassage) { returned = true; break; }
  }
  assert.equal(returned, true, 'The floating rim must not permanently trap a recovering resident');
  assert.equal(passedThrough, true, 'The swimmer must leave through the open center using a depth passage');
  assert.equal(jellyfish.body.collisionFilter.group, island.wildlife.group, 'Normal rim collisions must resume once clear');
  assert.equal(island.snapshot().finite, true);
  island.dispose();
});