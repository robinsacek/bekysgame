const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const stateOf = page => page.evaluate(() => window.__blobIsland.snapshot());
const screenPoint = (state, view, point) => ({ x: (point.x - state.camera.x) / state.camera.width * view.width, y: point.y / state.height * view.height });
const pointer = (page, type, point, id = 81) => page.dispatchEvent('#world', type, { pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true });

async function frames(page, count) {
  const before = await stateOf(page);
  await page.waitForFunction(target => window.__blobIsland.snapshot().frames >= target, before.frames + count);
}

async function seek(page, positionX) {
  const state = await stateOf(page);
  const overview = page.locator('#coast-overview');
  const box = await overview.boundingBox();
  await overview.click({ position: { x: Math.max(1, Math.min(box.width - 1, positionX / state.width * box.width)), y: box.height / 2 } });
}

async function trackWorldTarget(page, target, count) {
  await page.evaluate(({ target, count }) => new Promise(resolve => {
    let frame = 0;
    const move = () => {
      const state = window.__blobIsland.snapshot();
      const canvas = document.getElementById('world');
      const bounds = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 81, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, bubbles: true,
        clientX: bounds.left + Math.max(14, Math.min(bounds.width - 14, (target.x - state.camera.x) / state.camera.width * bounds.width)), clientY: bounds.top + target.y / state.height * bounds.height }));
      frame += 1;
      if (frame >= count) resolve(); else requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
  }), { target, count });
}

async function carry(page, view, selector, target) {
  let state = await stateOf(page);
  const item = selector === 'blob' ? state.blob : state.props.find(prop => prop.id === selector);
  assert.ok(item, 'The carried object must exist');
  if (selector === 'blob') await page.locator('#find-jelly').click(); else await seek(page, item.x);
  state = await stateOf(page);
  const current = selector === 'blob' ? state.blob : state.props.find(prop => prop.id === selector);
  await pointer(page, 'pointerdown', screenPoint(state, view, current));
  assert.equal((await stateOf(page)).drags, 1, 'The actual input handler must acquire the carried object');
  if (selector !== 'blob') {
    const grabbed = await stateOf(page);
    assert.equal(grabbed.props.find(prop => prop.id === selector).playerHandled, true, `The touch must acquire prop ${selector}: ${JSON.stringify({ point: current, grips: grabbed.grips })}`);
  }
  const liftY = Math.max(245, state.ground - 165);
  await pointer(page, 'pointermove', screenPoint(state, view, { x: current.x, y: liftY }));
  await frames(page, 55);
  const direction = Math.sign(target.x - current.x);
  if (target.x < state.camera.x + 55 || target.x > state.camera.x + state.camera.width - 55) {
    await pointer(page, 'pointermove', { x: direction > 0 ? view.width - 12 : 12, y: liftY / 900 * view.height });
    await page.waitForFunction(({ selector, target, direction }) => {
      const state = window.__blobIsland.snapshot();
      const item = selector === 'blob' ? state.blob : state.props.find(prop => prop.id === selector);
      return direction > 0 ? item.x > target.x - 85 : item.x < target.x + 85;
    }, { selector, target, direction }, { timeout: 18000 });
  }
  await trackWorldTarget(page, { x: target.x, y: liftY }, 65);
  await page.waitForFunction(({ selector, positionX }) => {
    const state = window.__blobIsland.snapshot();
    const item = selector === 'blob' ? state.blob : state.props.find(prop => prop.id === selector);
    return Math.abs(item.x - positionX) < 46;
  }, { selector, positionX: target.x });
  await trackWorldTarget(page, target, 65);
  state = await stateOf(page);
  const destination = screenPoint(state, view, target);
  destination.x = Math.max(14, Math.min(view.width - 14, destination.x));
  await pointer(page, 'pointerup', destination);
  assert.equal((await stateOf(page)).drags, 0);
  const delivered = await stateOf(page);
  const landed = selector === 'blob' ? delivered.blob : delivered.props.find(prop => prop.id === selector);
  assert.ok(Math.abs(landed.x - target.x) < 55, 'The carried object must actually reach the intended world-space landmark');
}

async function exerciseCoast(page, config, output) {
  await page.locator('[data-map="lagoon"]').click();
  await page.locator('#reset').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().time > 1100);
  const initial = await stateOf(page);
  assert.equal(initial.version, 4);
  assert.equal(initial.blob.name, 'Blobby');
  assert.equal(initial.width, 3200);
  assert.ok(initial.camera.width < initial.width, 'The coast must extend beyond the viewport');
  assert.equal(initial.creatures.length, 10);
  assert.ok(initial.creatures.some(resident => resident.id === 'mango' && resident.species === 'lizard'), 'Little Lagoon must include its own local character');
  assert.ok(initial.height * 0.96 - initial.water > 330, 'The sea must have a deeper playable water column');
  assert.ok(initial.sceneryPixels <= 5000000, 'The scenery cache must remain memory-bounded');
  assert.equal(initial.objectives.completed, 0);
  await page.locator('#journal').click();
  assert.equal(await page.locator('#journal-entries li').count(), 4);
  const journal = await page.locator('#journal-panel').boundingBox();
  assert.ok(journal.x >= 0 && journal.x + journal.width <= config.viewport.width, 'The journal must fit the viewport');
  await page.getByRole('button', { name: 'View Far-shore lookout', exact: true }).click();
  const viewed = await stateOf(page);
  assert.equal(viewed.camera.x, viewed.camera.maximum);
  assert.equal(viewed.objectives.completed, 0, 'Camera-only travel must not complete exploration');
  await page.screenshot({ path: path.join(output, `${config.name}-far-view.png`) });
  await page.locator('#find-jelly').click();
  const home = await stateOf(page);
  const background = { x: config.viewport.width * 0.86, y: config.viewport.height * 0.34 };
  await pointer(page, 'pointerdown', background);
  await pointer(page, 'pointermove', { x: config.viewport.width * 0.38, y: background.y });
  await pointer(page, 'pointerup', { x: config.viewport.width * 0.38, y: background.y });
  assert.ok((await stateOf(page)).camera.x > home.camera.x + 40, 'Dragging empty scenery must pan');
  await page.locator('#find-jelly').click();
  await carry(page, config.viewport, 'blob', { x: initial.landmarks.far.x, y: initial.landmarks.far.y - 80 });
  await page.waitForFunction(() => window.__blobIsland.snapshot().objectives.entries[0].complete, undefined, { timeout: 9000 });
  const arrived = await stateOf(page);
  assert.ok(arrived.blob.x > 2900);
  assert.equal(arrived.pointerCount, 0);
  await page.screenshot({ path: path.join(output, `${config.name}-lookout.png`) });
  if (['desktop', 'tablet-native-touch', 'ipad-landscape'].includes(config.name)) {
    await carry(page, config.viewport, 'blob', { x: initial.spawn.x - 80, y: initial.ground - 85 });
    await frames(page, 90);
    const back = await stateOf(page);
    assert.ok(back.blob.x < 650, 'Blobby must be able to return');
    const shells = back.props.filter(prop => prop.expeditionId?.startsWith('shell-'));
    for (let index = 0; index < shells.length; index += 1) await carry(page, config.viewport, shells[index].id, { x: back.landmarks.nook.x + (index ? 26 : -26), y: back.landmarks.nook.y - shells[index].radius - 4 });
    await page.waitForFunction(() => window.__blobIsland.snapshot().objectives.entries[1].complete, undefined, { timeout: 10000 });
    const beforePicnic = await stateOf(page);
    const coconut = beforePicnic.props.find(prop => prop.kind === 'coconut');
    await carry(page, config.viewport, coconut.id, { x: beforePicnic.landmarks.picnic.x, y: beforePicnic.landmarks.picnic.y - coconut.radius - 4 });
    await seek(page, beforePicnic.landmarks.picnic.x);
    await page.waitForFunction(() => window.__blobIsland.snapshot().objectives.entries[2].complete, undefined, { timeout: 30000 });
    assert.ok((await stateOf(page)).objectives.entries.slice(0, 3).every(entry => entry.complete), 'The original three objectives must remain achievable using real controls');
    await page.screenshot({ path: path.join(output, `${config.name}-picnic.png`) });
    await carry(page, config.viewport, 'blob', { x: initial.landmarks.reef.x, y: initial.water + 150 });
    await page.locator('#find-jelly').click();
    const swimming = await stateOf(page);
    await pointer(page, 'pointerdown', screenPoint(swimming, config.viewport, swimming.blob));
    assert.equal((await stateOf(page)).grips[0]?.kind, 'blob');
    const guidance = [];
    try {
      for (const species of ['jellyfish', 'fish', 'octopus', 'shark']) {
        if ((await stateOf(page)).objectives.entries[3].complete) break;
        guidance.push(await page.evaluate(species => new Promise(resolve => {
          const initial = window.__blobIsland.snapshot();
          const first = initial.creatures.find(item => item.species === species);
          const offset = first.x > initial.blob.x ? -95 : 95;
          const target = { x: initial.blob.x, y: initial.blob.y };
          const observations = [];
          const encounters = new Map();
          let previousTime = initial.time;
          let sampledAt = initial.time - 250;
          const move = () => {
            const state = window.__blobIsland.snapshot();
            const resident = state.creatures.find(item => item.species === species);
            const canvas = document.getElementById('world');
            const bounds = canvas.getBoundingClientRect();
            const destination = { x: Math.max(state.coast.waterStart + 65, Math.min(state.coast.waterEnd - 65, resident.x + offset)), y: Math.max(state.water + 75, resident.y - 25) };
            const travel = Math.hypot(destination.x - target.x, destination.y - target.y);
            const maximumStep = 2.1 * Math.min(2, Math.max(0, (state.time - previousTime) / (1000 / 60)));
            const fraction = travel ? Math.min(1, maximumStep / travel) : 0;
            target.x += (destination.x - target.x) * fraction;
            target.y += (destination.y - target.y) * fraction;
            previousTime = state.time;
            canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 81, pointerType: 'touch', bubbles: true, button: 0, buttons: 1,
              clientX: bounds.left + Math.max(14, Math.min(bounds.width - 14, (target.x - state.camera.x) / state.camera.width * bounds.width)),
              clientY: bounds.top + target.y / state.height * bounds.height }));
            for (const encounter of state.encounters) if (encounter.time >= initial.time && encounter.second === 'blob') encounters.set(encounter.id, encounter);
            if (state.time - sampledAt >= 250) {
              observations.push({ time: state.time, distance: Math.hypot(state.blob.x - resident.x, state.blob.y - resident.y), speed: Math.hypot(state.blob.velocity.x, state.blob.velocity.y), residentState: resident.state, progress: state.objectives.entries[3].progress });
              sampledAt = state.time;
            }
            if (state.time - initial.time >= 14500 || state.objectives.entries[3].progress > initial.objectives.entries[3].progress) {
              resolve({ species, startedAt: initial.time, elapsed: state.time - initial.time, progressBefore: initial.objectives.entries[3].progress, progressAfter: state.objectives.entries[3].progress, observations, encounters: [...encounters.values()] });
            } else requestAnimationFrame(move);
          };
          requestAnimationFrame(move);
        }), species));
      }
    } finally {
      await pointer(page, 'pointerup', { x: 0, y: 0 });
      fs.writeFileSync(path.join(output, `${config.name}-reef-guidance.json`), JSON.stringify({ source: page.url(), guidance }, null, 2));
    }
    assert.equal((await stateOf(page)).objectives.completed, 4, 'Actual player-guided reef encounters must complete the fourth objective');
    await page.screenshot({ path: path.join(output, `${config.name}-reef-friends.png`) });
  }
  await seek(page, initial.landmarks.reef.x);
  await frames(page, 80);
  const reef = await stateOf(page);
  assert.equal(reef.creatures.filter(item => ['fish', 'jellyfish', 'shark', 'octopus'].includes(item.species)).length, 5);
  await page.screenshot({ path: path.join(output, `${config.name}-reef.png`) });
  await page.locator('#pause').click();
  const frozen = await stateOf(page);
  await page.locator('[data-map="pools"]').click();
  assert.ok((await stateOf(page)).creatures.some(resident => resident.id === 'aster' && resident.species === 'starfish'), 'Tide Pools must include its own reef character');
  await page.locator('[data-map="sunset"]').click();
  assert.ok((await stateOf(page)).creatures.some(resident => resident.id === 'clover' && resident.species === 'rabbit'), 'Sunset Cove must include its own land character');
  await page.locator('[data-map="lagoon"]').click();
  const retained = await stateOf(page);
  assert.deepEqual(retained.objectives, frozen.objectives, 'Map changes must preserve progress');
  assert.deepEqual(retained.creatures, frozen.creatures, 'Map changes must preserve resident identities and activities');
  await page.locator('#reset').click();
  assert.equal((await stateOf(page)).objectives.completed, 0);
  assert.equal((await stateOf(page)).creatures.length, 10);
  await frames(page, 70);
}

module.exports = { exerciseCoast };