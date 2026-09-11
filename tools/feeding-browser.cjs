const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const readState = page => page.evaluate(() => window.__blobIsland.snapshot());
const LAND = new Set(['crab', 'tortoise', 'lizard', 'rabbit', 'monkey', 'frog']);

async function screenPoint(page, point) {
  const state = await readState(page);
  const bounds = await page.locator('#world').boundingBox();
  return { x: bounds.x + Math.max(10, Math.min(bounds.width - 10, (point.x - state.camera.x) / state.camera.width * bounds.width)),
    y: bounds.y + point.y / state.height * bounds.height };
}

async function seek(page, positionX) {
  const overview = page.locator('#coast-overview');
  const bounds = await overview.boundingBox();
  await overview.click({ force: true, position: { x: Math.max(1, Math.min(bounds.width - 1, positionX / 3200 * bounds.width)), y: bounds.height / 2 } });
  await page.clock.runFor(34);
}

async function inputFor(page, config) {
  const session = config.nativeTouch ? await page.context().newCDPSession(page) : null;
  const contacts = new Map();
  return {
    async send(type, point, id = 81) {
      const screen = await screenPoint(page, point);
      if (session) {
        if (type === 'down' || type === 'move') contacts.set(id, { ...screen, id }); else contacts.delete(id);
        await session.send('Input.dispatchTouchEvent', { type: type === 'down' ? 'touchStart' : type === 'move' ? 'touchMove' : 'touchEnd', touchPoints: [...contacts.values()] });
      } else if (config.touch) {
        await page.dispatchEvent('#world', `pointer${type}`, { pointerId: id, pointerType: 'touch', isPrimary: true, button: 0,
          buttons: type === 'up' || type === 'cancel' ? 0 : 1, clientX: screen.x, clientY: screen.y, bubbles: true, cancelable: true });
      } else {
        await page.mouse.move(screen.x, screen.y);
        if (type === 'down') await page.mouse.down();
        if (type === 'up' || type === 'cancel') await page.mouse.up();
      }
      await page.clock.runFor(34);
    },
    async close() {
      if (!session) return;
      try { if (contacts.size) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      finally { contacts.clear(); await session.detach(); }
    },
  };
}

async function carryResident(page, input, id, destination, settle = false) {
  let resident = (await readState(page)).creatures.find(item => item.id === id);
  await seek(page, resident.x);
  let offset;
  for (let layer = 0; layer < 3 && !offset; layer += 1) {
    for (const position of [{ x: 0, y: 0 }, { x: 0.33, y: -0.2 }, { x: -0.33, y: 0.2 }]) {
      resident = (await readState(page)).creatures.find(item => item.id === id);
      const point = { x: resident.x + resident.width * position.x, y: resident.y + resident.height * position.y };
      await input.send('down', point);
      const state = await readState(page);
      if (state.creatures.find(item => item.id === id).held) { offset = { x: point.x - resident.x, y: point.y - resident.y }; break; }
      const covering = state.creatures.find(item => item.held);
      if (covering) {
        const clear = { x: covering.x + (covering.x < resident.x ? -145 : 145), y: covering.y - 55 };
        await input.send('move', clear);
        await page.clock.runFor(700);
        await input.send('up', clear);
        break;
      }
      await input.send('up', point);
    }
  }
  assert.ok(offset, `${id} must be acquired through the actual input handler`);
  for (let attempt = 0; attempt < 140; attempt += 1) {
    const target = { x: destination.x + offset.x, y: destination.y + offset.y };
    await input.send('move', target); await page.clock.runFor(100);
    resident = (await readState(page)).creatures.find(item => item.id === id);
    if (Math.hypot(resident.x - destination.x, resident.y - destination.y) < 18
      && (!settle || Math.hypot(resident.velocity.x, resident.velocity.y) < 0.45)) break;
  }
  assert.ok(Math.hypot(resident.x - destination.x, resident.y - destination.y) < 22, `${id} must reach the clear feeding area by real dragging`);
  assert.ok(!settle || Math.hypot(resident.velocity.x, resident.velocity.y) < 0.45, 'Deliberate pad placement must settle before release');
  await input.send('up', { x: destination.x + offset.x, y: destination.y + offset.y });
  await page.clock.runFor(650);
}

async function capture(page, output, name, stage, id) {
  const state = await readState(page);
  const resident = state.creatures.find(item => item.id === id);
  await page.screenshot({ path: path.join(output, `feeding-${name}-${stage}.png`) });
  return { time: state.time, resident, bubble: state.bubbles?.find(bubble => bubble.id === id) || null,
    props: state.props.filter(prop => prop.kind === 'food'), camera: state.camera };
}

async function mealCase(page, input, config, output, request) {
  await page.locator(`[data-map="${request.map}"]`).click({ force: true });
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1600);
  let state = await readState(page);
  let recipient = state.creatures.find(resident => resident.id === request.id);
  const sources = state.foodPatches.filter(source => source.food === request.food && source.available && source.x > (LAND.has(recipient.species) ? 170 : 110) && source.x < 2800
    && (LAND.has(recipient.species) ? source.x < state.coast.shore - 110 : source.depth === 0))
    .filter(source => !state.props.some(prop => Math.abs((prop.depth || 0) - source.depth) < 18 && Math.abs(prop.x - source.harvestPoint.x) < (prop.radius || prop.width / 2) + 45
      && Math.abs(prop.y - source.harvestPoint.y) < (prop.radius || prop.height / 2) + 35))
    .sort((first, second) => Math.abs(first.x - recipient.x) - Math.abs(second.x - recipient.x));
  assert.ok(sources.length, `${request.map}/${request.id} needs a visible source for ${request.food}`);
  const source = sources[0];
  const destination = { x: source.x + (request.food === 'banana' || recipient.species === 'frog' ? 85 : -Math.max(70, recipient.width * 0.55)),
    y: LAND.has(recipient.species) ? state.ground - recipient.height * 0.41 + source.depth
      : recipient.species === 'bird' ? state.water - 75 : ['starfish', 'octopus'].includes(recipient.species) ? source.y - recipient.height * 0.5 - 10
        : request.food === 'algae' ? source.y - 90 : Math.max(state.water + recipient.height * 0.65 + 28, source.y) };
  await carryResident(page, input, recipient.id, destination);
  await seek(page, source.x);
  state = await readState(page);
  const name = `${config.name}-${request.map}-${request.id}-${request.food}`;
  const normal = await capture(page, output, name, 'normal', request.id);
  assert.equal(normal.resident.feedingPose.eating, false);
  let portion;
  for (const offset of [{ x: 0, y: 0 }, { x: 18, y: 0 }, { x: -18, y: 0 }, { x: 0, y: -18 }, { x: 0, y: 18 }]) {
    const point = { x: source.harvestPoint.x + offset.x, y: source.harvestPoint.y + offset.y };
    await input.send('down', point);
    state = await readState(page);
    portion = state.props.find(prop => prop.sourceId === source.id);
    if (portion && state.grips.some(grip => grip.bodyId === portion.id)) break;
    await input.send('up', point);
  }
  assert.ok(portion && state.grips.some(grip => grip.bodyId === portion.id), `A visible ${request.food} source must yield the held physical portion`);
  assert.equal(state.foodPatches.find(patch => patch.id === source.id).available, false);
  const heldGrip = state.grips.find(grip => grip.bodyId === portion.id);
  const gripOffset = { x: heldGrip.target.x - portion.x, y: heldGrip.target.y - portion.y };
  const portionId = portion.portionId;
  const previousMeals = state.creatures.find(resident => resident.id === request.id).meals;
  let extraId = null;
  if (config.nativeTouch && request.id === 'fin') {
    const otherSource = state.foodPatches.find(patch => patch.available && patch.id !== source.id && patch.depth === 0
      && Math.abs(patch.x - source.x) < 60 && Math.abs(patch.harvestPoint.y - source.harvestPoint.y) > 45);
    assert.ok(otherSource, 'The native multi-touch case needs a second separate visible food target');
    await input.send('down', otherSource.harvestPoint, 82);
    const extra = (await readState(page)).props.find(prop => prop.sourceId === otherSource.id);
    assert.ok(extra && (await readState(page)).grips.some(grip => grip.bodyId === extra.id));
    extraId = extra.id;
    await input.send('move', { x: otherSource.x, y: state.water - 100 }, 82);
    await page.clock.runFor(200);
  }
  const openings = [];
  let eating;
  let released = false;
  let completed;
  for (let attempt = 0; attempt < 220; attempt += 1) {
    state = await readState(page);
    recipient = state.creatures.find(resident => resident.id === request.id);
    if (recipient.lastMeal?.portionId === portionId) { completed = state; break; }
    portion = state.props.find(prop => prop.portionId === portionId);
    assert.ok(portion, `Only the intended eater may consume the offered ${request.food}`);
    if (!released) {
      const point = { x: recipient.x + recipient.direction * (recipient.width * 0.32 + 23),
        y: recipient.species === 'bird' ? Math.min(state.water + 8, recipient.y + 5) : recipient.y - recipient.height * 0.08 };
      point.x += gripOffset.x; point.y += gripOffset.y;
      await input.send('move', point);
    }
    await page.clock.runFor(66);
    state = await readState(page); recipient = state.creatures.find(resident => resident.id === request.id);
    if (recipient.feedingPose.eating) {
      openings.push(recipient.feedingPose.open);
      if (!eating && recipient.feedingPose.open > 0.25) eating = await capture(page, output, name, 'eating', request.id);
      if (request.released && !released) {
        const offered = state.props.find(prop => prop.portionId === portionId);
        if (recipient.species !== 'frog' || recipient.grounded && Math.abs(offered.physicalY - recipient.physicalY) < 12) {
          await input.send('up', offered); released = true;
        }
      }
    }
  }
  assert.ok(completed, `${request.map}/${request.id} must consume ${request.food} by a calm real-input offer`);
  assert.ok(!request.released || released, 'A released-food case must release the portion before it is consumed');
  assert.ok(eating, 'Eating must be visibly sampled before consumption');
  assert.ok(openings.length >= 3 && Math.max(...openings) - Math.min(...openings) > 0.3, 'The actual mouth must naturally open and close during the bite');
  recipient = completed.creatures.find(resident => resident.id === request.id);
  assert.equal(recipient.meals, previousMeals + 1);
  assert.equal(recipient.lastMeal.assisted, true);
  assert.ok(recipient.needs.hunger < 0.03);
  assert.equal(completed.creatures.length, 13);
  assert.equal(completed.props.some(prop => prop.portionId === portionId), false);
  assert.equal(completed.grips.some(grip => grip.bodyId === portion.id), false);
  if (extraId) assert.ok(completed.grips.some(grip => grip.bodyId === extraId), 'Consuming one native-held portion must preserve the other grip');
  const satisfied = await capture(page, output, name, 'satisfied', request.id);
  assert.ok(satisfied.resident.feedingPose.smile > 0.9);
  assert.equal(satisfied.resident.feedingPose.heart, true);
  const heart = (await readState(page)).bubbles.find(bubble => bubble.id === request.id);
  assert.equal(heart?.kind, 'meal-heart', 'The actual recipient must have its visible larger meal heart');
  assert.equal(heart.glyphScale, 1.5);
  if (!released) {
    if (!extraId) {
      const cameraX = completed.camera.x;
      await input.send('move', { x: cameraX + completed.camera.width - 4, y: completed.water });
      await page.clock.runFor(350);
      assert.ok(Math.abs((await readState(page)).camera.x - cameraX) < 1, 'A consumed gesture must not pan or edge-scroll');
    }
    await input.send('up', { x: recipient.x, y: recipient.y });
  }
  if (extraId) {
    const extra = (await readState(page)).props.find(prop => prop.id === extraId);
    await input.send('up', extra, 82);
  }
  await page.locator('#pause').click({ force: true });
  const paused = await readState(page);
  await page.clock.runFor(2300);
  assert.equal((await readState(page)).time, paused.time);
  assert.deepEqual((await readState(page)).creatures.find(resident => resident.id === request.id).feedingPose,
    paused.creatures.find(resident => resident.id === request.id).feedingPose, 'Pause freezes mouth and satisfaction timers');
  await page.locator('#pause').click({ force: true });
  const beforeSwitch = await readState(page);
  await page.locator(`[data-map="${request.map === 'pools' ? 'lagoon' : 'pools'}"]`).click({ force: true });
  await page.clock.runFor(2000);
  await page.locator(`[data-map="${request.map}"]`).click({ force: true });
  assert.equal((await readState(page)).time, beforeSwitch.time, 'An inactive map freezes its meal reaction clock');
  await page.clock.runFor(6200);
  const reverted = await capture(page, output, name, 'reverted', request.id);
  assert.equal(reverted.resident.feedingPose.smile, 0);
  assert.equal(reverted.resident.feedingPose.heart, false);
  assert.equal((await readState(page)).objectives.completed, 0, 'Food alone must not qualify any journal objective');
  const report = { ...request, portionId, input: config.nativeTouch ? 'native multi-touch' : config.touch ? 'touch pointers' : 'mouse',
    normal, eating, satisfied, reverted, openings, extraGripPreserved: Boolean(extraId), passed: true };
  fs.writeFileSync(path.join(output, `feeding-${name}.json`), JSON.stringify(report, null, 2));
  console.log(`PASS feeding ${name}: harvest, ${released ? 'released' : 'held'} meal, moving mouth, larger heart, smile and cleanup`);
  return report;
}

async function treasureCase(page, input, config, output, map) {
  await page.locator(`[data-map="${map}"]`).click({ force: true });
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1300);
  let state = await readState(page);
  await seek(page, state.treasure.x);
  assert.equal(state.treasure.opened, false);
  await input.send('down', state.treasure);
  assert.ok((await readState(page)).grips.some(grip => grip.kind === 'chest'), 'The visible chest must be the actual picked object');
  await input.send('up', state.treasure);
  await page.clock.runFor(1600);
  state = await readState(page);
  assert.equal(state.treasure.opened, true);
  assert.ok(state.treasure.lid > 0.99);
  const loot = state.props.filter(prop => ['coin', 'gold', 'gem'].includes(prop.kind));
  assert.equal(loot.length, 6);
  assert.deepEqual(new Set(loot.map(prop => prop.kind)), new Set(['coin', 'gold', 'gem']));
  await page.screenshot({ path: path.join(output, `treasure-${config.name}-${map}-open.png`) });
  const collections = [];
  for (const original of loot) {
    let item = (await readState(page)).props.find(prop => prop.id === original.id);
    assert.ok(item, 'Uncollected treasure must remain a physical object');
    await seek(page, item.x);
    for (const offset of [0, -0.6, 0.6]) {
      item = (await readState(page)).props.find(prop => prop.id === original.id);
      await input.send('down', { x: item.x + offset * (item.radius || item.width / 2), y: item.y });
      if ((await readState(page)).grips.some(grip => grip.bodyId === item.id)) break;
      await input.send('up', item);
    }
    assert.ok((await readState(page)).grips.some(grip => grip.bodyId === item.id), `The visible ${item.kind} must be draggable`);
    const before = (await readState(page)).treasure.wealth.total;
    let collected = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      state = await readState(page);
      await input.send('move', { x: state.blob.x + 30, y: state.blob.y - 6 });
      await page.clock.runFor(66);
      state = await readState(page);
      if (!state.props.some(prop => prop.id === original.id)) { collected = state; break; }
    }
    assert.ok(collected, 'Carrying treasure to Blobby must collect the actual object');
    assert.equal(collected.grips.some(grip => grip.bodyId === original.id), false);
    assert.equal(collected.treasure.wealth.total, before + ({ coin: 1, gold: 5, gem: 10 }[original.kind]));
    assert.equal(collected.treasure.happy, true);
    collections.push({ kind: original.kind, id: original.id, treasure: collected.treasure });
    await page.screenshot({ path: path.join(output, `treasure-${config.name}-${map}-${original.kind}-rich.png`) });
    await input.send('up', { x: collected.blob.x, y: collected.blob.y });
  }
  state = await readState(page);
  assert.deepEqual(state.treasure.wealth, { coins: 3, gold: 1, gems: 2, total: 28 });
  assert.equal(state.treasure.remaining, 0);
  await seek(page, state.treasure.x);
  await input.send('down', state.treasure); await input.send('up', state.treasure);
  assert.equal((await readState(page)).props.some(prop => ['coin', 'gold', 'gem'].includes(prop.kind)), false, 'Repeated opening cannot duplicate treasure');
  await page.locator('#pause').click({ force: true });
  const paused = await readState(page);
  await page.clock.runFor(1600);
  assert.deepEqual((await readState(page)).treasure, paused.treasure, 'Pause freezes the chest and happiness');
  await page.locator('#pause').click({ force: true });
  const retained = (await readState(page)).treasure;
  await page.locator(`[data-map="${map === 'pools' ? 'sunset' : 'pools'}"]`).click({ force: true });
  await page.clock.runFor(500);
  await page.locator(`[data-map="${map}"]`).click({ force: true });
  assert.deepEqual((await readState(page)).treasure, retained, 'Returning to a map preserves its opened chest and wealth');
  await page.locator('#reset').click({ force: true });
  assert.equal((await readState(page)).treasure.opened, false);
  assert.equal((await readState(page)).treasure.wealth.total, 0);
  const report = { map, kind: 'treasure', passed: true, collections };
  fs.writeFileSync(path.join(output, `treasure-${config.name}-${map}.json`), JSON.stringify(report, null, 2));
  console.log(`PASS treasure ${config.name}-${map}: real pickup, coins/gold/gems, happiness, pause, map retention and reset`);
  return report;
}

async function frogPlayCase(page, config, output) {
  await page.locator('[data-map="lagoon"]').click({ force: true });
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1300);
  let state = await readState(page);
  const deadline = state.time + 450000;
  let normalHop = null;
  let upsideDown = null;
  let landing = null;
  let flippingId = null;
  const turns = [];
  const hops = new Map();
  while (state.time < deadline && (!normalHop || !landing)) {
    const active = state.creatures.some(resident => resident.species === 'frog' && resident.antic === 'somersault');
    await page.clock.runFor(!normalHop ? 33 : active ? 66 : 250);
    state = await readState(page);
    assert.equal(state.finite, true);
    for (const frog of state.creatures.filter(resident => resident.species === 'frog')) {
      if (frog.grounded || frog.antic === 'somersault') hops.delete(frog.id);
      else {
        const hop = hops.get(frog.id) || { extension: 0, height: 0 };
        hop.extension = Math.max(hop.extension, frog.jumpPose.extension);
        hop.height = Math.max(hop.height, state.ground - frog.height * 0.41 - frog.physicalY);
        hops.set(frog.id, hop);
      }
      const hop = hops.get(frog.id);
      if (!normalHop && hop?.extension > 0.6 && hop.height > 12) {
        await seek(page, frog.x);
        normalHop = { ...frog, observedHop: { ...hop } };
        await page.screenshot({ path: path.join(output, `frogs-${config.name}-hop.png`) });
      }
      if (!flippingId && frog.jumpPose.rotation > 0.2) flippingId = frog.id;
      if (frog.id !== flippingId) continue;
      if (frog.jumpPose.rotation > 0) turns.push({ time: state.time, resident: frog });
      if (!upsideDown && frog.jumpPose.rotation > Math.PI * 0.65 && frog.jumpPose.rotation < Math.PI * 1.25) {
        await seek(page, frog.x);
        upsideDown = (await readState(page)).creatures.find(resident => resident.id === frog.id);
        await page.screenshot({ path: path.join(output, `frogs-${config.name}-somersault.png`) });
      }
      if (upsideDown && frog.grounded && frog.jumpPose.rotation === 0) {
        landing = frog;
        await seek(page, frog.x);
        await page.screenshot({ path: path.join(output, `frogs-${config.name}-landing.png`) });
      }
    }
  }
  assert.ok(normalHop, 'Untouched frogs must make visible ordinary hops');
  assert.ok(upsideDown && landing, 'An occasional, naturally scheduled somersault must turn in the air and land upright');
  assert.ok(turns.length >= 4, 'The real turn must be observed over multiple animation frames');
  assert.ok(Math.max(...turns.map(turn => turn.resident.jumpPose.rotation)) > Math.PI * 1.8, 'The rendered somersault must turn all the way around');
  assert.ok(turns.some(turn => turn.resident.jumpPose.tuck > 0.8), 'The frog must tuck its legs during the flip');
  const report = { kind: 'frog-play', passed: true, normalHop, upsideDown, landing, turns, time: state.time };
  fs.writeFileSync(path.join(output, `frogs-${config.name}-play.json`), JSON.stringify(report, null, 2));
  console.log(`PASS frogs ${config.name}: ordinary hops, natural airborne somersault and upright landing`);
  return report;
}

async function frogSwimmingCase(page, input, config, output, map) {
  await page.locator(`[data-map="${map}"]`).click({ force: true });
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1300);
  const initial = await readState(page);
  const report = { kind: 'frog-swimming', map, passed: false, swimmers: [] };
  try {
    for (const [index, id] of ['puddle', 'sprig'].entries()) {
      await carryResident(page, input, id, { x: initial.coast.farToe - 195 - index * 180, y: initial.water + 60 });
      const released = await readState(page);
      assert.equal(released.drags, 0, 'The frog must be released before the swimming observation');
      assert.equal(released.creatures.find(resident => resident.id === id).held, false);
      const samples = [];
      const swimmer = { id, released, samples };
      report.swimmers.push(swimmer);
      for (let sample = 0; sample < 64; sample += 1) {
        await page.clock.runFor(100);
        const state = await readState(page);
        const frog = state.creatures.find(resident => resident.id === id);
        assert.equal(state.finite, true);
        samples.push({ time: state.time, frog });
        assert.equal(frog.recovery, '', `${map}/${id} must not be forced back to shore`);
        assert.equal(frog.rescue, false);
      }
      const surface = samples.filter(sample => sample.frog.swimPose.swimming && Math.abs(sample.frog.physicalY - initial.water) < sample.frog.height * 0.6);
      assert.ok(surface.length >= 30, `${map}/${id} must spend sustained time swimming at the surface`);
      swimmer.surfaceTravel = Math.max(...surface.map(sample => sample.frog.x)) - Math.min(...surface.map(sample => sample.frog.x));
      assert.ok(swimmer.surfaceTravel > 65, `${map}/${id} must paddle across the water after release`);
      assert.ok(surface.some(sample => !sample.frog.frown), 'A frog must be comfortable swimming');
      assert.ok(surface.every(sample => !sample.frog.jumpPose.airborne && sample.frog.jumpPose.rotation === 0), 'Swimming must not show an airborne somersault');
      const kicks = surface.map(sample => sample.frog.swimPose.kick);
      assert.ok(Math.max(...kicks) - Math.min(...kicks) > 0.85, 'The rendered swimming legs must cycle through full strokes');
      await seek(page, surface.at(-1).frog.x);
      await page.screenshot({ path: path.join(output, `frog-swimming-${config.name}-${map}-${id}.png`) });
    }
    await seek(page, (await readState(page)).environment.lilyPads[6].x);
    report.lilyPads = await page.evaluate(() => {
      const state = window.__blobIsland.snapshot();
      const canvas = document.getElementById('world');
      canvas.toDataURL();
      const context = canvas.getContext('2d');
      const scale = canvas.height / state.height;
      return state.environment.lilyPads.filter(pad => pad.x - pad.radius > state.camera.x && pad.x + pad.radius < state.camera.x + state.camera.width).map(pad => {
        const left = Math.floor((pad.x - pad.radius * 0.8 - state.camera.x) * scale);
        const top = Math.floor((pad.y - pad.radius * 0.12) * scale);
        const pixels = context.getImageData(left, top, Math.max(1, Math.floor(pad.radius * 0.6 * scale)), Math.max(1, Math.floor(pad.radius * 0.24 * scale))).data;
        let greenPixels = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 1] > pixels[offset] * 1.1 && pixels[offset + 1] > pixels[offset + 2] * 1.1) greenPixels += 1;
        }
        return { ...pad, greenPixels };
      });
    });
    assert.ok(report.lilyPads.length >= 2, 'A lily-pad cluster must be visible in the ocean');
    assert.ok(report.lilyPads.every(pad => pad.greenPixels > 12), 'Lily pads must have real rendered leaf pixels at their surface positions');
    await page.screenshot({ path: path.join(output, `frog-swimming-${config.name}-${map}-lily-pads.png`) });
    await page.keyboard.press('Space');
    const frozen = await readState(page);
    await page.clock.runFor(800);
    const paused = await readState(page);
    assert.equal(paused.time, frozen.time, 'Pause must freeze swimming time');
    assert.deepEqual(paused.environment.lilyPads, frozen.environment.lilyPads, 'Pause must freeze the floating lily pads');
    assert.deepEqual(paused.creatures.filter(resident => resident.species === 'frog'), frozen.creatures.filter(resident => resident.species === 'frog'));
    await page.keyboard.press('Space');
    await page.clock.runFor(200);
    assert.ok((await readState(page)).time > paused.time, 'Swimming must resume after pause');
    report.passed = true;
  } finally {
    fs.writeFileSync(path.join(output, `frog-swimming-${config.name}-${map}.json`), JSON.stringify(report, null, 2));
  }
  console.log(`PASS swimming ${config.name}-${map}: both frogs, real release, surface strokes, lily-pad pixels and pause`);
  return report;
}

async function frogPadCase(page, input, config, output, map) {
  await page.locator(`[data-map="${map}"]`).click({ force: true });
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1300);
  const initial = await readState(page);
  const id = config.nativeTouch ? map === 'pools' ? 'puddle' : 'sprig' : map === 'pools' ? 'sprig' : 'puddle';
  const original = initial.creatures.find(resident => resident.id === id);
  const pad = initial.environment.lilyPads[6];
  const report = { kind: 'frog-lily-pads', map, id, passed: false, samples: [], jumps: [] };
  try {
    await carryResident(page, input, id, { x: pad.x, y: pad.y - original.height * 0.41 - 40 }, true);
    await seek(page, pad.x);
    let state = await readState(page);
    let frog = state.creatures.find(resident => resident.id === id);
    assert.equal(frog.lilyPadId, pad.id, 'A frog dropped onto a lily pad must be physically supported');
    assert.equal(frog.grounded, true);
    await input.send('down', frog);
    assert.equal((await readState(page)).creatures.find(resident => resident.id === id).held, true, 'A seated frog must remain pickable');
    await input.send('move', { x: pad.x, y: frog.y - 45 });
    await page.clock.runFor(450);
    const held = (await readState(page)).creatures.find(resident => resident.id === id);
    assert.ok(held.y < frog.y - 20, 'The held frog must lift off its pad');
    assert.equal(held.padHop, null);
    await input.send('up', held);
    await page.clock.runFor(900);
    state = await readState(page);
    frog = state.creatures.find(resident => resident.id === id);
    assert.equal(frog.lilyPadId, pad.id);
    assert.equal(state.drags, 0);
    await page.locator('#pause').click({ force: true });
    const frozen = await readState(page);
    assert.equal(frozen.paused, true);
    await page.clock.runFor(800);
    assert.equal((await readState(page)).time, frozen.time, 'A seated frog and its pad must pause together');
    const otherMap = map === 'lagoon' ? 'pools' : 'lagoon';
    await page.locator(`[data-map="${otherMap}"]`).click({ force: true });
    await page.clock.runFor(300);
    await page.locator(`[data-map="${map}"]`).click({ force: true });
    const retained = await readState(page);
    assert.equal(retained.time, frozen.time);
    assert.deepEqual(retained.creatures.find(resident => resident.id === id), frozen.creatures.find(resident => resident.id === id), 'Map switching must retain the frog on its original pad');
    assert.deepEqual(retained.environment.lilyPads, frozen.environment.lilyPads);
    await seek(page, frog.x);
    report.resting = retained.creatures.find(resident => resident.id === id);
    report.visibleBellyPixels = await page.evaluate(id => {
      const state = window.__blobIsland.snapshot();
      const frog = state.creatures.find(resident => resident.id === id);
      const canvas = document.getElementById('world');
      canvas.toDataURL();
      const scale = canvas.height / state.height;
      const pixels = canvas.getContext('2d').getImageData(Math.floor((frog.x - frog.width * 0.35 - state.camera.x) * scale),
        Math.floor((frog.y + frog.height * 0.08) * scale), Math.max(1, Math.floor(frog.width * 0.7 * scale)), Math.max(1, Math.floor(frog.height * 0.22 * scale))).data;
      let visible = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset] > 160 && pixels[offset + 1] > 145 && pixels[offset + 2] > 100
          && pixels[offset] > pixels[offset + 1] * 0.98 && pixels[offset] > pixels[offset + 2] * 1.03) visible += 1;
      }
      return visible;
    }, id);
    assert.ok(report.visibleBellyPixels > 8, 'The seated frog must render on top of the leaf, not disappear behind it');
    await page.screenshot({ path: path.join(output, `lily-pads-${config.name}-${map}-resting.png`) });
    await page.locator('#pause').click({ force: true });
    assert.equal((await readState(page)).paused, false);
    await page.locator('#reset').click({ force: true });
    await page.clock.runFor(1300);
    const fresh = await readState(page);
    const waterStart = fresh.environment.lilyPads[7];
    await carryResident(page, input, id, { x: waterStart.x + 65, y: waterStart.y + original.height * 1.5 }, true);
    report.waterStart = await readState(page);
    assert.equal(report.waterStart.drags, 0, 'The natural pad cycle starts with a released swimming frog');
    assert.equal(report.waterStart.creatures.find(resident => resident.id === id).lilyPadId, null);
    const deadline = report.waterStart.time + 60000;
    let activeJump = null;
    let restStart = null;
    let restingPad = null;
    let longestRest = 0;
    state = await readState(page);
    for (let sample = 0; sample < 600 && state.time < deadline; sample += 1) {
      const previousTime = state.time;
      await page.clock.runFor(100);
      state = await readState(page);
      assert.ok(state.time > previousTime, 'The natural pad-cycle check must observe an advancing simulation');
      frog = state.creatures.find(resident => resident.id === id);
      report.samples.push({ time: state.time, frog });
      assert.equal(state.finite, true);
      assert.equal(frog.recovery, '', 'Pad activity must not trigger habitat rescue');
      if (activeJump && frog.padHop?.started !== activeJump.started) {
        activeJump.landed = frog.lilyPadId;
        activeJump.water = !frog.lilyPadId && frog.immersion > 0.15 && frog.swimPose.swimming;
        activeJump = null;
      }
      if (frog.padHop?.started != null) {
        if (!activeJump) {
          activeJump = { ...frog.padHop, airborne: false, extension: 0, height: 0 };
          report.jumps.push(activeJump);
        }
        activeJump.airborne ||= frog.jumpPose.airborne;
        activeJump.extension = Math.max(activeJump.extension, frog.jumpPose.extension);
        activeJump.height = Math.max(activeJump.height, initial.water - frog.physicalY - frog.height * 0.41);
        if (!activeJump.screenshot && frog.jumpPose.airborne && activeJump.height > 15) {
          await seek(page, frog.x);
          activeJump.screenshot = `lily-pads-${config.name}-${map}-hop-${report.jumps.length}.png`;
          await page.screenshot({ path: path.join(output, activeJump.screenshot) });
        }
      }
      if (frog.lilyPadId && frog.state === 'resting') {
        if (restingPad !== frog.lilyPadId) restStart = state.time;
        restingPad = frog.lilyPadId;
        longestRest = Math.max(longestRest, state.time - restStart);
        assert.equal(frog.grounded, true);
        assert.equal(frog.swimPose.swimming, false, 'A sitting frog must stop paddling');
      } else { restingPad = null; restStart = null; }
      const physical = jump => jump.airborne && jump.extension > 0.6 && jump.height > 12;
      report.between = report.jumps.some(jump => physical(jump) && jump.from && jump.to && jump.from !== jump.to && jump.landed === jump.to);
      report.off = report.jumps.some(jump => physical(jump) && jump.from && !jump.to && jump.water);
      report.onto = report.jumps.some(jump => physical(jump) && !jump.from && jump.to && jump.landed === jump.to);
      if (report.between && report.off && report.onto && longestRest >= 2000) break;
    }
    report.longestRest = longestRest;
    assert.ok(longestRest >= 2000, 'Frogs must sit calmly on lily pads for at least two active seconds');
    assert.ok(report.between, `${map}/${id} must naturally jump and land on a neighboring pad`);
    assert.ok(report.off, `${map}/${id} must naturally jump back into the water`);
    assert.ok(report.onto, `${map}/${id} must naturally jump out of the water onto a pad`);
    report.passed = true;
  } finally {
    fs.writeFileSync(path.join(output, `lily-pads-${config.name}-${map}.json`), JSON.stringify(report, null, 2));
  }
  console.log(`PASS lily pads ${config.name}-${map}: support, regrab, visible rest, natural hops, pause and map retention`);
  return report;
}

async function exerciseFeeding(page, config, output) {
  await page.clock.install({ time: new Date('2026-09-09T14:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-09T14:00:00.100Z'));
  await page.reload();
  await page.clock.runFor(1600);
  const input = await inputFor(page, config);
  const thorough = config.name === 'desktop' || config.nativeTouch;
  const discoveries = process.env.BLOB_FEATURES === 'discoveries';
  const frogs = process.env.BLOB_FEATURES === 'frogs';
  const swimming = process.env.BLOB_FEATURES === 'swimming';
  const requests = swimming ? [] : [...(discoveries || frogs ? [] : [{ map: 'lagoon', id: 'fin', food: 'algae' },
    ...(thorough ? [{ map: 'lagoon', id: 'drift', food: 'bait-fish' }, { map: 'lagoon', id: 'skipper', food: 'bait-fish' },
      { map: 'lagoon', id: 'mango', food: 'insects' }, { map: 'lagoon', id: 'fern', food: 'insects' },
      { map: 'pools', id: 'aster', food: 'algae' }, { map: 'pools', id: 'pearl', food: 'shell-bed' }] : []),
    { map: 'sunset', id: 'clover', food: 'carrot' },
    ...(thorough ? [{ map: 'sunset', id: 'thistle', food: 'grass', released: true }] : []),
    ...(config.name === 'desktop' ? [{ map: 'lagoon', id: 'moss', food: 'grass', released: true }, { map: 'lagoon', id: 'pebble', food: 'shore-scraps' },
      { map: 'lagoon', id: 'lumi', food: 'plankton' }, { map: 'lagoon', id: 'ollie', food: 'shell-bed' },
      { map: 'pools', id: 'skipper', food: 'insects' }, { map: 'sunset', id: 'skipper', food: 'bait-fish' }] : [])]),
    ...(frogs ? [] : ['lagoon', 'pools', 'sunset'].map(map => ({ map, id: 'momo', food: 'banana' }))),
    ...(discoveries ? [] : ['lagoon', 'pools', 'sunset'].flatMap(map => ['puddle', 'sprig'].map(id => ({ map, id, food: 'insects', released: id === 'sprig' }))))]
    .filter(request => !process.env.BLOB_FEEDING_CASES || process.env.BLOB_FEEDING_CASES.split(',').includes(`${request.map}:${request.id}`));
  assert.ok(swimming || requests.length, 'The feeding selector must execute real meal cases');
  const reports = [];
  try {
    for (const request of requests) reports.push(await mealCase(page, input, config, output, request));
    if (frogs || (process.env.BLOB_FEATURES || 'all') === 'all') reports.push(await frogPlayCase(page, config, output));
    if (swimming || frogs || (process.env.BLOB_FEATURES || 'all') === 'all') {
      for (const map of ['lagoon', 'pools', 'sunset']) {
        reports.push(await frogSwimmingCase(page, input, config, output, map));
        reports.push(await frogPadCase(page, input, config, output, map));
      }
    }
    if (discoveries || (process.env.BLOB_FEATURES || 'all') === 'all') {
      for (const map of ['lagoon', 'pools', 'sunset']) reports.push(await treasureCase(page, input, config, output, map));
    }
  } finally {
    await input.close();
    await page.clock.resume();
  }
  await page.locator('[data-map="lagoon"]').click({ force: true });
  await page.locator('#reset').click({ force: true });
  return reports;
}

module.exports = { exerciseFeeding };