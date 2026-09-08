import { createElement, RotateCcw, Volume2, VolumeX, Pause, Play, Maximize, Minimize, Sun, Music2, AudioLines } from 'lucide';
import { IslandPhysics, STEP } from './physics.js';
import { MAPS } from './maps.js';
import { IslandScene } from './scene.js';
import { IslandAudio } from './audio.js';

const canvas = document.getElementById('world');
const container = document.getElementById('island');
const announcer = document.getElementById('announcer');
const audio = new IslandAudio();
const keys = new Set();
const waterPointers = new Set();
const state = { paused: false, resize: true, timestamp: 0, accumulator: 0, pointer: null, frames: 0, audioBusy: false, musicBusy: false, mapId: 'lagoon' };
const islands = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let island;
let scene;

function icon(element, glyph) {
  const symbol = createElement(glyph, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' });
  element.replaceChildren(symbol);
}

function releaseAll() {
  island?.releaseAll(); keys.clear(); waterPointers.clear();
  canvas.style.cursor = 'default';
}

function resizeWorld(preserve = true) {
  const bounds = container.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return;
  const old = island;
  releaseAll();
  const width = 900 * bounds.width / bounds.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(5000000 / (bounds.width * bounds.height)));
  canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
  island = new IslandPhysics(width, 900, state.mapId);
  if (old && preserve) island.restoreFrom(old);
  old?.dispose();
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
  state.mapId = mapId;
  const bounds = container.getBoundingClientRect();
  const width = 900 * bounds.width / bounds.height;
  island = islands.get(mapId) || new IslandPhysics(width, 900, mapId);
  if (Math.abs(island.width - width) > 0.5) {
    const resized = new IslandPhysics(width, 900, mapId);
    resized.restoreFrom(island); island.dispose(); island = resized;
  }
  islands.set(mapId, island);
  scene = new IslandScene(canvas, island);
  state.pointer = null; state.timestamp = 0; state.accumulator = 0;
  updateMapControls();
  announcer.textContent = island.map.name;
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) / bounds.width * island.width, y: (event.clientY - bounds.top) / bounds.height * island.height };
}

function onPointerDown(event) {
  if (!island || state.paused) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  const point = pointFromEvent(event);
  state.pointer = point;
  const padding = (event.pointerType === 'mouse' ? 8 : 24) * island.height / canvas.getBoundingClientRect().height;
  const drag = island.grab(event.pointerId, point, Math.min(38, padding));
  if (drag) {
    canvas.style.cursor = 'grabbing'; audio.play(drag.kind === 'tree' ? 'rustle' : 'grab', 2, point.x / island.width * 2 - 1);
  } else if (point.x > island.layout.waterStart && point.y > island.layout.water - 35 && point.y < island.layout.bottom) {
    waterPointers.add(event.pointerId); island.splash(point.x, 2.5);
  }
  try { canvas.setPointerCapture(event.pointerId); } catch {}
}

function onPointerMove(event) {
  if (!island) return;
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
  if (island?.drags.size === 0) canvas.style.cursor = 'default';
  if (event.pointerType !== 'mouse' && island?.drags.size === 0) state.pointer = null;
}

function setPaused(paused) {
  state.paused = paused; state.accumulator = 0; state.timestamp = 0; releaseAll();
  const button = document.getElementById('pause');
  button.setAttribute('aria-pressed', String(paused)); button.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  icon(button, paused ? Play : Pause); document.getElementById('pause-state').hidden = !paused;
  audio.pause(paused || document.hidden);
  announcer.textContent = paused ? 'Game paused.' : 'Game resumed.';
}

async function toggleSound() {
  if (state.audioBusy) return;
  state.audioBusy = true;
  const enabled = await audio.toggle();
  const button = document.getElementById('sound');
  button.setAttribute('aria-pressed', String(enabled)); button.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
  icon(button, enabled ? Volume2 : VolumeX);
  audio.pause(state.paused || document.hidden);
  announcer.textContent = enabled ? 'Sound on.' : 'Sound off.';
  state.audioBusy = false;
}

async function toggleMusic() {
  if (state.musicBusy) return;
  state.musicBusy = true;
  try {
    const enabled = await audio.toggleMusic();
    updateMusicControl();
    audio.pause(state.paused || document.hidden);
    announcer.textContent = enabled ? 'Music on.' : 'Music off.';
  } finally { state.musicBusy = false; }
}

function updateMusicControl() {
  const button = document.getElementById('music');
  button.setAttribute('aria-pressed', String(audio.musicEnabled)); button.setAttribute('aria-label', audio.musicEnabled ? 'Pause music' : 'Play music');
  icon(button, audio.musicEnabled ? AudioLines : Music2);
}

function reset() {
  resizeWorld(false); setPaused(false); state.pointer = null; audio.play('grab', 2);
  announcer.textContent = 'The island has been reset.';
}

function frame(timestamp) {
  try {
    if (state.resize) resizeWorld();
    const elapsed = state.timestamp ? Math.min(100, timestamp - state.timestamp) : 0;
    state.timestamp = timestamp;
    if (!state.paused && !document.hidden) {
      state.accumulator += elapsed;
      while (state.accumulator >= STEP) {
        const horizontal = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
        const vertical = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
        if (horizontal || vertical) island.nudge(horizontal, vertical);
        island.step(); state.accumulator -= STEP;
        for (const splash of island.splashes.splice(0)) {
          scene.addSplash(splash);
        }
        for (const sound of island.sounds.splice(0)) audio.play(sound.kind, sound.strength, sound.pan);
      }
      const positions = island.blob.ring.map(particle => particle.position.x);
      audio.stretch((Math.max(...positions) - Math.min(...positions)) / 80, [...island.drags.values()].filter(drag => drag.kind === 'blob').length > 1);
    } else state.accumulator = 0;
    scene.draw(island, island.time, state.pointer, reducedMotion.matches);
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
    if (event.target.closest?.('button')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); keys.add(event.key); }
    if (event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); setPaused(!state.paused); }
    if (event.key.toLowerCase() === 'r') reset();
    if (event.key.toLowerCase() === 'm') toggleSound();
  });
  window.addEventListener('keyup', event => keys.delete(event.key));
  window.addEventListener('blur', releaseAll);
  window.addEventListener('resize', () => { state.resize = true; });
  new ResizeObserver(() => { state.resize = true; }).observe(container);
  document.addEventListener('visibilitychange', () => {
    releaseAll(); state.timestamp = 0; state.accumulator = 0; audio.pause(document.hidden || state.paused);
  });
  window.addEventListener('pagehide', () => { releaseAll(); audio.pause(true); });
  window.addEventListener('pageshow', () => audio.pause(document.hidden || state.paused));
  const appearance = window.matchMedia('(prefers-color-scheme: dark)');
  appearance.addEventListener('change', event => {
    if (new URLSearchParams(location.search).has('scoutTheme')) return;
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; state.resize = true;
  });
  resizeWorld(false);
  const favicon = document.createElement('link'); favicon.rel = 'icon'; favicon.href = document.getElementById('brand-mark').toDataURL(); document.head.append(favicon);
  window.__blobIsland = Object.freeze({ snapshot: () => ({ ...island.snapshot(), version: 2, paused: state.paused, sound: audio.enabled, audioSupported: audio.supported, audioState: audio.context?.state || 'not-created', music: audio.musicEnabled, musicSupported: audio.musicSupported, musicPaused: audio.music.paused, musicTime: audio.music.currentTime, musicError: audio.music.error?.message || null, soundEvents: { ...audio.effectCounts }, activeVoices: audio.activeVoices, frames: state.frames, waterTouches: waterPointers.size }) });
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}