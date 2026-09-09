const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { MOMENTS, REPERTOIRE, SIGNATURES, comicPose } = require('./antics.js');

test('each character gets a distinct rare gag on randomized multi-minute timers', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const timers = [...island.wildlife.comedy.nextAt.values()];
  assert.equal(timers.length, 11, 'Every resident and Blobby must have a timer');
  for (const timer of timers) assert.ok(timer >= 60000 && timer <= 420000, 'Each character must draw its own interval between one and seven active-play minutes');
  assert.equal(new Set(timers).size, timers.length, 'Timers must be staggered');
  assert.ok(Math.max(...timers) - Math.min(...timers) > 240000, 'The seeded schedule must exercise a wider range than the old two-to-four-minute window');
  assert.equal(new Set(Object.values(MOMENTS)).size, Object.keys(MOMENTS).length, 'Species must not all perform the same gag');
  for (let frame = 0; frame < 120; frame += 1) island.step();
  assert.equal(island.wildlife.comedy.events.length, 0, 'Normal startup must not unleash comic events');
  island.dispose();
});

test('bird droppings fall physically, cause a nearby Ewww retreat, then clean up', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const bird = island.wildlife.residents.find(resident => resident.species === 'bird');
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  Body.setPosition(bird.body, { x: tortoise.body.position.x + 9, y: island.layout.ground - 80 });
  Body.setVelocity(bird.body, { x: 0, y: 0 });
  island.wildlife.comedy.nextAt.set(bird.id, 0);
  let sawDropping = false;
  let sawEwww = false;
  let sawRetreat = false;
  for (let frame = 0; frame < 240; frame += 1) {
    island.step();
    sawDropping ||= island.wildlife.comedy.droppings.length > 0;
    sawEwww ||= tortoise.ewwUntil > island.time;
    sawRetreat ||= sawEwww && tortoise.state === 'fleeing';
  }
  assert.equal(sawDropping && sawEwww && sawRetreat, true, 'The gag must actually fall and cause the specified nearby reaction');
  assert.equal(island.wildlife.comedy.counts.dropping, 1, 'The bird must not repeatedly poop each frame');
  assert.ok(island.wildlife.comedy.nextAt.get(bird.id) >= 60000);
  for (let frame = 0; frame < 300; frame += 1) island.step();
  assert.equal(island.wildlife.comedy.droppings.length, 0);
  assert.equal(island.wildlife.comedy.events.length, 0);
  assert.equal(island.snapshot().finite, true);
  island.dispose();
});

test('every reschedule redraws the full one-to-seven-minute interval from the current time', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  island.time = 900000;
  for (const fraction of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
    island.wildlife.random = () => fraction;
    island.wildlife.comedy.schedule('blob');
    const interval = island.wildlife.comedy.nextAt.get('blob') - island.time;
    assert.ok(interval >= 60000 && interval <= 420000, 'A redrawn interval cannot exceed seven minutes');
    assert.ok(Math.abs(interval - (60000 + fraction * 360000)) < 0.001, 'Each random draw must control the new interval, not reuse a fixed cadence');
  }
  island.dispose();
});

test('rare events wait while their character is held and respect pause through simulation time', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const fish = island.wildlife.residents[0];
  island.grab(8, fish.body.position, 0);
  island.step();
  island.wildlife.comedy.nextAt.set(fish.id, island.time);
  island.step();
  assert.equal(island.wildlife.comedy.counts['bubble-ring'] || 0, 0);
  const next = island.wildlife.comedy.nextAt.get(fish.id);
  const clock = island.time;
  island.snapshot(); island.snapshot();
  assert.equal(island.time, clock, 'Reading or pausing the game cannot advance gag timers');
  assert.equal(island.wildlife.comedy.nextAt.get(fish.id), next);
  island.release(8); island.dispose();
});

test('Blobby reacts to a gross-out without claiming a player action', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const blobby = island.blobPosition();
  island.wildlife.comedy.grossOut({ x: blobby.x + 15, y: blobby.y + 20 });
  assert.ok(island.blob.ewwUntil > island.time, 'The nearby gag must still trigger Blobby\'s visible reaction');
  assert.equal(Boolean(island.blobHandled), false, 'An autonomous hop must not qualify for player objectives');
  assert.ok(island.blob.particles.some(particle => particle.force.x < 0), 'Blobby must actually hop away from the unpleasant spot');
  island.nudge(1, 0);
  assert.equal(island.blobHandled, true, 'Actual keyboard movement must remain a player action');
  island.dispose();
});

test('mutual interactions accumulate probability and advance both baseline clocks without per-frame spam', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const [first, second] = island.wildlife.residents;
  const comedy = island.wildlife.comedy;
  island.wildlife.random = () => 0.99;
  comedy.schedule(first.id); comedy.schedule(second.id);
  const baseline = comedy.nextAt.get(first.id);
  island.time = 70000;
  island.wildlife.meet('schooling', first, second);
  const firstChance = comedy.activity.get(first.id).chance;
  const firstDeadline = comedy.nextAt.get(first.id);
  assert.ok(firstDeadline < baseline, 'A real social encounter must advance the baseline');
  assert.ok(comedy.nextAt.get(second.id) < baseline, 'Both participants must benefit from a mutual interaction');
  island.wildlife.meet('schooling', second, first);
  assert.equal(comedy.nextAt.get(first.id), firstDeadline, 'Repeated observations in the same frame must not accelerate the clock again');
  for (let encounter = 0; encounter < 5; encounter += 1) {
    island.time += 8500;
    island.wildlife.meet('schooling', first, second);
  }
  assert.ok(comedy.activity.get(first.id).chance > firstChance, 'Frequent encounters must increase the chance beyond an isolated encounter');
  assert.ok(comedy.nextAt.get(first.id) < firstDeadline, 'Continued activity must shorten, never restart or postpone, a pending baseline');
  const busyScore = comedy.activity.get(first.id).score;
  island.time += 180000;
  island.wildlife.meet('schooling', first, second);
  assert.ok(comedy.activity.get(first.id).score < busyScore, 'Accumulated excitement must fade when encounters stop');
  island.dispose();
});

test('an interaction-triggered gag resets its probability and draws a fresh baseline with a cooldown', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const fish = island.wildlife.residents[0];
  const comedy = island.wildlife.comedy;
  island.wildlife.random = () => 0.99;
  comedy.schedule(fish.id); comedy.schedule('blob');
  const oldBaseline = comedy.nextAt.get(fish.id);
  island.time = 70000;
  island.wildlife.random = () => 0;
  island.wildlife.meet('blob-curiosity', fish, { id: 'blob' });
  assert.ok(comedy.nextAt.get(fish.id) < island.time + 1200, 'A successful contextual roll must trigger an early moment');
  island.time += 1300;
  comedy.tick();
  const event = comedy.events.find(item => item.character === fish.id);
  assert.equal(event.source, 'interaction');
  assert.equal(event.trigger.kind, 'blob-curiosity');
  assert.ok(event.time < oldBaseline, 'The comic situation must actually occur ahead of its baseline');
  assert.equal(comedy.activity.get(fish.id).score, 0, 'A completed gag must clear accumulated probability');
  assert.equal(comedy.activity.get(fish.id).trigger, null);
  const resetDeadline = comedy.nextAt.get(fish.id);
  assert.ok(resetDeadline >= island.time + 60000 && resetDeadline <= island.time + 420000, 'Completion must draw a fresh one-to-seven-minute baseline');
  island.wildlife.meet('blob-curiosity', fish, { id: 'blob' });
  assert.equal(comedy.nextAt.get(fish.id), resetDeadline, 'Immediate repeated interactions must respect the fresh cooldown');
  island.dispose();
});

test('comic reactions cannot recursively boost their own timers or overrule a held participant', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const [first, second] = island.wildlife.residents;
  const comedy = island.wildlife.comedy;
  island.time = 70000;
  const unchanged = comedy.snapshot();
  island.wildlife.meet('ewww', first, second);
  assert.deepEqual(comedy.snapshot(), unchanged, 'A gross-out reaction must not start a self-sustaining comic chain');
  island.grab(18, first.body.position, 0);
  island.wildlife.meet('schooling', first, second);
  assert.equal(comedy.activity.get(first.id).notices, 0, 'Held participants must not receive contextual triggers');
  assert.ok(comedy.activity.get(second.id).notices > 0, 'The free participant can still react');
  island.release(18); island.dispose();
});

test('every repertoire varies with bounded history and named signatures are eligible only for their owner', () => {
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, mapId, true);
    try {
      const comedy = island.wildlife.comedy;
      for (const resident of island.wildlife.residents) {
        assert.ok(REPERTOIRE[resident.species].length >= 4);
        const draws = [];
        for (let index = 0; index < 20; index += 1) {
          island.time += 60000;
          comedy.perform(resident); comedy.pending.length = 0;
          const kind = comedy.events.at(-1).kind;
          assert.equal(draws.slice(-3).includes(kind), false, 'A gag cannot repeat in the last three draws');
          if (Object.values(SIGNATURES).includes(kind)) assert.equal(SIGNATURES[resident.id], kind);
          draws.push(kind);
        }
        assert.ok(new Set(draws).size >= 4);
        assert.ok(comedy.history.get(resident.id).length <= 12);
      }
    } finally { island.dispose(); }
  }
});

test('fidgets require drive conflict and yield to held input and objective activity', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const resident = island.wildlife.residents.find(item => item.id === 'mango');
    const comedy = island.wildlife.comedy;
    island.time = 13000;
    comedy.fidgets(); assert.equal(resident.fidget, undefined);
    resident.needs.hunger = 1; resident.foodId = null; resident.state = 'resting'; Body.setVelocity(resident.body, { x: 0, y: 0 });
    comedy.fidgets(); assert.ok(resident.fidgetUntil > island.time);
    const count = comedy.fidgetCounts[resident.fidget];
    island.time += 14000; resident.state = 'foraging'; comedy.fidgets();
    assert.equal(comedy.fidgetCounts[resident.fidget], count);
    resident.state = 'resting'; resident.needs.hunger = 0; comedy.fidgets();
    assert.equal(comedy.fidgetCounts[resident.fidget], count);
  } finally { island.dispose(); }
});

test('moments anticipate before physical action and spatial staging defers overlapping starts', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const comedy = island.wildlife.comedy;
    const bird = island.wildlife.residents.find(item => item.species === 'bird');
    comedy.perform(bird);
    assert.equal(comedy.droppings.length, 0);
    assert.ok(comicPose('dropping', 0.07).anticipation > 0.9);
    island.time = 350; comedy.tick();
    assert.equal(comedy.droppings.length, 1);
    const resident = island.wildlife.residents.find(item => item.id === 'mango');
    Body.setPosition(resident.body, { ...bird.body.position });
    comedy.lastAt = 0; island.time = 1900;
    comedy.nextAt.set(resident.id, 1800);
    comedy.tick();
    assert.equal(comedy.history.has(resident.id), false);
    assert.ok(comedy.nextAt.get(resident.id) > island.time);
    assert.equal(Boolean(island.blobHandled), false);
  } finally { island.dispose(); }
});

test('a priority change during anticipation cancels physical and audio gag actions', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  try {
    const comedy = island.wildlife.comedy;
    const bird = island.wildlife.residents.find(resident => resident.species === 'bird');
    comedy.perform(bird);
    bird.state = 'visiting-flight';
    island.time = 350;
    comedy.tick();
    assert.equal(comedy.droppings.length, 0);
    assert.equal(island.sounds.length, 0);
    assert.equal(bird.anticUntil, island.time);
    assert.equal(comedy.pending.length, 0);
  } finally { island.dispose(); }
});