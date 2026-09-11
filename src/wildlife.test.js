const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Detector } = require('matter-js');
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

test('frogs released into the ocean swim at the surface on every island', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const frogs = island.wildlife.residents.filter(resident => resident.species === 'frog');
    const surfaceTravel = frogs.map(() => ({ minX: Infinity, maxX: -Infinity }));
    frogs.forEach((frog, index) => {
      const position = { x: island.wildlife.water.maxX - 160 - index * 180,
        y: island.layout.water + 75 };
      Body.setPosition(frog.body, position);
      Body.setVelocity(frog.body, { x: 0, y: 0 });
      Object.assign(frog, { depth: 0, depthTarget: 0, state: 'held', decideAt: 0, foodAt: Infinity });
      assert.equal(island.wildlife.inHabitat(frog), true, `${frog.id} must accept the ocean as a habitat in ${map}`);
    });
    for (let frame = 0; frame < 480; frame += 1) {
      island.step();
      for (const [index, frog] of frogs.entries()) {
        if (Math.abs(frog.body.position.y - island.surfaceAt(frog.body.position.x)) < frog.height * 0.55) {
          surfaceTravel[index].minX = Math.min(surfaceTravel[index].minX, frog.body.position.x);
          surfaceTravel[index].maxX = Math.max(surfaceTravel[index].maxX, frog.body.position.x);
        }
      }
    }
    assert.equal(island.snapshot().finite, true);
    for (const [index, frog] of frogs.entries()) {
      assert.equal(frog.state, 'swimming', `${frog.id} must choose to swim in ${map}`);
      assert.equal(frog.recovery, '', 'Swimming must not trigger land-resident recovery');
      assert.equal(frog.rescue, false, 'A swimming frog must not need rescue');
      assert.equal(frog.frown, false, 'Frogs must be comfortable in the ocean');
      assert.ok(surfaceTravel[index].maxX - surfaceTravel[index].minX > 65, `${frog.id} must paddle across the ocean surface in ${map}`);
      assert.ok(Math.abs(frog.body.position.y - island.surfaceAt(frog.body.position.x)) < frog.height * 0.55, `${frog.id} must float near the surface in ${map}`);
      assert.equal(frog.hopAt, -2000, 'Swimming must not trigger underwater land hops');
    }
    island.dispose();
  }
});

test('lily pads physically support frogs from above while leaving underwater passage open', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    try {
      const frog = island.wildlife.residents.find(resident => resident.id === 'puddle');
      const pad = island.wildlife.lilyPadBodies[6];
      Body.setPosition(frog.body, { x: pad.body.position.x, y: pad.body.bounds.min.y - frog.height * 0.41 - 30 });
      Body.setVelocity(frog.body, { x: 0, y: 0 });
      Object.assign(frog, { depth: 0, depthTarget: 0, state: 'resting', until: Infinity, decideAt: Infinity, foodAt: Infinity });
      advance(island, 120);
      assert.equal(frog.lilyPadId, pad.id, `A dropped frog must land on the lily pad in ${map}`);
      assert.equal(frog.grounded, true);
      assert.ok(island.engine.pairs.list.some(pair => pair.isActive
        && [pair.bodyA.parent, pair.bodyB.parent].includes(frog.body) && [pair.bodyA.parent, pair.bodyB.parent].includes(pad.body)), 'Support must come from a real Matter.js collision');
      const heights = [];
      for (let frame = 0; frame < 240; frame += 1) {
        island.step();
        heights.push(frog.body.position.y);
        assert.ok(Math.abs(frog.body.bounds.max.y - pad.body.bounds.min.y) < 4, 'The frog must stay on the moving pad');
      }
      assert.ok(Math.max(...heights) - Math.min(...heights) > 0.1, 'The supported frog must bob with its pad');
      assert.equal(Detector.canCollide(island.wildlife.residents[0].body.collisionFilter, pad.body.collisionFilter), false, 'Lily pads must not block fish');
      Body.setPosition(frog.body, { x: pad.body.position.x, y: pad.body.position.y + frog.height });
      Body.setVelocity(frog.body, { x: 0, y: -7 });
      island.step();
      assert.equal(Detector.canCollide(frog.body.collisionFilter, pad.body.collisionFilter), false, 'Frogs rising from below must pass through the pad');
      assert.equal(frog.lilyPadId, null);
      assert.equal(island.snapshot().finite, true);
    } finally { island.dispose(); }
  }
});

test('frogs naturally hop onto lily pads, rest, hop between pads, and return to swimming', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) for (const id of ['puddle', 'sprig']) {
    const island = new IslandPhysics(3200, 900, map, true);
    try {
      const frog = island.wildlife.residents.find(resident => resident.id === id);
      const pad = island.environment.lilyPads()[7];
      const start = { x: pad.x + 50, y: island.surfaceAt(pad.x + 50) + frog.height * 0.04 };
      Body.setPosition(frog.body, start); Body.setVelocity(frog.body, { x: 0, y: 0 });
      Object.assign(frog, { depth: 0, depthTarget: 0, state: 'swimming', until: 0, decideAt: 0, target: start });
      const visited = new Set();
      let restFrames = 0;
      let longestRest = 0;
      let onto = false;
      let between = false;
      let off = false;
      let backInWater = false;
      let previous = { ...frog.body.position };
      for (let frame = 0; frame < 2700 && !backInWater; frame += 1) {
        island.step();
        assert.ok(Math.hypot(frog.body.position.x - previous.x, frog.body.position.y - previous.y) < 14, 'Pad travel must be continuous physical motion, not teleporting');
        previous = { ...frog.body.position };
        const hop = frog.padHop;
        if (hop?.started != null) {
          onto ||= !hop.fromPadId && Boolean(hop.padId);
          between ||= Boolean(hop.fromPadId && hop.padId && hop.fromPadId !== hop.padId);
          off ||= Boolean(hop.fromPadId && !hop.padId);
        }
        if (frog.lilyPadId && frog.state === 'resting') {
          visited.add(frog.lilyPadId);
          restFrames += 1; longestRest = Math.max(longestRest, restFrames);
          assert.equal(frog.grounded, true);
          assert.equal(frog.frown, false);
        } else restFrames = 0;
        backInWater = off && !frog.padHop && frog.state === 'swimming' && frog.immersion > 0.15;
      }
      assert.ok(onto, `${map}/${id} must jump out of the water onto a pad`);
      assert.ok(longestRest >= 120, `${map}/${id} must sit on a pad for at least two seconds`);
      assert.ok(between && visited.size >= 2, `${map}/${id} must land on a neighboring pad`);
      assert.ok(backInWater, `${map}/${id} must jump off and resume swimming`);
      assert.equal(frog.recovery, '');
      assert.equal(island.snapshot().finite, true);
    } finally { island.dispose(); }
  }
});

test('a frog can hop to the next free lily pad when the nearest leaf is blocked', () => {
  const island = new IslandPhysics(3200, 900, 'pools', true);
  try {
    const frog = island.wildlife.residents.find(resident => resident.id === 'sprig');
    const [destination, blocked, start] = island.wildlife.lilyPadBodies.slice(5);
    const raft = island.props.find(prop => prop.kind === 'raft');
    Body.setPosition(raft.body, { x: blocked.body.position.x, y: blocked.body.position.y - 5 });
    Body.setStatic(raft.body, true);
    Body.setPosition(frog.body, { x: start.body.position.x, y: start.body.bounds.min.y - frog.height * 0.41 - 1 });
    Body.setVelocity(frog.body, { x: 0, y: 0 });
    Object.assign(frog, { depth: 0, depthTarget: 0, state: 'resting', until: 0, decideAt: 0 });
    assert.equal(island.wildlife.frogPadOpen(frog, blocked), false, 'The nearest pad must actually be obstructed');
    assert.equal(island.wildlife.frogPadOpen(frog, destination), true);
    island.step();
    assert.equal(frog.padTargetId, destination.id, 'A reachable clear leaf should win over a blocked neighbor');
    advance(island, 70);
    assert.equal(frog.lilyPadId, destination.id, 'The frog must physically complete the longer hop');
    assert.equal(frog.state, 'resting');
  } finally { island.dispose(); }
});

test('a frog near the far bank jumps off its lily pad into water deep enough to swim', () => {
  const island = new IslandPhysics(3200, 900, 'sunset', true);
  try {
    const frog = island.wildlife.residents.find(resident => resident.id === 'puddle');
    const pad = island.wildlife.lilyPadBodies[6];
    Body.setPosition(frog.body, { x: pad.body.position.x, y: pad.body.bounds.min.y - frog.height * 0.41 - 1 });
    Body.setVelocity(frog.body, { x: 0, y: 0 });
    Object.assign(frog, { depth: 0, depthTarget: 0, state: 'resting', until: 0, decideAt: 0, padHops: 1, foodAt: Infinity });
    island.step();
    assert.ok(frog.padHop);
    const destination = frog.padHop.target.x;
    assert.ok(island.floorAt(destination) > island.surfaceAt(destination) + frog.height + 8, 'The jump must avoid the shallow far bank');
    advance(island, 70);
    assert.equal(frog.padHop, null);
    assert.equal(frog.state, 'swimming');
    assert.ok(frog.immersion > 0.15);
    assert.equal(frog.recovery, '');
  } finally { island.dispose(); }
});

test('landing on a lily pad interrupts wandering before an ordinary beach hop can fire', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const frog = island.wildlife.residents.find(resident => resident.id === 'puddle');
    const pad = island.wildlife.lilyPadBodies[6];
    Body.setPosition(frog.body, { x: pad.body.position.x, y: pad.body.bounds.min.y - frog.height * 0.41 - 1 });
    Body.setVelocity(frog.body, { x: 0, y: 0 });
    Object.assign(frog, { depth: 0, depthTarget: 0, state: 'swimming', until: 10000, decideAt: 10000, foodAt: Infinity,
      target: { x: pad.body.position.x + 160, y: pad.body.position.y } });
    advance(island, 30);
    assert.equal(frog.lilyPadId, pad.id);
    assert.equal(frog.state, 'resting');
    assert.equal(frog.grounded, true);
    assert.equal(frog.hopAt, -2000, 'A newly supported frog must settle rather than fire a beach hop');
    const jellyfish = island.wildlife.residents.find(resident => resident.species === 'jellyfish');
    Body.setPosition(jellyfish.body, { x: pad.body.position.x + 50, y: pad.body.position.y + 30 });
    island.wildlife.interactions.nextNotice = 0;
    island.wildlife.interactions.tick();
    assert.equal(frog.state, 'resting', 'A nearby marine resident must not replace a supported rest with land-only steering');
  } finally { island.dispose(); }
});

test('grabbing a perched or airborne frog cancels its pad jump and landing reservation', () => {
  for (const airborne of [false, true]) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    try {
      const frog = island.wildlife.residents.find(resident => resident.id === 'sprig');
      const pad = island.wildlife.lilyPadBodies[6];
      Body.setPosition(frog.body, { x: pad.body.position.x, y: pad.body.bounds.min.y - frog.height * 0.41 - 30 });
      Body.setVelocity(frog.body, { x: 0, y: 0 });
      Object.assign(frog, { depth: 0, depthTarget: 0, state: 'held', decideAt: 0, foodAt: Infinity });
      advance(island, 90);
      assert.equal(frog.lilyPadId, pad.id);
      if (airborne) {
        for (let frame = 0; frame < 600 && frog.padHop?.started == null; frame += 1) island.step();
        assert.ok(frog.padHop?.started != null, 'The grab check must interrupt a real, naturally chosen jump');
      }
      const drag = island.grab(81, island.wildlife.position(frog), 0);
      assert.equal(drag?.creature, frog, 'The actual frog must be pickable above the lily pad');
      island.move(81, { x: frog.body.position.x, y: frog.body.position.y - 70 });
      advance(island, 5);
      assert.equal(frog.state, 'held');
      assert.equal(frog.padHop, null);
      assert.equal(frog.padTargetId, null);
      assert.equal(frog.lilyPadId, null);
      assert.equal(frog.hopPrepareUntil, null);
      island.release(81);
      advance(island, 120);
      assert.equal(island.drags.size, 0);
      assert.equal(frog.held, false);
    } finally { island.dispose(); }
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