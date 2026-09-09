import { createElement, RotateCcw, Volume2, VolumeX, Pause, Play, Maximize, Minimize, Sun, Music2, AudioLines } from 'lucide';
import { IslandPhysics, STEP } from './physics.js';
import { CoastCamera, WORLD_WIDTH, WORLD_HEIGHT } from './camera.js';
import { MAPS } from './maps.js';
import { IslandScene } from './scene.js';
import { IslandAudio } from './audio.js';
import { ExplorationUI } from './exploration-ui.js';
import { propSound, residentSound } from './sound-context.js';

const canvas = document.getElementById('world');
const container = document.getElementById('island');
const announcer = document.getElementById('announcer');
const audio = new IslandAudio();
const keys = new Set();
const waterPointers = new Set();
const pointers = new Map();
const cameras = new Map();
const state = { paused: false, active: true, resize: true, timestamp: 0, accumulator: 0, pointer: null, frames: 0, audioBusy: false, musicBusy: false, mapId: 'lagoon' };
const islands = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let island;
let scene;
let camera;
let exploration;

function icon(element, glyph) {
  const symbol = createElement(glyph, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' });
  element.replaceChildren(symbol);
}

function releaseAll() {
  island?.releaseAll(); keys.clear(); waterPointers.clear();
  for (const pointerId of pointers.keys()) if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  pointers.clear();
  canvas.style.cursor = 'default';
}

function resizeWorld(preserve = true) {
  const bounds = container.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return;
  releaseAll();
  const width = WORLD_HEIGHT * bounds.width / bounds.height;
  const ratio = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1 : 1.5,
    Math.sqrt(2000000 / (bounds.width * bounds.height)));
  canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
  if (!island || !preserve) {
    island?.dispose();
    island = new IslandPhysics(WORLD_WIDTH, WORLD_HEIGHT, state.mapId, true);
    camera = new CoastCamera(WORLD_WIDTH, width);
    camera.find(island.spawn.x);
    cameras.set(state.mapId, camera);
  } else camera.resize(width);
  islands.set(state.mapId, island);
  scene = new IslandScene(canvas, island);
  state.resize = false; state.accumulator = 0; state.timestamp = 0;
  updateMapControls();
}

function updateMapControls() {
  for (const button of document.querySelectorAll('[data-map]')) button.setAttribute('aria-pressed', String(button.dataset.map === state.mapId));
  document.getElementById('place-name').textContent = island.map.name;
  document.getElementById('place-caption').textContent = `NO. 0${MAPS.indexOf(island.map) + 1} / ${island.map.caption}`;
  document.getElementById('temperature').textContent = `${island.map.temperature}\u00b0`;
}

function selectMap(mapId) {
  if (mapId === state.mapId || !MAPS.some(map => map.id === mapId)) return;
  releaseAll();
  island.sounds.length = 0;
  state.mapId = mapId;
  const bounds = container.getBoundingClientRect();
  const width = WORLD_HEIGHT * bounds.width / bounds.height;
  island = islands.get(mapId) || new IslandPhysics(WORLD_WIDTH, WORLD_HEIGHT, mapId, true);
  island.sounds.length = 0;
  camera = cameras.get(mapId) || new CoastCamera(WORLD_WIDTH, width);
  if (!cameras.has(mapId)) camera.find(island.spawn.x); else camera.resize(width);
  cameras.set(mapId, camera);
  islands.set(mapId, island);
  scene = new IslandScene(canvas, island);
  state.pointer = null; state.timestamp = 0; state.accumulator = 0;
  audio.clearEffects();
  updateMapControls();
  announcer.textContent = island.map.name;
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return camera.toWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, bounds);
}

function onPointerDown(event) {
  if (!island || state.paused || !state.active) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  const point = pointFromEvent(event);
  state.pointer = point;
  const padding = (event.pointerType === 'mouse' ? 8 : 24) * island.height / canvas.getBoundingClientRect().height;
  const drag = island.grab(event.pointerId, point, Math.min(38, padding));
  pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY, startX: event.clientX, lastX: event.clientX, kind: drag ? 'object' : 'background', panning: false });
  if (drag) {
    if (drag.kind === 'blob') camera.follow = true;
    const sound = drag.kind === 'creature' ? { kind: `voice-${drag.creature.species}`, ...residentSound(drag.creature, 'held') } : propSound(drag.kind, drag.body);
    canvas.style.cursor = 'grabbing';
    audio.play(sound.kind, 2, (point.x - camera.x) / camera.viewWidth * 2 - 1,
      { ...sound, distance: Math.abs(point.x - camera.x - camera.viewWidth / 2) });
  } else if (point.x > island.layout.waterStart && point.x < island.layout.waterEnd && point.y > island.layout.water - 35 && point.y < island.layout.bottom) {
    waterPointers.add(event.pointerId); island.splash(point.x, 2.5);
  }
  if (!drag) island.wildlife?.foraging.touch(point);
  try { canvas.setPointerCapture(event.pointerId); } catch {}
}

function onPointerMove(event) {
  if (!island) return;
  const pointer = pointers.get(event.pointerId);
  if (pointer) {
    if (pointer.kind === 'background' && !island.drags.size) {
      if (Math.abs(event.clientX - pointer.startX) > 7) { pointer.panning = true; waterPointers.delete(event.pointerId); }
      if (pointer.panning) camera.pan((pointer.lastX - event.clientX) / canvas.getBoundingClientRect().width * camera.viewWidth);
    }
    pointer.clientX = event.clientX; pointer.clientY = event.clientY; pointer.lastX = event.clientX;
  }
  const point = pointFromEvent(event);
  state.pointer = point;
  island.move(event.pointerId, point);
  if (waterPointers.has(event.pointerId) && !state.paused) island.splash(point.x, 0.30);
  if (island.drags.size === 0 && event.pointerType === 'mouse') canvas.style.cursor = island.pick(point, 8) ? 'grab' : 'default';
}

function onPointerEnd(event) {
  const drag = island?.drags.get(event.pointerId);
  if (drag?.kind === 'blob' && event.type === 'pointerup') audio.play('release', 2);
  island?.release(event.pointerId); waterPointers.delete(event.pointerId);
  pointers.delete(event.pointerId);
  if (island?.drags.size === 0) canvas.style.cursor = 'default';
  if (event.pointerType !== 'mouse' && island?.drags.size === 0) state.pointer = null;
}

function syncAudio() {
  const suspended = state.paused || !state.active || document.hidden;
  if (suspended && island) island.sounds.length = 0;
  audio.pause(suspended);
}

function setActive(active) {
  state.active = active; state.timestamp = 0; state.accumulator = 0; releaseAll();
  syncAudio();
}

function setPaused(paused) {
  state.paused = paused; state.accumulator = 0; state.timestamp = 0; releaseAll();
  const button = document.getElementById('pause');
  button.setAttribute('aria-pressed', String(paused)); button.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  icon(button, paused ? Play : Pause); document.getElementById('pause-state').hidden = !paused;
  syncAudio();
  announcer.textContent = paused ? 'Game paused.' : 'Game resumed.';
}

async function toggleSound() {
  if (state.audioBusy) return;
  state.audioBusy = true;
  const enabled = await audio.toggle();
  const button = document.getElementById('sound');
  button.setAttribute('aria-pressed', String(enabled)); button.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
  icon(button, enabled ? Volume2 : VolumeX);
  syncAudio();
  announcer.textContent = enabled ? 'Sound on.' : 'Sound off.';
  state.audioBusy = false;
}

async function toggleMusic() {
  if (state.musicBusy) return;
  state.musicBusy = true;
  try {
    const enabled = await audio.toggleMusic();
    updateMusicControl();
    syncAudio();
    announcer.textContent = enabled ? 'Music on.' : 'Music off.';
  } finally { state.musicBusy = false; }
}

function updateMusicControl() {
  const button = document.getElementById('music');
  button.setAttribute('aria-pressed', String(audio.musicEnabled)); button.setAttribute('aria-label', audio.musicEnabled ? 'Pause music' : 'Play music');
  icon(button, audio.musicEnabled ? AudioLines : Music2);
}

function reset() {
  audio.clearEffects();
  resizeWorld(false); setPaused(false); state.pointer = null; audio.play('grab', 2);
  announcer.textContent = 'The island has been reset.';
}

function frame(timestamp) {
  try {
    if (state.resize) resizeWorld();
    const elapsed = state.timestamp ? Math.min(100, timestamp - state.timestamp) : 0;
    state.timestamp = timestamp;
    if (!state.paused && state.active && !document.hidden) {
      scene.observeFrame(elapsed);
      const bounds = canvas.getBoundingClientRect();
      const grips = [...pointers.values()].filter(pointer => pointer.kind === 'object').map(pointer => (pointer.clientX - bounds.left) / bounds.width);
      const panning = [...pointers.values()].some(pointer => pointer.panning);
      if (!panning) camera.step(island.blobPosition().x, elapsed, grips);
      for (const [pointerId, pointer] of pointers) {
        if (pointer.kind !== 'object') continue;
        const point = pointFromEvent(pointer); island.move(pointerId, point); state.pointer = point;
      }
      state.accumulator += elapsed;
      while (state.accumulator >= STEP) {
        const horizontal = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
        const vertical = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
        if (horizontal || vertical) island.nudge(horizontal, vertical);
        island.step(); state.accumulator -= STEP;
        for (const splash of island.splashes.splice(0)) {
          scene.addSplash(splash);
        }
        for (const sound of island.sounds.splice(0)) {
          const positionX = sound.x ?? (sound.pan + 1) * island.width / 2;
          const normalized = (positionX - camera.x) / camera.viewWidth;
          if (normalized >= -0.15 && normalized <= 1.15) audio.play(sound.kind, sound.strength, normalized * 2 - 1,
            { ...sound, distance: Math.abs(positionX - camera.x - camera.viewWidth / 2) });
        }
      }
      audio.environment({ mapId: island.map.id,
        immersion: island.blob.particles.reduce((total, body) => total + (body.plugin.lastImmersion || 0), 0) / island.blob.particles.length,
        waveEnergy: Math.sqrt(island.waves.reduce((total, wave) => total + wave.offset ** 2 + wave.velocity ** 2 * 8, 0) / island.waves.length) / 8,
        wind: island.environment?.wind || 0 });
      audio.syncContacts(island.contactSounds().filter(contact => {
        const normalized = (contact.x - camera.x) / camera.viewWidth;
        return normalized >= -0.15 && normalized <= 1.15;
      }).map(contact => ({ ...contact, pan: (contact.x - camera.x) / camera.viewWidth * 2 - 1,
        distance: Math.abs(contact.x - camera.x - camera.viewWidth / 2) })));
      const positions = island.blob.ring.map(particle => particle.position.x);
      audio.stretch((Math.max(...positions) - Math.min(...positions)) / 80, [...island.drags.values()].filter(drag => drag.kind === 'blob').length > 1);
    } else state.accumulator = 0;
    scene.draw(island, island.time, state.pointer, reducedMotion.matches, camera);
    exploration.update();
    state.frames += 1;
    requestAnimationFrame(frame);
  } catch (error) {
    showError(error);
  }
}

function showError(error) {
  releaseAll(); audio.pause(true);
  const message = document.getElementById('error');
  message.textContent = 'The island could not start. Please reload in a current version of Safari, Edge, Chrome, or Firefox.';
  message.hidden = false; console.error(error);
}

try {
  icon(document.getElementById('sound'), VolumeX); icon(document.getElementById('pause'), Pause);
  icon(document.getElementById('music'), Music2);
  audio.onMusicChange = updateMusicControl;
  icon(document.getElementById('reset'), RotateCcw); icon(document.getElementById('fullscreen'), Maximize); icon(document.getElementById('sun-icon'), Sun);
  if (!audio.supported) {
    document.getElementById('sound').disabled = true;
    document.getElementById('sound').setAttribute('aria-label', 'Sound unavailable in this browser');
  }
  if (!audio.musicSupported) {
    document.getElementById('music').disabled = true;
    document.getElementById('music').setAttribute('aria-label', 'Music unavailable in this browser');
  }
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(eventName, onPointerEnd);
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerleave', () => { if (!island?.drags.size) state.pointer = null; });
  document.getElementById('pause').addEventListener('click', () => setPaused(!state.paused));
  document.getElementById('reset').addEventListener('click', reset);
  document.getElementById('sound').addEventListener('click', toggleSound);
  document.getElementById('music').addEventListener('click', toggleMusic);
  for (const button of document.querySelectorAll('[data-map]')) button.addEventListener('click', () => selectMap(button.dataset.map));
  const fullscreen = document.getElementById('fullscreen');
  fullscreen.hidden = !(document.fullscreenEnabled && container.requestFullscreen);
  fullscreen.addEventListener('click', async () => {
    try { await (document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen()); }
    catch { announcer.textContent = 'Full screen is unavailable in this browser.'; }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreen.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen'); icon(fullscreen, active ? Minimize : Maximize);
    state.resize = true;
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { exploration.showJournal(false); releaseAll(); }
    if (event.target.closest?.('button')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); keys.add(event.key); camera.follow = true; }
    if (event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); setPaused(!state.paused); }
    if (event.key.toLowerCase() === 'r') reset();
    if (event.key.toLowerCase() === 'm') toggleSound();
    if (event.key.toLowerCase() === 'f') exploration.find();
  });
  window.addEventListener('keyup', event => keys.delete(event.key));
  window.addEventListener('blur', () => setActive(false));
  window.addEventListener('focus', () => setActive(true));
  window.addEventListener('resize', () => { state.resize = true; });
  new ResizeObserver(() => { state.resize = true; }).observe(container);
  document.addEventListener('visibilitychange', () => {
    releaseAll(); state.timestamp = 0; state.accumulator = 0; syncAudio();
  });
  window.addEventListener('pagehide', () => setActive(false));
  window.addEventListener('pageshow', () => setActive(true));
  const appearance = window.matchMedia('(prefers-color-scheme: dark)');
  appearance.addEventListener('change', event => {
    if (new URLSearchParams(location.search).has('scoutTheme')) return;
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; state.resize = true;
  });
  resizeWorld(false);
  exploration = new ExplorationUI(() => ({ island, camera, scene }), releaseAll, message => { announcer.textContent = message; });
  const favicon = document.createElement('link'); favicon.rel = 'icon'; favicon.href = document.getElementById('brand-mark').toDataURL(); document.head.append(favicon);
  window.__blobIsland = Object.freeze({ snapshot: () => ({ ...island.snapshot(), version: 4, camera: camera.snapshot(), paused: state.paused, sound: audio.enabled, audioSupported: audio.supported, audioState: audio.context?.state || 'not-created', music: audio.musicEnabled, musicSupported: audio.musicSupported, musicPaused: audio.music.paused, musicTime: audio.music.currentTime, musicError: audio.music.error?.message || null, soundEvents: { ...audio.effectCounts }, activeVoices: audio.activeVoices, frames: state.frames, waterTouches: waterPointers.size, pointerCount: pointers.size, sceneryPixels: scene.sceneryPixels, renderQuality: { ...scene.quality }, parallax: scene.layers.map(layer => ({ kind: layer.kind, factor: layer.factor, pixels: layer.canvas.width * layer.canvas.height })), audioEnvironment: { ...audio.environmentState } }) });
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}