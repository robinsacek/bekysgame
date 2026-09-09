const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');

async function installAudioProbe(page) {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    if (!NativeContext) return;
    const probe = { contexts: [], nodes: [], sources: [], music: null };
    class ObservedContext extends NativeContext {
      constructor(...args) {
        super(...args);
        this.mixMeter = super.createAnalyser(); this.mixMeter.fftSize = 8192;
        this.effectsMeter = super.createAnalyser(); this.effectsMeter.fftSize = 8192;
        this.mixMeter.connect(this.destination);
        probe.contexts.push(this);
      }
    }
    for (const method of ['createGain', 'createBiquadFilter', 'createStereoPanner', 'createDynamicsCompressor', 'createMediaElementSource', 'createOscillator', 'createBufferSource']) {
      ObservedContext.prototype[method] = function (...args) {
        const node = NativeContext.prototype[method].apply(this, args);
        const record = { node, method, connections: new Set(), started: false, ended: false, stopAt: Infinity };
        probe.nodes.push(record);
        const connect = node.connect.bind(node);
        const disconnect = node.disconnect.bind(node);
        node.connect = (destination, ...ports) => {
          const target = destination === this.destination ? this.mixMeter : destination;
          record.connections.add(target);
          return connect(target, ...ports);
        };
        node.disconnect = (...ports) => {
          if (!ports.length) record.connections.clear();
          else record.connections.delete(ports[0]);
          return disconnect(...ports);
        };
        if (method === 'createDynamicsCompressor') connect(this.effectsMeter);
        if (method === 'createMediaElementSource') probe.music = args[0];
        if (method === 'createOscillator' || method === 'createBufferSource') {
          probe.sources.push(record);
          const start = node.start.bind(node);
          const stop = node.stop.bind(node);
          if (node.frequency) {
            const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
            node.frequency.setValueAtTime = (value, time) => { record.frequency = value; return setFrequency(value, time); };
          }
          node.start = (...times) => { start(...times); record.started = true; };
          node.stop = (time = this.currentTime) => { stop(time); record.stopAt = time; };
          node.addEventListener('ended', () => { record.ended = true; });
        }
        return node;
      };
    }
    window.AudioContext = ObservedContext;
    window.__audioProbe = probe;
  });
}

async function measure(page, frames = 12) {
  return page.evaluate(async count => {
    const context = window.__audioProbe.contexts[0];
    const samples = new Float32Array(context.mixMeter.fftSize);
    const result = { peak: 0, effectsPeak: 0, rms: 0, frames: count, audioStart: context.currentTime };
    for (let frame = 0; frame < count; frame += 1) {
      context.mixMeter.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) { result.peak = Math.max(result.peak, Math.abs(sample)); energy += sample * sample; }
      result.rms = Math.max(result.rms, Math.sqrt(energy / samples.length));
      context.effectsMeter.getFloatTimeDomainData(samples);
      for (const sample of samples) result.effectsPeak = Math.max(result.effectsPeak, Math.abs(sample));
      await new Promise(requestAnimationFrame);
    }
    result.audioEnd = context.currentTime;
    return result;
  }, frames);
}

async function screenPoint(page, point) {
  return page.evaluate(position => {
    const state = window.__blobIsland.snapshot();
    const bounds = document.getElementById('world').getBoundingClientRect();
    return { x: bounds.left + (position.x - state.camera.x) / state.camera.width * bounds.width,
      y: bounds.top + position.y / state.height * bounds.height };
  }, point);
}

async function seek(page, positionX) {
  const overview = page.locator('#coast-overview');
  const bounds = await overview.boundingBox();
  await overview.click({ position: { x: Math.max(2, Math.min(bounds.width - 2, positionX / 3200 * bounds.width)), y: bounds.height / 2 } });
}

async function transientState(page, mark, end) {
  return page.evaluate(({ start, end }) => {
    const records = window.__audioProbe.nodes.slice(start, end);
    return { connected: records.filter(record => record.connections.size).length,
      playing: records.filter(record => record.started && !record.ended && record.stopAt > record.node.context.currentTime).length,
      oscillators: records.filter(record => record.method === 'createOscillator').map(record => record.frequency) };
  }, { start: mark, end });
}

async function renderAudioChecks(page) {
  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../src/audio.js')], bundle: true, write: false, format: 'iife', globalName: 'AudioUnderTest', loader: { '.mp3': 'empty' } }).outputFiles[0].text;
  await page.addScriptTag({ content: bundle });
  const results = await page.evaluate(async () => {
    const recording = await (await fetch(window.__audioProbe.music.src)).arrayBuffer();
    const decoder = new OfflineAudioContext(2, 44100, 44100);
    const music = await decoder.decodeAudioData(recording);
    const renders = {};
    const analyze = (samples, rate, start = 0) => {
      let peak = 0; let energy = 0; let activeUntil = 0;
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      for (let index = 0; index < samples.length; index += 1) if (Math.abs(samples[index]) > peak * 0.01) activeUntil = index / rate;
      const length = 2048;
      const offset = Math.round(rate * (start + 0.035));
      const windowed = Array.from({ length }, (_, index) => samples[offset + index] * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (length - 1))));
      let total = 0; let weighted = 0; let strongest = 0; let dominant = 0;
      for (let bin = 1; bin < length / 2; bin += 1) {
        let real = 0; let imaginary = 0;
        for (let index = 0; index < length; index += 1) {
          const phase = 2 * Math.PI * bin * index / length;
          real += windowed[index] * Math.cos(phase); imaginary -= windowed[index] * Math.sin(phase);
        }
        const power = real * real + imaginary * imaginary;
        const frequency = bin * rate / length;
        total += power; weighted += power * frequency;
        if (power > strongest) { strongest = power; dominant = frequency; }
      }
      return { peak, rms: Math.sqrt(energy / samples.length), centroid: total ? weighted / total : 0, dominant, activeUntil };
    };
    const render = async (name, events, withMusic = false, muted = false, environment) => {
      const offline = new OfflineAudioContext(2, environment ? 88200 : 44100, 44100);
      const sources = [];
      let clock = 0;
      const facade = new Proxy(offline, { get(target, key) {
        if (key === 'state') return 'running';
        if (key === 'currentTime') return clock;
        if (key === 'createMediaElementSource') return () => target.createGain();
        if (key === 'createBufferSource') return () => { const source = target.createBufferSource(); sources.push(source); return source; };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      const original = window.AudioContext;
      let audio;
      try {
        window.AudioContext = function () { return facade; };
        audio = new AudioUnderTest.IslandAudio(); audio.enabled = !muted; audio.initialize();
      } finally { window.AudioContext = original; }
      for (const source of sources) if (source.loop) { source.stop(); source.disconnect(); }
      if (environment) { audio.environment(environment); clock = 0.8; }
      let seed = 193;
      const noise = audio.noise.getChannelData(0);
      for (let index = 0; index < noise.length; index += 1) { seed = Math.imul(seed, 1664525) + 1013904223 | 0; noise[index] = (seed >>> 0) / 2147483648 - 1; }
      const random = Math.random;
      let accepted;
      try {
        Math.random = () => 0.5;
        accepted = events.map(event => audio.play(event.kind, event.strength ?? 5, event.pan ?? 0, event.detail || {}));
      } finally { Math.random = random; }
      const peakVoices = audio.activeVoices;
      const peakSources = [...audio.voices].reduce((total, voice) => total + voice.sources.size, 0);
      if (withMusic) { const source = offline.createBufferSource(); source.buffer = music; source.connect(audio.musicGain); source.start(0, 12); }
      const buffer = await offline.startRendering();
      await new Promise(requestAnimationFrame);
      const samples = buffer.getChannelData(0);
      const metrics = analyze(samples, buffer.sampleRate, clock);
      renders[name] = { samples: Array.from(samples), metrics, accepted, peakVoices, peakSources, remaining: audio.activeVoices, dropped: audio.droppedVoices, stolen: audio.stolenVoices };
    };
    for (const kind of ['wood', 'glass', 'shell']) await render(kind, [{ kind, detail: { material: kind, mass: 1, speed: 5 } }]);
    await render('slow', [{ kind: 'glass', detail: { material: 'glass', mass: 1, speed: 1 } }]);
    await render('fast', [{ kind: 'glass', detail: { material: 'glass', mass: 1, speed: 9 } }]);
    await render('heavy', [{ kind: 'wood', detail: { material: 'wood', mass: 8, speed: 5 } }]);
    const fin = { characterId: 'fin', size: Math.sqrt(30 * 18), behavior: 'curious' };
    await render('fin', [{ kind: 'voice-fish', detail: fin }]);
    await render('fin-repeat', [{ kind: 'voice-fish', detail: fin }]);
    await render('pip', [{ kind: 'voice-fish', detail: { characterId: 'pip', size: Math.sqrt(24 * 15), behavior: 'curious' } }]);
    await render('held', [{ kind: 'voice-fish', detail: { ...fin, behavior: 'held' } }]);
    await render('gag', [{ kind: 'voice-fish', detail: { ...fin, behavior: 'bubble-ring' } }]);
    await render('sneeze', [{ kind: 'voice-tortoise', detail: { characterId: 'moss', size: 52, behavior: 'sneeze' } }]);
    await render('far', [{ kind: 'glass', detail: { material: 'glass', mass: 1, speed: 5, distance: 1400 } }]);
    await render('muted', [{ kind: 'glass' }], false, true);
    await render('dry-water', [{ kind: 'glass' }], false, false, { mapId: 'lagoon', immersion: 0 });
    await render('submerged', [{ kind: 'glass' }], false, false, { mapId: 'lagoon', immersion: 1 });
    await render('burst', ['wood', 'glass', 'shell', 'splash', 'grab', 'release', 'chime', 'achievement', 'voice-fish'].map(kind => ({ kind })), true);
    let repeatedDifference = 0;
    for (let index = 0; index < renders.fin.samples.length; index += 1) repeatedDifference = Math.max(repeatedDifference, Math.abs(renders.fin.samples[index] - renders['fin-repeat'].samples[index]));
    return { repeatedDifference, cases: Object.fromEntries(Object.entries(renders).map(([name, result]) => [name, { ...result, samples: undefined }])) };
  });
  fs.writeFileSync(path.resolve(__dirname, '../test-results/audio-rendered.json'), JSON.stringify(results, null, 2));
  const cases = results.cases;
  for (const [name, result] of Object.entries(cases)) {
    assert.ok(Number.isFinite(result.metrics.peak) && result.metrics.peak < 0.95, `${name}: rendered output must stay finite and below full scale`);
    assert.equal(result.remaining, 0, `${name}: every production voice must naturally finish`);
    assert.ok(result.peakVoices <= 8 && result.peakSources <= 32, `${name}: bounded event/source budget`);
    if (name !== 'muted') assert.ok(result.metrics.peak > 0.0001, `${name}: actual rendered audio must be nonzero`);
  }
  assert.ok(cases.glass.metrics.centroid > cases.wood.metrics.centroid * 2);
  assert.ok(cases.shell.metrics.centroid > cases.wood.metrics.centroid * 1.5);
  assert.ok(cases.fast.metrics.centroid > cases.slow.metrics.centroid * 1.15, 'Equal-gain speed changes must alter the normalized spectrum');
  assert.ok(cases.heavy.metrics.dominant < cases.wood.metrics.dominant * 0.7);
  assert.ok(Math.abs(cases.fin.metrics.dominant - cases.pip.metrics.dominant) > 20);
  assert.ok(results.repeatedDifference < 0.000001, 'Individual voice identity must not redraw randomly');
  assert.ok(cases.held.metrics.activeUntil < cases.fin.metrics.activeUntil);
  assert.ok(cases.gag.metrics.activeUntil > cases.fin.metrics.activeUntil * 1.5);
  assert.ok(cases.far.metrics.rms < cases.glass.metrics.rms * 0.55);
  assert.ok(cases.far.metrics.centroid < cases.glass.metrics.centroid);
  assert.equal(cases.muted.metrics.peak, 0);
  assert.ok(cases.submerged.metrics.centroid < cases['dry-water'].metrics.centroid * 0.9, 'The actual effects waveform must darken underwater without transposing its fundamental');
  assert.ok(cases.burst.accepted.every(Boolean), 'The reserved achievement and priority voice must survive the ordinary burst');
  assert.equal(cases.burst.stolen, 1);
  return results;
}

async function exerciseAudio(page, config, output) {
  const snapshot = () => page.evaluate(() => window.__blobIsland.snapshot());
  if (!(await snapshot()).audioSupported) {
    assert.equal(await page.locator('#sound').isDisabled(), true);
    assert.equal(await page.locator('#music').isDisabled(), true);
    assert.equal((await snapshot()).audioState, 'not-created');
    return { supported: false, fallback: 'disabled controls; no playback claimed' };
  }
  await page.locator('[data-map="lagoon"]').click();
  await page.locator('#reset').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().time > 2200);
  if (!(await snapshot()).sound) await page.locator('#sound').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().audioState === 'running' && window.__blobIsland.snapshot().activeVoices === 0);
  await page.waitForFunction(() => {
    const probe = window.__audioProbe;
    const context = probe.contexts[0];
    if (window.__blobIsland.snapshot().activeVoices) probe.quietSince = context.currentTime;
    probe.quietSince ??= context.currentTime;
    return context.currentTime - probe.quietSince > context.mixMeter.fftSize / context.sampleRate + 0.05;
  });
  const baseline = await measure(page, 8);
  const crate = (await snapshot()).props.find(prop => prop.kind === 'crate');
  const point = await screenPoint(page, crate);
  await page.mouse.move(point.x, point.y);
  const mark = await page.evaluate(() => window.__audioProbe.nodes.length);
  const capture = measure(page, 18);
  await page.mouse.down();
  assert.ok((await snapshot()).grips.some(grip => grip.kind === 'crate'));
  const wood = await capture;
  await page.mouse.up();
  await page.waitForFunction(() => window.__blobIsland.snapshot().activeVoices === 0);
  const completed = await transientState(page, mark);
  assert.ok(completed.oscillators.length >= 3, 'A real crate grab must render multiple material modes');
  assert.ok(wood.peak > baseline.peak * 1.15, `The gameplay effect must be audible above the surf bed: ${JSON.stringify({ baseline, wood })}`);
  assert.ok(wood.audioEnd > wood.audioStart && wood.peak < 0.95);
  assert.equal(completed.connected, 0, 'Completed native sources and processing nodes must disconnect');
  const voices = [];
  for (const id of ['mango', 'fern']) {
    let resident = (await snapshot()).creatures.find(item => item.id === id);
    await seek(page, resident.x);
    let start;
    let held = false;
    for (const offset of [0, 0.4, -0.4, 0.25, -0.25]) {
      resident = (await snapshot()).creatures.find(item => item.id === id);
      const target = await screenPoint(page, { x: resident.x + resident.width * offset, y: resident.y - resident.height * Math.abs(offset) });
      start = await page.evaluate(() => window.__audioProbe.nodes.length);
      await page.mouse.move(target.x, target.y); await page.mouse.down();
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const grabbed = await snapshot();
      held = grabbed.creatures.find(item => item.id === id).held;
      if (held) break;
      const covering = grabbed.creatures.find(item => item.held);
      if (covering) {
        await page.mouse.move(target.x + 130, target.y - 80, { steps: 8 });
        await page.waitForFunction(origin => {
          const current = window.__blobIsland.snapshot().creatures.find(item => item.id === origin.id);
          return Math.hypot(current.x - origin.x, current.y - origin.y) > 65;
        }, covering);
      }
      await page.mouse.up();
    }
    assert.equal(held, true, `${id} must be grabbed through real pointer input`);
    const measured = await measure(page, 8);
    await page.mouse.up();
    const native = await transientState(page, start);
    assert.ok(native.oscillators.length > 0 && measured.peak > 0.0001, `${id} must produce actual audio`);
    voices.push({ id, frequency: native.oscillators[0], measured });
  }
  assert.notEqual(voices[0].frequency, voices[1].frequency);
  const grabBottle = async () => {
    let bottle = (await snapshot()).props.find(prop => prop.kind === 'bottle');
    await seek(page, bottle.x);
    bottle = (await snapshot()).props.find(prop => prop.kind === 'bottle');
    const target = await screenPoint(page, bottle);
    const start = await page.evaluate(() => window.__audioProbe.nodes.length);
    await page.mouse.move(target.x, target.y); await page.mouse.down();
    assert.ok((await snapshot()).grips.some(grip => grip.kind === 'bottle'));
    assert.ok((await snapshot()).activeVoices > 0);
    return start;
  };
  const interrupted = await grabBottle();
  await page.keyboard.press('Space');
  const paused = await snapshot();
  assert.equal(paused.paused, true);
  await page.mouse.up();
  assert.equal((await transientState(page, interrupted)).connected, 0);
  await measure(page, 6);
  assert.equal((await snapshot()).time, paused.time);
  assert.equal((await snapshot()).audioState, 'suspended');
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  assert.equal((await snapshot()).audioState, 'suspended', 'Focus must not override explicit pause');
  await page.locator('#pause').click();
  const blurred = await grabBottle();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  const inactive = await snapshot();
  await measure(page, 6);
  assert.equal((await snapshot()).time, inactive.time);
  assert.equal(inactive.drags, 0);
  assert.equal((await transientState(page, blurred)).connected, 0);
  assert.equal((await snapshot()).audioState, 'suspended');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => window.__blobIsland.snapshot().audioState === 'running');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await snapshot();
  await measure(page, 6);
  assert.equal((await snapshot()).time, hidden.time);
  assert.equal((await snapshot()).audioState, 'suspended');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__blobIsland.snapshot().audioState === 'running');
  const switched = await grabBottle();
  const switchedEnd = await page.evaluate(() => window.__audioProbe.nodes.length);
  await page.mouse.up();
  await page.locator('[data-map="sunset"]').click();
  assert.equal((await transientState(page, switched, switchedEnd)).connected, 0, 'Map changes must retire old-map sound nodes');
  await page.locator('[data-map="lagoon"]').click();
  const resetMark = await grabBottle();
  const resetEnd = await page.evaluate(() => window.__audioProbe.nodes.length);
  await page.mouse.up(); await page.locator('#reset').click();
  const oldConnected = await page.evaluate(({ start, end }) => window.__audioProbe.nodes.slice(start, end).filter(record => record.connections.size).length, { start: resetMark, end: resetEnd });
  assert.equal(oldConnected, 0, 'Reset must retire old sources before its new feedback');
  await page.locator('#music').click();
  await page.waitForFunction(() => window.__blobIsland.snapshot().musicTime > 1.5);
  const withMusic = await measure(page, 12);
  await page.locator('#sound').click();
  await measure(page, 24);
  const musicOnly = await measure(page, 12);
  assert.ok(musicOnly.peak > 0.0001 && musicOnly.effectsPeak < 0.00001, `Effects must be silent while real music continues: ${JSON.stringify(musicOnly)}`);
  assert.equal((await snapshot()).activeVoices, 0);
  assert.equal((await snapshot()).musicPaused, false);
  assert.ok(withMusic.peak < 0.95 && musicOnly.peak < 0.95);
  await page.locator('#music').click();
  const rendered = config.name === 'desktop' ? await renderAudioChecks(page) : undefined;
  const result = { supported: true, baseline, wood, voices, withMusic, musicOnly, cleanup: ['natural completion', 'pause', 'blur/focus', 'visibility', 'map', 'reset', 'mute'], rendered };
  fs.writeFileSync(path.join(output, `audio-${config.name}.json`), JSON.stringify(result, null, 2));
  await page.locator('#reset').click();
  return result;
}

module.exports = { installAudioProbe, exerciseAudio };