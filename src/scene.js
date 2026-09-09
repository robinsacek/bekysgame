import { drawBlob, drawProp, drawLogo } from './sprites.js';
import { drawCreature, drawHabitats, drawObjectiveEffects } from './creature-art.js';
import { drawLocalResident, drawReaction, drawComicEffects } from './character-details.js';
import { drawTerrainDetails } from './terrain-art.js';
import { drawMapHabitat } from './map-art.js';
import { drawForagePatch, drawFoodPortion } from './forage-art.js';
import { drawCreatureBubbles } from './creature-bubbles.js';
import { projectShadow } from './shadows.js';
import { drawEnvironment, drawSwash, drawWeather } from './environment-art.js';
import { comicPose } from './antics.js';

const TAU = Math.PI * 2;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const mix = (first, second, amount) => first.map((channel, index) => channel + (second[index] - channel) * amount);
const paint = (color, alpha = 1) => `rgba(${color.map(channel => Math.round(channel)).join(',')},${alpha})`;

function readColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value.startsWith('#')) return [0, 2, 4].map(offset => parseInt(value.slice(offset + 1, offset + 3), 16));
  return value.match(/[\d.]+/g).slice(0, 3).map(Number);
}

function randomSource(seed = 73821) {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function oval(context, positionX, positionY, radiusX, radiusY, color, angle = 0) {
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(positionX, positionY, radiusX, radiusY, angle, 0, TAU);
  context.fill();
}

function polygon(context, points, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath();
  context.fill();
}

export class IslandScene {
  constructor(canvas, island) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas is not available.');
    this.width = island.width;
    this.height = island.height;
    this.map = island.map;
    const samples = new Set([0, island.width, island.layout.shore, island.layout.toe, island.layout.farToe, island.layout.farShore].filter(Number.isFinite));
    for (const point of island.layout.seabed || []) samples.add(point.x);
    for (let positionX = 0; positionX < island.width; positionX += 16) samples.add(positionX);
    this.coastline = [...samples].sort((first, second) => first - second).map(positionX => [positionX, island.floorAt(positionX)]);
    const waterEnd = island.layout.waterEnd || island.width;
    this.waterBed = [[waterEnd, island.layout.water], ...this.coastline.filter(point => point[0] > island.layout.waterStart && point[0] < waterEnd).reverse(), [island.layout.waterStart, island.layout.water]];
    this.scale = canvas.height / island.height;
    Object.assign(this, { paint, mix, oval, clamp });
    this.random = randomSource();
    this.pupils = [{ x: 0, y: 0, velocityX: 0, velocityY: 0 }, { x: 0, y: 0, velocityX: 0, velocityY: 0 }];
    this.droplets = [];
    this.ripples = [];
    this.lastTime = 0;
    this.faceAngle = 0;
    this.dark = document.documentElement.dataset.theme === 'dark';
    this.colors = {
      paper: readColor(this.dark ? '--cp-text' : '--cp-surface'), ink: readColor(this.dark ? '--cp-bg-elevated' : '--cp-text'),
      blue: readColor('--cp-link'), green: readColor('--cp-success'), pink: readColor('--cp-accent'),
      yellow: readColor('--cp-warning'), red: readColor('--cp-danger'),
    };
    const { paper, ink, blue, green, yellow, pink } = this.colors;
    Object.assign(this.colors, { ocean: mix(blue, green, 0.41), leaf: mix(green, ink, 0.26), sand: mix(paper, yellow, 0.28), wood: mix(yellow, ink, 0.52) });
    this.rainbow = [this.colors.red, yellow, green, mix(green, blue, 0.5), blue, mix(blue, pink, 0.62), pink];
    this.frondSprites = new Map();
    this.layers = [{ kind: 'far', factor: 0.25, scale: Math.min(this.scale, 0.6), height: island.height },
      { kind: 'mid', factor: 0.55, scale: Math.min(this.scale, 0.5), height: Math.min(island.height, island.layout.ground + 20) },
      { kind: 'near', factor: 1, scale: Math.min(this.scale, 0.9), height: island.height }].map(layer => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(island.width * layer.scale); canvas.height = Math.ceil(layer.height * layer.scale);
      const context = canvas.getContext('2d', { alpha: layer.kind !== 'far' }); context.scale(layer.scale, layer.scale);
      this.drawBackground(context, island, layer.kind);
      if (layer.kind === 'near') { drawTerrainDetails(this, context, island); drawMapHabitat(this, context, island); drawHabitats(this, context, island); }
      return this.freezeCanvasCache({ ...layer, canvas });
    });
    this.background = this.layers[2].canvas; this.cacheScale = this.layers[2].scale;
    this.sceneryPixels = this.layers.reduce((total, layer) => total + layer.canvas.width * layer.canvas.height, 0)
      + [...this.frondSprites.values()].reduce((total, sprite) => total + sprite.canvas.width * sprite.canvas.height, 0);
    this.quality = { refraction: canvas.width >= 900 && canvas.width / canvas.height < 1.7 && canvas.width * canvas.height < 4000000, caustics: true, parallax: true };
    this.frameAverage = 16.7; this.qualityFrames = 0;
    this.refractionCanvas = document.createElement('canvas');
    this.refraction = null;
    drawLogo(this);
    this.drawMapPreviews();
  }

  drawMapPreviews() {
    const { paper, blue, ocean, yellow, pink, sand, leaf, wood, ink } = this.colors;
    for (const button of document.querySelectorAll('[data-map]')) {
      const context = button.querySelector('canvas').getContext('2d');
      const sunset = button.dataset.map === 'sunset';
      context.fillStyle = paint(mix(paper, sunset ? pink : blue, 0.22)); context.fillRect(0, 0, 64, 64);
      oval(context, 47, sunset ? 29 : 16, sunset ? 10 : 6, sunset ? 10 : 6, paint(mix(paper, yellow, 0.35)));
      context.fillStyle = paint(mix(ocean, paper, 0.42)); context.fillRect(0, 34, 64, 30);
      polygon(context, [[0, 44], [24, 42], [53, 64], [0, 64]], paint(sand));
      if (button.dataset.map === 'pools') {
        context.fillStyle = paint(mix(ink, paper, 0.57)); context.beginPath(); context.moveTo(0, 39);
        context.bezierCurveTo(13, 39, 17, 42, 25, 42); context.lineTo(33, 47);
        context.quadraticCurveTo(37, 48, 42, 53); context.lineTo(53, 64);
        context.lineTo(45, 64); context.quadraticCurveTo(32, 51, 23, 49); context.lineTo(0, 45); context.closePath(); context.fill();
        context.strokeStyle = paint(paper, 0.54); context.lineWidth = 1;
        context.beginPath(); context.moveTo(28, 44); context.quadraticCurveTo(37, 47, 40, 52); context.stroke();
      } else {
        context.strokeStyle = paint(wood); context.lineWidth = 4;
        context.beginPath(); context.moveTo(13, 49); context.quadraticCurveTo(14, 31, 21, 23); context.stroke();
        for (let index = 0; index < 5; index += 1) this.leaf(context, 21, 23, 18, 8, index * 1.2, paint(leaf));
      }
    }
  }

  freezeCanvasCache(entry) {
    const canvas = entry.canvas;
    const image = new Image();
    image.onload = () => {
      entry.canvas = image;
      if (this.background === canvas) this.background = image;
      canvas.width = 1; canvas.height = 1;
      image.onload = null;
    };
    image.src = canvas.toDataURL();
    return entry;
  }

  cloud(context, positionX, positionY, size, opacity) {
    context.save(); context.translate(positionX, positionY); context.scale(size, size);
    context.fillStyle = paint(this.colors.paper, opacity);
    context.beginPath(); context.moveTo(-92, 13);
    context.bezierCurveTo(-102, -2, -72, -15, -54, -10);
    context.bezierCurveTo(-61, -40, -14, -56, 2, -27);
    context.bezierCurveTo(20, -40, 52, -26, 50, -8);
    context.bezierCurveTo(77, -20, 105, 0, 96, 12);
    context.bezierCurveTo(63, 28, -47, 26, -92, 13);
    context.fill(); context.restore();
  }

  leaf(context, positionX, positionY, length, width, angle, color) {
    context.save(); context.translate(positionX, positionY); context.rotate(angle);
    context.fillStyle = color;
    context.beginPath(); context.moveTo(0, 0);
    context.bezierCurveTo(length * 0.38, -width, length * 0.82, -width * 0.42, length, 0);
    context.bezierCurveTo(length * 0.66, width * 0.34, length * 0.28, width * 0.45, 0, 0);
    context.fill();
    context.strokeStyle = paint(this.colors.paper, 0.14); context.lineWidth = 1;
    context.beginPath(); context.moveTo(0, 0);
    context.quadraticCurveTo(length * 0.5, -width * 0.08, length * 0.90, 0); context.stroke(); context.restore();
  }

  frond(context, targetX, targetY, color) {
    const controlX = targetX * 0.48;
    const controlY = targetY - 58;
    for (let index = 1; index <= 11; index += 1) {
      const portion = index / 12;
      const positionX = 2 * (1 - portion) * portion * controlX + portion * portion * targetX;
      const positionY = 2 * (1 - portion) * portion * controlY + portion * portion * targetY;
      const angle = Math.atan2(2 * (1 - portion) * controlY + 2 * portion * (targetY - controlY), 2 * (1 - portion) * controlX + 2 * portion * (targetX - controlX));
      const blade = Math.sin(portion * Math.PI) * 40 + 9;
      this.leaf(context, positionX, positionY, blade, blade * 0.23, angle - 0.98, color);
      this.leaf(context, positionX, positionY, blade * 0.91, blade * 0.22, angle + 0.94, color);
    }
    context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(controlX, controlY, targetX, targetY);
    context.lineWidth = 2.4; context.strokeStyle = paint(mix(this.colors.leaf, this.colors.yellow, 0.23)); context.stroke();
  }

  frondSprite(targetX, targetY, color) {
    const key = `${targetX}:${targetY}:${color}`;
    if (this.frondSprites.has(key)) return this.frondSprites.get(key);
    const left = Math.min(0, targetX) - 58;
    const top = Math.min(-85, targetY - 115);
    const width = Math.ceil(Math.max(0, targetX) + 58 - left);
    const height = Math.ceil(Math.max(20, targetY) + 60 - top);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.translate(-left, -top);
    this.frond(context, targetX, targetY, color);
    const sprite = this.freezeCanvasCache({ canvas, left, top, width, height }); this.frondSprites.set(key, sprite);
    return sprite;
  }

  palm(context, positionX, baseY, height, lean, scale = 1, showFruit = true, wind = 0) {
    const { wood, yellow, ink, leaf, green } = this.colors;
    context.save(); context.translate(positionX, baseY); context.scale(scale, scale);
    const bark = context.createLinearGradient(0, 0, 35, -height);
    bark.addColorStop(0, paint(mix(wood, ink, 0.12))); bark.addColorStop(0.55, paint(mix(wood, yellow, 0.16))); bark.addColorStop(1, paint(mix(wood, yellow, 0.35)));
    context.fillStyle = bark;
    context.beginPath(); context.moveTo(-18, 0);
    context.bezierCurveTo(lean * 0.18 - 15, -height * 0.30, lean * 0.65 - 12, -height * 0.83, lean - 7, -height);
    context.lineTo(lean + 7, -height);
    context.bezierCurveTo(lean * 0.75 + 12, -height * 0.7, lean * 0.22 + 12, -height * 0.26, 20, 0);
    context.closePath(); context.fill();
    for (let index = 1; index < 18; index += 1) {
      const portion = index / 18;
      const centerX = lean * Math.pow(portion, 1.3);
      const radius = 16 - portion * 8;
      context.strokeStyle = paint(ink, 0.18); context.lineWidth = 2;
      context.beginPath(); context.moveTo(centerX - radius, -height * portion);
      context.quadraticCurveTo(centerX, -height * portion + 8, centerX + radius, -height * portion + 4); context.stroke();
    }
    context.translate(lean, -height);
    [[-174, 22], [-143, -43], [-64, -80], [30, -86], [128, -60], [186, -4], [178, 69], [73, 96], [-107, 77]].forEach(([targetX, targetY], index) => {
      const sway = wind * (10 + Math.sin((this.animationTime || 0) * 0.0016 + index) * 7);
      const sprite = this.frondSprite(targetX, targetY, paint(mix(leaf, green, index % 3 * 0.19)));
      context.save(); context.rotate(sway * 0.003); context.drawImage(sprite.canvas, sprite.left, sprite.top, sprite.width, sprite.height); context.restore();
    });
    if (showFruit) {
      oval(context, -9, 13, 10, 13, paint(wood)); oval(context, 8, 17, 10, 12, paint(mix(wood, yellow, 0.20)));
    }
    oval(context, 0, 0, 12, 10, paint(leaf));
    context.restore();
  }

  drawBackground(context, island, layer) {
    const { width, height } = this;
    const { ground, bottom, shore, toe, water, waterStart } = island.layout;
    const { paper, ink, blue, green, yellow, sand, leaf, ocean, pink } = this.colors;
    const random = randomSource();
    const horizon = height * (this.map.horizon - (island.expedition ? 0.09 : 0));
    if (layer === 'far') {
    const sky = context.createLinearGradient(0, 0, 0, horizon + 70);
    sky.addColorStop(0, paint(this.dark ? mix(ink, blue, 0.26) : mix(mix(paper, blue, 0.23), mix(paper, pink, 0.28), this.map.warmth * 2.4)));
    sky.addColorStop(1, paint(this.dark ? mix(ink, blue, 0.38) : mix(paper, yellow, 0.035 + this.map.warmth * 0.68)));
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    const sun = island.environment.sun;
    oval(context, width * (0.5 + Math.cos(sun.azimuth) * 0.30), horizon - 30 - sun.elevation * 115, 33 + this.map.warmth * 48, 33 + this.map.warmth * 48, paint(mix(paper, yellow, 0.13 + this.map.warmth), 0.95));
    const sea = context.createLinearGradient(0, horizon, 0, ground + 40);
    sea.addColorStop(0, paint(mix(blue, paper, 0.46))); sea.addColorStop(0.6, paint(mix(ocean, paper, 0.50))); sea.addColorStop(1, paint(mix(ocean, paper, 0.64)));
    context.fillStyle = sea; context.fillRect(0, horizon, width, height - horizon);
    return;
    }
    if (layer === 'mid') {
    this.cloud(context, width * 0.28, 180, 0.9, 0.55); this.cloud(context, width * 0.60, 240, 0.64, 0.50);
    this.cloud(context, width * 0.97, 275, 1.05, 0.52); this.cloud(context, width * 0.015, 255, 0.61, 0.44);
    const islandX = width * 0.68;
    const islandWidth = Math.min(360, width * 0.37);
    context.beginPath(); context.moveTo(islandX - islandWidth * 0.60, horizon + 11);
    context.bezierCurveTo(islandX - islandWidth * 0.38, horizon - 16, islandX - islandWidth * 0.22, horizon - 119, islandX, horizon - 112);
    context.bezierCurveTo(islandX + islandWidth * 0.12, horizon - 120, islandX + islandWidth * 0.18, horizon - 36, islandX + islandWidth * 0.26, horizon - 45);
    context.bezierCurveTo(islandX + islandWidth * 0.42, horizon - 42, islandX + islandWidth * 0.49, horizon, islandX + islandWidth * 0.66, horizon + 14);
    context.closePath(); context.fillStyle = paint(mix(green, mix(blue, paper, 0.52), 0.69)); context.fill();
    polygon(context, [[islandX - islandWidth * 0.13, horizon - 94], [islandX - islandWidth * 0.01, horizon - 109], [islandX + islandWidth * 0.20, horizon + 9], [islandX - islandWidth * 0.30, horizon + 9]], paint(mix(leaf, paper, 0.50), 0.25));
    oval(context, islandX, horizon + 15, islandWidth * 0.68, 6, paint(mix(paper, yellow, 0.19)));
    context.globalCompositeOperation = 'source-atop'; context.fillStyle = paint(mix(paper, blue, 0.25), 0.12); context.fillRect(0, 0, width, height); context.globalCompositeOperation = 'source-over';
    return;
    }
    for (let index = 0; index < 70; index += 1) {
      const positionY = horizon + 30 + random() * 228;
      const positionX = random() * width;
      const length = 8 + random() * 52;
      context.strokeStyle = paint(paper, 0.18 + random() * 0.24); context.lineWidth = 1 + (positionY - horizon) / 150;
      context.beginPath(); context.moveTo(positionX, positionY); context.quadraticCurveTo(positionX + length / 2, positionY - 2, positionX + length, positionY); context.stroke();
    }
    context.fillStyle = paint(mix(sand, paper, 0.23)); context.beginPath(); context.moveTo(0, ground - 74);
    context.bezierCurveTo(shore * 0.25, ground - 91, shore * 0.67, ground - 62, shore + 18, ground + 10);
    context.lineTo(shore, ground + 100); context.lineTo(0, ground + 100); context.fill();
    for (let index = 0; index < 14; index += 1) this.leaf(context, random() * shore * 0.56, ground - 34, 55 + random() * 70, 15 + random() * 9, -2.8 + random() * 2.5, paint(mix(leaf, green, random() * 0.5)));
    const palmScale = clamp(width / 1300, 0.69, 1);
    this.palm(context, width * 0.027, ground - 30, island.expedition ? 205 : 248, -18, palmScale * 0.77);
    const beach = context.createLinearGradient(0, ground, 0, height);
    beach.addColorStop(0, paint(mix(sand, paper, 0.23))); beach.addColorStop(0.65, paint(sand)); beach.addColorStop(1, paint(mix(sand, yellow, 0.12)));
    const farToe = island.layout.farToe || width;
    const farShore = island.layout.farShore || width;
    const farGround = island.layout.farGround || bottom;
    polygon(context, [...this.coastline, [width, height], [0, height]], beach);
    context.strokeStyle = paint(mix(sand, paper, 0.25), 0.25); context.lineWidth = 5; context.lineJoin = 'round';
    for (const [start, end] of [[shore, toe], [farToe, farShore]]) {
      context.beginPath(); context.moveTo(start, island.floorAt(start) + 2);
      for (const [positionX, positionY] of this.coastline.filter(point => point[0] > start && point[0] <= end)) context.lineTo(positionX, positionY + 2);
      context.stroke();
    }
    for (let index = 0; index < 760; index += 1) {
      const positionX = random() * width;
      const floor = island.floorAt(positionX);
      oval(context, positionX, floor + 8 + random() * (height - floor), 0.6 + random() * 1.4, 0.4 + random() * 0.6, paint(random() > 0.45 ? paper : mix(yellow, ink, 0.30), 0.18 + random() * 0.2));
    }
    for (let index = 0; index < 15; index += 1) {
      const positionX = waterStart + random() * (width - waterStart);
      const floor = island.floorAt(positionX);
      oval(context, positionX, floor + 3, 4 + random() * 8, 2 + random() * 3, paint(mix(sand, ink, 0.34), 0.43));
      if (index % 3 === 0) for (let blade = 0; blade < 5; blade += 1) this.leaf(context, positionX, floor, 23 + random() * 35, 4, -2.1 + blade * 0.23, paint(mix(green, ocean, 0.26), 0.54));
    }
    const shallow = context.createLinearGradient(0, water, 0, bottom);
    shallow.addColorStop(0, paint(mix(ocean, paper, 0.39), 0.18)); shallow.addColorStop(1, paint(mix(ocean, blue, 0.25), 0.30));
    polygon(context, [[waterStart, water], ...this.waterBed], shallow);
    for (const rock of island.rocks) {
      polygon(context, rock.vertices.map(vertex => [vertex.x, vertex.y]), paint(mix(ink, paper, 0.57)));
      polygon(context, rock.vertices.slice(0, 3).map(vertex => [vertex.x, vertex.y]), paint(mix(ink, paper, 0.68)));
      context.strokeStyle = paint(paper, 0.40); context.lineWidth = 2;
      context.beginPath(); context.moveTo(rock.vertices[1].x, rock.vertices[1].y); context.lineTo(rock.vertices[2].x, rock.vertices[2].y); context.stroke();
    }
    for (const prop of island.props.filter(item => item.anchor)) {
      polygon(context, [[prop.anchor.x - 17, ground], [prop.anchor.x, prop.anchor.y - 1], [prop.anchor.x + 17, ground]], paint(mix(this.colors.wood, yellow, 0.14)));
      oval(context, prop.anchor.x, prop.anchor.y, 4, 4, paint(ink, 0.65));
    }
  }

  drawTree(context, island, time) {
    const tree = island.tree;
    const base = tree.point({ x: 0, y: 0 });
    context.save(); context.translate(base.x, base.y); context.rotate(tree.body.angle);
    this.palm(context, 0, 0, tree.height, tree.lean, tree.scale, false, this.wind);
    context.restore();
    for (const fruit of tree.fruits.filter(item => item.attached)) {
      context.strokeStyle = paint(this.colors.wood); context.lineWidth = 1.8;
      context.beginPath(); context.moveTo(tree.body.position.x + fruit.stem.pointA.x, tree.body.position.y + fruit.stem.pointA.y);
      context.lineTo(fruit.body.position.x, fruit.body.position.y - fruit.radius * 0.65); context.stroke();
      drawProp(this, context, fruit);
    }
    for (const rustle of tree.rustles) {
      const age = (time - rustle.time) / 1000;
      if (age < 0 || age > 1.2) continue;
      for (let index = 0; index < 5; index += 1) this.leaf(context, rustle.x + Math.sin(index * 2.1) * age * 76, rustle.y + age * 55 + age * age * 90, 12, 4, index + age * 4, paint(this.colors.leaf, 1 - age / 1.2));
    }
  }

  addSplash(event) {
    for (let index = 0; index < Math.min(18, Math.ceil(event.strength * 3)); index += 1) this.droplets.push({ x: event.x, y: event.y, velocityX: (this.random() - 0.5) * (event.strength + 2) * 24, velocityY: -(45 + this.random() * 65 + event.strength * 15), start: event.time, radius: 1 + this.random() * 2 });
    this.droplets = this.droplets.slice(-120);
    this.ripples.push({ x: event.x, start: event.time }); this.ripples = this.ripples.slice(-20);
  }

  drawWater(context, island, time) {
    const { paper, ocean, blue } = this.colors;
    const { waterStart, water, bottom } = island.layout;
    const waterEnd = island.layout.waterEnd || this.width;
    context.save();
    context.beginPath(); context.moveTo(waterStart, water);
    for (const point of this.waterBed) context.lineTo(...point);
    context.closePath(); context.clip();
    if (this.quality.caustics) for (let band = 0; band < 7; band += 1) {
      context.strokeStyle = paint(paper, 0.055 + band % 2 * 0.028); context.lineWidth = 1.3;
      context.beginPath();
      for (let sample = 0; sample <= 72; sample += 1) {
        const positionX = waterStart + sample / 72 * (waterEnd - waterStart);
        const interference = Math.sin(positionX * 0.018 + time * 0.0009 + band) * 6 + Math.sin(positionX * 0.034 - time * 0.0007 + band * 1.8) * 4;
        const positionY = Math.min(island.floorAt(positionX) - 6, bottom - 15 - band * 11) + interference;
        if (sample === 0) context.moveTo(positionX, positionY); else context.lineTo(positionX, positionY);
      }
      context.stroke();
    }
    for (let index = 0; index < 14; index += 1) {
      const positionX = waterStart + index / 27 * (waterEnd - waterStart) + Math.sin(time * 0.0006 + index) * 15;
      const positionY = water + 42 + index % 6 * 44;
      context.strokeStyle = paint(paper, 0.07 + (Math.sin(time * 0.001 + index) + 1) * 0.025); context.lineWidth = 1.2;
      context.beginPath(); context.ellipse(positionX, positionY, 22 + index % 3 * 10, 6, Math.sin(index) * 0.2, 0.2, Math.PI * 1.6); context.stroke();
      if (index % 5 === 0) {
        const bubbleY = bottom - (time * 0.015 + index * 19) % Math.max(1, bottom - water - 12);
        context.strokeStyle = paint(paper, 0.27); context.lineWidth = 0.8; context.beginPath(); context.arc(positionX + 10, bubbleY, 2.2, 0, TAU); context.stroke();
      }
    }
    context.restore();
    const waterPath = () => {
      context.beginPath();
      island.waves.forEach((wave, index) => {
        const positionX = waterStart + index / (island.waves.length - 1) * (waterEnd - waterStart);
        if (index === 0) context.moveTo(positionX, island.surfaceAt(positionX));
        else context.lineTo(positionX, island.surfaceAt(positionX));
      });
    };
    waterPath();
    for (const point of this.waterBed) context.lineTo(...point);
    context.closePath();
    const wash = context.createLinearGradient(0, water, 0, bottom);
    wash.addColorStop(0, paint(mix(ocean, paper, 0.35), 0.11)); wash.addColorStop(1, paint(mix(blue, ocean, 0.6), 0.19));
    context.fillStyle = wash; context.fill();
    waterPath(); context.strokeStyle = paint(paper, 0.87); context.lineWidth = 2.5; context.stroke();
    waterPath(); context.strokeStyle = paint(ocean, 0.40); context.lineWidth = 0.7; context.stroke();
    const glitterX = this.width * (0.5 + Math.cos(island.environment.sun.azimuth) * 0.30);
    for (let index = 0; index < 35; index += 1) {
      const positionX = waterStart + (waterEnd - waterStart) * index / 34;
      const alignment = Math.max(0, 1 - Math.abs(positionX - glitterX) / 550);
      const slope = Math.abs(island.surfaceAt(positionX + 7) - island.surfaceAt(positionX - 7));
      const flicker = 0.6 + 0.4 * Math.sin(time * 0.002 + index * 2.3);
      if (alignment < 0.05) continue;
      context.strokeStyle = paint(mix(paper, this.colors.yellow, 0.18), alignment * flicker * 0.50 / (1 + slope)); context.lineWidth = 1.4;
      context.beginPath(); context.moveTo(positionX - 6, island.surfaceAt(positionX) + 3 + index % 3 * 5);
      context.lineTo(positionX + 6, island.surfaceAt(positionX) + 3 + index % 3 * 5); context.stroke();
    }
    for (let index = 0; index < 7; index += 1) {
      const positionX = waterStart + ((index * 139 + time * 0.009) % (waterEnd - waterStart));
      context.strokeStyle = paint(paper, 0.32); context.lineWidth = 1.2;
      context.beginPath(); context.ellipse(positionX, water + 12 + index % 3 * 30, 14 + index % 3 * 8, 2.5, 0, Math.PI * 1.15, TAU * 0.95); context.stroke();
    }
    this.ripples = this.ripples.filter(ripple => time - ripple.start < 1900);
    for (const ripple of this.ripples) {
      const age = (time - ripple.start) / 1900;
      context.strokeStyle = paint(paper, (1 - age) * 0.5); context.lineWidth = 1.3;
      context.beginPath(); context.ellipse(ripple.x, island.surfaceAt(ripple.x) + 2, 8 + age * 48, 1 + age * 6, 0, 0, TAU); context.stroke();
    }
    this.droplets = this.droplets.filter(drop => time - drop.start < 720);
    for (const drop of this.droplets) {
      const age = (time - drop.start) / 1000;
      const positionY = drop.y + drop.velocityY * age + 370 * age * age;
      if (positionY < water + 8) oval(context, drop.x + drop.velocityX * age, positionY, drop.radius, drop.radius * 1.35, paint(mix(ocean, paper, 0.60), (1 - age) * 0.85));
    }
  }

  observeFrame(elapsed) {
    if (elapsed <= 0) return;
    this.frameAverage += (elapsed - this.frameAverage) * 0.06;
    this.qualityFrames += 1;
    if (this.qualityFrames < 45 || this.frameAverage <= 34) return;
    if (this.quality.refraction) this.quality.refraction = false;
    else if (this.quality.caustics) this.quality.caustics = false;
    this.qualityFrames = 0;
  }

  captureBlob(island, camera) {
    this.refraction = null;
    if (!this.quality.refraction) return;
    const particles = island.blob.ring;
    const left = Math.max(0, (Math.min(...particles.map(body => body.position.x)) - camera.x - 8) * this.scale);
    const right = Math.min(this.canvas.width, (Math.max(...particles.map(body => body.position.x)) - camera.x + 8) * this.scale);
    const top = Math.max(0, (Math.min(...particles.map(body => body.position.y)) + island.blob.depth - 8) * this.scale);
    const bottom = Math.min(this.canvas.height, (Math.max(...particles.map(body => body.position.y)) + island.blob.depth + 8) * this.scale);
    if (right <= left || bottom <= top) return;
    const scratch = this.refractionCanvas;
    scratch.width = Math.max(1, Math.min(512, Math.ceil(right - left))); scratch.height = Math.max(1, Math.min(512, Math.ceil(bottom - top)));
    scratch.getContext('2d').drawImage(this.canvas, left, top, right - left, bottom - top, 0, 0, scratch.width, scratch.height);
    this.refraction = { canvas: scratch, x: camera.x + left / this.scale, y: top / this.scale - island.blob.depth, width: (right - left) / this.scale, height: (bottom - top) / this.scale };
  }

  draw(island, time, pointer, reducedMotion, camera = { x: 0, viewWidth: island.width }) {
    const context = this.context;
    this.animationTime = time;
    this.wind = reducedMotion ? 0 : island.environment.wind;
    const delta = clamp(time - this.lastTime, 0, 40); this.lastTime = time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = paint(this.colors.paper); context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const visibleWidth = Math.min(camera.viewWidth, island.width - camera.x);
    for (const layer of this.layers) {
      if (layer.kind === 'near') {
        context.setTransform(this.scale, 0, 0, this.scale, -camera.x * this.scale, 0);
        drawWeather(this, context, island, time, camera, reducedMotion, true);
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      const factor = this.quality.parallax ? layer.factor : 1;
      context.drawImage(layer.canvas, camera.x * layer.scale * factor, 0, visibleWidth * layer.scale, layer.canvas.height,
        0, 0, visibleWidth * this.scale, layer.height * this.scale);
    }
    context.setTransform(this.scale, 0, 0, this.scale, -camera.x * this.scale, 0);
    drawEnvironment(this, context, island, time, camera, reducedMotion);
    const { paper, ink, blue, pink } = this.colors;
    if (!reducedMotion) {
      for (let index = 0; !island.wildlife && index < 3; index += 1) {
        const positionX = this.width * (0.65 + index * 0.12) + Math.sin(time * 0.0004 + index * 2) * 22;
        const positionY = island.layout.water + 108 + index % 2 * 38;
        const direction = Math.cos(time * 0.0004 + index * 2) < 0 ? -1 : 1;
        oval(context, positionX, positionY, 9, 3.4, paint(index % 2 ? pink : blue, 0.30));
        polygon(context, [[positionX - direction * 8, positionY], [positionX - direction * 15, positionY - 4], [positionX - direction * 15, positionY + 4]], paint(blue, 0.24));
      }
      const boatX = this.width * 0.9 + Math.sin(time * 0.000045) * this.width * 0.035;
      const boatY = this.height * (this.map.horizon - (island.expedition ? 0.09 : 0)) + 68 + Math.sin(time * 0.0008) * 1.3;
      polygon(context, [[boatX - 14, boatY], [boatX + 15, boatY], [boatX + 9, boatY + 5], [boatX - 8, boatY + 5]], paint(mix(ink, paper, 0.52)));
      polygon(context, [[boatX - 1, boatY - 35], [boatX - 1, boatY - 3], [boatX - 19, boatY - 3]], paint(paper, 0.83));
      polygon(context, [[boatX + 1, boatY - 29], [boatX + 1, boatY - 3], [boatX + 14, boatY - 3]], paint(mix(paper, this.colors.yellow, 0.09), 0.8));
    }
    const center = island.blobPosition();
    const shadow = body => {
      const shade = projectShadow(island, body);
      if (shade.alpha <= 0.005) return;
      oval(context, shade.x, shade.y, shade.radiusX * shade.softness, shade.radiusY * 1.7, paint(ink, shade.alpha * 0.28));
      oval(context, shade.x, shade.y, shade.radiusX, shade.radiusY, paint(ink, shade.alpha * 0.78));
    };
    this.drawTree(context, island, time);
    const drawToy = prop => {
      const position = prop.body.position;
      shadow({ ...position, width: prop.width || prop.radius * 2, height: prop.height || prop.radius * 2, depth: prop.depth || 0, floating: prop.submerged > 0.05 && prop.density < 1, aquatic: prop.submerged > 0.5 });
      if (prop.ropes) {
        context.strokeStyle = paint(this.colors.wood, 0.82); context.lineWidth = 2;
        for (const rope of prop.ropes) {
          const cosine = Math.cos(prop.body.angle), sine = Math.sin(prop.body.angle);
          context.beginPath(); context.moveTo(rope.pointA.x, rope.pointA.y);
          context.lineTo(position.x + rope.pointB.x * cosine - rope.pointB.y * sine, position.y + rope.pointB.x * sine + rope.pointB.y * cosine); context.stroke();
        }
      }
      context.save(); context.translate(Math.sin(time * 0.0015 + position.y * 0.04) * prop.submerged * 1.6, 0);
      if (prop.kind === 'food') drawFoodPortion(this, context, prop, time); else drawProp(this, context, prop);
      context.restore();
    };
    const residents = [...(island.wildlife?.residents || [])].sort((first, second) => first.depth - second.depth);
    const drawResident = resident => {
      if (resident.body.position.x < camera.x - 90 || resident.body.position.x > camera.x + camera.viewWidth + 90) return;
      shadow({ ...resident.body.position, width: resident.width, height: resident.height, depth: resident.depth, aquatic: resident.immersion > 0.5 });
      context.save(); context.translate(Math.sin(time * 0.0015 + resident.body.position.y * 0.04) * resident.immersion * 1.6, 0);
      if (!drawLocalResident(this, context, resident, time)) drawCreature(this, context, resident, time);
      drawReaction(this, context, resident, time);
      const shineX = resident.body.position.x + Math.cos(island.environment.sun.azimuth) * resident.width * 0.12;
      oval(context, shineX, resident.body.position.y + resident.depth - resident.height * 0.23, resident.width * 0.16, Math.max(0.7, resident.height * 0.028), paint(paper, 0.10 + this.map.warmth * 0.04));
      context.restore();
    };
    const drawBlobby = () => {
      shadow({ ...center, width: 80, height: 80, depth: island.blob.depth, floating: center.x > island.layout.waterStart && center.x < island.layout.waterEnd && Math.abs(center.y - island.layout.water) < 50 });
      if (!reducedMotion) this.captureBlob(island, camera); else this.refraction = null;
      context.save(); context.translate(0, island.blob.depth);
      const held = [...island.drags.values()].some(drag => drag.kind === 'blob');
      const moment = island.blob.anticUntil > time;
      if (!held && (moment || island.blob.fidgetUntil > time)) {
        const kind = moment ? island.blob.antic : island.blob.fidget;
        const start = moment ? island.blob.anticStart : island.blob.fidgetStart;
        const pose = comicPose(kind, (time - start) / (moment ? 2500 : 800));
        context.translate(center.x, center.y); context.scale(pose.scaleX, pose.scaleY); context.rotate(pose.rotation * 0.5); context.translate(-center.x, -center.y);
      }
      drawBlob(this, context, island, time, pointer, delta); context.restore();
    };
    const sprites = [...(island.wildlife?.foraging.patches || []).filter(patch => patch.x > camera.x - 50 && patch.x < camera.x + camera.viewWidth + 50).map(patch => ({ depth: patch.depth, priority: -1, draw: () => drawForagePatch(this, context, patch, time, this.wind) })),
      ...island.props.map(prop => ({ depth: prop.depth || 0, priority: 0, draw: () => drawToy(prop) })),
      ...residents.map(resident => ({ depth: resident.depth, priority: 2, draw: () => drawResident(resident) })),
      { depth: island.blob.depth, priority: island.blob.depth > 18 ? 1 : 3, draw: drawBlobby }].sort((first, second) => first.depth - second.depth || first.priority - second.priority);
    for (const sprite of sprites.filter(item => item.depth <= 18)) sprite.draw();
    this.drawWater(context, island, time);
    drawSwash(this, context, island, camera);
    for (const sprite of sprites.filter(item => item.depth > 18)) sprite.draw();
    context.fillStyle = paint(this.colors.yellow, this.map.warmth * 0.055);
    context.fillRect(camera.x, 0, camera.viewWidth, this.height);
    drawWeather(this, context, island, time, camera, reducedMotion, false);
    drawObjectiveEffects(this, context, island, time);
    drawComicEffects(this, context, island, time);
    this.reducedMotion = reducedMotion;
    if (island.wildlife) drawCreatureBubbles(this, context, island, time, camera);
    for (const drag of island.drags.values()) {
      context.strokeStyle = paint(paper, 0.55); context.lineWidth = 1.1;
      context.beginPath(); context.arc(drag.target.x, drag.target.y, 17, 0, TAU); context.stroke();
    }
  }
}