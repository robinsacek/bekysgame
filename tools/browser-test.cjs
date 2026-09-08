const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const localUrl = pathToFileURL(path.join(root, 'index.html')).href;
const baseUrl = process.env.BLOB_URL || localUrl;
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
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    let signature = 0;
    for (let offset = 0; offset < image.data.length; offset += 4 * 113) {
      colors.add(`${image.data[offset] >> 4},${image.data[offset + 1] >> 4},${image.data[offset + 2] >> 4}`);
      signature = (Math.imul(signature, 31) + image.data[offset] + image.data[offset + 1] * 3) | 0;
    }
    const identity = document.querySelector('.identity').getBoundingClientRect();
    const controls = document.querySelector('.controls').getBoundingClientRect();
    return { colors: colors.size, signature, width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      headerOverlap: identity.right > controls.left - 3,
      buttons: [...document.querySelectorAll('.icon-button')].filter(button => button.getBoundingClientRect().width > 0).map(button => ({ label: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, icon: Boolean(button.querySelector('svg')) })),
      touchAction: getComputedStyle(canvas).touchAction, errorVisible: !document.getElementById('error').hidden };
  });
}

function screenPoint(state, viewport, point) {
  return { x: point.x / state.width * viewport.width, y: point.y / state.height * viewport.height };
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
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x - 40, y: center.y - 60, id: 1 }, { x: center.x + 40, y: center.y - 60, id: 2 }] });
    await frames(page, 12);
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
  assert.ok(Math.abs(reset.blob.x / reset.width - 0.30) < 0.025, 'Reset must restore the jelly to the beach');
  assert.equal(reset.props.length, 4, 'Reset must restore exactly four toys');
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
    { name: 'ipad-dark', engine: 'webkit', viewport: { width: 1180, height: 820 }, touch: true, theme: 'dark' },
  ];
  for (const engineName of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit }[engineName]).launch({ headless: true });
    try {
      for (const config of configurations.filter(item => item.engine === engineName)) {
        const errors = [];
        const external = [];
        const browserOffline = baseUrl.startsWith('file:') && engineName === 'chromium';
        const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1.5, hasTouch: Boolean(config.touch), isMobile: Boolean(config.touch), colorScheme: config.theme || 'light', offline: browserOffline });
        await context.route(/^https?:\/\//, route => route.request().resourceType() === 'document' ? route.continue() : route.abort());
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (request.resourceType() !== 'document' && /^https?:/.test(request.url())) external.push(request.url()); });
          await page.goto(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}scoutTheme=${config.theme || 'light'}`);
          await page.waitForFunction(() => window.__blobIsland?.snapshot().time > 1100);
          const initial = await layoutAndPixels(page);
          assert.equal(initial.errorVisible, false, 'The game must not show a startup error');
          assert.equal(initial.overflow, false, 'The page must fit without scrolling');
          assert.equal(initial.headerOverlap, false, 'The title and toolbar must not overlap');
          assert.equal(initial.touchAction, 'none', 'The play surface must own its touch gestures');
          assert.ok(initial.colors > 60, 'The canvas must contain a nonblank, richly colored scene');
          for (const button of initial.buttons) {
            assert.ok(button.width >= 44 && button.height >= 44, 'Touch buttons must be at least 44 pixels');
            assert.equal(button.icon, true, 'Every tool button needs an icon');
          }
          assert.equal((await snapshot(page)).audioState, 'not-created', 'Audio must wait for a user gesture');
          await page.screenshot({ path: path.join(output, `${config.name}.png`) });
          await exercise(page, context, config);
          const final = await layoutAndPixels(page);
          assert.notEqual(initial.signature, final.signature, 'The canvas must actually animate');
          if (config.name === 'ipad-landscape' || config.name === 'tablet-native-touch') {
            const beforeRotation = await snapshot(page);
            const center = screenPoint(beforeRotation, config.viewport, beforeRotation.blob);
            await pointerEvent(page, 'pointerdown', 21, center);
            assert.equal((await snapshot(page)).drags, 1, 'The rotation test must start with an active grab');
            const rotated = { width: config.viewport.height, height: config.viewport.width };
            await page.setViewportSize(rotated);
            await page.waitForFunction(width => Math.abs(window.__blobIsland.snapshot().width - width) < 1, 900 * rotated.width / rotated.height);
            const afterRotation = await snapshot(page);
            assert.equal(afterRotation.drags, 0, 'Rotation must release every active touch');
            assert.ok(Math.abs(afterRotation.blob.x / afterRotation.width - beforeRotation.blob.x / beforeRotation.width) < 0.045, 'Rotation must preserve the jelly location');
            const rotatedLayout = await layoutAndPixels(page);
            assert.equal(rotatedLayout.overflow, false);
            assert.equal(rotatedLayout.headerOverlap, false);
            assert.ok(rotatedLayout.colors > 60, 'The rotated canvas must remain fully rendered');
            await page.screenshot({ path: path.join(output, `${config.name}-rotated.png`) });
          }
          assert.deepEqual(errors, [], 'There must be no JavaScript errors');
          assert.deepEqual(external, [], 'The game must not need external resources');
          const result = { name: config.name, engine: engineName, passed: true, colors: initial.colors, viewport: config.viewport, input: config.nativeTouch ? 'native multi-touch' : config.touch ? 'WebKit touch pointers and native tap' : 'mouse', networkMode: browserOffline ? 'browser-offline' : 'external-requests-blocked' };
          report.push(result); console.log(`PASS ${config.name}: ${result.input}, controls, pixels, self-contained assets`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
}

run().then(() => {
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: true, source: baseUrl, cases: report }, null, 2));
  console.log(`All ${report.length} browser scenarios passed.`);
}).catch(error => {
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: false, cases: report, error: error.stack }, null, 2));
  console.error(error); process.exitCode = 1;
});