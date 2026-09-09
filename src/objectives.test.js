const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

function advance(island, frames) {
  for (let frame = 0; frame < frames; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true);
}

function put(prop, point) {
  Body.setPosition(prop.body, point);
  Body.setVelocity(prop.body, { x: 0, y: 0 });
  Body.setAngularVelocity(prop.body, 0);
}

test('far-shore achievement requires a player-moved jelly, not a viewed or untouched location', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  advance(island, 200);
  const objective = island.objectives.entries[0];
  assert.equal(objective.complete, false, 'Idle play must not complete exploration');
  const center = island.blobPosition();
  for (const particle of island.blob.particles) {
    Body.translate(particle, { x: island.landmarks.far.x - center.x, y: island.landmarks.far.y - 60 - center.y });
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  advance(island, 240);
  assert.equal(objective.complete, false, 'Teleporting the fixture without a player action must not earn an objective');
  island.grab(10, island.blobPosition(), 12);
  advance(island, 120);
  assert.equal(objective.complete, false, 'Holding a jelly over the lookout must not count as settling there');
  island.release(10);
  advance(island, 300);
  assert.equal(objective.complete, true, 'A player-moved and settled jelly must discover the far shore');
  advance(island, 200);
  assert.equal(island.objectives.flourishes.filter(flourish => flourish.id === 'wander').length, 1, 'Completion must only fire once');
  island.dispose();
});

test('shell delivery counts two distinct handled, released, settled shells', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const tortoise = island.wildlife.residents.find(resident => resident.species === 'tortoise');
  Body.setPosition(tortoise.body, { x: island.landmarks.picnic.x - 85, y: island.layout.ground - tortoise.height / 2 });
  const shells = island.props.filter(prop => prop.expeditionId?.startsWith('shell-'));
  const nook = island.landmarks.nook;
  shells.forEach((shell, index) => put(shell, { x: nook.x + (index ? 27 : -27), y: nook.y - shell.radius - 1 }));
  advance(island, 180);
  const objective = island.objectives.entries[1];
  assert.equal(objective.progress, 0, 'Untouched shells must not earn delivery progress');
  island.grab(20, shells[0].body.position, 0);
  island.release(20);
  advance(island, 160);
  assert.equal(objective.progress, 1, 'One distinct shell must count once');
  put(shells[0], { x: nook.x - 160, y: nook.y - shells[0].radius - 1 });
  advance(island, 90);
  assert.equal(objective.progress, 1, 'A completed delivery must survive later movement by a resident');
  island.grab(20, shells[0].body.position, 0); island.release(20);
  advance(island, 160);
  assert.equal(objective.progress, 1, 'Rehandling the same shell cannot count it twice');
  island.grab(21, shells[1].body.position, 0);
  advance(island, 150);
  assert.equal(objective.complete, false, 'A held second shell must not count as a completed delivery');
  island.release(21);
  advance(island, 200);
  assert.equal(objective.complete, true, 'Two settled player deliveries must complete Shell Corner');
  island.dispose();
});

test('the picnic completes from an actual delivery and autonomous shared visit', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const coconut = island.props.find(prop => prop.kind === 'coconut');
  put(coconut, { x: island.landmarks.picnic.x, y: island.layout.ground - coconut.radius - 1 });
  advance(island, 250);
  const picnic = island.objectives.entries[2];
  assert.equal(picnic.complete, false, 'A placed but untouched fixture cannot complete a player objective');
  island.grab(30, coconut.body.position, 0); island.release(30);
  advance(island, 1700);
  assert.equal(picnic.complete, true, 'The tortoise and bird must autonomously complete the delivered-coconut picnic');
  assert.ok(island.wildlife.encounters.some(event => event.kind === 'picnic-visit'));
  const fresh = new IslandPhysics(3200, 900, 'lagoon', true);
  assert.equal(fresh.objectives.snapshot().completed, 0, 'Reset must restore incomplete optional objectives');
  island.dispose(); fresh.dispose();
});

test('reef friendship needs player-guided Blobby and actual responses from three distinct species', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const point = { x: island.landmarks.reef.x, y: island.layout.water + 120 };
  const before = island.blobPosition();
  for (const particle of island.blob.particles) {
    Body.translate(particle, { x: point.x - before.x, y: point.y - before.y });
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  island.wildlife.random = () => 0.55;
  const respond = id => {
    const resident = island.wildlife.residents.find(item => item.id === id);
    Body.setPosition(resident.body, { x: point.x + 75, y: point.y + 15 });
    resident.interactionAt = -10000; resident.until = 0; resident.state = 'wandering';
    assert.equal(island.wildlife.respondToBlob(resident), true, 'The production character decision must react to nearby calm Blobby');
  };
  const objective = island.objectives.entries[3];
  respond('fin');
  assert.equal(objective.progress, 0, 'A fixture placed underwater without player input cannot earn friendship');
  island.grab(55, island.blobPosition(), 0);
  respond('fin');
  assert.equal(objective.progress, 1);
  respond('fin'); respond('pip');
  assert.equal(objective.progress, 1, 'The same fish or a second fish cannot stand in for another species');
  respond('lumi');
  assert.equal(objective.progress, 2);
  respond('ollie');
  assert.equal(objective.complete, true, 'Three actual reef responses must complete the objective');
  respond('fin');
  assert.equal(island.objectives.flourishes.filter(event => event.id === 'friends').length, 1);
  island.release(55); island.dispose();
});

test('the picnic journal names the actual visitors on each map', () => {
  for (const [map, guests] of [['lagoon', 'Moss and Skipper'], ['pools', 'Moss and Piper'], ['sunset', 'Moss and Sail']]) {
    const island = new IslandPhysics(3200, 900, map, true);
    const picnic = island.objectives.snapshot().entries.find(entry => entry.id === 'picnic');
    assert.equal(picnic.detail, `${guests}, together`);
    assert.equal(picnic.complete, false);
    island.dispose();
  }
});