const test = require('node:test');
const assert = require('node:assert/strict');
const { IslandPhysics } = require('./physics.js');
const { traitsFor } = require('./individuality.js');

test('named partners have stable distinct traits and approach distances without extra gameplay draws', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const mango = island.wildlife.residents.find(resident => resident.id === 'mango');
    const fern = island.wildlife.residents.find(resident => resident.id === 'fern');
    const seed = island.wildlife.seed;
    assert.deepEqual(mango.traits, traitsFor('mango'));
    assert.notDeepEqual(mango.traits, fern.traits);
    assert.notEqual(island.wildlife.individuals.approachDistance(mango), island.wildlife.individuals.approachDistance(fern));
    assert.ok(Object.values(mango.traits).every(value => value >= 0 && value <= 1));
    island.time += 100; island.wildlife.individuals.tick();
    assert.equal(island.wildlife.seed, seed);
  } finally { island.dispose(); }
});

test('exertion produces bounded fatigue and longer rests without slowing protected recovery or objective paths', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const resident = island.wildlife.residents.find(item => item.id === 'mango');
    const life = island.wildlife.individuals;
    const rested = life.restFactor(resident);
    resident.state = 'fleeing';
    for (let index = 0; index < 100; index += 1) { island.time += 100; life.tick(); }
    assert.ok(resident.needs.energy < 0.6);
    resident.state = 'wandering';
    assert.ok(life.speedFactor(resident) < 0.95);
    assert.ok(life.restFactor(resident) > rested * 1.3);
    for (const state of ['returning', 'foraging', 'visiting-flight', 'startled']) { resident.state = state; assert.equal(life.speedFactor(resident), 1); }
    resident.state = 'resting';
    for (let index = 0; index < 150; index += 1) { island.time += 100; life.tick(); }
    assert.equal(resident.needs.energy, 1);
  } finally { island.dispose(); }
});

test('affinity rewards named shared activity, falls after fright, and rejects unbounded toy identities', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const [first, second] = island.wildlife.residents;
    const life = island.wildlife.individuals;
    island.wildlife.meet('schooling', first, second);
    assert.ok(life.affinity(first, second) > 0);
    island.time += 2000;
    island.wildlife.meet('fish-startled-by-bird', first, second);
    assert.ok(life.affinity(first, second) < 0);
    for (let index = 0; index < 100; index += 1) life.notice('schooling', first, { id: `toy-${index}` });
    assert.equal(life.pairs.size, 1);
    island.time += 180001; life.tick();
    assert.equal(life.pairs.size, 0);
  } finally { island.dispose(); }
});

test('fright memory redirects ordinary targets for thirty seconds but never recovery or deliveries', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const resident = island.wildlife.residents.find(item => item.id === 'mango');
    const life = island.wildlife.individuals;
    const spot = { x: 600, y: resident.body.position.y };
    life.fright(resident, spot);
    assert.ok(Math.abs(life.target(resident, 'wandering', spot).x - spot.x) >= 90);
    assert.deepEqual(life.target(resident, 'returning', spot), spot);
    assert.deepEqual(life.target(resident, 'foraging', spot), spot);
    island.time = 30001; life.tick();
    assert.equal(resident.avoidSpot, null);
    assert.deepEqual(life.target(resident, 'wandering', spot), spot);
  } finally { island.dispose(); }
});

test('schooling combines nearby fish alignment and cohesion while threats and distant fish are excluded', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const [first, second] = island.wildlife.residents;
    first.state = 'schooling';
    first.body.position.x = 1900; first.body.position.y = 600;
    second.body.position.x = 1980; second.body.position.y = 630; second.body.velocity.x = 2;
    const flock = island.wildlife.flock(first);
    assert.ok(flock.x > 0 && flock.y > 0 && flock.x <= 0.16);
    first.state = 'startled';
    assert.deepEqual(island.wildlife.flock(first), { x: 0, y: 0 });
    first.state = 'schooling'; second.body.position.x = 2500;
    assert.deepEqual(island.wildlife.flock(first), { x: 0, y: 0 });
  } finally { island.dispose(); }
});

test('actual gait sound production is phase/cooldown/distance gated and held input stays silent', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const resident = island.wildlife.residents.find(item => item.id === 'fern');
    resident.body.position = { ...island.blobPosition() }; resident.body.velocity.x = 1;
    resident.grounded = true; resident.recovery = ''; resident.state = 'wandering'; resident.motionPhase = Math.PI;
    island.time = 2000;
    island.wildlife.individuals.motionSound(resident);
    assert.equal(island.sounds.at(-1).kind, 'step');
    const count = island.sounds.length;
    resident.motionPhase += Math.PI; island.wildlife.individuals.motionSound(resident);
    assert.equal(island.sounds.length, count);
    island.time += 2000; resident.held = true;
    island.wildlife.individuals.motionSound(resident);
    assert.equal(island.sounds.length, count);
  } finally { island.dispose(); }
});