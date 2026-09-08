const test = require('node:test');
const assert = require('node:assert/strict');
const { Body, Query } = require('matter-js');
const { IslandPhysics } = require('./physics.js');

function advance(island, frames) {
  for (let frame = 0; frame < frames; frame += 1) island.step();
  assert.equal(island.snapshot().finite, true, 'Every simulated body must have finite coordinates');
}

test('jelly falls, collides with sand, and retains its volume', () => {
  const island = new IslandPhysics();
  const initial = island.snapshot();
  advance(island, 240);
  const settled = island.snapshot();
  assert.ok(settled.blob.y > initial.blob.y + 30, 'Gravity must move the blob down');
  assert.ok(settled.blob.y < island.layout.ground, 'The blob must remain above the solid beach');
  assert.ok(settled.blob.area > initial.blob.area * 0.55, 'The soft mesh must not collapse on the ground');
  assert.ok(Math.abs(settled.blob.velocity.y) < 1, 'The blob should settle after a fall');
  island.dispose();
});

test('touch spring lifts the jelly, releases momentum, and survives repeated pulls', () => {
  const island = new IslandPhysics();
  advance(island, 120);
  const origin = island.blobPosition();
  assert.equal(island.grab(1, origin, 15).kind, 'blob');
  for (let frame = 0; frame < 120; frame += 1) {
    island.move(1, { x: origin.x + frame * 2, y: origin.y - 190 });
    island.step();
  }
  assert.ok(island.blobPosition().y < origin.y - 100, 'A touch must lift the whole jelly');
  const beforeRelease = island.blobPosition();
  island.release(1);
  advance(island, 12);
  assert.ok(island.blobPosition().x > beforeRelease.x + 5, 'Release must preserve horizontal momentum');
  for (let trial = 0; trial < 16; trial += 1) {
    island.grab(2, island.blobPosition(), 12);
    island.move(2, { x: trial % 2 ? 120 : 1260, y: 170 });
    advance(island, 90);
    island.release(2);
    advance(island, 120);
  }
  assert.equal(island.drags.size, 0);
  assert.ok(island.snapshot().blob.area > 1000, 'Repeated hard pulls must not invert or destroy the jelly');
  island.dispose();
});

test('multiple fingers can hold and release the blob independently', () => {
  const island = new IslandPhysics();
  const center = island.blobPosition();
  assert.ok(island.grab(11, { x: center.x - 28, y: center.y }, 8));
  assert.ok(island.grab(12, { x: center.x + 28, y: center.y }, 8));
  island.move(11, { x: center.x - 85, y: center.y - 70 });
  island.move(12, { x: center.x + 85, y: center.y - 70 });
  advance(island, 90);
  assert.equal(island.drags.size, 2);
  island.release(11);
  assert.equal(island.drags.size, 1);
  island.releaseAll();
  assert.equal(island.drags.size, 0);
  advance(island, 240);
  assert.ok(island.snapshot().blob.area > 1000, 'A two-finger stretch must recover');
  island.dispose();
});

test('two fingers reshape the jelly into a long blob and it recovers after release', () => {
  const island = new IslandPhysics();
  const center = island.blobPosition();
  const widthOf = () => {
    const positions = island.blob.ring.map(particle => particle.position.x);
    return Math.max(...positions) - Math.min(...positions);
  };
  const initialWidth = widthOf();
  const left = island.grab(21, { x: center.x - 22, y: center.y }, 18);
  const right = island.grab(22, { x: center.x + 22, y: center.y }, 18);
  assert.ok(left && right, 'Both fingers must acquire the jelly');
  assert.notEqual(left.body.id, right.body.id, 'Each finger must hold a different mesh point');
  island.move(21, { x: center.x - 125, y: center.y - 90 });
  island.move(22, { x: center.x + 125, y: center.y - 90 });
  advance(island, 120);
  assert.ok(widthOf() > initialWidth * 2.3, 'Two fingers must visibly elongate the jelly, not translate a rigid ball');
  assert.ok(island.snapshot().blob.area > 1000, 'A held stretch must remain a filled blob');
  island.releaseAll();
  advance(island, 420);
  assert.ok(widthOf() < initialWidth * 1.65, 'Released jelly must elastically recover');
  assert.ok(island.snapshot().blob.area > 1000, 'Recovery must not collapse or invert the mesh');
  island.dispose();
});

test('floating toys settle at the water surface instead of sinking or launching', () => {
  const island = new IslandPhysics();
  advance(island, 1200);
  for (const kind of ['ball', 'raft', 'coconut']) {
    const prop = island.props.find(item => item.kind === kind);
    assert.ok(Math.abs(prop.body.position.y - island.layout.water) < 48, `${kind} must float at the surface`);
    assert.ok(Math.abs(prop.body.velocity.y) < 0.8, `${kind} must reach a calm buoyant equilibrium`);
  }
  const offset = { x: island.width * 0.72 - island.blobPosition().x, y: island.layout.water - 90 - island.blobPosition().y };
  for (const particle of island.blob.particles) {
    Body.translate(particle, offset);
    Body.setVelocity(particle, { x: 0, y: 0 });
  }
  advance(island, 900);
  assert.ok(Math.abs(island.blobPosition().y - island.layout.water) < 58, 'The jelly must float near the surface');
  assert.ok(island.snapshot().blob.area > 1000, 'Buoyancy must preserve the soft body');
  island.dispose();
});

test('portrait and tablet worlds remain contained during extended simulation', () => {
  for (const width of [416, 675, 1200, 1800]) {
    const island = new IslandPhysics(width, 900);
    advance(island, 1200);
    const state = island.snapshot();
    for (const body of [state.blob, ...state.props]) {
      assert.ok(body.x >= -5 && body.x <= width + 5, `A body must remain inside a ${width}-unit viewport`);
      assert.ok(body.y < 900, 'The floor must contain all bodies');
    }
    island.dispose();
  }
});

test('the palm holds its coconuts until a real jelly collision knocks one down', () => {
  const island = new IslandPhysics();
  advance(island, 600);
  assert.equal(island.tree.snapshot().attached, 3, 'Idle trees must not spontaneously shed coconuts');
  const target = island.tree.snapshot().hitTarget;
  const center = island.blobPosition();
  const initialFruitY = island.tree.fruits[0].body.position.y;
  const initialPropCount = island.props.length;
  for (const particle of island.blob.particles) {
    Body.translate(particle, { x: target.x + 100 - center.x, y: target.y - 16 - center.y });
    Body.setVelocity(particle, { x: -9, y: 0 });
  }
  for (let frame = 0; frame < 70 && island.tree.snapshot().dropped === 0; frame += 1) island.step();
  assert.ok(island.tree.impacts > 0, 'The jelly must physically collide with the trunk');
  assert.equal(island.tree.snapshot().dropped, 1, 'One impact must release one coconut, not one per mesh particle');
  assert.equal(island.props.length, initialPropCount + 1, 'The detached coconut must join the playable objects');
  const detached = island.props.find(prop => prop.palmSlot === 0);
  assert.ok(detached, 'The detached object must be the original hanging coconut');
  advance(island, 100);
  assert.ok(detached.body.position.y > initialFruitY + 60, 'Released coconuts must fall under gravity');
  assert.ok(Math.hypot(island.tree.snapshot().base.x - island.tree.base.x, island.tree.snapshot().base.y - island.tree.base.y) < 3, 'The palm must remain rooted after a crash');
  island.dispose();
});

test('touching and dragging the palm sways it and can shake coconuts loose', () => {
  const island = new IslandPhysics();
  advance(island, 120);
  const crown = island.tree.crown();
  const grab = island.grab(31, crown, 12);
  assert.equal(grab.kind, 'tree', 'The palm canopy must accept a touch');
  island.move(31, { x: crown.x + 160, y: crown.y + 30 });
  advance(island, 60);
  assert.ok(Math.abs(island.tree.body.angle) > 0.06, 'The palm must visibly sway under a finger');
  assert.ok(island.tree.snapshot().dropped >= 1, 'A deliberate shake must release a coconut');
  island.release(31);
  advance(island, 360);
  assert.ok(Math.abs(island.tree.body.angle) < 0.12, 'The rooted palm must spring back upright');
  assert.ok(island.props.length <= island.map.toys.length + 3, 'The finite canopy must bound the coconut population');
  island.dispose();
});

test('every island has distinct scenery and stable interactive objects at tablet and phone widths', () => {
  const { MAPS } = require('./maps.js');
  assert.equal(MAPS.length, 3, 'Three distinct island areas must be available');
  for (const map of MAPS) {
    for (const width of [416, 900, 1440]) {
      const island = new IslandPhysics(width, 900, map.id);
      assert.equal(island.map.id, map.id);
      assert.ok(island.props.length >= 6, 'Each map needs at least six physical toys');
      advance(island, 900);
      assert.ok(island.snapshot().blob.area > 1000, 'Map-specific scenery must not destroy the jelly');
      for (const prop of island.props) {
        assert.ok(prop.body.position.x > -12 && prop.body.position.x < width + 12, 'Every toy must stay on its island');
        assert.ok(prop.body.position.y < 900, 'Every toy must remain above the bottom boundary');
      }
      assert.ok(Math.abs(island.tree.body.angle) < 0.2, 'Each island palm must remain rooted and upright');
      island.dispose();
    }
  }
});

test('resizing an island preserves fallen coconuts and stretched jelly without stranded grabs', () => {
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const previous = new IslandPhysics(1440, 900, mapId);
    advance(previous, 90);
    previous.tree.detach(1);
    previous.tree.detach(0);
    previous.grab(77, previous.blobPosition(), 18);
    const next = new IslandPhysics(675, 900, mapId);
    next.restoreFrom(previous);
    assert.equal(next.map.id, mapId);
    assert.equal(next.tree.snapshot().attached, 1, 'Rotation must not regenerate fallen coconuts');
    assert.equal(next.props.length, previous.props.length, 'Rotation must retain every toy without duplicates');
    assert.deepEqual(next.props.filter(prop => Number.isInteger(prop.palmSlot)).map(prop => prop.palmSlot), [1, 0], 'Coconuts must retain their identities, including release order');
    assert.equal(next.drags.size, 0, 'A resized world must not retain stale touch constraints');
    advance(next, 360);
    assert.ok(next.snapshot().blob.area > 1000, 'The resized soft body must remain intact');
    previous.dispose();
    next.dispose();
  }
});

test('settled islands do not repeatedly emit splash sounds but new water entries still do', () => {
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    const island = new IslandPhysics(1440, 900, mapId);
    advance(island, 900);
    island.splashes.length = 0;
    island.sounds.length = 0;
    let idleSplashes = 0;
    let idleSounds = 0;
    for (let frame = 0; frame < 2100; frame += 1) {
      island.step();
      idleSplashes += island.splashes.splice(0).filter(splash => splash.strength > 0.9).length;
      idleSounds += island.sounds.splice(0).length;
    }
    assert.equal(idleSplashes, 0, `${mapId} must remain free of repetitive idle splash sounds`);
    assert.equal(idleSounds, 0, `${mapId} must not make impact sounds while idle`);
    const ball = island.props.find(prop => prop.kind === 'ball');
    Body.setPosition(ball.body, { x: island.width * 0.74, y: island.layout.water - 160 });
    Body.setVelocity(ball.body, { x: 0, y: 0 });
    advance(island, 90);
    assert.ok(island.splashes.some(splash => splash.strength > 0.9), 'A new throw into the water must still splash');
    assert.ok(island.sounds.some(sound => sound.kind === 'splash'), 'A real water entry must queue the distinct splash sound');
    island.dispose();
  }
});

test('the float ring has a real open centre and a collidable rubber rim', () => {
  const island = new IslandPhysics();
  const ring = island.props.find(prop => prop.kind === 'ring');
  assert.equal(Query.point([ring.body], ring.body.position).length, 0, 'A hollow ring must not have an invisible solid centre');
  assert.equal(Query.point([ring.body], { x: ring.body.position.x + ring.radius * 0.77, y: ring.body.position.y }).length, 1, 'The visible rim must physically collide');
  island.dispose();
});

test('a weight tips the seesaw while its physical pivot remains anchored', () => {
  const island = new IslandPhysics(1440, 900, 'sunset');
  const center = island.blobPosition();
  for (const particle of island.blob.particles) Body.translate(particle, { x: island.width * 0.72 - center.x, y: -100 });
  advance(island, 240);
  const seesaw = island.props.find(prop => prop.kind === 'seesaw');
  const crate = island.props.find(prop => prop.kind === 'crate');
  Body.setPosition(crate.body, { x: seesaw.anchor.x + seesaw.width * 0.34, y: seesaw.anchor.y - 60 });
  Body.setVelocity(crate.body, { x: 0, y: 0 });
  Body.setAngle(crate.body, 0);
  let maximumTilt = 0;
  for (let frame = 0; frame < 100; frame += 1) {
    island.step();
    maximumTilt = Math.max(maximumTilt, seesaw.body.angle);
  }
  assert.ok(maximumTilt > 0.15, 'A crate landing on one side must tip the board under gravity');
  assert.ok(Math.hypot(seesaw.body.position.x - seesaw.anchor.x, seesaw.body.position.y - seesaw.anchor.y) < 2, 'The pivot must remain in place');
  assert.equal(island.snapshot().finite, true);
  island.dispose();
});