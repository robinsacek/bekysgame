const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildSync } = require('esbuild');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');
const { exerciseCoast } = require('./coast-browser.cjs');
const { installAudioProbe, exerciseAudio } = require('./audio-browser.cjs');
const { exerciseFeeding } = require('./feeding-browser.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const localUrl = pathToFileURL(path.join(root, 'index.html')).href;
const baseUrl = process.env.BLOB_URL || localUrl;
const features = process.env.BLOB_FEATURES || 'all';
const stage = (process.env.BLOB_STAGE || 'current').replace(/[^a-z0-9-]/gi, '');
const sourceSha256 = baseUrl === localUrl ? createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex') : null;
const report = [];
const snapshot = page => page.evaluate(() => window.__blobIsland.snapshot());

async function frames(page, count) {
  const initial = await snapshot(page);
  await page.waitForFunction(target => window.__blobIsland.snapshot().frames >= target, initial.frames + count);
}

async function layoutAndPixels(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('world');
    const context = canvas.getContext('2d');
    canvas.toDataURL();
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    const rgbColors = new Set();
    let signature = 0;
    for (let offset = 0; offset < image.data.length; offset += 4 * 113) {
      colors.add(`${image.data[offset] >> 4},${image.data[offset + 1] >> 4},${image.data[offset + 2] >> 4}`);
      signature = (Math.imul(signature, 31) + image.data[offset] + image.data[offset + 1] * 3) | 0;
    }
    for (let offset = 0; offset < image.data.length && rgbColors.size <= 512; offset += 4) rgbColors.add(image.data[offset] * 65536 + image.data[offset + 1] * 256 + image.data[offset + 2]);
    const identity = document.querySelector('.identity').getBoundingClientRect();
    const controls = document.querySelector('.controls').getBoundingClientRect();
    const maps = document.querySelector('.map-switcher').getBoundingClientRect();
    const credits = document.querySelector('.music-credit').getBoundingClientRect();
    return { colors: colors.size, rgbColors: rgbColors.size, signature, width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      headerOverlap: identity.right > controls.left - 3,
      mapOverlap: maps.top < Math.max(identity.bottom, controls.bottom) + 8,
      mapsClipped: maps.left < 0 || maps.right > innerWidth,
      creditsClipped: credits.left < 0 || credits.right > innerWidth,
      buttons: [...document.querySelectorAll('.icon-button')].filter(button => button.getBoundingClientRect().width > 0).map(button => ({ label: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, icon: Boolean(button.querySelector('svg')) })),
      touchAction: getComputedStyle(canvas).touchAction, errorVisible: !document.getElementById('error').hidden };
  });
}

function screenPoint(state, viewport, point) {
  return { x: (point.x - state.camera.x) / state.camera.width * viewport.width, y: point.y / state.height * viewport.height };
}

function blobWidth(state) {
  const positions = state.blob.particles.map(particle => particle.x);
  return Math.max(...positions) - Math.min(...positions);
}

async function pointerEvent(page, type, pointerId, point) {
  await page.dispatchEvent('#world', type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 21, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true });
}

async function exercise(page, context, config) {
  const initial = await snapshot(page);
  const start = screenPoint(initial, config.viewport, initial.blob);
  const target = { x: start.x + Math.min(150, config.viewport.width * 0.13), y: start.y - Math.min(180, config.viewport.height * 0.20) };
  if (config.nativeTouch) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...target, id: 1 }] });
    await page.waitForFunction(origin => window.__blobIsland.snapshot().blob.y < origin - 90, initial.blob.y);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal((await snapshot(page)).drags, 0, 'Native touch release must remove its drag constraint');
    await page.locator('#reset').click();
    await page.waitForFunction(() => window.__blobIsland.snapshot().time > 1100);
    const current = await snapshot(page);
    const center = screenPoint(current, config.viewport, current.blob);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x - 15, y: center.y, id: 1 }, { x: center.x + 15, y: center.y, id: 2 }] });
    await page.waitForFunction(() => window.__blobIsland.snapshot().drags === 2);
    assert.equal((await snapshot(page)).drags, 2, 'Two real touch contacts must create independent grabs');
    const spread = 120 * config.viewport.height / 900;
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x - spread, y: center.y - 90, id: 1 }, { x: center.x + spread, y: center.y - 90, id: 2 }] });
    await frames(page, 75);
    assert.ok(blobWidth(await snapshot(page)) > blobWidth(current) * 2, 'Native two-finger input must visibly stretch the mesh');
    await page.screenshot({ path: path.join(output, `${config.name}-stretched.png`) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal((await snapshot(page)).drags, 0, 'Cancelled native touches must not strand the jelly');
    await session.detach();
  } else if (config.touch) {
    await pointerEvent(page, 'pointerdown', 21, start);
    assert.equal((await snapshot(page)).drags, 1, 'Touch pointer down must grab the jelly');
    await pointerEvent(page, 'pointermove', 21, target);
    await page.waitForFunction(origin => window.__blobIsland.snapshot().blob.y < origin - 90, initial.blob.y);
    await pointerEvent(page, 'pointercancel', 21, target);
    assert.equal((await snapshot(page)).drags, 0, 'Cancelled WebKit touch must release the jelly');
    await page.touchscreen.tap(target.x, target.y);
    assert.equal((await snapshot(page)).drags, 0, 'A native WebKit tap must finish without a stuck grab');
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 16 });
    await page.waitForFunction(origin => window.__blobIsland.snapshot().blob.y < origin - 90, initial.blob.y);
    await page.mouse.up();
    assert.equal((await snapshot(page)).drags, 0, 'Mouse release must remove its drag constraint');
  }
  await page.locator('#pause').click();
  const paused = await snapshot(page);
  assert.equal(paused.paused, true);
  await frames(page, 8);
  assert.equal((await snapshot(page)).time, paused.time, 'Paused physics must not advance');
  await page.locator('#reset').click();
  const reset = await snapshot(page);
  assert.equal(reset.paused, false);
  assert.ok(Math.abs(reset.blob.x - reset.spawn.x) < 15, 'Reset must restore Blobby to the fixed beach spawn');
  assert.equal(reset.props.length, reset.initialProps, 'Reset must restore exactly the current area\'s initial toys');
  if (reset.audioSupported) {
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.__blobIsland.snapshot().sound);
    assert.equal((await snapshot(page)).audioState, 'running', 'A user gesture must unlock audio');
    await page.locator('#sound').click();
    await page.waitForFunction(() => !window.__blobIsland.snapshot().sound);
    assert.equal((await snapshot(page)).audioState, 'suspended');
  } else {
    assert.equal(await page.locator('#sound').isDisabled(), true, 'An unavailable audio API must have an honest disabled control');
    assert.equal((await snapshot(page)).audioState, 'not-created');
  }
  await frames(page, 65);
  const final = await snapshot(page);
  assert.equal(final.finite, true);
  assert.ok(final.blob.area > 1000, 'Interactions must preserve the soft mesh');
}

async function exerciseIslands(page, config) {
  await page.locator('#reset').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().time > 1200);
  const initial = await snapshot(page);
  if (initial.audioSupported) {
    await page.locator('#sound').click();
    await page.waitForFunction(() => {
      const state = window.__blobIsland.snapshot();
      return state.sound && state.audioState === 'running';
    });
  }
  const center = screenPoint(initial, config.viewport, initial.blob);
  const scale = config.viewport.height / 900;
  await pointerEvent(page, 'pointerdown', 21, { x: center.x - 24 * scale, y: center.y });
  await pointerEvent(page, 'pointerdown', 22, { x: center.x + 24 * scale, y: center.y });
  assert.equal((await snapshot(page)).drags, 2, 'Both skin grips must be held independently');
  const left = { x: Math.max(9, center.x - 120 * scale), y: center.y - 100 * scale };
  const right = { x: center.x + 120 * scale, y: center.y - 100 * scale };
  await pointerEvent(page, 'pointermove', 21, left);
  await pointerEvent(page, 'pointermove', 22, right);
  await frames(page, 100);
  const stretched = await snapshot(page);
  assert.ok(blobWidth(stretched) > blobWidth(initial) * 2, 'The rendered jelly must stretch rather than act as a rigid ball');
  assert.ok(stretched.blob.area > 1000, 'The stretched character must retain its volume');
  await page.screenshot({ path: path.join(output, `${config.name}-jelly.png`) });
  await pointerEvent(page, 'pointercancel', 21, left);
  assert.equal((await snapshot(page)).drags, 1, 'Cancelling one finger must leave the other grip intact');
  await pointerEvent(page, 'pointerup', 22, right);
  await frames(page, 80);
  assert.equal((await snapshot(page)).drags, 0);
  if (initial.audioSupported) {
    const effects = (await snapshot(page)).soundEvents;
    assert.ok(effects.grab > 0, 'Touching the jelly must produce its specific grab effect');
    assert.ok(effects.stretch > 0, 'Shape changes must produce a stretch effect without constant buzzing');
    assert.ok(effects.release > 0, 'Releasing a finger must produce the separate release effect');
  }

  await page.locator('[data-map="pools"]').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().map === 'pools' && window.__blobIsland.snapshot().time > 1100);
  const pools = await snapshot(page);
  assert.ok(pools.props.some(prop => prop.kind === 'shell'), 'Tide Pools must have sinking shells');
  await page.screenshot({ path: path.join(output, `${config.name}-pools.png`) });
  const crown = screenPoint(pools, config.viewport, pools.tree.hitTarget);
  await pointerEvent(page, 'pointerdown', 31, crown);
  assert.equal((await snapshot(page)).drags, 1, 'The visible palm must accept a touch');
  const shake = { x: crown.x + 150 * scale, y: crown.y + 35 * scale };
  await pointerEvent(page, 'pointermove', 31, shake);
  const reaction = await page.waitForFunction(() => {
    const state = window.__blobIsland.snapshot();
    return state.tree.dropped >= 1 && Math.abs(state.tree.angle) > 0.035 ? state : false;
  });
  const shaken = await reaction.jsonValue();
  await reaction.dispose();
  await pointerEvent(page, 'pointerup', 31, shake);
  assert.ok(Math.abs(shaken.tree.angle) > 0.035, 'The palm must visibly react');
  assert.equal(shaken.props.length, shaken.initialProps + shaken.tree.dropped, 'Fallen coconuts must be playable objects');
  await page.screenshot({ path: path.join(output, `${config.name}-palm.png`) });
  await page.locator('#pause').click();
  const frozen = await snapshot(page);
  assert.equal(frozen.activeVoices, 0, 'Pausing must discard effects that would otherwise play on resume');
  await page.locator('[data-map="sunset"]').click();
  const sunset = await snapshot(page);
  assert.equal(sunset.map, 'sunset');
  assert.ok(sunset.props.some(prop => prop.kind === 'seesaw'), 'Sunset Cove must have its hinged seesaw');
  await page.screenshot({ path: path.join(output, `${config.name}-sunset.png`) });
  await page.locator('[data-map="pools"]').click();
  const restored = await snapshot(page);
  assert.equal(restored.time, frozen.time, 'Unvisited areas must remain frozen, not secretly reset or simulate');
  assert.equal(restored.tree.dropped, frozen.tree.dropped, 'Switching areas must retain fallen coconuts');
  assert.equal(restored.props.length, frozen.props.length, 'Switching areas must not duplicate toys');
  await page.locator('#reset').click();
  assert.equal((await snapshot(page)).tree.attached, 3, 'Reset must restore this island\'s coconuts');
  await page.locator('[data-map="lagoon"]').click();
  await page.locator('#reset').click();
  if (config.name === 'desktop' || config.name === 'ipad-landscape') {
    await page.waitForFunction(() => window.__blobIsland.snapshot().time > 1100);
    const resting = await snapshot(page);
    const blob = screenPoint(resting, config.viewport, resting.blob);
    const target = resting.tree.hitTarget;
    const lift = screenPoint(resting, config.viewport, { x: target.x + 135, y: target.y - 15 });
    const crash = screenPoint(resting, config.viewport, { x: target.x - 24, y: target.y - 15 });
    await pointerEvent(page, 'pointerdown', 41, blob);
    await pointerEvent(page, 'pointermove', 41, lift);
    await frames(page, 65);
    await pointerEvent(page, 'pointermove', 41, crash);
    await page.waitForFunction(() => window.__blobIsland.snapshot().tree.impacts > 0);
    await pointerEvent(page, 'pointerup', 41, crash);
    assert.ok((await snapshot(page)).tree.dropped >= 1, 'Crashing the jelly into the visible trunk must knock down a coconut');
    await page.screenshot({ path: path.join(output, `${config.name}-crash.png`) });
    await page.locator('#reset').click();
  }

  if (initial.musicSupported) {
    await page.locator('#music').click();
    await page.waitForFunction(() => window.__blobIsland.snapshot().music && window.__blobIsland.snapshot().musicTime > 0.2);
    assert.equal((await snapshot(page)).musicError, null, 'The embedded recording must decode and play');
    await page.locator('#pause').click();
    const paused = await snapshot(page);
    await frames(page, 10);
    assert.equal((await snapshot(page)).musicPaused, true, 'Pausing the game must also pause the music');
    assert.ok(Math.abs((await snapshot(page)).musicTime - paused.musicTime) < 0.1);
    await page.locator('#pause').click();
    await page.waitForFunction(previous => window.__blobIsland.snapshot().musicTime > previous + 0.15, paused.musicTime);
    if ((await snapshot(page)).sound) await page.locator('#sound').click();
    const independent = await snapshot(page);
    assert.equal(independent.sound, false, 'Sound effects can be muted independently');
    await page.waitForFunction(previous => window.__blobIsland.snapshot().musicTime > previous + 0.15, independent.musicTime);
    const musicBeforeSwitch = (await snapshot(page)).musicTime;
    await page.locator('[data-map="sunset"]').click();
    await page.waitForFunction(previous => window.__blobIsland.snapshot().musicTime > previous + 0.15, musicBeforeSwitch);
    assert.equal((await snapshot(page)).musicPaused, false, 'Music must continue through an area change');
    await page.locator('[data-map="lagoon"]').click();
    await page.locator('#music').click();
    assert.equal((await snapshot(page)).musicPaused, true, 'The separate music control must stop playback');
  } else assert.equal(await page.locator('#music').isDisabled(), true, 'An unavailable music decoder must have an honest disabled control');
  if ((await snapshot(page)).sound) await page.locator('#sound').click();
  assert.equal((await snapshot(page)).activeVoices, 0, 'Muting effects must release every short-lived sound node');
  await frames(page, 60);
  assert.equal((await snapshot(page)).finite, true);
}

async function comicGallery(page, config) {
  const bundle = buildSync({ stdin: { contents: `export { IslandPhysics } from './src/physics.js';
    export { IslandScene } from './src/scene.js'; export { drawCreature } from './src/creature-art.js';
    export { drawLocalResident, drawReaction, drawComicEffects } from './src/character-details.js';
    export { REPERTOIRE, SIGNATURES } from './src/antics.js'; export { blobPath, blobDrawingPoints } from './src/sprites.js';`, resolveDir: root },
    bundle: true, write: false, format: 'iife', globalName: 'VisualFixture' }).outputFiles[0].text;
  await page.addScriptTag({ content: bundle });
  const galleries = await page.evaluate(() => {
    const results = [];
    for (const mapId of ['lagoon', 'pools', 'sunset']) {
      const island = new VisualFixture.IslandPhysics(3200, 900, mapId, true);
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 1100;
      const scene = new VisualFixture.IslandScene(canvas, island);
      const context = canvas.getContext('2d');
      for (const [phase, time] of [['anticipation', 175], ['action', 1125], ['reaction', 2250]]) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = scene.paint(scene.mix(scene.colors.paper, scene.colors.ocean, 0.20)); context.fillRect(0, 0, canvas.width, canvas.height);
        let cells = 0;
        for (const [row, resident] of island.wildlife.residents.entries()) {
          const choices = [...VisualFixture.REPERTOIRE[resident.species], ...(VisualFixture.SIGNATURES[resident.id] ? [VisualFixture.SIGNATURES[resident.id]] : [])];
          context.font = '13px Segoe UI'; context.fillStyle = scene.paint(scene.colors.ink);
          context.fillText(`${resident.name} / ${resident.species}`, 12, 20 + row * 108);
          for (const [column, kind] of choices.entries()) {
            resident.antic = kind; resident.anticStart = 0; resident.anticUntil = 2500; resident.anticIntensity = 1;
            resident.body.position = { x: 0, y: 0 }; resident.body.velocity = { x: 0, y: 0 };
            resident.depth = 0; resident.held = false; resident.facing = 1; resident.direction = 1;
            resident.lookAt = null; resident.recovery = ''; resident.frown = false; resident.motionPhase = 0;
            island.wildlife.comedy.events = [{ kind, time: 0, character: resident.id, x: 0, y: 0 }];
            context.save(); context.translate(95 + column * 185, 59 + row * 108);
            if (!VisualFixture.drawLocalResident(scene, context, resident, time)) VisualFixture.drawCreature(scene, context, resident, time);
            VisualFixture.drawReaction(scene, context, resident, time);
            VisualFixture.drawComicEffects(scene, context, island, time);
            context.restore();
            context.font = '11px Segoe UI'; context.fillStyle = scene.paint(scene.colors.ink);
            context.fillText(kind, 26 + column * 185, 100 + row * 108);
            cells += 1;
          }
        }
        results.push({ mapId, phase, cells, png: canvas.toDataURL('image/png') });
      }
      island.dispose();
    }
    return results;
  });
  for (const gallery of galleries) {
    assert.ok(gallery.cells >= 40, 'The gallery must render every existing resident repertoire');
    fs.writeFileSync(path.join(output, `${stage}-${config.name}-${gallery.mapId}-${gallery.phase}.png`), Buffer.from(gallery.png.split(',')[1], 'base64'));
  }
  return galleries.map(({ mapId, phase, cells }) => ({ mapId, phase, cells }));
}

async function verifyScene(page) {
  const result = await page.evaluate(async () => {
    const island = new VisualFixture.IslandPhysics(3200, 900, 'lagoon', true);
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 900;
    const scene = new VisualFixture.IslandScene(canvas, island);
    const caches = [...scene.layers, ...scene.frondSprites.values()].map(entry => ({ entry, original: entry.canvas,
      width: entry.canvas.width, height: entry.canvas.height, pixels: entry.canvas.getContext('2d').getImageData(0, 0, entry.canvas.width, entry.canvas.height).data }));
    await new Promise((resolve, reject) => {
      const started = performance.now();
      const decoded = () => {
        if (caches.every(cache => cache.entry.canvas instanceof HTMLImageElement)) resolve();
        else if (performance.now() - started > 5000) reject(new Error('Static scenery caches did not decode'));
        else requestAnimationFrame(decoded);
      };
      decoded();
    });
    let cachePixelDifference = 0;
    let releasedCanvases = 0;
    for (const cache of caches) {
      const inspection = document.createElement('canvas'); inspection.width = cache.width; inspection.height = cache.height;
      const drawing = inspection.getContext('2d'); drawing.drawImage(cache.entry.canvas, 0, 0);
      const pixels = drawing.getImageData(0, 0, inspection.width, inspection.height).data;
      for (let offset = 0; offset < pixels.length; offset += 1) cachePixelDifference = Math.max(cachePixelDifference, Math.abs(pixels[offset] - cache.pixels[offset]));
      releasedCanvases += Number(cache.original.width === 1 && cache.original.height === 1);
      inspection.width = 1; inspection.height = 1;
    }
    const context = canvas.getContext('2d');
    const camera = { x: 0, viewWidth: 1440 };
    const sourceOffsets = [];
    const original = context.drawImage.bind(context);
    context.drawImage = (...args) => {
      const layer = scene.layers.find(item => item.canvas === args[0]);
      if (layer) sourceOffsets.push({ kind: layer.kind, x: args[1] / layer.scale });
      return original(...args);
    };
    scene.quality.refraction = true; scene.lastTime = 1200;
    scene.draw(island, 1200, null, false, camera);
    const refracted = context.getImageData(0, 0, canvas.width, canvas.height).data;
    scene.quality.refraction = false;
    scene.draw(island, 1200, null, false, camera);
    const plain = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const mask = document.createElement('canvas'); mask.width = canvas.width; mask.height = canvas.height;
    const maskContext = mask.getContext('2d');
    VisualFixture.blobPath(maskContext, VisualFixture.blobDrawingPoints(island));
    maskContext.fillStyle = 'white'; maskContext.fill(); maskContext.strokeStyle = 'white'; maskContext.lineWidth = 3; maskContext.stroke();
    const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
    let inside = 0; let outside = 0;
    for (let offset = 0; offset < plain.length; offset += 4) {
      const difference = Math.abs(plain[offset] - refracted[offset]) + Math.abs(plain[offset + 1] - refracted[offset + 1]) + Math.abs(plain[offset + 2] - refracted[offset + 2]);
      if (difference <= 3) continue;
      if (pixels[offset + 3]) inside += 1; else outside += 1;
    }
    sourceOffsets.length = 0;
    scene.draw(island, 1200, null, false, { x: 100, viewWidth: 1440 });
    const parallax = [...sourceOffsets];
    const renderMs = {};
    for (const enabled of [true, false]) {
      scene.quality.refraction = enabled;
      const costs = [];
      for (let frame = 0; frame < 20; frame += 1) {
        const start = performance.now();
        scene.draw(island, 1200, null, false, camera);
        context.getImageData(0, 0, 1, 1);
        costs.push(performance.now() - start);
      }
      costs.sort((first, second) => first - second);
      renderMs[enabled ? 'refraction' : 'plain'] = { p50: costs[10], p95: costs[18] };
    }
    scene.quality.caustics = false; scene.quality.parallax = false; scene.quality.refraction = false;
    scene.draw(island, 1200, null, true, camera);
    const fallback = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const fallbackColors = new Set();
    for (let offset = 0; offset < fallback.length; offset += 4 * 113) fallbackColors.add(`${fallback[offset] >> 4},${fallback[offset + 1] >> 4},${fallback[offset + 2] >> 4}`);
    island.dispose();
    return { insideChanged: inside, outsideChanged: outside, sceneryPixels: scene.sceneryPixels, scratchPixels: scene.refractionCanvas.width * scene.refractionCanvas.height,
      parallax, renderMs, fallbackColors: fallbackColors.size, fallbackRefraction: scene.refraction,
      cacheCount: caches.length, cachePixelDifference, releasedCanvases };
  });
  fs.writeFileSync(path.join(output, `${stage}-rendering.json`), JSON.stringify(result, null, 2));
  assert.ok(result.insideChanged > 40, 'Refraction must change actual silhouette pixels');
  assert.equal(result.outsideChanged, 0, 'Refraction must not leak outside the production silhouette');
  assert.ok(result.sceneryPixels <= 4500000);
  assert.equal(result.cachePixelDifference, 0, 'Immutable scenery images must preserve the original cached pixels exactly');
  assert.equal(result.releasedCanvases, result.cacheCount, 'Decoded images release every replaced canvas backing store');
  assert.ok(result.scratchPixels <= 512 * 512);
  for (const [index, expected] of [25, 55, 100].entries()) assert.ok(Math.abs(result.parallax[index].x - expected) < 1e-9, 'Parallax must match its factor to sub-pixel precision');
  assert.ok(result.fallbackColors > 60);
  assert.equal(result.fallbackRefraction, null);
  return result;
}

async function exerciseRhythms(page, config) {
  await page.clock.install({ time: new Date('2026-09-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-09T12:00:00.100Z'));
  const cases = [];
  for (const [mapId, eventTime, kind] of [['lagoon', 24000, 'seedpod-drift'], ['pools', 18000, 'spray-set'], ['sunset', 28000, 'firefly-gust']]) {
    await page.locator(`[data-map="${mapId}"]`).click({ force: true });
    await page.locator('#reset').click({ force: true });
    await page.clock.runFor(1600);
    const state = await snapshot(page);
    const overview = page.locator('#coast-overview'); const bounds = await overview.boundingBox();
    const target = mapId === 'sunset' ? state.width * 0.95 : state.coast.waterStart + 160;
    await overview.click({ force: true, position: { x: Math.min(bounds.width - 2, target / state.width * bounds.width), y: bounds.height / 2 } });
    for (let elapsed = 0; elapsed < eventTime + 3000; elapsed += 1000) await page.clock.runFor(1000);
    const active = await snapshot(page);
    assert.equal(active.environment.event?.kind, kind, `${mapId}: the signature must arrive on the unmodified simulation clock`);
    assert.equal(active.environment.eventCounts[kind], 1);
    assert.equal(active.finite, true);
    assert.equal(active.creatures.length, 10);
    assert.ok(active.objectives.entries.every(entry => !entry.complete && entry.progress === 0), 'Environmental rhythms must not earn journal progress');
    await page.mouse.move(5, config.viewport.height - 8);
    await page.screenshot({ path: path.join(output, `${stage}-${config.name}-${mapId}-event.png`) });
    await page.locator('#pause').click({ force: true });
    const paused = await snapshot(page);
    await page.clock.runFor(1500);
    assert.deepEqual((await snapshot(page)).environment, paused.environment, 'Paused environmental clocks and events must freeze');
    const other = mapId === 'lagoon' ? 'pools' : 'lagoon';
    await page.locator(`[data-map="${other}"]`).click({ force: true });
    await page.locator('#pause').click({ force: true });
    await page.clock.runFor(1200);
    await page.locator('#pause').click({ force: true });
    await page.locator(`[data-map="${mapId}"]`).click({ force: true });
    assert.deepEqual((await snapshot(page)).environment, paused.environment, 'Inactive maps must retain exactly their environmental event state');
    cases.push({ mapId, event: active.environment.event, wind: active.environment.wind, energy: active.environment.energy, objectiveProgress: 0 });
    console.log(`PASS ${config.name}/${mapId}: signature event, pixels, pause and inactive-map retention`);
  }
  await page.clock.resume();
  await page.locator('[data-map="lagoon"]').click(); await page.locator('#reset').click();
  return cases;
}

async function exerciseVisual(page, config) {
  const cases = [];
  for (const mapId of ['lagoon', 'pools', 'sunset']) {
    await page.locator(`[data-map="${mapId}"]`).click();
    await page.locator('#reset').click();
    await page.waitForFunction(() => window.__blobIsland.snapshot().time > 1400);
    const before = await layoutAndPixels(page);
    assert.equal(before.overflow, false);
    assert.equal(before.headerOverlap, false);
    assert.equal(before.mapsClipped, false);
    assert.equal(before.creditsClipped, false);
    assert.ok(before.rgbColors > 256, `The stage shore view must retain actual color detail: ${before.rgbColors} RGB colors`);
    await page.screenshot({ path: path.join(output, `${stage}-${config.name}-${mapId}-shore.png`) });
    const observation = await page.evaluate(async () => {
      const canvas = document.getElementById('world');
      const context = canvas.getContext('2d');
      const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const timings = [];
      let previous;
      await new Promise(resolve => {
        const frame = timestamp => {
          if (previous !== undefined) timings.push(timestamp - previous);
          previous = timestamp;
          if (timings.length >= 30) resolve(); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let offset = 0; offset < before.length; offset += 4) if (before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1] || before[offset + 2] !== after[offset + 2]) changed += 1;
      timings.sort((first, second) => first - second);
      const state = window.__blobIsland.snapshot();
      return { changedPixels: changed, frameMs: { p50: timings[15], p95: timings[28] }, environment: state.environment, finite: state.finite };
    });
    assert.ok(observation.changedPixels > 10);
    assert.equal(observation.finite, true);
    const state = await snapshot(page);
    const overview = page.locator('#coast-overview');
    const bounds = await overview.boundingBox();
    await overview.click({ position: { x: state.landmarks.reef.x / state.width * bounds.width, y: bounds.height / 2 } });
    await frames(page, 8);
    const reef = await layoutAndPixels(page);
    assert.ok(reef.rgbColors > 256, `The narrow reef view must retain actual color detail: ${reef.rgbColors} RGB colors`);
    await page.screenshot({ path: path.join(output, `${stage}-${config.name}-${mapId}-reef.png`) });
    cases.push({ mapId, ...observation, shoreColors: before.colors, reefColors: reef.colors, reefRgbColors: reef.rgbColors });
  }
  await page.locator('[data-map="lagoon"]').click();
  await page.locator('#reset').click();
  await frames(page, 5);
  if (config.name === 'desktop' && ['m5', 'm6', 'v4-final'].includes(stage)) {
    cases.push({ gallery: await comicGallery(page, config) });
    if (['m6', 'v4-final'].includes(stage)) cases.push({ rendering: await verifyScene(page) });
  }
  if (['m6', 'v4-final'].includes(stage)) cases.push({ rhythms: await exerciseRhythms(page, config) });
  return cases;
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/<script[^>]+src\s*=/i.test(html), 'The HTML must contain its scripts');
  assert.ok(html.includes('Permission is hereby granted'), 'The standalone distribution must retain dependency licenses');
  const configurations = [
    { name: 'desktop', engine: 'chromium', viewport: { width: 1440, height: 900 } },
    { name: 'wide-desktop', engine: 'chromium', viewport: { width: 1920, height: 1080 } },
    { name: 'tablet-native-touch', engine: 'chromium', viewport: { width: 1180, height: 820 }, touch: true, nativeTouch: true },
    { name: 'ipad-landscape', engine: 'webkit', viewport: { width: 1180, height: 820 }, touch: true },
    { name: 'ipad-portrait', engine: 'webkit', viewport: { width: 820, height: 1180 }, touch: true },
    { name: 'phone', engine: 'webkit', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'small-phone', engine: 'webkit', viewport: { width: 320, height: 568 }, touch: true, reducedMotion: 'reduce' },
    { name: 'ipad-dark', engine: 'webkit', viewport: { width: 1180, height: 820 }, touch: true, theme: 'dark' },
  ].filter(config => !process.env.BLOB_CASES || process.env.BLOB_CASES.split(',').includes(config.name));
  assert.ok(configurations.length > 0, 'The selector must execute at least one real browser scenario');
  for (const engineName of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit }[engineName]).launch({ headless: true });
    try {
      for (const config of configurations.filter(item => item.engine === engineName)) {
        const errors = [];
        const external = [];
        const browserOffline = baseUrl.startsWith('file:') && engineName === 'chromium';
        const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1.5, hasTouch: Boolean(config.touch), isMobile: Boolean(config.touch),
          colorScheme: config.theme || 'light', reducedMotion: config.reducedMotion || 'no-preference', offline: browserOffline });
        await context.route(/^https?:\/\//, route => route.request().resourceType() === 'document' ? route.continue() : route.abort());
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (request.resourceType() !== 'document' && /^https?:/.test(request.url())) external.push(request.url()); });
          if (process.env.BLOB_FEATURES !== 'coast') await installAudioProbe(page);
          await page.goto(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}scoutTheme=${config.theme || 'light'}`);
          await page.waitForFunction(() => window.__blobIsland?.snapshot().time > 1100);
          const initial = await layoutAndPixels(page);
          assert.equal(initial.errorVisible, false, 'The game must not show a startup error');
          assert.equal(initial.overflow, false, 'The page must fit without scrolling');
          assert.equal(initial.headerOverlap, false, 'The title and toolbar must not overlap');
          assert.equal(initial.mapOverlap, false, 'Area controls must not overlap the header');
          assert.equal(initial.mapsClipped, false, 'Every area button must fit the viewport');
          assert.equal(initial.creditsClipped, false, 'Music attribution must remain visible');
          assert.equal(initial.touchAction, 'none', 'The play surface must own its touch gestures');
          assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), config.reducedMotion === 'reduce');
          assert.ok(initial.colors > 60, 'The canvas must contain a nonblank, richly colored scene');
          for (const button of initial.buttons) {
            assert.ok(button.width >= 44 && button.height >= 44, 'Touch buttons must be at least 44 pixels');
            assert.equal(button.icon, true, 'Every tool button needs an icon');
          }
          assert.equal((await snapshot(page)).audioState, 'not-created', 'Audio must wait for a user gesture');
          await page.screenshot({ path: path.join(output, `${config.name}.png`) });
          let audioResult;
          let visualResult;
          let feedingResult;
          if (features === 'visual') visualResult = await exerciseVisual(page, config);
          else if (features === 'feeding') feedingResult = await exerciseFeeding(page, config, output);
          else if (process.env.BLOB_FEATURES !== 'coast') {
            await exercise(page, context, config);
            if (process.env.BLOB_FEATURES !== 'audio') await exerciseIslands(page, config);
            audioResult = await exerciseAudio(page, config, output);
          }
          if (features === 'all') feedingResult = await exerciseFeeding(page, config, output);
          if (!['audio', 'visual', 'feeding'].includes(features)) await exerciseCoast(page, config, output);
          const animation = await page.evaluate(async () => {
            const canvas = document.getElementById('world');
            const context = canvas.getContext('2d');
            const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const time = window.__blobIsland.snapshot().time;
            await new Promise(resolve => {
              let count = 0;
              const advance = () => { count += 1; if (count >= 36) resolve(); else requestAnimationFrame(advance); };
              requestAnimationFrame(advance);
            });
            const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let changedPixels = 0;
            for (let offset = 0; offset < before.length; offset += 4) {
              if (before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1] || before[offset + 2] !== after[offset + 2]) changedPixels += 1;
            }
            return { changedPixels, elapsed: window.__blobIsland.snapshot().time - time };
          });
          assert.ok(animation.elapsed > 0, 'Animation checks must observe active simulation time');
          assert.ok(animation.changedPixels > 10, `The canvas must actually animate between active frames: ${JSON.stringify(animation)}`);
          if (config.name === 'ipad-landscape' || config.name === 'tablet-native-touch') {
            const beforeRotation = await snapshot(page);
            const center = screenPoint(beforeRotation, config.viewport, beforeRotation.blob);
            await pointerEvent(page, 'pointerdown', 21, center);
            assert.equal((await snapshot(page)).drags, 1, 'The rotation test must start with an active grab');
            const rotated = { width: config.viewport.height, height: config.viewport.width };
            await page.setViewportSize(rotated);
            await page.waitForFunction(width => Math.abs(window.__blobIsland.snapshot().camera.width - width) < 1, 900 * rotated.width / rotated.height);
            const afterRotation = await snapshot(page);
            assert.equal(afterRotation.width, beforeRotation.width, 'Rotation must not rebuild or resize the physical world');
            assert.deepEqual(afterRotation.props.map(prop => prop.id), beforeRotation.props.map(prop => prop.id), 'Rotation must preserve original object identities');
            assert.deepEqual(afterRotation.creatures.map(creature => creature.id), beforeRotation.creatures.map(creature => creature.id));
            assert.equal(afterRotation.drags, 0, 'Rotation must release every active touch');
            assert.ok(Math.abs(afterRotation.blob.x / afterRotation.width - beforeRotation.blob.x / beforeRotation.width) < 0.045, 'Rotation must preserve the jelly location');
            await frames(page, 3);
            await page.screenshot({ path: path.join(output, `${config.name}-rotated.png`) });
            const rotatedLayout = await layoutAndPixels(page);
            assert.equal(rotatedLayout.overflow, false);
            assert.equal(rotatedLayout.headerOverlap, false);
            assert.ok(rotatedLayout.colors > 60, `The rotated canvas must remain fully rendered: ${JSON.stringify(rotatedLayout)}`);
          }
          assert.deepEqual(errors, [], 'There must be no JavaScript errors');
          assert.deepEqual(external, [], 'The game must not need external resources');
          const result = { name: config.name, engine: engineName, passed: true, colors: initial.colors, viewport: config.viewport, reducedMotion: config.reducedMotion === 'reduce', input: config.nativeTouch ? 'native multi-touch' : config.touch ? 'WebKit touch pointers and native tap' : 'mouse', networkMode: browserOffline ? 'browser-offline' : 'external-requests-blocked', audio: audioResult, visual: visualResult, feeding: feedingResult };
          report.push(result); console.log(`PASS ${config.name}: ${result.input}, controls, pixels, self-contained assets`);
        } catch (error) {
          const failedPage = context.pages()[0];
          if (failedPage) {
            fs.writeFileSync(path.join(output, `${config.name}-failure.json`), JSON.stringify(await snapshot(failedPage), null, 2));
            await failedPage.screenshot({ path: path.join(output, `${config.name}-failure.png`) });
          }
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
}

run().then(() => {
  const result = JSON.stringify({ passed: true, features, stage, source: baseUrl, sourceSha256, cases: report }, null, 2);
  fs.writeFileSync(path.join(output, 'browser-results.json'), result);
  if (stage !== 'current') fs.writeFileSync(path.join(output, `${stage}-browser-results.json`), result);
  console.log(`All ${report.length} browser scenarios passed.`);
}).catch(error => {
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: false, features, source: baseUrl, sourceSha256, cases: report, error: error.stack }, null, 2));
  console.error(error); process.exitCode = 1;
});