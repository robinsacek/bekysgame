import { drawBlob, drawProp, drawLogo } from './sprites.js';

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
    this.background = document.createElement('canvas');
    this.background.width = canvas.width;
    this.background.height = canvas.height;
    const background = this.background.getContext('2d', { alpha: false });
    background.scale(this.scale, this.scale);
    this.drawBackground(background, island);
    drawLogo(this);
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

  palm(context, positionX, baseY, height, lean, scale = 1) {
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
    [[-174, 22], [-143, -43], [-64, -80], [30, -86], [128, -60], [186, -4], [178, 69], [73, 96], [-107, 77]].forEach(([targetX, targetY], index) => this.frond(context, targetX, targetY, paint(mix(leaf, green, index % 3 * 0.19))));
    oval(context, -9, 13, 10, 13, paint(wood)); oval(context, 8, 17, 10, 12, paint(mix(wood, yellow, 0.20))); oval(context, 0, 0, 12, 10, paint(leaf));
    context.restore();
  }

  drawBackground(context, island) {
    const { width, height } = this;
    const { ground, bottom, shore, toe, water, waterStart } = island.layout;
    const { paper, ink, blue, green, yellow, sand, leaf, ocean } = this.colors;
    const random = randomSource();
    const horizon = height * 0.405;
    const sky = context.createLinearGradient(0, 0, 0, horizon + 70);
    sky.addColorStop(0, paint(this.dark ? mix(ink, blue, 0.26) : mix(paper, blue, 0.23)));
    sky.addColorStop(1, paint(this.dark ? mix(ink, blue, 0.38) : mix(paper, yellow, 0.035)));
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    oval(context, width * 0.77, 170, 33, 33, paint(mix(paper, yellow, 0.13), 0.95));
    this.cloud(context, width * 0.28, 180, 0.9, 0.55); this.cloud(context, width * 0.60, 240, 0.64, 0.50);
    this.cloud(context, width * 0.97, 275, 1.05, 0.52); this.cloud(context, width * 0.015, 255, 0.61, 0.44);
    const sea = context.createLinearGradient(0, horizon, 0, ground + 40);
    sea.addColorStop(0, paint(mix(blue, paper, 0.46))); sea.addColorStop(0.6, paint(mix(ocean, paper, 0.50))); sea.addColorStop(1, paint(mix(ocean, paper, 0.64)));
    context.fillStyle = sea; context.fillRect(0, horizon, width, height - horizon);
    const islandX = width * 0.68;
    const islandWidth = Math.min(360, width * 0.37);
    context.beginPath(); context.moveTo(islandX - islandWidth * 0.60, horizon + 11);
    context.bezierCurveTo(islandX - islandWidth * 0.38, horizon - 16, islandX - islandWidth * 0.22, horizon - 119, islandX, horizon - 112);
    context.bezierCurveTo(islandX + islandWidth * 0.12, horizon - 120, islandX + islandWidth * 0.18, horizon - 36, islandX + islandWidth * 0.26, horizon - 45);
    context.bezierCurveTo(islandX + islandWidth * 0.42, horizon - 42, islandX + islandWidth * 0.49, horizon, islandX + islandWidth * 0.66, horizon + 14);
    context.closePath(); context.fillStyle = paint(mix(green, mix(blue, paper, 0.52), 0.69)); context.fill();
    polygon(context, [[islandX - islandWidth * 0.13, horizon - 94], [islandX - islandWidth * 0.01, horizon - 109], [islandX + islandWidth * 0.20, horizon + 9], [islandX - islandWidth * 0.30, horizon + 9]], paint(mix(leaf, paper, 0.50), 0.25));
    oval(context, islandX, horizon + 15, islandWidth * 0.68, 6, paint(mix(paper, yellow, 0.19)));
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
    this.palm(context, width * 0.027, ground - 30, 248, -18, palmScale * 0.77);
    this.palm(context, width * 0.105, ground - 8, 325, 93, palmScale);
    const beach = context.createLinearGradient(0, ground, 0, height);
    beach.addColorStop(0, paint(mix(sand, paper, 0.34))); beach.addColorStop(0.65, paint(sand)); beach.addColorStop(1, paint(mix(sand, yellow, 0.12)));
    polygon(context, [[0, ground], [shore, ground], [toe, bottom], [width, bottom], [width, height], [0, height]], beach);
    context.strokeStyle = paint(paper, 0.62); context.lineWidth = 4; context.lineJoin = 'round';
    context.beginPath(); context.moveTo(0, ground + 1); context.lineTo(shore, ground + 1); context.lineTo(toe, bottom + 1); context.lineTo(width, bottom + 1); context.stroke();
    for (let index = 0; index < 760; index += 1) {
      const positionX = random() * width;
      const floor = positionX < shore ? ground : positionX < toe ? ground + (positionX - shore) / (toe - shore) * (bottom - ground) : bottom;
      oval(context, positionX, floor + 8 + random() * (height - floor), 0.6 + random() * 1.4, 0.4 + random() * 0.6, paint(random() > 0.45 ? paper : mix(yellow, ink, 0.30), 0.18 + random() * 0.2));
    }
    for (let index = 0; index < 15; index += 1) {
      const positionX = waterStart + random() * (width - waterStart);
      const floor = positionX < toe ? ground + (positionX - shore) / (toe - shore) * (bottom - ground) : bottom;
      oval(context, positionX, floor + 3, 4 + random() * 8, 2 + random() * 3, paint(mix(sand, ink, 0.34), 0.43));
      if (index % 3 === 0) for (let blade = 0; blade < 5; blade += 1) this.leaf(context, positionX, floor, 23 + random() * 35, 4, -2.1 + blade * 0.23, paint(mix(green, ocean, 0.26), 0.54));
    }
    const shallow = context.createLinearGradient(0, water, 0, bottom);
    shallow.addColorStop(0, paint(mix(ocean, paper, 0.39), 0.18)); shallow.addColorStop(1, paint(mix(ocean, blue, 0.25), 0.30));
    polygon(context, [[waterStart, water], [width, water], [width, bottom], [toe, bottom]], shallow);
  }

  addSplash(event) {
    for (let index = 0; index < Math.min(18, Math.ceil(event.strength * 3)); index += 1) this.droplets.push({ x: event.x, y: event.y, velocityX: (this.random() - 0.5) * (event.strength + 2) * 24, velocityY: -(45 + this.random() * 65 + event.strength * 15), start: event.time, radius: 1 + this.random() * 2 });
    this.droplets = this.droplets.slice(-120);
    this.ripples.push({ x: event.x, start: event.time }); this.ripples = this.ripples.slice(-20);
  }

  drawWater(context, island, time) {
    const { paper, ocean, blue } = this.colors;
    const { waterStart, water, bottom } = island.layout;
    const waterPath = () => {
      context.beginPath();
      island.waves.forEach((wave, index) => {
        const positionX = waterStart + index / (island.waves.length - 1) * (this.width - waterStart);
        if (index === 0) context.moveTo(positionX, water + wave.offset);
        else context.lineTo(positionX, water + wave.offset);
      });
    };
    waterPath(); context.lineTo(this.width, bottom + 12); context.lineTo(island.layout.toe, bottom + 12); context.closePath();
    const wash = context.createLinearGradient(0, water, 0, bottom);
    wash.addColorStop(0, paint(mix(ocean, paper, 0.35), 0.11)); wash.addColorStop(1, paint(mix(blue, ocean, 0.6), 0.19));
    context.fillStyle = wash; context.fill();
    waterPath(); context.strokeStyle = paint(paper, 0.87); context.lineWidth = 2.5; context.stroke();
    waterPath(); context.strokeStyle = paint(ocean, 0.40); context.lineWidth = 0.7; context.stroke();
    for (let index = 0; index < 7; index += 1) {
      const positionX = waterStart + ((index * 139 + time * 0.009) % (this.width - waterStart));
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

  draw(island, time, pointer, reducedMotion) {
    const context = this.context;
    const delta = clamp(time - this.lastTime, 0, 40); this.lastTime = time;
    context.setTransform(1, 0, 0, 1, 0, 0); context.drawImage(this.background, 0, 0);
    context.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const { paper, ink, blue, pink } = this.colors;
    if (!reducedMotion) {
      for (let index = 0; index < 3; index += 1) {
        const positionX = this.width * (0.65 + index * 0.12) + Math.sin(time * 0.0004 + index * 2) * 22;
        const positionY = island.layout.water + 108 + index % 2 * 38;
        const direction = Math.cos(time * 0.0004 + index * 2) < 0 ? -1 : 1;
        oval(context, positionX, positionY, 9, 3.4, paint(index % 2 ? pink : blue, 0.30));
        polygon(context, [[positionX - direction * 8, positionY], [positionX - direction * 15, positionY - 4], [positionX - direction * 15, positionY + 4]], paint(blue, 0.24));
      }
      const boatX = this.width * 0.9 + Math.sin(time * 0.000045) * this.width * 0.035;
      const boatY = 433 + Math.sin(time * 0.0008) * 1.3;
      polygon(context, [[boatX - 14, boatY], [boatX + 15, boatY], [boatX + 9, boatY + 5], [boatX - 8, boatY + 5]], paint(mix(ink, paper, 0.52)));
      polygon(context, [[boatX - 1, boatY - 35], [boatX - 1, boatY - 3], [boatX - 19, boatY - 3]], paint(paper, 0.83));
      polygon(context, [[boatX + 1, boatY - 29], [boatX + 1, boatY - 3], [boatX + 14, boatY - 3]], paint(mix(paper, this.colors.yellow, 0.09), 0.8));
    }
    const center = island.blobPosition();
    const { ground, shore, toe, bottom } = island.layout;
    const floor = center.x < shore ? ground : center.x < toe ? ground + (center.x - shore) / (toe - shore) * (bottom - ground) : bottom;
    const elevation = Math.max(0, floor - center.y - island.blob.radius);
    oval(context, center.x, floor + 3, clamp(31 - elevation * 0.04, 10, 31), 4, paint(ink, 0.12 * Math.max(0.15, 1 - elevation / 420)));
    for (const prop of island.props) drawProp(this, context, prop);
    drawBlob(this, context, island, time, pointer, delta);
    this.drawWater(context, island, time);
    for (const drag of island.drags.values()) {
      context.strokeStyle = paint(paper, 0.55); context.lineWidth = 1.1;
      context.beginPath(); context.arc(drag.target.x, drag.target.y, 17, 0, TAU); context.stroke();
    }
  }
}