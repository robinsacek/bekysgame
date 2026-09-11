import { drawMapObject } from './map-art.js';

const TAU = Math.PI * 2;

function star(context, positionX, positionY, radius, color, points = 4) {
  context.fillStyle = color; context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const angle = index / (points * 2) * TAU - Math.PI / 2;
    const length = radius * (index % 2 ? 0.38 : 1);
    const point = [positionX + Math.cos(angle) * length, positionY + Math.sin(angle) * length];
    if (index === 0) context.moveTo(...point); else context.lineTo(...point);
  }
  context.closePath(); context.fill();
}

export function drawProp(art, context, prop) {
  const { paint, mix, oval } = art;
  const { paper, ink, blue, pink, yellow, green, wood } = art.colors;
  const { body, kind, radius, width, height } = prop;
  context.save(); context.translate(body.position.x, body.position.y + (prop.depth || 0)); context.rotate(body.angle);
  if (kind === 'ball') {
    oval(context, 0, 0, radius, radius, paint(paper));
    [pink, yellow, blue].forEach((color, index) => {
      context.fillStyle = paint(mix(color, paper, 0.17)); context.beginPath(); context.moveTo(0, 0);
      context.arc(0, 0, radius, index * TAU / 3, index * TAU / 3 + TAU / 6); context.closePath(); context.fill();
    });
    oval(context, 0, 0, radius * 0.14, radius * 0.14, paint(paper));
    const shine = context.createRadialGradient(-radius * 0.35, -radius * 0.40, 1, 0, 0, radius * 1.15);
    shine.addColorStop(0, paint(paper, 0.45)); shine.addColorStop(0.48, paint(paper, 0)); shine.addColorStop(1, paint(ink, 0.16));
    oval(context, 0, 0, radius, radius, shine);
    context.strokeStyle = paint(ink, 0.16); context.lineWidth = 1;
    context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.stroke();
  } else if (kind === 'ring') {
    context.lineWidth = radius * 0.47; context.strokeStyle = paint(mix(paper, yellow, 0.06));
    context.beginPath(); context.arc(0, 0, radius * 0.77, 0, TAU); context.stroke();
    context.strokeStyle = paint(mix(pink, paper, 0.14));
    for (let index = 0; index < 4; index += 1) {
      context.beginPath(); context.arc(0, 0, radius * 0.77, index * TAU / 4, index * TAU / 4 + 0.48); context.stroke();
    }
    context.strokeStyle = paint(paper, 0.76); context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, radius * 0.85, Math.PI * 1.12, Math.PI * 1.72); context.stroke();
  } else if (kind === 'stone') {
    const rock = context.createRadialGradient(-radius * 0.35, -radius * 0.45, 1, 0, 0, radius);
    rock.addColorStop(0, paint(mix(paper, ink, 0.35))); rock.addColorStop(1, paint(mix(ink, paper, 0.37)));
    oval(context, 0, 0, radius, radius * 0.85, rock);
    oval(context, -radius * 0.2, -radius * 0.3, radius * 0.45, radius * 0.12, paint(paper, 0.32), -0.2);
  } else if (kind === 'swing') {
    const leaf = context.createLinearGradient(0, -height, 0, height);
    leaf.addColorStop(0, paint(mix(green, yellow, 0.22))); leaf.addColorStop(1, paint(mix(green, ink, 0.27)));
    context.fillStyle = leaf; context.beginPath(); context.moveTo(-width / 2, 0);
    context.bezierCurveTo(-width * 0.28, -height, width * 0.22, -height, width / 2, 0);
    context.quadraticCurveTo(0, height * 0.95, -width / 2, 0); context.fill();
    context.strokeStyle = paint(mix(yellow, paper, 0.18), 0.55); context.lineWidth = 1;
    context.beginPath(); context.moveTo(-width * 0.42, 0); context.lineTo(width * 0.42, 0); context.stroke();
    for (let index = -3; index <= 3; index += 1) { context.beginPath(); context.moveTo(index * 10, 0); context.lineTo(index * 10 - 6, -height * 0.44); context.stroke(); }
  } else if (kind === 'chest') {
    const gold = mix(yellow, paper, 0.16);
    const lid = prop.lid || 0;
    const lidTop = -height * 0.5 - lid * 36;
    const lidBottom = -height * 0.12 - lid * 8;
    const timber = context.createLinearGradient(0, lidTop, 0, height / 2);
    timber.addColorStop(0, paint(mix(wood, yellow, 0.3))); timber.addColorStop(1, paint(mix(wood, ink, 0.15)));
    context.fillStyle = timber; context.beginPath(); context.moveTo(-width / 2, lidBottom);
    context.lineTo(-width / 2, lidTop + 9); context.quadraticCurveTo(-width / 2, lidTop, -width / 2 + 9, lidTop);
    context.lineTo(width / 2 - 9, lidTop); context.quadraticCurveTo(width / 2, lidTop, width / 2, lidTop + 9);
    context.lineTo(width / 2, lidBottom); context.closePath(); context.fill();
    context.strokeStyle = paint(mix(wood, ink, 0.3)); context.lineWidth = 1.5; context.stroke();
    context.strokeStyle = paint(ink, 0.22); context.lineWidth = 1;
    for (let plank = 1; plank < 4; plank += 1) {
      const positionY = lidTop + (lidBottom - lidTop) * plank / 4;
      context.beginPath(); context.moveTo(-width / 2 + 3, positionY); context.lineTo(width / 2 - 3, positionY); context.stroke();
    }
    for (const offset of [-0.32, 0.32]) {
      context.fillStyle = paint(gold); context.fillRect(width * offset - 3, lidTop + 2, 6, lidBottom - lidTop - 1);
    }
    if (lid > 0.05) oval(context, 0, -4, width * 0.48, 5 + lid * 6, paint(mix(ink, wood, 0.22)));
    context.fillStyle = timber; context.fillRect(-width / 2, -3, width, height / 2 + 3);
    context.strokeStyle = paint(mix(wood, ink, 0.3)); context.lineWidth = 1.3; context.strokeRect(-width / 2, -3, width, height / 2 + 3);
    context.strokeStyle = paint(ink, 0.18); context.lineWidth = 1;
    context.beginPath(); context.moveTo(-width / 2, 11); context.lineTo(width / 2, 11); context.stroke();
    for (const offset of [-0.32, 0.32]) {
      context.fillStyle = paint(gold); context.fillRect(width * offset - 3, -3, 6, height / 2 + 3);
      for (const positionY of [2, 18]) oval(context, width * offset, positionY, 1.3, 1.3, paint(mix(wood, ink, 0.2)));
    }
    context.strokeStyle = paint(gold); context.lineWidth = 2.5;
    context.strokeRect(-width / 2 + 1, -3, width - 2, height / 2 + 2);
    const latchY = lid > 0.2 ? lidBottom - 7 : -7;
    context.fillStyle = paint(gold); context.beginPath(); context.roundRect(-7, latchY, 14, 15, 3); context.fill();
    oval(context, 0, latchY + 6, 2, 2, paint(ink)); context.fillStyle = paint(ink); context.fillRect(-1, latchY + 6, 2, 4);
    if (!lid) star(context, width * 0.3, -height * 0.47, 4 + Math.sin((art.animationTime || 0) * 0.004), paint(paper, 0.85));
  } else if (kind === 'coin') {
    oval(context, 0, 1, radius, radius, paint(mix(yellow, wood, 0.4)));
    oval(context, 0, -1, radius, radius * 0.9, paint(yellow));
    context.strokeStyle = paint(mix(yellow, paper, 0.5)); context.lineWidth = 1.5;
    context.beginPath(); context.ellipse(0, -1, radius * 0.75, radius * 0.67, 0, 0, TAU); context.stroke();
    star(context, 0, -1, radius * 0.5, paint(mix(yellow, wood, 0.36)), 5);
    star(context, -radius * 0.55, -radius * 0.65, 3.5, paint(paper, 0.9));
  } else if (kind === 'gold') {
    context.fillStyle = paint(yellow); context.beginPath(); context.moveTo(-width * 0.4, -height / 2);
    context.lineTo(width * 0.4, -height / 2); context.lineTo(width / 2, height / 2); context.lineTo(-width / 2, height / 2); context.closePath(); context.fill();
    context.fillStyle = paint(mix(yellow, paper, 0.38)); context.fillRect(-width * 0.4, -height / 2, width * 0.8, height * 0.3);
    context.strokeStyle = paint(mix(yellow, wood, 0.35)); context.lineWidth = 1.4; context.strokeRect(-width / 2 + 2, height * 0.12, width - 4, height * 0.35);
    star(context, width * 0.25, -height * 0.45, 4, paint(paper, 0.95));
  } else if (kind === 'gem') {
    const color = prop.treasureId % 2 ? pink : mix(blue, green, 0.3);
    context.fillStyle = paint(color); context.beginPath(); context.moveTo(0, -radius); context.lineTo(radius, -radius * 0.25);
    context.lineTo(radius * 0.65, radius * 0.55); context.lineTo(0, radius); context.lineTo(-radius * 0.65, radius * 0.55); context.lineTo(-radius, -radius * 0.25); context.closePath(); context.fill();
    context.fillStyle = paint(mix(color, paper, 0.55)); context.beginPath(); context.moveTo(0, -radius); context.lineTo(radius, -radius * 0.25); context.lineTo(0, 0); context.lineTo(-radius, -radius * 0.25); context.closePath(); context.fill();
    context.fillStyle = paint(mix(color, ink, 0.18)); context.beginPath(); context.moveTo(0, 0); context.lineTo(radius, -radius * 0.25); context.lineTo(0, radius); context.closePath(); context.fill();
    context.strokeStyle = paint(paper, 0.65); context.lineWidth = 1; context.beginPath(); context.moveTo(0, -radius); context.lineTo(0, 0); context.lineTo(-radius * 0.65, radius * 0.55); context.stroke();
    star(context, -radius * 0.55, -radius * 0.55, 4, paint(paper, 0.95));
  } else if (kind === 'crate') {
    context.fillStyle = paint(mix(wood, yellow, 0.36)); context.fillRect(-width / 2, -height / 2, width, height);
    context.strokeStyle = paint(mix(wood, ink, 0.15)); context.lineWidth = 1.8;
    for (let index = 1; index < 4; index += 1) {
      context.beginPath(); context.moveTo(-width / 2, -height / 2 + height * index / 4); context.lineTo(width / 2, -height / 2 + height * index / 4); context.stroke();
    }
    context.strokeStyle = paint(mix(wood, paper, 0.28)); context.lineWidth = 4;
    context.strokeRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
    context.beginPath(); context.moveTo(-width / 2 + 3, -height / 2 + 3); context.lineTo(width / 2 - 3, height / 2 - 3); context.stroke();
    for (const cornerX of [-1, 1]) for (const cornerY of [-1, 1]) oval(context, cornerX * (width / 2 - 4), cornerY * (height / 2 - 4), 1.1, 1.1, paint(ink, 0.7));
    context.strokeStyle = paint(ink, 0.13); context.lineWidth = 0.6;
    for (let grain = 0; grain < 7; grain += 1) { const elevation = -height * 0.37 + grain * height * 0.12; context.beginPath(); context.moveTo(-width * 0.36, elevation); context.bezierCurveTo(-4, elevation - 1.5, 4, elevation + 1.5, width * 0.36, elevation); context.stroke(); }
  } else if (kind === 'shell') {
    const shell = context.createRadialGradient(-radius * 0.3, -radius * 0.2, 1, 0, 0, radius);
    shell.addColorStop(0, paint(paper)); shell.addColorStop(1, paint(mix(pink, paper, 0.60)));
    oval(context, 0, 0, radius, radius * 0.9, shell);
    context.strokeStyle = paint(mix(pink, wood, 0.3), 0.46); context.lineWidth = 1.2;
    for (let index = 0; index < 7; index += 1) {
      const angle = Math.PI + index / 6 * Math.PI;
      context.beginPath(); context.moveTo(0, radius * 0.85); context.quadraticCurveTo(Math.cos(angle) * radius * 0.35, 0, Math.cos(angle) * radius * 0.92, Math.sin(angle) * radius * 0.8); context.stroke();
    }
  } else if (kind === 'raft' || kind === 'seesaw') {
    for (let index = 0; index < 3; index += 1) {
      const top = -height / 2 + index * height / 3;
      const log = context.createLinearGradient(0, top, 0, top + height / 3);
      log.addColorStop(0, paint(mix(yellow, paper, 0.39))); log.addColorStop(0.45, paint(mix(wood, yellow, 0.50))); log.addColorStop(1, paint(wood));
      context.fillStyle = log; context.fillRect(-width / 2, top, width, height / 3 - 0.4);
      oval(context, -width / 2, top + height / 6, 3.2, height / 6, paint(mix(wood, paper, 0.32)));
      oval(context, width / 2, top + height / 6, 3.2, height / 6, paint(mix(wood, paper, 0.48)));
      context.strokeStyle = paint(ink, 0.14); context.lineWidth = 0.65;
      for (const joint of [-0.14, 0.19]) { context.beginPath(); context.moveTo(width * joint, top + 1); context.lineTo(width * joint + 1.5, top + height / 3 - 1); context.stroke(); }
    }
    for (const offset of [-0.30, 0.30]) {
      context.strokeStyle = paint(mix(wood, ink, 0.32)); context.lineWidth = 2;
      for (let wrap = 0; wrap < 3; wrap += 1) {
        context.beginPath(); context.moveTo(width * offset + wrap * 2, -height / 2 - 1); context.lineTo(width * offset + wrap * 2 - 2, height / 2 + 1); context.stroke();
      }
    }
  } else if (kind === 'coconut') {
    const skin = context.createRadialGradient(-radius * 0.4, -radius * 0.5, 1, 0, 0, radius);
    skin.addColorStop(0, paint(mix(wood, yellow, 0.23))); skin.addColorStop(1, paint(mix(wood, ink, 0.23)));
    oval(context, 0, 0, radius, radius, skin);
    context.strokeStyle = paint(paper, 0.18); context.lineWidth = 0.8;
    for (let index = -2; index <= 2; index += 1) {
      context.beginPath(); context.moveTo(index * radius * 0.22, -radius * 0.83);
      context.quadraticCurveTo(index * radius * 0.55 - 7, 0, index * radius * 0.26, radius * 0.87); context.stroke();
    }
    for (const [offsetX, offsetY] of [[-4, -7], [3, -6], [-1, 0]]) oval(context, offsetX, offsetY, 2, 2.4, paint(ink, 0.52));
    context.strokeStyle = paint(paper, 0.16); context.lineWidth = 0.45;
    for (let fiber = 0; fiber < 18; fiber += 1) { const angle = fiber / 18 * TAU; context.beginPath(); context.moveTo(Math.cos(angle) * radius * 0.63, Math.sin(angle) * radius * 0.63); context.lineTo(Math.cos(angle + 0.035) * radius * 0.88, Math.sin(angle + 0.035) * radius * 0.88); context.stroke(); }
  } else if (kind === 'bottle') {
    context.fillStyle = paint(mix(green, blue, 0.40), 0.38); context.strokeStyle = paint(mix(green, ink, 0.26), 0.7); context.lineWidth = 1.3;
    context.beginPath(); context.moveTo(-width * 0.23, -height / 2); context.lineTo(width * 0.23, -height / 2);
    context.lineTo(width * 0.23, -height * 0.23); context.quadraticCurveTo(width / 2, -height * 0.17, width / 2, 0);
    context.lineTo(width / 2, height * 0.38); context.quadraticCurveTo(width / 2, height / 2, width * 0.2, height / 2);
    context.lineTo(-width * 0.2, height / 2); context.quadraticCurveTo(-width / 2, height / 2, -width / 2, height * 0.38);
    context.lineTo(-width / 2, 0); context.quadraticCurveTo(-width / 2, -height * 0.17, -width * 0.23, -height * 0.23);
    context.closePath(); context.fill(); context.stroke();
    context.fillStyle = paint(mix(paper, yellow, 0.17), 0.88); context.fillRect(-width * 0.24, 0, width * 0.48, height * 0.36);
    context.fillStyle = paint(wood); context.fillRect(-width * 0.26, -height / 2, width * 0.52, 6);
    context.fillStyle = paint(paper, 0.73); context.fillRect(-width * 0.29, -height * 0.13, 1.8, height * 0.42);
  } else drawMapObject(art, context, prop);
  context.restore();
}

export function blobPath(context, points) {
  const last = points[points.length - 1];
  context.beginPath(); context.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  });
  context.closePath();
}

export function blobDrawingPoints(island) {
  const center = island.blobPosition();
  return island.blob.ring.map(body => {
    const differenceX = body.position.x - center.x;
    const differenceY = body.position.y - center.y;
    const distance = Math.hypot(differenceX, differenceY) || 1;
    return { x: body.position.x + differenceX / distance * 5, y: body.position.y + differenceY / distance * 5 };
  });
}

export function drawBlob(art, context, island, time, pointer, delta) {
  const { paint, mix, oval, clamp } = art;
  const { paper, ink, pink } = art.colors;
  const center = island.blobPosition();
  const core = island.blob.center;
  const points = blobDrawingPoints(island);
  const bounds = { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)), top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) };
  const gradient = context.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
  const rim = context.createLinearGradient(bounds.left, bounds.bottom, bounds.right, bounds.top);
  const shimmer = island.blob.antic === 'colour-shimmer' && island.blob.anticUntil > time
    ? Math.sin((time - island.blob.anticStart) / 2500 * Math.PI) * 0.4 : 0;
  art.rainbow.forEach((color, index) => {
    gradient.addColorStop(index / 6, paint(mix(mix(color, art.rainbow[(index + 2) % 7], shimmer), paper, 0.13), art.refraction ? 0.38 : 0.44));
    rim.addColorStop(index / 6, paint(mix(color, paper, 0.12), 0.78));
  });
  if (art.refraction) {
    const image = art.refraction;
    context.save(); blobPath(context, points); context.clip();
    context.drawImage(image.canvas, image.x - image.width * 0.03, image.y - image.height * 0.03, image.width * 1.06, image.height * 1.06);
    context.restore();
  }
  blobPath(context, points); context.fillStyle = gradient; context.fill();
  context.strokeStyle = rim; context.lineWidth = 2.4; context.stroke();
  context.save(); blobPath(context, points); context.clip();
  const bodyWidth = bounds.right - bounds.left;
  const bodyHeight = bounds.bottom - bounds.top;
  art.rainbow.forEach((color, index) => {
    context.strokeStyle = paint(color, 0.065); context.lineWidth = 4;
    context.beginPath(); context.moveTo(bounds.left - 3, bounds.top + bodyHeight * (0.22 + index * 0.10));
    context.bezierCurveTo(bounds.left + bodyWidth * 0.25, bounds.top + bodyHeight * (index * 0.08 - 0.08), bounds.left + bodyWidth * 0.68, bounds.bottom - bodyHeight * 0.15, bounds.right + 2, bounds.top + bodyHeight * index * 0.11);
    context.stroke();
  });
  const light = Math.cos(island.environment.sun.azimuth);
  const sheen = context.createRadialGradient(center.x + light * 15, center.y - 19, 2, center.x, center.y, 47);
  sheen.addColorStop(0, paint(paper, 0.18)); sheen.addColorStop(0.48, paint(paper, 0));
  sheen.addColorStop(0.85, paint(paper, 0.025)); sheen.addColorStop(1, paint(paper, 0.32));
  context.fillStyle = sheen; context.fillRect(bounds.left - 2, bounds.top - 2, bounds.right - bounds.left + 4, bounds.bottom - bounds.top + 4);
  blobPath(context, points); context.strokeStyle = paint(paper, 0.12 + (island.blob.wetness || 0) * 0.14); context.lineWidth = 5; context.stroke();
  context.strokeStyle = paint(paper, 0.78); context.lineWidth = 2.2; context.lineCap = 'round';
  context.beginPath(); context.moveTo(center.x - 24, center.y - 6); context.quadraticCurveTo(center.x - 24, center.y - 23, center.x - 9, center.y - 26); context.stroke();
  oval(context, center.x + 18, center.y + 20, 4.5, 1.5, paint(paper, 0.52), -0.5); context.restore();
  if (island.blob.wetness > 0.3 && core.position.y < island.layout.water - 30) for (let drip = 0; drip < 3; drip += 1) {
    const age = (time * 0.0014 + drip * 0.37) % 1;
    oval(context, center.x + Math.sin(drip * 2.3) * 20, bounds.bottom + age * 17, 1.1, 1.8, paint(art.colors.blue, (1 - age) * island.blob.wetness * 0.35));
  }
  art.faceAngle += (clamp(core.velocity.x * 0.035, -0.30, 0.30) - art.faceAngle) * Math.min(1, delta * 0.009);
  context.save(); context.translate(center.x, center.y + 1); context.rotate(art.faceAngle);
  context.scale(clamp(bodyWidth / 86, 0.80, 1.6), clamp(bodyHeight / 66, 0.78, 1.12));
  const blink = time % 5900 > 5740;
  const rich = island.blob.richUntil > time && !(island.blob.ewwUntil > time);
  const fingers = [...island.drags.values()].filter(drag => drag.kind === 'blob');
  for (let index = 0; index < 2; index += 1) {
    const eyeX = index === 0 ? -10.5 : 10.5;
    const eyeY = index === 0 ? -5 : -6.2;
    const pupil = art.pupils[index];
    const lookAt = fingers.length > 1 ? fingers[index % fingers.length].target : pointer;
    const lookX = lookAt ? clamp((lookAt.x - center.x) / 110, -2.5, 2.5) : Math.sin(time * 0.0006) * 0.5;
    const lookY = lookAt ? clamp((lookAt.y - center.y - island.blob.depth) / 120, -1.6, 1.8) : 0.6;
    const targetX = clamp(lookX - core.velocity.x * 0.37, -3.9, 3.9);
    const targetY = clamp(lookY - core.velocity.y * 0.31 + 0.9, -3.3, 3.7);
    const tick = Math.min(2, delta / 16.667);
    pupil.velocityX = (pupil.velocityX + (targetX - pupil.x) * (0.22 + index * 0.015) * tick) * Math.pow(0.73, tick);
    pupil.velocityY = (pupil.velocityY + (targetY - pupil.y) * 0.21 * tick) * Math.pow(0.75, tick);
    pupil.x = clamp(pupil.x + pupil.velocityX * tick, -4.1, 4.1);
    pupil.y = clamp(pupil.y + pupil.velocityY * tick, -4.1, 4.1);
    if (blink) {
      context.strokeStyle = paint(ink, 0.85); context.lineWidth = 1.8;
      context.beginPath(); context.moveTo(eyeX - 6, eyeY); context.quadraticCurveTo(eyeX, eyeY + 3, eyeX + 6, eyeY); context.stroke();
    } else {
      oval(context, eyeX, eyeY + 1, 9, 9.7, paint(ink, 0.10));
      oval(context, eyeX, eyeY, 8.5, 9.2, paint(paper, 0.97));
      if (rich) star(context, eyeX + pupil.x * 0.4, eyeY, 6, paint(art.colors.yellow), 5);
      else {
        oval(context, eyeX + pupil.x, eyeY + pupil.y, 3.6, 4, paint(ink));
        oval(context, eyeX + pupil.x - 1, eyeY + pupil.y - 1.5, 1.05, 1.05, paint(paper));
      }
    }
  }
  const excited = rich || Math.hypot(core.velocity.x, core.velocity.y) > 5 || [...island.drags.values()].some(drag => drag.kind === 'blob');
  context.strokeStyle = paint(ink, 0.87); context.fillStyle = paint(ink, 0.91); context.lineWidth = 1.8; context.lineCap = 'round';
  context.beginPath(); context.moveTo(-6.5, 9); context.quadraticCurveTo(0, island.blob.ewwUntil > time ? 1 : excited ? 23 : 18, 7, 9);
  if (island.blob.ewwUntil > time) context.stroke();
  else if (island.blob.hiccupUntil > time || island.blob.tingleUntil > time) oval(context, 0, 11, 3.5, 4.5, paint(ink, 0.85));
  else if (excited) {
    context.quadraticCurveTo(0, 12, -6.5, 9); context.fill();
    oval(context, 0.5, 15.5, 3.1, 1.4, paint(mix(pink, paper, 0.28)));
  } else context.stroke();
  oval(context, -20, 6.5, 3.7, 1.8, paint(pink, 0.16)); oval(context, 20, 6.5, 3.7, 1.8, paint(pink, 0.16));
  context.restore();
  if (rich) for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI + index / 4 * Math.PI;
    star(context, center.x + Math.cos(angle) * (bodyWidth * 0.65 + 8), center.y + Math.sin(angle) * (bodyHeight * 0.7 + 12),
      4 + Math.sin(time * 0.007 + index) * 1.5, paint(art.colors.yellow, 0.9));
  }
}

export function drawLogo(art) {
  const { paint, oval } = art;
  const canvas = document.getElementById('brand-mark');
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(16, 12, 76, 75);
  art.rainbow.forEach((color, index) => gradient.addColorStop(index / 6, paint(color, 0.58)));
  context.beginPath(); context.moveTo(14, 59);
  context.bezierCurveTo(5, 26, 34, 7, 57, 16); context.bezierCurveTo(88, 20, 90, 65, 74, 76); context.bezierCurveTo(59, 90, 18, 87, 14, 59);
  context.fillStyle = gradient; context.fill(); context.strokeStyle = gradient; context.lineWidth = 3; context.stroke();
  for (const positionX of [34, 60]) {
    oval(context, positionX, 42, 10, 12, paint(art.colors.paper));
    oval(context, positionX + 1, 45, 4.3, 5, paint(art.colors.ink));
  }
  context.beginPath(); context.moveTo(38, 63); context.quadraticCurveTo(49, 75, 60, 62);
  context.strokeStyle = paint(art.colors.ink); context.lineWidth = 3; context.lineCap = 'round'; context.stroke();
}