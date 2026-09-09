const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');
const { noise } = require('./environment.js');
const { Body, Composite } = require('matter-js');

test('environment fields are deterministic, bounded, map-specific, and independent of wildlife choices', () => {
  const islands = ['lagoon', 'pools', 'sunset'].map(map => new IslandPhysics(3200, 900, map, true));
  try {
    const winds = [];
    for (const island of islands) {
      const seed = island.wildlife.seed;
      island.time = 12000; island.environment.step(16);
      const before = island.environment.snapshot();
      island.environment.step(0);
      assert.deepEqual(island.environment.snapshot(), before);
      assert.equal(island.wildlife.seed, seed);
      assert.ok(before.wind >= 0 && before.wind <= 1);
      winds.push(before.wind);
      island.environment.windOverride = 0;
      island.environment.step(16);
      assert.equal(island.environment.wind, 0);
    }
    assert.equal(new Set(winds).size, 3);
    assert.ok(islands[2].environment.sun.elevation < islands[0].environment.sun.elevation);
    assert.ok(Math.abs(noise(1 - 0.00001, 7) - noise(1 + 0.00001, 7)) < 0.0001);
  } finally { for (const island of islands) island.dispose(); }
});

test('shore wetness agrees with the surface and dries within four active seconds', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const dry = island.environment.shoreline.find(point => island.floorAt(point.x) < island.layout.water - 6 && island.floorAt(point.x) > island.layout.water - 18);
    assert.ok(dry);
    for (const wave of island.waves) wave.offset = -18;
    island.environment.updateShoreline(17);
    assert.equal(dry.wetness, 1);
    for (const wave of island.waves) wave.offset = 0;
    island.environment.updateShoreline(2000);
    assert.equal(dry.wetness, 0.5);
    island.environment.updateShoreline(2000);
    assert.equal(dry.wetness, 0);
    assert.equal(island.environment.energy, 0);
  } finally { island.dispose(); }
});

test('contact particles and sand marks are bounded and expire on simulation time', () => {
  const island = new IslandPhysics();
  try {
    for (let index = 0; index < 100; index += 1) island.environment.impact(200, island.layout.ground, 8);
    assert.equal(island.environment.particles.length, 48);
    island.environment.mark(200, 100);
    assert.equal(island.environment.snapshot().marks, 1);
    island.time = 5001; island.environment.step(5001);
    assert.equal(island.environment.particles.length, 0);
    assert.equal(island.environment.snapshot().marks, 0);
  } finally { island.dispose(); }
});

test('the shared current is strongest at the surface and vanishes at the floor or with zero configuration', () => {
  const island = new IslandPhysics(3200, 900, 'pools', true);
  try {
    const positionX = island.landmarks.reef.x;
    const surface = island.environment.currentAt(positionX, island.surfaceAt(positionX));
    assert.ok(surface > 0 && surface <= 0.23);
    assert.equal(island.environment.currentAt(positionX, island.floorAt(positionX)), 0);
    assert.equal(island.environment.currentAt(100, island.layout.ground), 0);
    island.map = { ...island.map, ecology: { ...island.map.ecology, current: 0 } };
    assert.equal(island.environment.currentAt(positionX, island.surfaceAt(positionX)), 0);
  } finally { island.dispose(); }
});

test('relative-motion wakes are symmetric, stationary controls stay quiet, and held props get no current force', () => {
  const island = new IslandPhysics(3200, 900, 'pools', true);
  try {
    const raft = island.props.find(prop => prop.kind === 'raft');
    Body.setPosition(raft.body, { x: 2000, y: island.layout.water + 20 });
    Body.setVelocity(raft.body, { x: 0, y: 0 });
    island.wake(raft.body, 1);
    assert.ok(island.waves.every(wave => wave.velocity === 0));
    Body.setVelocity(raft.body, { x: 4, y: 0 });
    island.wake(raft.body, 1);
    assert.ok(island.waves.some(wave => wave.velocity !== 0));
    assert.ok(Math.abs(island.waves.reduce((sum, wave) => sum + wave.velocity, 0)) < 0.000001);
    for (const wave of island.waves) wave.velocity = 0;
    Body.setVelocity(raft.body, { x: 0, y: 0 }); raft.body.force.x = 0;
    island.drags.set(1, { kind: 'raft', body: raft.body });
    island.floatBody(raft.body, raft.density, raft.radius, raft.width, raft.height);
    assert.equal(raft.body.force.x, 0);
    assert.ok(island.waves.every(wave => wave.velocity === 0));
  } finally { island.drags.clear(); island.dispose(); }
});

test('identical isolated rafts measurably drift under current but not the zero-current control', () => {
  const drift = current => {
    const island = new IslandPhysics(3200, 900, 'lagoon');
    try {
      island.map = { ...island.map, ecology: { ...island.map.ecology, current } };
      island.environment.swellOverride = 0; island.environment.windOverride = 0;
      const raft = island.props.find(prop => prop.kind === 'raft');
      for (const prop of island.props) if (prop !== raft) Composite.remove(island.engine.world, prop.body);
      island.props = [raft];
      Body.setPosition(raft.body, { x: 2100, y: island.layout.water - 2 });
      Body.setVelocity(raft.body, { x: 0, y: 0 });
      for (let frame = 0; frame < 600; frame += 1) island.step();
      assert.ok(island.waves.every(wave => Math.abs(wave.offset) <= 18 && Math.abs(wave.velocity) < 6));
      return raft.body.position.x - 2100;
    } finally { island.dispose(); }
  };
  assert.ok(Math.abs(drift(0)) < 0.2);
  assert.ok(drift(0.2) > 20);
});

test('existing five-sample buoyancy levels a tilted raft and follows the bounded swell', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon');
  try {
    const raft = island.props.find(prop => prop.kind === 'raft');
    for (const prop of island.props) if (prop !== raft) Composite.remove(island.engine.world, prop.body);
    island.props = [raft];
    Body.setPosition(raft.body, { x: 2100, y: island.layout.water - 2 }); Body.setAngle(raft.body, 0.35);
    const heights = [];
    for (let frame = 0; frame < 900; frame += 1) {
      island.step();
      if (frame > 400) heights.push(raft.body.position.y);
    }
    assert.ok(Math.abs(raft.body.angle) < 0.08);
    assert.ok(Math.max(...heights) - Math.min(...heights) > 0.15);
    assert.ok(Math.max(...heights) - Math.min(...heights) < 8);
  } finally { island.dispose(); }
});

test('wet contact friction follows the shared moisture field and round props lose rolling spin', () => {
  const island = new IslandPhysics();
  try {
    const ball = island.props.find(prop => prop.kind === 'ball');
    Body.setPosition(ball.body, { x: 200, y: island.layout.ground - ball.radius });
    for (let frame = 0; frame < 40; frame += 1) island.step();
    const moisture = island.environment.shoreline[Math.round(ball.body.position.x / 12)];
    moisture.wetness = 1;
    Body.setAngularVelocity(ball.body, 0.2);
    island.dampContacts();
    assert.equal(ball.body.friction, 0.54);
    assert.ok(Math.abs(ball.body.angularVelocity) < 0.2);
    moisture.wetness = 0;
    island.dampContacts();
    assert.equal(ball.body.friction, 0.48);
  } finally { island.dispose(); }
});

test('map rhythms arrive once per active-time cycle, remain bounded, and do not move the tide or landmarks', () => {
  const kinds = [];
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, mapId, true);
    try {
      const environment = island.environment;
      const landmarks = JSON.stringify(island.landmarks);
      const water = island.layout.water;
      const seed = island.wildlife.seed;
      island.time = environment.rhythm.first - 1; environment.step(0);
      assert.equal(environment.event, null);
      island.time += 1; environment.step(16);
      assert.ok(environment.event);
      kinds.push(environment.event.kind);
      assert.equal(environment.eventCounts[environment.event.kind], 1);
      environment.step(0);
      assert.equal(environment.eventCounts[environment.event.kind], 1);
      island.time += environment.rhythm.duration + 1; environment.step(16);
      assert.equal(environment.event, null);
      island.time = environment.rhythm.first + environment.rhythm.period; environment.step(16);
      assert.equal(environment.eventCounts[environment.event.kind], 2);
      assert.equal(island.layout.water, water);
      assert.equal(JSON.stringify(island.landmarks), landmarks);
      assert.equal(island.wildlife.seed, seed);
    } finally { island.dispose(); }
  }
  assert.equal(new Set(kinds).size, 3);
});

test('nearby map-event reactions yield to held input and do not earn objectives', () => {
  const island = new IslandPhysics(3200, 900, 'pools', true);
  try {
    const resident = island.wildlife.residents.find(item => item.species === 'crab');
    Body.setPosition(resident.body, { x: island.layout.waterStart + 30, y: island.layout.water - 20 });
    resident.state = 'wandering'; resident.held = false; resident.recovery = '';
    island.time = island.environment.rhythm.first; island.environment.step(16);
    assert.equal(resident.comicReaction, 'startle');
    assert.ok(resident.comicReactionUntil > island.time);
    const previous = resident.comicReactionUntil;
    resident.held = true;
    island.time += island.environment.rhythm.period; island.environment.step(16);
    assert.equal(resident.comicReactionUntil, previous);
    assert.equal(island.objectives.snapshot().completed, 0);
  } finally { island.dispose(); }
});