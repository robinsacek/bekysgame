const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

function advance(island, frames) {
  for (let frame = 0; frame < frames; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true, 'All creature and physics positions must remain finite');
}

test('little frogs make springy ordinary hops with a crouch and no constant flipping', () => {
  for (const id of ['puddle', 'sprig']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const frog = island.wildlife.residents.find(resident => resident.id === id);
    Body.setPosition(frog.body, { x: 280, y: island.layout.ground - frog.height * 0.41 });
    Object.assign(frog, { state: 'wandering', until: 10000, decideAt: 10000, foodAt: 10000,
      target: { x: 500, y: island.layout.ground - frog.height * 0.41 } });
    const hops = new Set();
    let crouched = false;
    let airborne = false;
    for (let frame = 0; frame < 400; frame += 1) {
      island.step();
      if (frog.hopAt >= 0) hops.add(frog.hopAt);
      const pose = island.wildlife.snapshot().find(resident => resident.id === id).jumpPose;
      crouched ||= pose.crouch > 0.5;
      airborne ||= frog.body.position.y < island.layout.ground - frog.height * 0.41 - 12;
      assert.equal(pose.rotation, 0, 'Ordinary hops must not spin');
    }
    assert.ok(hops.size >= 2, `${id} must make repeated physical hops`);
    assert.ok(crouched && airborne, 'A hop must anticipate and actually leave the ground');
    assert.equal(island.snapshot().finite, true);
    island.dispose();
  }
});

test('a frog lands on toys only in its own beach-depth lane', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const frog = island.wildlife.residents.find(resident => resident.id === 'sprig');
  const crate = island.props.find(prop => prop.kind === 'crate');
  Body.setPosition(frog.body, { x: crate.body.position.x, y: crate.body.bounds.min.y - frog.height * 0.41 });
  Body.setVelocity(frog.body, { x: 0, y: 0 });
  frog.depth = 55;
  island.wildlife.updateMedium(frog);
  assert.equal(frog.grounded, false, 'A background toy must not stop an airborne foreground somersault');
  frog.depth = crate.depth;
  island.wildlife.updateMedium(frog);
  assert.equal(frog.grounded, true, 'A toy in the same depth lane remains a landing surface');
  island.dispose();
});

test('all species act autonomously and remain in a bounded living world', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const before = island.wildlife.snapshot();
    const travel = new Map();
    for (let frame = 0; frame < 2100; frame += 1) {
      island.step();
      for (const resident of island.wildlife.snapshot()) {
        const initial = before.find(item => item.id === resident.id);
        travel.set(resident.id, Math.max(travel.get(resident.id) || 0, Math.hypot(resident.x - initial.x, resident.y - initial.y)));
      }
    }
    assert.equal(island.snapshot().finite, true);
    const after = island.wildlife.snapshot();
    assert.deepEqual(after.map(resident => resident.species), ['fish', 'fish', 'crab', 'tortoise', 'bird', 'jellyfish', 'shark', 'octopus', island.map.resident.species, ...island.map.visitors.map(resident => resident.species), 'monkey', 'frog', 'frog']);
    for (const resident of after) {
      assert.ok(resident.transitions > 0, `${resident.name} must choose activities without player input`);
      assert.ok(resident.x > 0 && resident.x < 3200 && resident.y > 100 && resident.y < 900, 'Residents must stay inside the world');
      assert.ok(travel.get(resident.id) > 3, `${resident.name} must move autonomously even if it returns near its start`);
    }
    for (const fish of island.wildlife.residents.filter(resident => resident.species === 'fish')) assert.equal(island.wildlife.inHabitat(fish), true, 'Fish must remain in their water habitat');
    assert.ok(island.wildlife.encounterCounts.schooling > 0, 'Fish must react to one another rather than swim on unrelated tracks');
    assert.ok(island.wildlife.encounterCounts['fish-startled-by-bird'] > 0, 'The bird and fish must demonstrate a cross-species reaction');
    assert.ok(island.wildlife.encounterCounts['fish-yield-to-shark'] > 0, 'Fish must yield to the cruising reef shark without disappearing');
    island.dispose();
  }
});

test('a delivered coconut attracts the tortoise and a visiting bird', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const coconut = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(coconut.body, { x: island.landmarks.picnic.x, y: island.layout.ground - coconut.radius - 1 });
  Body.setVelocity(coconut.body, { x: 0, y: 0 });
  coconut.playerHandled = true;
  let sawSnacking = false;
  for (let frame = 0; frame < 1400; frame += 1) {
    island.step();
    if (island.wildlife.residents.find(resident => resident.species === 'tortoise').state === 'snacking') sawSnacking = true;
  }
  assert.equal(island.snapshot().finite, true);
  assert.ok(island.wildlife.encounters.some(event => event.kind === 'picnic-visit'), 'Delivery must result in an autonomous tortoise-and-bird visit');
  assert.equal(sawSnacking, true, 'The tortoise must actually snack during the visit before it may choose another activity');
  island.dispose();
});

test('a nearby calm blob prompts active varied reactions from land and marine residents', () => {
  for (const species of ['fish', 'crab', 'tortoise', 'bird', 'jellyfish', 'shark', 'octopus']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const center = island.blobPosition();
    const nearby = { x: resident.body.position.x + 85, y: resident.body.position.y };
    for (const particle of island.blob.particles) {
      Body.translate(particle, { x: nearby.x - center.x, y: nearby.y - center.y });
      Body.setVelocity(particle, { x: 0, y: 0 });
    }
    if (species === 'bird') {
      island.grab(93, island.blobPosition(), 12);
      island.move(93, nearby);
    }
    advance(island, species === 'bird' || species === 'tortoise' ? 240 : 95);
    assert.ok(resident.reactions > 0, `${species} must react to a nearby calm blob, not only fast collisions`);
    assert.ok(island.wildlife.encounters.some(event => event.first === resident.id && event.second === 'blob'), 'The resident must target the blob itself');
    assert.ok(island.sounds.some(sound => sound.kind === `voice-${species}`), `${species} must have its own encounter sound`);
    island.dispose();
  }
});

test('the octopus investigates and gently moves a handled seabed object', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const octopus = island.wildlife.residents.find(item => item.species === 'octopus');
  const shell = island.props.find(prop => prop.expeditionId === 'shell-one');
  Body.setPosition(shell.body, { x: octopus.body.position.x + 55, y: island.layout.bottom - shell.radius - 1 });
  Body.setVelocity(shell.body, { x: 0, y: 0 });
  shell.playerHandled = true;
  const initialX = shell.body.position.x;
  advance(island, 300);
  assert.ok(island.wildlife.encounters.some(event => event.kind === 'toy-interest' && event.first === octopus.id));
  assert.ok(Math.abs(shell.body.position.x - initialX) > 3, 'The octopus must interact physically with the shell');
  assert.equal(island.wildlife.residents.length, 13, 'Play must not remove any residents');
  island.dispose();
});

test('grabbed fish stop steering and recover toward water after release', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const fish = island.wildlife.residents[0];
  const drag = island.grab(72, fish.body.position, 0);
  assert.equal(drag.kind, 'creature');
  island.move(72, { x: 1900, y: 400 });
  advance(island, 90);
  assert.equal(fish.state, 'held');
  assert.ok(fish.body.position.y < island.layout.water - 70, 'A player must be able to lift the actual fish');
  island.release(72);
  advance(island, 600);
  assert.equal(island.wildlife.inHabitat(fish), true, 'A released fish must recover instead of being stranded forever');
  assert.equal(island.drags.size, 0);
  island.dispose();
});