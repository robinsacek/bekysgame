const test = require('node:test');
const assert = require('node:assert/strict');
const { encounterResponse, AGENDAS } = require('./encounters.js');
const { IslandPhysics } = require('./physics.js');

test('each species pair has an appropriate response and each resident has an agenda', () => {
  for (const first of Object.keys(AGENDAS)) for (const second of Object.keys(AGENDAS)) assert.equal(typeof encounterResponse(first, second), 'string');
  assert.equal(encounterResponse('fish', 'fish'), 'school');
  assert.equal(encounterResponse('fish', 'shark'), 'give-space');
  assert.equal(encounterResponse('bird', 'fish'), 'watch');
  assert.notEqual(encounterResponse('rabbit', 'lizard'), encounterResponse('octopus', 'crab'));
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(3200, 900, mapId, true);
    for (const resident of island.wildlife.residents) assert.equal(typeof resident.agenda, 'string');
    island.dispose();
  }
});

test('an occasional shark chase produces fleeing and a cartoon snap, with no lost residents', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  island.wildlife.interactions.huntAt = 0;
  let hunted = false;
  let fled = false;
  let snapped = false;
  for (let frame = 0; frame < 1800; frame += 1) {
    island.step();
    hunted ||= island.wildlife.residents.some(resident => ['stalking', 'lunging'].includes(resident.state));
    fled ||= island.wildlife.residents.some(resident => resident.state === 'fleeing');
    snapped ||= island.wildlife.residents.some(resident => resident.snapUntil > island.time);
  }
  assert.equal(hunted && fled && snapped, true, 'A hunt must actually stalk, scatter prey, and visibly snap');
  assert.equal(island.wildlife.residents.length, 13);
  assert.equal(island.snapshot().finite, true);
  assert.ok(island.wildlife.interactions.huntAt > island.time - 6000, 'Hunts must have a substantial cooldown');
  island.dispose();
});

test('held characters frown in an unsuitable medium and relax after returning', () => {
  for (const species of ['fish', 'tortoise', 'bird']) {
    const island = new IslandPhysics(3200, 900, 'lagoon', true);
    const resident = island.wildlife.residents.find(item => item.species === species);
    island.grab(19, island.wildlife.position(resident), 0);
    island.move(19, species === 'fish' ? { x: island.landmarks.reef.x, y: 330 } : { x: island.landmarks.reef.x, y: island.layout.water + 110 });
    for (let frame = 0; frame < 220; frame += 1) island.step();
    assert.equal(resident.frown, true, `${species} must visibly object to an unsuitable environment`);
    island.release(19);
    for (let frame = 0; frame < 2700; frame += 1) island.step();
    assert.equal(resident.frown, false, 'Habitat recovery must clear the unhappy expression');
    island.dispose();
  }
});