const test = require('node:test');
const assert = require('node:assert/strict');
const { Body } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

test('land neighbors and bird-fish pairs play without losing residents or interrupting held input', () => {
  for (const [firstSpecies, secondSpecies, event] of [['crab', 'tortoise', 'playful-chase'], ['bird', 'fish', 'bird-fish-play'], ['octopus', 'starfish', 'peekaboo']]) {
    const island = new IslandPhysics(3200, 900, 'pools', true);
    const first = island.wildlife.residents.find(item => item.species === firstSpecies);
    const second = island.wildlife.residents.find(item => item.species === secondSpecies);
    Body.setPosition(second.body, { x: first.body.position.x + 55, y: first.body.position.y + 10 });
    island.time = 15000; island.wildlife.random = () => 0;
    assert.equal(island.wildlife.interactions.play(first, second), true);
    assert.ok(island.wildlife.encounterCounts[event] > 0);
    assert.equal(second.state, 'play-retreat');
    assert.ok(['play-chase', 'peekaboo'].includes(first.state));
    assert.equal(island.wildlife.interactions.play(first, second), false, 'Cooldowns must prevent repeated frame-by-frame gags');
    assert.equal(island.wildlife.residents.length, 13);
    first.behaviorUntil = 0; second.behaviorUntil = 0; island.wildlife.interactions.playAt = 0;
    island.grab(42, island.wildlife.position(second), 0);
    assert.equal(island.wildlife.interactions.play(first, second), false, 'Play must not move an animal held by the player');
    island.dispose();
  }
});

test('a jellyfish tingle is brief, bounded and never harms or claims player control', () => {
  const island = new IslandPhysics(3200, 900, 'lagoon', true);
  const jellyfish = island.wildlife.residents.find(item => item.species === 'jellyfish');
  const fish = island.wildlife.residents[0];
  Body.setPosition(fish.body, { x: jellyfish.body.position.x + 12, y: jellyfish.body.position.y + 5 });
  island.time = 15000;
  assert.equal(island.wildlife.interactions.tingle(jellyfish, fish), true);
  assert.ok(fish.tingleUntil <= island.time + 1200);
  assert.equal(fish.state, 'fleeing');
  assert.equal(island.wildlife.interactions.tingle(jellyfish, fish), false);
  assert.equal(Boolean(island.blobHandled), false);
  assert.equal(island.wildlife.residents.length, 13);
  assert.ok(island.wildlife.interactions.effects.some(effect => effect.kind === 'tingle'));
  island.dispose();
});