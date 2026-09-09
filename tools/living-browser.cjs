const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const source = process.env.BLOB_URL || pathToFileURL(path.join(root, 'index.html')).href;
const readState = page => page.evaluate(() => window.__blobIsland.snapshot());
const aquatic = new Set(['fish', 'jellyfish', 'shark', 'octopus', 'starfish']);
const special = { lagoon: 'lizard', pools: 'starfish', sunset: 'rabbit' };
const gags = { fish: 'bubble-ring', crab: 'claw-dance', tortoise: 'sneeze', bird: 'dropping', jellyfish: 'hiccup', shark: 'yawn', octopus: 'ink-puff', lizard: 'tongue-flick', starfish: 'cartwheel', rabbit: 'binky' };

async function pointer(page, type, pointerId, point) {
  await page.evaluate(({ type, pointerId, point }) => {
    const state = window.__blobIsland.snapshot();
    const canvas = document.getElementById('world');
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 81, bubbles: true, button: 0,
      buttons: ['pointerup', 'pointercancel'].includes(type) ? 0 : 1,
      clientX: bounds.left + Math.max(12, Math.min(bounds.width - 12, (point.x - state.camera.x) / state.camera.width * bounds.width)),
      clientY: bounds.top + point.y / state.height * bounds.height }));
  }, { type, pointerId, point });
}

async function seek(page, positionX) {
  const overview = page.locator('#coast-overview');
  const bounds = await overview.boundingBox();
  await overview.click({ force: true, position: { x: Math.max(1, Math.min(bounds.width - 1, positionX / 3200 * bounds.width)), y: bounds.height / 2 } });
  await page.clock.runFor(34);
}

async function pixels(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('world');
    canvas.toDataURL();
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let offset = 0; offset < data.length; offset += 4 * 113) colors.add(`${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`);
    return colors.size;
  });
}

async function grabResident(page, id) {
  let resident = (await readState(page)).creatures.find(item => item.id === id);
  await seek(page, resident.x);
  for (let layer = 0; layer < 3; layer += 1) {
    for (const offset of [{ x: 0, y: 0 }, { x: 0.35, y: 0 }, { x: -0.35, y: 0 }, { x: 0, y: -0.32 }, { x: 0, y: 0.32 }]) {
      resident = (await readState(page)).creatures.find(item => item.id === id);
      await pointer(page, 'pointerdown', 81, { x: resident.x + offset.x * resident.width, y: resident.y + offset.y * resident.height });
      await page.clock.runFor(34);
      if ((await readState(page)).creatures.find(item => item.id === id).held) return { x: offset.x * resident.width, y: offset.y * resident.height };
      await pointer(page, 'pointercancel', 81, resident);
    }
    resident = (await readState(page)).creatures.find(item => item.id === id);
    await pointer(page, 'pointerdown', 81, resident);
    const covered = await readState(page);
    const foreground = covered.creatures.find(item => item.held && item.id !== id);
    if (foreground) {
      await pointer(page, 'pointermove', 81, { x: foreground.x + 145, y: foreground.y - 50 });
      await page.clock.runFor(1200);
    }
    await pointer(page, 'pointerup', 81, resident);
    await page.clock.runFor(250);
  }
  assert.fail(`The visible ${resident.species} must be touch-pickable`);
}

async function carryResident(page, id, target, gripOffset) {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    await pointer(page, 'pointermove', 81, { x: target.x + gripOffset.x, y: target.y + gripOffset.y });
    await page.clock.runFor(160);
    const resident = (await readState(page)).creatures.find(item => item.id === id);
    if (Math.hypot(resident.x - target.x, resident.y - target.y) < 16) return;
  }
  assert.fail(`The held ${id} did not follow its touch to ${JSON.stringify(target)}`);
}

async function shaping(page) {
  const before = await readState(page);
  for (const [offset, index] of [1, 7, 13].entries()) await pointer(page, 'pointerdown', 81 + offset, before.blob.particles[index]);
  const held = await readState(page);
  assert.equal(held.drags, 3);
  assert.equal(new Set(held.grips.map(grip => grip.bodyId)).size, 3, 'Three fingers must own three distinct material points');
  for (const [offset, point] of [{ x: before.blob.x - 130, y: 360 }, { x: before.blob.x, y: 275 }, { x: before.blob.x + 130, y: 360 }].entries()) await pointer(page, 'pointermove', 81 + offset, point);
  await page.clock.runFor(1900);
  const stretched = await readState(page);
  const width = Math.max(...stretched.blob.particles.map(particle => particle.x)) - Math.min(...stretched.blob.particles.map(particle => particle.x));
  assert.ok(width > 220, 'The real event handlers must visibly shape Blobby with all three grips');
  assert.ok(stretched.blob.area > 1000);
  await pointer(page, 'pointercancel', 81, before.blob);
  assert.equal((await readState(page)).drags, 2);
  for (const pointerId of [82, 83]) await pointer(page, 'pointerup', pointerId, before.blob);
  await page.clock.runFor(3500);
  const released = await readState(page);
  assert.equal(released.drags, 0);
  assert.ok(Math.abs(released.blob.area / before.blob.area - 1) < 0.22, 'The stretched material must recover its resting area');
  await page.locator('#find-jelly').click({ force: true });
  await pointer(page, 'pointerdown', 81, released.blob);
  const target = { x: released.blob.x, y: released.ground + 135 };
  await pointer(page, 'pointermove', 81, target);
  await page.clock.runFor(2400);
  const foreground = await readState(page);
  assert.ok(foreground.blob.depth > 135, 'Blobby must be draggable across the foreground beach');
  assert.ok(foreground.blob.y > foreground.ground + 70, 'The snapshot and rendered body must use the visible foreground position');
  await pointer(page, 'pointerup', 81, target);
  await page.clock.runFor(500);
  const settled = await readState(page);
  await pointer(page, 'pointerdown', 81, settled.blob);
  assert.equal((await readState(page)).grips[0]?.kind, 'blob', 'Blobby must be pickable where it is drawn after depth movement');
  await pointer(page, 'pointermove', 81, { x: settled.blob.x, y: settled.ground - 130 });
  await page.clock.runFor(2400);
  assert.equal((await readState(page)).blob.depth, 0);
  await pointer(page, 'pointerup', 81, target);
  return { width, restoredArea: released.blob.area, foregroundDepth: foreground.blob.depth };
}

async function expressions(page, engine, map) {
  const initial = await readState(page);
  const tested = new Set();
  const results = [];
  if (initial.audioSupported && !initial.sound) {
    await page.locator('#sound').click({ force: true });
    await page.waitForFunction(() => window.__blobIsland.snapshot().audioState === 'running');
  }
  for (const original of initial.creatures) {
    if (tested.has(original.species) || map !== 'lagoon' && original.species !== special[map]) continue;
    tested.add(original.species);
    const gripOffset = await grabResident(page, original.id);
    const heldState = await readState(page);
    let resident = heldState.creatures.find(item => item.id === original.id);
    const target = { x: resident.x, y: aquatic.has(resident.species) ? initial.water - 115 : initial.ground - 170 };
    if (aquatic.has(resident.species)) {
      const margin = resident.width + 50;
      const candidates = Array.from({ length: 24 }, (_, index) => heldState.coast.toe + margin
        + index / 23 * (heldState.coast.farToe - heldState.coast.toe - margin * 2))
        .filter(positionX => heldState.props.every(prop => (prop.depth || 0) > 18 || prop.physicalY > initial.water + resident.height + 50
          || Math.abs(positionX - prop.x) > (prop.radius || prop.width / 2) + resident.width * 0.5 + 40))
        .filter(positionX => Math.abs(positionX - heldState.blob.x) > resident.width + heldState.blob.radius + 50)
        .sort((first, second) => Math.abs(first - resident.x) - Math.abs(second - resident.x));
      assert.ok(candidates.length, 'The habitat reaction check needs an unobstructed water return');
      target.x = candidates[0];
    }
    if (resident.species === 'bird') {
      await carryResident(page, resident.id, { x: initial.landmarks.reef.x, y: 285 }, gripOffset);
      target.x = initial.landmarks.reef.x; target.y = initial.water + 120;
    }
    await carryResident(page, resident.id, target, gripOffset);
    await page.clock.runFor(100);
    resident = (await readState(page)).creatures.find(item => item.id === original.id);
    assert.equal(resident.held, true);
    assert.equal(resident.frown, true, `${resident.species} must frown while held in an unsuitable environment`);
    assert.equal((await readState(page)).grips.length, 1);
    if (engine === 'chromium') await page.screenshot({ path: path.join(output, `living-${map}-${resident.species}-frown.png`) });
    await pointer(page, 'pointerup', 81, target);
    await page.clock.runFor(8000);
    resident = (await readState(page)).creatures.find(item => item.id === original.id);
    assert.equal(resident.held, false);
    assert.equal(resident.frown, false, `${resident.species} must relax after falling or flying back into its habitat`);
    assert.equal(resident.recovery, '', `${resident.species} must actually return, not merely lose its expression`);
    if (initial.audioSupported) assert.ok((await readState(page)).soundEvents[`voice-${resident.species}`] > 0, `${resident.species} needs its own working sound event`);
    results.push({ species: resident.species, returned: true, voice: initial.audioSupported });
  }
  if ((await readState(page)).sound) await page.locator('#sound').click({ force: true });
  return results;
}

async function mapDiscoveries(page, engine, map) {
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(1600);
  const kinds = [...new Set((await readState(page)).props.map(prop => prop.kind))];
  const results = [];
  if ((await readState(page)).audioSupported) {
    await page.locator('#sound').click({ force: true });
    await page.waitForFunction(() => window.__blobIsland.snapshot().audioState === 'running');
  }
  for (const kind of kinds) {
    const initial = (await readState(page)).props.find(prop => prop.kind === kind);
    assert.ok(initial, `${map} must have an interactive ${kind}`);
    await seek(page, initial.x);
    let current;
    let grip;
    for (const [horizontal, vertical] of kind === 'seesaw' ? [[0.7, 0], [-0.7, 0]] : [[0, 0], [0.7, 0], [-0.7, 0], [0, -0.6], [0, 0.6]]) {
      current = (await readState(page)).props.find(prop => prop.id === initial.id);
      grip = { x: current.x + horizontal * (current.radius || current.width / 2), y: current.y + vertical * (current.radius || current.height / 2) };
      await pointer(page, 'pointerdown', 81, grip);
      if ((await readState(page)).grips[0]?.bodyId === initial.id) break;
      await pointer(page, 'pointercancel', 81, grip);
      await page.clock.runFor(34);
    }
    const held = await readState(page);
    assert.equal(held.grips[0]?.bodyId, initial.id, `The visible ${kind} must be the actual grabbed body`);
    await pointer(page, 'pointermove', 81, { x: grip.x + (kind === 'seesaw' ? 0 : 55), y: grip.y - 40 });
    await page.clock.runFor(900);
    const moved = (await readState(page)).props.find(prop => prop.id === initial.id);
    if (kind === 'seesaw') assert.ok(Math.abs(moved.angle - current.angle) > 0.15, 'The anchored seesaw must rotate under an off-center touch');
    else assert.ok(Math.hypot(moved.x - current.x, moved.y - current.y) > 20, `${kind} must respond physically to the touch`);
    assert.equal(moved.playerHandled, true);
    if (engine === 'chromium') await page.screenshot({ path: path.join(output, `discovery-${map}-${kind}.png`) });
    await pointer(page, 'pointerup', 81, moved);
    await page.clock.runFor(500);
    if (kind === 'bell' && held.audioSupported) assert.ok((await readState(page)).soundEvents.chime > 0, 'Swinging the cove chimes must play their own sound');
    results.push({ kind, moved: true });
  }
  let grassTouched = false;
  for (const patch of (await readState(page)).foodPatches.filter(patch => patch.food === 'grass').slice(0, 8)) {
    await seek(page, patch.x);
    const point = { x: patch.x, y: patch.y + patch.depth - 10 };
    await pointer(page, 'pointerdown', 81, point);
    await pointer(page, 'pointerup', 81, point);
    await page.clock.runFor(50);
    if ((await readState(page)).foodPatches.find(item => item.id === patch.id).touches > 0) { grassTouched = true; break; }
  }
  assert.equal(grassTouched, true, 'The visible foreground grass must react to real pointer input');
  results.push({ kind: 'grass', touched: true });
  if ((await readState(page)).sound) await page.locator('#sound').click({ force: true });
  return results;
}

async function naturalTimeline(page, engine, map) {
  await page.locator('#reset').click({ force: true });
  await page.clock.runFor(34);
  const initial = await readState(page);
  const mealObservations = new Map(initial.creatures.map(resident => [resident.id, { id: resident.id, species: resident.species, meals: 0,
    eating: 0, smiling: 0, hearts: 0, minimumOpening: 1, maximumOpening: 0, portions: [] }]));
  const eatenPortions = new Set();
  const mealStages = {};
  const subjectId = map === 'pools' ? 'aster' : map === 'sunset' ? 'clover' : 'fin';
  const captureMeal = async (state, stage) => {
    await seek(page, state.creatures.find(resident => resident.id === subjectId).x);
    const current = await readState(page);
    const resident = current.creatures.find(item => item.id === subjectId);
    await page.screenshot({ path: path.join(output, `living-${engine}-${map}-meal-${stage}.png`) });
    mealStages[stage] = { time: current.time, resident, bubble: current.bubbles.find(bubble => bubble.id === subjectId) || null };
  };
  await captureMeal(initial, 'normal');
  const seen = new Set();
  const interactionEvents = new Map();
  const states = new Set();
  const snapshots = [];
  let progressAt = 60000;
  while ((await readState(page)).time < 435000) {
    await page.clock.runFor(250);
    const state = await readState(page);
    if (state.time >= progressAt) {
      console.log(`PROGRESS ${engine}/${map}: ${Math.round(state.time / 1000)} simulated seconds`);
      progressAt += 60000;
    }
    assert.equal(state.finite, true);
    assert.equal(state.creatures.length, 10, 'No resident may disappear during hunts or comic events');
    assert.ok(state.creatures.every(resident => resident.x >= 18 && resident.x <= 3182 && resident.physicalY >= 100 && resident.physicalY <= 870));
    assert.ok(state.props.filter(prop => prop.kind === 'food').length <= 24, 'Food bodies remain bounded during natural play');
    for (const resident of state.creatures) {
      states.add(`${resident.species}:${resident.state}`);
      const observation = mealObservations.get(resident.id);
      if (resident.feedingPose.eating) {
        observation.eating += 1;
        observation.minimumOpening = Math.min(observation.minimumOpening, resident.feedingPose.open);
        observation.maximumOpening = Math.max(observation.maximumOpening, resident.feedingPose.open);
      }
      observation.smiling += Number(resident.feedingPose.smile > 0.8);
      observation.hearts += Number(resident.feedingPose.heart);
      if (resident.meals > observation.meals) {
        assert.equal(resident.meals, observation.meals + 1, 'A natural meal is credited once');
        assert.equal(resident.lastMeal.assisted, false, 'The untouched world eats autonomously');
        assert.equal(eatenPortions.has(resident.lastMeal.portionId), false, 'Two residents cannot consume the same lifecycle');
        assert.equal(state.props.some(prop => prop.portionId === resident.lastMeal.portionId), false);
        eatenPortions.add(resident.lastMeal.portionId);
        observation.portions.push({ ...resident.lastMeal }); observation.meals = resident.meals;
      }
    }
    const subject = state.creatures.find(resident => resident.id === subjectId);
    if (!mealStages.satisfied && subject.feedingPose.eating && subject.foodPortion !== mealStages.eating?.resident.foodPortion) await captureMeal(state, 'eating');
    if (!mealStages.satisfied && subject.feedingPose.heart && subject.lastMeal?.portionId === mealStages.eating?.resident.foodPortion) {
      await captureMeal(state, 'satisfied');
      assert.equal(mealStages.satisfied.bubble?.kind, 'meal-heart', 'A completed autonomous meal has a visible larger heart');
      assert.equal(mealStages.satisfied.bubble.glyphScale, 1.5);
    }
    if (mealStages.satisfied && !mealStages.reverted && state.time >= mealStages.satisfied.resident.satisfiedUntil) {
      await captureMeal(state, 'reverted');
      assert.equal(mealStages.reverted.resident.feedingPose.smile, 0);
      assert.equal(mealStages.reverted.resident.feedingPose.heart, false);
    }
    if (state.time < 60000) assert.equal(Object.keys(state.comedy.counts).length, 0, 'The browser must preserve the real randomized one-to-seven-minute event timers');
    for (const event of state.comedy.events) {
      if (event.source === 'interaction') interactionEvents.set(event.id, event);
      if (seen.has(event.kind)) continue;
      seen.add(event.kind);
      snapshots.push({ ...event, observedAt: state.time });
      if (engine === 'chromium' && (map === 'lagoon' || event.kind === gags[special[map]])) {
        await seek(page, event.x);
        assert.ok(await pixels(page) > 60, 'Every captured event must be visibly rendered in a nonblank scene');
        await page.screenshot({ path: path.join(output, `living-${map}-${event.kind}.png`) });
      }
    }
  }
  const final = await readState(page);
  const meals = final.creatures.map(resident => ({ id: resident.id, species: resident.species, meals: resident.meals }));
  fs.writeFileSync(path.join(output, `living-${engine}-${map}-feeding-observations.json`), JSON.stringify({ source,
    sourceSha256: source.startsWith('file:') ? createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex') : null,
    simulatedMs: final.time, meals, observations: [...mealObservations.values()], stages: mealStages }, null, 2));
  for (const species of new Set(final.creatures.filter(resident => resident.food).map(resident => resident.species))) {
    assert.ok(meals.some(resident => resident.species === species && resident.meals > 0), `${map}: ${species} must actually find and eat food during natural play`);
    assert.ok([...mealObservations.values()].some(resident => resident.species === species && resident.eating > 0 && resident.smiling > 0 && resident.hearts > 0
      && resident.maximumOpening - resident.minimumOpening > 0.3), `${map}: ${species} needs observed autonomous mouth motion and satisfaction`);
  }
  assert.deepEqual(Object.keys(mealStages), ['normal', 'eating', 'satisfied', 'reverted']);
  const playfulEncounters = ['playful-chase', 'bird-fish-play', 'peekaboo', 'gentle-tingle'].filter(kind => final.encounterCounts[kind] > 0);
  assert.ok(playfulEncounters.length > 0, 'Natural play must include a real cross-species play encounter');
  for (const species of new Set(initial.creatures.map(resident => resident.species))) assert.ok(final.comedy.counts[gags[species]] > 0, `${map}: ${species} must perform its scheduled comic event`);
  assert.ok(final.comedy.counts['blobby-hiccup'] > 0);
  assert.ok(interactionEvents.size > 0, 'Actual nearby encounters must produce situational comedy in the browser');
  assert.ok([...interactionEvents.values()].some(event => event.time < event.baselineAt), 'At least one mutual interaction must bring a comic event forward from its baseline');
  assert.ok(final.encounterCounts['shark-hunt'] > 0 && final.encounterCounts['shark-snap'] > 0 && final.encounterCounts['fleeing-shark'] > 0);
  assert.ok(states.has('shark:stalking') || states.has('shark:lunging'), 'The shark must visibly pursue prey between recorded events');
  assert.ok(states.has('fish:fleeing'), 'Prey must visibly flee a pursuit');
  assert.equal(final.objectives.completed, 0, 'An untouched living world must not claim player objectives');
  assert.ok(final.comedy.events.length <= 16 && final.comedy.droppings.length <= 2);
  return { simulatedMs: final.time, meals, mealObservations: [...mealObservations.values()], mealStages, playfulEncounters, counts: final.comedy.counts, encounters: final.encounterCounts, interactionEvents: [...interactionEvents.values()], states: [...states], snapshots };
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const localUrl = pathToFileURL(path.join(root, 'index.html')).href;
  const report = { source, sourceSha256: source === localUrl ? createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex') : null, passed: false, cases: [] };
  const engines = ['chromium', 'webkit'].filter(engine => !process.env.BLOB_LIVING_ENGINES || process.env.BLOB_LIVING_ENGINES.split(',').includes(engine));
  const maps = ['lagoon', 'pools', 'sunset'].filter(map => !process.env.BLOB_LIVING_MAPS || process.env.BLOB_LIVING_MAPS.split(',').includes(map));
  assert.ok(engines.length && maps.length, 'Living-world selectors must run real browser cases');
  try {
    for (const engine of engines) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, colorScheme: 'light' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route(/^https?:\/\//, route => route.request().resourceType() === 'document' ? route.continue() : route.abort());
        await page.clock.install({ time: new Date('2026-09-08T12:00:00Z') });
        await page.clock.pauseAt(new Date('2026-09-08T12:00:00.100Z'));
        await page.goto(`${source}${source.includes('?') ? '&' : '?'}scoutTheme=light`);
        for (const map of maps) {
          try {
            await page.locator(`[data-map="${map}"]`).click({ force: true });
            await page.locator('#reset').click({ force: true });
            await page.clock.runFor(1600);
            assert.ok((await readState(page)).creatures.some(resident => resident.species === special[map]));
            console.log(`START ${engine}/${map}: manipulation, recovery, discoveries, and natural timeline`);
            const shape = map === 'lagoon' ? await shaping(page) : null;
            const reactions = await expressions(page, engine, map);
            const discoveries = await mapDiscoveries(page, engine, map);
            const timeline = await naturalTimeline(page, engine, map);
            assert.deepEqual(errors, []);
            report.cases.push({ engine, map, shape, reactions, discoveries, timeline, passed: true });
            console.log(`PASS ${engine}/${map}: habitat reactions, voices, hunts, ${Math.round(timeline.simulatedMs / 1000)} seconds of natural comic events`);
          } catch (error) {
            fs.writeFileSync(path.join(output, `living-${engine}-${map}-failure.json`), JSON.stringify(await readState(page), null, 2));
            await page.screenshot({ path: path.join(output, `living-${engine}-${map}-failure.png`) });
            throw error;
          }
        }
        await context.close();
      } finally { await browser.close(); }
    }
    report.passed = true;
  } finally { fs.writeFileSync(path.join(output, 'living-browser-results.json'), JSON.stringify(report, null, 2)); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });