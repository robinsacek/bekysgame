const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Bodies, Composite } = require('matter-js');
const { IslandPhysics } = require('./physics.js');
const { DIETS, FOODS, MAX_PORTIONS } = require('./foraging.js');
const { feedingPose } = require('./creature-pose.js');

function offerFixture(food = 'plankton') {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const foraging = island.wildlife.foraging;
  const resident = island.wildlife.residents.find(item => item.species === 'fish');
  const source = foraging.patches.find(item => item.food === food);
  const portion = foraging.harvest(source, true);
  Body.setPosition(resident.body, { x: island.wildlife.water.minX + 250, y: island.layout.water + 155 });
  Body.setVelocity(resident.body, { x: 0, y: 0 });
  resident.direction = 1; resident.frown = false; resident.until = 0; resident.behaviorUntil = 0;
  const mouth = foraging.mouthFor(resident);
  Body.setPosition(portion.body, { x: mouth.x + 24, y: mouth.y });
  portion.depth = 0; portion.depthTarget = 0;
  const tick = (frames = 100) => {
    for (let frame = 0; frame < frames; frame += 1) { island.time += 1000 / 60; foraging.tick(); foraging.act(resident); }
  };
  return { island, foraging, resident, source, portion, tick };
}

test('a calm held offer consumes exactly once, updates needs and preserves another independent grip', () => {
  const { island, foraging, resident, source, portion, tick } = offerFixture();
  const second = island.props.find(prop => prop.kind === 'ball');
  assert.equal(island.grab(41, portion.body.position)?.body, portion.body);
  assert.equal(island.grab(42, second.body.position)?.body, second.body);
  const otherConstraint = island.drags.get(42).constraint;
  tick(40);
  assert.equal(resident.meals, 0);
  assert.equal(resident.state, 'feeding');
  tick(60);
  assert.equal(resident.meals, 1);
  assert.equal(resident.needs.hunger, 0);
  assert.equal(resident.lastMeal.assisted, true);
  assert.equal(resident.lastMeal.portionId, portion.portionId);
  assert.ok(resident.mealHeartUntil > island.time && resident.satisfiedUntil > resident.mealHeartUntil);
  assert.equal(island.drags.has(41), false);
  assert.equal(island.drags.get(42).constraint, otherConstraint);
  assert.equal(Composite.allBodies(island.engine.world).includes(portion.body), false);
  assert.equal(foraging.consume(resident, portion), false);
  assert.equal(foraging.harvest(source, true), null);
  island.time = source.readyAt + 1;
  const renewed = foraging.harvest(source, true);
  assert.notEqual(renewed.portionId, portion.portionId);
  assert.equal(foraging.consume(resident, portion), false);
  assert.equal(resident.meals, 1);
  island.dispose();
});

test('released offers use the same calm dwell and cancelled food drags cannot credit a meal', () => {
  const fixture = offerFixture();
  const { island, resident, portion, tick } = fixture;
  island.grab(1, portion.body.position); tick(40); island.release(1); tick(40);
  assert.equal(resident.meals, 0, 'Release restarts the calm bite');
  tick(60);
  assert.equal(resident.meals, 1);
  island.dispose();
  const cancelled = offerFixture();
  cancelled.island.grab(1, cancelled.portion.body.position); cancelled.tick(40); cancelled.island.release(1, true); cancelled.tick(100);
  assert.equal(cancelled.resident.meals, 0);
  assert.equal(cancelled.resident.satisfiedUntil, 0);
  assert.equal(cancelled.foraging.live(cancelled.portion), false);
  cancelled.island.dispose();
});

test('wrong food, fast passes, depth, medium, barriers and higher priorities reject meals and satisfaction', () => {
  for (const invalid of ['food', 'speed', 'depth', 'medium', 'barrier', 'held', 'recovery', 'fright', 'moved-away', 'expired']) {
    const { island, foraging, resident, portion, tick } = offerFixture(invalid === 'food' ? 'grass' : 'plankton');
    tick(25);
    if (invalid === 'speed') Body.setVelocity(portion.body, { x: 6, y: 0 });
    if (invalid === 'depth') portion.depth = 55;
    if (invalid === 'medium') Body.setPosition(portion.body, { x: portion.body.position.x, y: island.layout.water - 30 });
    if (invalid === 'barrier') {
      const barrier = Bodies.rectangle(portion.body.position.x - 4, portion.body.position.y, 8, 70, { isStatic: true });
      island.rocks.push(barrier); Composite.add(island.engine.world, barrier);
    }
    if (invalid === 'held') island.grab(44, resident.body.position);
    if (invalid === 'recovery') resident.recovery = 'flopping';
    if (invalid === 'fright') { resident.state = 'fleeing'; resident.until = 9000; }
    if (invalid === 'moved-away') { island.grab(45, portion.body.position); island.move(45, { x: portion.body.position.x + 150, y: portion.body.position.y }); }
    if (invalid === 'expired') { portion.reservedBy = 'pip'; portion.reservedUntil = 9000; }
    tick(120);
    assert.equal(resident.meals, 0, invalid);
    assert.equal(resident.mealHeartUntil, 0, invalid);
    assert.equal(resident.satisfiedUntil, 0, invalid);
    assert.equal(foraging.live(portion), true, invalid);
    island.dispose();
  }
});

test('food competition and repeated depletion remain bounded with fresh ownership', () => {
  const { island, foraging, resident, source, portion, tick } = offerFixture();
  const other = island.wildlife.residents.find(item => item.id === 'pip');
  Body.setPosition(other.body, { x: resident.body.position.x, y: resident.body.position.y + 32 }); other.until = 0;
  foraging.act(resident);
  assert.equal(foraging.reserve(other, portion), false);
  island.grab(31, resident.body.position);
  assert.equal(portion.reservedBy, null);
  assert.equal(foraging.reserve(other, portion), true);
  foraging.cancel(other); island.release(31);
  tick();
  assert.equal(resident.meals, 1);
  for (let cycle = 0; cycle < 12; cycle += 1) {
    island.time = source.readyAt + 1;
    const renewed = foraging.harvest(source, true);
    assert.equal(foraging.harvest(source, true), null);
    assert.equal(foraging.retire(renewed), true);
    assert.equal(foraging.retire(renewed), false);
  }
  island.time += 32001;
  for (const patch of foraging.patches) foraging.harvest(patch);
  assert.equal(foraging.portions.size, MAX_PORTIONS);
  assert.equal(island.props.filter(prop => prop.kind === 'food').length, MAX_PORTIONS);
  island.time += 60001; foraging.tick();
  assert.equal(foraging.portions.size, 0);
  assert.equal(island.wildlife.residents.length, 10);
  island.dispose();
});

test('every species on every map has reachable renewable food including seaweed, bait, swarms and both rabbit plants', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const foraging = island.wildlife.foraging;
    for (const resident of island.wildlife.residents) {
      const patches = foraging.patches.filter(patch => foraging.accepts(resident, patch.food));
      assert.ok(patches.length > 0, `${map}/${resident.id} needs compatible sources`);
      assert.ok(patches.some(patch => {
        const target = foraging.targetFor(resident, patch);
        return target.x > resident.width && target.x < island.width - resident.width && target.y < island.height
          && (FOODS[patch.food].medium !== 'water' || island.floorAt(patch.x) > island.layout.water + 60);
      }), `${map}/${resident.id} needs an accessible source`);
      assert.ok(patches.every(patch => patch.readyAt === 0 && patch.portionId === null && patch.generation === 0));
    }
    const fish = island.wildlife.residents.find(resident => resident.species === 'fish');
    const shark = island.wildlife.residents.find(resident => resident.species === 'shark');
    assert.ok(foraging.accepts(fish, 'algae'));
    assert.ok(foraging.accepts(shark, 'bait-fish'));
    assert.equal(foraging.accepts(shark, 'fish'), false, 'Named residents are never food');
    assert.ok(foraging.patches.some(patch => patch.food === 'insects'));
    if (map === 'sunset') {
      const rabbit = island.wildlife.residents.find(resident => resident.species === 'rabbit');
      for (const food of ['grass', 'carrot']) {
        assert.ok(foraging.accepts(rabbit, food));
        assert.ok(foraging.patches.some(patch => patch.food === food));
      }
    }
    island.dispose();
  }
});

test('every species including sharks can approach its own food and complete a replenishing meal', () => {
  for (const species of Object.keys(DIETS)) {
    const map = species === 'starfish' ? 'pools' : species === 'rabbit' ? 'sunset' : 'lagoon';
    const island = new IslandPhysics(3200, 900, map, true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    const patch = island.wildlife.foraging.patches.find(item => item.food === resident.diet.food);
    const target = island.wildlife.foraging.targetFor(resident, patch);
    Body.setPosition(resident.body, { x: target.x, y: target.y }); Body.setVelocity(resident.body, { x: 0, y: 0 });
    resident.depth = target.depth; resident.depthTarget = target.depth; resident.foodAt = 0; resident.until = 0;
    for (let frame = 0; frame < 220; frame += 1) island.step();
    assert.ok(resident.meals >= 1, `${species} must actually feed using its production routine`);
    assert.ok(patch.visits >= 1 && patch.readyAt > island.time, 'An eaten patch must briefly replenish instead of yielding food every frame');
    assert.ok(island.wildlife.encounterCounts['food-found'] > 0);
    assert.equal(island.wildlife.residents.length, 10, 'Feeding must not consume named residents');
    island.dispose();
  }
});

test('holding and a delivered picnic take priority over ordinary foraging', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const fish = island.wildlife.residents[0]; fish.foodAt = 0;
  island.grab(41, fish.body.position, 0);
  assert.equal(island.wildlife.foraging.act(fish), false);
  island.release(41);
  const food = island.props.find(prop => prop.kind === 'coconut');
  Body.setPosition(food.body, { x: island.landmarks.picnic.x, y: island.layout.ground - food.radius });
  Body.setVelocity(food.body, { x: 0, y: 0 }); food.playerHandled = true;
  for (const resident of island.wildlife.residents.filter(item => ['bird', 'tortoise'].includes(item.species))) {
    resident.foodAt = 0;
    assert.equal(island.wildlife.foraging.act(resident), false, 'The journal picnic must retain priority over background feeding');
  }
  const grass = island.wildlife.foraging.patches.filter(patch => patch.food === 'grass');
  assert.ok(grass.length >= 15 && new Set(grass.map(patch => patch.depth)).size > 4, 'Grass patches must cover the usable beach depth');
  const point = { x: grass[0].x, y: grass[0].y + grass[0].depth - 10 };
  assert.equal(island.wildlife.foraging.touch(point).id, grass[0].id, 'Grass must react at its actual visible depth');
  assert.ok(grass[0].touchedUntil > island.time);
  assert.ok(island.sounds.some(sound => sound.kind === 'rustle'));
  island.dispose();
});

test('Lagoon and Cove birds can catch surface bait without leaving their suitable flight medium', () => {
  for (const map of ['lagoon', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const foraging = island.wildlife.foraging;
    const bird = island.wildlife.residents.find(resident => resident.species === 'bird');
    const source = foraging.patches.find(patch => patch.food === 'bait-fish' && foraging.clearTarget(bird, patch));
    const target = foraging.targetFor(bird, source);
    Body.setPosition(bird.body, target); Body.setVelocity(bird.body, { x: 0, y: 0 });
    bird.foodAt = 0; bird.until = 0;
    for (let frame = 0; frame < 280; frame += 1) island.step();
    assert.ok(bird.meals > 0, `${map} bird must actually consume surface bait`);
    assert.equal(bird.lastMeal.food, 'bait-fish');
    assert.equal(bird.frown, false);
    assert.equal(bird.recovery, '');
    island.dispose();
  }
});

test('a player offer prefers the nearby recipient over an earlier but more distant compatible resident', () => {
  const { island, foraging, resident, portion } = offerFixture();
  const other = island.wildlife.residents.find(item => item.id === 'pip');
  Body.setPosition(other.body, { x: portion.body.position.x - 20, y: portion.body.position.y });
  Body.setPosition(resident.body, { x: portion.body.position.x - 130, y: portion.body.position.y });
  other.until = 0;
  assert.equal(foraging.nearbyOffer(resident), null);
  assert.equal(foraging.nearbyOffer(other), portion);
  assert.equal(foraging.reserve(resident, portion), false);
  assert.equal(foraging.reserve(other, portion), true);
  assert.equal(foraging.reserve(resident, portion), false, 'An existing live reservation is not stolen');
  island.dispose();
});

test('expired reservations restart dwell and unreachable food recycles without taking held portions', () => {
  const { island, foraging, resident, portion, source, tick } = offerFixture();
  tick(60);
  island.time += 1100;
  foraging.tick();
  assert.equal(portion.reservedBy, null);
  assert.equal(resident.feedingSince, null);
  assert.equal(foraging.consume(resident, portion), false);
  tick(60);
  assert.equal(resident.meals, 0, 'An expired bite cannot keep its previous dwell');
  tick(40);
  assert.equal(resident.meals, 1);
  island.time = source.readyAt + 1;
  const renewed = foraging.harvest(source, true);
  Body.setPosition(renewed.body, { x: 180, y: island.layout.ground - 70 });
  assert.equal(island.grab(51, renewed.body.position)?.body, renewed.body);
  island.time += 65000; foraging.tick();
  assert.equal(foraging.live(renewed), true, 'A held portion remains under player control even outside its habitat');
  island.release(51); foraging.tick();
  assert.equal(foraging.live(renewed), false);
  assert.equal(resident.meals, 1, 'Recycling does not count as eating');
  assert.ok(source.readyAt > island.time);
  const abandonedSource = foraging.patches.find(patch => patch.food === 'bait-fish');
  const abandoned = foraging.harvest(abandonedSource);
  Body.setPosition(abandoned.body, { x: 180, y: island.layout.ground - 70 });
  foraging.tick(); island.time += 8001; foraging.tick();
  assert.equal(foraging.live(abandoned), false, 'Stranded food returns to its bounded source lifecycle');
  assert.equal(abandonedSource.visits, 0);
  island.dispose();
});

test('untouched maps sustain real autonomous meals, chewing and satisfaction for every individual', () => {
  for (const map of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, map, true);
    const foraging = island.wildlife.foraging;
    const observed = new Map(island.wildlife.residents.map(resident => [resident.id, { meals: 0, openings: new Set(), happy: false, heart: false, otherActivity: false }]));
    const consumed = new Set();
    for (let frame = 0; frame < 26100; frame += 1) {
      island.step();
      assert.ok(foraging.portions.size <= MAX_PORTIONS, `${map} food bodies remain bounded`);
      for (const resident of island.wildlife.residents) {
        const sample = observed.get(resident.id);
        const pose = feedingPose(resident, island.time);
        if (pose.eating) sample.openings.add(Math.round(pose.open * 10));
        sample.happy ||= pose.smile > 0.8; sample.heart ||= pose.heart;
        sample.otherActivity ||= !['feeding', 'seeking-food', 'held'].includes(resident.state);
        if (resident.meals === sample.meals) continue;
        assert.equal(resident.meals, sample.meals + 1, `${map}/${resident.id} records one meal per consumption`);
        assert.equal(resident.lastMeal.assisted, false);
        assert.equal(consumed.has(resident.lastMeal.portionId), false, 'A lifecycle cannot credit two meals or eaters');
        assert.equal(foraging.portions.has(resident.lastMeal.portionId), false);
        assert.equal(resident.mealHeartUntil, resident.lastMeal.time + 2000);
        assert.equal(resident.satisfiedUntil, resident.lastMeal.time + 5000);
        assert.ok(resident.needs.hunger < 0.001, 'A completed autonomous meal updates hunger');
        consumed.add(resident.lastMeal.portionId); sample.meals = resident.meals;
      }
    }
    for (const [id, sample] of observed) {
      assert.ok(sample.meals > 0, `${map}/${id} autonomously reaches and consumes food`);
      assert.ok(sample.openings.size > 5, `${map}/${id} visibly opens and closes its mouth during actual bites`);
      assert.ok(sample.happy && sample.heart && sample.otherActivity, `${map}/${id} shows satisfaction and keeps its other activities`);
    }
    assert.equal(foraging.patches.reduce((sum, source) => sum + source.visits, 0), consumed.size);
    assert.ok(foraging.patches.some(source => source.food === 'bait-fish' && source.visits > 1), 'Eaten bait replenishes and can be eaten in a fresh lifecycle');
    assert.equal(island.wildlife.residents.length, 10);
    assert.equal(island.objectives.snapshot().completed, 0);
    assert.equal(island.drags.size, 0);
    island.dispose();
  }
});