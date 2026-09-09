const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const readState = page => page.evaluate(() => window.__blobIsland.snapshot());
const LAND = new Set(['crab', 'tortoise', 'lizard', 'rabbit']);

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

async function carryResident(page, input, id, destination) {
  let resident = (await readState(page)).creatures.find(item => item.id === id);
  await seek(page, resident.x);
  let offset;
  for (const position of [{ x: 0, y: 0 }, { x: 0.33, y: -0.2 }, { x: -0.33, y: 0.2 }]) {
    resident = (await readState(page)).creatures.find(item => item.id === id);
    const point = { x: resident.x + resident.width * position.x, y: resident.y + resident.height * position.y };
    await input.send('down', point);
    if ((await readState(page)).creatures.find(item => item.id === id).held) { offset = { x: point.x - resident.x, y: point.y - resident.y }; break; }
    await input.send('up', point);
  }
  assert.ok(offset, `${id} must be acquired through the actual input handler`);
  for (let attempt = 0; attempt < 140; attempt += 1) {
    const target = { x: destination.x + offset.x, y: destination.y + offset.y };
    await input.send('move', target); await page.clock.runFor(100);
    resident = (await readState(page)).creatures.find(item => item.id === id);
    if (Math.hypot(resident.x - destination.x, resident.y - destination.y) < 18) break;
  }
  assert.ok(Math.hypot(resident.x - destination.x, resident.y - destination.y) < 22, `${id} must reach the clear feeding area by real dragging`);
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
  const destination = { x: source.x - Math.max(70, recipient.width * 0.55),
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
      await input.send('move', point);
    }
    await page.clock.runFor(66);
    state = await readState(page); recipient = state.creatures.find(resident => resident.id === request.id);
    if (recipient.feedingPose.eating) {
      openings.push(recipient.feedingPose.open);
      if (!eating && recipient.feedingPose.open > 0.25) eating = await capture(page, output, name, 'eating', request.id);
      if (request.released && !released) {
        const offered = state.props.find(prop => prop.portionId === portionId);
        await input.send('up', offered); released = true;
      }
    }
  }
  assert.ok(completed, `${request.map}/${request.id} must consume ${request.food} by a calm real-input offer`);
  assert.ok(eating, 'Eating must be visibly sampled before consumption');
  assert.ok(openings.length >= 3 && Math.max(...openings) - Math.min(...openings) > 0.3, 'The actual mouth must naturally open and close during the bite');
  recipient = completed.creatures.find(resident => resident.id === request.id);
  assert.equal(recipient.meals, previousMeals + 1);
  assert.equal(recipient.lastMeal.assisted, true);
  assert.ok(recipient.needs.hunger < 0.03);
  assert.equal(completed.creatures.length, 10);
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

async function exerciseFeeding(page, config, output) {
  await page.clock.install({ time: new Date('2026-09-09T14:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-09T14:00:00.100Z'));
  await page.reload();
  await page.clock.runFor(1600);
  const input = await inputFor(page, config);
  const thorough = config.name === 'desktop' || config.nativeTouch;
  const requests = [{ map: 'lagoon', id: 'fin', food: 'algae' },
    ...(thorough ? [{ map: 'lagoon', id: 'drift', food: 'bait-fish' }, { map: 'lagoon', id: 'skipper', food: 'bait-fish' },
      { map: 'lagoon', id: 'mango', food: 'insects' }, { map: 'lagoon', id: 'fern', food: 'insects' },
      { map: 'pools', id: 'aster', food: 'algae' }, { map: 'pools', id: 'pearl', food: 'shell-bed' }] : []),
    { map: 'sunset', id: 'clover', food: 'carrot' },
    ...(thorough ? [{ map: 'sunset', id: 'thistle', food: 'grass', released: true }] : []),
    ...(config.name === 'desktop' ? [{ map: 'lagoon', id: 'moss', food: 'grass', released: true }, { map: 'lagoon', id: 'pebble', food: 'shore-scraps' },
      { map: 'lagoon', id: 'lumi', food: 'plankton' }, { map: 'lagoon', id: 'ollie', food: 'shell-bed' },
      { map: 'pools', id: 'skipper', food: 'insects' }, { map: 'sunset', id: 'skipper', food: 'bait-fish' }] : [])]
    .filter(request => !process.env.BLOB_FEEDING_CASES || process.env.BLOB_FEEDING_CASES.split(',').includes(`${request.map}:${request.id}`));
  assert.ok(requests.length, 'The feeding selector must execute real meal cases');
  const reports = [];
  try {
    for (const request of requests) reports.push(await mealCase(page, input, config, output, request));
  } finally {
    await input.close();
    await page.clock.resume();
  }
  await page.locator('[data-map="lagoon"]').click({ force: true });
  await page.locator('#reset').click({ force: true });
  return reports;
}

module.exports = { exerciseFeeding };